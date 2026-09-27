/* ============================================================
   📁 courses-files-plus.js — تطوير ملفات المواد
   - تصنيف الملفات (Slides / Lab / Project / Exam / Other)
   - فلترة حسب التصنيف
   - بحث في أسماء الملفات
   - إحصائيات لكل مادة
   ============================================================ */
(function(){
  'use strict';

  function getSpace(){ return window.space || {courses:[]}; }
  function toast(m,t,d){ if(typeof window.toast === 'function') window.toast(m,t||'info',d||2500); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  var FILE_TAGS = {
    slides:  {label:'سلايدات', icon:'📊', color:'var(--cyan)'},
    lab:     {label:'مختبر',  icon:'🔬', color:'var(--green)'},
    project: {label:'مشروع',  icon:'🎯', color:'var(--amber)'},
    exam:    {label:'امتحان', icon:'📝', color:'var(--red)'},
    book:    {label:'كتاب',   icon:'📚', color:'var(--purple)'},
    other:   {label:'أخرى',   icon:'📎', color:'var(--muted)'}
  };

  function detectTagFromName(name){
    var n = String(name || '').toLowerCase();
    if(/slide|lec|lecture|محاضرة|شريحة/.test(n)) return 'slides';
    if(/lab|مختبر|تجرب/.test(n)) return 'lab';
    if(/project|مشروع|proj/.test(n)) return 'project';
    if(/exam|امتحان|final|midterm|quiz|كويز/.test(n)) return 'exam';
    if(/book|كتاب|مرجع|reference|pdf.*book/.test(n)) return 'book';
    return 'other';
  }

  function saveTag(path, tag){
    try{
      var tags = JSON.parse(localStorage.getItem('course_files_tags') || '{}');
      tags[path] = tag;
      localStorage.setItem('course_files_tags', JSON.stringify(tags));
    }catch(e){}
  }

  function getTag(path){
    try{
      var tags = JSON.parse(localStorage.getItem('course_files_tags') || '{}');
      return tags[path] || null;
    }catch(e){ return null; }
  }

  /* ============ Override على loadCourseFilesForCard ============ */
  function install(){
    if(typeof window.loadCourseFilesForCard !== 'function'){ setTimeout(install, 400); return; }
    if(window._cfpInstalled) return;
    window._cfpInstalled = true;

    window.loadCourseFilesForCard = async function(courseId){
      var list = document.querySelector('[data-files-list="' + courseId + '"]');
      var count = document.querySelector('[data-files-count="' + courseId + '"]');
      if(!list) return;

      if(!window.SB || !window.SB.listCourseFiles){
        list.innerHTML = '<div style="text-align:center;padding:10px;font-size:.75rem;color:var(--muted2)">المزامنة غير مفعّلة</div>';
        return;
      }

      try{
        var files = await window.SB.listCourseFiles(courseId);
        if(!files.length){
          list.innerHTML = '<div style="text-align:center;padding:10px;font-size:.75rem;color:var(--muted2)">ما في ملفات بعد</div>';
          if(count) count.textContent = '0 ملف';
          return;
        }

        if(count) count.textContent = files.length + ' ملف';

        // فلترة حسب tag + بحث
        var stateKey = 'cfp_' + courseId;
        var state = window[stateKey] || (window[stateKey] = {tag: 'all', q: ''});

        // أدوات الفلترة
        var tagsInFiles = {};
        files.forEach(function(f){
          var tag = getTag(f.path) || detectTagFromName(f.name);
          tagsInFiles[tag] = (tagsInFiles[tag] || 0) + 1;
          f._tag = tag;
        });

        var filtered = files.filter(function(f){
          if(state.tag !== 'all' && f._tag !== state.tag) return false;
          if(state.q){
            var q = state.q.toLowerCase();
            var cleanName = f.name.replace(/^\d+_/, '').toLowerCase();
            if(cleanName.indexOf(q) === -1) return false;
          }
          return true;
        });

        // Header بأدوات فلترة
        var html = '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;padding:6px;background:var(--bg2);border-radius:8px">';
        html += '<button class="cfp-chip' + (state.tag === 'all' ? ' active' : '') + '" data-cfp-tag="all" data-cfp-course="' + courseId + '">الكل (' + files.length + ')</button>';
        Object.keys(FILE_TAGS).forEach(function(t){
          if(!tagsInFiles[t]) return;
          var ft = FILE_TAGS[t];
          html += '<button class="cfp-chip' + (state.tag === t ? ' active' : '') + '" data-cfp-tag="' + t + '" data-cfp-course="' + courseId + '">' + ft.icon + ' ' + ft.label + ' (' + tagsInFiles[t] + ')</button>';
        });
        html += '</div>';

        // بحث
        html += '<div style="margin-bottom:8px"><input class="cfp-search" data-cfp-search="' + courseId + '" placeholder="🔍 ابحث في الملفات..." value="' + esc(state.q) + '" style="width:100%;padding:6px 10px;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:8px;font-family:inherit;font-size:.78rem;outline:none"></div>';

        if(!filtered.length){
          html += '<div style="text-align:center;padding:14px;font-size:.75rem;color:var(--muted2)">لا نتائج</div>';
        } else {
          filtered.forEach(function(f){
            var tag = FILE_TAGS[f._tag] || FILE_TAGS.other;
            var icon = (window.SB.getFileIcon && window.SB.getFileIcon(f.name)) || '📎';
            var size = (window.SB.formatFileSize && window.SB.formatFileSize(f.size)) || '';
            var cleanName = f.name.replace(/^\d+_/, '');

            html += '<div class="course-file-item" style="position:relative">' +
              '<div class="cf-icon">' + icon + '</div>' +
              '<div class="cf-info">' +
                '<div class="cf-name" title="' + esc(cleanName) + '">' + esc(cleanName) + '</div>' +
                '<div class="cf-meta"><span style="padding:1px 6px;border-radius:4px;background:' + tag.color + '20;color:' + tag.color + ';font-size:.65rem;font-weight:700;margin-left:4px">' + tag.icon + ' ' + tag.label + '</span>' + size + '</div>' +
              '</div>' +
              '<div class="cf-actions">' +
                '<a class="btn btn-sm btn-ghost" href="' + esc(f.url) + '" target="_blank" rel="noopener" title="فتح">👁️</a>' +
                '<button class="btn btn-sm btn-ghost" data-cfp-tag-edit="' + esc(f.path) + '" data-course="' + courseId + '" title="تغيير التصنيف">🏷️</button>' +
                '<button class="btn btn-sm btn-danger" data-del-file="' + esc(f.path) + '" data-course="' + courseId + '" title="حذف">🗑</button>' +
              '</div>' +
            '</div>';
          });
        }

        list.innerHTML = html;

        // Bind chips
        list.querySelectorAll('[data-cfp-tag]').forEach(function(b){
          b.addEventListener('click', function(){
            state.tag = b.dataset.cfpTag;
            window.loadCourseFilesForCard(courseId);
          });
        });
        // Bind search
        var searchInput = list.querySelector('[data-cfp-search]');
        if(searchInput){
          searchInput.addEventListener('input', function(){
            state.q = this.value;
            clearTimeout(window['_cfp_' + courseId + '_t']);
            window['_cfp_' + courseId + '_t'] = setTimeout(function(){
              window.loadCourseFilesForCard(courseId);
              // refocus
              setTimeout(function(){
                var inp = document.querySelector('[data-cfp-search="' + courseId + '"]');
                if(inp){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
              }, 20);
            }, 300);
          });
        }
        // Bind tag edit
        list.querySelectorAll('[data-cfp-tag-edit]').forEach(function(b){
          b.addEventListener('click', function(){
            var path = b.dataset.cfpTagEdit;
            openTagPicker(path, b.dataset.course);
          });
        });
        // Bind delete
        list.querySelectorAll('[data-del-file]').forEach(function(b){
          b.addEventListener('click', function(){
            if(typeof window.customConfirm !== 'function'){ if(!confirm('حذف الملف؟')) return; }
            var doDel = async function(){
              var ok = await window.SB.deleteCourseFile(b.dataset.delFile);
              if(ok){ toast('🗑 حُذف', 'success'); window.loadCourseFilesForCard(b.dataset.course); }
              else toast('فشل الحذف', 'warn');
            };
            if(typeof window.customConfirm === 'function') window.customConfirm('حذف الملف؟', doDel);
            else doDel();
          });
        });
      }catch(e){
        console.error('loadCourseFilesForCard+ error:', e);
        list.innerHTML = '<div style="text-align:center;padding:10px;font-size:.75rem;color:var(--red)">فشل التحميل</div>';
      }
    };

    // Override على handleCourseFileUpload لتخمين tag بعد الرفع
    if(typeof window.handleCourseFileUpload === 'function'){
      var origUpload = window.handleCourseFileUpload;
      window.handleCourseFileUpload = async function(courseId, file){
        var r = await origUpload.apply(this, arguments);
        // خمّن tag من الاسم
        try{
          var tags = JSON.parse(localStorage.getItem('course_files_tags') || '{}');
          var guess = detectTagFromName(file.name);
          // ما نحفظه الآن — لأنه ما نعرف اسم الملف على السيرفر
        }catch(e){}
        return r;
      };
    }
  }

  /* ============ Modal اختيار التصنيف ============ */
  function openTagPicker(path, courseId){
    document.querySelectorAll('.modal-backdrop').forEach(function(m){ m.remove(); });
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop show';
    var current = getTag(path);
    var opts = '';
    Object.keys(FILE_TAGS).forEach(function(k){
      var t = FILE_TAGS[k];
      opts += '<button class="cfp-tag-opt' + (current === k ? ' active' : '') + '" data-tag="' + k + '" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;cursor:pointer;font-family:inherit;color:var(--text);font-size:.85rem;margin-bottom:6px;text-align:right;transition:.2s">' +
        '<span style="font-size:1.2rem">' + t.icon + '</span><span style="flex:1;font-weight:600">' + t.label + '</span>' + (current === k ? '✓' : '') +
      '</button>';
    });
    bd.innerHTML = '<div class="modal" style="max-width:380px"><h3>🏷️ اختر تصنيف الملف</h3>' + opts +
      '<div class="modal-actions"><button class="btn btn-sm btn-ghost" id="cfpCancel">إلغاء</button></div></div>';
    document.body.appendChild(bd);
    bd.querySelector('#cfpCancel').onclick = function(){ bd.remove(); };
    bd.onclick = function(e){ if(e.target === bd) bd.remove(); };
    bd.querySelectorAll('.cfp-tag-opt').forEach(function(b){
      b.addEventListener('click', function(){
        saveTag(path, b.dataset.tag);
        bd.remove();
        toast('🏷️ حُدّث التصنيف', 'success');
        window.loadCourseFilesForCard(courseId);
      });
    });
  }

  /* ============ CSS ============ */
  function injectCSS(){
    if(document.getElementById('cfp-css')) return;
    var s = document.createElement('style');
    s.id = 'cfp-css';
    s.textContent = `
      .cfp-chip{padding:4px 9px;background:var(--card);border:1px solid var(--border);border-radius:14px;cursor:pointer;font-family:inherit;color:var(--muted);font-size:.68rem;font-weight:700;transition:.2s;white-space:nowrap}
      .cfp-chip:hover{border-color:var(--cyan);color:var(--cyan)}
      .cfp-chip.active{background:var(--grad-soft);border-color:var(--cyan);color:var(--cyan)}
      .cfp-tag-opt:hover{border-color:var(--cyan)!important;background:var(--card2)!important}
      .cfp-tag-opt.active{background:var(--grad-soft)!important;border-color:var(--cyan)!important;color:var(--cyan)!important}
      .cfp-search:focus{border-color:var(--cyan)}
    `;
    document.head.appendChild(s);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ injectCSS(); install(); });
  else { injectCSS(); install(); }
  console.log('📁 Courses Files Plus loaded');
})();