"""程式合成的 X 光影像（無著作權疑慮）。

用法：python tools/gen_xray.py <輸出資料夾>
會產生：
  cxr-necklace.png  兒童胸部 PA，戴著項鍊（945×1033，項鍊座標與 ui.js 的 CHAIN 一致）
  ct-scout.png      腹部骨盆 CT 定位像（702×1310，標記高度與 ui.js rangeGame 一致）

原理：每個像素累積 X 光路徑上的「衰減量」——軟組織依厚度、肺和腸氣扣掉、
骨頭用中空管的投影（皮質較亮）、金屬近乎全吸收——再用 1 - exp(-k·D) 轉成亮度，
最後加上模糊、邊緣強化與雜訊，模擬數位放射影像的質感。
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter

rng = np.random.default_rng(11)


# ---------- 幾何小工具 ----------
def catmull(pts, n=16, closed=False):
    """Catmull-Rom 平滑曲線，讓輪廓不會有稜角。"""
    p = [np.array(q, np.float64) for q in pts]
    p = ([p[-1]] + p + [p[0], p[1]]) if closed else ([p[0]] + p + [p[-1]])
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    if not closed:
        out.append(p[-2])
    return [tuple(q) for q in out]


class Film:
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.D = np.zeros((H, W), np.float32)

    def mask(self, draw_fn, blur=0):
        im = Image.new('L', (self.W, self.H), 0)
        draw_fn(ImageDraw.Draw(im))
        m = np.asarray(im, np.float32) / 255
        return gaussian_filter(m, blur) if blur else m

    def shape(self, pts, closed=True, smooth=True):
        """平滑多邊形遮罩。"""
        poly = catmull(pts, 12, closed=True) if smooth else pts
        return self.mask(lambda d: d.polygon(poly, fill=255))

    def thickness(self, m, depth):
        """遮罩 → 圓潤的厚度（邊緣薄、中間厚），depth 是達到最厚所需的像素距離。"""
        d = distance_transform_edt(m > 0.5)
        return np.sqrt(np.clip(d / depth, 0, 1)).astype(np.float32)

    def tube(self, pts, r, cortex=0.55, smooth=True, taper=None):
        """骨頭：沿中心線的中空管投影，邊緣（皮質）比中間亮。只在包圍盒內計算以加快速度。"""
        line = catmull(pts, 12) if smooth and len(pts) > 2 else pts
        xs, ys = [q[0] for q in line], [q[1] for q in line]
        pad = int(r * 1.6) + 4
        x0, y0 = max(0, int(min(xs)) - pad), max(0, int(min(ys)) - pad)
        x1, y1 = min(self.W, int(max(xs)) + pad), min(self.H, int(max(ys)) + pad)
        if x1 <= x0 or y1 <= y0:
            return np.zeros((self.H, self.W), np.float32)
        im = Image.new('L', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(im).line([(a - x0, b - y0) for a, b in line], fill=255, width=1)
        d = distance_transform_edt(np.asarray(im) == 0)
        rr = r
        if taper is not None:  # 半徑沿長軸變化（例如肋骨往外變細）
            rr = r * taper(np.mgrid[y0:y1, x0:x1][1], np.mgrid[y0:y1, x0:x1][0])
        solid = np.sqrt(np.clip(1 - (d / rr) ** 2, 0, 1))
        inner = np.sqrt(np.clip(1 - (d / (rr * 0.72)) ** 2, 0, 1))
        out = np.zeros((self.H, self.W), np.float32)
        out[y0:y1, x0:x1] = solid - cortex * inner
        return out

    def oval(self, cx, cy, rx, ry, ang=0.0):
        y, x = np.mgrid[0:self.H, 0:self.W].astype(np.float32)
        c, s = np.cos(ang), np.sin(ang)
        u = ((x - cx) * c + (y - cy) * s) / rx
        v = (-(x - cx) * s + (y - cy) * c) / ry
        return np.sqrt(np.clip(1 - (u * u + v * v), 0, 1)).astype(np.float32)

    def vessels(self, hila, lung, gen=6, base_len=46, base_w=9, spread=0.55):
        """肺紋理：從肺門長出的分岔血管樹，越往周邊越細越淡。"""
        im = Image.new('L', (self.W, self.H), 0)
        d = ImageDraw.Draw(im)

        def grow(x, y, ang, length, w, g):
            if g == 0 or w < 1:
                return
            nx, ny = x + np.cos(ang) * length, y + np.sin(ang) * length
            d.line([(x, y), (nx, ny)], fill=int(min(255, 60 + w * 22)), width=max(1, int(round(w))))
            for k in (-1, 1):
                grow(nx, ny, ang + k * spread * rng.uniform(0.5, 1.2), length * rng.uniform(0.72, 0.9), w * 0.72, g - 1)

        for hx, hy, a0, a1 in hila:
            for ang in np.linspace(a0, a1, 6):
                grow(hx, hy, ang + rng.normal(0, 0.12), base_len, base_w, gen)
        return gaussian_filter(np.asarray(im, np.float32) / 255, 1.4) * lung

    def develop(self, k, gamma, blur, sharpen, noise, floor=0.0, mottle=0.04):
        """衰減量 → 影像。"""
        D = self.D * (1 + mottle * gaussian_filter(rng.normal(0, 1, self.D.shape), 10).astype(np.float32) * 3)
        img = 1 - np.exp(-k * np.clip(D, 0, None))
        img = gaussian_filter(img, blur)
        img = img + sharpen * (img - gaussian_filter(img, 8))
        img = np.clip(img, 0, 1) ** gamma
        img = floor + (1 - floor) * img
        img = img + rng.normal(0, noise, img.shape).astype(np.float32)
        img = gaussian_filter(img, 0.55)
        return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))


# ---------- 兒童胸部 PA（戴項鍊） ----------
def chest_xray(path):
    W, H, cx = 945, 1033, 472
    F = Film(W, H)

    # 軀幹（頸 → 斜方肌 → 肩 → 胸壁）與下垂的雙臂
    body = F.shape([(398, -40), (548, -40), (556, 110), (620, 158), (760, 182), (850, 214), (868, 330), (862, 620),
                    (872, 1080), (73, 1080), (83, 620), (77, 330), (95, 214), (185, 182), (325, 158), (390, 110)])
    F.D += 1.15 * F.thickness(body, 260)
    for side in (-1, 1):
        ax = cx + side * 445
        arm = F.shape([(ax - 70, 175), (ax + 70, 175), (ax + 75, 1080), (ax - 75, 1080)])
        F.D += 0.85 * F.thickness(arm, 70)

    # 肺：空氣讓衰減變少；越靠肺中央空氣越厚
    rl = F.shape([(335, 92), (262, 128), (190, 215), (150, 360), (130, 540), (128, 700), (142, 790), (152, 818),
                  (205, 782), (262, 744), (332, 722), (402, 716), (428, 700), (420, 600), (410, 470), (404, 330), (398, 200), (380, 118)])
    ll = F.shape([(612, 92), (680, 118), (742, 172), (800, 285), (838, 430), (856, 600), (858, 780), (842, 846),
                  (790, 772), (760, 700), (722, 612), (652, 522), (590, 440), (556, 380), (578, 312), (552, 262),
                  (550, 150), (570, 112)])
    lungs = np.maximum(rl, ll)
    air = F.thickness(lungs, 85)
    F.D -= 0.62 * gaussian_filter(air, 3)
    F.D += 0.2 * gaussian_filter(F.vessels([(414, 468, 1.9, 4.2), (556, 462, -1.2, 1.3)], gaussian_filter(lungs, 4), gen=5), 1.2)
    # 肺門較濃
    F.D += 0.18 * (F.oval(420, 470, 34, 60) + F.oval(552, 462, 30, 56))

    # 氣管與主支氣管（空氣柱）
    F.D -= 0.32 * F.tube([(474, -10), (476, 180), (478, 330)], 17, cortex=0)
    F.D -= 0.2 * F.tube([(474, 352), (448, 392), (418, 428)], 12, cortex=0)
    F.D -= 0.2 * F.tube([(484, 352), (515, 382), (552, 412)], 11, cortex=0)

    # 胃泡與腸氣（左上腹＝影像右側）
    F.D -= 0.55 * gaussian_filter(F.oval(715, 905, 72, 38, 0.1), 4)
    for _ in range(14):
        bx, by = rng.uniform(560, 830), rng.uniform(950, 1040)
        F.D -= 0.25 * gaussian_filter(F.oval(bx, by, rng.uniform(16, 34), rng.uniform(12, 24), rng.uniform(0, 3)), 3)

    bone = np.zeros((H, W), np.float32)
    # 脊椎：椎體＋椎弓根（被縱膈遮住，只淡淡看得到）
    for vy in np.arange(-10, H, 47):
        body_v = F.shape([(cx - 30, vy), (cx + 32, vy), (cx + 34, vy + 36), (cx - 32, vy + 36)])
        bone += 0.28 * F.thickness(body_v, 10)
        bone += 0.22 * (F.tube([(cx - 30, vy + 8), (cx - 30, vy + 22)], 7) + F.tube([(cx + 32, vy + 8), (cx + 32, vy + 22)], 7))
        bone += 0.12 * F.tube([(cx + 1, vy + 18), (cx + 1, vy + 40)], 6)

    # 肋骨：後段（從脊椎往外微升再沿胸壁往下）＋前段（往內下，較淡）
    def lat_x(yy):
        return np.interp(yy, [100, 180, 300, 520, 800], [250, 185, 140, 118, 118])

    for i in range(10):
        y0 = 132 + i * 61
        for s in (-1, 1):
            lx = lat_x(y0 + 40)
            post = [(cx + s * 44, y0), (cx + s * 105, y0 - 16), (cx + s * 190, y0 - 10),
                    (cx + s * (cx - lx - 30), y0 + 22), (cx + s * (cx - lx + 4), y0 + 72)]
            bone += 0.55 * F.tube(post, 12.5 - i * 0.3, cortex=0.45)
            ant = [(cx + s * (cx - lx + 4), y0 + 72), (cx + s * (cx - lx - 38), y0 + 132),
                   (cx + s * (cx - lx - 120), y0 + 176), (cx + s * 175, y0 + 196)]
            bone += 0.2 * F.tube(ant, 10.5 - i * 0.25, cortex=0.4)

    # 鎖骨（S 形）、肩胛骨內緣、肱骨頭與骨幹
    for s in (-1, 1):
        bone += 1.0 * F.tube([(cx + s * 38, 222), (cx + s * 120, 206), (cx + s * 220, 210), (cx + s * 300, 196), (cx + s * 345, 176)], 15, cortex=0.5)
        scap = F.shape([(cx + s * 370, 212), (cx + s * 240, 230), (cx + s * 255, 330), (cx + s * 330, 520), (cx + s * 375, 360)])
        bone += 0.35 * F.thickness(scap, 14)
        bone += 0.55 * F.oval(cx + s * 432, 300, 66, 74)
        bone += 0.5 * F.tube([(cx + s * 438, 330), (cx + s * 445, 1080)], 30, cortex=0.4, smooth=False)
    F.D += 0.42 * bone

    # 項鍊：路徑與遊戲裡的點擊判定點一致
    chain_pts = [(345, 410), (420, 370), (500, 320), (580, 265), (620, 230), (670, 180), (700, 110), (680, 45),
                 (560, 25), (450, 15), (330, 12), (240, 20), (180, 60), (170, 130), (180, 200), (220, 280), (280, 350)]
    curve = catmull(chain_pts, 30, closed=True)
    seg = np.concatenate([[0], np.cumsum(np.hypot(np.diff([c[0] for c in curve]), np.diff([c[1] for c in curve])))])
    metal = Image.new('L', (W, H), 0)
    md = ImageDraw.Draw(metal)
    for k, s in enumerate(np.arange(0, seg[-1], 9.5)):
        j = int(np.clip(np.searchsorted(seg, s), 1, len(curve) - 1))
        (px, py), (qx, qy) = curve[j], curve[j - 1]
        a = np.arctan2(py - qy, px - qx)
        if k % 2 == 0:  # 正面的鍊環（空心）
            ring = Image.new('L', (20, 20), 0)
            ImageDraw.Draw(ring).ellipse([3, 5.8, 16, 14.2], outline=255, width=2)
            metal.paste(255, (int(px - 10), int(py - 10)), ring.rotate(-np.degrees(a), resample=Image.BICUBIC))
        else:  # 側面的鍊環（短棒）
            dx, dy = np.cos(a) * 5, np.sin(a) * 5
            md.line([(px - dx, py - dy), (px + dx, py + dy)], fill=255, width=3)
    md.ellipse([577, 252, 597, 272], outline=255, width=3)        # 扣環
    md.ellipse([328, 412, 344, 434], outline=255, width=3)        # 墜頭
    hx, hy, hs = 332, 472, 36
    md.polygon([(hx + hs * np.sin(u) ** 3, hy - hs * (13 * np.cos(u) - 5 * np.cos(2 * u) - 2 * np.cos(3 * u) - np.cos(4 * u)) / 16)
                for u in np.linspace(0, 2 * np.pi, 90)], fill=255)
    F.D += 3.5 * gaussian_filter(np.asarray(metal, np.float32) / 255, 0.6)

    # 左右標記「L」（鉛字）
    F.D += 4 * F.mask(lambda d: (d.rectangle([790, 10, 803, 42], fill=255), d.rectangle([790, 30, 820, 42], fill=255)))

    F.develop(k=1.3, gamma=1.05, blur=1.5, sharpen=0.5, noise=0.016).save(path)


# ---------- 腹部骨盆 CT 定位像 ----------
def ct_scout(path):
    W, H, cx = 702, 1310, 351
    F = Film(W, H)
    ILIAC, PUBIS = 790, 1104   # 遊戲判定用的高度（原圖 351×655 的兩倍）；橫膈頂約在 480

    body = F.shape([(70, -40), (632, -40), (642, 130), (646, 480), (628, 690), (650, 860), (652, 1060), (628, 1350),
                    (74, 1350), (50, 1060), (52, 860), (74, 690), (56, 480), (60, 130)])
    F.D += 0.95 * F.thickness(body, 230)
    # 大腿之間的空隙
    F.D -= 1.2 * gaussian_filter(F.mask(lambda d: d.polygon([(351, 1168), (382, 1320), (320, 1320)], fill=255)), 4)
    # 舉高的雙手（上臂在頂部兩側）
    for s in (-1, 1):
        F.D += 0.5 * F.oval(cx + s * 270, 30, 70, 120)

    # 肺（右側橫膈較高）與心臟
    rl = F.shape([(300, 122), (215, 150), (150, 250), (122, 400), (116, 520), (132, 562), (205, 506), (276, 480),
                  (326, 492), (334, 400), (328, 250), (318, 150)])
    ll = F.shape([(402, 122), (490, 150), (556, 250), (584, 400), (590, 540), (572, 580), (505, 525), (468, 505),
                  (440, 470), (400, 400), (382, 300), (386, 150)])
    lungs = np.maximum(rl, ll)
    F.D -= 0.75 * gaussian_filter(F.thickness(lungs, 70), 2)
    F.D += 0.18 * F.vessels([(326, 330, 1.9, 3.9), (386, 335, -0.8, 1.2)], gaussian_filter(lungs, 4), gen=5, base_len=36, base_w=6)

    # 肝臟、胃泡、腸氣
    F.D += 0.10 * gaussian_filter(F.oval(215, 600, 150, 95), 12)
    F.D -= 0.5 * gaussian_filter(F.oval(470, 566, 52, 28, 0.2), 3)
    colon = [(205, 820), (195, 700), (215, 625), (300, 640), (400, 625), (520, 600), (548, 700), (545, 820), (470, 880), (390, 930)]
    gut = catmull(colon, 10)
    for i in range(0, len(gut), 3):
        px, py = gut[i]
        if rng.random() < 0.55:
            F.D -= 0.32 * gaussian_filter(F.oval(px + rng.normal(0, 6), py + rng.normal(0, 6), rng.uniform(14, 26), rng.uniform(10, 20), rng.uniform(0, 3)), 2)
    for _ in range(10):
        F.D -= 0.22 * gaussian_filter(F.oval(rng.uniform(260, 460), rng.uniform(680, 860), rng.uniform(10, 18), rng.uniform(8, 14), rng.uniform(0, 3)), 2)

    bone = np.zeros((H, W), np.float32)
    # 脊椎：胸椎 12 節、腰椎 5 節，越往下越大
    vy = 40
    for i in range(17):
        w = np.interp(i, [0, 11, 16], [22, 28, 34])
        h = np.interp(i, [0, 11, 16], [26, 32, 40])
        vb = F.shape([(cx - w, vy), (cx + w, vy), (cx + w + 2, vy + h), (cx - w - 2, vy + h)])
        bone += 0.45 * F.thickness(vb, 8)
        bone += 0.28 * (F.tube([(cx - w + 4, vy + 6), (cx - w + 4, vy + h - 8)], 6) + F.tube([(cx + w - 4, vy + 6), (cx + w - 4, vy + h - 8)], 6))
        vy += h + (10 if i < 12 else 14)
    sac = F.shape([(cx - 52, 895), (cx + 52, 895), (cx + 30, 990), (cx + 8, 1040), (cx - 8, 1040), (cx - 30, 990)])
    bone += 0.42 * F.thickness(sac, 16)
    for k in range(4):
        for s in (-1, 1):
            bone -= 0.3 * F.oval(cx + s * (26 - k * 4), 915 + k * 28, 6, 5)

    # 肋骨（細而淡、往外下彎）與鎖骨
    for i in range(12):
        y0 = 120 + i * 37
        length = 1.0 if i < 10 else 0.6
        for s in (-1, 1):
            pts = [(cx + s * 30, y0), (cx + s * 130, y0 - 6), (cx + s * 225, y0 + 24), (cx + s * 262, y0 + 75), (cx + s * 250, y0 + 125)]
            n = 5 if length == 1.0 else 3
            bone += 0.2 * F.tube(pts[:n], 7, cortex=0.5)
    for s in (-1, 1):
        bone += 0.8 * F.tube([(cx + s * 25, 112), (cx + s * 110, 96), (cx + s * 190, 100), (cx + s * 250, 78)], 11)
        bone += 0.7 * F.tube([(cx + s * 230, 70), (cx + s * 300, -30)], 20)   # 上臂（肱骨）

    # 骨盆
    for s in (-1, 1):
        X = lambda dx: cx + s * dx   # noqa: E731
        wing = F.shape([(X(62), 880), (X(110), 820), (X(170), ILIAC + 2), (X(225), ILIAC), (X(268), ILIAC + 22),
                        (X(282), 862), (X(262), 912), (X(232), 960), (X(200), 990), (X(165), 992), (X(120), 960), (X(78), 925)])
        bone += 0.55 * F.thickness(wing, 26)
        bone += 0.4 * F.tube([(X(62), 880), (X(110), 820), (X(170), ILIAC + 4), (X(225), ILIAC + 3), (X(268), ILIAC + 24), (X(282), 862)], 11)
        bone += 0.35 * F.tube([(X(78), 925), (X(120), 958), (X(165), 990)], 9)   # 弓狀線
        # 股骨頭、頸、大轉子、骨幹、小轉子
        bone += 0.75 * F.oval(X(150), 1006, 36, 36)
        bone += 0.9 * F.tube([(X(160), 1012), (X(208), 1050)], 22, smooth=False)
        bone += 0.8 * F.oval(X(228), 1048, 28, 36)
        bone += 0.85 * F.tube([(X(214), 1068), (X(205), 1180), (X(196), 1330)], 34, cortex=0.55)
        bone += 0.6 * F.oval(X(182), 1112, 13, 16)
        # 恥骨上枝、下枝與坐骨，中間圍出閉孔
        bone += 0.85 * F.tube([(X(128), 1030), (X(70), 1050), (X(16), 1064)], 13)
        bone += 0.85 * F.tube([(X(16), PUBIS - 8), (X(60), PUBIS + 4), (X(105), 1118), (X(132), 1090), (X(140), 1040)], 14)
        bone += 0.8 * F.shape([(X(4), 1058), (X(24), 1056), (X(26), PUBIS - 2), (X(4), PUBIS)], smooth=False)
    F.D += 0.45 * bone

    # 檢查床兩側邊緣
    y, x = np.mgrid[0:H, 0:W]
    for bx in (22, 680):
        F.D += 0.35 * gaussian_filter((np.abs(x - bx) < 5).astype(np.float32), 1.5)

    F.develop(k=0.85, gamma=1.15, blur=2.2, sharpen=0.35, noise=0.028, floor=0.1, mottle=0.03).save(path)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    chest_xray(os.path.join(out, 'cxr-necklace.png'))
    ct_scout(os.path.join(out, 'ct-scout.png'))
    print('done')
