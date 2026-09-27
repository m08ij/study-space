/* ============================================================
   📈 insights.js — تحليلات متقدمة
   - Heatmap للساعات (نمط GitHub)
   - Trends أسبوعية/شهرية
   - تحليل أداء المواد
   - توقعات المعدل
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {}; }
  function getS(){ return window.S || {get:function(k,d){return d;}}; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ============ Heatmap ============ */
  function renderHeatmap(){
    var log = getS().get('studyLog', {});
    var container = document.getElementById('insightsHeatmap');
    if(!container) return;

    // آخر 16 أسبوع (112 يوم)
    var days = [];
    var now = new Date();
    // نبدأ من بداية الأسبوع (الأحد)
    var startDay = new Date(now);
    startDay.setDate(startDay.getDate() - 111);
    // ضبط لللأحد
    startDay.setDate(startDay.getDate() - startDay.getDay());

    var maxMin = 0;
    for(var i = 0; i < 119; i++){
      var d = new Date(startDay);
      d.setDate(d.getDate() + i);
      var ds = d.toISOString().slice(0,10);
      var m = log[ds] || 0;
      if(m > maxMin) maxMin = m;
      days.push({date: ds, minutes: m, day: d.getDay(), month: d.getMonth()});
    }
    if(maxMin === 0) maxMin = 60;

    // بناء Grid 7 x 17
    var html = '<div style="display:flex;gap:3px;overflow-x:auto;padding:8px 0;direction:ltr">';
    // 17 أسبوع
    for(var w = 0; w < 17; w++){
      html += '<div style="display:flex;flex-direction:column;gap:3px">';
      for(var dd = 0; dd < 7; dd++){
        var idx = w * 7 + dd;
        if(idx >= days.length) { html += '<div style="width:13px;height:13px"></div>'; continue; }
        var day = days[idx];
        var intensity = day.minutes === 0 ? 0 : Math.min(4, Math.ceil((day.minutes / maxMin) * 4));
        var colors = ['var(--bg2)', 'rgba(34,211,238,.25)', 'rgba(34,211,238,.5)', 'rgba(34,211,238,.75)', 'var(--cyan)'];
        var title = day.date + ' — ' + (day.minutes > 0 ? day.minutes + ' دقيقة' : 'ما درست');
        html += '<div title="' + title + '" style="width:13px;height:13px;border-radius:3px;background:' + colors[intensity] + ';border:1px solid rgba(255,255,255,.05)"></div>';
      }
      html += '</div>';
    }
    html += '</div>';

    // Legend
    html += '<div style="display:flex;align-items:center;gap:8px;font-size:.7rem;color:var(--muted);margin-top:8px;justify-content:flex-end">' +
      '<span>أقل</span>';
    for(var i = 0; i < 5; i++){
      var colors = ['var(--bg2)', 'rgba(34,211,238,.25)', 'rgba(34,211,238,.5)', 'rgba(34,211,238,.75)', 'var(--cyan)'];
      html += '<div style="width:11px;height:11px;border-radius:3px;background:' + colors[i] + '"></div>';
    }
    html += '<span>أكثر</span></div>';

    // إحصائيات سريعة
    var totalMin = days.reduce(function(a,d){ return a + d.minutes; }, 0);
    var activeDays = days.filter(function(d){ return d.minutes > 0; }).length;
    var streak = computeStreak(log);
    var bestDay = days.reduce(function(best, d){ return d.minutes > (best.minutes||0) ? d : best; }, {minutes:0});

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:14px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--cyan)">' + (totalMin/60).toFixed(1) + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">ساعة (16 أسبوع)</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--green)">' + activeDays + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">يوم نشط</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--amber)">' + streak + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">🔥 أيام متتالية</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--purple)">' + ((activeDays ? totalMin/activeDays : 0)/60).toFixed(1) + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">متوسط/يوم</div></div>';
    html += '</div>';

    container.innerHTML = html;
  }

  function computeStreak(log){
    var streak = 0;
    var d = new Date();
    for(var i = 0; i < 365; i++){
      var ds = d.toISOString().slice(0,10);
      if(log[ds] && log[ds] > 0) streak++;
      else if(i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  /* ============ Trends: هذا الأسبوع vs الماضي ============ */
  function renderTrends(){
    var log = getS().get('studyLog', {});
    var thisWeek = 0, lastWeek = 0, thisWeekDays = 0, lastWeekDays = 0;
    for(var i = 0; i < 7; i++){
      var d1 = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
      var m1 = log[d1] || 0;
      thisWeek += m1;
      if(m1 > 0) thisWeekDays++;

      var d2 = new Date(Date.now() - (i + 7) * 86400000).toISOString().slice(0,10);
      var m2 = log[d2] || 0;
      lastWeek += m2;
      if(m2 > 0) lastWeekDays++;
    }
    var diff = lastWeek === 0 ? (thisWeek > 0 ? 100 : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    var arrow = diff > 0 ? '📈 +' : diff < 0 ? '📉 ' : '➡️ ';
    var color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--muted)';

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:.7rem;color:var(--muted)">هذا الأسبوع</div><div style="font-size:1.3rem;font-weight:800;color:var(--cyan);margin-top:4px">' + (thisWeek/60).toFixed(1) + ' ساعة</div><div style="font-size:.68rem;color:var(--muted);margin-top:4px">' + thisWeekDays + ' أيام نشطة</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:.7rem;color:var(--muted)">الأسبوع الماضي</div><div style="font-size:1.3rem;font-weight:800;margin-top:4px">' + (lastWeek/60).toFixed(1) + ' ساعة</div><div style="font-size:.68rem;color:' + color + ';margin-top:4px;font-weight:700">' + arrow + Math.abs(diff) + '%</div></div>';
    html += '</div>';

    var container = document.getElementById('insightsTrends');
    if(container) container.innerHTML = html;
  }

  /* ============ تحليل أداء المواد ============ */
  function renderCoursePerformance(){
    var sp = getSpace();
    var grades = sp.grades || [];
    var container = document.getElementById('insightsCourses');
    if(!container) return;

    if(!grades.length){
      container.innerHTML = '<div class="empty" style="padding:24px"><div class="ic">📊</div><p>ما عندك علامات مسجلة بعد</p><p class="sub">سجّل علاماتك في "علاماتي"</p></div>';
      return;
    }

    var data = grades.map(function(g){
      var total = 0, earned = 0;
      (g.items || []).forEach(function(it){
        var w = parseFloat(it.weight) || 0;
        var s = parseFloat(it.score) || 0;
        total += w;
        earned += s * w / 100;
      });
      var pct = total > 0 ? (earned / total) * 100 : 0;
      return {name: g.name, pct: pct, items: (g.items || []).length};
    });
    data.sort(function(a,b){ return b.pct - a.pct; });

    var html = '<div style="display:flex;flex-direction:column;gap:8px">';
    data.forEach(function(d){
      var color = d.pct >= 85 ? 'var(--green)' : d.pct >= 70 ? 'var(--cyan)' : d.pct >= 50 ? 'var(--amber)' : 'var(--red)';
      html += '<div style="padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-size:.85rem;font-weight:600">' + esc(d.name) + '</span>' +
          '<span style="font-weight:800;color:' + color + '">' + d.pct.toFixed(1) + '%</span>' +
        '</div>' +
        '<div style="height:5px;background:var(--card);border-radius:5px;overflow:hidden">' +
          '<div style="height:100%;width:' + d.pct + '%;background:' + color + ';border-radius:5px"></div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    // Best/worst
    if(data.length >= 2){
      html += '<div style="margin-top:14px;padding:12px;background:var(--grad-soft);border-radius:10px;font-size:.82rem">';
      html += '🏆 <b>الأقوى:</b> ' + esc(data[0].name) + ' (' + data[0].pct.toFixed(1) + '%)\n';
      html += '⚠️ <b>الأضعف:</b> ' + esc(data[data.length-1].name) + ' (' + data[data.length-1].pct.toFixed(1) + '%)';
      html += '</div>';
    }

    container.innerHTML = html;
  }

  /* ============ توقع GPA النهائي ============ */
  function renderGpaForecast(){
    var sp = getSpace();
    var grades = sp.grades || [];
    var container = document.getElementById('insightsGpa');
    if(!container) return;

    if(!grades.length){
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.85rem">📊 سجّل علاماتك أول</div>';
      return;
    }

    var GRADES = window.GRADES || {};
    var courses = sp.courses || [];

    // احسب معدل الحالي
    var totalPts = 0, totalHrs = 0;
    grades.forEach(function(g){
      var total = 0, earned = 0;
      (g.items || []).forEach(function(it){
        total += parseFloat(it.weight) || 0;
        earned += (parseFloat(it.score)||0) * (parseFloat(it.weight)||0) / 100;
      });
      var pct = total > 0 ? earned / total * 100 : 0;
      var hrs = 3;
      var found = courses.find(function(c){ return c.name === g.name; });
      if(found && found.hours) hrs = found.hours;
      // تحويل % إلى GPA نقطة (تقديري)
      var gpaPoints = pct >= 90 ? 4.0 : pct >= 85 ? 3.75 : pct >= 80 ? 3.5 : pct >= 75 ? 3.0 : pct >= 70 ? 2.75 : pct >= 65 ? 2.5 : pct >= 60 ? 2.0 : pct >= 55 ? 1.75 : pct >= 50 ? 1.5 : pct >= 45 ? 1.0 : 0;
      totalPts += gpaPoints * hrs;
      totalHrs += hrs;
    });

    var currentGpa = totalHrs > 0 ? totalPts / totalHrs : 0;

    // توقع لو استمريت بنفس المستوى
    var remainingHrs = Math.max(0, 130 - totalHrs);
    var finalGpa = currentGpa;

    var html = '<div style="text-align:center;padding:16px">';
    html += '<div style="font-size:.78rem;color:var(--muted)">المعدل التقديري الحالي</div>';
    html += '<div style="font-size:2.6rem;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:8px 0">' + currentGpa.toFixed(2) + '</div>';
    var label = currentGpa >= 3.75 ? '🏆 ممتاز' : currentGpa >= 3.5 ? '⭐ جيد جداً مرتفع' : currentGpa >= 3.0 ? '✅ جيد جداً' : currentGpa >= 2.5 ? '👍 جيد' : currentGpa >= 2.0 ? '📌 مقبول' : '⚠️ يحتاج تحسين';
    html += '<div style="font-size:.85rem;color:var(--cyan);font-weight:700">' + label + '</div>';
    html += '<div style="font-size:.72rem;color:var(--muted);margin-top:12px">' + totalHrs + ' ساعة محسوبة من ' + grades.length + ' مادة</div>';
    html += '</div>';

    container.innerHTML = html;
  }

  /* ============ الرسم الرئيسي ============ */
  function renderInsights(){
    renderHeatmap();
    renderTrends();
    renderCoursePerformance();
    renderGpaForecast();
  }

  /* ============ UI: تبويب داخل Dashboard ============ */
  function injectInsightsSection(){
    var dash = document.getElementById('dashboard');
    if(!dash) return;
    if(document.getElementById('insightsSection')) return;

    var section = document.createElement('div');
    section.id = 'insightsSection';
    section.className = 'card';
    section.style.marginTop = '16px';
    section.innerHTML =
      '<div class="card-head"><h3>📈 تحليلات متقدمة</h3>' +
      '<span class="card-action" id="insightsRefresh">🔄 تحديث</span></div>' +
      '<div style="margin-bottom:16px">' +
        '<div class="chart-title" style="margin-bottom:10px">⏱️ ساعات الدراسة (16 أسبوع)</div>' +
        '<div id="insightsHeatmap"></div>' +
      '</div>' +
      '<div style="margin-bottom:16px">' +
        '<div class="chart-title" style="margin-bottom:10px">📊 هذا الأسبوع vs الماضي</div>' +
        '<div id="insightsTrends"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">' +
        '<div>' +
          '<div class="chart-title" style="margin-bottom:10px">📚 أداء المواد</div>' +
          '<div id="insightsCourses"></div>' +
        '</div>' +
        '<div>' +
          '<div class="chart-title" style="margin-bottom:10px">🎯 توقع المعدل</div>' +
          '<div id="insightsGpa" style="background:var(--grad-soft);border-radius:12px;border:1px solid var(--glow)"></div>' +
        '</div>' +
      '</div>';

    // أضفه قبل القسم الأخير (إحصائيات الدراسة)
    var lastCard = dash.querySelector('.card:last-child');
    if(lastCard) dash.insertBefore(section, lastCard);
    else dash.appendChild(section);

    var refresh = document.getElementById('insightsRefresh');
    if(refresh) refresh.addEventListener('click', function(){
      renderInsights();
      if(typeof window.toast === 'function') window.toast('🔄 حُدّثت التحليلات', 'success');
    });
  }

  /* ============ Hook على renderDashboard ============ */
  function install(){
    if(typeof window.renderDashboard !== 'function'){ setTimeout(install, 300); return; }
    if(window._insightsInstalled) return;
    window._insightsInstalled = true;

    var orig = window.renderDashboard;
    window.renderDashboard = function(){
      var r = orig.apply(this, arguments);
      try{
        injectInsightsSection();
        renderInsights();
      }catch(e){ console.warn('insights error:', e); }
      return r;
    };

    // Hook على logStudySession لتحديث الـ heatmap مباشرة
    if(typeof window.logStudySession === 'function'){
      var origLog = window.logStudySession;
      window.logStudySession = function(min){
        var r = origLog.apply(this, arguments);
        try{ renderHeatmap(); renderTrends(); }catch(e){}
        return r;
      };
    }
  }

  window.renderInsights = renderInsights;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('📈 Insights loaded');
})();