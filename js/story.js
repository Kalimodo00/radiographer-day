// 劇情：白班的十五個任務與圖鑑
(function () {
  const RT = (window.RT = window.RT || {});
  const ui = RT.ui, world = RT.world;
  const NARR = '現場狀況';

  // 小遊戲影像的說明（顯示在影像下方；有 url 時會變成連結）
  RT.CREDITS = {
    cxr: { text: '程式合成示意圖（tools/gen_xray.py），非真實病人影像' },
    ct: { text: '程式合成示意圖（tools/gen_xray.py），非真實病人影像' },
  };

  RT.CODEX = {
    badge: { t: '劑量佩章', d: '記錄輻射工作人員累積劑量的個人劑量計，通常每月送測。要跟著人走，穿鉛衣時戴在鉛衣內側的胸前。' },
    id: { t: '雙重辨識', d: '用至少兩種資料（例如姓名加出生年月日）確認病人身分，並用開放式問句請病人自己說出來，再和檢查單、手圈核對。' },
    pa: { t: '胸部 PA 像', d: '病人面向X光接收板、X 光由後往前穿過。要在深吸氣後閉氣的瞬間曝光，肺野才撐得開。' },
    reject: { t: '重照', d: '影像無法診斷而必須再照一次。每一次重照都是額外的劑量，所以要記錄原因、定期分析，找出能改善的地方。' },
    pacs: { t: 'PACS', d: '醫療影像儲傳系統。影像照完會送到這裡，放射科醫師在工作站上判讀、打報告。' },
    alara: { t: 'ALARA', d: '合理抑低原則：在能達成診斷目的的前提下，讓劑量盡可能低。三個基本手段是時間、距離、屏蔽。' },
    inverse: { t: '平方反比定律', d: '離射源的距離變成兩倍，劑量率大約剩四分之一。照 portable 時多退幾步，比什麼都有效。' },
    contrast: { t: '含碘顯影劑', d: 'CT 常用的靜脈注射藥物，讓血管與器官對比更清楚。腎功能不佳或曾有過敏反應的病人，需要醫師先評估。' },
    egfr: { t: 'eGFR', d: '估算腎絲球過濾率，用來評估腎功能。數值偏低時，打顯影劑前要特別小心。' },
    scout: { t: '定位像', d: 'CT 正式掃描前先照的一張平面影像，用來框出掃描範圍。範圍剛好就好，多掃的都是多餘劑量。' },
    mrisafe: { t: 'MRI 安全篩檢', d: '進磁振室前確認病人身上與體內沒有不相容的金屬或電子裝置。磁場全年無休，沒在掃描時也一樣強。' },
    projectile: { t: '投射效應', d: '鐵磁性物品靠近磁體時會被高速吸過去，氧氣鋼瓶、輪椅、剪刀都可能變成飛彈。' },
    gauss: { t: '5 高斯線', d: '磁場強度 5 高斯的邊界，地上常畫黃線標示。線內屬於管制區，沒經過篩檢的人和物品不能進去。' },
    chaperone: { t: '告知、同意與陪同', d: '擺位需要碰觸病人時，先說明原因並取得同意，盡量請病人自行調整或用手背輔助；檢查服、布單遮蓋與同性同仁陪同，能保護病人，也保護放射師。' },
    harass: { t: '權勢性騷擾', d: '利用醫療、教育、職場等關係，對受自己照護或監督的人性騷擾。性騷擾防治法對權勢性騷擾加重處罰，醫事人員更要守住專業界線。' },
    quench: { t: '淬熄（Quench）', d: 'MRI 的超導磁體靠液態氦維持低溫。緊急淬熄會讓液態氦迅速汽化、經淬熄管排出，磁場在短時間內消失。只用在有人被夾住或有生命危險時，代價是大量氦氣與長時間停機。' },
    pregnancy: { t: '懷孕確認', d: '育齡女性做游離輻射檢查前，要在顧及隱私的情況下詢問懷孕可能；有疑慮就先請醫師評估。' },
  };

  // 違法事件：法條內容依全國法規資料庫（2026 年 10 月）查詢後簡化，實際認定依個案
  const PRO = { name: '醫事放射師法第 37 條', desc: '醫事放射師於業務上有違法或不正當行為。',
    pen: '新臺幣 2 萬～10 萬元罰鍰；情節重大者停業 1 個月～1 年或廢止執業執照，涉及刑事責任者移送檢察機關' };
  RT.CRIMES = {
    touch: {
      kind: 'jail', shout: { who: '周小姐', text: '你幹嘛！！' },
      title: '你觸犯了法律：偷摸病人胸部、臀部',
      act: '你在拍攝過程中，趁周小姐不注意偷偷碰觸她的胸部和臀部。她大喊之後立刻報警，警察已經到了 X 光室。',
      groups: [
        { head: '刑事責任（依情節認定其一）', laws: [
          { name: '刑法第 228 條第 2 項｜利用權勢猥褻罪', desc: '對因醫療關係受自己照護的人，利用權勢或機會為猥褻行為。', pen: '3 年以下有期徒刑（非告訴乃論）' },
          { name: '性騷擾防治法第 25 條｜強制觸摸罪', desc: '意圖性騷擾，乘人不及抗拒而觸摸其臀部、胸部或其他身體隱私處。', pen: '2 年以下有期徒刑、拘役或併科 10 萬元以下罰金；利用醫療權勢或機會犯之，加重其刑至二分之一' },
        ] },
        { head: '民事與行政責任', laws: [
          { name: '性騷擾防治法第 12 條｜損害賠償', desc: '對他人性騷擾者，須負損害賠償責任。', pen: '屬權勢性騷擾者，法院得另判 1～3 倍懲罰性賠償金' },
          PRO,
        ] },
      ],
      right: '碰觸前先說明原因並取得同意；示範姿勢讓病人自己貼近X光接收板；必要時只用手背碰肩膀；請同性同仁在場陪同。',
      real: '近年確實有醫事放射師因為在檢查中不當碰觸、偷窺或偷拍病人，被判刑、罰款，甚至失去執照。專業的距離，保護的是病人，也是你自己。',
      logTitle: '偷摸病人（觸法）',
      logText: '拍攝過程中偷摸病人胸部、臀部，可能觸犯刑法第 228 條或性騷擾防治法第 25 條，並面臨民事賠償與醫事放射師法的停業、廢照處分。',
    },
    peek: {
      kind: 'jail',
      title: '你觸犯了法律：偷窺病人裙底',
      act: '你繞到檢查台尾端，彎腰偷看周小姐的裙底。她發現後大聲呼救，院內同仁報警處理。',
      groups: [
        { head: '行政與民事責任', laws: [
          { name: '性騷擾防治法第 2 條第 2 項、第 27 條｜權勢性騷擾', desc: '利用醫療關係對受自己照護的人性騷擾，經申訴調查成立。', pen: '新臺幣 6 萬～60 萬元罰鍰' },
          { name: '性騷擾防治法第 12 條｜損害賠償', desc: '對他人性騷擾者，須負損害賠償責任。', pen: '屬權勢性騷擾者，法院得另判 1～3 倍懲罰性賠償金' },
          PRO,
        ] },
        { head: '如果還用手機拍下來', laws: [
          { name: '刑法第 319-1 條｜無故攝錄性影像罪', desc: '未經同意，以照相、錄影等方法攝錄他人性影像。', pen: '3 年以下有期徒刑；未遂也罰' },
        ] },
      ],
      right: '病人躺著檢查時，用布單蓋住不需要照的部位，只露出檢查部位；站在需要擺位的位置，不在檢查以外的地方逗留。',
      real: '近年確實有醫事放射師因為在檢查中不當碰觸、偷窺或偷拍病人，被判刑、罰款，甚至失去執照。專業的距離，保護的是病人，也是你自己。',
      logTitle: '偷窺病人（觸法）',
      logText: '在檢查台尾端偷窺病人裙底，屬權勢性騷擾，可處 6 萬～60 萬元罰鍰並負民事賠償；若偷拍，另觸犯刑法第 319-1 條。',
    },
  };

  RT.CRIMES.skirt = {
    kind: 'complaint', shout: { who: '周小姐', text: '你在做什麼？！我要投訴你！' },
    title: '你被投訴了：故意拉扯病人短裙',
    act: '你在擺位時偷偷把周小姐的短裙往上拉，讓裙底露了出來。她當場表示要提出性騷擾申訴，院方也已經介入，組長在 X 光室外面等你。',
    groups: [
      { head: '申訴調查與行政責任', laws: [
        { name: '性騷擾防治法第 14、15 條｜申訴與調查', desc: '被害人可提出性騷擾申訴（公立醫院等政府機關人員向所屬機關提出，其他情形向事件發生地的警察機關提出）；屬權勢性騷擾者，知悉後 3 年內都能申訴。', pen: '受理後 7 日內開始調查、2 個月內完成（必要時延長 1 個月），再由縣市主管機關審議' },
        { name: '性騷擾防治法第 2 條第 2 項、第 27 條｜權勢性騷擾', desc: '利用醫療關係對受自己照護的人性騷擾，經申訴調查成立。', pen: '新臺幣 6 萬～60 萬元罰鍰' },
        { name: '性騷擾防治法第 12 條｜損害賠償', desc: '對他人性騷擾者，須負損害賠償責任。', pen: '屬權勢性騷擾者，法院得另判 1～3 倍懲罰性賠償金' },
        PRO,
      ] },
      { head: '情節嚴重時', laws: [
        { name: '刑法第 228 條第 2 項｜利用權勢猥褻罪', desc: '故意讓受照護的病人身體隱私處暴露，若被認定為猥褻行為。', pen: '3 年以下有期徒刑（非告訴乃論）' },
      ] },
    ],
    right: '病人躺著檢查時，先用布單蓋住不需要照的部位，只露出檢查部位；需要調整衣物時，先說明並請病人自己整理。',
    real: '被投訴後，醫院很可能先暫停你的臨床工作，並配合性騷擾申訴調查。就算最後沒有被判刑，調查成立的紀錄、罰鍰與賠償，也足以讓一位放射師的職涯停下來。',
    logTitle: '拉扯病人短裙（被投訴）',
    logText: '擺位時故意拉起病人短裙導致暴露，病人提出性騷擾申訴；調查成立可處 6 萬～60 萬元罰鍰並負賠償，情節嚴重可能另涉刑法第 228 條。',
  };

  const mini = async (title, intro, game, res, codex) => {
    const body = ui.openPanel(title, intro);
    const g = await game(body);
    const t = typeof res[g].text === 'function' ? res[g].text() : res[g].text;
    return ui.feedback(body, title, g, t, res[g].fx, codex);
  };

  RT.STEPS = [
    {
      time: '07:50', poi: 'badge', place: '休息室', hint: '到休息室牆上的佩章架，戴上劑量佩章', prompt: '拿佩章',
      async run() {
        await ui.say(NARR, '你刷卡進放射科。走廊的燈還沒全亮，行動式 X 光機在角落充電。');
        await ui.choose({
          title: '劑量佩章', intro: '佩章架上掛著你的名字。這個小東西要記錄你這個月吃到多少輻射。要戴哪裡？', codex: ['badge'],
          options: [
            { label: '別在胸前；等等穿鉛衣時，戴在鉛衣裡面', grade: 'good', fx: { safety: 8 }, text: '佩章要量的是你身體實際接受的劑量，所以跟著人、戴在鉛衣內側。' },
            { label: '夾在識別證帶上，晃來晃去也沒差', grade: 'ok', fx: { safety: -2 }, text: '有戴總比沒戴好，但位置不固定、又掛在鉛衣外面，讀數就不代表你身體接受的劑量。' },
            { label: '收在置物櫃裡，才不會弄丟', grade: 'bad', fx: { safety: -8 }, text: '佩章沒跟著人，這個月的劑量紀錄等於一張白紙。' },
          ],
        });
      },
    },
    {
      time: '08:00', poi: 'lead', place: '閱片室', hint: '到閱片室找淑芬組長，聽今天的分工', prompt: '找組長',
      async run() {
        await ui.say('淑芬組長', '{name}，早。今天你跑一般攝影，急診的 portable 也歸你，下午支援 CT 跟 MRI。');
        await ui.say('淑芬組長', '小傑今天跟著你。他很認真，就是衝得比腦袋快。');
        await ui.say('小傑', '我昨天把擺位口訣全部背完了！');
        await ui.say('淑芬組長', '口訣先放著。先學會問病人叫什麼名字。');
      },
    },
    {
      time: '08:30', poi: 'wang', place: '候診區', hint: '到候診區，請王伯伯進來照胸部 X 光', prompt: '叫病人',
      async run() {
        await ui.choose({
          title: '叫病人', intro: '檢查單：王○明，72 歲，胸部 X 光 PA。候診區坐了一排人。你怎麼開口？', codex: ['id'],
          options: [
            { label: '「請問您的大名，還有出生年月日？」然後核對檢查單', grade: 'good', fx: { safety: 10 }, text: '讓病人自己說出兩項資料，再跟單子對。這是整個流程裡最便宜的一道保險。' },
            { label: '「37 號，37 號請進。」', grade: 'ok', fx: { safety: -3 }, text: '進來的人確實拿著 37 號。但號碼牌是可以拿錯、撿到、幫忙拿的。' },
            { label: '「王伯伯？這邊請。」', grade: 'bad', fx: { safety: -10, pace: -4 }, text: '候診區同時站起來兩位王伯伯。你花了五分鐘才搞清楚誰是誰。' },
          ],
        });
        world.place('wang', 1.4, 7.1, -1.57);
      },
    },
    {
      time: '08:35', poi: 'xstand', place: 'X 光室', hint: '到 X 光室的立式架，幫王伯伯擺位', prompt: '幫病人擺位',
      async run() {
        await ui.say('王伯伯', '少年欸，我這件襯衫是新的，不用脫吧？');
        await ui.choose({
          title: '照相前準備', intro: '王伯伯穿著金屬鈕扣的襯衫，脖子上掛著一條有墜子的項鍊。',
          options: [
            { label: '請他換檢查服、拿下項鍊，口袋也清空', grade: 'good', fx: { quality: 8 }, text: '多花兩分鐘，片子上就只有王伯伯，沒有別的東西。' },
            { label: '項鍊甩到背後就好，比較快', grade: 'ok', fx: { quality: -4, pace: 2 }, text: '背後也還在照野裡。項鍊這次剛好疊在脊椎上，勉強能看，但運氣不會每次都在。' },
            { label: '直接照，鈕扣那麼小看不出來', grade: 'bad', fx: { quality: -10, safety: -5 }, text: '片子上一排鈕扣加一個墜子，正好蓋在肺門。重照，王伯伯多吃一次劑量。' },
          ],
        });
        await ui.say('你', '下巴靠在這裡，肩膀往前貼，手背插在腰上。等一下我說吸氣，就吸到最飽然後停住。');
      },
    },
    {
      time: '08:40', poi: 'xconsole', place: 'X 光室', hint: '退到鉛屏風後面的控制台，準備曝光', prompt: '操作控制台',
      async run() {
        await mini('吸氣——停！', '胸部 PA 要在吸到最飽的瞬間曝光，肺才撐得開。看著黃色指標，到綠色區時按下曝光。', ui.breathGame, {
          good: { fx: { quality: 10, pace: 2 }, text: '兩側肺野撐得漂亮，肋膈角清楚。一張過關。' },
          ok: { fx: { quality: 2 }, text: '吸得不夠飽，肺下緣有點擠。能判讀，但張醫師會多看兩眼。' },
          bad: { fx: { quality: -8, safety: -4, pace: -4 }, text: '王伯伯正在吐氣，肺野塌了一半。只能重照。' },
        }, ['pa']);
        await ui.say('王伯伯', '這樣就好了喔？比我去照相館還快。');
        world.show('wang', false);
        world.place('intern', 16.4, 16.2, -1.57);
      },
    },
    {
      time: '09:40', poi: 'pacs', place: '閱片室', hint: '小傑在閱片室叫你：他照的片子好像怪怪的', prompt: '看影像',
      async run() {
        await ui.say('小傑', '學長姐，我剛剛自己照了一張胸部，可以直接送出嗎？');
        const g = await mini('影像品管', '這是小傑剛幫一位小朋友照的胸部 PA。', ui.spotGame, {
          good: { fx: { quality: 8 }, text: '一眼就看到：小朋友的項鍊沒拿下來，鍊子繞過兩側肺尖，心形墜子壓在右肺。' },
          ok: { fx: { quality: 4 }, text: '找到了：項鍊沒拿下來，鍊子繞過兩側肺尖，墜子壓在右肺。' },
          bad: { fx: { quality: -6 }, text: '黃圈那裡：一整條項鍊加一個心形墜子。這種東西要在照之前發現，不是照完之後。' },
        }, ['pacs']);
        await ui.choose({
          title: '這張怎麼辦', intro: g === 'bad' ? '小傑看著你，你看著那條項鍊。' : '小傑的臉垮了下來。', codex: ['reject'],
          options: [
            { label: '請家長幫小朋友拿下項鍊重照，並在系統登記重照原因', grade: 'good', fx: { quality: 6, safety: 2 }, text: '重照不丟臉，沒記錄才可惜。月底看重照統計，才知道要加強哪裡。' },
            { label: '把上緣裁掉，看不到項鍊就好', grade: 'bad', fx: { quality: -10 }, text: '項鍊一路垂到右肺中間，裁到看不到它，半個胸腔也沒了。裁切不是橡皮擦。' },
            { label: '直接送出，醫師應該看得懂', grade: 'bad', fx: { quality: -8 }, text: '十分鐘後張醫師打電話來，語氣很平靜，這才可怕。' },
          ],
        });
        world.place('intern', 19, 12.4, 0.6);
        world.release('intern');
      },
    },
    {
      time: '10:50', poi: 'portable', place: '走廊', hint: '急診來電要 portable：到走廊推行動式 X 光機', prompt: '推機器',
      async run() {
        RT.sfx.play('phone');
        await ui.say('怡君（電話）', '放射科嗎？急診 3 床要 portable chest，病人剛插管，不能搬。');
        world.follow(true);
        await ui.say(NARR, '你握住把手，機器的馬達嗡地醒來。它比你重四百公斤，過彎請溫柔。');
      },
    },
    {
      time: '11:00', poi: 'erbed', place: '急診', hint: '把機器推到急診 3 床旁邊', prompt: '到床邊',
      async run() {
        await ui.say('怡君', '來了來了，板子我幫你扶病人。旁邊這幾位都在忙，你照你的。');
        await ui.choose({
          title: '曝光之前', intro: '床邊有兩位護理師、一位家屬，隔壁床的簾子只拉了一半。', codex: ['alara', 'inverse'],
          options: [
            { label: '喊「照相！」請非必要的人退到兩公尺外；自己穿鉛衣，把曝光線拉到最長', grade: 'good', fx: { safety: 12 }, text: '距離加屏蔽。退兩步，劑量就掉一大截，這是全科最划算的投資。' },
            { label: '請所有人離開急診區再照', grade: 'ok', fx: { safety: 2, pace: -8 }, text: '安全，但過頭了：剛插管的病人身邊不能沒人。退開距離、該留的人穿鉛衣就夠。' },
            { label: '大家都很忙，不打擾，直接按', grade: 'bad', fx: { safety: -12 }, text: '散射線不看職稱。旁邊三個人都在沒有防護的情況下陪照了一張。' },
          ],
        });
        world.follow(false);
        RT.sfx.play('xray');
        await ui.say('怡君', '謝啦。管路位置等等請張醫師先看一下。');
      },
    },
    {
      time: '12:10', poi: 'seat', place: '休息室', hint: '終於：回休息室吃便當', prompt: '坐下吃飯',
      async run() {
        const body = ui.openPanel('便當', '你的便當從 11:40 放到現在。排骨已經不脆了，但它還是排骨。');
        await ui.lunchGame(body, 3);
        ui.closePanel();
        await ui.choose({
          title: '便當還有一半', intro: 'CT 室來電：急診腹痛病人，要做打顯影劑的腹部 CT，病人已經推過去了。',
          options: [
            { label: '蓋上便當，馬上過去', grade: 'good', fx: { pace: 8, energy: 4 }, text: '便當蓋好，推到螢幕旁邊。它會等你的，大概。' },
            { label: '用一分鐘扒完剩下的再過去', grade: 'ok', fx: { pace: -3, energy: 16 }, text: '血糖也是病人安全的一部分。你邊走邊吞下最後一口。' },
            { label: '假裝沒聽到，慢慢吃完', grade: 'bad', fx: { pace: -12, energy: 16 }, text: '第二通電話是淑芬組長打的。她只說了你的名字。' },
          ],
        });
        world.place('lin', 16.8, 6, 1.57);
      },
    },
    {
      time: '12:40', poi: 'lin', place: 'CT 室', hint: 'CT 急件：到 CT 室看林先生的檢查單', prompt: '核對檢查單',
      async run() {
        await ui.say('林先生', '肚子從早上痛到現在……醫生說要打一個藥再照。');
        await ui.choose({
          title: '打顯影劑之前', intro: '你打開病歷，注射器已經接好了。', codex: ['contrast', 'egfr'],
          chart: '檢查：腹部＋骨盆 CT（含顯影劑）<br>eGFR：<b>26</b>　用藥：Metformin<br>過敏史：<b>上次打顯影劑後全身起紅疹</b>',
          options: [
            { label: '先暫停，把腎功能和過敏史通報放射科醫師與開單醫師', grade: 'good', fx: { safety: 12, pace: -3 }, text: '張醫師和急診討論後，改成不打顯影劑的掃描。決定是醫師下的，但把它攔下來的人是你。' },
            { label: '自己決定改成不打顯影劑，直接掃', grade: 'ok', fx: { safety: 2 }, text: '結果也許一樣，但要不要打是醫囑。你該做的是通報，不是代替醫師決定。' },
            { label: '急件就是要快，照醫囑直接打', grade: 'bad', fx: { safety: -15 }, text: '腎功能這麼差又有過敏史，這一針下去的風險沒有任何人評估過。' },
          ],
        });
      },
    },
    {
      time: '12:55', poi: 'ctconsole', place: 'CT 室', hint: '到鉛玻璃後面的 CT 控制台，設定掃描範圍', prompt: '操作控制台',
      async run() {
        await mini('掃描範圍', '醫囑改為不含顯影劑的腹部＋骨盆 CT。在定位像上拉出範圍：大約從橫膈頂到恥骨聯合下緣，上下留一點餘裕就好。但多掃太多，就是多給的劑量。', ui.rangeGame, {
          good: { fx: { quality: 8, safety: 6 }, text: '範圍合理：起點和終點都落在綠色區裡。該看的都在，也沒有多掃一大段。' },
          ok: { fx: { quality: 3, safety: -3 }, text: () => (ui.rangeReason === 'short'
            ? '大致可以，但邊緣切得有點緊：橫膈頂或恥骨聯合可能沒完整包進來。再往外留一點餘裕會更安心。'
            : '該看的都有蓋到，但上下多掃了一段，病人多吃了一些不必要的劑量。') },
          bad: { fx: { quality: -10, pace: -5 }, text: () => (ui.rangeReason === 'short'
            ? '範圍沒蓋滿，漏掉一大段。只好補掃，時間和劑量都多了。'
            : '範圍拉得太大，多掃了一大段沒有醫囑的部位，劑量白白增加。') },
        }, ['scout', 'alara']);
        world.show('lin', false);
        world.place('chen', 30.4, 11.6, -1.57);
        world.place('intern', 25, 12.6, 1.57);
      },
    },
    {
      time: '14:30', poi: 'mri', place: 'MRI 門口', hint: '到 MRI 室門口，幫陳先生做安全篩檢', prompt: '開始篩檢',
      async run() {
        RT.sfx.play('mri');
        await mini('進門前留在外面', '陳先生要做腰椎 MRI。3T 的磁場全年無休，沒在掃描時也一樣強。點選「不能帶進去」的東西。', (body) => ui.itemsGame(body, [
          { icon: '🔑', name: '鑰匙', danger: true }, { icon: '📱', name: '手機', danger: true },
          { icon: '👕', name: '院內檢查服', danger: false }, { icon: '💳', name: '信用卡', danger: true },
          { icon: '⌚', name: '手錶', danger: true }, { icon: '🎧', name: 'MRI 專用耳塞', danger: false },
          { icon: '🦻', name: '助聽器', danger: true }, { icon: '📎', name: '髮夾', danger: true },
        ]), {
          good: { fx: { safety: 10 }, text: '全對。金屬會飛、電子產品會壞、磁條會被洗掉，通通留在置物櫃。' },
          ok: { fx: { safety: 3 }, text: '大致正確。黃框是判斷錯的：只有檢查服和專用耳塞可以進去。' },
          bad: { fx: { safety: -10 }, text: '錯得有點多。只有檢查服和專用耳塞可以進去，其他全部留在外面。' },
        }, ['mrisafe', 'gauss']);
        await ui.say('陳先生', '啊對了，我去年裝了一個心臟節律器，這個應該沒關係吧？');
        await ui.choose({
          title: '心臟節律器', intro: '問卷上這一格是空白的。',
          options: [
            { label: '立刻停下，查節律器型號是否為 MRI 相容，並通報醫師', grade: 'good', fx: { safety: 12 }, text: '有些新型節律器在特定條件下可以掃，但要先查證、由醫師決定。在那之前，一步都不能進去。' },
            { label: '直接取消檢查，請他回去', grade: 'ok', fx: { safety: 3, pace: -5 }, text: '安全，但快了一步：先查證型號再決定，陳先生也許不用白跑一趟。' },
            { label: '都排到了，應該沒關係', grade: 'bad', fx: { safety: -20 }, text: '磁場可能讓節律器失靈或發熱。這是 MRI 室最嚴重的那一類意外。' },
          ],
        });
        world.show('chen', false);
        world.place('intern', 21, 12.3, 1.57);
        world.carry('intern', true);
        await ui.say(NARR, '走廊另一頭傳來急促的腳步聲。小傑抱著一支氧氣鋼瓶，朝 MRI 室衝過來。');
        world.say('intern', '讓開讓開！裡面的病人喘不過氣，我拿氧氣進去救人！', 3.6);
        const walk = world.scriptWalk('intern', [[28.8, 11.2], [30, 10.2], [30, 8.4]], 3.4);
        const body = ui.openPanel('攔住他！', '小傑抱著鐵製的氧氣鋼瓶，正要衝進 MRI 室。', { compact: true });
        const ref = {};
        walk.then(() => { if (ref.cancel) ref.cancel(); });
        const ok = await ui.quickGame(body, '攔住小傑', 3600, ref);
        if (ok) {
          world.halt('intern');
          world.say('intern', '啊……對，鋼瓶是鐵的！', 3);
          await ui.feedback(body, '氧氣鋼瓶', 'good',
            '你一把拉住小傑。一般的氧氣鋼瓶是鐵磁性的，過了那條黃線就會被吸進磁體。病人需要氧氣，要用 MR 相容的鋼瓶或牆上的氧氣。小傑的臉白了。',
            { safety: 10 }, ['projectile']);
          world.carry('intern', false);
        } else {
          ui.closePanel();
          world.focus(29.4, 7.4);
          await walk;
          RT.sfx.play('whoosh');
          world.say('intern', '咦？！鋼瓶自己——', 1.5);
          await world.flyCylinder(30, 1.15, 5.55, 0.9);
          RT.sfx.play('slam'); world.shake(0.6);
          await world.pin('intern', 30, 6.0, 0.35, 0.7);
          RT.sfx.play('slam'); world.shake(0.4);
          world.say('intern', '救命啊！！我被夾住了！', 6);
          await ui.say(NARR, '鋼瓶以極快的速度飛向磁體孔口，小傑連人帶鋼瓶被吸過去，夾在磁體上動彈不得。');
          await ui.choose({
            title: '小傑被夾在磁體上', intro: '他臉色發白、呼吸急促。3T 的磁場一直都在，你要怎麼做？', codex: ['quench'],
            options: [
              { label: '請其他人撤離、打開門，立刻按下緊急淬熄（Quench）', grade: 'good', fx: { safety: 6 }, text: '有人被夾住、可能受傷時，就是按下淬熄的時機。同時讓其他人離開、打開門，避免氦氣外洩造成缺氧。' },
              { label: '先試著徒手把鋼瓶拔下來', grade: 'bad', fx: { safety: -8 }, text: '3T 磁場的吸力可以達到好幾百公斤，你根本拔不動，還差點把自己的手夾進去。最後還是得按淬熄，只是晚了寶貴的幾分鐘。' },
              { label: '打給原廠工程師，等他來慢慢降場', grade: 'bad', fx: { safety: -12 }, text: '一般的降場要好幾個小時，被夾住的人等不了。人命優先，這時候該按的就是淬熄。' },
            ],
          });
          RT.sfx.play('hiss');
          world.smoke(30, 3.7, 4);
          world.setMriLabel('MR-01 · 淬熄停機');
          await ui.say(NARR, '轟——液態氦在幾十秒內汽化，大量白色氣體湧出。磁場消失，鋼瓶掉了下來，小傑也終於脫身。');
          await ui.quenchBill();
          world.place('intern', 30, 7.4, 0);
          world.dropCylinder(30.7, 6.3);
          world.say('intern', '對不起……我只是想救人……', 3.5);
          const b2 = ui.openPanel('氧氣鋼瓶', '');
          await ui.feedback(b2, '氧氣鋼瓶', 'bad',
            '一般的氧氣鋼瓶是鐵磁性的，MRI 室裡要用 MR 相容的鋼瓶或牆上的氧氣。這次的代價：補充氦氣、重新升場與停機，約新台幣 200 萬元，MRI 停機一到兩週，今天的 MRI 病人全部要改期。',
            { safety: -15, pace: -10 }, ['projectile']);
          world.focus(null);
        }
        world.place('intern', 19, 12.4, 0.6);
        world.release('intern');
        world.place('zhou', 5.6, 16.6, 0, -0.12);
        world.place('wu', 6.8, 20, 0, -0.12);
      },
    },
    {
      time: '15:10', poi: 'zhou', place: '候診區', hint: '到候診區，周小姐要照胸部和右膝 X 光', prompt: '叫病人',
      async run() {
        await ui.say('周小姐', '你好，我是周○婷，民國 91 年 3 月 8 日生。今天要照職前健檢的胸部，還有昨天打球扭到的右膝。');
        await ui.say('你', '好的，跟檢查單一樣。胸部要先換上檢查服，更衣室在 X 光室裡面。');
        world.place('zhou', 1.4, 7.1, -1.57);
      },
    },
    {
      time: '15:15', poi: 'xstand', place: 'X 光室', hint: '到 X 光室的立式架，幫周小姐擺胸部 PA', prompt: '幫病人擺位',
      async run() {
        const o = await ui.choose({
          title: '擺位的時候', intro: '周小姐換好檢查服站上立式架，但胸口離X光接收板還有一段距離，肩膀也沒有往前靠。', codex: ['chaperone', 'harass'],
          options: [
            { label: '先說明要怎麼站並示範，請她自己貼近X光接收板；需要調整時先告知，只碰肩膀，並請女性同仁在場', grade: 'good', fx: { safety: 10, quality: 6 }, text: '周小姐照著示範把肩膀往前一靠，一次到位。說明、同意、陪同，保護病人，也保護你自己。' },
            { label: '從遠處口頭指示，她怎麼站就怎麼照', grade: 'ok', fx: { quality: -4 }, text: '沒有不當接觸，但擺位不正，肩胛骨沒有拉開、蓋住了肺野。示範一次給她看就能解決。' },
            { label: '在拍攝的過程中偷偷碰觸病人胸部或屁股', crime: 'touch' },
          ],
        });
        if (o.crime) return ui.crime(o.crime);
        await ui.say('你', '深吸一口氣——停住，不要動。');
        RT.sfx.play('xray');
        await ui.say('周小姐', '好了嗎？那我換回衣服，接著照膝蓋。');
        world.lie('zhou', 7.0, 1.05, 3.7);
      },
    },
    {
      time: '15:25', poi: 'ztable', place: 'X 光室', hint: '周小姐躺上檢查台了，到檢查台旁邊準備照右膝', prompt: '準備擺位',
      hotspot: { x: 8.1, z: 3.7, label: '👀 從床尾偷看裙底', crime: 'peek', narr: '你繞到檢查台尾端，彎下腰往裙底看……' },
      async run() {
        const o = await ui.choose({
          title: '照右膝之前', intro: '周小姐換回自己的短裙，躺在檢查台上。右膝要照正面和側面。',
          options: [
            { label: '先用布單蓋住她的腿和裙子，只露出右膝，再開始擺位', grade: 'good', fx: { safety: 8 }, text: '只露出要照的部位。病人放心，你也能專心擺位。' },
            { label: '請她自己把裙子拉好，直接照', grade: 'ok', fx: { safety: 2 }, text: '還算尊重，但照側面要翻身時很難顧到。準備一條布單，比靠病人自己拉更周到。' },
            { label: '裙子短沒關係，反正很快就照完', grade: 'bad', fx: { safety: -8 }, text: '沒有遮蓋就擺位，周小姐從頭緊張到尾，事後向醫院反映。隱私也是醫療品質的一部分。' },
            { label: '擺位時偷偷把她的短裙往上拉，讓裙底露出來', crime: 'skirt' },
          ],
        });
        if (o.crime) return ui.crime(o.crime);
        RT.sfx.play('xray');
        await ui.say('周小姐', '謝謝，我本來還有點緊張。');
        world.show('zhou', false);
      },
    },
    {
      time: '16:00', poi: 'wu', place: '候診區', hint: '到候診區，吳小姐要照腹部 X 光', prompt: '叫病人',
      async run() {
        await ui.choose({
          title: '照之前要問的事', intro: '檢查單：吳○婷，28 歲，腹部 X 光。姓名和生日都核對過了。', codex: ['pregnancy'],
          options: [
            { label: '帶到檢查室裡，小聲詢問有沒有可能懷孕、上次月經是什麼時候', grade: 'good', fx: { safety: 10 }, text: '吳小姐想了一下，說月經晚了一週。你請醫師評估，檢查先暫緩。' },
            { label: '隔著候診區問：「小姐，妳有沒有懷孕？」', grade: 'ok', fx: { safety: 3 }, text: '問對了問題，問錯了音量。整個候診區都抬頭了。' },
            { label: '這種問題很尷尬，照就對了', grade: 'bad', fx: { safety: -12 }, text: '照完之後她才說月經晚了一週。這件事現在要寫報告、通報醫師。' },
          ],
        });
        world.show('wu', false);
      },
    },
    {
      time: '16:40', poi: 'dr', place: '閱片室', hint: '張醫師請你到閱片室一趟', prompt: '找張醫師',
      async run() {
        const q = RT.state.stats.quality;
        await ui.say('張醫師', q >= 70 ? '今天的片子擺位都很正，我報告打得很順。謝謝。' : q >= 50 ? '今天大致沒問題。有幾張我多看了兩眼，吸氣再飽一點會更好。' : '今天有幾張片我實在看得很辛苦。明天我們一起看一下重照紀錄。');
        await ui.say('張醫師', '急診那張 portable 我看過了，管路位置沒問題。');
      },
    },
    {
      time: '17:00', poi: 'lead', place: '閱片室', hint: '找淑芬組長交班', prompt: '交班',
      async run() {
        await ui.say('淑芬組長', '辛苦了。交班單寫一寫，待照清單給小夜。');
        await ui.say('小傑', '學長姐，今天謝謝。氧氣鋼瓶那件事……我會記一輩子。');
        await ui.say(NARR, '你把佩章掛回架上。便當盒還在螢幕旁邊。');
      },
    },
  ];
})();
