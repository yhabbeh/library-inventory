import { fetchBooksData } from './data.js';

let books = [];
let filteredBooks = [];
let currentBook = null;

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXdQ_DgPG3j7Ehz9e6KqpXCrXjHeFabUO0Y9WdQvjTCIOvYigZvepKlK_B3ibAe3k/exec';


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
    authError: document.getElementById('auth-error')
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
    try {
        books = await fetchBooksData();
        console.log('Books loaded:', books.length);
    } catch (err) {
        console.error('Failed to load books', err);
        alert('Failed to load books database');
    }

    console.log('Using Apps Script URL:', SCRIPT_URL);


    setupEventListeners();
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

    DOM.btnBackToSearch.addEventListener('click', resetView);

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

    DOM.searchSection.classList.remove('active');
    DOM.searchSection.classList.add('hidden');

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
    if (!currentBook || !DOM.fileInput.files[0]) return;

    const file = DOM.fileInput.files[0];
    DOM.uploadBtn.disabled = true;
    DOM.uploadBtn.textContent = 'جاري الرفع...';

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
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                // Use simple content type to avoid CORS preflight issues with Apps Script
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                DOM.uploadStatus.innerHTML = '<span class="status-indicator success">✓ نجاح</span> تم الرفع بنجاح!';
                DOM.uploadStatus.classList.add('success');

                currentBook.image = result.url;
                currentBook.isPlaceholder = false;

                import('./data.js').then(({ saveLocalImageOverride }) => {
                    saveLocalImageOverride(currentBook.title, result.url);
                });

                renderBookDetails(currentBook);

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
