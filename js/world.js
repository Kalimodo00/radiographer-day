// 3D 場景：放射科平面、角色、移動與尋路
(function () {
  const RT = (window.RT = window.RT || {});
  const W = 36, D = 24, CELL = 0.5, GW = W / CELL, GD = D / CELL, RADIUS = 0.3, SPEED = 5.2, NPC_SPEED = 2.1;
  // 當前任務指向這些地點時，對應的 NPC 會走回自己的位置等你
  const POI_NPC = { lead: 'lead', dr: 'dr', erbed: 'nurse', pacs: 'intern' };
  const ROUTES = {
    lead: [[21.4, 17], [22, 21], [19.5, 22.5], [17.5, 15.5]],
    dr: [[15.8, 21], [16, 17.6], [20, 19.5]],
    intern: [[19, 12.4], [10, 12], [4, 12.5], [14, 11.5], [25, 12.2]],
    nurse: [[34.6, 18.4], [31.5, 15], [34.5, 22.5], [31.2, 21.5]],
    porter: [[2, 12], [35, 12.5], [33, 22.5], [8, 13], [22, 11]],
    cleaner: [[2, 22.8], [12.5, 22.8], [12.5, 18], [1.2, 18.5]],
    visitor: [[11.5, 16.8], [9.5, 18.3], [4.5, 22.8], [12, 12]],
  };

  let renderer, scene, camera, canvas, labelRoot;
  const solids = [], labels = [], chars = {}, mats = {};
  const blocked = new Uint8Array(GW * GD);
  const keys = {};
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tmp = new THREE.Vector3();

  const world = (RT.world = {
    locked: true, target: null, onFrame: null, onArrive: null, onStep: null, onChatter: null, chatter: false,
    pois: {
      badge: { x: 28.9, z: 15.3 }, lead: { x: 20.4, z: 17.6 }, wang: { x: 3.6, z: 17.9 },
      xstand: { x: 2.3, z: 7.1 }, xconsole: { x: 10.6, z: 6.8 }, pacs: { x: 16, z: 17 },
      portable: { x: 33, z: 12.9 }, erbed: { x: 31.6, z: 18.2 }, seat: { x: 27, z: 19.9 },
      lin: { x: 16.6, z: 6 }, ctconsole: { x: 22.3, z: 6.8 }, mri: { x: 29.4, z: 11.8 },
      wu: { x: 6, z: 21.3 }, dr: { x: 17, z: 21 },
    },
  });

  let player, path = null, follower = null, marker, ring;

  function mat(color, opt) {
    const key = color + (opt ? JSON.stringify(opt) : '');
    if (!mats[key]) mats[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, opt || {}));
    return mats[key];
  }

  // 以最小角 (x,z) 與尺寸建立方塊
  function B(x, z, w, d, h, color, y, solid, parent, opt) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opt));
    m.position.set(x + w / 2, (y || 0) + h / 2, z + d / 2);
    m.castShadow = !(opt && opt.transparent);
    m.receiveShadow = true;
    (parent || scene).add(m);
    if (solid) solids.push({ x, z, w, d });
    return m;
  }

  function wall(x, z, w, d, h) {
    h = h || 1.4;
    B(x, z, w, d, h, '#eef3f4', 0, true);
    B(x, z, w, d, 0.08, '#8fa6b2', h);
  }

  function tint(x, z, w, d, color, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity || 0.35, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x + w / 2, 0.01, z + d / 2);
    scene.add(m);
  }

  function decal(text, x, z, size, color) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.font = '700 84px "Microsoft JhengHei", "Noto Sans TC", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color || 'rgba(60,90,105,0.55)';
    g.fillText(text, 256, 68);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    scene.add(m);
  }

  function addLabel(text, cls, getPos, color) {
    const el = document.createElement('div');
    el.className = 'label ' + (cls || '');
    el.textContent = text;
    if (color) { el.style.background = color; el.style.color = '#10222b'; }
    labelRoot.appendChild(el);
    const l = { el, getPos, visible: true };
    labels.push(l);
    return l;
  }

  function makeChar(id, name, o) {
    const g = new THREE.Group();
    const P = (w, h, d, c, x, y, z, parent) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
      m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m;
    };
    const legL = P(0.24, 0.5, 0.26, o.pants, -0.15, 0.25, 0);
    const legR = P(0.24, 0.5, 0.26, o.pants, 0.15, 0.25, 0);
    const torso = P(0.62, 0.62, 0.38, o.shirt, 0, 0.81, 0);
    const armL = P(0.16, 0.56, 0.22, o.shirt, -0.39, 0.82, 0);
    const armR = P(0.16, 0.56, 0.22, o.shirt, 0.39, 0.82, 0);
    const head = new THREE.Group();
    head.position.y = 1.36;
    g.add(head);
    P(0.44, 0.44, 0.44, o.skin || '#f1c9a5', 0, 0, 0, head);
    P(0.48, 0.18, 0.48, o.hair || '#2b2b33', 0, 0.24, 0, head);
    P(0.3, 0.06, 0.04, '#2b2b33', 0, 0.04, 0.23, head);
    if (o.prop) o.prop(P);
    scene.add(g);
    const c = { id, g, legL, legR, armL, armR, torso, head, walk: 0, phase: Math.random() * 10,
      lines: o.lines || [], anchor: true, path: null, wait: 1 + Math.random() * 3, home: null, bubbleT: 0, lastSign: 1 };
    c.label = addLabel(name, o.cls, () => tmp.set(g.position.x, g.position.y + 2.15, g.position.z), o.tag);
    c.bubble = addLabel('', 'bubble', () => tmp.set(g.position.x, g.position.y + 2.8, g.position.z));
    c.bubble.visible = false;
    chars[id] = c;
    return c;
  }

  // 控制區：背靠北側鉛牆的 L 形隔間，入口朝南、開口寬；控制台貼牆，避免玩家繞到「對面」
  function booth(x, xr, screens) {
    const glass = { transparent: true, opacity: 0.45 };
    B(x, 4.9, xr - x, 0.2, 1.8, '#7d8f99', 0, true);
    B(x, 4.9, 0.2, 2.5, 1.0, '#7d8f99', 0, true);
    B(x + 0.02, 4.9, 0.16, 2.5, 0.8, '#9fd8e8', 1.0, false, null, glass);
    B(x + 0.5, 5.1, xr - x - 0.7, 0.8, 0.9, '#dfe6e9', 0, true);
    screens.forEach((c, i) => {
      const sx = x + 0.7 + i * 0.9;
      B(sx, 5.3, 0.7, 0.1, 0.55, '#1b2a33', 0.95);
      B(sx + 0.05, 5.41, 0.6, 0.02, 0.45, c, 1.0, false, null, { emissive: c, emissiveIntensity: 0.5 });
    });
    B(x + 0.3, 7.6, xr - x - 0.5, 0.08, 0.01, '#f5c542', 0.01); // 入口地線
  }

  function buildScene() {
    // 地板
    const tc = document.createElement('canvas');
    tc.width = tc.height = 64;
    const tg = tc.getContext('2d');
    tg.fillStyle = '#dde6e9'; tg.fillRect(0, 0, 64, 64);
    tg.strokeStyle = '#c6d2d7'; tg.lineWidth = 2; tg.strokeRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(tc);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(W, D);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: tex }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); floor.receiveShadow = true;
    scene.add(floor);
    B(-3, -3, W + 6, D + 6, 0.5, '#16262f', -0.52);

    tint(0, 0, 12, 10, '#f5c542', 0.16);   // X 光
    tint(12, 0, 12, 10, '#2fc4b2', 0.16);  // CT
    tint(24, 0, 12, 10, '#7b8cf0', 0.18);  // MRI
    tint(0, 14, 14, 10, '#8fd0f0', 0.2);   // 候診
    tint(14, 14, 10, 10, '#b0bcc4', 0.3);  // 閱片
    tint(24, 14, 6, 10, '#f0b98f', 0.22);  // 休息
    tint(30, 14, 6, 10, '#ef5d5d', 0.16);  // 急診

    decal('X 光室', 6.5, 9, 0.9); decal('CT 電腦斷層', 14.6, 1.2, 0.8); decal('MRI 磁振造影', 26.6, 9.2, 0.8);
    decal('候診區', 9, 22.6, 0.9); decal('閱片室', 20.5, 22.6, 0.9); decal('休息室', 27.4, 22.6, 0.8);
    decal('急診', 33.4, 22.6, 0.9, 'rgba(180,60,60,0.6)'); decal('放射科', 12, 12, 1.1, 'rgba(60,90,105,0.3)');

    // 外牆（靠鏡頭的兩面做矮）
    wall(0, -0.15, W, 0.3, 1.8); wall(-0.15, 0, 0.3, D, 1.8);
    wall(0, D - 0.15, W, 0.3, 0.3); wall(W - 0.15, 0, 0.3, D, 0.3);
    // 檢查室隔間
    [[0, 5], [7, 10], [19, 10], [31, 5]].forEach(([x, w]) => wall(x, 9.85, w, 0.3));
    wall(11.85, 0, 0.3, 10); wall(23.85, 0, 0.3, 10);
    // 下排隔間
    [[14, 4], [20, 6], [28, 2]].forEach(([x, w]) => wall(x, 13.85, w, 0.3));
    wall(13.85, 14, 0.3, 10); wall(23.85, 14, 0.3, 10); wall(29.85, 14, 0.3, 10);
    // 門框上的輻射警示燈
    [[6, '#f5c542'], [18, '#f5c542'], [30, '#7b8cf0']].forEach(([x, c]) =>
      B(x - 0.3, 9.9, 0.6, 0.2, 0.25, c, 1.5, false, null, { emissive: c, emissiveIntensity: 0.6 }));

    // --- X 光室 ---
    B(4.2, 3.4, 2, 0.6, 0.7, '#8fa3ad'); B(3, 3, 4.4, 1.4, 0.15, '#f7fafb', 0.7, true);
    B(5.05, 2.2, 0.35, 0.35, 3, '#c9d4d9', 0, true); B(5.1, 2.3, 0.25, 1.5, 0.2, '#c9d4d9', 2.8);
    B(4.82, 3.3, 0.8, 0.8, 0.55, '#f5c542', 2.25); B(4.97, 3.45, 0.5, 0.5, 0.3, '#3b4a54', 1.95);
    B(0.35, 6.95, 0.3, 0.3, 2.4, '#c9d4d9', 0, true); B(0.65, 6.5, 0.12, 1.2, 1.1, '#2b3944', 1.0);
    booth(9, 11.85, ['#7fe0ff']);
    B(10.6, 0.3, 1, 0.5, 1.6, '#3f7a9c', 0, true); // 鉛衣架

    // --- CT 室 ---
    B(16.2, 3, 1.1, 1, 2.8, '#f7fafb'); B(18.7, 3, 1.1, 1, 2.8, '#f7fafb');
    B(17.3, 3, 1.4, 1, 0.5, '#f7fafb'); B(17.3, 3, 1.4, 1, 0.7, '#f7fafb', 2.1);
    B(17.3, 3.45, 1.4, 0.1, 1.6, '#1b2a33', 0.5); B(16.2, 3.98, 3.6, 0.04, 0.12, '#2fc4b2', 2.3);
    solids.push({ x: 16.2, z: 3, w: 3.6, d: 1 });
    B(17.7, 4.4, 0.6, 3.2, 0.55, '#8fa3ad'); B(17.5, 4, 1, 4, 0.15, '#dfe6e9', 0.55, true);
    B(19.9, 5.6, 0.1, 0.1, 1.5, '#aab8c0'); B(19.7, 5.45, 0.5, 0.4, 0.35, '#f08f4a', 1.5); // 高壓注射器
    booth(20.8, 23.85, ['#7fe0ff', '#b6f5c8']);

    // --- MRI 室 ---
    B(28.5, 2, 0.9, 3.4, 2.8, '#eef0fb'); B(30.6, 2, 0.9, 3.4, 2.8, '#eef0fb');
    B(29.4, 2, 1.2, 3.4, 0.5, '#eef0fb'); B(29.4, 2, 1.2, 3.4, 0.7, '#eef0fb', 2.1);
    B(29.4, 3, 1.2, 0.1, 1.6, '#1b2a33', 0.5); B(28.5, 5.38, 3, 0.04, 0.14, '#7b8cf0', 2.3);
    solids.push({ x: 28.5, z: 2, w: 3, d: 3.4 });
    B(29.7, 5.8, 0.6, 2.2, 0.55, '#8fa3ad'); B(29.5, 5.4, 1, 3, 0.15, '#dfe6e9', 0.55, true);
    for (let i = 0; i < 9; i++) { // 5 高斯線
      B(26 + i, 1, 0.6, 0.12, 0.02, '#f5c542', 0.01); B(26 + i, 9, 0.6, 0.12, 0.02, '#f5c542', 0.01);
      if (i < 8) { B(26, 1.2 + i, 0.12, 0.6, 0.02, '#f5c542', 0.01); B(34.5, 1.2 + i, 0.12, 0.6, 0.02, '#f5c542', 0.01); }
    }
    B(32, 10.2, 1.6, 0.6, 0.5, '#c7a36a', 0, true); B(32, 10.2, 1.6, 0.15, 1.1, '#aab8c0', 0.5); // 置物櫃

    // --- 候診區 ---
    [16.2, 19.6].forEach((z) => {
      for (let x = 2; x < 8.5; x += 1.2) { B(x, z, 0.8, 0.8, 0.45, '#4c8fb5', 0, true); B(x, z, 0.8, 0.15, 0.5, '#3f7a9c', 0.45); }
    });
    B(10.5, 15, 2.6, 1, 1.1, '#c7a36a', 0, true); B(10.4, 14.9, 2.8, 1.2, 0.08, '#f7fafb', 1.1);
    B(11.4, 15.2, 0.7, 0.1, 0.5, '#1b2a33', 1.2);
    B(0.6, 22.6, 0.6, 0.6, 0.5, '#b07a52', 0, true); B(0.5, 22.5, 0.8, 0.8, 0.9, '#4fa36a', 0.5);

    // --- 閱片室 ---
    [15.5, 19.5].forEach((z) => {
      B(14.3, z, 1, 3, 0.9, '#dfe6e9', 0, true);
      [0.3, 1.6].forEach((o) => {
        B(14.5, z + o, 0.1, 1, 0.65, '#1b2a33', 0.95);
        B(14.6, z + o + 0.06, 0.02, 0.88, 0.53, '#9fb7c4', 1.0, false, null, { emissive: '#5f7f90' });
      });
    });
    B(20, 14.3, 2.6, 0.1, 1.1, '#f7fafb', 0.8); // 白板
    B(22.4, 22.4, 0.7, 0.7, 1, '#aab8c0', 0, true);

    // --- 休息室 ---
    B(26, 18, 2, 1.2, 0.75, '#c7a36a', 0, true); B(26.6, 18.3, 0.55, 0.4, 0.12, '#f08f4a', 0.75);
    B(27.3, 18.4, 0.2, 0.3, 0.04, '#1b2a33', 0.75);
    B(24.3, 20.5, 0.7, 3, 2, '#7d8f99', 0, true); B(26.4, 22.6, 2.6, 0.9, 0.5, '#5b6fb5', 0, true);
    B(28.3, 14.15, 1.3, 0.1, 0.8, '#2b3944', 0.9);
    ['#2fc4b2', '#f5c542', '#ef5d5d', '#7b8cf0'].forEach((c, i) => B(28.4 + i * 0.3, 14.25, 0.18, 0.04, 0.26, c, 1.2));

    // --- 急診 ---
    B(32.5, 17, 1.2, 2.4, 0.55, '#aab8c0', 0, true); B(32.5, 17, 1.2, 2.4, 0.15, '#f7fafb', 0.55);
    B(32.72, 17.6, 0.76, 1.5, 0.24, '#9fd0b5', 0.7); B(32.9, 17.12, 0.4, 0.4, 0.3, '#f1c9a5', 0.7);
    B(34.1, 17.1, 0.08, 0.08, 1.9, '#aab8c0'); B(33.95, 17.05, 0.3, 0.18, 0.4, '#bfe7f5', 1.6);
    B(34.6, 20.5, 0.9, 0.6, 1.1, '#ef5d5d', 0, true);

    // 行動式 X 光機
    const pm = new THREE.Group();
    B(-0.6, -0.4, 1.2, 0.8, 0.9, '#f7fafb', 0.1, false, pm); B(-0.5, -0.3, 0.2, 0.6, 1.9, '#c9d4d9', 0.1, false, pm);
    B(-0.5, -0.1, 1.3, 0.2, 0.18, '#c9d4d9', 1.8, false, pm); B(0.5, -0.25, 0.5, 0.5, 0.4, '#f5c542', 1.5, false, pm);
    B(-0.6, -0.42, 1.2, 0.04, 0.3, '#2fc4b2', 0.5, false, pm);
    pm.position.set(34, 0, 11.8);
    scene.add(pm);
    world.portableMesh = pm;
    addLabel('行動式 X 光機', 'machine', () => tmp.set(pm.position.x, 2.6, pm.position.z));
    addLabel('DR-01 · X 光', 'machine', () => tmp.set(5.2, 3.8, 3.7));
    addLabel('CT-01 · 待機中', 'machine', () => tmp.set(18, 3.6, 3.5));
    addLabel('MR-01 · 3T', 'machine', () => tmp.set(30, 3.6, 3.7));
    addLabel('DR 控制台', 'machine', () => tmp.set(10.6, 2.4, 5.4));
    addLabel('CT 控制台', 'machine', () => tmp.set(22.3, 2.4, 5.4));

    // 目前任務的站位：地上的脈動光圈
    ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.6, 32),
      new THREE.MeshBasicMaterial({ color: '#f5c542', transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    scene.add(ring);

    // 角色
    const scrubs = (c) => ({ shirt: c, pants: c });
    player = makeChar('you', '你｜放射師', Object.assign(scrubs('#2fa89a'), { cls: 'you' }));
    makeChar('lead', '淑芬組長', Object.assign(scrubs('#34506b'), { tag: '#f2b54a', hair: '#5a3b2b',
      lines: ['今天急診 portable 好多……', '小夜的班表誰還沒填？', '鉛衣掛好，不要折！', '重照統計月底要交喔'] }));
    makeChar('intern', '小傑｜實習生', Object.assign(scrubs('#7fd1c7'), { tag: '#7fd1c7',
      lines: ['肩膀往前、手背插腰……', '學長姐等我一下！', '這台 DR 好帥', '吸氣——停！（自己練習）'] }));
    makeChar('nurse', '怡君｜急診護理師', Object.assign(scrubs('#f08fb0'), { tag: '#f08fb0', hair: '#3b2b2b',
      lines: ['3 床血壓再量一次！', '家屬請在外面稍等喔', '放射科分機幾號啊？'] }));
    makeChar('dr', '張醫師｜放射科', { shirt: '#f7fafb', pants: '#3b4a54', tag: '#e8eef2',
      lines: ['這張肋膈角很漂亮', '咖啡……我需要咖啡', '報告還剩 37 份'] });
    makeChar('wang', '王伯伯', { shirt: '#b9d9c2', pants: '#8a8f96', hair: '#d9d9d9', lines: ['少年欸，還要等多久？', '我 37 號喔'] });
    makeChar('lin', '林先生', { shirt: '#c9c2e8', pants: '#5b6470', hair: '#2b2b33', lines: ['肚子好痛……'] });
    makeChar('chen', '陳先生', { shirt: '#e8d2b0', pants: '#5b6470', lines: ['磁振要躺多久啊？'] });
    makeChar('wu', '吳小姐', { shirt: '#f0c9d6', pants: '#4a5d7a', hair: '#2b2b33', lines: ['（滑手機）', '叫到我了嗎？'] });
    // 路人：沒有劇情，只負責讓科裡熱鬧一點
    makeChar('porter', '傳送員阿明', { shirt: '#5b6fb5', pants: '#34405e', tag: '#aab8c0',
      lines: ['借過借過～', '7 樓要接病人下來', '電梯又在等了……'] });
    makeChar('cleaner', '清潔阿姨', { shirt: '#9b7fd1', pants: '#4a3f63', hair: '#6b6b6b', tag: '#aab8c0',
      lines: ['地板剛拖過，小心滑！', '這邊借我一下喔'],
      prop: (P) => { P(0.06, 1.1, 0.06, '#c7a36a', 0.42, 0.75, 0.3); P(0.4, 0.06, 0.18, '#4fa36a', 0.42, 0.2, 0.36); } });
    makeChar('visitor', '病人家屬', { shirt: '#e3b04b', pants: '#3b4a54', hair: '#4a2f2f', tag: '#aab8c0',
      lines: ['請問 X 光在哪裡？', '我是 38 號嗎？', '廁所在哪邊……'] });

    marker = addLabel('!', 'mark', () => {
      const p = world.pois[world.target];
      return p ? tmp.set(p.mx !== undefined ? p.mx : p.x, 3, p.mz !== undefined ? p.mz : p.z) : null;
    });
  }

  function computeGrid() {
    for (let j = 0; j < GD; j++) for (let i = 0; i < GW; i++) {
      const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL;
      let b = 0;
      for (const s of solids) {
        if (cx > s.x - RADIUS && cx < s.x + s.w + RADIUS && cz > s.z - RADIUS && cz < s.z + s.d + RADIUS) { b = 1; break; }
      }
      blocked[j * GW + i] = b;
    }
  }
  const isBlocked = (x, z) => {
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    return i < 0 || j < 0 || i >= GW || j >= GD || blocked[j * GW + i] === 1;
  };

  function nearestFree(i, j) {
    i = Math.max(0, Math.min(GW - 1, i)); j = Math.max(0, Math.min(GD - 1, j));
    if (!blocked[j * GW + i]) return [i, j];
    for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < GW && b < GD && !blocked[b * GW + a]) return [a, b];
    }
    return [i, j];
  }

  function findPath(sx, sz, tx, tz) {
    const [si, sj] = nearestFree(Math.floor(sx / CELL), Math.floor(sz / CELL));
    const [ti, tj] = nearestFree(Math.floor(tx / CELL), Math.floor(tz / CELL));
    const N = GW * GD, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const start = sj * GW + si, goal = tj * GW + ti, open = [start];
    const h = (n) => { const dx = Math.abs((n % GW) - ti), dz = Math.abs(Math.floor(n / GW) - tj); return Math.max(dx, dz) + 0.41 * Math.min(dx, dz); };
    g[start] = 0;
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (g[open[k]] + h(open[k]) < g[open[bi]] + h(open[bi])) bi = k;
      const cur = open.splice(bi, 1)[0];
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % GW, cj = Math.floor(cur / GW);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GD) continue;
        const n = nj * GW + ni;
        if (blocked[n] || closed[n]) continue;
        if (di && dj && (blocked[cj * GW + ni] || blocked[nj * GW + ci])) continue;
        const cost = g[cur] + (di && dj ? 1.41 : 1);
        if (cost < g[n]) { g[n] = cost; came[n] = cur; open.push(n); }
      }
    }
    if (came[goal] === -1 && goal !== start) return null;
    const pts = [];
    for (let n = goal; n !== -1 && n !== start; n = came[n]) pts.push({ x: ((n % GW) + 0.5) * CELL, z: (Math.floor(n / GW) + 0.5) * CELL });
    pts.reverse();
    if (!isBlocked(tx, tz)) pts.push({ x: tx, z: tz });
    return pts;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight, a = w / h, vh = a < 1 ? 20 : 15;
    renderer.setSize(w, h, false);
    camera.left = (-vh * a) / 2; camera.right = (vh * a) / 2; camera.top = vh / 2; camera.bottom = -vh / 2;
    camera.updateProjectionMatrix();
  }

  function stepPlayer(dt) {
    const p = player.g.position;
    let dx = 0, dz = 0;
    if (!world.locked) {
      const u = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
      const r = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      if (u || r) { path = null; dx = r - u; dz = -r - u; }
    }
    if (!dx && !dz && path && path.length) {
      const t = path[0], ex = t.x - p.x, ez = t.z - p.z, dist = Math.hypot(ex, ez);
      if (dist < 0.12) {
        path.shift();
        if (!path.length) { path = null; if (world.onArrive) world.onArrive(); }
      } else { dx = ex; dz = ez; }
      if (dx || dz) {
        const l = Math.hypot(dx, dz), s = Math.min(SPEED * dt, dist);
        p.x += (dx / l) * s; p.z += (dz / l) * s;
      }
    } else if (dx || dz) {
      const l = Math.hypot(dx, dz), sx = (dx / l) * SPEED * dt, sz = (dz / l) * SPEED * dt;
      if (!isBlocked(p.x + sx, p.z)) p.x += sx;
      if (!isBlocked(p.x, p.z + sz)) p.z += sz;
    }
    const moving = !!(dx || dz);
    if (moving) player.g.rotation.y = Math.atan2(dx, dz);
    animate(player, moving, dt, performance.now() / 1000);
    const sign = Math.sin(player.walk) >= 0 ? 1 : -1;
    if (moving && sign !== player.lastSign && world.onStep) world.onStep();
    player.lastSign = sign;
    if (follower) {
      const fx = p.x - Math.sin(player.g.rotation.y) * 1.3, fz = p.z - Math.cos(player.g.rotation.y) * 1.3;
      follower.position.x += (fx - follower.position.x) * Math.min(1, dt * 6);
      follower.position.z += (fz - follower.position.z) * Math.min(1, dt * 6);
      follower.rotation.y = player.g.rotation.y - Math.PI / 2;
    }
  }

  const turn = (a, b, k) => a + ((((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, k));

  function animate(c, moving, dt, t) {
    if (moving) c.walk += dt * (c === player ? 12 : 9);
    const s = moving ? Math.sin(c.walk) : 0;
    c.legL.position.z = s * 0.16; c.legR.position.z = -s * 0.16;
    c.armL.rotation.x = s * 0.5; c.armR.rotation.x = -s * 0.5;
    c.torso.scale.y = 1 + Math.sin(t * 2.2 + c.phase) * 0.025;
    // 站著時偶爾左右張望
    const look = moving ? 0 : Math.sin(t * 0.5 + c.phase) * 0.45 * Math.max(0, Math.sin(t * 0.17 + c.phase * 2));
    c.head.rotation.y += (look - c.head.rotation.y) * Math.min(1, dt * 4);
  }

  function stepNPC(c, dt, t) {
    const p = c.g.position, pp = player.g.position;
    const pinned = c.anchor || POI_NPC[world.target] === c.id;
    c.wait -= dt;
    if (!c.path && c.wait <= 0) {
      if (pinned && c.home && Math.hypot(p.x - c.home.x, p.z - c.home.z) > 0.2) {
        c.path = findPath(p.x, p.z, c.home.x, c.home.z); c.wait = 1;
      } else if (!pinned && ROUTES[c.id]) {
        const r = ROUTES[c.id], pt = r[Math.floor(Math.random() * r.length)];
        c.path = findPath(p.x, p.z, pt[0], pt[1]); c.wait = 2 + Math.random() * 6;
      }
    }
    let moving = false;
    if (c.path && c.path.length) {
      const tp = c.path[0], ex = tp.x - p.x, ez = tp.z - p.z, d = Math.hypot(ex, ez);
      if (d < 0.1) { c.path.shift(); if (!c.path.length) c.path = null; }
      else {
        const s = Math.min(d, NPC_SPEED * dt);
        p.x += (ex / d) * s; p.z += (ez / d) * s;
        c.g.rotation.y = turn(c.g.rotation.y, Math.atan2(ex, ez), dt * 10);
        moving = true;
      }
    } else if (!c.seated && Math.hypot(pp.x - p.x, pp.z - p.z) < 2.6) {
      c.g.rotation.y = turn(c.g.rotation.y, Math.atan2(pp.x - p.x, pp.z - p.z), dt * 6); // 看向玩家
    } else if (pinned && c.home && c.home.rot !== undefined) {
      c.g.rotation.y = turn(c.g.rotation.y, c.home.rot, dt * 4);
    }
    animate(c, moving, dt, t);
    if (c.bubbleT > 0 && (c.bubbleT -= dt) <= 0) c.bubble.visible = false;
  }

  // 隨機挑一個畫面內的 NPC 自言自語
  let chatT = 4;
  function chatter(dt) {
    if (!world.chatter || world.locked || (chatT -= dt) > 0) return;
    chatT = 5 + Math.random() * 5;
    const cand = Object.values(chars).filter((c) => {
      if (c === player || !c.g.visible || !c.lines.length || c.bubbleT > 0) return false;
      const v = tmp.copy(c.g.position).project(camera);
      return Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.8;
    });
    if (cand.length) {
      const c = cand[Math.floor(Math.random() * cand.length)];
      world.say(c.id, c.lines[Math.floor(Math.random() * c.lines.length)]);
    }
  }

  function updateLabels() {
    const w = window.innerWidth, h = window.innerHeight;
    for (const l of labels) {
      const pos = l.visible ? l.getPos() : null;
      if (!pos) { l.el.style.display = 'none'; continue; }
      pos.project(camera);
      l.el.style.display = '';
      l.el.style.transform = `translate(${((pos.x + 1) / 2) * w}px, ${((1 - pos.y) / 2) * h}px) translate(-50%, -100%)`;
    }
  }

  let last = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    stepPlayer(dt);
    for (const id in chars) if (chars[id] !== player && chars[id].g.visible) stepNPC(chars[id], dt, t / 1000);
    chatter(dt);
    const tp = world.pois[world.target];
    ring.visible = !!tp && !world.locked;
    if (tp) {
      ring.position.x = tp.x; ring.position.z = tp.z;
      const k = 1 + Math.sin(t / 220) * 0.12;
      ring.scale.set(k, k, k);
    }
    const p = player.g.position;
    camera.position.lerp(tmp.set(p.x + 20, 20, p.z + 20), Math.min(1, dt * 5));
    renderer.render(scene, camera);
    updateLabels();
    if (world.onFrame) world.onFrame();
    requestAnimationFrame(loop);
  }

  world.init = function (cv) {
    canvas = cv;
    labelRoot = document.getElementById('labels');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0e1a22');
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    scene.add(new THREE.AmbientLight('#ffffff', 0.72));
    const sun = new THREE.DirectionalLight('#ffffff', 0.55);
    sun.position.set(30, 34, 6); sun.target.position.set(18, 0, 12);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 90 });
    scene.add(sun, sun.target);

    buildScene();
    computeGrid();
    world.reset();
    const p = player.g.position;
    camera.position.set(p.x + 20, 20, p.z + 20);
    camera.lookAt(p.x, 0, p.z);
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT') keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    canvas.addEventListener('pointerdown', (e) => {
      if (world.locked) return;
      const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
      if (hit) world.walkTo(hit.x, hit.z);
    });
    requestAnimationFrame(loop);
  };

  world.reset = function () {
    path = null; follower = null; world.target = null;
    world.place('you', 27, 12, 0);
    world.place('lead', 21.4, 17, -1.2); world.place('intern', 19, 12.4, 0.6);
    world.place('nurse', 34.6, 18.4, -1.57); world.place('dr', 15.8, 21, -1.57);
    world.place('wang', 3.6, 16.6, 0, -0.12); world.place('lin', 5.6, 20, 0, -0.12); world.place('wu', 6.8, 20, 0, -0.12);
    world.show('chen', false); world.show('lin', false); world.show('wu', false);
    world.place('porter', 8, 12.5); world.place('cleaner', 12, 22.6); world.place('visitor', 11.5, 17);
    ['lead', 'intern', 'nurse', 'dr', 'porter', 'cleaner', 'visitor'].forEach(world.release);
    world.portableMesh.position.set(34, 0, 11.8); world.portableMesh.rotation.y = 0;
  };
  world.place = function (id, x, z, rot, y) {
    const c = chars[id];
    c.g.position.set(x, y || 0, z);
    if (rot !== undefined) c.g.rotation.y = rot;
    c.home = { x, z, rot }; c.path = null; c.anchor = true; c.seated = (y || 0) < 0;
    world.show(id, true);
  };
  // 解除固定，讓 NPC 沿自己的路線閒晃
  world.release = function (id) { chars[id].anchor = false; chars[id].wait = 1 + Math.random() * 3; };
  world.show = function (id, v) {
    const c = chars[id];
    c.g.visible = v; c.label.visible = v;
    if (!v) { c.bubble.visible = false; c.bubbleT = 0; }
  };
  world.say = function (id, text, secs) {
    const c = chars[id];
    if (!c || !c.g.visible) return;
    c.bubble.el.textContent = text; c.bubble.visible = true; c.bubbleT = secs || 3.2;
    if (world.onChatter) world.onChatter(id);
  };
  world.rename = function (id, text) { chars[id].label.el.textContent = text; };
  world.walkTo = function (x, z) {
    const p = player.g.position;
    path = findPath(p.x, p.z, x, z);
  };
  world.goToTarget = function () { const t = world.pois[world.target]; if (t) world.walkTo(t.x, t.z); };
  world.stop = function () { path = null; };
  world.distToTarget = function () {
    const t = world.pois[world.target];
    return t ? Math.hypot(player.g.position.x - t.x, player.g.position.z - t.z) : Infinity;
  };
  world.follow = function (on) {
    follower = on ? world.portableMesh : null;
    if (RT.sfx) RT.sfx.hum(on);
    if (!on) { world.portableMesh.position.set(31.4, 0, 16.6); world.portableMesh.rotation.y = 0; }
  };
})();
