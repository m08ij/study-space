/* ============================================================
   timetable-ui.js v3
   - يستبدل بطاقة OCR فقط
   - يبقي "أدوات سريعة" ظاهرة
   - لا يُخفي أي زر إلا btnPasteOcr (لا معنى له بعد إلغاء OCR)
   - لا يطوي الـ grid
   ============================================================ */
(function(){
  'use strict';

  var REPLACED_FLAG = 'data-tui-replaced';

  function log(msg){ try{ console.log('[Timetable UI] ' + msg); }catch(e){} }
  function toast(msg, type, dur){
    if(typeof window.toast === 'function') window.toast(msg, type || 'info', dur || 2500);
  }

  /* ============================================================
     بناء بطاقة "إضافة جدول"
     ============================================================ */
  function buildCardHtml(){
    return '' +
      '<div style="text-align:center;padding:36px 20px 32px">' +

        '<div style="font-size:2.6rem;line-height:1;margin-bottom:14px">📅</div>' +

        '<div style="font-size:1.15rem;font-weight:800;margin-bottom:8px">إضافة جدول</div>' +

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
     استبدال بطاقة OCR
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
     فتح Smart Timetable مع retry
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
      s.onload = function(){
        setTimeout(function(){ openSmartWithRetry(attempt + 1); }, 100);
      };
      s.onerror = function(){
        toast('فشل تحميل محرر الجدول', 'warn', 3000);
      };
      document.head.appendChild(s);
      return;
    }

    setTimeout(function(){ openSmartWithRetry(attempt + 1); }, 300);
  }

  /* ============================================================
     تحديث العنوان الفرعي
     ============================================================ */
  function updatePageSub(){
    var sub = document.querySelector('#timetable .page-sub');
    if(sub) sub.textContent = 'أضف موادك بشكل تفاعلي ذكي';
  }

  /* ============================================================
     إخفاء عناصر OCR القديمة (داخل البطاقة المُستبدلة عادة)
     + btnPasteOcr فقط من "أدوات سريعة"
     ============================================================ */
  function hideLeftoverOcrUi(){
    var ids = [
      'ocrProgress','ocrPreview','ocrResult','ocrFile','ocrTextarea',
      'btnParseOcr','btnClearOcr','ocrBar','ocrText',
      'btnPasteOcr'   /* ← هذا الزر لا معنى له بعد إلغاء OCR */
    ];
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if(el && el.style) el.style.display = 'none';
    });
  }

  /* ⚠️ لا نستدعي hideQuickToolsCard ولا collapseParentGrid */

  /* ============================================================
     Boot
     ============================================================ */
  function runAll(){
    updatePageSub();
    hideLeftoverOcrUi();
    replaceOcrCard();
  }

  function init(){
    runAll();

    /* محاولات إضافية لأن الـ DOM قد يُبنى على دفعات */
    setTimeout(runAll, 400);
    setTimeout(runAll, 1200);
    setTimeout(runAll, 2500);

    /* راقب تبديل التبويب */
    var origSwitch = window.switchTab;
    if(typeof origSwitch === 'function' && !window._tuiWrappedV3){
      window.switchTab = function(tab){
        var r = origSwitch.apply(this, arguments);
        setTimeout(function(){
          if(tab === 'timetable') runAll();
        }, 80);
        return r;
      };
      window._tuiWrappedV3 = true;
    }

    log('v3 ready — Quick Tools preserved');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 200); });
  } else {
    setTimeout(init, 200);
  }
})();