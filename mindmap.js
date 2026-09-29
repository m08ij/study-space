/* ============================================================
   🧠 mindmap.js — مولّد الخرائط الذهنية
   - يحوّل أي ملاحظة/مادة إلى mind map بصري
   - SVG rendering خفيف
   - قابل للتصدير PNG
   ============================================================ */
(function(){
  'use strict';

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

  /**
   * يبني شجرة من نص حر
   * - كل سطر = نقطة
   * - indent بـ "  " أو "-" = فرع
   * - ":" أو "=" = علاقة parent
   */
  function parseTextToTree(text){
    if(!text) return null;
    var lines = String(text).split(/\r?\n/).map(function(l){ return l.replace(/\t/g, '  '); }).filter(function(l){ return l.trim().length > 0; });

    var root = { label: 'الموضوع', children: [] };
    var stack = [{ node: root, indent: -1 }];

    lines.forEach(function(line){
      // نحدد الـ indent
      var indentMatch = line.match(/^(\s*)/);
      var indent = indentMatch ? indentMatch[1].length : 0;
      var content = line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '');

      // نتأكد إن الـ indent منطقي
      while(stack.length > 1 && stack[stack.length - 1].indent >= indent){
        stack.pop();
      }

      var node = { label: content, children: [] };
      stack[stack.length - 1].node.children.push(node);
      stack.push({ node: node, indent: indent });
    });

    // لو root فاضي، خذ أول عنصر كـ root
    if(root.children.length === 1 && root.children[0].children.length > 0){
      return root.children[0];
    }
    return root;
  }

  /**
   * يحوّل ملاحظة (title + body) لشجرة
   */
  function noteToTree(note){
    var root = { label: note.title || 'ملاحظة', children: [] };
    var body = note.body || '';
    if(!body) return root;

    var parsed = parseTextToTree(body);
    if(parsed && parsed.children) root.children = parsed.children;
    else if(parsed) root.children.push(parsed);

    return root;
  }

  /**
   * Layout للـ mind map (radial)
   */
  function layoutTree(root){
    var nodes = [];
    var links = [];
    var PADDING = 60;

    // حساب عدد الأوراق
    function countLeaves(node){
      if(!node.children || !node.children.length) return 1;
      return node.children.reduce(function(a, c){ return a + countLeaves(c); }, 0);
    }
    function maxDepth(node){
      if(!node.children || !node.children.length) return 1;
      return 1 + Math.max.apply(null, node.children.map(maxDepth));
    }

    var totalLeaves = countLeaves(root);
    var height = Math.max(600, totalLeaves * 44 + 100);
    var depth = maxDepth(root);
    var width = Math.max(700, depth * 180 + 200);

    // نضع root على اليسار
    var rootX = PADDING;
    var rootY = height / 2;

    var rootNode = { id: 'n0', x: rootX, y: rootY, label: root.label, depth: 0, color: '#22d3ee' };
    nodes.push(rootNode);

    var colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#f87171'];
    var nodeId = 1;

    function layoutChildren(parentLayout, node, currentDepth, yStart, yEnd){
      if(!node.children || !node.children.length) return;
      var childCount = node.children.length;
      var totalSpan = yEnd - yStart;
      var gap = totalSpan / childCount;

      node.children.forEach(function(child, i){
        var cy = yStart + gap * (i + 0.5);
        var cx = PADDING + (currentDepth + 1) * 180;

        var color = colors[currentDepth % colors.length];
        var childLayout = {
          id: 'n' + (nodeId++),
          x: cx, y: cy,
          label: child.label,
          depth: currentDepth + 1,
          color: color,
          parentId: parentLayout.id
        };
        nodes.push(childLayout);
        links.push({ from: parentLayout, to: childLayout });

        // نوزّع الأبناء على المسافة المخصّصة
        var childYStart = yStart + gap * i + 4;
        var childYEnd = yStart + gap * (i + 1) - 4;
        layoutChildren(childLayout, child, currentDepth + 1, childYStart, childYEnd);
      });
    }

    layoutChildren(rootNode, root, 0, 40, height - 40);

    return { nodes: nodes, links: links, width: width, height: height };
  }

  /**
   * يرسم SVG
   */
  function renderSVG(layout){
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + layout.width + ' ' + layout.height + '" style="width:100%;height:auto;max-height:75vh;background:var(--bg2);border-radius:14px">';

    // defs
    svg += '<defs>';
    svg += '<filter id="mmGlow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    svg += '</defs>';

    // Links
    layout.links.forEach(function(l){
      var x1 = l.from.x, y1 = l.from.y;
      var x2 = l.to.x, y2 = l.to.y;
      var cx1 = (x1 + x2) / 2, cy1 = y1;
      var cx2 = (x1 + x2) / 2, cy2 = y2;
      svg += '<path d="M ' + x1 + ' ' + y1 + ' C ' + cx1 + ' ' + cy1 + ', ' + cx2 + ' ' + cy2 + ', ' + x2 + ' ' + y2 + '" ' +
        'stroke="' + l.to.color + '" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round"/>';
    });

    // Nodes
    layout.nodes.forEach(function(n){
      var fontSize = n.depth === 0 ? 14 : (n.depth === 1 ? 12 : 10);
      var rx = 10;
      var padH = 12;
      var approxWidth = Math.max(70, n.label.length * (fontSize * 0.55) + padH * 2);
      var boxH = fontSize * 1.8;

      svg += '<g>';
      // Rect
      svg += '<rect x="' + (n.x - 4) + '" y="' + (n.y - boxH/2) + '" width="' + approxWidth + '" height="' + boxH + '" ' +
        'rx="' + rx + '" ry="' + rx + '" ' +
        'fill="var(--card)" ' +
        'stroke="' + n.color + '" stroke-width="2" ' +
        (n.depth === 0 ? 'filter="url(#mmGlow)"' : '') +
        '/>';
      // Text
      svg += '<text x="' + (n.x + approxWidth/2 - 4) + '" y="' + (n.y + fontSize * 0.35) + '" ' +
        'text-anchor="middle" ' +
        'font-family="Tahoma, sans-serif" ' +
        'font-size="' + fontSize + '" ' +
        'font-weight="' + (n.depth <= 1 ? '700' : '500') + '" ' +
        'fill="var(--text)" ' +
        'style="direction:rtl">' +
        esc(n.label.slice(0, 40)) +
        '</text>';
      svg += '</g>';
    });

    svg += '</svg>';
    return svg;
  }

  /**
   * فتح الـ mindmap من نص
   */
  function openMindmap(root, title){
    if(!root){ toast('لا يوجد محتوى', 'warn'); return; }

    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:96vw;width:1200px;padding:22px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:8px">' +
          '<h3 style="margin:0">🧠 ' + esc(title || 'خريطة ذهنية') + '</h3>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-sm" id="mmDownload">📥 PNG</button>' +
            '<button class="btn btn-sm btn-ghost" id="mmClose">✕</button>' +
          '</div>' +
        '</div>' +
        '<div id="mmBody"></div>' +
        '<div style="margin-top:12px;padding:10px;background:var(--grad-soft);border-radius:10px;font-size:.75rem;color:var(--muted);line-height:1.6">' +
          '💡 <b>نصيحة:</b> استخدم الأسطر العادية للنقاط، وابدأ بـ <code>  </code> (مسافتين) للتفريعات.' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);

    var layout = layoutTree(root);
    var svg = renderSVG(layout);
    var body = bd.querySelector('#mmBody');
    body.innerHTML = '<div style="overflow:auto;background:var(--bg2);border-radius:14px;padding:8px">' + svg + '</div>';

    bd.querySelector('#mmClose').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };

    bd.querySelector('#mmDownload').onclick = function(){
      downloadMindmapPNG(svg, title);
    };
  }

  function downloadMindmapPNG(svgString, title){
    var blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function(){
      var canvas = document.createElement('canvas');
      var scale = 2;
      canvas.width = img.width * scale || 1600;
      canvas.height = img.height * scale || 1000;
      var ctx = canvas.getContext('2d');
      // خلفية
      ctx.fillStyle = '#0b0f1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(function(b){
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'mindmap-' + (title || 'map').replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_') + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = function(){
      // فشل التحويل - نحمّل SVG مباشرة
      var a = document.createElement('a');
      a.href = url;
      a.download = 'mindmap-' + (title || 'map') + '.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.src = url;
  }

  /**
   * فتح من ملاحظة
   */
  function openFromNote(idx){
    var notes = window.notes || [];
    if(idx >= notes.length){ toast('ملاحظة غير موجودة', 'warn'); return; }
    var note = notes[idx];
    var tree = noteToTree(note);
    openMindmap(tree, note.title || 'ملاحظة');
  }

  /**
   * فتح يدوي: يطلب نص
   */
  function openManual(){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:620px">' +
        '<h3>🧠 خريطة ذهنية جديدة</h3>' +
        '<div class="form-group">' +
          '<label>العنوان</label>' +
          '<input id="mmTitle" placeholder="مثال: ملخص الفصل 3" value="">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>المحتوى (اكتب الأفكار الرئيسية مع تفريعاتها)</label>' +
          '<textarea id="mmText" rows="12" style="font-family:monospace;direction:rtl;min-height:200px" placeholder="المفاهيم الأساسية\n  - التعريف\n  - مثال\nالتطبيقات\n  - حالة 1\n  - حالة 2"></textarea>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-sm btn-ghost" id="mmCancel">إلغاء</button>' +
          '<button class="btn btn-sm" id="mmGo">🎨 توليد الخريطة</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);
    setTimeout(function(){ var t = document.getElementById('mmText'); if(t) t.focus(); }, 150);

    bd.querySelector('#mmCancel').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
    bd.querySelector('#mmGo').onclick = function(){
      var title = (document.getElementById('mmTitle').value || '').trim();
      var text = (document.getElementById('mmText').value || '').trim();
      if(!text){ toast('اكتب محتوى', 'warn'); return; }
      bd.remove();
      var tree = parseTextToTree(text);
      if(title && tree) tree.label = title;
      openMindmap(tree, title || 'خريطة ذهنية');
    };
  }

  /* ============ زر في الإعدادات ============ */
  function injectButton(){
    var menu = document.getElementById('settingsMenu');
    if(!menu || menu.querySelector('#mmBtn')) return;
    var btn = document.createElement('button');
    btn.className = 'settings-item';
    btn.id = 'mmBtn';
    btn.innerHTML = '<span>🧠</span> خريطة ذهنية';
    btn.addEventListener('click', function(){
      if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
      openManual();
    });
    var pdfBtn = menu.querySelector('#pdfBtn');
    if(pdfBtn) menu.insertBefore(btn, pdfBtn);
    else menu.appendChild(btn);
  }

  /* ============ زر لكل ملاحظة ============ */
  function enhanceNoteCards(){
    var notes = window.notes || [];
    document.querySelectorAll('.note-card').forEach(function(card, idx){
      if(card.querySelector('.mm-note-btn')) return;
      var btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-ghost mm-note-btn';
      btn.style.cssText = 'margin-top:6px';
      btn.innerHTML = '🧠 خريطة ذهنية';
      btn.onclick = function(){ openFromNote(idx); };
      card.appendChild(btn);
    });
  }

  function install(){
    setTimeout(injectButton, 1500);
    if(typeof window.renderNotes === 'function' && !window._mmNotesWrapped){
      var orig = window.renderNotes;
      window.renderNotes = function(){
        var r = orig.apply(this, arguments);
        setTimeout(enhanceNoteCards, 100);
        return r;
      };
      window._mmNotesWrapped = true;
    }
    setTimeout(enhanceNoteCards, 2000);
  }

  window.openMindmap = openMindmap;
  window.openMindmapManual = openManual;
  window.openMindmapFromNote = openFromNote;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('🧠 Mindmap loaded');
})();