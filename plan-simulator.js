/* ============================================================
   🎓 plan-simulator.js — محاكي "خطة الفصول القادمة"
   يقرأ موادك المُنجزة → يقترح مواد الترم الجاي
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {profile:{},courses:[],grades:[]}; }
  function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2600); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function getDB(){ return window.COURSES_DB || {}; }

  /* ============ المنطق الأساسي ============ */
  // 1. جمع المواد المُنجزة من: courses + grades + plan (المستوردة)
  function getCompletedCourses(){
    var sp = getSpace();
    var done = {};
    // من "موادي"
    (sp.courses || []).forEach(function(c){ if(c.name) done[c.name] = true; });
    // من "متتبع العلامات"
    (sp.grades || []).forEach(function(g){ if(g.name) done[g.name] = true; });
    // من "حاسبة المعدل"
    (window.gpaRows || []).forEach(function(r){ if(r.name && r.hrs > 0) done[r.name] = true; });
    // المواد اللي الطالب قال إنه خلّصها يدوياً (حقل جديد)
    (sp.completedCourses || []).forEach(function(n){ done[n] = true; });
    return done;
  }

  // 2. هل المتطلبات السابقة لمادة ما محققة؟
  function prereqsMet(courseName, completed){
    var db = getDB();
    var info = db[courseName];
    if(!info) return true;
    if(!info.pre || !info.pre.length) return true;
    for(var i = 0; i < info.pre.length; i++){
      if(!completed[info.pre[i]]) return false;
    }
    return true;
  }

  // 3. حساب الساعات المُنجزة حسب النوع
  function getProgress(){
    var sp = getSpace();
    var completed = getCompletedCourses();
    var db = getDB();
    var stats = { 'uni-c':0, 'uni-e':0, 'faculty':0, 'major-c':0, 'major-e':0, total:0 };
    Object.keys(completed).forEach(function(name){
      var info = db[name];
      if(!info) return;
      var t = info.t;
      if(stats[t] !== undefined) stats[t] += info.h;
      stats.total += info.h;
    });
    return stats;
  }

  // 4. اقتراح مواد الترم القادم
  function suggestNextSemester(){
    var sp = getSpace();
    var completed = getCompletedCourses();
    var db = getDB();
    var plan = window.RECOMMENDED_PLAN || {};
    var currentCourses = (sp.courses || []).map(function(c){ return c.name; });

    // حدد أي فصل إحنا فيه (بناءً على عدد الساعات المُنجزة)
    var progress = getProgress();
    var currentSem = 1;
    var acc = 0;
    for(var i = 1; i <= 9; i++){
      acc += (plan[i] || []).reduce(function(sum, n){
        var info = db[n]; return sum + (info ? info.h : 3);
      }, 0);
      if(progress.total >= acc * 0.7){ currentSem = i + 1; }
      else break;
    }
    if(currentSem > 9) currentSem = 9;

    // اقترح مواد الفصل التالي
    var semToSuggest = Math.min(currentSem, 9);
    var candidates = plan[semToSuggest] || [];
    var suggestions = [];
    candidates.forEach(function(name){
      var info = db[name];
      if(!info) return;
      // تجاهل المواد المُنجزة
      if(completed[name]) return;
      // تجاهل المواد اللي مسجلها حالياً
      if(currentCourses.indexOf(name) > -1) return;
      // تحقق من المتطلبات
      var ready = prereqsMet(name, completed);
      suggestions.push({
        name: name,
        info: info,
        ready: ready,
        blocked: ready ? null : info.pre.filter(function(p){ return !completed[p]; })
      });
    });

    return {
      semester: semToSuggest,
      suggestions: suggestions,
      totalHours: suggestions.filter(function(s){ return s.ready; }).reduce(function(a, s){ return a + s.info.h; }, 0),
      progress: progress
    };
  }

  // 5. تحليل "كم باقي لي للتخرج"
  function analyzeGraduationGap(){
    var progress = getProgress();
    var total = window.TOTAL_REQUIRED_HOURS || {total:160};
    var remaining = {
      'uni-c': Math.max(0, (total['uni-c']||18) - progress['uni-c']),
      'uni-e': Math.max(0, (total['uni-e']||6) - progress['uni-e']),
      'faculty': Math.max(0, (total.faculty||33) - progress.faculty),
      'major-c': Math.max(0, (total['major-c']||88) - progress['major-c']),
      'major-e': Math.max(0, (total['major-e']||15) - progress['major-e']),
      total: Math.max(0, (total.total||160) - progress.total)
    };
    return {progress: progress, remaining: remaining, totalRequired: total};
  }

  /* ============ الرسم ============ */
  function renderSimulator(){
    var container = document.getElementById('planSimulatorBody');
    if(!container) return;

    var result = suggestNextSemester();
    var gap = analyzeGraduationGap();
    var semNames = ['','الفصل الأول','الفصل الثاني','الفصل الثالث','الفصل الرابع','الفصل الخامس','الفصل السادس','الفصل السابع','الفصل الثامن','الفصل التاسع'];

    // Progress bar
    var pct = Math.round((gap.progress.total / gap.totalRequired.total) * 100);
    var html = '';

    // القسم 1: التقدم
    html += '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-head"><h3>📊 تقدمك نحو التخرج</h3>' +
      '<span style="font-size:.85rem;color:var(--cyan);font-weight:800">' + pct + '%</span></div>' +
      '<div class="sc-progress"><div class="sc-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px">';

    var cats = [
      {k:'uni-c', l:'جامعة إجبارية', i:'🏛️', max:18},
      {k:'uni-e', l:'جامعة اختيارية', i:'🎨', max:6},
      {k:'faculty', l:'كلية إجبارية', i:'🏫', max:33},
      {k:'major-c', l:'تخصص إجباري', i:'🎯', max:88},
      {k:'major-e', l:'تخصص اختياري', i:'⭐', max:15}
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

    // القسم 2: اقتراح الترم القادم
    html += '<div class="card">' +
      '<div class="card-head"><h3>🎯 مقترح للترم القادم (' + (semNames[result.semester] || 'الفصل ' + result.semester) + ')</h3>' +
      '<span class="badge" style="background:var(--grad-soft);color:var(--cyan)">' + result.totalHours + ' ساعة</span></div>';

    if(!result.suggestions.length){
      html += '<div class="empty"><div class="ic">✨</div><p>ما لقيت مواد مقترحة</p>' +
        '<p class="sub">تأكد من إضافة موادك الحالية في قسم "موادي"</p></div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      result.suggestions.forEach(function(s){
        var t = (window.COURSE_TYPES && window.COURSE_TYPES[s.info.t]) || {label:'مادة', icon:'📘', color:'var(--cyan)'};
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

    // القسم 3: الأدوات
    html += '<div class="card" style="margin-top:16px">' +
      '<h3>⚙️ أدوات</h3>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-sm" id="psImportCurrent">📥 استيراد مواد الترم كـ "منجزة"' +
        '</button>' +
        '<button class="btn btn-sm btn-ghost" id="psExportPlan">📤 تصدير خطة الفصول القادمة</button>' +
        '<button class="btn btn-sm btn-ghost" id="psResetCompleted">🗑 مسح سجل المُنجزة</button>' +
      '</div>' +
      '<div style="margin-top:12px;padding:10px;background:var(--grad-soft);border-radius:10px;font-size:.76rem;color:var(--muted);line-height:1.7">' +
        '💡 <b>كيف يعمل؟</b> يقرأ موادك من: "موادي" + "متتبع العلامات" + "حاسبة المعدل". كل ما تضيف مواد، تتحدث الاقتراحات تلقائياً.' +
      '</div>' +
    '</div>';

    container.innerHTML = html;

    // Bind buttons
    var impBtn = document.getElementById('psImportCurrent');
    if(impBtn) impBtn.addEventListener('click', importCurrentAsCompleted);
    var expBtn = document.getElementById('psExportPlan');
    if(expBtn) expBtn.addEventListener('click', exportNextSemester);
    var resBtn = document.getElementById('psResetCompleted');
    if(resBtn) resBtn.addEventListener('click', resetCompleted);
  }

  function importCurrentAsCompleted(){
    var sp = getSpace();
    if(!sp.courses || !sp.courses.length){
      toast('ما عندك مواد في "موادي"', 'warn'); return;
    }
    if(!sp.completedCourses) sp.completedCourses = [];
    var added = 0;
    sp.courses.forEach(function(c){
      if(c.name && sp.completedCourses.indexOf(c.name) === -1){
        sp.completedCourses.push(c.name); added++;
      }
    });
    if(typeof window.saveSpace === 'function') window.saveSpace();
    toast('✅ أُضيفت ' + added + ' مادة للسجل', 'success');
    renderSimulator();
  }

  function resetCompleted(){
    if(!confirm('مسح سجل المواد المُنجزة يدوياً؟')) return;
    var sp = getSpace();
    sp.completedCourses = [];
    if(typeof window.saveSpace === 'function') window.saveSpace();
    toast('🗑 تم المسح', 'success');
    renderSimulator();
  }

  function exportNextSemester(){
    var result = suggestNextSemester();
    var semNames = ['','الفصل الأول','الفصل الثاني','الفصل الثالث','الفصل الرابع','الفصل الخامس','الفصل السادس','الفصل السابع','الفصل الثامن','الفصل التاسع'];
    var lines = ['📚 خطة ' + (semNames[result.semester] || 'الفصل ' + result.semester), ''];
    result.suggestions.filter(function(s){ return s.ready; }).forEach(function(s){
      lines.push('• ' + s.name + ' (' + s.info.code + ') — ' + s.info.h + ' ساعات');
    });
    lines.push('');
    lines.push('المجموع: ' + result.totalHours + ' ساعة');
    var text = lines.join('\n');

    if(navigator.clipboard){ navigator.clipboard.writeText(text); toast('📋 نُسخت الخطة', 'success'); }
    else { alert(text); }
  }

  /* ============ UI: تبويب في قسم "plan" ============ */
  function injectTab(){
    var planSection = document.getElementById('plan');
    if(!planSection) return;
    var tabsWrap = planSection.querySelector('.section-tabs');
    if(!tabsWrap) return;
    if(tabsWrap.querySelector('[data-plan-tab="simulator"]')) return;

    // أضف التبويب
    var tab = document.createElement('button');
    tab.className = 'section-tab';
    tab.setAttribute('data-plan-tab', 'simulator');
    tab.textContent = '🎓 محاكي الترم الجاي';
    tabsWrap.appendChild(tab);

    // أضف الـ subsection
    var subsWrap = planSection.querySelector('.subsection') ? planSection : planSection;
    var sim = document.createElement('div');
    sim.className = 'subsection';
    sim.setAttribute('data-plan-sub', 'simulator');
    sim.innerHTML = '<div id="planSimulatorBody"></div>';
    planSection.appendChild(sim);

    // اربط الحدث
    tab.addEventListener('click', function(){
      if(typeof window.switchSubTab === 'function') window.switchSubTab('plan', 'simulator');
      renderSimulator();
    });
  }

  /* ============ Init ============ */
  function init(){
    setTimeout(injectTab, 500);
    // اربط زر لو موجود في أي مكان
    var btns = document.querySelectorAll('[data-open-simulator]');
    btns.forEach(function(b){
      b.addEventListener('click', function(){
        if(typeof window.switchTab === 'function') window.switchTab('plan');
        setTimeout(function(){
          if(typeof window.switchSubTab === 'function') window.switchSubTab('plan', 'simulator');
          renderSimulator();
        }, 200);
      });
    });
  }

  window.renderPlanSimulator = renderSimulator;
  window.suggestNextSemester = suggestNextSemester;
  window.analyzeGraduationGap = analyzeGraduationGap;
  window.getCompletedCourses = getCompletedCourses;
  window.prereqsMet = prereqsMet;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  console.log('🎓 Plan Simulator loaded');
})();