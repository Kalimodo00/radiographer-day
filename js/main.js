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
    world.target = s.poi;
    $('objText').textContent = s.hint;
    $('objective').classList.remove('hidden');
    world.locked = false;
  }

  async function interact() {
    if (busy || !playing) return;
    const s = RT.STEPS[RT.state.step];
    busy = true;
    world.stop(); world.locked = true; world.target = null;
    RT.state.place = s.place;
    $('prompt').classList.add('hidden'); $('objective').classList.add('hidden');
    await s.run();
    busy = false;
    nextStep();
  }

  function score() {
    const s = RT.state.stats;
    return Math.round(s.safety * 0.4 + s.quality * 0.3 + s.pace * 0.15 + s.energy * 0.15);
  }

  function finish() {
    playing = false; world.locked = true; world.chatter = false;
    RT.sfx.play('fanfare');
    $('objective').classList.add('hidden');
    const sc = score();
    const rank = sc >= 80 ? ['ALARA 守門人', '該攔的都攔下來了，該照的一張到位。病人不會知道你今天替他們擋掉了什麼，這正是這份工作的樣子。']
      : sc >= 65 ? ['可靠的當班放射師', '有幾個地方可以更好，但沒有人因為你而多冒風險。明天繼續。']
      : sc >= 50 ? ['還在抓節奏的新人', '今天有點兵荒馬亂。回頭看看下面每個決定，下次會順很多。']
      : ['今天先回家睡飽', '有些事不能靠運氣。好消息是這只是遊戲，而且可以再上一天班。'];
    $('rankTitle').textContent = rank[0];
    $('rankText').textContent = `${RT.state.name}，綜合評分 ${sc} 分。${rank[1]}`;
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

  world.init($('scene'));
  world.onArrive = () => { if (playing && !busy && world.distToTarget() < 1.6) RT.sfx.play('arrive'); };
  world.onStep = () => RT.sfx.play('step');
  world.onChatter = () => RT.sfx.play('bubble');
  let ducked = false;
  world.onFrame = () => {
    const near = playing && !busy && !world.locked && world.distToTarget() < 1.6;
    $('prompt').classList.toggle('hidden', !near);
    if (near) $('prompt').textContent = 'E　' + RT.STEPS[RT.state.step].prompt;
    const talking = !$('dialog').classList.contains('hidden') || !$('panel').classList.contains('hidden');
    if (talking !== ducked) { ducked = talking; RT.sfx.duck(talking); }
  };

  $('nameInput').value = store.get('rt24-name') || '';
  $('btnStart').onclick = () => {
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
  $('prompt').onclick = interact;
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
    if (k === 'e' && !$('prompt').classList.contains('hidden')) interact();
    else if (k === ' ' || k === 'enter') { if (ui.advance()) e.preventDefault(); }
  });
})();
