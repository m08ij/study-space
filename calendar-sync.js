/* ============================================================
   calendar-sync.js v3 - RFC 5545 Compliant
   - Uses RRULE:FREQ=WEEKLY instead of 16 separate events
   - Line folding at 75 octets
   - DTSTAMP in UTC with Z suffix
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {}; }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2600); }

  var DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAYS_ICAL = ['SU','MO','TU','WE','TH','FR','SA'];

  function pad(n){ return String(n).padStart(2, '0'); }

  function icsEscape(s){
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

  function foldLine(line){
    var seg = 74;
    if(line.length <= seg) return line;
    var out = '';
    for(var j = 0; j < line.length; j += seg){
      out += (j === 0 ? '' : '\r\n ') + line.substr(j, seg);
    }
    return out;
  }

  function icsDateLocal(y, m, d, h, mi){
    return y + pad(m) + pad(d) + 'T' + pad(h) + pad(mi) + '00';
  }

  function icsDateUTC(dt){
    return dt.getUTCFullYear() + pad(dt.getUTCMonth() + 1) + pad(dt.getUTCDate()) + 'T' +
      pad(dt.getUTCHours()) + pad(dt.getUTCMinutes()) + pad(dt.getUTCSeconds()) + 'Z';
  }

  function getNextDayOfWeek(dayIdx, hour, minute){
    var now = new Date();
    var current = now.getDay();
    var diff = (dayIdx - current + 7) % 7;
    if(diff === 0){
      var t = new Date(now);
      t.setHours(hour, minute, 0, 0);
      if(t.getTime() <= now.getTime()) diff = 7;
    }
    var dt = new Date(now);
    dt.setDate(dt.getDate() + diff);
    dt.setHours(hour, minute, 0, 0);
    return dt;
  }

  function hashString(s){
    var h = 0;
    for(var i = 0; i < s.length; i++){
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return h;
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
      var hh = parseInt(tp[0], 10);
      var mm = parseInt(tp[1], 10) || 0;

      var start = getNextDayOfWeek(dayIdx, hh, mm);
      var dtEnd = new Date(start);
      dtEnd.setHours(dtEnd.getHours() + 1);

      var uidBase = 'tt-' + dayEn + '-' + pad(hh) + pad(mm) + '-' +
        Math.abs(hashString(cls.name)).toString(36);

      events.push({
        uid: uidBase + '@studyspace',
        summary: '\uD83D\uDCDA ' + cls.name,
        location: cls.room || '',
        description: (cls.instructor ? '\u062F. ' + cls.instructor + '\\n' : '') + '\u0645\u062D\u0627\u0636\u0631\u0629 \u0623\u0633\u0628\u0648\u0639\u064A\u0629',
        startLocal: icsDateLocal(start.getFullYear(), start.getMonth() + 1, start.getDate(), hh, mm),
        endLocal: icsDateLocal(dtEnd.getFullYear(), dtEnd.getMonth() + 1, dtEnd.getDate(), dtEnd.getHours(), dtEnd.getMinutes()),
        rrule: 'FREQ=WEEKLY;COUNT=16;BYDAY=' + DAYS_ICAL[dayIdx],
        alarm: false
      });
    });
    return events;
  }

  function buildExamEvents(){
    var sp = getSpace();
    var events = [];

    (sp.exams || []).forEach(function(e){
      if(!e.date) return;
      var p = e.date.split('-');
      if(p.length !== 3) return;

      var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
      var hh = 9, mm = 0;
      if(e.time && /^\d{1,2}:\d{2}/.test(e.time)){
        var tp = e.time.split(':');
        hh = parseInt(tp[0], 10);
        mm = parseInt(tp[1], 10) || 0;
      }

      var dtEnd = new Date(y, m - 1, d, hh, mm);
      dtEnd.setHours(dtEnd.getHours() + 2);

      var uidBase = 'exam-' + y + pad(m) + pad(d) + '-' +
        Math.abs(hashString(e.name || e.id || 'x')).toString(36);

      events.push({
        uid: uidBase + '@studyspace',
        summary: '\uD83D\uDCDD \u0627\u0645\u062A\u062D\u0627\u0646: ' + (e.name || ''),
        location: e.room || '',
        description: (e.course ? '\uD83D\uDCDA ' + e.course + '\\n' : '') + '\u23F0 ' + (e.time || '\u064A\u062D\u062F\u062F \u0644\u0627\u062D\u0642\u0627\u064B'),
        startLocal: icsDateLocal(y, m, d, hh, mm),
        endLocal: icsDateLocal(dtEnd.getFullYear(), dtEnd.getMonth() + 1, dtEnd.getDate(), dtEnd.getHours(), dtEnd.getMinutes()),
        rrule: '',
        alarm: true
      });
    });
    return events;
  }

  function buildTaskEvents(){
    var sp = getSpace();
    var events = [];

    (sp.tasks || []).forEach(function(t){
      if(t.done || !t.due) return;
      var p = t.due.split('-');
      if(p.length !== 3) return;

      var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
      var uidBase = 'task-' + y + pad(m) + pad(d) + '-' +
        Math.abs(hashString(t.title || t.id || 'x')).toString(36);

      events.push({
        uid: uidBase + '@studyspace',
        summary: '\u23F0 \u062A\u0633\u0644\u064A\u0645: ' + (t.title || ''),
        location: '',
        description: (t.course ? '\uD83D\uDCDA ' + t.course + '\\n' : '') + '\uD83D\uDCDD \u0646\u0648\u0639: ' + (t.type || '\u0645\u0647\u0645\u0629'),
        startLocal: icsDateLocal(y, m, d, 23, 0),
        endLocal: icsDateLocal(y, m, d, 23, 30),
        rrule: '',
        alarm: true
      });
    });
    return events;
  }

  function buildICS(){
    var sp = getSpace();
    var name = (sp.profile && sp.profile.name) || '\u0637\u0627\u0644\u0628';
    var nowUtc = icsDateUTC(new Date());

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//StudySpace//Calendar Sync v3//AR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEscape('\u0645\u0633\u0627\u062D\u062A\u064A \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629 \u2014 ' + name),
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
      lines.push('DTSTAMP:' + nowUtc);
      lines.push('DTSTART;TZID=Asia/Amman:' + ev.startLocal);
      lines.push('DTEND;TZID=Asia/Amman:' + ev.endLocal);
      lines.push('SUMMARY:' + icsEscape(ev.summary));
      if(ev.location) lines.push('LOCATION:' + icsEscape(ev.location));
      if(ev.description) lines.push('DESCRIPTION:' + icsEscape(ev.description));
      if(ev.rrule) lines.push('RRULE:' + ev.rrule);
      if(ev.alarm){
        lines.push('BEGIN:VALARM');
        lines.push('TRIGGER:-PT2H');
        lines.push('ACTION:DISPLAY');
        lines.push('DESCRIPTION:' + icsEscape(ev.summary));
        lines.push('END:VALARM');
      }
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n');
  }

  function downloadICS(){
    try{
      var ics = buildICS();
      var blob = new Blob([ics], {type: 'text/calendar;charset=utf-8'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'study-space-' + new Date().toISOString().slice(0, 10) + '.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
      toast('\uD83D\uDCC5 \u062A\u0645 \u062A\u0646\u0632\u064A\u0644 \u0645\u0644\u0641 \u0627\u0644\u062A\u0642\u0648\u064A\u0645', 'success', 4000);
    }catch(e){
      console.error(e);
      toast('\u0641\u0634\u0644 \u0627\u0644\u062A\u0635\u062F\u064A\u0631', 'warn');
    }
  }

  function injectButton(){
    var menu = document.getElementById('settingsMenu');
    if(!menu || menu.querySelector('#calSyncBtn')) return;

    var btn = document.createElement('button');
    btn.className = 'settings-item';
    btn.id = 'calSyncBtn';
    btn.innerHTML = '<span>\uD83D\uDCC5</span> \u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u062A\u0642\u0648\u064A\u0645 (.ics)';
    btn.addEventListener('click', function(){
      if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
      downloadICS();
    });

    var pdfBtn = menu.querySelector('#pdfBtn');
    if(pdfBtn) menu.insertBefore(btn, pdfBtn);
    else menu.appendChild(btn);
  }

  window.downloadICS = downloadICS;
  window.buildICS = buildICS;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(injectButton, 600); });
  else setTimeout(injectButton, 600);
  console.log('\uD83D\uDCC5 Calendar Sync v3 loaded \u2014 RFC 5545 compliant');
})();