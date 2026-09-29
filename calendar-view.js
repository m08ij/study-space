/* ============================================================
   📅 calendar-view.js — تقويم شهري موحّد
   - عرض شهري للمهام + الامتحانات + المحاضرات
   - اضغط أي يوم → تفاصيل
   - زر "اليوم" للعودة
   - إضافة كمودال قابل للفتح من أي مكان
   ============================================================ */
(function(){
  'use strict';

  var DAYS_AR = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
  var MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  var currentDate = new Date();
  var currentView = 'month';

  function getSpace(){ return window.space || {tasks:[],exams:[],timetable:{}}; }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function pad(n){ return String(n).padStart(2,'0'); }
  function dateKey(d){ return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function parseDate(s){
    if(!s) return null;
    var p = String(s).split('-');
    if(p.length !== 3) return null;
    return new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10));
  }

  function getEventsForDate(d){
    var sp = getSpace();
    var events = [];
    var dk = dateKey(d);

    // امتحانات
    (sp.exams || []).forEach(function(e){
      if(e.date === dk) events.push({ type:'exam', icon:'📝', title: e.name, time: e.time || '', room: e.room || '', raw: e });
    });

    // مهام
    (sp.tasks || []).forEach(function(t){
      if(t.due === dk) events.push({ type:'task', icon: t.done ? '✅' : '📌', title: t.title, time:'', done: t.done, raw: t });
    });

    // محاضرات
    var DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var dayEn = DAYS_EN[d.getDay()];
    Object.keys(sp.timetable || {}).forEach(function(k){
      if(k.indexOf(dayEn) === 0){
        var parts = k.split('-');
        var time = parts[1];
        var cls = sp.timetable[k];
        if(cls && cls.name){
          events.push({ type:'lecture', icon:'📖', title: cls.name, time: time, room: cls.room || '', raw: cls });
        }
      }
    });

    events.sort(function(a,b){ return (a.time || '99:99').localeCompare(b.time || '99:99'); });
    return events;
  }

  function buildMonthGrid(date){
    var year = date.getFullYear();
    var month = date.getMonth();
    var first = new Date(year, month, 1);
    var last = new Date(year, month + 1, 0);
    var startDay = first.getDay(); // 0-6
    var daysInMonth = last.getDate();

    // نعرض 6 أسابيع (42 يوم) كحد أدنى
    var cells = [];
    // أيام الشهر السابق
    var prevLast = new Date(year, month, 0).getDate();
    for(var i = startDay - 1; i >= 0; i--){
      cells.push({
        date: new Date(year, month - 1, prevLast - i),
        inMonth: false
      });
    }
    // أيام الشهر الحالي
    for(var d = 1; d <= daysInMonth; d++){
      cells.push({
        date: new Date(year, month, d),
        inMonth: true
      });
    }
    // نكمل لـ 42
    while(cells.length < 42){
      var idx = cells.length - (startDay + daysInMonth) + 1;
      cells.push({
        date: new Date(year, month + 1, idx),
        inMonth: false
      });
    }

    return cells;
  }

  function renderCalendar(){
    var body = document.getElementById('cvBody');
    if(!body) return;

    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();
    var cells = buildMonthGrid(currentDate);
    var todayStr = dateKey(new Date());

    var html = '';

    // Header
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:8px 4px">' +
      '<button class="btn btn-sm btn-ghost" id="cvPrev" style="padding:6px 12px">→ السابق</button>' +
      '<div style="text-align:center">' +
        '<div style="font-size:1.15rem;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">' + MONTHS_AR[month] + ' ' + year + '</div>' +
        '<button class="btn btn-sm btn-ghost" id="cvToday" style="margin-top:4px;padding:4px 12px;font-size:.72rem">📍 اليوم</button>' +
      '</div>' +
      '<button class="btn btn-sm btn-ghost" id="cvNext" style="padding:6px 12px">التالي ←</button>' +
    '</div>';

    // Grid
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:12px">';
    DAYS_AR.forEach(function(d){
      html += '<div style="text-align:center;font-size:.7rem;font-weight:700;color:var(--muted);padding:6px 0">' + d + '</div>';
    });
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px" id="cvGrid">';
    cells.forEach(function(cell){
      var dk = dateKey(cell.date);
      var isToday = dk === todayStr;
      var events = getEventsForDate(cell.date);

      var dayNum = cell.date.getDate();
      var bg = isToday ? 'background:var(--grad);color:#0b0f1a' : (cell.inMonth ? 'background:var(--card)' : 'background:var(--bg2);opacity:.5');
      var border = isToday ? 'border-color:var(--cyan)' : 'border-color:var(--border)';

      html += '<button class="cv-day" data-date="' + dk + '" type="button" style="' +
        bg + ';border:1px solid ' + border + ';border-radius:10px;padding:6px 4px;min-height:58px;display:flex;flex-direction:column;align-items:stretch;gap:3px;cursor:pointer;font-family:inherit;position:relative;transition:.15s">' +
        '<div style="font-size:.78rem;font-weight:800;text-align:right;color:' + (isToday ? '#0b0f1a' : (cell.inMonth ? 'var(--text)' : 'var(--muted2)')) + '">' + dayNum + '</div>';

      // Events indicators
      if(events.length){
        html += '<div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:flex-end">';
        var shown = events.slice(0, 3);
        shown.forEach(function(e){
          var dotColor = e.type === 'exam' ? 'var(--red)' : e.type === 'task' ? 'var(--amber)' : 'var(--cyan)';
          html += '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + dotColor + '"></span>';
        });
        if(events.length > 3){
          html += '<span style="font-size:.55rem;color:var(--muted);font-weight:700">+' + (events.length - 3) + '</span>';
        }
        html += '</div>';
      }

      html += '</button>';
    });
    html += '</div>';

    // Legend
    html += '<div style="display:flex;gap:14px;justify-content:center;margin-top:16px;font-size:.72rem;color:var(--muted);flex-wrap:wrap">' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--red);margin-left:4px"></span> امتحان</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--amber);margin-left:4px"></span> مهمة</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--cyan);margin-left:4px"></span> محاضرة</span>' +
    '</div>';

    body.innerHTML = html;

    // Bind
    var prev = document.getElementById('cvPrev');
    var next = document.getElementById('cvNext');
    var today = document.getElementById('cvToday');
    if(prev) prev.onclick = function(){ currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
    if(next) next.onclick = function(){ currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
    if(today) today.onclick = function(){ currentDate = new Date(); renderCalendar(); };

    document.querySelectorAll('.cv-day').forEach(function(b){
      b.addEventListener('click', function(){
        var dk = b.dataset.date;
        openDayDetails(dk);
      });
      b.addEventListener('mouseenter', function(){ b.style.transform = 'translateY(-2px)'; });
      b.addEventListener('mouseleave', function(){ b.style.transform = 'translateY(0)'; });
    });
  }

  function openDayDetails(dateStr){
    var d = parseDate(dateStr);
    if(!d) return;
    var events = getEventsForDate(d);

    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';

    var title = d.getDate() + ' ' + MONTHS_AR[d.getMonth()] + ' ' + d.getFullYear();
    var html = '<div class="modal" style="max-width:500px"><h3>📅 ' + title + '</h3>';

    if(!events.length){
      html += '<div class="empty" style="padding:24px"><div class="ic">🌴</div><p>ما في أحداث هذا اليوم</p></div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto">';
      events.forEach(function(e){
        var color = e.type === 'exam' ? 'var(--red)' : e.type === 'task' ? 'var(--amber)' : 'var(--cyan)';
        var typeLabel = e.type === 'exam' ? 'امتحان' : e.type === 'task' ? 'مهمة' : 'محاضرة';
        html += '<div style="padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;border-right:3px solid ' + color + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">' +
            '<span style="font-weight:700;font-size:.88rem">' + e.icon + ' ' + esc(e.title) + '</span>' +
            '<span style="font-size:.65rem;padding:2px 8px;border-radius:6px;background:' + color + '20;color:' + color + ';font-weight:700">' + typeLabel + '</span>' +
          '</div>' +
          '<div style="font-size:.72rem;color:var(--muted)">' +
            (e.time ? '⏰ ' + e.time : '') +
            (e.room ? ' · 📍 ' + esc(e.room) : '') +
            (e.done ? ' · ✅ منجزة' : '') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '<div class="modal-actions"><button class="btn btn-sm btn-ghost" id="cvClose">إغلاق</button></div></div>';
    bd.innerHTML = html;
    document.body.appendChild(bd);

    bd.querySelector('#cvClose').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
  }

  function openCalendar(){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:640px;padding:22px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<h3 style="margin:0">📅 التقويم</h3>' +
          '<button class="btn btn-sm btn-ghost" id="cvCloseTop">✕</button>' +
        '</div>' +
        '<div id="cvBody"></div>' +
      '</div>';
    document.body.appendChild(bd);
    bd.querySelector('#cvCloseTop').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
    renderCalendar();
  }

  /* ============ زر في الإعدادات + عرض في Dashboard ============ */
  function injectButtons(){
    // إضافة زر في الـ settings menu
    var menu = document.getElementById('settingsMenu');
    if(menu && !menu.querySelector('#calViewBtn')){
      var btn = document.createElement('button');
      btn.className = 'settings-item';
      btn.id = 'calViewBtn';
      btn.innerHTML = '<span>📅</span> التقويم الشهري';
      btn.addEventListener('click', function(){
        if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
        openCalendar();
      });
      var divider = menu.querySelector('.settings-divider');
      if(divider) menu.insertBefore(btn, divider);
      else menu.appendChild(btn);
    }

    // إضافة زر في الـ dashboard
    var dash = document.getElementById('dashboard');
    if(dash && !document.getElementById('dashCalendarBtn')){
      var head = dash.querySelector('.page-head');
      if(head){
        var quickBtn = document.createElement('button');
        quickBtn.className = 'btn btn-sm btn-ghost';
        quickBtn.id = 'dashCalendarBtn';
        quickBtn.style.cssText = 'position:absolute;left:0;top:0';
        quickBtn.innerHTML = '📅 التقويم';
        quickBtn.onclick = openCalendar;
        head.style.position = 'relative';
        head.appendChild(quickBtn);
      }
    }
  }

  window.openCalendar = openCalendar;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(injectButtons, 1200); });
  } else {
    setTimeout(injectButtons, 1200);
  }
  console.log('📅 Calendar View loaded');
})();