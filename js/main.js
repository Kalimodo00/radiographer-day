// 流程控制：開始、任務推進、結算
(function () {
  const RT = window.RT, ui = RT.ui, world = RT.world;
  const $ = (id) => document.getElementById(id);
  let busy = false, playing = false;

  RT.state = {
    name: '放射師', time: '07:50', place: '', step: -1, log: [], unlocked: new Set(),
    stats: { safety: 50, quality: 50, pace: 60, energy: 60 },
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 無痕模式 */ } },
  };

  function nextStep() {
    const st = RT.state;
    st.step++;
    if (st.step >= RT.STEPS.length) return finish();
    const s = RT.STEPS[st.step];
    ui.setTime(s.time);
    RT.sfx.play('chime');
    if (st.step > 0) st.stats.energy = Math.max(0, st.stats.energy - 2);
    ui.refresh();
    activate(s);
  }

  // 讓目前任務可以被觸發（也用在違法事件後「回到事件之前」）
  function activate(s) {
    world.target = s.poi;
    world.hotspot = s.hotspot || null;
    $('objText').textContent = s.hint;
    $('objective').classList.remove('hidden');
    world.locked = false;
  }

  async function run(fn) {
    if (busy || !playing) return;
    const s = RT.STEPS[RT.state.step];
    busy = true;
    world.stop(); world.locked = true; world.target = null; world.hotspot = null;
    RT.state.place = s.place;
    $('prompt').classList.add('hidden'); $('objective').classList.add('hidden');
    const r = await fn(s);
    busy = false;
    if (r === 'arrest' || r === 'suspend') return finish(r);
    if (r === 'retry') return activate(s);
    nextStep();
  }
  const interact = () => run((s) => s.run());
  // 測試用：直接跳到第 i 個任務（主控台執行 RT._jump(i)）
  RT._jump = (i) => { RT.state.step = i - 1; nextStep(); };
  // 床尾之類的「誘惑」熱點：觸發違法事件
  const tempt = () => run(async (s) => {
    if (s.hotspot.narr) await ui.say('現場狀況', s.hotspot.narr);
    return ui.crime(s.hotspot.crime);
  });
  let promptAction = interact;

  function score() {
    const s = RT.state.stats;
    return Math.round(s.safety * 0.4 + s.quality * 0.3 + s.pace * 0.15 + s.energy * 0.15);
  }

  function finish(arrested) {
    playing = false; world.locked = true; world.chatter = false;
    RT.sfx.play(arrested ? 'clang' : 'fanfare');
    $('objective').classList.add('hidden');
    const sc = score();
    const rank = arrested === 'suspend' ? ['停職調查中', '醫院暫停了你所有的臨床工作，等待性騷擾申訴調查結果。現實中，這一步沒有「重來」可以按。']
      : arrested ? ['移送法辦', '你的執照、工作和名聲，都在那一刻結束了。現實中，這一步沒有「重來」可以按。']
      : RT.state.crimes ? ['帶著紀錄的放射師', '遊戲讓你重來了，現實不會。下面記錄了你差點毀掉職涯的那一刻。']
      : sc >= 80 ? ['ALARA 守門人', '該攔的都攔下來了，該照的一張到位。病人不會知道你今天替他們擋掉了什麼，這正是這份工作的樣子。']
      : sc >= 65 ? ['可靠的當班放射師', '有幾個地方可以更好，但沒有人因為你而多冒風險。明天繼續。']
      : sc >= 50 ? ['還在抓節奏的新人', '今天有點兵荒馬亂。回頭看看下面每個決定，下次會順很多。']
      : ['今天先回家睡飽', '有些事不能靠運氣。好消息是這只是遊戲，而且可以再上一天班。'];
    $('rankTitle').textContent = rank[0];
    $('rankText').textContent = arrested ? `${RT.state.name}，${rank[1]}` : `${RT.state.name}，綜合評分 ${sc} 分。${rank[1]}`;
    if (RT.voice) RT.voice.speak(`今天的你是，${rank[0]}。${$('rankText').textContent}`);
    ui.renderStats($('resultStats'), RT.state.stats);
    $('resultStats').querySelectorAll('.stat span').forEach((sp, i) => { sp.textContent += ' ' + Object.values(RT.state.stats)[i]; });
    const icon = { good: '●', ok: '▲', bad: '✕' };
    $('review').innerHTML = '';
    RT.state.log.forEach((l) => {
      const li = document.createElement('li');
      li.innerHTML = `<b class="g-${l.grade}">${icon[l.grade]} ${l.title}</b><span>${l.text}</span>`;
      $('review').appendChild(li);
    });
    $('result').classList.remove('hidden');
  }

  function showCodex() {
    const ids = Object.keys(RT.CODEX), got = RT.state.unlocked;
    $('codexCount').textContent = `${got.size} / ${ids.length}`;
    $('codexList').innerHTML = '';
    ids.forEach((id) => {
      const d = document.createElement('div'), on = got.has(id);
      d.className = 'codex-item' + (on ? '' : ' locked');
      d.innerHTML = on ? `<b>${RT.CODEX[id].t}</b>${RT.CODEX[id].d}` : '<b>？？？</b>上班時遇到就會解鎖。';
      $('codexList').appendChild(d);
    });
    $('codex').classList.remove('hidden');
  }

  // 觸控裝置：介面改用觸控說法、互動按鈕不顯示「E」
  const isTouch = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : 'ontouchstart' in window;
  document.documentElement.classList.toggle('touch', isTouch);

  world.init($('scene'));
  world.onArrive = () => { if (playing && !busy && world.distToTarget() < 1.6) RT.sfx.play('arrive'); };
  world.onStep = () => RT.sfx.play('step');
  world.onChatter = () => RT.sfx.play('bubble');
  let ducked = false;
  world.onFrame = () => {
    const free = playing && !busy && !world.locked;
    const tempting = free && world.distToHotspot() < 0.9;
    const near = free && !tempting && world.distToTarget() < 1.6;
    const pr = $('prompt');
    pr.classList.toggle('hidden', !near && !tempting);
    pr.classList.toggle('danger', tempting);
    if (tempting) { pr.textContent = (isTouch ? '' : 'E　') + world.hotspot.label; promptAction = tempt; }
    else if (near) { pr.textContent = (isTouch ? '👆 ' : 'E　') + RT.STEPS[RT.state.step].prompt; promptAction = interact; }
    const talking = !$('dialog').classList.contains('hidden') || !$('panel').classList.contains('hidden');
    if (talking !== ducked) { ducked = talking; RT.sfx.duck(talking); }
  };

  $('nameInput').value = store.get('rt24-name') || '';
  $('btnStart').onclick = () => {
    if (RT.voice.on) RT.voice.speak('開始上班。');   // iOS 需要由點擊觸發第一次朗讀
    const n = $('nameInput').value.trim();
    store.set('rt24-name', n);
    RT.state.name = n || '放射師';
    world.rename('you', `${n || '你'}｜放射師`);
    $('home').classList.add('hidden'); $('hud').classList.remove('hidden');
    playing = true; world.chatter = true;
    RT.sfx.unlock();
    ui.refresh();
    nextStep();
  };
  $('btnGo').onclick = () => world.goToTarget();
  $('prompt').onclick = () => promptAction();
  $('dlgNext').onclick = (e) => { e.currentTarget.blur(); ui.advance(); };
  $('btnHome').onclick = $('btnAgain').onclick = () => location.reload();
  $('btnCodex').onclick = showCodex;
  $('btnCodexClose').onclick = () => $('codex').classList.add('hidden');
  const syncAudioBtns = () => {
    $('btnSound').textContent = RT.sfx.enabled ? '🔊' : '🔇';
    $('btnMusic').textContent = '🎵';
    $('btnMusic').style.opacity = RT.sfx.musicOn ? 1 : 0.45;
  };
  syncAudioBtns();
  $('btnSound').onclick = () => { RT.sfx.unlock(); RT.sfx.setEnabled(!RT.sfx.enabled); syncAudioBtns(); };
  $('btnMusic').onclick = () => { RT.sfx.unlock(); RT.sfx.setMusic(!RT.sfx.musicOn); syncAudioBtns(); };
  // 朗讀與大字：HUD 與首頁各一組開關
  const syncA11y = () => {
    const v = RT.voice;
    $('btnVoice').style.opacity = v.on ? 1 : 0.45;
    $('btnBig').style.opacity = v.big ? 1 : 0.45;
    $('optVoice').textContent = '🗣 朗讀對話：' + (v.on ? '開' : '關');
    $('optBig').textContent = '🔠 大字模式：' + (v.big ? '開' : '關');
    $('optVoice').classList.toggle('on', v.on);
    $('optBig').classList.toggle('on', v.big);
  };
  const toggleVoice = () => {
    if (!RT.voice.supported) { ui.float('這個瀏覽器不支援語音朗讀'); return; }
    RT.voice.setOn(!RT.voice.on);
    if (RT.voice.on && !RT.voice.hasChinese()) ui.float('找不到中文語音，請到裝置設定安裝「中文（台灣）」語音');
    syncA11y();
  };
  const toggleBig = () => { RT.voice.setBig(!RT.voice.big); syncA11y(); };
  $('btnVoice').onclick = $('optVoice').onclick = toggleVoice;
  $('btnBig').onclick = $('optBig').onclick = toggleBig;
  syncA11y();
  // 所有按鈕的點擊聲
  document.addEventListener('click', (e) => { if (e.target.closest('button')) RT.sfx.play('click'); }, true);
  $('btnCopy').onclick = () => {
    const text = `我在 RT24 當了一天醫事放射師：「${$('rankTitle').textContent}」，綜合 ${score()} 分。`;
    const done = () => { $('btnCopy').textContent = '已複製'; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => window.prompt('複製這段文字', text));
    else window.prompt('複製這段文字', text);
  };
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'e' && !$('prompt').classList.contains('hidden')) promptAction();
    else if (k === ' ' || k === 'enter') { if (ui.advance()) e.preventDefault(); }
  });
})();
