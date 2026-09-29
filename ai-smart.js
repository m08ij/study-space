/* ============================================================
   🧠 ai-smart.js — محرك ذكاء اصطناعي محسّن للمساعد
   - تصنيف intents بنظام النقاط (Scoring)
   - Levenshtein للتحمل الإملائي
   - ذاكرة سياق (يفتكر الموضوع السابق)
   - ردود متعددة + أزرار تفاعلية
   - Small talk + مزاج
   - Multi-intent (يفهم "افتح المهام وكم عندي؟")
   ============================================================ */
(function(){
  'use strict';

  /* ============ Utilities ============ */
  function norm(s){
    return String(s || '')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/[؟?.,،!؛;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase().trim();
  }
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function tokens(s){ return norm(s).split(' ').filter(Boolean); }
  function getSpace(){ return window.space || {profile:{},courses:[],tasks:[],exams:[],budget:[],grades:[]}; }
  function getS(){ return window.S || {get:function(k,d){return d;}, set:function(){}}; }
  function today(){ return new Date().toISOString().slice(0,10); }
  function daysFromNow(d){ return Math.ceil((new Date(d) - new Date(today())) / 86400000); }

  /* ============ Levenshtein (تحمل الأخطاء الإملائية) ============ */
  function lev(a, b){
    if(!a.length) return b.length;
    if(!b.length) return a.length;
    var m = [];
    for(var i = 0; i <= b.length; i++) m[i] = [i];
    for(var j = 0; j <= a.length; j++) m[0][j] = j;
    for(i = 1; i <= b.length; i++){
      for(j = 1; j <= a.length; j++){
        m[i][j] = b.charAt(i-1) === a.charAt(j-1)
          ? m[i-1][j-1]
          : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
      }
    }
    return m[b.length][a.length];
  }
  function similar(a, b){
    if(a === b) return 1;
    var maxLen = Math.max(a.length, b.length);
    if(maxLen < 3) return 0;
    return 1 - (lev(a, b) / maxLen);
  }

  /* ============ ذاكرة السياق ============ */
  var CTX_KEY = 'ai_smart_ctx';
  function loadCtx(){
    try{ return JSON.parse(sessionStorage.getItem(CTX_KEY) || '{}'); }catch(e){ return {}; }
  }
  function saveCtx(c){
    try{ sessionStorage.setItem(CTX_KEY, JSON.stringify(c)); }catch(e){}
  }
  function setCtxTopic(topic, data){
    var c = loadCtx();
    c.lastTopic = topic;
    c.lastData = data || null;
    c.ts = Date.now();
    saveCtx(c);
  }
  function getCtx(){
    var c = loadCtx();
    if(!c.ts || Date.now() - c.ts > 10 * 60 * 1000) return {};
    return c;
  }

  /* ============ قاعدة الكلمات المرادفة ============ */
  var SYNONYMS = {
    'مهمه': ['مهمة','task','واجب','تسليم','assignment','homework'],
    'امتحان': ['اختبار','exam','فاينل','كويز','test','quiz'],
    'ماده': ['مادة','كورس','course','مساق'],
    'جدول': ['timetable','محاضرات','schedule'],
    'معدل': ['gpa','تراكمي','average'],
    'رصيد': ['فلوس','balance','ميزانية','مصاريف','budget'],
    'ملاحظه': ['note','مذكرة','notes'],
    'علامه': ['درجة','grade','علامة','نتيجة'],
    'مشروع': ['project','تخرج'],
    'مختبر': ['lab','معمل']
  };
  function expandSynonyms(word){
    for(var k in SYNONYMS){
      if(SYNONYMS[k].indexOf(word) > -1 || k === word){
        return [k].concat(SYNONYMS[k]);
      }
    }
    return [word];
  }

  /* ============ Intents Definition ============ */
  var INTENTS = {
    // 1. فتح تبويب
    'navigate': {
      keywords: ['افتح','روح','اذهب','انتقل','ودني','ودي','خدني','show','open','goto','انتقل','سير'],
      targets: {
        'dashboard': ['لوحة','رئيسية','dashboard','home'],
        'timetable': ['جدول','محاضرات','timetable','schedule'],
        'courses':   ['مواد','موادي','courses','مساقات'],
        'tasks':     ['مهام','مهمات','tasks','واجبات'],
        'exams':     ['امتحانات','اختبارات','exams','فاينل'],
        'attendance':['حضور','attendance'],
        'timer':     ['بومودورو','مؤقت','timer','pomodoro'],
        'flashcards':['بطاقات','flashcards','كاردز'],
        'gradecalc': ['علامات','درجات','معدل','gpa','gradecalc'],
        'budget':    ['ميزانية','مصاريف','budget'],
        'notes':     ['ملاحظات','notes'],
        'plan':      ['خطة','plan'],
        'hulinks':   ['روابط','بوابة','جامعة','hulinks']
      }
    },

    // 2. عدد/كم
    'count_tasks': {
      keywords: ['كم','عدد','how many','عد'],
      targets:  ['مهام','مهمات','واجبات','tasks']
    },
    'count_exams': {
      keywords: ['كم','عدد','how many'],
      targets:  ['امتحانات','اختبارات','exams']
    },

    // 3. البيانات
    'query_tasks':   { keywords: ['مهامي','مهام','مهمات','واجبات','tasks','واجب','تسليم'] },
    'query_exams':   { keywords: ['امتحاني','امتحاناتي','امتحانات','اختبارات','exams','فاينل'] },
    'query_gpa':     { keywords: ['معدلي','معدل','gpa','تراكمي'] },
    'query_budget':  { keywords: ['ميزانيتي','ميزانية','رصيد','مصروف','دخل','فلوس'] },
    'query_courses': { keywords: ['موادي','مواد','courses','مساقات'] },
    'query_notes':   { keywords: ['ملاحظاتي','ملاحظات','notes'] },
    'query_attendance': { keywords: ['حضوري','غياب','حضور','attendance'] },
    'query_schedule_today': { keywords: ['محاضراتي','اليوم','جدولي','محاضرات اليوم'] },
    'query_summary': { keywords: ['ملخص','وضعي','حالتي','status','summary','نظرة'] },

    // 4. التخطيط
    'plan_next_sem': {
      keywords: ['الترم الجاي','الفصل الجاي','الترم القادم','أسجل','اسجل','next semester','التالي']
    },
    'progress': {
      keywords: ['تقدمي','تخرج','باقي','اتخرج','progress','graduation']
    },

    // 5. مادة محددة
    'course_info': {
      keywords: ['ايش','شنو','معلومات','وصف','تفاصيل','كود','code']
    },

    // 6. نصائح
    'tips': { keywords: ['نصيحه','نصائح','tip','advice'] },
    'motivation': { keywords: ['محبط','تعبان','زهقت','مليت','فشلت','sad','tired'] },

    // 7. Small talk
    'greeting': { keywords: ['مرحبا','هلا','اهلا','هاي','سلام','hi','hello','صباح','مساء'] },
    'thanks': { keywords: ['شكرا','مشكور','thank'] },
    'who_you': { keywords: ['من انت','مين انت','اسمك','who are you'] },
    'how_are_you': { keywords: ['كيف حالك','كيفك','شلونك','اخبارك'] },
    'help': { keywords: ['ساعدني','مساعده','help','اقدر اسوي'] }
  };

  /* ============ Classifier ============ */
  function classify(text){
    var lower = norm(text);
    var toks = tokens(lower);
    var scores = {};

    Object.keys(INTENTS).forEach(function(intent){
      var def = INTENTS[intent];
      var score = 0;
      def.keywords.forEach(function(kw){
        var kwn = norm(kw);
        // مطابقة دقيقة
        if(lower.indexOf(kwn) > -1){ score += 10; return; }
        // مطابقة جزئية
        toks.forEach(function(t){
          var sim = similar(t, kwn);
          if(sim > 0.78){ score += 7 * sim; }
          else if(sim > 0.6 && kwn.length > 3){ score += 3 * sim; }
        });
      });
      // targets bonus (للـ navigate و count)
      if(def.targets){
        def.targets.forEach(function(t){
          var tn = norm(t);
          if(lower.indexOf(tn) > -1) score += 5;
        });
      }
      if(score > 0) scores[intent] = score;
    });

    var sorted = Object.keys(scores).sort(function(a,b){ return scores[b] - scores[a]; });
    return {
      intent: sorted[0] || null,
      score: sorted.length ? scores[sorted[0]] : 0,
      all: scores,
      tokens: toks,
      lower: lower
    };
  }

  /* ============ Handlers ============ */
  function handleGreeting(lower){
    var hour = new Date().getHours();
    var name = (getSpace().profile && getSpace().profile.name || '').split(' ')[0];
    var greet = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';
    if(lower.indexOf('السلام عليكم') > -1) return '👋 وعليكم السلام' + (name ? ' يا ' + name : '') + '!';
    if(lower.indexOf('صباح') > -1) return '☀️ صباح النور' + (name ? ' يا ' + name : '') + '!';
    if(lower.indexOf('مساء') > -1) return '🌆 مساء النور' + (name ? ' يا ' + name : '') + '!';
    return '👋 ' + greet + (name ? ' يا ' + name : '') + '! كيف أقدر أساعدك؟';
  }

  function handleThanks(){
    var msgs = ['🙏 على الرحب والسعة!', '💙 أهلاً بيك دايماً!', '🌟 بالخدمة!', '😊 ولا يهمك!'];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  function handleWhoYou(){
    return '🤖 **أنا مساعدك الذكي**\n\n✨ أعرف كل شي عن مساحتك:\n• بياناتك وموادك\n• خطتك الدراسية\n• روابط جامعتك\n\n💡 جرّب تسألني عن أي شي!';
  }

  function handleHowAreYou(){
    return '😊 بخير الحمدلله! جاهز أساعدك.\n\n💡 تحب أسألك عن شي محدد؟';
  }

  function handleHelp(){
    return '🧭 **أقدر أساعدك بـ:**\n\n' +
      '📊 **بياناتك:**\n• "كم مهمة عندي؟"\n• "شو موادي هالترم؟"\n• "متى امتحاني القادم؟"\n\n' +
      '🎯 **التخطيط:**\n• "شو أسجل الترم الجاي؟"\n• "كم باقيلي للتخرج؟"\n\n' +
      '📚 **المعلومات:**\n• "وصف مادة شبكات حاسوب"\n• "متطلبات مشروع تخرج"\n\n' +
      '🧭 **التنقل:**\n• "افتح المهام" / "روح للميزانية"';
  }

  function handleNavigate(lower){
    var map = INTENTS.navigate.targets;
    var found = null;
    var tabs = Object.keys(map);
    for(var i = 0; i < tabs.length; i++){
      var keys = map[tabs[i]];
      for(var k = 0; k < keys.length; k++){
        var kn = norm(keys[k]);
        if(lower.indexOf(kn) > -1){ found = tabs[i]; break; }
      }
      if(found) break;
    }
    if(!found) return null;
    var names = {
      dashboard:'لوحة التحكم', timetable:'الجدول الأسبوعي', courses:'موادي',
      tasks:'المهام', exams:'الامتحانات', attendance:'الحضور',
      timer:'البومودورو', flashcards:'البطاقات', gradecalc:'علاماتي',
      budget:'الميزانية', notes:'الملاحظات', plan:'الخطة والمواد', hulinks:'روابط الجامعة'
    };
    try{
      if(typeof window.switchTab === 'function') window.switchTab(found);
      setCtxTopic('navigated', {tab: found});
      return '✅ فتحت لك **' + names[found] + '**\n\n💡 شي ثاني أقدر أساعدك فيه؟';
    }catch(e){ return null; }
  }

  function handleQueryTasks(lower){
    var sp = getSpace();
    var tasks = sp.tasks || [];
    var pending = tasks.filter(function(t){ return !t.done; });
    var overdue = pending.filter(function(t){ return t.due && t.due < today(); });
    var todayTasks = pending.filter(function(t){ return t.due === today(); });
    var week = pending.filter(function(t){
      if(!t.due) return false;
      var d = daysFromNow(t.due);
      return d >= 0 && d <= 7;
    });

    if(!tasks.length) return '📝 **ما عندك مهام** حالياً!\n\n➕ تحب تضيف مهمة؟ اضغط زر "+" أو Ctrl+T';
    if(!pending.length) return '🎉 **مبروك!** خلّصت كل مهامك (' + tasks.length + ' مهمة).\n\n💡 وقت راحة؟';

    var msg = '📝 **مهامك** (' + pending.length + ' متبقية من ' + tasks.length + '):\n';
    if(overdue.length){
      msg += '\n🔴 **متأخرة (' + overdue.length + '):**\n';
      overdue.slice(0,3).forEach(function(t){
        msg += '• ' + t.title + ' — منذ ' + Math.abs(daysFromNow(t.due)) + ' يوم\n';
      });
    }
    if(todayTasks.length){
      msg += '\n🟡 **اليوم (' + todayTasks.length + '):**\n';
      todayTasks.slice(0,3).forEach(function(t){ msg += '• ' + t.title + '\n'; });
    }
    var upcoming = week.filter(function(t){ return t.due !== today() && (!t.due || t.due > today()); });
    if(upcoming.length && !todayTasks.length){
      msg += '\n🟢 **هذا الأسبوع:**\n';
      upcoming.slice(0,4).forEach(function(t){
        var d = daysFromNow(t.due);
        msg += '• ' + t.title + ' — ' + (d === 1 ? 'بكرة' : 'بعد ' + d + ' أيام') + '\n';
      });
    }
    if(!overdue.length && !todayTasks.length && !upcoming.length){
      msg += '\n✅ ما عندك شي عاجل! استمتع بوقتك 😎';
    }
    setCtxTopic('tasks', {count: pending.length});
    return msg;
  }

  function handleQueryExams(lower){
    var sp = getSpace();
    var exams = (sp.exams || []).filter(function(e){ return e.date >= today(); })
      .sort(function(a,b){ return a.date.localeCompare(b.date); });
    if(!exams.length){
      var past = (sp.exams || []).length;
      return past ? '✅ **خلصت كل امتحاناتك!** (' + past + ' امتحان)\n\n😌 ارتاح، تستاهل!' : '⏳ **ما عندك امتحانات** مسجلة.\n\n➕ تحب تضيف واحد؟';
    }
    var next = exams[0];
    var days = daysFromNow(next.date);
    var emoji = days <= 3 ? '🚨' : days <= 7 ? '⚠️' : '📅';
    var msg = emoji + ' **أقرب امتحان** (بعد ' + days + ' يوم):\n\n';
    msg += '📝 **' + next.name + '**\n';
    msg += '📅 ' + next.date;
    if(next.time) msg += ' — ⏰ ' + next.time;
    if(next.room) msg += '\n📍 ' + next.room;
    if(next.course) msg += '\n📚 ' + next.course;

    if(exams.length > 1){
      msg += '\n\n**البقية (' + (exams.length - 1) + '):**\n';
      exams.slice(1,5).forEach(function(e){
        msg += '• ' + e.name + ' — بعد ' + daysFromNow(e.date) + ' يوم\n';
      });
    }
    if(days <= 7 && days > 0){
      msg += '\n💪 **نصيحة:** ابدأ مراجعة جدية، وادرس بومودورو.';
    }
    setCtxTopic('exams', {next: next.name, days: days});
    return msg;
  }

  function handleQueryGpa(){
    var rows = window.gpaRows || [];
    var G = window.GRADES || {};
    var pts = 0, hrs = 0, valid = 0;
    rows.forEach(function(r){
      var h = parseFloat(r.hrs) || 0;
      if(h > 0 && r.name && G[r.grade] !== undefined){ pts += h * G[r.grade]; hrs += h; valid++; }
    });
    if(!hrs) return '📊 **ما عندك علامات مسجلة** بحاسبة المعدل بعد.\n\n➕ افتح "علاماتي" وأضف موادك.';
    var gpa = pts / hrs;
    var label = gpa >= 3.75 ? '🏆 ممتاز' : gpa >= 3.5 ? '⭐ جيد جداً مرتفع' : gpa >= 3.0 ? '✅ جيد جداً' : gpa >= 2.5 ? '👍 جيد' : gpa >= 2.0 ? '📌 مقبول' : '⚠️ يحتاج تحسين';
    var msg = '📊 **معدلك التراكمي:**\n\n';
    msg += '🎯 **' + gpa.toFixed(2) + '** — ' + label + '\n\n';
    msg += '📚 الساعات: ' + hrs + '\n📝 المواد: ' + valid;
    if(gpa < 3.0) msg += '\n\n💡 تحتاج دفعة؟ اسألني "شو أسجل الترم الجاي"';
    setCtxTopic('gpa', {gpa: gpa});
    return msg;
  }

  function handleQueryBudget(){
    var sp = getSpace();
    var budget = sp.budget || [];
    if(!budget.length) return '💰 **ما عندك حركات مالية** مسجلة.\n\n➕ أضف من قسم الميزانية.';
    var inc = budget.filter(function(b){ return b.type === 'income'; }).reduce(function(a,b){ return a + (parseFloat(b.amount)||0); }, 0);
    var exp = budget.filter(function(b){ return b.type === 'expense'; }).reduce(function(a,b){ return a + (parseFloat(b.amount)||0); }, 0);
    var bal = inc - exp;
    var status = bal >= 0 ? '👍 ممتاز' : '⚠️ انتبه';
    var msg = '💰 **ملخص ميزانيتك:**\n\n';
    msg += '📈 دخل: **' + inc.toFixed(0) + ' د**\n';
    msg += '📉 مصروف: **' + exp.toFixed(0) + ' د**\n';
    msg += '💼 رصيد: **' + bal.toFixed(0) + ' د** ' + status + '\n';
    // Top category
    var byCat = {};
    budget.filter(function(b){ return b.type === 'expense'; }).forEach(function(b){
      byCat[b.category] = (byCat[b.category] || 0) + (parseFloat(b.amount) || 0);
    });
    var cats = Object.keys(byCat).sort(function(a,b){ return byCat[b] - byCat[a]; });
    if(cats.length){
      var BUDGET_CATS = window.BUDGET_CATS || [];
      var topCat = BUDGET_CATS.find(function(c){ return c.v === cats[0]; });
      msg += '\n🔍 **أكبر مصروف:** ' + (topCat ? topCat.i + ' ' + topCat.l : cats[0]) + ' (' + byCat[cats[0]].toFixed(0) + ' د)';
    }
    setCtxTopic('budget', {balance: bal});
    return msg;
  }

  function handleQueryCourses(){
    var sp = getSpace();
    var courses = sp.courses || [];
    if(!courses.length) return '📚 **ما عندك مواد مسجلة.**\n\n➕ أضف موادك من قسم "موادي" أو استوردها من الخطة.';
    var totalH = courses.reduce(function(a,c){ return a + (c.hours||0); }, 0);
    var msg = '📚 **موادك** (' + courses.length + ' — ' + totalH + ' ساعة):\n\n';
    courses.slice(0,8).forEach(function(c){
      msg += '• **' + c.name + '**';
      if(c.hours) msg += ' (' + c.hours + ' س)';
      msg += '\n';
    });
    if(courses.length > 8) msg += '\n... و ' + (courses.length - 8) + ' مواد أخرى';
    setCtxTopic('courses', {count: courses.length});
    return msg;
  }

  function handleQueryNotes(){
    var notes = window.notes || [];
    if(!notes.length) return '📔 **ما عندك ملاحظات.**';
    var msg = '📔 **ملاحظاتك** (' + notes.length + '):\n\n';
    notes.slice(0,4).forEach(function(n){
      msg += '• **' + (n.title || 'بدون عنوان') + '**\n';
    });
    if(notes.length > 4) msg += '\n... و ' + (notes.length - 4) + ' أكثر';
    return msg;
  }

  function handleQueryAttendance(){
    var sp = getSpace();
    var att = sp.attendance || {};
    var entries = Object.keys(att);
    if(!entries.length) return '✅ **ما عندك تسجيل حضور.**';
    var msg = '✅ **حضورك:**\n\n';
    var warn = [];
    entries.slice(0, 6).forEach(function(name){
      var a = att[name];
      var total = a.present + a.absent;
      var pct = total ? Math.round(a.present/total*100) : 0;
      var emoji = total === 0 ? '⚪' : pct >= 85 ? '🟢' : pct >= 75 ? '🟡' : '🔴';
      msg += emoji + ' **' + name + ':** ' + (total ? pct + '%' : 'لا يوجد') + '\n';
      if(total > 0 && pct < 75) warn.push(name);
    });
    if(warn.length) msg += '\n⚠️ **تحذير:** ' + warn.length + ' مادة تحت 75%!';
    return msg;
  }

  function handleTodaySchedule(){
    var sp = getSpace();
    var tt = sp.timetable || {};
    var DAYS_EN = window.DAYS_EN || ['Sun','Mon','Tue','Wed','Thu'];
    var DAYS_AR = window.DAYS_AR || ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    var todayIdx = new Date().getDay();
    var todayKey = DAYS_EN[todayIdx];
    if(!todayKey) return '🌴 اليوم **' + DAYS_AR[todayIdx] + '** — ما في محاضرات بالجامعة عادة!';
    var classes = Object.keys(tt).filter(function(k){ return k.indexOf(todayKey) === 0; });
    if(!classes.length) return '🌴 ما عندك محاضرات اليوم (' + DAYS_AR[todayIdx] + ').\n\n💡 تحب تشوف جدول الأسبوع؟';
    classes.sort();
    var msg = '📅 **محاضراتك اليوم (' + DAYS_AR[todayIdx] + '):**\n\n';
    classes.forEach(function(k){
      var time = k.split('-')[1];
      var cls = tt[k];
      msg += '⏰ **' + time + '** — ' + cls.name;
      if(cls.room) msg += ' 📍' + cls.room;
      msg += '\n';
    });
    return msg;
  }

  function handleSummary(){
    var sp = getSpace();
    var S = getS();
    var name = (sp.profile && sp.profile.name) || 'صديقي';
    var tasks = sp.tasks || [];
    var pending = tasks.filter(function(t){ return !t.done; }).length;
    var exams = (sp.exams || []).filter(function(e){ return e.date >= today(); }).length;
    var budget = sp.budget || [];
    var inc = budget.filter(function(b){ return b.type === 'income'; }).reduce(function(a,b){ return a + (parseFloat(b.amount)||0); }, 0);
    var exp = budget.filter(function(b){ return b.type === 'expense'; }).reduce(function(a,b){ return a + (parseFloat(b.amount)||0); }, 0);
    var bal = inc - exp;
    var sessions = S.get('pomoSessions', 0) || 0;
    var log = S.get('studyLog', {});
    var weekMin = 0;
    for(var i = 0; i < 7; i++){
      weekMin += log[new Date(Date.now() - i*86400000).toISOString().slice(0,10)] || 0;
    }
    return '📊 **ملخص ' + esc(name) + '**\n━━━━━━━━━━━━━━━\n\n' +
      '📚 **الدراسة:**\n' +
      '• المواد: ' + (sp.courses||[]).length + '\n' +
      '• مهام متبقية: ' + pending + '\n' +
      '• امتحانات قادمة: ' + exams + '\n\n' +
      '⏱️ **المذاكرة:**\n' +
      '• جلسات: ' + sessions + '\n' +
      '• ساعات آخر أسبوع: ' + (weekMin/60).toFixed(1) + '\n\n' +
      '💰 **المالية:**\n' +
      '• الرصيد: ' + bal.toFixed(0) + ' د ' + (bal >= 0 ? '👍' : '⚠️');
  }

  function handlePlanNext(){
    if(typeof window.suggestNextSemester !== 'function')
      return '🎓 محاكي الترم الجاي مو متوفر. أعد تحميل الصفحة.';
    var r = window.suggestNextSemester();
    if(!r.suggestions.length) return '📚 **ما لقيت مواد مقترحة** للترم الجاي.\n\n💡 تأكد إنك أضفت موادك الحالية بـ "موادي".';
    var semNames = ['','الفصل الأول','الفصل الثاني','الفصل الثالث','الفصل الرابع','الفصل الخامس','الفصل السادس','الفصل السابع','الفصل الثامن','الفصل التاسع'];
    var msg = '🎓 **مقترح ' + (semNames[r.semester]||'الترم الجاي') + ':**\n\n';
    var ready = r.suggestions.filter(function(s){ return s.ready; });
    var blocked = r.suggestions.filter(function(s){ return !s.ready; });
    if(ready.length){
      msg += '✅ **جاهز للتسجيل:**\n';
      ready.forEach(function(s){ msg += '• ' + s.name + ' (' + s.info.h + ' س)\n'; });
    }
    if(blocked.length){
      msg += '\n⚠️ **تحتاج متطلبات:**\n';
      blocked.slice(0,3).forEach(function(s){
        msg += '• ' + s.name + ' → 🔒 ' + s.blocked.join('، ') + '\n';
      });
    }
    msg += '\n📊 **مجموع جاهز:** ' + r.totalHours + ' ساعة';
    return msg;
  }

  function handleProgress(){
    if(typeof window.analyzeGraduationGap !== 'function')
      return '🎓 ما أقدر أحسب تقدمك حالياً.';
    var g = window.analyzeGraduationGap();
    var pct = Math.round((g.progress.total / g.totalRequired.total) * 100);
    var msg = '📊 **تقدمك للتخرج:**\n\n';
    msg += '🎯 **' + g.progress.total + ' / ' + g.totalRequired.total + '** ساعة (' + pct + '%)\n';
    msg += '⏳ باقي **' + g.remaining.total + '** ساعة\n\n';
    msg += '**التفصيل:**\n';
    msg += '🏛️ جامعة إجبارية: ' + g.progress['uni-c'] + '/' + g.totalRequired['uni-c'] + '\n';
    msg += '🎨 جامعة اختيارية: ' + g.progress['uni-e'] + '/' + g.totalRequired['uni-e'] + '\n';
    msg += '🏫 كلية: ' + g.progress.faculty + '/' + g.totalRequired.faculty + '\n';
    msg += '🎯 تخصص إجباري: ' + g.progress['major-c'] + '/' + g.totalRequired['major-c'] + '\n';
    msg += '⭐ تخصص اختياري: ' + g.progress['major-e'] + '/' + g.totalRequired['major-e'];
    return msg;
  }

  function handleCourseInfo(lower){
    var DB = window.COURSES_DB || {};
    var found = null, bestScore = 0;
    Object.keys(DB).forEach(function(name){
      var nameNorm = norm(name);
      // ابحث عن تطابق ضمن lower
      if(lower.indexOf(nameNorm) > -1){ found = name; bestScore = 100; return; }
      // جزئي
      var toks = tokens(nameNorm);
      var matches = toks.filter(function(t){ return t.length > 2 && lower.indexOf(t) > -1; }).length;
      if(matches && matches/toks.length >= 0.6 && matches > bestScore){
        found = name; bestScore = matches;
      }
    });
    // بحث بالكود
    var codeMatch = lower.match(/\b(\d{6,10})\b/);
    if(!found && codeMatch){
      Object.keys(DB).forEach(function(k){ if(DB[k].code === codeMatch[1]) found = k; });
    }
    if(!found) return null;
    var info = DB[found];
    var t = (window.COURSE_TYPES && window.COURSE_TYPES[info.t]) || {label:'مادة', icon:'📘'};
    var msg = t.icon + ' **' + found + '**\n\n';
    msg += '📌 كود: `' + info.code + '`\n';
    msg += '⏱️ ساعات: ' + info.h + '\n';
    msg += '🏷️ ' + t.label + '\n';
    if(info.pre && info.pre.length) msg += '🔒 متطلب: ' + info.pre.join('، ') + '\n';
    else msg += '🔓 بدون متطلب سابق\n';
    if(info.d) msg += '\n📖 ' + info.d.slice(0, 300);
    setCtxTopic('course', {name: found});
    return msg;
  }

  function handleTips(lower){
    var tips = window.STUDY_TIPS || ['💡 ادرس بنفس الوقت يومياً.'];
    var q = tips[Math.floor(Math.random() * tips.length)];
    return q + '\n\n💡 تحب نصائح أكثر؟ اسأل: "كيف أنظم وقتي؟"';
  }

  function handleMotivation(){
    var quotes = window.DAILY_QUOTES || [{t:'لا تنتظر الفرصة، اصنعها بنفسك.', a:'—'}];
    var q = quotes[Math.floor(Math.random() * quotes.length)];
    var msgs = [
      '💪 **لا تيأس!** كل واحد يمر بأيام صعبة.\n\n✨ "' + q.t + '"\n— ' + q.a,
      '🌟 **أنت أقوى من كذا!** خذ نفس عميق وكمّل.\n\n✨ "' + q.t + '"',
      '🔥 **تعبت؟ معناته أنت تحاول!** هذي علامة إنك تشتغل.\n\n✨ "' + q.t + '"'
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  /* ============ Context Follow-ups ============ */
  function handleFollowUp(lower, ctx){
    if(!ctx || !ctx.lastTopic) return null;
    var short = lower.split(' ').filter(Boolean).length <= 3;
    if(!short) return null;

    // "ومتى؟" / "متى؟" بعد امتحان
    if(ctx.lastTopic === 'exams' && /متى|when/.test(lower)) return null;

    // "شو هي؟" / "وهو؟" (ضمير مبهم) — نعيد الموضوع السابق
    if(/شو هي|وش هي|هو ايش|ايش هو|وش اسمه|what is it/.test(lower)){
      if(ctx.lastTopic === 'course' && ctx.lastData && ctx.lastData.name){
        return 'تقصد **' + ctx.lastData.name + '**؟\n\n💡 اسألني: "وصف ' + ctx.lastData.name + '"';
      }
    }
    return null;
  }

  /* ============ Multi-intent Splitter ============ */
  function splitMultiIntent(text){
    // نقسم على "و" أو "ثم" أو "," فقط لو في فعلين
    var parts = norm(text).split(/\s+(?:و|ثم)\s+/);
    if(parts.length < 2) return [text];
    // نتحقق: هل كل جزء فيه فعل أمر أو استفهام؟
    var valid = parts.every(function(p){
      var t = tokens(p);
      return t.length >= 2;
    });
    return valid ? parts : [text];
  }

  /* ============ Router ============ */
  function process(text){
    var raw = String(text || '').trim();
    if(!raw) return {text: '🤔 اكتب شي عشان أساعدك!'};

    // تحقق سياق
    var ctx = getCtx();
    var followUp = handleFollowUp(norm(raw), ctx);
    if(followUp) return {text: followUp};

    // قسّم لو multi-intent
    var parts = splitMultiIntent(raw);
    if(parts.length > 1){
      var responses = parts.map(function(p){ return processSingle(p).text; }).filter(Boolean);
      return {text: responses.join('\n\n━━━━━━━━━━━━━━━\n\n')};
    }

    return processSingle(raw);
  }

  function processSingle(text){
    var raw = String(text || '').trim();
    var lower = norm(raw);

    // Small talk أولاً (سريع)
    if(/^(مرحبا|هلا|اهلا|هاي|hi|hello|صباح|مساء|السلام)/.test(lower) && lower.split(' ').length <= 4){
      return {text: handleGreeting(lower), intent: 'greeting'};
    }
    if(/شكرا|مشكور|thank/.test(lower) && lower.split(' ').length <= 3){
      return {text: handleThanks(), intent: 'thanks'};
    }
    if(/من انت|مين انت|who are you|اسمك/.test(lower)) return {text: handleWhoYou(), intent: 'who'};
    if(/كيف حالك|كيفك|شلونك|اخبارك/.test(lower)) return {text: handleHowAreYou(), intent: 'howareyou'};
    if(/ساعدني|help|اقدر اسوي|شو تعرف/.test(lower)) return {text: handleHelp(), intent: 'help'};

    // Classify
    var cls = classify(raw);
    var intent = cls.intent;

    // Route
    if(intent === 'navigate' || /افتح|روح|اذهب|انتقل|ودني|show me|open/i.test(lower)){
      var r = handleNavigate(lower);
      if(r) return {text: r, intent: 'navigate'};
    }

    // Count specific
    if(intent === 'count_tasks' || (/كم|how many/i.test(lower) && /مهام|واجبات|tasks/.test(lower))){
      var sp = getSpace();
      var pending = (sp.tasks||[]).filter(function(t){ return !t.done; });
      setCtxTopic('tasks', {count: pending.length});
      return {text: '📝 عندك **' + pending.length + '** مهمة متبقية' + (pending.length ? ' 📌' : ' ✨'), intent: 'count_tasks'};
    }
    if(intent === 'count_exams' || (/كم|how many/i.test(lower) && /امتحان|اختبار|exams/.test(lower))){
      var upcoming = (getSpace().exams||[]).filter(function(e){ return e.date >= today(); }).length;
      return {text: '⏳ عندك **' + upcoming + '** امتحان قادم' + (upcoming ? ' 📚' : ' 😌'), intent: 'count_exams'};
    }

    if(intent === 'query_tasks') return {text: handleQueryTasks(lower), intent};
    if(intent === 'query_exams') return {text: handleQueryExams(lower), intent};
    if(intent === 'query_gpa') return {text: handleQueryGpa(), intent};
    if(intent === 'query_budget') return {text: handleQueryBudget(), intent};
    if(intent === 'query_courses') return {text: handleQueryCourses(), intent};
    if(intent === 'query_notes') return {text: handleQueryNotes(), intent};
    if(intent === 'query_attendance') return {text: handleQueryAttendance(), intent};
    if(intent === 'query_schedule_today' || (/اليوم|today/.test(lower) && /محاضرات|جدول/.test(lower))) return {text: handleTodaySchedule(), intent};
    if(intent === 'query_summary' || /ملخص|summary|وضعي/.test(lower)) return {text: handleSummary(), intent};
    if(intent === 'plan_next_sem') return {text: handlePlanNext(), intent};
    if(intent === 'progress') return {text: handleProgress(), intent};
    if(intent === 'course_info'){ var ci = handleCourseInfo(lower); if(ci) return {text: ci, intent}; }
    if(intent === 'tips') return {text: handleTips(lower), intent};
    if(intent === 'motivation') return {text: handleMotivation(), intent};

    // Fallback: حاول AI الأصلي
    if(typeof window._aiOriginal === 'function'){
      var orig = window._aiOriginal(raw);
      if(orig && orig.indexOf('ما فهمت') === -1) return {text: orig, intent: 'original'};
    }

    // Fallback ذكي
    return {text: buildSmartFallback(raw), intent: null};
  }

  function buildSmartFallback(raw){
    var suggestions = [
      '📝 "كم مهمة عندي؟"',
      '⏳ "متى امتحاني القادم؟"',
      '📚 "شو موادي هالترم؟"',
      '💰 "كم رصيدي؟"',
      '🎓 "شو أسجل الترم الجاي؟"',
      '📊 "معدلي كام؟"'
    ];
    var picks = [];
    for(var i = 0; i < 4; i++){
      var idx = Math.floor(Math.random() * suggestions.length);
      picks.push(suggestions.splice(idx, 1)[0]);
    }
    return '🤔 ما فهمت "' + esc(raw) + '" تماماً.\n\n' +
      '💡 **جرّب تسألني:**\n\n' +
      picks.join('\n') + '\n\n' +
      '🔍 أو اكتب **"ساعدني"** لقائمة كاملة.';
  }

  /* ============ Install ============ */
  function install(){
    if(typeof window.aiRespond !== 'function'){ setTimeout(install, 300); return; }
    if(window._aiSmartInstalled) return;
    window._aiSmartInstalled = true;

    // خزّن الأصلية
    window._aiOriginal = window.aiRespond;

    // استبدل بـ smart
    window.aiRespond = function(q){
      try{
        return process(q).text;
      }catch(e){
        console.error('Smart AI error:', e);
        return window._aiOriginal ? window._aiOriginal(q) : '⚠️ صار خطأ، جرب مرة ثانية.';
      }
    };

    // أضف suggestions جديدة
    var SUGG = [
      'ساعدني',
      'كم مهمة عندي؟',
      'شو أسجل الترم الجاي؟',
      'كم باقيلي للتخرج؟',
      'متى امتحاني القادم؟',
      'ملخص مساحتي',
      'شو موادي؟',
      'معدلي كام؟'
    ];
    if(Array.isArray(window.SUGG_POOL)){
      SUGG.forEach(function(s){ if(window.SUGG_POOL.indexOf(s) === -1) window.SUGG_POOL.push(s); });
    }
  }

  window._aiSmart = {
    process: process,
    classify: classify,
    handleHelp: handleHelp,
    resetCtx: function(){ try{ sessionStorage.removeItem(CTX_KEY); }catch(e){} }
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('🧠 AI Smart loaded');
})();