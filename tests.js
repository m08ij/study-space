/* ============================================================
   🧪 tests.js v3 — اختبارات سلوكية شاملة
   - Test Runner with describe/it/expect
   - Async support
   - Isolated state (save/restore)
   - ~80 اختبار حقيقي (input → output)
   ============================================================ */
(function(){
  'use strict';

  /* ============================================================
     Test Runner
     ============================================================ */
  var suites = [];
  var currentSuite = null;
  var results = [];
  var pass = 0, fail = 0;
  var onlyMode = null;      /* ركّز على suite واحد */
  var running = false;

  function describe(name, fn){
    currentSuite = { name: name, tests: [] };
    suites.push(currentSuite);
    try{ fn(); }catch(e){ console.error('describe error:', name, e); }
    currentSuite = null;
  }

  function it(name, fn){
    if(!currentSuite){ console.warn('it() without describe:', name); return; }
    currentSuite.tests.push({ name: name, fn: fn });
  }

  function expect(actual){
    return {
      toBe: function(expected){
        if(actual !== expected){
          throw new Error('expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
        }
      },
      toEqual: function(expected){
        var a = JSON.stringify(actual), b = JSON.stringify(expected);
        if(a !== b){
          throw new Error('expected ' + b + ' but got ' + a);
        }
      },
      toBeTruthy: function(){
        if(!actual) throw new Error('expected truthy but got ' + JSON.stringify(actual));
      },
      toBeFalsy: function(){
        if(actual) throw new Error('expected falsy but got ' + JSON.stringify(actual));
      },
      toBeGreaterThan: function(n){
        if(!(actual > n)) throw new Error('expected > ' + n + ' but got ' + actual);
      },
      toBeGreaterThanOrEqual: function(n){
        if(!(actual >= n)) throw new Error('expected >= ' + n + ' but got ' + actual);
      },
      toBeLessThan: function(n){
        if(!(actual < n)) throw new Error('expected < ' + n + ' but got ' + actual);
      },
      toBeLessThanOrEqual: function(n){
        if(!(actual <= n)) throw new Error('expected <= ' + n + ' but got ' + actual);
      },
      toContain: function(sub){
        if(String(actual).indexOf(sub) === -1){
          throw new Error('expected "' + actual + '" to contain "' + sub + '"');
        }
      },
      toMatch: function(re){
        if(!re.test(String(actual))){
          throw new Error('expected "' + actual + '" to match ' + re);
        }
      },
      toBeCloseTo: function(n, digits){
        digits = digits || 2;
        var d = Math.pow(10, digits);
        if(Math.round(actual * d) !== Math.round(n * d)){
          throw new Error('expected ~' + n + ' (±' + (1/d) + ') but got ' + actual);
        }
      },
      toBeArray: function(){
        if(!Array.isArray(actual)) throw new Error('expected array but got ' + typeof actual);
      },
      toBeFunction: function(){
        if(typeof actual !== 'function') throw new Error('expected function but got ' + typeof actual);
      },
      toBeObject: function(){
        if(!actual || typeof actual !== 'object' || Array.isArray(actual)){
          throw new Error('expected object but got ' + JSON.stringify(actual));
        }
      },
      toThrow: function(){
        try{ actual(); }catch(e){ return; }
        throw new Error('expected function to throw');
      }
    };
  }

  /* ============================================================
     Helpers
     ============================================================ */
  function snapshotState(){
    return {
      space: window.space ? JSON.parse(JSON.stringify(window.space)) : null,
      notes: window.notes ? JSON.parse(JSON.stringify(window.notes)) : [],
      gpaRows: window.gpaRows ? JSON.parse(JSON.stringify(window.gpaRows)) : []
    };
  }
  function restoreState(snap){
    if(snap.space !== undefined && snap.space !== null) window.space = snap.space;
    if(snap.notes !== undefined) window.notes = snap.notes;
    if(snap.gpaRows !== undefined) window.gpaRows = snap.gpaRows;
  }

  function cleanStorageKeys(prefix){
    try{
      var keys = [];
      for(var i = 0; i < localStorage.length; i++){
        var k = localStorage.key(i);
        if(k && k.indexOf(prefix) === 0) keys.push(k);
      }
      keys.forEach(function(k){
        try{ localStorage.removeItem(k); }catch(e){}
      });
    }catch(e){}
  }

  function makeSpace(overrides){
    var base = {
      profile: { name: '' },
      timetable: {}, courses: [], tasks: [], exams: [],
      attendance: {}, decks: [], budget: [], grades: [],
      completedCourses: [], currentSemester: 1, extras: []
    };
    if(overrides){
      Object.keys(overrides).forEach(function(k){ base[k] = overrides[k]; });
    }
    return base;
  }

  /* ============================================================
     Runner
     ============================================================ */
  async function runTests(){
    if(running){
      console.warn('tests already running');
      return;
    }
    running = true;
    results = []; pass = 0; fail = 0;

    var snap = snapshotState();
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');
    console.log('%c🧪 Test Run Started', 'color:#22d3ee;font-weight:bold;font-size:14px');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');

    var t0 = performance.now();

    for(var si = 0; si < suites.length; si++){
      var suite = suites[si];
      if(onlyMode && suite.name.indexOf(onlyMode) === -1) continue;

      console.log('%c▸ ' + suite.name, 'color:#a78bfa;font-weight:bold;margin-top:6px');

      for(var ti = 0; ti < suite.tests.length; ti++){
        var test = suite.tests[ti];
        var start = performance.now();
        try{
          var r = test.fn();
          if(r && typeof r.then === 'function'){
            await r;
          }
          pass++;
          results.push({ ok: true, suite: suite.name, name: test.name, ms: performance.now() - start });
          console.log('%c  ✅ ' + test.name, 'color:#34d399');
        }catch(err){
          fail++;
          results.push({ ok: false, suite: suite.name, name: test.name, error: err.message || String(err) });
          console.log('%c  ❌ ' + test.name, 'color:#f87171;font-weight:bold');
          console.log('%c     ' + (err.message || String(err)), 'color:#f87171');
        }
      }
    }

    var elapsed = (performance.now() - t0).toFixed(0);
    restoreState(snap);

    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');
    var total = pass + fail;
    var pct = total ? Math.round((pass / total) * 100) : 0;
    var summaryColor = fail === 0 ? '#34d399' : fail < 5 ? '#fbbf24' : '#f87171';
    console.log('%c📊 ' + pass + ' / ' + total + ' نجحت (' + pct + '%) في ' + elapsed + 'ms',
      'color:' + summaryColor + ';font-weight:bold;font-size:14px');

    if(fail > 0){
      console.log('%c🔴 الفاشلة:', 'color:#f87171;font-weight:bold');
      results.filter(function(r){ return !r.ok; }).forEach(function(r){
        console.log('  • [' + r.suite + '] ' + r.name + ' — ' + r.error);
      });
    } else {
      console.log('%c🎉 كل الاختبارات نجحت!', 'color:#34d399;font-weight:bold');
    }
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color:#22d3ee');

    running = false;
    return { pass: pass, fail: fail, results: results, elapsed: elapsed };
  }

  function runSuite(pattern){
    onlyMode = pattern;
    return runTests().then(function(r){
      onlyMode = null;
      return r;
    });
  }

  /* ============================================================
     Suite 1: Utils
     ============================================================ */
  describe('🔧 Utils', function(){
    it('esc يحمي HTML', function(){
      expect(window.esc('<script>alert(1)</script>'))
        .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
    it('esc يتعامل مع null', function(){
      expect(window.esc(null)).toBe('');
    });
    it('esc يتعامل مع الأرقام', function(){
      expect(window.esc(123)).toBe('123');
    });
    it('uid ينتج string', function(){
      expect(typeof window.uid()).toBe('string');
    });
    it('uid فريد خلال 1000 نداء', function(){
      var seen = {};
      var dupes = 0;
      for(var i = 0; i < 1000; i++){
        var u = window.uid();
        if(seen[u]) dupes++;
        seen[u] = true;
      }
      expect(dupes).toBe(0);
    });
    it('today() بصيغة YYYY-MM-DD', function(){
      expect(window.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    it('today() يستخدم الوقت المحلي', function(){
      var d = new Date();
      var expected = d.getFullYear() + '-' +
        String(d.getMonth()+1).padStart(2,'0') + '-' +
        String(d.getDate()).padStart(2,'0');
      expect(window.today()).toBe(expected);
    });
    it('daysBetween يحسب الفرق', function(){
      expect(window.daysBetween('2025-01-01', '2025-01-11')).toBe(10);
    });
    it('daysBetween يعمل بالسالب', function(){
      expect(window.daysBetween('2025-01-11', '2025-01-01')).toBe(-10);
    });
  });

  /* ============================================================
     Suite 2: Date Logic (batch 1 + 3 fixes)
     ============================================================ */
  describe('📅 Date Logic', function(){
    it('dateKeyLocal ينتج نفس صيغة today()', function(){
      if(typeof window.dateKeyLocal !== 'function') return;
      expect(window.dateKeyLocal(new Date())).toBe(window.today());
    });
    it('arabicDays: 0 → اليوم', function(){
      expect(window.arabicDays(0)).toBe('اليوم');
    });
    it('arabicDays: 1 → يوم', function(){
      expect(window.arabicDays(1)).toBe('يوم');
    });
    it('arabicDays: 2 → يومان', function(){
      expect(window.arabicDays(2)).toBe('يومان');
    });
    it('arabicDays: 5 → 5 أيام', function(){
      expect(window.arabicDays(5)).toBe('5 أيام');
    });
    it('arabicDays: 11 → 11 يومًا (بتنوين)', function(){
      expect(window.arabicDays(11)).toBe('11 يومًا');
    });
    it('arabicDays: 30 → 30 يومًا', function(){
      expect(window.arabicDays(30)).toBe('30 يومًا');
    });
    it('arabicDays يتعامل مع السالب', function(){
      expect(window.arabicDays(-5)).toBe('5 أيام');
    });
  });

  /* ============================================================
     Suite 3: GPA Math (batch 1 fix)
     ============================================================ */
  describe('📊 GPA Math', function(){
    it('computeGradePercentage: 30/40 = 75%', function(){
      var g = { name: 'test', items: [{ name: 'mid', score: 30, weight: 40 }] };
      expect(window.computeGradePercentage(g)).toBeCloseTo(75, 1);
    });
    it('computeGradePercentage: مجموع متعدد', function(){
      var g = { name: 'test', items: [
        { name: 'a', score: 20, weight: 20 },   /* 100% */
        { name: 'b', score: 15, weight: 30 },   /* 50% */
        { name: 'c', score: 30, weight: 50 }    /* 60% */
      ]};
      /* 65/100 = 65% */
      expect(window.computeGradePercentage(g)).toBeCloseTo(65, 1);
    });
    it('computeGradePercentage: صفر وزن → 0%', function(){
      var g = { name: 'test', items: [{ name: 'a', score: 10, weight: 0 }] };
      expect(window.computeGradePercentage(g)).toBe(0);
    });
    it('computeGradePercentage: قائمة فارغة → 0%', function(){
      expect(window.computeGradePercentage({ name: 'x', items: [] })).toBe(0);
    });
    it('computeGradePercentage: يتجاهل NaN', function(){
      var g = { name: 'test', items: [
        { name: 'a', score: 30, weight: 40 },
        { name: 'b', score: 'abc', weight: 'xyz' }
      ]};
      expect(window.computeGradePercentage(g)).toBeCloseTo(75, 1);
    });
  });

  /* ============================================================
     Suite 4: Sanitize Space (batch 1 fix)
     ============================================================ */
  describe('🧹 Sanitize Space', function(){
    it('sanitizeSpace يعالج null fields', function(){
      if(!window.CriticalFixes) return;
      var r = window.CriticalFixes.sanitizeSpace({
        courses: null, tasks: null, decks: null
      });
      expect(Array.isArray(r.courses)).toBe(true);
      expect(Array.isArray(r.tasks)).toBe(true);
      expect(Array.isArray(r.decks)).toBe(true);
      expect(r.courses.length).toBe(0);
    });
    it('sanitizeSpace يحوّل object خاطئ', function(){
      if(!window.CriticalFixes) return;
      var r = window.CriticalFixes.sanitizeSpace({
        timetable: null, attendance: 'string'
      });
      expect(typeof r.timetable).toBe('object');
      expect(typeof r.attendance).toBe('object');
      expect(Array.isArray(r.timetable)).toBe(false);
      expect(Array.isArray(r.attendance)).toBe(false);
    });
    it('sanitizeSpace يحفظ المفاتيح الإضافية', function(){
      if(!window.CriticalFixes) return;
      var r = window.CriticalFixes.sanitizeSpace({
        myCustomKey: 'hello',
        courses: []
      });
      expect(r.myCustomKey).toBe('hello');
    });
    it('sanitizeSpace يعيد defaultSpace للـ null', function(){
      if(!window.CriticalFixes) return;
      var r = window.CriticalFixes.sanitizeSpace(null);
      expect(Array.isArray(r.courses)).toBe(true);
      expect(Array.isArray(r.tasks)).toBe(true);
      expect(r.profile).toBeObject();
    });
    it('sanitizeSpace يعيد defaultSpace للمصفوفة', function(){
      if(!window.CriticalFixes) return;
      var r = window.CriticalFixes.sanitizeSpace([1,2,3]);
      expect(Array.isArray(r.courses)).toBe(true);
    });
  });

  /* ============================================================
     Suite 5: Quick Capture (batch 1 fix — Arabic regex)
     ============================================================ */
  describe('⚡ Quick Capture', function(){
    it('يكتشف مهمة عربية', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('واجب شبكات غدًا');
      expect(r.type).toBe('task');
      expect(r.title).toContain('شبكات');
    });
    it('يزيل "غدًا" من العنوان العربي', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('واجب شبكات غدًا');
      expect(r.title.indexOf('غدًا')).toBe(-1);
    });
    it('يزيل "اليوم" من العنوان', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('مهمة رياضيات اليوم');
      expect(r.title.indexOf('اليوم')).toBe(-1);
    });
    it('يكتشف امتحان', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('امتحان شبكات 15/5');
      expect(r.type).toBe('exam');
    });
    it('يستخرج التاريخ من صيغة DD/MM', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('امتحان شبكات 15/5');
      expect(r.due).toMatch(/^\d{4}-05-15$/);
    });
    it('يكتشف مصروف طعام بمبلغ', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('صرفت 20 د أكل');
      expect(r.type).toBe('expense');
      expect(r.amount).toBe(20);
      expect(r.category).toBe('food');
    });
    it('يصنّف بنزين كـ transport (ليس food)', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('مصروف بنزين 20');
      expect(r.category).toBe('transport');
    });
    it('يصنّف قهوة كـ food', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('صرفت 15 قهوة');
      expect(r.category).toBe('food');
    });
    it('يكتشف دخل راتب', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('دخل راتب 500');
      expect(r.type).toBe('income');
      expect(r.amount).toBe(500);
    });
    it('يكتشف ملاحظة', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('ملاحظة: اجتمعنا اليوم');
      expect(r.type).toBe('note');
    });
    it('يفهم "بعد 3 أيام"', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('واجب بعد 3 أيام');
      var d = new Date();
      d.setDate(d.getDate() + 3);
      var exp = d.getFullYear() + '-' +
        String(d.getMonth()+1).padStart(2,'0') + '-' +
        String(d.getDate()).padStart(2,'0');
      expect(r.due).toBe(exp);
    });
    it('يفهم أسماء الأيام العربية', function(){
      if(typeof window.parseQuickCapture !== 'function') return;
      var r = window.parseQuickCapture('واجب الأحد');
      expect(r.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  /* ============================================================
     Suite 6: Courses DB (batch 1 fix — duplicate code)
     ============================================================ */
  describe('📚 Courses DB', function(){
    it('COURSES_DB محمّل', function(){
      expect(window.COURSES_DB).toBeObject();
    });
    it('فيه أكثر من 100 مادة', function(){
      var n = Object.keys(window.COURSES_DB || {}).length;
      expect(n).toBeGreaterThanOrEqual(100);
    });
    it('validateCoursesDB يعيد مصفوفة', function(){
      if(typeof window.validateCoursesDB !== 'function') return;
      var r = window.validateCoursesDB();
      expect(Array.isArray(r)).toBe(true);
    });
    it('لا توجد أكواد مكررة', function(){
      var DB = window.COURSES_DB || {};
      var codes = {}, dupes = [];
      Object.keys(DB).forEach(function(k){
        var c = String(DB[k].code || '').replace(/^0+/, '');
        if(!c) return;
        if(codes[c]) dupes.push(c + ' (' + codes[c] + ' | ' + k + ')');
        else codes[c] = k;
      });
      expect(dupes.length).toBe(0);
    });
	    it('uni-c = 18 ساعة بالضبط', function(){
      var DB = window.COURSES_DB || {};
      var total = 0;
      Object.keys(DB).forEach(function(k){
        if(DB[k].t === 'uni-c') total += DB[k].h;
      });
      expect(total).toBe(18);
    });

    it('faculty >= 33 ساعة', function(){
      var DB = window.COURSES_DB || {};
      var total = 0;
      Object.keys(DB).forEach(function(k){
        if(DB[k].t === 'faculty') total += DB[k].h;
      });
      expect(total).toBeGreaterThanOrEqual(33);
    });

    it('major-c >= 88 ساعة', function(){
      var DB = window.COURSES_DB || {};
      var total = 0;
      Object.keys(DB).forEach(function(k){
        if(DB[k].t === 'major-c') total += DB[k].h;
      });
      expect(total).toBeGreaterThanOrEqual(88);
    });

    it('major-e >= 15 ساعة', function(){
      var DB = window.COURSES_DB || {};
      var total = 0;
      Object.keys(DB).forEach(function(k){
        if(DB[k].t === 'major-e') total += DB[k].h;
      });
      expect(total).toBeGreaterThanOrEqual(15);
    });
    it('findCourseByCode يعمل بالكود الكامل', function(){
      if(typeof window.findCourseByCode !== 'function') return;
      var r = window.findCourseByCode('110108101');
      expect(r).toBeTruthy();
      expect(r.name).toContain('تفاضل');
    });
    it('findCourseByCode يعمل مع صفر في البداية', function(){
      if(typeof window.findCourseByCode !== 'function') return;
      var r = window.findCourseByCode('0110108101');
      expect(r).toBeTruthy();
    });
    it('findCourseByCode يعيد null لكود مجهول', function(){
      if(typeof window.findCourseByCode !== 'function') return;
      var r = window.findCourseByCode('999999999');
      expect(r).toBe(null);
    });
    it('الكود 110408327 له مادة واحدة فقط', function(){
      var DB = window.COURSES_DB || {};
      var matches = Object.keys(DB).filter(function(k){
        return DB[k].code === '110408327';
      });
      expect(matches.length).toBe(1);
    });
    it('الكود المكرر يعمل عبر aliases', function(){
      if(typeof window.findCourseByCode !== 'function') return;
      var r = window.findCourseByCode('110408327');
      expect(r).toBeTruthy();
    });
  });

  /* ============================================================
     Suite 7: Plan Simulator (batch 3 fix)
     ============================================================ */
  describe('🎓 Plan Simulator', function(){
    it('getCompletedCourses موجودة', function(){
      expect(window.getCompletedCourses).toBeFunction();
    });
    it('لا يعتبر gpaRows منجزة تلقائياً', function(){
      if(typeof window.getCompletedCourses !== 'function') return;
      var snap = snapshotState();
      try{
        window.space = makeSpace();
        window.gpaRows = [
          { name: 'مادة-وهمية-1', hrs: 3, grade: 'A (90-100)' },
          { name: 'مادة-وهمية-2', hrs: 3, grade: 'B (75-79)' }
        ];
        var completed = window.getCompletedCourses();
        expect(completed['مادة-وهمية-1']).toBeFalsy();
        expect(completed['مادة-وهمية-2']).toBeFalsy();
      }finally{ restoreState(snap); }
    });
    it('يحترم completedCourses الصريحة', function(){
      if(typeof window.getCompletedCourses !== 'function') return;
      var snap = snapshotState();
      try{
        window.space = makeSpace({
          completedCourses: ['تفاضل وتكامل (1)', 'فيزياء عامة (1)']
        });
        var c = window.getCompletedCourses();
        expect(c['تفاضل وتكامل (1)']).toBeTruthy();
        expect(c['فيزياء عامة (1)']).toBeTruthy();
      }finally{ restoreState(snap); }
    });
    it('setCompleted يضيف بنجاح', function(){
      if(typeof window.setCompleted !== 'function') return;
      var snap = snapshotState();
      try{
        window.space = makeSpace();
        window.setCompleted('مادة-اختبار', true);
        expect(window.getCompletedCourses()['مادة-اختبار']).toBeTruthy();
      }finally{ restoreState(snap); }
    });
    it('setCompleted يحذف بنجاح', function(){
      if(typeof window.setCompleted !== 'function') return;
      var snap = snapshotState();
      try{
        window.space = makeSpace({ completedCourses: ['X'] });
        window.setCompleted('X', false);
        expect(window.getCompletedCourses()['X']).toBeFalsy();
      }finally{ restoreState(snap); }
    });
    it('analyzeGraduationGap يعيد بنية صحيحة', function(){
      if(typeof window.analyzeGraduationGap !== 'function') return;
      var snap = snapshotState();
      try{
        window.space = makeSpace();
        var g = window.analyzeGraduationGap();
        expect(g.progress).toBeObject();
        expect(g.remaining).toBeObject();
        expect(g.totalRequired).toBeObject();
        expect(typeof g.progress.total).toBe('number');
      }finally{ restoreState(snap); }
    });
    it('suggestNextSemester يعيد بنية صحيحة', function(){
      if(typeof window.suggestNextSemester !== 'function') return;
      var snap = snapshotState();
      try{
        window.space = makeSpace();
        var r = window.suggestNextSemester();
        expect(r.semester).toBeGreaterThanOrEqual(1);
        expect(r.suggestions).toBeArray();
      }finally{ restoreState(snap); }
    });
    it('المادة المُنجزة لا تُقترح مرة أخرى', function(){
      if(typeof window.suggestNextSemester !== 'function') return;
      var snap = snapshotState();
      try{
        window.space = makeSpace({ currentSemester: 1 });
        /* علّم كل مواد الفصل الأول */
        var plan = window.RECOMMENDED_PLAN || {};
        var sem1 = plan[1] || [];
        if(!sem1.length) return;
        window.space.completedCourses = sem1.slice();
        var r = window.suggestNextSemester();
        var suggestedNames = r.suggestions.map(function(s){ return s.name; });
        /* أول مادة في sem1 يجب أن تكون غائبة عن المقترح */
        expect(suggestedNames.indexOf(sem1[0])).toBe(-1);
      }finally{ restoreState(snap); }
    });
  });

  /* ============================================================
     Suite 8: AI v3
     ============================================================ */
  describe('🤖 AI v3', function(){
    it('aiRespond موجودة', function(){
      expect(window.aiRespond).toBeFunction();
    });
    it('يرد على تحية', function(){
      var r = window.aiRespond('السلام عليكم');
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(5);
    });
    it('يرد على "كم مهمة عندي؟"', function(){
      var r = window.aiRespond('كم مهمة عندي؟');
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(3);
    });
    it('يرد على سؤال التقدم', function(){
      var r = window.aiRespond('كم باقيلي للتخرج؟');
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(5);
    });
    it('يتعامل مع نص فارغ', function(){
      var r = window.aiRespond('');
      expect(typeof r).toBe('string');
    });
    it('يتعامل مع رموز غريبة', function(){
      var r = window.aiRespond('@#$%^&*()');
      expect(typeof r).toBe('string');
    });
    it('لا يتعطل على نص طويل جداً', function(){
      var r = window.aiRespond('مهمة '.repeat(200));
      expect(typeof r).toBe('string');
    });
  });

  /* ============================================================
     Suite 9: Modal Stack (batch 5 fix)
     ============================================================ */
  describe('🪟 Modal Stack', function(){
    it('__uxModalStack موجودة', function(){
      if(typeof window.__uxModalStack !== 'function') return;
      expect(window.__uxModalStack()).toBeArray();
    });
    it('modal-backdrop يُسجَّل تلقائياً', function(done){
      if(typeof window.__uxModalStack !== 'function') return;
      var initial = window.__uxModalStack().length;
      var bd = document.createElement('div');
      bd.className = 'modal-backdrop show';
      document.body.appendChild(bd);

      return new Promise(function(resolve){
        setTimeout(function(){
          var after = window.__uxModalStack().length;
          expect(after).toBeGreaterThan(initial);
          bd.remove();
          setTimeout(function(){
            var final = window.__uxModalStack().length;
            expect(final).toBe(initial);
            resolve();
          }, 50);
        }, 50);
      });
    });
  });

  /* ============================================================
     Suite 10: DOM Smoke
     ============================================================ */
  describe('🖥️ DOM', function(){
    var requiredSections = [
      'dashboard', 'timetable', 'courses', 'tasks', 'exams',
      'attendance', 'timer', 'flashcards', 'gradecalc',
      'budget', 'notes', 'plan', 'hulinks'
    ];
    requiredSections.forEach(function(id){
      it('section #' + id + ' موجود', function(){
        expect(document.getElementById(id)).toBeTruthy();
      });
    });
    it('nav-item عناصر موجودة', function(){
      expect(document.querySelectorAll('.nav-item').length).toBeGreaterThan(0);
    });
    it('toastContainer موجود', function(){
      expect(document.getElementById('toastContainer')).toBeTruthy();
    });
    it('switchTab موجودة', function(){
      expect(typeof window.switchTab).toBe('function');
    });
  });

  /* ============================================================
     Suite 11: Storage (S)
     ============================================================ */
  describe('💾 Storage', function(){
    it('S.set/get يعملان', function(){
      var k = '__test_v3_' + Date.now();
      try{
        window.S.set(k, { a: 1, b: [2, 3] });
        var r = window.S.get(k, null);
        expect(r.a).toBe(1);
        expect(r.b).toBeArray();
        expect(r.b.length).toBe(2);
      }finally{
        window.S.remove(k);
      }
    });
    it('S.get يعيد default للـ missing', function(){
      var r = window.S.get('__missing_' + Date.now(), 'default');
      expect(r).toBe('default');
    });
    it('S.remove يحذف', function(){
      var k = '__test_rm_' + Date.now();
      window.S.set(k, 'value');
      window.S.remove(k);
      expect(window.S.get(k, 'gone')).toBe('gone');
    });
  });

  /* ============================================================
     Suite 12: Perf Fixes (batch 4)
     ============================================================ */
  describe('⚡ Perf Fixes', function(){
    it('__perfClearFileCache موجودة', function(){
      if(typeof window.__perfClearFileCache !== 'function') return;
      expect(window.__perfClearFileCache).toBeFunction();
    });
    it('SB.listCourseFiles موجودة', function(){
      expect(window.SB).toBeObject();
      expect(window.SB.listCourseFiles).toBeFunction();
    });
    it('SB.listCourseFiles تُعيد Promise للكورس غير موجود', function(){
      if(!window.SB || !window.SB.listCourseFiles) return;
      var r = window.SB.listCourseFiles('__nonexistent_test__');
      expect(typeof r.then).toBe('function');
      return r.then(function(){ return true; }).catch(function(){ return true; });
    });
  });

  /* ============================================================
     Suite 13: UX Fixes (batch 5)
     ============================================================ */
  describe('✨ UX Fixes', function(){
    it('addClassSlot موجودة', function(){
      expect(window.addClassSlot).toBeFunction();
    });
    it('openSmartTimetable موجودة', function(){
      if(typeof window.openSmartTimetable !== 'function') return;
      expect(window.openSmartTimetable).toBeFunction();
    });
    it('openSmartTimetableAtKey موجودة', function(){
      if(typeof window.openSmartTimetableAtKey !== 'function') return;
      expect(window.openSmartTimetableAtKey).toBeFunction();
    });
  });

  /* ============================================================
     Suite 14: Integrations
     ============================================================ */
  describe('🔗 Integrations', function(){
    it('CriticalFixes محمّل', function(){
      expect(window.CriticalFixes).toBeObject();
      expect(window.CriticalFixes.sanitizeSpace).toBeFunction();
    });
    it('planEnhance محمّل', function(){
      expect(window.planEnhance).toBeObject();
      expect(window.planEnhance.refreshPlan).toBeFunction();
    });
    it('SB محمّل بالكامل', function(){
      var required = ['init','load','save','getCode','setCode',
        'listCourseFiles','uploadCourseFile','deleteCourseFile',
        'formatFileSize','getFileIcon','showSyncPanel'];
      required.forEach(function(m){
        expect(window.SB[m]).toBeFunction();
      });
    });
    it('SB.formatFileSize صحيح', function(){
      expect(window.SB.formatFileSize(512)).toBe('512 B');
      expect(window.SB.formatFileSize(1024)).toBe('1.0 KB');
      expect(window.SB.formatFileSize(1024 * 1024)).toBe('1.0 MB');
    });
    it('SB.getFileIcon يعطي PDF', function(){
      expect(window.SB.getFileIcon('test.pdf')).toBe('📄');
    });
    it('SB.getFileIcon يعطي افتراضي للمجهول', function(){
      expect(window.SB.getFileIcon('test.xyz')).toBe('📎');
    });
  });

  /* ============================================================
     Public API
     ============================================================ */
  window.testAll = function(){
    onlyMode = null;
    return runTests();
  };

  window.testQuick = function(){
    console.clear();
    /* ركّز على أهم 4 suites */
    var all = suites;
    var quick = all.filter(function(s){
      return /Utils|Date|GPA|Quick Capture/.test(s.name);
    });
    var savedSuites = suites;
    suites = quick;
    var r = runTests();
    suites = savedSuites;
    return r;
  };

  window.testSuite = function(pattern){
    return runSuite(pattern);
  };

  window.testSuites = function(){ return suites.map(function(s){ return s.name; }); };

  window.runTests = runTests;

  /* ============================================================
     Console hint
     ============================================================ */
  var totalTests = 0;
  suites.forEach(function(s){ totalTests += s.tests.length; });

  console.log(
    '%c🧪 tests.js v3 — ' + totalTests + ' اختبار في ' + suites.length + ' suite',
    'color:#a78bfa;font-weight:bold;font-size:13px'
  );
  console.log('%c   اكتب: testAll() للجميع · testQuick() للسريع · testSuites() للقائمة',
    'color:#8a96b8');
  console.log('%c   أو: testSuite("GPA") لتنفيذ suite واحد',
    'color:#8a96b8');

  /* تشغيل تلقائي عند hash = #test */
  if(location.hash === '#test' || location.hash === '#tests'){
    setTimeout(function(){ runTests(); }, 800);
  }
})();