/* ============================================================
   🎓 plan-simulator.js v3 — نسخة مُصلَحة
   - فصل واضح بين "مسجّلة حالياً" و"منجزة"
   - الاعتماد على space.currentSemester الصريح
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {}; }
  function getDB(){ return window.COURSES_DB || {}; }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2600); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ============ 1) المواد المُنجزة ============ */
  function getCompletedCourses(){
    var sp = getSpace();
    var done = {};

    if(Array.isArray(sp.completedCourses)){
      sp.completedCourses.forEach(function(name){
        if(name) done[String(name)] = true;
      });
    }

    (sp.courses || []).forEach(function(c){
      if(c && c.completed === true && c.name) done[c.name] = true;
    });

    (sp.grades || []).forEach(function(g){
      if(g && g.name) done[g.name] = true;
    });

    if(Array.isArray(window.gpaRows)){
      window.gpaRows.forEach(function(r){
        if(r && r.name && parseFloat(r.hrs) > 0) done[r.name] = true;
      });
    }

    return done;
  }

  /* ============ 2) فحص المتطلبات السابقة ============ */
  function prereqsMet(courseName, completed){
    var info = getDB()[courseName];
    if(!info) return true;
    if(!info.pre || !info.pre.length) return true;
    for(var i = 0; i < info.pre.length; i++){
      if(!completed[info.pre[i]]) return false;
    }
    return true;
  }

  /* ============ 3) حساب التقدم ============ */
  function getProgress(){
    var completed = getCompletedCourses();
    var db = getDB();
    var stats = { 'uni-c': 0, 'uni-e': 0, 'faculty': 0, 'major-c': 0, 'major-e': 0, 'remedial': 0, total: 0 };

    Object.keys(completed).forEach(function(name){
      var info = db[name];
      if(!info) return;
      var t = info.t || 'major-c';
      if(stats[t] !== undefined) stats[t] += info.h;
      if(t !== 'remedial') stats.total += info.h;
    });

    return stats;
  }

  /* ============ 4) تحديد الفصل الحالي ============ */
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
      if(allDone){
        currentSem = sem + 1;
      } else {
        break;
      }
    }

    if(currentSem > 10) currentSem = 10;
    return currentSem;
  }

  /* ============ 5) اقتراح مواد الترم الجاي ============ */
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
      totalHours: suggestions.filter(function(s){ return s.ready; }).reduce(function(a, s){ return a + s.info.h; }, 0),
      progress: getProgress()
    };
  }

  /* ============ 6) تحليل فجوة التخرج ============ */
  function analyzeGraduationGap(){
    var progress = getProgress();
    var total = window.TOTAL_REQUIRED_HOURS || {
      'uni-c': 18, 'uni-e': 6, 'faculty': 33, 'major-c': 88, 'major-e': 15, 'remedial': 9, total: 160
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

  /* ============ 7) الرسم ============ */
  function renderSimulator(){
    var container = document.getElementById('planSimulatorBody');
    if(!container) return;

    var result = suggestNextSemester();
    var gap = analyzeGraduationGap();
    var semNames = ['', 'الفصل الأول', 'الفصل الثاني', 'الفصل الثالث', 'الفصل الرابع', 'الفصل الخامس',
      'الفصل السادس', 'الفصل السابع', 'الفصل الثامن', 'الفصل التاسع', 'الفصل العاشر'];

    var pct = Math.round((gap.progress.total / gap.totalRequired.total) * 100);
    var html = '';

    /* القسم 1: التقدم */
    html += '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-head"><h3>📊 تقدمك نحو التخرج</h3>' +
      '<span style="font-size:.85rem;color:var(--cyan);font-weight:800">' + pct + '%</span></div>' +
      '<div class="sc-progress"><div class="sc-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div style="text-align:center;font-size:.75rem;color:var(--muted);margin-top:8px">' +
        gap.progress.total + ' / ' + gap.totalRequired.total + ' ساعة · باقي ' + gap.remaining.total +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:16px">';

    var cats = [
      { k: 'uni-c', l: 'جامعة إجبارية', i: '🏛️', max: 18 },
      { k: 'uni-e', l: 'جامعة اختيارية', i: '🎨', max: 6 },
      { k: 'faculty', l: 'كلية إجبارية', i: '🏫', max: 33 },
      { k: 'major-c', l: 'تخصص إجباري', i: '🎯', max: 88 },
      { k: 'major-e', l: 'تخصص اختياري', i: '⭐', max: 15 },
      { k: 'remedial', l: 'استدراكية', i: '📌', max: gap.totalRequired.remedial || 9 }
    ];

    cats.forEach(function(c){
      var done = gap.progress[c.k] || 0;
      var rem = gap.remaining[c.k] || 0;
      var p = Math.round((done / c.max) * 100);
      html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px">' +
        '<div style="font-size:.75rem;color:var(--muted);margin-bottom:4px">' + c.i + ' ' + c.l + '</div>' +
        '<div style="font-size:.9rem;font-weight:800;color:var(--cyan)">' + done + ' / ' + c.max + '</div>' +
        '<div style="height:5px;background:var(--card);border-radius:5px;overflow:hidden;margin-top:6px">' +
        '<div style="height:100%;width:' + p + '%;background:var(--grad);border-radius:5px"></div></div>' +
        '<div style="font-size:.68rem;color:var(--muted);margin-top:4px">' + (rem > 0 ? 'باقي ' + rem + ' ساعة' : '✅ مكتمل') + '</div>' +
      '</div>';
    });
    html += '</div></div>';

    /* القسم 2: المقترح */
    html += '<div class="card">' +
      '<div class="card-head"><h3>🎯 مقترح للترم القادم (' + (semNames[result.semester] || 'الفصل ' + result.semester) + ')</h3>' +
      '<span class="badge" style="background:var(--grad-soft);color:var(--cyan)">' + result.totalHours + ' ساعة</span></div>';

    if(!result.suggestions.length){
      html += '<div class="empty"><div class="ic">✨</div><p>ما لقيت مواد مقترحة</p>' +
        '<p class="sub">تأكد من إضافة موادك الحالية في قسم "موادي"</p></div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      result.suggestions.forEach(function(s){
        var t = (window.COURSE_TYPES && window.COURSE_TYPES[s.info.t]) || { label: 'مادة', icon: '📘', color: 'var(--cyan)' };
        var readyBadge = s.ready
          ? '<span style="font-size:.68rem;padding:3px 9px;border-radius:6px;background:rgba(52,211,153,.15);color:var(--green);font-weight:700">✅ جاهز</span>'
          : '<span style="font-size:.68rem;padding:3px 9px;border-radius:6px;background:rgba(251,191,36,.15);color:var(--amber);font-weight:700">⚠️ يحتاج متطلب</span>';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:12px' +
          (s.ready ? '' : ';opacity:.75') + '">' +
          '<div style="font-size:1.4rem">' + t.icon + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:.9rem">' + esc(s.name) + '</div>' +
            '<div style="font-size:.7rem;color:var(--muted2);font-family:monospace">' + esc(s.info.code) + ' · ' + s.info.h + ' ساعات · ' + t.label + '</div>' +
            (s.blocked ? '<div style="font-size:.7rem;color:var(--amber);margin-top:4px">🔒 محجوب بـ: ' + s.blocked.map(esc).join('، ') + '</div>' : '') +
          '</div>' + readyBadge + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    /* القسم 3: الأدوات */
    html += '<div class="card" style="margin-top:16px">' +
      '<h3>⚙️ أدوات</h3>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-sm" id="psSetSemester">🎯 تحديد الفصل الحالي</button>' +
        '<button class="btn btn-sm btn-ghost" id="psExportPlan">📤 تصدير الخطة</button>' +
        '<button class="btn btn-sm btn-ghost" id="psResetCompleted">🗑 مسح سجل المُنجزة</button>' +
      '</div>' +
      '<div style="margin-top:12px;padding:10px;background:var(--grad-soft);border-radius:10px;font-size:.76rem;color:var(--muted);line-height:1.7">' +
        '💡 <b>كيف يعمل؟</b> يقرأ موادك من: "موادي" + "متتبع العلامات" + "حاسبة المعدل" + <b>space.completedCourses</b>. ' +
        'لتصحيح الفصل، اضغط "🎯 تحديد الفصل الحالي".' +
      '</div>' +
    '</div>';

    container.innerHTML = html;

    var setSem = document.getElementById('psSetSemester');
    if(setSem) setSem.addEventListener('click', setCurrentSemesterDialog);

    var expBtn = document.getElementById('psExportPlan');
    if(expBtn) expBtn.addEventListener('click', exportNextSemester);

    var resBtn = document.getElementById('psResetCompleted');
    if(resBtn) resBtn.addEventListener('click', resetCompleted);
  }

  /* ============ تحديد الفصل يدوياً ============ */
  function setCurrentSemesterDialog(){
    var sp = getSpace();
    var current = sp.currentSemester || getCurrentSemester();

    var options = '';
    var names = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    for(var i = 1; i <= 10; i++){
      options += '<option value="' + i + '"' + (i === current ? ' selected' : '') + '>الفصل ' + names[i] + '</option>';
    }

    if(typeof window.showModal === 'function'){
      window.showModal('🎯 الفصل الحالي', [
        { key: 'sem', label: 'الفصل', type: 'select', options: [] }
      ], { sem: current }, function(data){
        var s = parseInt(data.sem, 10) || 1;
        sp.currentSemester = s;
        if(typeof window.saveSpace === 'function') window.saveSpace();
        toast('✅ تم تحديث الفصل الحالي', 'success');
        renderSimulator();
      });
      setTimeout(function(){
        var sel = document.getElementById('mf_sem');
        if(sel) sel.innerHTML = options;
      }, 100);
    }
  }

  function resetCompleted(){
    if(!confirm('مسح سجل المواد المُنجزة؟')) return;
    var sp = getSpace();
    sp.completedCourses = [];
    if(typeof window.saveSpace === 'function') window.saveSpace();
    toast('🗑 تم المسح', 'success');
    renderSimulator();
  }

  function exportNextSemester(){
    var result = suggestNextSemester();
    var semNames = ['', 'الفصل الأول', 'الفصل الثاني', 'الفصل الثالث', 'الفصل الرابع', 'الفصل الخامس',
      'الفصل السادس', 'الفصل السابع', 'الفصل الثامن', 'الفصل التاسع', 'الفصل العاشر'];
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
      if(typeof window.switchSubTab === 'function') window.switchSubTab('plan', 'simulator');
      renderSimulator();
    });
  }

  function init(){
    setTimeout(injectTab, 500);
  }

  window.renderPlanSimulator = renderSimulator;
  window.suggestNextSemester = suggestNextSemester;
  window.analyzeGraduationGap = analyzeGraduationGap;
  window.getCompletedCourses = getCompletedCourses;
  window.getCurrentSemester = getCurrentSemester;
  window.prereqsMet = prereqsMet;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  console.log('🎓 Plan Simulator v3 loaded');
})();