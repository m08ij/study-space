/* ============================================================
   📸 ocr-smart.js v4 — Parser صبور يستوعب OCR المعطوب
   ✅ فاصلة كوقت: 10,30 = 10:30
   ✅ ترتيب معكوس: 10,30-09,30 = 09:30 → 10:30
   ✅ أيام ملتصقة: 10ح = ح | ثخ = ث، خ
   ✅ أسطر متعددة: يجمع اسم المادة من 3 أسطر
   ✅ مطابقة بالاسم أولاً (fuzzy قوي)
   ✅ تقرير مفصّل: كل صف وليش نجح/فشل
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

  /* ============ 1. الأيام ============ */
  var DAY_LETTER = { 'ح':'Sun', 'ن':'Mon', 'ث':'Tue', 'ر':'Wed', 'خ':'Thu', 'ج':'Fri', 'س':'Sat' };

  var DAY_FULL = {
    'الاحد':'Sun','الأحد':'Sun','sunday':'Sun','sun':'Sun',
    'الاثنين':'Mon','الاتنين':'Mon','monday':'Mon','mon':'Mon',
    'الثلاثاء':'Tue','tuesday':'Tue','tue':'Tue',
    'الاربعاء':'Wed','الأربعاء':'Wed','wednesday':'Wed','wed':'Wed',
    'الخميس':'Thu','thursday':'Thu','thu':'Thu',
    'الجمعه':'Fri','الجمعة':'Fri','friday':'Fri','fri':'Fri',
    'السبت':'Sat','saturday':'Sat','sat':'Sat'
  };

  function extractDays(text){
    var days = [];
    var t = fixDigits(String(text || ''));

    // 1) سلاسل أحرف عربية (ح ن ث ر خ) — ممكن تكون ملتصقة ببعض: ثخ، حثخ
    // نطابق أي سلسلة من هذه الأحرف
    var seqRe = /[حنثرخجس]+/g;
    var m;
    while ((m = seqRe.exec(t)) !== null){
      var seq = m[0];
      // لكن لازم نتأكد إن هذه السلسلة مو جزء من كلمة (مثل "شخص" فيها "خ")
      // نفقط نقبل السلسلة لو:
      // - كل أحرفها من مجموعة الأيام
      // - طولها 1-5
      // - ما حولها حرف عربي آخر
      var before = t[m.index - 1] || '';
      var after = t[m.index + seq.length] || '';
      var isArabicBefore = /[\u0600-\u06FF]/.test(before);
      var isArabicAfter = /[\u0600-\u06FF]/.test(after);
      if (isArabicBefore || isArabicAfter) continue;
      if (seq.length > 5) continue;

      for (var i = 0; i < seq.length; i++){
        var d = DAY_LETTER[seq[i]];
        if (d && days.indexOf(d) === -1) days.push(d);
      }
    }

    // 2) الأسماء الكاملة
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

  /* ============ 2. الأوقات ============ */
  function p2(n){ return String(n).padStart(2,'0'); }
  function fixDigits(t){
    return String(t||'').replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }

  function extractTimeRange(text){
    var t = fixDigits(text);

    // ✅ قبول , : . كفواصل
    // ✅ قبول - – — ~ كفواصل النطاق
    var m = t.match(/(\d{1,2})\s*[,:.]\s*(\d{2})\s*[\-–—~]\s*(\d{1,2})\s*[,:.]\s*(\d{2})/);
    if(m){
      var h1 = parseInt(m[1],10), mm1 = parseInt(m[2],10);
      var h2 = parseInt(m[3],10), mm2 = parseInt(m[4],10);
      if(h1<=23 && h2<=23 && mm1<=59 && mm2<=59){
        // ✅ نرتّب: الأصغر أولاً (بغض النظر عن ترتيب النص)
        if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
          var th = h1, tm = mm1;
          h1 = h2; mm1 = mm2;
          h2 = th; mm2 = tm;
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
          var th2 = hh1, tm2 = mn1;
          hh1 = hh2; mn1 = mn2;
          hh2 = th2; mn2 = tm2;
        }
        return { start: p2(hh1)+':'+p2(mn1), end: p2(hh2)+':'+p2(mn2) };
      }
    }

    // وقت واحد (نضيف ساعة)
    m = t.match(/\b(\d{1,2})\s*[,:.]\s*(\d{2})\b/);
    if(m){
      var h1b = parseInt(m[1],10), m1b = parseInt(m[2],10);
      if(h1b>=6 && h1b<=21 && m1b<=59){
        return { start: p2(h1b)+':'+p2(m1b), end: p2(h1b+1)+':'+p2(m1b) };
      }
    }

    return null;
  }

  /* ============ 3. الكود ============ */
  function extractCode(text){
    var m = String(text||'').match(/\b(\d{6,11})\b/);
    return m ? m[1] : null;
  }

  /* ============ 4. القاعة ============ */
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

  /* ============ 5. تنظيف ============ */
  function cleanText(raw){
    if (!raw) return '';
    var t = fixDigits(raw);
    t = t.replace(/[|¦]/g, ' ');
    t = t.replace(/[ \t]+/g, ' ');
    return t;
  }

  /* ============ 6. استخراج الاسم — يحفظ (1) و (2) ============ */
  function extractName(rowText, code){
    var t = rowText;
    if(code) t = t.replace(code, ' ');

    // احمي الأقواس: )1( و (1) و ) 1 (
    // الأول: )1( → (1)
    t = t.replace(/\)\s*(\d+)\s*\(/g, '§$1§');
    // الثاني: (1) عادي
    t = t.replace(/\(\s*(\d+)\s*\)/g, '§$1§');

    // نزيل أسماء الأيام الكاملة (قبل حذف الأحرف المفردة)
    Object.keys(DAY_FULL).forEach(function(dn){
      var esc2 = dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp('(?:^|[\\s،,؛;\\-])\\s*' + esc2 + '\\s*(?=[\\s،,؛;\\-]|$)', 'gi'), ' ');
    });

    // نزيل الأوقات (بأي فاصل)
    t = t.replace(/\d{1,2}\s*[,:.]\s*\d{2}\s*[\-–—~]?\s*\d{0,2}\s*[,:.]?\s*\d{0,2}/g, ' ');
    t = t.replace(/\b\d{3,4}\s*[\-–—~]\s*\d{3,4}\b/g, ' ');

    // نزيل القاعة
    t = t.replace(/(?:قاعة|قاعه|ق\.|ح\.?\s*ب|م\.?\s*غ|م\.?\s*ب|room|hall)\s*[A-Za-z0-9\u0600-\u06FF\-]+/gi, ' ');

    // نزيل أوصاف شائعة في جداول الجامعة
    t = t.replace(/(?:المادة تدرس|بشكل مدمج|في مبنى|في مجمع|على منصة|مايكروسوفت|teams|مدمج|وجاهي|عن بعد|قاعات|الحسين الباني|ابن خلدون|خلدون|عندما|بس|ت:|تدرس|على|منصة)/gi, ' ');
    t = t.replace(/\(teams\)/gi, ' ');

    // نزيل الأحرف المنفردة (ح ن ث ر خ) — لكن بحذر
    // نزيل حرف واحد فقط لو حواليه مسافات
    t = t.replace(/(?:^|\s)([حنثرخجس])(?:\s|$)/g, ' ');

    // نزيل الرموز
    t = t.replace(/[\-–—\.\|،,;·•_]+/g, ' ');
    t = t.replace(/[\u060C\u061B\u061F]/g, ' ');

    // نزيل الأرقام الصغيرة (1 2 0 3) — لكن (1) محمية بـ §
    t = t.replace(/\b\d{1,2}\b/g, ' ');

    // نرجّع (1)، (2)
    t = t.replace(/§(\d+)§/g, '($1)');

    // نضغط المسافات
    t = t.replace(/\s+/g, ' ').trim();

    // نزيل أقواس فارغة
    t = t.replace(/\(\s*\)/g, ' ').trim();

    return t;
  }

  /* ============ 7. parseTable — يجمع من أسطر متعددة ============ */
  function hasTime(s){
    return /\d{1,2}\s*[,:.]\s*\d{2}\s*[\-–—~]\s*\d{1,2}\s*[,:.]\s*\d{2}/.test(String(s||''));
  }
  function hasCode(s){
    return /\b\d{6,11}\b/.test(String(s||''));
  }

  function parseTable(raw){
    var text = cleanText(raw);
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var entries = [];

    for (var i = 0; i < lines.length; i++){
      var line = lines[i];

      // لازم هذا السطر فيه وقت
      if (!hasTime(line)) continue;

      // نبدأ بالخط الحالي
      var combined = line;

      // نضيف السطر السابق لو ما فيه وقت وما فيه كود (يعني جزء من نفس الصف)
      if (i > 0){
        var prev = lines[i-1];
        if (!hasTime(prev) && !hasCode(prev)){
          combined = prev + ' ' + combined;
        }
      }

      // نضيف السطر التالي لو ما فيه وقت (يعني قد يكون تكملة الاسم أو القاعة)
      // نتحقق: لو السطر التالي فيه وقت ثاني — لا نضيفه
      if (i < lines.length - 1){
        var next = lines[i+1];
        if (!hasTime(next)){
          combined = combined + ' ' + next;
          // جرّب سطر ثالث لو ما فيه وقت
          if (i < lines.length - 2 && !hasTime(lines[i+2])){
            // لكن لا تضم أكثر من سطرين إضافيين (لتجنب امتصاص صفوف ثانية)
            // نضيفه فقط لو ما فيه كود
            if(!hasCode(lines[i+2])){
              combined = combined + ' ' + lines[i+2];
            }
          }
        }
      }

      var code = extractCode(combined);
      var days = extractDays(combined);
      var time = extractTimeRange(combined);
      var room = extractRoom(combined);
      var name = extractName(combined, code);

      // تجاهل لو ما في اسم
      if (!name || name.length < 3) continue;

      // تجاهل المكرر
      var dup = false;
      for (var k = 0; k < entries.length; k++){
        if (entries[k].name === name && time && entries[k].time && entries[k].time.start === time.start){
          dup = true; break;
        }
      }
      if (dup) continue;

      entries.push({
        code: code,
        name: name,
        days: days,
        time: time,
        room: room,
        hours: 3,
        raw: combined
      });
    }

    return entries;
  }

  /* ============ 8. matchWithDB ============ */
  function matchWithDB(entry){
    var DB = window.COURSES_DB || {};
    var keys = Object.keys(DB);

    // 1) بالاسم الكامل
    var eName = norm(entry.name);
    if(eName){
      for (var j = 0; j < keys.length; j++){
        if (norm(keys[j]) === eName){
          return { matched: true, dbKey: keys[j], info: DB[keys[j]], matchedBy: 'name-exact', confidence: 1.0 };
        }
      }
    }

    // 2) بالكود
    var eCode = String(entry.code || '').replace(/^0+/, '');
    if (eCode){
      for (var i = 0; i < keys.length; i++){
        var dbCode = String(DB[keys[i]].code || '').replace(/^0+/, '');
        if (dbCode === eCode){
          return { matched: true, dbKey: keys[i], info: DB[keys[i]], matchedBy: 'code', confidence: 1.0 };
        }
      }
    }

    // 3) fuzzy قوي — token overlap مع substring
    if(!eName) return { matched: false, confidence: 0 };
    var best = null, bestScore = 0;
    var eTokens = eName.split(/\s+/).filter(function(t){ return t.length > 2; });
    keys.forEach(function(k){
      var kNorm = norm(k);
      var kTokens = kNorm.split(/\s+/).filter(function(t){ return t.length > 2; });
      if (!kTokens.length || !eTokens.length) return;
      var matched = 0;
      eTokens.forEach(function(t){
        var found = kTokens.some(function(kt){
          if (kt === t) return true;
          if (kt.indexOf(t) > -1 || t.indexOf(kt) > -1) return true;
          return false;
        });
        if (found) matched++;
      });
      var score = matched / Math.max(eTokens.length, kTokens.length);
      if (score > bestScore && score >= 0.5){ bestScore = score; best = k; }
    });

    if (best){
      return { matched: true, dbKey: best, info: DB[best], matchedBy: 'name-fuzzy', confidence: bestScore };
    }
    return { matched: false, confidence: 0 };
  }

  /* ============ 9. applyAll ============ */
  function applyAll(entries){
    var sp = space();
    if (!sp.timetable) sp.timetable = {};
    if (!sp.courses) sp.courses = [];
    if (!sp.attendance) sp.attendance = {};
    if (!sp.completedCourses) sp.completedCourses = [];

    var stats = {
      total: entries.length,
      addedToTimetable: 0, addedToCourses: 0, addedToAttendance: 0,
      matched: 0, unmatched: [], matchedList: [], skipped: []
    };

    entries.forEach(function(entry){
      var match = matchWithDB(entry);
      entry._match = match;
      var finalName = match.matched ? match.dbKey : entry.name;
      entry._finalName = finalName;

      var hasDays = entry.days && entry.days.length > 0;
      var hasTime = entry.time && entry.time.start;

      if (!hasDays || !hasTime){
        var reason = !hasDays && !hasTime ? 'ما في أيام ولا وقت' :
                     !hasDays ? 'ما في أيام (ح ن ث ر خ)' : 'ما في وقت';
        stats.skipped.push({ code: entry.code, name: finalName || entry.name, reason: reason });
      }

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
      if (hasDays && hasTime){
        entry.days.forEach(function(day){
          var key = day + '-' + entry.time.start;
          if (!sp.timetable[key]){
            sp.timetable[key] = {
              name: finalName || entry.name,
              room: entry.room || '',
              instructor: ''
            };
            stats.addedToTimetable++;
          }
        });
      }

      // موادي
      var courseName = finalName || entry.name;
      if (match.matched && courseName){
        var exists = sp.courses.some(function(c){ return c.name === courseName; });
        var isCompleted = sp.completedCourses.indexOf(courseName) > -1;
        if (!exists && !isCompleted){
          var DBinfo = match.info || {};
          sp.courses.push({
            id: uid(), name: courseName,
            code: entry.code || DBinfo.code || '',
            hours: entry.hours || DBinfo.h || 3,
            instructor: '', room: entry.room || ''
          });
          stats.addedToCourses++;
        }
        if (!sp.attendance[courseName]){
          sp.attendance[courseName] = { present: 0, absent: 0 };
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

  /* ============ 10. showReport ============ */
  function showReport(entries, stats){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';

    var html = '<div class="modal" style="max-width:720px;padding:22px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    html += '<h3 style="margin:0">📊 تقرير التحليل</h3>';
    html += '<button class="btn btn-sm btn-ghost" id="ocrSmartClose">✕</button></div>';

    // Stats
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:16px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--cyan)">' + stats.total + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">صفوف</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--green)">' + stats.addedToTimetable + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">محاضرات</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--amber)">' + stats.addedToCourses + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">مواد</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--purple)">' + stats.addedToAttendance + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">حضور</div></div>';
    html += '</div>';

    // تفاصيل كل صف
    html += '<h4 style="font-size:.9rem;color:var(--cyan);margin-bottom:10px">📋 تفاصيل الصفوف (' + entries.length + ')</h4>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;max-height:420px;overflow-y:auto">';
    entries.forEach(function(entry){
      var m = entry._match || {};
      var finalName = entry._finalName || entry.name || '(بدون اسم)';
      var hasDays = entry.days && entry.days.length > 0;
      var hasTime = entry.time && entry.time.start;

      var color, status, reasons = [];
      if (!m.matched){
        color = 'var(--red)'; status = '❌ ما تطابقت';
        reasons.push('الكود: ' + (entry.code || '—'));
        reasons.push('الاسم المستخرج: "' + entry.name + '"');
        reasons.push('ما لقيت مادة مطابقة بالخطة');
      } else if (!hasDays && !hasTime){
        color = 'var(--amber)'; status = '⚠️ ناقص أيام ووقت';
        reasons.push('ما في أيام ولا وقت');
        reasons.push('انضافت لموادي فقط');
      } else if (!hasDays){
        color = 'var(--amber)'; status = '⚠️ ناقص أيام';
        reasons.push('ما في أحرف أيام');
      } else if (!hasTime){
        color = 'var(--amber)'; status = '⚠️ ناقص وقت';
        reasons.push('ما في وقت');
      } else {
        color = 'var(--green)'; status = '✅ نجح';
        var dayNames = entry.days.map(function(d){
          return {Sun:'أحد',Mon:'اثنين',Tue:'ثلاثاء',Wed:'أربعاء',Thu:'خميس',Fri:'جمعة',Sat:'سبت'}[d] || d;
        }).join('، ');
        reasons.push(dayNames + ' · ' + entry.time.start + '→' + entry.time.end);
        if (entry.room) reasons.push('قاعة: ' + entry.room);
      }

      html += '<div style="padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-left:3px solid ' + color + ';border-radius:8px;font-size:.82rem">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">';
      html += '<span style="font-weight:700;color:' + color + '">' + status + ' — ' + esc(finalName) + '</span>';
      if (m.matched) html += '<span style="font-size:.62rem;padding:2px 6px;border-radius:5px;background:rgba(52,211,153,.15);color:var(--green);font-weight:700">' + (m.matchedBy||'') + '</span>';
      html += '</div>';
      html += '<div style="font-size:.68rem;color:var(--muted2);font-family:monospace;margin-bottom:4px">كود: ' + esc(entry.code || '—') + '</div>';
      html += '<ul style="margin:0;padding-right:16px;color:var(--muted);font-size:.75rem;line-height:1.6">';
      reasons.forEach(function(r){ html += '<li>' + esc(r) + '</li>'; });
      html += '</ul>';
      // عرض النص الأصلي (مختصر)
      html += '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:.7rem;color:var(--muted2)">عرض النص الأصلي</summary>';
      html += '<pre style="direction:ltr;text-align:left;background:rgba(0,0,0,.3);padding:6px;border-radius:6px;font-size:.65rem;margin-top:4px;overflow-x:auto;white-space:pre-wrap">' + esc(entry.raw || '') + '</pre></details>';
      html += '</div>';
    });
    html += '</div>';

    // تنبيه تعليمي
    if (stats.skipped.length || stats.unmatched.length){
      html += '<div style="margin-top:14px;padding:12px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:10px;font-size:.78rem;line-height:1.9">';
      html += '<b style="color:var(--amber)">💡 الصيغة المثالية:</b><br>';
      html += '<code style="direction:ltr;display:block;background:rgba(0,0,0,.3);padding:8px 10px;border-radius:6px;font-size:.72rem;margin-top:6px;white-space:pre-wrap;text-align:left">110102101 فيزياء عامة (1) 1 0 ح ث خ 10:30-11:30 ق.ب 105\n110400102 برمجة الحاسوب 2 1 ن ر 08:30-10:00 ح.ب 201</code>';
      html += '<div style="margin-top:8px;font-size:.72rem;color:var(--muted)">كل صف يجب أن يحتوي على: <b>كود</b> + <b>اسم</b> + <b>أحرف أيام</b> + <b>وقت</b></div>';
      html += '</div>';
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
      if (!confirm('إزالة المحاضرات اللي انضافت من التحليل؟')) return;
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

  /* ============ 11. install ============ */
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
              toast('⚠️ ما لقيت صفوف صالحة', 'warn', 4000);
              return;
            }
            var stats = applyAll(entries);
            showReport(entries, stats);
            toast('✅ ' + stats.addedToTimetable + ' محاضرة أُضيفت', 'success', 3000);
          } catch(e){
            console.error('OCR Smart error:', e);
            toast('فشل: ' + (e.message || e), 'warn', 4000);
          }
        });
        clearInterval(timer);
      }
      if (tries > 30) clearInterval(timer);
    }, 1000);
  }

  /* ============ 12. Public API ============ */
  window.ocrSmart = {
    parse: parseTable,
    apply: applyAll,
    extractDays: extractDays,
    extractTime: extractTimeRange,
    matchWithDB: matchWithDB
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
      console.log('  مطابقة:', match.matched ? '✅ ' + match.dbKey + ' (' + match.matchedBy + ')' : '❌');
    });
    return entries;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📸 OCR Smart v4 loaded');
})();