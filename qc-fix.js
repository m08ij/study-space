/* ============================================================
   🔧 qc-fix.js — إصلاح تصنيف Quick Capture
   يحل مشكلة "بنزين" اللي تروح لـ food بدل transport
   ============================================================ */
(function(){
  'use strict';

  function install(){
    if(typeof window.parseQuickCapture !== 'function'){ 
      setTimeout(install, 300); 
      return; 
    }
    if(window._qcFixInstalled) return;
    window._qcFixInstalled = true;

    var original = window.parseQuickCapture;

    window.parseQuickCapture = function(text){
      var result = original.apply(this, arguments);
      if(!result) return result;

      // ✅ إصلاح التصنيف فقط للمصاريف
      if(result.type === 'expense'){
        var t = String(text || '');

        // الترتيب مهم: الأكثر تحديداً أولاً
        // 1) مواصلات ووقود
        if(/بنزين|بترول|وقود|ديزل|مواصلات|باص|تاكسي|أوبر|كريم|مترو|transport|fuel|gas|uber|careem/i.test(t)){
          result.category = 'transport';
        }
        // 2) طعام (بعد استبعاد بنزين)
        else if(/طعام|أكل|مطعم|بقالة|سوبر|food|قهوة|كافيه|مطعم|ساندويش|فطور|غدا|عشا/i.test(t)){
          result.category = 'food';
        }
        // 3) "بن" كلمة مستقلة فقط (مو جزء من بنزين)
        else if(/(^|\s)بن(\s|$)/i.test(t)){
          result.category = 'food';
        }
      }

      return result;
    };

    console.log('🔧 qc-fix installed');
  }

  if(document.readyState === 'loading'){ 
    document.addEventListener('DOMContentLoaded', install); 
  } else { 
    install(); 
  }
})();