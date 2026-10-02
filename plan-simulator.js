/* ============================================================
   🎓 plan-simulator.js v4 — منطق بيانات صريح
   - ✅ completed flag صريح (لا auto-include لـ gpaRows)
   - ✅ واجهة إدارة "المواد المنجزة"
   - ✅ استيراد اختياري من حاسبة المعدل
   - ✅ migration آمن بدون تخمين
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {}; }
  function getDB(){ return window.COURSES_DB || {}; }
  function toast(m, t, d){
    if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2600);
  }
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function saveSpace(){
    if(typeof window.saveSpace === 'function') window.saveSpace();
  }

  /* ============ 1) المنجزة — flag صريح فقط ============ */
  function ensureCompletedCourses(){
    var sp = getSpace();
    if(Array.isArray(sp.completedCourses)) return sp.completedCourses;

    /* Migration: من space.courses[].completed فقط (وليس gpaRows) */
    var list = [];
    (sp.courses || []).forEach(function(c){
      if(c && c.completed === true && c.name) list.push(c.name);
    });
    sp.completedCourses = list;
    saveSpace();
    return list;
  }

  function getCompletedCourses(){
    var sp = getSpace();
    ensureCompletedCourses();
    var done = {};
    (sp.completedCourses || []).forEach(function(n){
      if(n) done[n] = true;
    });
    /* احترام أيضاً space.courses[].completed */
    (sp.courses || []).forEach(function(c){
      if(c && c.completed === true && c.name) done[c.name] = true;
    });
    return done;
  }

  function isCompleted(name){
    return !!getCompletedCourses()[name];
  }

  function setCompleted(name, yes){
    var sp = getSpace();
    var list = Array.isArray(sp.completedCourses) ? sp.completedCourses.slice() : [];
    var idx = list.indexOf(name);
    if(yes && idx === -1) list.push(name);
    if(!yes && idx > -1) list.splice(idx, 1);
    sp.completedCourses = list;

    (sp.courses || []).forEach(function(c){
      if(c && c.name === name) c.completed = !!yes;
    });
    saveSpace();
  }

  /* ============ 2) المتطلبات السابقة ============ */
  function prereqsMet(courseName, completed){
    completed = completed || getCompletedCourses();
    var info = getDB()[courseName];
    if(!info) return true;
    if(!info.pre || !info.pre.length) return true;
    for(var i = 0; i < info.pre.length; i++){
      if(!completed[info.pre[i]]) return false;
    }
    return true;
  }

  /* ============ 3) التقدم ============ */
  function getProgress(){
    var completed = getCompletedCourses();
    var db = getDB();
    var stats = {
      'uni-c': 0, 'uni-e': 0, 'faculty': 0,
      'major-c': 0, 'major-e': 0, 'remedial': 0, total: 0
    };
    Object.keys(completed).forEach(function(name){
      var info = db[name];
      if(!info) return;
      var t = info.t || 'major-c';
      if(stats[t] !== undefined) stats[t] += info.h;
      if(t !== 'remedial') stats.total += info.h;
    });
    return stats;
  }

  /* ============ 4) الفصل الحالي ============ */
  function getCurrentSemester(){
    var sp = getSpace();
    if(sp.currentSemester && sp.currentSemester >= 1 && sp.currentSemester <= 10){
      return sp.currentSemester;
    }
    var plan = window.RECOMMENDED_PLAN || {};
    var completed = getCompletedCourses();
    var currentSem = 1;

    for(var sem = 1; sem <= 10; sem++){
      var courses = plan[sem] || [];
      if(!courses.length) continue;
      var allDone = courses.every(function(name){ return completed[name]; });
      if(allDone) currentSem = sem + 1;
      else break;
    }
    if(currentSem > 10) currentSem = 10;
    return currentSem;
  }

  /* ============ 5) اقتراح الترم الجاي ============ */
  function suggestNextSemester(){
    var sp = getSpace();
    var completed = getCompletedCourses();
    var db = getDB();
    var plan = window.RECOMMENDED_PLAN || {};
    var currentCourses = (sp.courses || []).map(function(c){ return c.name; });
    var currentSem = getCurrentSemester();

    var candidates = plan[currentSem] || [];
    var suggestions = [];

    candidates.forEach(function(name){
      var info = db[name];
      if(!info) return;
      if(completed[name]) return;
      if(currentCourses.indexOf(name) > -1) return;

      var ready = prereqsMet(name, completed);
      suggestions.push({
        name: name,
        info: info,
        ready: ready,
        blocked: ready ? null : info.pre.filter(function(p){ return !completed[p]; })
      });
    });

    return {
      semester: currentSem,
      suggestions: suggestions,
      totalHours: suggestions.filter(function(s){ return s.ready; })
        .reduce(function(a, s){ return a + s.info.h; }, 0),
      progress: getProgress()
    };
  }

  /* ============ 6) فجوة التخرج ============ */
  function analyzeGraduationGap(){
    var progress = getProgress();
    var total = window.TOTAL_REQUIRED_HOURS || {
      'uni-c': 18, 'uni-e': 6, 'faculty': 33,
      'major-c': 88, 'major-e': 15, 'remedial': 9, total: 160
    };
    var remaining = {
      'uni-c': Math.max(0, (total['uni-c'] || 18) - progress['uni-c']),
      'uni-e': Math.max(0, (total['uni-e'] || 6) - progress['uni-e']),
      'faculty': Math.max(0, (total.faculty || 33) - progress.faculty),
      'major-c': Math.max(0, (total['major-c'] || 88) - progress['major-c']),
      'major-e': Math.max(0, (total['major-e'] || 15) - progress['major-e']),
      'remedial': Math.max(0, (total.remedial || 9) - progress.remedial),
      total: Math.max(0, (total.total || 160) - progress.total)
    };
    return { progress: progress, remaining: remaining, totalRequired: total };
  }

  /* ============ 7) العرض الرئيسي ============ */
  function renderSimulator(){
    var container = document.getElementById('planSimulatorBody');
    if(!container) return;

    var result = suggestNextSemester();
    var gap = analyzeGraduationGap();
    var semNames = ['', 'الفصل الأول', 'الفصل الثاني', 'الفصل الثالث', 'الفصل الرابع', 'الفصل الخامس',
      'الفصل السادس', 'الفصل السابع', 'الفصل الثامن', 'الفصل التاسع', 'الفصل العاشر'];

    var pct = Math.round((gap.progress.total / gap.totalRequired.total) * 100);
    var html = '';

    /* ===== Progress ===== */
    html += '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-head"><h3>📊 تقدمك نحو التخرج</h3>' +
      '<span style="font-size:.85rem;color:var(--cyan);font-weight:800">' + pct + '%</span></div>' +
      '<div class="sc-progress"><div class="sc-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div style="text-align:center;font-size:.75rem;color:var(--muted);margin-top:8px">' +
        gap.progress.total + ' / ' + gap.totalRequired.total + ' ساعة · باقي ' + gap.remaining.total +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:16px">';

    var cats = [
      { k: 'uni-c',   l: 'جامعة إجبارية',  i: '🏛️', max: 18 },
      { k: 'uni-e',   l: 'جامعة اختيارية', i: '🎨', max: 6  },
      { k: 'faculty', l: 'كلية إجبارية',   i: '🏫', max: 33 },
      { k: 'major-c', l: 'تخصص إجباري',    i: '🎯', max: 88 },
      { k: 'major-e', l: 'تخصص اختياري',   i: '⭐', max: 15 },
      { k: 'remedial', l: 'استدراكية',     i: '📌', max: gap.totalRequired.remedial || 9 }
    ];
    cats.forEach(function(c){
      var done = gap.progress[c.k] || 0;
      var rem = gap.remaining[c.k] || 0;
      var p = Math.round((done / c.max) * 100);
      html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px">' +
        '<div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">' + c.i + ' ' + c.l + '</div>' +
        '<div style="font-size:.9rem;font-weight:800;color:var(--cyan)">' + done + ' / ' + c.max + '</div>' +
        '<div style="height:5px;background:var(--card);border-radius:5px;overflow:hidden;margin-top:6px">' +
          '<div style="height:100%;width:' + p + '%;background:var(--grad);border-radius:5px"></div>' +
        '</div>' +
        '<div style="font-size:.68rem;color:var(--muted);margin-top:4px">' +
          (rem > 0 ? 'باقي ' + rem + ' ساعة' : '✅ مكتمل') +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    /* أزرار إدارة المنجزة */
    html += '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-sm" id="psManageCompleted" style="background:var(--grad);color:#0b0f1a">☑ إدارة المواد المنجزة</button>' +
      '<button class="btn btn-sm btn-ghost" id="psImportFromGpa">📥 استيراد من حاسبة المعدل</button>' +
    '</div></div>';

    /* ===== المقترح ===== */
    html += '<div class="card">' +
      '<div class="card-head"><h3>🎯 مقترح للترم القادم (' +
        (semNames[result.semester] || 'الفصل ' + result.semester) + ')</h3>' +
      '<span class="badge" style="background:var(--grad-soft);color:var(--cyan)">' +
        result.totalHours + ' ساعة</span></div>';

    if(!result.suggestions.length){
      html += '<div class="empty"><div class="ic">✨</div><p>ما لقيت مواد مقترحة</p>' +
        '<p class="sub">أضف موادك في "موادي" + علّم موادك المنجزة من الزر أعلاه</p></div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      result.suggestions.forEach(function(s){
        var t = (window.COURSE_TYPES && window.COURSE_TYPES[s.info.t]) ||
          { label: 'مادة', icon: '📘', color: 'var(--cyan)' };
        var readyBadge = s.ready
          ? '<span style="font-size:.68rem;padding:3px 9px;border-radius:6px;background:rgba(52,211,153,.15);color:var(--green);font-weight:700">✅ جاهز</span>'
          : '<span style="font-size:.68rem;padding:3px 9px;border-radius:6px;background:rgba(251,191,36,.15);color:var(--amber);font-weight:700">⚠️ يحتاج متطلب</span>';

        html += '<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:12px' +
          (s.ready ? '' : ';opacity:.75') + '">' +
          '<div style="font-size:1.4rem">' + t.icon + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:.9rem">' + esc(s.name) + '</div>' +
            '<div style="font-size:.7rem;color:var(--muted2);font-family:monospace">' +
              esc(s.info.code) + ' · ' + s.info.h + ' ساعات · ' + t.label + '</div>' +
            (s.blocked
              ? '<div style="font-size:.7rem;color:var(--amber);margin-top:4px">🔒 محجوب بـ: ' +
                s.blocked.map(esc).join('، ') + '</div>'
              : '') +
          '</div>' + readyBadge + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    /* ===== أدوات ===== */
    html += '<div class="card" style="margin-top:16px">' +
      '<h3>⚙️ أدوات</h3>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-sm" id="psSetSemester">🎯 تحديد الفصل الحالي</button>' +
        '<button class="btn btn-sm btn-ghost" id="psExportPlan">📤 تصدير الخطة</button>' +
        '<button class="btn btn-sm btn-danger" id="psResetCompleted">🗑 مسح سجل المنجزة</button>' +
      '</div>' +
      '<div style="margin-top:12px;padding:10px;background:var(--grad-soft);border-radius:10px;font-size:.76rem;color:var(--muted);line-height:1.7">' +
        '💡 <b>كيف يعمل؟</b> المواد المنجزة تُحدَّد يدوياً من "☑ إدارة المواد المنجزة". ' +
        'المواد في "علاماتي" أو "حاسبة المعدل" <b>لا تُعتبر منجزة</b> تلقائياً — اضغط "استيراد من حاسبة المعدل" إن أردت.' +
      '</div>' +
    '</div>';

    container.innerHTML = html;

    /* Bind */
    var setSem = document.getElementById('psSetSemester');
    if(setSem) setSem.addEventListener('click', setCurrentSemesterDialog);

    var manage = document.getElementById('psManageCompleted');
    if(manage) manage.addEventListener('click', openCompletionManager);

    var importGpa = document.getElementById('psImportFromGpa');
    if(importGpa) importGpa.addEventListener('click', importFromGpa);

    var expBtn = document.getElementById('psExportPlan');
    if(expBtn) expBtn.addEventListener('click', exportNextSemester);

    var resBtn = document.getElementById('psResetCompleted');
    if(resBtn) resBtn.addEventListener('click', resetCompleted);
  }

  /* ============ 8) إدارة المواد المنجزة ============ */
  function openCompletionManager(){
    var db = getDB();
    var sem = window.SEMESTERS || [];
    var completed = getCompletedCourses();

    var seen = {};
    var groups = {
      'uni-c': [], 'uni-e': [], 'faculty': [],
      'major-c': [], 'major-e': [], 'remedial': []
    };

    /* من SEMESTERS أولاً */
    sem.forEach(function(s){
      (s.courses || []).forEach(function(c){
        if(seen[c.n]) return;
        seen[c.n] = true;
        var info = db[c.n];
        var t = info ? info.t : 'major-c';
        if(!groups[t]) groups[t] = [];
        groups[t].push({
          name: c.n,
          h: c.h,
          code: c.code || (info && info.code) || ''
        });
      });
    });

    /* ثم الباقي من DB */
    Object.keys(db).forEach(function(name){
      if(seen[name]) return;
      seen[name] = true;
      var info = db[name];
      var t = info.t || 'major-c';
      if(!groups[t]) groups[t] = [];
      groups[t].push({
        name: name,
        h: info.h || 3,
        code: info.code || ''
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';

    var typeLabels = {
      'uni-c':   { i:'🏛️', l:'جامعة إجبارية' },
      'uni-e':   { i:'🎨', l:'جامعة اختيارية' },
      'faculty': { i:'🏫', l:'كلية إجبارية' },
      'major-c': { i:'🎯', l:'تخصص إجباري' },
      'major-e': { i:'⭐', l:'تخصص اختياري' },
      'remedial':{ i:'📌', l:'استدراكية' }
    };

    var html = '<div class="modal" style="max-width:640px;padding:22px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<h3 style="margin:0">☑ إدارة المواد المنجزة</h3>' +
        '<span id="cpmCount" style="font-size:.8rem;color:var(--cyan);font-weight:700"></span>' +
      '</div>' +
      '<div style="margin-bottom:12px">' +
        '<input id="cpmSearch" placeholder="🔍 ابحث باسم المادة أو الكود..." ' +
        'style="width:100%;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);' +
        'color:var(--text);border-radius:10px;font-family:inherit;font-size:.85rem;outline:none">' +
      '</div>' +
      '<div id="cpmList" style="max-height:55vh;overflow-y:auto;padding:4px">';

    Object.keys(groups).forEach(function(t){
      if(!groups[t].length) return;
      var meta = typeLabels[t] || { i:'📘', l:t };
      html += '<div data-cpm-group="' + t + '" style="margin-bottom:14px">' +
        '<div style="font-size:.78rem;font-weight:800;color:var(--cyan);margin-bottom:6px;padding:4px 0">' +
          meta.i + ' ' + meta.l + ' (' + groups[t].length + ')' +
        '</div>';

      groups[t].forEach(function(c){
        var checked = completed[c.name] ? 'checked' : '';
        html += '<label class="cpm-item" data-name="' + esc(c.name) + '" ' +
          'style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg2);' +
          'border:1px solid var(--border);border-radius:8px;margin-bottom:4px;cursor:pointer">' +
          '<input type="checkbox" ' + checked +
            ' style="width:18px;height:18px;accent-color:var(--cyan);cursor:pointer;flex-shrink:0">' +
          '<span style="flex:1;font-size:.84rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            esc(c.name) + '</span>' +
          '<span style="font-size:.7rem;color:var(--muted);font-family:monospace">' +
            esc(c.code) + '</span>' +
          '<span style="font-size:.7rem;color:var(--cyan);font-weight:700;flex-shrink:0">' +
            c.h + ' س</span>' +
        '</label>';
      });
      html += '</div>';
    });

    html += '</div>' +
      '<div class="modal-actions" style="margin-top:14px">' +
        '<button class="btn btn-sm btn-ghost" id="cpmCancel">إلغاء</button>' +
        '<button class="btn btn-sm" id="cpmSave">💾 حفظ</button>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:.72rem;color:var(--muted);text-align:center">' +
        'التعديلات تُطبَّق بعد الحفظ فقط' +
      '</div>' +
    '</div>';

    bd.innerHTML = html;
    document.body.appendChild(bd);

    var list = bd.querySelector('#cpmList');
    var search = bd.querySelector('#cpmSearch');
    var countEl = bd.querySelector('#cpmCount');

    function updateCount(){
      var n = list.querySelectorAll('input[type="checkbox"]:checked').length;
      countEl.textContent = n + ' منجزة';
    }
    updateCount();

    list.addEventListener('change', function(e){
      if(e.target && e.target.type === 'checkbox') updateCount();
    });

    if(search){
      search.addEventListener('input', function(){
        var q = search.value.trim().toLowerCase();
        list.querySelectorAll('.cpm-item').forEach(function(item){
          var name = (item.dataset.name || '').toLowerCase();
          item.style.display = (!q || name.indexOf(q) > -1) ? '' : 'none';
        });
        list.querySelectorAll('[data-cpm-group]').forEach(function(g){
          var anyVisible = false;
          g.querySelectorAll('.cpm-item').forEach(function(i){
            if(i.style.display !== 'none') anyVisible = true;
          });
          g.style.display = anyVisible ? '' : 'none';
        });
      });
    }

    bd.querySelector('#cpmCancel').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };

    bd.querySelector('#cpmSave').onclick = function(){
      var sp = getSpace();
      var selected = [];
      list.querySelectorAll('.cpm-item').forEach(function(item){
        var cb = item.querySelector('input[type="checkbox"]');
        if(cb && cb.checked) selected.push(item.dataset.name);
      });
      sp.completedCourses = selected;

      /* مزامنة space.courses[].completed */
      (sp.courses || []).forEach(function(c){
        if(c && c.name) c.completed = selected.indexOf(c.name) > -1;
      });

      saveSpace();
      toast('✅ تم الحفظ — ' + selected.length + ' مادة منجزة', 'success', 2500);
      bd.remove();
      renderSimulator();
    };
  }

  /* ============ 9) استيراد من GPA ============ */
  function importFromGpa(){
    var rows = window.gpaRows || [];
    if(!rows.length){
      toast('حاسبة المعدل فاضية', 'warn');
      return;
    }
    var names = rows
      .filter(function(r){ return r && r.name && parseFloat(r.hrs) > 0; })
      .map(function(r){ return r.name; });

    if(!names.length){
      toast('لا يوجد مواد بأسماء في حاسبة المعدل', 'warn');
      return;
    }
    if(!confirm('استيراد ' + names.length + ' مادة من حاسبة المعدل كمنجزة؟')) return;

    var sp = getSpace();
    var current = Array.isArray(sp.completedCourses) ? sp.completedCourses.slice() : [];
    names.forEach(function(n){
      if(current.indexOf(n) === -1) current.push(n);
    });
    sp.completedCourses = current;
    saveSpace();
    toast('✅ استورد ' + names.length + ' مادة', 'success');
    renderSimulator();
  }

  /* ============ 10) تحديد الفصل ============ */
  function setCurrentSemesterDialog(){
    var sp = getSpace();
    var current = sp.currentSemester || getCurrentSemester();
    var names = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس',
      'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    var options = [];
    for(var i = 1; i <= 10; i++){
      options.push({ v: String(i), l: 'الفصل ' + names[i] });
    }
    if(typeof window.showModal === 'function'){
      window.showModal('🎯 الفصل الحالي', [
        { key: 'sem', label: 'الفصل', type: 'select', options: options }
      ], { sem: String(current) }, function(data){
        var s = parseInt(data.sem, 10) || 1;
        sp.currentSemester = s;
        saveSpace();
        toast('✅ تم تحديث الفصل الحالي', 'success');
        renderSimulator();
        return true;
      });
    }
  }

  function resetCompleted(){
    if(!confirm('مسح كل المواد من قائمة المنجزة؟')) return;
    var sp = getSpace();
    sp.completedCourses = [];
    (sp.courses || []).forEach(function(c){ if(c) c.completed = false; });
    saveSpace();
    toast('🗑 تم المسح', 'success');
    renderSimulator();
  }

  function exportNextSemester(){
    var result = suggestNextSemester();
    var semNames = ['', 'الفصل الأول', 'الفصل الثاني', 'الفصل الثالث', 'الفصل الرابع',
      'الفصل الخامس', 'الفصل السادس', 'الفصل السابع', 'الفصل الثامن', 'الفصل التاسع', 'الفصل العاشر'];
    var lines = ['📚 خطة ' + (semNames[result.semester] || 'الفصل ' + result.semester), ''];
    result.suggestions.filter(function(s){ return s.ready; }).forEach(function(s){
      lines.push('• ' + s.name + ' (' + s.info.code + ') — ' + s.info.h + ' ساعات');
    });
    lines.push('');
    lines.push('المجموع: ' + result.totalHours + ' ساعة');
    var text = lines.join('\n');

    if(navigator.clipboard){
      navigator.clipboard.writeText(text);
      toast('📋 نُسخت الخطة', 'success');
    } else {
      alert(text);
    }
  }

  /* ============ 11) إدراج التبويب ============ */
  function injectTab(){
    var planSection = document.getElementById('plan');
    if(!planSection) return;
    var tabsWrap = planSection.querySelector('.section-tabs');
    if(!tabsWrap) return;
    if(tabsWrap.querySelector('[data-plan-tab="simulator"]')) return;

    var tab = document.createElement('button');
    tab.className = 'section-tab';
    tab.setAttribute('data-plan-tab', 'simulator');
    tab.textContent = '🎓 محاكي الترم الجاي';
    tabsWrap.appendChild(tab);

    var sim = document.createElement('div');
    sim.className = 'subsection';
    sim.setAttribute('data-plan-sub', 'simulator');
    sim.innerHTML = '<div id="planSimulatorBody"></div>';
    planSection.appendChild(sim);

    tab.addEventListener('click', function(){
      if(typeof window.switchSubTab === 'function'){
        window.switchSubTab('plan', 'simulator');
      }
      renderSimulator();
    });
  }

  function init(){
    ensureCompletedCourses();
    setTimeout(injectTab, 500);
  }

  /* ============ API ============ */
  window.renderPlanSimulator = renderSimulator;
  window.suggestNextSemester = suggestNextSemester;
  window.analyzeGraduationGap = analyzeGraduationGap;
  window.getCompletedCourses = getCompletedCourses;
  window.getCurrentSemester = getCurrentSemester;
  window.prereqsMet = prereqsMet;
  window.setCompleted = setCompleted;
  window.isCompleted = isCompleted;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  console.log('🎓 Plan Simulator v4 loaded — explicit completed flag');
})();