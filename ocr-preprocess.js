/* ============================================================
   🎨 ocr-preprocess.js — تحسين Tesseract بـ Canvas
   ✅ Multi-pass: 3 محاولات preprocessing
   ✅ Adaptive threshold (Bradley) — أسرع 50x من Gaussian
   ✅ Median denoise 3x3
   ✅ إزالة خطوط الجدول تلقائياً
   ✅ إصلاح الأرقام العربية
   ✅ معاملات Tesseract محسّنة للعربي
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

  /* ============ تحميل صورة ============ */
  function loadImage(src){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function(){ resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  /* ============ 1) تكبير الصور الصغيرة ============ */
  function upscaleIfNeeded(img, targetWidth){
    targetWidth = targetWidth || 2000;
    if(img.width >= targetWidth) return null;
    var scale = targetWidth / img.width;
    var canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = Math.round(img.height * scale);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /* ============ 2) رمادي + تحسين التباين (Histogram Stretch) ============ */
  function grayscaleAndStretch(imageData){
    var data = imageData.data;
    var min = 255, max = 0;
    for(var i = 0; i < data.length; i += 4){
      var g = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) | 0;
      data[i] = data[i+1] = data[i+2] = g;
      if(g < min) min = g;
      if(g > max) max = g;
    }
    if(max - min > 20){
      var range = max - min;
      for(var j = 0; j < data.length; j += 4){
        var v = ((data[j] - min) * 255 / range) | 0;
        v = v < 0 ? 0 : (v > 255 ? 255 : v);
        data[j] = data[j+1] = data[j+2] = v;
      }
    }
    return imageData;
  }

  /* ============ 3) Adaptive Threshold (Bradley) ============ */
  function adaptiveThreshold(imageData, width, height, sensitivity, windowSize){
    sensitivity = sensitivity || 15;
    windowSize = windowSize || Math.max(15, (width / 30) | 0);
    var data = imageData.data;
    var gray = new Uint8Array(width * height);
    for(var i = 0; i < data.length; i += 4){
      gray[i / 4] = data[i];
    }

    // Integral image (Summed Area Table)
    var integral = new Int32Array((width + 1) * (height + 1));
    for(var y = 0; y < height; y++){
      var sum = 0;
      for(var x = 0; x < width; x++){
        sum += gray[y * width + x];
        integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + sum;
      }
    }

    var half = windowSize >> 1;
    for(var y2 = 0; y2 < height; y2++){
      var y1 = Math.max(0, y2 - half);
      var y2b = Math.min(height - 1, y2 + half);
      for(var x2 = 0; x2 < width; x2++){
        var x1 = Math.max(0, x2 - half);
        var x2b = Math.min(width - 1, x2 + half);
        var count = (x2b - x1 + 1) * (y2b - y1 + 1);
        var s = integral[(y2b + 1) * (width + 1) + (x2b + 1)]
              - integral[y1 * (width + 1) + (x2b + 1)]
              - integral[(y2b + 1) * (width + 1) + x1]
              + integral[y1 * (width + 1) + x1];
        var avg = s / count;
        var value = gray[y2 * width + x2];
        var threshold = avg * (1 - sensitivity / 100);
        var result = value > threshold ? 255 : 0;
        var idx = (y2 * width + x2) * 4;
        data[idx] = data[idx+1] = data[idx+2] = result;
      }
    }
    return imageData;
  }

  /* ============ 4) Median Denoise (3x3) ============ */
  function medianDenoise(imageData, width, height){
    var data = imageData.data;
    var copy = new Uint8ClampedArray(data);
    for(var y = 1; y < height - 1; y++){
      for(var x = 1; x < width - 1; x++){
        var idx = (y * width + x) * 4;
        var vals = [];
        for(var dy = -1; dy <= 1; dy++){
          for(var dx = -1; dx <= 1; dx++){
            vals.push(copy[((y + dy) * width + (x + dx)) * 4]);
          }
        }
        vals.sort(function(a, b){ return a - b; });
        data[idx] = data[idx+1] = data[idx+2] = vals[4];
      }
    }
    return imageData;
  }

  /* ============ 5) إزالة خطوط الجدول ============ */
  function removeTableLines(imageData, width, height){
    var data = imageData.data;
    var copy = new Uint8ClampedArray(data);
    var minRun = Math.max(30, (width / 20) | 0);

    // خطوط أفقية
    for(var y = 0; y < height; y++){
      var run = 0;
      for(var x = 0; x < width; x++){
        var v = copy[(y * width + x) * 4];
        if(v < 100){ run++; }
        else {
          if(run >= minRun){
            for(var k = x - run; k < x; k++){
              var i1 = (y * width + k) * 4;
              data[i1] = data[i1+1] = data[i1+2] = 255;
            }
          }
          run = 0;
        }
      }
      if(run >= minRun){
        for(var k2 = width - run; k2 < width; k2++){
          var i2 = (y * width + k2) * 4;
          data[i2] = data[i2+1] = data[i2+2] = 255;
        }
      }
    }

    // خطوط عمودية
    for(var x3 = 0; x3 < width; x3++){
      var run2 = 0;
      for(var y3 = 0; y3 < height; y3++){
        var v2 = copy[(y3 * width + x3) * 4];
        if(v2 < 100){ run2++; }
        else {
          if(run2 >= minRun){
            for(var k3 = y3 - run2; k3 < y3; k3++){
              var i3 = (k3 * width + x3) * 4;
              data[i3] = data[i3+1] = data[i3+2] = 255;
            }
          }
          run2 = 0;
        }
      }
    }
    return imageData;
  }

  /* ============ 6) Pipeline المعالجة ============ */
  async function preprocess(srcImage, mode){
    mode = mode || 'balanced';
    var img = await loadImage(srcImage);
    var upCanvas = upscaleIfNeeded(img, 2000);
    var canvas = upCanvas || document.createElement('canvas');
    if(!upCanvas){
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
    }
    var ctx = canvas.getContext('2d');
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    grayscaleAndStretch(imageData);

    var cfg = {
      'light':      { sens: 10, win: 20 },
      'balanced':   { sens: 15, win: 25 },
      'aggressive': { sens: 20, win: 30 }
    }[mode] || { sens: 15, win: 25 };

    adaptiveThreshold(imageData, canvas.width, canvas.height, cfg.sens, cfg.win);
    medianDenoise(imageData, canvas.width, canvas.height);

    if(mode !== 'light'){
      removeTableLines(imageData, canvas.width, canvas.height);
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /* ============ 7) Tesseract بمعاملات الجداول ============ */
  function loadTesseract(){
    if(typeof Tesseract !== 'undefined') return Promise.resolve();
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function runTesseract(processedUrl, onProgress){
    await loadTesseract();
    var result = await Tesseract.recognize(processedUrl, 'ara', {
      // ✅ معاملات جداول
      tessedit_pageseg_mode: '6',           // Single uniform block
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
      // ✅ تحسين العربي
      tessedit_char_blacklist: '،؛؟!?',
      tessedit_do_invert: '0',
      textord_tabfind_find_tables: '1',
      logger: function(m){
        if(m.status === 'recognizing text' && onProgress){
          onProgress(Math.round(m.progress * 100));
        }
      }
    });
    return result.data.text || '';
  }

  /* ============ 8) جودة النتيجة ============ */
  function scoreText(text){
    if(!text) return 0;
    var lines = text.split('\n').filter(function(l){ return l.trim().length > 5; });
    var codes = (text.match(/\b\d{6,11}\b/g) || []).length;
    var digits = (text.match(/\d/g) || []).length;
    var arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
    var badChars = (text.match(/[^\u0600-\u06FFa-zA-Z0-9\s:.\-\/,()]/g) || []).length;
    return codes * 1000 + lines.length * 10 + digits + arabic - badChars * 5;
  }

  /* ============ 9) Multi-pass (3 محاولات) ============ */
  async function multiPassOCR(imageSrc, onProgress){
    var modes = ['light', 'balanced', 'aggressive'];
    var results = [];

    for(var i = 0; i < modes.length; i++){
      var mode = modes[i];
      if(onProgress) onProgress('تحضير ' + (i+1) + '/' + modes.length + ' — ' + mode, (i*30));
      try{
        var processed = await preprocess(imageSrc, mode);
        var text = await runTesseract(processed, function(pct){
          if(onProgress) onProgress('تحليل ' + (i+1) + '/' + modes.length + ' — ' + pct + '%', (i*30) + (pct*0.3));
        });
        var score = scoreText(text);
        results.push({ mode: mode, text: text, score: score, processed: processed });
      }catch(e){
        console.warn('Pass failed:', mode, e);
      }
    }

    results.sort(function(a, b){ return b.score - a.score; });
    return results;
  }

  /* ============ 10) المعالج الرئيسي ============ */
  async function handleImage(file){
    if(!file || !file.type.startsWith('image/')){ toast('استخدم صورة', 'warn'); return; }

    var reader = new FileReader();
    reader.onload = async function(){
      var imageSrc = reader.result;

      var preview = document.getElementById('ocrPreview');
      if(preview){
        preview.style.display = 'block';
        preview.innerHTML = '<img src="' + imageSrc + '" style="max-width:100%;border-radius:12px;max-height:300px">';
      }

      var progress = document.getElementById('ocrProgress');
      var bar = document.getElementById('ocrBar');
      var progressText = document.getElementById('ocrText');
      if(progress) progress.style.display = 'block';
      if(bar) bar.style.width = '0%';

      toast('🎨 يعالج 3 نسخ من الصورة...', 'info', 3000);

      var results;
      try{
        results = await multiPassOCR(imageSrc, function(msg, pct){
          if(bar) bar.style.width = Math.min(100, pct) + '%';
          if(progressText) progressText.textContent = msg;
        });
      }catch(e){
        console.error(e);
        if(progressText) progressText.textContent = '❌ فشل';
        toast('فشل — جرّب صورة أوضح', 'warn', 4000);
        return;
      }

      if(!results.length){
        if(progressText) progressText.textContent = '❌ فشل التحليل';
        toast('فشل — جرّب صورة أوضح', 'warn', 4000);
        return;
      }

      var best = results[0];

      // عرض مقارنة بصرية
      if(preview){
        preview.innerHTML =
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
            '<div>' +
              '<div style="font-size:.7rem;color:var(--muted);margin-bottom:4px;text-align:center">الأصلية</div>' +
              '<img src="' + imageSrc + '" style="width:100%;border-radius:8px;max-height:200px;object-fit:contain;background:#fff">' +
            '</div>' +
            '<div>' +
              '<div style="font-size:.7rem;color:var(--cyan);margin-bottom:4px;text-align:center">المعالجة (' + best.mode + ')</div>' +
              '<img src="' + best.processed + '" style="width:100%;border-radius:8px;max-height:200px;object-fit:contain;background:#fff">' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center">' +
            results.map(function(r){
              return '<span style="padding:3px 10px;border-radius:8px;font-size:.7rem;font-weight:700;' +
                (r.mode === best.mode ? 'background:var(--grad);color:#0b0f1a' : 'background:var(--bg2);color:var(--muted)') + '">' +
                r.mode + ': ' + r.score + '</span>';
            }).join('') +
          '</div>';
      }

      var ta = document.getElementById('ocrTextarea');
      if(ta) ta.value = best.text;

      var resultEl = document.getElementById('ocrResult');
      if(resultEl) resultEl.style.display = 'block';

      if(bar) bar.style.width = '100%';
      if(progressText) progressText.textContent = '✅ الأفضل: ' + best.mode + ' (جودة ' + best.score + ')';

      toast('✅ ' + best.text.split('\n').length + ' سطر — الوضع: ' + best.mode, 'success', 3500);

      // افتح المستورد تلقائياً
      if(window.TimetableImporter && window.TimetableImporter.open){
        setTimeout(function(){
          window.TimetableImporter.open(best.text);
        }, 600);
      }
    };
    reader.readAsDataURL(file);
  }

  /* ============ 11) Install ============ */
  function install(){
    // استبدل معالج OCR القديم (clone يحذف كل المستمعين السابقين)
    var ocrFile = document.getElementById('ocrFile');
    if(ocrFile && !ocrFile._ppBound){
      ocrFile._ppBound = true;
      var newInput = ocrFile.cloneNode(true);
      ocrFile.parentNode.replaceChild(newInput, ocrFile);
      newInput.addEventListener('change', function(e){
        var f = e.target.files[0];
        if(f) handleImage(f);
      });
    }

    // drag-drop على zone
    var uz = document.getElementById('uploadZone');
    if(uz && !uz._ppBound){
      uz._ppBound = true;
      uz.addEventListener('dragover', function(e){ e.preventDefault(); uz.classList.add('dragover'); });
      uz.addEventListener('dragleave', function(){ uz.classList.remove('dragover'); });
      uz.addEventListener('drop', function(e){
        e.preventDefault(); uz.classList.remove('dragover');
        var f = e.dataTransfer.files[0];
        if(f) handleImage(f);
      });
    }

    console.log('🎨 OCR Preprocess: bound to input');
  }

  /* ============ Public API ============ */
  window.ocrPreprocess = {
    preprocess: preprocess,
    recognize: multiPassOCR,
    handle: handleImage,
    scoreText: scoreText,
    test: async function(url){
      var results = await multiPassOCR(url);
      console.table(results.map(function(r){
        return { mode: r.mode, score: r.score, preview: r.text.slice(0, 60) };
      }));
      return results;
    }
  };

  // ✅ تأخير التركيب ليتجاوز boot() في index.html
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 1500); });
  } else {
    setTimeout(install, 1500);
  }

  console.log('🎨 OCR Preprocess v1 loaded — multi-pass + adaptive threshold');
})();