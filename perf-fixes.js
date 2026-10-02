/* ============================================================
   ⚡ perf-fixes.js — إصلاحات الأداء
   - Visibility-aware setInterval (يتجاهل ≥30s عند الخلفية)
   - Cache لـ SB.listCourseFiles (TTL 60s + invalidation ذكي)
   - Debounce لـ loadCourseFilesForCard
   ============================================================ */
(function(){
  'use strict';
  if(window._perfFixesLoaded) return;
  window._perfFixesLoaded = true;

  /* ============================================================
     1) Visibility-aware setInterval
     ============================================================ */
  (function patchSetInterval(){
    if(window._setIntervalPatched) return;
    window._setIntervalPatched = true;

    var orig = window.setInterval;
    window.setInterval = function(fn, ms){
      /* فقط للفواصل ≥ 30 ثانية */
      if(typeof ms === 'number' && ms >= 30000 && typeof fn === 'function'){
        var wrapped = function(){
          /* تجاهل عند الخلفية */
          var state = document.visibilityState;
          if(state === 'hidden') return;
          try{ return fn.apply(this, arguments); }
          catch(e){ console.warn('[perf] interval callback error:', e); }
        };
        return orig.call(window, wrapped, ms);
      }
      return orig.apply(window, arguments);
    };
    /* نحفظ الأصل للطوارئ */
    window.setInterval._original = orig;
  })();

  /* ============================================================
     2) Cache لـ SB.listCourseFiles
     ============================================================ */
  function installSBCache(){
    if(!window.SB || typeof window.SB.listCourseFiles !== 'function'){
      return false;
    }
    if(window._sbCacheInstalled) return true;
    window._sbCacheInstalled = true;

    var _listCache = {};       /* courseId → { ts, data } */
    var _listInflight = {};    /* courseId → Promise */
    var TTL = 60 * 1000;

    /* --- listCourseFiles مع cache + in-flight dedupe --- */
    var origList = window.SB.listCourseFiles;
    window.SB.listCourseFiles = function(courseId){
      var key = String(courseId);
      var now = Date.now();

      var c = _listCache[key];
      if(c && (now - c.ts) < TTL){
        return Promise.resolve(c.data);
      }
      if(_listInflight[key]){
        return _listInflight[key];
      }

      var promise = Promise.resolve(origList.call(window.SB, courseId))
        .then(function(files){
          _listCache[key] = { ts: Date.now(), data: files || [] };
          delete _listInflight[key];
          return files;
        })
        .catch(function(err){
          delete _listInflight[key];
          throw err;
        });

      _listInflight[key] = promise;
      return promise;
    };

    /* --- upload → invalidation للكورس المعني --- */
    var origUpload = window.SB.uploadCourseFile;
    window.SB.uploadCourseFile = async function(courseId, file){
      var r = await origUpload.call(window.SB, courseId, file);
      if(r && !r.error){
        delete _listCache[String(courseId)];
      }
      return r;
    };

    /* --- delete → invalidation ذكي (استخرج courseId من المسار) --- */
    var origDelete = window.SB.deleteCourseFile;
    window.SB.deleteCourseFile = async function(path){
      var r = await origDelete.call(window.SB, path);
      if(r){
        try{
          /* path format: <code>/courses/<courseId>/<filename> */
          var parts = String(path || '').split('/');
          var cid = parts[2];
          if(cid) delete _listCache[cid];
          else _listCache = {};   /* fallback: امسح الكل */
        }catch(e){
          _listCache = {};
        }
      }
      return r;
    };

    /* --- أداة تشخيص/تصفير يدوي --- */
    window.__perfClearFileCache = function(){ _listCache = {}; };

    return true;
  }

  /* ============================================================
     3) Debounce loadCourseFilesForCard
     ============================================================ */
  function installLCFDebounce(){
    if(typeof window.loadCourseFilesForCard !== 'function'){
      return false;
    }
    if(window._lcfDebounced) return true;
    window._lcfDebounced = true;

    var orig = window.loadCourseFilesForCard;
    var timers = {};
    var DEBOUNCE_MS = 100;

    window.loadCourseFilesForCard = function(courseId){
      var key = String(courseId);
      clearTimeout(timers[key]);
      timers[key] = setTimeout(function(){
        delete timers[key];
        try{ return orig.call(window, courseId); }
        catch(e){ console.warn('[perf] lcf error:', e); }
      }, DEBOUNCE_MS);
    };

    return true;
  }

  /* ============================================================
     4) إلغاء Cache عند تغيير رمز المزامنة
     ============================================================ */
  function installCodeChangeHook(){
    if(!window.SB || !window.SB.setCode) return false;
    if(window._codeHookInstalled) return true;
    window._codeHookInstalled = true;

    var origSet = window.SB.setCode;
    window.SB.setCode = function(newCode){
      var r = origSet.call(window.SB, newCode);
      if(typeof window.__perfClearFileCache === 'function'){
        window.__perfClearFileCache();
      }
      return r;
    };
    return true;
  }

  /* ============================================================
     التثبيت
     ============================================================ */
  function install(){
    var a = installSBCache();
    var b = installLCFDebounce();
    installCodeChangeHook();
    return a && b;
  }

  /* المحاولة الفورية */
  if(!install()){
    /* polling حتى تُحمَّل التبعيات */
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      if(install() || tries > 25){
        clearInterval(timer);
      }
    }, 200);
  }

  console.log('⚡ Perf Fixes loaded — visibility + SB cache + debounce');
})();