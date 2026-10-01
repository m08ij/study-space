/* ============================================================
   courses-data-patch.js v2 - Fixes for courses-data.js
   Loaded AFTER courses-data.js.
   ASCII-only console output.
   ============================================================ */
(function(){
  'use strict';

  var DB = window.COURSES_DB;
  if(!DB){ console.warn('[courses-data-patch] COURSES_DB not loaded'); return; }
  if(window._coursesDataPatched) return;
  window._coursesDataPatched = true;

  var EXTRA_ALIASES = {
    'اساسيات الكيمياء العامة':         ['1701081137'],
    'فيزياء عامة (1)':                 ['1701081136'],
    'تفاضل وتكامل (1)':                ['110108101'],
    'لغة عربية / استدراكية':           ['121601099'],
    'مهارات التواصل باللغة الانجليزية': ['2116021101'],
    'اساسيات الكيمياء العامة العملية': ['1701081138']
  };

  var CODE_INDEX = window.COURSE_BY_CODE || {};
  Object.keys(EXTRA_ALIASES).forEach(function(name){
    if(!DB[name]) return;
    var codes = EXTRA_ALIASES[name];
    codes.forEach(function(code){
      var clean = String(code).replace(/^0+/, '');
      if(!CODE_INDEX[code]) CODE_INDEX[code] = [];
      if(CODE_INDEX[code].indexOf(name) === -1) CODE_INDEX[code].push(name);
      if(clean !== code){
        if(!CODE_INDEX[clean]) CODE_INDEX[clean] = [];
        if(CODE_INDEX[clean].indexOf(name) === -1) CODE_INDEX[clean].push(name);
      }
    });
  });
  window.COURSE_BY_CODE = CODE_INDEX;

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

  function normCode(s){
    return String(s == null ? '' : s).trim().normalize('NFC').replace(/^0+/, '');
  }
  function normName(s){
    return String(s == null ? '' : s).trim().normalize('NFC').replace(/\s+/g, ' ');
  }

  var origFind = window.findCourseByCode;
  window.findCourseByCode = function(code){
    if(typeof origFind === 'function'){
      var r = origFind.call(this, code);
      if(r) return r;
    }
    var target = normCode(code);
    if(!target) return null;

    if(CODE_INDEX[target]){
      var name = CODE_INDEX[target][0];
      if(DB[name]) return { name: name, info: DB[name] };
    }

    var keys = Object.keys(DB);
    for(var i = 0; i < keys.length; i++){
      var key = keys[i];
      var info = DB[key];
      if(normCode(info.code) === target) return { name: key, info: info };
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

  var origValidate = window.validateCoursesDB;
  window.validateCoursesDB = function(){
    var issues = [];
    if(typeof origValidate === 'function'){
      issues = origValidate.apply(this, arguments) || [];
    }
    var actualRemedial = 0;
    Object.keys(DB).forEach(function(k){
      if(DB[k].t === 'remedial') actualRemedial += DB[k].h;
    });
    if(actualRemedial !== remedialHours){
      issues.push('remedial hours: ' + actualRemedial + ' vs ' + remedialHours);
    }
    if(issues.length === 0){
      console.log('[courses-data-patch] DB is valid');
    } else {
      console.warn('[courses-data-patch] ' + issues.length + ' note(s)');
      issues.forEach(function(i){ console.warn('  ' + i); });
    }
    return issues;
  };

  console.log('[courses-data-patch] loaded, remedial=' + remedialHours + 'h, aliases=' + Object.keys(EXTRA_ALIASES).length);
})();
