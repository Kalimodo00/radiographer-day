// 音效與背景音樂：全部用 WebAudio 即時合成，不需要音檔
(function () {
  const RT = (window.RT = window.RT || {});
  let ctx = null, master, sfxBus, musicBus, noiseBuf, humNodes = null, musicTimer = null;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { /* 無痕模式 */ } },
  };
  const sfx = (RT.sfx = { enabled: store.get('rt24-sfx', true), musicOn: store.get('rt24-music', true) });

  // 第一次使用者操作時建立 AudioContext（瀏覽器規定）
  sfx.unlock = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfx.enabled ? 1 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (sfx.musicOn) sfx.setMusic(true);
  };

  function tone(freq, dur, o) {
    if (!ctx) return;
    o = o || {};
    const t = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.08, t + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function noise(dur, o) {
    if (!ctx) return;
    o = o || {};
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.08, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  let stepAlt = false;
  const SOUNDS = {
    click: () => noise(0.03, { filter: 'highpass', freq: 3000, vol: 0.05 }),
    blip: () => tone(740, 0.06, { vol: 0.035, type: 'triangle' }),
    step: () => { stepAlt = !stepAlt; noise(0.07, { freq: stepAlt ? 700 : 560, q: 2, vol: 0.07 }); },
    arrive: () => { tone(880, 0.09, { vol: 0.05 }); tone(1320, 0.12, { vol: 0.05, at: 0.07 }); },
    // 院內廣播「叮咚」
    chime: () => { tone(784, 0.7, { vol: 0.07, attack: 0.01 }); tone(659, 0.9, { vol: 0.07, at: 0.38, attack: 0.01 }); },
    phone: () => {
      for (let r = 0; r < 2; r++) for (let i = 0; i < 10; i++) {
        tone(i % 2 ? 1250 : 1000, 0.045, { type: 'square', vol: 0.025, at: r * 0.75 + i * 0.045 });
      }
    },
    // X 光：預備嗶聲＋曝光的高頻鳴音
    xray: () => {
      tone(1000, 0.12, { vol: 0.05, type: 'square' });
      tone(1800, 0.45, { vol: 0.035, type: 'square', at: 0.25 });
      tone(90, 0.45, { vol: 0.05, type: 'sawtooth', at: 0.25 });
    },
    // CT 機架旋轉
    ct: () => {
      noise(2.2, { freq: 250, to: 1600, q: 3, vol: 0.06, attack: 0.6 });
      tone(110, 2.2, { to: 240, vol: 0.04, type: 'triangle', attack: 0.6 });
      tone(1000, 0.15, { vol: 0.05, at: 2.3 });
    },
    // MRI 的敲擊聲
    mri: () => {
      for (let i = 0; i < 14; i++) tone(520, 0.035, { type: 'square', vol: 0.04, at: i * 0.12 });
      for (let i = 0; i < 6; i++) tone(260, 0.12, { type: 'sawtooth', vol: 0.03, at: 1.8 + i * 0.2 });
    },
    alarm: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, 0.16, { type: 'sawtooth', vol: 0.035, at: i * 0.18 }); },
    good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.06, at: i * 0.07 })),
    ok: () => { tone(523, 0.2, { type: 'triangle', vol: 0.06 }); tone(587, 0.3, { type: 'triangle', vol: 0.06, at: 0.1 }); },
    bad: () => { tone(233, 0.4, { type: 'sawtooth', vol: 0.04, to: 150 }); },
    wrong: () => tone(200, 0.12, { type: 'sawtooth', vol: 0.035 }),
    bite: () => { noise(0.05, { freq: 2200, q: 3, vol: 0.08 }); noise(0.05, { freq: 1700, q: 3, vol: 0.06, at: 0.08 }); },
    bubble: () => tone(1180, 0.05, { vol: 0.018, type: 'triangle' }),
    // 警車鳴笛：高低音來回約 4 秒
    siren: () => {
      if (!ctx) return;
      const t = ctx.currentTime, osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = 'sawtooth';
      for (let i = 0; i < 8; i++) {
        osc.frequency.setValueAtTime(i % 2 ? 960 : 640, t + i * 0.5);
        osc.frequency.linearRampToValueAtTime(i % 2 ? 640 : 960, t + i * 0.5 + 0.48);
      }
      f.type = 'lowpass'; f.frequency.value = 1800;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.2);
      g.gain.setValueAtTime(0.05, t + 3.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.1);
      osc.connect(f); f.connect(g); g.connect(sfxBus);
      osc.start(t); osc.stop(t + 4.2);
    },
    // 鐵柵欄落下
    clang: () => { noise(0.5, { freq: 900, q: 6, vol: 0.12 }); tone(110, 0.6, { type: 'square', vol: 0.05 }); tone(165, 0.5, { type: 'square', vol: 0.03, at: 0.02 }); },
    // 鋼瓶被吸過去的呼嘯聲＋撞上磁體
    whoosh: () => noise(0.7, { freq: 300, to: 2400, q: 2, vol: 0.09, attack: 0.5 }),
    slam: () => { noise(0.35, { freq: 600, q: 3, vol: 0.16 }); tone(70, 0.5, { type: 'square', vol: 0.06 }); },
    // 失超：液態氦汽化的強烈嘶嘶聲
    hiss: () => noise(5, { filter: 'highpass', freq: 1200, vol: 0.09, attack: 0.3 }),
    cash: () => [1319, 1568, 2093].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.05, at: i * 0.09 })),
    fanfare: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.06, at: i * 0.12 }));
      [523, 659, 784].forEach((f) => tone(f, 1.2, { type: 'triangle', vol: 0.04, at: 0.55 }));
    },
  };

  sfx.play = function (name) {
    if (!ctx || !sfx.enabled || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) { /* 音效失敗不影響遊戲 */ }
  };

  // 推行動式 X 光機時的馬達聲
  sfx.hum = function (on) {
    if (!ctx) return;
    if (on && !humNodes) {
      const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 62;
      lfo.frequency.value = 3; lg.gain.value = 6; lfo.connect(lg); lg.connect(osc.frequency);
      f.type = 'lowpass'; f.frequency.value = 260;
      g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.4);
      osc.connect(f); f.connect(g); g.connect(sfxBus);
      osc.start(); lfo.start();
      humNodes = { osc, lfo, g };
    } else if (!on && humNodes) {
      const h = humNodes; humNodes = null;
      h.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      h.osc.stop(ctx.currentTime + 0.5); h.lfo.stop(ctx.currentTime + 0.5);
    }
  };

  // --- 背景音樂：慢速 lo-fi 和弦＋琶音，隨機生成不會重複 ---
  const BEAT = 60 / 78;
  const CHORDS = [
    [48, 52, 55, 59], // Cmaj7
    [45, 48, 52, 55], // Am7
    [41, 45, 48, 52], // Fmaj7
    [43, 47, 50, 52], // G6
  ];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let nextTime = 0, eighth = 0;

  function scheduleMusic() {
    while (nextTime < ctx.currentTime + 0.4) {
      const chord = CHORDS[Math.floor(eighth / 16) % CHORDS.length], pos = eighth % 16;
      if (pos === 0) {
        chord.forEach((m) => padNote(hz(m), nextTime, BEAT * 8));
        tone(hz(chord[0] - 12), BEAT * 3, { bus: musicBus, vol: 0.09, at: nextTime - ctx.currentTime, attack: 0.02 });
      }
      if (pos === 8) tone(hz(chord[0] - 12), BEAT * 3, { bus: musicBus, vol: 0.07, at: nextTime - ctx.currentTime, attack: 0.02 });
      if (Math.random() < 0.6) {
        const m = chord[Math.floor(Math.random() * 4)] + (Math.random() < 0.5 ? 12 : 24);
        tone(hz(m), 0.6, { bus: musicBus, vol: 0.035, type: 'triangle', at: nextTime - ctx.currentTime, attack: 0.01 });
      }
      nextTime += BEAT / 2;
      eighth++;
    }
  }

  function padNote(freq, t, dur) {
    const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq; osc.detune.value = (Math.random() - 0.5) * 12;
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 1.4);
    g.gain.setValueAtTime(0.03, t + dur - 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    osc.connect(f); f.connect(g); g.connect(musicBus);
    osc.start(t); osc.stop(t + dur + 1);
  }

  sfx.setMusic = function (on) {
    sfx.musicOn = on;
    store.set('rt24-music', on);
    if (!ctx) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.4);
    if (on && !musicTimer) {
      nextTime = ctx.currentTime + 0.1;
      musicTimer = setInterval(scheduleMusic, 120);
    } else if (!on && musicTimer) {
      clearInterval(musicTimer); musicTimer = null;
    }
  };

  // 對話或小遊戲時把音樂壓低一點
  sfx.duck = function (on) {
    if (!ctx || !sfx.musicOn) return;
    musicBus.gain.setTargetAtTime(on ? 0.3 : 0.55, ctx.currentTime, 0.3);
  };

  sfx.setEnabled = function (on) {
    sfx.enabled = on;
    store.set('rt24-sfx', on);
    if (ctx) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  };
})();
