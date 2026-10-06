// Dhadi Wala - Subscription & Payment Management System
import { formatINR } from './data.js';
import { AppState, showToast } from './app.js';

// Default Subscription Plans
export const DEFAULT_PLANS = [
  {
    id: 'plan_monthly',
    type: 'monthly',
    name: 'Monthly Plan',
    nameHi: 'मासिक प्लान',
    price: 29,
    durationMonths: 1,
    durationLabel: '1 Month',
    durationLabelHi: '1 महीना',
    tag: 'Flexible',
    tagHi: 'लोकप्रिय',
    qrImage: '/assets/qr-monthly-29.png',
    benefits: [
      'Full Labour Live discovery & direct phone contact',
      'Unlimited daily attendance & dhadi entries',
      'Instant WhatsApp statements & PDF payment slips',
      'Real-time cloud backup & synchronization',
      'Priority contractor support'
    ],
    benefitsHi: [
      'सभी कारीगरों की लाइव सूची और सीधा कॉल/व्हाट्सएप',
      'असीमित मजदूरों की दैनिक हाजिरी और हिसाब किताब',
      'तुरंत व्हाट्सएप हाजिरी पर्ची और PDF रसीद डाउनलोड',
      'क्लाउड पर हमेशा सुरक्षित बैकअप',
      'प्राथमिकता सहायता (Priority Support)'
    ],
    active: true
  },
  {
    id: 'plan_yearly',
    type: 'yearly',
    name: 'Yearly Plan',
    nameHi: 'वार्षिक प्लान',
    price: 199,
    durationMonths: 12,
    durationLabel: '1 Year',
    durationLabelHi: '1 पूरा साल',
    tag: 'Best Value • Save 42%',
    tagHi: 'सबसे किफायती • 42% बचत',
    qrImage: '/assets/qr-yearly-199.png',
    benefits: [
      'Full Labour Live discovery & direct phone contact',
      'Unlimited daily attendance & dhadi entries',
      'Instant WhatsApp statements & PDF payment slips',
      'Real-time cloud backup & synchronization',
      'Complete 12 months uninterrupted access',
      'VIP Contractor Verified Badge'
    ],
    benefitsHi: [
      'सभी कारीगरों की लाइव सूची और सीधा कॉल/व्हाट्सएप',
      'असीमित मजदूरों की दैनिक हाजिरी और हिसाब किताब',
      'तुरंत व्हाट्सएप हाजिरी पर्ची और PDF रसीद डाउनलोड',
      'क्लाउड पर हमेशा सुरक्षित बैकअप',
      'पूरे 1 साल की लगातार सुविधा (कोई रुकावट नहीं)',
      'वेरिफाइड ठेकेदार (VIP Contractor) बैज'
    ],
    active: true
  }
];

// Subscription State
export const SubscriptionState = {
  plans: [...DEFAULT_PLANS],
  subscriptions: {}, // userId -> subscription object
  paymentTransactions: [], // array of transactions
  currentSession: null, // { planId, expiresAt, timerInterval, proofBase64 }
  selectedPlanId: 'plan_monthly'
};

// Storage Keys
const STORAGE_SUBSCRIPTIONS = 'dhadi_subscriptions_v1';
const STORAGE_TRANSACTIONS = 'dhadi_payment_transactions_v1';
const STORAGE_PLANS = 'dhadi_subscription_plans_v1';

// --- Initialization & Storage ---
export function initSubscriptionSystem() {
  try {
    const savedPlans = localStorage.getItem(STORAGE_PLANS);
    if (savedPlans) {
      SubscriptionState.plans = JSON.parse(savedPlans);
    } else {
      localStorage.setItem(STORAGE_PLANS, JSON.stringify(DEFAULT_PLANS));
    }

    const savedSubs = localStorage.getItem(STORAGE_SUBSCRIPTIONS);
    if (savedSubs) {
      SubscriptionState.subscriptions = JSON.parse(savedSubs);
    }

    const savedTxns = localStorage.getItem(STORAGE_TRANSACTIONS);
    if (savedTxns) {
      SubscriptionState.paymentTransactions = JSON.parse(savedTxns);
    }

    // Sync with Firebase if available
    syncWithFirebase();
  } catch (err) {
    console.error("Subscription system init error:", err);
  }
}

function saveSubscriptionsToStorage() {
  try {
    localStorage.setItem(STORAGE_SUBSCRIPTIONS, JSON.stringify(SubscriptionState.subscriptions));
    localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(SubscriptionState.paymentTransactions));
    syncWithFirebase();
  } catch (e) {
    console.error("Error saving subscriptions:", e);
  }
}

function syncWithFirebase() {
  try {
    if (typeof window !== 'undefined' && window.firebase && window.firebase.database) {
      const db = window.firebase.database();
      // Push subscriptions & transactions
      const currentUserId = AppState.currentUser?.userId;
      if (currentUserId && SubscriptionState.subscriptions[currentUserId]) {
        db.ref(`subscriptions/${currentUserId}`).set(SubscriptionState.subscriptions[currentUserId]);
      }
    }
  } catch (err) {
    console.warn("Firebase subscription sync notice:", err.message);
  }
}

// --- Central Entitlement & Status Engine ---
export function getSubscriptionStatus(userId = null) {
  const uid = userId || AppState.currentUser?.userId || 'guest';
  if (!uid || uid === 'guest') {
    return {
      status: 'FREE',
      planId: null,
      planName: 'Free Plan',
      planNameHi: 'मुफ्त प्लान',
      price: 0,
      duration: 'Basic',
      isPremium: false,
      startDate: null,
      expiryDate: null,
      daysRemaining: 0,
      badgeClass: 'badge-free',
      latestTxn: null
    };
  }

  const sub = SubscriptionState.subscriptions[uid];
  if (!sub) {
    return {
      status: 'FREE',
      planId: null,
      planName: 'Free Plan',
      planNameHi: 'मुफ्त प्लान',
      price: 0,
      duration: 'Basic',
      isPremium: false,
      startDate: null,
      expiryDate: null,
      daysRemaining: 0,
      badgeClass: 'badge-free',
      latestTxn: null
    };
  }

  // Check if active subscription has passed expiry
  if (sub.status === 'ACTIVE' && sub.expiryDate) {
    const now = new Date().getTime();
    const expiry = new Date(sub.expiryDate).getTime();
    if (now > expiry) {
      sub.status = 'EXPIRED';
      saveSubscriptionsToStorage();
    }
  }

  let daysRemaining = 0;
  if (sub.expiryDate) {
    const diffTime = new Date(sub.expiryDate).getTime() - new Date().getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  const plan = SubscriptionState.plans.find(p => p.id === sub.planId) || DEFAULT_PLANS[0];

  let badgeClass = 'badge-free';
  if (sub.status === 'ACTIVE') badgeClass = 'badge-active';
  else if (sub.status === 'PENDING') badgeClass = 'badge-pending';
  else if (sub.status === 'EXPIRED') badgeClass = 'badge-expired';
  else if (sub.status === 'REJECTED') badgeClass = 'badge-rejected';

  const userTxns = SubscriptionState.paymentTransactions
    .filter(t => t.userId === uid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    status: sub.status, // FREE | ACTIVE | EXPIRED | PENDING | REJECTED
    planId: sub.planId,
    planName: plan.name,
    planNameHi: plan.nameHi,
    price: sub.amount || plan.price,
    duration: plan.durationLabel,
    durationHi: plan.durationLabelHi,
    isPremium: sub.status === 'ACTIVE',
    startDate: sub.startDate,
    expiryDate: sub.expiryDate,
    daysRemaining,
    badgeClass,
    rejectionReason: sub.rejectionReason || '',
    latestTxn: userTxns[0] || null
  };
}

// Format date helper
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// --- UI Controllers ---

// 1. Open "My Subscription" Modal / Screen
export function openMySubscriptionModal() {
  const modal = document.getElementById('modal-my-subscription');
  if (!modal) return;

  const currentInfo = getSubscriptionStatus();
  renderMySubscriptionView(currentInfo);

  modal.classList.add('active');
}

export function closeMySubscriptionModal() {
  document.getElementById('modal-my-subscription')?.classList.remove('active');
}

export function renderMySubscriptionView(info) {
  const container = document.getElementById('my-subscription-content');
  if (!container) return;

  const isHindi = AppState.language === 'hi';
  const uid = AppState.currentUser?.userId || 'guest';
  const historyList = SubscriptionState.paymentTransactions
    .filter(t => t.userId === uid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let statusBadgeHtml = '';
  let statusBannerHtml = '';
  let actionButtonHtml = '';

  if (info.status === 'ACTIVE') {
    statusBadgeHtml = `<span class="sub-badge sub-badge-active"><i class="fa-solid fa-crown"></i> ${isHindi ? 'सक्रिय (ACTIVE)' : 'ACTIVE'}</span>`;
    statusBannerHtml = `
      <div class="sub-status-card active-card">
        <div class="status-top-row">
          <div>
            <div class="sub-plan-title">👑 ${isHindi ? info.planNameHi : info.planName}</div>
            <div class="sub-plan-price">${formatINR(info.price)} / ${info.duration}</div>
          </div>
          ${statusBadgeHtml}
        </div>
        <div class="sub-dates-grid">
          <div>
            <span class="sub-date-lbl">${isHindi ? 'शुरुआत की तारीख' : 'Start Date'}</span>
            <span class="sub-date-val">${formatDate(info.startDate)}</span>
          </div>
          <div>
            <span class="sub-date-lbl">${isHindi ? 'वैधता समाप्ति' : 'Valid Until'}</span>
            <span class="sub-date-val" style="color: #15803d;">${formatDate(info.expiryDate)}</span>
          </div>
        </div>
        <div class="sub-days-left">
          <i class="fa-regular fa-clock"></i> ${info.daysRemaining} ${isHindi ? 'दिन की वैधता बची है' : 'Days remaining'}
        </div>
      </div>
    `;
    actionButtonHtml = `
      <button type="button" class="btn-m3-outline" style="width: 100%; margin-top: 14px; font-weight: 700;" onclick="window.DhadiSubscription.openChoosePlanModal()">
        <i class="fa-solid fa-arrows-rotate"></i> ${isHindi ? 'प्लान बदलें या रिन्यू करें' : 'Change or Renew Plan'}
      </button>
    `;
  } else if (info.status === 'PENDING') {
    statusBadgeHtml = `<span class="sub-badge sub-badge-pending"><i class="fa-solid fa-hourglass-half"></i> ${isHindi ? 'समीक्षाधीन (REVIEW)' : 'UNDER REVIEW'}</span>`;
    statusBannerHtml = `
      <div class="sub-status-card pending-card">
        <div class="status-top-row">
          <div>
            <div class="sub-plan-title">${isHindi ? info.planNameHi : info.planName}</div>
            <div class="sub-plan-price">${formatINR(info.price)} (${info.duration})</div>
          </div>
          ${statusBadgeHtml}
        </div>
        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px; margin-top: 12px; font-size: 13px; color: #92400e; line-height: 1.4;">
          <i class="fa-solid fa-circle-info" style="margin-right: 4px;"></i>
          <strong>${isHindi ? 'पेमेंट सत्यापन प्रक्रिया में है:' : 'Payment Verification in Progress:'}</strong><br>
          ${isHindi ? 'आपका पेमेंट विवरण प्राप्त हो गया है। एडमिन द्वारा UTR और स्क्रीनशॉट चेक करने के बाद आपका सब्सक्रिप्शन तुरंत सक्रिय हो जाएगा।' : 'Your payment confirmation has been submitted. Your subscription will be activated after payment verification.'}
        </div>
        ${info.latestTxn?.utr ? `<div style="font-size: 12px; color: #64748b; margin-top: 8px;"><strong>UTR/Txn ID:</strong> ${info.latestTxn.utr}</div>` : ''}
      </div>
    `;
    actionButtonHtml = `
      <button type="button" class="btn-m3-outline" style="width: 100%; margin-top: 14px; font-weight: 700;" onclick="window.DhadiSubscription.openChoosePlanModal()">
        <i class="fa-solid fa-plus"></i> ${isHindi ? 'नया पेमेंट भेजें' : 'Submit Another Payment'}
      </button>
    `;
  } else if (info.status === 'EXPIRED') {
    statusBadgeHtml = `<span class="sub-badge sub-badge-expired"><i class="fa-solid fa-circle-xmark"></i> ${isHindi ? 'समाप्त (EXPIRED)' : 'EXPIRED'}</span>`;
    statusBannerHtml = `
      <div class="sub-status-card expired-card">
        <div class="status-top-row">
          <div>
            <div class="sub-plan-title">${isHindi ? info.planNameHi : info.planName}</div>
            <div class="sub-plan-price">${formatINR(info.price)} / ${info.duration}</div>
          </div>
          ${statusBadgeHtml}
        </div>
        <p style="font-size: 13px; color: #991b1b; margin-top: 8px;">
          ${isHindi ? 'आपका पुराना सब्सक्रिप्शन समाप्त हो गया है। प्रीमियम सुविधाएं जारी रखने के लिए रिन्यू करें।' : 'Your subscription has expired. Please renew your subscription to continue enjoying premium features.'}
        </p>
      </div>
    `;
    actionButtonHtml = `
      <button type="button" class="btn-m3-primary" style="width: 100%; margin-top: 14px; font-weight: 800;" onclick="window.DhadiSubscription.openChoosePlanModal()">
        <i class="fa-solid fa-bolt"></i> ${isHindi ? 'सब्सक्रिप्शन रिन्यू करें' : 'Renew Subscription'}
      </button>
    `;
  } else if (info.status === 'REJECTED') {
    statusBadgeHtml = `<span class="sub-badge sub-badge-rejected"><i class="fa-solid fa-triangle-exclamation"></i> ${isHindi ? 'अस्वीकृत (REJECTED)' : 'REJECTED'}</span>`;
    statusBannerHtml = `
      <div class="sub-status-card rejected-card">
        <div class="status-top-row">
          <div>
            <div class="sub-plan-title">${isHindi ? info.planNameHi : info.planName}</div>
            <div class="sub-plan-price">${formatINR(info.price)}</div>
          </div>
          ${statusBadgeHtml}
        </div>
        <p style="font-size: 13px; color: #991b1b; margin-top: 8px;">
          <strong>${isHindi ? 'पेमेंट सत्यापन विफल:' : 'Payment Verification Failed:'}</strong> ${info.rejectionReason || (isHindi ? 'UTR या पेमेंट प्रूफ का मिलान नहीं हुआ।' : 'Transaction ID could not be verified.')}
        </p>
      </div>
    `;
    actionButtonHtml = `
      <button type="button" class="btn-m3-primary" style="width: 100%; margin-top: 14px; font-weight: 800;" onclick="window.DhadiSubscription.openChoosePlanModal()">
        <i class="fa-solid fa-rotate-right"></i> ${isHindi ? 'दोबारा प्रयास करें' : 'Try Again'}
      </button>
    `;
  } else {
    // FREE
    statusBadgeHtml = `<span class="sub-badge sub-badge-free">${isHindi ? 'फ्री प्लान' : 'Free Plan'}</span>`;
    statusBannerHtml = `
      <div class="sub-status-card free-card">
        <div class="status-top-row">
          <div>
            <div class="sub-plan-title">${isHindi ? 'फ्री प्लान (Free Plan)' : 'Free Plan'}</div>
            <div class="sub-plan-price" style="color: #64748b;">₹0 / आजीवन</div>
          </div>
          ${statusBadgeHtml}
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 8px; line-height: 1.4;">
          ${isHindi ? 'आप वर्तमान में बेसिक प्लान पर हैं। असीमित कारीगर खोज, हाजिरी लेज़र और डिजिटल रसीद के लिए प्रीमियम प्लान चुनें।' : 'You are currently on the Free Plan. Upgrade to unlock all features, direct contacts, unlimited worker attendance and PDF ledgers.'}
        </p>
      </div>
    `;
    actionButtonHtml = `
      <button type="button" class="btn-m3-primary" style="width: 100%; margin-top: 14px; font-weight: 800;" onclick="window.DhadiSubscription.openChoosePlanModal()">
        <i class="fa-solid fa-crown" style="color: #fef08a;"></i> ${isHindi ? 'प्रीमियम प्लान में अपग्रेड करें' : 'Upgrade Plan'}
      </button>
    `;
  }

  // History section
  let historyHtml = '';
  if (historyList.length === 0) {
    historyHtml = `
      <div style="text-align: center; padding: 24px 16px; color: #94a3b8; font-size: 13px;">
        <i class="fa-solid fa-clock-rotate-left" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
        <div>${isHindi ? 'कोई पुराना भुगतान रिकॉर्ड नहीं है' : 'No subscription history yet'}</div>
      </div>
    `;
  } else {
    historyHtml = `
      <div class="sub-history-list">
        ${historyList.map(item => `
          <div class="sub-history-item">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <strong style="font-size: 14px; color: #1e293b;">${item.planName}</strong>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                  ${formatDate(item.createdAt)} • ${item.utr ? `UTR: ${item.utr}` : 'QR Direct'}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 14px; color: #ea580c;">${formatINR(item.amount)}</div>
                <span class="sub-badge sub-badge-${item.status.toLowerCase()}" style="font-size: 10px; padding: 2px 6px;">
                  ${item.status}
                </span>
              </div>
            </div>
            ${item.rejectionReason ? `<div style="font-size: 11px; color: #dc2626; margin-top: 4px;">Reason: ${item.rejectionReason}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Top Current Status Card -->
    ${statusBannerHtml}

    ${actionButtonHtml}

    <!-- Features Overview -->
    <div style="margin-top: 20px; background: #ffffff; border-radius: 16px; padding: 16px; border: 1px solid #e2e8f0;">
      <h4 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-shield-halved" style="color: #ea580c;"></i> ${isHindi ? 'प्रीमियम प्लान के लाभ' : 'Premium Membership Benefits'}
      </h4>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #334155;">
        <div style="display: flex; gap: 8px; align-items: center;"><i class="fa-solid fa-check" style="color: #16a34a;"></i> <span>${isHindi ? 'सभी कारीगरों की लाइव सूची और सीधा संपर्क' : 'Full Labour Live discovery & direct calling'}</span></div>
        <div style="display: flex; gap: 8px; align-items: center;"><i class="fa-solid fa-check" style="color: #16a34a;"></i> <span>${isHindi ? 'असीमित हाजिरी व धाड़ी रजिस्टर' : 'Unlimited daily worker attendance'}</span></div>
        <div style="display: flex; gap: 8px; align-items: center;"><i class="fa-solid fa-check" style="color: #16a34a;"></i> <span>${isHindi ? 'डिजिटल रसीद और PDF स्टेटमेंट' : 'Instant WhatsApp statements & PDF receipts'}</span></div>
        <div style="display: flex; gap: 8px; align-items: center;"><i class="fa-solid fa-check" style="color: #16a34a;"></i> <span>${isHindi ? '24/7 सुरक्षित क्लाउड बैकअप' : 'Real-time cloud backup & synchronization'}</span></div>
      </div>
    </div>

    <!-- Subscription History -->
    <div style="margin-top: 20px;">
      <h4 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
        <span><i class="fa-solid fa-clock-rotate-left" style="color: #64748b;"></i> ${isHindi ? 'भुगतान इतिहास (History)' : 'Subscription History'}</span>
        <span style="font-size: 12px; font-weight: 600; color: #64748b;">${historyList.length} ${isHindi ? 'रिकॉर्ड' : 'records'}</span>
      </h4>
      ${historyHtml}
    </div>
  `;
}

// 2. Open "Choose Your Plan" Modal
export function openChoosePlanModal() {
  closeMySubscriptionModal();
  const modal = document.getElementById('modal-choose-plan');
  if (!modal) return;

  renderChoosePlanView();
  modal.classList.add('active');
}

export function closeChoosePlanModal() {
  document.getElementById('modal-choose-plan')?.classList.remove('active');
}

export function selectPlan(planId) {
  SubscriptionState.selectedPlanId = planId;
  document.querySelectorAll('.plan-select-card').forEach(card => {
    if (card.dataset.planId === planId) {
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    } else {
      card.classList.remove('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = false;
    }
  });
}

export function renderChoosePlanView() {
  const container = document.getElementById('choose-plan-content');
  if (!container) return;

  const isHindi = AppState.language === 'hi';
  const monthlyPlan = SubscriptionState.plans.find(p => p.type === 'monthly') || DEFAULT_PLANS[0];
  const yearlyPlan = SubscriptionState.plans.find(p => p.type === 'yearly') || DEFAULT_PLANS[1];

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 18px;">
      <h3 style="font-size: 20px; font-weight: 800; color: #0f172a;">${isHindi ? 'अपना प्लान चुनें' : 'Choose Your Plan'}</h3>
      <p style="font-size: 13px; color: #64748b; margin-top: 4px;">
        ${isHindi ? 'अपनी जरूरत अनुसार मासिक या वार्षिक प्लान चुनें' : 'Select a plan that suits your workforce scale'}
      </p>
    </div>

    <!-- Monthly Plan Card -->
    <div class="plan-select-card ${SubscriptionState.selectedPlanId === monthlyPlan.id ? 'selected' : ''}" data-plan-id="${monthlyPlan.id}" onclick="window.DhadiSubscription.selectPlan('${monthlyPlan.id}')">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span class="plan-badge">${isHindi ? monthlyPlan.tagHi : monthlyPlan.tag}</span>
          <div class="plan-card-name">${isHindi ? monthlyPlan.nameHi : monthlyPlan.name}</div>
          <div class="plan-card-price">
            ${formatINR(monthlyPlan.price)} <span class="plan-card-unit">/ ${isHindi ? monthlyPlan.durationLabelHi : 'month'}</span>
          </div>
        </div>
        <input type="radio" name="plan_choice" value="${monthlyPlan.id}" ${SubscriptionState.selectedPlanId === monthlyPlan.id ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #ea580c; cursor: pointer; margin-top: 4px;" />
      </div>

      <div class="plan-card-features">
        ${(isHindi ? monthlyPlan.benefitsHi : monthlyPlan.benefits).map(b => `
          <div class="plan-feature-row">
            <i class="fa-solid fa-circle-check" style="color: #16a34a; font-size: 13px;"></i>
            <span>${b}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Yearly Plan Card -->
    <div class="plan-select-card ${SubscriptionState.selectedPlanId === yearlyPlan.id ? 'selected' : ''}" data-plan-id="${yearlyPlan.id}" onclick="window.DhadiSubscription.selectPlan('${yearlyPlan.id}')" style="border-color: #f97316;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span class="plan-badge" style="background: #ea580c; color: #fff;">${isHindi ? yearlyPlan.tagHi : yearlyPlan.tag}</span>
          <div class="plan-card-name" style="color: #c2410c;">👑 ${isHindi ? yearlyPlan.nameHi : yearlyPlan.name}</div>
          <div class="plan-card-price">
            ${formatINR(yearlyPlan.price)} <span class="plan-card-unit">/ ${isHindi ? yearlyPlan.durationLabelHi : 'year'}</span>
          </div>
        </div>
        <input type="radio" name="plan_choice" value="${yearlyPlan.id}" ${SubscriptionState.selectedPlanId === yearlyPlan.id ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #ea580c; cursor: pointer; margin-top: 4px;" />
      </div>

      <div class="plan-card-features">
        ${(isHindi ? yearlyPlan.benefitsHi : yearlyPlan.benefits).map(b => `
          <div class="plan-feature-row">
            <i class="fa-solid fa-circle-check" style="color: #16a34a; font-size: 13px;"></i>
            <span>${b}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Action Button -->
    <button type="button" class="btn-m3-primary" style="width: 100%; margin-top: 16px; padding: 14px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);" onclick="window.DhadiSubscription.proceedToPayment()">
      ${isHindi ? 'भुगतान के लिए आगे बढ़ें (Proceed to Pay)' : 'Proceed to Pay'} <i class="fa-solid fa-arrow-right"></i>
    </button>
  `;
}

// 3. Payment Flow & 5-Minute Countdown Timer
export function proceedToPayment() {
  const selectedPlan = SubscriptionState.plans.find(p => p.id === SubscriptionState.selectedPlanId) || DEFAULT_PLANS[0];
  closeChoosePlanModal();
  openPaymentScreen(selectedPlan);
}

export function openPaymentScreen(plan) {
  const modal = document.getElementById('modal-payment-screen');
  if (!modal) return;

  // Clear previous timer if any
  if (SubscriptionState.currentSession?.timerInterval) {
    clearInterval(SubscriptionState.currentSession.timerInterval);
  }

  // Create 5-Minute Session
  const DURATION_MS = 5 * 60 * 1000; // 5 Minutes
  const expiresAt = Date.now() + DURATION_MS;

  SubscriptionState.currentSession = {
    planId: plan.id,
    plan,
    expiresAt,
    isExpired: false,
    timerInterval: null,
    proofBase64: null
  };

  renderPaymentView(plan);
  modal.classList.add('active');

  // Start real-time countdown timer
  startPaymentTimer();
}

export function closePaymentScreen() {
  if (SubscriptionState.currentSession?.timerInterval) {
    clearInterval(SubscriptionState.currentSession.timerInterval);
  }
  document.getElementById('modal-payment-screen')?.classList.remove('active');
}

function startPaymentTimer() {
  const timerEl = document.getElementById('payment-countdown-timer');
  const session = SubscriptionState.currentSession;
  if (!session) return;

  function update() {
    const now = Date.now();
    const remaining = Math.max(0, session.expiresAt - now);

    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (timerEl) {
      timerEl.textContent = formatted;
    }

    if (remaining <= 0) {
      session.isExpired = true;
      clearInterval(session.timerInterval);
      handleSessionExpiration();
    }
  }

  update();
  session.timerInterval = setInterval(update, 1000);
}

function handleSessionExpiration() {
  const expiredBanner = document.getElementById('payment-expired-banner');
  const submitBtn = document.getElementById('btn-submit-payment');
  const retryBox = document.getElementById('payment-retry-box');

  if (expiredBanner) expiredBanner.style.display = 'block';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
  }
  if (retryBox) retryBox.style.display = 'block';
}

export function retryPaymentSession() {
  const session = SubscriptionState.currentSession;
  if (!session || !session.plan) return;
  openPaymentScreen(session.plan);
}

export function renderPaymentView(plan) {
  const container = document.getElementById('payment-screen-content');
  if (!container) return;

  const isHindi = AppState.language === 'hi';

  container.innerHTML = `
    <!-- Top Plan Header -->
    <div style="background: linear-gradient(135deg, #ea580c, #c2410c); border-radius: 16px; color: #fff; padding: 16px; text-align: center; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);">
      <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9;">
        ${isHindi ? 'भुगतान स्क्रीन' : 'Payment Checkout'}
      </div>
      <div style="font-size: 22px; font-weight: 800; margin-top: 2px;">
        ${isHindi ? plan.nameHi : plan.name}
      </div>
      <div style="font-size: 28px; font-weight: 900; margin-top: 4px;">
        ${formatINR(plan.price)}
        <span style="font-size: 14px; font-weight: 600; opacity: 0.9;">/ ${isHindi ? plan.durationLabelHi : plan.durationLabel}</span>
      </div>
    </div>

    <!-- 5-Minute Timer Display -->
    <div class="timer-box">
      <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
        <i class="fa-regular fa-clock"></i> ${isHindi ? 'सत्र समाप्ति समय (Time Remaining)' : 'Payment Session Expires In'}
      </div>
      <div id="payment-countdown-timer" class="timer-digits">05:00</div>
      <div style="font-size: 11px; color: #94a3b8;">
        ${isHindi ? 'कृपया 5 मिनट के भीतर भुगतान पूरा करें' : 'Please complete payment before the timer reaches 00:00'}
      </div>
    </div>

    <!-- Expired Warning Banner -->
    <div id="payment-expired-banner" class="status-badge status-expired" style="display: none; margin-bottom: 14px; text-align: center; padding: 12px;">
      <i class="fa-solid fa-triangle-exclamation" style="font-size: 18px; color: #dc2626; margin-bottom: 4px;"></i>
      <div style="font-weight: 800; color: #991b1b; font-size: 14px;">
        ${isHindi ? 'भुगतान सत्र समाप्त हो गया है (Payment Session Expired)' : 'Payment Session Expired'}
      </div>
      <div style="font-size: 12px; color: #7f1d1d; margin-top: 2px;">
        ${isHindi ? 'समय सीमा समाप्त हो गई है। कृपया नया क्यूआर कोड लोड करने के लिए नीचे "दोबारा प्रयास करें" दबाएं।' : 'This session has timed out. Tap "Try Again" below to generate a fresh 5-minute payment session.'}
      </div>
    </div>

    <!-- QR Code Section -->
    <div class="qr-container-card">
      <div style="font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 10px;">
        <i class="fa-solid fa-qrcode" style="color: #ea580c;"></i> ${isHindi ? 'QR कोड स्कैन करके भुगतान करें' : 'Scan QR Code to Pay'}
      </div>

      <!-- Centered, large, undistorted QR image with sufficient white space -->
      <div class="qr-image-wrapper">
        <img src="${plan.qrImage}" alt="${plan.name} QR Code" class="qr-code-img" id="payment-qr-img" />
      </div>

      <div style="margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span style="font-size: 16px; font-weight: 900; color: #ea580c;">
          ${formatINR(plan.price)}
        </span>
        <button type="button" class="btn-action-view" style="font-size: 11px; padding: 4px 8px; border-radius: 6px;" onclick="window.DhadiSubscription.copyUpiAmount(${plan.price})">
          <i class="fa-regular fa-copy"></i> Copy Amount
        </button>
      </div>
      <div style="font-size: 12px; color: #475569; margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;">
        <span>UPI: <strong style="color: #0f172a;">7340988453@upi</strong></span>
        <button type="button" class="btn-action-view" style="font-size: 11px; padding: 4px 8px; border-radius: 6px;" onclick="window.DhadiSubscription.copyUpiId()">
          <i class="fa-regular fa-copy"></i> Copy UPI
        </button>
      </div>
      <div style="font-size: 10.5px; color: #94a3b8; margin-top: 4px;">
        Beneficiary: <strong>Dhadi Wala (Labour & Attendance)</strong>
      </div>
    </div>

    <!-- Step-by-Step Payment Instructions -->
    <div class="payment-instructions-box">
      <div style="font-size: 13px; font-weight: 800; color: #92400e; margin-bottom: 8px;">
        <i class="fa-solid fa-list-check"></i> ${isHindi ? 'भुगतान करने के सरल निर्देश:' : 'Simple Payment Steps:'}
      </div>
      <ol style="margin-left: 18px; font-size: 12.5px; color: #78350f; line-height: 1.6;">
        <li>${isHindi ? 'अपने फोन में कोई भी UPI ऐप खोलें (GPay, PhonePe, Paytm, BHIM)' : 'Open your UPI / payment app (Google Pay, PhonePe, Paytm, BHIM).'}</li>
        <li>${isHindi ? 'ऊपर दिए गए QR कोड को स्कैन करें।' : 'Scan the QR code displayed above.'}</li>
        <li>${isHindi ? `पूरी राशि <b>${formatINR(plan.price)}</b> का भुगतान करें।` : `Pay the exact subscription amount of <b>${formatINR(plan.price)}</b>.`}</li>
        <li>${isHindi ? 'भुगतान सफल होने पर UTR / Transaction ID नोट करें।' : 'Complete payment in your UPI app.'}</li>
        <li>${isHindi ? 'नीचे UTR नंबर डालें और "Submit Payment" पर टैप करें।' : 'Submit payment confirmation below.'}</li>
      </ol>
    </div>

    <!-- Payment Confirmation Form -->
    <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 16px;">
      <h4 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-receipt" style="color: #ea580c;"></i> ${isHindi ? 'भुगतान पुष्टि (Payment Confirmation)' : 'Submit Payment Confirmation'}
      </h4>

      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="font-size: 12px; font-weight: 700; color: #475569;">
          ${isHindi ? 'ट्रांजेक्शन आईडी / UTR नंबर (12-digit UTR)' : 'Transaction ID / UTR (Optional)'}
        </label>
        <input type="text" id="input-payment-utr" class="m3-input no-icon" placeholder="e.g. 423589123456" maxlength="30" />
        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
          ${isHindi ? 'PhonePe/GPay के रिसिप्ट में 12 अंकों का UTR नंबर मिलता है' : '12-digit reference number from your payment app'}
        </div>
      </div>

      <!-- Payment Proof Upload with Preview -->
      <div class="form-group" style="margin-bottom: 14px;">
        <label class="form-label" style="font-size: 12px; font-weight: 700; color: #475569;">
          ${isHindi ? 'भुगतान का स्क्रीनशॉट (Payment Proof)' : 'Payment Screenshot / Proof (Optional)'}
        </label>
        <div id="payment-proof-preview-box" style="display: none; margin-bottom: 8px; text-align: center; position: relative;">
          <img id="payment-proof-img" src="" alt="Proof Preview" style="max-height: 140px; border-radius: 10px; border: 1.5px solid #cbd5e1; object-fit: contain;" />
          <button type="button" onclick="window.DhadiSubscription.removeProofImage()" style="position: absolute; top: 4px; right: calc(50% - 70px); background: #ef4444; color: #fff; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer;">
            ✕
          </button>
        </div>
        <input type="file" id="input-payment-proof" accept="image/*" onchange="window.DhadiSubscription.handleProofUpload(event)" style="font-size: 12px;" />
      </div>

      <button type="button" id="btn-submit-payment" class="btn-m3-primary" style="width: 100%; padding: 14px; font-weight: 800; font-size: 15px;" onclick="window.DhadiSubscription.handleSubmitPayment()">
        <i class="fa-solid fa-circle-check"></i> ${isHindi ? 'मैंने भुगतान कर दिया है (Submit Payment)' : 'I Have Paid / Submit Payment'}
      </button>

      <!-- Retry box when expired -->
      <div id="payment-retry-box" style="display: none; margin-top: 12px;">
        <button type="button" class="btn-m3-outline" style="width: 100%; border-color: #ea580c; color: #ea580c; font-weight: 800;" onclick="window.DhadiSubscription.retryPaymentSession()">
          <i class="fa-solid fa-rotate-right"></i> ${isHindi ? 'नया 5 मिनट का सत्र शुरू करें (Try Again)' : 'Try Again (New 5-Minute Session)'}
        </button>
      </div>
    </div>
  `;
}

export function handleProofUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('Please select an image smaller than 5MB', 'fa-triangle-exclamation');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64 = evt.target.result;
    if (SubscriptionState.currentSession) {
      SubscriptionState.currentSession.proofBase64 = base64;
    }
    const previewBox = document.getElementById('payment-proof-preview-box');
    const previewImg = document.getElementById('payment-proof-img');
    if (previewBox && previewImg) {
      previewImg.src = base64;
      previewBox.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

export function removeProofImage() {
  if (SubscriptionState.currentSession) {
    SubscriptionState.currentSession.proofBase64 = null;
  }
  const previewBox = document.getElementById('payment-proof-preview-box');
  const fileInput = document.getElementById('input-payment-proof');
  if (previewBox) previewBox.style.display = 'none';
  if (fileInput) fileInput.value = '';
}

export function handleSubmitPayment() {
  const session = SubscriptionState.currentSession;
  if (!session) return;

  if (session.isExpired || Date.now() > session.expiresAt) {
    showToast('Payment session has expired. Tap "Try Again".', 'fa-clock');
    return;
  }

  const utrInput = document.getElementById('input-payment-utr');
  const utr = utrInput?.value.trim() || '';
  const proof = session.proofBase64 || '';

  const user = AppState.currentUser || {
    userId: 'user-' + Date.now(),
    name: 'Guest Contractor',
    email: 'contractor@dhadiwala.in',
    mobile: ''
  };

  const plan = session.plan;

  // Create Transaction Record
  const txnId = 'txn_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const newTxn = {
    transactionId: txnId,
    userId: user.userId,
    userName: user.name,
    userEmail: user.email,
    userMobile: user.mobile,
    planId: plan.id,
    planName: plan.name,
    planType: plan.type,
    amount: plan.price,
    durationMonths: plan.durationMonths,
    utr: utr,
    paymentProof: proof,
    status: 'PENDING', // PENDING | APPROVED | REJECTED
    createdAt: new Date().toISOString()
  };

  // Set Subscription in PENDING state (DO NOT auto-activate)
  const newSub = {
    subscriptionId: 'sub_' + user.userId,
    userId: user.userId,
    userName: user.name,
    planId: plan.id,
    planName: plan.name,
    amount: plan.price,
    durationMonths: plan.durationMonths,
    startDate: null,
    expiryDate: null,
    status: 'PENDING', // PENDING -> Under Review
    paymentStatus: 'PENDING',
    transactionId: txnId,
    paymentProof: proof,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  SubscriptionState.paymentTransactions.unshift(newTxn);
  SubscriptionState.subscriptions[user.userId] = newSub;

  saveSubscriptionsToStorage();

  // Clear session timer
  if (session.timerInterval) clearInterval(session.timerInterval);

  closePaymentScreen();
  openPaymentPendingScreen(newTxn);
}

// 4. Payment Under Review / Pending Modal
export function openPaymentStatusModal(txn) {
  openPaymentPendingScreen(txn);
}

export function openPaymentPendingScreen(txn) {
  const modal = document.getElementById('modal-payment-status');
  if (!modal) return;

  if (!txn) {
    const user = AppState.currentUser || { userId: 'guest-user' };
    txn = SubscriptionState.paymentTransactions.find(t => t.userId === user.userId) || {
      planName: 'Monthly Plan',
      amount: 29,
      status: 'PENDING'
    };
  }

  const isHindi = AppState.language === 'hi';
  const container = document.getElementById('payment-status-modal-content');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px 10px;">
        <div style="width: 72px; height: 72px; background: #fffbeb; color: #d97706; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 16px; border: 2px solid #fef3c7;">
          <i class="fa-solid fa-hourglass-half fa-spin"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
          ${isHindi ? 'भुगतान समीक्षाधीन है' : 'Payment Under Review'}
        </h3>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
          ${isHindi ? 'आपका भुगतान विवरण प्राप्त हो गया है। एडमिन द्वारा सत्यापन के बाद आपका सब्सक्रिप्शन सक्रिय हो जाएगा।' : 'We received your payment details. Your subscription will be activated after payment verification.'}
        </p>

        <div style="background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; padding: 14px; text-align: left; font-size: 13px; color: #334155; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Plan:</span>
            <strong>${txn.planName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">Amount:</span>
            <strong style="color: #ea580c;">${formatINR(txn.amount)}</strong>
          </div>
          ${txn.utr ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #64748b;">UTR / Ref:</span>
            <span>${txn.utr}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Status:</span>
            <span class="sub-badge sub-badge-pending">UNDER REVIEW</span>
          </div>
        </div>

        <button type="button" class="btn-m3-primary" style="width: 100%; font-weight: 800;" onclick="window.DhadiSubscription.closePaymentStatusModal(); window.DhadiSubscription.openMySubscriptionModal();">
          ${isHindi ? 'सब्सक्रिप्शन स्थिति देखें' : 'View Subscription Status'}
        </button>
      </div>
    `;
  }

  modal.classList.add('active');
}

export function closePaymentStatusModal() {
  document.getElementById('modal-payment-status')?.classList.remove('active');
}

// --- Admin Subscription & Verification Portal ---
export function openAdminSubscriptionModal() {
  const modal = document.getElementById('modal-admin-subscriptions');
  if (!modal) return;

  renderAdminDashboard();
  modal.classList.add('active');
}

export function closeAdminSubscriptionModal() {
  document.getElementById('modal-admin-subscriptions')?.classList.remove('active');
}

export function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  document.querySelectorAll('.admin-tab-pane').forEach(pane => {
    if (pane.id === `admin-pane-${tabName}`) pane.classList.add('active');
    else pane.classList.remove('active');
  });
}

export function renderAdminDashboard() {
  const container = document.getElementById('admin-subscriptions-content');
  if (!container) return;

  const txns = SubscriptionState.paymentTransactions;
  const subs = Object.values(SubscriptionState.subscriptions);

  // Compute Stats
  const totalSubscribers = subs.filter(s => s.status === 'ACTIVE').length;
  const activeMonthly = subs.filter(s => s.status === 'ACTIVE' && s.durationMonths === 1).length;
  const activeYearly = subs.filter(s => s.status === 'ACTIVE' && s.durationMonths === 12).length;
  const pendingPayments = txns.filter(t => t.status === 'PENDING').length;
  const expiredSubs = subs.filter(s => s.status === 'EXPIRED').length;
  const totalRevenue = txns
    .filter(t => t.status === 'APPROVED')
    .reduce((acc, cur) => acc + Number(cur.amount || 0), 0);

  const pendingList = txns.filter(t => t.status === 'PENDING');
  const activeList = subs.filter(s => s.status === 'ACTIVE');

  container.innerHTML = `
    <!-- Admin Tabs -->
    <div class="admin-tab-bar">
      <button class="admin-tab-btn active" data-tab="dashboard" onclick="window.DhadiSubscription.switchAdminTab('dashboard')">
        <i class="fa-solid fa-chart-pie"></i> Dashboard
      </button>
      <button class="admin-tab-btn" data-tab="requests" onclick="window.DhadiSubscription.switchAdminTab('requests')">
        <i class="fa-solid fa-inbox"></i> Requests ${pendingPayments > 0 ? `<span class="admin-badge-count">${pendingPayments}</span>` : ''}
      </button>
      <button class="admin-tab-btn" data-tab="active" onclick="window.DhadiSubscription.switchAdminTab('active')">
        <i class="fa-solid fa-crown"></i> Active (${totalSubscribers})
      </button>
      <button class="admin-tab-btn" data-tab="plans" onclick="window.DhadiSubscription.switchAdminTab('plans')">
        <i class="fa-solid fa-tags"></i> Plans
      </button>
      <button class="admin-tab-btn" data-tab="history" onclick="window.DhadiSubscription.switchAdminTab('history')">
        <i class="fa-solid fa-clock-rotate-left"></i> History
      </button>
    </div>

    <!-- PANE 1: Dashboard -->
    <div id="admin-pane-dashboard" class="admin-tab-pane active">
      <div class="admin-stats-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-val" style="color: #ea580c;">${totalSubscribers}</div>
          <div class="admin-stat-lbl">Active Subscribers</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-val" style="color: #d97706;">${pendingPayments}</div>
          <div class="admin-stat-lbl">Pending Verification</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-val" style="color: #16a34a;">${formatINR(totalRevenue)}</div>
          <div class="admin-stat-lbl">Total Revenue</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-val" style="color: #0284c7;">${activeMonthly}</div>
          <div class="admin-stat-lbl">Monthly (₹29)</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-val" style="color: #9333ea;">${activeYearly}</div>
          <div class="admin-stat-lbl">Yearly (₹199)</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-val" style="color: #dc2626;">${expiredSubs}</div>
          <div class="admin-stat-lbl">Expired</div>
        </div>
      </div>

      <!-- Quick Pending Queue Notice -->
      ${pendingPayments > 0 ? `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #92400e; font-size: 14px;">${pendingPayments} Payment(s) waiting for approval</strong>
            <div style="font-size: 12px; color: #b45309;">Verify UTR and activate subscriber access.</div>
          </div>
          <button class="btn-m3-primary" style="padding: 6px 14px; font-size: 12px;" onclick="window.DhadiSubscription.switchAdminTab('requests')">
            Review Now
          </button>
        </div>
      ` : ''}

      <!-- Testing & Simulator Tools -->
      <div style="margin-top: 20px; padding: 14px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px;">
        <div style="font-size: 13px; font-weight: 800; color: #334155; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-flask" style="color: #ea580c;"></i> Testing & Demo Tools (अनुकरण टूल्स)
        </div>
        <p style="font-size: 11.5px; color: #64748b; margin-bottom: 10px;">
          Quickly switch subscription states to test all application features and restrictions:
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button type="button" class="btn-m3-outline" style="font-size: 11px; padding: 8px 6px; background: #fff;" onclick="window.DhadiSubscription.adminSimulateApproveCurrent('monthly')">
            ⚡ Activate Monthly
          </button>
          <button type="button" class="btn-m3-outline" style="font-size: 11px; padding: 8px 6px; background: #fff;" onclick="window.DhadiSubscription.adminSimulateApproveCurrent('yearly')">
            👑 Activate Yearly
          </button>
        </div>
        <button type="button" class="btn-m3-outline" style="width: 100%; margin-top: 8px; font-size: 11px; padding: 8px; color: #dc2626; border-color: #fca5a5; background: #fff;" onclick="window.DhadiSubscription.adminSimulateResetSubscription()">
          <i class="fa-solid fa-rotate-left"></i> Reset to Free Plan
        </button>
      </div>
    </div>

    <!-- PANE 2: Payment Requests (Approval Queue) -->
    <div id="admin-pane-requests" class="admin-tab-pane">
      <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Pending Payment Approvals</h4>
      ${pendingList.length === 0 ? `
        <div style="text-align: center; padding: 30px; color: #94a3b8; font-size: 13px;">
          <i class="fa-solid fa-circle-check" style="font-size: 32px; color: #22c55e; margin-bottom: 8px;"></i>
          <div>All payment requests have been reviewed!</div>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${pendingList.map(item => `
            <div class="admin-request-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="font-weight: 800; font-size: 15px; color: #0f172a;">${item.userName || 'Contractor'}</div>
                  <div style="font-size: 12px; color: #64748b;">${item.userEmail || ''} ${item.userMobile ? '• ' + item.userMobile : ''}</div>
                  <div style="font-size: 12px; font-weight: 700; color: #ea580c; margin-top: 4px;">
                    ${item.planName} • ${formatINR(item.amount)}
                  </div>
                </div>
                <span class="sub-badge sub-badge-pending">PENDING</span>
              </div>

              <div style="background: #f8fafc; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 12px; color: #334155;">
                <div><strong>Transaction / UTR:</strong> ${item.utr || '<em style="color:#94a3b8;">Not provided</em>'}</div>
                <div><strong>Date:</strong> ${formatDate(item.createdAt)}</div>
                ${item.paymentProof ? `
                  <div style="margin-top: 8px;">
                    <strong>Payment Proof:</strong><br>
                    <img src="${item.paymentProof}" alt="Proof" style="max-height: 120px; border-radius: 6px; border: 1px solid #cbd5e1; margin-top: 4px; cursor: pointer;" onclick="window.DhadiSubscription.viewProofImage('${item.transactionId}')" />
                  </div>
                ` : ''}
              </div>

              <div style="display: flex; gap: 8px;">
                <button class="btn-m3-primary" style="flex: 1; padding: 10px; background: #16a34a; font-size: 13px;" onclick="window.DhadiSubscription.adminApprovePayment('${item.transactionId}')">
                  <i class="fa-solid fa-check"></i> Approve
                </button>
                <button class="btn-m3-outline" style="flex: 1; padding: 10px; border-color: #dc2626; color: #dc2626; font-size: 13px;" onclick="window.DhadiSubscription.adminRejectPayment('${item.transactionId}')">
                  <i class="fa-solid fa-xmark"></i> Reject
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- PANE 3: Active Subscriptions -->
    <div id="admin-pane-active" class="admin-tab-pane">
      <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Active Subscribers (${activeList.length})</h4>
      ${activeList.length === 0 ? `
        <div style="text-align: center; padding: 30px; color: #94a3b8; font-size: 13px;">
          No active subscribers found.
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${activeList.map(sub => `
            <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong style="font-size: 14px; color: #1e293b;">${sub.userName || 'Subscriber'}</strong>
                  <div style="font-size: 12px; color: #64748b;">${sub.planName} • ${formatINR(sub.amount)}</div>
                </div>
                <span class="sub-badge sub-badge-active">ACTIVE</span>
              </div>
              <div style="font-size: 11.5px; color: #64748b; margin-top: 8px; display: flex; justify-content: space-between;">
                <span>Start: ${formatDate(sub.startDate)}</span>
                <span style="color: #15803d; font-weight: 700;">Expires: ${formatDate(sub.expiryDate)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>

    <!-- PANE 4: Plans Management -->
    <div id="admin-pane-plans" class="admin-tab-pane">
      <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Configured Subscription Plans</h4>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${SubscriptionState.plans.map(p => `
          <div style="background: #ffffff; border-radius: 14px; border: 1.5px solid #e2e8f0; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <strong style="font-size: 16px; color: #0f172a;">${p.name}</strong>
                <div style="font-size: 13px; color: #ea580c; font-weight: 800; margin-top: 2px;">
                  ${formatINR(p.price)} / ${p.durationLabel}
                </div>
              </div>
              <span class="sub-badge sub-badge-active">ACTIVE PLAN</span>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #475569;">
              <div><strong>QR Asset:</strong> ${p.qrImage}</div>
              <div style="margin-top: 4px;"><strong>Included Benefits:</strong> ${p.benefits.length} features enabled</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- PANE 5: Complete Audit History -->
    <div id="admin-pane-history" class="admin-tab-pane">
      <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">All Transactions Audit Log</h4>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${txns.map(t => `
          <div style="background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; padding: 12px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <strong>${t.userName || 'User'} (${t.planName})</strong>
              <span class="sub-badge sub-badge-${t.status.toLowerCase()}">${t.status}</span>
            </div>
            <div style="color: #64748b; margin-top: 4px;">
              Amount: ${formatINR(t.amount)} • Date: ${formatDate(t.createdAt)} ${t.utr ? '• UTR: ' + t.utr : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Admin Action: Approve Payment
export function adminApprovePayment(transactionId) {
  const txn = SubscriptionState.paymentTransactions.find(t => t.transactionId === transactionId);
  if (!txn) return;

  const now = new Date();
  const startDate = now.toISOString();

  // Calendar month / year addition
  const expiry = new Date(now);
  if (txn.durationMonths === 12) {
    expiry.setFullYear(expiry.getFullYear() + 1);
  } else {
    expiry.setMonth(expiry.getMonth() + 1);
  }
  const expiryDate = expiry.toISOString();

  // Update Transaction
  txn.status = 'APPROVED';
  txn.reviewedAt = new Date().toISOString();
  txn.reviewedBy = 'Admin';

  // Update Subscription
  const sub = SubscriptionState.subscriptions[txn.userId] || {
    subscriptionId: 'sub_' + txn.userId,
    userId: txn.userId
  };

  sub.planId = txn.planId;
  sub.planName = txn.planName;
  sub.amount = txn.amount;
  sub.durationMonths = txn.durationMonths;
  sub.startDate = startDate;
  sub.expiryDate = expiryDate;
  sub.status = 'ACTIVE';
  sub.paymentStatus = 'APPROVED';
  sub.transactionId = txn.transactionId;
  sub.updatedAt = new Date().toISOString();

  SubscriptionState.subscriptions[txn.userId] = sub;

  saveSubscriptionsToStorage();
  renderAdminDashboard();

  // If the approved user is currently logged in, refresh their profile
  if (AppState.currentUser && AppState.currentUser.userId === txn.userId) {
    if (typeof window.DhadiApp?.renderProfileScreen === 'function') {
      window.DhadiApp.renderProfileScreen();
    }
  }

  showToast(`Subscription activated successfully! Valid until ${formatDate(expiryDate)}`, 'fa-circle-check');
}

// Admin Action: Reject Payment
export function adminRejectPayment(transactionId) {
  const txn = SubscriptionState.paymentTransactions.find(t => t.transactionId === transactionId);
  if (!txn) return;

  const reason = 'Transaction ID / UTR could not be verified in bank records.';

  txn.status = 'REJECTED';
  txn.rejectionReason = reason;
  txn.reviewedAt = new Date().toISOString();
  txn.reviewedBy = 'Admin';

  const sub = SubscriptionState.subscriptions[txn.userId];
  if (sub) {
    sub.status = 'REJECTED';
    sub.paymentStatus = 'REJECTED';
    sub.rejectionReason = reason;
    sub.updatedAt = new Date().toISOString();
  }

  saveSubscriptionsToStorage();
  renderAdminDashboard();

  if (AppState.currentUser && AppState.currentUser.userId === txn.userId) {
    if (typeof window.DhadiApp?.renderProfileScreen === 'function') {
      window.DhadiApp.renderProfileScreen();
    }
  }

  showToast('Payment request marked as Rejected.', 'fa-circle-xmark');
}

// Copy UPI ID & Amount Helpers
export function copyUpiId() {
  const upiId = '7340988453@upi';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(upiId).then(() => {
      showToast('UPI ID copied: ' + upiId, 'fa-copy');
    }).catch(() => {
      showToast('UPI ID: ' + upiId, 'fa-copy');
    });
  } else {
    showToast('UPI ID: ' + upiId, 'fa-copy');
  }
}

export function copyUpiAmount(amount) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(String(amount)).then(() => {
      showToast(`Amount ₹${amount} copied`, 'fa-copy');
    }).catch(() => {
      showToast(`Amount: ₹${amount}`, 'fa-copy');
    });
  } else {
    showToast(`Amount: ₹${amount}`, 'fa-copy');
  }
}

// Simulation helpers for testing all states
export function adminSimulateApproveCurrent(planType = 'monthly') {
  const user = AppState.currentUser || { userId: 'guest-user', name: 'Contractor Demo' };
  const plan = SubscriptionState.plans.find(p => p.type === planType) || DEFAULT_PLANS[0];
  
  const now = new Date();
  const startDate = now.toISOString();
  const expiry = new Date(now);
  if (plan.durationMonths === 12) {
    expiry.setFullYear(expiry.getFullYear() + 1);
  } else {
    expiry.setMonth(expiry.getMonth() + 1);
  }
  const expiryDate = expiry.toISOString();

  SubscriptionState.subscriptions[user.userId] = {
    subscriptionId: 'sub_' + user.userId,
    userId: user.userId,
    userName: user.name,
    planId: plan.id,
    planName: plan.name,
    amount: plan.price,
    durationMonths: plan.durationMonths,
    startDate,
    expiryDate,
    status: 'ACTIVE',
    paymentStatus: 'APPROVED',
    transactionId: 'sim_' + Date.now(),
    updatedAt: new Date().toISOString()
  };

  saveSubscriptionsToStorage();
  if (typeof window.DhadiApp?.renderProfileScreen === 'function') {
    window.DhadiApp.renderProfileScreen();
  }
  renderAdminDashboard();
  renderMySubscriptionView();
  showToast(`${plan.name} activated until ${formatDate(expiryDate)}`, 'fa-crown');
}

export function adminSimulateResetSubscription() {
  const user = AppState.currentUser || { userId: 'guest-user' };
  delete SubscriptionState.subscriptions[user.userId];
  saveSubscriptionsToStorage();
  if (typeof window.DhadiApp?.renderProfileScreen === 'function') {
    window.DhadiApp.renderProfileScreen();
  }
  renderAdminDashboard();
  renderMySubscriptionView();
  showToast('Subscription reset to Free Plan', 'fa-rotate-left');
}

// View Proof Modal (In-App Lightbox)
export function viewProofImage(transactionId) {
  const txn = SubscriptionState.paymentTransactions.find(t => t.transactionId === transactionId);
  if (!txn || !txn.paymentProof) {
    showToast('No proof image uploaded', 'fa-circle-exclamation');
    return;
  }

  let lightbox = document.getElementById('image-lightbox-modal');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'image-lightbox-modal';
    lightbox.className = 'modal-backdrop';
    lightbox.style.zIndex = '99999';
    lightbox.onclick = (e) => {
      if (e.target === lightbox || e.target.closest('.lightbox-close-btn')) {
        lightbox.classList.remove('active');
      }
    };
    document.body.appendChild(lightbox);
  }

  lightbox.innerHTML = `
    <div style="background: #ffffff; border-radius: 16px; padding: 16px; max-width: 380px; width: 90%; max-height: 85vh; display: flex; flex-direction: column; align-items: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3); position: relative; margin: auto;">
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 10px;">
        <span style="font-weight: 700; font-size: 14px; color: #0f172a;">Payment Screenshot</span>
        <button type="button" class="lightbox-close-btn icon-btn-ghost" style="font-size: 18px; color: #64748b;">✕</button>
      </div>
      <div style="overflow: auto; max-height: 65vh; width: 100%; text-align: center;">
        <img src="${txn.paymentProof}" alt="Payment Proof" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #cbd5e1;" />
      </div>
    </div>
  `;
  lightbox.classList.add('active');
}

// Gatekeeper for Premium Features
export function requirePremium(featureName = 'This feature', onAllowed) {
  const statusInfo = getSubscriptionStatus();
  if (statusInfo.isPremium) {
    if (typeof onAllowed === 'function') onAllowed();
    return true;
  }

  // Show Premium Upgrade Dialog
  showPremiumUpgradePrompt(featureName);
  return false;
}

export function showPremiumUpgradePrompt(featureName) {
  const isHindi = AppState.language === 'hi';
  const modal = document.getElementById('modal-premium-gate');
  if (!modal) {
    openChoosePlanModal();
    return;
  }

  const titleEl = document.getElementById('premium-gate-title');
  const descEl = document.getElementById('premium-gate-desc');
  if (titleEl) {
    titleEl.textContent = isHindi ? 'प्रीमियम सुविधा (Premium Feature)' : 'Premium Feature';
  }
  if (descEl) {
    descEl.textContent = isHindi
      ? `"${featureName}" का उपयोग करने के लिए एक्टिव सब्सक्रिप्शन की आवश्यकता है।`
      : `"${featureName}" requires an active subscription. Upgrade to unlock full access.`;
  }

  modal.classList.add('active');
}

export function closePremiumGateModal() {
  document.getElementById('modal-premium-gate')?.classList.remove('active');
}

// Global Browser API Export
if (typeof window !== 'undefined') {
  window.DhadiSubscription = {
    SubscriptionState,
    DEFAULT_PLANS,
    initSubscriptionSystem,
    getSubscriptionStatus,
    openMySubscriptionModal,
    closeMySubscriptionModal,
    renderMySubscriptionView,
    openChoosePlanModal,
    closeChoosePlanModal,
    selectPlan,
    proceedToPayment,
    openPaymentScreen,
    closePaymentScreen,
    openPaymentStatusModal,
    openPaymentPendingScreen,
    closePaymentStatusModal,
    openAdminSubscriptionModal,
    closeAdminSubscriptionModal,
    switchAdminTab,
    renderAdminDashboard,
    adminApprovePayment,
    adminRejectPayment,
    adminSimulateApproveCurrent,
    adminSimulateResetSubscription,
    copyUpiId,
    copyUpiAmount,
    handleProofUpload,
    removeProofImage,
    handleSubmitPayment,
    retryPaymentSession,
    viewProofImage,
    requirePremium,
    showPremiumUpgradePrompt,
    closePremiumGateModal
  };
}
