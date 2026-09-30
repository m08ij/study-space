/* ============================================================
   📸 ocr-smart.js v2 — OCR ذكي (مع تطبيع الأكواد)
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function space(){ return window.space || {}; }
  function save(){ if(typeof window.saveSpace === 'function') window.saveSpace(); }
  function uid(){ return window.uid ? window.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function norm(s){
    return String(s || '')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه')
      .replace(/[ىئ]/g, 'ي').replace(/ؤ/g, 'و')
      .replace(/\s+/g, ' ').trim();
  }

  var DAY_LETTERS = {
    'ح': 'Sun', 'ن': 'Mon', 'ث': 'Tue', 'ر': 'Wed',
    'خ': 'Thu', 'ج': 'Fri', 'س': 'Sat'
  };

  function extractDays(text){
    var days = [];
    var re = /(?:^|[\s،,\-])([حنثرخجس])(?=[\s،,\-]|$|\d)/g;
    var m;
    while ((m = re.exec(text)) !== null){
      var dayEn = DAY_LETTERS[m[1]];
      if (dayEn && days.indexOf(dayEn) === -1) days.push(dayEn);
    }
    return days;
  }

  function extractTimeRange(text){
    var m = text.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*[-–—]\s*(\d{1,2})\s*[:.]\s*(\d{2})/);
    if (!m) return null;
    var h1 = parseInt(m[1], 10), m1 = parseInt(m[2], 10);
    var h2 = parseInt(m[3], 10), m2 = parseInt(m[4], 10);
    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
    return {
      start: String(h1).padStart(2,'0') + ':' + String(m1).padStart(2,'0'),
      end:   String(h2).padStart(2,'0') + ':' + String(m2).padStart(2,'0')
    };
  }

  function extractCode(text){
    var m = text.match(/\b(\d{6,11})\b/);
    return m ? m[1] : null;
  }

  function extractRoom(text){
    var patterns = [
      /ح\.?\s*ب\s*(\d+)/,
      /م\.?\s*غ\s*(\d+)/,
      /(?:قاعه|قاعة|room|hall)\s*([A-Za-z0-9\u0600-\u06FF]+)/i,
      /(?:مبنى|مبنه)\s+[\u0600-\u06FF]+\s+([A-Za-z0-9\u0600-\u06FF]+)/
    ];
    for (var i = 0; i < patterns.length; i++){
      var m = text.match(patterns[i]);
      if (m && m[1]) return m[1];
      if (m && m[0]) return m[0];
    }
    return '';
  }

  function extractMode(text){
    var t = text;
    if (/وجاهي|وجاهيا|حضوريا|في المبنى/.test(t)) return 'in-person';
    if (/مدمج|مدمجا|blended|hybrid/.test(t)) return 'blended';
    if (/عن بعد|اونلاين|أونلاين|online|افتراضي|منصه|مايكروسوفت|teams|moodle/i.test(t)) return 'online';
    return 'in-person';
  }

  function extractHours(text){
    var m = text.match(/\b([1-6])\b(?=\s*$|\s*\n)/);
    if (m) return parseInt(m[1], 10);
    m = text.match(/(\d+)\s*(?:ساعات?|hours?)/i);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  function cleanText(raw){
    if (!raw) return '';
    var t = String(raw);
    t = t.replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
    t = t.replace(/[|¦]/g, ' ');
    t = t.replace(/[ \t]+/g, ' ');
    return t;
  }

  function parseTable(raw){
    var text = cleanText(raw);
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
    var rows = [];
    var current = null;

    lines.forEach(function(line){
      var code = extractCode(line);
      var isNewRow = code && line.indexOf(code) < 5;

      if (isNewRow){
        if (current && current.code) rows.push(current);
        current = { code: code, text: line };
      } else if (current){
        current.text += '\n' + line;
      }
    });
    if (current && current.code) rows.push(current);
    return rows.map(parseRow).filter(function(r){ return r.code; });
  }

  function parseRow(row){
    var full = row.text;
    var single = full.replace(/\n/g, ' ');

    var result = {
      code: row.code, name: '', theory: 0, practical: 0,
      days: extractDays(single), time: extractTimeRange(single),
      room: extractRoom(single), mode: extractMode(single),
      hours: 0, raw: single
    };

    var withoutCode = single.replace(row.code, '').trim();
    var sectionsMatch = withoutCode.match(/^(.+?)\s+(\d+)\s+(\d+)(?=\s|$)/);
    if (sectionsMatch){
      result.name = sectionsMatch[1].trim();
      result.theory = parseInt(sectionsMatch[2], 10);
      result.practical = parseInt(sectionsMatch[3], 10);
    } else {
      var nameMatch = withoutCode.match(/^([^\d]+?)(?=\s+\d|\s*$)/);
      result.name = nameMatch ? nameMatch[1].trim() : withoutCode.split(/\s+\d/)[0].trim();
    }

    result.name = result.name.replace(/[\-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
    result.hours = extractHours(single) || 3;
    return result;
  }

  /* ✅ matchWithDB مُصلَحة — تطبيع الأكواد */
  function matchWithDB(entry){
    var DB = window.COURSES_DB || {};
    var keys = Object.keys(DB);

    // 1) بالكود (مع تطبيع الأصفار)
    var eCode = String(entry.code || '').replace(/^0+/, '');
    if (eCode){
      for (var i = 0; i < keys.length; i++){
        var dbCode = String(DB[keys[i]].code || '').replace(/^0+/, '');
        if (dbCode === eCode){
          return {
            matched: true, dbKey: keys[i], info: DB[keys[i]],
            matchedBy: 'code', confidence: 1.0
          };
        }
      }
    }

    // 2) بالاسم الكامل
    var eName = norm(entry.name);
    for (var j = 0; j < keys.length; j++){
      if (norm(keys[j]) === eName){
        return {
          matched: true, dbKey: keys[j], info: DB[keys[j]],
          matchedBy: 'name-exact', confidence: 0.95
        };
      }
    }

    // 3) مطابقة جزئية
    var best = null, bestScore = 0;
    var eTokens = eName.split(/\s+/).filter(function(t){ return t.length > 2; });

    keys.forEach(function(k){
      var kNorm = norm(k);
      var kTokens = kNorm.split(/\s+/).filter(function(t){ return t.length > 2; });
      if (!kTokens.length || !eTokens.length) return;

      var matched = eTokens.filter(function(t){
        return kTokens.some(function(kt){
          return kt === t || kt.indexOf(t) > -1 || t.indexOf(kt) > -1;
        });
      }).length;

      var score = matched / Math.max(eTokens.length, kTokens.length);
      if (score > bestScore && score >= 0.6){
        bestScore = score;
        best = k;
      }
    });

    if (best){
      return {
        matched: true, dbKey: best, info: DB[best],
        matchedBy: 'name-fuzzy', confidence: bestScore
      };
    }

    return { matched: false, confidence: 0 };
  }

  function applyAll(entries){
    var sp = space();
    if (!sp.timetable) sp.timetable = {};
    if (!sp.courses) sp.courses = [];
    if (!sp.attendance) sp.attendance = {};
    if (!sp.completedCourses) sp.completedCourses = [];

    var stats = {
      total: entries.length,
      addedToTimetable: 0, addedToCourses: 0, addedToAttendance: 0,
      matched: 0, unmatched: [], matchedList: []
    };

    entries.forEach(function(entry){
      var match = matchWithDB(entry);
      entry._match = match;
      var finalName = match.matched ? match.dbKey : entry.name;
      entry._finalName = finalName;

      if (match.matched){
        stats.matched++;
        stats.matchedList.push({
          code: entry.code, name: finalName,
          matchedBy: match.matchedBy, confidence: match.confidence
        });
      } else {
        stats.unmatched.push({ code: entry.code, name: entry.name });
      }

      if (entry.days.length && entry.time && entry.time.start){
        entry.days.forEach(function(day){
          var key = day + '-' + entry.time.start;
          if (!sp.timetable[key]){
            sp.timetable[key] = {
              name: finalName, room: entry.room || '',
              instructor: '', mode: entry.mode
            };
            stats.addedToTimetable++;
          }
        });
      }

      if (match.matched){
        var exists = sp.courses.some(function(c){ return c.name === finalName; });
        var isCompleted = sp.completedCourses.indexOf(finalName) > -1;
        if (!exists && !isCompleted){
          var DBinfo = match.info || {};
          sp.courses.push({
            id: uid(), name: finalName,
            code: entry.code || DBinfo.code || '',
            hours: entry.hours || DBinfo.h || 3,
            instructor: '', room: entry.room || ''
          });
          stats.addedToCourses++;
        }
      }

      if (match.matched){
        if (!sp.attendance[finalName]){
          sp.attendance[finalName] = { present: 0, absent: 0 };
          stats.addedToAttendance++;
        }
      }
    });

    save();
    try{ window.renderTimetable && window.renderTimetable(); }catch(e){}
    try{ window.renderCourses && window.renderCourses(); }catch(e){}
    try{ window.renderAttendance && window.renderAttendance(); }catch(e){}
    try{ window.renderDashboard && window.renderDashboard(); }catch(e){}

    return stats;
  }

  function showReport(entries, stats){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';

    var html = '<div class="modal" style="max-width:640px;padding:22px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    html += '<h3 style="margin:0">📊 تقرير OCR الذكي</h3>';
    html += '<button class="btn btn-sm btn-ghost" id="ocrSmartClose">✕</button></div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--cyan)">' + stats.total + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:4px">صفوف</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--green)">' + stats.addedToTimetable + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:4px">محاضرات</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--amber)">' + stats.addedToCourses + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:4px">مواد</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--purple)">' + stats.addedToAttendance + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:4px">حضور</div></div>';
    html += '</div>';

    if (stats.matchedList.length){
      html += '<div style="margin-bottom:16px"><h4 style="font-size:.9rem;color:var(--cyan);margin-bottom:10px">✅ تطابقت (' + stats.matchedList.length + ')</h4>';
      html += '<div style="display:flex;flex-direction:column;gap:6px;max-height:250px;overflow-y:auto">';
      stats.matchedList.forEach(function(m){
        var badge = m.matchedBy === 'code' ? '🟢 بالكود' : m.matchedBy === 'name-exact' ? '🟢 بالاسم' : '🟡 مشابه';
        var conf = m.confidence < 1 ? ' (' + Math.round(m.confidence*100) + '%)' : '';
        html += '<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:.82rem">';
        html += '<div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(m.name) + '</div>';
        html += '<div style="font-size:.68rem;color:var(--muted2);font-family:monospace">' + esc(m.code) + '</div></div>';
        html += '<span style="font-size:.68rem;padding:3px 8px;border-radius:6px;background:var(--grad-soft);color:var(--cyan);font-weight:700;white-space:nowrap">' + badge + conf + '</span></div>';
      });
      html += '</div></div>';
    }

    if (stats.unmatched.length){
      html += '<div style="margin-bottom:16px"><h4 style="font-size:.9rem;color:var(--amber);margin-bottom:10px">⚠️ ما تطابقت (' + stats.unmatched.length + ')</h4>';
      html += '<div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto">';
      stats.unmatched.forEach(function(m){
        html += '<div style="padding:8px 12px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;font-size:.82rem">';
        html += '<div style="font-weight:700">' + esc(m.name || '(بدون اسم)') + '</div>';
        html += '<div style="font-size:.68rem;color:var(--muted2);font-family:monospace">' + esc(m.code) + '</div></div>';
      });
      html += '</div></div>';
    }

    html += '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">';
    html += '<button class="btn btn-sm btn-ghost" id="ocrSmartUndo">↺ تراجع</button>';
    html += '<button class="btn btn-sm" id="ocrSmartDone">تمام</button></div></div>';

    bd.innerHTML = html;
    document.body.appendChild(bd);

    function close(){ bd.remove(); }
    bd.querySelector('#ocrSmartClose').onclick = close;
    bd.querySelector('#ocrSmartDone').onclick = close;
    bd.onclick = function(e){ if(e.target === bd) close(); };

    bd.querySelector('#ocrSmartUndo').onclick = function(){
      if (!confirm('إزالة المواد اللي انضافت من OCR؟')) return;
      var sp = space();
      entries.forEach(function(entry){
        if (entry.days.length && entry.time){
          entry.days.forEach(function(day){
            var key = day + '-' + entry.time.start;
            if (sp.timetable[key]) delete sp.timetable[key];
          });
        }
      });
      save();
      try{ window.renderTimetable && window.renderTimetable(); }catch(e){}
      try{ window.renderDashboard && window.renderDashboard(); }catch(e){}
      toast('✅ تم التراجع عن الجدول', 'success');
      close();
    };
  }

  function install(){
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      var btn = document.getElementById('btnParseOcr');
      if (btn && !btn._ocrSmartBound){
        btn._ocrSmartBound = true;
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(){
          var ta = document.getElementById('ocrTextarea');
          if (!ta || !ta.value.trim()){
            toast('لا يوجد نص — الصق نص الجدول أولاً', 'warn');
            return;
          }
          try {
            var entries = parseTable(ta.value);
            if (!entries.length){
              toast('⚠️ ما لقيت صفوف صالحة — تأكد من صيغة الجدول', 'warn', 4000);
              return;
            }
            var stats = applyAll(entries);
            showReport(entries, stats);
            toast('✅ تم التحليل! ' + stats.addedToTimetable + ' محاضرة أُضيفت', 'success', 3000);
          } catch(e){
            console.error('OCR Smart error:', e);
            toast('فشل التحليل: ' + (e.message || e), 'warn', 4000);
          }
        });
        clearInterval(timer);
      }
      if (tries > 30) clearInterval(timer);
    }, 1000);
  }

  window.ocrSmart = {
    parse: parseTable,
    apply: applyAll,
    extractDays: extractDays,
    extractTime: extractTimeRange,
    matchWithDB: matchWithDB
  };

  window.ocrSmartTest = function(text){
    var entries = parseTable(text || '');
    console.log('📊 Parsed entries:', entries);
    return entries;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📸 OCR Smart v2 loaded');
})();