/* ============================================================
   ☁️ ocr-advanced.js — OCR عبر OCR.space API (مجاني)
   ✅ مجاني 25,000 طلب/شهر — بلا بطاقة ائتمان
   ✅ يدعم العربية + الجداول
   ✅ يعمل من المتصفح مباشرة
   ⚠️ ضع مفتاحك في المتغير API_KEY تحت
   ============================================================ */
(function() {
    'use strict';

    /* ============================================================
       🔑 ضع مفتاحك هنا (من https://ocr.space/ocrapi)
       ============================================================ */
    var API_KEY = ' K81400074888957';   // ← استبدل بمفتاحك الحقيقي

    /* ============================================================ */

    function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

    /* ============ إرسال الصورة لـ OCR.space ============ */
    async function callOCRSpace(file) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('language', 'ara');           // ✅ اللغة العربية
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');  // ✅ كشف الدوران
        formData.append('scale', 'true');              // ✅ تحسين تلقائي
        formData.append('isTable', 'true');            // ✅ فهم الجداول
        formData.append('OCREngine', '2');             // ✅ محرك 2 أفضل للعربي
        formData.append('apikey', API_KEY);

        var res = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            throw new Error('فشل الاتصال بالخادم (' + res.status + ')');
        }

        var data = await res.json();

        if (data.IsErroredOnProcessing) {
            var msg = data.ErrorMessage;
            if (Array.isArray(msg)) msg = msg.join(' · ');
            throw new Error(msg || 'فشل التحليل');
        }

        if (!data.ParsedResults || !data.ParsedResults.length) {
            throw new Error('لم يتم استخراج أي نص');
        }

        return data.ParsedResults[0].ParsedText || '';
    }

    /* ============ تحليل الصورة ============ */
    async function analyzeImage(file) {
        if (!file || !file.type.startsWith('image/')) {
            toast('⚠️ الرجاء اختيار صورة صالحة.', 'warn');
            return;
        }

        if (API_KEY === 'K8123456789' || !API_KEY || API_KEY.length < 10) {
            toast('⚠️ ضع مفتاح OCR.space في الملف أولاً', 'warn', 5000);
            return;
        }

        // معاينة
        var preview = document.getElementById('ocrPreview');
        if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = '<img src="' + URL.createObjectURL(file) + '" style="max-width:100%;border-radius:12px;max-height:300px">';
        }

        // شريط التقدم
        var progress = document.getElementById('ocrProgress');
        var bar = document.getElementById('ocrBar');
        var progressText = document.getElementById('ocrText');
        if (progress) progress.style.display = 'block';
        if (bar) bar.style.width = '20%';
        if (progressText) progressText.textContent = '☁️ يرسل الصورة للخادم...';

        try {
            if (bar) bar.style.width = '50%';
            if (progressText) progressText.textContent = '⏳ جاري تحليل الجدول...';

            var text = await callOCRSpace(file);

            if (bar) bar.style.width = '100%';
            if (progressText) progressText.textContent = '✅ تم التحليل (' + text.split('\n').length + ' سطر)';

            var ta = document.getElementById('ocrTextarea');
            if (ta) ta.value = text;

            var resultEl = document.getElementById('ocrResult');
            if (resultEl) resultEl.style.display = 'block';

            toast('✅ استُخرج ' + text.split('\n').length + ' سطر', 'success', 3000);

            // فتح المستورد تلقائياً
            if (window.TimetableImporter && window.TimetableImporter.open) {
                setTimeout(function(){
                    window.TimetableImporter.open(text);
                }, 600);
            }

        } catch (error) {
            console.error('OCR Error:', error);
            if (progressText) progressText.textContent = '❌ فشل التحليل: ' + error.message;
            if (bar) bar.style.width = '0%';
            toast('فشل: ' + error.message, 'warn', 5000);
        }
    }

    /* ============ ربط الزر ============ */
    function install() {
        var uploadZone = document.getElementById('uploadZone');
        var ocrFile = document.getElementById('ocrFile');

        if (!uploadZone || !ocrFile) {
            console.warn('⚠️ عناصر رفع الصورة غير موجودة');
            return;
        }

        if (uploadZone._advancedBound) return;
        uploadZone._advancedBound = true;

        uploadZone.addEventListener('click', function(e){
            if (e.target.tagName !== 'INPUT') {
                ocrFile.click();
            }
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

        console.log('☁️ OCR.space: bound to input');
    }

    /* ============ API عام ============ */
    window.ocrAdvanced = {
        analyze: analyzeImage,
        setKey: function(k){ API_KEY = k; },
        test: async function(){
            console.log('🔍 اختبار OCR.space...');
            if (!API_KEY || API_KEY.length < 10) {
                console.error('❌ لم يتم إعداد المفتاح');
                return 'no-key';
            }
            console.log('✅ المفتاح موجود (' + API_KEY.substring(0, 6) + '...)');
            return 'ready';
        }
    };

    /* ============ التشغيل ============ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 1000); });
    } else {
        setTimeout(install, 1000);
    }

    console.log('☁️ OCR.space module loaded — ' + (API_KEY.length > 10 ? 'المفتاح جاهز' : '⚠️ ضع المفتاح'));
})();