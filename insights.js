/* ============================================================
   insights.js v3 - Advanced analytics
   - FIXED: GPA calculation (score out of weight, not %)
   - FIXED: Uses local date strings
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {}; }
  function getS(){ return window.S || {get:function(k,d){return d;}}; }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function localDateStr(d){
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  function renderHeatmap(){
    var log = getS().get('studyLog', {});
    var container = document.getElementById('insightsHeatmap');
    if(!container) return;

    var days = [];
    var now = new Date();
    var startDay = new Date(now);
    startDay.setDate(startDay.getDate() - 111);
    startDay.setDate(startDay.getDate() - startDay.getDay());

    var maxMin = 0;
    for(var i = 0; i < 119; i++){
      var d = new Date(startDay);
      d.setDate(d.getDate() + i);
      var ds = localDateStr(d);
      var m = log[ds] || 0;
      if(m > maxMin) maxMin = m;
      days.push({date: ds, minutes: m, day: d.getDay(), month: d.getMonth()});
    }
    if(maxMin === 0) maxMin = 60;

    var colors = ['var(--bg2)', 'rgba(34,211,238,.25)', 'rgba(34,211,238,.5)', 'rgba(34,211,238,.75)', 'var(--cyan)'];

    var html = '<div style="display:flex;gap:3px;overflow-x:auto;padding:8px 0;direction:ltr">';
    for(var w = 0; w < 17; w++){
      html += '<div style="display:flex;flex-direction:column;gap:3px">';
      for(var dd = 0; dd < 7; dd++){
        var idx = w * 7 + dd;
        if(idx >= days.length){ html += '<div style="width:13px;height:13px"></div>'; continue; }
        var day = days[idx];
        var intensity = day.minutes === 0 ? 0 : Math.min(4, Math.ceil((day.minutes / maxMin) * 4));
        var title = day.date + ' - ' + (day.minutes > 0 ? day.minutes + ' min' : 'no study');
        html += '<div title="' + title + '" style="width:13px;height:13px;border-radius:3px;background:' + colors[intensity] + ';border:1px solid rgba(255,255,255,.05)"></div>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '<div style="display:flex;align-items:center;gap:8px;font-size:.7rem;color:var(--muted);margin-top:8px;justify-content:flex-end">';
    for(var i2 = 0; i2 < 5; i2++){
      html += '<div style="width:11px;height:11px;border-radius:3px;background:' + colors[i2] + '"></div>';
    }
    html += '</div>';

    var totalMin = days.reduce(function(a,d){ return a + d.minutes; }, 0);
    var activeDays = days.filter(function(d){ return d.minutes > 0; }).length;
    var streak = computeStreak(log);

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:14px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--cyan)">' + (totalMin/60).toFixed(1) + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">hrs (16 weeks)</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--green)">' + activeDays + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">active days</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--amber)">' + streak + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">streak</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--purple)">' + ((activeDays ? totalMin/activeDays : 0)/60).toFixed(1) + '</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">avg/day</div></div>';
    html += '</div>';

    container.innerHTML = html;
  }

  function computeStreak(log){
    var streak = 0;
    var d = new Date();
    for(var i = 0; i < 365; i++){
      var ds = localDateStr(d);
      if(log[ds] && log[ds] > 0){
        streak++;
      } else if(i > 0){
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function renderTrends(){
    var log = getS().get('studyLog', {});
    var thisWeek = 0, lastWeek = 0, thisWeekDays = 0, lastWeekDays = 0;
    for(var i = 0; i < 7; i++){
      var d1 = new Date(Date.now() - i * 86400000);
      var m1 = log[localDateStr(d1)] || 0;
      thisWeek += m1;
      if(m1 > 0) thisWeekDays++;

      var d2 = new Date(Date.now() - (i + 7) * 86400000);
      var m2 = log[localDateStr(d2)] || 0;
      lastWeek += m2;
      if(m2 > 0) lastWeekDays++;
    }
    var diff = lastWeek === 0 ? (thisWeek > 0 ? 100 : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    var arrow = diff > 0 ? '+' : diff < 0 ? '' : '';
    var color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--muted)';

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:.7rem;color:var(--muted)">This week</div><div style="font-size:1.3rem;font-weight:800;color:var(--cyan);margin-top:4px">' + (thisWeek/60).toFixed(1) + ' hrs</div><div style="font-size:.68rem;color:var(--muted);margin-top:4px">' + thisWeekDays + ' active days</div></div>';
    html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:.7rem;color:var(--muted)">Last week</div><div style="font-size:1.3rem;font-weight:800;margin-top:4px">' + (lastWeek/60).toFixed(1) + ' hrs</div><div style="font-size:.68rem;color:' + color + ';margin-top:4px;font-weight:700">' + arrow + Math.abs(diff) + '%</div></div>';
    html += '</div>';

    var container = document.getElementById('insightsTrends');
    if(container) container.innerHTML = html;
  }

  /* ============ ✅ GPA math FIXED ============ */
  function computeGradePercentage(g){
    var total = 0, earned = 0;
    (g.items || []).forEach(function(it){
      var w = parseFloat(it.weight) || 0;
      var s = parseFloat(it.score)  || 0;
      total += w;
      earned += s;   /* score is out of weight */
    });
    return total > 0 ? (earned / total) * 100 : 0;
  }

  function renderCoursePerformance(){
    var sp = getSpace();
    var grades = sp.grades || [];
    var container = document.getElementById('insightsCourses');
    if(!container) return;

    if(!grades.length){
      container.innerHTML = '<div class="empty" style="padding:24px"><div class="ic">📊</div><p>No grades recorded yet</p></div>';
      return;
    }

    var data = grades.map(function(g){
      return {
        name: g.name,
        pct: computeGradePercentage(g),
        items: (g.items || []).length
      };
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

    if(data.length >= 2){
      html += '<div style="margin-top:14px;padding:12px;background:var(--grad-soft);border-radius:10px;font-size:.82rem">';
      html += 'Best: <b>' + esc(data[0].name) + '</b> (' + data[0].pct.toFixed(1) + '%)<br>';
      html += 'Weakest: <b>' + esc(data[data.length-1].name) + '</b> (' + data[data.length-1].pct.toFixed(1) + '%)';
      html += '</div>';
    }

    container.innerHTML = html;
  }

  /* ============ ✅ GPA forecast FIXED ============ */
  function renderGpaForecast(){
    var sp = getSpace();
    var grades = sp.grades || [];
    var container = document.getElementById('insightsGpa');
    if(!container) return;

    if(!grades.length){
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.85rem">Add your grades first</div>';
      return;
    }

    var courses = sp.courses || [];
    var totalPts = 0, totalHrs = 0;
    grades.forEach(function(g){
      var pct = computeGradePercentage(g);
      var hrs = 3;
      var found = courses.find(function(c){ return c.name === g.name; });
      if(found && found.hours) hrs = found.hours;
      var gpaPoints = pct >= 90 ? 4.0 : pct >= 85 ? 3.75 : pct >= 80 ? 3.5 :
                      pct >= 75 ? 3.0 : pct >= 70 ? 2.75 : pct >= 65 ? 2.5 :
                      pct >= 60 ? 2.0 : pct >= 55 ? 1.75 : pct >= 50 ? 1.5 :
                      pct >= 45 ? 1.0 : 0;
      totalPts += gpaPoints * hrs;
      totalHrs += hrs;
    });

    var currentGpa = totalHrs > 0 ? totalPts / totalHrs : 0;

    var html = '<div style="text-align:center;padding:16px">';
    html += '<div style="font-size:.78rem;color:var(--muted)">Estimated GPA</div>';
    html += '<div style="font-size:2.6rem;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:8px 0">' + currentGpa.toFixed(2) + '</div>';
    var label = currentGpa >= 3.75 ? 'Excellent' : currentGpa >= 3.5 ? 'Very Good+' : currentGpa >= 3.0 ? 'Very Good' : currentGpa >= 2.5 ? 'Good' : currentGpa >= 2.0 ? 'Pass' : 'Needs improvement';
    html += '<div style="font-size:.85rem;color:var(--cyan);font-weight:700">' + label + '</div>';
    html += '<div style="font-size:.72rem;color:var(--muted);margin-top:12px">' + totalHrs + ' hrs from ' + grades.length + ' courses</div>';
    html += '</div>';

    container.innerHTML = html;
  }

  function renderInsights(){
    renderHeatmap();
    renderTrends();
    renderCoursePerformance();
    renderGpaForecast();
  }

  function injectInsightsSection(){
    var dash = document.getElementById('dashboard');
    if(!dash) return;
    if(document.getElementById('insightsSection')) return;

    var section = document.createElement('div');
    section.id = 'insightsSection';
    section.className = 'card';
    section.style.marginTop = '16px';
    section.innerHTML =
      '<div class="card-head"><h3>📈 Advanced Analytics</h3>' +
      '<span class="card-action" id="insightsRefresh">🔄 Refresh</span></div>' +
      '<div style="margin-bottom:16px">' +
        '<div class="chart-title" style="margin-bottom:10px">Study hours (16 weeks)</div>' +
        '<div id="insightsHeatmap"></div>' +
      '</div>' +
      '<div style="margin-bottom:16px">' +
        '<div class="chart-title" style="margin-bottom:10px">This week vs last</div>' +
        '<div id="insightsTrends"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">' +
        '<div>' +
          '<div class="chart-title" style="margin-bottom:10px">Course performance</div>' +
          '<div id="insightsCourses"></div>' +
        '</div>' +
        '<div>' +
          '<div class="chart-title" style="margin-bottom:10px">GPA forecast</div>' +
          '<div id="insightsGpa" style="background:var(--grad-soft);border-radius:12px;border:1px solid var(--glow)"></div>' +
        '</div>' +
      '</div>';

    var lastCard = null;
    var children = dash.children;
    for(var i = 0; i < children.length; i++){
      var ch = children[i];
      if(ch.classList && ch.classList.contains('card')) lastCard = ch;
    }

    try{
      if(lastCard && lastCard.parentNode === dash) dash.insertBefore(section, lastCard);
      else dash.appendChild(section);
    }catch(e){ dash.appendChild(section); }

    var refresh = document.getElementById('insightsRefresh');
    if(refresh && !refresh._bound){
      refresh._bound = true;
      refresh.addEventListener('click', function(){
        renderInsights();
        if(typeof window.toast === 'function') window.toast('Refreshed', 'success');
      });
    }
  }

  function install(){
    if(typeof window.renderDashboard !== 'function'){ setTimeout(install, 300); return; }
    if(window._insightsInstalled) return;
    window._insightsInstalled = true;

    var orig = window.renderDashboard;
    window.renderDashboard = function(){
      var r = orig.apply(this, arguments);
      try{ injectInsightsSection(); renderInsights(); }catch(e){ console.warn('insights error:', e); }
      return r;
    };

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
  window.computeGradePercentage = computeGradePercentage;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  console.log('insights.js v3 loaded');
})();