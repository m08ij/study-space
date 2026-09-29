/* ============================================================
   ⏰ lecture-reminder.js — تذكير قبل المحاضرة بـ 15 دقيقة
   - يفحص كل دقيقة
   - إشعار + صوت + toast
   - يفتكر أي محاضرة انتبه لها اليوم
   ============================================================ */
(function(){
  'use strict';

  var FIRED_KEY = 'ss_fired_lecture_reminders';
  var CHECK_INTERVAL = 60 * 1000;    // كل دقيقة
  var REMIND_BEFORE = 15;            // 15 دقيقة
  var SECOND_REMIND = 5;             // + تذكير ثاني قبل 5 دقائق

  function getSpace(){ return window.space || {timetable:{}}; }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 3000); }
  function getS(){ return window.S || {get:function(k,d){return d;}, set:function(){}}; }

  function todayDate(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function loadFired(){
    try{ return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}') || {}; }catch(e){ return {}; }
  }
  function saveFired(o){
    try{ localStorage.setItem(FIRED_KEY, JSON.stringify(o)); }catch(e){}
  }

  function playChime(){
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      var ctx = new Ctx();
      // نغمة ثلاثية
      var notes = [523.25, 659.25, 783.99];  // C5, E5, G5
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
    var DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
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
      var time = parts[1]; // "08:00"
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

      // fire15
      var key15 = todayStr + '_' + key + '_15';
      if(diffMin === REMIND_BEFORE && !fired[key15]){
        fired[key15] = true;
        saveFired(fired);
        showLectureReminder(lecture, diffMin, DAYS_AR[now.getDay()]);
      }

      // fire5
      var key5 = todayStr + '_' + key + '_5';
      if(diffMin === SECOND_REMIND && !fired[key5]){
        fired[key5] = true;
        saveFired(fired);
        showLectureReminder(lecture, diffMin, DAYS_AR[now.getDay()]);
      }

      // fire عند البدء (0)
      var key0 = todayStr + '_' + key + '_0';
      if(diffMin === 0 && !fired[key0]){
        fired[key0] = true;
        saveFired(fired);
        showLectureReminder(lecture, 0, DAYS_AR[now.getDay()]);
      }
    });
  }

  function showLectureReminder(lecture, minutes, dayName){
    var msg;
    if(minutes === 0){
      msg = '🎓 **بدأت محاضرتك الآن!**';
    } else if(minutes === 5){
      msg = '🚨 **باقي 5 دقائق!**';
    } else {
      msg = '⏰ **باقي ' + minutes + ' دقيقة على محاضرتك**';
    }

    var body = lecture.name;
    if(lecture.room) body += ' — 📍 ' + lecture.room;
    if(lecture.instructor) body += ' — ' + lecture.instructor;

    // Toast
    toast(msg.replace(/\*\*/g,'') + ' ' + body, minutes <= 5 ? 'warn' : 'info', 8000);

    // صوت
    playChime();

    // إشعار المتصفح
    if(typeof window.showNotif === 'function'){
      window.showNotif(msg.replace(/\*\*/g,''), body, {
        tag: 'lecture-' + Date.now(),
        requireInteraction: minutes === 0,
        data: { tab: 'timetable' }
      });
    }
  }

  function install(){
    // أول فحص بعد 10 ثواني من التحميل
    setTimeout(checkLectures, 10000);
    // ثم كل دقيقة
    setInterval(checkLectures, CHECK_INTERVAL);
    console.log('⏰ Lecture Reminders active (15 + 5 + 0 min before)');
  }

  // زر اختبار
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