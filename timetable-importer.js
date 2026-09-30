/* ============================================================
   📥 timetable-importer.js — استيراد جدول احترافي مع مراجعة
   - تحليل تلقائي من النص (best-effort)
   - صفوف قابلة للتعديل الكامل قبل التطبيق
   - مطابقة تلقائية مع COURSES_DB
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function getSpace(){ return window.space || {}; }
  function saveSpace(){ if(typeof window.saveSpace === 'function') window.saveSpace(); }
  function uid(){ return window.uid ? window.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function p2(n){ return String(n).padStart(2,'0'); }
  function fixDigits(t){
    return String(t||'').replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }

  var DAY_LETTER = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };
  var DAY_SHORT = { Sun:'ح', Mon:'ن', Tue:'ث', Wed:'ر', Thu:'خ', Fri:'ج', Sat:'س' };
  var DAY_KEYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  /* ============ Extraction ============ */
  function extractCode(text){
    var m = String(text||'').match(/\b(\d{6,11})\b/);
    return m ? m[1] : '';
  }

  function extractTime(text){
    var t = fixDigits(text);
    var m = t.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*[-–—~]\s*(\d{1,2})\s*[:.]\s*(\d{2})/);
    if(m){
      var h1 = parseInt(m[1],10), mm1 = parseInt(m[2],10);
      var h2 = parseInt(m[3],10), mm2 = parseInt(m[4],10);
      if(h1<=23 && h2<=23 && mm1<=59 && mm2<=59){
        if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
          var th=h1, tm=mm1; h1=h2; mm1=mm2; h2=th; mm2=tm;
        }
        return { start: p2(h1)+':'+p2(mm1), end: p2(h2)+':'+p2(mm2) };
      }
    }
    return null;
  }

  function extractRoom(text){
    var patterns = [
      /ح\.?\s*ب\.?\s*(\d+)/,
      /م\.?\s*غ\.?\s*(\d+)/,
      /م\.?\s*ب\.?\s*(\d+)/,
      /م\.?\s*ج\.?\s*(\d+)/
    ];
    for(var i = 0; i < patterns.length; i++){
      var m = text.match(patterns[i]);
      if(m) return m[0].replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  function extractDays(text){
    // نبحث عن كل تسلسلات [حنثرخجس] وناخذ آخر واحد
    var re = /(?:^|[\s\/|\\\-–—,؛;])([حنثرخجس])(?:[\s\/|\\\-–—,؛;]+([حنثرخجس])){0,4}(?=[\s\/|\\\-–—,؛;]|$)/g;
    var m;
    var allMatches = [];
    while((m = re.exec(text)) !== null){
      var seq = m[0].match(/[حنثرخجس]/g) || [];
      allMatches.push({ seq: seq, index: m.index });
    }
    if(!allMatches.length) return [];
    var last = allMatches[allMatches.length - 1];
    var days = [];
    last.seq.forEach(function(l){
      var d = DAY_LETTER[l];
      if(d && days.indexOf(d) === -1) days.push(d);
    });
    return days;
  }

  function extractName(text, code, time, room){
    var name = text;
    if(code) name = name.replace(code, ' ');
    if(time){
      name = name.replace(/\d{1,2}\s*[:.]\s*\d{2}\s*[-–—~]\s*\d{1,2}\s*[:.]\s*\d{2}/g, ' ');
    }
    name = name.replace(/(?:^|[\s\/|\\\-–—,؛;])([حنثرخجس](?:[\s\/|\\\-–—,؛;]+[حنثرخجس]){0,4})(?=[\s\/|\\\-–—,؛;]|$)/g, ' ');
    if(room) name = name.replace(room, ' ');
    name = name.replace(/المادة\s+تدرس[^\n]*/gi, ' ');
    name = name.replace(/الماده\s+تدرس[^\n]*/gi, ' ');
    name = name.replace(/على\s+منصة[^\n]*/gi, ' ');
    name = name.replace(/\(?مايكروسوفت\)?/gi, ' ');
    name = name.replace(/\(?teams\)?/gi, ' ');
    name = name.replace(/(?:مدمج|وجاهي|حضوريا|افتراضي)/g, ' ');
    name = name.replace(/في\s+(?:مبنى|مجمع)\s+[^\n,،؛]+/g, ' ');
    name = name.replace(/[\/|\\]/g, ' ');
    name = name.replace(/\s+/g, ' ').trim();
    name = name.replace(/^\d+\s+/, '').replace(/\s+\d+$/, '');
    name = name.replace(/\s+\d+\s+\d+\s*$/, '');
    name = name.replace(/\s+\d\s+/g, ' ').trim();
    return name;
  }

  /* ============ Parse text → rows ============ */
  function parseRows(raw){
    var text = fixDigits(String(raw || ''));
    var codeMatches = [];
    var re = /\b(\d{6,11})\b/g;
    var m;
    while((m = re.exec(text)) !== null){
      codeMatches.push({ code: m[1], index: m.index, end: m.index + m[1].length });
    }
    if(!codeMatches.length) return [];

    var rows = [];
    for(var i = 0; i < codeMatches.length; i++){
      var start = codeMatches[i].end;
      var end = (i + 1 < codeMatches.length) ? codeMatches[i + 1].index : text.length;
      var chunk = text.substring(start, end).trim();
      var time = extractTime(chunk);
      var room = extractRoom(chunk);
      var days = extractDays(chunk);
      var name = extractName(chunk, codeMatches[i].code, time, room);
      if(!name || name.length < 2) name = 'مادة ' + codeMatches[i].code;
      rows.push({
        code: codeMatches[i].code,
        name: name,
        days: days,
        timeStart: time ? time.start : '',
        timeEnd: time ? time.end : '',
        room: room
      });
    }
    return rows;
  }

  /* ============ Match with DB ============ */
  function matchDB(row){
    var DB = window.COURSES_DB || {};
    var cleanCode = String(row.code || '').replace(/^0+/, '');
    if(cleanCode && typeof window.findCourseByCode === 'function'){
      var r = window.findCourseByCode(row.code);
      if(r) return r.name;
    }
    for(var k in DB){
      if(String(DB[k].code).replace(/^0+/, '') === cleanCode) return k;
    }
    var n = (row.name || '').trim();
    if(DB[n]) return n;
    var eTokens = n.split(/\s+/).filter(function(t){ return t.length > 2; });
    var best = null, bestScore = 0;
    for(var k2 in DB){
      var kTokens = k2.split(/\s+/).filter(function(t){ return t.length > 2; });
      if(!kTokens.length) continue;
      var matched = 0;
      eTokens.forEach(function(t){
        if(kTokens.some(function(kt){ return kt === t || kt.indexOf(t) > -1; })) matched++;
      });
      var score = matched / Math.max(eTokens.length, kTokens.length);
      if(score > bestScore && score >= 0.6){ bestScore = score; best = k2; }
    }
    return best;
  }

  /* ============ Apply ============ */
  function apply(rows){
    var sp = getSpace();
    if(!sp.timetable) sp.timetable = {};
    if(!sp.courses) sp.courses = [];
    if(!sp.attendance) sp.attendance = {};

    var stats = { timetable: 0, courses: 0, attendance: 0, matched: 0, total: rows.length };

    rows.forEach(function(row){
      var matchedName = matchDB(row);
      var finalName = matchedName || row.name;
      if(matchedName) stats.matched++;

      if(row.days && row.days.length && row.timeStart){
        row.days.forEach(function(day){
          var key = day + '-' + row.timeStart;
          if(!sp.timetable[key]){
            sp.timetable[key] = {
              name: finalName,
              room: row.room || '',
              instructor: ''
            };
            stats.timetable++;
          }
        });
      }

      var exists = sp.courses.some(function(c){
        return c.name === finalName || (row.code && c.code === row.code);
      });
      if(!exists && finalName){
        var info = matchedName ? (window.COURSES_DB[matchedName] || {}) : {};
        sp.courses.push({
          id: uid(),
          name: finalName,
          code: row.code || info.code || '',
          hours: info.h || 3,
          instructor: '',
          room: row.room || ''
        });
        stats.courses++;
      }

      if(finalName && !sp.attendance[finalName]){
        sp.attendance[finalName] = { present: 0, absent: 0 };
        stats.attendance++;
      }
    });

    saveSpace();
    try{ window.renderTimetable && window.renderTimetable(); }catch(e){}
    try{ window.renderCourses && window.renderCourses(); }catch(e){}
    try{ window.renderAttendance && window.renderAttendance(); }catch(e){}
    try{ window.renderDashboard && window.renderDashboard(); }catch(e){}
    return stats;
  }

  /* ============ Modal UI ============ */
  function openEditor(initialText){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var state = { rows: [] };

    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:1000px;width:96vw;padding:22px;max-height:92vh;display:flex;flex-direction:column">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
          '<h3 style="margin:0">📥 استيراد جدول — مع مراجعة</h3>' +
          '<button class="btn btn-sm btn-ghost" id="tiiClose">✕</button>' +
        '</div>' +
        '<div style="background:var(--grad-soft);border:1px solid var(--glow);border-radius:10px;padding:10px;margin-bottom:12px;font-size:.78rem;line-height:1.7">' +
          '💡 <b>الصق نص الجدول</b> (من OCR أو أي مصدر) ثم اضغط "تحليل النص".<br>' +
          'يمكنك تعديل أي صف — أيام، وقت، قاعة — قبل التطبيق.' +
        '</div>' +
        '<textarea id="tiiInput" placeholder="الصق النص هنا..." style="width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:12px;border-radius:10px;font-family:monospace;font-size:.8rem;min-height:110px;resize:vertical;direction:rtl;outline:none"></textarea>' +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
          '<button class="btn btn-sm" id="tiiParse">🔄 تحليل النص</button>' +
          '<button class="btn btn-sm btn-ghost" id="tiiAddRow">➕ إضافة صف</button>' +
          '<button class="btn btn-sm btn-ghost" id="tiiClear">🗑 مسح الكل</button>' +
          '<span style="margin-right:auto;color:var(--muted);font-size:.75rem;align-self:center" id="tiiCount">0 صف</span>' +
        '</div>' +
        '<div id="tiiRowsWrap" style="margin-top:16px;flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:8px;background:var(--bg2);min-height:150px">' +
          '<div style="text-align:center;padding:30px;color:var(--muted);font-size:.85rem">لا يوجد صفوف بعد</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
          '<button class="btn btn-sm btn-ghost" id="tiiCancel">إلغاء</button>' +
          '<button class="btn btn-sm" id="tiiApply">✅ تطبيق الكل</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);

    var input = bd.querySelector('#tiiInput');
    var rowsWrap = bd.querySelector('#tiiRowsWrap');
    var countEl = bd.querySelector('#tiiCount');
    if(initialText) input.value = initialText;

    function renderRows(){
      if(!state.rows.length){
        rowsWrap.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:.85rem">لا يوجد صفوف بعد</div>';
        countEl.textContent = '0 صف';
        return;
      }
      countEl.textContent = state.rows.length + ' صف';
      var html = '';
      state.rows.forEach(function(row, i){
        html += '<div class="tii-row" data-idx="' + i + '" style="display:grid;grid-template-columns:28px 100px 1.5fr 130px 90px 90px 30px;gap:6px;align-items:center;padding:8px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;font-size:.8rem">';
        html += '<span style="color:var(--muted);font-weight:700;text-align:center">' + (i+1) + '</span>';
        html += '<input data-field="code" value="' + esc(row.code) + '" placeholder="كود" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:6px;font-family:monospace;font-size:.72rem;outline:none;direction:ltr;text-align:left;width:100%">';
        html += '<input data-field="name" value="' + esc(row.name) + '" placeholder="اسم المادة" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:6px;font-size:.78rem;outline:none;width:100%">';
        html += '<div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center">';
        DAY_KEYS.forEach(function(d){
          var active = row.days.indexOf(d) > -1;
          html += '<button data-day="' + d + '" type="button" style="width:22px;height:22px;border-radius:6px;border:1px solid ' + (active ? 'var(--cyan)' : 'var(--border)') + ';background:' + (active ? 'var(--grad-soft)' : 'var(--bg2)') + ';color:' + (active ? 'var(--cyan)' : 'var(--muted)') + ';font-size:.68rem;font-weight:700;font-family:inherit;cursor:pointer;padding:0">' + DAY_SHORT[d] + '</button>';
        });
        html += '</div>';
        html += '<input type="time" data-field="timeStart" value="' + esc(row.timeStart) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:4px;border-radius:6px;font-size:.72rem;outline:none;direction:ltr;width:100%">';
        html += '<input type="time" data-field="timeEnd" value="' + esc(row.timeEnd) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:4px;border-radius:6px;font-size:.72rem;outline:none;direction:ltr;width:100%">';
        html += '<input data-field="room" value="' + esc(row.room) + '" placeholder="قاعة" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 8px;border-radius:6px;font-size:.72rem;outline:none;width:100%">';
        html += '<button data-del="' + i + '" type="button" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--red);cursor:pointer;padding:0;font-family:inherit;font-size:.9rem">✕</button>';
        html += '</div>';
      });
      rowsWrap.innerHTML = html;

      rowsWrap.querySelectorAll('[data-field]').forEach(function(inp){
        inp.addEventListener('input', function(){
          var rowEl = inp.closest('.tii-row');
          var idx = parseInt(rowEl.dataset.idx, 10);
          state.rows[idx][inp.dataset.field] = inp.value;
        });
      });
      rowsWrap.querySelectorAll('[data-day]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var rowEl = btn.closest('.tii-row');
          var idx = parseInt(rowEl.dataset.idx, 10);
          var d = btn.dataset.day;
          var arr = state.rows[idx].days;
          var pos = arr.indexOf(d);
          if(pos > -1) arr.splice(pos, 1);
          else arr.push(d);
          renderRows();
        });
      });
      rowsWrap.querySelectorAll('[data-del]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var idx = parseInt(btn.dataset.del, 10);
          state.rows.splice(idx, 1);
          renderRows();
        });
      });
    }

    bd.querySelector('#tiiClose').onclick = function(){ bd.remove(); };
    bd.querySelector('#tiiCancel').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };

    bd.querySelector('#tiiParse').onclick = function(){
      var text = input.value.trim();
      if(!text){ toast('الصق نص أولاً', 'warn'); return; }
      var rows = parseRows(text);
      if(!rows.length){ toast('⚠️ ما لقيت صفوف — أضف يدوياً', 'warn', 3500); return; }
      state.rows = rows;
      renderRows();
      toast('✅ حُلّل ' + rows.length + ' صف — راجعه', 'success');
    };

    bd.querySelector('#tiiAddRow').onclick = function(){
      state.rows.push({ code:'', name:'', days:[], timeStart:'', timeEnd:'', room:'' });
      renderRows();
    };

    bd.querySelector('#tiiClear').onclick = function(){
      if(!state.rows.length) return;
      if(!confirm('مسح كل الصفوف؟')) return;
      state.rows = [];
      renderRows();
    };

    bd.querySelector('#tiiApply').onclick = function(){
      var valid = state.rows.filter(function(r){ return r.name && r.days.length && r.timeStart; });
      if(!valid.length){
        toast('⚠️ ما في صفوف صالحة (تحتاج: اسم + أيام + وقت)', 'warn', 4000);
        return;
      }
      var stats = apply(valid);
      bd.remove();
      toast('✅ ' + stats.timetable + ' محاضرة · ' + stats.courses + ' مادة · ' + stats.attendance + ' حضور', 'success', 4500);
    };

    if(initialText){
      bd.querySelector('#tiiParse').click();
    }
  }

  /* ============ Public API ============ */
  window.TimetableImporter = {
    open: openEditor,
    parse: parseRows,
    apply: apply
  };

  /* ============ Install ============ */
  function install(){
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      var btn = document.getElementById('btnParseOcr');
      if(btn && !btn._tiiBound){
        btn._tiiBound = true;
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(){
          var ta = document.getElementById('ocrTextarea');
          var text = ta && ta.value.trim() ? ta.value : '';
          openEditor(text);
        });
        clearInterval(timer);
      }
      if(tries > 60) clearInterval(timer);
    }, 500);

    var tries2 = 0;
    var timer2 = setInterval(function(){
      tries2++;
      var pasteBtn = document.getElementById('btnPasteOcr');
      if(pasteBtn && !pasteBtn._tiiBound){
        pasteBtn._tiiBound = true;
        var newP = pasteBtn.cloneNode(true);
        pasteBtn.parentNode.replaceChild(newP, pasteBtn);
        newP.addEventListener('click', function(){
          var example =
            '110108101 تفاضل وتكامل (1) ح ث خ 09:30-10:30 ح.ب 104\n' +
            '121601099 لغة عربية / استدراكية ن ر 08:30-10:00 م.غ 213\n' +
            '1701081136 فيزياء عامة (1) ح ث خ 10:30-11:30 ح.ب 105\n' +
            '2116021101 مهارات التواصل باللغة الانجليزية ح ث خ 18:30-19:30';
          openEditor(example);
        });
        clearInterval(timer2);
      }
      if(tries2 > 60) clearInterval(timer2);
    }, 500);
  }

  function injectCSS(){
    if(document.getElementById('tii-css')) return;
    var s = document.createElement('style');
    s.id = 'tii-css';
    s.textContent =
      '.tii-row input:focus{border-color:var(--cyan)!important;box-shadow:0 0 0 2px var(--glow)}' +
      '@media(max-width:800px){' +
        '.tii-row{grid-template-columns:1fr!important;gap:6px!important;padding-top:28px!important;position:relative!important}' +
        '.tii-row > span:first-child{position:absolute;top:6px;right:8px;font-size:.7rem}' +
        '.tii-row > button:last-child{position:absolute;top:4px;left:4px}' +
      '}';
    document.head.appendChild(s);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ injectCSS(); install(); });
  } else {
    injectCSS(); install();
  }
  console.log('📥 Timetable Importer loaded');
})();