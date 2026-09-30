/* ============================================================
   📸 ocr-advanced.js v4 — Row-based OCR + HU Table Filter
   ✅ يقرأ الكلمات مع مواقعها من Tesseract
   ✅ يجمع الكلمات في صفوف حسب الإحداثي y
   ✅ يفلتر أسطر الرأس (رقم المادة/اسم المادة/الشعبة...)
   ✅ يربط كل صف بمادة من COURSES_DB (fuzzy + Levenshtein)
   ✅ يخرج نص نظيف بصف لكل مادة
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
      .replace(/[()\[\]{}،,؛;:.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
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
     🆕 فلترة أسطر الرأس — تنظيف مخرجات OCR
     ============================================================ */
  var HEADER_WORDS = [
    'رقم الماده', 'اسم الماده', 'الشعبه', 'النظري', 'العملي',
    'وقت المحاضره', 'عدد الساعات', 'القاعه', 'كما هو اسم',
    'المحاضره', 'الدراسي', 'الفصل', 'الجامعه', 'الهاشميه',
    'الماده', 'الشعبه النظري', 'الشعبه العملي', 'رقم القاعه',
    'وقت المحاضره/رقم القاعه'
  ];

  function isHeaderLine(line){
    var t = normAr(line);
    if(!t) return true;
    // لو السطر قصير جداً
    if(t.length < 4) return true;
    // احسب عدد كلمات الرأس الموجودة
    var hits = 0;
    HEADER_WORDS.forEach(function(w){
      if(t.indexOf(normAr(w)) > -1) hits++;
    });
    // لو فيه كلمتين رأس أو أكثر → سطر رأس
    if(hits >= 2) return true;
    // لو ما فيه حرف عربي ولا كود 8-11 رقم → تجاهل
    if(!/[\u0600-\u06FF]/.test(t) && !/\d{8,11}/.test(t)) return true;
    return false;
  }

  function filterHeaderLines(lines){
    return lines.filter(function(line){
      if(!line || !line.trim()) return false;
      if(isHeaderLine(line)) return false;
      return true;
    });
  }

  /* ============================================================
     🆕 دمج أسطر الرأس المتعددة مع السطر التالي
     ============================================================ */
  function mergeHeaderWithNext(lines){
    var out = [];
    var buffer = '';
    for(var i = 0; i < lines.length; i++){
      var line = lines[i].trim();
      if(!line) continue;
      // لو السطر ما فيه كود 8-11 رقم → احتفظ فيه كـ buffer
      if(!/\d{8,11}/.test(line)){
        // لو الـ buffer فاضي، خزنه
        if(!buffer) buffer = line;
        else buffer += ' ' + line;
        // لو الـ buffer صار طويل، تخلص منه كسطر عادي
        if(buffer.length > 200){
          out.push(buffer);
          buffer = '';
        }
      } else {
        // السطر فيه كود → ادمجه مع الـ buffer
        if(buffer){
          out.push(buffer + ' ' + line);
          buffer = '';
        } else {
          out.push(line);
        }
      }
    }
    if(buffer) out.push(buffer);
    return out;
  }

  /* ============ إيجاد المادة من نص ============ */
  function findCourseInText(text){
    var DB = window.COURSES_DB || {};
    var line = normAr(text);
    var lineTokens = line.split(/\s+/).filter(function(t){ return t.length > 2; });
    var best = null, bestScore = 0;

    Object.keys(DB).forEach(function(key){
      var nKey = normAr(key);
      var cleanKey = nKey.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if(cleanKey.length < 6) return;

      // 1) تطابق مباشر
      if(line.indexOf(cleanKey) > -1){
        best = key; bestScore = 100;
        return;
      }

      // 2) تطابق كلمة بكلمة
      var keyTokens = cleanKey.split(/\s+/).filter(function(t){ return t.length > 2; });
      if(keyTokens.length < 1) return;

      var matched = 0;
      keyTokens.forEach(function(kt){
        if(lineTokens.some(function(lt){ return lt === kt || sim(lt, kt) >= 0.75; })) matched++;
      });
      var ratio = matched / keyTokens.length;
      if(ratio >= 0.7 && ratio > bestScore){
        bestScore = ratio;
        best = key;
      }
    });

    return best;
  }

  /* ============ تجميع الكلمات في صفوف ============ */
  function groupIntoRows(words, tolerance){
    if(!words || !words.length) return [];
    words.sort(function(a, b){ return a.bbox.y0 - b.bbox.y0; });

    var rows = [];
    var currentRow = [];
    var currentY = null;

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

  /* ============ ترتيب كلمات السطر ============ */
  function rowToText(row){
    // في العربي: رتّب تنازلي بـ x (من اليمين)
    row.sort(function(a, b){ return b.bbox.x0 - a.bbox.x0; });
    return row.map(function(w){ return w.text; }).join(' ');
  }

  /* ============================================================
     🆕 استخراج الكود من السطر — للتحقق من صحة OCR
     ============================================================ */
  function extractCodeFromLine(line){
    var m = String(line).match(/\d{8,11}/);
    return m ? m[0] : null;
  }

  /* ============================================================
     🆕 إصلاح الأكواد المشوّهة من OCR
     ============================================================ */
  function repairCode(badCode, contextText){
    if(!badCode) return null;
    var DB = window.COURSES_DB || {};
    var codes = Object.keys(DB).map(function(k){
      return { key: k, code: String(DB[k].code || '').replace(/^0+/, '') };
    }).filter(function(x){ return x.code.length >= 8; });

    var clean = String(badCode).replace(/^0+/, '');
    if(!clean) return null;

    // 1) تطابق تام
    for(var i = 0; i < codes.length; i++){
      if(codes[i].code === clean) return codes[i].code;
    }

    // 2) لو الطول قريب، استخدم Levenshtein
    if(clean.length >= 7){
      var best = null, bestScore = 0;
      codes.forEach(function(c){
        var sc = sim(clean, c.code);
        if(sc > bestScore){ bestScore = sc; best = c.code; }
      });
      if(bestScore >= 0.75) return best;
    }

    // 3) استخدم سياق النص للبحث باسم المادة
    if(contextText){
      var course = findCourseInText(contextText);
      if(course && DB[course] && DB[course].code){
        return String(DB[course].code).replace(/^0+/, '');
      }
    }
    return null;
  }

  /* ============ المعالجة الرئيسية ============ */
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

      // ✅ استخدم words مع bbox
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

      // ✅ 🆕 فلترة أسطر الرأس
      lines = filterHeaderLines(lines);
      console.log('🧹 بعد فلترة الرأس:', lines.length);

      // ✅ 🆕 دمج الأسطر المتعددة للمادة الواحدة
      lines = mergeHeaderWithNext(lines);
      console.log('🔗 بعد الدمج:', lines.length);

      if(bar) bar.style.width = '85%';
      if(progressText) progressText.textContent = '🔄 ترتيب المواد...';

      // ✅ اربط كل سطر بمادة
      var finalLines = [];
      var seenCourses = {};
      var seenCodes = {};

      lines.forEach(function(line){
        var course = findCourseInText(line);
        var DB = window.COURSES_DB || {};
        var rawCode = extractCodeFromLine(line);
        var finalCode = null;

        // 1) حاول إصلاح الكود أولاً
        if(rawCode){
          finalCode = repairCode(rawCode, line);
        }

        // 2) لو ما لقينا كود، جرب من المادة
        if(!finalCode && course && DB[course]){
          finalCode = String(DB[course].code || '').replace(/^0+/, '');
        }

        // 3) لو لقينا مادة جديدة، أضفها
        if(course && !seenCourses[course]){
          seenCourses[course] = true;
          if(finalCode) seenCodes[finalCode] = true;
          var codePrefix = finalCode ? finalCode + ' ' : '';
          // لا تكرر الكود في البداية لو موجود
          var cleanLine = line;
          if(finalCode && line.indexOf(finalCode) === 0){
            cleanLine = line; // موجود بالفعل
          }
          finalLines.push(codePrefix + cleanLine);
        } else if(!course){
          // ما لقينا مادة → احتفظ بالسطر للتحليل اللاحق
          if(finalCode && seenCodes[finalCode]) return; // مكرر
          if(finalCode) seenCodes[finalCode] = true;
          finalLines.push(line);
        }
      });

      // لو ما لقينا ولا مادة، استخدم السطور الأصلية
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

      // افتح المستورد
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
    if(uploadZone._v4Bound) return;
    uploadZone._v4Bound = true;

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

    console.log('📸 OCR v4 (row-based + header filter): bound');
  }

  window.ocrAdvanced = {
    analyze: analyzeImage,
    filterHeaderLines: filterHeaderLines,
    mergeHeaderWithNext: mergeHeaderWithNext,
    repairCode: repairCode,
    test: function(){
      console.log('📸 OCR v4 — row-based + header filter + code repair');
      return 'ready';
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 1000); });
  } else { setTimeout(install, 1000); }

  console.log('📸 OCR v4 — Row-based + Header Filter + Code Repair');
})();