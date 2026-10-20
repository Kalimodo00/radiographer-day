// 語音朗讀與大字模式：給看字比較吃力的玩家
(function () {
  const RT = (window.RT = window.RT || {});
  const store = {
    get(k) { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } },
    set(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { /* 無痕模式 */ } },
  };
  const synth = window.speechSynthesis;
  const voice = (RT.voice = { on: store.get('rt24-voice'), big: store.get('rt24-big'), supported: !!synth });
  let picked = null, male = null, female = null;

  // 男性角色用男聲、女性角色用女聲（裝置有的話），再加上不同音高
  const GENDER = { '淑芬組長': 'f', '怡君': 'f', '怡君（電話）': 'f', '吳小姐': 'f', '周小姐': 'f',
    '小傑': 'm', '張醫師': 'm', '王伯伯': 'm', '林先生': 'm', '陳先生': 'm' };
  // 每個角色用不同音高，聽得出是誰在說話
  const PITCH = { '淑芬組長': 1.05, '小傑': 1.3, '怡君': 1.25, '怡君（電話）': 1.25, '張醫師': 0.85, '王伯伯': 0.7,
    '林先生': 0.8, '陳先生': 0.8, '吳小姐': 1.2, '周小姐': 1.2, '你': 1.0, '現場狀況': 0.95 };

  function pick() {
    if (!synth) return null;
    const vs = synth.getVoices();
    const score = (v) => {
      const lang = (v.lang || '').toLowerCase().replace('_', '-');
      let s = 0;
      if (lang === 'zh-tw') s += 100;
      else if (lang.startsWith('cmn') || lang === 'zh-cn') s += 60;
      else if (lang.startsWith('zh') && lang !== 'zh-hk') s += 40;
      else return -1;
      if (/natural|online|neural|google/i.test(v.name)) s += 10; // 較自然的語音
      return s;
    };
    let best = null, bs = -1;
    vs.forEach((v) => { const s = score(v); if (s > bs) { bs = s; best = v; } });
    return bs >= 0 ? best : null;
  }
  // 在同一種中文裡找男聲／女聲
  function pickGender(re) {
    if (!synth || !picked) return null;
    const base = picked.lang.toLowerCase();
    const same = synth.getVoices().filter((v) => v.lang.toLowerCase() === base && re.test(v.name));
    return same.find((v) => /natural|online|neural/i.test(v.name)) || same[0] || null;
  }
  function refresh() {
    picked = pick();
    male = pickGender(/zhiwei|yunjhe|kangkang|yunxi|yunyang/i);
    female = pickGender(/hanhan|yating|hsiaochen|hsiaoyu|huihui|yaoyao|xiaoxiao|female/i);
  }
  if (synth) {
    refresh();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', refresh);
  }
  voice.hasChinese = () => !!(picked || pick());

  // 去掉表情符號與括號說明，長句切段（部分瀏覽器朗讀太長會被截斷）
  function chunks(text) {
    const clean = String(text)
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
      .replace(/[｜|]/g, '，').replace(/……/g, '，').replace(/——/g, '，')
      .replace(/\s+/g, ' ').trim();
    return clean.split(/(?<=[。！？；])/).map((x) => x.trim()).filter(Boolean);
  }

  voice.speak = function (text, who) {
    if (!voice.on || !synth || !text) return;
    synth.cancel();
    const pitch = PITCH[who] || 1;
    const g = GENDER[who];
    const v = (g === 'm' && male) || (g === 'f' && female) || picked;
    chunks(text).forEach((part) => {
      const u = new SpeechSynthesisUtterance(part);
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'zh-TW';
      u.rate = 0.95;
      u.pitch = pitch;
      synth.speak(u);
    });
  };
  voice.stop = function () { if (synth) synth.cancel(); };

  voice.setOn = function (on) {
    voice.on = on;
    store.set('rt24-voice', on);
    if (!on) voice.stop();
    else voice.speak('語音朗讀已開啟。');
  };
  voice.setBig = function (on) {
    voice.big = on;
    store.set('rt24-big', on);
    document.documentElement.classList.toggle('big', on);
  };
  document.documentElement.classList.toggle('big', voice.big);
})();
