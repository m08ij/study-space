/* ============================================================
   📸 ocr-parser-v8.js — محلل الجدول الجامعي الموحّد
   ✅ يدعم صيغة الجامعة الهاشمية الرسمية (ح ن ث ر خ)
   ✅ يربط الأكواد بـ COURSES_DB
   ✅ يعبّي الجدول + المواد + الحضور + Dashboard
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function space(){ return window.space || {}; }
  function save(){ if(typeof window.saveSpace === 'function') window.saveSpace(); }
  function uid(){ return window.uid ? window.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function p2(n){ return String(n).padStart(2,'0'); }

  /* ============ الأيام ============ */
  var DAY_LETTER = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };
  var DAY_AR = { Sun:'الأحد', Mon:'الاثنين', Tue:'الثلاثاء', Wed:'الأربعاء', Thu:'الخميس', Fri:'الجمعة', Sat:'السبت' };

  /* ============ تطبيع ============ */
  function fixDigits(t){
    return String(t||'').replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }
  function norm(s){
    return String(s || '')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه')
      .replace(/[ىئ]/g, 'ي').replace(/ؤ/g, 'و')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /* ============ تنظيف النص ============ */
  function preprocess(raw){
    var t = fixDigits(String(raw || ''));
    // احذف رؤوس الأعمدة
    t = t.replace(/رقم\s+المادة\s+اسم\s+المادة[^\n]*/gi, '');
    t = t.replace(/الشعبة\s+النظري[^\n]*/gi, '');
    t = t.replace(/وقت\s+المحاضرة[^\n]*/gi, '');
    t = t.replace(/عدد\s+الساعات/gi, '');
    t = t.replace(/\/\s*رقم\s+القاعة/gi, '');
    // دمج الأسطر: إذا السطر ما يبدأ بكود، ادمجه مع اللي قبله
    var rawLines = t.split(/\r?\n/);
    var merged = [];
    rawLines.forEach(function(line){
      var trimmed = line.trim();
      if(!trimmed) return;
      if(/^\d{6,11}/.test(trimmed)) merged.push(trimmed);
      else if(merged.length) merged[merged.length - 1] += ' ' + trimmed;
      else merged.push(trimmed);
    });
    var out = merged.join('\n');
    out = out.replace(/\)\s*(\d+)\s*\(/g, '($1)');
    out = out.replace(/(\d{1,2})\s*[,.]\s*(\d{2})/g, '$1:$2');
    out = out.replace(/\(?مايكروسوفت\s*\)?/gi, ' ');
    out = out.replace(/\(?teams\)?/gi, ' ');
    out = out.replace(/[|¦]+/g, ' ');
    out = out.replace(/[ \t]+/g, ' ');
    return out;
  }

  /* ============ الوقت ============ */
  function extractTime(text){
    var m = text.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*[-–—~]\s*(\d{1,2})\s*[:.]\s*(\d{2})/);
    if(m){
      var h1 = parseInt(m[1],10), mm1 = parseInt(m[2],10);
      var h2 = parseInt(m[3],10), mm2 = parseInt(m[4],10);
      if(h1<=23 && h2<=23 && mm1<=59 && mm2<=59){
        if(h1>h2 || (h1===h2 && mm1>mm2)){ var th=h1, tm=mm1; h1=h2; mm1=mm2; h2=th; mm2=tm; }
        return { start: p2(h1)+':'+p2(mm1), end: p2(h2)+':'+p2(mm2), match: m[0], index: m.index };
      }
    }
    m = text.match(/\b(\d{3,4})\s*[-–—~]\s*(\d{3,4})\b/);
    if(m){
      var s1 = m[1].length===3 ? '0'+m[1] : m[1];
      var s2 = m[2].length===3 ? '0'+m[2] : m[2];
      var hh1 = parseInt(s1.slice(0,2),10), mn1 = parseInt(s1.slice(2),10);
      var hh2 = parseInt(s2.slice(0,2),10), mn2 = parseInt(s2.slice(2),10);
      if(hh1<=23 && hh2<=23 && mn1<=59 && mn2<=59){
        return { start: p2(hh1)+':'+p2(mn1), end: p2(hh2)+':'+p2(mn2), match: m[0], index: m.index };
      }
    }
    return null;
  }

  /* ============ الأيام (ح ن ث ر خ) ============ */
  function extractDays(text, beforeIdx){
    var days = [], m, last = null;
    var zone = (beforeIdx != null) ? text.substring(0, beforeIdx) : text;
    var re = /(?:^|[\s\/|\\\-–—,؛;])([حنثرخجس](?:[\s\/|\\\-–—,؛;]+[حنثرخجس]){0,6})(?=[\s\/|\\\-–—,؛;]|$)/g;
    while((m = re.exec(zone)) !== null) last = m;
    if(last){
      last[1].split(/[\s\/|\\\-–—,؛;]+/).filter(Boolean).forEach(function(l){
        var d = DAY_LETTER[l];
        if(d && days.indexOf(d) === -1) days.push(d);
      });
    }
    return { days: days, match: last ? last[0] : null, index: last ? last.index : -1 };
  }

  /* ============ القاعة ============ */
  function extractRoom(text){
    var patterns = [
      /ح\.?\s*ب\.?\s*(\d+)/, /م\.?\s*غ\.?\s*(\d+)/, /م\.?\s*ب\.?\s*(\d+)/, /م\.?\s*ج\.?\s*(\d+)/,
      /(?:قاعة|قاعه|ق\.)\s*([A-Za-z0-9\u0600-\u06FF\-]+)/i,
      /(?:room|hall)\s*([A-Za-z0-9\-]+)/i
    ];
    for(var i = 0; i < patterns.length; i++){
      var m = text.match(patterns[i]);
      if(m) return m[0].replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  /* ============ الساعات ============ */
  function extractHours(text, timeMatch){
    var t = text;
    if(timeMatch) t = t.replace(timeMatch, ' ');
    var m = t.match(/\s(\d{1,2})\s*$/);
    if(m){
      var h = parseInt(m[1],10);
      if(h >= 1 && h <= 6) return { hours: h, match: m[0] };
    }
    return { hours: 3, match: null };
  }

  /* ============ رقم الشعبة (فقط قبل الأيام) ============ */
  function extractSection(text, daysStart){
    if(daysStart < 0) return null;
    var zone = text.substring(0, daysStart);
    var m = zone.match(/\s(\d{1,3})\s+(\d{1,2})\s*$/);
    if(m){
      var sec = parseInt(m[1],10);
      if(sec >= 1 && sec <= 999) return { section: sec, match: m[0] };
    }
    return null;
  }

  /* ============ parseRow ============ */
  function parseRow(rowText, code){
    var text = rowText;
    var result = { code: code, name: '', days: [], time: null, room: '', hours: 3 };

    var timeInfo = extractTime(text);
    if(timeInfo) result.time = { start: timeInfo.start, end: timeInfo.end };

    var daysInfo = extractDays(text, timeInfo ? timeInfo.index : null);
    result.days = daysInfo.days;

    result.room = extractRoom(text);
    var hoursInfo = extractHours(text, timeInfo ? timeInfo.match : null);
    result.hours = hoursInfo.hours;
    var secInfo = extractSection(text, daysInfo.index);

    var name = text;
    name = name.replace(code, ' ');
    if(timeInfo) name = name.replace(timeInfo.match, ' ');
    if(daysInfo.match) name = name.replace(daysInfo.match, ' ');
    name = name.replace(/ح\.?\s*ب\.?\s*\d+/g, ' ');
    name = name.replace(/م\.?\s*غ\.?\s*\d+/g, ' ');
    name = name.replace(/م\.?\s*ب\.?\s*\d+/g, ' ');
    if(secInfo) name = name.replace(secInfo.match, ' ');
    name = name.replace(/\s+\d{1,2}\s*$/, ' ');
    name = name.replace(/المادة\s+تدرس[^\n]*/gi, ' ');
    name = name.replace(/الماده\s+تدرس[^\n]*/gi, ' ');
    name = name.replace(/على\s+منصة[^\n]*/gi, ' ');
    name = name.replace(/عن\s+بعد[^\n]*/gi, ' ');
    name = name.replace(/[\/|\\]/g, ' ');
    name = name.replace(/\s+/g, ' ').trim();

    result.name = (!name || name.length < 2) ? 'مادة ' + code : name;
    return result;
  }

  /* ============ parseTable ============ */
  function parseTable(raw){
    var text = preprocess(raw);
    var lines = text.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    var entries = [], seen = {};
    lines.forEach(function(line){
      var m = line.match(/^(\d{6,11})\s+(.+)$/);
      if(!m) return;
      var code = m[1], rest = m[2];
      var key = code + '|' + rest.substring(0, 40);
      if(seen[key]) return;
      seen[key] = true;
      var entry = parseRow(rest, code);
      entries.push(entry);
    });
    return entries;
  }

  /* ============ المطابقة مع DB ============ */
  function matchWithDB(entry){
    var DB = window.COURSES_DB || {};
    var cleanCode = String(entry.code || '').replace(/^0+/, '');
    if(cleanCode && typeof window.findCourseByCode === 'function'){
      var r = window.findCourseByCode(entry.code);
      if(r) return { matched: true, dbKey: r.name, info: r.info, matchedBy: 'code', confidence: 1.0 };
    }
    for(var k in DB){
      if(String(DB[k].code).replace(/^0+/, '') === cleanCode){
        return { matched: true, dbKey: k, info: DB[k], matchedBy: 'code-exact', confidence: 1.0 };
      }
    }
    var normName = norm(entry.name);
    for(var k2 in DB){
      if(norm(k2) === normName) return { matched: true, dbKey: k2, info: DB[k2], matchedBy: 'name', confidence: 0.95 };
    }
    var best = null, bestScore = 0;
    var eTokens = normName.split(/\s+/).filter(function(t){ return t.length > 2; });
    Object.keys(DB).forEach(function(k){
      var kTokens = norm(k).split(/\s+/).filter(function(t){ return t.length > 2; });
      if(!kTokens.length || !eTokens.length) return;
      var matched = 0;
      eTokens.forEach(function(t){
        if(kTokens.some(function(kt){ return kt === t || kt.indexOf(t) > -1; })) matched++;
      });
      var score = matched / Math.max(eTokens.length, kTokens.length);
      if(score > bestScore && score >= 0.6){ bestScore = score; best = k; }
    });
    if(best) return { matched: true, dbKey: best, info: DB[best], matchedBy: 'fuzzy', confidence: bestScore };
    return { matched: false, confidence: 0 };
  }

  /* ============ التطبيق ============ */
  function applyAll(entries){
    var sp = space();
    if(!sp.timetable) sp.timetable = {};
    if(!sp.courses) sp.courses = [];
    if(!sp.attendance) sp.attendance = {};

    var stats = { total: entries.length, addedToTimetable: 0, addedToCourses: 0, addedToAttendance: 0, matched: 0, unmatched: [] };

    entries.forEach(function(entry){
      var match = matchWithDB(entry);
      entry._match = match;
      var finalName = match.matched ? match.dbKey : entry.name;
      entry._finalName = finalName;

      if(match.matched) stats.matched++;
      else stats.unmatched.push({ code: entry.code, name: entry.name });

      if(entry.days.length && entry.time){
        entry.days.forEach(function(day){
          var key = day + '-' + entry.time.start;
          sp.timetable[key] = { name: finalName, room: entry.room || '', instructor: '' };
          stats.addedToTimetable++;
        });
      }

      var exists = sp.courses.some(function(c){
        return c.name === finalName || (entry.code && c.code === entry.code);
      });
      if(!exists){
        var DBinfo = match.info || {};
        sp.courses.push({
          id: uid(), name: finalName,
          code: entry.code || DBinfo.code || '',
          hours: entry.hours || DBinfo.h || 3,
          instructor: '', room: entry.room || ''
        });
        stats.addedToCourses++;
      }

      if(finalName && !sp.attendance[finalName]){
        sp.attendance[finalName] = { present: 0, absent: 0 };
        stats.addedToAttendance++;
      }
    });

    save();
    try{ window.renderTimetable && window.renderTimetable(); }catch(e){}
    try{ window.renderCourses && window.renderCourses(); }catch(e){}
    try{ window.renderAttendance && window.renderAttendance(); }catch(e){}
    try{ window.renderDashboard && window.renderDashboard(); }catch(e){}
    return { stats: stats, entries: entries };
  }

  /* ============ التقرير ============ */
  function showReport(entries, stats){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';

    var html = '<div class="modal" style="max-width:760px;padding:22px;max-height:90vh;overflow-y:auto">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
    html += '<h3 style="margin:0">📊 تقرير استيراد الجدول</h3>';
    html += '<button class="btn btn-sm btn-ghost" id="ocrV8Close">✕</button></div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:16px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--cyan)">' + stats.total + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">صفوف</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--green)">' + stats.addedToTimetable + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">محاضرة</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--amber)">' + stats.addedToCourses + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">مادة</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--purple)">' + stats.matched + '/' + stats.total + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">مطابقة</div></div>';
    html += '</div>';

    html += '<div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">';
    entries.forEach(function(entry){
      var m = entry._match || {};
      var finalName = entry._finalName || entry.name;
      var color = m.matched ? 'var(--green)' : 'var(--amber)';
      var status = m.matched ? '✅' : '⚠️';
      var dayNames = (entry.days || []).map(function(d){ return DAY_AR[d] || d; }).join('، ');

      html += '<div style="padding:12px;background:var(--bg2);border:1px solid var(--border);border-right:3px solid ' + color + ';border-radius:10px;font-size:.82rem">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">';
      html += '<div style="flex:1"><div style="font-weight:700;color:' + color + ';font-size:.9rem">' + status + ' ' + esc(finalName) + '</div>';
      html += '<div style="font-size:.68rem;color:var(--muted2);font-family:monospace;margin-top:2px">' + esc(entry.code) + ' · ' + (entry.hours || 3) + ' ساعات</div></div>';
      if(m.matched) html += '<span style="font-size:.62rem;padding:3px 8px;border-radius:6px;background:rgba(52,211,153,.15);color:var(--green);font-weight:700">' + (m.matchedBy || 'match') + '</span>';
      html += '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;font-size:.74rem">';
      html += '<div><span style="color:var(--muted)">📅</span> <b>' + (dayNames || '—') + '</b></div>';
      html += '<div><span style="color:var(--muted)">⏰</span> <b>' + (entry.time ? entry.time.start + ' → ' + entry.time.end : '—') + '</b></div>';
      html += '<div><span style="color:var(--muted)">📍</span> <b>' + (entry.room || '—') + '</b></div>';
      html += '</div>';
      if(!m.matched) html += '<div style="margin-top:8px;padding:6px 10px;background:rgba(251,191,36,.1);border-radius:6px;font-size:.7rem;color:var(--amber)">⚠️ ما لقيت مطابقة في الخطة — أضفتها بالاسم</div>';
      if(!entry.days.length || !entry.time) html += '<div style="margin-top:8px;padding:6px 10px;background:rgba(239,68,68,.1);border-radius:6px;font-size:.7rem;color:var(--red)">❌ ناقص أيام أو وقت</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">';
    html += '<button class="btn btn-sm btn-ghost" id="ocrV8Undo">↺ تراجع</button>';
    html += '<button class="btn btn-sm" id="ocrV8Done">تمام</button></div></div>';

    bd.innerHTML = html;
    document.body.appendChild(bd);

    function close(){ bd.remove(); }
    bd.querySelector('#ocrV8Close').onclick = close;
    bd.querySelector('#ocrV8Done').onclick = close;
    bd.onclick = function(e){ if(e.target === bd) close(); };
    bd.querySelector('#ocrV8Undo').onclick = function(){
      if(!confirm('إزالة المحاضرات والمواد اللي انضافت؟')) return;
      var sp = space();
      entries.forEach(function(entry){
        if(entry.days && entry.days.length && entry.time){
          entry.days.forEach(function(day){
            var key = day + '-' + entry.time.start;
            if(sp.timetable[key]) delete sp.timetable[key];
          });
        }
        var finalName = entry._finalName;
        if(finalName){
          sp.courses = sp.courses.filter(function(c){ return c.name !== finalName; });
          if(sp.attendance[finalName]) delete sp.attendance[finalName];
        }
      });
      save();
      try{ window.renderTimetable && window.renderTimetable(); }catch(e){}
      try{ window.renderCourses && window.renderCourses(); }catch(e){}
      try{ window.renderAttendance && window.renderAttendance(); }catch(e){}
      try{ window.renderDashboard && window.renderDashboard(); }catch(e){}
      toast('↺ تم التراجع', 'success');
      close();
    };
  }

  /* ============ تركيب ============ */
  var EXAMPLE = [
    '110108101 تفاضل وتكامل (1) 1 0 ح ث خ / 09:30 - 10:30 المادة تدرس بشكل مدمج في مبنى الحسين الباني ح.ب 104 3',
    '121601099 لغة عربية / استدراكية 2 0 ن ر / 08:30 - 10:00 المادة تدرس بشكل مدمج في مجمع قاعات ابن خلدون م.غ 213 3',
    '1701081136 فيزياء عامة (1) 4 0 ح ث خ / 10:30 - 11:30 المادة تدرس وجاهي في مبنى الحسين الباني ح.ب 105 3',
    '2116021101 مهارات التواصل باللغة الانجليزية 10 0 ح ث خ / 18:30 - 19:30 المادة تدرس عن بعد على منصة مايكروسوفت 3'
  ].join('\n');

  function install(){
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      var btn = document.getElementById('btnParseOcr');
      var pasteBtn = document.getElementById('btnPasteOcr');
      if(btn){
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(){
          var ta = document.getElementById('ocrTextarea');
          if(!ta || !ta.value.trim()){ toast('⚠️ لا يوجد نص', 'warn'); return; }
          try{
            var entries = parseTable(ta.value);
            if(!entries.length){
              toast('⚠️ ما لقيت صفوف صالحة', 'warn', 4000); return;
            }
            var result = applyAll(entries);
            showReport(result.entries, result.stats);
            toast('✅ ' + result.stats.addedToTimetable + ' محاضرة · ' + result.stats.addedToCourses + ' مادة', 'success', 4000);
          }catch(e){ console.error(e); toast('فشل: ' + (e.message || e), 'warn', 4000); }
        });
        clearInterval(timer);
      }
      if(pasteBtn && !pasteBtn._v8){
        pasteBtn._v8 = true;
        var newP = pasteBtn.cloneNode(true);
        pasteBtn.parentNode.replaceChild(newP, pasteBtn);
        newP.addEventListener('click', function(){
          var res = document.getElementById('ocrResult');
          var ta = document.getElementById('ocrTextarea');
          if(res) res.style.display = 'block';
          if(ta) ta.value = EXAMPLE;
          toast('📋 مثال جاهز', 'info', 2000);
        });
      }
      if(tries > 60) clearInterval(timer);
    }, 500);
  }

  /* ============ API عام ============ */
  window.ocrV8 = { parse: parseTable, apply: applyAll, parseRow: parseRow, matchWithDB: matchWithDB };
  window.ocrV8Test = function(text){
    var entries = parseTable(text || '');
    console.log('%c🔍 عدد الصفوف: ' + entries.length, 'color:#a78bfa;font-weight:bold');
    entries.forEach(function(e){
      var m = matchWithDB(e);
      console.log('➡️', e.code, '|', e.name, '|', e.days.join(','), '|', e.time ? e.time.start : '—', '|', e.room, '|', m.matched ? '✅ '+m.dbKey : '❌');
    });
    return entries;
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📸 OCR Parser v8 loaded');
})();