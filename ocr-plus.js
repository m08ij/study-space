/* ============================================================
   📸 ocr-plus.js — تحسين محرك OCR
   - دقة أعلى بالعربية والإنجليزية
   - تنقية النص المستخرج
   - تحويل تلقائي لجدول
   - كشف الأيام والأوقات بشكل ذكي
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function getSpace(){ return window.space || {timetable:{}}; }

  var DAYS_MAP = {
    'sunday': 'Sun', 'sun': 'Sun', 'الأحد': 'Sun', 'الاحد': 'Sun',
    'monday': 'Mon', 'mon': 'Mon', 'الاثنين': 'Mon',
    'tuesday': 'Tue', 'tue': 'Tue', 'الثلاثاء': 'Tue',
    'wednesday': 'Wed', 'wed': 'Wed', 'الأربعاء': 'Wed', 'الاربعاء': 'Wed',
    'thursday': 'Thu', 'thu': 'Thu', 'الخميس': 'Thu'
  };

  /**
   * تنظيف نص OCR
   */
  function cleanText(raw){
    if(!raw) return '';
    var t = String(raw);
    // إزالة رموز مشوهة
    t = t.replace(/[|¦]/g, ' ');
    t = t.replace(/\s+/g, ' ');
    // إصلاح الأرقام العربية
    t = t.replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
    // إزالة أسطر فارغة كثيرة
    t = t.replace(/\n{3,}/g, '\n\n');
    return t.trim();
  }

  /**
   * يحاول استخراج الأوقات من نص
   */
  function extractTime(str){
    var m = String(str).match(/(\d{1,2})[:.\-](\d{2})/);
    if(!m) return null;
    var h = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10);
    if(h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return { h: h, m: mm, str: String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0') };
  }

  /**
   * يستخرج الأيام من نص
   */
  function extractDays(str){
    var found = [];
    var lower = str.toLowerCase();
    Object.keys(DAYS_MAP).forEach(function(k){
      if(lower.indexOf(k.toLowerCase()) > -1 && found.indexOf(DAYS_MAP[k]) === -1){
        found.push(DAYS_MAP[k]);
      }
    });
    return found;
  }

  /**
   * parser محسّن
   * يدعم:
   *   - "Sunday 08:00-09:00 Calculus Room 101"
   *   - "8:00 9:00 الأحد رياضيات قاعة 101"
   *   - "الأحد 8-10 برمجة"
   */
  function parseTimetableText(raw){
    var cleaned = cleanText(raw);
    var lines = cleaned.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    var entries = [];

    lines.forEach(function(line){
      var days = extractDays(line);
      if(!days.length) return;

      // نبحث عن الأوقات (قبل أو بعد اليوم)
      var timeMatches = line.match(/(\d{1,2})[:.\-]?(\d{2})?(?:\s*[-–]\s*(\d{1,2})[:.\-]?(\d{2})?)?/g);
      if(!timeMatches) return;

      // نختار أول وقت
      var firstTime = null;
      for(var i = 0; i < timeMatches.length; i++){
        var t = extractTime(timeMatches[i]);
        if(t){ firstTime = t; break; }
      }
      if(!firstTime) return;
      if(firstTime.h < 6 || firstTime.h > 22) return; // نتجاهل أوقات غير واقعية

      // اسم المادة = الباقي بعد إزالة اليوم والأوقات
      var name = line;
      days.forEach(function(day){
        Object.keys(DAYS_MAP).forEach(function(k){
          if(DAYS_MAP[k] === day){
            name = name.replace(new RegExp(k, 'gi'), ' ');
          }
        });
      });
      name = name.replace(/(\d{1,2})[:.\-](\d{2})/g, ' ');
      name = name.replace(/(\d{1,2})\s*[-–]\s*(\d{1,2})/g, ' ');
      name = name.replace(/\s+/g, ' ').trim();
      // نزيل كلمات مكررة
      name = name.replace(/(Room|room|قاعة|ق\.?)\s*\d+/g, function(m){ return m; });
      if(name.length < 3) return;

      // استخراج القاعة
      var roomMatch = name.match(/(?:room|قاعة|ق\.?|hall)\s*([A-Za-z0-9\u0600-\u06FF\-]+)/i);
      var room = roomMatch ? roomMatch[1] : '';
      if(room){
        name = name.replace(roomMatch[0], '').trim();
      }

      days.forEach(function(day){
        entries.push({
          day: day,
          time: firstTime.str,
          name: name.slice(0, 60),
          room: room
        });
      });
    });

    return entries;
  }

  /**
   * تحليل أكثر ذكاء - يعتمد على كلمات مفتاحية قريبة
   */
  function smartParse(raw){
    var cleaned = cleanText(raw);
    // نقسّم على "الجداول المحتملة"
    var blocks = cleaned.split(/\n\s*\n/).map(function(b){ return b.trim(); }).filter(Boolean);
    var allEntries = [];

    blocks.forEach(function(block){
      var entries = parseTimetableText(block);
      allEntries = allEntries.concat(entries);
    });

    // لو ما في blocks، نحاول على النص كامل
    if(!allEntries.length){
      allEntries = parseTimetableText(cleaned);
    }

    return allEntries;
  }

  /**
   * يطبّق النتائج على الجدول
   */
  function applyToTimetable(entries, replace){
    if(!entries.length){ toast('ما لقيت محاضرات بالنص', 'warn', 3000); return 0; }
    var sp = getSpace();
    if(!sp.timetable) sp.timetable = {};
    if(replace) sp.timetable = {};

    var added = 0;
    var TIME_SLOTS = window.TIME_SLOTS || ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
    entries.forEach(function(e){
      // نطابق الوقت لأقرب slot
      var slot = null;
      TIME_SLOTS.forEach(function(s){
        if(s === e.time) slot = s;
      });
      if(!slot){
        // نختار أقرب slot
        var hh = parseInt(e.time.split(':')[0], 10);
        var candidates = TIME_SLOTS.filter(function(s){
          return Math.abs(parseInt(s.split(':')[0], 10) - hh) <= 1;
        });
        slot = candidates[0] || TIME_SLOTS[0];
      }

      var key = e.day + '-' + slot;
      if(!sp.timetable[key] || replace){
        sp.timetable[key] = {
          name: e.name,
          room: e.room || '',
          instructor: ''
        };
        added++;
      }
    });

    if(typeof window.saveSpace === 'function') window.saveSpace();
    if(typeof window.renderTimetable === 'function') window.renderTimetable();
    if(typeof window.renderDashboard === 'function') window.renderDashboard();

    return added;
  }

  /**
   * wrapper محسّن لدالة parseOcrText الموجودة
   */
  function enhanceExistingParser(){
    if(typeof window._ocrPlusInstalled === 'undefined'){
      window._ocrPlusInstalled = true;

      // نغيّر زر "تحليل وملء الجدول"
      var btn = document.getElementById('btnParseOcr');
      if(btn && !btn._ocrPlusBound){
        btn._ocrPlusBound = true;
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(){
          var ta = document.getElementById('ocrTextarea');
          if(!ta || !ta.value.trim()){ toast('لا يوجد نص', 'warn'); return; }
          var entries = smartParse(ta.value);
          var added = applyToTimetable(entries, false);
          if(added > 0){
            toast('✅ أُضيفت ' + added + ' محاضرة (محسّن)', 'success', 3000);
          } else {
            toast('⚠️ ما لقيت محاضرات صالحة — جرّب تعديل النص', 'warn', 3500);
          }
        });
      }
    }
  }

  /**
   * تحسين دقة Tesseract
   */
  function enhanceTesseractCall(){
    if(typeof window.Tesseract === 'undefined') return;
    if(window._ocrTessPatched) return;
    window._ocrTessPatched = true;

    var orig = window.Tesseract.recognize;
    window.Tesseract.recognize = function(image, lang, opts){
      // نحوّل لـ eng+ara + معاملات أفضل
      if(!opts) opts = {};
      if(!opts.tessedit_pageseg_mode){
        opts.tessedit_pageseg_mode = '6'; // Single uniform block
      }
      if(!opts.preserve_interword_spaces){
        opts.preserve_interword_spaces = '1';
      }
      return orig.call(this, image, 'eng+ara', opts);
    };
  }

  /**
   * دالة تحليل يدوي (لمن يريد يلصق نص)
   */
  function analyzeManual(){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:560px">' +
        '<h3>📸 تحليل جدول يدوي</h3>' +
        '<div class="form-group">' +
          '<label>الصق نص الجدول (من أي مصدر)</label>' +
          '<textarea id="ocrPasteArea" rows="10" placeholder="Sunday 08:00-09:00 Calculus Room 101&#10;Monday 10:00-11:00 Physics A&#10;الأحد 8:00 رياضيات" style="font-family:monospace;min-height:180px"></textarea>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--muted);cursor:pointer">' +
            '<input type="checkbox" id="ocrReplace"> استبدال الجدول' +
          '</label>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-sm btn-ghost" id="ocrCancel">إلغاء</button>' +
          '<button class="btn btn-sm" id="ocrAnalyze">🔍 حلّل واملأ</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);

    var ta = bd.querySelector('#ocrPasteArea');
    setTimeout(function(){ if(ta) ta.focus(); }, 150);

    bd.querySelector('#ocrCancel').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
    bd.querySelector('#ocrAnalyze').onclick = function(){
      var text = ta.value.trim();
      if(!text){ toast('اكتب نص', 'warn'); return; }
      var entries = smartParse(text);
      if(!entries.length){
        toast('⚠️ ما لقيت محاضرات — جرّب صيغة مختلفة', 'warn', 3500);
        return;
      }
      var replace = bd.querySelector('#ocrReplace').checked;
      var added = applyToTimetable(entries, replace);
      toast('✅ أُضيفت ' + added + ' محاضرة', 'success', 3000);
      bd.remove();
    };
  }

  /* ============ زر في الإعدادات ============ */
  function injectButton(){
    var menu = document.getElementById('settingsMenu');
    if(!menu || menu.querySelector('#ocrPlusBtn')) return;
    var btn = document.createElement('button');
    btn.className = 'settings-item';
    btn.id = 'ocrPlusBtn';
    btn.innerHTML = '<span>📸</span> تحليل جدول يدوي';
    btn.addEventListener('click', function(){
      if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
      analyzeManual();
    });
    var pdfBtn = menu.querySelector('#pdfBtn');
    if(pdfBtn) menu.insertBefore(btn, pdfBtn);
    else menu.appendChild(btn);
  }

  function install(){
    // نحاول نستبدل parser عند فتح تبويب الجدول
    var tryEnhance = setInterval(function(){
      if(document.getElementById('btnParseOcr')){
        enhanceExistingParser();
        clearInterval(tryEnhance);
      }
    }, 1000);
    setTimeout(function(){ clearInterval(tryEnhance); }, 20000);

    // patch tesseract (لمّا يتحمّل)
    var tryTess = setInterval(function(){
      if(typeof window.Tesseract !== 'undefined'){
        enhanceTesseractCall();
        clearInterval(tryTess);
      }
    }, 1500);
    setTimeout(function(){ clearInterval(tryTess); }, 30000);

    setTimeout(injectButton, 1500);
  }

  window.ocrSmartParse = smartParse;
  window.ocrAnalyzeManual = analyzeManual;
  window.ocrApplyToTimetable = applyToTimetable;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📸 OCR Plus loaded');
})();