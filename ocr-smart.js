/* ============================================================
   📸 ocr-smart.js v7 — النسخة النهائية المُصلَحة
   ✅ إصلاح مشكلة shadow على window
   ✅ parser يستوعب صيغة جدول الجامعة
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function space(){ return window.space || {}; }
  function save(){ if(typeof window.saveSpace === 'function') window.saveSpace(); }
  function uid(){ return window.uid ? window.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function p2(n){ return String(n).padStart(2,'0'); }

  /* ============ التطبيع ============ */
  function norm(s){
    return String(s || '')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function normStrong(s){
    return norm(s)
      .replace(/[()\[\]{}]/g, ' ')
      .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ============ الأيام ============ */
  var DAY_LETTER = { 'ح':'Sun', 'ن':'Mon', 'ث':'Tue', 'ر':'Wed', 'خ':'Thu', 'ج':'Fri', 'س':'Sat' };
  var DAY_FULL = {
    'الاحد':'Sun','الاثنين':'Mon','الثلاثاء':'Tue','الاربعاء':'Wed','الخميس':'Thu','الجمعه':'Fri','السبت':'Sat',
    'sunday':'Sun','monday':'Mon','tuesday':'Tue','wednesday':'Wed','thursday':'Thu','friday':'Fri','saturday':'Sat',
    'sun':'Sun','mon':'Mon','tue':'Tue','wed':'Wed','thu':'Thu','fri':'Fri','sat':'Sat'
  };

  function extractDays(text){
    var days = [];
    var t = fixDigits(String(text || ''));

    var seqRe = /[حنثرخجس]+/g;
    var m;
    while ((m = seqRe.exec(t)) !== null){
      var seq = m[0];
      var before = t[m.index - 1] || '';
      var after = t[m.index + seq.length] || '';
      if (/[\u0600-\u06FF]/.test(before) || /[\u0600-\u06FF]/.test(after)) continue;
      if (seq.length > 5) continue;
      for (var i = 0; i < seq.length; i++){
        var d = DAY_LETTER[seq[i]];
        if (d && days.indexOf(d) === -1) days.push(d);
      }
    }

    var tNorm = norm(t);
    Object.keys(DAY_FULL).forEach(function(name){
      var nNorm = norm(name);
      if(!nNorm) return;
      var re = new RegExp('(?:^|[\\s،,؛;\\-–—|/])' + nNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[\\s،,؛;\\-–—|/]|$)', 'i');
      if(re.test(tNorm)){
        var d2 = DAY_FULL[name];
        if (d2 && days.indexOf(d2) === -1) days.push(d2);
      }
    });

    return days;
  }

  /* ============ الأرقام والأوقات ============ */
  function fixDigits(t){
    return String(t||'').replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }

  function extractTimeRange(text){
    var t = fixDigits(text);
    var m = t.match(/(\d{1,2})\s*[,:.]\s*(\d{2})\s*[\-–—~]\s*(\d{1,2})\s*[,:.]\s*(\d{2})/);
    if(m){
      var h1 = parseInt(m[1],10), mm1 = parseInt(m[2],10);
      var h2 = parseInt(m[3],10), mm2 = parseInt(m[4],10);
      if(h1<=23 && h2<=23 && mm1<=59 && mm2<=59){
        if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
          var th = h1, tm = mm1; h1 = h2; mm1 = mm2; h2 = th; mm2 = tm;
        }
        return { start: p2(h1)+':'+p2(mm1), end: p2(h2)+':'+p2(mm2) };
      }
    }
    m = t.match(/\b(\d{3,4})\s*[\-–—~]\s*(\d{3,4})\b/);
    if(m){
      var s1 = m[1].length === 3 ? '0'+m[1] : m[1];
      var s2 = m[2].length === 3 ? '0'+m[2] : m[2];
      var hh1 = parseInt(s1.slice(0,2),10), mn1 = parseInt(s1.slice(2),10);
      var hh2 = parseInt(s2.slice(0,2),10), mn2 = parseInt(s2.slice(2),10);
      if(hh1<=23 && hh2<=23 && mn1<=59 && mn2<=59){
        if(hh1 > hh2 || (hh1 === hh2 && mn1 > mn2)){
          var t2 = hh1, t3 = mn1; hh1 = hh2; mn1 = mn2; hh2 = t2; mn2 = t3;
        }
        return { start: p2(hh1)+':'+p2(mn1), end: p2(hh2)+':'+p2(mn2) };
      }
    }
    return null;
  }

  function extractCode(text){
    var m = String(text||'').match(/\b(\d{6,11})\b/);
    return m ? m[1] : null;
  }

  function extractRoom(text){
    var patterns = [
      /ح\.?\s*ب\s*(\d+)/,
      /م\.?\s*غ\s*(\d+)/,
      /م\.?\s*ب\s*(\d+)/,
      /(?:قاعة|قاعه|ق\.)\s*([A-Za-z0-9\u0600-\u06FF\-]+)/i,
      /(?:room|hall)\s*([A-Za-z0-9\-]+)/i
    ];
    for (var i = 0; i < patterns.length; i++){
      var m = text.match(patterns[i]);
      if (m && m[1]) return m[1];
    }
    return '';
  }

  /* ============ تنظيف نص جدول الجامعة ============ */
  function preprocess(raw){
    var t = fixDigits(String(raw||''));

    var merges = [
      ['لغةعربية', 'لغة عربية'],
      ['لغةانجليزية', 'لغة انجليزية'],
      ['لغةإنجليزية', 'لغة انجليزية'],
      ['مهاراتالتواصل', 'مهارات التواصل'],
      ['مهاراتحاسوب', 'مهارات حاسوب'],
      ['فيزياءعامة', 'فيزياء عامة'],
      ['تفاضلوتكامل', 'تفاضل وتكامل'],
      ['رياضياتمتقطعة', 'رياضيات متقطعة'],
      ['شبكاتحاسوب', 'شبكات حاسوب'],
      ['هيكليةالبيانات', 'هيكلية البيانات'],
      ['هندسةالبرمجيات', 'هندسة البرمجيات'],
      ['منطقرقمي', 'منطق رقمي']
    ];
    merges.forEach(function(m){
      t = t.replace(new RegExp(m[0], 'g'), m[1]);
    });

    // الفاصلة كوقت → نقطتان
    t = t.replace(/(\d{1,2})\s*,\s*(\d{2})/g, '$1:$2');

    // إزالة وصف "المادة تدرس..."
    t = t.replace(/المادة\s+تدرس[^\n]*?(?=\n|$)/g, ' ');
    t = t.replace(/الماده\s+تدرس[^\n]*?(?=\n|$)/g, ' ');

    // إزالة "على منصة مايكروسوفت teams"
    t = t.replace(/على\s+منصة\s*\(?مايكروسوفت\s*\)?\s*\(?teams\)?/gi, ' ');
    t = t.replace(/\(?مايكروسوفت\s*\)?\s*\(?teams\)?/gi, ' ');
    t = t.replace(/\(?teams\)?/gi, ' ');
    t = t.replace(/\(?مايكروسوفت\)?/gi, ' ');

    // إزالة أوصاف طريقة التدريس
    t = t.replace(/\b(?:مدمج|مدمجا|وجاهي|وجاهيا|عن\s+بعد|حضوريا|افتراضي)\b/g, ' ');

    // إزالة "في مبنى/في مجمع..."
    t = t.replace(/في\s+(?:مبنى|مجمع|مجمّع)\s+[^\n,،؛]+/g, ' ');

    // إصلاح الأقواس المقلوبة )1( → (1)
    t = t.replace(/\)\s*(\d+)\s*\(/g, '($1)');

    // إزالة كلمات OCR السيئة
    t = t.replace(/\b(?:بس|أو|ندا|رس|اخ|ت:|ت\b)\b/g, ' ');

    // إزالة الرموز المتكررة
    t = t.replace(/[|¦]+/g, ' ');
    t = t.replace(/[؛;]{2,}/g, ' ');
    t = t.replace(/[ \t]+/g, ' ');

    return t;
  }

  /* ============ البحث عن أسماء المواد في DB ============ */
  function findCourseNamesInWindow(winText){
    var DB = window.COURSES_DB || {};
    var found = [];

    var wNormStrong = normStrong(winText);

    Object.keys(DB).forEach(function(name){
      var nNormStrong = normStrong(name);
      if(!nNormStrong || nNormStrong.length < 6) return;

      if(wNormStrong.indexOf(nNormStrong) > -1){
        found.push({ name: name, matched: 'exact', weight: name.length * 2 });
        return;
      }

      var altName = nNormStrong.replace(/\s*\d+\s*$/, '').trim();
      if(altName.length >= 6 && wNormStrong.indexOf(altName) > -1){
        found.push({ name: name, matched: 'no-number', weight: name.length });
      }
    });

    found.sort(function(a, b){ return b.weight - a.weight; });
    return found;
  }

  /* ============ ✅ Parser الأساسي — مُصلَح ============ */
  function parseTable(raw){
    var t = preprocess(raw);
    t = t.replace(/[\n\r]+/g, '\n');
    var entries = [];
    var seen = {};

    var timeRe = /(\d{1,2})\s*[:.]\s*(\d{2})\s*[\-–—~]\s*(\d{1,2})\s*[:.]\s*(\d{2})/g;
    var m;

    while ((m = timeRe.exec(t)) !== null){
      var pos = m.index;
      var winStart = Math.max(0, pos - 500);
      var winEnd = Math.min(t.length, pos + 300);
      var winText = t.substring(winStart, winEnd);

      var h1 = parseInt(m[1],10), mm1 = parseInt(m[2],10);
      var h2 = parseInt(m[3],10), mm2 = parseInt(m[4],10);
      if(h1 > 23 || h2 > 23 || mm1 > 59 || mm2 > 59) continue;
      if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
        var th = h1, tm = mm1; h1 = h2; mm1 = mm2; h2 = th; mm2 = tm;
      }
      var time = { start: p2(h1)+':'+p2(mm1), end: p2(h2)+':'+p2(mm2) };

      var nameMatches = findCourseNamesInWindow(winText);
      if(!nameMatches.length) continue;

      var courseName = nameMatches[0].name;

      var key = courseName + '|' + time.start;
      if(seen[key]) continue;
      seen[key] = true;

      var DB = window.COURSES_DB || {};
      var info = DB[courseName] || {};

      var codeMatch = winText.match(/\b(\d{6,11})\b/);
      var code = codeMatch ? codeMatch[1] : (info.code || '');

      var days = extractDays(winText);
      var room = extractRoom(winText);

      entries.push({
        code: code,
        name: courseName,
        days: days,
        time: time,
        room: room,
        hours: info.h || 3,
        raw: winText.substring(0, 200).replace(/\s+/g, ' ')
      });
    }

    return entries;
  }

  /* ============ matchWithDB ============ */
  function matchWithDB(entry){
    var DB = window.COURSES_DB || {};
    var keys = Object.keys(DB);

    var eName = norm(entry.name);
    for (var j = 0; j < keys.length; j++){
      if (norm(keys[j]) === eName){
        return { matched: true, dbKey: keys[j], info: DB[keys[j]], matchedBy: 'name-exact', confidence: 1.0 };
      }
    }

    var eCode = String(entry.code || '').replace(/^0+/, '');
    if (eCode){
      for (var i = 0; i < keys.length; i++){
        var dbCode = String(DB[keys[i]].code || '').replace(/^0+/, '');
        if (dbCode === eCode){
          return { matched: true, dbKey: keys[i], info: DB[keys[i]], matchedBy: 'code', confidence: 1.0 };
        }
      }
      for (var i2 = 0; i2 < keys.length; i2++){
        var aliases = DB[keys[i2]].aliases || [];
        for (var a = 0; a < aliases.length; a++){
          if (String(aliases[a]).replace(/^0+/, '') === eCode){
            return { matched: true, dbKey: keys[i2], info: DB[keys[i2]], matchedBy: 'code-alias', confidence: 0.98 };
          }
        }
      }
    }

    if(!eName) return { matched: false, confidence: 0 };
    var best = null, bestScore = 0;
    var eTokens = eName.split(/\s+/).filter(function(t){ return t.length > 2; });
    keys.forEach(function(k){
      var kNorm = norm(k);
      var kTokens = kNorm.split(/\s+/).filter(function(t){ return t.length > 2; });
      if (!kTokens.length || !eTokens.length) return;
      var matched = 0;
      eTokens.forEach(function(t){
        if(kTokens.some(function(kt){ return kt === t || kt.indexOf(t) > -1 || t.indexOf(kt) > -1; })){
          matched++;
        }
      });
      var score = matched / Math.max(eTokens.length, kTokens.length);
      if (score > bestScore && score >= 0.5){ bestScore = score; best = k; }
    });

    if (best){
      return { matched: true, dbKey: best, info: DB[best], matchedBy: 'name-fuzzy', confidence: bestScore };
    }
    return { matched: false, confidence: 0 };
  }

  /* ============ applyAll ============ */
  function applyAll(entries){
    var sp = space();
    if (!sp.timetable) sp.timetable = {};
    if (!sp.courses) sp.courses = [];
    if (!sp.attendance) sp.attendance = {};

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
          matchedBy: match.matchedBy, confidence: match.confidence,
          days: entry.days, time: entry.time
        });
      } else {
        stats.unmatched.push({ code: entry.code, name: entry.name });
      }

      if (entry.days && entry.days.length && entry.time && entry.time.start){
        entry.days.forEach(function(day){
          var key = day + '-' + entry.time.start;
          if (!sp.timetable[key]){
            sp.timetable[key] = {
              name: finalName,
              room: entry.room || '',
              instructor: ''
            };
            stats.addedToTimetable++;
          }
        });
      }

      if (finalName){
        var exists = sp.courses.some(function(c){ return c.name === finalName; });
        if (!exists){
          var DBinfo = match.info || {};
          sp.courses.push({
            id: uid(), name: finalName,
            code: entry.code || DBinfo.code || '',
            hours: entry.hours || DBinfo.h || 3,
            instructor: '', room: entry.room || ''
          });
          stats.addedToCourses++;
        }
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

  /* ============ التقرير ============ */
  function showReport(entries, stats){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';

    var html = '<div class="modal" style="max-width:740px;padding:22px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    html += '<h3 style="margin:0">📊 تقرير التحليل</h3>';
    html += '<button class="btn btn-sm btn-ghost" id="ocrSmartClose">✕</button></div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:16px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--cyan)">' + stats.total + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">صفوف</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--green)">' + stats.addedToTimetable + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">محاضرات</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--amber)">' + stats.addedToCourses + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">مواد</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--purple)">' + stats.addedToAttendance + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">حضور</div></div>';
    html += '</div>';

    html += '<h4 style="font-size:.9rem;color:var(--cyan);margin-bottom:10px">📋 تفاصيل الصفوف</h4>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto">';

    entries.forEach(function(entry){
      var m = entry._match || {};
      var finalName = entry._finalName || entry.name;
      var hasDays = entry.days && entry.days.length;
      var hasTime = entry.time && entry.time.start;
      var color = m.matched ? 'var(--green)' : 'var(--red)';
      var status = m.matched ? '✅' : '❌';
      var dayNames = (entry.days||[]).map(function(d){
        return {Sun:'أحد',Mon:'اثنين',Tue:'ثلاثاء',Wed:'أربعاء',Thu:'خميس',Fri:'جمعة',Sat:'سبت'}[d] || d;
      }).join('، ');

      html += '<div style="padding:12px;background:var(--bg2);border:1px solid var(--border);border-right:3px solid ' + color + ';border-radius:10px;font-size:.82rem">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">';
      html += '<div style="flex:1"><div style="font-weight:700;color:' + color + ';font-size:.9rem">' + status + ' ' + esc(finalName) + '</div>';
      if (entry.code) html += '<div style="font-size:.68rem;color:var(--muted2);font-family:monospace;margin-top:2px">كود: ' + esc(entry.code) + '</div>';
      html += '</div>';
      if (m.matched) html += '<span style="font-size:.62rem;padding:3px 8px;border-radius:6px;background:rgba(52,211,153,.15);color:var(--green);font-weight:700">' + (m.matchedBy||'matched') + '</span>';
      html += '</div>';

      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;font-size:.74rem">';
      html += '<div><span style="color:var(--muted)">📅 أيام:</span> <b>' + (dayNames || '—') + '</b></div>';
      html += '<div><span style="color:var(--muted)">⏰ وقت:</span> <b>' + (hasTime ? entry.time.start + ' → ' + entry.time.end : '—') + '</b></div>';
      html += '<div><span style="color:var(--muted)">📍 قاعة:</span> <b>' + (entry.room || '—') + '</b></div>';
      html += '</div>';

      if (!m.matched){
        html += '<div style="margin-top:8px;padding:6px 10px;background:rgba(239,68,68,.1);border-radius:6px;font-size:.7rem;color:var(--red)">❌ ما لقيت مادة مطابقة في الخطة</div>';
      }
      if (!hasDays || !hasTime){
        html += '<div style="margin-top:8px;padding:6px 10px;background:rgba(251,191,36,.1);border-radius:6px;font-size:.7rem;color:var(--amber)">⚠️ ' + (!hasDays ? 'ما في أيام ' : '') + (!hasTime ? 'ما في وقت' : '') + ' — ما رح تنضاف للجدول</div>';
      }

      html += '</div>';
    });

    html += '</div>';
    html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">';
    html += '<button class="btn btn-sm btn-ghost" id="ocrSmartUndo">↺ تراجع</button>';
    html += '<button class="btn btn-sm" id="ocrSmartDone">تمام</button></div></div>';

    bd.innerHTML = html;
    document.body.appendChild(bd);

    function close(){ bd.remove(); }
    bd.querySelector('#ocrSmartClose').onclick = close;
    bd.querySelector('#ocrSmartDone').onclick = close;
    bd.onclick = function(e){ if(e.target === bd) close(); };

    bd.querySelector('#ocrSmartUndo').onclick = function(){
      if (!confirm('إزالة المحاضرات اللي انضافت؟')) return;
      var sp = space();
      entries.forEach(function(entry){
        if (entry.days && entry.days.length && entry.time){
          entry.days.forEach(function(day){
            var key = day + '-' + entry.time.start;
            if (sp.timetable[key]) delete sp.timetable[key];
          });
        }
      });
      save();
      try{ window.renderTimetable && window.renderTimetable(); }catch(e){}
      try{ window.renderDashboard && window.renderDashboard(); }catch(e){}
      toast('✅ تم التراجع', 'success');
      close();
    };
  }

  /* ============ الإدخال اليدوي ============ */
  function openManualInput(){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:820px;padding:22px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
          '<h3 style="margin:0">📝 إدخال الجدول يدوياً</h3>' +
          '<button class="btn btn-sm btn-ghost" id="mtClose">✕</button>' +
        '</div>' +
        '<div style="background:var(--grad-soft);border:1px solid var(--glow);border-radius:10px;padding:12px;margin-bottom:14px;font-size:.8rem;line-height:1.8">' +
          '<b>الصيغة:</b> <code style="direction:ltr;display:inline-block;background:rgba(0,0,0,.3);padding:2px 8px;border-radius:6px">كود | اسم | أيام | وقت | قاعة</code>' +
          '<br><b>الأيام:</b> ح ن ث ر خ <b>·</b> <b>الوقت:</b> 09:30-10:30' +
        '</div>' +
        '<textarea id="mtInput" style="width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:14px;border-radius:10px;font-family:monospace;font-size:.82rem;min-height:200px;line-height:2;direction:rtl;text-align:right;resize:vertical"></textarea>' +
        '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px;flex-wrap:wrap">' +
          '<button class="btn btn-sm btn-ghost" id="mtClear">🗑 مسح</button>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-sm btn-ghost" id="mtCancel">إلغاء</button>' +
            '<button class="btn btn-sm" id="mtSave">💾 حفظ</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);

    var ta = document.getElementById('mtInput');
    ta.value =
      '110108101 | تفاضل وتكامل (1) | ح ث خ | 09:30-10:30 | ح.ب 104\n' +
      '121601099 | لغة عربية / استدراكية | ن ر | 08:30-10:00 | م.غ 213\n' +
      '1701081136 | فيزياء عامة (1) | ح ث خ | 10:30-11:30 | ح.ب 105\n' +
      '2116021101 | مهارات التواصل باللغة الانجليزية | ح ث خ | 18:30-19:30 | —';

    bd.querySelector('#mtClose').onclick = function(){ bd.remove(); };
    bd.querySelector('#mtCancel').onclick = function(){ bd.remove(); };
    bd.querySelector('#mtClear').onclick = function(){ ta.value = ''; ta.focus(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };

    bd.querySelector('#mtSave').onclick = function(){
      var text = ta.value.trim();
      if(!text){ toast('اكتب صفوف الجدول', 'warn'); return; }

      var lines = text.split(/\r?\n/).filter(Boolean);
      var entries = [];

      lines.forEach(function(line){
        var parts = line.split(/\s*\|\s*/).map(function(p){ return p.trim(); });
        if (parts.length < 4) return;
        var code = parts[0] || '';
        var name = parts[1] || '';
        var days = extractDays(parts[2] || '');
        var time = extractTimeRange(parts[3] || '');
        var room = parts[4] || '';
        if (!name || !days.length || !time) return;
        entries.push({ code: code, name: name, days: days, time: time, room: room, hours: 3, raw: line });
      });

      if(!entries.length){ toast('⚠️ ما لقيت صفوف صالحة', 'warn', 3500); return; }

      var stats = applyAll(entries);
      bd.remove();
      showReport(entries, stats);
      toast('✅ ' + stats.addedToTimetable + ' محاضرة أُضيفت', 'success', 3000);
    };
  }

  /* ============ install ============ */
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
            toast('لا يوجد نص', 'warn');
            return;
          }
          try {
            var entries = parseTable(ta.value);
            if (!entries.length){
              toast('⚠️ ما لقيت صفوف — جرّب الإدخال اليدوي', 'warn', 4000);
              return;
            }
            var stats = applyAll(entries);
            showReport(entries, stats);
            toast('✅ ' + stats.addedToTimetable + ' محاضرة أُضيفت', 'success', 3000);
          } catch(e){
            console.error('OCR error:', e);
            toast('فشل: ' + (e.message || e), 'warn', 4000);
          }
        });
        clearInterval(timer);
      }
      if (tries > 30) clearInterval(timer);
    }, 1000);

    var tries2 = 0;
    var timer2 = setInterval(function(){
      tries2++;
      var uploadZone = document.getElementById('uploadZone');
      if (uploadZone && !document.getElementById('manualInputBtn')){
        var card = uploadZone.closest('.card');
        if (card){
          var btn = document.createElement('button');
          btn.className = 'btn';
          btn.id = 'manualInputBtn';
          btn.style.cssText = 'width:100%;margin-top:10px;background:var(--grad-soft);color:var(--cyan);border:1px solid var(--cyan)';
          btn.innerHTML = '📝 إدخال يدوي للجدول (موصى به)';
          btn.addEventListener('click', openManualInput);
          card.appendChild(btn);
          clearInterval(timer2);
        }
      }
      if (tries2 > 30) clearInterval(timer2);
    }, 1000);
  }

  /* ============ Public API ============ */
  window.ocrSmart = {
    parse: parseTable,
    apply: applyAll,
    extractDays: extractDays,
    extractTime: extractTimeRange,
    matchWithDB: matchWithDB,
    openManualInput: openManualInput
  };

  window.ocrSmartTest = function(text){
    var entries = parseTable(text || '');
    console.log('%c🔍 عدد الصفوف: ' + entries.length, 'color:#a78bfa;font-weight:bold;font-size:14px');
    entries.forEach(function(e, i){
      var match = matchWithDB(e);
      console.log('%c #' + (i+1) + ' → ' + e.name, 'color:#22d3ee;font-weight:bold');
      console.log('  كود:', e.code || '—');
      console.log('  أيام:', e.days.join('، ') || '—');
      console.log('  وقت:', e.time ? (e.time.start + '→' + e.time.end) : '—');
      console.log('  قاعة:', e.room || '—');
      console.log('  مطابقة:', match.matched ? '✅ ' + match.dbKey : '❌');
    });
    return entries;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📸 OCR Smart v7 loaded — بدون مشاكل');
})();