/* ============================================================
   📱 bottom-nav.js — Bottom Navigation للموبايل
   - 5 أيقونات رئيسية أسفل الشاشة
   - تظهر فقط على الجوال (≤900px)
   - تخفي الـ FAB و AI FAB
   ============================================================ */
(function(){
  'use strict';

  var TABS = [
    { id: 'dashboard',    icon: '📊', label: 'الرئيسية' },
    { id: 'tasks',        icon: '📝', label: 'المهام' },
    { id: 'timetable',    icon: '📅', label: 'الجدول' },
    { id: 'gradecalc',    icon: '📊', label: 'علاماتي' },
    { id: 'budget',       icon: '💰', label: 'الميزانية' }
  ];

  function injectCSS(){
    if(document.getElementById('bn-style')) return;
    var s = document.createElement('style');
    s.id = 'bn-style';
    s.textContent = `
      .bn-bar{
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 350;
        display: none;
        background: var(--topbar-bg);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        border-top: 1px solid var(--border);
        padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
        box-shadow: 0 -8px 32px rgba(0,0,0,.25);
      }
      @media (max-width: 900px){
        .bn-bar{ display: flex; }
        /* نرفع الـ FAB فوق الـ bottom nav */
        .fab-main{ bottom: 90px !important; }
        .fab-menu{ bottom: 158px !important; }
        .ai-fab{ bottom: 90px !important; }
        .ai-panel{ bottom: 158px !important; max-height: calc(100vh - 240px) !important; }
        /* نضيف padding أسفل main */
        main{ padding-bottom: 100px !important; }
      }
      .bn-item{
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 8px 4px;
        background: transparent;
        border: none;
        color: var(--muted);
        font-family: inherit;
        font-size: .68rem;
        font-weight: 600;
        cursor: pointer;
        border-radius: 12px;
        transition: all .2s ease;
        position: relative;
      }
      .bn-item:active{ transform: scale(.92); }
      .bn-item.active{
        color: var(--cyan);
        background: var(--grad-soft);
      }
      .bn-item.active::before{
        content: '';
        position: absolute;
        top: 0; left: 50%; transform: translateX(-50%);
        width: 24px; height: 3px;
        border-radius: 3px;
        background: var(--grad);
      }
      .bn-item .bn-ic{
        font-size: 1.3rem;
        line-height: 1;
        transition: transform .2s ease;
      }
      .bn-item.active .bn-ic{
        transform: scale(1.1);
      }
      .bn-item .bn-lbl{
        font-size: .62rem;
        white-space: nowrap;
      }
      @media (max-width: 360px){
        .bn-item .bn-lbl{ font-size: .56rem; }
        .bn-item .bn-ic{ font-size: 1.15rem; }
      }
    `;
    document.head.appendChild(s);
  }

  function injectBar(){
    if(document.getElementById('bnBar')) return;
    var bar = document.createElement('div');
    bar.className = 'bn-bar';
    bar.id = 'bnBar';
    var html = '';
    TABS.forEach(function(t){
      html += '<button class="bn-item" data-bn-tab="' + t.id + '" type="button">' +
        '<span class="bn-ic">' + t.icon + '</span>' +
        '<span class="bn-lbl">' + t.label + '</span>' +
      '</button>';
    });
    bar.innerHTML = html;
    document.body.appendChild(bar);

    bar.querySelectorAll('[data-bn-tab]').forEach(function(b){
      b.addEventListener('click', function(){
        var tab = b.dataset.bnTab;
        if(typeof window.switchTab === 'function') window.switchTab(tab);
        // haptic feedback إن أمكن
        if(navigator.vibrate) navigator.vibrate(10);
      });
    });
  }

  function syncActive(){
    var currentTab = (window.S && window.S.get && window.S.get('activeTab', 'dashboard')) || 'dashboard';
    document.querySelectorAll('.bn-item').forEach(function(b){
      b.classList.toggle('active', b.dataset.bnTab === currentTab);
    });
  }

  function install(){
    injectCSS();
    injectBar();
    syncActive();
    // تحديث عند تغيير التبويب
    if(typeof window.switchTab === 'function' && !window._bnSwitchWrapped){
      var orig = window.switchTab;
      window.switchTab = function(tab, push){
        var r = orig.apply(this, arguments);
        setTimeout(syncActive, 50);
        return r;
      };
      window._bnSwitchWrapped = true;
    }
    // إخفاء عند فتح AI أو Focus
    setInterval(function(){
      var ai = document.getElementById('aiPanel');
      var focus = document.getElementById('focusScreen');
      var bar = document.getElementById('bnBar');
      if(!bar) return;
      var shouldHide = (ai && ai.classList.contains('show')) ||
                       (focus && focus.classList.contains('open'));
      bar.style.transform = shouldHide ? 'translateY(100%)' : 'translateY(0)';
    }, 300);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📱 Bottom Nav loaded');
})();