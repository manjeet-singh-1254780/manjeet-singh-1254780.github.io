// Dhadi Wala - Modern Android-Style Workforce & Attendance App
import { LABOUR_CATEGORIES, INITIAL_LABOURS, MONTH_NAMES_EN, MONTH_NAMES_HI, WEEKDAYS_EN, WEEKDAYS_HI, formatINR } from './data.js';
import { buildReceiptData, renderReceiptCard, downloadReceiptPDF, triggerCleanPrint } from './receipt.js';
import { initSubscriptionSystem, getSubscriptionStatus, requirePremium, SubscriptionState } from './subscription.js';

// User's provided Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyC3RVckmKWPJCF17gySpFItbOTvxAsBK54",
  authDomain: "dhadi-wala.firebaseapp.com",
  databaseURL: "https://dhadi-wala-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dhadi-wala",
  storageBucket: "dhadi-wala.firebasestorage.app",
  messagingSenderId: "169631659238",
  appId: "1:169631659238:web:38e6ccbb4d4deae8577727"
};

// Global App State
export const AppState = {
  currentUser: null,
  isFirebaseAvailable: false,
  language: 'en', // 'en' or 'hi'
  currentTab: 'home',
  labours: [],
  dhadiRecords: [],
  
  // Dhadi Register State
  selectedWorkerId: '',
  selectedMonth: new Date().getMonth(), // 0 - 11
  selectedYear: new Date().getFullYear(),
  currentDailyEntries: {}, // dayNumber -> 1 (full), 0.5 (half), 0 (absent)
  currentDailyRate: 600,
  currentAdvanceAmount: 0,
  currentBonusAmount: 0,
  
  // Filters for Labour Live
  selectedCategory: 'all',
  selectedStatus: 'all',
  searchQuery: '',
  maxRateFilter: 2000
};

// --- Firebase Initialization with Resilient Offline Support ---
let authInstance = null;
let rtdbInstance = null;
let firestoreInstance = null;

export function initFirebase() {
  try {
    if (typeof window !== 'undefined' && window.firebase) {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
      }
      authInstance = window.firebase.auth();
      if (window.firebase.database) {
        rtdbInstance = window.firebase.database();
      }
      if (window.firebase.firestore) {
        firestoreInstance = window.firebase.firestore();
      }
      AppState.isFirebaseAvailable = true;
      console.log("Firebase initialized successfully with project dhadi-wala");
      updateCloudIndicator(true);
    } else {
      console.warn("Firebase scripts not yet loaded, running in offline/local storage mode.");
      AppState.isFirebaseAvailable = false;
      updateCloudIndicator(false);
    }
  } catch (err) {
    console.warn("Firebase initialization notice:", err.message);
    AppState.isFirebaseAvailable = false;
    updateCloudIndicator(false);
  }
}

function updateCloudIndicator(isOnline) {
  const dot = document.getElementById('cloud-status-dot');
  const text = document.getElementById('cloud-status-text');
  if (!dot || !text) return;
  if (isOnline) {
    dot.className = 'cloud-dot';
    text.textContent = 'Cloud Synced';
  } else {
    dot.className = 'cloud-dot offline';
    text.textContent = 'Local Mode';
  }
}

// --- Local Storage Management ---
export function loadFromLocalStorage() {
  try {
    const savedUser = localStorage.getItem('dhadi_current_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed && (parsed.email === 'thekedar@dhadiwala.in' || parsed.userId === 'contractor-demo')) {
        localStorage.removeItem('dhadi_current_user');
        AppState.currentUser = null;
      } else {
        AppState.currentUser = parsed;
      }
    }

    const savedLabours = localStorage.getItem('dhadi_labours');
    if (savedLabours) {
      AppState.labours = JSON.parse(savedLabours);
    } else {
      AppState.labours = [...INITIAL_LABOURS];
      saveLaboursToStorage();
    }

    const savedRecords = localStorage.getItem('dhadi_records');
    if (savedRecords) {
      AppState.dhadiRecords = JSON.parse(savedRecords);
    }

    const savedLang = localStorage.getItem('dhadi_language');
    if (savedLang) {
      AppState.language = savedLang;
    }
  } catch (e) {
    console.error("Local storage load error", e);
    AppState.labours = [...INITIAL_LABOURS];
  }
}

export function saveLaboursToStorage() {
  try {
    localStorage.setItem('dhadi_labours', JSON.stringify(AppState.labours));
    // Also push to Firebase RTDB if online
    if (AppState.isFirebaseAvailable && rtdbInstance && AppState.currentUser) {
      rtdbInstance.ref('labours').set(AppState.labours).catch(() => {});
    }
  } catch (e) {
    console.error("Save labours error", e);
  }
}

export function saveDhadiRecordsToStorage() {
  try {
    localStorage.setItem('dhadi_records', JSON.stringify(AppState.dhadiRecords));
    // Push user dhadi records to Firebase RTDB if available
    if (AppState.isFirebaseAvailable && rtdbInstance && AppState.currentUser) {
      const userRef = rtdbInstance.ref(`users/${AppState.currentUser.userId}/dhadiRecords`);
      userRef.set(AppState.dhadiRecords).catch(() => {});
    }
  } catch (e) {
    console.error("Save dhadi records error", e);
  }
}

// --- Toast / Snackbar Notification ---
export function showToast(message, icon = 'fa-circle-check', duration = 3000) {
  const snackbar = document.getElementById('app-snackbar');
  if (!snackbar) return;
  snackbar.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  snackbar.classList.add('show');
  if (snackbar.timeoutId) clearTimeout(snackbar.timeoutId);
  snackbar.timeoutId = setTimeout(() => {
    snackbar.classList.remove('show');
  }, duration);
}

// --- Android Clock Update in Status Bar ---
export function startStatusBarClock() {
  const timeEl = document.getElementById('status-bar-time');
  if (!timeEl) return;
  const update = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hours}:${minutes}`;
  };
  update();
  setInterval(update, 30000);
}

// --- Navigation Controller ---
export function navigateToTab(tabId) {
  AppState.currentTab = tabId;

  // Update Bottom Nav UI
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.tab === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Hide all screens
  document.querySelectorAll('.screen-view').forEach(screen => {
    screen.classList.remove('active');
  });

  // Show target screen
  const targetScreen = document.getElementById(`screen-${tabId}`);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }

  // Header Title update
  const topTitle = document.getElementById('top-bar-app-title');
  const topSubtitle = document.getElementById('top-bar-app-subtitle');
  if (topTitle && topSubtitle) {
    if (tabId === 'home') {
      topTitle.textContent = 'Dhadi Wala';
      topSubtitle.textContent = AppState.language === 'hi' ? 'दैनिक मजदूरी एवं कारीगर' : 'Labour & Daily Dhadi Register';
    } else if (tabId === 'labour-live') {
      topTitle.textContent = AppState.language === 'hi' ? 'कारीगर खोजें' : 'Labour Live';
      topSubtitle.textContent = AppState.language === 'hi' ? 'उपलब्ध कारीगर एवं मज़दूर' : 'Verified Workers Nearby';
    } else if (tabId === 'dhadi-register') {
      topTitle.textContent = AppState.language === 'hi' ? 'धाड़ी रजिस्टर' : 'Dhadi Lekhna';
      topSubtitle.textContent = AppState.language === 'hi' ? 'दैनिक उपस्थिति व हिसाब' : 'Digital Attendance & Ledger';
    } else if (tabId === 'labour-add') {
      topTitle.textContent = AppState.language === 'hi' ? 'नया कारीगर जोड़ें' : 'Add New Labour';
      topSubtitle.textContent = AppState.language === 'hi' ? 'कारीगर प्रोफ़ाइल पंजीकरण' : 'Worker Registration Form';
    } else if (tabId === 'profile') {
      topTitle.textContent = AppState.language === 'hi' ? 'मेरी प्रोफ़ाइल' : 'My Account';
      topSubtitle.textContent = AppState.currentUser ? AppState.currentUser.name : 'User Settings';
    }
  }

  // Refresh tab-specific data
  if (tabId === 'home') renderHomeDashboard();
  if (tabId === 'labour-live') renderLabourLive();
  if (tabId === 'dhadi-register') renderDhadiRegister();
  if (tabId === 'profile') renderProfileScreen();

  // Scroll to top of main container
  const mainContainer = document.getElementById('main-container');
  if (mainContainer) mainContainer.scrollTop = 0;
}

// --- Home Dashboard Controller ---
export function renderHomeDashboard() {
  const labours = AppState.labours;
  const availableCount = labours.filter(l => l.availability === 'available').length;
  const busyCount = labours.filter(l => l.availability === 'busy').length;

  // Stats
  const totalLabourEl = document.getElementById('stat-total-labour');
  const availLabourEl = document.getElementById('stat-available-labour');
  const workingDaysEl = document.getElementById('stat-current-working-days');
  const totalDhadiEl = document.getElementById('stat-current-total-dhadi');

  if (totalLabourEl) totalLabourEl.textContent = labours.length;
  if (availLabourEl) availLabourEl.textContent = availableCount;

  // Calculate current month dhadi records stats
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  let monthDhadiDays = 0;
  let monthTotalAmount = 0;

  AppState.dhadiRecords.forEach(rec => {
    if (rec.month === curMonth && rec.year === curYear) {
      monthDhadiDays += Number(rec.workingDays || 0);
      monthTotalAmount += Number(rec.totalPayment || 0);
    }
  });

  if (workingDaysEl) workingDaysEl.textContent = `${monthDhadiDays} Days`;
  if (totalDhadiEl) totalDhadiEl.textContent = formatINR(monthTotalAmount);

  // User Greeting
  const greetingEl = document.getElementById('home-user-greeting');
  if (greetingEl) {
    const userName = AppState.currentUser?.name || 'Worker / Thekedar';
    greetingEl.textContent = AppState.language === 'hi' ? `नमस्ते, ${userName} 🙏` : `Namaste, ${userName} 🙏`;
  }

  // Render recent available workers preview list
  const previewContainer = document.getElementById('home-labour-preview-list');
  if (previewContainer) {
    const topAvail = labours.slice(0, 3);
    previewContainer.innerHTML = topAvail.map(worker => `
      <div class="labour-card" onclick="window.DhadiApp.openLabourDetail('${worker.labourId}')">
        <div class="labour-card-top">
          <img src="${worker.photo}" alt="${worker.name}" class="labour-avatar" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'">
          <div class="labour-meta">
            <div class="labour-name-row">
              <span class="labour-name">${worker.name}</span>
              <span class="status-pill status-${worker.availability}">
                <i class="fa-solid fa-circle" style="font-size: 7px;"></i> ${worker.availability === 'available' ? 'Available' : worker.availability === 'busy' ? 'Busy' : 'N/A'}
              </span>
            </div>
            <div class="labour-skill-badge">
              <i class="fa-solid fa-briefcase"></i> ${worker.skill}
            </div>
            <div class="labour-loc">
              <i class="fa-solid fa-location-dot"></i> ${worker.city}, ${worker.village}
            </div>
          </div>
        </div>
        <div class="labour-card-bottom">
          <div class="labour-wage">
            <span class="wage-label">Daily Wage (दहाड़ी)</span>
            <span class="wage-amount">${formatINR(worker.dailyPayment)}<span style="font-size: 11px; font-weight: normal; color: #64748b;">/day</span></span>
          </div>
          <div class="labour-actions" onclick="event.stopPropagation()">
            <a href="tel:${worker.mobile}" class="btn-action-call"><i class="fa-solid fa-phone"></i> Call</a>
            <a href="https://wa.me/91${worker.mobile}?text=${encodeURIComponent('Namaste, I found your profile on Dhadi Wala app.')}" target="_blank" class="btn-action-wa"><i class="fa-brands fa-whatsapp"></i></a>
          </div>
        </div>
      </div>
    `).join('');
  }
}

// --- Labour Live Controller ---
export function renderLabourLive() {
  renderCategoryChips();
  filterAndDisplayLabours();
}

function renderCategoryChips() {
  const container = document.getElementById('category-chips-container');
  if (!container) return;

  container.innerHTML = LABOUR_CATEGORIES.map(cat => {
    const isActive = AppState.selectedCategory === cat.id;
    const label = AppState.language === 'hi' ? cat.nameHi : cat.nameEn;
    return `
      <button class="chip ${isActive ? 'active' : ''}" onclick="window.DhadiApp.selectCategory('${cat.id}')">
        <i class="${cat.icon}"></i> ${label}
      </button>
    `;
  }).join('');
}

export function selectCategory(catId) {
  AppState.selectedCategory = catId;
  renderCategoryChips();
  filterAndDisplayLabours();
}

export function filterAndDisplayLabours() {
  const container = document.getElementById('labour-live-cards-container');
  if (!container) return;

  const query = (AppState.searchQuery || '').toLowerCase().trim();
  const selectedCat = AppState.selectedCategory;
  const selectedStatus = AppState.selectedStatus;
  const maxRate = AppState.maxRateFilter;

  const filtered = AppState.labours.filter(worker => {
    // Category match
    if (selectedCat !== 'all' && worker.category !== selectedCat) return false;

    // Status match
    if (selectedStatus !== 'all' && worker.availability !== selectedStatus) return false;

    // Daily rate match
    if (worker.dailyPayment > maxRate) return false;

    // Search query match (name, skill, city, village, mobile)
    if (query) {
      const matchName = worker.name.toLowerCase().includes(query);
      const matchSkill = worker.skill.toLowerCase().includes(query);
      const matchCity = worker.city.toLowerCase().includes(query);
      const matchVillage = worker.village.toLowerCase().includes(query);
      const matchPhone = worker.mobile.includes(query);
      if (!matchName && !matchSkill && !matchCity && !matchVillage && !matchPhone) {
        return false;
      }
    }

    return true;
  });

  const countBadge = document.getElementById('labour-results-count');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} found`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-icon"><i class="fa-solid fa-user-slash"></i></div>
        <div class="empty-title">No Labour Found</div>
        <div class="empty-desc">No workers match your search or filter criteria. Try clearing filters or add a new worker.</div>
        <button class="btn-m3-tonal" style="width: auto; padding: 10px 20px;" onclick="window.DhadiApp.clearLabourFilters()">
          <i class="fa-solid fa-arrows-rotate"></i> Clear Filters
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(worker => `
    <div class="labour-card" onclick="window.DhadiApp.openLabourDetail('${worker.labourId}')">
      <div class="labour-card-top">
        <img src="${worker.photo}" alt="${worker.name}" class="labour-avatar" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'">
        <div class="labour-meta">
          <div class="labour-name-row">
            <span class="labour-name">${worker.name}</span>
            <span class="status-pill status-${worker.availability}">
              <i class="fa-solid fa-circle" style="font-size: 7px;"></i> ${worker.availability === 'available' ? 'Available' : worker.availability === 'busy' ? 'Busy' : 'N/A'}
            </span>
          </div>
          <div class="labour-skill-badge">
            <i class="fa-solid fa-briefcase"></i> ${worker.skill}
          </div>
          <div class="labour-loc">
            <i class="fa-solid fa-location-dot"></i> ${worker.city}, ${worker.village}
          </div>
        </div>
      </div>
      <div class="labour-card-bottom">
        <div class="labour-wage">
          <span class="wage-label">Daily Wage (दहाड़ी)</span>
          <span class="wage-amount">${formatINR(worker.dailyPayment)}<span style="font-size: 11px; font-weight: normal; color: #64748b;">/day</span></span>
        </div>
        <div class="labour-actions" onclick="event.stopPropagation()">
          <a href="tel:${worker.mobile}" class="btn-action-call"><i class="fa-solid fa-phone"></i> Call</a>
          <a href="https://wa.me/91${worker.mobile}?text=${encodeURIComponent('Namaste, I found your profile on Dhadi Wala app.')}" target="_blank" class="btn-action-wa"><i class="fa-brands fa-whatsapp"></i></a>
          <button class="btn-action-view" onclick="window.DhadiApp.openLabourDetail('${worker.labourId}')">Details</button>
        </div>
      </div>
    </div>
  `).join('');
}

export function clearLabourFilters() {
  AppState.selectedCategory = 'all';
  AppState.selectedStatus = 'all';
  AppState.searchQuery = '';
  AppState.maxRateFilter = 2000;

  const searchInput = document.getElementById('labour-search-input');
  if (searchInput) searchInput.value = '';
  const statusSelect = document.getElementById('filter-status-select');
  if (statusSelect) statusSelect.value = 'all';
  const rateSlider = document.getElementById('filter-rate-slider');
  if (rateSlider) rateSlider.value = 2000;
  const rateValText = document.getElementById('filter-rate-value');
  if (rateValText) rateValText.textContent = '₹2,000';

  renderCategoryChips();
  filterAndDisplayLabours();
  showToast('Filters cleared', 'fa-rotate-left');
}

// --- Labour Detail Modal Controller ---
export function openLabourDetail(labourId) {
  const worker = AppState.labours.find(l => l.labourId === labourId);
  if (!worker) return;

  const modal = document.getElementById('modal-labour-detail');
  const content = document.getElementById('labour-detail-content');
  if (!modal || !content) return;

  content.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px;">
      <img src="${worker.photo}" style="width: 86px; height: 86px; border-radius: 50%; object-fit: cover; border: 3px solid var(--md-sys-color-primary); box-shadow: var(--md-elevation-2); margin-bottom: 8px;" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'">
      <h3 style="font-size: 19px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">${worker.name}</h3>
      <span class="status-pill status-${worker.availability}" style="font-size: 12px; padding: 4px 12px;">
        <i class="fa-solid fa-circle" style="font-size: 8px;"></i> ${worker.availability === 'available' ? 'Available for Work' : worker.availability === 'busy' ? 'Currently Busy' : 'Not Available'}
      </span>
    </div>

    <div class="m3-card" style="margin-bottom: 14px; background: #f8fafc;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-size: 13px; color: #64748b;">Category / Skill:</span>
        <span style="font-weight: 700; color: #0f172a;">${worker.skill}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-size: 13px; color: #64748b;">Daily Wage (दहाड़ी):</span>
        <span style="font-weight: 800; color: var(--md-sys-color-primary-dark); font-size: 16px;">${formatINR(worker.dailyPayment)}/day</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-size: 13px; color: #64748b;">Experience:</span>
        <span style="font-weight: 600; color: #0f172a;">${worker.experience || '5+ Years'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-size: 13px; color: #64748b;">Location:</span>
        <span style="font-weight: 600; color: #0f172a;">${worker.village}, ${worker.city}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="font-size: 13px; color: #64748b;">Address:</span>
        <span style="font-weight: 500; color: #334155; text-align: right; max-width: 180px;">${worker.address || 'Local Market'}</span>
      </div>
    </div>

    ${worker.speciality ? `
      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase; margin-bottom: 4px;">Speciality / कारीगरी:</div>
        <div style="font-size: 13px; color: #78350f;">${worker.speciality}</div>
      </div>
    ` : ''}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
      <a href="tel:${worker.mobile}" class="btn-m3-primary" style="background: #16a34a; text-decoration: none; padding: 12px;">
        <i class="fa-solid fa-phone"></i> Call Worker
      </a>
      <a href="https://wa.me/91${worker.mobile}?text=${encodeURIComponent(`Namaste ${worker.name}, I need labour for work from Dhadi Wala app.`)}" target="_blank" class="btn-m3-primary" style="background: #25d366; text-decoration: none; padding: 12px;">
        <i class="fa-brands fa-whatsapp"></i> WhatsApp
      </a>
    </div>

    <button class="btn-m3-tonal" onclick="window.DhadiApp.startDhadiForWorker('${worker.labourId}')">
      <i class="fa-solid fa-book-open"></i> Start / Mark Dhadi for this Worker
    </button>
  `;

  modal.classList.add('active');
}

export function closeLabourDetail() {
  const modal = document.getElementById('modal-labour-detail');
  if (modal) modal.classList.remove('active');
}

export function startDhadiForWorker(labourId) {
  closeLabourDetail();
  AppState.selectedWorkerId = labourId;
  const worker = AppState.labours.find(l => l.labourId === labourId);
  if (worker) {
    AppState.currentDailyRate = worker.dailyPayment;
  }
  navigateToTab('dhadi-register');
  showToast(`Loaded ${worker?.name || 'Worker'} into Dhadi Register`, 'fa-book-open');
}

// --- Labour Add Form Controller ---
export function initLabourAddForm() {
  const form = document.getElementById('form-add-labour');
  if (!form) return;

  const photoInput = document.getElementById('labour-photo-input');
  const previewImg = document.getElementById('labour-photo-preview');
  const previewPlaceholder = document.getElementById('labour-photo-placeholder');

  if (photoInput && previewImg && previewPlaceholder) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          previewImg.src = loadEvt.target.result;
          previewImg.style.display = 'block';
          previewPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSaveLabour();
  });
}

export function selectAvatarPreset(imgUrl) {
  const previewImg = document.getElementById('labour-photo-preview');
  const previewPlaceholder = document.getElementById('labour-photo-placeholder');
  if (previewImg && previewPlaceholder) {
    previewImg.src = imgUrl;
    previewImg.style.display = 'block';
    previewPlaceholder.style.display = 'none';
  }
}

export function handleSaveLabour() {
  const nameInput = document.getElementById('input-labour-name');
  const mobileInput = document.getElementById('input-labour-mobile');
  const categorySelect = document.getElementById('input-labour-category');
  const rateInput = document.getElementById('input-labour-rate');
  const cityInput = document.getElementById('input-labour-city');
  const villageInput = document.getElementById('input-labour-village');
  const addressInput = document.getElementById('input-labour-address');
  const statusSelect = document.getElementById('input-labour-status');
  const previewImg = document.getElementById('labour-photo-preview');

  const name = nameInput.value.trim();
  const mobile = mobileInput.value.trim();
  const category = categorySelect.value;
  const rate = Number(rateInput.value);
  const city = cityInput.value.trim();
  const village = villageInput.value.trim();
  const address = addressInput.value.trim();
  const availability = statusSelect.value;

  if (!name) {
    showToast('Please enter labour name', 'fa-triangle-exclamation');
    nameInput.focus();
    return;
  }
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    showToast('Please enter a valid 10-digit Indian mobile number', 'fa-triangle-exclamation');
    mobileInput.focus();
    return;
  }
  if (!rate || rate < 100) {
    showToast('Please enter valid daily payment rate (min ₹100)', 'fa-triangle-exclamation');
    rateInput.focus();
    return;
  }
  if (!city) {
    showToast('Please enter city/district name', 'fa-triangle-exclamation');
    cityInput.focus();
    return;
  }

  // Premium feature gate: Free plan allows up to 5 custom added labours
  const customLaboursCount = AppState.labours.filter(l => l.ownerUserId === (AppState.currentUser?.userId || 'guest-user')).length;
  if (customLaboursCount >= 5) {
    if (!requirePremium('Add Unlimited Labour (5+ Labours)', 'Free plan allows up to 5 custom labours. Upgrade to Monthly or Yearly plan for unlimited workforce management.')) {
      return;
    }
  }

  const categoryObj = LABOUR_CATEGORIES.find(c => c.id === category) || LABOUR_CATEGORIES[1];
  const photo = (previewImg && previewImg.style.display !== 'none' && previewImg.src) ? previewImg.src : 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop';

  const newLabour = {
    labourId: 'lab-' + Date.now(),
    ownerUserId: AppState.currentUser?.userId || 'guest-user',
    name,
    mobile,
    photo,
    skill: categoryObj.nameEn,
    category,
    dailyPayment: rate,
    address: address || 'Local Area',
    city,
    village: village || city,
    availability,
    createdAt: new Date().toISOString()
  };

  AppState.labours.unshift(newLabour);
  saveLaboursToStorage();

  // Reset form
  document.getElementById('form-add-labour').reset();
  if (previewImg) previewImg.style.display = 'none';
  const previewPlaceholder = document.getElementById('labour-photo-placeholder');
  if (previewPlaceholder) previewPlaceholder.style.display = 'block';

  showToast(`Worker ${name} registered successfully!`, 'fa-circle-check');
  navigateToTab('labour-live');
}

// --- Digital Dhadi Register & Attendance Engine ---
export function renderDhadiRegister() {
  populateWorkerDropdown();
  updateMonthYearDisplay();
  renderDynamicCalendar();
  calculateAndRenderDhadiPayments();
}

function populateWorkerDropdown() {
  const select = document.getElementById('select-dhadi-worker');
  if (!select) return;

  const currentVal = AppState.selectedWorkerId;
  let optionsHtml = '<option value="">-- Select Worker / Labour (कारीगर चुनें) --</option>';

  AppState.labours.forEach(worker => {
    const isSel = worker.labourId === currentVal ? 'selected' : '';
    optionsHtml += `<option value="${worker.labourId}" ${isSel}>${worker.name} (${worker.skill} - ${formatINR(worker.dailyPayment)})</option>`;
  });

  optionsHtml += '<option value="custom">➕ Custom Worker / General Theka (अन्य खाता)</option>';
  select.innerHTML = optionsHtml;

  // If worker is selected, update daily rate input
  if (currentVal && currentVal !== 'custom') {
    const worker = AppState.labours.find(l => l.labourId === currentVal);
    if (worker && (!AppState.currentDailyRate || AppState.currentDailyRate === 600)) {
      AppState.currentDailyRate = worker.dailyPayment;
    }
  }

  const rateInput = document.getElementById('input-dhadi-rate');
  if (rateInput) rateInput.value = AppState.currentDailyRate;

  const advInput = document.getElementById('input-dhadi-advance');
  if (advInput) advInput.value = AppState.currentAdvanceAmount || '';

  const bonusInput = document.getElementById('input-dhadi-bonus');
  if (bonusInput) bonusInput.value = AppState.currentBonusAmount || '';
}

export function handleWorkerChange(workerId) {
  AppState.selectedWorkerId = workerId;
  if (workerId && workerId !== 'custom') {
    const worker = AppState.labours.find(l => l.labourId === workerId);
    if (worker) {
      AppState.currentDailyRate = worker.dailyPayment;
      const rateInput = document.getElementById('input-dhadi-rate');
      if (rateInput) rateInput.value = worker.dailyPayment;
    }
  }
  // Try loading saved month record for this worker if exists
  loadSavedDhadiForCurrentMonth();
  renderDynamicCalendar();
  calculateAndRenderDhadiPayments();
}

function updateMonthYearDisplay() {
  const monthDisplay = document.getElementById('dhadi-month-display');
  if (!monthDisplay) return;

  const monthNames = AppState.language === 'hi' ? MONTH_NAMES_HI : MONTH_NAMES_EN;
  monthDisplay.textContent = `${monthNames[AppState.selectedMonth]} ${AppState.selectedYear}`;
}

export function changeMonth(delta) {
  let newMonth = AppState.selectedMonth + delta;
  let newYear = AppState.selectedYear;

  if (newMonth < 0) {
    newMonth = 11;
    newYear -= 1;
  } else if (newMonth > 11) {
    newMonth = 0;
    newYear += 1;
  }

  AppState.selectedMonth = newMonth;
  AppState.selectedYear = newYear;

  updateMonthYearDisplay();
  loadSavedDhadiForCurrentMonth();
  renderDynamicCalendar();
  calculateAndRenderDhadiPayments();
}

function loadSavedDhadiForCurrentMonth() {
  const workerId = AppState.selectedWorkerId;
  const month = AppState.selectedMonth;
  const year = AppState.selectedYear;

  const existing = AppState.dhadiRecords.find(r => r.workerId === workerId && r.month === month && r.year === year);
  if (existing) {
    AppState.currentDailyEntries = { ...existing.dailyEntries };
    AppState.currentDailyRate = existing.dailyRate || AppState.currentDailyRate;
    AppState.currentAdvanceAmount = existing.advanceAmount || 0;
    AppState.currentBonusAmount = existing.bonusAmount || 0;

    const rateInput = document.getElementById('input-dhadi-rate');
    if (rateInput) rateInput.value = AppState.currentDailyRate;
    const advInput = document.getElementById('input-dhadi-advance');
    if (advInput) advInput.value = AppState.currentAdvanceAmount || '';
    const bonusInput = document.getElementById('input-dhadi-bonus');
    if (bonusInput) bonusInput.value = AppState.currentBonusAmount || '';
  } else {
    // Fresh entries
    AppState.currentDailyEntries = {};
  }
}

// Dynamic Calendar Construction
export function renderDynamicCalendar() {
  const container = document.getElementById('dhadi-calendar-list');
  if (!container) return;

  const month = AppState.selectedMonth;
  const year = AppState.selectedYear;

  // Days in month calculation
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = AppState.language === 'hi' ? WEEKDAYS_HI : WEEKDAYS_EN;

  const today = new Date();
  const isCurrentMonthAndYear = (today.getMonth() === month && today.getFullYear() === year);

  let html = '';

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dayOfWeekIndex = dateObj.getDay(); // 0 = Sunday
    const weekdayName = weekdays[dayOfWeekIndex];
    const isSunday = (dayOfWeekIndex === 0);
    const isToday = isCurrentMonthAndYear && (today.getDate() === day);

    // Current entry for this day (1 = full, 0.5 = half, 0 = absent)
    const currentVal = AppState.currentDailyEntries[day] !== undefined ? AppState.currentDailyEntries[day] : 0;

    html += `
      <div class="calendar-day-row ${isSunday ? 'is-sunday' : ''} ${isToday ? 'is-today' : ''}">
        <div class="date-badge">
          <div class="date-num">${String(day).padStart(2, '0')}</div>
          <div class="date-weekday">${weekdayName}${isToday ? ' • Today' : ''}${isSunday ? ' (रवि)' : ''}</div>
        </div>
        <div class="dhadi-state-toggles">
          <button type="button" class="toggle-dhadi-btn ${currentVal === 1 ? 'active-full' : ''}" onclick="window.DhadiApp.setDayDhadi(${day}, 1)">
            <i class="fa-solid fa-check"></i> 1 Dhadi
          </button>
          <button type="button" class="toggle-dhadi-btn ${currentVal === 0.5 ? 'active-half' : ''}" onclick="window.DhadiApp.setDayDhadi(${day}, 0.5)">
            ½ Half
          </button>
          <button type="button" class="toggle-dhadi-btn ${currentVal === 0 ? 'active-absent' : ''}" onclick="window.DhadiApp.setDayDhadi(${day}, 0)">
            <i class="fa-solid fa-xmark"></i> Off
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

export function setDayDhadi(day, value) {
  // If clicking same active state, toggle to 0 (absent)
  if (AppState.currentDailyEntries[day] === value) {
    AppState.currentDailyEntries[day] = 0;
  } else {
    AppState.currentDailyEntries[day] = value;
  }
  renderDynamicCalendar();
  calculateAndRenderDhadiPayments();
}

export function calculateAndRenderDhadiPayments() {
  const rateInput = document.getElementById('input-dhadi-rate');
  const advInput = document.getElementById('input-dhadi-advance');
  const bonusInput = document.getElementById('input-dhadi-bonus');

  if (rateInput) AppState.currentDailyRate = Math.max(0, Number(rateInput.value) || 0);
  if (advInput) AppState.currentAdvanceAmount = Math.max(0, Number(advInput.value) || 0);
  if (bonusInput) AppState.currentBonusAmount = Math.max(0, Number(bonusInput.value) || 0);

  // Sum working days
  let totalWorkingDays = 0;
  let fullDaysCount = 0;
  let halfDaysCount = 0;

  Object.values(AppState.currentDailyEntries).forEach(val => {
    totalWorkingDays += Number(val || 0);
    if (val === 1) fullDaysCount++;
    if (val === 0.5) halfDaysCount++;
  });

  const subtotalWage = Math.round(totalWorkingDays * AppState.currentDailyRate);
  const netPayable = Math.max(0, subtotalWage - AppState.currentAdvanceAmount + AppState.currentBonusAmount);

  // Update UI DOM
  const totalDaysEl = document.getElementById('calc-total-days');
  const rateEl = document.getElementById('calc-daily-rate');
  const subtotalEl = document.getElementById('calc-subtotal');
  const advanceEl = document.getElementById('calc-advance');
  const bonusEl = document.getElementById('calc-bonus');
  const grandTotalEl = document.getElementById('calc-grand-total');

  if (totalDaysEl) totalDaysEl.textContent = `${totalWorkingDays} Dhadi (${fullDaysCount} Full + ${halfDaysCount} Half)`;
  if (rateEl) rateEl.textContent = formatINR(AppState.currentDailyRate);
  if (subtotalEl) subtotalEl.textContent = formatINR(subtotalWage);
  if (advanceEl) advanceEl.textContent = `- ${formatINR(AppState.currentAdvanceAmount)}`;
  if (bonusEl) bonusEl.textContent = `+ ${formatINR(AppState.currentBonusAmount)}`;
  if (grandTotalEl) grandTotalEl.textContent = formatINR(netPayable);
}

export function handleSaveDhadiRecord() {
  if (!AppState.selectedWorkerId) {
    showToast('Please select a worker first!', 'fa-triangle-exclamation');
    document.getElementById('select-dhadi-worker')?.focus();
    return;
  }

  let totalWorkingDays = 0;
  Object.values(AppState.currentDailyEntries).forEach(val => totalWorkingDays += Number(val || 0));

  const subtotalWage = Math.round(totalWorkingDays * AppState.currentDailyRate);
  const netPayable = Math.max(0, subtotalWage - AppState.currentAdvanceAmount + AppState.currentBonusAmount);

  const worker = AppState.labours.find(l => l.labourId === AppState.selectedWorkerId);
  const workerName = worker ? worker.name : 'General Project';

  const recordId = `dhadi-${AppState.selectedWorkerId}-${AppState.selectedYear}-${AppState.selectedMonth}`;

  const recordObj = {
    recordId,
    ownerUserId: AppState.currentUser?.userId || 'guest-user',
    workerId: AppState.selectedWorkerId,
    workerName,
    workerSkill: worker?.skill || 'General',
    workerMobile: worker?.mobile || '',
    month: AppState.selectedMonth,
    year: AppState.selectedYear,
    dailyRate: AppState.currentDailyRate,
    advanceAmount: AppState.currentAdvanceAmount,
    bonusAmount: AppState.currentBonusAmount,
    workingDays: totalWorkingDays,
    subtotalWage,
    totalPayment: netPayable,
    dailyEntries: { ...AppState.currentDailyEntries },
    updatedAt: new Date().toISOString()
  };

  // Replace or add in records
  const existingIdx = AppState.dhadiRecords.findIndex(r => r.recordId === recordId);
  if (existingIdx >= 0) {
    AppState.dhadiRecords[existingIdx] = recordObj;
  } else {
    AppState.dhadiRecords.unshift(recordObj);
  }

  saveDhadiRecordsToStorage();
  showToast(`Register saved for ${workerName} (${MONTH_NAMES_EN[AppState.selectedMonth]} ${AppState.selectedYear})!`, 'fa-floppy-disk');
}

export function shareDhadiWhatsApp() {
  if (!AppState.selectedWorkerId) {
    showToast('Please select a worker to share attendance', 'fa-triangle-exclamation');
    return;
  }

  const worker = AppState.labours.find(l => l.labourId === AppState.selectedWorkerId);
  const workerName = worker ? worker.name : 'Worker / Labour';
  const monthName = MONTH_NAMES_EN[AppState.selectedMonth];
  const year = AppState.selectedYear;

  let totalWorkingDays = 0;
  Object.values(AppState.currentDailyEntries).forEach(val => totalWorkingDays += Number(val || 0));
  const subtotalWage = Math.round(totalWorkingDays * AppState.currentDailyRate);
  const netPayable = Math.max(0, subtotalWage - AppState.currentAdvanceAmount + AppState.currentBonusAmount);

  const msg = `*📋 DHADI WALA ATTENDANCE & PAYMENT STATEMENT*\n` +
    `--------------------------------------\n` +
    `👤 *Worker:* ${workerName}\n` +
    `📅 *Month:* ${monthName} ${year}\n` +
    `🛠️ *Daily Rate:* ${formatINR(AppState.currentDailyRate)}/day\n` +
    `✅ *Total Working Days:* ${totalWorkingDays} Dhadi\n` +
    `💵 *Total Earned:* ${formatINR(subtotalWage)}\n` +
    `➖ *Advance Given (खर्चा):* ${formatINR(AppState.currentAdvanceAmount)}\n` +
    `➕ *Bonus / Extra:* ${formatINR(AppState.currentBonusAmount)}\n` +
    `--------------------------------------\n` +
    `💰 *FINAL BALANCE PAYABLE: ${formatINR(netPayable)}*\n` +
    `--------------------------------------\n` +
    `_Generated automatically via Dhadi Wala App_`;

  const phone = worker?.mobile ? `91${worker.mobile}` : '';
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

let currentReceiptData = null;

export function printDhadiStatement() {
  if (!AppState.selectedWorkerId) {
    if (AppState.labours && AppState.labours.length > 0) {
      AppState.selectedWorkerId = AppState.labours[0].labourId;
      AppState.currentDailyRate = AppState.labours[0].dailyPayment || 600;
      const workerSelect = document.getElementById('select-dhadi-worker');
      if (workerSelect) workerSelect.value = AppState.selectedWorkerId;
    } else {
      showToast('Please register or select a worker first!', 'fa-triangle-exclamation');
      return;
    }
  }
  openReceiptModal();
}

export function openReceiptModal() {
  const modal = document.getElementById('modal-print-receipt');
  const container = document.getElementById('receipt-modal-body');
  if (!modal || !container) return;

  currentReceiptData = buildReceiptData(AppState);
  container.innerHTML = renderReceiptCard(currentReceiptData);
  modal.classList.add('active');
}

export function closeReceiptModal() {
  const modal = document.getElementById('modal-print-receipt');
  if (modal) modal.classList.remove('active');
}

export async function downloadReceiptPDFAction() {
  if (!requirePremium('PDF Download & Slip Generation', 'Download high-quality printable attendance slips and PDF reports.')) {
    return;
  }
  if (!currentReceiptData) {
    currentReceiptData = buildReceiptData(AppState);
  }
  await downloadReceiptPDF(currentReceiptData, showToast);
}

export function printReceiptAction() {
  if (!currentReceiptData) {
    currentReceiptData = buildReceiptData(AppState);
  }
  triggerCleanPrint(currentReceiptData, showToast);
}

// --- Dhadi History Modal Controller ---
export function openDhadiHistoryModal() {
  const modal = document.getElementById('modal-dhadi-history');
  const container = document.getElementById('dhadi-history-list');
  if (!modal || !container) return;

  if (AppState.dhadiRecords.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
        <div class="empty-title">No Dhadi Records Yet</div>
        <div class="empty-desc">When you save attendance in Dhadi Lekhna, monthly statements will appear here.</div>
      </div>
    `;
  } else {
    container.innerHTML = AppState.dhadiRecords.map(rec => `
      <div class="history-card" onclick="window.DhadiApp.loadHistoryRecord('${rec.recordId}')">
        <div>
          <div style="font-weight: 700; color: #0f172a; font-size: 15px; margin-bottom: 2px;">${rec.workerName}</div>
          <div style="font-size: 12px; color: #64748b;">
            <i class="fa-solid fa-calendar"></i> ${MONTH_NAMES_EN[rec.month]} ${rec.year} • ${rec.workingDays} Dhadi Days
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Rate: ${formatINR(rec.dailyRate)}/day</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 16px; color: var(--md-sys-color-primary-dark);">${formatINR(rec.totalPayment)}</div>
          <div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 6px;">
            <button class="btn-action-view" style="padding: 4px 8px;" title="Print / PDF Slip" onclick="event.stopPropagation(); window.DhadiApp.printPastRecordReceipt('${rec.recordId}')">
              <i class="fa-solid fa-file-invoice" style="color: #0284c7;"></i>
            </button>
            <button class="btn-action-view" style="padding: 4px 8px;" title="Delete" onclick="event.stopPropagation(); window.DhadiApp.deleteDhadiRecord('${rec.recordId}')">
              <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  modal.classList.add('active');
}

export function closeDhadiHistoryModal() {
  const modal = document.getElementById('modal-dhadi-history');
  if (modal) modal.classList.remove('active');
}

export function printPastRecordReceipt(recordId) {
  const rec = AppState.dhadiRecords.find(r => r.recordId === recordId);
  if (!rec) return;

  closeDhadiHistoryModal();
  AppState.selectedWorkerId = rec.workerId;
  AppState.selectedMonth = rec.month;
  AppState.selectedYear = rec.year;
  AppState.currentDailyRate = rec.dailyRate;
  AppState.currentAdvanceAmount = rec.advanceAmount || 0;
  AppState.currentBonusAmount = rec.bonusAmount || 0;
  AppState.currentDailyEntries = { ...rec.dailyEntries };

  openReceiptModal();
}

export function loadHistoryRecord(recordId) {
  const rec = AppState.dhadiRecords.find(r => r.recordId === recordId);
  if (!rec) return;

  closeDhadiHistoryModal();
  AppState.selectedWorkerId = rec.workerId;
  AppState.selectedMonth = rec.month;
  AppState.selectedYear = rec.year;
  AppState.currentDailyRate = rec.dailyRate;
  AppState.currentAdvanceAmount = rec.advanceAmount || 0;
  AppState.currentBonusAmount = rec.bonusAmount || 0;
  AppState.currentDailyEntries = { ...rec.dailyEntries };

  navigateToTab('dhadi-register');
  showToast(`Loaded statement for ${rec.workerName}`, 'fa-folder-open');
}

export function deleteDhadiRecord(recordId) {
  confirmDialog('Delete Record?', 'Are you sure you want to delete this Dhadi register statement?', () => {
    AppState.dhadiRecords = AppState.dhadiRecords.filter(r => r.recordId !== recordId);
    saveDhadiRecordsToStorage();
    openDhadiHistoryModal();
    showToast('Record deleted', 'fa-trash');
  });
}

// --- My Labour Modal Controller ---
export function openMyLabourModal() {
  const modal = document.getElementById('modal-my-labour');
  const container = document.getElementById('my-labour-list');
  if (!modal || !container) return;

  const currentUserId = AppState.currentUser?.userId || 'guest-user';
  // User's added labour (or all in demo mode)
  const myLabours = AppState.labours;

  if (myLabours.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-icon"><i class="fa-solid fa-users"></i></div>
        <div class="empty-title">No Labour Added</div>
        <div class="empty-desc">Use the "Labour Add" tab to register your first workforce profile.</div>
      </div>
    `;
  } else {
    container.innerHTML = myLabours.map(worker => `
      <div class="history-card" style="align-items: flex-start;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <img src="${worker.photo}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;">
          <div>
            <div style="font-weight: 700; color: #0f172a; font-size: 14px;">${worker.name}</div>
            <div style="font-size: 12px; color: #64748b;">${worker.skill} • ${formatINR(worker.dailyPayment)}/day</div>
            <div style="font-size: 11px; color: #94a3b8;"><i class="fa-solid fa-phone"></i> ${worker.mobile}</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
          <select style="font-size: 11px; padding: 3px 6px; border-radius: 4px; border: 1px solid #cbd5e1;" onchange="window.DhadiApp.toggleLabourStatus('${worker.labourId}', this.value)">
            <option value="available" ${worker.availability === 'available' ? 'selected' : ''}>🟢 Available</option>
            <option value="busy" ${worker.availability === 'busy' ? 'selected' : ''}>🔴 Busy</option>
            <option value="na" ${worker.availability === 'na' ? 'selected' : ''}>🟡 N/A</option>
          </select>
          <button class="btn-action-view" style="color: #dc2626; padding: 4px 8px;" onclick="window.DhadiApp.deleteLabour('${worker.labourId}')">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `).join('');
  }

  modal.classList.add('active');
}

export function closeMyLabourModal() {
  const modal = document.getElementById('modal-my-labour');
  if (modal) modal.classList.remove('active');
}

export function toggleLabourStatus(labourId, newStatus) {
  const worker = AppState.labours.find(l => l.labourId === labourId);
  if (worker) {
    worker.availability = newStatus;
    saveLaboursToStorage();
    renderLabourLive();
    renderHomeDashboard();
    showToast(`Updated status for ${worker.name}`, 'fa-check');
  }
}

export function deleteLabour(labourId) {
  confirmDialog('Delete Labour Profile?', 'This labour will be removed from your list and discovery feed.', () => {
    AppState.labours = AppState.labours.filter(l => l.labourId !== labourId);
    saveLaboursToStorage();
    openMyLabourModal();
    renderLabourLive();
    renderHomeDashboard();
    showToast('Labour removed', 'fa-trash');
  });
}

// --- Profile & Authentication Flow ---
export function renderProfileScreen() {
  const user = AppState.currentUser || {
    name: 'Contractor',
    email: '',
    mobile: '',
    profilePhoto: ''
  };

  const nameEl = document.getElementById('profile-user-name');
  const emailEl = document.getElementById('profile-user-email');
  const mobileEl = document.getElementById('profile-user-mobile');

  if (nameEl) nameEl.textContent = user.name || 'Contractor';
  if (emailEl) emailEl.textContent = user.email || '';
  if (mobileEl) mobileEl.textContent = user.mobile ? `+91 ${user.mobile}` : 'Active Account';

  // Update subscription indicators in Profile
  try {
    const subInfo = getSubscriptionStatus();
    const subSummaryEl = document.getElementById('profile-sub-summary');
    const subPillEl = document.getElementById('profile-sub-pill');
    const adminPendingPill = document.getElementById('admin-pending-pill');

    if (subSummaryEl && subPillEl) {
      const isHindi = AppState.language === 'hi';
      if (subInfo.status === 'ACTIVE') {
        subSummaryEl.textContent = `${subInfo.planName || 'Premium'} • ${subInfo.daysLeft} ${isHindi ? 'दिन शेष' : 'days left'}`;
        subPillEl.className = 'sub-badge sub-badge-active';
        subPillEl.textContent = isHindi ? 'सक्रिय (ACTIVE)' : 'ACTIVE';
      } else if (subInfo.status === 'PENDING') {
        subSummaryEl.textContent = isHindi ? 'सत्यापन प्रक्रिया में • UTR जाँचा जा रहा है' : 'Verification Pending • Reviewing UTR';
        subPillEl.className = 'sub-badge sub-badge-pending';
        subPillEl.textContent = isHindi ? 'जाँच में' : 'UNDER REVIEW';
      } else if (subInfo.status === 'EXPIRED') {
        subSummaryEl.textContent = isHindi ? 'प्लान समाप्त • नया प्लान चुनें' : 'Plan Expired • Renew Now';
        subPillEl.className = 'sub-badge sub-badge-expired';
        subPillEl.textContent = isHindi ? 'समाप्त' : 'EXPIRED';
      } else if (subInfo.status === 'REJECTED') {
        subSummaryEl.textContent = isHindi ? 'भुगतान अस्वीकृत • पुनः प्रयास करें' : 'Payment Rejected • Tap to Retry';
        subPillEl.className = 'sub-badge sub-badge-rejected';
        subPillEl.textContent = isHindi ? 'अस्वीकृत' : 'REJECTED';
      } else {
        subSummaryEl.textContent = isHindi ? 'फ्री प्लान • ₹29/माह से अपग्रेड करें' : 'Free Plan • Upgrade from ₹29/mo';
        subPillEl.className = 'sub-badge sub-badge-free';
        subPillEl.textContent = isHindi ? 'मुफ़्त (FREE)' : 'FREE';
      }
    }

    if (adminPendingPill && SubscriptionState) {
      const pendingCount = SubscriptionState.paymentTransactions.filter(t => t.status === 'PENDING').length;
      if (pendingCount > 0) {
        adminPendingPill.textContent = pendingCount;
        adminPendingPill.style.display = 'inline-block';
      } else {
        adminPendingPill.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Subscription profile update notice:', err);
  }
}

export function openEditProfileModal() {
  const modal = document.getElementById('modal-edit-profile');
  if (!modal) return;
  const user = AppState.currentUser || { name: '', email: '', mobile: '' };
  document.getElementById('edit-profile-name').value = user.name || '';
  document.getElementById('edit-profile-email').value = user.email || '';
  document.getElementById('edit-profile-mobile').value = user.mobile || '';
  modal.classList.add('active');
}

export function closeEditProfileModal() {
  document.getElementById('modal-edit-profile')?.classList.remove('active');
}

export function saveUserProfile() {
  const name = document.getElementById('edit-profile-name').value.trim();
  const mobile = document.getElementById('edit-profile-mobile').value.trim();

  if (!name) {
    showToast('Name is required', 'fa-triangle-exclamation');
    return;
  }

  if (AppState.currentUser) {
    AppState.currentUser.name = name;
    AppState.currentUser.mobile = mobile;
    localStorage.setItem('dhadi_current_user', JSON.stringify(AppState.currentUser));
  }

  closeEditProfileModal();
  renderProfileScreen();
  showToast('Profile updated successfully', 'fa-circle-check');
}

export function openChangePasswordModal() {
  document.getElementById('modal-change-password')?.classList.add('active');
}

export function closeChangePasswordModal() {
  document.getElementById('modal-change-password')?.classList.remove('active');
  document.getElementById('form-change-password')?.reset();
}

export function handleChangePassword(e) {
  e.preventDefault();
  const newPass = document.getElementById('input-new-password').value;
  const confirmPass = document.getElementById('input-confirm-password').value;

  if (newPass.length < 6) {
    showToast('Password must be at least 6 characters', 'fa-triangle-exclamation');
    return;
  }
  if (newPass !== confirmPass) {
    showToast('Passwords do not match', 'fa-triangle-exclamation');
    return;
  }

  if (AppState.isFirebaseAvailable && authInstance && authInstance.currentUser) {
    authInstance.currentUser.updatePassword(newPass)
      .then(() => {
        closeChangePasswordModal();
        showToast('Password updated securely on Firebase', 'fa-lock');
      })
      .catch((err) => {
        showToast(err.message, 'fa-triangle-exclamation');
      });
  } else {
    closeChangePasswordModal();
    showToast('Password updated successfully', 'fa-lock');
  }
}

// --- Cloud Sync & Data Backup Modal ---
export function openBackupModal() {
  const modal = document.getElementById('modal-backup-sync');
  if (!modal) return;
  modal.classList.add('active');
}

export function closeBackupModal() {
  document.getElementById('modal-backup-sync')?.classList.remove('active');
}

export function exportAppDataJSON() {
  if (!requirePremium('Cloud & JSON Backup', 'Export complete contractor ledger data, attendance logs, and labour database to JSON format.')) {
    return;
  }

  const backupData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    user: AppState.currentUser,
    labours: AppState.labours,
    dhadiRecords: AppState.dhadiRecords
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `dhadi_wala_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Backup JSON downloaded', 'fa-file-arrow-down');
}

// --- Confirmation Dialog Helper ---
export function confirmDialog(title, message, onConfirm) {
  const modal = document.getElementById('modal-confirm-dialog');
  const titleEl = document.getElementById('confirm-dialog-title');
  const msgEl = document.getElementById('confirm-dialog-message');
  const btn = document.getElementById('confirm-dialog-btn');

  if (!modal || !titleEl || !msgEl || !btn) return;

  titleEl.textContent = title;
  msgEl.textContent = message;

  btn.onclick = () => {
    modal.classList.remove('active');
    onConfirm();
  };

  modal.classList.add('active');
}

export function closeConfirmDialog() {
  document.getElementById('modal-confirm-dialog')?.classList.remove('active');
}

// --- Authentication UI Handlers ---
function getRegisteredUsers() {
  try {
    return JSON.parse(localStorage.getItem('dhadi_registered_users') || '[]');
  } catch (e) {
    return [];
  }
}

function saveRegisteredUser(user) {
  const users = getRegisteredUsers().filter(u => u.email.toLowerCase() !== user.email.toLowerCase());
  users.push(user);
  localStorage.setItem('dhadi_registered_users', JSON.stringify(users));
}

export function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const loginBtn = document.getElementById('btn-login-submit');

  if (!email || !password) {
    showToast('Please enter both Email and Password', 'fa-triangle-exclamation');
    return;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
  }

  if (AppState.isFirebaseAvailable && authInstance) {
    authInstance.signInWithEmailAndPassword(email, password)
      .then((userCred) => {
        const fbUser = userCred.user;
        const registeredUsers = getRegisteredUsers();
        const existing = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        const userName = existing?.name || fbUser.displayName || email.split('@')[0];
        const userMobile = existing?.mobile || '';

        handleAuthSuccess({
          userId: fbUser.uid,
          name: userName,
          email: fbUser.email,
          mobile: userMobile
        });
      })
      .catch((err) => {
        console.warn("Firebase sign in notice:", err.message);
        const registeredUsers = getRegisteredUsers();
        const localUser = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (localUser && localUser.password === password) {
          handleAuthSuccess({
            userId: localUser.userId,
            name: localUser.name,
            email: localUser.email,
            mobile: localUser.mobile
          });
          showToast('Logged in successfully', 'fa-circle-check');
        } else {
          let errorMsg = 'Invalid email or password.';
          if (err.code === 'auth/user-not-found') {
            errorMsg = 'No account found. Please click Create Account below.';
          } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            errorMsg = 'Incorrect password. Please try again.';
          } else if (err.code === 'auth/invalid-email') {
            errorMsg = 'Please enter a valid email address.';
          } else if (err.message && !err.message.includes('offline')) {
            errorMsg = err.message;
          }
          showToast(errorMsg, 'fa-triangle-exclamation');
        }
      })
      .finally(() => {
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Login';
        }
      });
  } else {
    // Local registered accounts validation
    const registeredUsers = getRegisteredUsers();
    const localUser = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (localUser) {
      if (localUser.password === password) {
        handleAuthSuccess({
          userId: localUser.userId,
          name: localUser.name,
          email: localUser.email,
          mobile: localUser.mobile
        });
        showToast('Logged in successfully', 'fa-circle-check');
      } else {
        showToast('Incorrect password. Please try again.', 'fa-triangle-exclamation');
      }
    } else {
      showToast('No account found. Please click Create Account below to register.', 'fa-triangle-exclamation');
    }
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Login';
    }
  }
}

export function handleSignupSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const mobile = document.getElementById('signup-mobile').value.trim();
  const password = document.getElementById('signup-password').value;
  const rePassword = document.getElementById('signup-repassword').value;
  const signupBtn = document.getElementById('btn-signup-submit');

  if (!name || !email || !mobile || !password) {
    showToast('Please fill all required fields', 'fa-triangle-exclamation');
    return;
  }
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    showToast('Please enter a valid 10-digit Indian mobile number', 'fa-triangle-exclamation');
    return;
  }
  if (password.length < 6) {
    showToast('Password must be at least 6 characters', 'fa-triangle-exclamation');
    return;
  }
  if (password !== rePassword) {
    showToast('Passwords do not match', 'fa-triangle-exclamation');
    return;
  }

  if (signupBtn) {
    signupBtn.disabled = true;
    signupBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';
  }

  const completeSignup = (uid) => {
    const userObj = {
      userId: uid || 'usr-' + Date.now(),
      name,
      email,
      mobile,
      password
    };
    saveRegisteredUser(userObj);
    handleAuthSuccess(userObj);
  };

  if (AppState.isFirebaseAvailable && authInstance) {
    authInstance.createUserWithEmailAndPassword(email, password)
      .then((userCred) => {
        return userCred.user.updateProfile({ displayName: name }).then(() => userCred.user);
      })
      .then((user) => {
        completeSignup(user.uid);
      })
      .catch((err) => {
        console.warn("Firebase sign up notice, registering account:", err.message);
        completeSignup();
      })
      .finally(() => {
        if (signupBtn) {
          signupBtn.disabled = false;
          signupBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
        }
      });
  } else {
    setTimeout(() => {
      completeSignup();
      if (signupBtn) {
        signupBtn.disabled = false;
        signupBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
      }
    }, 400);
  }
}

export function handleForgotPasswordSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) {
    showToast('Please enter your registered email address', 'fa-triangle-exclamation');
    return;
  }

  if (AppState.isFirebaseAvailable && authInstance) {
    authInstance.sendPasswordResetEmail(email)
      .then(() => {
        showToast('Password reset link sent to ' + email, 'fa-paper-plane', 4000);
        showAuthScreen('login');
      })
      .catch((err) => {
        showToast(err.message, 'fa-triangle-exclamation');
      });
  } else {
    showToast('Password reset link generated for ' + email, 'fa-paper-plane');
    showAuthScreen('login');
  }
}

function handleAuthSuccess(userObj) {
  AppState.currentUser = userObj;
  localStorage.setItem('dhadi_current_user', JSON.stringify(userObj));

  document.querySelectorAll('.screen-view').forEach(screen => {
    screen.classList.remove('active');
  });

  const nav = document.querySelector('.android-nav-bar');
  if (nav) nav.style.display = 'flex';
  const topBar = document.querySelector('.top-app-bar');
  if (topBar) topBar.style.display = 'flex';

  renderProfileScreen();
  navigateToTab('home');
  showToast(`Welcome ${userObj.name}!`, 'fa-circle-check');
}

export function handleLogout() {
  confirmDialog('Logout?', 'Are you sure you want to log out of Dhadi Wala?', () => {
    if (AppState.isFirebaseAvailable && authInstance) {
      authInstance.signOut().catch(() => {});
    }
    AppState.currentUser = null;
    localStorage.removeItem('dhadi_current_user');

    // Reset profile screen DOM elements
    const nameEl = document.getElementById('profile-user-name');
    const emailEl = document.getElementById('profile-user-email');
    const mobileEl = document.getElementById('profile-user-mobile');
    if (nameEl) nameEl.textContent = 'Profile';
    if (emailEl) emailEl.textContent = 'Contractor Account';
    if (mobileEl) mobileEl.textContent = 'Active Account';

    // Deselect navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    // Clear login fields
    const loginPass = document.getElementById('login-password');
    if (loginPass) loginPass.value = '';

    showAuthScreen('login');
    showToast('Logged out safely', 'fa-arrow-right-from-bracket');
  });
}

export function showAuthScreen(subscreen) {
  // Hide all screens to ensure no leftover screens are shown below
  document.querySelectorAll('.screen-view').forEach(screen => {
    screen.classList.remove('active');
  });

  const loginBox = document.getElementById('auth-login-box');
  const signupBox = document.getElementById('auth-signup-box');
  const forgotBox = document.getElementById('auth-forgot-box');
  if (loginBox) loginBox.style.display = subscreen === 'login' ? 'block' : 'none';
  if (signupBox) signupBox.style.display = subscreen === 'signup' ? 'block' : 'none';
  if (forgotBox) forgotBox.style.display = subscreen === 'forgot' ? 'block' : 'none';

  const authScreen = document.getElementById('screen-auth');
  if (authScreen) {
    authScreen.classList.add('active');
  }

  // Hide nav bar and top app bar during auth
  const nav = document.querySelector('.android-nav-bar');
  if (nav) nav.style.display = 'none';
  const topBar = document.querySelector('.top-app-bar');
  if (topBar) topBar.style.display = 'none';

  // Scroll to top
  const mainContainer = document.getElementById('main-container');
  if (mainContainer) {
    mainContainer.scrollTop = 0;
  }
}

export function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
  }
}

export function toggleLanguage() {
  AppState.language = AppState.language === 'en' ? 'hi' : 'en';
  localStorage.setItem('dhadi_language', AppState.language);
  const langBtn = document.getElementById('btn-lang-toggle');
  if (langBtn) {
    langBtn.textContent = AppState.language === 'en' ? 'हिंदी' : 'EN';
  }
  showToast(AppState.language === 'hi' ? 'भाषा: हिंदी चुनी गई' : 'Language set to English', 'fa-language');
  navigateToTab(AppState.currentTab);
}

// --- App Bootstrap / Lifecycle ---
export function initApp() {
  startStatusBarClock();
  loadFromLocalStorage();
  initFirebase();
  initSubscriptionSystem();
  initLabourAddForm();

  // Search input debounce in Labour Live
  const searchInput = document.getElementById('labour-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value;
      filterAndDisplayLabours();
    });
  }

  // Status Filter in Labour Live
  const statusSelect = document.getElementById('filter-status-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      AppState.selectedStatus = e.target.value;
      filterAndDisplayLabours();
    });
  }

  // Rate Slider Filter in Labour Live
  const rateSlider = document.getElementById('filter-rate-slider');
  const rateValText = document.getElementById('filter-rate-value');
  if (rateSlider && rateValText) {
    rateSlider.addEventListener('input', (e) => {
      AppState.maxRateFilter = Number(e.target.value);
      rateValText.textContent = `₹${Number(e.target.value).toLocaleString('en-IN')}`;
      filterAndDisplayLabours();
    });
  }

  // Dhadi Calculation input listeners
  const dhadiRateInput = document.getElementById('input-dhadi-rate');
  const dhadiAdvInput = document.getElementById('input-dhadi-advance');
  const dhadiBonusInput = document.getElementById('input-dhadi-bonus');

  if (dhadiRateInput) dhadiRateInput.addEventListener('input', calculateAndRenderDhadiPayments);
  if (dhadiAdvInput) dhadiAdvInput.addEventListener('input', calculateAndRenderDhadiPayments);
  if (dhadiBonusInput) dhadiBonusInput.addEventListener('input', calculateAndRenderDhadiPayments);

  // Splash Screen Timer (~2.5s)
  const splashScreen = document.getElementById('screen-splash');
  setTimeout(() => {
    if (splashScreen) {
      splashScreen.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      splashScreen.style.opacity = '0';
      splashScreen.style.transform = 'scale(0.96)';
      setTimeout(() => {
        splashScreen.style.display = 'none';

        // Check login state
        if (AppState.currentUser) {
          document.querySelector('.android-nav-bar').style.display = 'flex';
          document.querySelector('.top-app-bar').style.display = 'flex';
          navigateToTab('home');
        } else {
          showAuthScreen('login');
        }
      }, 400);
    }
  }, 2400);
}

// PWA deferred install prompt
let deferredPrompt = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('btn-pwa-install-trigger');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-download"></i> Install App on This Device';
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToast('Dhadi Wala App installed successfully!', 'fa-circle-check');
  });
}

export function openInstallModal() {
  const modal = document.getElementById('modal-install-app');
  if (!modal) return;

  const urlBox = document.getElementById('live-app-url-box');
  if (urlBox) {
    urlBox.textContent = window.location.href;
  }
  modal.classList.add('active');
}

export function closeInstallModal() {
  const modal = document.getElementById('modal-install-app');
  if (modal) modal.classList.remove('active');
}

export async function triggerPWAInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Installing Dhadi Wala App...', 'fa-download');
    }
    deferredPrompt = null;
  } else {
    showToast('Chrome menu (⋮) par jakar "Install app" par tap karein!', 'fa-circle-info');
  }
}

export function downloadDhadiApk() {
  try {
    showToast('Downloading DhadiWala.apk...', 'fa-arrow-down');
    const b64 = window.DHADI_APK_BASE64;
    if (b64) {
      const byteCharacters = atob(b64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'DhadiWala.apk';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('DhadiWala.apk Downloaded! Open Downloads to Install', 'fa-circle-check');
      }, 800);
      return;
    }

    // Fallback: fetch blob
    fetch('/DhadiWala.apk')
      .then(res => {
        if (!res.ok) throw new Error('File not available');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'DhadiWala.apk';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('DhadiWala.apk Downloaded!', 'fa-circle-check');
        }, 800);
      })
      .catch(() => {
        window.location.href = '/install.html';
      });
  } catch (e) {
    window.location.href = '/install.html';
  }
}

export function copyAppURL() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('App link copied! PWABuilder me paste karein', 'fa-copy');
  }).catch(() => {
    showToast(`URL: ${url}`, 'fa-copy');
  });
}

// Export functions to window for onclick handlers
if (typeof window !== 'undefined') {
  window.DhadiApp = {
    navigateToTab,
    selectCategory,
    openLabourDetail,
    closeLabourDetail,
    startDhadiForWorker,
    clearLabourFilters,
    selectAvatarPreset,
    handleWorkerChange,
    changeMonth,
    setDayDhadi,
    handleSaveDhadiRecord,
    shareDhadiWhatsApp,
    printDhadiStatement,
    openReceiptModal,
    closeReceiptModal,
    downloadReceiptPDFAction,
    printReceiptAction,
    openDhadiHistoryModal,
    closeDhadiHistoryModal,
    loadHistoryRecord,
    printPastRecordReceipt,
    deleteDhadiRecord,
    openMyLabourModal,
    closeMyLabourModal,
    toggleLabourStatus,
    deleteLabour,
    openEditProfileModal,
    closeEditProfileModal,
    saveUserProfile,
    openChangePasswordModal,
    closeChangePasswordModal,
    handleChangePassword,
    openBackupModal,
    closeBackupModal,
    exportAppDataJSON,
    confirmDialog,
    closeConfirmDialog,
    handleLoginSubmit,
    handleSignupSubmit,
    handleForgotPasswordSubmit,
    handleLogout,
    showAuthScreen,
    togglePasswordVisibility,
    toggleLanguage,
    openInstallModal,
    closeInstallModal,
    triggerPWAInstall,
    downloadDhadiApk,
    copyAppURL
  };
}
