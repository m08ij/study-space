/* ============================================================
   🤖 ai-assistant-plus.js — تحسينات AI Assistant
   - ذاكرة محادثة (سياق آخر 6 رسائل)
   - intents جديدة (متطلب مادة، كود مادة، تقدم، ترم جاي)
   - lookup بالكود
   - اقتراحات ذكية بناءً على سلوكك
   ============================================================ */
(function(){
  'use strict';

  var MEMORY_KEY = 'ai_chat_memory';
  var MAX_MEMORY = 20;

  function getSpace(){ return window.space || {profile:{},courses:[],tasks:[],exams:[]}; }
  function toast(m,t,d){ if(typeof window.toast === 'function') window.toast(m,t||'info',d||2500); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
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

  /* ============ الذاكرة ============ */
  function loadMemory(){
    try{ var m = JSON.parse(sessionStorage.getItem(MEMORY_KEY) || '[]'); return Array.isArray(m) ? m : []; }
    catch(e){ return []; }
  }
  function saveMemory(m){
    try{ sessionStorage.setItem(MEMORY_KEY, JSON.stringify(m.slice(-MAX_MEMORY))); }catch(e){}
  }
  function pushMemory(role, text){
    var m = loadMemory();
    m.push({role: role, text: text, ts: Date.now()});
    saveMemory(m);
  }
  function getLastUserQuery(){
    var m = loadMemory();
    for(var i = m.length - 2; i >= 0; i--){
      if(m[i].role === 'user') return m[i].text;
    }
    return '';
  }

  /* ============ Intents جديدة ============ */
  // 1. البحث بالكود: "ايش مادة 110408220؟" أو "408220"
  function tryCourseByCode(lower){
    var codeMatch = lower.match(/\b(\d{6,10})\b/);
    if(!codeMatch) return null;
    var code = codeMatch[1];
    var DB = window.COURSES_DB || {};
    var found = null;
    Object.keys(DB).forEach(function(k){
      if(DB[k].code === code) found = {name: k, info: DB[k]};
    });
    if(!found) return null;
    var t = (window.COURSE_TYPES && window.COURSE_TYPES[found.info.t]) || {label:'مادة', icon:'📘'};
    var msg = t.icon + ' **' + found.name + '**\n\n';
    msg += '📌 الكود: `' + found.info.code + '`\n';
    msg += '⏱️ الساعات: ' + found.info.h + '\n';
    msg += '🏷️ النوع: ' + t.label + '\n';
    if(found.info.pre && found.info.pre.length){
      msg += '🔒 المتطلب السابق: ' + found.info.pre.join('، ') + '\n';
    } else {
      msg += '🔓 لا يوجد متطلب سابق\n';
    }
    if(found.info.d) msg += '\n📖 **الوصف:**\n' + found.info.d;
    return msg;
  }

  // 2. "شنو متطلب مادة X" / "ايش يحتاج قبل X"
  function tryPrereqQuery(lower){
    var hasPre = /\b(متطلب|متطلبات|يحتاج|قبل|prerequisite|prereq)\b/.test(lower);
    if(!hasPre) return null;
    var DB = window.COURSES_DB || {};
    var found = null;
    Object.keys(DB).forEach(function(k){
      var kNorm = norm(k);
      if(lower.indexOf(kNorm) > -1 || kNorm.indexOf(lower) > -1){
        if(!found || k.length > found.length) found = k;
      }
    });
    if(!found) return null;
    var info = DB[found];
    var msg = '🔒 **متطلبات ' + found + ':**\n\n';
    if(!info.pre || !info.pre.length){
      msg += '✅ لا يوجد متطلبات سابقة — تقدر تسجلها بأي وقت.';
    } else {
      info.pre.forEach(function(p){
        var completed = window.getCompletedCourses ? window.getCompletedCourses() : {};
        var status = completed[p] ? '✅ خلّصتها' : '⏳ لسا';
        msg += status + ' — ' + p + '\n';
      });
    }
    return msg;
  }

  // 3. "شنو أسجل الترم الجاي؟" / "الترم القادم"
  function tryPlanSuggestion(lower){
    var k = /\b(الترم الجاي|الترم القادم|الفصل الجاي|الفصل القادم|شنو اسجل|وش اسجل|اسجل ايش|next semester|plan)\b/.test(lower);
    if(!k) return null;
    if(typeof window.suggestNextSemester !== 'function') return null;
    var result = window.suggestNextSemester();
    if(!result || !result.suggestions.length) return null;
    var semNames = ['','الفصل الأول','الفصل الثاني','الفصل الثالث','الفصل الرابع','الفصل الخامس','الفصل السادس','الفصل السابع','الفصل الثامن','الفصل التاسع'];
    var msg = '🎓 **اقتراح ' + (semNames[result.semester] || 'الفصل ' + result.semester) + ':**\n\n';
    result.suggestions.forEach(function(s){
      var ready = s.ready ? '✅' : '⚠️';
      msg += ready + ' ' + s.name + ' (' + s.info.h + ' ساعات)\n';
    });
    msg += '\n📊 **المجموع الجاهز:** ' + result.totalHours + ' ساعة';
    if(result.suggestions.some(function(s){ return !s.ready; })){
      msg += '\n\n⚠️ مواد تحتاج متطلبات سابقة مو مخلّصة.';
    }
    msg += '\n\n💡 افتح "الخطة والمواد" → "محاكي الترم الجاي" للتفاصيل.';
    return msg;
  }

  // 4. "تقدمي" / "كم باقي للتخرج"
  function tryProgressQuery(lower){
    var k = /\b(تقدم|تقدمي|باقي|كم باقي|للتخرج|اتخرج|graduat|progress)\b/.test(lower);
    if(!k) return null;
    if(typeof window.analyzeGraduationGap !== 'function') return null;
    var gap = window.analyzeGraduationGap();
    var pct = Math.round((gap.progress.total / gap.totalRequired.total) * 100);
    var msg = '📊 **تقدمك نحو التخرج:**\n\n';
    msg += '🎯 **' + gap.progress.total + ' / ' + gap.totalRequired.total + '** ساعة (' + pct + '%)\n';
    msg += '⏳ باقي **' + gap.remaining.total + '** ساعة\n\n';
    msg += '**التفصيل:**\n';
    msg += '• جامعة إجبارية: ' + gap.progress['uni-c'] + '/' + gap.totalRequired['uni-c'] + '\n';
    msg += '• جامعة اختيارية: ' + gap.progress['uni-e'] + '/' + gap.totalRequired['uni-e'] + '\n';
    msg += '• كلية: ' + gap.progress.faculty + '/' + gap.totalRequired.faculty + '\n';
    msg += '• تخصص إجباري: ' + gap.progress['major-c'] + '/' + gap.totalRequired['major-c'] + '\n';
    msg += '• تخصص اختياري: ' + gap.progress['major-e'] + '/' + gap.totalRequired['major-e'];
    return msg;
  }

  // 5. "قارن بين X و Y" / "أي مادة أسهل"
  function tryComparison(lower){
    if(!/\b(قارن|افضل|اسهل|اصعب|افضّل|مقارنه|vs)\b/.test(lower)) return null;
    var DB = window.COURSES_DB || {};
    var found = [];
    Object.keys(DB).forEach(function(k){
      var kNorm = norm(k);
      if(lower.indexOf(kNorm) > -1) found.push(k);
    });
    if(found.length < 2) return null;
    var a = found[0], b = found[1];
    var ia = DB[a], ib = DB[b];
    var msg = '🔍 **مقارنة:**\n\n';
    msg += '📘 **' + a + '**\n';
    msg += '  • ' + ia.h + ' ساعات · ' + (ia.pre.length ? 'متطلب: ' + ia.pre.join('، ') : 'لا متطلب' ) + '\n';
    msg += '  • ' + ia.d.slice(0, 120) + '...\n\n';
    msg += '📗 **' + b + '**\n';
    msg += '  • ' + ib.h + ' ساعات · ' + (ib.pre.length ? 'متطلب: ' + ib.pre.join('، ') : 'لا متطلب') + '\n';
    msg += '  • ' + ib.d.slice(0, 120) + '...';
    return msg;
  }

  // 6. "شنو أدرس الحين" (اقتراح ذكي حسب المهام القريبة)
  function trySmartStudy(lower){
    if(!/\b(شنو ادرس|ايش ادرس|ادرس ايش|استعد|اراجع|مراجعه|study now|ماذا ادرس)\b/.test(lower)) return null;
    var sp = getSpace();
    var today = new Date().toISOString().slice(0,10);
    var soonExams = (sp.exams || [])
      .filter(function(e){ return e.date >= today; })
      .sort(function(a,b){ return a.date.localeCompare(b.date); })
      .slice(0, 1);
    var soonTasks = (sp.tasks || [])
      .filter(function(t){ return !t.done && t.due && t.due >= today; })
      .sort(function(a,b){ return a.due.localeCompare(b.due); })
      .slice(0, 3);

    if(!soonExams.length && !soonTasks.length){
      return '🌟 **ما عندك شي قريب!**\n\n💡 اقتراح: راجع مادة من الترم الماضي أو اشتغل على مشروع تخرج.';
    }
    var msg = '🧠 **اقتراحي للدراسة الآن:**\n\n';
    if(soonExams.length){
      var e = soonExams[0];
      var days = Math.ceil((new Date(e.date) - new Date(today)) / 86400000);
      msg += '📝 **أولوية قصوى:**\n' + e.name + ' (بعد ' + days + ' يوم)\n\n';
    }
    if(soonTasks.length){
      msg += '📌 **مهام قريبة:**\n';
      soonTasks.forEach(function(t){
        var d = Math.ceil((new Date(t.due) - new Date(today)) / 86400000);
        msg += '• ' + t.title + ' (' + (d === 0 ? 'اليوم' : d === 1 ? 'غدًا' : 'بعد ' + d + ' أيام') + ')\n';
      });
    }
    msg += '\n💡 **نصيحة:** ابدأ بأصعب شي وأنت مرتاح، وبومودورو 25 دقيقة.';
    return msg;
  }

  // 7. "كيف حال دراستي" — تحليل عام
  function tryStudyStatus(lower){
    if(!/\b(كيف دراستي|حال دراستي|وضعي الدراسي|كيف اموري)\b/.test(lower)) return null;
    var sp = getSpace();
    var pending = (sp.tasks || []).filter(function(t){ return !t.done; });
    var overdue = pending.filter(function(t){ return t.due && t.due < new Date().toISOString().slice(0,10); });
    var msg = '📊 **وضعك الدراسي:**\n\n';
    msg += '📚 المواد المسجلة: **' + (sp.courses || []).length + '**\n';
    msg += '📝 مهام متبقية: **' + pending.length + '**';
    if(overdue.length) msg += ' (⚠️ ' + overdue.length + ' متأخرة)';
    msg += '\n⏳ امتحانات قادمة: **' + (sp.exams || []).filter(function(e){ return e.date >= new Date().toISOString().slice(0,10); }).length + '**\n';
    var S = window.S || {get:function(k,d){return d;}};
    msg += '⏱️ جلسات بومودورو: **' + (S.get('pomoSessions', 0) || 0) + '**\n';
    var log = S.get('studyLog', {});
    var week = 0;
    for(var i = 0; i < 7; i++){
      var d = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
      week += log[d] || 0;
    }
    msg += '📈 ساعات آخر أسبوع: **' + (week / 60).toFixed(1) + '** ساعة\n\n';
    if(overdue.length > 2) msg += '⚠️ عندك تراكم بالمهام، ابدأ بالأسهل عشان تتحفز.';
    else if(week > 300) msg += '🔥 أداء ممتاز! استمر.';
    else msg += '💪 جيد، بس حاول تزيد جلسات التركيز.';
    return msg;
  }

  /* ============ Hook على aiRespond الأصلي ============ */
  function install(){
    if(typeof window.aiRespond !== 'function'){ setTimeout(install, 300); return; }
    if(window._aiPlusInstalled) return;
    window._aiPlusInstalled = true;

    var original = window.aiRespond;
    window.aiRespond = function(q){
      var raw = String(q || '').trim();
      var lower = norm(raw);

      pushMemory('user', raw);

      var r;
      r = tryPlanSuggestion(lower);   if(r) return finish(r);
      r = tryProgressQuery(lower);    if(r) return finish(r);
      r = tryPrereqQuery(lower);      if(r) return finish(r);
      r = tryCourseByCode(lower);     if(r) return finish(r);
      r = trySmartStudy(lower);       if(r) return finish(r);
      r = tryStudyStatus(lower);      if(r) return finish(r);
      r = tryComparison(lower);       if(r) return finish(r);

      // fallback للأصلي
      var orig = original.apply(this, arguments);
      return finish(orig);
    };

    function finish(response){
      pushMemory('bot', response);
      return response;
    }

    // تحديث الاقتراحات لتشمل الجديد
    setTimeout(injectNewSuggestions, 800);
  }

  function injectNewSuggestions(){
    var SUGG = [
      'شنو أسجل الترم الجاي؟','تقدمي للتخرج','متطلبات مشروع تخرج (1)',
      'ايش مادة 110408220؟','شنو أدرس الحين؟','كيف دراستي؟','قارن بين شبكات حاسوب وأمن الحاسوب'
    ];
    if(typeof window.SUGG_POOL === 'object' && Array.isArray(window.SUGG_POOL)){
      SUGG.forEach(function(s){ if(window.SUGG_POOL.indexOf(s) === -1) window.SUGG_POOL.push(s); });
    }
  }

  /* ============ زر "مسح الذاكرة" ============ */
  function injectClearMemoryBtn(){
    var header = document.querySelector('.ai-header');
    if(!header || header.querySelector('.ai-clear-mem')) return;
    var btn = document.createElement('button');
    btn.className = 'ai-close ai-clear-mem';
    btn.title = 'مسح ذاكرة المحادثة';
    btn.textContent = '🧹';
    btn.style.fontSize = '1rem';
    btn.style.marginRight = '6px';
    btn.addEventListener('click', function(){
      try{ sessionStorage.removeItem(MEMORY_KEY); }catch(e){}
      var msgs = document.getElementById('aiMessages');
      if(msgs){ msgs.innerHTML = ''; if(typeof window.initAI === 'function') window.initAI(); }
      toast('🧹 مسحت الذاكرة', 'success');
    });
    var closeBtn = header.querySelector('.ai-close');
    if(closeBtn) header.insertBefore(btn, closeBtn);
    else header.appendChild(btn);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ install(); setTimeout(injectClearMemoryBtn, 900); });
  else { install(); setTimeout(injectClearMemoryBtn, 900); }
  console.log('🤖 AI Assistant Plus loaded');
})();