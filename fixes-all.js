/* ============================================================
   fixes-all.js v3 — إصلاحات شاملة + منع double-binding
   - يحتوي إصلاحات الدفعة 1 (guarded)
   - يمنع التكرار في bindAllEvents / safeBindAllEvents
   - يوسم العناصر المُربَطة مسبقًا
   ============================================================ */
(function(){
  'use strict';
  if(window._fixesAllInstalledV3) return;
  window._fixesAllInstalledV3 = true;

  /* ============================================================
     أدوات مساعدة
     ============================================================ */
  function toast(m, t, d){
    if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500);
  }
  function getSpace(){ return window.space || {}; }
  function saveSpace(){
    if(typeof window.saveSpace === 'function') window.saveSpace();
    else if(window.S && window.S.set) window.S.set('space', window.space);
  }
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function uid(){
    return window.uid ? window.uid() :
      Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  }
  function localToday(){
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  /* ============================================================
     0) وسم العناصر المُربَطة بواسطة bindAllEvents الأصلي
     ============================================================ */
  function markElementsBoundByOriginal(){
    var selectors = [
      '.fab-action',
      '[data-tf]', '[data-bt]', '[data-gc-tab]', '[data-plan-tab]',
      '.nav-item', '.chip[data-filter]', '[data-cd-year]', '[data-goto]'
    ];
    selectors.forEach(function(sel){
      try{
        document.querySelectorAll(sel).forEach(function(el){
          el._boundByOriginal = true;
        });
      }catch(e){}
    });
  }

  /* ============================================================
     0.1) تغليف bindAllEvents لمنع التكرار
     ============================================================ */
  function wrapBindAll(){
    if(window._bindAllWrapped) return;
    if(typeof window.bindAllEvents !== 'function'){
      setTimeout(wrapBindAll, 20);
      return;
    }
    window._bindAllWrapped = true;

    var orig = window.bindAllEvents;
    window.bindAllEvents = function(){
      if(window._bindAllRan){
        /* مُنع التشغيل الثاني */
        return;
      }
      window._bindAllRan = true;
      try{
        var r = orig.apply(this, arguments);
        markElementsBoundByOriginal();
        window._bindAllSucceeded = true;
        return r;
      }catch(e){
        console.warn('bindAllEvents threw:', e);
        window._bindAllSucceeded = false;
      }
    };
  }

  /* ============================================================
     1) الدوال الناقصة
     ============================================================ */

  window.clearTimetable = function(){
    if(!window.space){ toast('البيانات غير محمّلة', 'warn'); return; }
    if(!Object.keys(window.space.timetable || {}).length){
      toast('الجدول فاضي أصلاً', 'info'); return;
    }
    var doClear = function(){
      window.space.timetable = {};
      saveSpace();
      if(typeof window.renderTimetable === 'function') window.renderTimetable();
      if(typeof window.renderDashboard === 'function') window.renderDashboard();
      toast('🗑 مُسح الجدول', 'success');
    };
    if(typeof window.customConfirm === 'function') window.customConfirm('مسح كل الجدول؟', doClear);
    else if(confirm('مسح كل الجدول؟')) doClear();
  };

  window.loadExampleTimetable = function(){
    if(!window.space) return;
    window.space.timetable = {
      'Sun-08:00': { name: 'تفاضل وتكامل (1)', room: '101', instructor: '' },
      'Sun-09:00': { name: 'فيزياء عامة (1)',  room: '102', instructor: '' },
      'Mon-08:00': { name: 'برمجة الحاسوب',    room: 'Lab 1', instructor: '' },
      'Mon-10:00': { name: 'رسم هندسي يدوي',  room: '203', instructor: '' },
      'Tue-09:00': { name: 'مهارات التواصل باللغة العربية', room: '105', instructor: '' },
      'Wed-11:00': { name: 'اساسيات الكيمياء العامة', room: 'Lab 3', instructor: '' },
      'Thu-08:00': { name: 'مهارات التواصل باللغة الانجليزية', room: '106', instructor: '' }
    };
    saveSpace();
    if(typeof window.renderTimetable === 'function') window.renderTimetable();
    if(typeof window.renderDashboard === 'function') window.renderDashboard();
    toast('✅ تم تحميل جدول تجريبي', 'success', 2500);
  };

  window.autoFillTimetable = function(){
    if(!window.space || !(window.space.courses || []).length){
      toast('أضف موادي أولاً', 'warn', 2500); return;
    }
    if(typeof window.openSmartTimetable === 'function'){
      window.openSmartTimetable();
    } else {
      toast('استخدم "✨ إضافة دفعة" لإدخال الجدول', 'info', 3500);
    }
  };

  window.printTimetable = function(){
    var tt = document.getElementById('timetableTable');
    if(!tt){ toast('الجدول غير موجود', 'warn'); return; }
    var w = window.open('', '_blank', 'width=1000,height=700');
    if(!w){ toast('امنع المتصفح من حجب النوافذ', 'warn', 3000); return; }
    w.document.write(
      '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">' +
      '<title>الجدول الأسبوعي</title>' +
      '<style>' +
      'body{font-family:Tahoma,sans-serif;padding:20px;direction:rtl;background:#fff;color:#000}' +
      'h2{text-align:center;margin-bottom:20px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}' +
      'th,td{border:1px solid #999;padding:8px 4px;text-align:center;vertical-align:middle}' +
      'th{background:#e8e8e8;font-weight:bold}' +
      '.time-col{background:#f5f5f5;font-weight:bold;font-size:11px}' +
      '.class-block{background:#e0f7fa;padding:5px;border-radius:4px;text-align:right}' +
      '.name{font-weight:bold;color:#00695c;font-size:11px;display:block}' +
      '.room{color:#555;font-size:10px;margin-top:2px;display:block}' +
      '.cell-empty{color:#ccc}' +
      '@media print{@page{size:A4 landscape;margin:8mm}}' +
      '</style></head><body><h2>📅 الجدول الأسبوعي</h2>' +
      tt.outerHTML +
      '</body></html>'
    );
    w.document.close();
    setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 400);
  };

  window.addClassSlot = function(key){
    if(typeof window.openSmartTimetable === 'function'){
      window.openSmartTimetable();
    } else {
      toast('محرر الجدول قيد التحميل...', 'info', 2000);
      var s = document.createElement('script');
      s.src = 'smart-timetable-entry.js';
      s.onload = function(){
        setTimeout(function(){
          if(window.openSmartTimetable) window.openSmartTimetable();
        }, 200);
      };
      document.head.appendChild(s);
    }
  };

  window.editClassSlot = function(key){
    if(!window.space || !window.space.timetable) return;
    var cls = window.space.timetable[key];
    if(!cls) return;
    if(typeof window.showModal !== 'function'){
      toast('لا يمكن فتح المحرر الآن', 'warn'); return;
    }
    window.showModal('تعديل محاضرة', [
      { key: 'name', label: 'اسم المادة' },
      { key: 'room', label: 'القاعة' },
      { key: 'instructor', label: 'الدكتور' }
    ], {
      name: cls.name || '',
      room: cls.room || '',
      instructor: cls.instructor || ''
    }, function(data){
      if(!data.name){ toast('أدخل اسم المادة', 'warn'); return false; }
      window.space.timetable[key] = {
        name: data.name,
        room: data.room || '',
        instructor: data.instructor || ''
      };
      saveSpace();
      if(typeof window.renderTimetable === 'function') window.renderTimetable();
      if(typeof window.renderDashboard === 'function') window.renderDashboard();
      toast('✅ تم التعديل', 'success');
      return true;
    }, function(){
      var doDel = function(){
        delete window.space.timetable[key];
        saveSpace();
        if(typeof window.renderTimetable === 'function') window.renderTimetable();
        if(typeof window.renderDashboard === 'function') window.renderDashboard();
        toast('🗑 حُذفت المحاضرة', 'success');
      };
      if(typeof window.customConfirm === 'function') window.customConfirm('حذف هذه المحاضرة؟', doDel);
      else if(confirm('حذف هذه المحاضرة؟')) doDel();
    });
  };

  /* ============================================================
     2) patchedProgress
     ============================================================ */
  function patchedProgress(){
    if(typeof window.analyzeGraduationGap !== 'function'){
      return '🎓 ما أقدر أحسب تقدمك حالياً. تأكد من إضافة موادك في "موادي".';
    }
    var g = window.analyzeGraduationGap();
    var pr = g.progress || {};
    var tr = g.totalRequired || {};
    var totalDone = pr.total || 0;
    var totalReq = tr.total || 160;
    var pct = totalReq > 0 ? Math.round((totalDone / totalReq) * 100) : 0;

    function row(label, k){
      var done = pr[k] || 0;
      var req = tr[k] || 0;
      return label + ': ' + done + '/' + req + '\n';
    }

    return '📊 **تقدمك للتخرج:**\n\n' +
      '🎯 **' + totalDone + ' / ' + totalReq + '** ساعة (' + pct + '%)\n' +
      '⏳ باقي **' + (g.remaining ? g.remaining.total || 0 : 0) + '** ساعة\n\n' +
      '**التفصيل:**\n' +
      row('🏛️ جامعة إجبارية', 'uni-c') +
      row('🎨 جامعة اختيارية', 'uni-e') +
      row('🏫 كلية', 'faculty') +
      row('🎯 تخصص إجباري', 'major-c') +
      row('⭐ تخصص اختياري', 'major-e');
  }

  /* ============================================================
     3) patchedCourseInfo
     ============================================================ */
  function patchedCourseInfo(lower){
    if(/^(وصف|معلومات|تفاصيل|شرح)\s*$/.test(lower)){
      return '📚 **أي مادة تريد وصفها؟**\n\n' +
        'اكتب مثلاً:\n' +
        '• "وصف شبكات حاسوب"\n' +
        '• "كود 110408450"\n' +
        '• "تفاصيل تفاضل وتكامل (1)"\n\n' +
        '💡 أو اكتب "موادي" لعرض قائمتك.';
    }
    return null;
  }

  /* ============================================================
     4) patchedTasks
     ============================================================ */
  function patchedTasks(){
    var sp = getSpace();
    var tasks = sp.tasks || [];
    if(!tasks.length) return '📝 **ما عندك مهام** حالياً!\n\n➕ اضغط زر "+" أو Alt+T';

    var pending = tasks.filter(function(t){ return !t.done; });
    if(!pending.length) return '🎉 **مبروك!** خلّصت كل مهامك (' + tasks.length + ' مهمة).';

    var today = localToday();
    var overdue = pending.filter(function(t){ return t.due && t.due < today; });
    var dueToday = pending.filter(function(t){ return t.due === today; });
    var upcoming = pending.filter(function(t){
      if(!t.due) return false;
      var d = Math.ceil((new Date(t.due) - new Date(today)) / 86400000);
      return d > 0 && d <= 7;
    });

    var msg = '📝 **مهامك** (' + pending.length + ' متبقية من ' + tasks.length + '):\n';

    if(overdue.length){
      msg += '\n🔴 **متأخرة (' + overdue.length + '):**\n';
      overdue.slice(0, 3).forEach(function(t){
        var days = Math.abs(Math.ceil((new Date(t.due) - new Date(today)) / 86400000));
        msg += '• ' + t.title + ' — منذ ' + days + ' يوم\n';
      });
    }
    if(dueToday.length){
      msg += '\n🟡 **اليوم (' + dueToday.length + '):**\n';
      dueToday.slice(0, 3).forEach(function(t){ msg += '• ' + t.title + '\n'; });
    }
    if(upcoming.length && !dueToday.length){
      msg += '\n🟢 **هذا الأسبوع:**\n';
      upcoming.slice(0, 4).forEach(function(t){
        var d = Math.ceil((new Date(t.due) - new Date(today)) / 86400000);
        msg += '• ' + t.title + ' — بعد ' + d + ' أيام\n';
      });
    }
    if(!overdue.length && !dueToday.length && !upcoming.length){
      msg += '\n✅ ما عندك شي عاجل! 😎';
    }
    return msg;
  }

  /* ============================================================
     5) patchedMatchCourse
     ============================================================ */
  function patchedMatchCourse(rowText, DB){
    DB = DB || window.COURSES_DB || {};
    var keys = Object.keys(DB);
    if(!keys.length) return null;

    var codeMatch = rowText.match(/\b(0?\d{6,10})\b/);
    if(codeMatch){
      if(typeof window.findCourseByCode === 'function'){
        var r = window.findCourseByCode(codeMatch[1]);
        if(r && r.name) return r.name;
      }
      var clean = codeMatch[1].replace(/^0+/, '');
      for(var i = 0; i < keys.length; i++){
        if(String(DB[keys[i]].code).replace(/^0+/, '') === clean) return keys[i];
      }
    }

    var best = null, bestLen = 0;
    for(var j = 0; j < keys.length; j++){
      var key = keys[j];
      if(rowText.indexOf(key) > -1 && key.length > bestLen){
        best = key; bestLen = key.length;
      }
    }
    if(best) return best;

    for(var k = 0; k < keys.length; k++){
      var k2 = keys[k];
      if(k2.length < 12) continue;
      var probe = k2.slice(0, k2.length - 3);
      if(probe.length >= 10 && rowText.indexOf(probe) > -1 && k2.length > bestLen){
        best = k2; bestLen = k2.length;
      }
    }
    return best;
  }

  /* ============================================================
     6) checkSmartReminders — محمي إذا كان critical-fixes مُثبّتًا
     ============================================================ */
  if(!window._criticalFixesApplied){
    window.checkSmartReminders = function(){
      if(!window.space || !window.space.tasks) return;
      var today = localToday();
      var hour = new Date().getHours();
      if(hour < 8 || hour > 23) return;

      var firedKey = 'ss_smart_reminders_' + today;
      var fired = {};
      try{
        if(window.S && window.S.get) fired = window.S.get(firedKey, {}) || {};
      }catch(e){}

      var sp = window.space;
      var dueToday = (sp.tasks || []).filter(function(t){ return !t.done && t.due === today; });
      var overdue = (sp.tasks || []).filter(function(t){ return !t.done && t.due && t.due < today; });
      var upcomingExams = (sp.exams || []).filter(function(e){
        if(!e.date) return false;
        var days = Math.ceil((new Date(e.date) - new Date()) / 86400000);
        return days >= 0 && days <= 3;
      });

      var reminders = [];
      if(dueToday.length){
        reminders.push({
          tag: 'due-today',
          t: '📌 ' + dueToday.length + ' مهمة مستحقة اليوم!',
          b: dueToday.slice(0, 3).map(function(x){ return x.title; }).join(' · ')
        });
      }
      if(overdue.length){
        reminders.push({
          tag: 'overdue',
          t: '⚠️ ' + overdue.length + ' مهمة متأخرة!',
          b: overdue.slice(0, 3).map(function(x){ return x.title; }).join(' · ')
        });
      }
      upcomingExams.forEach(function(e){
        var days = Math.ceil((new Date(e.date) - new Date()) / 86400000);
        var when = days === 0 ? 'اليوم!' : days === 1 ? 'غدًا!' : 'بعد ' + days + ' أيام';
        reminders.push({
          tag: 'exam-' + e.date,
          t: '⏳ امتحان ' + when,
          b: (e.name || '') + (e.time ? ' — الساعة ' + e.time : '')
        });
      });

      var anyNew = false;
      reminders.forEach(function(r, i){
        if(fired[r.tag]) return;
        fired[r.tag] = true;
        anyNew = true;
        setTimeout(function(){ toast(r.t, 'warn', 5000); }, 1500 + i * 2500);
        if(typeof window.showNotif === 'function'){
          setTimeout(function(){
            window.showNotif(r.t, r.b, { tag: 'ss-' + r.tag + '-' + today });
          }, 1500 + i * 2500);
        }
      });

      if(anyNew && window.S && window.S.set){
        try{ window.S.set(firedKey, fired); }catch(e){}
      }
    };
  }

  /* ============================================================
     7) installAIFixes
     ============================================================ */
  function smartSplit(text){
    var raw = String(text || '').trim();
    if(raw.split(/\s+/).length < 5) return [raw];

    var q = (raw.match(/[؟?]/g) || []).length;
    if(q > 1) return [raw];

    var starters = /^(شو|كم|متى|كيف|وين|ليش|هل|اعرض|افتح|روح|وصف|معلومات|تفاصيل)\s/;
    if(!starters.test(raw)) return [raw];

    var parts = raw.split(/\s+(?:و|ثم)\s+/);
    if(parts.length < 2) return [raw];

    var valid = true;
    for(var i = 1; i < parts.length; i++){
      if(!starters.test(parts[i].trim())){ valid = false; break; }
    }
    if(!valid) return [raw];

    for(var j = 0; j < parts.length; j++){
      if(parts[j].trim().split(/\s+/).length < 2){ return [raw]; }
    }
    return parts;
  }

  function installAIFixes(){
    if(!window._aiV3 || typeof window.aiRespond !== 'function') return false;
    if(window._aiFixesApplied) return true;
    window._aiFixesApplied = true;

    /* patch intent handlers */
    if(window._aiV3._intents){
      window._aiV3._intents.forEach(function(intent){
        if(intent.id === 'progress') intent.handler = patchedProgress;
        else if(intent.id === 'myTasks') intent.handler = patchedTasks;
        else if(intent.id === 'courseInfo'){
          var orig = intent.handler;
          intent.handler = function(lower){
            var special = patchedCourseInfo(lower);
            if(special) return special;
            return orig.call(this, lower);
          };
        }
      });
    }

    /* patch aiRespond for smart split */
    var origProcess = window.aiRespond;
    window.aiRespond = function(q){
      var raw = String(q || '').trim();
      if(!raw) return '🤔 اكتب شي عشان أساعدك!';

      var parts = smartSplit(raw);
      if(parts.length > 1){
        var results = [];
        parts.forEach(function(p){
          try{
            var r = origProcess.call(this, p);
            if(r && r.indexOf('ما فهمت') === -1) results.push(r);
          }catch(e){}
        });
        if(results.length){
          return results.join('\n\n━━━━━━━━━━━━━━━\n\n');
        }
      }
      return origProcess.call(this, raw);
    };

    return true;
  }

  /* ============================================================
     8) الخطة حسب النوع
     ============================================================ */
  function renderPlanByType(){
    var container = document.getElementById('semesters');
    if(!container) return;

    var DB = window.COURSES_DB || {};
    var TYPES = window.COURSE_TYPES || {};
    var SEMS = window.SEMESTERS || [];

    var seen = {};
    var groups = {};
    var typeOrder = ['uni-c', 'uni-e', 'faculty', 'major-c', 'major-e', 'remedial'];

    SEMS.forEach(function(sem){
      (sem.courses || []).forEach(function(c){
        if(seen[c.n]) return;
        seen[c.n] = true;
        var info = DB[c.n];
        var type = info ? info.t : 'major-c';
        if(typeOrder.indexOf(type) === -1) type = 'major-c';
        if(!groups[type]) groups[type] = [];
        groups[type].push({
          name: c.n, h: c.h, code: c.code,
          year: sem.year, semName: sem.name, info: info
        });
      });
    });

    var grandTotal = 0;
    typeOrder.forEach(function(t){
      (groups[t] || []).forEach(function(c){ grandTotal += c.h; });
    });

    var html = '<div class="card" style="margin-bottom:16px;padding:16px 18px;background:var(--grad-soft);border:1px solid var(--glow)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
        '<div style="font-weight:800;font-size:.95rem">📖 خطة هندسة الحاسوب — حسب نوع المتطلب</div>' +
        '<div style="font-size:.82rem;color:var(--muted)">المجموع: <b style="color:var(--cyan)">' + grandTotal + ' ساعة</b></div>' +
      '</div>' +
    '</div>';

    typeOrder.forEach(function(t){
      var list = groups[t];
      if(!list || !list.length) return;

      var tInfo = TYPES[t] || { label: 'أخرى', icon: '📘', color: 'var(--cyan)' };
      var totalH = list.reduce(function(a,c){ return a + c.h; }, 0);

      html += '<div class="card plan-type-card" data-plan-type="' + t + '" style="margin-bottom:12px">' +
        '<div class="plan-type-head" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:4px 0">' +
          '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">' +
            '<span style="font-size:1.4rem">' + tInfo.icon + '</span>' +
            '<div style="min-width:0">' +
              '<div style="font-weight:800;font-size:.95rem;color:' + tInfo.color + '">' + tInfo.label + '</div>' +
              '<div style="font-size:.7rem;color:var(--muted);margin-top:2px">' + list.length + ' مادة · ' + totalH + ' ساعة</div>' +
            '</div>' +
          '</div>' +
          '<span class="type-arrow" style="transition:transform .3s;color:var(--muted);font-size:.9rem">▼</span>' +
        '</div>' +
        '<div class="plan-type-body" style="max-height:0;overflow:hidden;transition:max-height .4s ease">';

      list.forEach(function(c){
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-top:1px solid var(--border);font-size:.86rem;gap:10px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600">' + esc(c.name) + '</div>' +
            '<div style="font-size:.68rem;color:var(--muted2);margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">' +
              (c.code ? '<span style="font-family:monospace">' + esc(c.code) + '</span>' : '') +
              '<span>سنة ' + c.year + ' · ' + esc(c.semName) + '</span>' +
            '</div>' +
          '</div>' +
          '<span style="color:var(--cyan);font-weight:700;font-size:.8rem;white-space:nowrap">' + c.h + ' س</span>' +
        '</div>';
      });

      html += '</div></div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.plan-type-card').forEach(function(card){
      var head = card.querySelector('.plan-type-head');
      var body = card.querySelector('.plan-type-body');
      var arrow = card.querySelector('.type-arrow');
      head.addEventListener('click', function(){
        var isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
        if(isOpen){
          body.style.maxHeight = '0px';
          if(arrow) arrow.style.transform = '';
        } else {
          body.style.maxHeight = body.scrollHeight + 'px';
          if(arrow) arrow.style.transform = 'rotate(180deg)';
        }
      });
    });

    if(window.planEnhance && typeof window.planEnhance.refreshPlan === 'function'){
      setTimeout(function(){ try{ window.planEnhance.refreshPlan(); }catch(e){} }, 100);
    }
  }

  /* ============================================================
     9) installPlanChips
     ============================================================ */
  function installPlanChips(){
    var planSection = document.getElementById('plan');
    if(!planSection) return false;

    var subs = planSection.querySelectorAll('.subsection[data-plan-sub="plan"]');
    if(!subs.length) return false;

    var controls = subs[0].querySelector('.controls');
    if(!controls) return false;

    if(controls.dataset.typeChipsInstalled) return true;

    controls.querySelectorAll('.chip').forEach(function(c){ c.remove(); });

    var types = [
      { v: 'all',      l: '📚 الكل' },
      { v: 'uni-c',    l: '🏛️ جامعة إجبارية' },
      { v: 'uni-e',    l: '🎨 جامعة اختيارية' },
      { v: 'faculty',  l: '🏫 كلية' },
      { v: 'major-c',  l: '🎯 تخصص إجباري' },
      { v: 'major-e',  l: '⭐ تخصص اختياري' },
      { v: 'remedial', l: '📌 استدراكية' }
    ];

    types.forEach(function(t, i){
      var btn = document.createElement('button');
      btn.className = 'chip' + (i === 0 ? ' active' : '');
      btn.type = 'button';
      btn.dataset.filterType = t.v;
      btn.textContent = t.l;
      btn.addEventListener('click', function(){
        controls.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('active'); });
        btn.classList.add('active');
        var cards = document.querySelectorAll('#semesters .plan-type-card');
        cards.forEach(function(card){
          card.style.display = (t.v === 'all' || card.dataset.planType === t.v) ? '' : 'none';
        });
      });
      controls.appendChild(btn);
    });

    controls.dataset.typeChipsInstalled = '1';
    return true;
  }

  /* ============================================================
     10) touch drag
     ============================================================ */
  function installTouchDrag(){
    var dash = document.getElementById('dashboard');
    if(!dash || dash.dataset.touchDragInstalled) return;
    dash.dataset.touchDragInstalled = '1';

    dash.addEventListener('touchstart', function(e){
      var handle = e.target.closest('.dash-handle');
      if(!handle) return;
      var card = handle.closest('[data-dash-id]');
      if(!card) return;

      var startY = e.touches[0].clientY;
      var startX = e.touches[0].clientX;
      var placeholder = document.createElement('div');
      placeholder.style.cssText = 'height:' + card.offsetHeight + 'px;border:2px dashed var(--cyan);border-radius:12px;margin-bottom:14px';

      var active = false;

      function onMove(ev){
        var t = ev.touches[0];
        var dy = Math.abs(t.clientY - startY);
        var dx = Math.abs(t.clientX - startX);

        if(!active && (dy > 10 || dx > 10)){
          active = true;
          card.parentNode.insertBefore(placeholder, card.nextSibling);
          card.style.opacity = '.5';
          card.style.pointerEvents = 'none';
        }
        if(!active) return;

        var el = document.elementFromPoint(t.clientX, t.clientY);
        if(!el) return;
        var target = el.closest('[data-dash-id]');
        if(!target || target === card) return;

        var rect = target.getBoundingClientRect();
        var mid = rect.top + rect.height / 2;
        if(t.clientY < mid){
          target.parentNode.insertBefore(placeholder, target);
        } else {
          target.parentNode.insertBefore(placeholder, target.nextSibling);
        }
        ev.preventDefault();
      }

      function onEnd(){
        document.removeEventListener('touchmove', onMove, {passive: false});
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);

        if(active && placeholder.parentNode){
          placeholder.parentNode.insertBefore(card, placeholder);
          placeholder.remove();
          card.style.opacity = '';
          card.style.pointerEvents = '';

          var ids = [];
          Array.prototype.forEach.call(dash.children, function(el){
            if(el.dataset && el.dataset.dashId) ids.push(el.dataset.dashId);
          });
          try{ localStorage.setItem('dash_order_v1', JSON.stringify(ids)); }catch(err){}
          toast('💾 حُفظ الترتيب', 'success', 1500);
        } else {
          placeholder.remove();
        }
      }

      document.addEventListener('touchmove', onMove, {passive: false});
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    }, {passive: true});
  }

  /* ============================================================
     11) safeBindAllEvents — مع فحص _boundByOriginal
     ============================================================ */
  function safeBindAllEvents(){
    document.querySelectorAll('[data-tf]').forEach(function(chip){
      if(chip._safeTfBound || chip._boundByOriginal) return;
      chip._safeTfBound = true;
      chip.addEventListener('click', function(){
        if(typeof window.filterTasks === 'function') window.filterTasks(chip.dataset.tf);
      });
    });

    document.querySelectorAll('[data-bt]').forEach(function(tab){
      if(tab._safeBtBound || tab._boundByOriginal) return;
      tab._safeBtBound = true;
      tab.addEventListener('click', function(){
        if(typeof window.filterBudget === 'function') window.filterBudget(tab.dataset.bt);
      });
    });

    document.querySelectorAll('[data-gc-tab]').forEach(function(btn){
      if(btn._safeGcBound || btn._boundByOriginal) return;
      btn._safeGcBound = true;
      btn.addEventListener('click', function(){
        if(typeof window.switchSubTab === 'function') window.switchSubTab('gradecalc', btn.dataset.gcTab);
      });
    });
    document.querySelectorAll('[data-plan-tab]').forEach(function(btn){
      if(btn._safePtBound || btn._boundByOriginal) return;
      btn._safePtBound = true;
      btn.addEventListener('click', function(){
        if(typeof window.switchSubTab === 'function') window.switchSubTab('plan', btn.dataset.planTab);
      });
    });

    var binds = [
      ['btnAddTask', 'addTask'],
      ['btnAddExam', 'addExam'],
      ['btnAddAtt', 'addAttendanceCourse'],
      ['btnAddCourse', 'addMyCourse'],
      ['btnImportPlan', 'importFromPlan'],
      ['btnAddDeck', 'addDeck'],
      ['btnAddNote', 'addNote'],
      ['btnAddGpa', 'addCourse'],
      ['btnLoadGpaSample', 'loadSampleGpa'],
      ['btnClearGpa', 'clearGpa'],
      ['btnCalcWhatIf', 'calcWhatIf'],
      ['ncCalc', 'calcNeed'],
      ['btnAddGrade', 'addGradeCourse'],
      ['startBtn', 'toggleTimer'],
      ['resetBtn', 'resetTimer'],
      ['miniStartBtn', 'toggleTimer'],
      ['miniResetBtn', 'resetTimer'],
      ['btnTimerSettings', 'openTimerSettings'],
      ['btnClearBudget', 'clearBudget']
    ];
    binds.forEach(function(pair){
      var el = document.getElementById(pair[0]);
      if(!el || el._safeBound || el._boundByOriginal) return;
      el._safeBound = true;
      el.addEventListener('click', function(){
        var fn = window[pair[1]];
        if(typeof fn === 'function') fn();
      });
    });

    var bi = document.getElementById('btnAddIncome');
    if(bi && !bi._safeBound && !bi._boundByOriginal){
      bi._safeBound = true;
      bi.addEventListener('click', function(){
        if(typeof window.addBudgetItem === 'function') window.addBudgetItem('income');
      });
    }
    var be = document.getElementById('btnAddExpense');
    if(be && !be._safeBound && !be._boundByOriginal){
      be._safeBound = true;
      be.addEventListener('click', function(){
        if(typeof window.addBudgetItem === 'function') window.addBudgetItem('expense');
      });
    }

    var bct = document.getElementById('btnClearTt');
    if(bct && !bct._safeBound && !bct._boundByOriginal){
      bct._safeBound = true;
      bct.addEventListener('click', function(){ window.clearTimetable(); });
    }
    var ble = document.getElementById('btnLoadExample');
    if(ble && !ble._safeBound && !ble._boundByOriginal){
      ble._safeBound = true;
      ble.addEventListener('click', function(){ window.loadExampleTimetable(); });
    }
    var baf = document.getElementById('btnAutoFill');
    if(baf && !baf._safeBound && !baf._boundByOriginal){
      baf._safeBound = true;
      baf.addEventListener('click', function(){ window.autoFillTimetable(); });
    }
    var bpt = document.getElementById('btnPrintTt');
    if(bpt && !bpt._safeBound && !bpt._boundByOriginal){
      bpt._safeBound = true;
      bpt.addEventListener('click', function(){ window.printTimetable(); });
    }
    var bac = document.getElementById('btnAddClass');
    if(bac && !bac._safeBound && !bac._boundByOriginal){
      bac._safeBound = true;
      bac.addEventListener('click', function(){ window.addClassSlot(); });
    }

    var sbtn = document.getElementById('btnOpenSmartTimetable');
    if(sbtn && !sbtn._smartTtBound){
      sbtn._smartTtBound = true;
      sbtn.addEventListener('click', function(e){
        e.preventDefault();
        if(typeof window.openSmartTimetable === 'function'){
          try{ window.openSmartTimetable(); }
          catch(err){ console.error(err); toast('فشل فتح محرر الجدول', 'warn'); }
        } else {
          toast('⏳ جاري تحميل المحرر...', 'info');
          var s = document.createElement('script');
          s.src = 'smart-timetable-entry.js';
          s.onload = function(){
            setTimeout(function(){
              if(window.openSmartTimetable) window.openSmartTimetable();
            }, 200);
          };
          document.head.appendChild(s);
        }
      });
    }

    /* ✅ لا نربط fab-action إذا كان bindAllEvents قد ربطها */
    document.querySelectorAll('.fab-action').forEach(function(b){
      if(b._safeFabBound || b._boundByOriginal) return;
      b._safeFabBound = true;
      b.addEventListener('click', function(){
        var type = b.dataset.fab;
        if(typeof window.toggleFabMenu === 'function') window.toggleFabMenu();
        setTimeout(function(){
          if(type === 'quick' && typeof window.openQuickCapture === 'function') window.openQuickCapture();
          else if(type === 'task' && typeof window.addTask === 'function'){
            if(window.switchTab) window.switchTab('tasks');
            setTimeout(window.addTask, 200);
          }
          else if(type === 'course' && typeof window.addMyCourse === 'function'){
            if(window.switchTab) window.switchTab('courses');
            setTimeout(window.addMyCourse, 200);
          }
          else if(type === 'exam' && typeof window.addExam === 'function'){
            if(window.switchTab) window.switchTab('exams');
            setTimeout(window.addExam, 200);
          }
          else if(type === 'note' && typeof window.addNote === 'function'){
            if(window.switchTab) window.switchTab('notes');
            setTimeout(window.addNote, 200);
          }
          else if(type === 'budget' && typeof window.addBudgetItem === 'function'){
            if(window.switchTab) window.switchTab('budget');
            setTimeout(function(){ window.addBudgetItem('expense'); }, 200);
          }
        }, 150);
      });
    });
  }

  /* ============================================================
     12) التثبيت الرئيسي
     ============================================================ */
  function install(){
    if(!window.today) window.today = localToday;

    if(!installAIFixes()) setTimeout(installAIFixes, 500);

    if(typeof window.renderPlan === 'function' && !window._renderPlanReplaced){
      window._renderPlanReplaced = true;
      var origRenderPlan = window.renderPlan;
      window.renderPlan = function(){
        try{
          renderPlanByType();
          installPlanChips();
        }catch(e){
          console.error('renderPlanByType failed:', e);
          try{ origRenderPlan.apply(this, arguments); }catch(e2){}
        }
      };
    }

    safeBindAllEvents();

    setTimeout(installTouchDrag, 1500);

    setTimeout(function(){
      safeBindAllEvents();
      installPlanChips();
      installTouchDrag();
    }, 1500);
    setTimeout(function(){
      safeBindAllEvents();
      installPlanChips();
    }, 3000);

    if(typeof window.switchTab === 'function' && !window._safeSwitchWrapped){
      var origSwitch = window.switchTab;
      window.switchTab = function(tab){
        var r = origSwitch.apply(this, arguments);
        setTimeout(function(){
          safeBindAllEvents();
          if(tab === 'plan'){
            installPlanChips();
            renderPlanByType();
          }
          if(tab === 'dashboard'){
            installTouchDrag();
          }
        }, 150);
        return r;
      };
      window._safeSwitchWrapped = true;
    }

    console.log('✅ fixes-all v3 installed — no double-binding');
  }

  /* ============================================================
     التسجيل
     ============================================================ */
  if(document.readyState === 'loading'){
    /* 1) wrapBindAll يُسجّل أولًا ليعمل قبل boot */
    document.addEventListener('DOMContentLoaded', wrapBindAll);
    /* 2) ثم install بعد 50ms */
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 50); });
  } else {
    wrapBindAll();
    setTimeout(install, 50);
  }

  /* احتياطي: حاول تغليف bindAllEvents كل 30ms حتى يظهر */
  var wrapTries = 0;
  var wrapTimer = setInterval(function(){
    wrapTries++;
    if(window._bindAllWrapped || wrapTries > 40){
      clearInterval(wrapTimer);
      return;
    }
    if(typeof window.bindAllEvents === 'function'){
      wrapBindAll();
      clearInterval(wrapTimer);
    }
  }, 30);
})();