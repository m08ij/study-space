/* ============================================================
   ☁️ ocr-advanced.js — OCR عبر OCR.space API (مجاني)
   ✅ OCREngine=1 (الأفضل للعربي)
   ✅ isTable=true لفهم الجداول
   ✅ مجاني 25,000 طلب/شهر
   ============================================================ */
(function() {
    'use strict';

    /* ============================================================
       🔑 مفتاح OCR.space
       ============================================================ */
    var API_KEY = 'K81400074888957';
    /* ============================================================ */

    function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

    /* ============ إرسال الصورة ============ */
    async function callOCRSpace(file) {
        var formData = new FormData();

        // ✅ ترتيب مهم: apikey أولاً
        formData.append('apikey', API_KEY);
        formData.append('file', file);
        formData.append('language', 'ara');            // العربية
        formData.append('OCREngine', '1');             // ✅ Engine 1 (يدعم العربي)
        formData.append('isTable', 'true');            // ✅ فهم الجداول
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('filetype', file.type || 'image/jpeg');

        console.log('☁️ POST to OCR.space...', {
            name: file.name, size: file.size, type: file.type
        });

        var res = await fetch('https://ocr-proxy.mohanad-jawabrah.workers.dev/', {
            method: 'POST',
            body: formData
        });

        console.log('📡 Response status:', res.status);

        // ✅ نقرأ الرد حتى لو فشل — لنعرف السبب الحقيقي
        var data;
        try {
            data = await res.json();
        } catch (e) {
            throw new Error('فشل الاتصال — الخادم رد ' + res.status);
        }

        console.log('📦 Response body:', data);

        if (!res.ok) {
            var em = data.ErrorMessage || data.error || ('HTTP ' + res.status);
            if (Array.isArray(em)) em = em.join(' · ');
            throw new Error(em);
        }

        if (data.IsErroredOnProcessing) {
            var msg = data.ErrorMessage;
            if (Array.isArray(msg)) msg = msg.join(' · ');
            throw new Error(msg || 'فشل التحليل');
        }

        if (!data.ParsedResults || !data.ParsedResults.length) {
            throw new Error('لم يُستخرج أي نص');
        }

        return data.ParsedResults[0].ParsedText || '';
    }

    /* ============ تحليل الصورة ============ */
    async function analyzeImage(file) {
        if (!file || !file.type.startsWith('image/')) {
            toast('⚠️ اختر صورة صالحة', 'warn');
            return;
        }

        var preview = document.getElementById('ocrPreview');
        if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = '<img src="' + URL.createObjectURL(file) + '" style="max-width:100%;border-radius:12px;max-height:300px">';
        }

        var progress = document.getElementById('ocrProgress');
        var bar = document.getElementById('ocrBar');
        var progressText = document.getElementById('ocrText');
        if (progress) progress.style.display = 'block';
        if (bar) bar.style.width = '20%';
        if (progressText) progressText.textContent = '☁️ يرسل للخادم...';

        try {
            if (bar) bar.style.width = '50%';
            if (progressText) progressText.textContent = '⏳ جاري التحليل...';

            var text = await callOCRSpace(file);

            if (bar) bar.style.width = '100%';
            if (progressText) progressText.textContent = '✅ تم التحليل (' + text.split('\n').length + ' سطر)';

            var ta = document.getElementById('ocrTextarea');
            if (ta) ta.value = text;

            var resultEl = document.getElementById('ocrResult');
            if (resultEl) resultEl.style.display = 'block';

            toast('✅ استُخرج ' + text.split('\n').length + ' سطر', 'success', 3000);

            if (window.TimetableImporter && window.TimetableImporter.open) {
                setTimeout(function(){
                    window.TimetableImporter.open(text);
                }, 600);
            }

        } catch (error) {
            console.error('❌ OCR Error:', error);
            if (progressText) progressText.textContent = '❌ فشل: ' + error.message;
            if (bar) bar.style.width = '0%';
            toast('فشل: ' + error.message, 'warn', 6000);
        }
    }

    /* ============ ربط الزر ============ */
    function install() {
        var uploadZone = document.getElementById('uploadZone');
        var ocrFile = document.getElementById('ocrFile');
        if (!uploadZone || !ocrFile) return;
        if (uploadZone._advancedBound) return;
        uploadZone._advancedBound = true;

        uploadZone.addEventListener('click', function(e){
            if (e.target.tagName !== 'INPUT') ocrFile.click();
        });

        ocrFile.addEventListener('change', function(e){
            var f = e.target.files[0];
            if (f) analyzeImage(f);
            ocrFile.value = '';
        });

        uploadZone.addEventListener('dragover', function(e){ e.preventDefault(); uploadZone.classList.add('dragover'); });
        uploadZone.addEventListener('dragleave', function(){ uploadZone.classList.remove('dragover'); });
        uploadZone.addEventListener('drop', function(e){
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            var f = e.dataTransfer.files[0];
            if (f) analyzeImage(f);
        });

        console.log('☁️ OCR.space bound');
    }

    /* ============ اختبار ============ */
    window.ocrAdvanced = {
        analyze: analyzeImage,
        test: async function(){
            console.log('🧪 اختبار OCR.space بـ helloworld...');
            try {
                var fd = new FormData();
                fd.append('apikey', 'helloworld');
                fd.append('url', 'https://i.imgur.com/Aq3YqjP.jpg');
                fd.append('language', 'ara');
                fd.append('OCREngine', '1');
                var r = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: fd });
                var j = await r.json();
                console.log('Response:', j);
                return j;
            } catch(e) {
                console.error(e);
                return 'failed';
            }
        },
        testKey: async function(){
            console.log('🧪 اختبار مفتاحك...');
            var fd = new FormData();
            fd.append('apikey', API_KEY);
            fd.append('url', 'https://i.imgur.com/Aq3YqjP.jpg');
            fd.append('language', 'ara');
            fd.append('OCREngine', '1');
            var r = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: fd });
            var j = await r.json();
            console.log('Response:', j);
            return j;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 1000); });
    } else {
        setTimeout(install, 1000);
    }

    console.log('☁️ OCR.space loaded — key: ' + API_KEY.substring(0, 6) + '...');
})();