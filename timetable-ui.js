/* ============================================================
   timetable-ui.js v2
   Replaces the OCR card with a clean "Add Schedule" card.
   - Hides the "Quick Tools" card entirely
   - Makes the Add card full-width
   - Centers a slim, wide button
   ASCII-only console output.
   ============================================================ */
(function(){
  'use strict';

  var REPLACED_FLAG = 'data-tui-replaced';
  var HIDDEN_FLAG = 'data-tui-hidden';
  var GRID_FLAG = 'data-tui-grid';

  function log(msg){ try{ console.log('[Timetable UI] ' + msg); }catch(e){} }
  function toast(msg, type, dur){
    if(typeof window.toast === 'function') window.toast(msg, type || 'info', dur || 2500);
  }

  /* ============================================================
     New compact card
     ============================================================ */
  function buildCardHtml(){
    return '' +
      '<div style="text-align:center;padding:36px 20px 32px;max-width:640px;margin:0 auto">' +

        '<div style="font-size:2.6rem;line-height:1;margin-bottom:14px">📅</div>' +

        '<div style="font-size:1.15rem;font-weight:800;margin-bottom:8px">' +
          'إضافة جدول' +
        '</div>' +

        '<div style="font-size:.85rem;color:var(--muted);line-height:1.7;margin-bottom:22px">' +
          'اكتب رقم المادة — نعبّي الاسم والساعات تلقائياً.<br>' +
          'اختر الأيام والوقت بضغطة واحدة.' +
        '</div>' +

        '<button class="btn" id="btnOpenSmartTimetable" ' +
          'style="' +
            'background:var(--grad);' +
            'color:#0b0f1a;' +
            'font-weight:800;' +
            'padding:12px 32px;' +
            'font-size:.95rem;' +
            'border-radius:12px;' +
            'width:100%;' +
            'max-width:420px;' +
            'box-shadow:0 6px 20px var(--glow);' +
            'justify-content:center;' +
          '">' +
          '➕ إضافة جدول' +
        '</button>' +

        '<div style="margin-top:22px;padding:12px 16px;background:var(--grad-soft);border-radius:10px;font-size:.76rem;color:var(--muted);line-height:1.7;text-align:right">' +
          '<span style="color:var(--cyan);font-weight:800">💡 كيف يعمل؟</span> ' +
          'اكتب رقم المادة، اختر الأيام، حدّد الوقت والقاعة، ثم احفظ الكل دفعة واحدة.' +
        '</div>' +

      '</div>';
  }

  /* ============================================================
     Hide Quick Tools card + collapse grid to single column
     ============================================================ */
  function hideQuickToolsCard(){
    var ref = document.getElementById('btnLoadExample') ||
              document.getElementById('btnAutoFill') ||
              document.getElementById('btnPrintTt');
    if(!ref) return false;

    var card = ref.closest('.card');
    if(!card) return false;

    if(card.getAttribute(HIDDEN_FLAG) === '1') return true;
    card.setAttribute(HIDDEN_FLAG, '1');
    card.style.display = 'none';
    log('Quick tools card hidden');
    return true;
  }

  function collapseParentGrid(){
    var uploadZone = document.getElementById('uploadZone');
    if(!uploadZone) return false;
    var card = uploadZone.closest('.card');
    if(!card) return false;

    var grid = card.parentNode;
    if(!grid) return false;

    // Only collapse if the parent is a grid container
    if(grid.classList && (
      grid.classList.contains('grid-2') ||
      grid.classList.contains('grid-3') ||
      (grid.style && String(grid.style.display).indexOf('grid') > -1) ||
      (grid.className && String(grid.className).indexOf('grid') > -1)
    )){
      if(grid.getAttribute(GRID_FLAG) === '1') return true;
      grid.setAttribute(GRID_FLAG, '1');
      grid.style.gridTemplateColumns = '1fr';
      log('Parent grid collapsed to single column');
      return true;
    }

    // Fallback: check computed style
    try{
      var cs = window.getComputedStyle(grid);
      if(cs && cs.display === 'grid'){
        if(grid.getAttribute(GRID_FLAG) === '1') return true;
        grid.setAttribute(GRID_FLAG, '1');
        grid.style.gridTemplateColumns = '1fr';
        log('Parent grid collapsed (computed)');
        return true;
      }
    }catch(e){}

    return false;
  }

  /* ============================================================
     Replace OCR card content
     ============================================================ */
  function replaceOcrCard(){
    var uploadZone = document.getElementById('uploadZone');
    if(!uploadZone) return false;

    var card = uploadZone.closest('.card');
    if(!card) return false;

    if(card.getAttribute(REPLACED_FLAG) === '1') return true;
    card.setAttribute(REPLACED_FLAG, '1');

    card.innerHTML = buildCardHtml();

    var btn = document.getElementById('btnOpenSmartTimetable');
    if(btn){
      btn.addEventListener('click', function(){
        openSmartWithRetry(0);
      });
    }

    log('OCR card replaced');
    return true;
  }

  /* ============================================================
     Open smart entry with retry
     ============================================================ */
  function openSmartWithRetry(attempt){
    if(typeof window.openSmartTimetable === 'function'){
      try{
        window.openSmartTimetable();
      }catch(e){
        console.error('[Timetable UI] openSmartTimetable failed:', e);
        toast('فشل فتح المحرر', 'warn', 3000);
      }
      return;
    }

    if(attempt >= 6){
      toast('⚠️ لم يتم تحميل محرر الجدول — جرّب تحديث الصفحة', 'warn', 4000);
      return;
    }

    if(attempt === 0 && !document.querySelector('script[src*="smart-timetable-entry"]')){
      var s = document.createElement('script');
      s.src = 'smart-timetable-entry.js';
      s.async = true;
      s.onload = function(){ setTimeout(function(){ openSmartWithRetry(attempt + 1); }, 100); };
      s.onerror = function(){ toast('فشل تحميل محرر الجدول', 'warn', 3000); };
      document.head.appendChild(s);
      return;
    }

    setTimeout(function(){ openSmartWithRetry(attempt + 1); }, 300);
  }

  /* ============================================================
     Update page subtitle
     ============================================================ */
  function updatePageSub(){
    var sub = document.querySelector('#timetable .page-sub');
    if(sub) sub.textContent = 'أضف موادك بشكل تفاعلي ذكي';
  }

  /* ============================================================
     Hide leftover OCR + remove unused quick buttons
     ============================================================ */
  function hideLeftoverOcrUi(){
    var ids = ['ocrProgress','ocrPreview','ocrResult','ocrFile','ocrTextarea',
               'btnParseOcr','btnClearOcr','ocrBar','ocrText','btnPasteOcr'];
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if(el && el.style) el.style.display = 'none';
    });
  }

  /* ============================================================
     Boot
     ============================================================ */
  function runAll(){
    updatePageSub();
    hideLeftoverOcrUi();
    hideQuickToolsCard();
    collapseParentGrid();
    replaceOcrCard();
  }

  function init(){
    runAll();

    // Retry multiple times (DOM may render in phases)
    setTimeout(runAll, 400);
    setTimeout(runAll, 1200);
    setTimeout(runAll, 2500);

    // Re-run on tab switch
    var origSwitch = window.switchTab;
    if(typeof origSwitch === 'function' && !window._tuiWrapped){
      window.switchTab = function(tab){
        var r = origSwitch.apply(this, arguments);
        setTimeout(function(){
          if(tab === 'timetable') runAll();
        }, 80);
        return r;
      };
      window._tuiWrapped = true;
    }

    log('v2 ready');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 200); });
  } else {
    setTimeout(init, 200);
  }
})();
