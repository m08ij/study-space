/* ============================================================
   AI v3 patch v2 - fixes for ai-v3.js
   - Clears CTX when topic changes
   - Smart splitMulti preserving compound Arabic questions
   - All Arabic literals as Unicode escapes (safe for GitHub Pages)
   ============================================================ */
(function(){
  'use strict';

  if(!window._aiV3){
    setTimeout(function(){ if(window._aiV3) installPatch(); }, 500);
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
      try{ sessionStorage.removeItem(CTX_KEY); }catch(e){}
    }

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

      return origProcess ? origProcess.apply(this, arguments) : '';
    };

    // Arabic starters (shu, km, mta, kif, wen, lesh, hal)
    // \u0634\u0648 = شو  |  \u0643\u0645 = كم  |  \u0645\u062A\u0649 = متى
    // \u0643\u064A\u0641 = كيف  |  \u0648\u064A\u0646 = وين  |  \u0644\u064A\u0634 = ليش  |  \u0647\u0644 = هل
    var STARTERS_RE = /^(\u0634\u0648|\u0643\u0645|\u0645\u062A\u0649|\u0643\u064A\u0641|\u0648\u064A\u0646|\u0644\u064A\u0634|\u0647\u0644)\s/;

    // Second starter adds: a3red, iftah, rooh
    // \u0627\u0639\u0631\u0636 = اعرض  |  \u0627\u0641\u062A\u062D = افتح  |  \u0631\u0648\u062D = روح
    var SECOND_STARTER_RE = /^(\u0634\u0648|\u0643\u0645|\u0645\u062A\u0649|\u0643\u064A\u0641|\u0648\u064A\u0646|\u0644\u064A\u0634|\u0647\u0644|\u0627\u0639\u0631\u0636|\u0627\u0641\u062A\u062D|\u0631\u0648\u062D)\s/;

    // Arabic "waw" (و = \u0648) and "thumma" (ثم = \u062B\u0645) separators
    var SEP_RE = /\s+(?:\u0648|\u062B\u0645)\s+/;

    function shouldSplit(text){
      var raw = String(text || '').trim();
      var words = raw.split(/\s+/).length;
      if(words < 6) return false;

      var q = (raw.match(/[\u061F?]/g) || []).length;
      if(q > 1) return false;

      if(STARTERS_RE.test(raw)){
        var parts = raw.split(SEP_RE);
        if(parts.length === 2){
          var first = parts[0].trim();
          var second = parts[1].trim();
          if(SECOND_STARTER_RE.test(second) && first.split(/\s+/).length >= 2){
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

    console.log('[AI v3 patch v2] Context clearing + smart splitMulti installed');
  }
})();