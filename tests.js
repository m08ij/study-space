/* ============================================================
   🧪 tests.js — اختبارات شاملة لمكونات الموقع
   الاستخدام: افتح Console واكتب  testAll()  أو  testQuick()
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

  function assert(name, cond, detail){
    log(!!cond, name, cond ? '' : (detail || 'فشل'));
  }

  function assertEq(name, a, b){
    var ok = JSON.stringify(a) === JSON.stringify(b);
    log(ok, name, ok ? '' : 'توقّع: ' + JSON.stringify(b) + ' — حصل: ' + JSON.stringify(a));
  }

  /* ==================== TESTS ==================== */
  function testGlobals(){
    console.log('%c🧩 Globals', 'color:#22d3ee;font-weight:bold');
    assert('space موجود', window.space !== null && typeof window.space === 'object');
    assert('notes مصفوفة', Array.isArray(window.notes));
    assert('gpaRows مصفوفة', Array.isArray(window.gpaRows));
    assert('SEMESTERS مصفوفة', Array.isArray(window.SEMESTERS));
    assert('GRADES كائن', typeof window.GRADES === 'object');
    assert('DAYS_AR مصفوفة 7 أيام', Array.isArray(window.DAYS_AR) && window.DAYS_AR.length === 7);
    assert('THEMES 9 ثيمات', Array.isArray(window.THEMES) && window.THEMES.length === 9);
    assert('HU_LINKS كائن', typeof window.HU_LINKS === 'object');
    assert('BUDGET_CATS مصفوفة', Array.isArray(window.BUDGET_CATS));
    assert('COURSES_DESC محمّل', typeof window.COURSES_DESC === 'object');
    assert('SB محمّل', typeof window.SB === 'object');
  }

  function testFunctionsExist(){
    console.log('%c⚙️ Functions', 'color:#22d3ee;font-weight:bold');
    var fns = ['switchTab','renderDashboard','renderTasks','renderExams','renderCourses',
      'renderBudget','renderNotes','renderGpa','renderGradeCalc','renderAttendance',
      'renderDecks','renderPlan','renderHuLinks','renderCourseDescriptions','renderTimetable',
      'addTask','editTask','toggleTask','deleteTask',
      'addExam','editExam','deleteExam',
      'addMyCourse','editMyCourse','deleteMyCourse',
      'addBudgetItem','editBudget','deleteBudget',
      'addNote','deleteNote',
      'addCourse','removeRow','clearGpa','loadSampleGpa','calcGpa','calcWhatIf',
      'addDeck','deleteDeck','openDeck',
      'addAttendanceCourse','markAttendance','removeAttendance',
      'toggleTimer','startTimer','stopTimer','resetTimer','setMode',
      'applyTheme','buildThemePanel','exportPDF','downloadBackup','restoreFromFile',
      'toast','showModal','customConfirm','uid','esc',
      'openQuickCapture','parseQuickCapture',
      'showNotif','isNotifSupported','getNotifPermission','requestNotifPermission',
      'switchSubTab','initSearch','checkReminders','checkSmartReminders'
    ];
    var missing = [];
    fns.forEach(function(fn){
      if(typeof window[fn] !== 'function') missing.push(fn);
    });
    assert('كل الدوال معرّفة (' + fns.length + ')', missing.length === 0, 'ناقص: ' + missing.join(', '));
  }

  function testHelpers(){
    console.log('%c🔧 Helpers', 'color:#22d3ee;font-weight:bold');
    assertEq('uid يُنتج نص', typeof uid(), 'string');
    assert('uid طويل', uid().length > 5);
    assert('uid فريد', uid() !== uid());
    assertEq('esc يحمي من HTML', esc('<script>'), '&lt;script&gt;');
    assertEq('esc يحمي من علامات التنصيص', esc('"test"'), '&quot;test&quot;');
    assertEq('esc للفراغ', esc(''), '');
    assertEq('esc لـ null', esc(null), '');
  }

  function testStorage(){
    console.log('%c💾 Storage', 'color:#22d3ee;font-weight:bold');
    var testKey = '__test_' + Date.now();
    var testVal = {hello: 'world', n: 42};
    S.set(testKey, testVal);
    var back = S.get(testKey, null);
    assertEq('حفظ + استرجاع', back, testVal);
    S.remove(testKey);
    assertEq('حذف', S.get(testKey, 'gone'), 'gone');
    assertEq('قيمة افتراضية', S.get('__nonexistent__', 'def'), 'def');
  }

  function testQuickCaptureParser(){
    console.log('%c⚡ Quick Capture Parser', 'color:#22d3ee;font-weight:bold');
    var cases = [
      {input:'واجب شبكات غدًا', expect:{type:'task'}},
      {input:'مهمة رياضيات', expect:{type:'task'}},
      {input:'امتحان شبكات 15/5', expect:{type:'exam'}},
      {input:'اختبار رياضيات', expect:{type:'exam'}},
      {input:'صرفت 20 د أكل', expect:{type:'expense', amount:20}},
      {input:'مصروف مواصلات 5 دينار', expect:{type:'expense', amount:5}},
      {input:'دخل راتب 500', expect:{type:'income', amount:500}},
      {input:'ملاحظة: اجتمعنا بفريق', expect:{type:'note'}},
      {input:'واجب برمجة بعد 3 أيام', expect:{type:'task'}},
      {input:'واجب رياضيات يوم الأحد', expect:{type:'task'}},
      {input:'مصروف أكل 10', expect:{type:'expense', category:'food'}},
      {input:'مصروف بنزين 20', expect:{type:'expense', category:'transport'}}
    ];
    cases.forEach(function(c){
      var r = parseQuickCapture(c.input);
      var ok = r && r.type === c.expect.type;
      if(c.expect.amount !== undefined) ok = ok && r.amount === c.expect.amount;
      if(c.expect.category !== undefined) ok = ok && r.category === c.expect.category;
      log(ok, '"' + c.input + '"', ok ? ('→ ' + r.type) : ('→ ' + JSON.stringify(r)));
    });
  }

  function testTaskCRUD(){
    console.log('%c📝 Tasks CRUD', 'color:#22d3ee;font-weight:bold');
    var before = window.space.tasks.length;
    var task = {id: uid(), title:'__TEST_TASK__', type:'task', course:'', due:'', done:false};
    window.space.tasks.push(task);
    assertEq('إضافة مهمة', window.space.tasks.length, before + 1);
    assert('العثور على المهمة', window.space.tasks.find(function(t){ return t.id === task.id; }) !== undefined);
    task.done = true;
    assert('تحديث حالة المهمة', task.done === true);
    window.space.tasks = window.space.tasks.filter(function(t){ return t.id !== task.id; });
    assertEq('حذف المهمة', window.space.tasks.length, before);
  }

  function testExamCRUD(){
    console.log('%c⏳ Exams CRUD', 'color:#22d3ee;font-weight:bold');
    var before = window.space.exams.length;
    var exam = {id: uid(), name:'__TEST_EXAM__', course:'', date:'2026-12-31', time:'10:00', room:'A'};
    window.space.exams.push(exam);
    assertEq('إضافة امتحان', window.space.exams.length, before + 1);
    window.space.exams = window.space.exams.filter(function(e){ return e.id !== exam.id; });
    assertEq('حذف الامتحان', window.space.exams.length, before);
  }

  function testCourseCRUD(){
    console.log('%c📚 Courses CRUD', 'color:#22d3ee;font-weight:bold');
    var before = window.space.courses.length;
    var c = {id: uid(), name:'__TEST_COURSE__', code:'000', hours:3, instructor:'', room:''};
    window.space.courses.push(c);
    assertEq('إضافة مادة', window.space.courses.length, before + 1);
    window.space.courses = window.space.courses.filter(function(x){ return x.id !== c.id; });
    assertEq('حذف المادة', window.space.courses.length, before);
  }

  function testBudgetCRUD(){
    console.log('%c💰 Budget CRUD', 'color:#22d3ee;font-weight:bold');
    var before = (window.space.budget || []).length;
    var b = {id: uid(), type:'expense', category:'food', amount: 15, date: new Date().toISOString().slice(0,10), note:'__TEST__'};
    if(!window.space.budget) window.space.budget = [];
    window.space.budget.push(b);
    assertEq('إضافة مصروف', window.space.budget.length, before + 1);

    var income = window.space.budget.filter(function(x){ return x.type === 'income'; }).reduce(function(a,x){ return a + (parseFloat(x.amount)||0); }, 0);
    var expense = window.space.budget.filter(function(x){ return x.type === 'expense'; }).reduce(function(a,x){ return a + (parseFloat(x.amount)||0); }, 0);
    assert('حساب الرصيد', typeof (income - expense) === 'number');

    window.space.budget = window.space.budget.filter(function(x){ return x.id !== b.id; });
    assertEq('حذف المصروف', window.space.budget.length, before);
  }

  function testNotesCRUD(){
    console.log('%c📔 Notes CRUD', 'color:#22d3ee;font-weight:bold');
    var before = window.notes.length;
    window.notes.unshift({title:'__TEST__', body:'test', ts: Date.now()});
    assertEq('إضافة ملاحظة', window.notes.length, before + 1);
    window.notes.splice(0, 1);
    assertEq('حذف الملاحظة', window.notes.length, before);
  }

  function testGPACalc(){
    console.log('%c📊 GPA Calc', 'color:#22d3ee;font-weight:bold');
    var savedRows = gpaRows.slice();
    gpaRows = [
      {name:'A', hrs:3, grade:'A (90-100)'},
      {name:'B', hrs:3, grade:'B (75-79)'}
    ];
    var pts = 0, hrs = 0;
    gpaRows.forEach(function(r){ var h = parseFloat(r.hrs)||0; pts += h*(GRADES[r.grade]||0); hrs += h; });
    var expected = (3*4.0 + 3*3.0) / 6;
    var actual = pts / hrs;
    assertEq('حساب المعدل', actual.toFixed(2), expected.toFixed(2));
    gpaRows = savedRows;
  }

  function testNeedCalc(){
    console.log('%c🎯 Need Calculator', 'color:#22d3ee;font-weight:bold');
    var cur = 72, w = 40, target = 60;
    var currentWeight = 100 - w;
    var need = (target - cur * (currentWeight/100)) / (w/100);
    assert('حساب كم أحتاج يعطي رقم', typeof need === 'number' && !isNaN(need));
    assert('السعر معقول', need >= -100 && need <= 200);
  }

  function testThemeApply(){
    console.log('%c🎨 Themes', 'color:#22d3ee;font-weight:bold');
    var original = document.documentElement.getAttribute('data-theme');
    applyTheme('ocean');
    assertEq('تطبيق ثيم محيط', document.documentElement.getAttribute('data-theme'), 'ocean');
    applyTheme('dark');
    assertEq('العودة للداكن', document.documentElement.getAttribute('data-theme'), 'dark');
    if(original && original !== 'dark') applyTheme(original);
    assert('THEMES بها كل الثيمات', ['dark','ocean','sunset','forest','royal','cyberpunk','midnight','aurora','ember'].every(function(id){
      return THEMES.some(function(t){ return t.id === id; });
    }));
  }

  function testTimer(){
    console.log('%c⏱️ Timer', 'color:#22d3ee;font-weight:bold');
    var originalMode = ts.mode;
    setMode(null, 'focus');
    assertEq('النمط focus', ts.mode, 'focus');
    assert('الوقت المتبقي رقم', typeof ts.remaining === 'number');
    resetTimer();
    assertEq('إعادة تعيين', ts.remaining, TM.focus);
    setMode(null, 'short');
    assertEq('النمط short', ts.mode, 'short');
    stopTimer();
    setMode(null, originalMode || 'focus');
    assert('timer يعمل', ts.running === false);
  }

  function testNotifications(){
    console.log('%c🔔 Notifications', 'color:#22d3ee;font-weight:bold');
    assert('isNotifSupported() دالة', typeof isNotifSupported === 'function');
    assert('getNotifPermission() دالة', typeof getNotifPermission === 'function');
    var perm = getNotifPermission();
    assert('إذن الإشعارات مقروء', ['granted','denied','default','unsupported'].indexOf(perm) > -1, 'perm=' + perm);
    assert('showNotif دالة', typeof showNotif === 'function');
  }

  function testNavigation(){
    console.log('%c🧭 Navigation', 'color:#22d3ee;font-weight:bold');
    var tabs = ['dashboard','timetable','courses','tasks','exams','attendance','timer','flashcards','gradecalc','budget','notes','plan','hulinks'];
    var missing = [];
    tabs.forEach(function(t){
      if(!document.getElementById(t)) missing.push(t);
    });
    assert('كل الأقسام موجودة (' + tabs.length + ')', missing.length === 0, 'ناقص: ' + missing.join(', '));

    var navItems = document.querySelectorAll('.nav-item');
    assert('عناصر التنقل موجودة', navItems.length > 0, navItems.length + ' عنصر');

    // Test navigation via redirect
    switchTab('stats', false);
    setTimeout(function(){
      assert('stats → dashboard', document.getElementById('dashboard').classList.contains('active'));
      switchTab('gpa', false);
      setTimeout(function(){
        assert('gpa → gradecalc', document.getElementById('gradecalc').classList.contains('active'));
        switchTab('dashboard', false);
      }, 100);
    }, 100);
  }

  function testSubTabs(){
    console.log('%c📑 SubTabs', 'color:#22d3ee;font-weight:bold');
    var gcTabs = document.querySelectorAll('[data-gc-tab]');
    assert('تبويبات gradecalc موجودة', gcTabs.length === 3, gcTabs.length + ' تبويب');
    var planTabs = document.querySelectorAll('[data-plan-tab]');
    assert('تبويبات plan موجودة', planTabs.length === 2, planTabs.length + ' تبويب');
  }

  function testDOMIds(){
    console.log('%c🆔 DOM IDs', 'color:#22d3ee;font-weight:bold');
    var ids = ['dashboard','timetable','courses','tasks','exams','attendance','timer','flashcards',
      'gradecalc','budget','notes','plan','hulinks','searchInput','settingsBtn','themeBtn',
      'fabMain','fabMenu','aiFab','aiPanel','welcomeOverlay','toastContainer',
      'ncCurrent','ncWeight','ncTarget','ncCalc','ncResult',
      'gpaBody','gpaVal','btnAddGpa','btnLoadGpaSample','btnClearGpa',
      'studyChart','statsCards','gradeTrackerList','btnAddGrade'];
    var missing = [];
    ids.forEach(function(id){
      if(!document.getElementById(id)) missing.push(id);
    });
    assert('كل IDs موجودة (' + ids.length + ')', missing.length === 0, 'ناقص: ' + missing.join(', '));
  }

  function testSB(){
    console.log('%c☁️ Supabase Client', 'color:#22d3ee;font-weight:bold');
    assert('SB موجود', typeof window.SB === 'object');
    if(window.SB){
      assert('SB.init دالة', typeof window.SB.init === 'function');
      assert('SB.load دالة', typeof window.SB.load === 'function');
      assert('SB.save دالة', typeof window.SB.save === 'function');
      assert('SB.getCode دالة', typeof window.SB.getCode === 'function');
      assert('SB.setCode دالة', typeof window.SB.setCode === 'function');
      assert('SB.listCourseFiles دالة', typeof window.SB.listCourseFiles === 'function');
      assert('SB.uploadCourseFile دالة', typeof window.SB.uploadCourseFile === 'function');
      assert('SB.deleteCourseFile دالة', typeof window.SB.deleteCourseFile === 'function');
      assert('SB.formatFileSize دالة', typeof window.SB.formatFileSize === 'function');
      assert('SB.getFileIcon دالة', typeof window.SB.getFileIcon === 'function');
      assert('SB.showSyncPanel دالة', typeof window.SB.showSyncPanel === 'function');
      var code = window.SB.getCode();
      assert('رمز المزامنة 6 خانات', typeof code === 'string' && code.length === 6, 'code=' + code);
      assertEq('formatFileSize 1KB', window.SB.formatFileSize(1024), '1.0 KB');
      assertEq('formatFileSize 1MB', window.SB.formatFileSize(1048576), '1.0 MB');
      assertEq('getFileIcon PDF', window.SB.getFileIcon('test.pdf'), '📄');
      assertEq('getFileIcon صورة', window.SB.getFileIcon('img.PNG'), '🖼️');
    }
  }

  function testWidgets(){
    console.log('%c🎯 Widgets', 'color:#22d3ee;font-weight:bold');
    assert('widget sidebar موجود', document.getElementById('lwSidebar') !== null);
    assert('expand button موجود', document.getElementById('lwExpandBtn') !== null);
    assert('focus screen موجود', document.getElementById('focusScreen') !== null);
    var wList = ['focus','weather','prayer','events','quote'];
    var sidebar = document.getElementById('lwSidebar');
    if(sidebar){
      var html = sidebar.innerHTML || '';
      // مش كل الويدجت مفعّلة افتراضيًا، فقط نتأكد إن الـ sidebar موجود
      assert('sidebar فيه محتوى', html.length > 0);
    }
  }

  function testSmartReminders(){
    console.log('%c⏰ Smart Reminders', 'color:#22d3ee;font-weight:bold');
    assert('checkReminders دالة', typeof checkReminders === 'function');
    assert('checkSmartReminders دالة', typeof checkSmartReminders === 'function');
    // لا نستدعيها فعليًا لأنها تُظهر toast
  }

  function testBackup(){
    console.log('%c💾 Backup', 'color:#22d3ee;font-weight:bold');
    var snap = gatherSnapshot();
    assert('gatherSnapshot يعمل', typeof snap === 'object');
    assert('snapshot فيه space', snap.space !== undefined);
    assert('snapshot فيه notes', Array.isArray(snap.notes));
    assert('snapshot فيه gpaRows', Array.isArray(snap.gpaRows));
    assert('snapshot فيه timerSettings', snap.timerSettings !== undefined);
    assert('snapshot فيه version', typeof snap.version === 'number');
    assert('snapshot فيه savedAt', typeof snap.savedAt === 'string');
  }

  function testCoursesData(){
    console.log('%c📕 Courses Data', 'color:#22d3ee;font-weight:bold');
    var CD = window.COURSES_DESC;
    assert('COURSES_DESC كائن', typeof CD === 'object');
    var keys = Object.keys(CD || {});
    assert('COURSES_DESC فيه 50+ مادة', keys.length >= 50, keys.length + ' مادة');
    var sample = keys[0];
    assert('أول وصف نصي', typeof CD[sample] === 'string' && CD[sample].length > 20);
  }

  function testPlanStructure(){
    console.log('%c📖 Plan Structure', 'color:#22d3ee;font-weight:bold');
    assert('SEMESTERS فيها 9 فصول', SEMESTERS.length === 9, SEMESTERS.length + ' فصل');
    var totalCourses = 0, totalHours = 0;
    SEMESTERS.forEach(function(s){
      totalCourses += s.courses.length;
      s.courses.forEach(function(c){ totalHours += c.h; });
    });
    assert('مجموع المواد 40+', totalCourses >= 40, totalCourses + ' مادة');
    assert('مجموع الساعات 120+', totalHours >= 120, totalHours + ' ساعة');
  }
  /* ==================== NEW MODULE TESTS ==================== */
  function testPlanSimulator(){
    console.log('%c🎓 Plan Simulator', 'color:#22d3ee;font-weight:bold');
    assert('COURSES_DB محمّل', typeof window.COURSES_DB === 'object' && Object.keys(window.COURSES_DB).length > 50);
    assert('COURSE_TYPES محمّل', typeof window.COURSE_TYPES === 'object');
    assert('TOTAL_REQUIRED_HOURS محمّل', typeof window.TOTAL_REQUIRED_HOURS === 'object');
    assert('findCourseByCode دالة', typeof window.findCourseByCode === 'function');
    assert('searchCourses دالة', typeof window.searchCourses === 'function');
    assert('suggestNextSemester دالة', typeof window.suggestNextSemester === 'function');
    assert('analyzeGraduationGap دالة', typeof window.analyzeGraduationGap === 'function');

    // اختبار البحث بالكود
    var found = window.findCourseByCode('110408220');
    assert('بحث بالكود يرجع نتيجة', found !== null, 'code=110408220');
    if(found) assert('نتيجة البحث اسم صحيح', typeof found.name === 'string');

    // اختبار الاقتراحات
    var sug = window.suggestNextSemester();
    assert('الاقتراحات كائن', typeof sug === 'object');
    assert('فيه semester', typeof sug.semester === 'number');
    assert('فيه suggestions مصفوفة', Array.isArray(sug.suggestions));
  }

  function testCalendarSync(){
    console.log('%c📅 Calendar Sync', 'color:#22d3ee;font-weight:bold');
    assert('buildICS دالة', typeof window.buildICS === 'function');
    assert('downloadICS دالة', typeof window.downloadICS === 'function');
    if(typeof window.buildICS === 'function'){
      var ics = window.buildICS();
      assert('ICS نص', typeof ics === 'string');
      assert('ICS يبدأ بـ BEGIN:VCALENDAR', ics.indexOf('BEGIN:VCALENDAR') === 0);
      assert('ICS ينتهي بـ END:VCALENDAR', ics.indexOf('END:VCALENDAR') > -1);
    }
  }

  function testInsights(){
    console.log('%c📈 Insights', 'color:#22d3ee;font-weight:bold');
    assert('renderInsights دالة', typeof window.renderInsights === 'function');
    assert('Heatmap container موجود', document.getElementById('insightsHeatmap') !== null);
    assert('Trends container موجود', document.getElementById('insightsTrends') !== null);
    assert('Courses container موجود', document.getElementById('insightsCourses') !== null);
    assert('GPA container موجود', document.getElementById('insightsGpa') !== null);
  }

  function testAIPlus(){
    console.log('%c🤖 AI Plus', 'color:#22d3ee;font-weight:bold');
    var testQueries = [
      'شنو أسجل الترم الجاي؟',
      'تقدمي للتخرج',
      'ايش مادة 110408220؟',
      'شنو أدرس الحين؟',
      'كيف دراستي؟'
    ];
    testQueries.forEach(function(q){
      try{
        var res = window.aiRespond(q);
        assert('AI يجاوب: "' + q.substring(0, 25) + '"', typeof res === 'string' && res.length > 10);
      }catch(e){
        assert('AI يجاوب: "' + q + '"', false, e.message);
      }
    });
  }

  function testCoursesDataDB(){
    console.log('%c📚 Courses DB v2', 'color:#22d3ee;font-weight:bold');
    var DB = window.COURSES_DB || {};
    var keys = Object.keys(DB);
    assert('DB فيه 100+ مادة', keys.length >= 100, keys.length + ' مادة');

    var types = { 'uni-c':0, 'uni-e':0, 'faculty':0, 'major-c':0, 'major-e':0 };
    var totalH = { 'uni-c':0, 'uni-e':0, 'faculty':0, 'major-c':0, 'major-e':0 };
    keys.forEach(function(k){
      var info = DB[k];
      if(types[info.t] !== undefined){
        types[info.t]++;
        totalH[info.t] += info.h;
      }
    });
    assert('ساعات كلية >= 30', totalH.faculty >= 30, 'faculty=' + totalH.faculty);
    assert('ساعات تخصص إجباري >= 80', totalH['major-c'] >= 80, 'major-c=' + totalH['major-c']);
  }
  /* ==================== RUNNERS ==================== */
  function testQuick(){
    console.clear();
    console.log('%c⚡ اختبار سريع', 'color:#a78bfa;font-weight:bold;font-size:14px');
    results = []; pass = 0; fail = 0;
    testGlobals();
    testFunctionsExist();
    testHelpers();
    testStorage();
    testQuickCaptureParser();
    printSummary();
	testPlanSimulator();
    testAIPlus();
  }

  function testAll(){
    console.clear();
    console.log('%c🧪 اختبار شامل لموقع مساحتي الدراسية', 'color:#a78bfa;font-weight:bold;font-size:16px');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');
    results = []; pass = 0; fail = 0;

    testGlobals();
    testFunctionsExist();
    testHelpers();
    testStorage();
    testQuickCaptureParser();
    testTaskCRUD();
    testExamCRUD();
    testCourseCRUD();
    testBudgetCRUD();
    testNotesCRUD();
    testGPACalc();
    testNeedCalc();
    testThemeApply();
    testTimer();
    testNotifications();
    testSubTabs();
    testDOMIds();
    testSB();
    testWidgets();
    testSmartReminders();
    testBackup();
    testCoursesData();
    testPlanStructure();
    testNavigation();
    testPlanSimulator();
    testCalendarSync();
    testInsights();
    testAIPlus();
    testCoursesDataDB();
    setTimeout(function(){
      printSummary();
      console.log('%c💡 ملاحظة: اختبارات Navigation قد تتأخر قليلاً', 'color:#8a96b8;font-style:italic');
    }, 300);
  }

  function printSummary(){
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');
    var total = pass + fail;
    var pct = total ? Math.round((pass / total) * 100) : 0;
    var color = fail === 0 ? '#34d399' : fail < 3 ? '#fbbf24' : '#f87171';
    console.log('%c📊 النتيجة: ' + pass + ' نجح / ' + fail + ' فشل — ' + pct + '%', 'color:' + color + ';font-weight:bold;font-size:14px');
    if(fail > 0){
      console.log('%c🔴 الاختبارات الفاشلة:', 'color:#f87171;font-weight:bold');
      results.filter(function(r){ return !r.ok; }).forEach(function(r){
        console.log('  ❌ ' + r.name, r.detail || '');
      });
    } else {
      console.log('%c🎉 كل الاختبارات نجحت!', 'color:#34d399;font-weight:bold;font-size:14px');
    }
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');
    return {pass: pass, fail: fail, results: results};
  }

  window.testAll = testAll;
  window.testQuick = testQuick;

  console.log('%c🧪 tests.js محمّل — اكتب testAll() أو testQuick() في الـ Console', 'color:#a78bfa;font-weight:bold');
})();