import './style.css'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o_KJTYojVnXI96dkOqIZrGtXTIuwn5bx0z1IBfrXTJ0/export?format=csv';
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
const ITEMS_PER_PAGE = 100;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', currentTheme);
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
    subtitle: 'Explore and manage our premium library collection. Real-time availability from our central database.',
    searchPlaceholder: 'Search by title, author, or category...',
    all: 'All',
    close: 'Close',
    quantity: 'x',
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
    subtitle: 'استكشف وإدارة مجموعتنا المكتبية المتميزة. توفر مباشر من قاعدة بياناتنا المركزية.',
    searchPlaceholder: 'ابحث حسب العنوان أو المؤلف أو التصنيف...',
    all: 'الكل',
    close: 'إغلاق',
    quantity: 'عدد',
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

function parseCSV(csv) {
  const lines = csv.split('\n');
  const result = [];
  const headers = lines[0].split(',');

  // Headers: Title,Cost,Price,Profit,Availability,Column 8,Author,Category,Overview
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const currentLine = parseCSVLine(lines[i]);
    if (currentLine.length < 2) continue;

    // "Column 8" is at index 5 in the CSV (0-based)
    const manualImageCol = currentLine[5];
    const isManualImage = manualImageCol && manualImageCol.startsWith('http');

    const book = {
      title: currentLine[0] || 'Unknown Title',
      cost: currentLine[1],
      price: currentLine[2],
      profit: currentLine[3],
      availability: currentLine[4],
      author: currentLine[6] || 'Unknown Author',
      category: formatCategory(currentLine[7], currentLine[0]),
      // Index 8 is now "Overview" based on recent CSV structure
      overview: currentLine[8] || null,
      manualImage: isManualImage ? manualImageCol : null,
      brief: currentLine[8] || `Experience the captivating story of "${currentLine[0]}" by ${currentLine[6] || 'Unknown Author'}. An essential addition to any library collection.`
    };

    // Logic to determine initial display state
    if (book.manualImage) {
      book.image = book.manualImage;
      book.isPlaceholder = false;
    } else {
      book.image = getPlaceholderImage(book.title, book.category);
      book.isPlaceholder = true; // Signals that we can try to auto-fetch
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
    container.innerHTML = `<div class="no-results" style="grid-column: 1 / -1; text-align:center; padding: 4rem; color: var(--text-muted); font-size: 1.2rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">${currentLang === 'ar' ? 'لم يتم العثور على نتائج' : 'No books found'}</div>`;
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
    const absoluteIndex = start + index;
    const fetchAttr = book.isPlaceholder
      ? `data-book-title="${book.title.replace(/"/g, '&quot;')}" data-book-author="${(book.author || '').replace(/"/g, '&quot;')}" data-book-index="${absoluteIndex}"`
      : '';

    const coverContent = book.isPlaceholder
      ? `<div class="placeholder-cover" style="--cover-bg: #${getCategoryColor(book.category)}">
           <div class="cover-title">${book.title}</div>
         </div>`
      : `<img src="${book.image}" alt="${book.title}" class="book-img" loading="lazy">`;

    return `
      <div class="book-card" onclick="window.openModal(${absoluteIndex})">
        <div class="book-img-container" ${fetchAttr}>
          ${book.availability === '1' ? `<span class="status-badge in-stock">${t.inStock}</span>` : `<span class="status-badge out-of-stock">${t.outOfAvailability}</span>`}
          ${coverContent}
        </div>
        <div class="book-info">
          <div class="book-category">${book.category}</div>
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
          <div class="card-actions">
            <div class="book-price">${book.price && !isNaN(parseFloat(book.price)) ? `${book.price}` : t.priceOnRequest}</div>
            <div class="cart-action-wrapper" onclick="event.stopPropagation()">
              ${renderAddToCartButton(book)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updatePagination(totalPages);
  initCoverLoader();
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
  processCategories(books);

  // Reset selection to All to avoid mismatches
  const allLabel = translations[currentLang].all;
  currentCategory = allLabel;
  currentSubCategory = null;

  renderUI(); // Re-render everything to update titles and directions
};

window.setPage = (page) => {
  currentPage = page;
  renderBooks();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.setCategory = (cat) => {
  currentCategory = cat;
  currentSubCategory = null; // Reset sub-category when parent changes
  filterBooks();
  renderCategories();
};

window.setSubCategory = (sub) => {
  currentSubCategory = sub;
  filterBooks();
  renderCategories(); // Re-render to update active state
};

window.handleSearch = (e) => {
  searchQuery = e.target.value.toLowerCase();
  currentPage = 1;
  filterBooks();
};

window.toggleTheme = () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
  // No need to re-render whole UI, just toggle classes potentially? 
  // For simplicity keeping renderUI but it might be jarring. 
  // Optimizing: Just update the button state if possible, but renderUI is safer for consistency.
  renderUI();
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
          matchesCategory = true;
        } else {
          matchesCategory = book.category === currentSubCategory;
        }
      }
    }

    const matchesSearch = book.title.toLowerCase().includes(searchQuery) ||
      book.author.toLowerCase().includes(searchQuery) ||
      (book.category || '').toLowerCase().includes(searchQuery);

    return matchesCategory && matchesSearch;
  });
  renderBooks();
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
        <span class="qty-val" style="color:white; font-weight:700;">${cartItem.quantity}</span>
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
  renderBooks();
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
  renderBooks();
  updateOpenModals(title);
};

function updateOpenModals(title) {
  // Update cart modal if open
  if (document.getElementById('cart-drawer').classList.contains('open')) {
    renderCartModal();
  }

  // Update main book modal if open and showing this book
  const modal = document.getElementById('modal');
  if (modal && modal.style.display === 'flex') {
    const book = books.find(b => b.title === title);
    const actionArea = document.querySelector('.modal-cart-action');
    if (actionArea && book) {
      actionArea.innerHTML = renderAddToCartButton(book);
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
    container.innerHTML = `<div style="text-align:center; padding: 4rem 1rem; color:var(--text-muted);">${t.emptyCart}</div>`;
    footer.innerHTML = '';
    return;
  }

  const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  container.innerHTML = `
    <div class="cart-items">
      ${cart.map(item => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.title}" class="cart-item-img" onerror="this.src='data:image/svg+xml;base64,...'"> 
          <div class="cart-item-info" style="flex:1;">
            <h4 class="cart-item-title" style="font-size:0.95rem; line-height:1.3;">${item.title}</h4>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0.5rem;">${item.price && !isNaN(parseFloat(item.price)) ? `$${parseFloat(item.price).toFixed(2)}` : t.priceOnRequest}</p>
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
        <span>$${total.toFixed(2)}</span>
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
          <input type="text" name="name" class="form-control" required placeholder="John Doe">
        </div>
        <div class="form-group">
          <label>${t.phoneNumber}</label>
          <input type="tel" name="phone" class="form-control" required placeholder="+1 234 567 890">
        </div>
        <div class="form-group">
          <label>${t.address}</label>
          <textarea name="address" class="form-control" required placeholder="123 Luxury Ave, City"></textarea>
        </div>
        
        <div style="background: var(--bg-body); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-weight:600;">
                <span>${t.total}:</span>
                <span>$${cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0).toFixed(2)}</span>
            </div>
        </div>

        <button type="submit" class="btn-primary submit-order-btn" style="width:100%; padding: 1rem;">${t.placeOrder}</button>
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
    total: cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0).toFixed(2),
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
        <p style="color: var(--text-muted); margin-bottom: 2rem;">
          ${currentLang === 'ar' ? 'تم تسجيل طلبك وإرسال إشعار بالبريد الإلكتروني.' : 'Your order has been recorded and an email notification has been sent.'}
        </p>
        <button class="primary-btn" onclick="window.closeCheckout(); location.reload();">${t.close}</button>
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

  const modalCover = book.isPlaceholder
    ? `<div class="placeholder-cover modal-placeholder" style="--cover-bg: #${getCategoryColor(book.category)}">
         <div class="cover-title">${book.title}</div>
       </div>`
    : `<img src="${book.image}" alt="${book.title}" class="modal-img-lg" id="modal-img">`;

  // We are using the new split layout
  const modalContent = modal.querySelector('.modal-content');

  modalContent.innerHTML = `
    <div class="modal-split-layout">
      <div class="modal-left">
         ${modalCover}
      </div>
      <div class="modal-right">
        <button class="modal-close" onclick="window.closeModal()">&times;</button>
        <div class="book-category">${book.category}</div>
        <h2 class="modal-title">${book.title}</h2>
        <div class="modal-meta">
          <span>${t.by} <strong style="color:white;">${book.author}</strong></span>
          ${book.availability === '1' ? `<span style="color:var(--success); font-weight:700;">${t.inStock}</span>` : `<span style="color:var(--error); font-weight:700;">${t.outOfAvailability}</span>`}
        </div>
        
        <div class="modal-desc">
          ${book.overview || t.briefTemplate(book.title, book.author)}
        </div>
        
        <div class="modal-actions">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
             <div class="book-price modal-price-lg">
              ${book.price && !isNaN(parseFloat(book.price)) ? `${book.price}` : t.priceOnRequest}
             </div>
           </div>
           ${renderAddToCartButton(book).replace('add-btn', 'btn-primary').replace('<span>+</span>', t.addToCart).replace('qty-controls', 'qty-controls modal-qty-controls')}
        </div>
      </div>
    </div>
  `;

  // Hacky replacement above to reuse renderAddToCartButton logic but style it for modal. 
  // Ideally renderAddToCartButton should take context, but string replace works for now to swap class/content
  // Re-adjusting the replacement to be safer:
  const cartBtnHtml = renderAddToCartButton(book);
  if (cartBtnHtml.includes('add-btn')) {
    // Start fresh for 'Add to Cart' big button
    modalContent.querySelector('.modal-actions').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
           <div class="book-price modal-price-lg">
            ${book.price && !isNaN(parseFloat(book.price)) ? `${book.price}` : t.priceOnRequest}
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

function renderUI() {
  const t = translations[currentLang];
  document.getElementById('app').innerHTML = `
    <header class="sticky-header">
      <div class="header-container">
        <div class="logo-container">
          <img src="/logo.png" alt="Logo" class="site-logo">
        </div>
        
        <div class="header-actions">
           <!-- Dynamic Theme Toggle -->
           <button class="icon-btn theme-btn-animated" onclick="window.toggleTheme()" aria-label="Toggle Theme">
             <span class="theme-icon-sun">☀️</span>
             <span class="theme-icon-moon">🌙</span>
           </button>

           <!-- Language Dropdown -->
           <div class="lang-dropdown-wrapper">
             <button class="lang-trigger" onclick="window.toggleLangDropdown()">
               <span class="curr-lang">${currentLang.toUpperCase()}</span>
               <svg class="dropdown-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1"/></svg>
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

    <div class="featured-wrapper">
      <div id="best-sellers-section" class="featured-section"></div>
      <div id="new-arrivals-section" class="featured-section"></div>
    </div>

    <div class="filter-section" style="margin-bottom: 2rem;">
      <div class="search-container">
        <input type="text" class="search-input" placeholder="${t.searchPlaceholder}" oninput="window.handleSearch(event)">
        <span class="search-icon">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
      </div>
      
      <div id="categories" class="categories">
        <!-- Categories will be injected here -->
      </div>
      <div id="sub-categories" class="categories sub-categories" style="display:none">
        <!-- Sub-categories injected here -->
      </div>
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
      <div class="modal-content checkout-modal">
        <div class="checkout-form">
           <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
             <h2>${t.checkout}</h2>
             <button class="modal-close" style="position:static" onclick="window.closeCheckout()">&times;</button>
           </div>
           <div id="checkout-content"></div>
        </div>
      </div>
    </div>
  `;

  renderBestSellers();
  renderNewArrivals();
  renderCategories();
  renderBooks();
  initCoverLoader();
}

// --- Google Books Auto-Fetch Logic ---
const imageCache = new Map(); // Cache URL to avoid re-fetching same book
let coverObserver = null;

function initCoverLoader() {
  // Disconnect previous observer if exists to avoid duplicates
  if (coverObserver) coverObserver.disconnect();

  const options = {
    root: null,
    rootMargin: '100px', // Fetch a bit before they appear
    threshold: 0.1
  };

  coverObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        const title = container.dataset.bookTitle;
        const author = container.dataset.bookAuthor;
        const index = container.dataset.bookIndex;

        if (title) { // Title is required
          fetchBookCover(title, author, container, index);
          observer.unobserve(container);
        }
      }
    });
  }, options);

  // Observe all containers that need fetching
  const containers = document.querySelectorAll('.book-img-container[data-book-title]');
  containers.forEach(el => coverObserver.observe(el));
}

async function fetchBookCover(title, author, containerElement, bookIndex) {
  // Construct a more specific query
  let query = `intitle:${title}`;
  if (author && author !== 'Unknown Author') {
    query += `+inauthor:${author}`;
  }

  const cacheKey = query;

  // Check RAM cache first
  if (imageCache.has(cacheKey)) {
    applyCoverImage(containerElement, imageCache.get(cacheKey), bookIndex);
    return;
  }

  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const info = data.items[0].volumeInfo;
      // Prefer high-res if available, but thumbnail is standard
      const imageLinks = info.imageLinks;

      if (imageLinks) {
        // Use standard thumbnail, force replace http with https
        let imgUrl = imageLinks.thumbnail || imageLinks.smallThumbnail;
        if (imgUrl) {
          imgUrl = imgUrl.replace('http://', 'https://');
          imageCache.set(cacheKey, imgUrl);
          applyCoverImage(containerElement, imgUrl, bookIndex);
        }
      }
    } else {
      // No result found, mark as processed
      containerElement.removeAttribute('data-book-title');
    }
  } catch (error) {
    console.warn('Failed to fetch cover for:', title, error);
  }
}

function applyCoverImage(container, url, index) {
  // Update the data model so modal opening works instantly later
  if (books[index]) {
    books[index].image = url;
    books[index].isPlaceholder = false;
  }

  // Update DOM using a fade-in effect
  const img = new Image();
  img.src = url;
  img.className = 'book-img fade-in';
  img.alt = books[index] ? books[index].title : 'Book Cover';

  img.onload = () => {
    container.innerHTML = ''; // Clear placeholder
    // Re-add status badge if it existed
    // Note: To keep it simple, we just re-render the inner content or prepend the badge.
    // However, since we cleared innerHTML, we lost the badge. Let's reconstruct or simpler:
    // Just replace the cover content.

    // Better strategy: Hide the placeholder div and append the image
    const placeholder = container.querySelector('.placeholder-cover');
    if (placeholder) placeholder.style.display = 'none';

    // Ensure badge stays
    const badge = container.querySelector('.status-badge');

    container.innerHTML = '';
    if (badge) container.appendChild(badge);
    container.appendChild(img);


    // Remove attribute
    container.removeAttribute('data-book-title');
  };
}

function renderNewArrivals() {
  const container = document.getElementById('new-arrivals-section');
  const t = translations[currentLang];
  if (!container || books.length === 0) return;

  // Last 10 records
  const newArrivals = books.slice(-5).reverse();

  container.innerHTML = `
    <h2 class="section-title">${t.newItems}</h2>
    <div class="horizontal-scroll">
      ${newArrivals.map((book, index) => renderBookCardSmall(book, books.indexOf(book))).join('')}
    </div>
  `;
}

function renderBestSellers() {
  const container = document.getElementById('best-sellers-section');
  const t = translations[currentLang];
  if (!container || books.length === 0) return;

  // Sort by profit (descending) as a proxy for "best sellers" or just "most valuable"
  // If profit is missing, fall back to price.
  const bestSellers = [...books]
    .sort((a, b) => {
      const profitA = parseFloat(a.profit) || parseFloat(a.price) || 0;
      const profitB = parseFloat(b.profit) || parseFloat(b.price) || 0;
      return profitB - profitA;
    })
    .slice(0, 3);

  container.innerHTML = `
    <h2 class="section-title">${t.bestSellers}</h2>
    <div class="horizontal-scroll">
      ${bestSellers.map((book, index) => renderBookCardSmall(book, books.indexOf(book))).join('')}
    </div>
  `;
}

function renderBookCardSmall(book, absoluteIndex) {
  const t = translations[currentLang];

  // Generate attributes for auto-fetching
  const fetchAttr = book.isPlaceholder
    ? `data-book-title="${book.title.replace(/"/g, '&quot;')}" data-book-author="${(book.author || '').replace(/"/g, '&quot;')}" data-book-index="${absoluteIndex}"`
    : '';

  const coverContent = book.isPlaceholder
    ? `<div class="placeholder-cover small-cover" style="--cover-bg: #${getCategoryColor(book.category)}">
         <div class="cover-title small-title">${book.title}</div>
       </div>`
    : `<img src="${book.image}" alt="${book.title}" class="book-img" loading="lazy">`;

  return `
    <div class="book-card small-card" onclick="window.openModal(${absoluteIndex})">
      <div class="book-img-container small-img-container" ${fetchAttr}>
        ${book.availability === '1' ? `<span class="status-badge in-stock">${t.inStock}</span>` : `<span class="status-badge out-of-stock">${t.outOfAvailability}</span>`}
        ${coverContent}
      </div>
      <div class="book-info small-info">
        <div class="book-category">${book.category}</div>
        <div class="book-title">${book.title}</div>
        <div class="card-actions">
          <div class="book-price">${book.price && !isNaN(parseFloat(book.price)) ? `$${parseFloat(book.price).toFixed(2)}` : t.priceOnRequest}</div>
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
