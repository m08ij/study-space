/* ============================================================
   🏛️ ocr-table-parser.js v1
   Table-aware OCR: صف صف، عمود عمود، ثم تجميع
   ============================================================ */
(function(){
  'use strict';

  var DAY_LETTER = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };
  var DAY_KEYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function p2(n){ return String(n).padStart(2,'0'); }
  function hasArabic(s){ return /[\u0600-\u06FF]/.test(s); }
  function clean(s){ return String(s||'').replace(/\s+/g,' ').trim(); }

  /* ============ 1) تجميع الكلمات في صفوف حسب y ============ */
  function groupIntoRows(words){
    if(!words || !words.length) return [];
    var sorted = words.slice().sort(function(a, b){
      return (a.bbox.y0 + a.bbox.y1)/2 - (b.bbox.y0 + b.bbox.y1)/2;
    });

    var rows = [], currentRow = [], currentY = null, currentH = 0;
    sorted.forEach(function(w){
      var y = (w.bbox.y0 + w.bbox.y1) / 2;
      var h = w.bbox.y1 - w.bbox.y0;
      var tol = Math.max(h * 0.8, 12);

      if(currentY === null || Math.abs(y - currentY) <= tol){
        currentRow.push(w);
        if(currentY === null){ currentY = y; currentH = h; }
        else {
          currentY = (currentY * (currentRow.length - 1) + y) / currentRow.length;
          currentH = Math.max(currentH, h);
        }
      } else {
        rows.push(currentRow);
        currentRow = [w];
        currentY = y;
        currentH = h;
      }
    });
    if(currentRow.length) rows.push(currentRow);
    return rows;
  }

  /* ============================================================
     2) كشف حدود الأعمدة — histogram على x
     ============================================================ */
  function detectColumns(words, imageWidth){
    if(!words.length || !imageWidth) return null;
    var N = 200;
    var hist = new Array(N).fill(0);

    words.forEach(function(w){
      var x0 = Math.max(0, Math.floor(w.bbox.x0 / imageWidth * N));
      var x1 = Math.min(N-1, Math.floor(w.bbox.x1 / imageWidth * N));
      for(var i = x0; i <= x1; i++) hist[i]++;
    });

    // ابحث عن فجوات (hist=0 لمدة ≥ 2% من العرض)
    var MIN_GAP = Math.round(N * 0.02);
    var gaps = [], gstart = -1;
    for(var i = 0; i <= N; i++){
      if(i === N || hist[i] === 0){
        if(gstart === -1) gstart = i;
      } else {
        if(gstart !== -1 && (i - gstart) >= MIN_GAP){
          gaps.push({ start: gstart, end: i, size: i - gstart });
        }
        gstart = -1;
      }
    }

    if(gaps.length < 2) return null;

    var boundaries = [0];
    gaps.forEach(function(g){
      boundaries.push(((g.start + g.end) / 2) / N);
    });
    boundaries.push(1);
    return boundaries;
  }

  /* ============ 3) تعيين كلمة لعمود ============ */
  function getColumn(word, boundaries, imageWidth){
    var xc = (word.bbox.x0 + word.bbox.x1) / 2 / imageWidth;
    for(var i = 0; i < boundaries.length - 1; i++){
      if(xc >= boundaries[i] && xc < boundaries[i+1]) return i;
    }
    return boundaries.length - 2;
  }

  /* ============ 4) صف → خلايا ============ */
  function rowToCells(row, boundaries, imageWidth){
    var nCols = boundaries.length - 1;
    var cells = [];
    for(var i = 0; i < nCols; i++) cells.push([]);

    row.forEach(function(w){
      var col = getColumn(w, boundaries, imageWidth);
      cells[col].push(w);
    });

    return cells.map(function(cw){
      if(!cw.length) return '';
      var arabic = cw.some(function(w){ return hasArabic(w.text); });
      cw.sort(function(a, b){
        return arabic ? b.bbox.x0 - a.bbox.x0 : a.bbox.x0 - b.bbox.x0;
      });
      return cw.map(function(w){ return w.text.trim(); }).filter(Boolean).join(' ').trim();
    });
  }

  /* ============ 5) استخراج الأيام ============ */
  function dayLettersToArray(str){
    var days = [];
    String(str||'').split('').forEach(function(ch){
      if(/\s/.test(ch)) return;
      var d = DAY_LETTER[ch];
      if(d && days.indexOf(d) === -1) days.push(d);
    });
    return days.sort(function(a,b){ return DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b); });
  }

  function extractDaysFromText(text){
    var m = text.match(/([حنثرخجس](?:\s*[حنثرخجس]){0,5})\s*[\/\\]/);
    if(m) return dayLettersToArray(m[1]);
    m = text.match(/\b([حنثرخجس](?:\s+[حنثرخجس]){1,5})\b/);
    if(m) return dayLettersToArray(m[1]);
    return [];
  }

  /* ============ 6) استخراج الوقت (يدعم الناقص) ============ */
  function extractTimeFromText(text){
    text = String(text || '');

    // كامل: HH:MM - HH:MM
    var m = text.match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/);
    if(m){
      var h1 = +m[1], mm1 = +m[2], h2 = +m[3], mm2 = +m[4];
      if(h1 <= 23 && h2 <= 23 && mm1 <= 59 && mm2 <= 59){
        // كشف "0:00 - 19:30" غالط
        if(h1 < 6 && h2 > 8 && (h2 - h1) > 6){ h1 = h2 - 1; mm1 = mm2; }
        if(h2 < 6 && h1 > 8 && (h1 - h2) > 6){ h2 = h1 + 1; mm2 = mm1; }
        // ترتيب معكوس
        if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
          var th = h1, tm = mm1; h1 = h2; mm1 = mm2; h2 = th; mm2 = tm;
        }
        return { start: p2(h1)+':'+p2(mm1), end: p2(h2)+':'+p2(mm2) };
      }
    }

    // ناقص يسار: "0 - 19:30"
    m = text.match(/(\d{1,2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/);
    if(m){
      var hA = +m[1], hB = +m[2], mmB = +m[3];
      if(hA < 6 && hB > 8) return { start: p2(hB-1)+':'+p2(mmB), end: p2(hB)+':'+p2(mmB) };
      return { start: p2(hA)+':00', end: p2(hB)+':'+p2(mmB) };
    }

    // ناقص يمين: "19:30 - 0"
    m = text.match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2})(?![:\d])/);
    if(m){
      var hA2 = +m[1], mmA2 = +m[2], hB2 = +m[3];
      if(hB2 < 6) return { start: p2(hA2)+':'+p2(mmA2), end: p2(Math.min(23,hA2+1))+':'+p2(mmA2) };
      return { start: p2(hA2)+':'+p2(mmA2), end: p2(hB2)+':00' };
    }

    return null;
  }

  /* ============ 7) استخراج القاعة ============ */
  function extractRoomFromText(text){
    var m = text.match(/([حمنر][\s.]*[بغبجمع][\s.]*)\s*[\/\\]\s*(\d{2,4})/);
    if(m) return clean(m[1]) + ' ' + m[2];
    m = text.match(/[\/\\]\s*(\d{3,4})\b/);
    if(m) return m[1];
    return '';
  }

  /* ============================================================
     8) خلايا → سجل (هنا السحر!)
     ============================================================ */
  function cellsToRecord(cells, code){
    var r = { code: code || '', name: '', days: [], timeStart: '', timeEnd: '', room: '', hours: 3 };
    if(!cells.length) return r;

    // اسم المادة = أطول خلية عربية (بعد استثناء الكود)
    var nameCandidates = [];
    cells.forEach(function(c){
      if(!c) return;
      if(code && c.indexOf(code) > -1) return;
      if(!hasArabic(c)) return;
      var stripped = c.replace(/\d+/g, '').trim();
      if(stripped.length < 3) return;
      nameCandidates.push({ text: c, score: stripped.length });
    });
    if(nameCandidates.length){
      nameCandidates.sort(function(a,b){ return b.score - a.score; });
      r.name = clean(nameCandidates[0].text);
    }

    // استخرج باقي الحقول من كل الخلايا
    cells.forEach(function(c){
      if(!c) return;

      if(!r.days.length){
        var d = extractDaysFromText(c);
        if(d.length) r.days = d;
      }
      if(!r.timeStart){
        var t = extractTimeFromText(c);
        if(t){ r.timeStart = t.start; r.timeEnd = t.end; }
      }
      if(!r.room){
        var rm = extractRoomFromText(c);
        if(rm) r.room = rm;
      }
      // عدد الساعات: خلية فيها رقم وحيد 1-6
      var hm = c.match(/^\s*(\d)\s*$/);
      if(hm && +hm[1] >= 1 && +hm[1] <= 6) r.hours = +hm[1];
    });

    return r;
  }

  /* ============ 9) التحليل الكامل ============ */
  function parse(tesseractData, imageWidth, imageHeight){
    var words = (tesseractData && tesseractData.words) || [];
    words = words.filter(function(w){ return w && w.text && w.text.trim(); });
    if(!words.length) return { records: [], boundaries: null, rows: [], ok: false };

    var rows = groupIntoRows(words);
    var boundaries = detectColumns(words, imageWidth);

    if(!boundaries || boundaries.length < 3){
      console.warn('🏛️ ما قدرنا نكشف الأعمدة — fallback للطريقة القديمة');
      return { records: [], boundaries: null, rows: rows, ok: false };
    }

    console.log('🏛️ عدد الأعمدة المكتشفة:', boundaries.length - 1);
    console.log('🏛️ الحدود:', boundaries.map(function(b){ return Math.round(b*100)+'%'; }).join(' | '));

    var records = [];
    rows.forEach(function(row, ri){
      var cells = rowToCells(row, boundaries, imageWidth);
      // ابحث عن كود 8-11 رقم في الصف
      var code = null;
      cells.forEach(function(c){
        if(code) return;
        var m = c.match(/\d{8,11}/);
        if(m) code = m[0];
      });
      if(!code) return; // صف بدون كود = رأس/فاصل

      var rec = cellsToRecord(cells, code);
      rec._rowIndex = ri;
      rec._cells = cells;
      records.push(rec);
    });

    return { records: records, boundaries: boundaries, rows: rows, ok: true };
  }

  window.OCRTableParser = {
    parse: parse,
    groupIntoRows: groupIntoRows,
    detectColumns: detectColumns,
    rowToCells: rowToCells,
    cellsToRecord: cellsToRecord,
    extractTimeFromText: extractTimeFromText,
    extractDaysFromText: extractDaysFromText,
    extractRoomFromText: extractRoomFromText
  };

  console.log('🏛️ OCR Table Parser v1 — row × column parsing ready');
})();