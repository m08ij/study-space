/* ============================================================
   📸 ocr-advanced.js — OCR نظيف، بلا وسيط
   ✅ Tesseract.js فقط — يشتغل بالمتصفح
   ✅ Multi-pass (3 أوضاع preprocessing)
   ✅ يختار أفضل نتيجة تلقائياً
   ✅ يفتح المستورد مباشرة
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ============ تحميل Tesseract ============ */
  function loadTesseract(){
    if(typeof Tesseract !== 'undefined' && Tesseract.recognize) return Promise.resolve();
    if(window._tessLoading) return window._tessLoading;
    window._tessLoading = new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = function(){ resolve(); };
      s.onerror = function(){ reject(new Error('فشل تحميل Tesseract')); };
      document.head.appendChild(s);
    });
    return window._tessLoading;
  }

  /* ============ تحميل صورة ============ */
  function loadImage(src){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function(){ resolve(img); };
      img.onerror = function(){ reject(new Error('فشل تحميل الصورة')); };
      img.src = src;
    });
  }

  /* ============ تكبير الصورة إن كانت صغيرة ============ */
  function upscaleIfNeeded(img, targetW){
    targetW = targetW || 2000;
    if(img.width >= targetW) return null;
    var scale = targetW / img.width;
    var c = document.createElement('canvas');
    c.width = targetW;
    c.height = Math.round(img.height * scale);
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /* ============ Grayscale + Histogram Stretch ============ */
  function grayStretch(imageData){
    var d = imageData.data;
    var min = 255, max = 0;
    for(var i = 0; i < d.length; i += 4){
      var g = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]) | 0;
      d[i] = d[i+1] = d[i+2] = g;
      if(g < min) min = g;
      if(g > max) max = g;
    }
    if(max - min > 20){
      var range = max - min;
      for(var j = 0; j < d.length; j += 4){
        var v = ((d[j] - min) * 255 / range) | 0;
        d[j] = d[j+1] = d[j+2] = v < 0 ? 0 : (v > 255 ? 255 : v);
      }
    }
    return imageData;
  }

  /* ============ Adaptive Threshold (Bradley) ============ */
  function adaptiveThreshold(imageData, w, h, sens, winSize){
    sens = sens || 15;
    winSize = winSize || Math.max(15, (w / 30) | 0);
    var d = imageData.data;
    var gray = new Uint8Array(w * h);
    for(var i = 0; i < d.length; i += 4) gray[i/4] = d[i];

    // Integral image
    var integral = new Int32Array((w + 1) * (h + 1));
    for(var y = 0; y < h; y++){
      var sum = 0;
      for(var x = 0; x < w; x++){
        sum += gray[y * w + x];
        integral[(y+1)*(w+1) + (x+1)] = integral[y*(w+1) + (x+1)] + sum;
      }
    }

    var half = winSize >> 1;
    for(var y2 = 0; y2 < h; y2++){
      var y1 = Math.max(0, y2 - half);
      var y2b = Math.min(h - 1, y2 + half);
      for(var x2 = 0; x2 < w; x2++){
        var x1 = Math.max(0, x2 - half);
        var x2b = Math.min(w - 1, x2 + half);
        var count = (x2b - x1 + 1) * (y2b - y1 + 1);
        var s = integral[(y2b+1)*(w+1) + (x2b+1)]
              - integral[y1*(w+1) + (x2b+1)]
              - integral[(y2b+1)*(w+1) + x1]
              + integral[y1*(w+1) + x1];
        var avg = s / count;
        var val = gray[y2 * w + x2];
        var th = avg * (1 - sens / 100);
        var result = val > th ? 255 : 0;
        var idx = (y2 * w + x2) * 4;
        d[idx] = d[idx+1] = d[idx+2] = result;
      }
    }
    return imageData;
  }

  /* ============ Median Denoise 3x3 ============ */
  function medianDenoise(imageData, w, h){
    var d = imageData.data;
    var copy = new Uint8ClampedArray(d);
    for(var y = 1; y < h - 1; y++){
      for(var x = 1; x < w - 1; x++){
        var idx = (y * w + x) * 4;
        var vals = [];
        for(var dy = -1; dy <= 1; dy++){
          for(var dx = -1; dx <= 1; dx++){
            vals.push(copy[((y+dy) * w + (x+dx)) * 4]);
          }
        }
        vals.sort(function(a,b){ return a-b; });
        d[idx] = d[idx+1] = d[idx+2] = vals[4];
      }
    }
    return imageData;
  }

  /* ============ إزالة خطوط الجدول ============ */
  function removeTableLines(imageData, w, h){
    var d = imageData.data;
    var copy = new Uint8ClampedArray(d);
    var minRun = Math.max(40, (w / 15) | 0);

    // خطوط أفقية
    for(var y = 0; y < h; y++){
      var run = 0;
      for(var x = 0; x < w; x++){
        var v = copy[(y * w + x) * 4];
        if(v < 100){ run++; }
        else {
          if(run >= minRun){
            for(var k = x - run; k < x; k++){
              var i1 = (y * w + k) * 4;
              d[i1] = d[i1+1] = d[i1+2] = 255;
            }
          }
          run = 0;
        }
      }
    }

    // خطوط عمودية
    for(var x2 = 0; x2 < w; x2++){
      var run2 = 0;
      for(var y2 = 0; y2 < h; y2++){
        var v2 = copy[(y2 * w + x2) * 4];
        if(v2 < 100){ run2++; }
        else {
          if(run2 >= minRun){
            for(var k2 = y2 - run2; k2 < y2; k2++){
              var i2 = (k2 * w + x2) * 4;
              d[i2] = d[i2+1] = d[i2+2] = 255;
            }
          }
          run2 = 0;
        }
      }
    }
    return imageData;
  }

  /* ============ Pipeline preprocessing ============ */
  async function preprocess(src, mode){
    mode = mode || 'balanced';
    var img = await loadImage(src);
    var up = upscaleIfNeeded(img, 2000);
    var canvas = up || document.createElement('canvas');
    if(!up){
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
    }
    var ctx = canvas.getContext('2d');
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    grayStretch(imageData);

    var cfg = {
      'light':      { s: 10, w: 20 },
      'balanced':   { s: 15, w: 25 },
      'aggressive': { s: 20, w: 30 }
    }[mode] || { s: 15, w: 25 };

    adaptiveThreshold(imageData, canvas.width, canvas.height, cfg.s, cfg.w);
    medianDenoise(imageData, canvas.width, canvas.height);
    if(mode !== 'light') removeTableLines(imageData, canvas.width, canvas.height);

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /* ============ تشغيل Tesseract ============ */
  async function runTesseract(processedUrl, onProgress){
    await loadTesseract();
    var result = await Tesseract.recognize(processedUrl, 'ara', {
      tessedit_pageseg_mode: '6',        // Single uniform block — للجداول
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
      tessedit_do_invert: '0',
      logger: function(m){
        if(m.status === 'recognizing text' && onProgress){
          onProgress(Math.round(m.progress * 100));
        }
      }
    });
    return result.data.text || '';
  }

  /* ============ تقييم جودة النص ============ */
  function scoreText(text){
    if(!text) return 0;
    var lines = text.split('\n').filter(function(l){ return l.trim().length > 4; });
    var codes = (text.match(/\b\d{6,11}\b/g) || []).length;
    var digits = (text.match(/\d/g) || []).length;
    var arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
    var badChars = (text.match(/[^\u0600-\u06FFa-zA-Z0-9\s:.\-\/,()]/g) || []).length;
    return codes * 1000 + lines.length * 10 + digits + arabic - badChars * 5;
  }

  /* ============ Multi-pass ============ */
  async function multiPassOCR(imageSrc, onProgress){
    var modes = ['light', 'balanced', 'aggressive'];
    var results = [];

    for(var i = 0; i < modes.length; i++){
      var mode = modes[i];
      if(onProgress) onProgress('نسخة ' + (i+1) + '/' + modes.length + ' (' + mode + ')...', i * 30);
      try{
        var processed = await preprocess(imageSrc, mode);
        var text = await runTesseract(processed, function(pct){
          if(onProgress) onProgress('تحليل ' + (i+1) + '/' + modes.length + ' — ' + pct + '%', (i * 30) + (pct * 0.3));
        });
        var score = scoreText(text);
        results.push({ mode: mode, text: text, score: score });
      }catch(e){
        console.warn('Pass failed:', mode, e);
      }
    }

    results.sort(function(a, b){ return b.score - a.score; });
    return results;
  }

  /* ============ التحليل الرئيسي ============ */
  async function analyzeImage(file){
    if(!file || !file.type.startsWith('image/')){
      toast('⚠️ اختر صورة صالحة', 'warn');
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
    if(bar) bar.style.width = '0%';

    toast('🎨 يعالج 3 نسخ من الصورة...', 'info', 3000);

    var reader = new FileReader();
    reader.onload = async function(){
      var imageSrc = reader.result;

      var results;
      try{
        results = await multiPassOCR(imageSrc, function(msg, pct){
          if(bar) bar.style.width = Math.min(100, pct) + '%';
          if(progressText) progressText.textContent = msg;
        });
      }catch(e){
        console.error(e);
        if(progressText) progressText.textContent = '❌ فشل';
        toast('فشل: ' + (e.message || e), 'warn', 4000);
        return;
      }

      if(!results || !results.length){
        if(progressText) progressText.textContent = '❌ فشل التحليل';
        toast('فشل — جرّب صورة أوضح', 'warn', 4000);
        return;
      }

      var best = results[0];

      if(bar) bar.style.width = '100%';
      if(progressText) progressText.textContent = '✅ الأفضل: ' + best.mode + ' (جودة ' + best.score + ')';

      var ta = document.getElementById('ocrTextarea');
      if(ta) ta.value = best.text;

      var resultEl = document.getElementById('ocrResult');
      if(resultEl) resultEl.style.display = 'block';

      toast('✅ ' + best.text.split('\n').length + ' سطر — الوضع: ' + best.mode, 'success', 3500);

      if(best.text.trim() && window.TimetableImporter && window.TimetableImporter.open){
        setTimeout(function(){
          window.TimetableImporter.open(best.text);
        }, 600);
      }
    };
    reader.readAsDataURL(file);
  }

  /* ============ ربط الزر ============ */
  function install(){
    var uploadZone = document.getElementById('uploadZone');
    var ocrFile = document.getElementById('ocrFile');
    if(!uploadZone || !ocrFile){
      console.warn('⚠️ عناصر رفع الصورة غير موجودة');
      return;
    }
    if(uploadZone._cleanBound) return;
    uploadZone._cleanBound = true;

    uploadZone.addEventListener('click', function(e){
      if(e.target.tagName !== 'INPUT') ocrFile.click();
    });

    ocrFile.addEventListener('change', function(e){
      var f = e.target.files[0];
      if(f) analyzeImage(f);
      ocrFile.value = '';
    });

    uploadZone.addEventListener('dragover', function(e){ e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', function(){ uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', function(e){
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      var f = e.dataTransfer.files[0];
      if(f) analyzeImage(f);
    });

    console.log('📸 OCR نظيف: bound');
  }

  window.ocrAdvanced = {
    analyze: analyzeImage,
    handle: analyzeImage,
    test: function(){
      console.log('🔍 اختبار Tesseract...');
      return loadTesseract().then(function(){
        console.log('✅ Tesseract جاهز');
        return 'ready';
      }).catch(function(e){
        console.error('❌ فشل:', e);
        return 'failed';
      });
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 1000); });
  } else {
    setTimeout(install, 1000);
  }

  console.log('📸 OCR نظيف — Tesseract.js فقط');
})();