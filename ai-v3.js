/* ============================================================
   🧠 ai-v3.js — مساعد ذكي (v3.1 مع إصلاح findCourseByCode)
   ============================================================ */
(function(){
  'use strict';

  function norm(s){
    if(s == null) return '';
    return String(s)
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  }
  function tokens(s){ return norm(s).split(' ').filter(Boolean); }

  function stem(w){
    if(!w || w.length < 3) return w;
    var o = w;
    w = w.replace(/^(وال|بال|كال|فال|ال)/, '');
    if(w.length >= 3 && w !== o) return w;
    w = w.replace(/^(و|ف|ب|ل)/, '');
    if(w.length >= 3 && w !== o) return w;
    w = w.replace(/(ها|هم|هن|كم|كن|نا|ات|ون|ين|يه|ته|ني|تي)$/, '');
    return w.length >= 3 ? w : o;
  }

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
  function sim(a, b){
    if(a === b) return 1;
    var L = Math.max(a.length, b.length);
    if(L < 3) return 0;
    return 1 - (lev(a, b) / L);
  }

  function S(){ return window.S || {get:function(k,d){return d;}}; }
  function space(){ return window.space || {}; }
  function today(){ return window.today ? window.today() : new Date().toISOString().slice(0,10); }
  function dFromNow(d){ return Math.ceil((new Date(d) - new Date(today())) / 86400000); }
  function pick(a){ return a[Math.floor(Math.random() * a.length)]; }

  var CTX = 'ai_v3_ctx';
  function ctxLoad(){ try{ return JSON.parse(sessionStorage.getItem(CTX)||'{}'); }catch(e){ return {}; } }
  function ctxSave(c){ try{ sessionStorage.setItem(CTX, JSON.stringify(c)); }catch(e){} }
  function ctxSet(t, d){ var c = ctxLoad(); c.topic = t; c.data = d||null; c.ts = Date.now(); ctxSave(c); }
  function ctxGet(){
    var c = ctxLoad();
    if(!c.ts || Date.now() - c.ts > 15*60*1000) return {};
    return c;
  }

  function hGreet(lower){
    var name = (space().profile && space().profile.name || '').split(' ')[0];
    if(/السلام عليكم|سلام عليكم/.test(lower)) return '👋 وعليكم السلام' + (name ? ' يا ' + name : '') + '!';
    if(lower.indexOf('صباح') > -1) return '☀️ صباح النور' + (name ? ' يا ' + name : '') + '!';
    if(lower.indexOf('مساء') > -1) return '🌆 مساء النور' + (name ? ' يا ' + name : '') + '!';
    var h = new Date().getHours();
    var greet = h < 12 ? 'صباح الخير' : h < 18 ? 'مساء الخير' : 'مساء النور';
    return '👋 ' + greet + (name ? ' يا ' + name : '') + '! كيف أقدر أساعدك؟';
  }
  function hHowAreYou(){ return pick(['😊 بخير الحمدلله! جاهز أساعدك.', '😄 تمام! وأنت؟', '👌 كله تمام! شو بدك؟']); }
  function hWho(){ return '🤖 **أنا مساعدك الذكي**\n\n✨ أعرف كل شي عن مساحتك:\n• بياناتك وموادك\n• خطتك الدراسية\n• روابط جامعتك\n\n💡 جرّب تسألني أي شي!'; }
  function hThanks(){ return pick(['🙏 على الرحب والسعة!', '💙 أهلاً بيك!', '🌟 بالخدمة!', '😊 ولا يهمك!']); }
  function hHelp(){
    return '🧭 **أقدر أساعدك بـ:**\n\n' +
      '📊 **بياناتك:**\n• "كم مهمة عندي؟"\n• "شو موادي؟"\n• "متى امتحاني القادم؟"\n• "شو رصيدي؟"\n• "معدلي كم؟"\n\n' +
      '🎯 **التخطيط:**\n• "شو أسجل الترم الجاي؟"\n• "كم باقيلي للتخرج؟"\n• "شنو أدرس الحين؟"\n\n' +
      '📚 **معلومات المواد:**\n• "وصف مادة شبكات"\n• "متطلبات مشروع تخرج"\n\n' +
      '🧭 **التنقل:**\n• "افتح المهام" / "روح للميزانية"';
  }
  function hTips(){
    if(/كيف انظم وقت|تنظيم وقت|organiz/.test(norm(lower)))
      return '⏰ **لتنظيم وقتك:**\n\n1️⃣ ادرس بنفس الوقت يومياً\n2️⃣ استخدم بومودورو 25 دقيقة\n3️⃣ رتب الأولويات بالأهم أولاً\n4️⃣ خذ راحة 5 دقائق كل ساعة\n5️⃣ نام 7 ساعات على الأقل';
    var t = window.STUDY_TIPS || ['💡 ادرس بنفس الوقت يومياً.'];
    return pick(t);
  }
  function hMotivation(){
    var q = pick(window.DAILY_QUOTES || [{t:'لا تنتظر الفرصة، اصنعها بنفسك.', a:'—'}]);
    return pick([
      '💪 **لا تيأس!** كلنا نمر بأيام صعبة.\n\n✨ "' + q.t + '"\n— ' + q.a,
      '🌟 **أنت أقوى من كذا!**\n\n✨ "' + q.t + '"',
      '🔥 **تعبك دليل إنك تحاول!**\n\n✨ "' + q.t + '"'
    ]);
  }

  function hNavigate(lower){
    var map = {
      dashboard: ['لوحه','رئيسيه','dashboard','الرئيسيه','البدايه'],
      timetable: ['جدول','جدولي','timetable','المحاضرات','schedule','محاضرات'],
      courses:   ['مواد','موادي','courses','مساقات'],
      tasks:     ['مهام','مهامي','tasks','واجبات','مهمات'],
      exams:     ['امتحانات','اختبارات','exams','الامتحانات','فاينل'],
      attendance:['حضور','attendance'],
      timer:     ['بومودورو','مؤقت','timer','pomodoro'],
      flashcards:['بطاقات','flashcards'],
      gradecalc: ['علامات','درجات','معدل','gpa','علاماتي'],
      budget:    ['ميزانيه','مصاريف','budget'],
      notes:     ['ملاحظات','notes','مذكرات'],
      plan:      ['خطه','plan'],
      hulinks:   ['روابط','بوابه','جامعه','hulinks']
    };
    var names = {
      dashboard:'لوحة التحكم', timetable:'الجدول الأسبوعي', courses:'موادي',
      tasks:'المهام', exams:'الامتحانات', attendance:'الحضور',
      timer:'البومودورو', flashcards:'البطاقات', gradecalc:'علاماتي',
      budget:'الميزانية', notes:'الملاحظات', plan:'الخطة والمواد', hulinks:'روابط الجامعة'
    };
    var found = null;
    Object.keys(map).forEach(function(tab){
      if(found) return;
      map[tab].forEach(function(k){
        if(!found && lower.indexOf(k) > -1) found = tab;
      });
    });
    if(!found) return null;
    try{
      if(typeof window.switchTab === 'function') window.switchTab(found);
      ctxSet('navigated', {tab: found});
      return '✅ فتحت لك **' + names[found] + '**\n\n💡 شي ثاني؟';
    }catch(e){ return null; }
  }

  function hTasks(){
    var sp = space(); var tasks = sp.tasks || [];
    if(!tasks.length) return '📝 **ما عندك مهام** حالياً!\n\n➕ اضغط زر "+" أو Alt+T';
    var pending = tasks.filter(function(t){ return !t.done; });
    if(!pending.length) return '🎉 **مبروك!** خلّصت كل مهامك (' + tasks.length + ' مهمة).\n\n💡 وقت راحة؟';
    var overdue = pending.filter(function(t){ return t.due && t.due < today(); });
    var dueToday = pending.filter(function(t){ return t.due === today(); });
    var msg = '📝 **مهامك** (' + pending.length + ' متبقية من ' + tasks.length + '):\n';
    if(overdue.length){
      msg += '\n🔴 **متأخرة (' + overdue.length + '):**\n';
      overdue.slice(0,3).forEach(function(t){ msg += '• ' + t.title + ' — منذ ' + Math.abs(dFromNow(t.due)) + ' يوم\n'; });
    }
    if(dueToday.length){
      msg += '\n🟡 **اليوم (' + dueToday.length + '):**\n';
      dueToday.slice(0,3).forEach(function(t){ msg += '• ' + t.title + '\n'; });
    }
    var up = pending.filter(function(t){ if(!t.due) return false; var d = dFromNow(t.due); return d > 0 && d <= 7; });
    if(up.length && !dueToday.length){
      msg += '\n🟢 **هذا الأسبوع:**\n';
      up.slice(0,4).forEach(function(t){
        var d = dFromNow(t.due);
        msg += '• ' + t.title + ' — ' + (d === 1 ? 'بكرة' : 'بعد ' + d + ' أيام') + '\n';
      });
    }
    if(!overdue.length && !dueToday.length && !up.length) msg += '\n✅ ما عندك شي عاجل! 😎';
    ctxSet('tasks', {count: pending.length});
    return msg;
  }

  function hExams(){
    var sp = space();
    var exams = (sp.exams || []).filter(function(e){ return e.date >= today(); })
      .sort(function(a,b){ return a.date.localeCompare(b.date); });
    if(!exams.length){
      var past = (sp.exams || []).length;
      return past ? '✅ **خلصت كل امتحاناتك!** (' + past + ' امتحان)\n\n😌 ارتاح!' : '⏳ **ما عندك امتحانات** مسجلة.';
    }
    var next = exams[0];
    var days = dFromNow(next.date);
    var emoji = days <= 3 ? '🚨' : days <= 7 ? '⚠️' : '📅';
    var msg = emoji + ' **أقرب امتحان** (بعد ' + days + ' يوم):\n\n';
    msg += '📝 **' + next.name + '**\n';
    msg += '📅 ' + next.date;
    if(next.time) msg += ' — ⏰ ' + next.time;
    if(next.room) msg += '\n📍 ' + next.room;
    if(next.course) msg += '\n📚 ' + next.course;
    if(exams.length > 1){
      msg += '\n\n**البقية (' + (exams.length-1) + '):**\n';
      exams.slice(1,5).forEach(function(e){ msg += '• ' + e.name + ' — بعد ' + dFromNow(e.date) + ' يوم\n'; });
    }
    ctxSet('exams', {next: next.name, days: days});
    return msg;
  }

  function hGpa(){
    var rows = window.gpaRows || []; var G = window.GRADES || {};
    var pts = 0, hrs = 0, valid = 0;
    rows.forEach(function(r){
      var h = parseFloat(r.hrs) || 0;
      if(h > 0 && r.name && G[r.grade] !== undefined){ pts += h * G[r.grade]; hrs += h; valid++; }
    });
    if(!hrs) return '📊 **ما عندك علامات مسجلة** بحاسبة المعدل.\n\n➕ افتح "علاماتي" وأضف موادك.';
    var gpa = pts / hrs;
    var label = gpa >= 3.75 ? '🏆 ممتاز' : gpa >= 3.5 ? '⭐ جيد جداً مرتفع' : gpa >= 3.0 ? '✅ جيد جداً' : gpa >= 2.5 ? '👍 جيد' : gpa >= 2.0 ? '📌 مقبول' : '⚠️ يحتاج تحسين';
    return '📊 **معدلك التراكمي:**\n\n🎯 **' + gpa.toFixed(2) + '** — ' + label + '\n\n📚 الساعات: ' + hrs + '\n📝 المواد: ' + valid;
  }

  function hBudget(){
    var b = space().budget || [];
    if(!b.length) return '💰 **ما عندك حركات مالية** مسجلة.';
    var inc = b.filter(function(x){ return x.type === 'income'; }).reduce(function(a,x){ return a + (parseFloat(x.amount)||0); }, 0);
    var exp = b.filter(function(x){ return x.type === 'expense'; }).reduce(function(a,x){ return a + (parseFloat(x.amount)||0); }, 0);
    var bal = inc - exp;
    var msg = '💰 **ملخص ميزانيتك:**\n\n';
    msg += '📈 دخل: **' + inc.toFixed(0) + ' د**\n';
    msg += '📉 مصروف: **' + exp.toFixed(0) + ' د**\n';
    msg += '💼 رصيد: **' + bal.toFixed(0) + ' د** ' + (bal >= 0 ? '👍' : '⚠️') + '\n';
    var byCat = {};
    b.filter(function(x){ return x.type === 'expense'; }).forEach(function(x){
      byCat[x.category] = (byCat[x.category]||0) + (parseFloat(x.amount)||0);
    });
    var cats = Object.keys(byCat).sort(function(a,b){ return byCat[b] - byCat[a]; });
    if(cats.length){
      var BC = window.BUDGET_CATS || [];
      var top = BC.find(function(c){ return c.v === cats[0]; });
      msg += '\n🔍 **أكبر مصروف:** ' + (top ? top.i + ' ' + top.l : cats[0]) + ' (' + byCat[cats[0]].toFixed(0) + ' د)';
    }
    return msg;
  }

  function hCourses(){
    var c = space().courses || [];
    if(!c.length) return '📚 **ما عندك مواد مسجلة.**';
    var tot = c.reduce(function(a,x){ return a + (x.hours||0); }, 0);
    var msg = '📚 **موادك** (' + c.length + ' — ' + tot + ' ساعة):\n\n';
    c.slice(0,12).forEach(function(x){ msg += '• **' + x.name + '**' + (x.hours ? ' (' + x.hours + ' س)' : '') + '\n'; });
    if(c.length > 12) msg += '\n... و ' + (c.length-12) + ' أكثر';
    return msg;
  }

  function hNotes(){
    var n = window.notes || [];
    if(!n.length) return '📔 **ما عندك ملاحظات.**';
    var msg = '📔 **ملاحظاتك** (' + n.length + '):\n\n';
    n.slice(0,5).forEach(function(x){ msg += '• **' + (x.title || 'بدون عنوان') + '**\n'; });
    if(n.length > 5) msg += '\n... و ' + (n.length-5) + ' أكثر';
    return msg;
  }

  function hAttendance(){
    var a = space().attendance || {};
    var keys = Object.keys(a);
    if(!keys.length) return '✅ **ما عندك تسجيل حضور.**';
    var msg = '✅ **حضورك:**\n\n';
    var warn = [];
    keys.slice(0, 8).forEach(function(name){
      var x = a[name]; var tot = x.present + x.absent;
      var pct = tot ? Math.round(x.present/tot*100) : 0;
      var e = tot === 0 ? '⚪' : pct >= 85 ? '🟢' : pct >= 75 ? '🟡' : '🔴';
      msg += e + ' **' + name + ':** ' + (tot ? pct + '%' : 'لا يوجد') + '\n';
      if(tot > 0 && pct < 75) warn.push(name);
    });
    if(warn.length) msg += '\n⚠️ **تحذير:** ' + warn.length + ' مادة تحت 75%!';
    return msg;
  }

  function hTodaySchedule(){
    var tt = space().timetable || {};
    var DAYS_EN = window.DAYS_EN || ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var DAYS_AR = window.DAYS_AR || ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    var ti = new Date().getDay();
    var tk = DAYS_EN[ti];
    if(!tk) return '🌴 اليوم **' + DAYS_AR[ti] + '** — عطلة!';
    var list = Object.keys(tt).filter(function(k){ return k.indexOf(tk) === 0; });
    if(!list.length) return '🌴 ما عندك محاضرات اليوم (' + DAYS_AR[ti] + ').\n\n💡 تحب تشوف جدول الأسبوع؟';
    list.sort();
    var msg = '📅 **محاضراتك اليوم (' + DAYS_AR[ti] + '):**\n\n';
    list.forEach(function(k){
      var t = k.split('-')[1]; var cls = tt[k];
      msg += '⏰ **' + t + '** — ' + cls.name;
      if(cls.room) msg += ' 📍' + cls.room;
      msg += '\n';
    });
    return msg;
  }

  function hSummary(){
    var sp = space();
    var name = (sp.profile && sp.profile.name) || 'صديقي';
    var pending = (sp.tasks||[]).filter(function(t){ return !t.done; }).length;
    var exams = (sp.exams||[]).filter(function(e){ return e.date >= today(); }).length;
    var b = sp.budget || [];
    var inc = b.filter(function(x){ return x.type==='income'; }).reduce(function(a,x){ return a + (parseFloat(x.amount)||0); }, 0);
    var exp = b.filter(function(x){ return x.type==='expense'; }).reduce(function(a,x){ return a + (parseFloat(x.amount)||0); }, 0);
    var bal = inc - exp;
    var S_ = S();
    var sessions = S_.get('pomoSessions', 0) || 0;
    var log = S_.get('studyLog', {});
    var week = 0;
    for(var i = 0; i < 7; i++){
      week += log[new Date(Date.now() - i*86400000).toISOString().slice(0,10)] || 0;
    }
    return '📊 **ملخص ' + name + '**\n━━━━━━━━━━━━━━━\n\n' +
      '📚 **الدراسة:**\n' +
      '• المواد: ' + (sp.courses||[]).length + '\n' +
      '• مهام متبقية: ' + pending + '\n' +
      '• امتحانات قادمة: ' + exams + '\n\n' +
      '⏱️ **المذاكرة:**\n' +
      '• جلسات: ' + sessions + '\n' +
      '• ساعات آخر أسبوع: ' + (week/60).toFixed(1) + '\n\n' +
      '💰 **المالية:**\n' +
      '• الرصيد: ' + bal.toFixed(0) + ' د ' + (bal >= 0 ? '👍' : '⚠️');
  }

  function hPlanNext(){
    if(typeof window.suggestNextSemester !== 'function') return '🎓 محاكي الترم الجاي مو متوفر. أعد تحميل الصفحة.';
    var r = window.suggestNextSemester();
    if(!r.suggestions.length) return '📚 **ما لقيت مواد مقترحة** للترم الجاي.\n\n💡 تأكد إنك أضفت موادك الحالية بـ "موادي".';
    var names = ['','الفصل الأول','الفصل الثاني','الفصل الثالث','الفصل الرابع','الفصل الخامس','الفصل السادس','الفصل السابع','الفصل الثامن','الفصل التاسع'];
    var msg = '🎓 **مقترح ' + (names[r.semester]||'الترم الجاي') + ':**\n\n';
    var ready = r.suggestions.filter(function(s){ return s.ready; });
    var blocked = r.suggestions.filter(function(s){ return !s.ready; });
    if(ready.length){
      msg += '✅ **جاهز للتسجيل:**\n';
      ready.forEach(function(s){ msg += '• ' + s.name + ' (' + s.info.h + ' س)\n'; });
    }
    if(blocked.length){
      msg += '\n⚠️ **تحتاج متطلبات:**\n';
      blocked.slice(0,3).forEach(function(s){ msg += '• ' + s.name + ' → 🔒 ' + s.blocked.join('، ') + '\n'; });
    }
    msg += '\n📊 **مجموع جاهز:** ' + r.totalHours + ' ساعة';
    return msg;
  }

  function hProgress(){
    if(typeof window.analyzeGraduationGap !== 'function') return '🎓 ما أقدر أحسب تقدمك حالياً.';
    var g = window.analyzeGraduationGap();
    var pct = Math.round((g.progress.total / g.totalRequired.total) * 100);
    return '📊 **تقدمك للتخرج:**\n\n' +
      '🎯 **' + g.progress.total + ' / ' + g.totalRequired.total + '** ساعة (' + pct + '%)\n' +
      '⏳ باقي **' + g.remaining.total + '** ساعة\n\n' +
      '**التفصيل:**\n' +
      '🏛️ جامعة إجبارية: ' + g.progress['uni-c'] + '/' + g.totalRequired['uni-c'] + '\n' +
      '🎨 جامعة اختيارية: ' + g.progress['uni-e'] + '/' + g.totalRequired['uni-e'] + '\n' +
      '🏫 كلية: ' + g.progress.faculty + '/' + g.totalRequired.faculty + '\n' +
      '🎯 تخصص إجباري: ' + g.progress['major-c'] + '/' + g.totalRequired['major-c'] + '\n' +
      '⭐ تخصص اختياري: ' + g.progress['major-e'] + '/' + g.totalRequired['major-e'];
  }

  function hStudyNow(){
    var sp = space(); var t = today();
    var soonExams = (sp.exams||[]).filter(function(e){ return e.date >= t; })
      .sort(function(a,b){ return a.date.localeCompare(b.date); }).slice(0,1);
    var soonTasks = (sp.tasks||[]).filter(function(x){ return !x.done && x.due && x.due >= t; })
      .sort(function(a,b){ return a.due.localeCompare(b.due); }).slice(0,3);
    if(!soonExams.length && !soonTasks.length)
      return '🌟 **ما عندك شي قريب!**\n\n💡 اقتراح: راجع مادة قديمة أو اشتغل على مشروع التخرج.';
    var msg = '🧠 **اقتراحي للدراسة الآن:**\n\n';
    if(soonExams.length){
      var e = soonExams[0];
      msg += '📝 **أولوية قصوى:**\n**' + e.name + '** (بعد ' + dFromNow(e.date) + ' يوم)\n\n';
    }
    if(soonTasks.length){
      msg += '📌 **مهام قريبة:**\n';
      soonTasks.forEach(function(x){
        var d = dFromNow(x.due);
        msg += '• ' + x.title + ' (' + (d === 0 ? 'اليوم' : d === 1 ? 'بكرة' : 'بعد ' + d + ' أيام') + ')\n';
      });
    }
    msg += '\n💡 **نصيحة:** ابدأ بأصعب شي وأنت مرتاح، وجرّب بومودورو 25 دقيقة.';
    return msg;
  }

  /* ✅ hCourseInfo مُصلَحة — تستخدم findCourseByCode */
  function hCourseInfo(lower){
    var DB = window.COURSES_DB || {};
    var keys = Object.keys(DB);
    var found = null, best = 0;

    // 1) بالكود — نستخدم findCourseByCode (تتعامل مع الأصفار)
    var cm = lower.match(/\b(0?\d{6,11})\b/);
    if(cm){
      if(typeof window.findCourseByCode === 'function'){
        var r = window.findCourseByCode(cm[1]);
        if(r){ found = r.name; best = 9999; }
      }
      // fallback: مقارنة بعد إزالة الأصفار
      if(!found){
        var cleanCode = cm[1].replace(/^0+/, '');
        for(var ci = 0; ci < keys.length; ci++){
          if(String(DB[keys[ci]].code).replace(/^0+/, '') === cleanCode){
            found = keys[ci]; best = 9999; break;
          }
        }
      }
    }

    // 2) بالاسم الكامل
    if(!found){
      for(var j = 0; j < keys.length; j++){
        var kn = norm(keys[j]);
        if(lower.indexOf(kn) > -1){ found = keys[j]; best = 500; break; }
      }
    }

    // 3) مطابقة جزئية
    if(!found){
      var tt = tokens(lower).map(stem);
      for(var k2 = 0; k2 < keys.length; k2++){
        var nt = tokens(keys[k2]).map(stem).filter(function(t){ return t.length > 2; });
        if(!nt.length) continue;
        var matched = 0;
        for(var ni = 0; ni < nt.length; ni++){
          for(var ti2 = 0; ti2 < tt.length; ti2++){
            if(tt[ti2] === nt[ni] || sim(tt[ti2], nt[ni]) >= 0.82){ matched++; break; }
          }
        }
        var ratio = matched / nt.length;
        var sc = matched * 40 + (ratio >= 0.75 ? 60 : 0);
        if(ratio >= 0.5 && sc > best){ found = keys[k2]; best = sc; }
      }
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
    if(info.d) msg += '\n📖 ' + info.d.slice(0, 350);
    ctxSet('course', {name: found});
    return msg;
  }

  function hCountTasks(){
    var p = (space().tasks || []).filter(function(t){ return !t.done; });
    if(!p.length) return '🎉 ما عندك مهام!';
    return '📝 عندك **' + p.length + '** مهمة متبقية 📌';
  }
  function hCountExams(){
    var u = (space().exams || []).filter(function(e){ return e.date >= today(); }).length;
    if(!u) return '✅ ما عندك امتحانات قادمة!';
    return '⏳ عندك **' + u + '** امتحان قادم 📚';
  }

  var INTENTS = [
    { id:'planNext',  priority:8, triggers:['الترم الجاي','الترم القادم','الفصل الجاي','الفصل القادم','شو اسجل','ماذا اسجل','اسجل ايش','next semester','الشسم'], handler:hPlanNext },
    { id:'progress',  priority:8, triggers:['تقدمي','باقي للتخرج','اتخرج','كم باقي','متبقي للتخرج','graduation','كم خلصت'], handler:hProgress },
    { id:'studyNow',  priority:8, triggers:['شنو ادرس','شو ادرس','ايش ادرس','ادرس ايش','استعد','اراجع','ماذا ادرس','بماذا ادرس','study now'], handler:hStudyNow },
    { id:'courseInfo',priority:7, triggers:['وصف ماده','وصف مادة','معلومات عن ماده','معلومات عن مادة','متطلبات ماده','متطلبات مادة','تفاصيل ماده','كود ماده','كود مادة','وصف','تفاصيل ماده'], handler:hCourseInfo },
    { id:'countTasks',priority:9, triggers:['كم مهمه','كم مهام','كم مهمة','كم واجب'], handler:hCountTasks },
    { id:'countExams',priority:9, triggers:['كم امتحان','كم اختبار','كم فاينل'], handler:hCountExams },
    { id:'myTasks',   priority:6, triggers:['مهامي','مهماتي','واجباتي','المهام','شو مهامي','ايش مهامي','شو المهام','مواعيد التسليم','tasks'], handler:hTasks },
    { id:'myExams',   priority:6, triggers:['امتحاني','امتحاناتي','اختباراتي','متى امتحان','الامتحانات','متى فاينل','exams'], handler:hExams },
    { id:'myGpa',     priority:6, triggers:['معدلي','تراكمي','gpa','معدل التراكمي','شو معدلي'], handler:hGpa },
    { id:'myBudget',  priority:6, triggers:['ميزانيتي','رصيدي','مصاريفي','دخلي','الفلوس','كم رصيد','مصروفي','budget'], handler:hBudget },
    { id:'myCourses', priority:5, triggers:['موادي','شو موادي','ايش موادي','قائمه موادي','المواد'], handler:hCourses },
    { id:'myNotes',   priority:5, triggers:['ملاحظاتي','مذكراتي','شو ملاحظاتي','notes'], handler:hNotes },
    { id:'myAtt',     priority:5, triggers:['حضوري','غيابي','كم غياب','الحضور','attendance'], handler:hAttendance },
    { id:'todaySch',  priority:6, triggers:['محاضرات اليوم','جدولي اليوم','شو عندي اليوم','محاضراتي اليوم','schedule today'], handler:hTodaySchedule },
    { id:'summary',   priority:4, triggers:['ملخص مساحتي','ملخص','وضعي','كل شي','summary','overview'], handler:hSummary },
    { id:'tips',      priority:3, triggers:['نصيحه','نصائح','نصيحة','tip','advice','كيف انظم'], handler:hTips },
    { id:'motive',    priority:3, triggers:['محبط','تعبان','زهقت','مليت','فشلت','مش قادر','ما بقدر','sad','tired'], handler:hMotivation }
  ];

  function scoreIntent(intent, lower){
    var sc = 0;
    intent.triggers.forEach(function(t){
      var tn = norm(t);
      if(lower.indexOf(tn) > -1){ sc += 200 + tn.length * 3; return; }
      if(tn.length >= 4){
        var ftoks = tn.split(' ');
        var matched = ftoks.filter(function(ft){
          if(ft.length < 3) return false;
          var toks = tokens(lower);
          for(var i = 0; i < toks.length; i++){
            if(sim(stem(toks[i]), stem(ft)) >= 0.85) return true;
          }
          return false;
        }).length;
        if(matched === ftoks.length && ftoks.length) sc += 130;
      }
    });
    return sc;
  }

  function splitMulti(text){
    var raw = String(text || '').trim();
    if(tokens(raw).length < 5) return [raw];
    var parts = raw.split(/\s+(?:و|ثم)\s+/);
    if(parts.length < 2) return [raw];
    var valid = parts.every(function(p){ return tokens(p).length >= 2; });
    return valid ? parts : [raw];
  }

  function handleFollowUp(lower){
    var c = ctxGet();
    if(!c.topic) return null;
    if(c.topic === 'exams' && /^(ومتى|متى)/.test(lower) && c.data && c.data.next){
      return '📅 امتحان **' + c.data.next + '** بعد **' + c.data.days + '** يوم.';
    }
    if(c.topic === 'course' && /وصفه|وصف|تفاصيله|عنها|عنه|اكمل/.test(lower) && c.data && c.data.name){
      return hCourseInfo(norm(c.data.name));
    }
    return null;
  }

  function processQuery(q){
    var raw = String(q || '').trim();
    if(!raw) return '🤔 اكتب شي عشان أساعدك!';
    var lower = norm(raw);

    var fu = handleFollowUp(lower);
    if(fu) return fu;

    var parts = splitMulti(raw);
    if(parts.length > 1){
      var r = parts.map(function(p){ return processSingle(p); }).filter(Boolean);
      return r.join('\n\n━━━━━━━━━━━━━━━\n\n');
    }
    return processSingle(raw);
  }

  function processSingle(text){
    var raw = String(text || '').trim();
    var lower = norm(raw);

    if(/^(السلام عليكم|سلام عليكم|سلام|مرحبا|هلا|اهلا|هاي|hi|hello|صباح|مساء)/.test(lower) && tokens(lower).length <= 5){
      return hGreet(lower);
    }
    if(/(^|\s)(كيفك|كيف حالك|شلونك|اخبارك|how are you)/.test(lower) && tokens(lower).length <= 6){
      return hHowAreYou();
    }
    if(/(^|\s)(شكرا|مشكور|thank|تسلم)/.test(lower) && tokens(lower).length <= 4){
      return hThanks();
    }
    if(/من انت|مين انت|منو انت|who are you|اسمك ايش|اسمك شو/.test(lower)){
      return hWho();
    }
    if(/^(ساعدني|مساعده|help|شو تعرف|شو بتعرف|ايش تعرف|كيف بقدر)/.test(lower)){
      return hHelp();
    }

    if(/(افتح|روح|خذني|انتقل|ودني|goto|open|show me|سير)/.test(lower)){
      var nr = hNavigate(lower);
      if(nr) return nr;
    }

    var scored = INTENTS.map(function(it){
      var sc = scoreIntent(it, lower);
      return { intent: it, score: sc + (it.priority || 5) * 30, rawScore: sc };
    }).filter(function(x){ return x.rawScore > 0; });

    scored.sort(function(a, b){ return b.score - a.score; });

    for(var i = 0; i < scored.length; i++){
      try{
        var r = scored[i].intent.handler(lower);
        if(r) return r;
      }catch(e){ console.warn('AI intent fail:', scored[i].intent.id, e); }
    }

    return buildFallback(raw);
  }

  function buildFallback(raw){
    return '🤔 ما فهمت **"' + raw + '"** تماماً.\n\n' +
      '💡 **جرّب تسألني:**\n\n' +
      '📝 "كم مهمة عندي؟"\n' +
      '⏳ "متى امتحاني القادم؟"\n' +
      '📚 "شو موادي؟"\n' +
      '💰 "كم رصيدي؟"\n' +
      '🎓 "شو أسجل الترم الجاي؟"\n' +
      '🧠 "شنو أدرس الحين؟"\n\n' +
      '🔍 أو اكتب **"ساعدني"** للقائمة الكاملة.';
  }

  var SUGG = [
    'كم مهمة عندي؟','متى امتحاني القادم؟','شو موادي؟','كم معدلي؟',
    'كم رصيدي؟','شو أسجل الترم الجاي؟','كم باقيلي للتخرج؟','شنو أدرس الحين؟',
    'ملخص مساحتي','افتح المهام','افتح الميزانية','ساعدني'
  ];

  function pickRandom(a, n){
    var c = a.slice(), o = [];
    for(var i = 0; i < n && c.length; i++){
      o.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
    }
    return o;
  }

  function toggleAI(){
    var p = document.getElementById('aiPanel'); if(!p) return;
    var open = !p.classList.contains('show');
    p.classList.toggle('show');
    if(open){
      var fm = document.getElementById('fabMenu'); if(fm) fm.classList.remove('show');
      var fmm = document.getElementById('fabMain'); if(fmm) fmm.classList.remove('active');
      var ai = document.getElementById('aiFab'); if(ai) ai.classList.remove('hidden');
      var m = document.getElementById('aiMessages');
      if(m && !m.children.length) initAI();
    }
  }

  function initAI(){
    var s = document.getElementById('aiSuggestions'); if(!s) return;
    var picks = pickRandom(SUGG, 4);
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
    var sp = space();
    var name = (sp.profile && sp.profile.name) || '';
    var intro = (name ? '👋 أهلاً ' + name.split(' ')[0] + '! ' : '👋 أهلاً! ') +
      'أنا مساعدك 🤖\n\n' +
      '✨ **أعرف كل شي عن مساحتك:**\n' +
      '• بياناتك (مهام، امتحانات، معدل، ميزانية)\n' +
      '• خطتك الدراسية وموادك\n' +
      '• روابط جامعتك\n\n' +
      '💡 **جرّب تسألني:**\n' +
      '• "كم مهمة عندي؟"\n' +
      '• "شو أسجل الترم الجاي؟"\n' +
      '• "شنو أدرس الحين؟"\n' +
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
      var resp;
      try{ resp = processQuery(q); }
      catch(e){ console.error(e); resp = '⚠️ صار خطأ، جرب مرة ثانية.'; }
      addAIMessage('bot', resp);
    }, 400);
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
  window.bindAIEvents = bindAIEvents;
  window.aiRespond = processQuery;

  window._aiV3 = {
    process: processQuery,
    norm: norm,
    stem: stem,
    classify: function(t){
      var lower = norm(t);
      return INTENTS.map(function(it){
        return { id: it.id, score: scoreIntent(it, lower) + (it.priority||5)*30, rawScore: scoreIntent(it, lower) };
      }).filter(function(x){ return x.rawScore > 0; })
        .sort(function(a,b){ return b.score - a.score; });
    },
    resetCtx: function(){ try{ sessionStorage.removeItem(CTX); }catch(e){} },
    _intents: INTENTS
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(bindAIEvents, 200); });
  } else {
    setTimeout(bindAIEvents, 200);
  }
  console.log('🧠 AI v3.1 loaded — ' + INTENTS.length + ' intents (with code normalization)');
})();