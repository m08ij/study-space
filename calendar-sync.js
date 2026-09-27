/* ============================================================
   📅 calendar-sync.js — تصدير الجدول والامتحانات لـ Google Calendar
   يولّد ملف .ics يفتح مباشرة في تقويم الجوال
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {}; }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2600); }
  function esc(s){ return String(s == null ? '' : s).replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n'); }

  var DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAYS_ICAL = ['SU','MO','TU','WE','TH','FR','SA'];

  /* ============ توليد ICS ============ */
  function pad(n){ return String(n).padStart(2, '0'); }

  function icsDate(y, m, d, h, mi){
    return y + pad(m) + pad(d) + 'T' + pad(h) + pad(mi) + '00';
  }

  function icsDT(y, m, d, h, mi){
    return 'DTSTART;TZID=Asia/Amman:' + icsDate(y, m, d, h, mi);
  }

  function getNextDayOfWeek(dayIdx, hour, minute){
    var now = new Date();
    var current = now.getDay();
    var diff = (dayIdx - current + 7) % 7;
    if(diff === 0){
      // إذا اليوم نفسه، شيك الوقت
      var target = new Date(now);
      target.setHours(hour, minute, 0, 0);
      if(target.getTime() <= now.getTime()) diff = 7;
    }
    var dt = new Date(now);
    dt.setDate(dt.getDate() + diff);
    dt.setHours(hour, minute, 0, 0);
    return dt;
  }

  function buildTimetableEvents(){
    var sp = getSpace();
    var events = [];
    var tt = sp.timetable || {};
    Object.keys(tt).forEach(function(key){
      var parts = key.split('-');
      var dayEn = parts[0];
      var time = parts[1];
      var dayIdx = DAYS_EN.indexOf(dayEn);
      if(dayIdx === -1) return;
      var cls = tt[key];
      if(!cls || !cls.name) return;
      var tp = time.split(':');
      var hh = parseInt(tp[0], 10); var mm = parseInt(tp[1], 10) || 0;

      // ابدأ من بكرة (أو اليوم) — كرر 16 أسبوع
      var start = getNextDayOfWeek(dayIdx, hh, mm);
      for(var week = 0; week < 16; week++){
        var dt = new Date(start);
        dt.setDate(dt.getDate() + week * 7);
        var dtEnd = new Date(dt);
        dtEnd.setHours(dt.getHours() + 1);

        events.push({
          uid: 'tt-' + key + '-' + week + '@studyspace',
          summary: '📚 ' + cls.name,
          location: cls.room || '',
          description: (cls.instructor ? 'د. ' + cls.instructor : '') + '\nمحاضرة أسبوعية',
          start: icsDate(dt.getFullYear(), dt.getMonth()+1, dt.getDate(), dt.getHours(), dt.getMinutes()),
          end:   icsDate(dtEnd.getFullYear(), dtEnd.getMonth()+1, dtEnd.getDate(), dtEnd.getHours(), dtEnd.getMinutes()),
          rrule: ''
        });
      }
    });
    return events;
  }

  function buildExamEvents(){
    var sp = getSpace();
    var events = [];
    (sp.exams || []).forEach(function(e){
      if(!e.date) return;
      var parts = e.date.split('-');
      if(parts.length !== 3) return;
      var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
      var hh = 9, mm = 0;
      if(e.time && /^\d{1,2}:\d{2}/.test(e.time)){
        var tp = e.time.split(':');
        hh = parseInt(tp[0], 10); mm = parseInt(tp[1], 10) || 0;
      }
      var dtEnd = new Date(y, m-1, d, hh, mm);
      dtEnd.setHours(dtEnd.getHours() + 2);

      events.push({
        uid: 'exam-' + (e.id || e.name) + '@studyspace',
        summary: '📝 امتحان: ' + e.name,
        location: e.room || '',
        description: (e.course ? '📚 ' + e.course : '') + '\n⏰ ' + (e.time || 'يحدد لاحقاً'),
        start: icsDate(y, m, d, hh, mm),
        end:   icsDate(dtEnd.getFullYear(), dtEnd.getMonth()+1, dtEnd.getDate(), dtEnd.getHours(), dtEnd.getMinutes())
      });
    });
    return events;
  }

  function buildTaskEvents(){
    var sp = getSpace();
    var events = [];
    (sp.tasks || []).forEach(function(t){
      if(t.done || !t.due) return;
      var parts = t.due.split('-');
      if(parts.length !== 3) return;
      var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
      events.push({
        uid: 'task-' + (t.id || t.title) + '@studyspace',
        summary: '⏰ تسليم: ' + t.title,
        location: '',
        description: (t.course ? '📚 ' + t.course : '') + '\n📝 نوع: ' + (t.type || 'مهمة'),
        start: icsDate(y, m, d, 23, 0),
        end:   icsDate(y, m, d, 23, 30),
        alarm: true
      });
    });
    return events;
  }

  function buildICS(){
    var sp = getSpace();
    var name = (sp.profile && sp.profile.name) || 'طالب';
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//StudySpace//Calendar Sync//AR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:مساحتي الدراسية — ' + esc(name),
      'X-WR-TIMEZONE:Asia/Amman',
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Amman',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0300',
      'TZOFFSETTO:+0300',
      'TZNAME:+03',
      'END:STANDARD',
      'END:VTIMEZONE'
    ];

    var all = [].concat(buildTimetableEvents(), buildExamEvents(), buildTaskEvents());
    all.forEach(function(ev){
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + ev.uid);
      lines.push('DTSTAMP:' + icsDate(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate(), new Date().getHours(), new Date().getMinutes()));
      lines.push('DTSTART;TZID=Asia/Amman:' + ev.start);
      lines.push('DTEND;TZID=Asia/Amman:' + ev.end);
      lines.push('SUMMARY:' + esc(ev.summary));
      if(ev.location) lines.push('LOCATION:' + esc(ev.location));
      if(ev.description) lines.push('DESCRIPTION:' + esc(ev.description));
      if(ev.alarm){
        lines.push('BEGIN:VALARM');
        lines.push('TRIGGER:-PT2H');
        lines.push('ACTION:DISPLAY');
        lines.push('DESCRIPTION:' + esc(ev.summary));
        lines.push('END:VALARM');
      }
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /* ============ التصدير ============ */
  function downloadICS(){
    try{
      var ics = buildICS();
      var blob = new Blob([ics], {type: 'text/calendar;charset=utf-8'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'study-space-' + new Date().toISOString().slice(0,10) + '.ics';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
      toast('📅 تم تنزيل ملف التقويم — افتحه لإضافته', 'success', 4000);
    }catch(e){
      console.error(e);
      toast('فشل التصدير', 'warn');
    }
  }

  function copyGoogleCalendarLink(){
    // رابط "إضافة إلى Google Calendar" مباشرة
    var sp = getSpace();
    var firstExam = (sp.exams || [])[0];
    if(!firstExam){ toast('ما عندك امتحانات بعد', 'warn'); return; }
    var parts = (firstExam.date || '').split('-');
    if(parts.length !== 3) return;
    var d = parts[0] + parts[1] + parts[2];
    var next = new Date(firstExam.date);
    next.setDate(next.getDate() + 1);
    var d2 = next.toISOString().slice(0,10).replace(/-/g,'');

    var url = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent('📝 امتحان: ' + firstExam.name) +
      '&dates=' + d + '/' + d2 +
      (firstExam.room ? '&location=' + encodeURIComponent(firstExam.room) : '') +
      (firstExam.course ? '&details=' + encodeURIComponent('📚 ' + firstExam.course) : '');

    window.open(url, '_blank');
  }

  /* ============ الزر في الإعدادات ============ */
  function injectButton(){
    var menu = document.getElementById('settingsMenu');
    if(!menu || menu.querySelector('#calSyncBtn')) return;
    var btn = document.createElement('button');
    btn.className = 'settings-item';
    btn.id = 'calSyncBtn';
    btn.innerHTML = '<span>📅</span> مزامنة التقويم (.ics)';
    btn.addEventListener('click', function(){
      if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
      downloadICS();
    });
    // أدخله قبل زر PDF
    var pdfBtn = menu.querySelector('#pdfBtn');
    if(pdfBtn) menu.insertBefore(btn, pdfBtn);
    else menu.appendChild(btn);

    // زر "Google Calendar مباشر"
    var btn2 = document.createElement('button');
    btn2.className = 'settings-item';
    btn2.id = 'calGoogleBtn';
    btn2.innerHTML = '<span>🔗</span> إضافة امتحان لـ Google Calendar';
    btn2.addEventListener('click', function(){
      if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
      copyGoogleCalendarLink();
    });
    if(pdfBtn) menu.insertBefore(btn2, pdfBtn);
    else menu.appendChild(btn2);
  }

  window.downloadICS = downloadICS;
  window.buildICS = buildICS;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(injectButton, 600); });
  else setTimeout(injectButton, 600);
  console.log('📅 Calendar Sync loaded');
})();