// 介面：對話、選擇面板、數值與小遊戲
(function () {
  const RT = (window.RT = window.RT || {});
  const $ = (id) => document.getElementById(id);
  const STATS = { safety: '病人安全', quality: '影像品質', pace: '效率', energy: '體力' };
  const GRADE = { good: '做得好', ok: '還可以', bad: '出狀況' };
  const ui = (RT.ui = { STATS });
  let dialogResolve = null;

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  const play = (n) => RT.sfx && RT.sfx.play(n);

  ui.renderStats = function (root, stats) {
    root.innerHTML = '';
    for (const k in STATS) {
      const s = el('div', 'stat', `<span>${STATS[k]}</span><div class="bar"><i style="width:${stats[k]}%"></i></div>`);
      s.title = `${STATS[k]} ${stats[k]}`;
      root.appendChild(s);
    }
  };
  ui.refresh = () => ui.renderStats($('stats'), RT.state.stats);

  ui.float = function (text) {
    const f = el('div', 'floater', text);
    $('floaters').appendChild(f);
    setTimeout(() => f.remove(), 2300);
  };

  ui.setTime = function (t) { RT.state.time = t; $('clock').textContent = t; };

  ui.applyFx = function (fx) {
    const wrap = el('div', 'deltas');
    for (const k in fx || {}) {
      if (!fx[k]) continue;
      RT.state.stats[k] = Math.max(0, Math.min(100, RT.state.stats[k] + fx[k]));
      wrap.appendChild(el('span', 'delta ' + (fx[k] > 0 ? 'up' : 'down'), `${STATS[k]} ${fx[k] > 0 ? '+' : ''}${fx[k]}`));
    }
    ui.refresh();
    return wrap;
  };

  ui.unlock = function (id) {
    if (RT.state.unlocked.has(id) || !RT.CODEX[id]) return;
    RT.state.unlocked.add(id);
    ui.float('圖鑑解鎖：' + RT.CODEX[id].t);
  };

  // --- 對話 ---
  ui.say = function (who, text) {
    RT.world.locked = true;
    $('dlgWho').textContent = who;
    $('dlgText').textContent = text.replace(/\{name\}/g, RT.state.name);
    $('dialog').classList.remove('hidden');
    play('blip');
    return new Promise((res) => { dialogResolve = res; });
  };
  ui.advance = function () {
    if (!dialogResolve) return false;
    const r = dialogResolve; dialogResolve = null;
    $('dialog').classList.add('hidden');
    r();
    return true;
  };

  // --- 面板 ---
  ui.openPanel = function (title, intro) {
    RT.world.locked = true;
    $('panelKicker').textContent = RT.state.time + ' · ' + (RT.state.place || '');
    $('panelTitle').textContent = title;
    const body = $('panelBody');
    body.innerHTML = '';
    if (intro) body.appendChild(el('p', '', intro));
    $('panel').classList.remove('hidden');
    $('panel').scrollTop = 0;
    return body;
  };
  ui.closePanel = () => $('panel').classList.add('hidden');

  // 顯示結果、套用數值、記錄到交班回顧
  ui.feedback = function (body, title, grade, text, fx, codex) {
    play(grade);
    const fb = el('div', 'fb ' + grade, `<b>${GRADE[grade]}</b>${text}`);
    fb.appendChild(ui.applyFx(fx));
    body.appendChild(fb);
    RT.state.log.push({ title, grade, text });
    (codex || []).forEach(ui.unlock);
    return new Promise((res) => {
      const b = el('button', 'btn primary', '繼續');
      b.type = 'button';
      b.onclick = () => { ui.closePanel(); res(grade); };
      body.appendChild(b);
      $('panel').scrollTop = $('panel').scrollHeight;
    });
  };

  // 選擇題：options = [{label, grade, text, fx}]
  ui.choose = function (cfg) {
    const body = ui.openPanel(cfg.title, cfg.intro);
    if (cfg.chart) body.appendChild(el('div', 'chart', cfg.chart));
    const opts = el('div', 'opts');
    body.appendChild(opts);
    return new Promise((res) => {
      cfg.options.forEach((o) => {
        const b = el('button', 'opt', o.label);
        b.type = 'button';
        b.onclick = () => {
          opts.remove();
          body.appendChild(el('p', '', '▸ ' + o.label)).style.color = '#8fa6b2';
          ui.feedback(body, cfg.title, o.grade, o.text, o.fx, cfg.codex).then(res);
        };
        opts.appendChild(b);
      });
    });
  };

  const button = (parent, text, cls) => {
    const b = el('button', 'btn ' + (cls || 'primary'), text);
    b.type = 'button';
    parent.appendChild(b);
    return b;
  };
  const canvas = (parent, w, h) => {
    const c = el('canvas');
    c.width = w; c.height = h;
    parent.appendChild(c);
    return c;
  };

  // --- 小遊戲：吸飽氣再曝光 ---
  ui.breathGame = function (body) {
    const c = canvas(body, 340, 210), g = c.getContext('2d');
    const b = button(body, '曝光', 'danger');
    const t0 = performance.now();
    let done = false, v = 0;
    return new Promise((res) => {
      (function draw(t) {
        if (done) return;
        const s = (t - t0) / 1000;
        v = (Math.sin(s * 1.9 + Math.sin(s * 0.7) * 0.8) + 1) / 2;
        g.fillStyle = '#05090c'; g.fillRect(0, 0, 340, 210);
        g.fillStyle = '#2b3944'; g.fillRect(60, 14, 170, 182); // 探測器
        g.fillStyle = '#5c6f7b';
        g.beginPath(); g.ellipse(145, 120, 62 + v * 6, 84, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(145, 28, 20, 0, 7); g.fill();
        g.fillStyle = '#0b1318';
        const lh = 38 + v * 30, lw = 20 + v * 7;
        g.beginPath(); g.ellipse(118, 112, lw, lh, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(172, 112, lw, lh, 0, 0, 7); g.fill();
        g.fillStyle = '#24394a'; g.fillRect(270, 20, 26, 170);
        g.fillStyle = '#58d68d'; g.fillRect(270, 20, 26, 22);
        g.fillStyle = '#f5c542'; g.fillRect(264, 186 - v * 166, 38, 6);
        g.fillStyle = '#8fa6b2'; g.font = '12px sans-serif'; g.fillText('吸飽', 302, 34); g.fillText('吐氣', 302, 188);
        requestAnimationFrame(draw);
      })(t0);
      b.onclick = () => {
        done = true; b.remove();
        play('xray');
        res(v >= 0.87 ? 'good' : v >= 0.6 ? 'ok' : 'bad');
      };
    });
  };

  function drawChest(g, artifact) {
    g.fillStyle = '#05090c'; g.fillRect(0, 0, 300, 330);
    const body = g.createLinearGradient(40, 0, 260, 0);
    body.addColorStop(0, '#3b444a'); body.addColorStop(0.5, '#9aa5ab'); body.addColorStop(1, '#3b444a');
    g.fillStyle = body;
    g.beginPath(); g.moveTo(50, 60); g.quadraticCurveTo(150, 20, 250, 60); g.lineTo(262, 330); g.lineTo(38, 330); g.closePath(); g.fill();
    g.fillRect(128, 0, 44, 60);
    g.fillStyle = '#12191d';
    g.beginPath(); g.ellipse(102, 180, 44, 104, 0.06, 0, 7); g.fill();
    g.beginPath(); g.ellipse(198, 180, 44, 104, -0.06, 0, 7); g.fill();
    g.fillStyle = 'rgba(190,200,205,0.75)'; g.fillRect(141, 40, 18, 290);
    g.beginPath(); g.ellipse(168, 222, 42, 54, 0.3, 0, 7); g.fill();
    g.strokeStyle = 'rgba(200,210,215,0.4)'; g.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      g.beginPath(); g.ellipse(102, 90 + i * 26, 46, 16, -0.25, Math.PI, 2 * Math.PI); g.stroke();
      g.beginPath(); g.ellipse(198, 90 + i * 26, 46, 16, 0.25, Math.PI, 2 * Math.PI); g.stroke();
    }
    g.lineWidth = 7; g.strokeStyle = 'rgba(210,218,222,0.6)';
    g.beginPath(); g.moveTo(60, 78); g.lineTo(140, 64); g.moveTo(240, 78); g.lineTo(160, 64); g.stroke();
    if (artifact) {
      g.fillStyle = '#ffffff';
      for (let a = 0.15; a < Math.PI - 0.1; a += 0.11) { g.beginPath(); g.arc(150 + Math.cos(a) * 42, 52 + Math.sin(a) * 46, 2.2, 0, 7); g.fill(); }
      g.beginPath(); g.moveTo(150, 96); g.lineTo(159, 110); g.lineTo(150, 124); g.lineTo(141, 110); g.closePath(); g.fill();
    }
    g.fillStyle = '#c9d4d9'; g.font = '700 14px Consolas, monospace'; g.fillText('L', 268, 30); g.fillText('PA', 12, 30);
  }

  // --- 小遊戲：找出影像上的問題 ---
  // 參考影像：載入失敗時退回手繪版本
  const imgCache = {};
  ui.loadImg = (src) => imgCache[src] || (imgCache[src] = new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  }));
  const credit = (parent, key) => {
    const src = (RT.CREDITS || {})[key];
    if (!src) return;
    const p = el('p', 'credit', '影像：');
    const a = el(src.url ? 'a' : 'span');
    if (src.url) { a.href = src.url; a.target = '_blank'; a.rel = 'noopener'; }
    a.textContent = src.text;
    p.appendChild(a);
    parent.appendChild(p);
  };

  // 項鍊在原圖 (945×1033) 上的取樣點
  const CHAIN = [[180, 60], [240, 20], [330, 12], [450, 15], [560, 25], [680, 45], [700, 110], [670, 180], [620, 230],
    [580, 265], [500, 320], [420, 370], [345, 410], [330, 470], [280, 350], [220, 280], [180, 200], [170, 130]];

  ui.spotGame = async function (body) {
    const CW = 300, CH = 328, k = CW / 945;
    const c = canvas(body, CW, CH), g = c.getContext('2d');
    credit(body, 'cxr');
    const hint = el('p', '', '點一下影像上你覺得有問題的地方。剩 3 次。');
    body.appendChild(hint);
    const img = await ui.loadImg('assets/img/cxr-necklace.png');
    if (img) g.drawImage(img, 0, 0, CW, CH);
    else drawChest(g, true);
    const isHit = img
      ? (x, y) => CHAIN.some(([px, py]) => Math.hypot(x / k - px, y / k - py) < 55)
      : (x, y) => x > 98 && x < 202 && y > 44 && y < 130;
    let tries = 3;
    return new Promise((res) => {
      c.onpointerdown = (e) => {
        const r = c.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * CW, y = ((e.clientY - r.top) / r.height) * CH;
        const hit = isHit(x, y);
        g.strokeStyle = hit ? '#58d68d' : '#ef5d5d'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, hit ? 30 : 12, 0, 7); g.stroke();
        if (hit || --tries === 0) {
          c.onpointerdown = null; hint.remove();
          if (!hit) {
            g.strokeStyle = '#f5c542'; g.beginPath();
            if (img) g.ellipse(140, 80, 100, 82, 0, 0, 7); else g.arc(150, 88, 50, 0, 7);
            g.stroke();
          }
          res(hit ? (tries === 3 ? 'good' : 'ok') : 'bad');
        } else {
          play('wrong');
          hint.textContent = `不是這裡。剩 ${tries} 次。`;
        }
      };
    });
  };

  // --- 小遊戲：CT 掃描範圍 ---
  // 定位像原圖 351×655，縮成 240 寬畫在左側；標記位置依原圖量測
  ui.rangeGame = async function (body) {
    const IW = 240, k = IW / 351, H = Math.round(655 * k), CW = 340;
    const TOP = Math.round(240 * k), ILIAC = Math.round(395 * k), BOT = Math.round(552 * k);
    const c = canvas(body, CW, H), g = c.getContext('2d');
    c.style.maxWidth = '340px';
    credit(body, 'ct');
    const mk = (name, val) => {
      const row = el('label', 'slider', `<span>${name}</span>`);
      const input = el('input');
      input.type = 'range'; input.min = 4; input.max = H - 4; input.value = val;
      row.appendChild(input); body.appendChild(row);
      return input;
    };
    const a = mk('起點', 70), z = mk('終點', 250);
    const img = await ui.loadImg('assets/img/ct-scout.png');
    let reveal = false;
    const draw = () => {
      const s = Math.min(+a.value, +z.value), e = Math.max(+a.value, +z.value);
      g.fillStyle = '#05090c'; g.fillRect(0, 0, CW, H);
      if (img) g.drawImage(img, 0, 0, IW, H);
      else { g.fillStyle = '#56646d'; g.fillRect(40, 20, 160, H - 20); }
      g.fillStyle = 'rgba(47,196,178,0.22)'; g.fillRect(0, s, IW, e - s);
      g.fillStyle = '#2fc4b2'; g.fillRect(0, s - 1, IW, 2); g.fillRect(0, e - 1, IW, 2);
      g.font = '12px sans-serif'; g.fillStyle = '#2fc4b2';
      if (!reveal) { g.fillText('起點', IW + 6, s + 4); g.fillText('終點', IW + 6, e + 4); }
      if (reveal) {
        g.setLineDash([5, 4]); g.strokeStyle = '#f5c542'; g.lineWidth = 2;
        [['橫膈頂', TOP], ['髂嵴', ILIAC], ['恥骨聯合下緣', BOT]].forEach(([n, y]) => {
          g.beginPath(); g.moveTo(0, y); g.lineTo(IW, y); g.stroke();
          g.fillStyle = '#f5c542'; g.fillText(n, IW + 6, y + (n === '髂嵴' ? 4 : n === '橫膈頂' ? -6 : 16));
        });
        g.setLineDash([]);
      }
    };
    a.oninput = z.oninput = draw;
    draw();
    const b = button(body, '開始掃描');
    return new Promise((res) => {
      b.onclick = () => {
        const s = Math.min(+a.value, +z.value), e = Math.max(+a.value, +z.value);
        a.disabled = z.disabled = true; b.remove();
        reveal = true; draw(); play('ct');
        const covered = s <= TOP + 4 && e >= BOT - 4;
        const extra = Math.max(0, TOP - s) + Math.max(0, e - BOT);
        res(!covered ? 'bad' : extra <= 34 ? 'good' : 'ok');
      };
    });
  };

  // --- 小遊戲：MRI 進門前要留在外面的東西 ---
  ui.itemsGame = function (body, items) {
    const grid = el('div', 'items');
    body.appendChild(grid);
    const btns = items.map((it) => {
      const b = el('button', 'item', `<span>${it.icon}</span>${it.name}`);
      b.type = 'button';
      b.onclick = () => b.classList.toggle('on');
      grid.appendChild(b);
      return b;
    });
    const ok = button(body, '篩檢完成');
    return new Promise((res) => {
      ok.onclick = () => {
        let right = 0;
        btns.forEach((b, i) => {
          const good = b.classList.contains('on') === items[i].danger;
          right += good ? 1 : 0;
          b.classList.add(good ? 'right' : 'wrong');
          b.onclick = null;
        });
        ok.remove();
        res(right === items.length ? 'good' : right >= items.length - 2 ? 'ok' : 'bad');
      };
    });
  };

  // --- 小遊戲：限時反應 ---
  ui.quickGame = function (body, label, ms) {
    const bar = el('div', 'timer', '<i></i>');
    body.appendChild(bar);
    const b = button(body, label, 'danger');
    const t0 = performance.now();
    let done = false;
    play('alarm');
    return new Promise((res) => {
      const finish = (ok) => { if (done) return; done = true; bar.remove(); b.remove(); res(ok); };
      (function tick(t) {
        if (done) return;
        const left = 1 - (t - t0) / ms;
        bar.firstChild.style.width = Math.max(0, left * 100) + '%';
        if (left <= 0) finish(false); else requestAnimationFrame(tick);
      })(t0);
      b.onclick = () => finish(true);
    });
  };

  // --- 便當 ---
  ui.lunchGame = function (body, maxBites) {
    const c = canvas(body, 320, 150), g = c.getContext('2d');
    const info = el('p');
    body.appendChild(info);
    let bites = 0;
    const draw = () => {
      g.fillStyle = '#6b4a34'; g.fillRect(0, 0, 320, 150);
      g.fillStyle = '#f7f1e3'; g.fillRect(20, 16, 190, 118);
      const foods = [['#fbfbf5', 30, 26, 80, 46], ['#c9783c', 118, 26, 82, 22], ['#c9783c', 118, 52, 82, 20], ['#fbfbf5', 30, 78, 80, 46], ['#7fbf5a', 118, 78, 38, 46], ['#f2c94c', 162, 78, 38, 46]];
      foods.forEach((f, i) => { if (i >= bites) { g.fillStyle = f[0]; g.fillRect(f[1], f[2], f[3], f[4]); } });
      g.fillStyle = '#1b2a33'; g.fillRect(240, 26, 56, 100);
      g.fillStyle = bites >= maxBites ? '#ef5d5d' : '#24394a'; g.fillRect(246, 34, 44, 84);
      if (bites >= maxBites) { g.fillStyle = '#fff'; g.font = '700 13px sans-serif'; g.fillText('CT 室', 250, 80); }
      info.textContent = bites >= maxBites ? '手機在桌上震了起來。' : `便當還剩 ${6 - bites} 口。`;
    };
    draw();
    const b = button(body, '吃一口');
    return new Promise((res) => {
      b.onclick = () => {
        bites++; play('bite'); draw();
        if (bites >= maxBites) { b.remove(); play('phone'); setTimeout(res, 900); }
      };
    });
  };
})();
