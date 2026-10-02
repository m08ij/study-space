/* ============================================================
   ✨ ux-fixes.js — إصلاحات تجربة المستخدم
   - Modal Stack:
       • Browser back يُغلق الأعلى فقط
       • Escape يُغلق الأعلى فقط
       • Nested modals تعمل صحيح
   - addClassSlot يمرر key (تعبئة تلقائية للخلية)
   ============================================================ */
(function(){
  'use strict';
  if(window._uxFixesLoaded) return;
  window._uxFixesLoaded = true;

  /* ============================================================
     1) Modal Stack
     ============================================================ */
  var modalStack = [];
  var pendingBackCount = 0;

  function registerModal(el){
    if(!el || modalStack.indexOf(el) > -1) return;
    modalStack.push(el);
    try{
      history.pushState(
        { __uxModal: modalStack.length, __uxTs: Date.now() },
        '',
        location.href
      );
    }catch(e){}
    updateTopmostMarker();
  }

  function unregisterModal(el, fromPopstate){
    var idx = modalStack.indexOf(el);
    if(idx === -1) return;
    modalStack.splice(idx, 1);
    updateTopmostMarker();

    /* إذا كان الإغلاق برمجياً → اسحب الـ history entry */
    if(!fromPopstate){
      if(history.state && history.state.__uxModal){
        pendingBackCount++;
        try{ history.back(); }
        catch(e){ pendingBackCount--; }
      }
    }
  }

  function updateTopmostMarker(){
    modalStack.forEach(function(el, i){
      if(el) el._uxIsTop = (i === modalStack.length - 1);
    });
  }

  function closeTopmost(){
    if(!modalStack.length) return false;
    var el = modalStack.pop();
    updateTopmostMarker();
    if(el){
      el._uxClosing = true;
      if(el.parentNode) el.parentNode.removeChild(el);
    }
    return true;
  }

  /* ---- MutationObserver لالتقاط المودالات ---- */
  var observer = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      /* Added */
      m.addedNodes.forEach(function(node){
        if(node.nodeType !== 1) return;
        if(!node.classList) return;
        if(!node.classList.contains('modal-backdrop')) return;
        if(node._uxTracked) return;

        node._uxTracked = true;
        /* ننتظر دورة الحدث لإكمال البناء الداخلي */
        setTimeout(function(){
          if(node.parentNode) registerModal(node);
        }, 0);
      });

      /* Removed */
      m.removedNodes.forEach(function(node){
        if(node.nodeType !== 1) return;
        if(!node.classList) return;
        if(!node.classList.contains('modal-backdrop')) return;
        if(!node._uxTracked) return;
        if(node._uxClosing) return;

        node._uxClosing = true;
        unregisterModal(node, false);
      });
    });
  });

  /* ننتظر DOM جاهزاً */
  function startObserver(){
    if(document.body){
      observer.observe(document.body, { childList: true });
    } else {
      setTimeout(startObserver, 50);
    }
  }
  startObserver();

  /* ---- popstate: أغلق الأعلى عند زر الرجوع ---- */
  window.addEventListener('popstate', function(e){
    /* هذا popstate ناتج من history.back() بتاعنا → تجاهل */
    if(pendingBackCount > 0){
      pendingBackCount--;
      return;
    }

    /* هذا popstate من المستخدم (زر رجوع) */
    if(modalStack.length > 0){
      closeTopmost();
    }
  });

  /* ---- Escape: أغلق الأعلى فقط (capture) ---- */
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    if(modalStack.length === 0) return;

    /* نوقف المعالجات الأخرى (التي تُغلق كل المودالات) */
    e.preventDefault();
    e.stopImmediatePropagation();
    closeTopmost();
  }, true);

  /* ---- API للتشخيص ---- */
  window.__uxModalStack = function(){ return modalStack.slice(); };

  /* ============================================================
     2) addClassSlot يمرر key
     ============================================================ */
  window.addClassSlot = function(key){
    /* الأولوية: openSmartTimetableAtKey لو موجودة */
    if(key && typeof window.openSmartTimetableAtKey === 'function'){
      try{
        window.openSmartTimetableAtKey(key);
        return;
      }catch(e){ console.warn('openSmartTimetableAtKey failed:', e); }
    }

    /* الرجوع لـ openSmartTimetable */
    if(typeof window.openSmartTimetable === 'function'){
      try{
        window.openSmartTimetable();
        return;
      }catch(e){ console.warn('openSmartTimetable failed:', e); }
    }

    /* Fallback: حمّل السكربت */
    if(window.toast) window.toast('⏳ جاري تحميل محرر الجدول...', 'info', 2000);
    var s = document.createElement('script');
    s.src = 'smart-timetable-entry.js';
    s.onload = function(){
      setTimeout(function(){
        if(key && typeof window.openSmartTimetableAtKey === 'function'){
          window.openSmartTimetableAtKey(key);
        } else if(typeof window.openSmartTimetable === 'function'){
          window.openSmartTimetable();
        }
      }, 200);
    };
    document.head.appendChild(s);
  };

  console.log('✨ UX Fixes loaded — modal stack + back + Escape topmost + addClassSlot key');
})();