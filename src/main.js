import './style.css'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o_KJTYojVnXI96dkOqIZrGtXTIuwn5bx0z1IBfrXTJ0/export?format=csv';

let books = [];
let filteredBooks = [];
let categories = ['All'];
let currentCategory = 'All';
let searchQuery = '';
let currentLang = 'ar'; // Default to Arabic as per data
let currentPage = 1;
const ITEMS_PER_PAGE = 100;

const translations = {
  en: {
    title: 'LibInventory',
    subtitle: 'Explore and manage our premium library collection. Real-time availability from our central database.',
    searchPlaceholder: 'Search by title, author, or category...',
    all: 'All',
    itemsFound: 'items found',
    loading: 'Loading collection...',
    priceOnRequest: 'Price on request',
    inStock: 'In Stock',
    outOfAvailability: 'Contact for Availability',
    reserveNow: 'Reserve Now',
    by: 'By',
    briefTemplate: (title, author) => `Experience the captivating story of "${title}" by ${author}. An essential addition to any library collection.`,
    pricePrefix: '$',
    errorTitle: 'Failed to load inventory',
    errorText: 'Please check your connection or the spreadsheet sharing settings.',
    retry: 'Retry',
    dir: 'ltr',
    prev: 'Previous',
    next: 'Next',
    pageOf: (current, total) => `Page ${current} of ${total}`
  },
  ar: {
    title: 'مكتبة الجرد',
    subtitle: 'استكشف وإدارة مجموعتنا المكتبية المتميزة. توفر مباشر من قاعدة بياناتنا المركزية.',
    searchPlaceholder: 'ابحث حسب العنوان أو المؤلف أو التصنيف...',
    all: 'الكل',
    itemsFound: 'عناصر موجودة',
    loading: 'جاري تحميل المجموعة...',
    priceOnRequest: 'السعر عند الطلب',
    inStock: 'متوفر',
    outOfAvailability: 'تواصل لمعرفة التوفر',
    reserveNow: 'احجز الآن',
    by: 'بواسطة',
    briefTemplate: (title, author) => `استمتع بتجربة القصة الآسرة لـ "${title}" بقلم ${author}. إضافة أساسية لأي مجموعة مكتبية.`,
    pricePrefix: '$',
    errorTitle: 'فشل تحميل المخزون',
    errorText: 'يرجى التحقق من الاتصال أو إعدادات مشاركة جدول البيانات.',
    retry: 'إعادة المحاولة',
    dir: 'rtl',
    prev: 'السابق',
    next: 'التالي',
    pageOf: (current, total) => `صفحة ${current} من ${total}`
  }
};

async function fetchBooks() {
  try {
    const response = await fetch(SHEET_URL);
    const csvData = await response.text();
    books = parseCSV(csvData);

    // Generate categories
    const uniqueCategories = [...new Set(books.map(b => b.category).filter(Boolean))];
    const allLabel = translations[currentLang].all;
    categories = [allLabel, ...uniqueCategories];
    currentCategory = allLabel;

    filteredBooks = books;
    renderUI();
  } catch (error) {
    console.error('Error fetching books:', error);
    const t = translations[currentLang];
    document.getElementById('app').innerHTML = `
      <div class="error">
        <h2>${t.errorTitle}</h2>
        <p>${t.errorText}</p>
        <button onclick="location.reload()">${t.retry}</button>
      </div>
    `;
  }
}

function parseCSV(csv) {
  const lines = csv.split('\n');
  const result = [];
  const headers = lines[0].split(',');

  // Headers: Title,Cost,Price,Profit,Availability,Column 8,Author,Category
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const currentLine = parseCSVLine(lines[i]);
    if (currentLine.length < 2) continue;

    const book = {
      title: currentLine[0] || 'Unknown Title',
      cost: currentLine[1],
      price: currentLine[2],
      availability: currentLine[4],
      author: currentLine[6] || 'Unknown Author',
      category: formatCategory(currentLine[7], currentLine[0]),
      // Generate a placeholder image URL based on category color
      image: getPlaceholderImage(currentLine[0], currentLine[7]),
      isPlaceholder: true, // All our current items are placeholders as they lack real img URLs
      brief: `Experience the captivating story of "${currentLine[0]}" by ${currentLine[6] || 'Unknown Author'}. An essential addition to any library collection.`
    };
    result.push(book);
  }
  return result;
}

// Simple CSV line parser to handle quotes/commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function formatCategory(cat, title) {
  if (!cat || cat === 'غير مصنف' || cat === 'Uncategorized') {
    // Basic heuristic categorization
    if (title.includes('رواية')) return 'رواية / أدب';
    if (title.includes('فقه') || title.includes('شرح')) return 'إسلامي / فقه';
    if (title.includes('سيرة')) return 'سيرة نبوية';
    if (title.includes('تطوير') || title.includes('الذات')) return 'تنمية بشرية';
    return 'General';
  }
  return cat;
}

function getPlaceholderImage(title, category) {
  const colors = {
    'رواية': '6366f1',
    'تنمية': 'a855f7',
    'إسلامي': '10b981',
    'فقه': 'f59e0b',
    'سيرة': 'ef4444',
    'default': '3f3f46'
  };

  let bgColor = colors.default;
  for (const [key, color] of Object.entries(colors)) {
    if (category && category.includes(key)) {
      bgColor = color;
      break;
    }
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=${bgColor}&size=400&color=fff&font-size=0.25&length=3&bold=true`;
}

function getCategoryColor(category) {
  const colors = {
    'رواية': '6366f1',
    'تنمية': 'a855f7',
    'إسلامي': '10b981',
    'فقه': 'f59e0b',
    'سيرة': 'ef4444',
    'default': '3f3f46'
  };

  for (const [key, color] of Object.entries(colors)) {
    if (category && category.includes(key)) return color;
  }
  return colors.default;
}

function renderCategories() {
  const container = document.getElementById('categories');
  if (!container) return;

  container.innerHTML = categories.map(cat => `
    <div class="category-pill ${cat === currentCategory ? 'active' : ''}" 
         onclick="window.setCategory('${cat}')">
      ${cat}
    </div>
  `).join('');
}

function renderBooks() {
  const container = document.getElementById('book-grid');
  const countElement = document.getElementById('result-count');
  const t = translations[currentLang];

  if (!container) return;

  if (filteredBooks.length === 0) {
    container.innerHTML = `<div class="no-results">${currentLang === 'ar' ? 'لم يتم العثور على نتائج' : 'No books found'}</div>`;
    countElement.innerText = `0 ${t.itemsFound}`;
    updatePagination(0);
    return;
  }

  const totalPages = Math.ceil(filteredBooks.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = filteredBooks.slice(start, end);

  countElement.innerText = `${filteredBooks.length} ${t.itemsFound}`;

  container.innerHTML = pageItems.map((book, index) => {
    // Find absolute index for modal
    const absoluteIndex = start + index;
    const coverContent = book.isPlaceholder
      ? `<div class="placeholder-cover" style="--cover-bg: #${getCategoryColor(book.category)}">
           <div class="cover-title">${book.title}</div>
         </div>`
      : `<img src="${book.image}" alt="${book.title}" class="book-img" loading="lazy">`;

    return `
      <div class="book-card" onclick="window.openModal(${absoluteIndex})">
        <div class="book-img-container">
          ${coverContent}
        </div>
        <div class="book-info">
          <div class="book-category">${book.category}</div>
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
          <div class="book-price">${book.price && !isNaN(parseFloat(book.price)) ? `$${parseFloat(book.price).toFixed(2)}` : t.priceOnRequest}</div>
          ${book.availability === '1' ? `<span class="status-badge in-stock">${t.inStock}</span>` : `<span class="status-badge out-of-stock">${t.outOfAvailability}</span>`}
        </div>
      </div>
    `;
  }).join('');

  updatePagination(totalPages);
}

function updatePagination(totalPages) {
  const container = document.getElementById('pagination');
  const t = translations[currentLang];
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button class="pag-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="window.setPage(${currentPage - 1})">${t.prev}</button>
    <span class="pag-info">${t.pageOf(currentPage, totalPages)}</span>
    <button class="pag-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.setPage(${currentPage + 1})">${t.next}</button>
  `;
}

// Global functions for events
window.setLanguage = (lang) => {
  currentLang = lang;
  document.documentElement.dir = translations[lang].dir;
  document.documentElement.lang = lang;

  // Re-generate categories list based on new "All" translation
  const uniqueCategories = [...new Set(books.map(b => b.category).filter(Boolean))];
  const allLabel = translations[currentLang].all;
  categories = [allLabel, ...uniqueCategories];
  currentCategory = allLabel;

  renderUI();
};

window.setPage = (page) => {
  currentPage = page;
  renderBooks();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.setCategory = (cat) => {
  currentCategory = cat;
  filterBooks();
  renderCategories();
};

window.handleSearch = (e) => {
  searchQuery = e.target.value.toLowerCase();
  currentPage = 1;
  filterBooks();
};

function filterBooks() {
  const allLabel = translations[currentLang].all;
  filteredBooks = books.filter(book => {
    const matchesCategory = currentCategory === allLabel || book.category === currentCategory;
    const matchesSearch = book.title.toLowerCase().includes(searchQuery) ||
      book.author.toLowerCase().includes(searchQuery) ||
      book.category.toLowerCase().includes(searchQuery);
    return matchesCategory && matchesSearch;
  });
  renderBooks();
}

window.openModal = (index) => {
  const book = filteredBooks[index];
  const modal = document.getElementById('modal');
  const details = document.getElementById('modal-details');
  const t = translations[currentLang];

  const modalCover = book.isPlaceholder
    ? `<div class="placeholder-cover modal-placeholder" style="--cover-bg: #${getCategoryColor(book.category)}">
         <div class="cover-title">${book.title}</div>
       </div>`
    : `<img src="${book.image}" alt="${book.title}" class="modal-img" id="modal-img">`;

  // Update modal structure to handle potential div cover
  const modalContent = document.querySelector('.modal-content');
  const existingCover = modalContent.querySelector('.modal-img, .modal-placeholder');
  if (existingCover) existingCover.remove();
  modalContent.insertAdjacentHTML('afterbegin', modalCover);

  details.innerHTML = `
    <button class="modal-close" onclick="window.closeModal()">&times;</button>
    <div class="book-category">${book.category}</div>
    <h2>${book.title}</h2>
    <div class="book-author">${t.by} ${book.author}</div>
    <div class="modal-brief">${t.briefTemplate(book.title, book.author)}</div>
    <div class="book-price" style="font-size: 2rem; margin-top: 1rem;">
      ${book.price && !isNaN(parseFloat(book.price)) ? `${t.pricePrefix}${parseFloat(book.price).toFixed(2)}` : t.priceOnRequest}
    </div>
  `;
  modal.style.display = 'flex';
};

window.closeModal = () => {
  document.getElementById('modal').style.display = 'none';
};

function renderUI() {
  const t = translations[currentLang];
  document.getElementById('app').innerHTML = `
    <div class="lang-switcher">
      <button class="${currentLang === 'en' ? 'active' : ''}" onclick="window.setLanguage('en')">EN</button>
      <button class="${currentLang === 'ar' ? 'active' : ''}" onclick="window.setLanguage('ar')">AR</button>
    </div>
    <header>
      <h1>${t.title}</h1>
      <p class="subtitle">${t.subtitle}</p>
      
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" placeholder="${t.searchPlaceholder}" oninput="window.handleSearch(event)">
      </div>
    </header>

    <div id="categories" class="categories">
      <!-- Categories will be injected here -->
    </div>

    <div id="result-count" style="text-align: center; margin-bottom: 2rem; color: var(--text-muted); font-size: 0.9rem;">
      ${t.loading}
    </div>

    <div id="book-grid" class="book-grid">
      <div class="loader"><div class="spinner"></div></div>
    </div>

    <div id="pagination" class="pagination"></div>

    <div id="modal" class="modal-overlay" onclick="if(event.target === this) window.closeModal()">
      <div class="modal-content">
        <img id="modal-img" class="modal-img" src="" alt="">
        <div id="modal-details" class="modal-details"></div>
      </div>
    </div>
  `;

  renderCategories();
  renderBooks();
}

// Initial Render Setup
document.documentElement.dir = translations[currentLang].dir;
document.documentElement.lang = currentLang;

// Initial template load
document.getElementById('app').innerHTML = `<div class="loader"><div class="spinner"></div></div>`;

fetchBooks();
