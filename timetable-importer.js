/* ============================================================
   📥 timetable-importer.js v5 — مدرَّب على جدول HU
   ✅ يفهم الصيغة الرسمية للجامعة الهاشمية
   ✅ يتعامل مع: 09,30 (فاصلة)، 10,00-08,30 (معكوس)، ح.ب / 104
   ✅ أسماء المواد تنتهي قبل [رقم] [رقم] [أيام]
   ✅ زر تحميل عينة من الجدول مباشرة
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function getSpace(){ return window.space || {}; }
  function saveSpace(){ if(typeof window.saveSpace === 'function') window.saveSpace(); }
  function uid(){ return window.uid ? window.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function p2(n){ return String(n).padStart(2,'0'); }

  var DAY_LETTER = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };
  var DAY_SHORT = { Sun:'ح', Mon:'ن', Tue:'ث', Wed:'ر', Thu:'خ', Fri:'ج', Sat:'س' };
  var DAY_KEYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAY_NAMES_AR = { Sun:'الأحد', Mon:'الاثنين', Tue:'الثلاثاء', Wed:'الأربعاء', Thu:'الخميس', Fri:'الجمعة', Sat:'السبت' };
  var DAY_CLASS = '[حنثرخجس]';

  /* ============================================================
     1) تطبيع — يحوّل الفاصلة والنقطة داخل الوقت لنقطتين
     ============================================================ */
  function fixDigits(t){
    return String(t||'').replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }

  function preprocess(raw){
    var t = fixDigits(String(raw || ''));
    // 09,30 → 09:30   09.30 → 09:30
    t = t.replace(/(\d{1,2})\s*[,.]\s*(\d{2})/g, '$1:$2');
    // إزالة الرموز المخفية
    t = t.replace(/[\u200F\u200E\u200B\u00A0]/g, ' ');
    // توحيد الأسطر
    t = t.replace(/\r\n?/g, '\n');
    // الرموز الغريبة
    t = t.replace(/[|¦]/g, ' ');
    // رؤوس الأعمدة
    t = t.replace(/رقم\s+المادة/gi, ' ');
    t = t.replace(/اسم\s+المادة/gi, ' ');
    t = t.replace(/الشعبة\s+النظري/gi, ' ');
    t = t.replace(/الشعبة\s+العملي/gi, ' ');
    t = t.replace(/وقت\s+المحاضرة[^\n]*/gi, ' ');
    t = t.replace(/عدد\s+الساعات/gi, ' ');
    return t;
  }

  /* ============================================================
     2) استخراج الأكواد — 6-11 رقم
     ============================================================ */
  function findCodes(text){
    var re = /\b(\d{6,11})\b/g;
    var m, out = [];
    while((m = re.exec(text)) !== null){
      // استبعد لو جزء من وقت
      var before = text.substring(Math.max(0, m.index - 2), m.index);
      var after = text.substring(m.index + m[1].length, m.index + m[1].length + 2);
      if(/[:.\-]\s*$/.test(before) || /^\s*[:.\-]/.test(after)) continue;
      out.push({ code: m[1], index: m.index, end: m.index + m[1].length });
    }
    return out;
  }

  /* ============================================================
     3) استخراج الوقت — يدعم المعكوس
     ============================================================ */
  function extractTime(text){
    var m = text.match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/);
    if(!m) return null;
    var h1 = parseInt(m[1],10), mm1 = parseInt(m[2],10);
    var h2 = parseInt(m[3],10), mm2 = parseInt(m[4],10);
    if(h1 > 23 || h2 > 23 || mm1 > 59 || mm2 > 59) return null;
    var reversed = false;
    if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
      var th = h1, tm = mm1; h1 = h2; mm1 = mm2; h2 = th; mm2 = tm;
      reversed = true;
    }
    return {
      start: p2(h1)+':'+p2(mm1),
      end:   p2(h2)+':'+p2(mm2),
      match: m[0],
      index: m.index,
      reversed: reversed
    };
  }

  /* ============================================================
     4) استخراج الأيام — ح ث خ أو ن ر (مع مسافات)
     ============================================================ */
  function extractDays(text, beforeIdx){
    var zone = (beforeIdx >= 0) ? text.substring(0, beforeIdx) : text;
    // نمط: تسلسل من 1-6 حروف أيام مفصولة بمسافة أو بدون
    var re = new RegExp('(?:^|[\\s\\/])([' + DAY_CLASS + '](?:[\\s]*' + DAY_CLASS + ')*)(?=[\\s\\/]|$)', 'g');
    var m, last = null;
    while((m = re.exec(zone)) !== null){
      var charBefore = m[0][0];
      if(/[\u0600-\u06FF]/.test(charBefore)) continue;
      last = m[1];
    }
    if(!last) return { days: [], match: null };
    var days = [];
    for(var i = 0; i < last.length; i++){
      var ch = last[i];
      if(/\s/.test(ch)) continue;
      var d = DAY_LETTER[ch];
      if(d && days.indexOf(d) === -1) days.push(d);
    }
    return { days: days, match: last };
  }

  /* ============================================================
     5) استخراج القاعة — ح.ب / 104 أو م.غ / 213
     ============================================================ */
  function extractRoom(text){
    var patterns = [
      /([حمم][\s.]*[بغبجمع][\s.]*)\s*\/\s*(\d{2,4})/,
      /([حمم][\s.]*[بغبجمع][\s.]*)\s+(\d{2,4})/
    ];
    for(var i = 0; i < patterns.length; i++){
      var m = text.match(patterns[i]);
      if(m){
        var prefix = m[1].replace(/\s+/g, ' ').trim();
        if(m[2].length >= 2) return prefix + ' ' + m[2];
      }
    }
    return '';
  }

  /* ============================================================
     6) استخراج الساعات — رقم وحيد في نهاية النص (1-6)
     ============================================================ */
  function extractHours(text){
    var m = text.match(/\s(\d)\s*$/);
    if(m){
      var h = parseInt(m[1],10);
      if(h >= 1 && h <= 6) return h;
    }
    return 3;
  }

  /* ============================================================
     7) استخراج الاسم — الأهم!
     الاسم ينتهي قبل: [رقم] [رقم] [أيام]
     ============================================================ */
  function cleanName(name){
    return String(name || '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*[\/\\|]+\s*/, '')
      .replace(/\s*[\/\\|]+\s*$/, '')
      .trim();
  }

  function extractName(text){
    var trimmed = text.trim();

    // 1) اسم + رقمين + أيام
    var m = trimmed.match(new RegExp('^(.+?)\\s+\\d{1,3}\\s+\\d{1,3}\\s+' + DAY_CLASS));
    if(m) return cleanName(m[1]);

    // 2) اسم + أيام
    m = trimmed.match(new RegExp('^(.+?)\\s+' + DAY_CLASS + '(?:\\s*' + DAY_CLASS + ')*\\s*(?=[\\/\\s])'));
    if(m) return cleanName(m[1]);

    // 3) قبل الوقت
    m = trimmed.match(/^(.+?)\s+\d{1,2}:\d{2}/);
    if(m) return cleanName(m[1]);

    // 4) احتياطي: أول 80 حرف
    return cleanName(trimmed.slice(0, 80));
  }

  /* ============================================================
     8) تحليل صف واحد
     ============================================================ */
  function parseRow(chunk, code){
    var r = { code: code, name: '', days: [], timeStart: '', timeEnd: '', room: '', hours: 3 };

    var time = extractTime(chunk);
    if(time){
      r.timeStart = time.start;
      r.timeEnd = time.end;
    }

    var daysInfo = extractDays(chunk, time ? time.index : -1);
    r.days = daysInfo.days;

    r.room = extractRoom(chunk);
    r.hours = extractHours(chunk);
    r.name = extractName(chunk);

    if(!r.name || r.name.length < 2) r.name = 'مادة ' + code;
    return r;
  }

  /* ============================================================
     9) تحليل الجدول كامل
     ============================================================ */
  function parseTable(raw){
    var text = preprocess(raw);
    if(!text.trim()) return [];
    var codes = findCodes(text);
    if(!codes.length) return [];

    var rows = [];
    for(var i = 0; i < codes.length; i++){
      var start = codes[i].end;
      var end = (i + 1 < codes.length) ? codes[i + 1].index : text.length;
      var chunk = text.substring(start, end).replace(/\s+/g, ' ').trim();
      rows.push(parseRow(chunk, codes[i].code));
    }
    return rows;
  }

  /* ============================================================
     10) مطابقة مع COURSES_DB
     ============================================================ */
  function matchDB(row){
    var DB = window.COURSES_DB || {};
    var cleanCode = String(row.code || '').replace(/^0+/, '');
    if(!cleanCode) return null;
    if(typeof window.findCourseByCode === 'function'){
      var r = window.findCourseByCode(row.code);
      if(r) return r.name;
    }
    for(var k in DB){
      if(String(DB[k].code).replace(/^0+/, '') === cleanCode) return k;
    }
    var n = (row.name || '').trim();
    if(DB[n]) return n;
    // fuzzy
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

  /* ============================================================
     11) التطبيق — جدول + مواد + حضور
     ============================================================ */
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
            sp.timetable[key] = { name: finalName, room: row.room || '', instructor: '' };
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
          id: uid(), name: finalName,
          code: row.code || info.code || '',
          hours: row.hours || info.h || 3,
          instructor: '', room: row.room || ''
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

  /* ============================================================
     12) عينة من الجدول الحقيقي (4 مواد)
     ============================================================ */
  var SAMPLE = [
    '110108101 تفاضل وتكامل (1) 1 0 ح ث خ / 09,30 - 10,30 المادة تدرس بشكل مدمج في مبنى الحسين الباني ح.ب / 104 على منصة مايكروسوفت teams 3',
    '121601099 لغة عربية / استدراكية 2 0 ن ر / 10,00 - 08,30 المادة تدرس بشكل مدمج في مجمع قاعات ابن خلدون م.غ / 213 على منصة مايكروسوفت teams 3',
    '1701081136 فيزياء عامة (1) 4 0 ح ث خ / 10,30 - 11,30 المادة تدرس وجاهي في مبنى الحسين الباني ح.ب / 105 3',
    '2116021101 مهارات التواصل باللغة الانجليزية 10 0 ح ث خ / 18,30 - 19,30 المادة تدرس عن بعد على منصة مايكروسوفت teams 3'
  ].join('\n');

  /* ============================================================
     13) نافذة الاستيراد
     ============================================================ */
  function openEditor(initialText){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var state = { rows: [] };

    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:1150px;width:96vw;padding:20px;max-height:94vh;display:flex;flex-direction:column">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<h3 style="margin:0">📥 استيراد الجدول</h3>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-sm" id="tiiLoadSample" style="background:var(--grad);color:#0b0f1a">📋 تحميل عينتي</button>' +
            '<button class="btn btn-sm btn-ghost" id="tiiClose">✕</button>' +
          '</div>' +
        '</div>' +
        '<div style="background:var(--grad-soft);border:1px solid var(--glow);border-radius:10px;padding:10px;margin-bottom:12px;font-size:.76rem;line-height:1.6">' +
          '📌 الصق نص الجدول → اضغط "تحليل النص" → راجع الصفوف → "تطبيق". أو اضغط <b>"📋 تحميل عينتي"</b> لتجرب مباشرة.' +
        '</div>' +
        '<textarea id="tiiInput" placeholder="الصق النص..." style="width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:10px;font-family:monospace;font-size:.76rem;min-height:90px;resize:vertical;direction:rtl;outline:none;line-height:1.5"></textarea>' +
        '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center">' +
          '<button class="btn btn-sm" id="tiiParse">🔄 تحليل النص</button>' +
          '<button class="btn btn-sm btn-ghost" id="tiiAddRow">➕ صف</button>' +
          '<button class="btn btn-sm btn-ghost" id="tiiClear">🗑 مسح</button>' +
          '<span style="margin-right:auto;color:var(--muted);font-size:.74rem" id="tiiCount">0 صف</span>' +
        '</div>' +
        '<div id="tiiRowsWrap" style="margin-top:12px;flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:8px;background:var(--bg2);min-height:150px">' +
          '<div style="text-align:center;padding:30px;color:var(--muted);font-size:.85rem">لا يوجد صفوف</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
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
        rowsWrap.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:.85rem">لا يوجد صفوف — اضغط "تحميل عينتي" أو الصق نصاً</div>';
        countEl.textContent = '0 صف';
        return;
      }
      countEl.textContent = state.rows.length + ' صف';
      var html = '';
      state.rows.forEach(function(row, i){
        var match = matchDB(row);
        html += '<div class="tii-row" data-idx="' + i + '" style="display:grid;grid-template-columns:26px 100px 1.4fr 165px 100px 100px 80px 30px;gap:5px;align-items:center;padding:8px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;font-size:.78rem">';
        html += '<span style="color:var(--muted);font-weight:700;text-align:center;font-size:.72rem">' + (i+1) + '</span>';
        html += '<input data-field="code" value="' + esc(row.code) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 7px;border-radius:6px;font-family:monospace;font-size:.68rem;outline:none;direction:ltr;text-align:left;width:100%">';
        html += '<div style="min-width:0"><input data-field="name" value="' + esc(row.name) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 7px;border-radius:6px;font-size:.74rem;outline:none;width:100%">' + (match ? '<div style="color:var(--green);font-size:.62rem;margin-top:2px">✓ ' + esc(match) + '</div>' : '') + '</div>';
        html += '<div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center">';
        DAY_KEYS.forEach(function(d){
          var active = row.days.indexOf(d) > -1;
          html += '<button data-day="' + d + '" type="button" style="width:22px;height:22px;border-radius:5px;border:1px solid ' + (active ? 'var(--cyan)' : 'var(--border)') + ';background:' + (active ? 'var(--grad-soft)' : 'var(--bg2)') + ';color:' + (active ? 'var(--cyan)' : 'var(--muted)') + ';font-size:.68rem;font-weight:700;font-family:inherit;cursor:pointer;padding:0">' + DAY_SHORT[d] + '</button>';
        });
        html += '</div>';
        html += '<input type="time" data-field="timeStart" value="' + esc(row.timeStart) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:4px;border-radius:6px;font-size:.7rem;outline:none;direction:ltr;width:100%">';
        html += '<input type="time" data-field="timeEnd" value="' + esc(row.timeEnd) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:4px;border-radius:6px;font-size:.7rem;outline:none;direction:ltr;width:100%">';
        html += '<input data-field="room" value="' + esc(row.room) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 7px;border-radius:6px;font-size:.7rem;outline:none;width:100%">';
        html += '<button data-del="' + i + '" type="button" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--red);cursor:pointer;padding:0;font-family:inherit;font-size:.9rem">✕</button>';
        html += '</div>';
      });
      rowsWrap.innerHTML = html;

      rowsWrap.querySelectorAll('[data-field]').forEach(function(inp){
        inp.addEventListener('input', function(){
          var rowEl = inp.closest('.tii-row');
          var idx = parseInt(rowEl.dataset.idx, 10);
          state.rows[idx][inp.dataset.field] = inp.value;
          if(inp.dataset.field === 'code' || inp.dataset.field === 'name'){
            clearTimeout(window._tiiMatchTimer);
            window._tiiMatchTimer = setTimeout(renderRows, 600);
          }
        });
      });
      rowsWrap.querySelectorAll('[data-day]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var rowEl = btn.closest('.tii-row');
          var idx = parseInt(rowEl.dataset.idx, 10);
          var d = btn.dataset.day;
          var arr = state.rows[idx].days;
          var pos = arr.indexOf(d);
          if(pos > -1) arr.splice(pos, 1); else arr.push(d);
          arr.sort(function(a,b){ return DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b); });
          renderRows();
        });
      });
      rowsWrap.querySelectorAll('[data-del]').forEach(function(btn){
        btn.addEventListener('click', function(){
          state.rows.splice(parseInt(btn.dataset.del, 10), 1);
          renderRows();
        });
      });
    }

    bd.querySelector('#tiiClose').onclick = function(){ bd.remove(); };
    bd.querySelector('#tiiCancel').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };

    bd.querySelector('#tiiLoadSample').onclick = function(){
      input.value = SAMPLE;
      state.rows = parseTable(SAMPLE);
      renderRows();
      toast('📋 تم تحميل 4 مواد من عينتك', 'success', 2500);
    };

    bd.querySelector('#tiiParse').onclick = function(){
      var text = input.value.trim();
      if(!text){ toast('الصق نص أولاً أو اضغط "تحميل عينتي"', 'warn'); return; }
      var rows;
      try{ rows = parseTable(text); }
      catch(e){ toast('فشل: ' + e.message, 'warn', 4000); return; }
      if(!rows.length){ toast('⚠️ ما لقيت أكواد', 'warn', 3500); return; }
      state.rows = rows;
      renderRows();
      toast('✅ حُلّل ' + rows.length + ' صف', 'success');
    };

    bd.querySelector('#tiiAddRow').onclick = function(){
      state.rows.push({ code:'', name:'', days:[], timeStart:'', timeEnd:'', room:'', hours:3 });
      renderRows();
    };

    bd.querySelector('#tiiClear').onclick = function(){
      if(!state.rows.length) return;
      if(!confirm('مسح كل الصفوف؟')) return;
      state.rows = []; renderRows();
    };

    bd.querySelector('#tiiApply').onclick = function(){
      var valid = state.rows.filter(function(r){ return r.name && r.days.length && r.timeStart; });
      if(!valid.length){ toast('⚠️ ما في صفوف صالحة', 'warn', 4000); return; }
      var stats = apply(valid);
      bd.remove();
      toast('✅ ' + stats.timetable + ' محاضرة · ' + stats.courses + ' مادة · ' + stats.attendance + ' حضور', 'success', 4500);
    };

    if(initialText) setTimeout(function(){ bd.querySelector('#tiiParse').click(); }, 100);
  }

  /* ============================================================
     14) التركيب
     ============================================================ */
  function injectCSS(){
    if(document.getElementById('tii-css')) return;
    var s = document.createElement('style');
    s.id = 'tii-css';
    s.textContent =
      '.tii-row input:focus{border-color:var(--cyan)!important;box-shadow:0 0 0 2px var(--glow);outline:none}' +
      '@media(max-width:900px){' +
        '.tii-row{grid-template-columns:1fr!important;gap:6px!important;padding-top:32px!important;position:relative!important}' +
        '.tii-row > span:first-child{position:absolute;top:6px;right:8px}' +
        '.tii-row > button:last-child{position:absolute;top:4px;left:4px}' +
      '}';
    document.head.appendChild(s);
  }

  function install(){
    // اربط زر "تحليل وملء الجدول"
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      var btn = document.getElementById('btnParseOcr');
      if(btn && !btn._v5Bound){
        btn._v5Bound = true;
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

    // اربط زر "تجربة OCR بمثال نصي" — يفتح المستورد مع العينة
    var tries2 = 0;
    var timer2 = setInterval(function(){
      tries2++;
      var btn = document.getElementById('btnPasteOcr');
      if(btn && !btn._v5Bound){
        btn._v5Bound = true;
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(){
          openEditor(SAMPLE);
        });
        clearInterval(timer2);
      }
      if(tries2 > 60) clearInterval(timer2);
    }, 500);
  }

  window.TimetableImporter = {
    open: openEditor,
    parse: parseTable,
    apply: apply,
    sample: SAMPLE,
    loadSample: function(){ openEditor(SAMPLE); }
  };

  window.ocrV5Test = function(text){
    var entries = parseTable(text || SAMPLE);
    console.log('%c🔍 ' + entries.length + ' صف', 'color:#a78bfa;font-weight:bold');
    entries.forEach(function(e){
      var m = matchDB(e);
      console.log('➡️', e.code, '|', e.name, '|', e.days.join(','), '|', e.timeStart + '→' + e.timeEnd, '|', e.room, '|', m ? '✅ '+m : '❌');
    });
    return entries;
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ injectCSS(); install(); });
  } else { injectCSS(); install(); }

  console.log('📥 Timetable Importer v5 — مدرَّب على صيغة HU');
})();