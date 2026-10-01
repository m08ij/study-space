/* ============================================================
   📸 ocr-grid.js v2 — نظام القراءة التفاعلي (Grid-Based OCR)
   ✅ استراتيجية "قسّم ثم اقرأ" مع معالجة احترافية لكل خلية
   ✅ Multi-PSM + Otsu Thresholding + Smart Repair + Confidence
   ============================================================ */
(function(){
  'use strict';
  if(window._ocrGridLoaded) return;
  window._ocrGridLoaded = true;

  /* ================== ثوابت ================== */
  var FIELDS  = ['code','name','theory','lab','details','hours'];
  var COLS    = ['hours','details','lab','theory','name','code'];
  var COLNAME = ['الساعات','الوقت والقاعة','العملي','النظري','اسم المادة','رقم المادة'];
  var NUMERIC_FIELDS = { code:1, theory:1, lab:1, hours:1 };
  /* نسب مبدئية محسّنة لجدول الجامعة (6 أعمدة) */
  var DEF_FRAC = [0.072, 0.615, 0.672, 0.740, 0.900];

  /* قاموس تصحيح OCR الشائع */
  var SPELL_FIX = [
    [/\bمايكر\s*وسوفت\b/g, 'مايكروسوفت'],
    [/\bمايكرو\s*سوفت\b/g, 'مايكروسوفت'],
    [/\bمايكروسفت\b/g, 'مايكروسوفت'],
    [/\bمايكروسوف\b/g, 'مايكروسوفت'],
    [/\b(تيامز|تيمز|teems|Тeams)\b/g, 'teams'],
    [/\bاستدراكيه\b/g, 'استدراكية'],
    [/\bفيزياء\s+عامه\b/g, 'فيزياء عامة'],
    [/\bتفاضل\s+وتكامل\s*\(\s*[١1]\s*\)/g, 'تفاضل وتكامل (1)'],
    [/\bلغه\b/g, 'لغة'],
    [/\bعربيه\b/g, 'عربية'],
    [/\bانجليزيه\b/g, 'انجليزية'],
    [/\bالحسين\s+البانى\b/g, 'الحسين الباني'],
    [/\bابن\s+خلدون\b/g, 'ابن خلدون']
  ];

  /* ================== حالة عامة ================== */
  var im = null, L = 0, R = 0, V = [], Hs = [], S = 1, drag = null;
  var rows = [], cellConf = [];  /* مصفوفة ثقة [rowIndex][field] = {score, warn} */
  var cv = null, ctx = null;
  var workerAr = null, workerEn = null;
  var busy = false;
  var modal = null;
  var imgBlobForCanvas = null;

  /* ================== أدوات مساعدة ================== */
  function toast(m,t,d){ if(typeof window.toast === 'function') window.toast(m, t||'info', d||2500); }
  function uid(){ return (window.uid ? window.uid() : Date.now().toString(36)+Math.random().toString(36).slice(2,6)); }
  function pad2(n){ return String(n).padStart(2,'0'); }

  /* أرقام عربية → إنجليزية */
  function toEnDigits(s){
    return String(s||'').replace(/[٠-٩]/g, function(d){
      return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48);
    });
  }

  /* إصلاح RTL للوقت: "10,30 - 09,30" → {start:'09:30', end:'10:30'} */
  function parseTimeRange(text){
    if(!text) return null;
    var t = toEnDigits(text);
    /* قبول , أو . أو : كفاصل */
    var re = /(\d{1,2})\s*[:.,]\s*(\d{2})\s*[-–—~to]+\s*(\d{1,2})\s*[:.,]\s*(\d{2})/i;
    var m = t.match(re);
    if(!m) return null;
    var h1 = +m[1], mm1 = +m[2], h2 = +m[3], mm2 = +m[4];
    if(h1 > 23 || h2 > 23 || mm1 > 59 || mm2 > 59) return null;
    /* مقارنة عددية → دائماً ابدأ الأصغر */
    var t1 = h1 * 60 + mm1, t2 = h2 * 60 + mm2;
    var start = Math.min(t1, t2), end = Math.max(t1, t2);
    /* إذا كانت المدة سالبة أو صفرية، اعكس */
    if(end - start > 6 * 60) return null;
    return {
      start: pad2(Math.floor(start/60)) + ':' + pad2(start % 60),
      end:   pad2(Math.floor(end/60)) + ':' + pad2(end % 60)
    };
  }

  /* أيام الأسبوع من حروف عربية */
  function extractDays(text){
    var DAY_LETTER = { 'ح':'Sun','ن':'Mon','ث':'Tue','ر':'Wed','خ':'Thu','ج':'Fri','س':'Sat' };
    var ORDER = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var m = String(text||'').match(/([حنثرخجس](?:\s*[حنثرخجس])*)\s*[\/\\]/);
    if(!m) return [];
    var out = [];
    m[1].replace(/\s/g,'').split('').forEach(function(ch){
      var d = DAY_LETTER[ch];
      if(d && out.indexOf(d) === -1) out.push(d);
    });
    return out.sort(function(a,b){ return ORDER.indexOf(a) - ORDER.indexOf(b); });
  }

  /* إصلاح أرقام القاعات المقسومة: "ح.ب / 4" → "ح.ب 104" */
  function fixRoomNumber(text){
    if(!text) return text;
    /* جمع الأنماط المشتركة: ح.ب / 4 + 10 في مكان آخر → 104 */
    /* انظر أيضاً للحالة: "م.غ / 213" و "ح.ب 105" */
    var t = String(text);
    /* حالة 1: كلمة قصيرة + / + رقم صغير = غالباً رقم قاعة مقطوع */
    /* ابحث عن تسلسل "حرف/رقم" واجمعه مع أي "رقم" قريب في نفس السطر */
    return t;
  }

  /* تنظيف عام للنصوص العربية */
  function cleanArabic(text){
    if(!text) return '';
    var t = String(text).trim();
    /* توحيد المسافات */
    t = t.replace(/\s+/g, ' ');
    /* إزالة رموز مشوهة */
    t = t.replace(/[|¦ـ]{2,}/g, ' ');
    /* تطبيق الإصلاحات الإملائية */
    SPELL_FIX.forEach(function(pair){
      t = t.replace(pair[0], pair[1]);
    });
    /* إزالة المسافات حول الفواصل */
    t = t.replace(/\s*\/\s*/g, ' / ');
    t = t.replace(/\s*-\s*/g, ' - ');
    t = t.replace(/\s*\(\s*/g, ' (').replace(/\s*\)\s*/g, ') ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  /* ================== تحميل Tesseract ================== */
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

  /* ================== CSS ================== */
  function injectCSS(){
    if(document.getElementById('ocrg-css')) return;
    var s = document.createElement('style');
    s.id = 'ocrg-css';
    s.textContent = `
      .ocrg-backdrop{position:fixed;inset:0;z-index:550;background:rgba(0,0,0,.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;animation:ocrgFade .25s ease}
      @keyframes ocrgFade{from{opacity:0}to{opacity:1}}
      .ocrg-modal{background:var(--card);border:1px solid var(--border);border-radius:20px;width:96vw;max-width:1200px;max-height:94vh;overflow-y:auto;padding:22px;box-shadow:var(--shadow-lg);position:relative;animation:ocrgPop .3s ease}
      @keyframes ocrgPop{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .ocrg-modal::before{content:'';position:absolute;top:0;right:0;left:0;height:3px;background:var(--grad);border-radius:20px 20px 0 0}
      .ocrg-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px}
      .ocrg-header h3{margin:0;font-size:1.1rem;color:var(--cyan)}
      .ocrg-close{width:36px;height:36px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--muted);font-size:1.2rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;transition:.2s}
      .ocrg-close:hover{border-color:var(--red);color:var(--red)}
      .ocrg-hint{color:var(--muted);font-size:.82rem;margin-bottom:10px;line-height:1.75;background:var(--grad-soft);padding:11px 15px;border-radius:11px;border:1px solid var(--glow)}
      .ocrg-hint b{color:var(--cyan)}
      .ocrg-drop{border:2px dashed var(--border2);border-radius:14px;padding:48px 20px;text-align:center;cursor:pointer;background:var(--bg2);transition:.25s;font-size:1rem;color:var(--muted)}
      .ocrg-drop:hover{border-color:var(--cyan);background:var(--grad-soft);color:var(--cyan);transform:scale(1.01)}
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
      .ocrg-table .ocrg-del:hover{background:rgba(239,68,68,.12);border-radius:6px}
      .ocrg-status{margin-top:12px;text-align:center;font-size:.85rem;font-weight:700;color:var(--muted);min-height:1.4em;line-height:1.7}
      @media(max-width:600px){.ocrg-modal{padding:14px;border-radius:14px}.ocrg-header h3{font-size:.95rem}}
    `;
    document.head.appendChild(s);
  }

  /* ================== فتح/إغلاق المودال ================== */
  function openModal(){
    injectCSS();
    document.querySelectorAll('.ocrg-backdrop').forEach(function(m){ m.remove(); });

    modal = document.createElement('div');
    modal.className = 'ocrg-backdrop';
    modal.innerHTML =
      '<div class="ocrg-modal" role="dialog" aria-modal="true">' +
        '<div class="ocrg-header">' +
          '<h3>📸 استخراج الجدول من صورة (تفاعلي)</h3>' +
          '<button class="ocrg-close" id="ocrgClose" aria-label="إغلاق">✕</button>' +
        '</div>' +
        '<div id="ocrgDrop" class="ocrg-drop">' +
          '<span class="ocrg-drop-icon">📤</span>' +
          'اسحب صورة الجدول هنا، أو اضغط للاختيار' +
          '<input type="file" id="ocrgFile" accept="image/*" hidden>' +
        '</div>' +
        '<div id="ocrgEditor" style="display:none">' +
          '<p class="ocrg-hint">' +
            '🎯 <b>الخطوط الحمراء</b> = الأعمدة، <b>الخطوط الخضراء</b> = الصفوف. ' +
            'اسحبها لتطابق الجدول. <b>نقر مزدوج</b> على خط أخضر لحذفه. ' +
            '<br>💡 كل خلية تُقرأ منفصلة → دقة أعلى.' +
          '</p>' +
          '<div class="ocrg-canvas-wrap"><canvas id="ocrgCanvas"></canvas></div>' +
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

  /* ================== تحميل الصورة + الاكتشاف ================== */
  function loadImage(file){
    if(!file || !file.type.startsWith('image/')) return;
    imgBlobForCanvas = file;
    var img = new Image();
    img.onload = function(){
      im = img;
      modal.querySelector('#ocrgDrop').style.display = 'none';
      modal.querySelector('#ocrgEditor').style.display = 'block';
      modal.querySelector('#ocrgTableWrap').style.display = 'none';
      cv = modal.querySelector('#ocrgCanvas');
      ctx = cv.getContext('2d');
      detect();
      draw();
      /* بعد الرسم، فعّل أحداث السحب */
      setTimeout(bindCanvasEvents, 80);
    };
    img.onerror = function(){ toast('تعذّر تحميل الصورة', 'warn'); };
    img.src = URL.createObjectURL(file);
  }

  /* الكشف التلقائي عن الترويسة وحدود الصفوف */
  function detect(){
    var W = im.naturalWidth, H = im.naturalHeight;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    var p = x.getImageData(0, 0, W, H).data;
    var lum = function(i){ return .3*p[i] + .59*p[i+1] + .11*p[i+2]; };
    var isBlue = function(i){ return (p[i+2] - p[i] > 50) && p[i+2] > 140; };

    /* ترويسة زرقاء */
    var b0 = -1, b1 = -1;
    for(var y = 0; y < H; y++){
      var n = 0;
      for(var xx = 0; xx < W; xx += 2) if(isBlue((y*W + xx)*4)) n++;
      if(n > W*0.15){ if(b0 < 0) b0 = y; b1 = y; }
      else if(b0 >= 0) break;
    }

    /* حدود الجدول */
    L = 0; R = W - 1;
    if(b0 >= 0){
      var mn = W, mx = 0;
      for(var x2 = 0; x2 < W; x2++){
        if(isBlue(((b0+2)*W + x2)*4)){ if(x2 < mn) mn = x2; if(x2 > mx) mx = x2; }
      }
      if(mx > mn){ L = mn; R = mx; }
    }

    /* حدود الصفوف (تغيرات سطوع) */
    var top = b1 + 1;
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

    /* مواضع الأعمدة المبدئية */
    V = DEF_FRAC.map(function(f){ return Math.round(L + f*(R - L)); });
  }

  /* ================== الرسم ================== */
  function draw(){
    if(!im || !cv) return;
    S = Math.min(1, 1100 / im.naturalWidth);
    cv.width  = Math.round(im.naturalWidth  * S);
    cv.height = Math.round(im.naturalHeight * S);
    ctx.drawImage(im, 0, 0, cv.width, cv.height);

    ctx.lineWidth = 2;
    ctx.font = 'bold 13px Tahoma, sans-serif';
    ctx.textAlign = 'center';

    var B = [L].concat(V).concat([R]);

    /* أعمدة حمراء */
    ctx.strokeStyle = '#e5484d';
    V.forEach(function(v){
      ctx.beginPath();
      ctx.moveTo(v*S, 0);
      ctx.lineTo(v*S, cv.height);
      ctx.stroke();
    });

    /* صفوف خضراء */
    ctx.strokeStyle = '#12a150';
    Hs.forEach(function(y){
      ctx.beginPath();
      ctx.moveTo(L*S, y*S);
      ctx.lineTo(R*S, y*S);
      ctx.stroke();
    });

    /* أسماء الأعمدة */
    ctx.fillStyle = '#e5484d';
    COLNAME.forEach(function(n, i){
      var cx = ((B[i] + B[i+1]) / 2) * S;
      ctx.fillText(n, cx, cv.height - 6);
    });
  }

  /* ================== تفاعل السحب على الـ canvas ================== */
  function canvasPos(e){
    var r = cv.getBoundingClientRect();
    var k = cv.width / r.width / S;
    return { x:(e.clientX - r.left) * k, y:(e.clientY - r.top) * k };
  }
  function hitTest(p){
    for(var vi = 0; vi < V.length; vi++){
      if(Math.abs(V[vi] - p.x) < 14/S) return { t:'v', i:vi };
    }
    for(var hi = 0; hi < Hs.length; hi++){
      if(Math.abs(Hs[hi] - p.y) < 14/S && p.x >= L - 20 && p.x <= R + 20) return { t:'h', i:hi };
    }
    return null;
  }
  function bindCanvasEvents(){
    if(!cv || cv._ocrgBound) return;
    cv._ocrgBound = true;
    cv.addEventListener('pointerdown', function(e){
      var p = canvasPos(e);
      var h = hitTest(p);
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
        drag = null;
        draw();
      }
    });
    cv.addEventListener('dblclick', function(e){
      var p = canvasPos(e);
      var h = hitTest(p);
      if(h && h.t === 'h' && Hs.length > 2){ Hs.splice(h.i, 1); draw(); }
    });
  }

  /* ============================================================
     معالجة الخلايا — الجزء الأهم
     ============================================================ */

  /* 1) قص الخلية + إزالة الهوامش البيضاء + Otsu Thresholding */
  function cropCell(x0, y0, x1, y1, scale){
    var w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0);
    var pad = 10;

    /* ارسم الخلية على canvas مؤقت */
    var tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    var tg = tmp.getContext('2d');
    tg.drawImage(im, x0, y0, w, h, 0, 0, w, h);

    /* اقرأ البيانات */
    var imageData = tg.getImageData(0, 0, w, h);
    var d = imageData.data;

    /* 1) Grayscale + حساب هيستوغرام */
    var hist = new Array(256).fill(0);
    var totalPx = w * h;
    for(var i = 0; i < d.length; i += 4){
      var l = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]) | 0;
      d[i] = d[i+1] = d[i+2] = l;
      hist[l]++;
    }

    /* 2) Otsu Threshold */
    var sum = 0;
    for(var t2 = 0; t2 < 256; t2++) sum += t2 * hist[t2];
    var sumB = 0, wB = 0, maxVar = 0, otsuThreshold = 128;
    for(var t3 = 0; t3 < 256; t3++){
      wB += hist[t3];
      if(wB === 0) continue;
      var wF = totalPx - wB;
      if(wF === 0) break;
      sumB += t3 * hist[t3];
      var mB = sumB / wB;
      var mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if(between > maxVar){ maxVar = between; otsuThreshold = t3; }
    }

    /* 3) تطبيق العتبة + إزالة الهوامش البيضاء */
    var minX = w, maxX = 0, minY = h, maxY = 0;
    for(var y2 = 0; y2 < h; y2++){
      for(var x2 = 0; x2 < w; x2++){
        var idx = (y2 * w + x2) * 4;
        var val = d[idx] > otsuThreshold ? 255 : 0;
        d[idx] = d[idx+1] = d[idx+2] = val;
        if(val === 0){
          if(x2 < minX) minX = x2;
          if(x2 > maxX) maxX = x2;
          if(y2 < minY) minY = y2;
          if(y2 > maxY) maxY = y2;
        }
      }
    }
    tg.putImageData(imageData, 0, 0);

    /* إذا ما في نص أسود، رجّع الصورة الأصلية بدون تكبير */
    if(maxX <= minX || maxY <= minY){
      return { canvas: tmp, empty: true };
    }

    /* 4) اعمل canvas جديد بدون الهوامش + تكبير + حشوة بيضاء */
    var trimW = maxX - minX + 1;
    var trimH = maxY - minY + 1;
    var outW = Math.round(trimW * scale) + pad * 2;
    var outH = Math.round(trimH * scale) + pad * 2;
    var out = document.createElement('canvas');
    out.width = outW; out.height = outH;
    var og = out.getContext('2d');
    og.fillStyle = '#fff';
    og.fillRect(0, 0, outW, outH);
    og.imageSmoothingEnabled = false; /* مهم: بدون تنعيم ليبقى النص حاد */
    og.drawImage(tmp, minX, minY, trimW, trimH, pad, pad, trimW * scale, trimH * scale);

    return { canvas: out, empty: false };
  }

  /* 2) تشغيل Tesseract على خلية بعدة PSM واختيار الأفضل */
  async function readCell(cellCanvas, worker, psmModes, whitelist){
    var best = null;
    for(var i = 0; i < psmModes.length; i++){
      try{
        var params = { tessedit_pageseg_mode: String(psmModes[i]) };
        if(whitelist) params.tessedit_char_whitelist = whitelist;
        await worker.setParameters(params);
        var res = await worker.recognize(cellCanvas);
        var txt = (res && res.data && res.data.text) ? res.data.text : '';
        var conf = (res && res.data && typeof res.data.confidence === 'number') ? res.data.confidence : 0;
        if(!best || conf > best.conf){
          best = { text: txt, conf: conf };
        }
        /* إذا الثقة عالية، لا داعي لتجربة باقي الأوضاع */
        if(conf > 85) break;
      }catch(e){ /* جرّب الوضع التالي */ }
    }
    return best || { text: '', conf: 0 };
  }

  /* 3) قراءة خلية رقمية */
  async function readNumericCell(canvas, expectedLen){
    var r = await readCell(canvas, workerEn, [7, 6, 8], '0123456789');
    var digits = toEnDigits(r.text).replace(/\D/g, '');
    return {
      text: digits,
      conf: r.conf,
      warn: (expectedLen && digits.length && digits.length !== expectedLen) || digits.length === 0
    };
  }

  /* 4) قراءة خلية نصية (عربي) */
  async function readTextCell(canvas){
    var r = await readCell(canvas, workerAr, [6, 7, 4], null);
    var txt = cleanArabic(r.text);
    return {
      text: txt,
      conf: r.conf,
      warn: r.conf < 65 || txt.length < 3
    };
  }

  /* 5) قراءة خلية وقت/قاعة (مختلط) */
  async function readDetailsCell(canvas){
    var r = await readCell(canvas, workerAr, [6, 7, 4], null);
    var txt = cleanArabic(r.text);
    /* إصلاح رقم القاعة المقطوع: "ح.ب / 4" عند وجود "ح.ب" آخر في النص */
    txt = repairRoomNumbers(txt);
    return {
      text: txt,
      conf: r.conf,
      warn: r.conf < 60 || !parseTimeRange(txt)
    };
  }

  /* إصلاح أرقام القاعات: حالة "ح.ب / 4" و "ح.ب 10" في نفس السطر */
  function repairRoomNumbers(text){
    if(!text) return text;
    /* ابحث عن نمط "XX / N" حيث N رقم صغير (1-9) — قد يكون جزء من رقم مقطوع */
    /* وإذا وجدنا "XX NY" بنفس السطر، نجمعهم */
    /* النمط الشائع: "ح.ب / 4 / على منصة ... 10" → "ح.ب 104" */
    /* النمط الآخر: "ح.ب / 4" فقط → نتركه كما هو */
    /* نمط "ح.ب 105" → يبقى كما هو */

    /* حالة خاصة: "XX / N ... N2" حيث N و N2 فرديان */
    var re1 = /([حمنر][.\s]?[بغبجمع])\s*\/\s*(\d)\s+(.{3,80}?)\s+(\d)(?=\s|$)/;
    var m = re1.exec(text);
    if(m){
      var roomNumber = m[2] + m[4];
      if(roomNumber.length === 3){
        text = text.replace(m[0], m[1] + ' ' + roomNumber + ' ' + m[3].trim() + ' ');
      }
    }

    /* حالة: "XX / N" بنهاية الجملة حيث N رقم فردي */
    /* لا نصلحها لأنها قد تكون رقم قاعة فعلاً */

    return text.replace(/\s+/g, ' ').trim();
  }

  /* ================== التحميل المسبق للنماذج ================== */
  async function ensureWorkers(){
    await loadTesseract();
    if(!workerAr){
      workerAr = await window.Tesseract.createWorker('ara+eng', 1);
    }
    if(!workerEn){
      workerEn = await window.Tesseract.createWorker('eng', 1);
    }
  }

  /* ================== الاستخراج الرئيسي ================== */
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
      textEl.textContent = '⏳ تحميل محرك Tesseract (قد يستغرق دقيقة أول مرة)...';
      barEl.style.width = '5%';
      await ensureWorkers();

      var B = [L].concat(V).concat([R]);
      var total = (Hs.length - 1) * 6;
      var done = 0;
      rows = [];
      cellConf = [];

      for(var r = 0; r < Hs.length - 1; r++){
        var rowObj = {};
        var confRow = {};
        for(var c = 0; c < 6; c++){
          var field = COLS[c];
          var isNum = !!NUMERIC_FIELDS[field];
          var isDetails = field === 'details';
          /* اسم المادة والوقت يحتاجان تكبير أعلى، الأرقام أعلى */
          var scale = isNum ? 4 : 3;

          var crop = cropCell(B[c], Hs[r], B[c+1], Hs[r+1], scale);

          if(crop.empty){
            rowObj[field] = '';
            confRow[field] = { conf: 0, warn: true };
          } else if(isNum){
            var expectedLen = field === 'code' ? null : 1;
            var resNum = await readNumericCell(crop.canvas, expectedLen);
            rowObj[field] = resNum.text;
            confRow[field] = { conf: resNum.conf, warn: resNum.warn };
          } else if(isDetails){
            var resDet = await readDetailsCell(crop.canvas);
            rowObj[field] = resDet.text;
            confRow[field] = { conf: resDet.conf, warn: resDet.warn };
          } else {
            var resTxt = await readTextCell(crop.canvas);
            rowObj[field] = resTxt.text;
            confRow[field] = { conf: resTxt.conf, warn: resTxt.warn };
          }

          done++;
          barEl.style.width = (10 + Math.round((done / total) * 88)) + '%';
          textEl.textContent = '⏳ قراءة الخلايا... ' + Math.round((done / total) * 100) + '%';
        }
        rows.push(rowObj);
        cellConf.push(confRow);
      }

      barEl.style.width = '100%';
      textEl.textContent = '✅ تم استخراج ' + rows.length + ' صفوف';

      modal.querySelector('#ocrgTableWrap').style.display = 'block';
      modal.querySelector('#ocrgStatus').textContent = 'راجع البيانات وصحّح أي خطأ، ثم اضغط "تطبيق على الجدول".';
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

  /* ================== عرض الجدول ================== */
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
        /* مؤشر الثقة */
        var conf = cellConf[i] && cellConf[i][f];
        if(conf){
          var badge = document.createElement('span');
          badge.className = 'ocrg-conf ' + (conf.conf >= 85 ? 'good' : conf.conf >= 65 ? 'mid' : 'low');
          badge.textContent = Math.round(conf.conf) + '%';
          td.appendChild(badge);
          if(conf.warn){
            td.classList.add(conf.conf >= 50 ? 'ocrg-warn' : 'ocrg-bad');
          }
        }
        td.addEventListener('input', function(){
          row[f] = td.textContent;
          /* إزالة التحذير عند التعديل اليدوي */
          td.classList.remove('ocrg-warn','ocrg-bad');
        });
        tr.appendChild(td);
      });
      var delTd = document.createElement('td');
      var delBtn = document.createElement('button');
      delBtn.className = 'ocrg-del';
      delBtn.textContent = '✕';
      delBtn.title = 'حذف الصف';
      delBtn.onclick = function(){ rows.splice(i, 1); cellConf.splice(i, 1); renderTable(); };
      delTd.appendChild(delBtn);
      tr.appendChild(delTd);
      body.appendChild(tr);
    });
  }

  /* ================== تطبيق على الجدول الأسبوعي ================== */
  function extractRoom(text){
    if(!text) return '';
    /* "ح.ب 104" أو "ح.ب 105" أو "م.غ 213" */
    var m = text.match(/([حمنر]\s*[.\s]\s*[بغبجمع])\s*(\d{2,4})/);
    if(m) return m[1].replace(/\s+/g,' ').trim() + ' ' + m[2];
    m = text.match(/[\/\\]\s*(\d{3,4})\b/);
    if(m) return m[1];
    return '';
  }

  function matchCourseInDB(row){
    var DB = window.COURSES_DB || {};
    var code = toEnDigits(row.code).replace(/^0+/, '').replace(/\D/g, '');
    var name = String(row.name || '').trim();

    if(code && code.length >= 8){
      for(var k in DB){
        if(String(DB[k].code || '').replace(/^0+/, '') === code) return k;
      }
    }
    if(name && DB[name]) return name;
    if(name.length >= 3){
      var norm = function(s){
        return String(s||'').replace(/[\u064B-\u0652]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
      };
      var nameN = norm(name);
      for(var k2 in DB){
        var keyN = norm(k2);
        if(keyN.length >= 6 && (keyN.indexOf(nameN) > -1 || nameN.indexOf(keyN) > -1)) return k2;
      }
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

      var time = parseTimeRange(row.details);
      var days = extractDays(row.details);
      var room = extractRoom(row.details);
      var hours = parseInt(toEnDigits(row.hours).replace(/\D/g,''), 10) || 3;
      var code = toEnDigits(row.code).replace(/\D/g,'');

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

      if(!sp.attendance[finalName]){
        sp.attendance[finalName] = { present: 0, absent: 0 };
      }
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

  /* ================== الربط مع واجهة الموقع ================== */
  function bindToUploadZone(){
    var zone = document.getElementById('uploadZone');
    if(!zone) return false;

    /* استبدل العنصر لنتخلص من كل الأحداث القديمة */
    var newZone = zone.cloneNode(true);
    zone.parentNode.replaceChild(newZone, zone);
    newZone._ocrgBound = true;

    /* أخفِ عناصر OCR القديمة */
    ['btnParseOcr','btnPasteOcr'].forEach(function(id){
      var el = document.getElementById(id);
      if(el){ el.style.display = 'none'; }
    });

    newZone.addEventListener('click', function(e){
      if(e.target.tagName === 'INPUT') return;
      e.preventDefault();
      openModal();
    });
    newZone.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openModal(); }
    });

    console.log('📸 ocr-grid v2: bound to uploadZone');
    return true;
  }

  function install(){
    if(bindToUploadZone()) return;
    setTimeout(install, 400);
  }

  window.ocrGrid = { open: openModal, close: closeModal };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 300); });
  } else {
    setTimeout(install, 300);
  }
  setTimeout(install, 1200);
  setTimeout(install, 2500);

  console.log('📸 ocr-grid.js v2 loaded');
})();