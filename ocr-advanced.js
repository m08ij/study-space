  /* ============ المعالجة الرئيسية ============ */
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
      // 1) حمّل الصورة لمعرفة أبعادها
      var img = await loadImage(file);
      var W = img.naturalWidth, H = img.naturalHeight;
      console.log('🖼️ أبعاد الصورة:', W, '×', H);

      await loadTesseract();
      if(bar) bar.style.width = '40%';
      if(progressText) progressText.textContent = '⏳ قراءة الجدول...';

      // 2) شغّل Tesseract مع bbox
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
      if(progressText) progressText.textContent = '🏛️ تحليل الجدول...';

      // 3) 🆕 جرّب الجدول أولاً
      var parsed = { records: [], ok: false };
      if(window.OCRTableParser){
        try{
          parsed = window.OCRTableParser.parse(result.data, W, H);
          console.log('🏛️ نتيجة الجدول:', parsed.records.length, 'سجل · ok =', parsed.ok);
        }catch(e){
          console.warn('⚠️ فشل table parser:', e);
        }
      }

      var outputText = '';

      if(parsed.ok && parsed.records.length > 0){
        // ✅ نجح — حوّل السجلات لنص HU
        outputText = parsed.records.map(function(r){
          var daysAr = r.days.map(function(d){
            for(var k in DAY_LETTER){ if(DAY_LETTER[k] === d) return k; }
            return '';
          }).join(' ');
          var t1 = r.timeStart || '--:--';
          var t2 = r.timeEnd || '--:--';
          return r.code + ' ' + r.name + ' 0 0 ' +
                 (daysAr || 'ح') + ' / ' + t1 + ' - ' + t2 + ' ' +
                 (r.room ? 'قاعة ' + r.room + ' ' : '') + r.hours;
        }).join('\n');
        if(progressText) progressText.textContent = '✅ جدول — ' + parsed.records.length + ' مادة';
      } else {
        // ❌ فشل — ارجع للطريقة القديمة (line-based)
        console.log('🔄 استخدام Fallback (line-based)...');
        var lines = [];

        if(result.data.words && result.data.words.length){
          if(result.data.lines && result.data.lines.length){
            result.data.lines.forEach(function(ln){
              if(ln.text && ln.text.trim()) lines.push(ln.text.trim());
            });
          } else {
            var rows = groupIntoRows(result.data.words, 15);
            rows.forEach(function(row){
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