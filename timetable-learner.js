/* ============================================================
   🧠 timetable-learner.js v1 — التعلّم من تصحيحات المستخدم
   ============================================================ */
(function(){
  'use strict';

  var FIXES_KEY = 'timetable_fixes_v1';

  function loadFixes(){
    try{ return JSON.parse(localStorage.getItem(FIXES_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  }

  function saveFixes(fixes){
    try{ localStorage.setItem(FIXES_KEY, JSON.stringify(fixes)); }catch(e){}
  }

  function getFixKey(row){
    if(row.code && /^\d{6,12}$/.test(String(row.code).trim())){
      return 'code:' + String(row.code).replace(/^0+/, '');
    }
    if(row.name && row.name.length >= 3){
      var cleanName = String(row.name)
        .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ')
        .trim();
      return 'name:' + cleanName;
    }
    return null;
  }

  function record(originalRow, correctedRow){
    var key = getFixKey(correctedRow) || getFixKey(originalRow);
    if(!key) return false;

    var fixes = loadFixes();
    var existing = fixes[key] || { hits: 0 };
    fixes[key] = {
      name: correctedRow.name || existing.name,
      code: correctedRow.code || existing.code,
      days: (correctedRow.days && correctedRow.days.length) ? correctedRow.days : existing.days,
      timeStart: correctedRow.timeStart || existing.timeStart,
      timeEnd: correctedRow.timeEnd || existing.timeEnd,
      room: correctedRow.room || existing.room,
      hours: correctedRow.hours || existing.hours,
      hits: (existing.hits || 0) + 1,
      ts: Date.now()
    };
    saveFixes(fixes);
    console.log('🧠 تعلّمنا:', key, '→', fixes[key].name);
    return true;
  }

  function apply(row){
    var key = getFixKey(row);
    if(!key) return row;

    var fixes = loadFixes();
    var fix = fixes[key];
    if(!fix) return row;

    if(fix.name && (!row.name || row.name.length < 3)) row.name = fix.name;
    if(fix.code && !row.code) row.code = fix.code;
    if(fix.days && fix.days.length && (!row.days || !row.days.length)) row.days = fix.days;
    if(fix.timeStart && !row.timeStart){
      row.timeStart = fix.timeStart;
      row.timeEnd = fix.timeEnd;
    }
    if(fix.room && !row.room) row.room = fix.room;
    if(fix.hours && (!row.hours || row.hours > 6)) row.hours = fix.hours;

    row._learned = true;
    return row;
  }

  function applyAll(rows){
    return (rows || []).map(function(r){ return apply(r); });
  }

  function stats(){
    var fixes = loadFixes();
    var keys = Object.keys(fixes);
    var week = Date.now() - 7 * 24 * 3600 * 1000;
    return {
      total: keys.length,
      recent: keys.filter(function(k){ return fixes[k].ts > week; }).length,
      fixes: fixes
    };
  }

  function clear(){
    if(!confirm('مسح كل التصحيحات المحفوظة؟')) return;
    localStorage.removeItem(FIXES_KEY);
    if(typeof window.toast === 'function') window.toast('🗑 مسح التصحيحات', 'success');
  }

  function exportFixes(){
    var fixes = loadFixes();
    var blob = new Blob([JSON.stringify(fixes, null, 2)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'timetable-fixes-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    if(typeof window.toast === 'function') window.toast('📤 تم التصدير', 'success');
  }

  function importFixes(){
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = function(e){
      var f = e.target.files[0];
      if(!f) return;
      var r = new FileReader();
      r.onload = function(ev){
        try{
          var data = JSON.parse(ev.target.result);
          if(!data || typeof data !== 'object') throw new Error('bad format');
          var fixes = loadFixes();
          var added = 0;
          Object.keys(data).forEach(function(k){
            if(!fixes[k]){ fixes[k] = data[k]; added++; }
          });
          saveFixes(fixes);
          if(typeof window.toast === 'function') window.toast('📥 أُضيف ' + added + ' تصحيح', 'success');
        }catch(err){
          if(typeof window.toast === 'function') window.toast('ملف غير صالح', 'warn');
        }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  function hookImporter(){
    if(!window.TimetableImporter){
      return setTimeout(hookImporter, 500);
    }
    if(window._tlHooked) return;
    window._tlHooked = true;

    var origParse = window.TimetableImporter.parse;
    window.TimetableImporter.parse = function(){
      var rows = origParse.apply(this, arguments);
      return applyAll(rows);
    };

    var origApply = window.TimetableImporter.apply;
    window.TimetableImporter.apply = function(rows){
      rows.forEach(function(r){
        if(r._edited) record(r._original || {}, r);
      });
      return origApply.apply(this, arguments);
    };

    console.log('🧠 Learner hooked');
  }

  function showStats(){
    var s = stats();
    var html = '<div class="modal" style="max-width:520px">' +
      '<h3>🧠 إحصائيات التعلّم</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div style="background:var(--bg2);padding:14px;border-radius:10px;text-align:center">' +
          '<div style="font-size:1.8rem;font-weight:800;color:var(--cyan)">' + s.total + '</div>' +
          '<div style="font-size:.75rem;color:var(--muted)">إجمالي التصحيحات</div>' +
        '</div>' +
        '<div style="background:var(--bg2);padding:14px;border-radius:10px;text-align:center">' +
          '<div style="font-size:1.8rem;font-weight:800;color:var(--green)">' + s.recent + '</div>' +
          '<div style="font-size:.75rem;color:var(--muted)">هذا الأسبوع</div>' +
        '</div>' +
      '</div>';

    var keys = Object.keys(s.fixes).slice(0, 10);
    if(keys.length){
      html += '<div style="max-height:200px;overflow-y:auto;margin-bottom:14px">';
      keys.forEach(function(k){
        var f = s.fixes[k];
        html += '<div style="padding:6px 10px;border-bottom:1px solid var(--border);font-size:.78rem">' +
          '<b>' + (f.name || k) + '</b> <span style="color:var(--muted);font-size:.7rem">(' + f.hits + ' مرة)</span>' +
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="empty" style="padding:20px"><p>ما في تصحيحات بعد</p></div>';
    }

    html += '<div class="modal-actions">' +
      '<button class="btn btn-sm btn-ghost" id="tlExport">📤 تصدير</button>' +
      '<button class="btn btn-sm btn-ghost" id="tlImport">📥 استيراد</button>' +
      '<button class="btn btn-sm btn-danger" id="tlClear">🗑 مسح</button>' +
      '<button class="btn btn-sm" id="tlClose">إغلاق</button>' +
    '</div></div>';

    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML = html;
    document.body.appendChild(bd);

    bd.querySelector('#tlClose').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
    bd.querySelector('#tlExport').onclick = exportFixes;
    bd.querySelector('#tlImport').onclick = function(){ importFixes(); bd.remove(); };
    bd.querySelector('#tlClear').onclick = function(){ clear(); bd.remove(); };
  }

  window.TimetableLearner = {
    record: record,
    apply: apply,
    applyAll: applyAll,
    stats: stats,
    clear: clear,
    export: exportFixes,
    import: importFixes,
    showStats: showStats,
    getFixKey: getFixKey
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hookImporter);
  } else {
    hookImporter();
  }

  console.log('🧠 Timetable Learner v1 — ready');
})();