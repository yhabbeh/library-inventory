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
    configModal: document.getElementById('config-modal'),
    scriptUrlInput: document.getElementById('script-url-input'),
    saveConfigBtn: document.getElementById('save-config')
};

// --- Initialization ---

async function init() {
    if (!scriptUrl) {
        DOM.configModal.style.display = 'flex';
    }

    try {
        books = await fetchBooksData();
        console.log('Books loaded:', books.length);
    } catch (err) {
        console.error('Failed to load books', err);
        alert('Failed to load books database');
    }

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

    // Config
    DOM.saveConfigBtn.addEventListener('click', () => {
        const url = DOM.scriptUrlInput.value.trim();
        if (url) {
            scriptUrl = url;
            localStorage.setItem('library_script_url', url);
            DOM.configModal.style.display = 'none';
        }
    });
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
        DOM.currentImageDisplay.innerHTML = `<div class="placeholder">لا توجد صورة</div>`;
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
                // mode: 'no-cors', // Apps Script needs specific handling, usually redirect.
                // If we use 'no-cors', we can't read response. 
                // Standard Apps Script Web App pattern allows CORS if set to "Anonymous" or "Me" with proper headers.
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === 'success') {
                DOM.uploadStatus.textContent = 'تم الرفع بنجاح! الرابط: ' + result.url;
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
                throw new Error(result.message || 'Unknown error');
            }

        } catch (error) {
            console.error('Upload failed', error);
            DOM.uploadStatus.textContent = 'فشل الرفع: ' + error.message;
            DOM.uploadStatus.classList.add('error');
            DOM.uploadBtn.disabled = false;
            DOM.uploadBtn.textContent = 'حاول مرة أخرى';
        }
    };
    reader.readAsDataURL(file);
}

init();
