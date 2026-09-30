/* ============================================================
   📸 ocr-advanced.js v8 — Column Classifier + Learner + Fallback
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

  var DAY_LETTER = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };

  function loadTesseract(){
    if(typeof Tesseract !== 'undefined' && Tesseract.recognize) return Promise.resolve();
    if(window._tessLoading) return window._tessLoading;
    window._tessLoading = new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = resolve;
      s.onerror = function(){ reject(new Error('فشل تحميل Tesseract')); };
      document.head.appendChild(s);
    });
    return window._tessLoading;
  }

  function normAr(s){
    return String(s||'')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىئي]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/[()\[\]{}،,؛;:.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function sim(a, b){
    if(a === b) return 1;
    if(!a || !b) return 0;
    var L = Math.max(a.length, b.length);
    if(L < 3) return 0;
    var m = [];
    for(var i = 0; i <= b.length; i++) m[i] = [i];
    for(var j = 0; j <= a.length; j++) m[0][j] = j;
    for(i = 1; i <= b.length; i++){
      for(j = 1; j <= a.length; j++){
        m[i][j] = b.charAt(i-1) === a.charAt(j-1) ? m[i-1][j-1]
          : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
      }
    }
    return 1 - (m[b.length][a.length] / L);
  }

  var HEADER_WORDS = ['رقم الماده','اسم الماده','الشعبه','النظري','العملي','وقت المحاضره','عدد الساعات','القاعه','المحاضره','الفصل','اذا','اده'];

  function isHeaderLine(line){
    var t = normAr(line);
    if(!t || t.length < 4) return true;
    var hits = 0;
    HEADER_WORDS.forEach(function(w){ if(t.indexOf(normAr(w)) > -1) hits++; });
    if(hits >= 2) return true;
    if(!/[\u0600-\u06FF]/.test(t) && !/\d{8,11}/.test(t)) return true;
    return false;
  }

  function filterHeaderLines(lines){
    return lines.filter(function(l){ return l && l.trim() && !isHeaderLine(l); });
  }

  function mergeHeaderWithNext(lines){
    var out = [], buffer = '';
    function flush(){ if(buffer.trim()) out.push(buffer.trim()); buffer = ''; }
    lines.forEach(function(line){
      line = (line || '').trim();
      if(!line) return;
      if(!/\d{8,11}/.test(line)){
        buffer = buffer ? buffer + ' ' + line : line;
      } else {
        out.push(buffer ? (buffer + ' ' + line).trim() : line);
        buffer = '';
      }
      if(buffer.length > 250) flush();
    });
    flush();
    return out;
  }

  function findCourseInText(text){
    var DB = window.COURSES_DB || {};
    var line = normAr(text);
    var lineTokens = line.split(/\s+/).filter(function(t){ return t.length > 2; });
    var best = null, bestScore = 0;

    Object.keys(DB).forEach(function(key){
      var nKey = normAr(key).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if(nKey.length < 5) return;
      if(line.indexOf(nKey) > -1){ best = key; bestScore = 100; return; }
      var keyTokens = nKey.split(/\s+/).filter(function(t){ return t.length > 2; });
      if(!keyTokens.length) return;
      var matched = 0;
      keyTokens.forEach(function(kt){
        if(lineTokens.some(function(lt){ return lt === kt || sim(lt, kt) >= 0.75; })) matched++;
      });
      var ratio = matched / keyTokens.length;
      if(ratio >= 0.7 && ratio * 100 > bestScore){ bestScore = ratio * 100; best = key; }
    });
    return best;
  }

  function groupIntoRows(words, tol){
    tol = tol || 15;
    if(!words || !words.length) return [];
    words.sort(function(a, b){ return a.bbox.y0 - b.bbox.y0; });
    var rows = [], cur = [], curY = null;
    words.forEach(function(w){
      var y = (w.bbox.y0 + w.bbox.y1) / 2;
      if(curY === null || Math.abs(y - curY) <= tol){
        cur.push(w);
        curY = curY === null ? y : (curY * cur.length + y) / (cur.length + 1);
      } else { rows.push(cur); cur = [w]; curY = y; }
    });
    if(cur.length) rows.push(cur);
    return rows;
  }

  function rowToText(row){
    row.sort(function(a, b){ return b.bbox.x0 - a.bbox.x0; });
    return row.map(function(w){ return w.text; }).join(' ');
  }

  function loadImage(file){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

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
    if(bar) bar.style.width = '10%';
    if(progressText) progressText.textContent = '⏳ تحميل Tesseract...';

    try{
      var img = await loadImage(file);
      var W = img.naturalWidth, H = img.naturalHeight;
      console.log('🖼️ أبعاد الصورة:', W, '×', H);

      await loadTesseract();
      if(bar) bar.style.width = '40%';
      if(progressText) progressText.textContent = '⏳ قراءة الجدول...';

      var result = await Tesseract.recognize(file, 'ara', {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        logger: function(m){
          if(m.status === 'recognizing text' && progressText){
            var pct = Math.round(m.progress * 100);
            progressText.textContent = '⏳ تحليل ' + pct + '%';
            if(bar) bar.style.width = (40 + pct * 0.4) + '%';
          }
        }
      });

      if(bar) bar.style.width = '80%';
      if(progressText) progressText.textContent = '📊 تحليل الأعمدة...';

      // 1) جرّب Column Classifier أولاً (الأذكى)
      var parsed = { records: [], ok: false };
      if(window.ColumnClassifier){
        try{
          parsed = window.ColumnClassifier.parseTable(result.data, W);
          console.log('📊 Column Classifier:', parsed.records.length, 'سجل · ok =', parsed.ok);
        }catch(e){ console.warn('⚠️ Column Classifier فشل:', e); }
      }

      // 2) لو فشل → جرّب Table Parser القديم
      if((!parsed.ok || !parsed.records.length) && window.OCRTableParser){
        try{
          parsed = window.OCRTableParser.parse(result.data, W, H);
          console.log('🏛️ Table Parser (fallback):', parsed.records.length, 'سجل');
        }catch(e){ console.warn('⚠️ Table Parser فشل:', e); }
      }

      var outputText = '';

      if(parsed.ok && parsed.records.length > 0){
        outputText = parsed.records.map(function(r){
          var daysAr = r.days.map(function(d){
            for(var k in DAY_LETTER){ if(DAY_LETTER[k] === d) return k; }
            return '';
          }).join(' ');
          return r.code + ' ' + r.name + ' 0 0 ' + (daysAr || 'ح') + ' / ' +
                 (r.timeStart || '--:--') + ' - ' + (r.timeEnd || '--:--') + ' ' +
                 (r.room ? 'قاعة ' + r.room + ' ' : '') + r.hours;
        }).join('\n');
        if(progressText) progressText.textContent = '✅ ' + parsed.records.length + ' مادة';
      } else {
        // 3) fallback line-based
        console.log('🔄 fallback (line-based)...');
        var lines = [];
        if(result.data.words && result.data.words.length){
          if(result.data.lines && result.data.lines.length){
            result.data.lines.forEach(function(ln){
              if(ln.text && ln.text.trim()) lines.push(ln.text.trim());
            });
          } else {
            groupIntoRows(result.data.words, 15).forEach(function(row){
              var t = rowToText(row);
              if(t.trim()) lines.push(t.trim());
            });
          }
        } else if(result.data.text){
          lines = result.data.text.split(/\n+/).filter(function(l){ return l.trim(); });
        }

        lines = filterHeaderLines(lines);
        lines = mergeHeaderWithNext(lines);

        var finalLines = [], seen = {};
        lines.forEach(function(line){
          var course = findCourseInText(line);
          if(course && !seen[course]){
            seen[course] = true;
            var DB = window.COURSES_DB || {};
            var code = (DB[course] || {}).code || '';
            finalLines.push(code ? code + ' ' + line : line);
          } else if(!course){
            finalLines.push(line);
          }
        });
        outputText = finalLines.length ? finalLines.join('\n') : lines.join('\n');
        if(progressText) progressText.textContent = '⚠️ fallback — ' + lines.length + ' سطر';
      }

      if(bar) bar.style.width = '100%';

      var ta = document.getElementById('ocrTextarea');
      if(ta) ta.value = outputText;

      var resultEl = document.getElementById('ocrResult');
      if(resultEl) resultEl.style.display = 'block';

      toast('✅ تم — ' + (parsed.ok ? parsed.records.length + ' مادة' : 'fallback'), 'success', 3500);

      if(window.TimetableImporter && window.TimetableImporter.open){
        setTimeout(function(){ window.TimetableImporter.open(outputText); }, 500);
      }

    }catch(e){
      console.error('OCR error:', e);
      if(progressText) progressText.textContent = '❌ فشل: ' + e.message;
      if(bar) bar.style.width = '0%';
      toast('فشل: ' + (e.message || e), 'warn', 4000);
    }
  }

  function install(){
    var uploadZone = document.getElementById('uploadZone');
    var ocrFile = document.getElementById('ocrFile');

    if(!uploadZone || !ocrFile){
      install._tries = (install._tries || 0) + 1;
      if(install._tries < 30) return setTimeout(install, 200);
      console.warn('⚠️ OCR: uploadZone/ocrFile مش موجودين');
      return;
    }

    if(uploadZone._v8Bound) return;
    uploadZone._v8Bound = true;

    console.log('✅ OCR v8: bound to uploadZone');

    uploadZone.addEventListener('click', function(e){
      if(e.target === ocrFile) return;
      e.preventDefault();
      ocrFile.click();
    });

    ocrFile.addEventListener('change', function(e){
      var f = e.target.files && e.target.files[0];
      if(f) analyzeImage(f);
      ocrFile.value = '';
    });

    uploadZone.addEventListener('dragover', function(e){
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', function(){
      uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', function(e){
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) analyzeImage(f);
    });
  }

  window.ocrAdvanced = {
    analyze: analyzeImage,
    install: install,
    filterHeaderLines: filterHeaderLines,
    mergeHeaderWithNext: mergeHeaderWithNext,
    findCourseInText: findCourseInText
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 200); });
  } else {
    setTimeout(install, 200);
  }
  setTimeout(install, 800);
  setTimeout(install, 1500);
  setTimeout(install, 2500);

  console.log('📸 OCR v8 FINAL — Column Classifier + Learner ready');
})();