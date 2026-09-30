/* ============================================================
   📥 timetable-importer.js v3 — محلل جدول الجامعة الهاشمية
   ✅ يفهم الصيغة الرسمية 100%:
      - وقت بصيغة HH,MM - HH,MM (فاصلة)
      - قاعة بصيغة ح.ب / 104 (مسافة حول /)
      - وقت معكوس (10,00 - 08,30)
      - اسم مادة على سطرين
      - شعب نظرية/عملية قبل الأيام
      - وصف "المادة تدرس..." و"على منصة..."
   ============================================================ */
(function(){
  'use strict';

  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }
  function getSpace(){ return window.space || {}; }
  function saveSpace(){ if(typeof window.saveSpace === 'function') window.saveSpace(); }
  function uid(){ return window.uid ? window.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function p2(n){ return String(n).padStart(2,'0'); }

  /* ============================================================
     ثوابت
     ============================================================ */
  var DAY_LETTER = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };
  var DAY_SHORT = { Sun:'ح', Mon:'ن', Tue:'ث', Wed:'ر', Thu:'خ', Fri:'ج', Sat:'س' };
  var DAY_KEYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAY_NAMES_AR = { Sun:'الأحد', Mon:'الاثنين', Tue:'الثلاثاء', Wed:'الأربعاء', Thu:'الخميس', Fri:'الجمعة', Sat:'السبت' };

  /* ============================================================
     1) تطبيع النص
     ============================================================ */
  function fixDigits(t){
    return String(t||'').replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }

  function normalize(raw){
    var t = fixDigits(String(raw || ''));
    // ✅ الأهم: نحوّل الفاصلة/النقطة داخل الأوقات إلى نقطتين
    // مثال: 09,30 → 09:30
    t = t.replace(/(\d{1,2})\s*[,.]\s*(\d{2})/g, '$1:$2');
    // إزالة الرموز الغريبة
    t = t.replace(/[|¦]/g, ' ');
    t = t.replace(/[\u200F\u200E\u200B]/g, '');
    // توحيد الأسطر
    t = t.replace(/\r\n?/g, '\n');
    return t;
  }

  /* ============================================================
     2) استخراج الكود
     ============================================================ */
  function findCodes(text){
    var re = /\b(\d{6,11})\b/g;
    var m, out = [];
    while((m = re.exec(text)) !== null){
      // تجاهل لو الرقم جزء من وقت (مثل 0930 بين 09:30-10:30)
      var before = text.substring(Math.max(0, m.index - 3), m.index);
      var after = text.substring(m.index + m[1].length, m.index + m[1].length + 3);
      if(/[:.\-]\s*$/.test(before) || /^\s*[:.\-]/.test(after)) continue;
      out.push({ code: m[1], index: m.index, end: m.index + m[1].length });
    }
    return out;
  }

  /* ============================================================
     3) استخراج الوقت — يدعم الفاصلة والوقت المعكوس
     ============================================================ */
  function extractTime(text){
    // الصيغة الأساسية: HH:MM - HH:MM
    var m = text.match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/);
    if(m){
      var h1 = parseInt(m[1],10), mm1 = parseInt(m[2],10);
      var h2 = parseInt(m[3],10), mm2 = parseInt(m[4],10);
      if(h1 <= 23 && h2 <= 23 && mm1 <= 59 && mm2 <= 59){
        // ✅ إصلاح الوقت المعكوس: لو h1 > h2، بدّل
        var wasReversed = false;
        if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
          var th = h1, tm = mm1; h1 = h2; mm1 = mm2; h2 = th; mm2 = tm;
          wasReversed = true;
        }
        return {
          start: p2(h1)+':'+p2(mm1),
          end:   p2(h2)+':'+p2(mm2),
          match: m[0],
          reversed: wasReversed
        };
      }
    }
    return null;
  }

  /* ============================================================
     4) استخراج الأيام — من المنطقة قبل الوقت
     ============================================================ */
  function extractDays(text, timeMatch){
    var zone = text;
    if(timeMatch){
      var idx = text.indexOf(timeMatch);
      if(idx > 0) zone = text.substring(0, idx);
    }
    // نبحث عن آخر تسلسل من [حنثرخجس]
    var re = /[حنثرخجس]+/g;
    var m, last = null;
    while((m = re.exec(zone)) !== null){
      var seq = m[0];
      if(seq.length < 1 || seq.length > 6) continue;
      var before = zone[m.index - 1] || '';
      var after = zone[m.index + seq.length] || '';
      if(/[\u0600-\u06FF]/.test(before) || /[\u0600-\u06FF]/.test(after)) continue;
      last = seq;
    }
    if(!last) return [];
    var days = [];
    for(var i = 0; i < last.length; i++){
      var d = DAY_LETTER[last[i]];
      if(d && days.indexOf(d) === -1) days.push(d);
    }
    return days;
  }

  /* ============================================================
     5) استخراج القاعة — يدعم "ح.ب / 104" و "م.غ / 213"
     ============================================================ */
  function extractRoom(text){
    // النمط: حرف.حرف (مسافات؟) / (مسافات؟) رقم
    // أمثلة: "ح.ب / 104" — "م.غ / 213" — "ح.ب/105" — "م.ب 302"
    var patterns = [
      // ح.ب / 104
      /([حمم][\s.]*[بغبجمع][\s.]*)\s*\/\s*(\d+)/,
      // ح.ب 104 (بدون /)
      /([حمم][\s.]*[بغبجمع][\s.]*)\s+(\d+)/,
      // قاعة 104
      /(?:قاعة|قاعه|ق\.)\s*([A-Za-z0-9\u0600-\u06FF\-]+)/i,
      // Room 104
      /(?:room|hall|lab|Rm)\s*([A-Za-z0-9\-]+)/i
    ];
    for(var i = 0; i < patterns.length; i++){
      var m = text.match(patterns[i]);
      if(m){
        if(m[2] !== undefined){
          // ح.ب + رقم
          return m[1].replace(/\s+/g, ' ').trim() + ' ' + m[2];
        }
        return m[0].replace(/\s+/g, ' ').trim();
      }
    }
    return '';
  }

  /* ============================================================
     6) استخراج الساعات (رقم وحيد في النهاية)
     ============================================================ */
  function extractHours(text, timeMatch){
    var t = text;
    if(timeMatch) t = t.replace(timeMatch, ' ');
    // رقم وحيد في نهاية النص (1-6)
    var m = t.match(/\s(\d)\s*$/);
    if(m){
      var h = parseInt(m[1],10);
      if(h >= 1 && h <= 6) return h;
    }
    // أو رقم بين مسافتين بعد القاعة
    return 3;
  }

  /* ============================================================
     7) تنظيف الاسم — إزالة كل الزوائد
     ============================================================ */
  function cleanName(text, code, time, days, room){
    var n = text;
    if(code) n = n.replace(code, ' ');

    // احذف الوقت
    if(time && time.match) n = n.replace(time.match, ' ');

    // احذف الأيام (ح ن ث ر خ فقط، مع مسافات أو شرطات)
    n = n.replace(/(?:^|[\s\/|\\\-–—,؛;])[حنثرخجس](?:[\s\/|\\\-–—,؛;]+[حنثرخجس]){0,5}(?=[\s\/|\\\-–—,؛;]|$)/g, ' ');

    // احذف القاعة
    if(room){
      // احذف كل الأشكال المحتملة
      n = n.replace(/[حمم][\s.]*[بغبجمع][\s.]*\s*\/?\s*\d+/g, ' ');
      n = n.replace(new RegExp(room.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
    }

    // احذف الوصف المدرسي
    n = n.replace(/المادة\s+تدرس[^\n]*/gi, ' ');
    n = n.replace(/الماده\s+تدرس[^\n]*/gi, ' ');
    n = n.replace(/تدرس\s+بشكل[^\n]*/gi, ' ');
    n = n.replace(/على\s+منصة[^\n]*/gi, ' ');
    n = n.replace(/على\s+منصه[^\n]*/gi, ' ');
    n = n.replace(/\(?\s*مايكروسوفت\s*\)?/gi, ' ');
    n = n.replace(/\(?\s*teams\s*\)?/gi, ' ');
    n = n.replace(/\(?\s*Microsoft\s*\)?/gi, ' ');
    n = n.replace(/(?:مدمج|مدمجا|وجاهي|وجاهيا|حضوريا|افتراضي|عن\s+بعد|عن\s+بعد)/g, ' ');
    n = n.replace(/في\s+(?:مبنى|مبنه|مجمع|مجمّع|قاعات)\s+[^\n\/,،؛]+/gi, ' ');

    // احذف أرقام الشعبة (نظري/عملي): رقم وحيد أو رقمين متتاليين قبل الأيام
    n = n.replace(/\s+\d{1,3}\s+\d{1,2}\s+/g, ' ');

    // احذف عدد الساعات (رقم وحيد في النهاية)
    n = n.replace(/\s+\d\s*$/g, ' ');

    // احذف الشرطات المائلة مع الحرص (لأن الاسم قد يحتوي / مثل "لغة عربية / استدراكية")
    // نحذف فقط لو / معزولة بدون سياق
    n = n.replace(/^\s*[\/|\\]\s*/, ' ');
    n = n.replace(/\s*[\/|\\]\s*$/, ' ');

    // نظّف
    n = n.replace(/\s+/g, ' ').trim();
    return n;
  }

  /* ============================================================
     8) التحليل الرئيسي — صف بصف
     ============================================================ */
  function parseRows(raw, debug){
    var log = debug ? console.log.bind(console, '[TII]') : function(){};
    var text = normalize(raw);
    log('📄 النص المطبّع:', text.substring(0, 300));

    if(!text.trim()) return [];

    var codes = findCodes(text);
    log('🔍 أكواد موجودة:', codes.map(function(c){ return c.code; }));

    if(!codes.length) return [];

    var rows = [];
    for(var i = 0; i < codes.length; i++){
      var start = codes[i].end;
      var end = (i + 1 < codes.length) ? codes[i + 1].index : text.length;
      var chunk = text.substring(start, end).replace(/\s+/g, ' ').trim();

      log('— صف ' + (i+1) + ' (كود ' + codes[i].code + '):', chunk.substring(0, 200));

      var time = extractTime(chunk);
      var days = extractDays(chunk, time ? time.match : null);
      var room = extractRoom(chunk);
      var hours = extractHours(chunk, time ? time.match : null);
      var name = cleanName(chunk, codes[i].code, time, days, room);

      if(!name || name.length < 2){
        name = 'مادة ' + codes[i].code;
      }

      var row = {
        code: codes[i].code,
        name: name,
        days: days,
        timeStart: time ? time.start : '',
        timeEnd: time ? time.end : '',
        room: room,
        hours: hours
      };
      log('   → اسم:', name, '| أيام:', days.join(','), '| وقت:', row.timeStart, '→', row.timeEnd, '| قاعة:', room);
      rows.push(row);
    }
    return rows;
  }

  /* ============================================================
     9) المطابقة مع COURSES_DB
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
     10) التطبيق
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
          hours: row.hours || info.h || 3,
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

  /* ============================================================
     11) بيانات الاختبار — من صورتك بالضبط!
     ============================================================ */
  var SAMPLE_REAL =
    '110108101 تفاضل وتكامل (1) 1 0 ح ث خ / 09,30 - 10,30 المادة تدرس بشكل مدمج في مبنى الحسين الباني ح.ب / 104 على منصة(مايكروسوفت teams) 3\n' +
    '121601099 لغة عربية / استدراكية 2 0 ن ر / 10,00 - 08,30 المادة تدرس بشكل مدمج في مجمع قاعات ابن خلدون م.غ / 213 على منصة(مايكروسوفت teams) 3\n' +
    '1701081136 فيزياء عامة (1) 4 0 ح ث خ / 10,30 - 11,30 المادة تدرس وجاهي في مبنى الحسين الباني ح.ب / 105 3\n' +
    '2116021101 مهارات التواصل باللغة الانجليزية 10 0 ح ث خ / 18,30 - 19,30 المادة تدرس عن بعد على منصة(مايكروسوفت teams) 3';

  var SAMPLE_MULTILINE =
    '110108101\nتفاضل وتكامل (1)\n1\n0\nح ث خ / 09,30 - 10,30\nالمادة تدرس بشكل مدمج في مبنى الحسين الباني ح.ب / 104\nعلى منصة(مايكروسوفت teams)\n3\n' +
    '121601099\nلغة عربية / استدراكية\n2\n0\nن ر / 10,00 - 08,30\nالمادة تدرس بشكل مدمج في مجمع قاعات ابن خلدون م.غ / 213\nعلى منصة(مايكروسوفت teams)\n3\n' +
    '1701081136\nفيزياء عامة (1)\n4\n0\nح ث خ / 10,30 - 11,30\nالمادة تدرس وجاهي في مبنى الحسين الباني ح.ب / 105\n3\n' +
    '2116021101\nمهارات التواصل باللغة الانجليزية\n10\n0\nح ث خ / 18,30 - 19,30\nالمادة تدرس عن بعد على منصة(مايكروسوفت teams)\n3';

  var SAMPLES = {
    '🎯 جدولك الحقيقي (سطر واحد لكل مادة)': SAMPLE_REAL,
    '📄 جدولك الحقيقي (كل حقل بسطر - OCR)': SAMPLE_MULTILINE
  };

  /* ============================================================
     12) نافذة الاختبار الذاتي
     ============================================================ */
  function openSelfTest(){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    var html = '<div class="modal" style="max-width:900px;width:96vw;padding:22px;max-height:92vh;overflow-y:auto">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    html += '<h3 style="margin:0">🧪 اختبار المحلل — بياناتك الحقيقية</h3>';
    html += '<button class="btn btn-sm btn-ghost" id="stClose">✕</button></div>';

    Object.keys(SAMPLES).forEach(function(key){
      var sample = SAMPLES[key];
      var parsed = [];
      var error = null;
      try{ parsed = parseRows(sample, false); }
      catch(e){ error = e.message; }
      var ok = parsed.length === 4;
      var color = ok ? 'var(--green)' : 'var(--red)';
      html += '<div style="background:var(--card);border:1px solid var(--border);border-right:3px solid ' + color + ';border-radius:12px;padding:14px;margin-bottom:10px">';
      html += '<div style="font-weight:700;font-size:.9rem;margin-bottom:8px">' + (ok ? '✅' : '❌') + ' ' + esc(key) + ' <span style="color:var(--muted);font-size:.75rem">(' + parsed.length + '/4)</span></div>';
      if(error){
        html += '<div style="color:var(--red);font-size:.78rem">خطأ: ' + esc(error) + '</div>';
      } else if(parsed.length){
        parsed.forEach(function(r, i){
          var match = matchDB(r);
          var dayStr = r.days.map(function(d){ return DAY_NAMES_AR[d]; }).join('، ');
          var timeOK = r.timeStart && r.timeEnd;
          html += '<div style="padding:8px 10px;background:var(--bg2);border-radius:8px;font-size:.75rem;margin-bottom:5px">';
          html += '<div style="font-weight:700;color:' + (match ? 'var(--green)' : 'var(--amber)') + '">' + (match ? '✅' : '⚠️') + ' ' + esc(match || r.name) + '</div>';
          html += '<div style="color:var(--muted2);font-family:monospace;font-size:.66rem;margin-top:2px">' + esc(r.code) + '</div>';
          html += '<div style="font-size:.7rem;margin-top:3px">📅 ' + (dayStr || '❌ لا أيام') + ' · ⏰ ' + (timeOK ? r.timeStart + '→' + r.timeEnd : '❌ لا وقت') + ' · 📍 ' + (r.room || '—') + '</div>';
          html += '</div>';
        });
      }
      html += '</div>';
    });

    html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">';
    html += '<button class="btn btn-sm btn-ghost" id="stCloseBtn">إغلاق</button>';
    html += '<button class="btn btn-sm" id="stOpenImporter">📥 فتح المستورد</button>';
    html += '</div></div>';
    bd.innerHTML = html;
    document.body.appendChild(bd);

    bd.querySelector('#stClose').onclick = function(){ bd.remove(); };
    bd.querySelector('#stCloseBtn').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
    bd.querySelector('#stOpenImporter').onclick = function(){
      bd.remove();
      openEditor(SAMPLE_REAL);
    };
  }

  /* ============================================================
     13) نافذة التحرير
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
            '<button class="btn btn-sm btn-ghost" id="tiiTest">🧪 اختبار</button>' +
            '<button class="btn btn-sm btn-ghost" id="tiiDebug">🐛 تشخيص</button>' +
            '<button class="btn btn-sm btn-ghost" id="tiiClose">✕</button>' +
          '</div>' +
        '</div>' +
        '<div style="background:var(--grad-soft);border:1px solid var(--glow);border-radius:10px;padding:10px;margin-bottom:12px;font-size:.76rem;line-height:1.6">' +
          '📌 الصق النص → اضغط "تحليل" → راجع الصفوف → اضغط "تطبيق". كل حقل قابل للتعديل. زر 🐛 يشخّص كل خطوة.' +
        '</div>' +
        '<textarea id="tiiInput" placeholder="الصق النص..." style="width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:10px;font-family:monospace;font-size:.76rem;min-height:90px;resize:vertical;direction:rtl;outline:none;line-height:1.5"></textarea>' +
        '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center">' +
          '<button class="btn btn-sm" id="tiiParse">🔄 تحليل النص</button>' +
          '<button class="btn btn-sm btn-ghost" id="tiiAddRow">➕ صف</button>' +
          '<button class="btn btn-sm btn-ghost" id="tiiClear">🗑 مسح</button>' +
          '<select id="tiiSample" style="padding:6px 10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:8px;font-family:inherit;font-size:.76rem;cursor:pointer;outline:none">' +
            '<option value="">📋 حمّل مثال...</option>' +
          '</select>' +
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
    var sampleSel = bd.querySelector('#tiiSample');
    if(initialText) input.value = initialText;

    Object.keys(SAMPLES).forEach(function(k){
      var opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      sampleSel.appendChild(opt);
    });
    sampleSel.addEventListener('change', function(){
      if(this.value && SAMPLES[this.value]){
        input.value = SAMPLES[this.value];
        bd.querySelector('#tiiParse').click();
      }
      this.value = '';
    });

    function renderRows(){
      if(!state.rows.length){
        rowsWrap.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:.85rem">لا يوجد صفوف</div>';
        countEl.textContent = '0 صف';
        return;
      }
      countEl.textContent = state.rows.length + ' صف';
      var html = '';
      state.rows.forEach(function(row, i){
        var match = matchDB(row);
        html += '<div class="tii-row" data-idx="' + i + '" style="display:grid;grid-template-columns:26px 100px 1.4fr 165px 100px 100px 80px 30px;gap:5px;align-items:center;padding:8px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;font-size:.78rem">';
        html += '<span style="color:var(--muted);font-weight:700;text-align:center;font-size:.72rem">' + (i+1) + '</span>';
        html += '<input data-field="code" value="' + esc(row.code) + '" placeholder="كود" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 7px;border-radius:6px;font-family:monospace;font-size:.68rem;outline:none;direction:ltr;text-align:left;width:100%;min-width:0">';
        html += '<div style="min-width:0"><input data-field="name" value="' + esc(row.name) + '" placeholder="اسم المادة" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 7px;border-radius:6px;font-size:.74rem;outline:none;width:100%;min-width:0">' + (match ? '<div style="color:var(--green);font-size:.62rem;margin-top:2px">✓ ' + esc(match) + '</div>' : '') + '</div>';
        html += '<div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center">';
        DAY_KEYS.forEach(function(d){
          var active = row.days.indexOf(d) > -1;
          html += '<button data-day="' + d + '" type="button" title="' + DAY_NAMES_AR[d] + '" style="width:22px;height:22px;border-radius:5px;border:1px solid ' + (active ? 'var(--cyan)' : 'var(--border)') + ';background:' + (active ? 'var(--grad-soft)' : 'var(--bg2)') + ';color:' + (active ? 'var(--cyan)' : 'var(--muted)') + ';font-size:.68rem;font-weight:700;font-family:inherit;cursor:pointer;padding:0">' + DAY_SHORT[d] + '</button>';
        });
        html += '</div>';
        html += '<input type="time" data-field="timeStart" value="' + esc(row.timeStart) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:4px;border-radius:6px;font-size:.7rem;outline:none;direction:ltr;width:100%;min-width:0">';
        html += '<input type="time" data-field="timeEnd" value="' + esc(row.timeEnd) + '" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:4px;border-radius:6px;font-size:.7rem;outline:none;direction:ltr;width:100%;min-width:0">';
        html += '<input data-field="room" value="' + esc(row.room) + '" placeholder="قاعة" style="background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:5px 7px;border-radius:6px;font-size:.7rem;outline:none;width:100%;min-width:0">';
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
    bd.querySelector('#tiiTest').onclick = function(){ bd.remove(); openSelfTest(); };

    bd.querySelector('#tiiParse').onclick = function(){
      var text = input.value.trim();
      if(!text){ toast('الصق نص أولاً', 'warn'); return; }
      var rows;
      try{ rows = parseRows(text, false); }
      catch(e){ toast('فشل التحليل: ' + e.message, 'warn', 4000); return; }
      if(!rows.length){ toast('⚠️ ما لقيت أكواد (6-11 رقم)', 'warn', 3500); return; }
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
     14) نافذة التشخيص
     ============================================================ */
  function openDebug(){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:900px;width:96vw;padding:22px;max-height:92vh;overflow-y:auto">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
          '<h3 style="margin:0">🐛 تشخيص المحلل</h3>' +
          '<button class="btn btn-sm btn-ghost" id="dbgClose">✕</button>' +
        '</div>' +
        '<p style="font-size:.82rem;color:var(--muted);margin-bottom:12px">الصق نصاً وشوف كيف يفهمه المحلل خطوة بخطوة.</p>' +
        '<textarea id="dbgInput" placeholder="الصق نص..." style="width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:12px;border-radius:10px;font-family:monospace;font-size:.78rem;min-height:140px;resize:vertical;direction:rtl;outline:none;line-height:1.6"></textarea>' +
        '<button class="btn btn-sm" id="dbgGo" style="margin-top:10px">🔍 حلّل واعرض</button>' +
        '<div id="dbgOutput" style="margin-top:16px"></div>' +
        '<div class="modal-actions" style="margin-top:14px">' +
          '<button class="btn btn-sm btn-ghost" id="dbgClose2">إغلاق</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);

    bd.querySelector('#dbgClose').onclick = function(){ bd.remove(); };
    bd.querySelector('#dbgClose2').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };

    bd.querySelector('#dbgGo').onclick = function(){
      var text = bd.querySelector('#dbgInput').value.trim();
      if(!text){ toast('الصق نصاً', 'warn'); return; }
      var out = [];
      out.push('📄 طول النص: ' + text.length + ' حرف');
      var normalized = normalize(text);
      out.push('🧹 بعد التطبيع (أول 200 حرف):\n' + normalized.substring(0, 200));
      var codes = findCodes(normalized);
      out.push('🔢 أكواد موجودة: ' + codes.length + ' → ' + codes.map(function(c){ return c.code; }).join(', '));
      var rows = parseRows(text, false);
      out.push('📊 صفوف مستخرجة: ' + rows.length);
      rows.forEach(function(r, i){
        out.push('\n── صف ' + (i+1) + ' ──');
        out.push('كود: ' + r.code);
        out.push('اسم: ' + r.name);
        out.push('أيام: ' + (r.days.join(',') || '❌ فاضي'));
        out.push('وقت: ' + (r.timeStart ? r.timeStart + ' → ' + r.timeEnd : '❌ فاضي'));
        out.push('قاعة: ' + (r.room || 'فاضي'));
        out.push('ساعات: ' + r.hours);
      });
      bd.querySelector('#dbgOutput').innerHTML =
        '<pre style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:.74rem;line-height:1.6;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-word;color:var(--text)">' +
        esc(out.join('\n')) + '</pre>';
    };
  }

  /* ============================================================
     15) Public API + Install
     ============================================================ */
  window.TimetableImporter = {
    open: openEditor,
    parse: parseRows,
    apply: apply,
    test: openSelfTest,
    debug: openDebug,
    samples: SAMPLES
  };

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
      var menu = document.getElementById('settingsMenu');
      if(menu && !menu.querySelector('#tiiTestBtn')){
        var btn1 = document.createElement('button');
        btn1.className = 'settings-item';
        btn1.id = 'tiiTestBtn';
        btn1.innerHTML = '<span>🧪</span> اختبار محلل الجدول';
        btn1.addEventListener('click', function(){
          if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
          openSelfTest();
        });
        var btn2 = document.createElement('button');
        btn2.className = 'settings-item';
        btn2.id = 'tiiDebugBtn';
        btn2.innerHTML = '<span>🐛</span> تشخيص المحلل';
        btn2.addEventListener('click', function(){
          if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
          openDebug();
        });
        var pdfBtn = menu.querySelector('#pdfBtn');
        if(pdfBtn){
          menu.insertBefore(btn1, pdfBtn);
          menu.insertBefore(btn2, pdfBtn);
        } else { menu.appendChild(btn1); menu.appendChild(btn2); }
        clearInterval(timer2);
      }
      if(tries2 > 40) clearInterval(timer2);
    }, 500);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ injectCSS(); install(); });
  } else { injectCSS(); install(); }

  console.log('📥 Timetable Importer v3 — محلل جدول الجامعة الهاشمية');
})();