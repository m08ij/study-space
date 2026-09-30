/* ============================================================
   📸 ocr-advanced.js v5 — Row-based OCR + HU Table Filter
   ✅ يفلتر أسطر الرأس
   ✅ يدمج الأسطر المبعثرة للمادة الواحدة
   ✅ يزيل "ال" التعريف قبل الـ fuzzy matching
   ✅ لو المادة تطابقت → يستبدل كود OCR الغلط بكود DB الصحيح
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

  /* ============ تحميل Tesseract ============ */
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

  /* ============ تطبيع عربي ============ */
  function normAr(s){
    return String(s||'')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىئي]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/[()\[\]{}،,؛;:./\\|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /* ============ 🆕 إزالة "ال" التعريف ============ */
  function stripAl(t){
    t = String(t || '');
    if(t.length > 3 && t.indexOf('ال') === 0) return t.slice(2);
    return t;
  }

  function levenshtein(a, b){
    if(!a.length) return b.length;
    if(!b.length) return a.length;
    var m = [];
    for(var i = 0; i <= b.length; i++) m[i] = [i];
    for(var j = 0; j <= a.length; j++) m[0][j] = j;
    for(i = 1; i <= b.length; i++){
      for(j = 1; j <= a.length; j++){
        m[i][j] = b.charAt(i-1) === a.charAt(j-1)
          ? m[i-1][j-1]
          : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
      }
    }
    return m[b.length][a.length];
  }
  function sim(a, b){
    if(a === b) return 1;
    var L = Math.max(a.length, b.length);
    if(L < 3) return 0;
    return 1 - (levenshtein(a, b) / L);
  }

  /* ============================================================
     فلترة أسطر الرأس
     ============================================================ */
  var HEADER_WORDS = [
    'رقم الماده', 'اسم الماده', 'الشعبه', 'النظري', 'العملي',
    'وقت المحاضره', 'عدد الساعات', 'القاعه', 'كما هو اسم',
    'المحاضره', 'الدراسي', 'الفصل', 'الجامعه', 'الهاشميه',
    'رقم القاعه', 'اذا', 'اده', 'الماده'
  ];

  function isHeaderLine(line){
    var t = normAr(line);
    if(!t || t.length < 4) return true;
    var hits = 0;
    HEADER_WORDS.forEach(function(w){
      if(t.indexOf(normAr(w)) > -1) hits++;
    });
    if(hits >= 2) return true;
    if(!/[\u0600-\u06FF]/.test(t) && !/\d{8,11}/.test(t)) return true;
    return false;
  }

  function filterHeaderLines(lines){
    return lines.filter(function(line){
      if(!line || !line.trim()) return false;
      return !isHeaderLine(line);
    });
  }

  /* ============================================================
     🆕 دمج الأسطر — نسخة محسّنة
     - كل سطر ما فيه كود 8-11 رقم → buffer
     - لو الـ buffer طويل أو فيه معلومات كافية → ادمجه مع السطر الحالي
     ============================================================ */
  function mergeHeaderWithNext(lines){
    var out = [];
    var buffer = '';

    function flushBuffer(){
      if(buffer.trim()) out.push(buffer.trim());
      buffer = '';
    }

    for(var i = 0; i < lines.length; i++){
      var line = (lines[i] || '').trim();
      if(!line) continue;

      var hasCode = /\d{8,11}/.test(line);

      if(!hasCode){
        // سطر بدون كود → buffer
        if(!buffer) buffer = line;
        else buffer += ' ' + line;
      } else {
        // سطر فيه كود
        if(buffer){
          out.push((buffer + ' ' + line).trim());
          buffer = '';
        } else {
          out.push(line);
        }
      }
      // لو الـ buffer طويل جداً وواضح إنه ما رح يندمج
      if(buffer.length > 250) flushBuffer();
    }
    flushBuffer();
    return out;
  }

  /* ============================================================
     إيجاد المادة — نسخة v5 مع إزالة "ال"
     ============================================================ */
  function findCourseInText(text){
    var DB = window.COURSES_DB || {};
    var line = normAr(text);
    var lineTokens = line.split(/\s+/).filter(function(t){ return t.length > 2; });
    var lineStripped = lineTokens.map(stripAl);
    var best = null, bestScore = 0;

    Object.keys(DB).forEach(function(key){
      var nKey = normAr(key);
      var cleanKey = nKey.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if(cleanKey.length < 5) return;

      // 1) تطابق مباشر
      if(line.indexOf(cleanKey) > -1){
        if(bestScore < 100){ best = key; bestScore = 100; }
        return;
      }

      // 2) 🆕 تطابق بعد إزالة "ال"
      var keyStripped = cleanKey.split(/\s+/).map(stripAl).join(' ');
      if(keyStripped.length >= 4 && line.indexOf(keyStripped) > -1){
        if(bestScore < 95){ best = key; bestScore = 95; }
        return;
      }

      // 3) تطابق كلمة بكلمة (fuzzy مع الـ stripped)
      var keyTokens = cleanKey.split(/\s+/)
        .filter(function(t){ return t.length > 2; })
        .map(stripAl);
      if(!keyTokens.length) return;

      var matched = 0;
      keyTokens.forEach(function(kt){
        if(lineStripped.some(function(lt){
          return lt === kt || sim(lt, kt) >= 0.7;
        })) matched++;
      });
      var ratio = matched / keyTokens.length;
      // ✅ خفّضنا العتبة من 0.7 إلى 0.66
      if(ratio >= 0.66 && ratio * 100 > bestScore){
        bestScore = ratio * 100;
        best = key;
      }
    });

    return best;
  }

  /* ============ استخراج الكود من السطر ============ */
  function extractCodeFromLine(line){
    var m = String(line).match(/\d{8,11}/);
    return m ? m[0] : null;
  }

  /* ============ إصلاح الأكواد المشوّهة ============ */
  function repairCode(badCode, contextText){
    if(!badCode) return null;
    var DB = window.COURSES_DB || {};
    var clean = String(badCode).replace(/^0+/, '');
    if(!clean) return null;

    // 1) تطابق تام مع DB
    for(var k in DB){
      var c = String(DB[k].code || '').replace(/^0+/, '');
      if(c === clean) return c;
    }

    // 2) Levenshtein على الأكواد (فقط لو الطول قريب)
    if(clean.length >= 8){
      var best = null, bestScore = 0;
      for(var k2 in DB){
        var c2 = String(DB[k2].code || '').replace(/^0+/, '');
        if(Math.abs(c2.length - clean.length) > 2) continue;
        var sc = sim(clean, c2);
        if(sc > bestScore){ bestScore = sc; best = c2; }
      }
      if(bestScore >= 0.82) return best;
    }

    // 3) سياق النص — اسم المادة
    if(contextText){
      var course = findCourseInText(contextText);
      if(course && DB[course] && DB[course].code){
        return String(DB[course].code).replace(/^0+/, '');
      }
    }
    return null;
  }

  /* ============ تجميع الكلمات في صفوف ============ */
  function groupIntoRows(words, tolerance){
    if(!words || !words.length) return [];
    words.sort(function(a, b){ return a.bbox.y0 - b.bbox.y0; });

    var rows = [], currentRow = [], currentY = null;

    words.forEach(function(w){
      var y = (w.bbox.y0 + w.bbox.y1) / 2;
      if(currentY === null || Math.abs(y - currentY) <= tolerance){
        currentRow.push(w);
        currentY = currentY === null ? y : (currentY * currentRow.length + y) / (currentRow.length + 1);
      } else {
        rows.push(currentRow);
        currentRow = [w];
        currentY = y;
      }
    });
    if(currentRow.length) rows.push(currentRow);
    return rows;
  }

  function rowToText(row){
    row.sort(function(a, b){ return b.bbox.x0 - a.bbox.x0; });
    return row.map(function(w){ return w.text; }).join(' ');
  }

  /* ============================================================
     المعالجة الرئيسية
     ============================================================ */
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

      var data = result.data || {};
      var words = data.words || [];
      console.log('📊 عدد الكلمات:', words.length);

      var lines = [];

      if(words.length){
        if(data.lines && data.lines.length){
          data.lines.forEach(function(ln){
            if(ln.text && ln.text.trim()) lines.push(ln.text.trim());
          });
        } else {
          var rows = groupIntoRows(words, 15);
          rows.forEach(function(row){
            var t = rowToText(row);
            if(t.trim()) lines.push(t.trim());
          });
        }
      } else if(data.text){
        lines = data.text.split(/\n+/).filter(function(l){ return l.trim(); });
      }

      console.log('📝 عدد الأسطر الخام:', lines.length);
      lines = filterHeaderLines(lines);
      console.log('🧹 بعد فلترة الرأس:', lines.length);
      lines = mergeHeaderWithNext(lines);
      console.log('🔗 بعد الدمج:', lines.length);

      if(bar) bar.style.width = '85%';
      if(progressText) progressText.textContent = '🔄 ترتيب المواد...';

      var finalLines = [];
      var seenCourses = {};
      var seenCodes = {};

      lines.forEach(function(line){
        var course = findCourseInText(line);
        var DB = window.COURSES_DB || {};
        var rawCode = extractCodeFromLine(line);
        var finalCode = null;
        var usedDB = false;

        // 1) لو لقينا المادة → خذ الكود من DB دايماً (أدق من OCR)
        if(course && DB[course]){
          finalCode = String(DB[course].code || '').replace(/^0+/, '');
          usedDB = true;
        } else if(rawCode){
          // 2) حاول إصلاح الكود
          finalCode = repairCode(rawCode, line);
        }

        if(course && !seenCourses[course]){
          seenCourses[course] = true;
          if(finalCode) seenCodes[finalCode] = true;

          var cleanLine = line;
          // ✅ لو الكود الخام غلط، استبدله بالكود الصحيح من DB
          if(rawCode && finalCode && rawCode !== finalCode){
            cleanLine = line.replace(rawCode, finalCode);
          } else if(!rawCode && finalCode){
            cleanLine = finalCode + ' ' + line;
          }
          finalLines.push(cleanLine);
        } else if(!course){
          if(rawCode && seenCodes[rawCode]) return;
          if(rawCode) seenCodes[rawCode] = true;
          finalLines.push(line);
        }
      });

      if(!Object.keys(seenCourses).length && !finalLines.length){
        finalLines = lines;
      }

      var outputText = finalLines.join('\n');
      console.log('✅ الأسطر النهائية:\n' + outputText);

      if(bar) bar.style.width = '100%';
      if(progressText) progressText.textContent = '✅ تم — ' + Object.keys(seenCourses).length + ' مادة';

      var ta = document.getElementById('ocrTextarea');
      if(ta) ta.value = outputText;

      var resultEl = document.getElementById('ocrResult');
      if(resultEl) resultEl.style.display = 'block';

      toast('✅ ' + Object.keys(seenCourses).length + ' مادة من ' + lines.length + ' سطر', 'success', 3500);

      if(window.TimetableImporter && window.TimetableImporter.open){
        setTimeout(function(){
          window.TimetableImporter.open(outputText);
        }, 500);
      }

    }catch(e){
      console.error('OCR error:', e);
      if(progressText) progressText.textContent = '❌ فشل: ' + e.message;
      if(bar) bar.style.width = '0%';
      toast('فشل: ' + (e.message || e), 'warn', 4000);
    }
  }

  /* ============ ربط الزر ============ */
  function install(){
    var uploadZone = document.getElementById('uploadZone');
    var ocrFile = document.getElementById('ocrFile');
    if(!uploadZone || !ocrFile) return;
    if(uploadZone._v5Bound) return;
    uploadZone._v5Bound = true;

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

    console.log('📸 OCR v5 (row + header filter + ال-strip): bound');
  }

  window.ocrAdvanced = {
    analyze: analyzeImage,
    filterHeaderLines: filterHeaderLines,
    mergeHeaderWithNext: mergeHeaderWithNext,
    repairCode: repairCode,
    findCourseInText: findCourseInText,
    test: function(){
      console.log('📸 OCR v5 — ال-strip + DB code override');
      return 'ready';
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 1000); });
  } else { setTimeout(install, 1000); }

  console.log('📸 OCR v5 — Row-based + Header Filter + Code Repair + ال-strip');
})();