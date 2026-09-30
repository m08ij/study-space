/* ============================================================
   📸 ocr-advanced.js — OCR متقدم للجداول العربية
   ✅ @paddleocr/paddleocr-js مع تركيبات متعددة
   ✅ Fallback تلقائي: يجرب lang='arabic' + PP-OCRv3 أولاً
   ✅ يعمل بالكامل في المتصفح — بلا سيرفر
   ============================================================ */
(function() {
    'use strict';

    function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

    let ocrEngine = null;
    let isInitializing = false;
    let engineConfig = null;

    /* ============ تحميل مكتبة PaddleOCR ============ */
    async function loadPaddleOCR() {
        if (window.PaddleOCR) return window.PaddleOCR;
        console.log('⏳ تحميل مكتبة PaddleOCR...');
        var module = await import('https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js/+esm');
        window.PaddleOCR = module.PaddleOCR;
        console.log('✅ PaddleOCR loaded');
        return window.PaddleOCR;
    }

    /* ============ تهيئة المحرك — تركيبات متعددة ============ */
    async function initOCR() {
        if (ocrEngine) return ocrEngine;
        if (isInitializing) {
            while (isInitializing) { await new Promise(function(r){ setTimeout(r, 100); }); }
            return ocrEngine;
        }

        isInitializing = true;
        try {
            var PaddleOCR = await loadPaddleOCR();

            toast('⏳ تهيئة محرك OCR للعربية (قد يستغرق دقيقة)...', 'info', 5000);

            // ✅ جرّب عدة تركيبات — الأول اللي ينجح يفوز
            var configs = [
                { lang: 'arabic', ocrVersion: 'PP-OCRv3' },
                { lang: 'arabic', ocrVersion: 'PP-OCRv4' },
                { lang: 'ar',     ocrVersion: 'PP-OCRv3' },
                { lang: 'ar',     ocrVersion: 'PP-OCRv4' },
                { lang: 'en',     ocrVersion: 'PP-OCRv4' }  // fallback أخير
            ];

            var lastError = null;
            for (var i = 0; i < configs.length; i++) {
                try {
                    console.log('🔄 Trying:', configs[i].lang, configs[i].ocrVersion);
                    ocrEngine = await PaddleOCR.create({
                        lang: configs[i].lang,
                        ocrVersion: configs[i].ocrVersion,
                        ortOptions: {
                            backend: 'wasm',
                            wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',
                            numThreads: 2
                        }
                    });
                    engineConfig = configs[i];
                    console.log('✅ نجح مع:', configs[i]);
                    break;
                } catch (e) {
                    console.warn('❌ فشل:', configs[i], e.message);
                    lastError = e;
                    ocrEngine = null;
                }
            }

            if (!ocrEngine) {
                throw lastError || new Error('كل التركيبات فشلت');
            }

            toast('✅ محرك OCR جاهز!', 'success', 2500);

        } catch (e) {
            console.error('OCR init failed:', e);
            toast('❌ فشل تهيئة OCR: ' + (e.message || e), 'warn', 5000);
            throw e;
        } finally {
            isInitializing = false;
        }
        return ocrEngine;
    }

    /* ============ تحليل الصورة ============ */
    async function analyzeImage(file) {
        if (!file || !file.type.startsWith('image/')) {
            toast('⚠️ الرجاء اختيار صورة صالحة.', 'warn');
            return;
        }

        // معاينة الصورة
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
        if (bar) bar.style.width = '5%';
        if (progressText) progressText.textContent = '⏳ تهيئة المحرك...';

        try {
            var engine = await initOCR();
            if (bar) bar.style.width = '40%';
            if (progressText) progressText.textContent = '⏳ قراءة الجدول...';

            // تنفيذ OCR
            var results = await engine.predict(file);
            var result = results[0] || {};

            if (bar) bar.style.width = '100%';
            if (progressText) progressText.textContent = '✅ تم التحليل';

            // استخراج النص
            var extractedText = '';
            if (result.items && Array.isArray(result.items)) {
                extractedText = result.items
                    .map(function(item){ return item.text || ''; })
                    .filter(function(t){ return t.length > 0; })
                    .join('\n');
            } else if (result.text) {
                extractedText = result.text;
            }

            var ta = document.getElementById('ocrTextarea');
            if (ta) ta.value = extractedText;

            var resultEl = document.getElementById('ocrResult');
            if (resultEl) resultEl.style.display = 'block';

            toast('✅ استُخرج ' + extractedText.split('\n').length + ' سطر', 'success', 3000);

            // فتح المستورد تلقائياً
            if (window.TimetableImporter && window.TimetableImporter.open) {
                setTimeout(function(){
                    window.TimetableImporter.open(extractedText);
                }, 600);
            }

        } catch (error) {
            console.error('OCR Error:', error);
            if (progressText) progressText.textContent = '❌ فشل التحليل';
            if (bar) bar.style.width = '0%';
            toast('فشل التحليل: ' + (error.message || 'خطأ غير معروف'), 'warn', 5000);
        }
    }

    /* ============ ربط زر رفع الصورة ============ */
    function install() {
        var uploadZone = document.getElementById('uploadZone');
        var ocrFile = document.getElementById('ocrFile');

        if (!uploadZone || !ocrFile) {
            console.warn('⚠️ عناصر رفع الصورة غير موجودة');
            return;
        }

        if (uploadZone._advancedBound) return;
        uploadZone._advancedBound = true;

        // فتح مدخل الملفات عند النقر
        uploadZone.addEventListener('click', function(e){
            if (e.target.tagName !== 'INPUT') {
                ocrFile.click();
            }
        });

        // ربط تغيير الملف بالتحليل
        ocrFile.addEventListener('change', function(e){
            var f = e.target.files[0];
            if (f) analyzeImage(f);
            ocrFile.value = '';
        });

        // السحب والإفلات
        uploadZone.addEventListener('dragover', function(e){ e.preventDefault(); uploadZone.classList.add('dragover'); });
        uploadZone.addEventListener('dragleave', function(){ uploadZone.classList.remove('dragover'); });
        uploadZone.addEventListener('drop', function(e){
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            var f = e.dataTransfer.files[0];
            if (f) analyzeImage(f);
        });

        console.log('📸 Advanced OCR: bound to input');
    }

    /* ============ واجهة عامة ============ */
    window.ocrAdvanced = {
        analyze: analyzeImage,
        init: initOCR,
        test: async function(){
            console.log('🔍 اختبار OCR...');
            try {
                await initOCR();
                console.log('✅ المحرك جاهز (تركيبة: ' + JSON.stringify(engineConfig) + ')');
                return 'ready';
            } catch (e) {
                console.error('❌ فشل:', e);
                return 'failed';
            }
        }
    };

    /* ============ التشغيل ============ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 1000); });
    } else {
        setTimeout(install, 1000);
    }

    console.log('📸 Advanced OCR loaded — PaddleOCR.js (Arabic)');
})();