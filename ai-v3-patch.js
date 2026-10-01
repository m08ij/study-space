/* ============================================================
   AI v3 patch - fixes for ai-v3.js
   - Clears CTX when topic changes to an independent intent
   - Smart splitMulti that preserves compound Arabic questions
   NOTE: All console strings are ASCII-only to avoid RTL/emoji
   encoding issues when uploaded to GitHub Pages.
   ============================================================ */
(function(){
  'use strict';

  if(!window._aiV3){
    setTimeout(function(){
      if(!window._aiV3) return;
      installPatch();
    }, 500);
  } else {
    installPatch();
  }

  function installPatch(){
    if(window._aiV3Patched) return;
    window._aiV3Patched = true;

    var origProcess = window.aiRespond;
    var CTX_KEY = 'ai_v3_ctx';

    function getCtx(){
      try{ return JSON.parse(sessionStorage.getItem(CTX_KEY) || '{}'); }
      catch(e){ return {}; }
    }

    function clearCtx(){
      try{ sessionStorage.removeItem(CTX_KEY); }
      catch(e){}
    }

    /* Intents that should reset context when the user switches to them */
    var INDEPENDENT_INTENTS = {
      'myTasks': true, 'countTasks': true,
      'myExams': true, 'countExams': true,
      'myGpa': true, 'myBudget': true,
      'myCourses': true, 'myNotes': true,
      'myAtt': true, 'todaySch': true,
      'summary': true, 'planNext': true,
      'progress': true, 'studyNow': true,
      'courseInfo': true
    };

    function classifyTopIntent(text){
      if(!window._aiV3 || !window._aiV3.classify) return null;
      var results = window._aiV3.classify(text);
      return results.length ? results[0] : null;
    }

    window.aiRespond = function(q){
      var ctxBefore = getCtx();
      var topIntent = classifyTopIntent(q);

      if(topIntent && INDEPENDENT_INTENTS[topIntent.id]){
        if(ctxBefore.topic && ctxBefore.topic !== topIntent.id){
          clearCtx();
        }
      }

      var response = origProcess ? origProcess.apply(this, arguments) : '';
      return response;
    };

    /*
      Smart splitMulti:
      Do not split compound Arabic questions like:
        "shu 3ndi alyom wmta emt7ani"
      But DO split truly independent queries like:
        "shu mwadi wkm m3dli"
    */
    function shouldSplit(text){
      var raw = String(text || '').trim();
      var words = raw.split(/\s+/).length;
      if(words < 6) return false;

      var q = (raw.match(/[\u061F?]/g) || []).length;
      if(q > 1) return false;

      var starters = /^(شو|كم|متى|كيف|وين|ليش|هل)\s/;
      if(starters.test(raw)){
        var parts = raw.split(/\s+(?:و|ثم)\s+/);
        if(parts.length === 2){
          var first = parts[0].trim();
          var second = parts[1].trim();
          var secondStarter = /^(شو|كم|متى|كيف|وين|ليش|هل|اعرض|افتح|روح)\s/;
          if(secondStarter.test(second) && first.split(/\s+/).length >= 2){
            return true;
          }
        }
        return false;
      }

      return false;
    }

    if(window._aiV3 && typeof window._aiV3.process === 'function'){
      var origProcessV3 = window._aiV3.process;
      window._aiV3.process = function(text){
        if(!shouldSplit(text)){
          return origProcessV3.call(this, text);
        }
        return origProcessV3.apply(this, arguments);
      };
    }

    console.log('[AI v3 patch] Context clearing + smart splitMulti installed');
  }
})();
