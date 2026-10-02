/* ============================================================
   🧰 core-utils.js v2 — الأدوات الموحدة (مُنظّف)
   - إزالة: bus, store, debounce, clone (غير مستخدمة)
   ============================================================ */
(function(){
  'use strict';
  if(window._coreUtilsLoaded) return;
  window._coreUtilsLoaded = true;

  /* ============ HTML Escape ============ */
  window.esc = function(s){
    if(s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  };

  /* ============ UID ============ */
  window.uid = function(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  /* ============ تاريخ محلي (يحل مشكلة UTC) ============ */
  window.today = function(){
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  };

  window.daysBetween = function(d1, d2){
    var t1 = new Date(d1); t1.setHours(0,0,0,0);
    var t2 = new Date(d2); t2.setHours(0,0,0,0);
    return Math.round((t2 - t1) / 86400000);
  };

  /* ============ Toast (singleton) ============ */
  window.toast = function(msg, type, dur){
    type = type || 'info'; dur = dur || 2600;
    var c = document.getElementById('toastContainer');
    if(!c){ console.log('[toast]', msg); return; }
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function(){
      t.classList.add('out');
      setTimeout(function(){ t.remove(); }, 300);
    }, dur);
  };

  /* ============ أيام موحّدة (7 أيام دائماً) ============ */
  window.DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  window.DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  window.WEEK_DAYS_AR = window.DAYS_AR.slice(0, 5);
  window.WEEK_DAYS_EN = window.DAYS_EN.slice(0, 5);

  /* ============ Helpers ============ */
  window.getSpace = function(){
    return window.space || {
      profile:{}, timetable:{}, courses:[], tasks:[],
      exams:[], attendance:{}, decks:[], budget:[], grades:[]
    };
  };

  if(!window.saveSpace){
    window.saveSpace = function(){
      if(window.S && typeof window.S.set === 'function'){
        window.S.set('space', window.space);
      }
    };
  }

  console.log('🧰 Core Utils loaded');
})();