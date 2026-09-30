/* ============================================================
   📸 ocr-smart.js v3 — Parser قوي يستوعب كل الصيغ
   - أيام: ح ن ث ر خ · كاملة عربي · إنجليزي
   - أوقات: 9:30-10:30 · 09:30 10:30 · 0930-1030 · 9.30
   - صفوف متعددة الأسطر
   - تقرير واضح: ليش كل صف نجح أو فشل
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

  /* ============ 1. جدول الأيام ============ */
  var DAY_LETTER = { 'ح':'Sun', 'ن':'Mon', 'ث':'Tue', 'ر':'Wed', 'خ':'Thu', 'ج':'Fri', 'س':'Sat' };

  var DAY_FULL = {
    'الاحد':'Sun','الأحد':'Sun','احد':'Sun',
    'الاثنين':'Mon','الاتنين':'Mon','اثنين':'Mon',
    'الثلاثاء':'Tue','ثلاثاء':'Tue',
    'الاربعاء':'Wed','الأربعاء':'Wed','اربعاء':'Wed',
    'الخميس':'Thu','خميس':'Thu',
    'الجمعه':'Fri','الجمعة':'Fri','جمعه':'Fri',
    'السبت':'Sat','سبت':'Sat',
    'sunday':'Sun','sun':'Sun',
    'monday':'Mon','mon':'Mon',
    'tuesday':'Tue','tue':'Tue','tues':'Tue',
    'wednesday':'Wed','wed':'Wed',
    'thursday':'Thu','thu':'Thu','thur':'Thu',
    'friday':'Fri','fri':'Fri',
    'saturday':'Sat','sat':'Sat'
  };

  function extractDays(text){
    var days = [];
    var t = String(text || '');
    var tNorm = norm(t).toLowerCase();

    // 1) الأحرف العربية المفردة (ح ن ث ر خ) — مع مراعاة وجودها ككلمة مستقلة
    var letterRe = /(?:^|[\s،,؛;·•\-–—\|/])([حنثرخجس])(?=[\s،,؛;·•\-–—\|/]|$|\d)/g;
    var m;
    while ((m = letterRe.exec(t)) !== null){
      var dayEn = DAY_LETTER[m[1]];
      if (dayEn && days.indexOf(dayEn) === -1) days.push(dayEn);
    }

    // 2) الأسماء الكاملة (عربي/إنجليزي)
    Object.keys(DAY_FULL).forEach(function(name){
      var nameNorm = norm(name).toLowerCase();
      if(!nameNorm) return;
      // نبحث بحدود كلمة (بداية أو مسافة قبل، ومسافة أو نهاية بعد)
      var re = new RegExp('(?:^|[\\s،,؛;·•\\-–—\\|/])' + nameNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[\\s،,؛;·•\\-–—\\|/]|$)', 'i');
      if(re.test(tNorm)){
        var dayEn2 = DAY_FULL[name];
        if(dayEn2 && days.indexOf(dayEn2) === -1) days.push(dayEn2);
      }
    });

    return days;
  }

  /* ============ 2. جدول الأوقات — كل الصيغ ============ */
  function extractTimeRange(text){
    var t = String(text || '');
    // إصلاح الأرقام العربية
    t = t.replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){ return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48); });

    // صيغة 1: 09:30-10:30 أو 9:30 – 10:30 أو 09:30 10:30
    var m = t.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*[\-–—\s]\s*(\d{1,2})\s*[:.]\s*(\d{2})/);
    if(m){
      var h1 = parseInt(m[1],10), m1 = parseInt(m[2],10);
      var h2 = parseInt(m[3],10), m2 = parseInt(m[4],10);
      if(h1<=23 && h2<=23 && m1<=59 && m2<=59){
        return {
          start: String(h1).padStart(2,'0')+':'+String(m1).padStart(2,'0'),
          end:   String(h2).padStart(2,'0')+':'+String(m2).padStart(2,'0')
        };
      }
    }

    // صيغة 2: 0930-1030 (بدون :)
    m = t.match(/\b(\d{3,4})\s*[\-–—]\s*(\d{3,4})\b/);
    if(m){
      var s1 = m[1], s2 = m[2];
      if(s1.length === 3){ s1 = '0' + s1; }
      if(s2.length === 3){ s2 = '0' + s2; }
      var hh1 = parseInt(s1.slice(0,2),10), mm1 = parseInt(s1.slice(2),10);
      var hh2 = parseInt(s2.slice(0,2),10), mm2 = parseInt(s2.slice(2),10);
      if(hh1<=23 && hh2<=23 && mm1<=59 && mm2<=59){
        return {
          start: String(hh1).padStart(2,'0')+':'+String(mm1).padStart(2,'0'),
          end:   String(hh2).padStart(2,'0')+':'+String(mm2).padStart(2,'0')
        };
      }
    }

    // صيغة 3: 9:30 فقط (بدون نهاية) — نستخدم وقت افتراضي حسب بداية
    m = t.match(/\b(\d{1,2})\s*[:.]\s*(\d{2})\b/);
    if(m){
      var h1b = parseInt(m[1],10), m1b = parseInt(m[2],10);
      if(h1b <= 23 && m1b <= 59 && h1b >= 7 && h1b <= 20){
        // نضع نهاية بعد ساعة
        var hh1b = h1b + 1;
        return {
          start: String(h1b).padStart(2,'0')+':'+String(m1b).padStart(2,'0'),
          end:   String(hh1b).padStart(2,'0')+':'+String(m1b).padStart(2,'0')
        };
      }
    }

    return null;
  }

  /* ============ 3. استخراج الكود ============ */
  function extractCode(text){
    // نبحث عن أي رقم بين 6-11 خانة
    var m = String(text||'').match(/\b(\d{6,11})\b/);
    return m ? m[1] : null;
  }

  /* ============ 4. استخراج القاعة ============ */
  function extractRoom(text){
    var patterns = [
      /(?:قاعة|قاعه|ق\.)\s*([A-Za-z0-9\u0600-\u06FF\-]+)/i,
      /(?:ح\.?\s*ب)\s*(\d+)/,
      /(?:م\.?\s*غ)\s*(\d+)/,
      /(?:م\.?\s*ب)\s*(\d+)/,
      /(?:room|hall)\s*([A-Za-z0-9\-]+)/i,
      /(?:مبنى|مبنه)\s+[\u0600-\u06FF]+\s*([A-Za-z0-9\-]+)/
    ];
    for (var i = 0; i < patterns.length; i++){
      var m = text.match(patterns[i]);
      if (m && m[1]) return m[1];
    }
    return '';
  }

  /* ============ 5. استخراج الساعات ============ */
  function extractHours(text){
    var m = String(text||'').match(/(\d+)\s*(?:ساعات?|hours?)/i);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  /* ============ 6. تنظيف النص ============ */
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

  /* ============ 7. تقسيم الصفوف — ذكي متعدد الأسطر ============ */
  function splitRows(text){
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var rows = [];
    var current = null;

    lines.forEach(function(line){
      var code = extractCode(line);
      var startsWithCode = code && line.indexOf(code) <= 5;

      if (startsWithCode){
        // سطر جديد
        if (current) rows.push(current);
        current = line;
      } else if (current){
        // نلحق بالسطر الحالي
        current += ' ' + line;
      } else {
        // سطر بدون كود وما في سطر مفتوح — نتجاهله
      }
    });
    if (current) rows.push(current);
    return rows;
  }

  /* ============ 8. parseTable — الدالة الرئيسية ============ */
  function parseTable(raw){
    var text = cleanText(raw);
    var rows = splitRows(text);
    var entries = [];

    rows.forEach(function(rowText){
      var code = extractCode(rowText);
      if (!code) return;

      var days = extractDays(rowText);
      var time = extractTimeRange(rowText);
      var room = extractRoom(rowText);
      var hours = extractHours(rowText);

      // استخراج الاسم: كل ما قبل الرقم الأول الكبير من الأرقام الصغيرة
      var withoutCode = rowText.replace(code, '').trim();
      // نزيل الأرقام الصغيرة في النهاية والأيام والأوقات
      var nameText = withoutCode;

      // نزيل الأيام (حروف عربية)
      nameText = nameText.replace(/(?:^|[\s،,\-])([حنثرخجس])(?=[\s،,\-]|$|\d)/g, ' ');
      // نزيل الأسماء الكاملة
      Object.keys(DAY_FULL).forEach(function(dn){
        nameText = nameText.replace(new RegExp('\\b' + dn + '\\b', 'gi'), ' ');
      });
      // نزيل الأوقات
      nameText = nameText.replace(/\d{1,2}\s*[:.]\s*\d{2}\s*[\-–—]?\s*\d{0,2}\s*[:.]?\s*\d{0,2}/g, ' ');
      // نزيل القاعة
      nameText = nameText.replace(/(?:قاعة|قاعه|ق\.|ح\.?\s*ب|م\.?\s*غ|م\.?\s*ب|room|hall)\s*[A-Za-z0-9\-]+/gi, ' ');
      // نزيل الأرقام الصغيرة المنفردة (1 2 0 3)
      nameText = nameText.replace(/\b\d{1,2}\b/g, ' ');
      // نزيل الرموز
      nameText = nameText.replace(/[\-–—\.\|،,;·•]+/g, ' ');
      // نضغط المسافات
      nameText = nameText.replace(/\s+/g, ' ').trim();

      var entry = {
        code: code,
        name: nameText,
        days: days,
        time: time,
        room: room,
        hours: hours || 3,
        raw: rowText
      };
      entries.push(entry);
    });

    return entries;
  }

  /* ============ 9. matchWithDB — مع aliases ============ */
  function matchWithDB(entry){
    var DB = window.COURSES_DB || {};
    var keys = Object.keys(DB);

    // 1) تطبيع الكود
    var eCode = String(entry.code || '').replace(/^0+/, '');
    if (eCode){
      // بالكود الرئيسي
      for (var i = 0; i < keys.length; i++){
        var dbCode = String(DB[keys[i]].code || '').replace(/^0+/, '');
        if (dbCode === eCode){
          return { matched: true, dbKey: keys[i], info: DB[keys[i]], matchedBy: 'code', confidence: 1.0 };
        }
      }
      // بالـ aliases
      for (var i2 = 0; i2 < keys.length; i2++){
        var aliases = DB[keys[i2]].aliases || [];
        for (var a = 0; a < aliases.length; a++){
          if (String(aliases[a]).replace(/^0+/, '') === eCode){
            return { matched: true, dbKey: keys[i2], info: DB[keys[i2]], matchedBy: 'code-alias', confidence: 0.98 };
          }
        }
      }
    }

    // 2) بالاسم الكامل
    var eName = norm(entry.name);
    if(!eName) return { matched: false, confidence: 0 };
    for (var j = 0; j < keys.length; j++){
      if (norm(keys[j]) === eName){
        return { matched: true, dbKey: keys[j], info: DB[keys[j]], matchedBy: 'name-exact', confidence: 0.95 };
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
      if (score > bestScore && score >= 0.6){ bestScore = score; best = k; }
    });

    if (best){
      return { matched: true, dbKey: best, info: DB[best], matchedBy: 'name-fuzzy', confidence: bestScore };
    }
    return { matched: false, confidence: 0 };
  }

  /* ============ 10. applyAll ============ */
  function applyAll(entries){
    var sp = space();
    if (!sp.timetable) sp.timetable = {};
    if (!sp.courses) sp.courses = [];
    if (!sp.attendance) sp.attendance = {};
    if (!sp.completedCourses) sp.completedCourses = [];

    var stats = {
      total: entries.length,
      addedToTimetable: 0, addedToCourses: 0, addedToAttendance: 0,
      matched: 0,
      unmatched: [], matchedList: [],
      skipped: [] // الصفوف اللي ما فيها أيام/وقت
    };

    entries.forEach(function(entry){
      var match = matchWithDB(entry);
      entry._match = match;
      var finalName = match.matched ? match.dbKey : entry.name;
      entry._finalName = finalName;

      // هل في أيام ووقت؟
      var hasDays = entry.days && entry.days.length > 0;
      var hasTime = entry.time && entry.time.start;

      if (!hasDays || !hasTime){
        stats.skipped.push({
          code: entry.code,
          name: finalName || entry.name,
          reason: !hasDays && !hasTime ? 'ما في أيام ولا وقت' :
                  !hasDays ? 'ما في أيام (ح ن ث ر خ)' : 'ما في وقت (09:30-10:30)'
        });
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

      // جدول
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

      // موادي (فقط لو تطابق + له أيام أو وقت)
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

  /* ============ 11. التقرير ============ */
  function showReport(entries, stats){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';

    var html = '<div class="modal" style="max-width:700px;padding:22px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    html += '<h3 style="margin:0">📊 تقرير التحليل</h3>';
    html += '<button class="btn btn-sm btn-ghost" id="ocrSmartClose">✕</button></div>';

    // Stats
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:16px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--cyan)">' + stats.total + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">صفوف</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--green)">' + stats.addedToTimetable + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">محاضرات</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--amber)">' + stats.addedToCourses + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">مواد</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.4rem;font-weight:800;color:var(--purple)">' + stats.addedToAttendance + '</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px">حضور</div></div>';
    html += '</div>';

    // تفاصيل كل صف
    html += '<h4 style="font-size:.9rem;color:var(--cyan);margin-bottom:10px">📋 تفاصيل الصفوف</h4>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto">';
    entries.forEach(function(entry){
      var m = entry._match || {};
      var finalName = entry._finalName || entry.name || '(بدون اسم)';
      var hasDays = entry.days && entry.days.length > 0;
      var hasTime = entry.time && entry.time.start;

      var status, color, reasons = [];
      if (!m.matched){
        color = 'var(--red)'; status = '❌ ما تطابقت';
        reasons.push('الكود ما موجود بالخطة');
        reasons.push('الاسم ما يشبه أي مادة');
      } else if (!hasDays && !hasTime){
        color = 'var(--amber)'; status = '⚠️ ناقص أيام ووقت';
        reasons.push('ما في أيام ولا وقت');
        reasons.push('ما رح تنضاف للجدول، بس لموادي');
      } else if (!hasDays){
        color = 'var(--amber)'; status = '⚠️ ناقص أيام';
        reasons.push('ما في أحرف أيام (ح ن ث ر خ)');
      } else if (!hasTime){
        color = 'var(--amber)'; status = '⚠️ ناقص وقت';
        reasons.push('ما في وقت (09:30-10:30)');
      } else {
        color = 'var(--green)'; status = '✅ نجح';
        reasons.push(entry.days.length + ' يوم · وقت ' + entry.time.start + '–' + entry.time.end);
        if (entry.room) reasons.push('قاعة: ' + entry.room);
      }

      html += '<div style="padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-left:3px solid ' + color + ';border-radius:8px;font-size:.82rem">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">';
      html += '<span style="font-weight:700;color:' + color + '">' + status + ' — ' + esc(finalName) + '</span>';
      if (m.matched) html += '<span style="font-size:.65rem;padding:2px 6px;border-radius:5px;background:rgba(52,211,153,.15);color:var(--green);font-weight:700">' + (m.matchedBy||'') + '</span>';
      html += '</div>';
      html += '<div style="font-size:.68rem;color:var(--muted2);font-family:monospace;margin-bottom:4px">كود: ' + esc(entry.code) + '</div>';
      html += '<ul style="margin:0;padding-right:16px;color:var(--muted);font-size:.75rem;line-height:1.6">';
      reasons.forEach(function(r){ html += '<li>' + esc(r) + '</li>'; });
      html += '</ul></div>';
    });
    html += '</div>';

    // تنبيه تعليمي
    if (stats.skipped.length || stats.unmatched.length){
      html += '<div style="margin-top:14px;padding:12px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:10px;font-size:.78rem;line-height:1.9">';
      html += '<b style="color:var(--amber)">💡 الصيغة المطلوبة:</b><br>';
      html += '<code style="direction:ltr;display:block;background:rgba(0,0,0,.3);padding:6px 10px;border-radius:6px;font-size:.72rem;margin-top:6px;white-space:pre-wrap">110102101 فيزياء عامة (1) 1 0 ح ث 09:30-10:30 ق.ب 104\n110400102 برمجة الحاسوب 2 1 ن ر 11:00-12:30 ح.ب 201</code>';
      html += '<div style="margin-top:8px;font-size:.72rem;color:var(--muted)">كل صف لازم يحتوي: <b>كود</b> + <b>اسم</b> + <b>أحرف أيام</b> (ح ن ث ر خ) + <b>وقت</b> (09:30-10:30)</div>';
      html += '</div>';
    }

    html += '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">';
    html += '<button class="btn btn-sm btn-ghost" id="ocrSmartUndo">↺ تراجع عن الجدول</button>';
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
      toast('✅ تم التراجع عن الجدول', 'success');
      close();
    };
  }

  /* ============ 12. install ============ */
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
            var msg = 'تم! ' + stats.addedToTimetable + ' محاضرة';
            if (stats.skipped.length) msg += ' · ' + stats.skipped.length + ' صف ناقص';
            toast('✅ ' + msg, 'success', 3000);
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

  /* ============ 13. Public API ============ */
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
    entries.forEach(function(e){
      console.log('  كود:', e.code, '| اسم:', e.name, '| أيام:', e.days, '| وقت:', e.time, '| قاعة:', e.room);
    });
    return entries;
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📸 OCR Smart v3 loaded — يستوعب كل الصيغ');
})();