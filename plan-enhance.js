/* ============================================================
   📖 plan-enhance.js v4 — يعمل مع كلا التصميمين
   - Layout A: .sem-body > div (من index.html الأصلي)
   - Layout B: .plan-type-body > div (من fixes-all.js)
   - يضيف: badges (نوع + متطلب سابق) + زر "+"
   ============================================================ */
(function(){
  'use strict';

  function getDB(){ return window.COURSES_DB || {}; }
  function esc(s){ return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function getCompleted(){ return window.getCompletedCourses ? window.getCompletedCourses() : {}; }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2200); }
  function uid(){ return window.uid ? window.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function getSpace(){ return window.space || {}; }
  function saveSpace(){ if(typeof window.saveSpace === 'function') window.saveSpace(); }

  function courseExists(name){
    var sp = getSpace();
    return (sp.courses || []).some(function(c){ return c.name === name; });
  }

  function addCourseByName(name, info){
    if(courseExists(name)) return false;
    var sp = getSpace();
    if(!sp.courses) sp.courses = [];
    sp.courses.push({
      id: uid(),
      name: name,
      code: (info && info.code) || '',
      hours: (info && info.h) || 3,
      instructor: '',
      room: ''
    });
    saveSpace();
    return true;
  }

  /* ============ مطابقة (كود أولاً) ============ */
  function matchCourse(rowText, DB){
    var codeMatch = rowText.match(/\b(0?\d{6,10})\b/);
    if(codeMatch){
      var code = codeMatch[1].replace(/^0+/, '');
      var keys = Object.keys(DB);
      for(var i = 0; i < keys.length; i++){
        if(String(DB[keys[i]].code).replace(/^0+/, '') === code) return keys[i];
      }
    }
    var keys2 = Object.keys(DB);
    for(var j = 0; j < keys2.length; j++){
      if(rowText.indexOf(keys2[j]) > -1) return keys2[j];
    }
    var best = null, bestLen = 0;
    var keys3 = Object.keys(DB);
    for(var k = 0; k < keys3.length; k++){
      var key = keys3[k];
      var probe = key.slice(0, Math.max(10, key.length - 3));
      if(probe.length >= 10 && rowText.indexOf(probe) > -1 && key.length > bestLen){
        best = key; bestLen = key.length;
      }
    }
    return best;
  }

  /* ============ بناء شارات ============ */
  function buildBadgesHtml(info, completed){
    var parts = [];
    var t = (window.COURSE_TYPES && window.COURSE_TYPES[info.t]);
    if(t) parts.push('<span style="color:' + t.color + ';font-weight:700">' + t.icon + ' ' + t.label + '</span>');

    if(info.pre && info.pre.length){
      var preStrs = info.pre.map(function(p){
        var done = completed[p];
        return '<span style="color:' + (done ? 'var(--green)' : 'var(--amber)') + '">' +
          (done ? '✅ ' : '⏳ ') + esc(p) + '</span>';
      });
      parts.push('🔒 ' + preStrs.join(' · '));
    } else {
      parts.push('<span style="color:var(--muted2)">🔓 لا متطلب سابق</span>');
    }
    return parts.join(' &nbsp;|&nbsp; ');
  }

  /* ============ إيجاد حاوية الاسم ============ */
  function findNameContainer(row, layout){
    if(layout === 'A'){
      /* .sem-body > div : أول عنصر div يحتوي على الاسم */
      return row.children[0] || null;
    }
    /* Layout B: نبحث عن div فيه font-weight:600 */
    var allDivs = row.querySelectorAll('div');
    for(var i = 0; i < allDivs.length; i++){
      var style = allDivs[i].getAttribute('style') || '';
      if(style.indexOf('font-weight:600') > -1 || style.indexOf('font-weight: 600') > -1){
        return allDivs[i];
      }
    }
    return row.querySelector('div') || null;
  }

  /* ============ إضافة زر + ============ */
  function setBtnState(btn, added){
    if(added){
      btn.classList.add('added');
      btn.textContent = '✓';
      btn.disabled = true;
    } else {
      btn.classList.remove('added');
      btn.textContent = '+';
      btn.disabled = false;
    }
  }

  function insertAddButton(row, foundName, info){
    if(row.querySelector('.plan-add-btn')) return;

    var btn = document.createElement('button');
    btn.className = 'plan-add-btn';
    btn.type = 'button';
    btn.title = 'أضف إلى موادي';
    setBtnState(btn, courseExists(foundName));

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      e.preventDefault();
      if(courseExists(foundName)){
        setBtnState(btn, true);
        toast('✅ "' + foundName + '" موجودة أصلاً', 'info', 2000);
        return;
      }
      if(addCourseByName(foundName, info)){
        setBtnState(btn, true);
        toast('✅ أُضيفت "' + foundName + '"', 'success', 2000);
        try{ if(typeof window.renderCourses === 'function') window.renderCourses(); }catch(err){}
      }
    });

    /* نضعه في حاوية مع عنصر الساعات (آخر عنصر) */
    var lastChild = row.lastElementChild;
    if(lastChild && lastChild !== btn){
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0';
      row.insertBefore(wrapper, lastChild);
      wrapper.appendChild(lastChild);
      wrapper.appendChild(btn);
    } else {
      row.appendChild(btn);
    }
  }

  /* ============ تحسين صف واحد ============ */
  function enhanceRow(row, layout, DB, completed){
    if(row.dataset.planV3) return;
    row.dataset.planV3 = '1';

    var text = (row.textContent || '').trim();
    if(!text) return;

    var foundName = matchCourse(text, DB);
    if(!foundName) return;
    var info = DB[foundName];

    var nameContainer = findNameContainer(row, layout);
    if(!nameContainer) return;

    nameContainer.dataset.courseName = foundName;

    /* احذف الشارات القديمة إن وجدت */
    var oldBadges = nameContainer.querySelector('.plan-badges-v3');
    if(oldBadges) oldBadges.remove();

    var badgesEl = document.createElement('div');
    badgesEl.className = 'plan-badges-v3';
    badgesEl.style.cssText = 'font-size:.68rem;color:var(--muted);margin-top:4px;line-height:1.5';
    badgesEl.innerHTML = buildBadgesHtml(info, completed);
    nameContainer.appendChild(badgesEl);

    insertAddButton(row, foundName, info);
  }

  /* ============ نقطة الدخول ============ */
  function enhancePlanRows(){
    var sem = document.getElementById('semesters');
    if(!sem) return;
    var DB = getDB();
    var completed = getCompleted();

    /* Layout A */
    sem.querySelectorAll('.sem-body > div').forEach(function(row){
      try{ enhanceRow(row, 'A', DB, completed); }catch(e){}
    });

    /* Layout B */
    sem.querySelectorAll('.plan-type-body > div').forEach(function(row){
      try{ enhanceRow(row, 'B', DB, completed); }catch(e){}
    });
  }

  /* ============ وصف المواد ============ */
  function enhanceDescriptionsList(){
    var list = document.getElementById('cdList');
    if(!list) return;
    var DB = getDB();
    var completed = getCompleted();

    list.querySelectorAll('.cd-course').forEach(function(card){
      if(card.dataset.planV3) return;
      card.dataset.planV3 = '1';

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

      var codeEl = card.querySelector('.cd-code');
      if(codeEl) codeEl.parentNode.insertBefore(metaDiv, codeEl.nextSibling);
      else nameEl.parentNode.insertBefore(metaDiv, nameEl.nextSibling);

      if(card.querySelector('.cd-add-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'btn btn-sm cd-add-btn';
      btn.style.cssText = 'margin-top:8px';
      btn.type = 'button';

      function setDescBtnState(added){
        if(added){
          btn.textContent = '✅ في قائمتي';
          btn.disabled = true;
          btn.classList.add('btn-ghost');
        } else {
          btn.textContent = '➕ أضف إلى موادي';
          btn.disabled = false;
          btn.classList.remove('btn-ghost');
        }
      }
      setDescBtnState(courseExists(name));

      btn.addEventListener('click', function(){
        if(btn.disabled) return;
        if(addCourseByName(name, info)){
          setDescBtnState(true);
          toast('✅ أُضيفت "' + name + '"', 'success');
          try{ if(typeof window.renderCourses === 'function') window.renderCourses(); }catch(err){}
        }
      });

      card.appendChild(btn);
    });
  }

  /* ============ التثبيت ============ */
  function install(){
    if(window._planV4Installed) return;
    window._planV4Installed = true;

    /* Wrap renderPlan */
    if(typeof window.renderPlan === 'function'){
      var origRenderPlan = window.renderPlan;
      window.renderPlan = function(){
        var r = origRenderPlan.apply(this, arguments);
        try{ enhancePlanRows(); }catch(e){ console.warn('plan v4:', e); }
        return r;
      };
    }

    /* Wrap renderCourseDescriptions */
    if(typeof window.renderCourseDescriptions === 'function'){
      var origDesc = window.renderCourseDescriptions;
      window.renderCourseDescriptions = function(){
        var r = origDesc.apply(this, arguments);
        try{ enhanceDescriptionsList(); }catch(e){ console.warn('desc v4:', e); }
        return r;
      };
    }

    /* MutationObserver */
    var sem = document.getElementById('semesters');
    if(sem){
      var obs = new MutationObserver(function(){ enhancePlanRows(); });
      obs.observe(sem, { childList: true, subtree: true });
    }

    var cdList = document.getElementById('cdList');
    if(cdList){
      var obs2 = new MutationObserver(function(){ enhanceDescriptionsList(); });
      obs2.observe(cdList, { childList: true, subtree: true });
    }

    /* محاولات أولية */
    setTimeout(enhancePlanRows, 300);
    setTimeout(enhancePlanRows, 1000);
    setTimeout(enhancePlanRows, 2500);
    setTimeout(enhanceDescriptionsList, 800);
    setTimeout(enhanceDescriptionsList, 2000);
  }

  window.planEnhance = {
    refreshPlan: enhancePlanRows,
    refreshDesc: enhanceDescriptionsList
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📖 Plan Enhance v4 loaded');
})();