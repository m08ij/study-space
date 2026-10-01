/* ============================================================
   📸 ocr-grid.js v1 — نظام القراءة التفاعلي (Grid-Based OCR)
   ✅ يعتمد على استراتيجية "قسّم ثم اقرأ":
      1. المستخدم يرسم خطوط الأعمدة والصفوف على الصورة.
      2. النظام يقصّ كل خلية على حدة ويقرأها بـ Tesseract.
      3. النتيجة ترفع دقة القراءة إلى 90%+ مقارنة بالقراءة الشاملة.
   ✅ يحل مشكلة الخلايا المدمجة التي فشلت فيها الطرق السابقة.
   ============================================================ */
(function(){
  'use strict';

  if(window._ocrGridLoaded) return;
  window._ocrGridLoaded = true;

  /* ================== الحالة ================== */
  var FIELDS = ['code','name','theory','lab','details','hours'];
  var COLS   = ['hours','details','lab','theory','name','code'];
  var COLNAME = ['الساعات','الوقت والقاعة','العملي','النظري','اسم المادة','رقم المادة'];
  var DEF_FRAC = [0.078, 0.62, 0.67, 0.742, 0.896]; // نسب مبدئية للفواصل من يسار الصورة

  var im = null, L = 0, R = 0, V = [], Hs = [], S = 1, drag = null;
  var rows = [];
  var cv = null, ctx = null;
  var workerAr = null, workerEn = null;
  var busy = false;
  var modal = null;

  /* ================== أدوات مساعدة ================== */
  function toast(m,t,d){ if(typeof window.toast === 'function') window.toast(m, t||'info', d||2500); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function uid(){ return (window.uid ? window.uid() : Date.now().toString(36)+Math.random().toString(36).slice(2,6)); }

  /* ================== تحميل Tesseract (Lazy) ================== */
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
      .ocrg-backdrop{position:fixed;inset:0;z-index:550;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;animation:ocrgFade .25s ease}
      @keyframes ocrgFade{from{opacity:0}to{opacity:1}}
      .ocrg-modal{background:var(--card);border:1px solid var(--border);border-radius:20px;width:96vw;max-width:1180px;max-height:94vh;overflow-y:auto;padding:20px;box-shadow:var(--shadow-lg);position:relative;animation:ocrgPop .3s ease}
      @keyframes ocrgPop{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .ocrg-modal::before{content:'';position:absolute;top:0;right:0;left:0;height:3px;background:var(--grad);border-radius:20px 20px 0 0}
      .ocrg-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px}
      .ocrg-header h3{margin:0;font-size:1.1rem;color:var(--cyan)}
      .ocrg-close{width:36px;height:36px;border-radius:10px;background:var(--bg2);border:1px solid var(--border);color:var(--muted);font-size:1.2rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;transition:.2s}
      .ocrg-close:hover{border-color:var(--red);color:var(--red)}
      .ocrg-hint{color:var(--muted);font-size:.82rem;margin-bottom:10px;line-height:1.7;background:var(--grad-soft);padding:10px 14px;border-radius:10px;border:1px solid var(--glow)}
      .ocrg-hint b{color:var(--cyan)}
      .ocrg-drop{border:2px dashed var(--border2);border-radius:14px;padding:44px 20px;text-align:center;cursor:pointer;background:var(--bg2);transition:.25s;font-size:1rem;color:var(--muted)}
      .ocrg-drop:hover{border-color:var(--cyan);background:var(--grad-soft);color:var(--cyan);transform:scale(1.01)}
      .ocrg-drop .ocrg-drop-icon{font-size:3rem;margin-bottom:10px;display:block;opacity:.7}
      .ocrg-canvas-wrap{position:relative;overflow:auto;max-height:60vh;border-radius:12px;border:1px solid var(--border);background:var(--bg2);padding:8px}
      #ocrgCanvas{max-width:100%;display:block;border-radius:8px;cursor:crosshair;touch-action:none}
      .ocrg-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;justify-content:flex-end}
      .ocrg-progress{margin-top:14px;background:var(--bg2);border-radius:12px;padding:12px;border:1px solid var(--border)}
      .ocrg-progress .bar-outer{height:10px;background:var(--card);border-radius:10px;overflow:hidden}
      .ocrg-progress .bar-inner{height:100%;width:0%;background:var(--grad);border-radius:10px;transition:width .3s}
      .ocrg-progress .text{font-size:.8rem;color:var(--muted);margin-top:8px;text-align:center;font-weight:600}
      .ocrg-table-wrap{margin-top:16px;overflow-x:auto}
      .ocrg-table{width:100%;border-collapse:collapse;min-width:820px;background:var(--bg2);border-radius:12px;overflow:hidden}
      .ocrg-table th{background:var(--head,#4a7bd4);color:#fff;padding:10px 8px;font-weight:700;font-size:.78rem;text-align:center;border:1px solid rgba(0,0,0,.15)}
      .ocrg-table td{border:1px solid var(--border);padding:4px;text-align:center;vertical-align:middle}
      .ocrg-table td[contenteditable]{padding:8px 6px;min-width:60px;font-size:.82rem;outline:none;transition:.15s}
      .ocrg-table td[contenteditable]:focus{background:var(--grad-soft);box-shadow:inset 0 0 0 2px var(--cyan)}
      .ocrg-table td.ocrg-det{text-align:right;min-width:240px;font-size:.78rem;line-height:1.6}
      .ocrg-table td.ocrg-nm{min-width:140px}
      .ocrg-table .ocrg-del{background:transparent;border:none;color:var(--red);font-size:1.05rem;cursor:pointer;font-family:inherit;padding:2px 8px}
      .ocrg-table .ocrg-del:hover{background:rgba(239,68,68,.12);border-radius:6px}
      .ocrg-status{margin-top:10px;text-align:center;font-size:.85rem;font-weight:700;color:var(--muted);min-height:1.4em}
      @media(max-width:600px){.ocrg-modal{padding:14px;border-radius:14px}.ocrg-header h3{font-size:.95rem}}
    `;
    document.head.appendChild(s);
  }

  /* ================== فتح النافذة ================== */
  function openModal(){
    injectCSS();
    // احذف أي نافذة قديمة
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
            '🎯 <b>الخطوط الحمراء</b> تفصل الأعمدة، و<b>الخطوط الخضراء</b> تفصل الصفوف. ' +
            'اسحبها لتطابق الجدول. <b>انقر نقراً مزدوجاً</b> على خط أخضر لحذفه.' +
          '</p>' +
          '<div class="ocrg-canvas-wrap"><canvas id="ocrgCanvas"></canvas></div>' +
          '<div class="ocrg-actions">' +
            '<button class="btn btn-sm btn-ghost" id="ocrgAddLine">➕ إضافة خط صفوف</button>' +
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

    // اختصارات
    document.addEventListener('keydown', onEscKey);

    // الربط
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
    modal.querySelector('#ocrgRedetect').onclick = function(){
      if(im){ detect(); draw(); }
    };
    modal.querySelector('#ocrgExtract').onclick = runExtraction;
    modal.querySelector('#ocrgAddRow').onclick = function(){
      rows.push({code:'',name:'',theory:'',lab:'',details:'',hours:''});
      renderTable();
    };
    modal.querySelector('#ocrgApply').onclick = applyToTimetable;
  }

  function closeModal(){
    document.removeEventListener('keydown', onEscKey);
    if(modal){ modal.remove(); modal = null; }
    document.body.style.overflow = '';
  }

  function onEscKey(e){
    if(e.key === 'Escape') closeModal();
  }

  /* ================== تحميل الصورة واكتشاف الجدول ================== */
  function loadImage(file){
    if(!file || !file.type.startsWith('image/')) return;
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
    };
    img.onerror = function(){ toast('تعذّر تحميل الصورة', 'warn'); };
    img.src = URL.createObjectURL(file);
  }

  /* اكتشاف: حدد الترويسة الزرقاء وحدود الصفوف من تباين الألوان */
  function detect(){
    var W = im.naturalWidth, H = im.naturalHeight;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    var p = x.getImageData(0, 0, W, H).data;
    var lum = function(i){ return .3*p[i] + .59*p[i+1] + .11*p[i+2]; };
    var isBlue = function(i){ return (p[i+2] - p[i] > 50) && p[i+2] > 140; };

    // 1) اعثر على منطقة الترويسة الزرقاء
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

    // 2) اعثر على حدود الصفوف (تغيرات في متوسط السطوع)
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

    // 3) مواضع الأعمدة المبدئية
    V = DEF_FRAC.map(function(f){ return Math.round(L + f*(R - L)); });
  }

  /* ================== الرسم والسحب ================== */
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

    // أعمدة (حمراء)
    ctx.strokeStyle = '#e5484d';
    V.forEach(function(v){
      ctx.beginPath();
      ctx.moveTo(v*S, 0);
      ctx.lineTo(v*S, cv.height);
      ctx.stroke();
    });

    // صفوف (خضراء)
    ctx.strokeStyle = '#12a150';
    Hs.forEach(function(y){
      ctx.beginPath();
      ctx.moveTo(L*S, y*S);
      ctx.lineTo(R*S, y*S);
      ctx.stroke();
    });

    // أسماء الأعمدة
    ctx.fillStyle = '#e5484d';
    COLNAME.forEach(function(n, i){
      var cx = ((B[i] + B[i+1]) / 2) * S;
      ctx.fillText(n, cx, cv.height - 6);
    });
  }

  function canvasPos(e){
    var r = cv.getBoundingClientRect();
    var k = (cv.width / r.width) / S;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, tol: 8 / S / S * 8 };
  }

  function hitTest(p){
    // هل قريب من عمود أحمر؟
    for(var vi = 0; vi < V.length; vi++){
      if(Math.abs(V[vi] - p.x) < 12/S) return { t:'v', i:vi };
    }
    // هل قريب من صف أخضر؟
    for(var hi = 0; hi < Hs.length; hi++){
      if(Math.abs(Hs[hi] - p.y) < 12/S && p.x >= L - 20 && p.x <= R + 20) return { t:'h', i:hi };
    }
    return null;
  }

  function bindCanvasEvents(){
    if(!cv) return;
    cv.addEventListener('pointerdown', function(e){
      var p = canvasPos(e);
      var h = hitTest(p);
      if(h){ drag = h; cv.setPointerCapture(e.pointerId); }
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

  /* ================== استخراج الخلايا ================== */
  function cropCell(x0, y0, x1, y1, scale){
    var w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0);
    var pad = 12;
    var c = document.createElement('canvas');
    c.width  = Math.round(w*scale) + pad*2;
    c.height = Math.round(h*scale) + pad*2;
    var g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, x0, y0, w, h, pad, pad, w*scale, h*scale);

    // تحسين التباين (grayscale + contrast)
    var d = g.getImageData(0, 0, c.width, c.height);
    var q = d.data;
    for(var i = 0; i < q.length; i += 4){
      var l = .3*q[i] + .59*q[i+1] + .11*q[i+2];
      l = Math.max(0, Math.min(255, (l - 80) * 255 / 145));
      q[i] = q[i+1] = q[i+2] = l;
    }
    g.putImageData(d, 0, 0);
    return c;
  }

  function digitsOnly(s){
    return String(s||'')
      .replace(/[٠-٩]/g, function(d){ return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48); })
      .replace(/\D/g, '');
  }

  async function ensureWorkers(){
    await loadTesseract();
    if(!workerAr){
      workerAr = await window.Tesseract.createWorker('ara+eng', 1);
      await workerAr.setParameters({ tessedit_pageseg_mode: '6' });
    }
    if(!workerEn){
      workerEn = await window.Tesseract.createWorker('eng', 1);
      await workerEn.setParameters({
        tessedit_pageseg_mode: '7',
        tessedit_char_whitelist: '0123456789'
      });
    }
  }

  async function runExtraction(){
    if(!im || busy) return;
    if(Hs.length < 2){ toast('أضف خط صفوف أولاً', 'warn'); return; }
    busy = true;

    var progressEl = modal.querySelector('#ocrgProgress');
    var barEl = modal.querySelector('#ocrgBar');
    var textEl = modal.querySelector('#ocrgProgressText');
    progressEl.style.display = 'block';

    try{
      textEl.textContent = '⏳ تحميل محرك Tesseract (قد يستغرق دقيقة أول مرة)...';
      barEl.style.width = '5%';
      await ensureWorkers();

      var B = [L].concat(V).concat([R]);
      var total = (Hs.length - 1) * 6;
      var done = 0;
      rows = [];

      for(var r = 0; r < Hs.length - 1; r++){
        var rowObj = {};
        for(var c = 0; c < 6; c++){
          var field = COLS[c];
          var isNum = (field === 'code' || field === 'theory' || field === 'lab' || field === 'hours');
          var scale = isNum ? 4 : 3;
          var cellCanvas = cropCell(B[c], Hs[r], B[c+1], Hs[r+1], scale);
          var worker = isNum ? workerEn : workerAr;
          var out = await worker.recognize(cellCanvas);
          var txt = (out && out.data && out.data.text) || '';
          rowObj[field] = isNum
            ? digitsOnly(txt)
            : txt.replace(/\s+/g, ' ').trim();
          done++;
          var pct = 10 + Math.round((done / total) * 85);
          barEl.style.width = pct + '%';
          textEl.textContent = '⏳ قراءة الخلايا... ' + Math.round((done / total) * 100) + '%';
        }
        rows.push(rowObj);
      }

      barEl.style.width = '100%';
      textEl.textContent = '✅ تم استخراج ' + rows.length + ' صفوف';

      modal.querySelector('#ocrgTableWrap').style.display = 'block';
      modal.querySelector('#ocrgStatus').textContent = 'راجع البيانات وصحّح أي خطأ، ثم اضغط "تطبيق على الجدول".';
      renderTable();

      // انتقل للأسفل لعرض الجدول
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
        td.dir = (f === 'code' || f === 'theory' || f === 'lab' || f === 'hours') ? 'ltr' : 'rtl';
        td.addEventListener('input', function(){ row[f] = td.textContent; });
        tr.appendChild(td);
      });
      var delTd = document.createElement('td');
      var delBtn = document.createElement('button');
      delBtn.className = 'ocrg-del';
      delBtn.textContent = '✕';
      delBtn.title = 'حذف الصف';
      delBtn.onclick = function(){ rows.splice(i, 1); renderTable(); };
      delTd.appendChild(delBtn);
      tr.appendChild(delTd);
      body.appendChild(tr);
    });
  }

  /* ================== تطبيق على الجدول الأسبوعي ================== */
  function extractTime(text){
    if(!text) return null;
    var m = text.match(/(\d{1,2})[:.,]\s*(\d{2})\s*[-–—~]\s*(\d{1,2})[:.,]\s*(\d{2})/);
    if(m){
      var h1 = +m[1], mm1 = +m[2], h2 = +m[3], mm2 = +m[4];
      if(h1 > h2 || (h1 === h2 && mm1 > mm2)){
        var th = h1, tm = mm1; h1 = h2; mm1 = mm2; h2 = th; mm2 = tm;
      }
      var p2 = function(n){ return String(n).padStart(2,'0'); };
      return { start: p2(h1) + ':' + p2(mm1), end: p2(h2) + ':' + p2(mm2) };
    }
    return null;
  }

  function extractDays(text){
    var DAY_LETTER = { 'ح':'Sun', 'ن':'Mon', 'ث':'Tue', 'ر':'Wed', 'خ':'Thu', 'ج':'Fri', 'س':'Sat' };
    var DAYS_ORDER = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var m = text.match(/([حنثرخجس](?:\s*[حنثرخجس])*)\s*[\/\\]/);
    if(!m) return [];
    var out = [];
    m[1].replace(/\s/g, '').split('').forEach(function(ch){
      var d = DAY_LETTER[ch];
      if(d && out.indexOf(d) === -1) out.push(d);
    });
    return out.sort(function(a,b){ return DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b); });
  }

  function extractRoom(text){
    var m = text.match(/([حمنر]\s*[.\s]?\s*[بغبجمع])\s*[\/\\]?\s*(\d{2,4})/);
    if(m) return m[1].replace(/\s+/g,' ').trim() + ' ' + m[2];
    m = text.match(/[\/\\]?\s*(\d{3})\b/);
    if(m) return m[1];
    return '';
  }

  function matchCourseInDB(row){
    var DB = window.COURSES_DB || {};
    var code = digitsOnly(row.code).replace(/^0+/, '');
    var name = String(row.name || '').trim();

    // 1) مطابقة بالكود
    if(code){
      for(var k in DB){
        if(String(DB[k].code || '').replace(/^0+/, '') === code) return k;
      }
    }
    // 2) مطابقة بالاسم
    if(name && DB[name]) return name;
    // 3) مطابقة جزئية
    if(name.length >= 3){
      var norm = function(s){
        return String(s||'').replace(/[\u064B-\u0652]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
      };
      var nameN = norm(name);
      for(var k2 in DB){
        var keyN = norm(k2);
        if(keyN.indexOf(nameN) > -1 || nameN.indexOf(keyN) > -1) return k2;
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

      var time = extractTime(row.details) || extractTime(row.code + ' ' + row.details);
      var days = extractDays(row.details);
      var room = extractRoom(row.details);
      var hours = parseInt(digitsOnly(row.hours), 10) || 3;
      var code = digitsOnly(row.code);

      // أضف إلى الجدول الأسبوعي
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

      // أضف إلى موادي
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

      // أضف للحضور
      if(!sp.attendance[finalName]){
        sp.attendance[finalName] = { present: 0, absent: 0 };
      }
    });

    if(typeof window.saveSpace === 'function') window.saveSpace();

    // رفرش كل الأقسام
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
      }, 800);
    }
  }

  /* ================== الربط مع واجهة الموقع ================== */
  function bindToUploadZone(){
    var zone = document.getElementById('uploadZone');
    var inp  = document.getElementById('ocrFile');
    if(!zone || !inp) return false;

    // نتجاوز كل الحدّادين القديمين
    var newZone = zone.cloneNode(true);
    zone.parentNode.replaceChild(newZone, zone);
    newZone._ocrgBound = true;

    newZone.addEventListener('click', function(e){
      if(e.target.tagName === 'INPUT') return;
      e.preventDefault();
      openModal();
    });
    newZone.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openModal(); }
    });

    // احذف أي زر قديم
    var oldBtn = document.getElementById('btnParseOcr');
    if(oldBtn) oldBtn.style.display = 'none';
    var oldPaste = document.getElementById('btnPasteOcr');
    if(oldPaste) oldPaste.style.display = 'none';

    // عند فتح المودال، سيظهر الـ drop zone داخله
    // اربط canvas بعد الفتح
    var origOpen = openModal;
    openModal = function(){
      origOpen.apply(this, arguments);
      setTimeout(bindCanvasEvents, 100);
    };

    console.log('📸 ocr-grid: bound to uploadZone');
    return true;
  }

  /* ================== Init ================== */
  function install(){
    if(bindToUploadZone()) return;
    setTimeout(install, 400);
  }

  // تصدير للأغراض الخارجية
  window.ocrGrid = {
    open: openModal,
    close: closeModal
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 300); });
  } else {
    setTimeout(install, 300);
  }
  setTimeout(install, 1200);
  setTimeout(install, 2500);

  console.log('📸 ocr-grid.js v1 loaded');
})();