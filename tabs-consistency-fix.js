/* ============================================================
   🔗 tabs-consistency-fix.js
   - يعمل بعد inline script (عبر defer) وقبل DOMContentLoaded
   - يصلح UTC bugs في: renderDashboard, renderTasks, renderExams,
     addBudgetItem, parseQuickCapture
   - insights/custom-dashboard تلتف حول النسخ المُصلَحة
   ============================================================ */
(function(){
  'use strict';
  if(window._tabsConsistencyFixApplied) return;
  window._tabsConsistencyFixApplied = true;

  function localToday(){
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }
  function localDate(d){
    if(!(d instanceof Date)) d = new Date(d);
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  /* ============================================================
     1) renderTasks — local date
     ============================================================ */
  window.renderTasks = function(){
    var c = document.getElementById('tasksList'); if(!c) return;
    var space = window.space || {};
    var today = localToday();
    var escFn = window.esc || function(s){ return String(s==null?'':s); };

    var tasks = (space.tasks || []).slice().sort(function(a,b){
      if(a.done !== b.done) return a.done ? 1 : -1;
      if(!a.due) return 1; if(!b.due) return -1;
      return a.due.localeCompare(b.due);
    });

    var filter = window.currentTaskFilter || 'all';
    if(filter === 'pending') tasks = tasks.filter(function(t){ return !t.done; });
    if(filter === 'done')    tasks = tasks.filter(function(t){ return t.done; });
    if(filter === 'overdue') tasks = tasks.filter(function(t){ return !t.done && t.due && t.due < today; });

    if(!tasks.length){
      c.innerHTML = '<div class="empty"><div class="ic">📝</div><p>لا توجد مهام</p></div>';
      return;
    }

    var typeMap = {exam:'امتحان', assignment:'واجب', quiz:'كويز', project:'مشروع', task:'مهمة'};
    var html = '';
    tasks.forEach(function(t){
      var isOverdue = !t.done && t.due && t.due < today;
      var daysLeft = t.due ? Math.ceil((new Date(t.due) - new Date(today)) / 86400000) : null;
      var isUrgent = !t.done && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
      html += '<div class="task ' + (t.done ? 'done' : '') + ' ' +
        (isOverdue ? 'overdue' : isUrgent ? 'urgent' : '') + '">' +
        '<div class="task-check" data-toggle-task="' + t.id + '"></div>' +
        '<div class="task-body"><div class="task-title">' + escFn(t.title) + '</div>' +
        '<div class="task-meta"><span class="badge ' + (t.type || 'task') + '">' +
        (typeMap[t.type] || 'مهمة') + '</span>' +
        (t.course ? '<span>📚 ' + escFn(t.course) + '</span>' : '') +
        (t.due ? '<span>📅 ' + t.due +
          (daysLeft !== null ? ' (' + (daysLeft >= 0 ? 'بعد ' + daysLeft + ' يوم' : 'متأخر ' + Math.abs(daysLeft)) + ')' : '') +
          '</span>' : '') + '</div></div>' +
        '<div class="task-actions"><button class="btn btn-sm btn-ghost" data-edit-task="' + t.id + '">✏️</button>' +
        '<button class="btn btn-sm btn-danger" data-del-task="' + t.id + '">🗑</button></div></div>';
    });
    c.innerHTML = html;

    c.querySelectorAll('[data-toggle-task]').forEach(function(b){
      b.addEventListener('click', function(){
        if(typeof window.toggleTask === 'function') window.toggleTask(b.dataset.toggleTask);
      });
    });
    c.querySelectorAll('[data-edit-task]').forEach(function(b){
      b.addEventListener('click', function(){
        if(typeof window.editTask === 'function') window.editTask(b.dataset.editTask);
      });
    });
    c.querySelectorAll('[data-del-task]').forEach(function(b){
      b.addEventListener('click', function(){
        if(typeof window.deleteTask === 'function') window.deleteTask(b.dataset.delTask);
      });
    });
  };

  /* ============================================================
     2) renderExams — local date
     ============================================================ */
  window.renderExams = function(){
    var c = document.getElementById('examsList'); if(!c) return;
    var space = window.space || {};
    if(!(space.exams || []).length){
      c.innerHTML = '<div class="empty"><div class="ic">⏳</div><p>لا توجد امتحانات</p></div>';
      return;
    }
    var today = localToday();
    var escFn = window.esc || function(s){ return String(s==null?'':s); };
    var sorted = space.exams.slice().sort(function(a,b){ return a.date.localeCompare(b.date); });
    var html = '';
    sorted.forEach(function(e){
      var daysLeft = Math.ceil((new Date(e.date) - new Date(today)) / 86400000);
      var isUrgent = daysLeft >= 0 && daysLeft <= 7;
      html += '<div class="exam-card"><div class="exam-info"><div class="title">📝 ' + escFn(e.name) + '</div>' +
        '<div class="meta">' + (e.course ? '📚 ' + escFn(e.course) + ' · ' : '') +
        '📅 ' + e.date + (e.time ? ' · ⏰ ' + escFn(e.time) : '') +
        (e.room ? ' · 📍 ' + escFn(e.room) : '') + '</div></div>' +
        '<div class="exam-countdown ' + (isUrgent ? 'urgent' : '') + '">' +
        (daysLeft >= 0 ? daysLeft + ' يوم' : 'انتهى') +
        '<div class="lbl">' + (daysLeft >= 0 ? 'متبقي' : 'منتهي') + '</div></div>' +
        '<div style="display:flex;gap:4px">' +
        '<button class="btn btn-sm btn-ghost" data-edit-exam="' + e.id + '">✏️</button>' +
        '<button class="btn btn-sm btn-danger" data-del-exam="' + e.id + '">🗑</button>' +
        '</div></div>';
    });
    c.innerHTML = html;
    c.querySelectorAll('[data-edit-exam]').forEach(function(b){
      b.addEventListener('click', function(){
        if(typeof window.editExam === 'function') window.editExam(b.dataset.editExam);
      });
    });
    c.querySelectorAll('[data-del-exam]').forEach(function(b){
      b.addEventListener('click', function(){
        if(typeof window.deleteExam === 'function') window.deleteExam(b.dataset.delExam);
      });
    });
  };

  /* ============================================================
     3) renderDashboard — local date
     ============================================================ */
  window.renderDashboard = function(){
    if(typeof window.renderDailyQuote === 'function') window.renderDailyQuote();

    var space = window.space || {};
    var notes = window.notes || [];
    var DAYS_EN = window.DAYS_EN || ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var escFn = window.esc || function(s){ return String(s==null?'':s); };

    var now = new Date();
    var hour = now.getHours();
    var name = (space.profile && space.profile.name) || '';
    var greet = hour < 5 ? '🌙' : hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙';

    var gl = document.getElementById('greetLine');
    if(gl){
      gl.textContent = greet + ' ' + (name ? name + ', ' : '') + 'لديك ' +
        (space.tasks || []).filter(function(t){ return !t.done; }).length + ' مهمة متبقية';
    }

    var todayIdx = now.getDay();
    var todayKey = DAYS_EN[todayIdx] || 'Sun';
    var todayStr = localToday();

    /* تقدم الترم */
    var tp = document.getElementById('dashTermProgress');
    if(tp){
      var totalRequired = 0;
      var SEMESTERS = window.SEMESTERS || [];
      SEMESTERS.forEach(function(sem){
        (sem.courses || []).forEach(function(c){ totalRequired += c.h; });
      });
      var registered = (space.courses || []).reduce(function(a,c){
        return a + (c.hours || 0);
      }, 0);
      var pct = totalRequired > 0 ? Math.round(registered / totalRequired * 100) : 0;
      tp.innerHTML =
        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:.86rem">' +
        '<span style="color:var(--muted)">📚 ' + registered + ' / ' + totalRequired + ' ساعة</span>' +
        '<span style="color:var(--cyan);font-weight:700">' + pct + '%</span></div>' +
        '<div class="sc-progress"><div class="sc-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div style="text-align:center;color:var(--muted2);font-size:.75rem;margin-top:6px">باقي ' +
        Math.max(0, totalRequired - registered) + ' ساعة للتخرج</div>';
    }

    var pending = (space.tasks || []).filter(function(t){ return !t.done; }).length;
    var budget = space.budget || [];
    var income = budget.filter(function(b){ return b.type === 'income'; })
      .reduce(function(a,b){ return a + (parseFloat(b.amount) || 0); }, 0);
    var expense = budget.filter(function(b){ return b.type === 'expense'; })
      .reduce(function(a,b){ return a + (parseFloat(b.amount) || 0); }, 0);
    var balance = income - expense;

    var dsEl = document.getElementById('dashStats');
    if(dsEl) dsEl.innerHTML =
      '<div class="stat"><div class="ic">📚</div><div><div class="v">' +
        (space.courses || []).length + '</div><div class="l">مادة مسجّلة</div></div></div>' +
      '<div class="stat"><div class="ic">📝</div><div><div class="v">' +
        pending + '</div><div class="l">مهمة متبقية</div></div></div>' +
      '<div class="stat"><div class="ic">⏳</div><div><div class="v">' +
        (space.exams || []).length + '</div><div class="l">امتحان قادم</div></div></div>' +
      '<div class="stat"><div class="ic">📊</div><div><div class="v">' +
        (space.grades ? space.grades.length : 0) + '</div><div class="l">مادة في علاماتي</div></div></div>';

    var tc = document.getElementById('todayClasses');
    if(tc){
      var tt = space.timetable || {};
      var todays = Object.keys(tt)
        .filter(function(k){ return k.indexOf(todayKey) === 0; })
        .sort();
      if(!todays.length){
        tc.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.85rem">🌴 لا توجد محاضرات اليوم</div>';
      } else {
        var h = '';
        todays.forEach(function(k){
          var time = k.split('-')[1];
          var cls = tt[k];
          h += '<div style="display:flex;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">' +
            '<div style="font-weight:700;color:var(--cyan);font-size:.84rem;min-width:48px">' + time + '</div>' +
            '<div><div style="font-size:.86rem;font-weight:600">' + escFn(cls.name) + '</div>' +
            (cls.room ? '<div style="font-size:.72rem;color:var(--muted)">📍 ' + escFn(cls.room) + '</div>' : '') +
            '</div></div>';
        });
        tc.innerHTML = h;
      }
    }

    var ut = document.getElementById('upcomingTasks');
    if(ut){
      var wl = new Date(); wl.setDate(wl.getDate() + 7);
      var weekLater = localDate(wl);
      var up = (space.tasks || [])
        .filter(function(t){
          return !t.done && t.due && t.due >= todayStr && t.due <= weekLater;
        })
        .sort(function(a,b){ return a.due.localeCompare(b.due); })
        .slice(0, 5);

      if(!up.length){
        ut.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.85rem">✨ لا مهام قريبة</div>';
      } else {
        var h2 = '';
        up.forEach(function(t){
          var days = Math.ceil((new Date(t.due) - new Date(todayStr)) / 86400000);
          var col = days <= 2 ? 'var(--red)' : days <= 5 ? 'var(--amber)' : 'var(--muted)';
          h2 += '<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);align-items:center">' +
            '<div style="font-size:.73rem;color:' + col + ';min-width:58px;font-weight:700">' +
            (days === 0 ? 'اليوم' : days === 1 ? 'غدًا' : 'بعد ' + days + ' أيام') + '</div>' +
            '<div style="flex:1;font-size:.84rem">' + escFn(t.title) + '</div></div>';
        });
        ut.innerHTML = h2;
      }
    }

    var db = document.getElementById('dashBudget');
    if(db){
      var col2 = balance >= 0 ? 'var(--green)' : 'var(--red)';
      db.innerHTML =
        '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:.85rem"><span>📈 دخل</span>' +
        '<span style="color:var(--green);font-weight:700">' + income.toFixed(0) + ' د</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:.85rem;border-top:1px solid var(--border)">' +
        '<span>📉 مصروف</span><span style="color:var(--red);font-weight:700">' + expense.toFixed(0) + ' د</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:.88rem;border-top:2px solid var(--border);margin-top:6px">' +
        '<span style="font-weight:700">💼 الرصيد</span><span style="color:' + col2 + ';font-weight:800">' + balance.toFixed(0) + ' د</span></div>';
    }

    var dn = document.getElementById('dashNotes');
    if(dn){
      var recent = notes.slice(0, 3);
      if(!recent.length){
        dn.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.85rem">📔 لا توجد ملاحظات</div>';
      } else {
        var hn = '';
        recent.forEach(function(n){
          hn += '<div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:.84rem">' +
            '<div style="font-weight:600">' + escFn(n.title || 'بدون عنوان') + '</div>' +
            '<div style="font-size:.73rem;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            escFn((n.body || '').slice(0, 50)) + '</div></div>';
        });
        dn.innerHTML = hn;
      }
    }

    try{ if(typeof window.renderStats === 'function') window.renderStats(); }catch(e){}
    try{ if(typeof window.updateTimerUI === 'function') window.updateTimerUI(); }catch(e){}
  };

  /* ============================================================
     4) addBudgetItem — local date
     ============================================================ */
  window.addBudgetItem = function(type){
    var BC = window.BUDGET_CATS || [];
    var catOpts = BC.filter(function(c){
      if(type === 'income')
        return ['salary','family','scholarship','freelance','other-income'].indexOf(c.v) > -1;
      return ['salary','family','scholarship','freelance','other-income'].indexOf(c.v) === -1;
    }).map(function(c){ return { v: c.v, l: c.i + ' ' + c.l }; });

    if(!catOpts.length){
      if(window.toast) window.toast('التصنيفات غير محملة', 'warn');
      return;
    }
    if(typeof window.showModal !== 'function'){
      if(window.toast) window.toast('لا يمكن فتح النافذة', 'warn');
      return;
    }

    window.showModal('إضافة ' + (type === 'income' ? 'دخل' : 'مصروف'), [
      { key: 'category', label: 'التصنيف', type: 'select', options: catOpts },
      { key: 'amount',   label: 'المبلغ (دينار)', type: 'number' },
      { key: 'date',     label: 'التاريخ', type: 'date' },
      { key: 'note',     label: 'ملاحظة', type: 'textarea' }
    ], {
      category: catOpts[0].v,
      amount: 0,
      date: localToday(),
      note: ''
    }, function(data){
      if(!data.amount || parseFloat(data.amount) <= 0){
        if(window.toast) window.toast('أدخل مبلغًا', 'warn');
        return false;
      }
      if(!window.space) return false;
      if(!window.space.budget) window.space.budget = [];
      window.space.budget.push({
        id: (typeof window.uid === 'function' ? window.uid() : Date.now().toString(36)),
        type: type,
        category: data.category,
        amount: parseFloat(data.amount),
        date: data.date || localToday(),
        note: data.note || ''
      });
      if(window.saveSpace) window.saveSpace();
      if(typeof window.renderBudget === 'function') window.renderBudget();
      if(typeof window.renderDashboard === 'function') window.renderDashboard();
      return true;
    });
  };

  /* ============================================================
     5) parseQuickCapture — full override (not wrap)
     ============================================================ */
  window.parseQuickCapture = function(text){
    var t = String(text || '').trim();
    if(!t) return null;

    var result = {
      type: 'task', title: t, due: '',
      amount: 0, category: 'other-expense', note: ''
    };

    /* نوع */
    if(/^\s*(امتحان|اختبار|exam|فاينل)/i.test(t)){
      result.type = 'exam';
      result.title = t.replace(/^\s*(امتحان|اختبار|exam|فاينل)\s*/i, '').trim();
    } else if(/^\s*(واجب|مهمة|task|assignment|homework|هومورك)/i.test(t)){
      result.type = 'task';
      result.title = t.replace(/^\s*(واجب|مهمة|task|assignment|homework|هومورك)\s*/i, '').trim();
    } else if(/^\s*(مصروف|صرفت|دفعت|expense|صرف)/i.test(t)){
      result.type = 'expense';
      result.title = t.replace(/^\s*(مصروف|صرفت|دفعت|expense|صرف)\s*/i, '').trim();
    } else if(/^\s*(دخل|راتب|income|وارد)/i.test(t)){
      result.type = 'income';
      result.title = t.replace(/^\s*(دخل|راتب|income|وارد)\s*/i, '').trim();
    } else if(/^\s*(ملاحظة|note|مذكرة)\s*:?/i.test(t)){
      result.type = 'note';
      result.title = t.replace(/^\s*(ملاحظة|note|مذكرة)\s*:?\s*/i, '').trim();
    }

    /* مبلغ */
    if(result.type === 'expense' || result.type === 'income'){
      var amtMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:د(?:ينار)?|jd|دولار|\$|usd)?/i);
      if(amtMatch) result.amount = parseFloat(amtMatch[1]) || 0;
    }

    /* تاريخ — LOCAL */
    var todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    var dateStr = '';

    if(/اليوم|today/i.test(t)){
      dateStr = localDate(todayDate);
    } else if(/بعد\s*غد|day after/i.test(t)){
      var d2 = new Date(todayDate); d2.setDate(d2.getDate() + 2);
      dateStr = localDate(d2);
    } else if(/غد|بكرة|tomorrow/i.test(t)){
      var tm = new Date(todayDate); tm.setDate(tm.getDate() + 1);
      dateStr = localDate(tm);
    } else {
      var afterMatch = t.match(/بعد\s*(\d+)\s*(يوم|أيام|ايام|day)/);
      if(afterMatch){
        var d3 = new Date(todayDate);
        d3.setDate(d3.getDate() + parseInt(afterMatch[1], 10));
        dateStr = localDate(d3);
      } else {
        var dateMatch = t.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/);
        if(dateMatch){
          var dd = parseInt(dateMatch[1], 10);
          var mm = parseInt(dateMatch[2], 10);
          var yr = dateMatch[3] ? parseInt(dateMatch[3], 10) : todayDate.getFullYear();
          if(yr < 100) yr += 2000;
          if(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12){
            var dt = new Date(yr, mm - 1, dd);
            if(!dateMatch[3] && dt.getTime() < todayDate.getTime()){
              dt.setFullYear(yr + 1);
            }
            dateStr = localDate(dt);
          }
        } else {
          var dayNames = {
            'الأحد':0,'الاحد':0,'sunday':0,
            'الاثنين':1,'monday':1,
            'الثلاثاء':2,'tuesday':2,
            'الأربعاء':3,'الاربعاء':3,'wednesday':3,
            'الخميس':4,'thursday':4,
            'الجمعة':5,'friday':5,
            'السبت':6,'saturday':6
          };
          var lowerT = t.toLowerCase();
          for(var dn in dayNames){
            if(t.indexOf(dn) > -1 || lowerT.indexOf(dn) > -1){
              var target = dayNames[dn];
              var cur = todayDate.getDay();
              var diff = (target - cur + 7) % 7;
              if(diff === 0) diff = 7;
              var dt2 = new Date(todayDate);
              dt2.setDate(dt2.getDate() + diff);
              dateStr = localDate(dt2);
              break;
            }
          }
        }
      }
    }
    if(dateStr) result.due = dateStr;

    /* تنظيف العنوان — بدون \b للعربية */
    result.title = result.title
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

    /* تصنيف المصروف */
    if(result.type === 'expense'){
      if(/بنزين|بترول|وقود|ديزل|مواصلات|باص|تاكسي|أوبر|كريم|مترو|transport|fuel|gas|uber|careem/i.test(t)){
        result.category = 'transport';
      } else if(/طعام|أكل|مطعم|بقالة|سوبر|food|قهوة|كافيه|ساندويش|فطور|غدا|عشا/i.test(t)){
        result.category = 'food';
      } else if(/(^|\s)بن(\s|$)/i.test(t)){
        result.category = 'food';
      } else if(/كتاب|قرطاسية|books/i.test(t)){
        result.category = 'books';
      } else if(/إنترنت|انترنت|شحن|رصيد|internet/i.test(t)){
        result.category = 'internet';
      } else if(/دواء|صحة|health/i.test(t)){
        result.category = 'health';
      } else if(/ملابس|clothing/i.test(t)){
        result.category = 'clothing';
      } else if(/ترفيه|لعبة|سينما|entertainment/i.test(t)){
        result.category = 'entertainment';
      } else {
        result.category = 'other-expense';
      }
    }
    if(result.type === 'income'){
      if(/راتب|salary/i.test(t)) result.category = 'salary';
      else if(/منحة|scholarship/i.test(t)) result.category = 'scholarship';
      else if(/عمل حر|فريلانس|freelance/i.test(t)) result.category = 'freelance';
      else if(/دعم|أهل|عائلة|family/i.test(t)) result.category = 'family';
      else result.category = 'other-income';
    }

    return result;
  };

  console.log('🔗 Tabs Consistency Fix applied — all UTC bugs fixed');
})();