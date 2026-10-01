/* ============================================================
   📸 HU Schedule OCR Parser & Auto-Inserter
   مخصص لجدول البوابة الرسمية للجامعة الهاشمية
   ============================================================ */

(function () {
  'use strict';

  // خريطة تحويل أيام الجامعة إلى الرموز المستخدمة في موقعك
  var DAY_MAP = {
    'ح': 'Sun',
    'ن': 'Mon',
    'ث': 'Tue',
    'ر': 'Wed',
    'خ': 'Thu',
    'ج': 'Fri',
    'س': 'Sat'
  };

  // تصحيح قراءات OCR الشائعة في الأرقام
  function fixDigits(str) {
    return String(str || '')
      .replace(/[٠-٩]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48); })
      .replace(/O/gi, '0')
      .replace(/[lI|]/g, '1')
      .replace(/S/gi, '5')
      .replace(/B/g, '8');
  }

  // 1. استخراج وقت البداية
  function extractStartTime(text) {
    var t = fixDigits(text);
    // البحث عن نمط الوقت: 09,30 - 10,30 أو 09:30 - 10:30
    var m = t.match(/(\d{1,2})\s*[:.,]\s*(\d{2})\s*[-–—~]\s*(\d{1,2})\s*[:.,]\s*(\d{2})/);
    if (m) {
      var h = String(m[1]).padStart(2, '0');
      var min = String(m[2]).padStart(2, '0');
      return h + ':' + min;
    }
    return null;
  }

  // 2. استخراج الأيام
  function extractDays(text) {
    var days = [];
    var t = String(text || '');
    // نمط الأيام بالجامعة الهاشمية (مثال: "ح ث خ" أو "ن ر")
    var m = t.match(/([حنثرخجس](?:\s+[حنثرخجس])+)/);
    if (m) {
      var chars = m[1].replace(/\s+/g, '').split('');
      chars.forEach(function (ch) {
        if (DAY_MAP[ch] && days.indexOf(DAY_MAP[ch]) === -1) {
          days.push(DAY_MAP[ch]);
        }
      });
    }
    return days;
  }

  // 3. استخراج القاعة أو طريقة التدريس
  function extractRoom(text) {
    var t = String(text || '');
    // البحث عن رموز المباني والقاعات (مثل: ح.ب 104، م.غ 203، م.ش 105)
    var roomMatch = t.match(/([حمنر]\s*[.\s]?\s*[بغبجمع])\s*(\d{2,4})/);
    if (roomMatch) {
      return roomMatch[1].replace(/\s+/g, '').trim() + ' ' + roomMatch[2];
    }
    if (/عن\s*بعد|teams|تيمز|منصة/i.test(t)) {
      return 'أونلاين (Teams)';
    }
    return 'غير محدد';
  }

  /**
   * الدالة الرئيسية: تحليل نص OCR المأخوذ من جدول الجامعة
   * @param {string} rawOcrText - النص المستخرج من الصورة عبر Tesseract
   */
  function parseAndApplyHUScheduleText(rawOcrText) {
    if (!rawOcrText) return;

    var lines = rawOcrText.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var addedCourses = 0;
    var addedLectures = 0;

    // التأكد من وجود كائنات تخزين البيانات في الموقع
    if (!window.space) window.space = {};
    if (!window.space.courses) window.space.courses = [];
    if (!window.space.timetable) window.space.timetable = {};
    if (!window.space.attendance) window.space.attendance = {};

    lines.forEach(function (line) {
      // البحث عن رقم المادة (يتكون من 8 إلى 10 أرقام)
      var codeMatch = fixDigits(line).match(/\b\d{8,10}\b/);
      if (!codeMatch) return;

      var code = codeMatch[0];
      var courseName = '';
      var hours = 3;

      // أ) البحث عن المادة في قاعدة البيانات COURSES_DB الموجودة بالموقع
      if (typeof window.findCourseByCode === 'function') {
        var found = window.findCourseByCode(code);
        if (found && found.name) {
          courseName = found.name;
          if (found.info && found.info.h) hours = found.info.h;
        }
      }

      // ب) في حال عدم وجود المادة بالداتابيز، نقوم باستخراج الاسم باللغة العربية من النص
      if (!courseName) {
        var nameMatch = line.match(/[\u0600-\u06FF\s()1-9]+/g);
        if (nameMatch) {
          courseName = nameMatch.join(' ').replace(/\d{8,10}/g, '').trim();
        }
      }

      if (!courseName || courseName.length < 2) return;

      // ج) استخراج تفاصيل الوقت والأيام والقاعة
      var startTime = extractStartTime(line);
      var days = extractDays(line);
      var room = extractRoom(line);

      // ----------------------------------------------------
      // 1. إضافة المادة إلى قائمة "موادي" (space.courses)
      // ----------------------------------------------------
      var courseExists = window.space.courses.some(function (c) {
        return c.code === code || c.name === courseName;
      });

      if (!courseExists) {
        window.space.courses.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: courseName,
          code: code,
          hours: hours,
          instructor: '',
          room: room
        });
        addedCourses++;
      }

      // ----------------------------------------------------
      // 2. إضافة المحاضرات إلى "الجدول الأسبوعي" (space.timetable)
      // ----------------------------------------------------
      if (days.length > 0 && startTime) {
        days.forEach(function (day) {
          var slotKey = day + '-' + startTime; // مثال: Sun-09:30
          
          // حفظ المحاضرة في الجدول
          window.space.timetable[slotKey] = {
            name: courseName,
            room: room,
            instructor: ''
          };
          addedLectures++;
        });
      }

      if (!window.space.attendance[courseName]) {
        window.space.attendance[courseName] = { present: 0, absent: 0 };
      }
    });

    // ----------------------------------------------------
    // 3. حفظ البيانات وإعادة رسم واجهة الموقع
    // ----------------------------------------------------
    if (typeof window.saveSpace === 'function') window.saveSpace();
    if (typeof window.renderTimetable === 'function') window.renderTimetable();
    if (typeof window.renderCourses === 'function') window.renderCourses();
    if (typeof window.renderAttendance === 'function') window.renderAttendance();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();

    // إظهار رسالة نجاح
    var msg = '✅ تم إدراج ' + addedCourses + ' مواد و ' + addedLectures + ' محاضرات في الجدول!';
    if (typeof window.toast === 'function') {
      window.toast(msg, 'success', 4000);
    } else {
      alert(msg);
    }

    return { addedCourses: addedCourses, addedLectures: addedLectures };
  }

  // تصدير الدالة للنطاق العام لاستخدامها في زِر الرفع أو Tesseract
  window.parseAndApplyHUScheduleText = parseAndApplyHUScheduleText;

})();