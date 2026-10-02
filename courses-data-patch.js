/* ============================================================
   courses-data-patch.js v4 — مبسّط بعد v6 النظيف
   - v6 يحتوي كل الأكواد الصحيحة، لا حاجة لدمج
   - هذا الملف للتوافق فقط
   ============================================================ */
(function(){
  'use strict';

  if(!window.COURSES_DB){
    console.warn('[courses-data-patch] COURSES_DB not loaded');
    return;
  }
  if(window._coursesDataPatched) return;
  window._coursesDataPatched = true;

  /* تحقق من الصلاحية */
  if(typeof window.validateCoursesDB === 'function'){
    window.validateCoursesDB();
  }

  console.log('[courses-data-patch v4] No-op (v6 is clean)');
})();