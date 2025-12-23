import './style.css'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o_KJTYojVnXI96dkOqIZrGtXTIuwn5bx0z1IBfrXTJ0/export?format=csv';
const ORDER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwQOHwQmOYCTg1D3FDRHp5zenrGH8BbnGfjV8nMgUpjyieAe4VphcvEEfvhHocqcgG9/exec';

let books = [];
let filteredBooks = [];
let categories = ['All'];
let currentCategory = 'All';
let searchQuery = '';
let currentLang = 'ar'; // Default to Arabic as per data
let currentPage = 1;
const ITEMS_PER_PAGE = 100;
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
          ${book.availability === '1' ? `<span class="status-badge in-stock">${t.inStock}</span>` : `<span class="status-badge out-of-stock">${t.outOfAvailability}</span>`}
          ${coverContent}
        </div>
        <div class="book-info">
          <div class="book-category">${book.category}</div>
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
          <div class="card-actions">
            <div class="book-price">${book.price && !isNaN(parseFloat(book.price)) ? `$${parseFloat(book.price).toFixed(2)}` : t.priceOnRequest}</div>
            <div class="cart-action-wrapper" onclick="event.stopPropagation()">
              ${renderAddToCartButton(book)}
            </div>
          </div>
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
        <span class="qty-val">${cartItem.quantity}</span>
        <button class="qty-btn" onclick="window.incrementQuantity('${book.title.replace(/'/g, "\\'")}')">+</button>
      </div>
    `;
  }
  return `
    <button class="add-to-cart-btn-sm" onclick="window.addToCartByTitle('${book.title.replace(/'/g, "\\'")}')">
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
  const modal = document.getElementById('cart-modal');
  if (modal.style.display !== 'flex') {
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
  if (document.getElementById('cart-modal').style.display === 'flex') {
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
  const modal = document.getElementById('cart-modal');
  if (modal.style.display === 'flex') {
    modal.style.display = 'none';
  } else {
    renderCartModal();
    modal.style.display = 'flex';
  }
};

function renderCartModal() {
  const container = document.getElementById('cart-content');
  const t = translations[currentLang];

  if (cart.length === 0) {
    container.innerHTML = `<div class="empty-cart-msg">${t.emptyCart}</div>`;
    return;
  }

  const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  container.innerHTML = `
    <div class="cart-items">
      ${cart.map(item => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.title}">
          <div class="cart-item-info">
            <h4>${item.title}</h4>
            <p>${item.price && !isNaN(parseFloat(item.price)) ? `$${parseFloat(item.price).toFixed(2)}` : t.priceOnRequest}</p>
          </div>
          <div class="qty-controls">
            <button class="qty-btn minus" onclick="window.decrementQuantity('${item.title.replace(/'/g, "\\'")}')">−</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="window.incrementQuantity('${item.title.replace(/'/g, "\\'")}')">+</button>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="cart-footer">
      <div class="cart-summary-row">
        <span>${t.items}:</span>
        <span>${totalItems}</span>
      </div>
      <div class="cart-total">
        <span>${t.total}:</span>
        <span>$${total.toFixed(2)}</span>
      </div>
      <button class="primary-btn checkout-btn" onclick="window.openCheckout()">${t.checkout}</button>
    </div>
  `;
}

window.openCheckout = () => {
  document.getElementById('cart-modal').style.display = 'none';
  const modal = document.getElementById('checkout-modal');
  const t = translations[currentLang];

  const content = document.getElementById('checkout-content');
  content.innerHTML = `
    <form id="checkout-form" onsubmit="window.handleOrder(event)">
      <div class="form-group">
        <label>${t.fullName}</label>
        <input type="text" name="name" required placeholder="John Doe">
      </div>
      <div class="form-group">
        <label>${t.phoneNumber}</label>
        <input type="tel" name="phone" required placeholder="+1 234 567 890">
      </div>
      <div class="form-group">
        <label>${t.address}</label>
        <textarea name="address" required placeholder="123 Luxury Ave, City"></textarea>
      </div>
      <button type="submit" class="primary-btn submit-order-btn">${t.placeOrder}</button>
    </form>
  `;
  modal.style.display = 'flex';
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
    <div style="margin-top: 2rem;" class="modal-cart-action">
      ${renderAddToCartButton(book)}
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
    <div class="header-actions">
      <div class="lang-switcher">
        <button class="${currentLang === 'en' ? 'active' : ''}" onclick="window.setLanguage('en')">EN</button>
        <button class="${currentLang === 'ar' ? 'active' : ''}" onclick="window.setLanguage('ar')">AR</button>
      </div>
      <div class="cart-trigger" onclick="window.toggleCart()">
        <span class="cart-icon">🛒</span>
        <span id="cart-badge" class="cart-badge" style="display: ${cart.length > 0 ? 'flex' : 'none'}">${cart.length}</span>
      </div>
    </div>
    <header>
      <div class="logo-container">
        <img src="/logo.png" alt="Logo" class="site-logo">
      </div>
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

    <div id="cart-modal" class="modal-overlay cart-overlay" onclick="if(event.target === this) window.toggleCart()">
      <div class="cart-sidebar">
        <div class="cart-header">
          <h3>${t.cart}</h3>
          <button class="close-cart" onclick="window.toggleCart()">&times;</button>
        </div>
        <div id="cart-content" class="cart-content-area"></div>
      </div>
    </div>

    <div id="checkout-modal" class="modal-overlay" onclick="if(event.target === this) window.closeCheckout()">
      <div class="modal-content checkout-modal-content">
        <div class="modal-details">
          <button class="modal-close" onclick="window.closeCheckout()">&times;</button>
          <h2>${t.checkout}</h2>
          <div id="checkout-content"></div>
        </div>
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
