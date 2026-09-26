/* ============================================================
   ☁️ supabase-client.js — طبقة الاتصال بـ Supabase
   ============================================================ */
(function(){
  'use strict';

  var CFG = window.SUPABASE_CONFIG || {};
  var client = null;
  var codeKey = 'ss_sync_code';
  var code = null;

  /* ==================== أدوات ==================== */
  function genCode(){
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var out = '';
    for(var i = 0; i < 12; i++){
      if(i > 0 && i % 4 === 0) out += '-';
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  function ensureCode(){
    if(code) return code;
    try{ code = localStorage.getItem(codeKey); }catch(e){}
    if(!code){
      code = genCode();
      try{ localStorage.setItem(codeKey, code); }catch(e){}
    }
    return code;
  }

  function getCode(){ return ensureCode(); }

  function setCode(newCode){
    code = String(newCode || '').trim().toUpperCase();
    try{ localStorage.setItem(codeKey, code); }catch(e){}
    return code;
  }

  /* ==================== Init ==================== */
  function init(){
    if(client) return client;
    if(!CFG.url || !CFG.anonKey || CFG.url.indexOf('YOUR-') > -1){
      console.warn('⚠️ Supabase config missing');
      return null;
    }
    if(typeof window.supabase === 'undefined' || !window.supabase.createClient){
      console.warn('⚠️ Supabase SDK not loaded');
      return null;
    }
    try{
      client = window.supabase.createClient(CFG.url, CFG.anonKey, {
        auth: { persistSession: false }
      });
      console.log('☁️ Supabase client ready');
    }catch(e){
      console.error('Supabase init failed:', e);
      client = null;
    }
    return client;
  }

  /* ==================== Load ==================== */
  async function load(){
    var c = init();
    if(!c) return null;
    var k = ensureCode();
    try{
      var res = await c.from('spaces').select('data, updated_at').eq('code', k).maybeSingle();
      if(res.error){ console.warn('Supabase load error:', res.error); return null; }
      if(!res.data) return null;
      return res.data;
    }catch(e){ console.warn('Supabase load failed:', e); return null; }
  }

  /* ==================== Save ==================== */
  async function save(snapshot){
    var c = init();
    if(!c) return false;
    var k = ensureCode();
    try{
      var res = await c.from('spaces').upsert({
        code: k,
        data: snapshot,
        updated_at: new Date().toISOString()
      }, { onConflict: 'code' });
      if(res.error){ console.warn('Supabase save error:', res.error); return false; }
      return true;
    }catch(e){ console.warn('Supabase save failed:', e); return false; }
  }

  /* ==================== Storage: الملفات ==================== */
  async function uploadFile(path, blob, contentType){
    var c = init();
    if(!c) return { error: 'no client' };
    var k = ensureCode();
    var fullPath = k + '/' + path;
    try{
      var res = await c.storage.from(CFG.bucket).upload(fullPath, blob, {
        upsert: true,
        contentType: contentType || 'application/octet-stream'
      });
      if(res.error) return { error: res.error.message };
      var urlRes = c.storage.from(CFG.bucket).getPublicUrl(fullPath);
      return { url: urlRes.data.publicUrl, path: fullPath };
    }catch(e){ return { error: e.message }; }
  }

  async function deleteFile(path){
    var c = init();
    if(!c) return false;
    try{
      var res = await c.storage.from(CFG.bucket).remove([path]);
      return !res.error;
    }catch(e){ return false; }
  }

  function getPublicUrl(path){
    var c = init();
    if(!c) return '';
    return c.storage.from(CFG.bucket).getPublicUrl(path).data.publicUrl;
  }

  /* ==================== Sync code UI ==================== */
  function showSyncPanel(){
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    bd.innerHTML =
      '<div class="modal" style="max-width:440px">' +
        '<h3>☁️ رمز المزامنة</h3>' +
        '<p style="color:var(--muted);font-size:.85rem;line-height:1.7;margin-bottom:16px">' +
          'هذا الرمز هو مفتاح مساحتك في السحابة. أدخله على أي جهاز آخر لترى نفس بياناتك.' +
        '</p>' +
        '<div class="form-group">' +
          '<label>الرمز</label>' +
          '<input id="syncCodeInput" value="' + getCode() + '" readonly ' +
            'style="font-family:monospace;text-align:center;letter-spacing:2px;font-size:1rem;direction:ltr">' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
          '<button class="btn btn-sm" id="syncCopy" style="flex:1">📋 نسخ</button>' +
          '<button class="btn btn-sm btn-ghost" id="syncChange" style="flex:1">🔄 تغيير</button>' +
          '<button class="btn btn-sm btn-ghost" id="syncClose" style="flex:1">إغلاق</button>' +
        '</div>' +
        '<div style="margin-top:14px;padding:10px;background:var(--grad-soft);border-radius:10px;font-size:.78rem;color:var(--muted);line-height:1.7">' +
          '💡 احفظ هذا الرمز في مكان آمن. من يفقد الرمز يفقد الوصول لبياناته السحابية.' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);

    var input = bd.querySelector('#syncCodeInput');
    bd.querySelector('#syncCopy').onclick = function(){
      input.select();
      try{
        navigator.clipboard.writeText(input.value);
        if(window.toast) window.toast('📋 نُسخ الرمز', 'success');
      }catch(e){ document.execCommand('copy'); }
    };
    bd.querySelector('#syncChange').onclick = function(){
      var v = prompt('أدخل رمزًا جديدًا (أو اتركه فارغًا لتوليد رمز جديد):', '');
      if(v === null) return;
      v = v.trim().toUpperCase();
      if(!v) v = genCode();
      setCode(v);
      input.value = v;
      if(window.toast) window.toast('✅ تم تغيير الرمز، أعد تحميل الصفحة', 'success', 3000);
    };
    bd.querySelector('#syncClose').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
  }

  /* ==================== Exports ==================== */
  window.SB = {
    init: init,
    load: load,
    save: save,
    getCode: getCode,
    setCode: setCode,
    uploadFile: uploadFile,
    deleteFile: deleteFile,
    getPublicUrl: getPublicUrl,
    showSyncPanel: showSyncPanel
  };

  console.log('☁️ Supabase client module loaded');
})();