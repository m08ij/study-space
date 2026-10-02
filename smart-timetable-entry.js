/* ============================================================
   Smart Timetable Entry v3 — إظهار التعارضات بوضوح
   - بعد الحفظ: modal تفصيلي إن وُجدت مشاكل
   - دعم initialKey (تعبئة تلقائية من خلية)
   - رسائل نجاح صادقة (لا "✅" إذا كان هناك فشل جزئي)
   ============================================================ */
(function(){
  'use strict';

  var DAYS = [
    { letter: '\u062D', key: 'Sun' },
    { letter: '\u0646', key: 'Mon' },
    { letter: '\u062B', key: 'Tue' },
    { letter: '\u0631', key: 'Wed' },
    { letter: '\u062E', key: 'Thu' },
    { letter: '\u062C', key: 'Fri' },
    { letter: '\u0633', key: 'Sat' }
  ];

  var MIN_ROWS = 4;
  var CSS_ID = 'stt-style-v3';

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg, type, dur){
    if(typeof window.toast === 'function') window.toast(msg, type || 'info', dur || 2600);
  }
  function uid(){
    return (typeof window.uid === 'function') ? window.uid() :
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function getSpace(){ return window.space || {}; }
  function saveSpace(){ if(typeof window.saveSpace === 'function') window.saveSpace(); }

  function renderAll(){
    try{ window.renderTimetable && window.renderTimetable(); }catch(e){}
    try{ window.renderCourses && window.renderCourses(); }catch(e){}
    try{ window.renderDashboard && window.renderDashboard(); }catch(e){}
    try{ window.renderAttendance && window.renderAttendance(); }catch(e){}
  }

  function lookupByCode(code){
    if(!code) return null;
    code = String(code).trim();
    if(code.length < 6) return null;

    if(typeof window.findCourseByCode === 'function'){
      var r = window.findCourseByCode(code);
      if(r && r.name) return r;
    }

    var DB = window.COURSES_DB || {};
    var clean = code.replace(/^0+/, '');
    var keys = Object.keys(DB);
    for(var i = 0; i < keys.length; i++){
      var info = DB[keys[i]];
      if(String(info.code || '').replace(/^0+/, '') === clean){
        return { name: keys[i], info: info };
      }
      if(info.aliases){
        for(var j = 0; j < info.aliases.length; j++){
          if(String(info.aliases[j]).replace(/^0+/, '') === clean){
            return { name: keys[i], info: info };
          }
        }
      }
    }
    return null;
  }

  function emptyRow(){
    return { code:'', name:'', matched:null, days:[], timeFrom:'', timeTo:'', room:'' };
  }

  function createDefaultRows(n){
    var rows = [];
    for(var i = 0; i < n; i++) rows.push(emptyRow());
    return rows;
  }

  /* ============ CSS ============ */
  function injectCSS(){
    if(document.getElementById(CSS_ID)) return;
    var css = `
      .stt-backdrop{position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;animation:stt-fade .2s ease}
      @keyframes stt-fade{from{opacity:0}to{opacity:1}}
      .stt-modal{background:var(--card);border:1px solid var(--border);border-radius:22px;width:100%;max-width:1320px;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6);animation:stt-pop .28s cubic-bezier(.22,1,.36,1)}
      @keyframes stt-pop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
      .stt-header{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(34,211,238,.08),rgba(167,139,250,.08));flex-shrink:0}
      .stt-header h3{margin:0;font-size:1.1rem;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
      .stt-close{width:34px;height:34px;border-radius:10px;background:var(--card2);border:1px solid var(--border);color:var(--muted);cursor:pointer;font-family:inherit;font-size:1.3rem;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;transition:.2s}
      .stt-close:hover{background:rgba(239,68,68,.15);border-color:var(--red);color:var(--red)}
      .stt-info{padding:11px 24px;background:var(--grad-soft);border-bottom:1px solid var(--border);font-size:.82rem;color:var(--muted);line-height:1.7;flex-shrink:0}
      .stt-info b{color:var(--cyan)}
      .stt-rows{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px}
      .stt-row{display:grid;grid-template-columns:42px 140px minmax(180px,1fr) 220px 118px 118px 130px 42px;gap:8px;align-items:center;padding:12px;background:var(--bg2);border:1.5px solid var(--border);border-radius:14px;transition:border-color .2s ease,box-shadow .2s ease}
      .stt-row:hover{border-color:var(--border2)}
      .stt-row.matched{border-color:rgba(52,211,153,.45);box-shadow:0 0 0 1px rgba(52,211,153,.15)}
      .stt-num{width:36px;height:36px;border-radius:10px;background:var(--grad);color:#0b0f1a;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;flex-shrink:0}
      .stt-row.matched .stt-num{background:linear-gradient(135deg,#34d399,#10b981)}
      .stt-input{width:100%;background:var(--card);border:1.5px solid var(--border);color:var(--text);padding:10px 12px;border-radius:10px;font-family:inherit;font-size:.9rem;outline:none;transition:border-color .2s,box-shadow .2s;min-width:0;height:42px}
      .stt-input:focus{border-color:var(--cyan);box-shadow:0 0 0 3px var(--glow)}
      .stt-code{font-family:ui-monospace,monospace;direction:ltr;text-align:left;letter-spacing:1px;font-size:.98rem;font-weight:700}
      .stt-time{direction:ltr;text-align:center;font-weight:600;font-size:.88rem;padding:8px 6px}
      .stt-name-wrap{position:relative;display:flex;flex-direction:column;gap:2px;min-width:0}
      .stt-name-wrap .stt-input{height:38px}
      .stt-match{font-size:.68rem;color:var(--green);font-weight:700;padding:0 4px;display:flex;align-items:center;gap:4px;min-height:14px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .stt-match.no-match{color:var(--amber)}
      .stt-match:empty{display:none}
      .stt-days{display:flex;gap:3px;padding:5px 6px;background:var(--card);border:1.5px solid var(--border);border-radius:10px;justify-content:center;height:42px;align-items:center}
      .stt-day{width:26px;height:26px;border-radius:7px;background:transparent;border:none;color:var(--muted);cursor:pointer;font-family:inherit;font-size:.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all .15s ease;padding:0}
      .stt-day:hover{color:var(--text);background:var(--card2)}
      .stt-day.active{background:var(--grad);color:#0b0f1a;transform:scale(1.1);box-shadow:0 3px 8px var(--glow)}
      .stt-del{width:36px;height:36px;border-radius:10px;background:transparent;border:1.5px solid var(--border);color:var(--muted);cursor:pointer;font-family:inherit;font-size:1.2rem;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;transition:.2s}
      .stt-del:hover{background:rgba(239,68,68,.15);border-color:var(--red);color:var(--red);transform:scale(1.05)}
      .stt-footer{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-top:1px solid var(--border);background:var(--card2);gap:10px;flex-wrap:wrap;flex-shrink:0}
      .stt-btn{padding:10px 18px;border-radius:11px;font-family:inherit;font-size:.88rem;font-weight:700;cursor:pointer;transition:all .2s;border:none;display:inline-flex;align-items:center;gap:7px}
      .stt-btn-primary{background:var(--grad);color:#0b0f1a;padding:12px 26px;font-size:.95rem;box-shadow:0 6px 20px var(--glow)}
      .stt-btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px var(--glow)}
      .stt-btn-primary:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
      .stt-btn-ghost{background:transparent;color:var(--text);border:1.5px solid var(--border)}
      .stt-btn-ghost:hover{background:var(--card);border-color:var(--cyan);color:var(--cyan)}
      .stt-hint{font-size:.78rem;color:var(--muted);margin:0 auto;text-align:center}
      .stt-issue-row{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:6px}
      .stt-issue-ic{font-size:1.1rem;flex-shrink:0}
      .stt-issue-body{flex:1;min-width:0;font-size:.82rem;line-height:1.6}
      @media (max-width: 1200px){.stt-row{grid-template-columns:40px 130px 1fr 190px 105px 105px 130px 40px;gap:6px;padding:10px}}
      @media (max-width: 860px){
        .stt-row{grid-template-columns:36px 1fr 32px;grid-template-areas:"num name del" "code code code" "days days days" "from to room";gap:6px;padding:12px 10px}
        .stt-num{grid-area:num;width:32px;height:32px;font-size:.85rem}
        .stt-code{grid-area:code}
        .stt-name-wrap{grid-area:name}
        .stt-days{grid-area:days;height:auto;padding:6px}
        .stt-time.stt-from{grid-area:from}
        .stt-time.stt-to{grid-area:to}
        .stt-room{grid-area:room}
        .stt-del{grid-area:del;width:32px;height:32px;font-size:1.1rem}
      }
      @media (max-width: 520px){
        .stt-modal{max-width:100%;border-radius:16px;max-height:96vh}
        .stt-header{padding:14px 16px}
        .stt-info{padding:10px 16px;font-size:.74rem}
        .stt-rows{padding:12px;gap:12px}
        .stt-input{font-size:.85rem;padding:8px 10px;height:38px}
        .stt-footer{padding:12px 16px}
        .stt-btn{padding:9px 14px;font-size:.82rem}
      }
    `;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ============ Modal ============ */
  function openModal(initialRows){
    injectCSS();
    document.querySelectorAll('.stt-backdrop').forEach(function(b){ b.remove(); });

    var state = {
      rows: initialRows && initialRows.length ? initialRows : createDefaultRows(MIN_ROWS)
    };

    var backdrop = document.createElement('div');
    backdrop.className = 'stt-backdrop';
    document.body.appendChild(backdrop);

    var modal = document.createElement('div');
    modal.className = 'stt-modal';
    backdrop.appendChild(modal);

    var header = document.createElement('div');
    header.className = 'stt-header';
    header.innerHTML =
      '<h3>\u2728 \u0625\u0636\u0627\u0641\u0629 \u062C\u062F\u0648\u0644 \u2014 \u062F\u0641\u0639\u0629 \u0648\u0627\u062D\u062F\u0629</h3>' +
      '<button class="stt-close" title="\u0625\u063A\u0644\u0627\u0642" type="button">\u00D7</button>';
    modal.appendChild(header);

    var info = document.createElement('div');
    info.className = 'stt-info';
    info.innerHTML =
      '\uD83D\uDCA1 \u0627\u0643\u062A\u0628 <b>\u0631\u0642\u0645 \u0627\u0644\u0645\u0627\u062F\u0629</b> ' +
      '\u0641\u064A\u0639\u0628\u064A \u0627\u0644\u0627\u0633\u0645 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B. ' +
      '\u0627\u062E\u062A\u0631 \u0627\u0644\u0623\u064A\u0627\u0645 \u0628\u0636\u063A\u0637\u0629\u060C ' +
      '\u0648\u062D\u062F\u0651\u062F \u0627\u0644\u0648\u0642\u062A \u0648\u0627\u0644\u0642\u0627\u0639\u0629.';
    modal.appendChild(info);

    var rowsWrap = document.createElement('div');
    rowsWrap.className = 'stt-rows';
    modal.appendChild(rowsWrap);

    var footer = document.createElement('div');
    footer.className = 'stt-footer';
    footer.innerHTML =
      '<button class="stt-btn stt-btn-ghost" data-action="add-row" type="button">+ \u0625\u0636\u0627\u0641\u0629 \u0635\u0641</button>' +
      '<div class="stt-hint" data-hint></div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="stt-btn stt-btn-ghost" data-action="cancel" type="button">\u0625\u0644\u063A\u0627\u0621</button>' +
        '<button class="stt-btn stt-btn-primary" data-action="save" type="button" disabled>\uD83D\uDCBE \u062D\u0641\u0638 \u0627\u0644\u0643\u0644</button>' +
      '</div>';
    modal.appendChild(footer);

    function isRowComplete(row){
      return !!(row.name && row.days && row.days.length && row.timeFrom && row.timeTo);
    }

    function updateFooter(){
      var readyCount = state.rows.filter(isRowComplete).length;
      var saveBtn = footer.querySelector('[data-action="save"]');
      var hint = footer.querySelector('[data-hint]');

      if(readyCount === 0){
        saveBtn.disabled = true;
        saveBtn.textContent = '\uD83D\uDCBE \u062D\u0641\u0638 \u0627\u0644\u0643\u0644';
        hint.textContent = '\u0627\u0645\u0644\u0623 \u0635\u0641 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644';
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = '\uD83D\uDCBE \u062D\u0641\u0638 \u0627\u0644\u0643\u0644 (' + readyCount + ')';
        hint.textContent = readyCount + ' \u0635\u0641 \u062C\u0627\u0647\u0632 \u0645\u0646 ' + state.rows.length;
      }
    }

    function updateRowStatus(idx){
      var row = state.rows[idx];
      if(!row) return;
      var rowEl = rowsWrap.querySelector('.stt-row[data-idx="' + idx + '"]');
      if(!rowEl) return;

      var matchEl = rowEl.querySelector('[data-match]');
      if(matchEl){
        if(row.matched){
          matchEl.textContent = '\u2713 ' + row.matched.name;
          matchEl.classList.remove('no-match');
        } else if(row.code && row.code.length >= 6){
          matchEl.textContent = '\u26A0 \u0643\u0648\u062F \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641';
          matchEl.classList.add('no-match');
        } else {
          matchEl.textContent = '';
          matchEl.classList.remove('no-match');
        }
      }
      rowEl.classList.toggle('matched', !!row.matched);
    }

    function buildRowEl(row, idx){
      var el = document.createElement('div');
      el.className = 'stt-row';
      el.dataset.idx = idx;

      var num = document.createElement('div');
      num.className = 'stt-num';
      num.textContent = String(idx + 1);
      el.appendChild(num);

      var code = document.createElement('input');
      code.type = 'text';
      code.className = 'stt-input stt-code';
      code.placeholder = '110108101';
      code.value = row.code || '';
      code.inputMode = 'numeric';
      code.autocomplete = 'off';
      code.dataset.field = 'code';
      el.appendChild(code);

      var nameWrap = document.createElement('div');
      nameWrap.className = 'stt-name-wrap';
      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'stt-input stt-name';
      nameInput.placeholder = '\u0627\u0633\u0645 \u0627\u0644\u0645\u0627\u062F\u0629 (\u064A\u064F\u0645\u0644\u0623 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B)';
      nameInput.value = row.name || '';
      nameInput.autocomplete = 'off';
      nameInput.dataset.field = 'name';
      nameWrap.appendChild(nameInput);
      var matchEl = document.createElement('div');
      matchEl.className = 'stt-match';
      matchEl.dataset.match = '1';
      nameWrap.appendChild(matchEl);
      el.appendChild(nameWrap);

      var days = document.createElement('div');
      days.className = 'stt-days';
      DAYS.forEach(function(d){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'stt-day';
        btn.dataset.day = d.key;
        btn.textContent = d.letter;
        if(row.days && row.days.indexOf(d.key) > -1) btn.classList.add('active');
        days.appendChild(btn);
      });
      el.appendChild(days);

      var from = document.createElement('input');
      from.type = 'time';
      from.className = 'stt-input stt-time stt-from';
      from.value = row.timeFrom || '';
      from.dataset.field = 'timeFrom';
      el.appendChild(from);

      var to = document.createElement('input');
      to.type = 'time';
      to.className = 'stt-input stt-time stt-to';
      to.value = row.timeTo || '';
      to.dataset.field = 'timeTo';
      el.appendChild(to);

      var room = document.createElement('input');
      room.type = 'text';
      room.className = 'stt-input stt-room';
      room.placeholder = '104 \u062D.\u0628';
      room.value = row.room || '';
      room.autocomplete = 'off';
      room.dataset.field = 'room';
      el.appendChild(room);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'stt-del';
      del.title = '\u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0635\u0641';
      del.textContent = '\u00D7';
      del.dataset.action = 'del';
      el.appendChild(del);

      updateRowStatus(idx);
      return el;
    }

    function renderRows(){
      rowsWrap.innerHTML = '';
      state.rows.forEach(function(row, idx){
        rowsWrap.appendChild(buildRowEl(row, idx));
      });
      updateFooter();
    }

    rowsWrap.addEventListener('input', function(e){
      var input = e.target.closest('[data-field]');
      if(!input) return;
      var rowEl = input.closest('.stt-row');
      if(!rowEl) return;
      var idx = parseInt(rowEl.dataset.idx, 10);
      var field = input.dataset.field;
      var val = input.value;
      var row = state.rows[idx];
      if(!row) return;

      if(field === 'code'){
        row.code = val.trim();
        clearTimeout(row._lookupTimer);
        row._lookupTimer = setTimeout(function(){
          var found = lookupByCode(row.code);
          var nameInput = rowEl.querySelector('.stt-name');
          if(found){
            row.matched = found;
            row.name = found.name;
            if(nameInput) nameInput.value = found.name;
          } else {
            row.matched = null;
          }
          updateRowStatus(idx);
          updateFooter();
        }, 220);
      } else if(field === 'name'){ row.name = val.trim(); updateFooter(); }
      else if(field === 'timeFrom'){ row.timeFrom = val; updateFooter(); }
      else if(field === 'timeTo'){ row.timeTo = val; updateFooter(); }
      else if(field === 'room'){ row.room = val.trim(); }
    });

    rowsWrap.addEventListener('click', function(e){
      var dayBtn = e.target.closest('.stt-day');
      if(dayBtn){
        e.preventDefault();
        var rowEl = dayBtn.closest('.stt-row');
        var idx = parseInt(rowEl.dataset.idx, 10);
        var dayKey = dayBtn.dataset.day;
        var row = state.rows[idx];
        if(!row) return;
        if(!row.days) row.days = [];
        var pos = row.days.indexOf(dayKey);
        if(pos > -1) row.days.splice(pos, 1);
        else row.days.push(dayKey);
        var order = DAYS.map(function(d){ return d.key; });
        row.days.sort(function(a, b){ return order.indexOf(a) - order.indexOf(b); });
        dayBtn.classList.toggle('active');
        updateFooter();
        return;
      }

      var delBtn = e.target.closest('[data-action="del"]');
      if(delBtn){
        e.preventDefault();
        var rowEl2 = delBtn.closest('.stt-row');
        var idx2 = parseInt(rowEl2.dataset.idx, 10);
        if(state.rows.length <= 1){
          toast('\u0644\u0627\u0632\u0645 \u064A\u0628\u0642\u0649 \u0635\u0641 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644', 'warn');
          return;
        }
        state.rows.splice(idx2, 1);
        while(state.rows.length < MIN_ROWS) state.rows.push(emptyRow());
        renderRows();
        return;
      }
    });

    footer.addEventListener('click', function(e){
      var btn = e.target.closest('[data-action]');
      if(!btn) return;
      var action = btn.dataset.action;

      if(action === 'add-row'){
        state.rows.push(emptyRow());
        renderRows();
        setTimeout(function(){
          rowsWrap.scrollTop = rowsWrap.scrollHeight;
          var last = rowsWrap.querySelector('.stt-row:last-child .stt-code');
          if(last) last.focus();
        }, 60);
      } else if(action === 'cancel'){ close(); }
      else if(action === 'save'){ saveAll(); }
    });

    header.querySelector('.stt-close').addEventListener('click', close);
    backdrop.addEventListener('click', function(e){
      if(e.target === backdrop) close();
    });

    var escHandler = function(e){ if(e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);

    function close(){
      document.removeEventListener('keydown', escHandler);
      backdrop.remove();
    }

    /* ============ الحفظ مع تقرير ============ */
    function saveAll(){
      var sp = getSpace();
      if(!sp.timetable) sp.timetable = {};
      if(!sp.courses) sp.courses = [];
      if(!sp.attendance) sp.attendance = {};

      var stats = {
        courses: 0,
        classes: 0,
        attendance: 0,
        skipped: [],
        incomplete: [],
        unknownCodes: []
      };

      state.rows.forEach(function(row, idx){
        /* فحص النقص */
        if(!isRowComplete(row)){
          var missing = [];
          if(!row.name) missing.push('الاسم');
          if(!row.days || !row.days.length) missing.push('الأيام');
          if(!row.timeFrom) missing.push('وقت البداية');
          if(!row.timeTo) missing.push('وقت النهاية');
          if(missing.length && (row.code || row.name)){
            stats.incomplete.push({ row: idx + 1, missing: missing.join(' + ') });
          }
          return;
        }

        /* تحذير كود غير معروف */
        if(row.code && row.code.length >= 6 && !row.matched){
          stats.unknownCodes.push({ row: idx + 1, code: row.code, name: row.name });
        }

        var finalName = row.matched ? row.matched.name : row.name;
        var finalCode = row.code || (row.matched && row.matched.info ? row.matched.info.code : '');
        var hours = (row.matched && row.matched.info && row.matched.info.h) ? row.matched.info.h : 3;

        var exists = sp.courses.some(function(c){
          return c.name === finalName ||
            (finalCode && c.code && String(c.code) === String(finalCode));
        });
        if(!exists){
          sp.courses.push({
            id: uid(),
            name: finalName,
            code: finalCode,
            hours: hours,
            instructor: '',
            room: row.room || ''
          });
          stats.courses++;
        }

        row.days.forEach(function(dayKey){
          var key = dayKey + '-' + row.timeFrom;
          if(sp.timetable[key] && sp.timetable[key].name !== finalName){
            stats.skipped.push({
              row: idx + 1,
              day: dayKey,
              time: row.timeFrom,
              newName: finalName,
              conflictWith: sp.timetable[key].name
            });
            return;
          }
          sp.timetable[key] = {
            name: finalName,
            room: row.room || '',
            instructor: ''
          };
          stats.classes++;
        });

        if(!sp.attendance[finalName]){
          sp.attendance[finalName] = { present: 0, absent: 0 };
          stats.attendance++;
        }
      });

      saveSpace();
      renderAll();

      var issueCount = stats.skipped.length + stats.incomplete.length + stats.unknownCodes.length;

      if(issueCount === 0){
        var msg = '✅ ' + stats.courses + ' مادة · ' + stats.classes + ' محاضرة';
        if(stats.courses === 0 && stats.classes === 0){
          toast('لم تُضف أي شيء جديد', 'info', 3000);
        } else {
          toast(msg, 'success', 4000);
        }
        close();
      } else {
        close();
        showSaveResult(stats);
      }
    }

    renderRows();
    setTimeout(function(){
      var firstCode = rowsWrap.querySelector('.stt-code');
      if(firstCode) firstCode.focus();
    }, 200);
  }

  /* ============ تقرير الحفظ ============ */
  function showSaveResult(stats){
    document.querySelectorAll('.stt-result-backdrop').forEach(function(b){ b.remove(); });

    var backdrop = document.createElement('div');
    backdrop.className = 'stt-backdrop stt-result-backdrop';
    document.body.appendChild(backdrop);

    var modal = document.createElement('div');
    modal.className = 'stt-modal';
    modal.style.maxWidth = '600px';
    backdrop.appendChild(modal);

    var hasSuccess = stats.courses > 0 || stats.classes > 0;
    var header = document.createElement('div');
    header.className = 'stt-header';
    header.innerHTML =
      '<h3>' + (hasSuccess ? '⚠️ تم الحفظ مع ملاحظات' : '⚠️ لم يُحفظ شيء') + '</h3>' +
      '<button class="stt-close" type="button">×</button>';
    modal.appendChild(header);

    var body = document.createElement('div');
    body.style.cssText = 'padding:18px 22px;overflow-y:auto;max-height:65vh';

    var summary = '';
    if(stats.courses > 0) summary += '✅ ' + stats.courses + ' مادة جديدة\n';
    if(stats.classes > 0) summary += '✅ ' + stats.classes + ' محاضرة\n';
    if(stats.skipped.length) summary += '❌ ' + stats.skipped.length + ' تعارض\n';
    if(stats.incomplete.length) summary += '⚠️ ' + stats.incomplete.length + ' صف ناقص\n';
    if(stats.unknownCodes.length) summary += '⚠️ ' + stats.unknownCodes.length + ' كود غير معروف\n';

    var html = '<div style="padding:12px;background:var(--bg2);border-radius:10px;font-family:monospace;font-size:.78rem;line-height:1.8;white-space:pre-line;margin-bottom:14px;color:var(--text)">' +
      esc(summary.trim()) + '</div>';

    /* التعارضات */
    if(stats.skipped.length){
      html += '<div style="margin-bottom:14px">' +
        '<div style="font-size:.85rem;font-weight:800;color:var(--red);margin-bottom:8px">❌ تعارضات (' +
          stats.skipped.length + ')</div>';
      stats.skipped.forEach(function(s){
        html += '<div class="stt-issue-row" style="border-color:rgba(248,113,113,.4)">' +
          '<div class="stt-issue-ic">🚫</div>' +
          '<div class="stt-issue-body">' +
            '<b>الصف ' + s.row + '</b> — ' + esc(s.day) + ' ' + esc(s.time) + '<br>' +
            'المادة: <b>' + esc(s.newName) + '</b><br>' +
            'متعارضة مع: <b style="color:var(--red)">' + esc(s.conflictWith) + '</b> ' +
            '(محاضرة موجودة)' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    /* صفوف ناقصة */
    if(stats.incomplete.length){
      html += '<div style="margin-bottom:14px">' +
        '<div style="font-size:.85rem;font-weight:800;color:var(--amber);margin-bottom:8px">⚠️ صفوف ناقصة (' +
          stats.incomplete.length + ')</div>';
      stats.incomplete.forEach(function(s){
        html += '<div class="stt-issue-row" style="border-color:rgba(251,191,36,.4)">' +
          '<div class="stt-issue-ic">📝</div>' +
          '<div class="stt-issue-body">' +
            '<b>الصف ' + s.row + '</b><br>' +
            'ينقص: <b>' + esc(s.missing) + '</b>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    /* أكواد غير معروفة */
    if(stats.unknownCodes.length){
      html += '<div style="margin-bottom:14px">' +
        '<div style="font-size:.85rem;font-weight:800;color:var(--amber);margin-bottom:8px">⚠️ أكواد غير معروفة (' +
          stats.unknownCodes.length + ')</div>';
      stats.unknownCodes.forEach(function(s){
        html += '<div class="stt-issue-row" style="border-color:rgba(251,191,36,.4)">' +
          '<div class="stt-issue-ic">🔍</div>' +
          '<div class="stt-issue-body">' +
            '<b>الصف ' + s.row + '</b> — <code style="direction:ltr">' + esc(s.code) + '</code><br>' +
            'حُفظت باسم: <b>' + esc(s.name) + '</b>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }

    html += '<div style="padding:10px;background:var(--grad-soft);border-radius:10px;font-size:.76rem;color:var(--muted);line-height:1.7">' +
      '💡 <b>ملاحظة:</b> التعارضات لم تُحفظ — المادة الموجودة مسبقاً بقيت. ' +
      'افتح الجدول يدوياً لحل التعارض، ثم أعد الإضافة.' +
    '</div>';

    body.innerHTML = html;
    modal.appendChild(body);

    var footer = document.createElement('div');
    footer.className = 'stt-footer';
    footer.style.justifyContent = 'flex-end';
    footer.innerHTML = '<button class="stt-btn stt-btn-primary" type="button">حسناً</button>';
    modal.appendChild(footer);

    function closeResult(){ backdrop.remove(); }
    header.querySelector('.stt-close').addEventListener('click', closeResult);
    backdrop.addEventListener('click', function(e){
      if(e.target === backdrop) closeResult();
    });
    footer.querySelector('button').addEventListener('click', closeResult);
  }

  /* ============ Public API ============ */
  window.openSmartTimetable = function(initialRows){
    openModal(initialRows);
  };

  /* فتح مع تعبئة خلية معينة */
  window.openSmartTimetableAtKey = function(key){
    if(!key) { openModal(); return; }
    var parts = key.split('-');
    var day = parts[0];
    var time = parts[1];
    var row = emptyRow();
    row.days = [day];
    row.timeFrom = time || '';
    /* احسب نهاية افتراضية + ساعة */
    if(time){
      var tp = time.split(':');
      var hh = parseInt(tp[0], 10);
      var mm = parseInt(tp[1], 10) || 0;
      var endH = (hh + 1) % 24;
      row.timeTo = String(endH).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
    }
    /* املأ بقية الصفوف فارغة */
    var rows = [row];
    while(rows.length < MIN_ROWS) rows.push(emptyRow());
    openModal(rows);
  };

  /* ============ زر الإضافة الجماعية ============ */
  function injectButton(){
    if(document.getElementById('btnSmartAddClass')) return;
    var existing = document.getElementById('btnAddClass');
    if(!existing) return;

    var btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'btnSmartAddClass';
    btn.type = 'button';
    btn.innerHTML = '✨ إضافة دفعة';
    btn.style.cssText = 'background:var(--grad);color:#0b0f1a;font-weight:800';
    btn.onclick = function(){ openModal(); };
    existing.parentNode.insertBefore(btn, existing.nextSibling);
  }

  function init(){
    setTimeout(injectButton, 600);
    setTimeout(injectButton, 1500);
    setTimeout(injectButton, 3000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  console.log('[Smart Timetable v3] Loaded with conflict reporting');
})();