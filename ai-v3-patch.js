/* ============================================================
   AI v3 patch v3
   - يستهدف window.aiRespond (الصحيح)
   - يعيد ربط sendAI ليستخدم window.aiRespond
   - Clears CTX when topic changes
   ============================================================ */
(function(){
  'use strict';

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

  function install(){
    if(!window._aiV3) return false;
    if(typeof window.aiRespond !== 'function') return false;
    if(window._aiRespondPatchedV3) return true;
    window._aiRespondPatchedV3 = true;

    var origRespond = window.aiRespond;

    /* ============ 1) Patch aiRespond لتنظيف السياق ============ */
    window.aiRespond = function(q){
      var ctxBefore = getCtx();
      var topIntent = null;
      if(window._aiV3 && typeof window._aiV3.classify === 'function'){
        var results = window._aiV3.classify(q);
        topIntent = results.length ? results[0] : null;
      }
      if(topIntent && INDEPENDENT_INTENTS[topIntent.id]){
        if(ctxBefore.topic && ctxBefore.topic !== topIntent.id){
          clearCtx();
        }
      }
      return origRespond.apply(this, arguments);
    };

    /* ============ 2) إعادة تعريف sendAI لاستخدام window.aiRespond ============ */
    window.sendAI = function(){
      var inp = document.getElementById('aiInput');
      if(!inp) return;
      var q = inp.value.trim();
      if(!q) return;

      if(typeof window.addAIMessage === 'function'){
        window.addAIMessage('user', q);
      }
      inp.value = '';

      var c = document.getElementById('aiMessages');
      var typing = null;
      if(c){
        typing = document.createElement('div');
        typing.className = 'ai-msg bot';
        typing.innerHTML = '<span class="ai-dots"><span></span><span></span><span></span></span>';
        c.appendChild(typing);
        c.scrollTop = c.scrollHeight;
      }

      setTimeout(function(){
        if(typing && typing.parentNode) typing.parentNode.removeChild(typing);
        var resp;
        try{
          resp = window.aiRespond(q);
        }catch(e){
          console.error(e);
          resp = '⚠️ صار خطأ، جرب مرة ثانية.';
        }
        if(typeof window.addAIMessage === 'function'){
          window.addAIMessage('bot', resp);
        }
      }, 400);
    };

    /* ============ 3) إعادة ربط زر الإرسال وحقل الإدخال ============ */
    var btn = document.getElementById('aiSend');
    if(btn){
      var cloneBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(cloneBtn, btn);
      cloneBtn.addEventListener('click', window.sendAI);
    }

    var inp = document.getElementById('aiInput');
    if(inp){
      var cloneInp = inp.cloneNode(true);
      inp.parentNode.replaceChild(cloneInp, inp);
      cloneInp.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){ e.preventDefault(); window.sendAI(); }
      });
    }

    /* ============ 4) إعادة ربط زر الإغلاق والفتح (احتياطي) ============ */
    var closeBtn = document.getElementById('aiClose');
    if(closeBtn && !closeBtn._aiRebound){
      closeBtn._aiRebound = true;
      closeBtn.addEventListener('click', function(){
        if(typeof window.toggleAI === 'function') window.toggleAI();
      });
    }

    console.log('[AI v3 patch v3] aiRespond patched + sendAI rebound');
    return true;
  }

  /* محاولة فورية ثم polling */
  if(install()) return;

  var tries = 0;
  var timer = setInterval(function(){
    tries++;
    if(install() || tries > 20){
      clearInterval(timer);
    }
  }, 300);
})();