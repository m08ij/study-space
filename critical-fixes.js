/* ============================================================
   🔥 critical-fixes.js v1 — إصلاحات حرجة
   - UTC → Local في كل مكان
   - Sanitize لبيانات السيرفر
   - تصحيح حساب GPA
   - showModal لا يُغلق عند فشل التحقق
   - parseQuickCapture نظيف للعربية
   - checkSmartReminders آمن ضد التكرار
   ============================================================ */
(function(){
  'use strict';
  if(window._criticalFixesLoaded) return;
  window._criticalFixesLoaded = true;

  /* ============ Helpers ============ */
  function localToday(){
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  function sanitizeSpace(raw){
    var defaultSpace = {
      profile: {name:''},
      timetable: {},
      courses: [], tasks: [], exams: [],
      attendance: {}, decks: [], budget: [], grades: [],
      completedCourses: [], currentSemester: 1, extras: []
    };
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultSpace;

    var out = {};
    Object.keys(defaultSpace).forEach(function(k){
      if(Array.isArray(defaultSpace[k])){
        out[k] = Array.isArray(raw[k]) ? raw[k] : [];
      } else if(defaultSpace[k] && typeof defaultSpace[k] === 'object'){
        out[k] = (raw[k] && typeof raw[k] === 'object' && !Array.isArray(raw[k]))
          ? raw[k] : defaultSpace[k];
      } else {
        out[k] = raw[k] !== undefined ? raw[k] : defaultSpace[k];
      }
    });
    // مفاتيح إضافية من raw (مثل extras) — نحفظها كما هي
    Object.keys(raw).forEach(function(k){
      if(!(k in out)) out[k] = raw[k];
    });
    return out;
  }

  function clampInt(v, min, max, def){
    var n = parseInt(v, 10);
    if(isNaN(n) || n < min || n > max) return def;
    return n;
  }

  /* ============================================================
     الإصلاح الرئيسي
     ============================================================ */
  function applyAll(){
    if(window._criticalFixesApplied) return;
    window._criticalFixesApplied = true;

    /* ============ 1) applyServerData ============ */
    window.applyServerData = function(data){
      if(!data || typeof data !== 'object') return;
      try{
        if(data.space){
          var clean = sanitizeSpace(data.space);
          window.space = clean;
          if(window.S) window.S.set('space', clean);
        }
        if(Array.isArray(data.notes)){
          window.notes = data.notes;
          if(window.S) window.S.set('notes', window.notes);
        }
        if(Array.isArray(data.gpaRows) && data.gpaRows.length){
          window.gpaRows = data.gpaRows;
          if(window.S) window.S.set('gpaRows', window.gpaRows);
        }
        if(data.timerSettings && typeof data.timerSettings === 'object'){
          var raw = data.timerSettings;
          window.timerSettings = {
            focus: clampInt(raw.focus, 1, 120, 25),
            short: clampInt(raw.short, 1, 60, 5),
            long:  clampInt(raw.long,  1, 90, 15)
          };
          if(window.S) window.S.set('timerSettings', window.timerSettings);
        }
        if(typeof data.pomoSessions === 'number' && data.pomoSessions >= 0){
          window.S.set('pomoSessions', data.pomoSessions);
        }
        if(typeof data.pomoFocus === 'number' && data.pomoFocus >= 0){
          window.S.set('pomoFocus', data.pomoFocus);
        }
        if(data.studyLog && typeof data.studyLog === 'object' && !Array.isArray(data.studyLog)){
          window.S.set('studyLog', data.studyLog);
        }
        if(typeof data.theme === 'string') window.S.set('theme', data.theme);
        if(typeof data.activeTab === 'string') window.S.set('activeTab', data.activeTab);
        if(typeof data.welcomeDone === 'boolean') window.S.set('welcomeDone', data.welcomeDone);
        if(Array.isArray(data.openSems)) window.S.set('openSems', data.openSems);

        /* مزامنة TM و ts */
        if(window.TM && window.timerSettings){
          window.TM.focus = window.timerSettings.focus * 60;
          window.TM.short = window.timerSettings.short * 60;
          window.TM.long  = window.timerSettings.long  * 60;
          if(window.ts){
            window.ts.remaining = window.TM[window.ts.mode] || window.TM.focus;
            window.ts.total = window.ts.remaining;
            window.ts.sessions = window.S.get('pomoSessions', 0) || 0;
            window.ts.focusMin = window.S.get('pomoFocus', 0) || 0;
          }
        }
      }catch(e){ console.warn('applyServerData (critical-fixes):', e); }
    };

    /* ============ 2) showModal ============ */
    window.showModal = function(title, fields, values, onSubmit, onDelete){
      document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
      var bd = document.createElement('div');
      bd.className = 'modal-backdrop show';
      var escFn = window.esc || function(s){ return String(s==null?'':s); };
      var fieldsHtml = '';
      fields.forEach(function(f){
        var val = values[f.key] !== undefined ? values[f.key] : '';
        var inputHtml;
        if(f.type === 'select'){
          var opts = '';
          f.options.forEach(function(o){
            opts += '<option value="' + escFn(o.v) + '"' +
              (String(val) === String(o.v) ? ' selected' : '') + '>' + escFn(o.l) + '</option>';
          });
          inputHtml = '<select id="mf_' + f.key + '">' + opts + '</select>';
        } else if(f.type === 'textarea'){
          inputHtml = '<textarea id="mf_' + f.key + '" rows="3">' + escFn(val) + '</textarea>';
        } else {
          inputHtml = '<input id="mf_' + f.key + '" type="' + (f.type || 'text') +
            '" value="' + escFn(val) + '" placeholder="' + escFn(f.placeholder || '') + '">';
        }
        fieldsHtml += '<div class="form-group"><label>' + escFn(f.label) + '</label>' + inputHtml + '</div>';
      });
      bd.innerHTML = '<div class="modal"><h3>' + escFn(title) + '</h3>' + fieldsHtml +
        '<div class="modal-actions">' +
          (onDelete ? '<button class="btn btn-sm btn-danger" id="mDel">🗑 حذف</button>' : '') +
          '<button class="btn btn-sm btn-ghost" id="mCancel">إلغاء</button>' +
          '<button class="btn btn-sm" id="mSave">حفظ</button>' +
        '</div></div>';
      document.body.appendChild(bd);

      function close(){ bd.remove(); }
      bd.querySelector('#mCancel').onclick = close;
      bd.onclick = function(e){ if(e.target === bd) close(); };

      bd.querySelector('#mSave').onclick = function(){
        var data = {};
        fields.forEach(function(f){
          var el = document.getElementById('mf_' + f.key);
          data[f.key] = el ? el.value.trim() : '';
        });
        var result;
        try{
          result = onSubmit(data);
        }catch(e){
          console.error('showModal submit error:', e);
          return;
        }
        /* ✅ لا نُغلق إلا إذا لم يُرجع onSubmit false */
        if(result === false) return;
        close();
      };
      if(onDelete) bd.querySelector('#mDel').onclick = function(){ onDelete(); close(); };

      setTimeout(function(){
        /* فضّل input على select */
        var i = bd.querySelector('input,textarea') || bd.querySelector('select');
        if(i) i.focus();
      }, 100);
    };

    /* ============ 3) renderGradeCalc (GPA math) ============ */
    window.renderGradeCalc = function(){
      if(!window.space) return;
      if(!Array.isArray(window.space.grades)) window.space.grades = [];
      var c = document.getElementById('gradeTrackerList');
      if(!c) return;
      if(!window.space.grades.length){
        c.innerHTML = '<div class="empty"><div class="ic">📊</div><p>لا توجد مواد</p><p class="sub">اضغط "+ مادة" للبدء</p></div>';
        return;
      }
      var escFn = window.esc || function(s){ return String(s==null?'':s); };
      var html = '';
      window.space.grades.forEach(function(g, idx){
        var total = 0, earned = 0;
        (g.items || []).forEach(function(it){
          total  += parseFloat(it.weight) || 0;
          earned += parseFloat(it.score)  || 0;   /* ✅ score out of weight */
        });
        var pct = total > 0 ? (earned / total * 100) : 0;
        var color = pct >= 85 ? 'var(--green)' : pct >= 70 ? 'var(--cyan)' :
                    pct >= 50 ? 'var(--amber)' : 'var(--red)';
        var itemsHtml = '';
        (g.items || []).forEach(function(it, i){
          itemsHtml += '<div class="gt-item-row"><span style="flex:1">' + escFn(it.name) + '</span>' +
            '<span style="color:var(--muted)">' + it.score + '/' + it.weight + '</span>' +
            '<button class="btn btn-sm btn-danger" data-gt-del="' + idx + '-' + i +
            '" style="padding:2px 6px;font-size:.7rem">✕</button></div>';
        });
        html += '<div class="card" style="margin-bottom:12px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
          '<div><div style="font-weight:700;font-size:.98rem">' + escFn(g.name) + '</div>' +
          '<div style="font-size:.72rem;color:var(--muted)">مجموع: ' + total + '%</div></div>' +
          '<div style="text-align:center"><div style="font-size:1.4rem;font-weight:800;color:' + color + '">' +
          pct.toFixed(1) + '%</div>' +
          '<div style="font-size:.65rem;color:var(--muted)">حتى الآن</div></div></div>' +
          itemsHtml +
          '<div style="display:flex;gap:6px;margin-top:10px">' +
          '<button class="btn btn-sm" data-gt-add="' + idx + '">+ علامة</button>' +
          '<button class="btn btn-sm btn-danger" data-gt-remove="' + idx + '">🗑 المادة</button></div></div>';
      });
      c.innerHTML = html;

      c.querySelectorAll('[data-gt-add]').forEach(function(b){
        b.addEventListener('click', function(){
          if(typeof window.addGradeItem === 'function') window.addGradeItem(parseInt(b.dataset.gtAdd,10));
        });
      });
      c.querySelectorAll('[data-gt-del]').forEach(function(b){
        b.addEventListener('click', function(){
          var parts = b.dataset.gtDel.split('-');
          window.space.grades[parseInt(parts[0],10)].items.splice(parseInt(parts[1],10), 1);
          if(window.saveSpace) window.saveSpace();
          window.renderGradeCalc();
        });
      });
      c.querySelectorAll('[data-gt-remove]').forEach(function(b){
        b.addEventListener('click', function(){
          var idx = parseInt(b.dataset.gtRemove, 10);
          var doDel = function(){
            window.space.grades.splice(idx, 1);
            if(window.saveSpace) window.saveSpace();
            window.renderGradeCalc();
          };
          if(typeof window.customConfirm === 'function'){
            window.customConfirm('حذف "' + window.space.grades[idx].name + '"؟', doDel);
          } else if(confirm('حذف؟')) doDel();
        });
      });
    };

    /* ============ 4) logStudySession (local date) ============ */
    window.logStudySession = function(minutes){
      var today = localToday();
      var log = (window.S && window.S.get('studyLog', {})) || {};
      if(!log || typeof log !== 'object' || Array.isArray(log)) log = {};
      log[today] = (log[today] || 0) + minutes;
      if(window.S) window.S.set('studyLog', log);
    };

    /* ============ 5) renderStats (local date) ============ */
    window.renderStats = function(){
      var chart = document.getElementById('studyChart');
      var cards = document.getElementById('statsCards');
      if(!chart || !cards) return;

      var log = (window.S && window.S.get('studyLog', {})) || {};
      if(!log || typeof log !== 'object' || Array.isArray(log)) log = {};

      var DAYS_AR = window.DAYS_AR ||
        ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

      var days = [];
      for(var i = 6; i >= 0; i--){
        var d = new Date();
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - i);
        var ds = d.getFullYear() + '-' +
          String(d.getMonth()+1).padStart(2,'0') + '-' +
          String(d.getDate()).padStart(2,'0');
        days.push({date: ds, name: DAYS_AR[d.getDay()].slice(0,3), minutes: log[ds] || 0});
      }

      var max = Math.max.apply(null, days.map(function(d){ return d.minutes; }).concat([60]));
      var chartHtml = '';
      days.forEach(function(d){
        var h = Math.max(4, (d.minutes / max) * 100);
        chartHtml += '<div class="bar" style="height:' + h + '%">' +
          '<span class="bar-value">' + (d.minutes > 0 ? d.minutes + 'د' : '') + '</span>' +
          '<span class="bar-label">' + d.name + '</span></div>';
      });
      chart.innerHTML = chartHtml;

      var totalMin = days.reduce(function(a,d){ return a + d.minutes; }, 0);
      var totalHrs = (totalMin / 60).toFixed(1);
      var avg = (totalMin / 7).toFixed(0);
      var sessions = (window.S && window.S.get('pomoSessions', 0)) || 0;
      var tasksDone = ((window.space && window.space.tasks) || []).filter(function(t){ return t.done; }).length;
      var totalTasks = ((window.space && window.space.tasks) || []).length;
      var completion = totalTasks ? Math.round(tasksDone / totalTasks * 100) : 0;
      var totalCards = ((window.space && window.space.decks) || [])
        .reduce(function(a,d){ return a + ((d.cards && d.cards.length) || 0); }, 0);

      cards.innerHTML =
        '<div class="stat"><div class="ic">⏱️</div><div><div class="v">' + totalHrs + ' س</div><div class="l">إجمالي الساعات</div></div></div>' +
        '<div class="stat"><div class="ic">📊</div><div><div class="v">' + avg + ' د</div><div class="l">متوسط يومي</div></div></div>' +
        '<div class="stat"><div class="ic">🎯</div><div><div class="v">' + sessions + '</div><div class="l">جلسات</div></div></div>' +
        '<div class="stat"><div class="ic">✅</div><div><div class="v">' + completion + '%</div><div class="l">إنجاز</div></div></div>' +
        '<div class="stat"><div class="ic">📚</div><div><div class="v">' + ((window.space && window.space.courses) || []).length + '</div><div class="l">المواد</div></div></div>' +
        '<div class="stat"><div class="ic">🃏</div><div><div class="v">' + totalCards + '</div><div class="l">البطاقات</div></div></div>';
    };

    /* ============ 6) checkReminders (local) ============ */
    window.checkReminders = function(){
      var today = localToday();
      var tasks = (window.space && window.space.tasks) || [];
      var dueToday = tasks.filter(function(t){ return !t.done && t.due === today; });
      var overdue = tasks.filter(function(t){ return !t.done && t.due && t.due < today; });
      if(overdue.length){
        setTimeout(function(){
          if(window.toast) window.toast('⚠️ ' + overdue.length + ' مهمة متأخرة!', 'warn', 5000);
        }, 1500);
      }
      if(dueToday.length){
        setTimeout(function(){
          if(window.toast) window.toast('📌 ' + dueToday.length + ' مهمة اليوم!', 'info', 5000);
        }, 2500);
      }
    };

    /* ============ 7) checkSmartReminders ============ */
    window.checkSmartReminders = function(){
      if(!window.space || !window.space.tasks) return;
      var today = localToday();
      var now = new Date();
      var hour = now.getHours();
      if(hour < 8 || hour > 23) return;

      var firedKey = 'ss_smart_reminders_v2_' + today;
      var fired = {};
      try{ if(window.S && window.S.get) fired = window.S.get(firedKey, {}) || {}; }catch(e){}
      if(!fired || typeof fired !== 'object' || Array.isArray(fired)) fired = {};

      var dueToday = (window.space.tasks || []).filter(function(t){ return !t.done && t.due === today; });
      var overdue = (window.space.tasks || []).filter(function(t){ return !t.done && t.due && t.due < today; });
      var upcomingExams = (window.space.exams || []).filter(function(e){
        if(!e.date) return false;
        var days = Math.ceil((new Date(e.date) - now) / 86400000);
        return days >= 0 && days <= 3;
      });

      var reminders = [];
      if(dueToday.length){
        reminders.push({
          tag: 'due-today',
          t: '📌 ' + dueToday.length + ' مهمة مستحقة اليوم!',
          b: dueToday.slice(0,3).map(function(x){return x.title;}).join(' · ')
        });
      }
      if(overdue.length){
        reminders.push({
          tag: 'overdue',
          t: '⚠️ ' + overdue.length + ' مهمة متأخرة!',
          b: overdue.slice(0,3).map(function(x){return x.title;}).join(' · ')
        });
      }
      upcomingExams.forEach(function(e){
        var days = Math.ceil((new Date(e.date) - now) / 86400000);
        var when = days === 0 ? 'اليوم!' : days === 1 ? 'غدًا!' : 'بعد ' + days + ' أيام';
        /* ✅ tag فريد لكل امتحان */
        var uid = e.id || (e.date + '_' + String(e.name || '').replace(/\s+/g,'_'));
        reminders.push({
          tag: 'exam-' + uid,
          t: '⏳ امتحان ' + when,
          b: (e.name || '') + (e.time ? ' — الساعة ' + e.time : '')
        });
      });

      var anyNew = false;
      reminders.forEach(function(r, i){
        if(fired[r.tag]) return;
        fired[r.tag] = true;
        anyNew = true;
        setTimeout(function(){
          if(window.toast) window.toast(r.t, 'warn', 5000);
        }, 1500 + i * 2500);
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

    /* ============ 8) parseQuickCapture (عربي نظيف) ============ */
    if(typeof window.parseQuickCapture === 'function'){
      var origQC = window.parseQuickCapture;
      window.parseQuickCapture = function(text){
        var result = origQC.apply(this, arguments);
        if(!result) return result;

        var t = String(text || '');
        /* إزالة \b لأن العربية ليست \w */
        result.title = String(result.title || '')
          .replace(/^\s*(امتحان|اختبار|exam|فاينل|واجب|مهمة|task|assignment|homework|هومورك|مصروف|صرفت|دفعت|expense|صرف|دخل|راتب|income|وارد|ملاحظة|note|مذكرة)\s*:?\s*/i, '')
          .replace(/\d{1,2}\s*[\/\-]\s*\d{1,2}(?:\s*[\/\-]\s*\d{2,4})?/g, '')
          .replace(/(\d+(?:\.\d+)?)\s*(?:د(?:ينار)?|jd|دولار|\$|usd)(\s|$)/gi, ' ')
          .replace(/(^|\s)(اليوم|today)(\s|$)/gi, ' ')
          .replace(/(^|\s)(غدًا|غدا|بكرة|tomorrow)(\s|$)/gi, ' ')
          .replace(/(^|\s)(بعد\s*غد|day after)(\s|$)/gi, ' ')
          .replace(/(^|\s)بعد\s*(\d+)\s*(يوم|أيام|ايام|day)(\s|$)/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if(!result.title) result.title = t;
        return result;
      };
    }

    /* ============ 9) loadAllData — sanitization إضافي ============ */
    if(typeof window.loadAllData === 'function'){
      var origLoadAll = window.loadAllData;
      window.loadAllData = function(){
        try{ origLoadAll.apply(this, arguments); }catch(e){}
        if(window.space) window.space = sanitizeSpace(window.space);
        if(!Array.isArray(window.notes)) window.notes = [];
        if(!Array.isArray(window.gpaRows) || !window.gpaRows.length){
          window.gpaRows = [{name:'', hrs:3, grade:'A (90-100)'}];
        }
      };
    }

    /* ============ 10) توحيد today() و dateKey ============ */
    window.today = localToday;
    window.dateKeyLocal = function(d){
      if(!(d instanceof Date)) d = new Date(d);
      return d.getFullYear() + '-' +
        String(d.getMonth()+1).padStart(2,'0') + '-' +
        String(d.getDate()).padStart(2,'0');
    };

    console.log('🔥 Critical Fixes applied — UTC→Local, sanitize, GPA, showModal');
  }

  /* ============ API ============ */
  window.CriticalFixes = {
    applyAll: applyAll,
    sanitizeSpace: sanitizeSpace,
    localToday: localToday
  };

  console.log('🔥 Critical Fixes module loaded');
})();