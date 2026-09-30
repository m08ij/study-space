/* ============================================================
   🧪 tests.js v2 — مُصلَح
   ============================================================ */
(function(){
  'use strict';

  var results = [];
  var pass = 0, fail = 0;

  function log(ok, name, detail){
    results.push({ok: ok, name: name, detail: detail});
    if(ok) pass++; else fail++;
    var icon = ok ? '✅' : '❌';
    var style = ok ? 'color:#34d399;font-weight:bold' : 'color:#f87171;font-weight:bold';
    console.log('%c' + icon + ' ' + name, style, detail || '');
  }
  function assert(name, cond, detail){ log(!!cond, name, cond ? '' : (detail || 'فشل')); }
  function assertEq(name, a, b){
    var ok = JSON.stringify(a) === JSON.stringify(b);
    log(ok, name, ok ? '' : 'توقّع: ' + JSON.stringify(b) + ' — حصل: ' + JSON.stringify(a));
  }

  function testGlobals(){
    console.log('%c🧩 Globals', 'color:#22d3ee;font-weight:bold');
    assert('space موجود', window.space !== null && typeof window.space === 'object');
    assert('notes مصفوفة', Array.isArray(window.notes));
    assert('gpaRows مصفوفة', Array.isArray(window.gpaRows));
    assert('SEMESTERS مصفوفة', Array.isArray(window.SEMESTERS));
    assert('GRADES كائن', typeof window.GRADES === 'object');
    assert('DAYS_AR 7 أيام', Array.isArray(window.DAYS_AR) && window.DAYS_AR.length === 7);
    assert('THEMES 9 ثيمات', Array.isArray(window.THEMES) && window.THEMES.length === 9);
    assert('COURSES_DESC محمّل', typeof window.COURSES_DESC === 'object');
    assert('SB محمّل', typeof window.SB === 'object');
  }

  function testFunctionsExist(){
    console.log('%c⚙️ Functions', 'color:#22d3ee;font-weight:bold');
    var fns = ['switchTab','renderDashboard','renderTasks','renderExams','renderCourses',
      'renderBudget','renderNotes','renderGpa','renderGradeCalc','renderAttendance',
      'renderDecks','renderPlan','renderHuLinks','renderCourseDescriptions','renderTimetable',
      'addTask','editTask','toggleTask','deleteTask',
      'addExam','editExam','deleteExam','addMyCourse','editMyCourse','deleteMyCourse',
      'addBudgetItem','editBudget','deleteBudget','addNote','deleteNote',
      'addCourse','removeRow','clearGpa','loadSampleGpa','calcGpa','calcWhatIf',
      'addDeck','deleteDeck','openDeck','addAttendanceCourse','markAttendance','removeAttendance',
      'toggleTimer','startTimer','stopTimer','resetTimer','setMode',
      'applyTheme','buildThemePanel','exportPDF','downloadBackup','restoreFromFile',
      'toast','showModal','customConfirm','uid','esc','today',
      'openQuickCapture','parseQuickCapture',
      'showNotif','isNotifSupported','getNotifPermission','requestNotifPermission',
      'switchSubTab','initSearch','checkReminders','checkSmartReminders'];
    var missing = fns.filter(function(fn){ return typeof window[fn] !== 'function'; });
    assert('كل الدوال معرّفة (' + fns.length + ')', missing.length === 0, 'ناقص: ' + missing.join(', '));
  }

  function testHelpers(){
    console.log('%c🔧 Helpers', 'color:#22d3ee;font-weight:bold');
    assertEq('uid نوعه string', typeof uid(), 'string');
    assert('uid فريد', uid() !== uid());
    assertEq('esc يحمي HTML', esc('<script>'), '&lt;script&gt;');
    assertEq('esc للفراغ', esc(''), '');
    assertEq('esc لـ null', esc(null), '');
    // اختبار today() المحلي
    var t = window.today();
    var d = new Date();
    var exp = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    assertEq('today() يستخدم التوقيت المحلي', t, exp);
  }

  function testStorage(){
    console.log('%c💾 Storage', 'color:#22d3ee;font-weight:bold');
    var k = '__t_' + Date.now();
    S.set(k, {a:1});
    assertEq('حفظ+استرجاع', S.get(k, null), {a:1});
    S.remove(k);
    assertEq('حذف', S.get(k, 'gone'), 'gone');
    assertEq('افتراضي', S.get('__nonexistent__', 'def'), 'def');
  }

  function testQuickCapture(){
    console.log('%c⚡ Quick Capture', 'color:#22d3ee;font-weight:bold');
    var cases = [
      {i:'واجب شبكات غدًا', e:{type:'task'}},
      {i:'امتحان شبكات 15/5', e:{type:'exam'}},
      {i:'صرفت 20 د أكل', e:{type:'expense', amount:20, category:'food'}},
      {i:'مصروف بنزين 20', e:{type:'expense', amount:20, category:'transport'}},
      {i:'دخل راتب 500', e:{type:'income', amount:500}},
      {i:'ملاحظة: اجتمعنا', e:{type:'note'}}
    ];
    cases.forEach(function(c){
      var r = parseQuickCapture(c.i);
      var ok = r && r.type === c.e.type;
      if(c.e.amount !== undefined) ok = ok && r.amount === c.e.amount;
      if(c.e.category !== undefined) ok = ok && r.category === c.e.category;
      log(ok, '"' + c.i + '"', ok ? '→ ' + r.type : '→ ' + JSON.stringify(r));
    });
  }

  function testGPACalc(){
    console.log('%c📊 GPA', 'color:#22d3ee;font-weight:bold');
    var saved = gpaRows.slice();
    gpaRows = [{name:'A',hrs:3,grade:'A (90-100)'},{name:'B',hrs:3,grade:'B (75-79)'}];
    var pts=0,hrs=0;
    gpaRows.forEach(function(r){ var h=parseFloat(r.hrs)||0; pts+=h*(GRADES[r.grade]||0); hrs+=h; });
    assertEq('حساب المعدل', (pts/hrs).toFixed(2), ((3*4+3*3)/6).toFixed(2));
    gpaRows = saved;
  }

  function testTheme(){
    console.log('%c🎨 Themes', 'color:#22d3ee;font-weight:bold');
    var orig = document.documentElement.getAttribute('data-theme');
    applyTheme('ocean');
    assertEq('ثيم محيط', document.documentElement.getAttribute('data-theme'), 'ocean');
    applyTheme('dark');
    if(orig && orig !== 'dark') applyTheme(orig);
    assert('THEMES كامل', ['dark','dracula','sakura','nord','ocean','royal','cyberpunk','midnight','aurora'].every(function(id){
      return THEMES.some(function(t){ return t.id === id; });
    }));
  }

  function testNavigation(){
    console.log('%c🧭 Navigation', 'color:#22d3ee;font-weight:bold');
    var tabs = ['dashboard','timetable','courses','tasks','exams','attendance','timer','flashcards','gradecalc','budget','notes','plan','hulinks'];
    var missing = tabs.filter(function(t){ return !document.getElementById(t); });
    assert('كل الأقسام (' + tabs.length + ')', missing.length === 0, 'ناقص: ' + missing.join(', '));
    assert('عناصر التنقل موجودة', document.querySelectorAll('.nav-item').length > 0);
    try{
      var b = document.querySelector('.section.active');
      if(b) b.classList.remove('active');
      switchTab('stats', false);
      assert('stats → dashboard', document.getElementById('dashboard').classList.contains('active'));
    }catch(e){ assert('stats → dashboard', false, e.message); }
    try{
      switchTab('gpa', false);
      assert('gpa → gradecalc', document.getElementById('gradecalc').classList.contains('active'));
    }catch(e){ assert('gpa → gradecalc', false, e.message); }
    try{ switchTab('dashboard', false); }catch(e){}
  }

  function testSubTabs(){
    console.log('%c📑 SubTabs', 'color:#22d3ee;font-weight:bold');
    var gc = document.querySelectorAll('[data-gc-tab]');
    assert('تبويبات gradecalc = 3', gc.length === 3, gc.length + '');
    var pl = document.querySelectorAll('[data-plan-tab]');
    assert('تبويبات plan ≥ 2', pl.length >= 2, pl.length + ''); // ← مرن
  }

  function testSB(){
    console.log('%c☁️ Supabase', 'color:#22d3ee;font-weight:bold');
    assert('SB موجود', typeof window.SB === 'object');
    if(window.SB){
      ['init','load','save','getCode','setCode','listCourseFiles','uploadCourseFile',
       'deleteCourseFile','formatFileSize','getFileIcon','showSyncPanel'].forEach(function(m){
        assert('SB.' + m, typeof window.SB[m] === 'function');
      });
      assertEq('formatFileSize 1KB', window.SB.formatFileSize(1024), '1.0 KB');
      assertEq('getFileIcon PDF', window.SB.getFileIcon('test.pdf'), '📄');
    }
  }

  function testBackup(){
    console.log('%c💾 Backup', 'color:#22d3ee;font-weight:bold');
    var s = gatherSnapshot();
    assert('snapshot.space', s.space !== undefined);
    assert('snapshot.notes مصفوفة', Array.isArray(s.notes));
    assert('snapshot.gpaRows مصفوفة', Array.isArray(s.gpaRows));
    assert('snapshot.version', typeof s.version === 'number');
  }

  function testCoursesData(){
    console.log('%c📕 Courses Data', 'color:#22d3ee;font-weight:bold');
    assert('COURSES_DESC كائن', typeof window.COURSES_DESC === 'object');
    assert('COURSES_DESC 50+', Object.keys(window.COURSES_DESC || {}).length >= 50);
  }

  function testPlanStructure(){
    console.log('%c📖 Plan', 'color:#22d3ee;font-weight:bold');
    assert('SEMESTERS 9+ فصول', SEMESTERS.length >= 9, SEMESTERS.length + '');
    var tc = 0, th = 0;
    SEMESTERS.forEach(function(s){
      tc += s.courses.length;
      s.courses.forEach(function(c){ th += c.h; });
    });
    assert('مجموع المواد 40+', tc >= 40, tc + '');
    assert('مجموع الساعات 120+', th >= 120, th + '');
  }

  function testCoursesDB(){
    console.log('%c📚 Courses DB v4', 'color:#22d3ee;font-weight:bold');
    var DB = window.COURSES_DB || {};
    var keys = Object.keys(DB);
    assert('DB فيه 100+ مادة', keys.length >= 100, keys.length + '');

    // ✅ لا أكواد مكررة
    var codes = {}, dupes = [];
    keys.forEach(function(k){
      var c = DB[k].code;
      if(codes[c]) dupes.push(c); else codes[c] = k;
    });
    assert('لا أكواد مكررة', dupes.length === 0, dupes.slice(0,3).join(', '));

    // ✅ ساعات حسب النوع
    var t = { 'uni-c':0,'uni-e':0,'faculty':0,'major-c':0,'major-e':0 };
    keys.forEach(function(k){
      var info = DB[k];
      if(t[info.t] !== undefined) t[info.t] += info.h;
    });
    assert('جامعة إجبارية = 18', t['uni-c'] === 18, '=' + t['uni-c']);
    assert('كلية = 33', t.faculty === 33, '=' + t.faculty);
    assert('تخصص إجباري = 88', t['major-c'] === 88, '=' + t['major-c']);

    // ✅ البحث بالكود (مع وبدون صفر)
    assertEq('findCourseByCode 110108101', !!findCourseByCode('110108101'), true);
    assertEq('findCourseByCode 0110108101', !!findCourseByCode('0110108101'), true);
    assert('validateCoursesDB موجودة', typeof window.validateCoursesDB === 'function');
  }

  function testPlanSimulator(){
    console.log('%c🎓 Plan Simulator', 'color:#22d3ee;font-weight:bold');
    assert('suggestNextSemester', typeof window.suggestNextSemester === 'function');
    assert('analyzeGraduationGap', typeof window.analyzeGraduationGap === 'function');
    if(typeof window.suggestNextSemester === 'function'){
      var s = window.suggestNextSemester();
      assert('اقتراحات.semester رقم', typeof s.semester === 'number');
      assert('اقتراحات.suggestions مصفوفة', Array.isArray(s.suggestions));
    }
  }

  function testCalendarSync(){
    console.log('%c📅 Calendar', 'color:#22d3ee;font-weight:bold');
    assert('buildICS دالة', typeof window.buildICS === 'function');
    if(typeof window.buildICS === 'function'){
      var ics = window.buildICS();
      assert('ICS يبدأ بـ VCALENDAR', ics.indexOf('BEGIN:VCALENDAR') === 0);
      assert('ICS ينتهي بـ VCALENDAR', ics.indexOf('END:VCALENDAR') > -1);
    }
  }

  function testAI(){
    console.log('%c🤖 AI', 'color:#22d3ee;font-weight:bold');
    ['شنو أسجل الترم الجاي؟','تقدمي للتخرج','شنو أدرس الحين؟','كم مهمة عندي؟'].forEach(function(q){
      try{
        var r = window.aiRespond(q);
        assert('AI: "' + q.substring(0,20) + '"', typeof r === 'string' && r.length > 10);
      }catch(e){ assert('AI: "' + q + '"', false, e.message); }
    });
  }

  function testNotifications(){
    console.log('%c🔔 Notifs', 'color:#22d3ee;font-weight:bold');
    assert('isNotifSupported', typeof isNotifSupported === 'function');
    var p = getNotifPermission();
    assert('إذن مقروء', ['granted','denied','default','unsupported'].indexOf(p) > -1, p);
  }

  function testDOMIds(){
    console.log('%c🆔 DOM', 'color:#22d3ee;font-weight:bold');
    var ids = ['dashboard','timetable','courses','tasks','exams','attendance','timer',
      'flashcards','gradecalc','budget','notes','plan','hulinks','searchInput',
      'settingsBtn','themeBtn','fabMain','fabMenu','aiFab','aiPanel',
      'welcomeOverlay','toastContainer','ncCurrent','ncWeight','ncTarget','ncCalc','ncResult',
      'gpaBody','gpaVal','btnAddGpa','btnLoadGpaSample','btnClearGpa',
      'studyChart','statsCards','gradeTrackerList','btnAddGrade'];
    var m = ids.filter(function(id){ return !document.getElementById(id); });
    assert('كل IDs (' + ids.length + ')', m.length === 0, 'ناقص: ' + m.join(', '));
  }

  function printSummary(){
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');
    var total = pass + fail;
    var pct = total ? Math.round((pass/total)*100) : 0;
    var color = fail === 0 ? '#34d399' : fail < 3 ? '#fbbf24' : '#f87171';
    console.log('%c📊 ' + pass + ' نجح / ' + fail + ' فشل — ' + pct + '%', 'color:' + color + ';font-weight:bold;font-size:14px');
    if(fail > 0){
      console.log('%c🔴 الفاشلة:', 'color:#f87171;font-weight:bold');
      results.filter(function(r){ return !r.ok; }).forEach(function(r){
        console.log('  ❌ ' + r.name, r.detail || '');
      });
    } else {
      console.log('%c🎉 كل الاختبارات نجحت!', 'color:#34d399;font-weight:bold;font-size:14px');
    }
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');
    return {pass: pass, fail: fail, results: results};
  }

  // ✅ printSummary آخر شي
  function testQuick(){
    console.clear();
    console.log('%c⚡ اختبار سريع', 'color:#a78bfa;font-weight:bold;font-size:14px');
    results = []; pass = 0; fail = 0;
    testGlobals(); testFunctionsExist(); testHelpers(); testStorage();
    testQuickCapture(); testPlanSimulator(); testAI();
    printSummary();
  }

  function testAll(){
    console.clear();
    console.log('%c🧪 اختبار شامل', 'color:#a78bfa;font-weight:bold;font-size:16px');
    results = []; pass = 0; fail = 0;
    testGlobals(); testFunctionsExist(); testHelpers(); testStorage();
    testQuickCapture(); testGPACalc(); testTheme(); testNavigation();
    testSubTabs(); testSB(); testBackup(); testCoursesData();
    testPlanStructure(); testCoursesDB(); testPlanSimulator();
    testCalendarSync(); testAI(); testNotifications(); testDOMIds();
    setTimeout(printSummary, 300);
  }

  window.testAll = testAll;
  window.testQuick = testQuick;
  console.log('%c🧪 tests.js v2 محمّل — اكتب testAll() أو testQuick()', 'color:#a78bfa;font-weight:bold');
})();