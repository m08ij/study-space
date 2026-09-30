/* ============================================================
   📸 ocr-smart.js v5 — OCR + إدخال يدوي للطوارئ
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
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function p2(n){ return String(n).padStart(2,'0'); }
  function fixDigits(t){
    return String(t||'').replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }

  /* ============ الأيام ============ */
  var DAY_LETTER = { 'ح':'Sun', 'ن':'Mon', 'ث':'Tue', 'ر':'Wed', 'خ':'Thu', 'ج':'Fri', 'س':'Sat' };
  var DAY_FULL = {
    'الاحد':'Sun','الأحد':'Sun','sunday':'Sun','sun':'Sun',
    'الاثنين':'Mon','monday':'Mon','mon':'Mon',
    'الثلاثاء':'Tue','tuesday':'Tue','tue':'Tue',
    'الاربعاء':'Wed','الأربعاء':'Wed','wednesday':'Wed','wed':'Wed',
    'الخميس':'Thu','thursday':'Thu','thu':'Thu',
    'الجمعه':'Fri','الجمعة':'Fri','friday':'Fri','fri':'Fri',
    'السبت':'Sat','saturday':'Sat','sat':'Sat'
  };

  function extractDays(text){
    var days = [];
    var t = fixDigits(String(text || ''));

    // سلاسل أحرف عربية (ح ن ث ر خ)
    var seqRe = /[حنثرخجس]+/g;
    var m;
    while ((m = seqRe.exec(t)) !== null){
      var seq = m[0];
      var before = t[m.index - 1] || '';
      var after = t[m.index + seq.length] || '';
      var isArBefore = /[\u0600-\u06FF]/.test(before);
      var isArAfter = /[\u0600-\u06FF]/.test(after);
      if (isArBefore || isArAfter) continue;
      if (seq.length > 5) continue;
      for (var i = 0; i < seq.length; i++){
        var d = DAY_LETTER[seq[i]];
        if (d && days.indexOf(d) === -1) days.push(d);
      }
    }

    // الأسماء الكاملة
    var tNorm = norm(t);
    Object.keys(DAY_FULL).forEach(function(name){
      var nameNorm = norm(name);
      if(!nameNorm) return;
      var esc2 = nameNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('(?:^|[\\s،,؛;\\-–—|/])' + esc2 + '(?:[\\s،,؛;\\-–—|/]|$)', 'i');
      if(re.test(tNorm)){
        var d2 = DAY_FULL[name];
        if (d2 && days.indexOf(d2) === -1) days.push(d2);
      }
    });

    return days;
  }

  /* ============ الأوقات ============ */
  function extractTimeRange(text){
    var t = fixDigits(text);

    // مع فاصل ( : . , ) ونطاق (- – — ~)
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

    // 0930-1030
    m = t.match(/\b(\d{3,4})\s*[\-–—~]\s*(\d{3,4})\b/);
    if(m){
      var s1 = m[1].length === 3 ? '0'+m[1] : m[1];
      var s2 = m[2].length === 3 ? '0'+m[2] : m[2];
      var hh1 = parseInt(s1.slice(0,2),10), mn1 = parseInt(s1.slice(2),10);
      var hh2 = parseInt(s2.slice(0,2),10), mn2 = parseInt(s2.slice(2),10);
      if(hh1<=23 && hh2<=23 && mn1<=59 && mn2<=59){
        if(hh1 > hh2 || (hh1 === hh2 && mn1 > mn2)){
          var th2 = hh1, tm2 = mn1; hh1 = hh2; mn1 = mn2; hh2 = th2; mn2 = tm2;
        }
        return { start: p2(hh1)+':'+p2(mn1), end: p2(hh2)+':'+p2(mn2) };
      }
    }

    // وقت واحد
    m = t.match(/\b(\d{1,2})\s*[,:.]\s*(\d{2})\b/);
    if(m){
      var h1b = parseInt(m[1],10), m1b = parseInt(m[2],10);
      if(h1b>=6 && h1b<=21 && m1b<=59){
        return { start: p2(h1b)+':'+p2(m1b), end: p2(h1b+1)+':'+p2(m1b) };
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
      /(?:قاعة|قاعه|ق\.)\s*([A-Za-z0-9\u0600-\u06FF\-]+)/i,
      /(?:ح\.?\s*ب)\s*(\d+)/,
      /(?:م\.?\s*غ)\s*(\d+)/,
      /(?:م\.?\s*ب)\s*(\d+)/,
      /(?:room|hall)\s*([A-Za-z0-9\-]+)/i
    ];
    for (var i = 0; i < patterns.length; i++){
      var m = text.match(patterns[i]);
      if (m && m[1]) return m[1];
    }
    return '';
  }

  function cleanText(raw){
    if (!raw) return '';
    var t = fixDigits(raw);
    t = t.replace(/[|¦]/g, ' ');
    t = t.replace(/[ \t]+/g, ' ');
    return t;
  }

  /* ============ Manual Input — الحل الأكيد ============ */
  function parseManualRows(text){
    var lines = String(text||'').split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var entries = [];

    lines.forEach(function(line){
      // فاصل: | أو ، أو ,
      var parts = line.split(/\s*[|،]\s*/).map(function(p){ return p.trim(); });
      if (parts.length < 4) return;

      // الشكل: كود | اسم | أيام | وقت | قاعة
      var code = parts[0] || null;
      var name = parts[1] || '';
      var daysStr = parts[2] || '';
      var timeStr = parts[3] || '';
      var room = parts[4] || '';

      // لو ما فيه كود (مثلاً blank)
      if(code && !/^\d{3,11}$/.test(code)) code = null;

      var days = extractDays(daysStr);
      var time = extractTimeRange(timeStr);

      if (!name || !days.length || !time) return;

      entries.push({
        code: code,
        name: name,
        days: days,
        time: time,
        room: room,
        hours: 3,
        raw: line
      });
    });

    return entries;
  }

  /* ============ Auto OCR Parser (يحاول) ============ */
  function parseTable(raw){
    var text = cleanText(raw);
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);

    // ابحث عن خطوط فيها أوقات
    var timeLines = [];
    for (var i = 0; i < lines.length; i++){
      if (extractTimeRange(lines[i])) timeLines.push(i);
    }

    var entries = [];

    timeLines.forEach(function(idx){
      // خذ نافذة ±2 سطر
      var s = Math.max(0, idx - 2);
      var e = Math.min(lines.length - 1, idx + 2);
      var window = lines.slice(s, e + 1).join(' ');

      var time = extractTimeRange(lines[idx]);
      if (!time) return;

      var code = extractCode(window);
      var days = extractDays(window);
      var room = extractRoom(window);

      // استخراج الاسم — نحذف كل شي معروف
      var name = window;
      if (code) name = name.replace(code, ' ');
      // احمي (1) و (2)
      name = name.replace(/\)\s*(\d+)\s*\(/g, '§$1§');
      name = name.replace(/\(\s*(\d+)\s*\)/g, '§$1§');
      // احذف الأيام
      name = name.replace(/[حنثرخجس]+/g, ' ');
      // احذف الأوقات
      name = name.replace(/\d{1,2}\s*[,:.]\s*\d{2}\s*[\-–—~]?\s*\d{0,2}\s*[,:.]?\s*\d{0,2}/g, ' ');
      // احذف القاعة
      name = name.replace(/(?:قاعة|قاعه|ق\.|ح\.?\s*ب|م\.?\s*غ|م\.?\s*ب|room|hall)\s*[A-Za-z0-9\u0600-\u06FF\-]+/gi, ' ');
      // احذف أوصاف شائعة
      name = name.replace(/(?:المادة تدرس|بشكل مدمج|في مبنى|في مجمع|على منصة|مايكروسوفت|teams|مدمج|وجاهي|عن بعد|قاعات|الحسين الباني|ابن خلدون|خلدون|ت:|تدرس|على|منصة|بس|أو|ندا|رس|بعد)/gi, ' ');
      name = name.replace(/\(teams\)/gi, ' ');
      // احذف الأرقام الصغيرة
      name = name.replace(/\b\d{1,2}\b/g, ' ');
      // احذف الرموز
      name = name.replace(/[\-–—\.\|،,;·•_]+/g, ' ');
      // رجّع (1)
      name = name.replace(/§(\d+)§/g, '($1)');
      // نضغط
      name = name.replace(/\s+/g, ' ').trim();

      if (!name || name.length < 3) return;
      if (!days.length) return;

      entries.push({
        code: code,
        name: name,
        days: days,
        time: time,
        room: room,
        hours: 3,
        raw: window
      });
    });

    return entries;
  }

  /* ============ matchWithDB ============ */
  function matchWithDB(entry){
    var DB = window.COURSES_DB || {};
    var keys = Object.keys(DB);

    // بالاسم
    var eName = norm(entry.name);
    if(eName){
      for (var j = 0; j < keys.length; j++){
        if (norm(keys[j]) === eName){
          return { matched: true, dbKey: keys[j], info: DB[keys[j]], matchedBy: 'name-exact', confidence: 1.0 };
        }
      }
    }

    // بالكود (مع aliases)
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

    // fuzzy
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

      // الجدول
      if (entry.days && entry.days.length && entry.time){
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

      // موادي
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

  /* ============ Report ============ */
  function showReport(entries, stats){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';

    var html = '<div class="modal" style="max-width:720px;padding:22px">';
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
    html += '<div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto">';
    entries.forEach(function(entry){
      var m = entry._match || {};
      var finalName = entry._finalName || entry.name;
      var color = m.matched ? 'var(--green)' : 'var(--red)';
      var status = m.matched ? '✅' : '❌';

      var dayNames = (entry.days || []).map(function(d){
        return {Sun:'أحد',Mon:'اثنين',Tue:'ثلاثاء',Wed:'أربعاء',Thu:'خميس',Fri:'جمعة',Sat:'سبت'}[d] || d;
      }).join('، ');

      html += '<div style="padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-left:3px solid ' + color + ';border-radius:8px;font-size:.82rem">';
      html += '<div style="font-weight:700;color:' + color + ';margin-bottom:4px">' + status + ' ' + esc(finalName) + '</div>';
      html += '<div style="font-size:.72rem;color:var(--muted)">';
      html += '📌 كود: ' + esc(entry.code || '—') + '<br>';
      html += '📅 أيام: ' + dayNames + '<br>';
      html += '⏰ وقت: ' + (entry.time ? entry.time.start + ' → ' + entry.time.end : '—') + '<br>';
      if (entry.room) html += '📍 قاعة: ' + esc(entry.room);
      html += '</div></div>';
    });
    html += '</div>';

    html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">';
    html += '<button class="btn btn-sm" id="ocrSmartDone">تمام</button></div></div>';

    bd.innerHTML = html;
    document.body.appendChild(bd);

    function close(){ bd.remove(); }
    bd.querySelector('#ocrSmartClose').onclick = close;
    bd.querySelector('#ocrSmartDone').onclick = close;
    bd.onclick = function(e){ if(e.target === bd) close(); };
  }

  /* ============ Manual Input UI ============ */
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
          '<b>الصيغة:</b><br>' +
          '<code style="direction:ltr;display:inline-block;background:rgba(0,0,0,.3);padding:4px 8px;border-radius:6px;font-size:.75rem;margin-top:4px">كود | اسم | أيام | وقت | قاعة</code>' +
          '<br><br>' +
          '<b>الأيام:</b> ح ن ث ر خ (أو: أحد، اثنين، ثلاثاء، أربعاء، خميس)' +
          '<br>' +
          '<b>الوقت:</b> 09:30-10:30 أو 9:30-10:30' +
        '</div>' +
        '<textarea id="mtInput" style="width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:14px;border-radius:10px;font-family:monospace;font-size:.82rem;min-height:240px;line-height:2;direction:rtl;text-align:right;resize:vertical"></textarea>' +
        '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px;flex-wrap:wrap">' +
          '<button class="btn btn-sm btn-ghost" id="mtClear">🗑 مسح</button>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-sm btn-ghost" id="mtCancel">إلغاء</button>' +
            '<button class="btn btn-sm" id="mtSave">💾 حفظ الجدول</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);

    var ta = document.getElementById('mtInput');
    // Pre-fill بالمثال
    ta.value =
      '110108101 | تفاضل وتكامل (1) | ح ث خ | 09:30-10:30 | ح.ب 104\n' +
      '121601099 | لغة عربية / استدراكية | ن ر | 08:30-10:00 | م.غ213\n' +
      '1701081136 | فيزياء عامة (1) | ح ث خ | 10:30-11:30 | ح.ب 105\n' +
      '2116021101 | مهارات التواصل باللغة الانجليزية | ح ث خ | 18:30-19:30 | —';

    bd.querySelector('#mtClose').onclick = function(){ bd.remove(); };
    bd.querySelector('#mtCancel').onclick = function(){ bd.remove(); };
    bd.querySelector('#mtClear').onclick = function(){ ta.value = ''; ta.focus(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };

    bd.querySelector('#mtSave').onclick = function(){
      var text = ta.value.trim();
      if(!text){ toast('اكتب صفوف الجدول', 'warn'); return; }

      var entries = parseManualRows(text);
      if(!entries.length){
        toast('⚠️ ما لقيت صفوف صالحة — تأكد من الصيغة (كود | اسم | أيام | وقت | قاعة)', 'warn', 4500);
        return;
      }

      var stats = applyAll(entries);
      bd.remove();
      showReport(entries, stats);
      toast('✅ ' + stats.addedToTimetable + ' محاضرة أُضيفت', 'success', 3000);
    };
  }

  /* ============ Install ============ */
  function install(){
    // اربط زر Parse OCR الأصلي
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
            toast('لا يوجد نص — الصق نص الجدول أو استخدم الإدخال اليدوي', 'warn');
            return;
          }
          try {
            var entries = parseTable(ta.value);
            if (!entries.length){
              toast('⚠️ ما لقيت صفوف صالحة — جرّب الإدخال اليدوي', 'warn', 4000);
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

    // أضف زر الإدخال اليدوي في بطاقة OCR
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
      console.log('%c #' + (i+1), 'color:#22d3ee;font-weight:bold');
      console.log('  كود:', e.code || '—');
      console.log('  اسم:', e.name || '—');
      console.log('  أيام:', e.days.join('، ') || '—');
      console.log('  وقت:', e.time ? (e.time.start + '→' + e.time.end) : '—');
      console.log('  قاعة:', e.room || '—');
      console.log('  مطابقة:', match.matched ? '✅ ' + match.dbKey : '❌');
    });
    return entries;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📸 OCR Smart v5 loaded');
})();