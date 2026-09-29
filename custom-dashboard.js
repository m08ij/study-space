/* ============================================================
   🎨 custom-dashboard.js — تخصيص لوحة التحكم
   - سحب وإفلات ترتيب البطاقات
   - إخفاء/إظهار أي بطاقة
   - حفظ الاختيارات في localStorage
   ============================================================ */
(function(){
  'use strict';

  var ORDER_KEY = 'dash_order_v1';
  var HIDDEN_KEY = 'dash_hidden_v1';

  function getOrder(){
    try{ return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') || []; }catch(e){ return []; }
  }
  function setOrder(o){
    try{ localStorage.setItem(ORDER_KEY, JSON.stringify(o)); }catch(e){}
  }
  function getHidden(){
    try{ return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]') || []; }catch(e){ return []; }
  }
  function setHidden(h){
    try{ localStorage.setItem(HIDDEN_KEY, JSON.stringify(h)); }catch(e){}
  }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2000); }

  function getCardId(card, idx){
    // نعتمد على العنوان لو ما في id
    if(card.id) return card.id;
    var h3 = card.querySelector('h3');
    var title = h3 ? (h3.textContent || '').trim().slice(0, 30) : '';
    if(!title){
      // للشبكات (grid) نستخدم index
      return 'grid_' + idx;
    }
    // ننظف العنوان ليصير id ثابت
    return 'card_' + title.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
  }

  function applyOrder(){
    var dash = document.getElementById('dashboard');
    if(!dash) return;
    var order = getOrder();
    var hidden = getHidden();

    // نجمع كل العناصر القابلة للترتيب
    var cards = Array.prototype.slice.call(dash.children).filter(function(el){
      return el.classList && (el.classList.contains('card') || el.classList.contains('grid') || el.classList.contains('daily-quote'));
    });

    cards.forEach(function(c, idx){
      c.dataset.dashId = getCardId(c, idx);
    });

    // إخفاء المخفي
    cards.forEach(function(c){
      c.style.display = hidden.indexOf(c.dataset.dashId) > -1 ? 'none' : '';
    });

    // ترتيب
    if(order.length){
      order.forEach(function(id){
        var el = dash.querySelector('[data-dash-id="' + id + '"]');
        if(el) dash.appendChild(el);
      });
      // اللي مو موجود في order ينزل آخر
      cards.forEach(function(c){
        if(order.indexOf(c.dataset.dashId) === -1) dash.appendChild(c);
      });
    }

    // إضافة أزرار السحب + الإخفاء لكل card
    cards.forEach(function(c){
      if(c.querySelector('.dash-handle')) return;
      c.style.position = 'relative';

      var handle = document.createElement('button');
      handle.className = 'dash-handle';
      handle.type = 'button';
      handle.title = 'اسحب لإعادة الترتيب · أو اضغط لإخفاء';
      handle.innerHTML = '⠿';
      handle.style.cssText = 'position:absolute;top:6px;left:6px;z-index:10;width:24px;height:24px;border-radius:8px;background:var(--bg2);border:1px solid var(--border);color:var(--muted);cursor:grab;font-family:inherit;font-size:.9rem;line-height:1;display:flex;align-items:center;justify-content:center;opacity:.4;transition:.2s';
      handle.addEventListener('mouseenter', function(){ handle.style.opacity = '1'; });
      handle.addEventListener('mouseleave', function(){ if(!handle.classList.contains('dragging')) handle.style.opacity = '.4'; });
      handle.addEventListener('click', function(e){
        e.stopPropagation();
        var id = c.dataset.dashId;
        if(confirm('إخفاء "' + (c.querySelector('h3') ? c.querySelector('h3').textContent.trim() : 'هذه البطاقة') + '"؟\n\n(يمكنك استرجاعها من الإعدادات)')){
          var h = getHidden();
          if(h.indexOf(id) === -1){ h.push(id); setHidden(h); }
          c.style.display = 'none';
          toast('✅ أخفيت البطاقة');
        }
      });
      c.insertBefore(handle, c.firstChild);
      c.setAttribute('draggable', 'false');
    });

    // تفعيل السحب والإفلات
    enableDragDrop(cards);
  }

  function enableDragDrop(cards){
    var dragged = null;
    var placeholder = null;

    cards.forEach(function(c){
      var handle = c.querySelector('.dash-handle');
      if(!handle) return;

      handle.addEventListener('mousedown', function(e){
        c.setAttribute('draggable', 'true');
        handle.style.cursor = 'grabbing';
      });
      handle.addEventListener('touchstart', function(){
        c.setAttribute('draggable', 'true');
      }, { passive: true });

      c.addEventListener('dragstart', function(e){
        dragged = c;
        c.style.opacity = '.4';
        handle.classList.add('dragging');
        // placeholder
        placeholder = document.createElement('div');
        placeholder.style.cssText = 'height:' + c.offsetHeight + 'px;border:2px dashed var(--cyan);border-radius:12px;margin-bottom:14px';
        c.parentNode.insertBefore(placeholder, c.nextSibling);
        try{ e.dataTransfer.setData('text/plain', c.dataset.dashId); }catch(err){}
        try{ e.dataTransfer.effectAllowed = 'move'; }catch(err){}
      });

      c.addEventListener('dragover', function(e){
        e.preventDefault();
        if(!dragged || dragged === c) return;
        try{ e.dataTransfer.dropEffect = 'move'; }catch(err){}
        var rect = c.getBoundingClientRect();
        var midpoint = rect.top + rect.height / 2;
        if(e.clientY < midpoint){
          c.parentNode.insertBefore(placeholder, c);
        } else {
          c.parentNode.insertBefore(placeholder, c.nextSibling);
        }
      });

      c.addEventListener('dragend', function(){
        c.style.opacity = '';
        c.setAttribute('draggable', 'false');
        handle.classList.remove('dragging');
        handle.style.cursor = 'grab';
        if(placeholder && dragged && dragged !== c){
          placeholder.parentNode.insertBefore(dragged, placeholder);
        } else if(placeholder && dragged){
          // نفس المكان
          placeholder.parentNode.insertBefore(dragged, placeholder);
        }
        if(placeholder) placeholder.remove();
        placeholder = null;
        // احفظ الترتيب
        saveCurrentOrder();
        dragged = null;
      });

      c.addEventListener('drop', function(e){
        e.preventDefault();
      });
    });
  }

  function saveCurrentOrder(){
    var dash = document.getElementById('dashboard');
    if(!dash) return;
    var ids = [];
    Array.prototype.forEach.call(dash.children, function(el){
      if(el.dataset && el.dataset.dashId) ids.push(el.dataset.dashId);
    });
    setOrder(ids);
    toast('💾 تم حفظ الترتيب', 'success', 1500);
  }

  function resetLayout(){
    setOrder([]);
    setHidden([]);
    toast('↺ تم إرجاع الترتيب الافتراضي', 'success', 2000);
    setTimeout(function(){ location.reload(); }, 500);
  }

  function injectButtons(){
    // زر في الـ settings
    var menu = document.getElementById('settingsMenu');
    if(menu && !menu.querySelector('#resetDashBtn')){
      var divider = document.createElement('div');
      divider.className = 'settings-divider';
      var btn = document.createElement('button');
      btn.className = 'settings-item';
      btn.id = 'resetDashBtn';
      btn.innerHTML = '<span>🎨</span> إعادة ترتيب اللوحة';
      btn.addEventListener('click', function(){
        if(typeof window.closeSettingsMenu === 'function') window.closeSettingsMenu();
        resetLayout();
      });
      menu.appendChild(divider);
      menu.appendChild(btn);
    }
  }

  function install(){
    // ننتظر تحميل dashboard
    setTimeout(applyOrder, 1500);
    setTimeout(injectButtons, 1800);

    // نشغّل applyOrder كل ما يتحدث dashboard
    if(typeof window.renderDashboard === 'function' && !window._dashWrapped){
      var orig = window.renderDashboard;
      window.renderDashboard = function(){
        var r = orig.apply(this, arguments);
        setTimeout(applyOrder, 100);
        return r;
      };
      window._dashWrapped = true;
    }
  }

  window.resetDashboardLayout = resetLayout;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('🎨 Custom Dashboard loaded');
})();