/* ============================================================
   📸 ocr-advanced.js — OCR متقدم للجداول العربية
   ✅ client-side-ocr + RapidOCR (PP-OCRv4) — دقة عالية
   ✅ تحميل ديناميكي آمن مع بدائل احتياطية
   ✅ لا يحتاج مفاتيح API، لا سيرفر، لا تسجيل
   ============================================================ */
(function() {
    'use strict';

    function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

    let ocrEngine = null;
    let isInitializing = false;

    // ========== تحميل ONNX Runtime ==========
    async function loadOnnxRuntime() {
        if (window.ort) return;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('فشل تحميل ONNX Runtime'));
            document.head.appendChild(s);
        });
        window.ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
        console.log('✅ ONNX Runtime loaded');
    }

    // ========== تحميل مكتبة client-side-ocr (مع بدائل) ==========
    async function loadOcrLibrary() {
        if (window.__clientSideOcrModule) return window.__clientSideOcrModule;
        
        await loadOnnxRuntime();

        // قائمة روابط CDN للاحتياط
        const urls = [
            'https://unpkg.com/client-side-ocr@latest/dist/index.mjs',
            'https://cdn.jsdelivr.net/npm/client-side-ocr@latest/dist/index.mjs',
            'https://esm.sh/client-side-ocr@latest'
        ];

        let lastError = null;
        for (const url of urls) {
            try {
                console.log('⏳ Trying to load OCR from:', url);
                const module = await import(/* @vite-ignore */ url);
                if (module && (module.createRapidOCREngine || module.createOCREngine)) {
                    console.log('✅ OCR library loaded from:', url);
                    window.__clientSideOcrModule = module;
                    return module;
                }
            } catch (e) {
                console.warn('❌ Failed with:', url, e.message);
                lastError = e;
            }
        }
        throw new Error('فشل تحميل مكتبة OCR من جميع المصادر: ' + (lastError?.message || ''));
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
            const lib = await loadOcrLibrary();
            const createEngine = lib.createRapidOCREngine || lib.createOCREngine;
            if (!createEngine) throw new Error('لم يتم العثور على دالة إنشاء المحرك');

            toast('⏳ جاري تهيئة محرك OCR للعربية (قد يستغرق دقيقة في المرة الأولى)...', 'info', 5000);
            
            ocrEngine = createEngine({
                language: 'ar',           // ✅ العربية
                modelVersion: 'PP-OCRv4', // ✅ نموذج دقيق
                modelType: 'mobile',      // أسرع، مناسب للمتصفح
                cacheModels: true          // تخزين في IndexedDB
            });

            if (typeof ocrEngine.initialize !== 'function') {
                throw new Error('المحرك لا يدعم التهيئة');
            }

            await ocrEngine.initialize();
            console.log('✅ OCR Engine initialized (Arabic)');
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

        const preview = document.getElementById('ocrPreview');
        if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-width:100%;border-radius:12px;max-height:300px">`;
        }

        const progress = document.getElementById('ocrProgress');
        const bar = document.getElementById('ocrBar');
        const progressText = document.getElementById('ocrText');
        if (progress) progress.style.display = 'block';
        if (bar) bar.style.width = '5%';
        if (progressText) progressText.textContent = '⏳ جاري تهيئة المحرك...';

        try {
            const engine = await initOCR();
            if (bar) bar.style.width = '30%';
            if (progressText) progressText.textContent = '⏳ جاري قراءة الجدول...';

            const result = await engine.processImage(file, {
                enableTextClassification: true,
                enableWordSegmentation: true,
                returnConfidence: true,
                preprocessConfig: { maxSideLen: 1280, detectImageMode: 'scale' },
                postprocessConfig: { unclipRatio: 2.0, boxThresh: 0.7, minBoxSize: 10 }
            });

            if (bar) bar.style.width = '100%';
            if (progressText) progressText.textContent = `✅ تم التحليل (دقة ${Math.round((result.confidence || 0) * 100)}%)`;

            const ta = document.getElementById('ocrTextarea');
            if (ta) ta.value = result.text || '';
            const resultEl = document.getElementById('ocrResult');
            if (resultEl) resultEl.style.display = 'block';

            toast(`✅ تم استخراج ${(result.text || '').split('\n').length} سطر`, 'success', 3000);

            if (window.TimetableImporter && window.TimetableImporter.open) {
                setTimeout(() => window.TimetableImporter.open(result.text || ''), 600);
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
        // ✅ الحل الجذري لمشكلة "الزر لا يعمل": استخدام مستمع واحد على العنصر الأصلي
        const uploadZone = document.getElementById('uploadZone');
        const ocrFile = document.getElementById('ocrFile');
        
        if (!uploadZone || !ocrFile) {
            console.warn('⚠️ لم يتم العثور على عناصر رفع الصورة');
            return;
        }

        if (uploadZone._advancedBound) return;
        uploadZone._advancedBound = true;

        // جعل النقر على المنطقة يفتح مدخل الملفات
        uploadZone.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                ocrFile.click();
            }
        });

        // ربط التغيير بالتحليل
        ocrFile.addEventListener('change', function(e) {
            const f = e.target.files[0];
            if (f) analyzeImage(f);
            ocrFile.value = ''; // السماح بإعادة رفع نفس الصورة
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

    console.log('📸 Advanced OCR loaded — Client-Side PaddleOCR (Arabic)');
})();