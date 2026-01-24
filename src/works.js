import { fetchBooksData } from './data.js';

let books = [];
let filteredBooks = [];
let currentBook = null;
let scriptUrl = localStorage.getItem('library_script_url') || '';

const DOM = {
    searchInput: document.getElementById('book-search'),
    searchResults: document.getElementById('search-results'),
    searchSection: document.getElementById('search-section'),
    editSection: document.getElementById('edit-section'),
    currentBookCard: document.getElementById('current-book-card'),
    currentImageDisplay: document.getElementById('current-image-display'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),
    previewContainer: document.getElementById('preview-container'),
    previewImage: document.getElementById('new-image-preview'),
    clearPreviewBtn: document.getElementById('clear-preview'),
    uploadBtn: document.getElementById('btn-upload'),
    skipBtn: document.getElementById('btn-skip'),
    uploadStatus: document.getElementById('upload-status'),
    btnBackToSearch: document.getElementById('btn-back-to-search'),
    authModal: document.getElementById('auth-modal'),
    authPasswordInput: document.getElementById('auth-password'),
    loginBtn: document.getElementById('btn-login'),
    authError: document.getElementById('auth-error'),
    configModal: document.getElementById('config-modal'),
    scriptUrlInput: document.getElementById('script-url-input'),
    saveConfigBtn: document.getElementById('save-config'),
    configError: document.getElementById('config-error'),
    settingsBtn: document.getElementById('settings-btn')
};

// --- Initialization ---
const AUTH_KEY = 'library_admin_session';
const PASS_CODE = 'admin123';

async function init() {
    if (!sessionStorage.getItem(AUTH_KEY)) {
        DOM.authModal.style.display = 'flex';
        DOM.loginBtn.addEventListener('click', checkAuth);
        DOM.authPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkAuth();
        });
        return;
    }
    DOM.authModal.style.display = 'none';
    loadApp();
}

function checkAuth() {
    if (DOM.authPasswordInput.value === PASS_CODE) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        DOM.authModal.style.display = 'none';
        loadApp();
    } else {
        DOM.authError.classList.add('show');
    }
}

async function loadApp() {
    // Load books data first
    try {
        books = await fetchBooksData();
        console.log('Books loaded:', books.length);
    } catch (err) {
        console.error('Failed to load books', err);
        alert('Failed to load books database');
    }

    // If no script URL is saved, show config modal after successful authentication
    if (!scriptUrl) {
        DOM.configModal.style.display = 'flex';
    }

    setupEventListeners();
}

// Validate the Apps Script URL
async function validateScriptUrl(url) {
    try {
        // Test the connection by sending a simple test request
        // Using GET method first to check if the endpoint is accessible
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Send a minimal request to test connectivity
            body: JSON.stringify({
                action: 'validate',
                timestamp: Date.now()
            })
        });

        // Check if the response is OK and parse it
        if (!response.ok) {
            return { valid: false, message: `استجاب الخادم بالحالة: ${response.status} ${response.statusText}` };
        }

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            // If JSON parsing fails, the server might be returning plain text
            const textResponse = await response.text();
            console.warn('Non-JSON response from server:', textResponse);
            // If we got a response at all, consider it a connection success
            return { valid: true, message: 'تم الاتصال بالخادم ولكن التنسيق غير متوقع.' };
        }

        // Check if the response has a status or similar property indicating success
        if (result && (result.status === 'success' || result.result || result.message)) {
            return { valid: true, message: 'الاتصال ناجح!' };
        } else {
            return { valid: false, message: 'تنسيق الاستجابة من الخادم غير متوقع' };
        }
    } catch (error) {
        console.error('Validation failed:', error);

        // Provide more specific error messages
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { valid: false, message: 'غير قادر على الاتصال بالخادم. يرجى التحقق من رابط Apps Script.' };
        } else if (error.message.includes('CORS')) {
            return { valid: false, message: 'خطأ في CORS: يرجى التحقق من إعدادات نشر Apps Script.' };
        } else if (error.message.includes('404')) {
            return { valid: false, message: 'نقطة النهاية غير موجودة. يرجى التحقق من الرابط.' };
        } else if (error.message.includes('403')) {
            return { valid: false, message: 'تم رفض الوصول. يرجى التحقق من أذونات تنفيذ Apps Script.' };
        } else {
            return { valid: false, message: `فشل الاتصال: ${error.message || 'خطأ غير معروف'}` };
        }
    }
}

// Helper functions for config error handling
function showConfigError(message) {
    DOM.configError.textContent = message;
    DOM.configError.classList.add('show');
}

function hideConfigError() {
    DOM.configError.classList.remove('show');
}

function setupEventListeners() {
    // Search
    DOM.searchInput.addEventListener('input', handleSearch);

    // File Upload UI
    DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', handleFileSelect);
    DOM.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); DOM.dropZone.classList.add('dragover'); });
    DOM.dropZone.addEventListener('dragleave', () => DOM.dropZone.classList.remove('dragover'));
    DOM.dropZone.addEventListener('drop', handleDrop);

    DOM.clearPreviewBtn.addEventListener('click', clearPreview);
    DOM.uploadBtn.addEventListener('click', uploadImage);
    DOM.skipBtn.addEventListener('click', resetView);

    // Config
    DOM.saveConfigBtn.addEventListener('click', async () => {
        const url = DOM.scriptUrlInput.value.trim();
        if (!url) {
            showConfigError('الرجاء إدخال رابط صحيح');
            return;
        }

        // Validate the URL format first
        try {
            new URL(url);
        } catch (e) {
            showConfigError('تنسيق الرابط غير صحيح. يرجى إدخال رابط صحيح.');
            return;
        }

        // Show loading state with spinner
        DOM.saveConfigBtn.innerHTML = '<span class="spinner"></span> جاري الاختبار...';
        DOM.saveConfigBtn.disabled = true;

        try {
            const validationResult = await validateScriptUrl(url);

            if (validationResult.valid) {
                scriptUrl = url;
                localStorage.setItem('library_script_url', url);
                DOM.configModal.style.display = 'none';

                // Reset button
                DOM.saveConfigBtn.innerHTML = '💾 حفظ الإعدادات';
                DOM.saveConfigBtn.disabled = false;
                hideConfigError();
            } else {
                showConfigError(validationResult.message);
                DOM.saveConfigBtn.innerHTML = '💾 حفظ الإعدادات';
                DOM.saveConfigBtn.disabled = false;
            }
        } catch (error) {
            console.error('Configuration validation failed:', error);
            showConfigError(`فشل الاختبار: ${error.message || 'خطأ غير معروف'}`);
            DOM.saveConfigBtn.innerHTML = '💾 حفظ الإعدادات';
            DOM.saveConfigBtn.disabled = false;
        }
    });

    // Back to search button
    DOM.btnBackToSearch.addEventListener('click', resetView);

    // Settings button to reopen config modal
    if (DOM.settingsBtn) {
        DOM.settingsBtn.addEventListener('click', () => {
            DOM.configModal.style.display = 'flex';
            if (scriptUrl) {
                DOM.scriptUrlInput.value = scriptUrl;
            }
        });
    }
}

// --- Search Logic ---

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
        DOM.searchResults.style.display = 'none';
        return;
    }

    filteredBooks = books.filter(b =>
        b.title.toLowerCase().includes(query) ||
        (b.author && b.author.toLowerCase().includes(query))
    );

    renderSearchResults(filteredBooks);
}

function renderSearchResults(results) {
    DOM.searchResults.innerHTML = '';
    if (results.length === 0) {
        DOM.searchResults.style.display = 'none';
        return;
    }

    results.slice(0, 10).forEach(book => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
      <div class="title">${book.title}</div>
      <div class="author">${book.author || ''}</div>
    `;
        div.onclick = () => selectBook(book);
        DOM.searchResults.appendChild(div);
    });

    DOM.searchResults.style.display = 'block';
}

// --- Selection Logic ---

function selectBook(book) {
    currentBook = book;
    DOM.searchInput.value = '';
    DOM.searchResults.style.display = 'none';

    // UI Switch
    DOM.searchSection.classList.remove('active');
    DOM.searchSection.classList.add('hidden'); // Optional: hide search or keep it? 
    // Design choice: Keep search visible but collapsed? Or switch views?
    // User asked for "Skip to another book", implying a flow.
    // Let's just show the edit section and maybe keep search accessible if needed?
    // Let's make it a step flow.

    DOM.editSection.classList.remove('hidden');
    DOM.editSection.classList.add('active');

    renderBookDetails(book);
}

function renderBookDetails(book) {
    DOM.currentBookCard.innerHTML = `
    <h2>${book.title}</h2>
    <p><strong>المؤلف:</strong> ${book.author || 'غير محدد'}</p>
    <p><strong>التصنيف:</strong> ${book.category}</p>
  `;

    if (book.image && !book.isPlaceholder) {
        DOM.currentImageDisplay.innerHTML = `<img src="${book.image}" alt="Book Cover">`;
    } else {
        DOM.currentImageDisplay.innerHTML = `<div class="placeholder"><span class="icon">📷</span><p>لا توجد صورة متاحة</p></div>`;
    }

    clearPreview();
}

function resetView() {
    currentBook = null;
    DOM.editSection.classList.add('hidden');
    DOM.editSection.classList.remove('active');
    DOM.searchSection.classList.remove('hidden');
    DOM.searchSection.classList.add('active');
    DOM.searchInput.focus();
}

// --- File Handling ---

function handleFileSelect(e) {
    const file = e.target.files[0];
    processFile(file);
}

function handleDrop(e) {
    e.preventDefault();
    DOM.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        processFile(e.dataTransfer.files[0]);
    }
}

function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('يرجى اختيار ملف صورة صحيح');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        DOM.previewImage.src = e.target.result;
        DOM.previewContainer.classList.remove('hidden');
        DOM.dropZone.classList.add('hidden');
        DOM.uploadBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

function clearPreview() {
    DOM.fileInput.value = '';
    DOM.previewContainer.classList.add('hidden');
    DOM.dropZone.classList.remove('hidden');
    DOM.uploadBtn.disabled = true;
    DOM.uploadStatus.innerHTML = '';
    DOM.uploadStatus.className = 'status-msg';
}

// --- Upload Logic ---

async function uploadImage() {
    if (!currentBook || !DOM.fileInput.files[0] || !scriptUrl) return;

    const file = DOM.fileInput.files[0];
    DOM.uploadBtn.disabled = true;
    DOM.uploadBtn.textContent = 'جاري الرفع...';

    // Convert to Base64 (remove prefix)
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];
        const mimeType = file.type;
        const filename = `${currentBook.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_')}_${Date.now()}`;

        const payload = {
            action: 'upload',
            image: base64Data,
            mimeType: mimeType,
            filename: filename,
            bookTitle: currentBook.title
        };

        try {
            const response = await fetch(scriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // Check if the response is ok
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                DOM.uploadStatus.innerHTML = '<span class="status-indicator success">✓ نجاح</span> تم الرفع بنجاح!';
                DOM.uploadStatus.classList.add('success');

                // Update local object
                currentBook.image = result.url;
                currentBook.isPlaceholder = false;

                // Save to local storage for persistent immediate feedback
                import('./data.js').then(({ saveLocalImageOverride }) => {
                    saveLocalImageOverride(currentBook.title, result.url);
                });

                // Simulating immediate feedback in UI
                renderBookDetails(currentBook);

                // Auto-advance after small delay
                setTimeout(() => {
                    if (confirm('تم الحفظ. الانتقال للكتاب التالي؟')) {
                        resetView();
                    } else {
                        DOM.uploadBtn.textContent = 'تم الرفع';
                    }
                }, 1000);

            } else {
                throw new Error(result.message || 'Unknown error from server');
            }

        } catch (error) {
            console.error('Upload failed', error);
            let errorMessage = error.message;

            // More specific error messages
            if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Unable to connect to the server. Please check the Apps Script URL.';
            } else if (error.message.includes('CORS')) {
                errorMessage = 'CORS error: Please check your Apps Script deployment settings.';
            } else if (error.message.includes('404')) {
                errorMessage = 'Apps Script endpoint not found. Please check the URL.';
            } else if (error.message.includes('403')) {
                errorMessage = 'Access denied. Please check your Apps Script execution permissions.';
            }

            DOM.uploadStatus.innerHTML = '<span class="status-indicator error">✗ خطأ</span> فشل الرفع: ' + errorMessage;
            DOM.uploadStatus.classList.add('error');
            DOM.uploadBtn.disabled = false;
            DOM.uploadBtn.textContent = 'حاول مرة أخرى';
        }
    };
    reader.readAsDataURL(file);
}

init();
