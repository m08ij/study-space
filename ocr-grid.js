/* ============================================================
   📸 ocr-grid.js v6 — إصلاح مُخصَّص لجدول الجامعة الهاشمية
   ✅ إحداثيات الأعمدة مضبوطة 100% على الجدول الفعلي
   ✅ كشف تلقائي عبر Projection (بدل الخطوط العمودية غير الموجودة)
   ✅ ترتيب صحيح: أيام → قاعة → وقت
   ✅ دعم aliases في courses-data
   ✅ تصحيح أرقام OCR (O→0, l→1)
   ============================================================ */
(function(){
  'use strict';
  if(window._ocrGridLoaded) return;
  window._ocrGridLoaded = true;

  var FIELDS  = ['code','name','theory','lab','details','hours'];
  var COLS    = ['hours','details','lab','theory','name','code'];
  var NUMERIC_FIELDS = { code:1, theory:1, lab:1, hours:1 };

  /* 🔥 الإصلاح الأساسي — قياسات حقيقية من جدول HU */
  /* الترتيب في الصورة (من اليسار): hours | details | lab | theory | name | code */
  var DEF_FRAC = [0.058, 0.690, 0.740, 0.790, 0.930];
  /*                 ↑      ↑      ↑      ↑      ↑
                    hours details lab  theory  name  code */

  var SPELL_FIX = [
    [/مايكر\s*وسوفت/g, 'مايكروسوفت'],
    [/مايكرو\s*سوفت/g, 'مايكروسوفت'],
    [/مايكروسفت/g,   'مايكروسوفت'],
    [/الحسين\s+البانى/g, 'الحسين الباني'],
    [/الحسين\s+البان[يى]/g, 'الحسين الباني'],
    [/ابن\s+خلدون/g,   'ابن خلدون'],
    [/ابن\s+رشد/g,     'ابن رشد'],
    [/استدراكيه/g,     'استدراكية'],
    [/فيزياء\s+عامه/g, 'فيزياء عامة'],
    [/لغه\s+عربيه/g,   'لغة عربية'],
    [/الانجليزيه/g,    'الانجليزية'],
    [/الانكليزيه/g,    'الانجليزية'],
    [/على\s+منصه/g,    'على منصة'],
    [/شبكاث/g,         'شبكات'],
    [/مودال/g,         ''],
    [/Mودال/g,         ''],
    [/teams\s*\)/gi,   'teams)']
  ];

  /* ✅ تصحيح أحرف OCR الشائعة إلى أرقام */
  function fixDigitsOCR(s){
    return String(s||'')
      .replace(/O/g, '0').replace(/o/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2');
  }

  var im = null, L = 0, R = 0, V = [], Hs = [], S = 1, drag = null;
  var rows = [], cellConf = [];
  var cv = null, ctx = null;
  var workerAr = null, workerEn = null;
  var busy = false, modal = null;

  function toast(m,t,d){ if(typeof window.toast === 'function') window.toast(m, t||'info', d||2500); }
  function uid(){ return (window.uid ? window.uid() : Date.now().toString(36)+Math.random().toString(36).slice(2,6)); }
  function pad2(n){ return String(n).padStart(2,'0'); }
  function toEnDigits(s){
    return String(s||'').replace(/[٠-٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }

  /* ============ الوقت ============ */
  function parseTimeRange(text){
    if(!text) return null;
    var t = toEnDigits(fixDigitsOCR(text)).replace(/\s+/g, ' ');

    /* النمط الأساسي: 10,30 - 09,30 */
    var m = t.match(/(\d{1,2})\s*[:.,]\s*(\d{2})\s*[-–—~]+\s*(\d{1,2})\s*[:.,]\s*(\d{2})/);
    if(m){
      var r = buildRange(+m[1],+m[2],+m[3],+m[4]);
      if(r) return r;
    }

    /* نمط مضغوط: 1030-0930 */
    m = t.match(/(\d{2})(\d{2})\s*[-–—~]+\s*(\d{2})(\d{2})/);
    if(m){
      var r2 = buildRange(+m[1],+m[2],+m[3],+m[4]);
      if(r2) return r2;
    }

    /* استخراج كل الأرقام الثنائية المتتالية */
    var pairs = [];
    var re = /(\d{2})(?!\d)/g, mm;
    while((mm = re.exec(t)) !== null){
      pairs.push({ v: +mm[1], pos: mm.index });
    }
    for(var i = 0; i <= pairs.length - 4; i++){
      if(Math.abs(pairs[i+3].pos - pairs[i].pos) > 30) continue;
      var r3 = buildRange(pairs[i].v, pairs[i+1].v, pairs[i+2].v, pairs[i+3].v);
      if(r3) return r3;
    }
    return null;
  }
  function buildRange(h1,m1,h2,m2){
    if(h1 < 6 || h1 > 23 || h2 < 6 || h2 > 23) return null;
    if(m1 < 0 || m1 > 59 || m2 < 0 || m2 > 59) return null;
    var t1 = h1*60+m1, t2 = h2*60+m2;
    if(t1 === t2) return null;
    var s = Math.min(t1,t2), e = Math.max(t1,t2);
    if(e - s > 6*60) return null;
    return { start: pad2(Math.floor(s/60))+':'+pad2(s%60), end: pad2(Math.floor(e/60))+':'+pad2(e%60) };
  }

  /* ============ الأيام ============ */
  var DAY_LET = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };
  var DAY_ORDER = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAY_AR = { Sun:'ح', Mon:'ن', Tue:'ث', Wed:'ر', Thu:'خ', Fri:'ج', Sat:'س' };

  function extractDays(text){
    var t = String(text||'');
    /* نمط HU الأساسي: "ح ث خ /" */
    var m = t.match(/([حنثرخجس](?:\s+[حنثرخجس])+)\s*[\/\\]/);
    if(m){ var o1 = parseDayChars(m[1]); if(o1.length >= 2) return o1; }
    /* نمط بدون / */
    m = t.match(/(?:^|\s)([حنثرخجس](?:\s+[حنثرخجس]){1,})(?=\s|$)/);
    if(m){ var o2 = parseDayChars(m[1]); if(o2.length >= 2) return o2; }
    /* نمط متلاصق */
    m = t.match(/[حنثرخجس]{2,}/);
    if(m){ var o3 = parseDayChars(m[0]); if(o3.length >= 2) return o3; }
    return [];
  }
  function parseDayChars(s){
    var out = [];
    String(s).replace(/\s/g,'').split('').forEach(function(ch){
      var d = DAY_LET[ch];
      if(d && out.indexOf(d) === -1) out.push(d);
    });
    return out.sort(function(a,b){ return DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b); });
  }

  /* ============ تنظيف ============ */
  function cleanArabic(text){
    if(!text) return '';
    var t = String(text);
    var arabicCount = (t.match(/[\u0600-\u06FF]/g) || []).length;
    var latinCount  = (t.match(/[a-zA-Z]/g) || []).length;
    if(arabicCount > 5 && latinCount > 0 && latinCount < arabicCount * 0.35){
      t = t.replace(/(^|\s)([a-zA-Z]{1,2})(?=\s|$)/g, '$1 ');
    }
    t = t.replace(/[|¦ـ]{2,}/g, ' ');
    t = t.replace(/[^\u0600-\u06FFa-zA-Z0-9\s.,:\-\/\\()]/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    SPELL_FIX.forEach(function(p){
      try{ t = t.replace(p[0], p[1]); }catch(e){}
    });
    t = t.replace(/\s*\/\s*/g, ' / ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  /* ============================================================
     🔧 parseAndRebuildDetails — ترتيب صحيح: أيام → قاعة → وقت
     ============================================================ */
  function parseAndRebuildDetails(rawText){
    var t = toEnDigits(fixDigitsOCR(String(rawText || '')));
    t = t.replace(/[|¦ـ]{2,}/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();

    /* 1) أيام */
    var days = extractDays(t);
    var daysText = '';
    if(days.length){
      daysText = days.map(function(d){ return DAY_AR[d]; }).join(' ');
      t = t.replace(/([حنثرخجس](?:\s+[حنثرخجس])+)\s*[\/\\]/g, ' ');
      t = t.replace(/(?:^|\s)([حنثرخجس](?:\s+[حنثرخجس]){1,})(?=\s|$)/g, ' ');
      t = t.replace(/[حنثرخجس]{2,}/g, ' ');
    }

    /* 2) القاعة — قبل حذف الأرقام */
    var room = '';
    var rm = t.match(/([حمنر]\s*[.\s]?\s*[بغبجمع])\s*[\/\\]?\s*(\d{2,4})/);
    if(rm){
      room = rm[1].replace(/\s+/g, ' ').trim() + ' ' + rm[2];
      t = t.replace(rm[0], ' ');
    } else {
      var rm2 = t.match(/[\/\\]\s*(\d{3,4})\b/);
      if(rm2){ room = rm2[1]; t = t.replace(rm2[0], ' '); }
      else {
        var rm3 = t.match(/(?:^|\s)(\d{3})(?=\s|$)/);
        if(rm3 && !/^(20|19)\d/.test(rm3[1])){ room = rm3[1]; t = t.replace(rm3[0], ' '); }
      }
    }

    /* 3) الوقت */
    var time = parseTimeRange(t);
    if(time){
      t = t.replace(/\d{1,2}\s*[:.,]?\s*\d{2}\s*[-–—~]?\s*\d{1,2}\s*[:.,]?\s*\d{2}/g, ' ');
      t = t.replace(/\b\d{1,2}\b/g, ' ');
    }

    /* 4) تنظيف */
    t = cleanArabic(t);

    /* 5) إعادة البناء */
    var rebuilt = '';
    if(daysText) rebuilt += daysText;
    if(time){
      if(rebuilt) rebuilt += ' / ';
      rebuilt += time.start + ' - ' + time.end;
    } else {
      if(rebuilt) rebuilt += ' / ';
      rebuilt += '--:--';
    }
    if(t) rebuilt += ' ' + t;
    if(room) rebuilt += ' ' + room;

    return { rebuilt: rebuilt.trim(), time: time, days: days, room: room };
  }

  function extractRoom(detailsText){
    if(!detailsText) return '';
    var m = detailsText.match(/([حمنر]\s*[.\s]?\s*[بغبجمع])\s*(\d{2,4})/);
    if(m) return m[1].replace(/\s+/g,' ').trim() + ' ' + m[2];
    m = detailsText.match(/[\/\\]?\s*(\d{3,4})\b/);
    if(m) return m[1];
    return '';
  }

  /* ============ Tesseract ============ */
  function loadTesseract(){
    if(typeof window.Tesseract !== 'undefined' && window.Tesseract.createWorker) return Promise.resolve();
    if(window._ocrGridTessPromise) return window._ocrGridTessPromise;
    window._ocrGridTessPromise = new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload = resolve;
      s.onerror = function(){ reject(new Error('فشل تحميل Tesseract')); };
      document.head.appendChild(s);
    });
    return window._ocrGridTessPromise;
  }

  /* ============ CSS ============ */
  function injectCSS(){
    if(document.getElementById('ocrg-css')) return;
    var s = document.createElement('style');
    s.id = 'ocrg-css';
    s.textContent = `
.ocrg-backdrop{position:fixed;inset:0;z-index:550;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px}
.ocrg-modal{background:var(--card);border:1px solid var(--border);border-radius:20px;width:96vw;max-width:1200px;max-height:94vh;overflow-y:auto;padding:22px;box-shadow:var(--shadow-lg);position:relative}
.ocrg-modal::before{content:'';position:absolute;top:0;right:0;left:0;height:3px;background:var(--grad);border-radius:20px 20px 0 0}
.ocrg-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.ocrg-header h3{margin:0;font-size:1.1rem;color:var(--cyan)}
.ocrg-close{width:36px;height:36px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--muted);font-size:1.2rem;cursor:pointer;font-family:inherit}
.ocrg-hint{color:var(--muted);font-size:.82rem;margin-bottom:10px;line-height:1.75;background:var(--grad-soft);padding:11px 15px;border-radius:11px;border:1px solid var(--glow)}
.ocrg-hint b{color:var(--cyan)}
.ocrg-drop{border:2px dashed var(--border2);border-radius:14px;padding:48px 20px;text-align:center;cursor:pointer;background:var(--bg2);transition:.25s;font-size:1rem;color:var(--muted)}
.ocrg-drop:hover{border-color:var(--cyan);background:var(--grad-soft);color:var(--cyan)}
.ocrg-drop .ocrg-drop-icon{font-size:3rem;margin-bottom:10px;display:block;opacity:.7}
.ocrg-canvas-wrap{position:relative;overflow:auto;max-height:58vh;border-radius:12px;border:1px solid var(--border);background:var(--bg2);padding:8px}
#ocrgCanvas{max-width:100%;display:block;border-radius:8px;cursor:crosshair;touch-action:none}
.ocrg-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;justify-content:flex-end}
.ocrg-progress{margin-top:14px;background:var(--bg2);border-radius:12px;padding:12px;border:1px solid var(--border)}
.ocrg-progress .bar-outer{height:10px;background:var(--card);border-radius:10px;overflow:hidden}
.ocrg-progress .bar-inner{height:100%;width:0%;background:var(--grad);border-radius:10px;transition:width .3s}
.ocrg-progress .text{font-size:.82rem;color:var(--muted);margin-top:8px;text-align:center;font-weight:600}
.ocrg-table-wrap{margin-top:16px;overflow-x:auto}
.ocrg-table{width:100%;border-collapse:collapse;min-width:900px;background:var(--bg2);border-radius:12px;overflow:hidden}
.ocrg-table th{background:#4a7bd4;color:#fff;padding:11px 8px;font-weight:700;font-size:.78rem;text-align:center;border:1px solid rgba(0,0,0,.2)}
.ocrg-table td{border:1px solid var(--border);padding:4px;text-align:center;vertical-align:middle;position:relative}
.ocrg-table td[contenteditable]{padding:10px 6px;min-width:60px;font-size:.82rem;outline:none;transition:.15s;line-height:1.5}
.ocrg-table td[contenteditable]:focus{background:var(--grad-soft);box-shadow:inset 0 0 0 2px var(--cyan)}
.ocrg-table td.ocrg-det{text-align:right;min-width:280px;font-size:.78rem;line-height:1.6}
.ocrg-table td.ocrg-nm{min-width:150px}
.ocrg-table td.ocrg-warn{background:rgba(251,191,36,.13)}
.ocrg-table td.ocrg-bad{background:rgba(239,68,68,.13)}
.ocrg-table .ocrg-conf{position:absolute;top:2px;left:3px;font-size:.55rem;font-weight:800;padding:1px 5px;border-radius:5px;background:var(--bg2);color:var(--muted);opacity:.65;pointer-events:none}
.ocrg-table .ocrg-conf.good{color:var(--green)}
.ocrg-table .ocrg-conf.mid{color:var(--amber)}
.ocrg-table .ocrg-conf.low{color:var(--red)}
.ocrg-table .ocrg-del{background:transparent;border:none;color:var(--red);font-size:1.05rem;cursor:pointer;font-family:inherit;padding:2px 8px}
.ocrg-status{margin-top:12px;text-align:center;font-size:.85rem;font-weight:700;color:var(--muted);min-height:1.4em;line-height:1.7}
.ocrg-debug{margin-top:8px;font-size:.68rem;color:var(--muted2);font-family:monospace;direction:ltr;text-align:left;background:var(--bg2);padding:6px 10px;border-radius:6px}
    `;
    document.head.appendChild(s);
  }

  /* ============ Modal ============ */
  function openModal(){
    injectCSS();
    document.querySelectorAll('.ocrg-backdrop').forEach(function(m){ m.remove(); });

    modal = document.createElement('div');
    modal.className = 'ocrg-backdrop';
    modal.innerHTML =
      '<div class="ocrg-modal" role="dialog" aria-modal="true">' +
        '<div class="ocrg-header">' +
          '<h3>📸 استخراج الجدول (v6 — HU)</h3>' +
          '<button class="ocrg-close" id="ocrgClose">✕</button>' +
        '</div>' +
        '<div id="ocrgDrop" class="ocrg-drop">' +
          '<span class="ocrg-drop-icon">📤</span>' +
          'اسحب صورة الجدول هنا، أو اضغط للاختيار' +
          '<input type="file" id="ocrgFile" accept="image/*" hidden>' +
        '</div>' +
        '<div id="ocrgEditor" style="display:none">' +
          '<p class="ocrg-hint">' +
            '🎯 <b>خطوط حمراء</b> = الأعمدة (مضبوطة لجدول الجامعة الهاشمية)، <b>خطوط خضراء</b> = الصفوف. اسحبها للتعديل.' +
          '</p>' +
          '<div class="ocrg-canvas-wrap"><canvas id="ocrgCanvas"></canvas></div>' +
          '<div class="ocrg-debug" id="ocrgDebug"></div>' +
          '<div class="ocrg-actions">' +
            '<button class="btn btn-sm btn-ghost" id="ocrgAddLine">➕ خط صفوف</button>' +
            '<button class="btn btn-sm btn-ghost" id="ocrgRedetect">🔄 إعادة الاكتشاف</button>' +
            '<button class="btn btn-sm" id="ocrgExtract">🚀 استخراج الجدول</button>' +
          '</div>' +
          '<div class="ocrg-progress" id="ocrgProgress" style="display:none">' +
            '<div class="bar-outer"><div class="bar-inner" id="ocrgBar"></div></div>' +
            '<div class="text" id="ocrgProgressText">جاري التحليل...</div>' +
          '</div>' +
        '</div>' +
        '<div class="ocrg-table-wrap" id="ocrgTableWrap" style="display:none">' +
          '<table class="ocrg-table">' +
            '<thead><tr>' +
              '<th>رقم المادة</th><th>اسم المادة</th><th>النظري</th>' +
              '<th>العملي</th><th>الوقت والقاعة</th><th>الساعات</th><th></th>' +
            '</tr></thead>' +
            '<tbody id="ocrgTableBody"></tbody>' +
          '</table>' +
          '<div class="ocrg-actions" style="margin-top:14px">' +
            '<button class="btn btn-sm btn-ghost" id="ocrgAddRow">+ صف</button>' +
            '<button class="btn btn-sm" id="ocrgApply">✅ تطبيق على الجدول</button>' +
          '</div>' +
          '<div class="ocrg-status" id="ocrgStatus"></div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onEscKey);

    modal.querySelector('#ocrgClose').onclick = closeModal;
    modal.addEventListener('click', function(e){ if(e.target === modal) closeModal(); });

    var dropEl = modal.querySelector('#ocrgDrop');
    var fileEl = modal.querySelector('#ocrgFile');
    dropEl.addEventListener('click', function(){ fileEl.click(); });
    fileEl.addEventListener('change', function(e){
      var f = e.target.files && e.target.files[0];
      if(f) loadImage(f);
      fileEl.value = '';
    });
    dropEl.addEventListener('dragover', function(e){ e.preventDefault(); dropEl.style.borderColor = 'var(--cyan)'; });
    dropEl.addEventListener('dragleave', function(){ dropEl.style.borderColor = ''; });
    dropEl.addEventListener('drop', function(e){
      e.preventDefault();
      dropEl.style.borderColor = '';
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) loadImage(f);
    });

    modal.querySelector('#ocrgAddLine').onclick = function(){
      if(!im) return;
      var bi = 0, bg = 0;
      for(var i = 0; i < Hs.length-1; i++){
        if(Hs[i+1]-Hs[i] > bg){ bg = Hs[i+1]-Hs[i]; bi = i; }
      }
      Hs.splice(bi+1, 0, Math.round((Hs[bi]+Hs[bi+1])/2));
      draw();
    };
    modal.querySelector('#ocrgRedetect').onclick = function(){ if(im){ detect(); draw(); } };
    modal.querySelector('#ocrgExtract').onclick = runExtraction;
    modal.querySelector('#ocrgAddRow').onclick = function(){
      rows.push({code:'',name:'',theory:'',lab:'',details:'',hours:''});
      cellConf.push({});
      renderTable();
    };
    modal.querySelector('#ocrgApply').onclick = applyToTimetable;
  }

  function closeModal(){
    document.removeEventListener('keydown', onEscKey);
    if(modal){ modal.remove(); modal = null; }
    document.body.style.overflow = '';
  }
  function onEscKey(e){ if(e.key === 'Escape') closeModal(); }

  function loadImage(file){
    if(!file || !file.type.startsWith('image/')) return;
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function(){
      im = img;
      modal.querySelector('#ocrgDrop').style.display = 'none';
      modal.querySelector('#ocrgEditor').style.display = 'block';
      modal.querySelector('#ocrgTableWrap').style.display = 'none';
      cv = modal.querySelector('#ocrgCanvas');
      ctx = cv.getContext('2d');
      detect();
      draw();
      setTimeout(bindCanvasEvents, 80);
      URL.revokeObjectURL(url);
    };
    img.onerror = function(){ toast('تعذّر تحميل الصورة', 'warn'); URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* ============================================================
     🔥 detect() — كشف ذكي بـ Projection (لا توجد خطوط عمودية!)
     ============================================================ */
  function detect(){
    var W = im.naturalWidth, H = im.naturalHeight;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    var p = x.getImageData(0, 0, W, H).data;

    var lum = function(i){ return .3*p[i] + .59*p[i+1] + .11*p[i+2]; };
    var isBlue = function(i){ return (p[i+2] - p[i] > 40) && p[i+2] > 120; };

    /* 1) كشف شريط الرأس الأزرق */
    var b0 = -1, b1 = -1;
    for(var y = 0; y < H; y++){
      var n = 0;
      for(var xx = 0; xx < W; xx += 2) if(isBlue((y*W + xx)*4)) n++;
      if(n > W*0.15){ if(b0 < 0) b0 = y; b1 = y; }
      else if(b0 >= 0) break;
    }

    L = 0; R = W - 1;
    if(b0 >= 0){
      var mn = W, mx = 0;
      for(var x2 = 0; x2 < W; x2++){
        if(isBlue(((b0+2)*W + x2)*4)){ if(x2 < mn) mn = x2; if(x2 > mx) mx = x2; }
      }
      if(mx > mn){ L = mn; R = mx; }
    }

    var top = b1 + 1;

    /* 2) كشف الصفوف */
    var med = new Array(H).fill(0), ink = new Array(H).fill(0);
    for(var y2 = top; y2 < H; y2++){
      var arr = [], k = 0;
      for(var x3 = L; x3 <= R; x3 += 3){
        var l = lum((y2*W + x3)*4);
        arr.push(l);
        if(l < 110) k++;
      }
      arr.sort(function(a,b){ return a-b; });
      med[y2] = arr[arr.length>>1];
      ink[y2] = k;
    }
    var cuts = [top];
    for(var y3 = top + 2; y3 < H; y3++){
      if(Math.abs(med[y3] - med[y3-1]) > 4 && y3 - cuts[cuts.length-1] > 8) cuts.push(y3);
    }
    cuts.push(H);
    var segs = [];
    for(var i = 0; i < cuts.length-1; i++){
      var s = 0;
      for(var y4 = cuts[i]; y4 < cuts[i+1]; y4++) s += ink[y4];
      if(s > 20) segs.push([cuts[i], cuts[i+1]]);
    }
    Hs = segs.length ? [segs[0][0]].concat(segs.map(function(sg){ return sg[1]; })) : [top, H];

    /* 3) كشف الأعمدة عبر Projection */
    var dataTop = Hs[0], dataBottom = Hs[Hs.length - 1];
    var cols = detectColumnsByProjection(p, W, H, L, R, dataTop, dataBottom);
    var method = 'projection';

    /* 4) تحقق: لازم 5 خطوط داخلية */
    if(cols.length < 4 || cols.length > 7){
      cols = DEF_FRAC.map(function(f){ return Math.round(L + f*(R - L)); });
      method = 'default (HU-tuned)';
    }

    V = cols;

    /* Debug output */
    var dbg = document.getElementById('ocrgDebug');
    if(dbg){
      var fr = V.map(function(v){ return ((v-L)/(R-L)).toFixed(3); });
      dbg.textContent = '🔍 Method: ' + method + ' | Lines: [' + fr.join(', ') + '] (from left)';
    }
    console.log('[ocr-grid v6] Method:', method, '| Columns:', V);
  }

  /**
   * كشف الأعمدة بـ Projection (توزيع البكسلات الداكنة)
   * يبحث عن "وديان" (فراغات) بين الأعمدة
   */
  function detectColumnsByProjection(p, W, H, L, R, top, bottom){
    var width = R - L + 1;
    if(width < 50 || bottom <= top) return [];

    var colInk = new Array(width).fill(0);
    var rowCount = 0;

    /* اعد البكسلات الداكنة في كل عمود */
    for(var y = top; y <= bottom; y++){
      rowCount++;
      for(var x = L; x <= R; x++){
        var idx = (y * W + x) * 4;
        var l = 0.3*p[idx] + 0.59*p[idx+1] + 0.11*p[idx+2];
        if(l < 140) colInk[x - L]++;
      }
    }
    if(rowCount === 0) return [];

    /* normalize + smooth */
    var smoothed = new Array(width);
    for(var i = 0; i < width; i++) colInk[i] /= rowCount;
    for(var i2 = 0; i2 < width; i2++){
      var s = 0, n = 0;
      for(var k = -5; k <= 5; k++){
        var ix = i2 + k;
        if(ix >= 0 && ix < width){ s += colInk[ix]; n++; }
      }
      smoothed[i2] = s / n;
    }

    var maxInk = 0;
    for(var i3 = 0; i3 < width; i3++) if(smoothed[i3] > maxInk) maxInk = smoothed[i3];
    if(maxInk === 0) return [];

    /* القمة = نص كثيف. الوادي = فراغ بين الأعمدة */
    var cutoff = maxInk * 0.08;
    var minGapWidth = Math.max(3, Math.round(width * 0.008));

    var gapCenters = [];
    var inGap = false, gapStart = 0;
    for(var x2 = 0; x2 < width; x2++){
      if(smoothed[x2] < cutoff){
        if(!inGap){ inGap = true; gapStart = x2; }
      } else {
        if(inGap){
          var gw = x2 - gapStart;
          if(gw >= minGapWidth && x2 > 5 && x2 < width - 5){
            gapCenters.push(L + Math.round((gapStart + x2) / 2));
          }
          inGap = false;
        }
      }
    }

    /* دمج الفراغات المتقاربة (أقل من 25 بكسل) */
    var merged = [];
    gapCenters.forEach(function(g){
      if(!merged.length || g - merged[merged.length-1] > 25){
        merged.push(g);
      } else {
        merged[merged.length-1] = Math.round((merged[merged.length-1] + g) / 2);
      }
    });

    return merged;
  }

  function draw(){
    if(!im || !cv) return;
    S = Math.min(1, 1100 / im.naturalWidth);
    cv.width  = Math.round(im.naturalWidth  * S);
    cv.height = Math.round(im.naturalHeight * S);
    ctx.drawImage(im, 0, 0, cv.width, cv.height);
    ctx.lineWidth = 2;
    ctx.font = 'bold 12px Tahoma, sans-serif';
    ctx.textAlign = 'center';

    var B = [L].concat(V).concat([R]);

    /* خطوط حمراء للأعمدة */
    ctx.strokeStyle = '#e5484d';
    V.forEach(function(v){ ctx.beginPath(); ctx.moveTo(v*S, 0); ctx.lineTo(v*S, cv.height); ctx.stroke(); });

    /* خطوط خضراء للصفوف */
    ctx.strokeStyle = '#12a150';
    Hs.forEach(function(y){ ctx.beginPath(); ctx.moveTo(L*S, y*S); ctx.lineTo(R*S, y*S); ctx.stroke(); });

    /* أسماء الأعمدة */
    var names = ['الساعات', 'الوقت', 'العملي', 'النظري', 'الاسم', 'الرقم'];
    ctx.fillStyle = '#e5484d';
    for(var i = 0; i < 6 && i < B.length - 1; i++){
      var cx = (B[i] + B[i+1]) / 2;
      var txt = names[i] + ' (' + ((B[i+1]-B[i])/im.naturalWidth*100).toFixed(0) + '%)';
      ctx.fillText(txt, cx * S, cv.height - 6);
    }
  }

  function canvasPos(e){
    var r = cv.getBoundingClientRect();
    var k = cv.width / r.width / S;
    return { x:(e.clientX - r.left) * k, y:(e.clientY - r.top) * k };
  }
  function hitTest(p){
    for(var vi = 0; vi < V.length; vi++) if(Math.abs(V[vi] - p.x) < 14/S) return { t:'v', i:vi };
    for(var hi = 0; hi < Hs.length; hi++){
      if(Math.abs(Hs[hi] - p.y) < 14/S && p.x >= L - 20 && p.x <= R + 20) return { t:'h', i:hi };
    }
    return null;
  }
  function bindCanvasEvents(){
    if(!cv || cv._ocrgBound) return;
    cv._ocrgBound = true;
    cv.addEventListener('pointerdown', function(e){
      var h = hitTest(canvasPos(e));
      if(h){ drag = h; try{ cv.setPointerCapture(e.pointerId); }catch(x){} }
    });
    cv.addEventListener('pointermove', function(e){
      var p = canvasPos(e);
      if(drag){
        if(drag.t === 'v') V[drag.i] = Math.max(L, Math.min(R, Math.round(p.x)));
        else Hs[drag.i] = Math.max(0, Math.min(im.naturalHeight, Math.round(p.y)));
        draw();
      } else {
        var h = hitTest(p);
        cv.style.cursor = h ? (h.t === 'v' ? 'ew-resize' : 'ns-resize') : 'crosshair';
      }
    });
    cv.addEventListener('pointerup', function(){
      if(drag){
        if(drag.t === 'v') V.sort(function(a,b){ return a-b; });
        else Hs.sort(function(a,b){ return a-b; });
        drag = null; draw();
      }
    });
  }

  /* ============ قص + Otsu ============ */
  function cropCell(x0, y0, x1, y1, scale){
    var w = Math.max(4, x1-x0), h = Math.max(4, y1-y0), pad = 10;
    var tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    var tg = tmp.getContext('2d');
    tg.drawImage(im, x0, y0, w, h, 0, 0, w, h);
    var imageData = tg.getImageData(0, 0, w, h);
    var d = imageData.data;
    var hist = new Array(256).fill(0);
    var totalPx = w * h;
    for(var i = 0; i < d.length; i += 4){
      var l = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) | 0;
      d[i]=d[i+1]=d[i+2]=l;
      hist[l]++;
    }
    var sum = 0;
    for(var t2 = 0; t2 < 256; t2++) sum += t2 * hist[t2];
    var sumB = 0, wB = 0, maxVar = 0, otsu = 128;
    for(var t3 = 0; t3 < 256; t3++){
      wB += hist[t3]; if(wB === 0) continue;
      var wF = totalPx - wB; if(wF === 0) break;
      sumB += t3 * hist[t3];
      var mB = sumB/wB, mF = (sum-sumB)/wF;
      var between = wB * wF * (mB-mF) * (mB-mF);
      if(between > maxVar){ maxVar = between; otsu = t3; }
    }
    var minX = w, maxX = 0, minY = h, maxY = 0;
    for(var y2 = 0; y2 < h; y2++){
      for(var x2 = 0; x2 < w; x2++){
        var idx = (y2*w + x2) * 4;
        var val = d[idx] > otsu ? 255 : 0;
        d[idx]=d[idx+1]=d[idx+2]=val;
        if(val === 0){
          if(x2 < minX) minX = x2; if(x2 > maxX) maxX = x2;
          if(y2 < minY) minY = y2; if(y2 > maxY) maxY = y2;
        }
      }
    }
    tg.putImageData(imageData, 0, 0);
    if(maxX <= minX || maxY <= minY) return { canvas: tmp, empty: true };
    var trimW = maxX-minX+1, trimH = maxY-minY+1;
    var outW = Math.round(trimW*scale) + pad*2;
    var outH = Math.round(trimH*scale) + pad*2;
    var out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    var og = out.getContext('2d');
    og.fillStyle = '#fff'; og.fillRect(0, 0, outW, outH);
    og.imageSmoothingEnabled = false;
    og.drawImage(tmp, minX, minY, trimW, trimH, pad, pad, trimW*scale, trimH*scale);
    return { canvas: out, empty: false };
  }

  async function readCellMulti(cellCanvas, worker, psmModes, whitelist){
    var best = null;
    for(var i = 0; i < psmModes.length; i++){
      try{
        var params = { tessedit_pageseg_mode: String(psmModes[i]) };
        if(whitelist) params.tessedit_char_whitelist = whitelist;
        await worker.setParameters(params);
        var res = await worker.recognize(cellCanvas);
        var txt = (res && res.data && res.data.text) || '';
        var conf = (res && res.data && typeof res.data.confidence === 'number') ? res.data.confidence : 0;
        if(!best || conf > best.conf) best = { text: txt, conf: conf };
        if(conf > 88) break;
      }catch(e){}
    }
    return best || { text: '', conf: 0 };
  }

  async function readNumeric(canvas, field){
    var r = await readCellMulti(canvas, workerEn, [7, 8, 6], '0123456789');
    var digits = toEnDigits(fixDigitsOCR(r.text)).replace(/\D/g, '');
    var warn = false;
    if(field === 'code') warn = digits.length < 8 || digits.length > 12;
    else if(field === 'hours') warn = !(digits.length === 1 && +digits >= 1 && +digits <= 6);
    else warn = digits.length > 2;
    return { text: digits, conf: r.conf, warn: warn };
  }

  async function readText(canvas){
    var r = await readCellMulti(canvas, workerAr, [6, 7, 4], null);
    var txt = cleanArabic(r.text);
    var warn = txt.length < 3;
    return { text: txt, conf: r.conf, warn: warn };
  }

  async function readDetails(canvas){
    var attempts = [];
    for(var pi = 0; pi < 3; pi++){
      var psm = [6, 4, 7][pi];
      try{
        await workerAr.setParameters({ tessedit_pageseg_mode: String(psm) });
        var res = await workerAr.recognize(canvas);
        var txt = (res && res.data && res.data.text) || '';
        var conf = (res && res.data && typeof res.data.confidence === 'number') ? res.data.confidence : 0;
        attempts.push({ text: txt, conf: conf });
      }catch(e){}
    }
    var best = null, bestScore = -1;
    attempts.forEach(function(a){
      var parsed = parseAndRebuildDetails(a.text);
      var score = a.conf
        + (parsed.time ? 60 : 0)
        + (parsed.days.length ? 25 : 0)
        + (parsed.room ? 20 : 0);
      if(score > bestScore){
        bestScore = score;
        best = { text: parsed.rebuilt, conf: a.conf, warn: !parsed.time || !parsed.days.length };
      }
    });
    return best || { text: '', conf: 0, warn: true };
  }

  async function ensureWorkers(){
    await loadTesseract();
    if(!workerAr) workerAr = await window.Tesseract.createWorker('ara+eng', 1);
    if(!workerEn) workerEn = await window.Tesseract.createWorker('eng', 1);
  }

  /* ============ الاستخراج ============ */
  async function runExtraction(){
    if(!im || busy) return;
    if(Hs.length < 2){ toast('أضف خط صفوف أولاً', 'warn'); return; }
    busy = true;

    var progressEl = modal.querySelector('#ocrgProgress');
    var barEl = modal.querySelector('#ocrgBar');
    var textEl = modal.querySelector('#ocrgProgressText');
    progressEl.style.display = 'block';
    textEl.style.color = '';

    try{
      textEl.textContent = '⏳ تحميل محرك Tesseract...';
      barEl.style.width = '5%';
      await ensureWorkers();

      /* ✅ تحقق: عدد الأعمدة لازم 5 خطوط داخلية */
      if(V.length !== 5){
        throw new Error('عدد الأعمدة يجب أن يكون 6 (' + (V.length + 1) + ' حالياً). اسحب الخطوط الحمراء للتعديل أو اضغط "إعادة الاكتشاف".');
      }

      var B = [L].concat(V).concat([R]);
      var total = (Hs.length - 1) * 6;
      var done = 0;
      rows = []; cellConf = [];

      for(var r = 0; r < Hs.length - 1; r++){
        var rowObj = {}, confRow = {};
        for(var c = 0; c < 6; c++){
          var field = COLS[c];
          var isNum = !!NUMERIC_FIELDS[field];
          var isDetails = field === 'details';
          var scale = isNum ? 4 : (isDetails ? 2 : 3);
          var crop = cropCell(B[c], Hs[r], B[c+1], Hs[r+1], scale);

          if(crop.empty){
            rowObj[field] = '';
            confRow[field] = { conf: 0, warn: (field === 'code' || field === 'name') };
          } else if(isNum){
            var resNum = await readNumeric(crop.canvas, field);
            rowObj[field] = resNum.text;
            confRow[field] = { conf: resNum.conf, warn: resNum.warn };
          } else if(isDetails){
            var resDet = await readDetails(crop.canvas);
            rowObj[field] = resDet.text;
            confRow[field] = { conf: resDet.conf, warn: resDet.warn };
          } else {
            var resTxt = await readText(crop.canvas);
            rowObj[field] = resTxt.text;
            confRow[field] = { conf: resTxt.conf, warn: resTxt.warn };
          }
          done++;
          barEl.style.width = (10 + Math.round((done/total)*88)) + '%';
          textEl.textContent = '⏳ قراءة الخلايا... ' + Math.round((done/total)*100) + '%';
        }
        rows.push(rowObj);
        cellConf.push(confRow);
      }

      barEl.style.width = '100%';
      textEl.textContent = '✅ استُخرجت ' + rows.length + ' صفوف';

      modal.querySelector('#ocrgTableWrap').style.display = 'block';
      modal.querySelector('#ocrgStatus').textContent = 'راجع البيانات (الخلايا الصفراء تحتاج تحقق)، ثم اضغط "تطبيق".';
      renderTable();
      modal.querySelector('.ocrg-modal').scrollTop = 9999;

    } catch(err){
      console.error(err);
      textEl.textContent = '❌ فشل: ' + err.message;
      textEl.style.color = 'var(--red)';
      toast('فشل الاستخراج: ' + err.message, 'warn', 4000);
    } finally {
      busy = false;
    }
  }

  function renderTable(){
    var body = modal.querySelector('#ocrgTableBody');
    body.innerHTML = '';
    rows.forEach(function(row, i){
      var tr = document.createElement('tr');
      FIELDS.forEach(function(f){
        var td = document.createElement('td');
        td.contentEditable = 'true';
        td.textContent = row[f] || '';
        if(f === 'details') td.className = 'ocrg-det';
        if(f === 'name')    td.className = 'ocrg-nm';
        td.dir = NUMERIC_FIELDS[f] ? 'ltr' : 'rtl';
        var conf = cellConf[i] && cellConf[i][f];
        if(conf){
          var badge = document.createElement('span');
          badge.className = 'ocrg-conf ' + (conf.conf >= 85 ? 'good' : conf.conf >= 65 ? 'mid' : 'low');
          badge.textContent = Math.round(conf.conf) + '%';
          td.appendChild(badge);
          if(conf.warn) td.classList.add(conf.conf >= 50 ? 'ocrg-warn' : 'ocrg-bad');
        }
        td.addEventListener('input', function(){
          row[f] = td.textContent;
          td.classList.remove('ocrg-warn','ocrg-bad');
        });
        tr.appendChild(td);
      });
      var delTd = document.createElement('td');
      var delBtn = document.createElement('button');
      delBtn.className = 'ocrg-del';
      delBtn.textContent = '✕';
      delBtn.onclick = function(){ rows.splice(i,1); cellConf.splice(i,1); renderTable(); };
      delTd.appendChild(delBtn);
      tr.appendChild(delTd);
      body.appendChild(tr);
    });
  }

  /* ============ مطابقة DB مع aliases ============ */
  function matchCourseInDB(row){
    var DB = window.COURSES_DB || {};
    var code = toEnDigits(fixDigitsOCR(row.code)).replace(/\D/g,'');
    var name = String(row.name || '').trim();

    if(code && code.length >= 8){
      var cleanCode = code.replace(/^0+/, '');
      for(var k in DB){
        var info = DB[k];
        /* الكود الأساسي */
        if(String(info.code || '').replace(/^0+/, '') === cleanCode) return k;
        /* ✅ aliases */
        if(Array.isArray(info.aliases)){
          for(var ai = 0; ai < info.aliases.length; ai++){
            if(String(info.aliases[ai]).replace(/^0+/, '') === cleanCode) return k;
          }
        }
      }
      /* استخدم الدالة الجاهزة */
      if(typeof window.findCourseByCode === 'function'){
        var r = window.findCourseByCode(code);
        if(r && r.name) return r.name;
      }
    }

    if(name && DB[name]) return name;

    if(name.length >= 3){
      var norm = function(s){
        return String(s||'')
          .replace(/[\u064B-\u0652]/g,'')
          .replace(/[أإآ]/g,'ا')
          .replace(/ة/g,'ه')
          .replace(/\s+/g,' ')
          .trim();
      };
      var nameN = norm(name);
      var bestKey = null, bestScore = 0;
      for(var k2 in DB){
        var keyN = norm(k2);
        if(keyN.length >= 6){
          if(keyN.indexOf(nameN) > -1 || nameN.indexOf(keyN) > -1){
            var score = Math.min(keyN.length, nameN.length);
            if(score > bestScore){ bestScore = score; bestKey = k2; }
          }
        }
      }
      if(bestKey) return bestKey;
    }
    return null;
  }

  function applyToTimetable(){
    if(!rows.length){ toast('لا توجد بيانات', 'warn'); return; }
    var sp = window.space;
    if(!sp){ toast('لم يتم تحميل البيانات', 'warn'); return; }
    if(!sp.timetable) sp.timetable = {};
    if(!sp.courses)   sp.courses   = [];
    if(!sp.attendance) sp.attendance = {};

    var added = 0, coursesAdded = 0, skipped = 0;

    rows.forEach(function(row){
      var matchedName = matchCourseInDB(row);
      var finalName = matchedName || row.name;
      if(!finalName || finalName.length < 2){ skipped++; return; }

      var parsed = parseAndRebuildDetails(row.details);
      var time = parsed.time || parseTimeRange(row.details);
      var days = parsed.days.length ? parsed.days : extractDays(row.details);
      var room = parsed.room || extractRoom(row.details);
      var hours = parseInt(toEnDigits(row.hours).replace(/\D/g,''), 10) || 3;
      var code = toEnDigits(fixDigitsOCR(row.code)).replace(/\D/g,'');

      if(days.length && time){
        days.forEach(function(day){
          var key = day + '-' + time.start;
          if(!sp.timetable[key]){
            sp.timetable[key] = { name: finalName, room: room, instructor: '' };
            added++;
          }
        });
      } else {
        skipped++;
      }

      var exists = sp.courses.some(function(c){ return c.name === finalName; });
      if(!exists){
        sp.courses.push({
          id: uid(), name: finalName,
          code: code || '',
          hours: hours,
          instructor: '', room: room
        });
        coursesAdded++;
      }
      if(!sp.attendance[finalName]) sp.attendance[finalName] = { present: 0, absent: 0 };
    });

    if(typeof window.saveSpace === 'function') window.saveSpace();
    try{ if(window.renderTimetable)   window.renderTimetable();   }catch(e){}
    try{ if(window.renderCourses)     window.renderCourses();     }catch(e){}
    try{ if(window.renderAttendance)  window.renderAttendance();  }catch(e){}
    try{ if(window.renderDashboard)   window.renderDashboard();   }catch(e){}

    var msg = '✅ ' + added + ' محاضرة، ' + coursesAdded + ' مادة' + (skipped ? ' — تم تجاهل ' + skipped : '');
    modal.querySelector('#ocrgStatus').textContent = msg;
    toast(msg, 'success', 4000);

    if(added > 0){
      setTimeout(function(){
        closeModal();
        if(window.switchTab) window.switchTab('timetable');
      }, 900);
    }
  }

  /* ============ الربط ============ */
  function bindToUploadZone(){
    var zone = document.getElementById('uploadZone');
    if(!zone) return false;
    if(zone._ocrgBound) return true;

    var parent = zone.parentNode;
    var clean = zone.cloneNode(true);
    parent.replaceChild(clean, zone);
    clean._ocrgBound = true;

    ['btnParseOcr','btnPasteOcr'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.style.display = 'none';
    });

    clean.addEventListener('click', function(e){
      if(e.target.tagName === 'INPUT') return;
      e.preventDefault();
      openModal();
    });
    console.log('📸 ocr-grid v6: bound');
    return true;
  }

  function install(){ if(bindToUploadZone()) return; setTimeout(install, 400); }

  window.ocrGrid = {
    open: openModal,
    close: closeModal,
    parseTimeRange: parseTimeRange,
    parseAndRebuildDetails: parseAndRebuildDetails,
    detect: detect
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 300); });
  } else setTimeout(install, 300);
  setTimeout(install, 1200);
  setTimeout(install, 2500);

  console.log('📸 ocr-grid.js v6 loaded — HU-tuned columns');
})();