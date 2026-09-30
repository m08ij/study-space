/* ============================================================
   📊 column-classifier.js v1 — كاشف الأعمدة الذكي
   ✅ يصنّف محتوى كل عمود تلقائياً (كود/اسم/وقت/أيام/ساعات/قاعة)
   ✅ يعمل على إحداثيات x من Tesseract
   ============================================================ */
(function(){
  'use strict';

  var PATTERNS = {
    code:    /^\d{8,11}$/,
    time:    /(\d{1,2})[:.,]\s*(\d{2})/,
    days:    /^[حنثرخجس\s\/]+$/,
    hours:   /^\d$/,
    room:    /[حمنر]\s*[.\s]?\s*[بغبجمع]\s*[\/\\]?\s*\d{2,4}/,
    section: /^\d{1,3}$/
  };

  function classifyCell(text){
    text = String(text || '').trim();
    if(!text) return { type: 'empty', score: 0 };

    if(PATTERNS.code.test(text.replace(/\s/g,''))) return { type: 'code', score: 100 };
    if(PATTERNS.time.test(text) && /[-–—~]/.test(text)) return { type: 'time', score: 90 };
    if(PATTERNS.days.test(text) && /[حنثرخجس]/.test(text)) return { type: 'days', score: 80 };
    if(PATTERNS.room.test(text)) return { type: 'room', score: 75 };
    if(PATTERNS.hours.test(text) && +text >= 1 && +text <= 6) return { type: 'hours', score: 70 };
    if(PATTERNS.section.test(text)) return { type: 'section', score: 50 };

    var letters = text.replace(/[\d\s]/g, '').length;
    if(letters >= 4) return { type: 'name', score: 60 + Math.min(letters, 30) };

    return { type: 'unknown', score: 10 };
  }

  function groupIntoColumns(words, imageWidth){
    if(!words || !words.length || !imageWidth) return [];

    var N = 200;
    var hist = new Array(N).fill(0);

    words.forEach(function(w){
      var x0 = Math.max(0, Math.floor(w.bbox.x0 / imageWidth * N));
      var x1 = Math.min(N - 1, Math.floor(w.bbox.x1 / imageWidth * N));
      for(var i = x0; i <= x1; i++) hist[i]++;
    });

    var MIN_GAP = Math.round(N * 0.015);
    var boundaries = [0];
    var gstart = -1;

    for(var i = 0; i <= N; i++){
      if(i === N || hist[i] === 0){
        if(gstart === -1) gstart = i;
      } else {
        if(gstart !== -1 && (i - gstart) >= MIN_GAP){
          boundaries.push(((gstart + i) / 2) / N);
        }
        gstart = -1;
      }
    }
    boundaries.push(1);

    var columns = [];
    for(var c = 0; c < boundaries.length - 1; c++){
      columns.push({
        index: c,
        start: boundaries[c],
        end: boundaries[c + 1],
        words: [],
        type: 'unknown',
        score: 0,
        text: ''
      });
    }

    words.forEach(function(w){
      var xc = (w.bbox.x0 + w.bbox.x1) / 2 / imageWidth;
      for(var c = 0; c < columns.length; c++){
        if(xc >= columns[c].start && xc < columns[c].end){
          columns[c].words.push(w);
          break;
        }
      }
    });

    columns.forEach(function(col){
      var allText = col.words.map(function(w){ return w.text; }).join(' ').trim();
      var result = classifyCell(allText);
      col.type = result.type;
      col.score = result.score;
      col.text = allText;
    });

    return columns;
  }

  function rowToCells(rowWords, columns, imageWidth){
    var cells = columns.map(function(){ return []; });

    rowWords.forEach(function(w){
      var xc = (w.bbox.x0 + w.bbox.x1) / 2 / imageWidth;
      for(var c = 0; c < columns.length; c++){
        if(xc >= columns[c].start && xc < columns[c].end){
          cells[c].push(w);
          break;
        }
      }
    });

    return cells.map(function(cw){
      if(!cw.length) return '';
      var isArabic = cw.some(function(w){ return /[\u0600-\u06FF]/.test(w.text); });
      cw.sort(function(a, b){
        return isArabic ? b.bbox.x0 - a.bbox.x0 : a.bbox.x0 - b.bbox.x0;
      });
      return cw.map(function(w){ return w.text.trim(); }).filter(Boolean).join(' ');
    });
  }

  function extractTime(text){
    var p2 = function(n){ return String(n).padStart(2, '0'); };

    var m = text.match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/);
    if(m){
      var h1 = +m[1], mm1 = +m[2], h2 = +m[3], mm2 = +m[4];
      if(h1 > 23 || h2 > 23 || mm1 > 59 || mm2 > 59) return null;
      if(h1 < 6 && h2 > 8){ h1 = h2 - 1; mm1 = mm2; }
      if(h2 < 6 && h1 > 8){ h2 = h1 + 1; mm2 = mm1; }
      if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
        var th = h1, tm = mm1; h1 = h2; mm1 = mm2; h2 = th; mm2 = tm;
      }
      return { start: p2(h1) + ':' + p2(mm1), end: p2(h2) + ':' + p2(mm2) };
    }

    m = text.match(/(\d{1,2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/);
    if(m){
      var hA = +m[1], hB = +m[2], mmB = +m[3];
      if(hA < 6 && hB > 8) return { start: p2(hB - 1) + ':' + p2(mmB), end: p2(hB) + ':' + p2(mmB) };
      return { start: p2(hA) + ':00', end: p2(hB) + ':' + p2(mmB) };
    }

    m = text.match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2})(?![:\d])/);
    if(m){
      var hA2 = +m[1], mmA2 = +m[2], hB2 = +m[3];
      if(hB2 < 6) return { start: p2(hA2) + ':' + p2(mmA2), end: p2(Math.min(23, hA2 + 1)) + ':' + p2(mmA2) };
      return { start: p2(hA2) + ':' + p2(mmA2), end: p2(hB2) + ':00' };
    }

    return null;
  }

  function cellsToRecord(cells, columns, code){
    var r = {
      code: code, name: '', days: [],
      timeStart: '', timeEnd: '', room: '', hours: 3
    };

    var DAY_LETTER = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };
    var DAY_KEYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    cells.forEach(function(cell, i){
      var col = columns[i];
      if(!cell || !col) return;

      if(col.type === 'name' && !r.name){
        r.name = cell.replace(/\s+/g, ' ').trim();
      } else if(col.type === 'time' && !r.timeStart){
        var t = extractTime(cell);
        if(t){ r.timeStart = t.start; r.timeEnd = t.end; }
      } else if(col.type === 'days' && !r.days.length){
        var days = [];
        cell.replace(/\s/g, '').split('').forEach(function(ch){
          var d = DAY_LETTER[ch];
          if(d && days.indexOf(d) === -1) days.push(d);
        });
        r.days = days.sort(function(a, b){ return DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b); });
      } else if(col.type === 'room' && !r.room){
        r.room = cell.trim();
      } else if(col.type === 'hours'){
        var hm = cell.match(/^\s*(\d)\s*$/);
        if(hm && +hm[1] >= 1 && +hm[1] <= 6) r.hours = +hm[1];
      }
    });

    return r;
  }

  function parseTable(tesseractData, imageWidth){
    var words = (tesseractData && tesseractData.words) || [];
    words = words.filter(function(w){ return w && w.text && w.text.trim(); });
    if(!words.length) return { records: [], columns: [], ok: false };

    var columns = groupIntoColumns(words, imageWidth);
    if(columns.length < 3){
      return { records: [], columns: columns, ok: false };
    }

    console.log('📊 Columns detected:', columns.length);
    columns.forEach(function(c, i){
      console.log('  [' + i + ']', c.type, '(' + c.score + ') →', c.text.slice(0, 50));
    });

    var sorted = words.slice().sort(function(a, b){ return a.bbox.y0 - b.bbox.y0; });
    var rows = [], cur = [], curY = null;

    sorted.forEach(function(w){
      var y = (w.bbox.y0 + w.bbox.y1) / 2;
      var h = w.bbox.y1 - w.bbox.y0;
      var tol = Math.max(h * 0.8, 12);
      if(curY === null || Math.abs(y - curY) <= tol){
        cur.push(w);
        curY = curY === null ? y : (curY * cur.length + y) / (cur.length + 1);
      } else {
        rows.push(cur);
        cur = [w];
        curY = y;
      }
    });
    if(cur.length) rows.push(cur);

    var records = [];
    rows.forEach(function(row){
      var cells = rowToCells(row, columns, imageWidth);
      if(!cells.join('').trim()) return;

      var code = null;
      cells.forEach(function(c){
        if(code) return;
        var m = c.match(/\d{8,11}/);
        if(m) code = m[0];
      });
      if(!code) return;

      var rec = cellsToRecord(cells, columns, code);
      rec._rowWords = row;
      records.push(rec);
    });

    return { records: records, columns: columns, ok: records.length > 0 };
  }

  window.ColumnClassifier = {
    classifyCell: classifyCell,
    groupIntoColumns: groupIntoColumns,
    rowToCells: rowToCells,
    cellsToRecord: cellsToRecord,
    parseTable: parseTable,
    extractTime: extractTime,
    PATTERNS: PATTERNS
  };

  console.log('📊 Column Classifier v1 — ready');
})();