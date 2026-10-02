/* ============================================================
   🔗 data-logic-fixes.js — توحيد منطق التواريخ
   - renderDashboard بـ local date
   - addBudgetItem بـ local date
   - arabicDays بإملاء صحيح
   ============================================================ */
(function(){
  'use strict';
  if(window._dataLogicFixesLoaded) return;
  window._dataLogicFixesLoaded = true;

  function localDate(d){
    if(!(d instanceof Date)) d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  /* ============================================================
     1) addBudgetItem — local date افتراضياً
     ============================================================ */
  window.addBudgetItem = function(type){
    var BC = window.BUDGET_CATS || [];
    var catOpts = BC.filter(function(c){
      if(type === 'income'){
        return ['salary','family','scholarship','freelance','other-income'].indexOf(c.v) > -1;
      }
      return ['salary','family','scholarship','freelance','other-income'].indexOf(c.v) === -1;
    }).map(function(c){ return { v: c.v, l: c.i + ' ' + c.l }; });

    if(!catOpts.length){
      if(window.toast) window.toast('التصنيفات غير محملة', 'warn');
      return;
    }

    var defaultDate = localDate();

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
      date: defaultDate,
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
        date: data.date || localDate(),
        note: data.note || ''
      });
      if(window.saveSpace) window.saveSpace();
      if(typeof window.renderBudget === 'function') window.renderBudget();
      if(typeof window.renderDashboard === 'function') window.renderDashboard();
      return true;
    });
  };

  /* ============================================================
     2) renderDashboard — local dates
     ============================================================ */
  window.renderDashboard = function(){
    if(typeof window.renderDailyQuote === 'function') window.renderDailyQuote();

    var space = window.space || {};
    var notes = window.notes || [];
    var DAYS_EN = window.DAYS_EN || ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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
    var todayStr = localDate();                 /* ✅ local */

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

    /* إحصائيات */
    var pending = (space.tasks || []).filter(function(t){ return !t.done; }).length;
    var budget = space.budget || [];
    var income = budget.filter(function(b){ return b.type === 'income'; })
      .reduce(function(a,b){ return a + (parseFloat(b.amount) || 0); }, 0);
    var expense = budget.filter(function(b){ return b.type === 'expense'; })
      .reduce(function(a,b){ return a + (parseFloat(b.amount) || 0); }, 0);
    var balance = income - expense;

    var dsEl = document.getElementById('dashStats');
    if(dsEl){
      dsEl.innerHTML =
        '<div class="stat"><div class="ic">📚</div><div><div class="v">' +
          (space.courses || []).length + '</div><div class="l">مادة مسجّلة</div></div></div>' +
        '<div class="stat"><div class="ic">📝</div><div><div class="v">' +
          pending + '</div><div class="l">مهمة متبقية</div></div></div>' +
        '<div class="stat"><div class="ic">⏳</div><div><div class="v">' +
          (space.exams || []).length + '</div><div class="l">امتحان قادم</div></div></div>' +
        '<div class="stat"><div class="ic">📊</div><div><div class="v">' +
          (space.grades ? space.grades.length : 0) + '</div><div class="l">مادة في علاماتي</div></div></div>';
    }

    /* محاضرات اليوم */
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
            '<div><div style="font-size:.86rem;font-weight:600">' + (window.esc ? window.esc(cls.name) : cls.name) + '</div>' +
            (cls.room ? '<div style="font-size:.72rem;color:var(--muted)">📍 ' +
              (window.esc ? window.esc(cls.room) : cls.room) + '</div>' : '') + '</div></div>';
        });
        tc.innerHTML = h;
      }
    }

    /* مهام قادمة — local date */
    var ut = document.getElementById('upcomingTasks');
    if(ut){
      var wl = new Date(); wl.setDate(wl.getDate() + 7);
      var weekLater = localDate(wl);                   /* ✅ local */
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
            '<div style="flex:1;font-size:.84rem">' + (window.esc ? window.esc(t.title) : t.title) + '</div></div>';
        });
        ut.innerHTML = h2;
      }
    }

    /* الميزانية */
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

    /* آخر الملاحظات */
    var dn = document.getElementById('dashNotes');
    if(dn){
      var recent = notes.slice(0, 3);
      if(!recent.length){
        dn.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.85rem">📔 لا توجد ملاحظات</div>';
      } else {
        var hn = '';
        recent.forEach(function(n){
          hn += '<div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:.84rem">' +
            '<div style="font-weight:600">' + (window.esc ? window.esc(n.title || 'بدون عنوان') : (n.title || 'بدون عنوان')) + '</div>' +
            '<div style="font-size:.73rem;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
              (window.esc ? window.esc((n.body || '').slice(0, 50)) : (n.body || '').slice(0, 50)) + '</div></div>';
        });
        dn.innerHTML = hn;
      }
    }

    try{ if(typeof window.renderStats === 'function') window.renderStats(); }catch(e){}
    try{ if(typeof window.updateTimerUI === 'function') window.updateTimerUI(); }catch(e){}
  };

  /* ============================================================
     3) arabicDays — إملاء صحيح
     ============================================================ */
  window.arabicDays = function(n){
    n = Math.abs(parseInt(n, 10) || 0);
    if(n === 0) return 'اليوم';
    if(n === 1) return 'يوم';
    if(n === 2) return 'يومان';
    if(n >= 3 && n <= 10) return n + ' أيام';
    return n + ' يومًا';
  };

  console.log('🔗 Data Logic Fixes loaded — dates unified');
})();