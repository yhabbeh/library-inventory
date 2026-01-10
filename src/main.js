import './style.css'
import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject();

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o_KJTYojVnXI96dkOqIZrGtXTIuwn5bx0z1IBfrXTJ0/gviz/tq?tqx=out:csv&sheet=Sheet1';
const ORDER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwQOHwQmOYCTg1D3FDRHp5zenrGH8BbnGfjV8nMgUpjyieAe4VphcvEEfvhHocqcgG9/exec';

let books = [];
let filteredBooks = [];

let categories = ['All'];
let subCategoriesMap = {}; // { Parent: [{ label: "Child", value: "FullCat" }] }
let categoryHierarchy = {}; // { FullCat: Parent }
let currentCategory = 'All';
let currentSubCategory = null;
let searchQuery = '';
let currentLang = 'ar'; // Default to Arabic as per data
let currentPage = 1;
const ITEMS_PER_PAGE = 60;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

// Migration: Ensure all cart items have a quantity (if they were from the old array-based system)
cart = cart.map(item => ({ ...item, quantity: item.quantity || 1 }));
// deduplicate by title if multiple instances existed
const uniqueCart = [];
cart.forEach(item => {
  const existing = uniqueCart.find(u => u.title === item.title);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    uniqueCart.push(item);
  }
});
cart = uniqueCart;

const translations = {
  en: {
    title: 'LibInventory',
    subtitle: 'Explore our premium library collection. Real-time availability from our central database.',
    searchPlaceholder: 'Search by title or category...',
    all: 'All',
    close: 'Close',
    quantity: 'x',
    itemsFound: 'items found',
    loading: 'Loading collection...',
    priceOnRequest: 'Contact to know',
    inStock: 'In Stock',
    outOfAvailability: 'Contact for Availability',
    reserveNow: 'Reserve Now',
    pricePrefix: 'JOD',
    fullNamePlaceholder: 'Mohammad Ahmad',
    phoneNumberPlaceholder: '+962 77 123 456',
    addressPlaceholder: '123 Amman, Jordan, st. ----',
    errorTitle: 'Failed to load inventory',
    errorText: 'Please check your connection or the spreadsheet sharing settings.',
    retry: 'Retry',
    dir: 'ltr',
    prev: 'Previous',
    next: 'Next',
    pageOf: (current, total) => `Page ${current} of ${total}`,
    addToCart: 'Add to Cart',
    cart: 'Shopping Cart',
    emptyCart: 'Your cart is empty',
    checkout: 'Checkout',
    fullName: 'Full Name',
    phoneNumber: 'Phone Number',
    address: 'Delivery Address',
    placeOrder: 'Place Order',
    newItems: 'New Collection',
    bestSellers: 'Best Sellers',
    orderSuccess: 'Thank you! Your order has been placed.',
    total: 'Total',
    items: 'items',
    remove: 'Remove'
  },
  ar: {
    title: 'مكتبة وعي',
    subtitle: 'استكشف مجموعتنا المكتبية المتميزة. توفر مباشر من قاعدة بياناتنا المركزية.',
    searchPlaceholder: 'ابحث حسب العنوان أو التصنيف...',
    all: 'الكل',
    close: 'إغلاق',
    quantity: 'عدد',
    itemsFound: 'عناصر موجودة',
    loading: 'جاري تحميل المجموعة...',
    priceOnRequest: 'تواصل لمعرفة السعر',
    inStock: 'متوفر',
    outOfAvailability: 'تواصل لمعرفة التوفر',
    reserveNow: 'احجز الآن',
    pricePrefix: 'دينار',
    errorTitle: 'فشل تحميل المخزون',
    errorText: 'يرجى التحقق من الاتصال أو إعدادات مشاركة جدول البيانات.',
    retry: 'إعادة المحاولة',
    dir: 'rtl',
    prev: 'السابق',
    next: 'التالي',
    fullNamePlaceholder: 'محمد أحمد',
    phoneNumberPlaceholder: '+962 77 123 456',
    addressPlaceholder: 'عمان, الأردن, شارع النعمان',
    pageOf: (current, total) => `صفحة ${current} من ${total}`,
    addToCart: 'إضافة إلى السلة',
    cart: 'سلة التسوق',
    emptyCart: 'سلة التسوق فارغة',
    checkout: 'إتمام الطلب',
    fullName: 'الاسم الكامل',
    phoneNumber: 'رقم الهاتف',
    address: 'عنوان التوصيل',
    placeOrder: 'تأكيد الطلب',
    newItems: 'وصل حديثاً',
    bestSellers: 'الأكثر مبيعاً',
    orderSuccess: 'شكراً لك! تم استلام طلبك بنجاح.',
    total: 'المجموع',
    items: 'عناصر',
    remove: 'حذف'
  }
};

async function fetchBooks() {
  try {
    const response = await fetch(SHEET_URL);
    const csvData = await response.text();
    books = parseCSV(csvData);

    // Generate categories and hierarchy
    processCategories(books);

    // Initial state
    const allLabel = translations[currentLang].all;
    currentCategory = allLabel;
    currentSubCategory = null;

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

function normalizeAvailability(availabilityValue) {
  if (!availabilityValue) return '0'; // Treat empty as not available

  const stringValue = availabilityValue.toString().trim();

  // If it's a number, treat as quantity
  const numValue = parseInt(stringValue);
  if (!isNaN(numValue)) {
    // If quantity is greater than 0, it's available
    return numValue > 0 ? '1' : '0';
  }

  // Handle text values
  const normalizedValue = stringValue.toLowerCase();

  // Common positive indicators
  if (normalizedValue === '1' ||
    normalizedValue === 'true' ||
    normalizedValue === 'yes' ||
    normalizedValue === 'available' ||
    normalizedValue === 'in stock' ||
    normalizedValue === 'instock' ||
    normalizedValue === 'onhand' ||
    normalizedValue === 'active') {
    return '1';
  }

  // Common negative indicators
  if (normalizedValue === '0' ||
    normalizedValue === 'false' ||
    normalizedValue === 'no' ||
    normalizedValue === 'not available' ||
    normalizedValue === 'out of stock' ||
    normalizedValue === 'outofstock' ||
    normalizedValue === 'discontinued' ||
    normalizedValue === 'inactive') {
    return '0';
  }

  // Default to not available if uncertain
  return '0';
}

function parseCSV(csv) {
  const lines = csv.split('\n');
  const result = [];
  const headers = lines[0].split(',');

  // Find column indices dynamically
  const titleIndex = headers.findIndex(header => header.trim().toLowerCase() === 'title');
  const costIndex = headers.findIndex(header => header.trim().toLowerCase() === 'cost');
  const priceIndex = headers.findIndex(header => header.trim().toLowerCase() === 'price');
  const profitIndex = headers.findIndex(header => header.trim().toLowerCase() === 'profit');
  const suggestedIndex = headers.findIndex(header => header.trim().toLowerCase() === 'suggestted' || header.trim().toLowerCase() === 'suggested');
  const availabilityIndex = headers.findIndex(header => header.trim().toLowerCase() === 'availability');
  const quantityIndex = headers.findIndex(header => header.trim().toLowerCase() === 'quantity');
  const authorIndex = headers.findIndex(header => header.trim().toLowerCase() === 'author');
  const categoryIndex = headers.findIndex(header => header.trim().toLowerCase() === 'category');
  const overviewIndex = headers.findIndex(header => header.trim().toLowerCase() === 'overview');

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const currentLine = parseCSVLine(lines[i]);
    if (currentLine.length < 2) continue;

    const rawAvailability = availabilityIndex !== -1 ? currentLine[availabilityIndex] : currentLine[5];

    // Parse the availability value to determine both status and quantity
    let availabilityStatus = '0'; // Default to not available
    let availabilityQuantity = 0; // Default quantity

    if (rawAvailability && rawAvailability.startsWith('http')) {
      // If it's a URL, treat as available and set quantity to 1
      availabilityStatus = '1';
      availabilityQuantity = 1;
    } else {
      // Parse the availability value
      const parsedValue = rawAvailability ? rawAvailability.toString().trim() : '';
      const numValue = parseInt(parsedValue);

      if (!isNaN(numValue)) {
        // It's a number - use it as quantity
        availabilityQuantity = numValue;
        availabilityStatus = numValue > 0 ? '1' : '0';
      } else {
        // It's text - normalize it
        availabilityStatus = normalizeAvailability(rawAvailability);
        availabilityQuantity = availabilityStatus === '1' ? 1 : 0; // Default to 1 if available, 0 if not
      }
    }

    const book = {
      title: titleIndex !== -1 ? currentLine[titleIndex] || 'Unknown Title' : currentLine[0] || 'Unknown Title',
      cost: costIndex !== -1 ? currentLine[costIndex] : currentLine[1],
      price: suggestedIndex !== -1 ? currentLine[suggestedIndex] : (priceIndex !== -1 ? currentLine[priceIndex] : currentLine[4]), // "Suggestted" column at index 4
      profit: profitIndex !== -1 ? currentLine[profitIndex] : currentLine[3],
      availability: availabilityStatus, // '1' if available, '0' if not
      availabilityQuantity: availabilityQuantity, // Actual quantity available
      author: authorIndex !== -1 ? currentLine[authorIndex] || '' : currentLine[7] || '', // Author
      category: categoryIndex !== -1 ? formatCategory(currentLine[categoryIndex], currentLine[titleIndex !== -1 ? titleIndex : 0]) : formatCategory(currentLine[8], currentLine[0]), // "Category"
      image: null,
      isPlaceholder: true
    };

    // Heuristic: If raw availability column starts with http, it's a manual image URL
    if (rawAvailability && rawAvailability.startsWith('http')) {
      book.image = rawAvailability;
      book.isPlaceholder = false;
    }

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
  if (!cat || cat === '��ير مصنف' || cat === 'Uncategorized') {
    // Basic heuristic categorization
    if (title.includes('رواية')) return 'رواية / أدب';
    if (title.includes('فقه') || title.includes('شرح')) return 'إسلامي / فقه';
    if (title.includes('سيرة')) return 'سيرة نبوية';
    if (title.includes('تطوير') || title.includes('الذات')) return 'تنمية بشرية';
    return 'General';
  }
  return cat;
}

function getCategoryColor(category) {
  return '3f3f46';
}

function processCategories(allBooks) {
  const allLabel = translations[currentLang].all;
  const uniqueFullCats = [...new Set(allBooks.map(b => b.category).filter(Boolean))];

  // 1. Identify potential parents (roots)
  const parents = new Set();
  const orphans = [];

  uniqueFullCats.forEach(cat => {
    if (cat.includes(' / ')) {
      parents.add(cat.split(' / ')[0].trim());
    } else {
      orphans.push(cat);
    }
  });

  // Add self-contained categories if they are substrings of others
  orphans.forEach(orphan => {
    const isParent = uniqueFullCats.some(c => c !== orphan && c.includes(orphan));
    if (isParent) parents.add(orphan);
  });

  const subCats = {}; // Parent -> Set of { label, value }
  const hierarchy = {}; // FullCat -> Parent

  uniqueFullCats.forEach(fullCat => {
    let assignedParent = null;
    let displayLabel = fullCat;

    // 1. Explicit slash check
    if (fullCat.includes(' / ')) {
      const parts = fullCat.split(' / ');
      assignedParent = parts[0].trim();
      displayLabel = parts.slice(1).join(' / ').trim();
    }
    // 2. Fuzzy match
    else {
      const potential = Array.from(parents).filter(p => fullCat.includes(p) && fullCat !== p);
      if (potential.length > 0) {
        potential.sort((a, b) => b.length - a.length);
        assignedParent = potential[0];
        displayLabel = fullCat.replace(assignedParent, '').trim();
      }
    }

    // 3. Fallback
    if (!assignedParent) {
      assignedParent = fullCat;
      displayLabel = null;
    }

    hierarchy[fullCat] = assignedParent;

    if (!subCats[assignedParent]) subCats[assignedParent] = [];

    if (displayLabel) {
      displayLabel = displayLabel.replace(/^[\/\-\s]+|[\/\-\s]+$/g, '');
      if (displayLabel) {
        subCats[assignedParent].push({ label: displayLabel, value: fullCat });
      }
    }
  });

  // Finalize
  const uniqueParents = [...new Set(Object.values(hierarchy))].sort();
  categories = [allLabel, ...uniqueParents];

  categoryHierarchy = hierarchy;
  subCategoriesMap = {};

  for (const [p, list] of Object.entries(subCats)) {
    const uniqueChildren = [];
    const seen = new Set();
    list.forEach(item => {
      if (!seen.has(item.label)) {
        seen.add(item.label);
        uniqueChildren.push(item);
      }
    });
    subCategoriesMap[p] = uniqueChildren.sort((a, b) => a.label.localeCompare(b.label));
  }
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

  renderSubCategories();
}

function renderSubCategories() {
  const container = document.getElementById('sub-categories');
  if (!container) return;

  const allLabel = translations[currentLang].all;

  // Only show subcategories if a specific parent is selected (not All)
  // AND that parent has subcategories
  if (currentCategory === allLabel || !subCategoriesMap[currentCategory]) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const subs = subCategoriesMap[currentCategory];
  if (subs.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Show container
  container.style.display = 'flex';

  // "All" equivalent for subcategories (using the filtered parent set)
  const allSub = currentLang === 'ar' ? 'الكل' : 'All';

  let html = `
    <div class="category-pill ${currentSubCategory === null ? 'active' : ''}" 
         onclick="window.setSubCategory(null)" 
         style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
      ${allSub}
    </div>
  `;

  html += subs.map(sub => `
    <div class="category-pill ${sub.value === currentSubCategory ? 'active' : ''}" 
         onclick="window.setSubCategory('${sub.value}')"
         style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
      ${sub.label}
    </div>
  `).join('');

  container.innerHTML = html;
}

function renderBooks() {
  const container = document.getElementById('book-grid');
  const countElement = document.getElementById('result-count');
  const t = translations[currentLang];

  if (!container) return;

  if (filteredBooks.length === 0) {
    container.innerHTML = `<div class="no-results" style="grid-column: 1 / -1; text-align:center; padding: 4rem; color: var(--text-muted); font-size: 1.2rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--border-color);">${currentLang === 'ar' ? 'لم يتم العثور على نتائج' : 'No books found'}</div>`;
    countElement.innerHTML = `<span class="result-count-inner">0 ${t.itemsFound}</span>`;
    updatePagination(0);
    return;
  }

  const totalPages = Math.ceil(filteredBooks.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = filteredBooks.slice(start, end);

  countElement.innerHTML = `<span class="result-count-inner">${filteredBooks.length} ${t.itemsFound}</span>`;

  container.innerHTML = pageItems.map((book, index) => {
    const absoluteIndex = start + index;
    return renderBookCard(book, absoluteIndex, index);
  }).join('');

  updatePagination(totalPages);
  initRevealObserver(); // Re-run observer for new elements
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
  if (currentLang === lang) return;
  currentLang = lang;
  document.documentElement.dir = translations[lang].dir;
  document.documentElement.lang = lang;

  // Re-generate categories list based on new "All" translation
  processCategories(books);

  // Reset selection to All to avoid mismatches
  const allLabel = translations[currentLang].all;
  currentCategory = allLabel;
  currentSubCategory = null;

  // Instead of full renderUI, we update translatable parts
  updateUIVisuals();
  updateMetaTags(); // Update meta tags after language change
};

window.setPage = (page) => {
  currentPage = page;
  renderBooks();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateMetaTags(); // Update meta tags after page change
};

window.setCategory = (cat) => {
  currentCategory = cat;
  currentSubCategory = null; // Reset sub-category when parent changes
  filterBooks();
  renderCategories();
  updateMetaTags(); // Update meta tags after category change
};

window.setSubCategory = (sub) => {
  currentSubCategory = sub;
  filterBooks();
  renderCategories(); // Re-render to update active state
  updateMetaTags(); // Update meta tags after sub-category change
};

let searchTimeout;
window.handleSearch = (e) => {
  const query = e.target.value.toLowerCase();
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = query;
    currentPage = 1;
    filterBooks();
    updateMetaTags(); // Update meta tags after search
  }, 250);
};



window.toggleLangDropdown = () => {
  const menu = document.getElementById('lang-menu');
  const trigger = document.querySelector('.lang-trigger');
  menu.classList.toggle('open');
  trigger.classList.toggle('active');
};

// Close dropdown when clicking outside
window.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.lang-dropdown-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById('lang-menu')?.classList.remove('open');
  }
});

function filterBooks() {
  const allLabel = translations[currentLang].all;
  filteredBooks = books.filter(book => {
    // Category Matching Logic
    let matchesCategory = false;

    if (currentCategory === allLabel) {
      matchesCategory = true;
    } else {
      // Hierarchical Check
      const bookParent = categoryHierarchy[book.category];

      if (bookParent === currentCategory) {
        if (currentSubCategory === null) {
          matchesCategory = book.category === currentSubCategory;
        }
      }
    }

    const matchesSearch = (book.title || '').toLowerCase().includes(searchQuery) ||
      (book.category || '').toLowerCase().includes(searchQuery);

    return matchesCategory && matchesSearch;
  });
  renderBooks();
  updateMetaTags(); // Update meta tags after filtering
}

function renderBookCard(book, absoluteIndex, pageIndex) {
  const t = translations[currentLang];
  const isAvailable = book.availability === '1';
  const availabilityText = isAvailable
    ? (book.availabilityQuantity > 1 ? `${book.availabilityQuantity} ${t.inStock}` : t.inStock)
    : t.outOfAvailability;

  return `
    <div class="book-card reveal" data-title="${book.title.replace(/"/g, '&quot;')}" style="--item-index: ${pageIndex % 10}" onclick="window.openModal(${absoluteIndex})">
      <div class="book-img-container">
        ${book.image ?
      `<img src="${book.image}" alt="${book.title}" class="book-img fade-in" loading="lazy">` :
      `<div class="placeholder-cover"><div class="cover-title">${book.title}</div></div>`
    }
      </div>
      <div class="book-info">
        <div class="status-badge-container">
          <span class="status-badge ${isAvailable ? 'in-stock' : 'out-of-stock'}">
            ${availabilityText}
          </span>
        </div>
        <div class="book-title">${book.title}</div>
        <div class="card-actions">
          <div class="book-price">${book.price && !isNaN(parseFloat(book.price)) && parseFloat(book.price) > 0 ? `${book.price} ${t.pricePrefix}` : t.priceOnRequest}</div>
          <div class="cart-action-wrapper" onclick="event.stopPropagation()">
            ${renderAddToCartButton(book)}
          </div>
        </div>
      </div>
    </div>
  `;
}



function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) {
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.innerText = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
  }
}

function renderAddToCartButton(book) {
  const cartItem = cart.find(item => item.title === book.title);
  if (cartItem) {
    return `
    <div class="qty-controls">
      <button class="qty-btn minus" onclick="window.decrementQuantity('${book.title.replace(/'/g, "\\'")}')">−</button>
      <span class="qty-val" style="color:inherit; font-weight:700;">${cartItem.quantity}</span>
      <button class="qty-btn" onclick="window.incrementQuantity('${book.title.replace(/'/g, "\\'")}')">+</button>
    </div>
    `;
  }
  return `
    <button class="add-btn" onclick="window.addToCartByTitle('${book.title.replace(/'/g, "\\'")}')">
      <span>+</span>
    </button>
    `;
}

window.addToCart = (index) => {
  const book = filteredBooks[index];
  window.addToCartByTitle(book.title);
};

window.addToCartByTitle = (title) => {
  window.incrementQuantity(title);
  // Automatically open cart to show success
  const modal = document.getElementById('cart-drawer');
  if (!modal.classList.contains('open')) {
    window.toggleCart();
  }
};

window.incrementQuantity = (title) => {
  const cartItem = cart.find(item => item.title === title);
  if (cartItem) {
    cartItem.quantity += 1;
  } else {
    const book = books.find(b => b.title === title);
    cart.push({ ...book, quantity: 1 });
  }
  saveCart();
  updateCartBadge();
  updateBookCardUI(title);
  updateOpenModals(title);
};

window.decrementQuantity = (title) => {
  const cartItem = cart.find(item => item.title === title);
  if (cartItem) {
    cartItem.quantity -= 1;
    if (cartItem.quantity <= 0) {
      cart = cart.filter(item => item.title !== title);
    }
  }
  saveCart();
  updateCartBadge();
  updateBookCardUI(title);
  updateOpenModals(title);
};

function updateBookCardUI(title) {
  const book = books.find(b => b.title === title);
  if (!book) return;

  const escapedTitle = title.replace(/"/g, '&quot;');
  const wrappers = document.querySelectorAll(`.book-card[data-title="${escapedTitle}"] .cart-action-wrapper`);
  wrappers.forEach(wrapper => {
    wrapper.innerHTML = renderAddToCartButton(book);
  });
}

function updateOpenModals(title) {
  // Update cart modal if open
  if (document.getElementById('cart-drawer').classList.contains('open')) {
    renderCartModal();
  }

  // Update main book modal if open and showing this book
  const modal = document.getElementById('modal');
  if (modal && modal.classList.contains('open')) {
    const book = books.find(b => b.title === title);
    const modalTitle = modal.querySelector('.modal-title');
    if (modalTitle && modalTitle.innerText === title && book) {
      // Update the status badge with quantity info
      const statusBadge = modal.querySelector('.status-badge');
      if (statusBadge) {
        const t = translations[currentLang];
        const isAvailable = book.availability === '1';
        const availabilityText = isAvailable
          ? (book.availabilityQuantity > 1 ? `${book.availabilityQuantity} ${t.inStock}` : t.inStock)
          : t.outOfAvailability;

        statusBadge.textContent = availabilityText;
        statusBadge.className = 'status-badge ' + (isAvailable ? 'in-stock' : 'out-of-stock');
      }

      // Update the action area in the modal
      const modalActions = modal.querySelector('.modal-actions');
      if (modalActions) {
        // Re-render modal action part
        const t = translations[currentLang];
        const cartBtnHtml = renderAddToCartButton(book);
        if (!cartBtnHtml.includes('qty-controls')) {
          modalActions.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
              <div class="book-price modal-price-lg">
                ${book.price && !isNaN(parseFloat(book.price)) && parseFloat(book.price) > 0 ? `${book.price} ${t.pricePrefix}` : t.priceOnRequest}
              </div>
            </div>
            <button class="btn-primary" onclick="window.addToCartByTitle('${book.title.replace(/'/g, "\\'")}')">${t.addToCart}</button>
            `;
        } else {
          modalActions.innerHTML = cartBtnHtml;
          const controlsDiv = modalActions.querySelector('.qty-controls');
          if (controlsDiv) controlsDiv.classList.add('modal-qty-controls-override');
        }
      }
    }
  }
}

window.toggleCart = () => {
  const overlay = document.getElementById('cart-drawer');
  const drawer = overlay.querySelector('.cart-drawer');

  if (overlay.classList.contains('open')) {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    setTimeout(() => {
      overlay.style.visibility = 'hidden';
    }, 300);
  } else {
    overlay.style.visibility = 'visible';
    // Force reflow
    overlay.offsetHeight;
    overlay.classList.add('open');
    drawer.classList.add('open');
    renderCartModal();
  }
};

function renderCartModal() {
  const container = document.getElementById('cart-content');
  const footer = document.getElementById('cart-footer');
  const t = translations[currentLang];

  if (cart.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 4rem 1rem; color:var(--text-secondary);">${t.emptyCart}</div>`;
    footer.innerHTML = '';
    return;
  }

  const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) && parseFloat(item.price) > 0 ? parseFloat(item.price) : 0) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  container.innerHTML = `
    <div class="cart-items">
      ${cart.map(item => `
        <div class="cart-item">
          <div class="cart-item-info" style="flex:1;">
            <h4 class="cart-item-title">${item.title}</h4>
            <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.5rem;">${item.price && !isNaN(parseFloat(item.price)) && parseFloat(item.price) > 0 ? `${item.price}` : t.priceOnRequest} ${translations[currentLang].pricePrefix}</p>
            <div class="qty-controls">
                <button class="qty-btn minus" onclick="window.decrementQuantity('${item.title.replace(/'/g, "\\'")}')">−</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-btn" onclick="window.incrementQuantity('${item.title.replace(/'/g, "\\'")}')">+</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    `;

  footer.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-weight:500; color:var(--text-secondary);">
        <span>${t.items}:</span>
        <span>${totalItems}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; font-size:1.25rem; font-weight:700; color:var(--text-primary);">
        <span>${t.total}:</span>
        <span>${total.toFixed(2)}   ${translations[currentLang].pricePrefix}</span>
      </div>
      <button class="btn-primary" onclick="window.openCheckout()">${t.checkout}</button>
  `;
}

window.openCheckout = () => {
  // Close cart drawer
  window.toggleCart();

  // Open checkout modal
  const modal = document.getElementById('checkout-modal');
  const t = translations[currentLang];
  const content = document.getElementById('checkout-content');

  content.innerHTML = `
    <form id="checkout-form" onsubmit="window.handleOrder(event)" class="checkout-container">
        <div class="form-group">
          <label>${t.fullName}</label>
          <input type="text" name="name" class="form-control" required placeholder=${t.fullNamePlaceholder}>
        </div>
        <div class="form-group">
          <label>${t.phoneNumber}</label>
          <input type="tel" name="phone" class="form-control" required placeholder=${t.phoneNumberPlaceholder}>
        </div>  
        <div class="form-group">
          <label>${t.address}</label>
          <textarea name="address" class="form-control" required placeholder=${t.addressPlaceholder}></textarea>
        </div>
        
        <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-weight:600;">
                <span>${t.total}:</span>
                <span>${cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0).toFixed(2)} ${translations[currentLang].pricePrefix}</span>
            </div>
        </div>

        <button type="submit" class="btn-primary" style="width:100%">${t.placeOrder}</button>
      </form>
    `;
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('open'), 10);
};

window.handleOrder = async (e) => {
  e.preventDefault();
  const t = translations[currentLang];
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerText;

  // Show loading state
  submitBtn.disabled = true;
  submitBtn.innerText = currentLang === 'ar' ? 'جاري الإرسال...' : 'Sending...';

  const formData = new FormData(e.target);
  const orderData = {
    customer: Object.fromEntries(formData),
    items: cart.map(item => `${item.title} (${translations[currentLang].quantity} ${item.quantity})`).join(', '),
    total: cart.reduce((sum, item) => sum + (parseFloat(item.price) && parseFloat(item.price) > 0 ? parseFloat(item.price) : 0) * item.quantity, 0).toFixed(2),
    timestamp: new Date().toLocaleString()
  };

  const formDataToSubmit = new URLSearchParams();
  formDataToSubmit.append('name', orderData.customer.name);
  formDataToSubmit.append('phone', orderData.customer.phone);
  formDataToSubmit.append('address', orderData.customer.address);
  formDataToSubmit.append('items', orderData.items);
  formDataToSubmit.append('total', orderData.total);
  formDataToSubmit.append('timestamp', orderData.timestamp);

  try {
    if (ORDER_ENDPOINT !== 'REPLACE_WITH_YOUR_APPS_SCRIPT_URL') {
      // Using simple POST with URLSearchParams to avoid CORS preflight issues
      await fetch(ORDER_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formDataToSubmit.toString()
      });
    } else {
      console.warn('ORDER_ENDPOINT not set. Logging data instead:', orderData);
    }

    // Show success
    const content = document.getElementById('checkout-content');
    content.innerHTML = `
      <div class="order-success">
        <div class="success-icon">✓</div>
        <h3>${t.orderSuccess}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">
          ${currentLang === 'ar' ? 'تم تسجيل طلبك وإرسال إشعار بالبريد الإلكتروني.' : 'Your order has been recorded and an email notification has been sent.'}
        </p>
        <button class="btn-primary" onclick="window.closeCheckout(); location.reload();">${t.close}</button>
      </div>
      `;

    // Clear cart
    cart = [];
    saveCart();
    updateCartBadge();
  } catch (error) {
    console.error('Order Submission Error:', error);
    submitBtn.disabled = false;
    submitBtn.innerText = originalBtnText;
    alert(currentLang === 'ar' ? 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.' : 'Error sending order. Please try again.');
  }
};

window.closeCheckout = () => {
  document.getElementById('checkout-modal').style.display = 'none';
};

window.openModal = (index) => {
  const book = filteredBooks[index];
  const modal = document.getElementById('modal');
  const t = translations[currentLang];

  const modalContent = modal.querySelector('.modal-content');

  const isAvailable = book.availability === '1';
  const availabilityText = isAvailable
    ? (book.availabilityQuantity > 1 ? `${book.availabilityQuantity} ${t.inStock}` : t.inStock)
    : t.outOfAvailability;

  modalContent.innerHTML = `
    <div class="modal-simple-layout">
        <button class="modal-close" onclick="window.closeModal()">&times;</button>
        <h2 class="modal-title">${book.title}</h2>
        <div class="status-badge-container">
          <span class="status-badge ${isAvailable ? 'in-stock' : 'out-of-stock'}">
            ${availabilityText}
          </span>
        </div>

        <div class="modal-actions">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
             <div class="book-price modal-price-lg">
              ${book.price && !isNaN(parseFloat(book.price)) && parseFloat(book.price) > 0 ? `${book.price} ${t.pricePrefix}` : t.priceOnRequest}
             </div>
           </div>
           <button class="btn-primary" onclick="window.addToCartByTitle('${book.title.replace(/'/g, "\\'")}')">${t.addToCart}</button>
        </div>
    </div>
    `;

  // Hacky replacement above to reuse renderAddToCartButton logic but style it for modal. 
  // Ideally renderAddToCartButton should take context, but string replace works for now to swap class/content
  // Re-adjusting the replacement to be safer:
  const cartBtnHtml = renderAddToCartButton(book);
  if (!cartBtnHtml.includes('qty-controls')) {
    modalContent.querySelector('.modal-actions').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
      <div class="book-price modal-price-lg">
        ${book.price && !isNaN(parseFloat(book.price)) ? `${book.price} ${translations[currentLang].pricePrefix}` : t.priceOnRequest}
      </div>
    </div>
    <button class="btn-primary" onclick="window.addToCartByTitle('${book.title.replace(/'/g, "\\'")}')">${t.addToCart}</button>
    `;
  } else {
    // It shows controls, we just need to style them bigger
    const controlsDiv = modalContent.querySelector('.qty-controls');
    if (controlsDiv) {
      controlsDiv.classList.add('modal-qty-controls-override');
    }
  }

  modal.classList.add('open');
};

window.closeModal = () => {
  document.getElementById('modal').classList.remove('open');
};

function updateUIVisuals() {
  const t = translations[currentLang];

  // Update header and non-dynamic parts
  const logoAlt = document.querySelector('.site-logo');
  if (logoAlt) logoAlt.alt = t.title;

  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) heroTitle.innerText = t.title;

  const heroSubtitle = document.querySelector('.subtitle');
  if (heroSubtitle) heroSubtitle.innerText = t.subtitle;

  const searchInput = document.querySelector('.search-input');
  if (searchInput) searchInput.placeholder = t.searchPlaceholder;

  const drawerTitle = document.querySelector('.drawer-title');
  if (drawerTitle) drawerTitle.innerText = t.cart;

  const currLangLabel = document.querySelector('.curr-lang');
  if (currLangLabel) currLangLabel.innerText = currentLang.toUpperCase();

  // Highlight active lang in menu
  document.querySelectorAll('.lang-item').forEach(btn => {
    const isEn = btn.innerText.toLowerCase().includes('english') || btn.getAttribute('onclick').includes("'en'");
    const lang = isEn ? 'en' : 'ar';
    btn.classList.toggle('active', currentLang === lang);
  });

  // Re-render dynamic sections
  renderBestSellers();
  renderNewArrivals();
  renderCategories();
  renderBooks();

  // Update footer
  const footerContainer = document.querySelector('.site-footer');
  if (footerContainer) {
    footerContainer.outerHTML = renderFooter();
  }

  updateMetaTags(); // Update meta tags after UI visuals update
}

function initAppStructure() {
  const t = translations[currentLang];
  document.getElementById('app').innerHTML = `
      <header class="sticky-header">
        <div class="header-container">
          <div class="logo-container">
            <img src="/logo.png" alt="Logo" class="site-logo">
          </div>

          <div class="header-actions">


            <!-- Language Dropdown -->
            <div class="lang-dropdown-wrapper">
              <button class="lang-trigger" onclick="window.toggleLangDropdown()">
                <span class="curr-lang">${currentLang.toUpperCase()}</span>
                <svg class="dropdown-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1" /></svg>
              </button>
              <div id="lang-menu" class="lang-menu">
                <button class="lang-item ${currentLang === 'en' ? 'active' : ''}" onclick="window.setLanguage('en')">English</button>
                <button class="lang-item ${currentLang === 'ar' ? 'active' : ''}" onclick="window.setLanguage('ar')">العربية</button>
              </div>
            </div>

            <div class="cart-trigger icon-btn" onclick="window.toggleCart()">
              <span class="cart-icon">🛒</span>
              <span id="cart-badge" class="cart-badge" style="display: ${cart.length > 0 ? 'flex' : 'none'}">${cart.reduce((a, b) => a + b.quantity, 0)}</span>
            </div>
          </div>
        </div>
    </header>

    <div class="hero-section animated-hero">
      <div class="hero-content">
        <h1 class="hero-title animate-enter">${t.title}</h1>
        <p class="subtitle animate-enter-delay">${t.subtitle}</p>
      </div>
      <div class="hero-mesh"></div>
    </div>

    <div id="best-sellers-section" class="featured-section reveal"></div>
    <div id="new-arrivals-section" class="featured-section reveal"></div>

    <div class="filter-section reveal">
      <div class="search-container">
        <input type="text" class="search-input" placeholder="${t.searchPlaceholder}" oninput="window.handleSearch(event)">
        <span class="search-icon">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
      </div>
      
      <div id="categories" class="categories" style="display:none">
        <!-- Categories hidden as requested -->
      </div>
      <div id="sub-categories" class="categories sub-categories" style="display:none">
        <!-- Sub-categories hidden as requested -->
      </div>
    </div>
    
    <div id="result-count" class="result-count">
      ${t.loading}
    </div>

    <div id="book-grid" class="book-grid">
      <div class="loader"><div class="spinner"></div></div>
    </div>

    <div id="pagination" class="pagination"></div>

    <div id="footer-placeholder"></div>

    <div id="modal" class="modal-overlay" onclick="if(event.target === this) window.closeModal()">
      <div class="modal-content">
        <!-- Injected via openModal -->
      </div>
    </div>

    <div id="cart-drawer" class="cart-overlay" onclick="if(event.target === this) window.toggleCart()">
      <div class="cart-drawer">
        <div class="drawer-header">
           <h3 class="drawer-title">${t.cart}</h3>
           <button class="drawer-close" onclick="window.toggleCart()">&times;</button>
        </div>
        <div id="cart-content" class="drawer-content"></div>
        <div id="cart-footer" class="drawer-footer"></div>
      </div>
    </div>

    <div id="checkout-modal" class="modal-overlay" onclick="if(event.target === this) window.closeCheckout()">
      <div class="checkout-form">
         <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
           <h2 class="modal-title" style="margin-bottom:0">${t.checkout}</h2>
           <button class="modal-close" style="position:static" onclick="window.closeCheckout()">&times;</button>
         </div>
         <div id="checkout-content"></div>
      </div>
    </div>
    `;

  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    footerPlaceholder.outerHTML = renderFooter();
  }
}

function updateMetaTags() {
  const t = translations[currentLang];
  const currentUrl = window.location.href;
  const baseUrl = 'https://library-inventory-seven.vercel.app';

  // Update title based on current view
  let pageTitle = t.title;
  let pageDescription = t.subtitle;

  if (searchQuery) {
    pageTitle = `"${searchQuery}" - ${t.title}`;
    pageDescription = `نتائج البحث عن "${searchQuery}" في ${t.title}. ${t.subtitle}`;
  } else if (currentCategory && currentCategory !== t.all) {
    pageTitle = `${currentCategory} - ${t.title}`;
    pageDescription = `تصفح كتب ${currentCategory} في ${t.title}. ${t.subtitle}`;
  }

  // Update meta tags
  document.title = pageTitle;

  // Update description meta tag
  const descTag = document.querySelector('meta[name="description"]');
  if (descTag) {
    descTag.setAttribute('content', pageDescription);
  } else {
    // Create description meta tag if it doesn't exist
    const metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    metaDesc.setAttribute('content', pageDescription);
    document.head.appendChild(metaDesc);
  }

  // Update canonical URL
  const canonicalTag = document.querySelector('link[rel="canonical"]');
  if (canonicalTag) {
    canonicalTag.setAttribute('href', currentUrl);
  } else {
    // Create canonical tag if it doesn't exist
    const linkCanonical = document.createElement('link');
    linkCanonical.setAttribute('rel', 'canonical');
    linkCanonical.setAttribute('href', currentUrl);
    document.head.appendChild(linkCanonical);
  }

  // Update Open Graph tags
  const ogTitleTag = document.querySelector('meta[property="og:title"]');
  if (ogTitleTag) {
    ogTitleTag.setAttribute('content', pageTitle);
  }

  const ogDescTag = document.querySelector('meta[property="og:description"]');
  if (ogDescTag) {
    ogDescTag.setAttribute('content', pageDescription);
  }

  const ogUrlTag = document.querySelector('meta[property="og:url"]');
  if (ogUrlTag) {
    ogUrlTag.setAttribute('content', currentUrl);
  }
}

function renderUI() {
  initAppStructure();
  renderBestSellers();
  renderNewArrivals();
  renderCategories();
  renderBooks();
  initRevealObserver();
  updateMetaTags(); // Update meta tags after initial render
}

// Image fetching logic removed


function renderNewArrivals() {
  const container = document.getElementById('new-arrivals-section');
  const t = translations[currentLang];
  if (!container || books.length === 0) return;

  // Filter to only show available books
  const availableBooks = books.filter(book => book.availability === '1');
  const newArrivals = availableBooks.slice(-20).reverse();

  container.innerHTML = `
    <h2 class="section-title">${t.newItems}</h2>
    <div class="horizontal-scroll-container">
       <div class="horizontal-scroll">
        ${newArrivals.map((book, index) => renderBookCardSmall(book, books.indexOf(book))).join('')}
      </div>
     </div>
  `;
}

function renderBestSellers() {
  const container = document.getElementById('best-sellers-section');
  const t = translations[currentLang];
  if (!container || books.length === 0) return;

  // Filter to only show available books
  const availableBooks = books.filter(book => book.availability === '1');

  const bestSellers = [...availableBooks]
    .sort((a, b) => {
      const profitA = parseFloat(a.profit) || parseFloat(a.price) || 0;
      const profitB = parseFloat(b.profit) || parseFloat(b.price) || 0;
      return profitB - profitA;
    })
    .slice(0, 10);

  container.innerHTML = `
    <h2 class="section-title">${t.bestSellers}</h2>
    <div class="horizontal-scroll-container">
       <div class="horizontal-scroll">
        ${bestSellers.map((book, index) => renderBookCardSmall(book, books.indexOf(book))).join('')}
      </div>
     </div>
  `;
}

// --- Dynamic Interactions & Observer ---

window.scrollCarousel = (btn, direction) => {
  const container = btn.parentElement.querySelector('.horizontal-scroll');
  const scrollAmount = container.clientWidth * 0.8;
  container.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth'
  });
};

function initRevealObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Optional: stop observing after reveal
        // observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

function renderFooter() {
  const t = translations[currentLang];
  return `
      <footer class="site-footer reveal">
        <div class="footer-content">
          <div class="footer-brand">
            <h3>${t.title}</h3>
            <p>${t.subtitle}</p>
          </div>
          <div class="footer-links">
            <h4>${currentLang === 'ar' ? 'المتجر' : 'Shop'}</h4>
            <ul>
              <li><a href="#" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">${t.bestSellers}</a></li>
              <li><a href="#" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">${t.newItems}</a></li>
            </ul>
          </div>
          <div class="footer-links">
            <h4>${currentLang === 'ar' ? 'تواصل معنا' : 'Contact'}</h4>
            <ul>
              <li><a href="https://wa.me/962781543080" target="_blank">${currentLang === 'ar' ? 'واتساب' : 'WhatsApp'}</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          &copy; ${new Date().getFullYear()} ${t.title}. ${currentLang === 'ar' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
        </div>
      </footer>
    `;
}

function renderBookCardSmall(book, absoluteIndex) {
  const t = translations[currentLang];
  const isAvailable = book.availability === '1';
  const availabilityText = isAvailable
    ? (book.availabilityQuantity > 1 ? `${book.availabilityQuantity} ${t.inStock}` : t.inStock)
    : t.outOfAvailability;

  return `
    <div class="book-card small-card reveal" data-title="${book.title.replace(/"/g, '&quot;')}" onclick="window.openModal(${absoluteIndex})">
      <div class="book-img-container" style="height: 180px;">
        ${book.image ?
      `<img src="${book.image}" alt="${book.title}" class="book-img fade-in" loading="lazy">` :
      `<div class="placeholder-cover"><div class="cover-title" style="font-size:0.7rem;">${book.title}</div></div>`
    }
      </div>
      <div class="book-info small-info">
        <div class="status-badge-container">
          <span class="status-badge ${isAvailable ? 'in-stock' : 'out-of-stock'}">
            ${availabilityText}
          </span>
        </div>
        <div class="book-title small-title">${book.title}</div>
        <div class="card-actions">
          <div class="book-price" style="font-size:0.9rem;">${book.price && !isNaN(parseFloat(book.price)) && parseFloat(book.price) > 0 ? `${book.price} ${t.pricePrefix}` : t.priceOnRequest}</div>
          <div class="cart-action-wrapper" onclick="event.stopPropagation()">
            ${renderAddToCartButton(book)}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Initial Render Setup
document.documentElement.dir = translations[currentLang].dir;
document.documentElement.lang = currentLang;

// Initial template load
document.getElementById('app').innerHTML = `<div class="loader"><div class="spinner"></div></div>`;

fetchBooks();
