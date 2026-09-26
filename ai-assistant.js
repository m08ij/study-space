/* ============================================================
   🤖 ai-assistant.js — المساعد الذكي
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {profile:{},timetable:{},courses:[],tasks:[],exams:[],attendance:{},decks:[],budget:[],extracurricular:[],grades:[]}; }
  function getNotes(){ return window.notes || []; }
  function getGpaRows(){ return window.gpaRows || []; }
  function getTimerSettings(){ return window.timerSettings || {focus:25,short:5,long:15}; }
  function getGrades(){ return window.GRADES || {}; }
  function getDaysAr(){ return window.DAYS_AR || ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']; }
  function getDaysEn(){ return window.DAYS_EN || ['Sun','Mon','Tue','Wed','Thu']; }
  function getTips(){ return window.STUDY_TIPS || ['💡 ادرس بنفس الوقت يوميًا.']; }
  function getQuotes(){ return window.DAILY_QUOTES || [{t:'لا تنتظر الفرصة، اصنعها بنفسك.', a:'—'}]; }
  function getS(){ return window.S || {get:function(k,d){return d;},set:function(){}}; }
  function getCoursesDesc(){ return (typeof window.COURSES_DESC === 'object' && window.COURSES_DESC) ? window.COURSES_DESC : {}; }

  var SITE_MAP = {
    dashboard:        {name:'لوحة التحكم',     icon:'📊', desc:'نظرة عامة على كل شيء', keys:['لوحة','لوحه','dashboard','رئيسية','الرئيسية','الصفحة الرئيسية','البداية']},
    timetable:        {name:'الجدول الأسبوعي', icon:'📅', desc:'محاضراتك الأسبوعية + OCR', keys:['جدول','timetable','محاضرات','محاضرة','الأسبوع','الاسبوع']},
    courses:          {name:'موادي',           icon:'📚', desc:'المواد المسجّلة هذا الفصل', keys:['مواد','موادي','courses','مساقات','مادة']},
    tasks:            {name:'المهام',          icon:'📝', desc:'الواجبات والمشاريع', keys:['مهام','المهام','tasks','واجب','واجبات','تسليم']},
    exams:            {name:'الامتحانات',      icon:'⏳', desc:'مواعيد امتحاناتك مع العدّاد', keys:['امتحان','امتحانات','exams','اختبار','اختبارات','فاينل','فاينلز']},
    attendance:       {name:'الحضور',          icon:'✅', desc:'تسجيل الحضور والغياب', keys:['حضور','attendance','غياب','غيابات']},
    timer:            {name:'بومودورو',        icon:'⏱️', desc:'مؤقت التركيز والراحة', keys:['بومودورو','pomodoro','مؤقت','timer','تايمر','تركيز']},
    flashcards:       {name:'بطاقات تعليمية',  icon:'🃏', desc:'مجموعات للمراجعة', keys:['بطاقات','بطاقة','flashcards','كاردز','فلاش','مراجعة']},
    stats:            {name:'إحصائيات',        icon:'📈', desc:'ساعات الدراسة ومؤشراتك', keys:['احصائيات','إحصائيات','stats','تحليلات','رسم']},
    extracurricular:  {name:'الأنشطة',         icon:'🎯', desc:'نوادي وتطوع', keys:['انشطة','أنشطة','extracurricular','نوادي','تطوع']},
    budget:           {name:'الميزانية',       icon:'💰', desc:'دخل ومصاريف ورصيد', keys:['ميزانية','budget','مصاريف','فلوس','مصروف','دخل','رصيد','مال']},
    notes:            {name:'ملاحظاتي',        icon:'📔', desc:'تُحفظ تلقائيًا', keys:['ملاحظات','ملاحظة','notes','مذكرة']},
    gpa:              {name:'حاسبة المعدل',    icon:'📊', desc:'GPA + محاكي', keys:['معدل','gpa','تراكمي','علامات']},
    plan:             {name:'الخطة الدراسية',  icon:'📖', desc:'هندسة الحاسوب', keys:['خطة','plan','منهج','تخصص','فصول']},
    coursedescriptions:{name:'وصف المواد',     icon:'📕', desc:'شرح كل مادة', keys:['وصف','شرح','descriptions','تفاصيل','تعريف']},
    hulinks:          {name:'روابط الجامعة',   icon:'🎓', desc:'بوابة الطالب، البريد، المكتبة', keys:['روابط','بوابة','بريد','مكتبة','جامعة','هاشمية','teams','moodle','myhu']},
    needcalc:         {name:'كم أحتاج؟',       icon:'🎯', desc:'حاسبة العلامة المطلوبة', keys:['كم احتاج','كم أحتاج','needcalc','فاينل']},
    gradetracker:     {name:'متتبع العلامات',  icon:'📈', desc:'سجّل علاماتك في المواد', keys:['متتبع','علامات','درجات','tracker']},
    termcalc:         {name:'حساب الترم',      icon:'🎓', desc:'كم ساعة سجلت؟', keys:['ترم','فصل','ساعات','credits','حساب الترم']},
    about:            {name:'عن التطبيق',      icon:'ℹ️', desc:'معلومات وتفاصيل', keys:['عن التطبيق','about','معلومات']}
  };

  var HOWTO = {
    tasks:'📝 **إضافة مهمة:**\n\n1️⃣ افتح "المهام"\n2️⃣ اضغط "+ مهمة"\n3️⃣ املأ البيانات\n4️⃣ اضغط "حفظ"\n\n⚡ **أسرع:** Ctrl+T',
    exams:'⏳ **إضافة امتحان:**\n\n1️⃣ افتح "الامتحانات"\n2️⃣ اضغط "+ امتحان"\n3️⃣ أدخل البيانات\n4️⃣ اضغط "حفظ"',
    attendance:'✅ **تسجيل الحضور:**\n\n1️⃣ افتح "الحضور"\n2️⃣ اضغط "+ مادة"\n3️⃣ بعد كل محاضرة اضغط "+ حاضر" أو "+ غائب"',
    timetable:'📅 **بناء الجدول:**\n\n🎨 **يدوي:** اضغط خلية فارغة\n📸 **OCR:** ارفع صورة\n⚡ **تلقائي:** "توليد من موادي"',
    timer:'⏱️ **بومودورو:**\n\n1️⃣ اختر النمط\n2️⃣ اضغط "▶ ابدأ"\n\n⌨️ اختصار: Ctrl+P',
    gpa:'📊 **حساب المعدل:**\n\n1️⃣ افتح "حاسبة المعدل"\n2️⃣ أدخل المواد والتقديرات\n3️⃣ المعدل يظهر تلقائيًا',
    budget:'💰 **الميزانية:**\n\n📈 زر "+ دخل"\n📉 زر "+ مصروف"\n\n🔍 فلاتر للتصنيفات',
    flashcards:'🃏 **البطاقات:**\n\n1️⃣ اضغط "+ مجموعة"\n2️⃣ أضف بطاقات\n3️⃣ انقر لقلب البطاقة',
    courses:'📚 **المواد:**\n\n➕ يدوي: زر "+ مادة"\n📥 من الخطة: زر "استيراد"',
    notes:'📔 **الملاحظات:**\n\n1️⃣ اضغط "+ ملاحظة"\n2️⃣ اكتب\n3️⃣ حفظ تلقائي\n\n⌨️ اختصار: Ctrl+N',
    stats:'📈 **الإحصائيات:**\n\n• مخطط آخر 7 أيام\n• إجمالي الساعات\n• جلسات بومودورو',
    plan:'📖 **الخطة الدراسية:**\n\n9 فصول / 5 سنوات\n\n🎯 اضغط أي سنة لعرضها',
    coursedescriptions:'📕 **وصف المواد:**\n\n🔍 ابحث بالاسم أو الرقم\n🎯 فلترة حسب السنة',
    extracurricular:'🎯 **الأنشطة:**\n\n➕ اضغط "+ نشاط"\n• اسم + تصنيف + ساعات',
    dashboard:'📊 **لوحة التحكم:**\n\n• إحصائيات رئيسية\n• محاضرات اليوم\n• مهام الأسبوع',
    hulinks:'🎓 **روابط الجامعة:**\n\n• البوابة: reg1.hu.edu.jo\n• Moodle: elearning.hu.edu.jo\n• المكتبة: library.hu.edu.jo',
    needcalc:'🎯 **كم أحتاج:**\n\n1️⃣ أدخل علامتك الحالية\n2️⃣ وزن الفاينل (%)\n3️⃣ العلامة الهدف\n4️⃣ احسب',
    gradetracker:'📈 **متتبع العلامات:**\n\n1️⃣ أضف مادة\n2️⃣ سجّل كل علامة\n3️⃣ شاهد نسبتك',
    termcalc:'🎓 **حساب الترم:**\n\n• يقرأ موادك المسجلة\n• يحسب الساعات الكلية\n• يقارنها بالخطة',
    about:'ℹ️ **عن التطبيق:**\n\nمساحة دراسية شاملة\nمبنية بـ Vanilla JS\n\n📦 GitHub: m08jj/study-space'
  };

  var SUGG_POOL = [
    'ملخص مساحتي','كم مهمة عندي؟','متى امتحاني القادم؟','كم معدلي؟','كم رصيدي؟',
    'كيف أضيف مهمة؟','كيف أستخدم بومودورو؟','افتح المهام','افتح الميزانية',
    'كم أحتاج في الفاينل؟','افتح متتبع العلامات','كيف أضيف علامة؟',
    'شو الأقسام المتاحة؟','نصيحة دراسة','كيف أنظم وقتي؟',
    'بوابة الطالب','كيف أضيف امتحان؟','كيف أحسب معدلي؟','أفكار لجدول دراسي'
  ];
  function pickRandom(arr, n){
    var copy = arr.slice(); var out = [];
    for(var i = 0; i < n && copy.length; i++){
      var idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

  function normalizeArabic(s){
    return String(s)
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/[؟?.,،!؛;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  }

  function fuzzyMatch(text, keyword){
    text = text || ''; keyword = keyword || '';
    if(!text || !keyword) return false;
    if(text.indexOf(keyword) > -1) return true;
    if(keyword.length >= 4){
      var stem = keyword.slice(0, 3);
      if(text.indexOf(stem) > -1) return true;
    }
    if(keyword.length >= 5){
      var words = text.split(' ');
      for(var i = 0; i < words.length; i++){
        var w = words[i];
        if(Math.abs(w.length - keyword.length) <= 1){
          var diffs = 0;
          var minLen = Math.min(w.length, keyword.length);
          for(var j = 0; j < minLen; j++){
            if(w.charAt(j) !== keyword.charAt(j)) diffs++;
            if(diffs > 1) break;
          }
          if(diffs <= 1) return true;
        }
      }
    }
    return false;
  }

  function toggleAI(){
    var p = document.getElementById('aiPanel'); if(!p) return;
    var willOpen = !p.classList.contains('show');
    p.classList.toggle('show');
    if(willOpen){
      var fm = document.getElementById('fabMenu'); if(fm) fm.classList.remove('show');
      var fmm = document.getElementById('fabMain'); if(fmm) fmm.classList.remove('active');
      var aiBtn = document.getElementById('aiFab'); if(aiBtn) aiBtn.classList.remove('hidden');
      var m = document.getElementById('aiMessages');
      if(m && !m.children.length) initAI();
    }
  }

  function initAI(){
    var s = document.getElementById('aiSuggestions'); if(!s) return;
    var picks = pickRandom(SUGG_POOL, 4);
    var html = '';
    picks.forEach(function(x){ html += '<button class="ai-suggestion">' + x + '</button>'; });
    s.innerHTML = html;
    s.querySelectorAll('.ai-suggestion').forEach(function(b){
      b.addEventListener('click', function(){
        var inp = document.getElementById('aiInput');
        if(inp) inp.value = b.textContent;
        sendAI();
      });
    });

    var sp = getSpace();
    var name = (sp.profile && sp.profile.name) || '';
    var intro = (name ? '👋 أهلاً ' + name.split(' ')[0] + '! ' : '👋 أهلاً! ') +
      'أنا مساعدك 🤖\n\n' +
      '✨ **أعرف كل شي عن موقعك:**\n' +
      '• بياناتك (مهام، امتحانات، معدل، ميزانية...)\n' +
      '• كل الأقسام وكيف توصل لها\n' +
      '• روابط الجامعة الهاشمية\n\n' +
      '💡 **جرّب:**\n' +
      '• "افتح المهام"\n' +
      '• "كم أحتاج في الفاينل؟"\n' +
      '• "بوابة الطالب"\n' +
      '• "ملخص مساحتي"\n\n' +
      '📝 أفهم العامية والفصحى!';
    addAIMessage('bot', intro);
  }

  function addAIMessage(type, text){
    var c = document.getElementById('aiMessages'); if(!c) return;
    var m = document.createElement('div');
    m.className = 'ai-msg ' + type;
    var html = String(text)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html = html.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>');
    html = html.replace(/(^|\s)_([^_\n]+?)_(\s|$)/g, '$1<i>$2</i>$3');
    html = html.replace(/`([^`\n]+?)`/g, '<code style="background:rgba(0,0,0,.25);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:.85em;direction:ltr">$1</code>');
    m.innerHTML = html;
    c.appendChild(m);
    c.scrollTop = c.scrollHeight;
  }

  function sendAI(){
    var inp = document.getElementById('aiInput'); if(!inp) return;
    var q = inp.value.trim(); if(!q) return;
    addAIMessage('user', q); inp.value = '';
    var c = document.getElementById('aiMessages');
    var typing = null;
    if(c){
      typing = document.createElement('div');
      typing.className = 'ai-msg bot';
      typing.innerHTML = '<span class="ai-dots"><span></span><span></span><span></span></span>';
      c.appendChild(typing); c.scrollTop = c.scrollHeight;
    }
    setTimeout(function(){
      if(typing && typing.parentNode) typing.parentNode.removeChild(typing);
      addAIMessage('bot', aiRespond(q));
    }, 450);
  }

  function aiRespond(q){
    var raw = String(q).trim();
    var lower = normalizeArabic(raw);
    var today = new Date().toISOString().slice(0,10);
    var now = new Date();

    var r = detectNavigation(lower); if(r) return r;
    r = detectHowTo(lower); if(r) return r;
    r = answerDataQuery(lower, today, now); if(r) return r;
    r = answerHuLinks(lower); if(r) return r;
    r = answerSiteInfo(lower); if(r) return r;
    r = answerTips(lower); if(r) return r;
    r = searchCourseDescription(lower); if(r) return r;
    r = generalSearch(raw); if(r) return r;

    return '🤔 ما فهمت "' + raw + '" تمامًا.\n\n' +
      '💡 **جرّب:**\n\n' +
      '🧭 **للتنقل:**\n• "افتح المهام"\n\n' +
      '❓ **للاستفسار:**\n• "كيف أضيف مهمة؟"\n\n' +
      '📊 **بياناتك:**\n• "كم مهمة عندي؟"\n\n' +
      '🎓 **الجامعة:**\n• "بوابة الطالب"';
  }

  var NAV_VERBS = ['افتح','روح','اذهب','خذني','انتقل','ودني','ابغى','ابي','اريد','شوف','عرض','اظهر','اعرض','سير','خدني'];

  function detectNavigation(lower){
    var hasNavVerb = false;
    for(var i=0;i<NAV_VERBS.length;i++){
      if(fuzzyMatch(lower, NAV_VERBS[i])){ hasNavVerb = true; break; }
    }
    var tabKeys = Object.keys(SITE_MAP);
    var foundTab = null;
    for(var t=0;t<tabKeys.length;t++){
      var keys = SITE_MAP[tabKeys[t]].keys;
      for(var k=0;k<keys.length;k++){
        var key = keys[k].toLowerCase();
        if(lower === key || lower.indexOf(' '+key+' ') > -1 ||
           lower.indexOf(key+' ') === 0 ||
           lower.indexOf(' '+key) === lower.length - key.length - 1 ||
           fuzzyMatch(lower, key)){
          foundTab = tabKeys[t]; break;
        }
      }
      if(foundTab) break;
    }
    if(!foundTab) return null;
    if(!hasNavVerb && lower.split(' ').filter(Boolean).length > 4) return null;
    try{
      if(typeof window.switchTab === 'function'){
        window.switchTab(foundTab);
        var s = SITE_MAP[foundTab];
        return '✅ فتحت لك قسم ' + s.icon + ' **' + s.name + '**\n\n💡 ' + s.desc;
      }
    }catch(e){}
    return null;
  }

  function detectHowTo(lower){
    var isHowTo = fuzzyMatch(lower,'كيف') || fuzzyMatch(lower,'طريقه') ||
                  fuzzyMatch(lower,'شرح') || fuzzyMatch(lower,'اشرح') ||
                  fuzzyMatch(lower,'وضح') || fuzzyMatch(lower,'علمني') ||
                  fuzzyMatch(lower,'كيفيه') || fuzzyMatch(lower,'استخدم') ||
                  fuzzyMatch(lower,'اسوي') || fuzzyMatch(lower,'اضيف') ||
                  fuzzyMatch(lower,'احط') || fuzzyMatch(lower,'ازيد');
    if(!isHowTo) return null;
    var tabKeys = Object.keys(HOWTO);
    for(var i=0;i<tabKeys.length;i++){
      var keys = SITE_MAP[tabKeys[i]] ? SITE_MAP[tabKeys[i]].keys : [];
      for(var k=0;k<keys.length;k++){
        if(fuzzyMatch(lower, keys[k].toLowerCase())) return HOWTO[tabKeys[i]];
      }
    }
    return null;
  }

  function answerDataQuery(lower, today, now){
    var space = getSpace();
    var pending = space.tasks.filter(function(t){ return !t.done; });
    var done = space.tasks.filter(function(t){ return t.done; });
    var overdue = pending.filter(function(t){ return t.due && t.due < today; });
    var dueToday = pending.filter(function(t){ return t.due === today; });
    var soon = pending.filter(function(t){
      if(!t.due) return false;
      var diff = Math.ceil((new Date(t.due) - new Date(today)) / 86400000);
      return diff >= 0 && diff <= 3;
    });

    if(lower.indexOf('مهام') > -1 || lower.indexOf('مهمه') > -1 || lower.indexOf('واجب') > -1){
      if(!space.tasks.length) return '📝 ما عندك مهام.\n\n➕ قسم المهام → "+ مهمة"';
      var msg = '📝 **ملخص المهام:**\n• متبقية: **' + pending.length + '**\n• مكتملة: **' + done.length + '**\n• إجمالي: ' + space.tasks.length;
      if(overdue.length) msg += '\n\n⚠️ **متأخرة (' + overdue.length + '):**\n' + overdue.slice(0,4).map(function(t){ return '• ' + t.title; }).join('\n');
      if(dueToday.length) msg += '\n\n📌 **مستحقة اليوم (' + dueToday.length + '):**\n' + dueToday.slice(0,4).map(function(t){ return '• ' + t.title; }).join('\n');
      if(soon.length && !dueToday.length) msg += '\n\n⏰ **خلال 3 أيام:**\n' + soon.slice(0,3).map(function(t){ return '• ' + t.title; }).join('\n');
      return msg;
    }

    if(lower.indexOf('امتحان') > -1 || lower.indexOf('اختبار') > -1 || lower.indexOf('فاينل') > -1){
      if(!space.exams.length) return '📚 ما عندك امتحانات.\n\n➕ قسم الامتحانات → "+ امتحان"';
      var sorted = space.exams.slice().sort(function(a,b){ return a.date.localeCompare(b.date); });
      var upcoming = sorted.filter(function(e){ return e.date >= today; });
      if(!upcoming.length) return '✅ خلصت امتحاناتك! ارتاح 😌';
      var next = upcoming[0];
      var days = Math.ceil((new Date(next.date) - new Date(today)) / 86400000);
      var out = '⏳ **أقرب امتحان:**\n📝 ' + next.name + '\n📅 ' + next.date + ' (**بعد ' + days + ' يوم**)' +
        (next.course ? '\n📚 ' + next.course : '') + (next.time ? '\n⏰ ' + next.time : '');
      return out;
    }

    if(lower.indexOf('معدل') > -1 || lower.indexOf('تراكمي') > -1 || lower.indexOf('gpa') > -1){
      var rows = getGpaRows(); var G = getGrades();
      var pts = 0, hrs = 0;
      rows.forEach(function(r){ var h = parseFloat(r.hrs) || 0; pts += h * (G[r.grade] || 0); hrs += h; });
      var g = hrs ? (pts / hrs).toFixed(2) : '0.00';
      var grade = '—'; var gn = parseFloat(g);
      if(gn >= 3.75) grade = '🏆 ممتاز';
      else if(gn >= 3.5) grade = '⭐ جيد جدًا مرتفع';
      else if(gn >= 3.0) grade = '✅ جيد جدًا';
      else if(gn >= 2.5) grade = '👍 جيد';
      else if(gn >= 2.0) grade = '📌 مقبول';
      else if(gn > 0) grade = '⚠️ ضعيف';
      return '📊 **معدلك:**\n\n🎯 **' + g + '** — ' + grade + '\n\n📚 الساعات: ' + hrs + '\n📝 المواد: ' + rows.length;
    }

    if(lower.indexOf('ميزانيه') > -1 || lower.indexOf('رصيد') > -1 || lower.indexOf('دخل') > -1 ||
       lower.indexOf('مصروف') > -1 || lower.indexOf('مصاريف') > -1 || lower.indexOf('فلوس') > -1){
      var inc = space.budget.filter(function(b){ return b.type === 'income'; }).reduce(function(a,b){ return a + (parseFloat(b.amount)||0); }, 0);
      var exp = space.budget.filter(function(b){ return b.type === 'expense'; }).reduce(function(a,b){ return a + (parseFloat(b.amount)||0); }, 0);
      var bal = inc - exp;
      return '💰 **الميزانية:**\n\n📈 دخل: **' + inc.toFixed(0) + '** د\n📉 مصروف: **' + exp.toFixed(0) + '** د\n💼 رصيد: **' + bal.toFixed(0) + '** د ' + (bal >= 0 ? '👍' : '⚠️');
    }

    if(lower.indexOf('نقاط') > -1){
      return '⭐ **نقاطك:** ' + (space.points || 0);
    }

    if(lower.indexOf('بومودورو') > -1 || lower.indexOf('جلسات') > -1){
      var S = getS(); var s = S.get('pomoSessions', 0); var f = S.get('pomoFocus', 0);
      var tset = getTimerSettings();
      return '⏱️ **بومودورو:**\n\n🎯 جلسات: **' + s + '**\n⏳ دقائق: **' + f + '** (' + (f/60).toFixed(1) + ' ساعة)\n\n📌 الإعداد: ' + tset.focus + '+' + tset.short + ' د';
    }

    if(lower.indexOf('حضور') > -1 || lower.indexOf('غياب') > -1){
      var att = Object.entries(space.attendance || {});
      if(!att.length) return '✅ ما عندك مواد للحضور.';
      var low = []; var lines = [];
      att.forEach(function(kv){
        var a = kv[1]; var t = a.present + a.absent;
        var p = t ? Math.round(a.present/t*100) : 0;
        var emoji = t === 0 ? '⚪' : p >= 85 ? '🟢' : p >= 75 ? '🟡' : '🔴';
        if(t > 0 && p < 75) low.push(kv[0]);
        lines.push(emoji + ' ' + kv[0] + ': ' + (t ? p + '%' : '—'));
      });
      var msg = '📊 **الحضور:**\n\n' + lines.slice(0,8).join('\n');
      if(low.length) msg += '\n\n⚠️ **تحذير:** ' + low.length + ' مادة أقل من 75%!';
      return msg;
    }

    if(lower.indexOf('مواد') > -1 || lower.indexOf('موادي') > -1){
      if(!space.courses.length) return '📚 ما عندك مواد.';
      var totalHrs = space.courses.reduce(function(a,c){ return a + (c.hours||0); }, 0);
      var list = space.courses.slice(0,10).map(function(c){ return '• ' + c.name; });
      return '📚 **موادك (' + space.courses.length + '، ' + totalHrs + ' ساعة):**\n\n' + list.join('\n');
    }

    if(lower.indexOf('ملاحظات') > -1 || lower.indexOf('ملاحظه') > -1){
      var notes = getNotes();
      if(!notes.length) return '📔 ما عندك ملاحظات.';
      return '📔 **ملاحظاتك:** ' + notes.length + '\n\nآخر: **' + (notes[0].title || 'بدون عنوان') + '**';
    }

    if(lower.indexOf('متتبع') > -1 || lower.indexOf('علاماتي') > -1){
      var grades = space.grades || [];
      if(!grades.length) return '📈 ما عندك مواد في متتبع العلامات.\n\n➕ قسم "متتبع العلامات" → "+ مادة"';
      var out2 = '📈 **متتبع العلامات:**\n\n';
      grades.forEach(function(g){
        var total = 0, earned = 0;
        g.items.forEach(function(it){
          total += parseFloat(it.weight) || 0;
          earned += (parseFloat(it.score) || 0) * (parseFloat(it.weight) || 0) / 100;
        });
        var pct = total > 0 ? (earned / total * 100) : 0;
        out2 += '• ' + g.name + ': **' + pct.toFixed(1) + '%**\n';
      });
      return out2;
    }

    if(lower.indexOf('ملخص') > -1 || lower.indexOf('وضعي') > -1 || lower.indexOf('كل شي') > -1){
      return buildFullSummary(today, pending, done, overdue, dueToday);
    }

    if(lower.indexOf('جدول') > -1 || lower.indexOf('محاضرات') > -1){
      var dayEn = getDaysEn(); var dayAr = getDaysAr();
      var todayKey = dayEn[now.getDay()] || 'Sun';
      var todays = Object.entries(space.timetable || {}).filter(function(kv){ return kv[0].indexOf(todayKey) === 0; });
      if(!todays.length) return '🌴 ما عندك محاضرات اليوم!';
      var m2 = '📅 **محاضرات اليوم (' + dayAr[now.getDay()] + '):**\n\n';
      todays.sort(function(a,b){ return a[0].localeCompare(b[0]); }).forEach(function(kv){
        m2 += '⏰ **' + kv[0].split('-')[1] + '** — ' + kv[1].name + (kv[1].room ? ' (' + kv[1].room + ')' : '') + '\n';
      });
      return m2;
    }

    return null;
  }

  function buildFullSummary(today, pending, done, overdue, dueToday){
    var space = getSpace(); var notes = getNotes(); var S = getS();
    var name = (space.profile && space.profile.name) || 'صديقي';
    var inc = space.budget.filter(function(b){ return b.type === 'income'; }).reduce(function(a,b){ return a + (parseFloat(b.amount)||0); }, 0);
    var exp = space.budget.filter(function(b){ return b.type === 'expense'; }).reduce(function(a,b){ return a + (parseFloat(b.amount)||0); }, 0);
    var bal = inc - exp;
    var totalCards = space.decks.reduce(function(a,d){ return a + d.cards.length; }, 0);

    return '📊 **ملخص مساحة ' + name + '**\n━━━━━━━━━━━━━━━\n\n' +
      '📚 **الدراسة:**\n' +
      '• المواد: ' + space.courses.length + '\n' +
      '• المهام: ' + pending.length + ' متبقية / ' + done.length + ' مكتملة' +
      (overdue.length ? ' ⚠️' + overdue.length : '') + '\n' +
      '• الامتحانات القادمة: ' + space.exams.filter(function(e){ return e.date >= today; }).length + '\n\n' +
      '⏱️ **المذاكرة:**\n' +
      '• جلسات: ' + S.get('pomoSessions', 0) + '\n' +
      '• دقائق: ' + S.get('pomoFocus', 0) + '\n' +
      '• بطاقات: ' + totalCards + '\n\n' +
      '💰 **المالية:**\n' +
      '• دخل: ' + inc.toFixed(0) + ' د\n' +
      '• مصروف: ' + exp.toFixed(0) + ' د\n' +
      '• رصيد: **' + bal.toFixed(0) + '** د ' + (bal >= 0 ? '👍' : '⚠️') + '\n\n' +
      '📔 الملاحظات: ' + notes.length;
  }

  var HU_NAV_KEYS = ['روابط','جامعه','جامعة','هاشميه','هاشمية','بوابه','بوابة','بريد','ايميل','مكتبه','مكتبة','library','teams','moodle','myhu','تطبيق','رسوم','دفع','efawateer','قبول','تسجيل','sis','apl','reg1','elearning','ادخال'];

  function answerHuLinks(lower){
    var found = false;
    for(var i = 0; i < HU_NAV_KEYS.length; i++){
      if(lower.indexOf(HU_NAV_KEYS[i]) > -1){ found = true; break; }
    }
    if(!found) return null;

    if(lower.indexOf('بوابه الطالب') > -1 || lower.indexOf('sis') > -1 || lower.indexOf('reg1') > -1){
      return '🎓 **بوابة الطالب:**\n\n🔗 **https://reg1.hu.edu.jo/**\n\n📌 الرسوم، الجدول، العلامات، البريد';
    }
    if(lower.indexOf('moodle') > -1 || lower.indexOf('elearning') > -1){
      return '📖 **Moodle:**\n\n🔗 **https://elearning.hu.edu.jo/**\n\n📌 المواد والواجبات';
    }
    if(lower.indexOf('بريد') > -1){
      return '📧 **البريد الجامعي:**\n\n• ادخل: reg1.hu.edu.jo\n• خانة "البريد الإلكتروني"\n• للدخول على Teams و Moodle';
    }
    if(lower.indexOf('مكتبه') > -1 || lower.indexOf('مكتبة') > -1){
      return '📚 **المكتبة:**\n\n🔗 **https://library.hu.edu.jo/**';
    }
    if(lower.indexOf('teams') > -1){
      return '💬 **Teams:**\n\n🔗 **https://teams.microsoft.com/**';
    }
    if(lower.indexOf('رسوم') > -1 || lower.indexOf('دفع') > -1){
      return '💰 **دفع الرسوم:**\n\n🔗 **https://www.efawateercom.jo/**';
    }
    return '🎓 **روابط الجامعة:**\n\n• 🎓 reg1.hu.edu.jo\n• 📖 elearning.hu.edu.jo\n• 📚 library.hu.edu.jo\n• 💰 efawateercom.jo';
  }

  function answerSiteInfo(lower){
    if(lower.indexOf('اقسام') > -1 || lower.indexOf('قائمه') > -1){
      var keys = Object.keys(SITE_MAP);
      var out = '🗺️ **أقسام الموقع (' + keys.length + '):**\n\n';
      keys.forEach(function(k){
        var s = SITE_MAP[k];
        out += s.icon + ' **' + s.name + '** — ' + s.desc + '\n';
      });
      return out;
    }
    if(lower.indexOf('شكرا') > -1 || lower.indexOf('مشكور') > -1){
      return '🙏 على الرحب والسعة! 💙';
    }
    if(lower.indexOf('من انت') > -1 || lower.indexOf('مين انت') > -1){
      return '🤖 **أنا مساعدك الذكي**\n\n✨ أعرف بياناتك وكل الأقسام';
    }
    if(/^(مرحبا|هلا|اهلا|هاي|السلام عليكم|صباح|مساء|hi|hello)/.test(lower)){
      if(lower.indexOf('السلام عليكم') > -1) return '👋 وعليكم السلام!';
      if(lower.indexOf('صباح') > -1) return '☀️ صباح النور!';
      if(lower.indexOf('مساء') > -1) return '🌆 مساء النور!';
      return '👋 أهلاً!';
    }
    if(lower.indexOf('كيف حالك') > -1 || lower.indexOf('كيفك') > -1) return '😊 بخير! جاهز لخدمتك.';
    return null;
  }

  function answerTips(lower){
    var tips = getTips(); var quotes = getQuotes();
    if(lower.indexOf('نصيحه') > -1 || lower.indexOf('نصائح') > -1) return tips[Math.floor(Math.random() * tips.length)];
    if(lower.indexOf('وقت') > -1 || lower.indexOf('تنظيم') > -1){
      return '⏰ **لتنظيم وقتك:**\n\n1️⃣ ادرس بنفس الوقت\n2️⃣ بومودورو\n3️⃣ رتّب الأولويات\n4️⃣ راحة كل ساعة';
    }
    if(lower.indexOf('محبط') > -1 || lower.indexOf('تعبان') > -1){
      var q = quotes[Math.floor(Math.random()*quotes.length)];
      return '💪 **لا تيأس!**\n\n✨ "' + q.t + '"\n— ' + q.a;
    }
    return null;
  }

  function searchCourseDescription(lower){
    var CD = getCoursesDesc(); if(!CD) return null;
    var keys = Object.keys(CD); if(!keys.length) return null;
    var matches = [];
    for(var i = 0; i < keys.length; i++){
      var key = keys[i].toLowerCase();
      if(lower.indexOf(key) > -1 || key.indexOf(lower) > -1) matches.push({name: keys[i], desc: CD[keys[i]]});
    }
    if(matches.length === 1) return '📘 **' + matches[0].name + '**\n\n' + matches[0].desc;
    if(matches.length > 1 && matches.length <= 5){
      return '📘 **وجدت ' + matches.length + ' مواد:**\n\n' + matches.map(function(m){ return '• ' + m.name; }).join('\n');
    }
    return null;
  }

  function generalSearch(raw){
    if(!raw || raw.length < 3) return null;
    var space = getSpace(); var q = raw.toLowerCase();
    var mc = space.courses.find(function(c){ return c.name && c.name.toLowerCase().indexOf(q) > -1; });
    if(mc) return '📚 **وجدتها:**\n\n📖 ' + mc.name;
    return null;
  }

  function bindAIEvents(){
    var aiFab = document.getElementById('aiFab');
    var aiClose = document.getElementById('aiClose');
    var aiSend = document.getElementById('aiSend');
    var aiInput = document.getElementById('aiInput');
    if(aiFab && !aiFab._aiBound){ aiFab.addEventListener('click', toggleAI); aiFab._aiBound = true; }
    if(aiClose && !aiClose._aiBound){ aiClose.addEventListener('click', toggleAI); aiClose._aiBound = true; }
    if(aiSend && !aiSend._aiBound){ aiSend.addEventListener('click', sendAI); aiSend._aiBound = true; }
    if(aiInput && !aiInput._aiBound){
      aiInput.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); sendAI(); } });
      aiInput._aiBound = true;
    }
  }

  window.toggleAI = toggleAI;
  window.initAI = initAI;
  window.addAIMessage = addAIMessage;
  window.sendAI = sendAI;
  window.aiRespond = aiRespond;
  window.bindAIEvents = bindAIEvents;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(bindAIEvents, 200); });
  } else {
    setTimeout(bindAIEvents, 200);
  }
  console.log('🤖 AI Assistant loaded');
})();