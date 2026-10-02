/* ============================================================
   courses-data-patch.js v3 — إصلاحات جذرية
   - دمج الأكواد المكررة (rename + aliases)
   - إصلاح pre-references بعد الدمج
   - validateCoursesDB متساهل مع الاختيارية
   - لا حاجة لتعديل courses-data.js يدوياً
   ============================================================ */
(function(){
  'use strict';

  var DB = window.COURSES_DB;
  if(!DB){
    console.warn('[courses-data-patch] COURSES_DB not loaded');
    return;
  }
  if(window._coursesDataPatchedV3) return;
  window._coursesDataPatchedV3 = true;

  /* ============================================================
     1) دمج الأكواد المكررة
     ============================================================ */
  function mergeDuplicates(){
    var byCode = {};
    Object.keys(DB).forEach(function(name){
      var code = DB[name].code;
      if(!code) return;
      var clean = String(code).replace(/^0+/, '');
      if(!byCode[clean]) byCode[clean] = [];
      byCode[clean].push(name);
    });

    var renameMap = {};
    var removed = [];
    var merged = [];

    Object.keys(byCode).forEach(function(code){
      var names = byCode[code];
      if(names.length <= 1) return;

      /* primary: الأطول اسم (يحتفظ بأكبر معلومات) */
      var primary = names.reduce(function(a, b){
        return String(a).length >= String(b).length ? a : b;
      });

      if(!DB[primary].aliases) DB[primary].aliases = [];

      names.forEach(function(n){
        if(n === primary) return;
        if(DB[primary].aliases.indexOf(n) === -1){
          DB[primary].aliases.push(n);
        }
        renameMap[n] = primary;
        delete DB[n];
        removed.push(n);
      });

      merged.push({ code: code, names: names, primary: primary });
    });

    return { renameMap: renameMap, removed: removed, merged: merged };
  }

  var mergeResult = mergeDuplicates();

  /* ============================================================
     2) إصلاح pre-references (استبدال الأسماء المدمجة)
     ============================================================ */
  function fixPreReferences(renameMap){
    Object.keys(DB).forEach(function(name){
      if(!Array.isArray(DB[name].pre)) return;
      var seen = {};
      var newPre = [];
      DB[name].pre.forEach(function(p){
        var resolved = renameMap[p] || p;
        if(seen[resolved]) return;
        seen[resolved] = true;
        newPre.push(resolved);
      });
      DB[name].pre = newPre;
    });
  }
  fixPreReferences(mergeResult.renameMap);

  /* ============================================================
     3) aliases إضافية يدوية
     ============================================================ */
  var EXTRA_ALIASES = {
    'اساسيات الكيمياء العامة':          ['1701081137'],
    'فيزياء عامة (1)':                  ['1701081136'],
    'تفاضل وتكامل (1)':                 ['110108101'],
    'لغة عربية / استدراكية':            ['121601099'],
    'مهارات التواصل باللغة الانجليزية':  ['2116021101'],
    'اساسيات الكيمياء العامة العملية':  ['1701081138']
  };

  var codeIndex = window.COURSE_BY_CODE || {};
  Object.keys(EXTRA_ALIASES).forEach(function(name){
    if(!DB[name]) return;
    EXTRA_ALIASES[name].forEach(function(code){
      var clean = String(code).replace(/^0+/, '');
      if(!codeIndex[code]) codeIndex[code] = [];
      if(codeIndex[code].indexOf(name) === -1) codeIndex[code].push(name);
      if(clean !== code){
        if(!codeIndex[clean]) codeIndex[clean] = [];
        if(codeIndex[clean].indexOf(name) === -1) codeIndex[clean].push(name);
      }
    });
  });

  /* ============================================================
     4) إعادة بناء COURSE_BY_CODE (نظيف)
     ============================================================ */
  function rebuildByCode(){
    var byCode = {};
    Object.keys(DB).forEach(function(name){
      var c = DB[name].code;
      if(!c) return;
      var clean = String(c).replace(/^0+/, '');
      if(!byCode[clean]) byCode[clean] = [];
      byCode[clean].push(name);
    });
    return byCode;
  }

  var newByCode = rebuildByCode();
  window.COURSE_BY_CODE = newByCode;

  /* ============================================================
     5) validateCoursesDB — محدَّث ومتساهل
     ============================================================ */
  window.validateCoursesDB = function(){
    var issues = [];

    /* A) أكواد مكررة — يجب أن يكون صفر الآن */
    Object.keys(newByCode).forEach(function(code){
      if(newByCode[code].length > 1){
        issues.push('⚠️ كود مكرر: ' + code + ' → ' + newByCode[code].join(' | '));
      }
    });

    /* B) متطلبات مفقودة */
    Object.keys(DB).forEach(function(name){
      (DB[name].pre || []).forEach(function(p){
        if(!DB[p]){
          issues.push('🔗 متطلب مفقود في "' + name + '": ' + p);
        }
      });
    });

    /* C) ساعات — متساهل */
    var totals = {};
    Object.keys(DB).forEach(function(name){
      var t = DB[name].t;
      if(!t) return;
      if(!totals[t]) totals[t] = 0;
      totals[t] += DB[name].h;
    });

    /* الجامعة الإجبارية = 18 بالضبط */
    var expectedExact = { 'uni-c': 18 };
    Object.keys(expectedExact).forEach(function(k){
      if(totals[k] !== expectedExact[k]){
        issues.push('📊 ' +
          ((window.COURSE_TYPES && window.COURSE_TYPES[k] && window.COURSE_TYPES[k].label) || k) +
          ': ' + totals[k] + ' (المتوقع ' + expectedExact[k] + ')');
      }
    });

    /* الفئات المتبقية — الحد الأدنى فقط */
    var expectedMin = {
      'faculty': 33,
      'major-c': 88,
      'uni-e': 6,
      'major-e': 15
    };
    Object.keys(expectedMin).forEach(function(k){
      if((totals[k] || 0) < expectedMin[k]){
        issues.push('📊 ' +
          ((window.COURSE_TYPES && window.COURSE_TYPES[k] && window.COURSE_TYPES[k].label) || k) +
          ': ' + totals[k] + ' (المتوقع ≥ ' + expectedMin[k] + ')');
      }
    });

    if(issues.length === 0){
      console.log('✅ COURSES_DB صالح 100% — لا مشاكل');
    } else {
      console.warn('[courses-data-patch v3] ' + issues.length + ' ملاحظة');
      issues.forEach(function(i){ console.warn('  ' + i); });
    }
    return issues;
  };

  /* ============================================================
     6) إحصائيات
     ============================================================ */
  var remedialHours = 0, remedialCount = 0;
  Object.keys(DB).forEach(function(k){
    if(DB[k].t === 'remedial'){
      remedialHours += DB[k].h;
      remedialCount++;
    }
  });

  var req = window.TOTAL_REQUIRED_HOURS || {};
  req.remedial = remedialHours;
  window.TOTAL_REQUIRED_HOURS = req;

  var types = window.COURSE_TYPES || {};
  if(!types.remedial){
    types.remedial = { label: 'استدراكية', icon: '📌', color: 'var(--muted)' };
    window.COURSE_TYPES = types;
  }

  /* ============================================================
     7) findCourseByCode محدَّث
     ============================================================ */
  function normCode(s){
    return String(s == null ? '' : s).trim().normalize('NFC').replace(/^0+/, '');
  }
  function normName(s){
    return String(s == null ? '' : s).trim().normalize('NFC').replace(/\s+/g, ' ');
  }

  window.findCourseByCode = function(code){
    var target = normCode(code);
    if(!target) return null;

    /* 1) عبر newByCode */
    if(newByCode[target] && newByCode[target].length){
      var name = newByCode[target][0];
      if(DB[name]) return { name: name, info: DB[name] };
    }

    /* 2) عبر المسح الكامل + aliases */
    var keys = Object.keys(DB);
    for(var i = 0; i < keys.length; i++){
      var key = keys[i];
      var info = DB[key];
      if(normCode(info.code) === target){
        return { name: key, info: info };
      }
      if(info.aliases && info.aliases.length){
        for(var j = 0; j < info.aliases.length; j++){
          if(normCode(info.aliases[j]) === target){
            return { name: key, info: info };
          }
        }
      }
    }
    return null;
  };

  /* ============================================================
     8) searchCourses محدَّث
     ============================================================ */
  window.searchCourses = function(query){
    var q = normName(query).toLowerCase();
    if(!q) return [];
    var results = [];
    var seen = {};
    Object.keys(DB).forEach(function(name){
      var key = normName(name).toLowerCase();
      var info = DB[name];
      var codeMatch = String(info.code || '').indexOf(q) > -1;
      if(key.indexOf(q) > -1 || codeMatch){
        if(!seen[name]){
          seen[name] = true;
          results.push({ name: name, info: info });
        }
      }
    });
    return results;
  };

  /* ============================================================
     تسجيل
     ============================================================ */
  console.log(
    '[courses-data-patch v3] Applied — removed ' +
    mergeResult.removed.length + ' duplicate(s), merged ' +
    mergeResult.merged.length + ' code(s)'
  );
  if(mergeResult.merged.length){
    mergeResult.merged.forEach(function(m){
      console.log(
        '  ✓ ' + m.code + ': "' +
        m.names.join('" + "') + '" → "' + m.primary + '"'
      );
    });
  }
})();