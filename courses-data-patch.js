/* ============================================================
   courses-data-patch.js v5 — Legacy Code Aliases
   - PDF يستخدم أكواداً قديمة كمراجع (1701081137, 110408340, ...)
   - نضيفها كـ aliases للبحث
   - نصلح pre-references التي تستخدم الأكواد القديمة
   ============================================================ */
(function(){
  'use strict';

  if(!window.COURSES_DB){
    console.warn('[courses-data-patch] COURSES_DB not loaded');
    return;
  }
  if(window._coursesDataPatchedV5) return;
  window._coursesDataPatchedV5 = true;

  /* ============================================================
     خريطة الأكواد القديمة → اسم المادة الحالي (من PDF الرسمي)
     ============================================================ */
  var LEGACY_CODES = {
    /* راجع PDF صفحة 6 — Faculty Requirements */
    '1701081137': 'اساسيات الكيمياء العامة',
    '1701081136': 'فيزياء عامة (1)',

    /* راجع PDF صفحات 7-8 — Specialization Compulsory */
    '110408340':  'تنظيم حاسوب',
    '110408362':  'انظمة مضمنة',
    '110408423':  'الالكترونيات الرقمية والدارات المتكاملة',

    /* راجع PDF صفحة 7 — pre لـ Signals and Systems */
    '110406260':  'تفاضل وتكامل (2)',
    '2104091201': 'معادلات تفاضلية عادية (1)',

    /* بدائل شائعة */
    '110108112':  'برمجة الحاسوب',
    '111001250':  'هيكلية البيانات',

    /* استدراكية — راجع PDF صفحة 12 */
    '21100960':   'مهارات الحاسوب / استدراكية',
    '21200960':   'لغة انجليزية / استدراكية',
    '211009601':  'مهارات الحاسوب / استدراكية',
    '212009601':  'لغة انجليزية / استدراكية',

    /* من بياناتك السابقة */
    '1701081138': 'اساسيات الكيمياء العامة العملية',
    '121601099':  'لغة عربية / استدراكية'
  };

  var DB = window.COURSES_DB;
  var addedAliases = 0;

  /* ============================================================
     1) أضف الأكواد القديمة كـ aliases
     ============================================================ */
  Object.keys(LEGACY_CODES).forEach(function(oldCode){
    var targetName = LEGACY_CODES[oldCode];
    if(!DB[targetName]) return;
    if(!Array.isArray(DB[targetName].aliases)) DB[targetName].aliases = [];
    if(DB[targetName].aliases.indexOf(oldCode) === -1){
      DB[targetName].aliases.push(oldCode);
      addedAliases++;
    }
  });

  /* ============================================================
     2) أصلح pre-references التي تستخدم الأكواد القديمة
     ============================================================ */
  var fixedPres = 0;
  Object.keys(DB).forEach(function(name){
    if(!Array.isArray(DB[name].pre)) return;
    DB[name].pre = DB[name].pre.map(function(p){
      if(DB[p]) return p;                     /* already اسم مادة */
      if(LEGACY_CODES[p] && DB[LEGACY_CODES[p]]){
        fixedPres++;
        return LEGACY_CODES[p];
      }
      return p;                                /* لا يمكن حله */
    });
  });

  /* ============================================================
     3) إعادة بناء COURSE_BY_CODE
     ============================================================ */
  var byCode = {};
  Object.keys(DB).forEach(function(name){
    var c = String(DB[name].code || '').replace(/^0+/, '');
    if(!c) return;
    if(!byCode[c]) byCode[c] = [];
    byCode[c].push(name);
    /* أضف الأكواد القديمة كـ indexable أيضاً */
    (DB[name].aliases || []).forEach(function(a){
      var clean = String(a).replace(/^0+/, '');
      if(!clean || !/^\d+$/.test(clean)) return;
      if(!byCode[clean]) byCode[clean] = [];
      if(byCode[clean].indexOf(name) === -1) byCode[clean].push(name);
    });
  });
  window.COURSE_BY_CODE = byCode;

  /* ============================================================
     4) تحقق
     ============================================================ */
  if(typeof window.validateCoursesDB === 'function'){
    window.validateCoursesDB();
  }

  console.log(
    '[courses-data-patch v5] Added ' + addedAliases +
    ' legacy aliases, fixed ' + fixedPres + ' pre-references'
  );
})();