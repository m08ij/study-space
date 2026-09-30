/* ============================================================
   📸 ocr-advanced.js — OCR متقدم للجداول العربية (محلي)
   ✅ @paddleocr/paddleocr-js — دقة عالية (PP-OCRv5)
   ✅ لا يحتاج مفاتيح API، لا سيرفر، لا تسجيل
   ✅ يفهم بنية الجداول ويرجع النص منظمًا
   ============================================================ */
(function() {
    'use strict';

    function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

    let ocrEngine = null;
    let isInitializing = false;

    // ========== تحميل مكتبة PaddleOCR عبر CDN ==========
    async function loadPaddleOCR() {
        if (window.PaddleOCR) return window.PaddleOCR;
        
        console.log('⏳ جاري تحميل مكتبة PaddleOCR...');
        
        // استخدام رابط ESM الذي يعمل مباشرة من jsDelivr
        const module = await import('https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js/+esm');
        
        window.PaddleOCR = module.PaddleOCR;
        console.log('✅ PaddleOCR library loaded');
        return window.PaddleOCR;
    }

    // ========== تهيئة محرك OCR ==========
    async function initOCR() {
        if (ocrEngine) return ocrEngine;
        if (isInitializing) {
            while (isInitializing) { await new Promise(r => setTimeout(r, 100)); }
            return ocrEngine;
        }

        isInitializing = true;
        try {
            const PaddleOCR = await loadPaddleOCR();
            
            toast('⏳ جاري تهيئة محرك OCR للعربية (قد يستغرق دقيقة في المرة الأولى)...', 'info', 5000);
            
            // ✅ تهيئة المحرك مع اللغة العربية
            ocrEngine = await PaddleOCR.create({
                lang: 'ar',                 // ✅ اللغة العربية
                ocrVersion: 'PP-OCRv5',     // ✅ أحدث وأدق نموذج
                ortOptions: {
                    backend: 'wasm',        // WebAssembly (يعمل في كل المتصفحات)
                    wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',
                    numThreads: 2
                }
            });

            console.log('✅ OCR Engine initialized (Arabic - PP-OCRv5)');
            toast('✅ محرك OCR جاهز!', 'success', 2000);
            
        } catch (e) {
            console.error('OCR init failed:', e);
            toast('❌ فشل تهيئة OCR: ' + (e.message || e), 'warn', 5000);
            throw e;
        } finally {
            isInitializing = false;
        }
        return ocrEngine;
    }

    // ========== تحليل الصورة ==========
    async function analyzeImage(file) {
        if (!file || !file.type.startsWith('image/')) {
            toast('⚠️ الرجاء اختيار صورة صالحة.', 'warn');
            return;
        }

        // عرض الصورة للمستخدم
        const preview = document.getElementById('ocrPreview');
        if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-width:100%;border-radius:12px;max-height:300px">`;
        }

        // شريط التقدم
        const progress = document.getElementById('ocrProgress');
        const bar = document.getElementById('ocrBar');
        const progressText = document.getElementById('ocrText');
        if (progress) progress.style.display = 'block';
        if (bar) bar.style.width = '5%';
        if (progressText) progressText.textContent = '⏳ جاري تهيئة المحرك...';

        try {
            const engine = await initOCR();
            if (bar) bar.style.width = '40%';
            if (progressText) progressText.textContent = '⏳ جاري قراءة الجدول...';

            // ✅ تنفيذ OCR
            const results = await engine.predict(file);
            const result = results[0] || {};

            if (bar) bar.style.width = '100%';
            if (progressText) progressText.textContent = '✅ تم التحليل';

            // استخراج النص
            let extractedText = '';
            if (result.items && Array.isArray(result.items)) {
                extractedText = result.items
                    .map(item => item.text || '')
                    .filter(t => t.length > 0)
                    .join('\n');
            } else if (result.text) {
                extractedText = result.text;
            }

            const ta = document.getElementById('ocrTextarea');
            if (ta) ta.value = extractedText;

            const resultEl = document.getElementById('ocrResult');
            if (resultEl) resultEl.style.display = 'block';

            toast(`✅ تم استخراج ${extractedText.split('\n').length} سطر`, 'success', 3000);

            // ✅ فتح المستورد تلقائيًا
            if (window.TimetableImporter && window.TimetableImporter.open) {
                setTimeout(() => {
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

    // ========== ربط زر رفع الصورة ==========
    function install() {
        const uploadZone = document.getElementById('uploadZone');
        const ocrFile = document.getElementById('ocrFile');
        
        if (!uploadZone || !ocrFile) {
            console.warn('⚠️ لم يتم العثور على عناصر رفع الصورة');
            return;
        }

        if (uploadZone._advancedBound) return;
        uploadZone._advancedBound = true;

        // فتح مدخل الملفات عند النقر
        uploadZone.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                ocrFile.click();
            }
        });

        // ربط تغيير الملف بالتحليل
        ocrFile.addEventListener('change', function(e) {
            const f = e.target.files[0];
            if (f) analyzeImage(f);
            ocrFile.value = '';
        });

        // السحب والإفلات
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const f = e.dataTransfer.files[0];
            if (f) analyzeImage(f);
        });

        console.log('📸 Advanced OCR: bound to input');
    }

    // ========== واجهة برمجية عامة ==========
    window.ocrAdvanced = {
        analyze: analyzeImage,
        init: initOCR,
        test: async () => {
            console.log('🔍 اختبار OCR...');
            try {
                await initOCR();
                console.log('✅ المحرك جاهز');
                return 'ready';
            } catch (e) {
                console.error('❌ فشل:', e);
                return 'failed';
            }
        }
    };

    // ========== التشغيل ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(install, 1000));
    } else {
        setTimeout(install, 1000);
    }

    console.log('📸 Advanced OCR loaded — PaddleOCR.js (Arabic)');
})();