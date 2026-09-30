/* ============================================================
   ⏰ lecture-reminder.js v2 — تذكير قبل المحاضرة بنطاقات آمنة
   - يفحص كل دقيقة
   - إشعار + صوت + toast
   - يستخدم نطاقات بدل تطابق تام (يتفادى تفويت الدقيقة)
   ============================================================ */
(function(){
  'use strict';

  var FIRED_KEY = 'ss_fired_lecture_reminders';
  var CHECK_INTERVAL = 60 * 1000;

  function getSpace(){ return window.space || {timetable:{}}; }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 3000); }

  function todayDate(){
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  function loadFired(){
    try{ return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function saveFired(o){
    try{ localStorage.setItem(FIRED_KEY, JSON.stringify(o)); }catch(e){}
  }

  function playChime(){
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      var ctx = new Ctx();
      var notes = [523.25, 659.25, 783.99];
      notes.forEach(function(freq, i){
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.value = freq;
        var t0 = ctx.currentTime + i * 0.15;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.15, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
        o.start(t0); o.stop(t0 + 0.5);
      });
    }catch(e){}
  }

  function checkLectures(){
    var sp = getSpace();
    var tt = sp.timetable || {};
    var DAYS_EN = window.DAYS_EN || ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var DAYS_AR = window.DAYS_AR || ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

    var now = new Date();
    var todayKey = DAYS_EN[now.getDay()];
    if(!todayKey) return;

    var nowMs = now.getTime();
    var fired = loadFired();
    var todayStr = todayDate();

    Object.keys(tt).forEach(function(key){
      var parts = key.split('-');
      if(parts[0] !== todayKey) return;
      var time = parts[1];
      var tp = time.split(':');
      var hh = parseInt(tp[0], 10);
      var mm = parseInt(tp[1], 10) || 0;
      if(isNaN(hh)) return;

      var lecture = tt[key];
      if(!lecture || !lecture.name) return;

      var lecDate = new Date(now);
      lecDate.setHours(hh, mm, 0, 0);
      var diffMs = lecDate.getTime() - nowMs;
      var diffMin = Math.round(diffMs / 60000);

      // ✅ نطاقات (10-15) بدل === 15
      var key15 = todayStr + '_' + key + '_15';
      if(diffMin <= 15 && diffMin > 10 && !fired[key15]){
        fired[key15] = true; saveFired(fired);
        showLectureReminder(lecture, diffMin, DAYS_AR[now.getDay()]);
      }

      // ✅ نطاق (2-5) بدل === 5
      var key5 = todayStr + '_' + key + '_5';
      if(diffMin <= 5 && diffMin > 1 && !fired[key5]){
        fired[key5] = true; saveFired(fired);
        showLectureReminder(lecture, diffMin, DAYS_AR[now.getDay()]);
      }

      // ✅ نطاق (-1 إلى 0) لبدء المحاضرة
      var key0 = todayStr + '_' + key + '_0';
      if(diffMin <= 0 && diffMin > -2 && !fired[key0]){
        fired[key0] = true; saveFired(fired);
        showLectureReminder(lecture, 0, DAYS_AR[now.getDay()]);
      }
    });
  }

  function showLectureReminder(lecture, minutes, dayName){
    var msg;
    if(minutes <= 0){
      msg = '🎓 **بدأت محاضرتك الآن!**';
    } else if(minutes <= 5){
      msg = '🚨 **باقي ' + minutes + ' دقائق!**';
    } else {
      msg = '⏰ **باقي ' + minutes + ' دقيقة على محاضرتك**';
    }

    var body = lecture.name;
    if(lecture.room) body += ' — 📍 ' + lecture.room;
    if(lecture.instructor) body += ' — ' + lecture.instructor;

    toast(msg.replace(/\*\*/g,'') + ' ' + body, minutes <= 5 ? 'warn' : 'info', 8000);
    playChime();

    if(typeof window.showNotif === 'function'){
      window.showNotif(msg.replace(/\*\*/g,''), body, {
        tag: 'lecture-' + Date.now(),
        requireInteraction: minutes <= 0,
        data: { tab: 'timetable' }
      });
    }
  }

  function install(){
    setTimeout(checkLectures, 10000);
    setInterval(checkLectures, CHECK_INTERVAL);
    console.log('⏰ Lecture Reminders active (ranges: 15/5/0)');
  }

  window.testLectureReminder = function(){
    var sp = getSpace();
    var first = null;
    Object.keys(sp.timetable || {}).forEach(function(k){
      if(!first) first = { key: k, cls: sp.timetable[k] };
    });
    if(!first){ toast('ما عندك محاضرات بالجدول', 'warn'); return; }
    showLectureReminder(first.cls, 15, 'اليوم');
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();