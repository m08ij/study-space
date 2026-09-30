/* ============================================================
   ☁️ ocr-puter.js — OCR مجاني عبر Puter.js + Mistral
   ✅ مجاني 100% — بلا تسجيل، بلا مفاتيح، بلا سيرفر
   ✅ يدعم العربية والجداول والبنية
   ✅ سطر واحد للتحليل: puter.ai.img2txt({ provider: 'mistral' })
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

  /* ============ تحميل Puter.js عند الحاجة ============ */
  function loadPuter(){
    if(typeof puter !== 'undefined') return Promise.resolve();
    if(window._puterLoading) return window._puterLoading;
    window._puterLoading = new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload = function(){ resolve(); };
      s.onerror = function(){ reject(new Error('فشل تحميل Puter.js')); };
      document.head.appendChild(s);
    });
    return window._puterLoading;
  }

  /* ============ التحليل الرئيسي ============ */
  async function analyzeImage(file){
    if(!file || !file.type.startsWith('image/')){
      toast('⚠️ اختر صورة', 'warn');
      return;
    }

    var preview = document.getElementById('ocrPreview');
    if(preview){
      preview.style.display = 'block';
      preview.innerHTML = '<img src="' + URL.createObjectURL(file) + '" style="max-width:100%;border-radius:12px;max-height:300px">';
    }

    var progress = document.getElementById('ocrProgress');
    var bar = document.getElementById('ocrBar');
    var progressText = document.getElementById('ocrText');
    if(progress) progress.style.display = 'block';
    if(bar) bar.style.width = '30%';
    if(progressText) progressText.textContent = '⏳ جاري التحليل عبر Mistral...';

    toast('☁️ يرسل الصورة للتحليل...', 'info', 2000);

    try{
      await loadPuter();

      var text = await puter.ai.img2txt({
        source: file,
        provider: 'mistral'
      });

      if(bar) bar.style.width = '100%';
      if(progressText) progressText.textContent = '✅ تم التحليل';

      var ta = document.getElementById('ocrTextarea');
      if(ta) ta.value = text || '';

      var resultEl = document.getElementById('ocrResult');
      if(resultEl) resultEl.style.display = 'block';

      toast('✅ تم استخراج ' + (text ? text.split('\n').length : 0) + ' سطر', 'success', 3000);

      // ✅ افتح المستورد تلقائياً
      if(text && window.TimetableImporter && window.TimetableImporter.open){
        setTimeout(function(){
          window.TimetableImporter.open(text);
        }, 600);
      }
    }catch(e){
      console.error('Puter OCR error:', e);
      if(progressText) progressText.textContent = '❌ فشل التحليل';
      if(bar) bar.style.width = '0%';
      toast('فشل: ' + (e.message || e), 'warn', 4000);
    }
  }

  /* ============ التركيب ============ */
  function install(){
    var ocrFile = document.getElementById('ocrFile');
    if(ocrFile && !ocrFile._puterBound){
      ocrFile._puterBound = true;
      var newInput = ocrFile.cloneNode(true);
      ocrFile.parentNode.replaceChild(newInput, ocrFile);
      newInput.addEventListener('change', function(e){
        var f = e.target.files[0];
        if(f) analyzeImage(f);
      });
    }

    var uz = document.getElementById('uploadZone');
    if(uz && !uz._puterBound){
      uz._puterBound = true;
      uz.addEventListener('dragover', function(e){ e.preventDefault(); uz.classList.add('dragover'); });
      uz.addEventListener('dragleave', function(){ uz.classList.remove('dragover'); });
      uz.addEventListener('drop', function(e){
        e.preventDefault(); uz.classList.remove('dragover');
        var f = e.dataTransfer.files[0];
        if(f) analyzeImage(f);
      });
    }

    console.log('☁️ OCR Puter: bound to input');
  }

  window.ocrPuter = {
    handle: analyzeImage,
    analyze: analyzeImage,
    test: async function(){
      console.log('🔍 اختبار Puter...');
      var text = await puter.ai.img2txt({
        source: 'https://assets.puter.site/letter.png',
        provider: 'mistral'
      });
      console.log('النتيجة:', text);
      return text;
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 1500); });
  } else {
    setTimeout(install, 1500);
  }

  console.log('☁️ OCR Puter v1 loaded — Mistral عبر Puter.js');
})();