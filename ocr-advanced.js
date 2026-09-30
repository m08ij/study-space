/* ============================================================
   📸 ocr-advanced.js — OCR متقدم يعمل في المتصفح
   ✅ client-side-ocr + PaddleOCR (PP-OCRv4) للعربية
   ✅ لا يحتاج مفاتيح API، لا سيرفر، لا تسجيل
   ✅ يفهم بنية الجداول ويرجع النص منظمًا
   ============================================================ */
(function() {
    'use strict';

    function toast(m, t, d){ if(typeof window.toast === 'function') window.toast(m, t || 'info', d || 2500); }

    // ========== تحميل المكتبة من CDN ==========
    let ocrEngine = null;
    let isInitializing = false;

    async function loadLibrary() {
        if (window.__clientSideOcrLoaded) return;
        
        // تحميل ONNX Runtime Web أولاً
        if (!window.ort) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error('فشل تحميل ONNX Runtime'));
                document.head.appendChild(s);
            });
        }

        // تحميل مكتبة client-side-ocr
        const module = await import('https://cdn.jsdelivr.net/npm/client-side-ocr@2.1.0/dist/index.mjs');
        window.__clientSideOcrLoaded = module;
        
        // تهيئة wasm paths
        if (window.ort) {
            window.ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
        }
    }

    // ========== تهيئة محرك OCR ==========
    async function initOCR() {
        if (ocrEngine) return ocrEngine;
        if (isInitializing) {
            while (isInitializing) {
                await new Promise(r => setTimeout(r, 100));
            }
            return ocrEngine;
        }

        isInitializing = true;
        try {
            await loadLibrary();
            
            const { createRapidOCREngine } = window.__clientSideOcrLoaded;
            
            toast('⏳ جاري تهيئة محرك OCR (المرة الأولى فقط)...', 'info', 4000);
            
            ocrEngine = createRapidOCREngine({
                language: 'ar',           // ✅ العربية
                modelVersion: 'PP-OCRv4', // ✅ أحدث نموذج
                modelType: 'mobile',      // أسرع، مناسب للمتصفح
                cacheModels: true          // تخزين مؤقت في IndexedDB
            });

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

    // ========== الدالة الرئيسية للتحليل ==========
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
        if (progressText) progressText.textContent = '⏳ جاري تحميل المكتبة...';

        try {
            // 1) تهيئة المحرك
            const engine = await initOCR();
            if (bar) bar.style.width = '30%';
            if (progressText) progressText.textContent = '⏳ جاري قراءة الجدول...';

            // 2) تنفيذ OCR
            const result = await engine.processImage(file, {
                enableTextClassification: true,   // كشف الدوران
                enableWordSegmentation: true,     // تقسيم الكلمات
                returnConfidence: true,
                preprocessConfig: {
                    detectImageNetNorm: true,
                    recStandardNorm: true,
                    maxSideLen: 1280,             // صور أكبر = دقة أعلى
                    detectImageMode: 'scale'
                },
                postprocessConfig: {
                    unclipRatio: 2.0,
                    boxThresh: 0.7,
                    minBoxSize: 10
                }
            });

            if (bar) bar.style.width = '100%';
            if (progressText) progressText.textContent = `✅ تم التحليل (دقة ${Math.round((result.confidence || 0) * 100)}%)`;

            // 3) عرض النص في textarea
            const ta = document.getElementById('ocrTextarea');
            if (ta) ta.value = result.text || '';

            const resultEl = document.getElementById('ocrResult');
            if (resultEl) resultEl.style.display = 'block';

            toast(`✅ تم استخراج ${(result.text || '').split('\n').length} سطر`, 'success', 3000);

            // 4) فتح المستورد تلقائيًا
            if (window.TimetableImporter && window.TimetableImporter.open) {
                setTimeout(() => {
                    window.TimetableImporter.open(result.text || '');
                }, 600);
            }

        } catch (error) {
            console.error('OCR Error:', error);
            if (progressText) progressText.textContent = '❌ فشل التحليل';
            if (bar) bar.style.width = '0%';
            toast('فشل التحليل: ' + (error.message || 'خطأ غير معروف'), 'warn', 5000);
        }
    }

    // ========== ربط الزر ==========
    function install() {
        // استبدال معالج الزر الحالي
        const ocrFile = document.getElementById('ocrFile');
        if (ocrFile && !ocrFile._advancedBound) {
            ocrFile._advancedBound = true;
            const newInput = ocrFile.cloneNode(true);
            ocrFile.parentNode.replaceChild(newInput, ocrFile);
            newInput.addEventListener('change', (e) => {
                const f = e.target.files[0];
                if (f) analyzeImage(f);
                newInput.value = ''; // للسماح بإعادة رفع نفس الصورة
            });
        }

        // drag-drop
        const uz = document.getElementById('uploadZone');
        if (uz && !uz._advancedBound) {
            uz._advancedBound = true;
            uz.addEventListener('dragover', (e) => { e.preventDefault(); uz.classList.add('dragover'); });
            uz.addEventListener('dragleave', () => uz.classList.remove('dragover'));
            uz.addEventListener('drop', (e) => {
                e.preventDefault();
                uz.classList.remove('dragover');
                const f = e.dataTransfer.files[0];
                if (f) analyzeImage(f);
            });
        }

        console.log('📸 Advanced OCR: bound to input');
    }

    // ========== API عام ==========
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(install, 1000));
    } else {
        setTimeout(install, 1000);
    }

    console.log('📸 Advanced OCR loaded — Client-Side PaddleOCR (Arabic)');
})();