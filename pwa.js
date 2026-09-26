/* ============================================================
   📱 pwa.js — تسجيل Service Worker + زر التثبيت
   ============================================================ */
(function(){
  'use strict';

  /* ==================== تسجيل SW ==================== */
  function registerSW(){
    if(!('serviceWorker' in navigator)) return;
    if(location.protocol !== 'https:' && location.hostname !== 'localhost'){
      console.warn('⚠️ Service Worker يحتاج HTTPS');
      return;
    }
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function(reg){
        console.log('✅ SW registered:', reg.scope);
      })
      .catch(function(err){
        console.warn('SW registration failed:', err);
      });
  }

  /* ==================== Install Prompt ==================== */
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    showInstallBtn();
  });

  window.addEventListener('appinstalled', function(){
    console.log('📱 App installed');
    hideInstallBtn();
    if(window.toast) window.toast('🎉 تم تثبيت التطبيق', 'success', 2500);
  });

  function showInstallBtn(){
    if(document.getElementById('pwaInstallBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.className = 'icon-btn';
    btn.title = 'تثبيت التطبيق';
    btn.innerHTML = '📲';
    btn.style.cssText = 'background:linear-gradient(135deg,#a78bfa,#f472b6);color:#fff;border:none';

    var actions = document.querySelector('.topbar-actions');
    if(actions) actions.insertBefore(btn, actions.firstChild);

    btn.addEventListener('click', async function(){
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      var choice = await deferredPrompt.userChoice;
      if(choice.outcome === 'accepted'){
        console.log('✅ User accepted install');
      } else {
        console.log('❌ User dismissed install');
      }
      deferredPrompt = null;
      hideInstallBtn();
    });
  }

  function hideInstallBtn(){
    var b = document.getElementById('pwaInstallBtn');
    if(b) b.remove();
  }

  /* ==================== عرض رمز المزامنة في Topbar ==================== */
  function injectSyncBtn(){
    var actions = document.querySelector('.topbar-actions');
    if(!actions) return;
    if(document.getElementById('syncCodeBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'syncCodeBtn';
    btn.className = 'icon-btn';
    btn.title = 'رمز المزامنة السحابية';
    btn.innerHTML = '🔑';
    btn.style.cssText = 'background:linear-gradient(135deg,#34d399,#22d3ee);color:#0b0f1a;border:none';

    var status = document.getElementById('serverStatus');
    if(status && status.parentNode){
      status.parentNode.insertBefore(btn, status.nextSibling);
    } else {
      actions.insertBefore(btn, actions.firstChild);
    }

    btn.addEventListener('click', function(){
      if(window.SB && window.SB.showSyncPanel) window.SB.showSyncPanel();
    });
  }

  /* ==================== Init ==================== */
  function init(){
    registerSW();
    setTimeout(injectSyncBtn, 400);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('📱 PWA module loaded');
})();