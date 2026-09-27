/* ============================================================
   📖 plan-enhance.js — تطوير عرض الخطة والمواد
   - عرض الكود + المتطلب السابق لكل مادة
   - عرض النوع (إجباري/اختياري)
   - زر "أضف إلى موادي"
   - تحسين عرض وصف المواد
   ============================================================ */
(function(){
  'use strict';

  function getDB(){ return window.COURSES_DB || {}; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function getCompleted(){
    return window.getCompletedCourses ? window.getCompletedCourses() : {};
  }

  /* ============ Hook على renderPlan ============ */
  function install(){
    if(typeof window.renderPlan !== 'function'){ setTimeout(install, 500); return; }
    if(window._planEnhInstalled) return;
    window._planEnhInstalled = true;

    var origRenderPlan = window.renderPlan;
    window.renderPlan = function(){
      var r = origRenderPlan.apply(this, arguments);
      try{ enhancePlanRows(); }catch(e){ console.warn('plan enhance error:', e); }
      return r;
    };

    // Hook على renderCourseDescriptions
    if(typeof window.renderCourseDescriptions === 'function'){
      var origDesc = window.renderCourseDescriptions;
      window.renderCourseDescriptions = function(){
        var r = origDesc.apply(this, arguments);
        try{ enhanceDescriptionsList(); }catch(e){}
        return r;
      };
    }

    // نفّذ الآن + كل ما يفتح تبويب الخطة
    setTimeout(enhancePlanRows, 1000);
  }

  function enhancePlanRows(){
    var sem = document.getElementById('semesters');
    if(!sem) return;
    var rows = sem.querySelectorAll('.sem-body > div');
    var DB = getDB();
    var completed = getCompleted();

    rows.forEach(function(row){
      if(row.dataset.planEnhanced) return;
      row.dataset.planEnhanced = '1';

      var text = (row.textContent || '').trim();
      // ابحث عن اسم المادة في الـ DB
      var foundName = null;
      Object.keys(DB).forEach(function(k){
        if(!foundName && text.indexOf(k) > -1) foundName = k;
      });
      if(!foundName) return;
      var info = DB[foundName];

      // نص إضافي: المتطلب + النوع
      var nameDiv = row.children[0];
      if(!nameDiv) return;

      var extraDiv = document.createElement('div');
      extraDiv.style.cssText = 'font-size:.68rem;color:var(--muted);margin-top:4px;line-height:1.5';

      var parts = [];
      // النوع
      var t = (window.COURSE_TYPES && window.COURSE_TYPES[info.t]);
      if(t) parts.push('<span style="color:' + t.color + ';font-weight:700">' + t.icon + ' ' + t.label + '</span>');
      // المتطلب السابق
      if(info.pre && info.pre.length){
        var preStrs = info.pre.map(function(p){
          var done = completed[p];
          return '<span style="color:' + (done ? 'var(--green)' : 'var(--amber)') + '">' + (done ? '✅ ' : '⏳ ') + esc(p) + '</span>';
        });
        parts.push('🔒 ' + preStrs.join(' · '));
      } else {
        parts.push('<span style="color:var(--muted2)">🔓 لا متطلب سابق</span>');
      }

      extraDiv.innerHTML = parts.join(' &nbsp;|&nbsp; ');
      nameDiv.appendChild(extraDiv);
    });
  }

  function enhanceDescriptionsList(){
    var list = document.getElementById('cdList');
    if(!list) return;
    var DB = getDB();
    var completed = getCompleted();

    list.querySelectorAll('.cd-course').forEach(function(card){
      if(card.dataset.planEnhanced) return;
      card.dataset.planEnhanced = '1';

      var nameEl = card.querySelector('.cd-name');
      if(!nameEl) return;
      var name = (nameEl.textContent || '').replace('📘', '').trim();
      var info = DB[name];
      if(!info) return;

      var metaDiv = document.createElement('div');
      metaDiv.style.cssText = 'font-size:.72rem;color:var(--muted);margin:8px 0;padding:8px 10px;background:var(--bg2);border-radius:8px;line-height:1.7';

      var parts = [];
      parts.push('📌 <b>الكود:</b> <code style="font-family:monospace;color:var(--cyan);direction:ltr;display:inline-block">' + esc(info.code) + '</code>');
      parts.push('⏱️ <b>الساعات:</b> ' + info.h);

      var t = (window.COURSE_TYPES && window.COURSE_TYPES[info.t]);
      if(t) parts.push('🏷️ <b>النوع:</b> <span style="color:' + t.color + ';font-weight:700">' + t.icon + ' ' + t.label + '</span>');

      if(info.pre && info.pre.length){
        var preHtml = info.pre.map(function(p){
          var done = completed[p];
          return '<span style="color:' + (done ? 'var(--green)' : 'var(--amber)') + '">' + (done ? '✅ ' : '⏳ ') + esc(p) + '</span>';
        }).join(' · ');
        parts.push('🔒 <b>المتطلب السابق:</b> ' + preHtml);
      }

      metaDiv.innerHTML = parts.join('<br>');

      // أضفه بعد cd-code أو cd-name
      var codeEl = card.querySelector('.cd-code');
      if(codeEl) codeEl.parentNode.insertBefore(metaDiv, codeEl.nextSibling);
      else nameEl.parentNode.insertBefore(metaDiv, nameEl.nextSibling);
    });
  }

  /* ============ إضافة زر "أضف لقائمتي" في وصف المواد ============ */
  function injectAddButton(){
    var list = document.getElementById('cdList');
    if(!list) return;
    list.querySelectorAll('.cd-course').forEach(function(card){
      if(card.querySelector('.cd-add-btn')) return;
      var nameEl = card.querySelector('.cd-name');
      if(!nameEl) return;
      var name = (nameEl.textContent || '').replace('📘', '').trim();
      var DB = getDB();
      var info = DB[name];
      if(!info) return;

      var sp = window.space || {};
      var exists = (sp.courses || []).some(function(c){ return c.name === name; });

      var btn = document.createElement('button');
      btn.className = 'btn btn-sm cd-add-btn';
      btn.style.cssText = 'margin-top:8px';
      btn.textContent = exists ? '✅ في قائمتي' : '➕ أضف إلى موادي';
      if(exists){ btn.classList.add('btn-ghost'); btn.disabled = true; }

      btn.addEventListener('click', function(){
        if(btn.disabled) return;
        var sp2 = window.space || {};
        if((sp2.courses || []).some(function(c){ return c.name === name; })){
          btn.textContent = '✅ في قائمتي'; btn.disabled = true; btn.classList.add('btn-ghost');
          return;
        }
        if(!sp2.courses) sp2.courses = [];
        sp2.courses.push({
          id: (window.uid ? window.uid() : Date.now().toString(36)),
          name: name, code: info.code, hours: info.h, instructor: '', room: ''
        });
        if(typeof window.saveSpace === 'function') window.saveSpace();
        if(typeof window.renderCourses === 'function') window.renderCourses();
        btn.textContent = '✅ في قائمتي'; btn.disabled = true; btn.classList.add('btn-ghost');
        if(typeof window.toast === 'function') window.toast('✅ أُضيفت "' + name + '"', 'success');
      });

      card.appendChild(btn);
    });
  }

  // استدعِ injectAddButton مع كل رندر
  if(typeof window.renderCourseDescriptions === 'function'){
    var orig = window.renderCourseDescriptions;
    window.renderCourseDescriptions = function(){
      var r = orig.apply(this, arguments);
      setTimeout(injectAddButton, 50);
      return r;
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📖 Plan Enhance loaded');
})();