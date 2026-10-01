function saveAll(){
  var sp = getSpace();
  if(!sp.timetable) sp.timetable = {};
  if(!sp.courses) sp.courses = [];
  if(!sp.attendance) sp.attendance = {};

  var stats = { courses: 0, classes: 0, attendance: 0, skipped: [], incomplete: [] };

  state.rows.forEach(function(row, idx){
    if(!isRowComplete(row)){
      // ✅ أضف تشخيص واضح بدل التخطي الصامت
      var missing = [];
      if(!row.name) missing.push('الاسم');
      if(!row.days || !row.days.length) missing.push('الأيام');
      if(!row.timeFrom) missing.push('وقت البداية');
      if(!row.timeTo) missing.push('وقت النهاية');
      stats.incomplete.push({ row: idx + 1, missing: missing.join(' + ') });
      return;
    }
    // ... باقي الكود
  });

  // ... بعد الحفظ
  if(stats.incomplete.length){
    var msg = '⚠️ ' + stats.incomplete.length + ' صف ناقص:\n';
    stats.incomplete.forEach(function(x){
      msg += '• صف ' + x.row + ' — ناقص: ' + x.missing + '\n';
    });
    console.warn('[Smart Timetable]', msg);
    toast('⚠️ بعض الصفوف ناقصة — افتح Console للتفاصيل', 'warn', 5000);
  }
}