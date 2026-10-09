/**
 * FA DIGITAL STORE BD - Client Engine & Firebase Synchronizer
 * Preconfigured for Telegram Web App & InfinityFree Hosting (fadigitalstorebd.page.gd)
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBDX7LJPYZlq_UYhOOijpnx7Rmu1js4M18",
  authDomain: "fa-digital-store-bd.firebaseapp.com",
  databaseURL: "https://fa-digital-store-bd-default-rtdb.firebaseio.com",
  projectId: "fa-digital-store-bd",
  storageBucket: "fa-digital-store-bd.firebasestorage.app",
  messagingSenderId: "1059180007640",
  appId: "1:1059180007640:web:50e91003bf96c6d84cc7ad"
};

const ADMIN_EMAIL = "abdullah.fahim1996.ban@gmail.com";
const ADMIN_PASSWORD = "Fahim$Fahim@2008";
const ADMIN_UID = "agyBIsgczmOf8TplXMy8Cyc0cH13";

let db = null;
try {
  if (window.firebase) {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  }
} catch (e) {
  console.warn("Firebase Init:", e);
}

let currentLang = 'en';

let currentUser = {
  userId: "guest_" + Math.floor(100000 + Math.random() * 900000),
  firstName: "Guest User",
  username: "",
  email: "",
  balance: 0.0,
  totalSpent: 0.0,
  referralEarnings: 0.0,
  activeCouponCode: "",
  isAdmin: false,
  role: 'user'
};

let storeSettings = {
  adminEmail: ADMIN_EMAIL,
  adminPassword: ADMIN_PASSWORD,
  supportAdminId: "6882165252",
  supportUsername: "@FADigitalAdmin",
  supportChannel: "https://t.me/FADigitalChannel",
  supportGroup: "https://t.me/FADigitalCommunityGroup",
  welcomeMessage: "  Welcome to FA DIGITAL STORE BD! Enjoy instant delivery & auto payment.",
  slidingNotice: "  RupantorPay auto payment & bKash/Nagad/Rocket active! Use coupon WELCOME10 for 10% discount on all orders!",
  rupantorpayApiKey: "uiiZWFJTTKDzmYeRuUwcClCqYy2VB1Rz60CwVBpNpFT2jayTXU",
  rupantorpayDeviceKey: "f5Iwkh35f6ghWNRX40ikY6wZiDTAgc23peymcOUx",
  rupantorpayBaseUrl: "https://rupantorpay.com/api/checkout",
  bkashNumber: "01957638599 (Personal / Send Money)",
  nagadNumber: "01957638599 (Personal / Send Money)",
  rocketNumber: "01957638599 (Personal / Send Money)",
  affiliateCommission: 10,
  globalMailCodeUrl: "https://korra.cababu.cfd/mail",
  globalProxyCheckerUrl: "https://checker.proxycheck.io"
};

let products = [];
let stocks = [];
let coupons = [];
let orders = [];
let deposits = [];
let registeredUsers = [];
let selectedCategory = 'all';

function initApp() {
  loadLocalState();

  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const u = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (u && !currentUser.email) {
      currentUser.userId = String(u.id);
      currentUser.firstName = u.first_name || "Telegram User";
      currentUser.username = u.username || "";
      if (tg.initDataUnsafe.start_param) {
        currentUser.referredBy = tg.initDataUnsafe.start_param.replace("ref_", "");
      }
    }
  }

  const path = window.location.pathname;
  const hash = window.location.hash;
  const search = window.location.search;
  if (path.includes("/admin") || hash.includes("admin") || search.includes("admin=true")) {
    openAdminModal();
  }

  syncFirebase();
  updateUserUI();
  updateSettingsUI();
  renderProducts();
  startTotpLoop();
}

function loadLocalState() {
  try {
    const sess = localStorage.getItem("fa_session");
    if (sess) {
      currentUser = { ...currentUser, ...JSON.parse(sess) };
    }
    const reg = localStorage.getItem("fa_registered_users");
    if (reg) registeredUsers = JSON.parse(reg);
    const p = localStorage.getItem("fa_prods");
    if (p) products = JSON.parse(p);
    else products = getDefaultProducts();
    const s = localStorage.getItem("fa_stocks");
    if (s) stocks = JSON.parse(s);
    else stocks = getDefaultStocks();
    const c = localStorage.getItem("fa_coups");
    if (c) coupons = JSON.parse(c);
    else coupons = getDefaultCoupons();
    const o = localStorage.getItem("fa_orders");
    if (o) orders = JSON.parse(o);
    const d = localStorage.getItem("fa_deps");
    if (d) deposits = JSON.parse(d);
    const set = localStorage.getItem("fa_settings");
    if (set) storeSettings = { ...storeSettings, ...JSON.parse(set) };
  } catch (e) {
    console.error(e);
  }
}

function saveLocalState() {
  localStorage.setItem("fa_session", JSON.stringify(currentUser));
  localStorage.setItem("fa_registered_users", JSON.stringify(registeredUsers));
  localStorage.setItem("fa_prods", JSON.stringify(products));
  localStorage.setItem("fa_stocks", JSON.stringify(stocks));
  localStorage.setItem("fa_coups", JSON.stringify(coupons));
  localStorage.setItem("fa_orders", JSON.stringify(orders));
  localStorage.setItem("fa_deps", JSON.stringify(deposits));
  localStorage.setItem("fa_settings", JSON.stringify(storeSettings));
}

function syncFirebase() {
  if (!db) return;

  db.ref("settings").on("value", snap => {
    if (snap.exists()) {
      storeSettings = { ...storeSettings, ...snap.val() };
      saveLocalState();
      updateSettingsUI();
    }
  });

  if (currentUser.userId) {
    db.ref("users/" + currentUser.userId).on("value", snap => {
      if (snap.exists()) {
        const remoteUser = snap.val();
        currentUser.balance = remoteUser.balance !== undefined ? remoteUser.balance : currentUser.balance;
        currentUser.totalSpent = remoteUser.totalSpent !== undefined ? remoteUser.totalSpent : currentUser.totalSpent;
        currentUser.referralEarnings = remoteUser.referralEarnings !== undefined ? remoteUser.referralEarnings : currentUser.referralEarnings;
        saveLocalState();
        updateUserUI();
      }
    });
  }

  db.ref("products").on("value", snap => {
    if (snap.exists()) {
      const val = snap.val();
      products = Array.isArray(val) ? val : Object.values(val);
      saveLocalState();
      renderProducts();
    }
  });

  db.ref("stock").on("value", snap => {
    if (snap.exists()) {
      const val = snap.val();
      stocks = Array.isArray(val) ? val : Object.values(val);
      saveLocalState();
      renderProducts();
    }
  });

  db.ref("deposits").on("value", snap => {
    if (snap.exists()) {
      const val = snap.val();
      deposits = Array.isArray(val) ? val : Object.values(val);
      saveLocalState();
      if (!document.getElementById("modal-admin").classList.contains("hidden")) {
        loadAdminDashboard();
      }
    }
  });
}

function isSuperAdmin() {
  return (
    currentUser.isAdmin === true ||
    (currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ||
    currentUser.userId === ADMIN_UID
  );
}

function updateUserUI() {
  const nameEl = document.getElementById("user-display-name");
  const balEl = document.getElementById("user-balance-badge");
  const roleBadge = document.getElementById("user-role-badge");
  const navAdminBtn = document.getElementById("nav-admin-btn");
  const authHeaderContainer = document.getElementById("auth-header-container");

  const isAdmin = isSuperAdmin();

  if (nameEl) {
    nameEl.textContent = currentUser.firstName + (currentUser.username ? " (@" + currentUser.username + ")" : "");
  }

  if (balEl) {
    balEl.textContent = (currentUser.balance || 0).toFixed(2) + " BDT";
  }

  if (navAdminBtn) {
    if (isAdmin) navAdminBtn.classList.remove("hidden");
    else navAdminBtn.classList.add("hidden");
  }

  if (roleBadge) {
    if (isAdmin) {
      roleBadge.textContent = "Super Admin";
      roleBadge.className = "text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40";
    } else {
      roleBadge.textContent = "Live";
      roleBadge.className = "text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30";
    }
  }

  if (authHeaderContainer) {
    if (currentUser.email) {
      authHeaderContainer.innerHTML = `
        <button onclick="logoutUser()" title="Logout" class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/30 text-slate-300 hover:text-rose-400 text-xs font-semibold flex items-center gap-1 transition">
          <span>🚪</span>
          <span class="hidden sm:inline">লগআউট</span>
        </button>
      `;
    } else {
      authHeaderContainer.innerHTML = `
        <button onclick="openAuthModal()" id="btn-header-login" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-extrabold text-xs transition active:scale-95 shadow-md shadow-emerald-500/20 flex items-center gap-1">
          <span>🔑</span>
          <span>লগইন</span>
        </button>
      `;
    }
  }

  const pUid = document.getElementById("prof-uid");
  const pEmail = document.getElementById("prof-email-display");
  const pBal = document.getElementById("prof-bal");
  const pSpent = document.getElementById("prof-spent");
  const pRefEarn = document.getElementById("prof-ref-earn");

  if (pUid) pUid.textContent = currentUser.userId;
  if (pEmail) pEmail.textContent = currentUser.email || "No email connected";
  if (pBal) pBal.textContent = (currentUser.balance || 0).toFixed(2) + " BDT";
  if (pSpent) pSpent.textContent = (currentUser.totalSpent || 0).toFixed(2) + " BDT";
  if (pRefEarn) pRefEarn.textContent = (currentUser.referralEarnings || 0).toFixed(2) + " BDT";

  const affLinkInput = document.getElementById("affiliate-link-input");
  if (affLinkInput) affLinkInput.value = window.location.origin + window.location.pathname + "?ref=" + currentUser.userId;
}

function updateSettingsUI() {
  const bBkash = document.getElementById("dep-bkash-num");
  const bNagad = document.getElementById("dep-nagad-num");
  const bRocket = document.getElementById("dep-rocket-num");
  if (bBkash) bBkash.textContent = storeSettings.bkashNumber;
  if (bNagad) bNagad.textContent = storeSettings.nagadNumber;
  if (bRocket) bRocket.textContent = storeSettings.rocketNumber;

  const sNotice = document.getElementById("sliding-notice-text");
  if (sNotice) sNotice.textContent = storeSettings.slidingNotice;

  const hWelcome = document.getElementById("hero-welcome-text");
  if (hWelcome) hWelcome.textContent = storeSettings.welcomeMessage;

  const sAdminId = document.getElementById("support-admin-id-val");
  const sAdminUser = document.getElementById("support-admin-user-val");
  const sLinkBtn = document.getElementById("support-link-btn");
  if (sAdminId) sAdminId.textContent = storeSettings.supportAdminId || "6882165252";
  if (sAdminUser) sAdminUser.textContent = storeSettings.supportUsername || "@FADigitalAdmin";
  if (sLinkBtn && storeSettings.supportUsername) {
    sLinkBtn.href = "https://t.me/" + storeSettings.supportUsername.replace("@", "");
  }
}

function openAuthModal() {
  document.getElementById("modal-auth").classList.remove("hidden");
  hideAuthMessages();
}

function closeAuthModal() {
  document.getElementById("modal-auth").classList.add("hidden");
}

function switchAuthMode(mode) {
  hideAuthMessages();
  const title = document.getElementById("auth-modal-title");
  const tabLogin = document.getElementById("auth-tab-login");
  const tabSignup = document.getElementById("auth-tab-signup");
  const formLogin = document.getElementById("form-auth-login");
  const formSignup = document.getElementById("form-auth-signup");

  if (mode === 'login') {
    title.textContent = "লগইন করুন (Sign In)";
    tabLogin.className = "flex-1 py-2 rounded-xl transition bg-emerald-500 text-black shadow-md shadow-emerald-500/20";
    tabSignup.className = "flex-1 py-2 rounded-xl transition text-slate-400 hover:text-white";
    formLogin.classList.remove("hidden");
    formSignup.classList.add("hidden");
  } else {
    title.textContent = "নতুন একাউন্ট খুলুন (Sign Up)";
    tabSignup.className = "flex-1 py-2 rounded-xl transition bg-emerald-500 text-black shadow-md shadow-emerald-500/20";
    tabLogin.className = "flex-1 py-2 rounded-xl transition text-slate-400 hover:text-white";
    formSignup.classList.remove("hidden");
    formLogin.classList.add("hidden");
  }
}

function hideAuthMessages() {
  const err = document.getElementById("auth-error-box");
  const succ = document.getElementById("auth-success-box");
  if (err) err.classList.add("hidden");
  if (succ) succ.classList.add("hidden");
}

function handleAuthLogin(e) {
  e.preventDefault();
  hideAuthMessages();

  const email = document.getElementById("auth-login-email").value.trim().toLowerCase();
  const pass = document.getElementById("auth-login-pass").value.trim();
  const errBox = document.getElementById("auth-error-box");

  if (email === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASSWORD) {
    currentUser = {
      userId: ADMIN_UID,
      firstName: "Abdullah Fahim (Admin)",
      username: "FADigitalAdmin",
      email: ADMIN_EMAIL,
      balance: 9999.0,
      totalSpent: 0.0,
      referralEarnings: 0.0,
      isAdmin: true,
      role: 'admin'
    };
    saveLocalState();
    updateUserUI();
    closeAuthModal();
    alert("এডমিন লগইন সফল হয়েছে!");
    openAdminModal();
    return;
  }

  const found = registeredUsers.find(u => u.email.toLowerCase() === email && u.password === pass);
  if (found) {
    currentUser = { ...currentUser, ...found, isAdmin: false, role: 'user' };
    saveLocalState();
    updateUserUI();
    closeAuthModal();
    alert("স্বাগতম " + found.firstName + "!");
    return;
  }

  if (errBox) {
    errBox.textContent = "ইমেইল বা পাসওয়ার্ড ভুল হয়েছে!";
    errBox.classList.remove("hidden");
  }
}

function handleAuthSignup(e) {
  e.preventDefault();
  hideAuthMessages();

  const name = document.getElementById("auth-signup-name").value.trim();
  const email = document.getElementById("auth-signup-email").value.trim().toLowerCase();
  const pass = document.getElementById("auth-signup-pass").value.trim();
  const tg = document.getElementById("auth-signup-tg").value.replace("@", "").trim();
  const errBox = document.getElementById("auth-error-box");

  if (email === ADMIN_EMAIL.toLowerCase()) {
    if (errBox) {
      errBox.textContent = "এই ইমেইলটি এডমিন অ্যাকাউন্ট হিসেবে সংরক্ষিত!";
      errBox.classList.remove("hidden");
    }
    return;
  }

  if (registeredUsers.some(u => u.email.toLowerCase() === email)) {
    if (errBox) {
      errBox.textContent = "এই ইমেইলটি দিয়ে ইতিমধ্যেই একাউন্ট খোলা হয়েছে!";
      errBox.classList.remove("hidden");
    }
    return;
  }

  const newUser = {
    userId: "user_" + Date.now().toString().slice(-6),
    firstName: name,
    email: email,
    password: pass,
    username: tg,
    balance: 0.0,
    totalSpent: 0.0,
    referralEarnings: 0.0,
    isAdmin: false,
    role: 'user'
  };

  registeredUsers.push(newUser);
  currentUser = { ...currentUser, ...newUser };
  saveLocalState();
  if (db) db.ref("users/" + newUser.userId).set(newUser);

  updateUserUI();
  closeAuthModal();
  alert("একাউন্ট সফলভাবে তৈরি হয়েছে!");
}

function logoutUser() {
  currentUser = {
    userId: "guest_" + Math.floor(100000 + Math.random() * 900000),
    firstName: "Guest User",
    username: "",
    email: "",
    balance: 0.0,
    totalSpent: 0.0,
    referralEarnings: 0.0,
    activeCouponCode: "",
    isAdmin: false,
    role: 'user'
  };
  saveLocalState();
  updateUserUI();
  closeAdminModal();
  alert("লগআউট সফল হয়েছে");
}

function openAdminModal() {
  const modal = document.getElementById("modal-admin");
  const loginBox = document.getElementById("admin-login-box");
  const dashBox = document.getElementById("admin-dash-box");

  modal.classList.remove("hidden");

  if (isSuperAdmin()) {
    loginBox.classList.add("hidden");
    dashBox.classList.remove("hidden");
    loadAdminDashboard();
  } else {
    loginBox.classList.remove("hidden");
    dashBox.classList.add("hidden");
  }
}

function closeAdminModal() {
  document.getElementById("modal-admin").classList.add("hidden");
}

function loginAdmin() {
  const email = (document.getElementById("admin-auth-email-input")?.value || "").trim().toLowerCase();
  const pass = (document.getElementById("admin-pass-input")?.value || "").trim();

  if (
    (email === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASSWORD) ||
    pass === ADMIN_PASSWORD ||
    pass === storeSettings.adminPassword
  ) {
    currentUser = {
      ...currentUser,
      userId: ADMIN_UID,
      email: ADMIN_EMAIL,
      firstName: "Abdullah Fahim (Admin)",
      isAdmin: true,
      role: 'admin'
    };
    saveLocalState();
    updateUserUI();

    document.getElementById("admin-login-box").classList.add("hidden");
    document.getElementById("admin-dash-box").classList.remove("hidden");
    loadAdminDashboard();
  } else {
    alert("ভুল এডমিন তথ্য দেওয়া হয়েছে!");
  }
}

function switchAdminTab(tabId, el) {
  document.querySelectorAll(".ad-subview").forEach(v => v.classList.add("hidden"));
  document.querySelectorAll(".ad-tab-btn").forEach(b => {
    b.classList.remove("bg-purple-600", "text-white");
    b.classList.add("bg-slate-800", "text-slate-300");
  });

  const targetView = document.getElementById(tabId);
  if (targetView) targetView.classList.remove("hidden");

  if (el) {
    el.classList.add("bg-purple-600", "text-white");
    el.classList.remove("bg-slate-800", "text-slate-300");
  }
}

function loadAdminDashboard() {
  const pList = document.getElementById("admin-pending-deposits-list");
  const pDeps = deposits.filter(d => d.status === 'pending');
  if (pList) {
    if (pDeps.length === 0) {
      pList.innerHTML = '<p class="text-xs text-slate-500 py-2">কোনো পেন্ডিং ডিপোজিট নেই</p>';
    } else {
      pList.innerHTML = pDeps.map(d => `
        <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span class="font-bold text-white">${d.amount} BDT</span> - <span class="text-slate-300">${d.userName}</span>
            <p class="text-[10px] text-slate-400 font-mono">TrxID: ${d.trxId} (${d.method})</p>
          </div>
          <div class="flex gap-2">
            <button onclick="adminApproveDeposit('${d.id}')" class="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition">Approve</button>
            <button onclick="adminRejectDeposit('${d.id}')" class="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition">Reject</button>
          </div>
        </div>
      `).join('');
    }
  }

  const sSelect = document.getElementById("stock-target-prod");
  if (sSelect) {
    sSelect.innerHTML = products.map(p => '<option value="' + p.id + '">' + p.name + ' (' + p.price + ' BDT)</option>').join('');
  }

  const pTable = document.getElementById("admin-products-table");
  if (pTable) {
    pTable.innerHTML = products.map(p => {
      const stockCount = stocks.filter(s => s.productId === p.id && !s.isSold).length;
      return `
        <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span class="font-bold text-white">${p.name}</span>
            <span class="text-emerald-400 font-semibold ml-2">${p.price} BDT</span>
            <span class="text-[10px] text-slate-400 ml-2">Stock: ${stockCount}</span>
          </div>
          <button onclick="adminDeleteProduct('${p.id}')" class="px-2 py-1 bg-rose-950 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] hover:bg-rose-900">Delete</button>
        </div>
      `;
    }).join('');
  }

  const gApi = document.getElementById("ad-set-rp-api");
  const gDev = document.getElementById("ad-set-rp-dev");
  const gUrl = document.getElementById("ad-set-rp-url");
  const gBkash = document.getElementById("ad-set-bkash");
  const gNagad = document.getElementById("ad-set-nagad");
  const gRocket = document.getElementById("ad-set-rocket");

  if (gApi) gApi.value = storeSettings.rupantorpayApiKey || "";
  if (gDev) gDev.value = storeSettings.rupantorpayDeviceKey || "";
  if (gUrl) gUrl.value = storeSettings.rupantorpayBaseUrl || "";
  if (gBkash) gBkash.value = storeSettings.bkashNumber || "";
  if (gNagad) gNagad.value = storeSettings.nagadNumber || "";
  if (gRocket) gRocket.value = storeSettings.rocketNumber || "";

  const sId = document.getElementById("ad-set-sup-id");
  const sUser = document.getElementById("ad-set-sup-user");
  const sChan = document.getElementById("ad-set-sup-chan");
  const sGrp = document.getElementById("ad-set-sup-grp");
  const sCom = document.getElementById("ad-set-commission");

  if (sId) sId.value = storeSettings.supportAdminId || "6882165252";
  if (sUser) sUser.value = storeSettings.supportUsername || "@FADigitalAdmin";
  if (sChan) sChan.value = storeSettings.supportChannel || "";
  if (sGrp) sGrp.value = storeSettings.supportGroup || "";
  if (sCom) sCom.value = storeSettings.affiliateCommission || 10;

  const nWelcome = document.getElementById("ad-set-welcome");
  const nSliding = document.getElementById("ad-set-sliding");
  if (nWelcome) nWelcome.value = storeSettings.welcomeMessage || "";
  if (nSliding) nSliding.value = storeSettings.slidingNotice || "";

  const cTable = document.getElementById("admin-coupons-table");
  if (cTable) {
    cTable.innerHTML = coupons.map(c => `
      <div class="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="font-bold text-emerald-400 font-mono">${c.code}</span>
          <span class="text-slate-300 ml-2">(${c.discountPercent}% Off)</span>
        </div>
        <button onclick="adminDeleteCoupon('${c.id}')" class="px-2 py-0.5 bg-rose-950 text-rose-300 rounded text-[10px]">Delete</button>
      </div>
    `).join('');
  }
}

function adminApproveDeposit(id) {
  const d = deposits.find(x => x.id === id);
  if (!d) return;

  d.status = 'approved';
  if (d.userId === currentUser.userId) {
    currentUser.balance = (currentUser.balance || 0) + d.amount;
  }

  saveLocalState();
  if (db) {
    db.ref("deposits/" + id).set(d);
    db.ref("users/" + d.userId + "/balance").transaction(b => (b || 0) + d.amount);
  }

  updateUserUI();
  loadAdminDashboard();
  alert("ডিপোজিট অ্যাপ্রুভ করা হয়েছে এবং ব্যালেন্স যুক্ত করা হয়েছে!");
}

function adminRejectDeposit(id) {
  const d = deposits.find(x => x.id === id);
  if (!d) return;

  d.status = 'rejected';
  saveLocalState();
  if (db) db.ref("deposits/" + id).set(d);

  loadAdminDashboard();
  alert("ডিপোজিট বাতিল করা হয়েছে!");
}

function triggerRupantorPayAuto() {
  const amt = parseFloat(document.getElementById("deposit-amount-input").value) || 100;
  const baseUrl = storeSettings.rupantorpayBaseUrl || "https://rupantorpay.com/api/checkout";
  const apiKey = storeSettings.rupantorpayApiKey || "uiiZWFJTTKDzmYeRuUwcClCqYy2VB1Rz60CwVBpNpFT2jayTXU";
  const deviceKey = storeSettings.rupantorpayDeviceKey || "f5Iwkh35f6ghWNRX40ikY6wZiDTAgc23peymcOUx";
  
  const paymentUrl = `${baseUrl}?api_key=${encodeURIComponent(apiKey)}&device_key=${encodeURIComponent(deviceKey)}&amount=${amt}&uid=${encodeURIComponent(currentUser.userId)}&redirect_url=${encodeURIComponent(window.location.href)}`;

  closeDepositModal();
  openInAppViewer("RupantorPay Auto Checkout", paymentUrl);
}

function adminAddProduct() {
  const name = document.getElementById("new-prod-name").value.trim();
  const price = parseFloat(document.getElementById("new-prod-price").value);
  const cat = document.getElementById("new-prod-cat") ? document.getElementById("new-prod-cat").value : "mail";
  const codeUrl = document.getElementById("new-prod-code-url") ? document.getElementById("new-prod-code-url").value.trim() : "";

  if (!name || isNaN(price) || price <= 0) {
    alert("সঠিক তথ্য ইনপুট দিন!");
    return;
  }

  const p = {
    id: "prod_" + Date.now(),
    name,
    category: cat,
    price,
    description: "100% verified & instant delivery.",
    code_web_url: codeUrl,
    is_active: true,
    createdAt: Date.now()
  };

  products.unshift(p);
  saveLocalState();
  if (db) db.ref("products/" + p.id).set(p);

  document.getElementById("new-prod-name").value = "";
  document.getElementById("new-prod-price").value = "";

  renderProducts();
  loadAdminDashboard();
  alert("প্রোডাক্ট যোগ করা হয়েছে!");
}

function adminDeleteProduct(id) {
  if (!confirm("আপনি কি নিশ্চিত এটি মুছতে চান?")) return;
  products = products.filter(p => p.id !== id);
  saveLocalState();
  if (db) db.ref("products/" + id).remove();
  renderProducts();
  loadAdminDashboard();
}

function adminAddStockBulk() {
  const prodId = document.getElementById("stock-target-prod").value;
  const txt = document.getElementById("bulk-stock-input").value;
  const lines = txt.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  if (!prodId) {
    alert("প্রোডাক্ট সিলেক্ট করুন!");
    return;
  }
  if (lines.length === 0) {
    alert("স্টক পেস্ট করুন!");
    return;
  }

  lines.forEach(l => {
    const s = {
      id: "stk_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      productId: prodId,
      content: l,
      isSold: false
    };
    stocks.push(s);
    if (db) db.ref("stock/" + s.id).set(s);
  });

  saveLocalState();
  document.getElementById("bulk-stock-input").value = "";
  renderProducts();
  loadAdminDashboard();
  alert(lines.length + " টি স্টক লোড করা হয়েছে!");
}

function adminSaveGatewaySettings() {
  storeSettings.rupantorpayApiKey = document.getElementById("ad-set-rp-api").value.trim();
  storeSettings.rupantorpayDeviceKey = document.getElementById("ad-set-rp-dev").value.trim();
  storeSettings.rupantorpayBaseUrl = document.getElementById("ad-set-rp-url").value.trim();
  storeSettings.bkashNumber = document.getElementById("ad-set-bkash").value.trim();
  storeSettings.nagadNumber = document.getElementById("ad-set-nagad").value.trim();
  storeSettings.rocketNumber = document.getElementById("ad-set-rocket").value.trim();

  saveLocalState();
  if (db) db.ref("settings").update(storeSettings);
  updateSettingsUI();
  alert("গেটওয়ে সেটিংস সেভ করা হয়েছে!");
}

function adminSaveSupportSettings() {
  storeSettings.supportAdminId = document.getElementById("ad-set-sup-id").value.trim();
  storeSettings.supportUsername = document.getElementById("ad-set-sup-user").value.trim();
  storeSettings.supportChannel = document.getElementById("ad-set-sup-chan").value.trim();
  storeSettings.supportGroup = document.getElementById("ad-set-sup-grp").value.trim();
  storeSettings.affiliateCommission = parseFloat(document.getElementById("ad-set-commission").value) || 10;

  saveLocalState();
  if (db) db.ref("settings").update(storeSettings);
  updateSettingsUI();
  alert("সাপোর্ট তথ্য সেভ করা হয়েছে!");
}

function adminSaveNoticeSettings() {
  storeSettings.welcomeMessage = document.getElementById("ad-set-welcome").value.trim();
  storeSettings.slidingNotice = document.getElementById("ad-set-sliding").value.trim();

  saveLocalState();
  if (db) db.ref("settings").update(storeSettings);
  updateSettingsUI();
  alert("নোটিশ সেভ করা হয়েছে!");
}

function adminAddCoupon() {
  const code = document.getElementById("new-coup-code").value.trim().toUpperCase();
  const pct = parseFloat(document.getElementById("new-coup-pct").value);

  if (!code || isNaN(pct) || pct <= 0) {
    alert("কুপন কোড ও ডিসকাউন্ট লিখুন!");
    return;
  }

  const c = {
    id: "coup_" + Date.now(),
    code,
    categoryTarget: "all",
    discountPercent: pct,
    isActive: true,
    createdAt: Date.now()
  };

  coupons.unshift(c);
  saveLocalState();
  if (db) db.ref("coupons/" + c.id).set(c);

  document.getElementById("new-coup-code").value = "";
  document.getElementById("new-coup-pct").value = "";
  loadAdminDashboard();
  alert("কুপন তৈরি করা হয়েছে!");
}

function adminDeleteCoupon(id) {
  coupons = coupons.filter(c => c.id !== id);
  saveLocalState();
  if (db) db.ref("coupons/" + id).remove();
  loadAdminDashboard();
}

function filterCategory(cat, evt) {
  selectedCategory = cat;
  document.querySelectorAll(".cat-pill").forEach(el => {
    el.classList.remove("bg-emerald-500", "text-black", "font-bold");
    el.classList.add("bg-slate-900", "text-slate-300");
  });
  if (evt && evt.currentTarget) {
    evt.currentTarget.classList.add("bg-emerald-500", "text-black", "font-bold");
  }
  renderProducts();
}

function renderProducts() {
  const container = document.getElementById("products-grid");
  if (!container) return;

  const searchVal = (document.getElementById("prod-search-input")?.value || "").toLowerCase();

  const filtered = products.filter(p => {
    if (!p.is_active) return false;
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchVal);
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="col-span-2 text-center py-10 text-slate-500 text-xs">কোনো প্রোডাক্ট পাওয়া যায়নি</div>';
    return;
  }

  container.innerHTML = filtered.map(p => {
    const stockCount = stocks.filter(s => s.productId === p.id && !s.isSold).length;
    const isOut = stockCount === 0;

    let catIcon = "✉️";
    if (p.category === 'proxy') catIcon = "⚡";
    else if (p.category === 'vpn') catIcon = "🛡️";
    else if (p.category === 'other') catIcon = "📦";

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 hover:border-slate-700 transition flex flex-col justify-between">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-semibold flex items-center gap-1">
              <span>${catIcon}</span>
              <span class="capitalize">${p.category}</span>
            </span>
            <span class="text-xs font-mono font-bold ${isOut ? 'text-rose-400 bg-rose-500/10 border border-rose-500/30' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'} px-2.5 py-0.5 rounded-full">
              ${isOut ? 'স্টক নেই' : stockCount + ' টি স্টক'}
            </span>
          </div>

          <h3 class="text-base font-bold text-white leading-snug">${p.name}</h3>
          <p class="text-xs text-slate-400 leading-relaxed">${p.description}</p>
        </div>

        <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <div>
            <span class="text-[10px] text-slate-400 uppercase tracking-wider block">মূল্য</span>
            <span class="text-lg font-extrabold text-emerald-400 font-mono">${p.price} BDT</span>
          </div>

          <button onclick="buyProduct('${p.id}')" ${isOut ? 'disabled' : ''} class="px-5 py-2.5 rounded-2xl font-extrabold text-xs transition active:scale-95 ${isOut ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-lg shadow-emerald-500/20 hover:scale-102'}">
            ${isOut ? 'স্টক শেষ' : 'কিনুন (Buy Now)'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function buyProduct(prodId) {
  const p = products.find(x => x.id === prodId);
  if (!p) return;

  const stockItem = stocks.find(s => s.productId === prodId && !s.isSold);
  if (!stockItem) {
    alert("দুঃখিত, স্টক শেষ হয়ে গেছে!");
    return;
  }

  if ((currentUser.balance || 0) < p.price) {
    alert(`পর্যাপ্ত ব্যালেন্স নেই! প্রয়োজন ${p.price} BDT, আপনার আছে ${currentUser.balance.toFixed(2)} BDT.`);
    openDepositModal();
    return;
  }

  currentUser.balance = parseFloat((currentUser.balance - p.price).toFixed(2));
  currentUser.totalSpent = parseFloat(((currentUser.totalSpent || 0) + p.price).toFixed(2));
  stockItem.isSold = true;
  stockItem.soldTo = currentUser.userId;
  stockItem.soldAt = Date.now();

  const newOrder = {
    id: "ord_" + Date.now(),
    userId: currentUser.userId,
    userName: currentUser.firstName,
    productId: p.id,
    productName: p.name,
    category: p.category,
    price: p.price,
    deliveredContent: stockItem.content,
    createdAt: Date.now()
  };

  orders.unshift(newOrder);
  saveLocalState();

  if (db) {
    db.ref("users/" + currentUser.userId).update({
      balance: currentUser.balance,
      totalSpent: currentUser.totalSpent
    });
    db.ref("stock/" + stockItem.id).update({
      isSold: true,
      soldTo: currentUser.userId,
      soldAt: stockItem.soldAt
    });
    db.ref("orders/" + newOrder.id).set(newOrder);
  }

  updateUserUI();
  renderProducts();
  showDeliveryModal(p.name, stockItem.content);
}

function showDeliveryModal(name, content) {
  document.getElementById("delivery-prod-name").textContent = name;
  document.getElementById("delivery-content-box").textContent = content;
  document.getElementById("modal-delivery").classList.remove("hidden");
}

function closeDeliveryModal() {
  document.getElementById("modal-delivery").classList.add("hidden");
}

function copyDeliveryContent() {
  const txt = document.getElementById("delivery-content-box").textContent;
  navigator.clipboard.writeText(txt).then(() => {
    alert("কপি করা হয়েছে!");
  });
}

function openDepositModal() {
  document.getElementById("modal-deposit").classList.remove("hidden");
}

function closeDepositModal() {
  document.getElementById("modal-deposit").classList.add("hidden");
}

function setDepositAmount(amt) {
  document.getElementById("deposit-amount-input").value = amt;
}

function submitManualDeposit() {
  const amt = parseFloat(document.getElementById("deposit-amount-input").value);
  const trx = document.getElementById("manual-trx-input").value.trim().toUpperCase();

  if (!amt || amt < 10) {
    alert("সর্বনিম্ন ১০ টাকা ডিপোজিট করতে হবে!");
    return;
  }
  if (!trx || trx.length < 6) {
    alert("সঠিক TrxID ইনপুট দিন!");
    return;
  }

  const dep = {
    id: "dep_" + Date.now(),
    userId: currentUser.userId,
    userName: currentUser.firstName,
    method: "bKash / Nagad",
    amount: amt,
    trxId: trx,
    status: "pending",
    isGateway: false,
    createdAt: Date.now()
  };

  deposits.unshift(dep);
  saveLocalState();
  if (db) db.ref("deposits/" + dep.id).set(dep);

  document.getElementById("manual-trx-input").value = "";
  closeDepositModal();
  alert("ডিপোজিট রিকোয়েস্ট জমা হয়েছে! এডমিন ভেরিফাই করবে।");
}

function openCouponModal() { document.getElementById("modal-coupon").classList.remove("hidden"); }
function closeCouponModal() { document.getElementById("modal-coupon").classList.add("hidden"); }

function applyCouponNow() {
  const code = document.getElementById("coupon-code-input").value.trim().toUpperCase();
  const c = coupons.find(x => x.code === code && x.isActive);
  if (!c) {
    alert("ভুল বা নিষ্ক্রিয় কুপন কোড!");
    return;
  }

  currentUser.activeCouponCode = code;
  saveLocalState();
  closeCouponModal();
  alert("কুপন প্রয়োগ করা হয়েছে! " + c.discountPercent + "% ডিসকাউন্ট পাবেন।");
  renderProducts();
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-view").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(el => {
    el.classList.remove("active", "bg-emerald-500", "text-black", "font-bold");
    el.classList.add("bg-slate-900", "border-slate-800", "text-slate-300");
  });

  const activeView = document.getElementById("view-" + tabId);
  const activeBtn = document.getElementById("tab-btn-" + tabId);
  if (activeView) activeView.classList.remove("hidden");
  if (activeBtn) {
    activeBtn.classList.add("active", "bg-emerald-500", "text-black", "font-bold");
    activeBtn.classList.remove("bg-slate-900", "border-slate-800", "text-slate-300");
  }

  if (tabId === 'profile') renderProfileHistory();
}

function renderProfileHistory() {
  const ordBox = document.getElementById("orders-list-box");
  if (ordBox) {
    if (orders.length === 0) {
      ordBox.innerHTML = '<p class="text-xs text-slate-500 py-2">কোনো কেনাকাটার ইতিহাস নেই</p>';
    } else {
      ordBox.innerHTML = orders.slice(0, 10).map(o => `
        <div class="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
          <div class="flex justify-between font-bold text-white">
            <span>${o.productName}</span>
            <span class="text-emerald-400">${o.price} BDT</span>
          </div>
          <div class="p-2 bg-slate-900 rounded-xl text-[11px] font-mono text-emerald-400 break-all select-all">
            ${o.deliveredContent}
          </div>
        </div>
      `).join('');
    }
  }

  const depBox = document.getElementById("deposits-list-box");
  if (depBox) {
    if (deposits.length === 0) {
      depBox.innerHTML = '<p class="text-xs text-slate-500 py-2">কোনো ডিপোজিট ইতিহাস নেই</p>';
    } else {
      depBox.innerHTML = deposits.slice(0, 10).map(d => {
        let badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/30";
        if (d.status === 'approved') badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        else if (d.status === 'rejected') badgeClass = "bg-rose-500/20 text-rose-400 border-rose-500/30";

        return `
          <div class="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs flex justify-between items-center">
            <div>
              <span class="font-bold text-white">${d.amount} BDT (${d.method})</span>
              <p class="text-[10px] text-slate-400 font-mono">TrxID: ${d.trxId}</p>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">
              ${d.status.toUpperCase()}
            </span>
          </div>
        `;
      }).join('');
    }
  }
}

function base32toHex(base32) {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let hex = "";
  const clean = base32.replace(/=+$/, "").toUpperCase();

  for (let i = 0; i < clean.length; i++) {
    const val = base32chars.indexOf(clean.charAt(i));
    if (val >= 0) {
      bits += val.toString(2).padStart(5, "0");
    }
  }
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substr(i, 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex;
}

async function generateTOTPCode(secret) {
  try {
    const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();
    if (!cleanSecret) return "------";

    const keyHex = base32toHex(cleanSecret);
    if (!keyHex) return "------";

    const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / 30);

    const timeBytes = new Uint8Array(8);
    let temp = timeStep;
    for (let i = 7; i >= 0; i--) {
      timeBytes[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: { name: "SHA-1" } },
      false,
      ["sign"]
    );

    const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, timeBytes);
    const hmac = new Uint8Array(signature);
    const offset = hmac[hmac.length - 1] & 0x0f;

    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, "0");
  } catch (e) {
    return "------";
  }
}

function startTotpLoop() {
  setInterval(async () => {
    const input = document.getElementById("totp-secret-input");
    const display = document.getElementById("totp-code-display");
    const bar = document.getElementById("totp-progress-bar");

    const epoch = Math.floor(Date.now() / 1000);
    const remaining = 30 - (epoch % 30);
    if (bar) bar.style.width = ((remaining / 30) * 100) + "%";

    if (input && input.value.trim() && display) {
      const code = await generateTOTPCode(input.value.trim());
      display.textContent = code;
    }
  }, 1000);
}

function copyTotpCode() {
  const code = document.getElementById("totp-code-display").textContent.trim();
  if (code && code !== "------") {
    navigator.clipboard.writeText(code).then(() => {
      alert("2FA কোড কপি করা হয়েছে: " + code);
    });
  }
}

function openInAppViewer(title, url) {
  document.getElementById("inapp-viewer-title").textContent = title;
  document.getElementById("inapp-viewer-frame").src = url;
  document.getElementById("modal-inapp").classList.remove("hidden");
}

function closeInAppViewer() {
  document.getElementById("inapp-viewer-frame").src = "about:blank";
  document.getElementById("modal-inapp").classList.add("hidden");
}

function copyAdminId() {
  const aid = storeSettings.supportAdminId || "6882165252";
  navigator.clipboard.writeText(aid).then(() => alert("Support Admin ID copied: " + aid));
}

function copyAffiliateLink() {
  const link = document.getElementById("affiliate-link-input").value;
  navigator.clipboard.writeText(link).then(() => alert("Invite link copied: " + link));
}

function setLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll("[id^='lang-btn-']").forEach(b => {
    b.className = "px-2 py-1 rounded-lg text-slate-400 hover:text-white";
  });
  const activeBtn = document.getElementById("lang-btn-" + lang);
  if (activeBtn) activeBtn.className = "px-2 py-1 rounded-lg bg-emerald-500 text-black";
  renderProducts();
}

function getDefaultProducts() {
  return [
    { id: "p1", name: "Gmail Verified 2023 Fresh", category: "mail", price: 18.0, description: "100% verified Gmail with 2FA & recovery POP3.", is_active: true },
    { id: "p2", name: "Hotmail / Outlook Pop3 Enabled", category: "mail", price: 7.5, description: "Instant OTP delivery, aged mail.", is_active: true },
    { id: "p3", name: "USA Residential Rotating Proxy (1GB)", category: "proxy", price: 95.0, description: "Ultra-fast 5G residential IP with Socks5/HTTP.", is_active: true },
    { id: "p4", name: "NordVPN Premium (1 Month)", category: "vpn", price: 140.0, description: "Worldwide high-speed streaming servers.", is_active: true }
  ];
}

function getDefaultStocks() {
  return [
    { id: "s1", productId: "p1", content: "sarah.smith2023@gmail.com:Pass2026:rec@mail.com:2FA_JBSWY3DPEHPK3PXP", isSold: false },
    { id: "s2", productId: "p2", content: "alex.hunter@outlook.com:HotmailPass_987", isSold: false },
    { id: "s3", productId: "p3", content: "us.res-proxy.net:1080:user_fa:pass_fa", isSold: false },
    { id: "s4", productId: "p4", content: "nord_user981@fastmail.com:NordPass2026#Win", isSold: false }
  ];
}

function getDefaultCoupons() {
  return [
    { id: "c1", code: "WELCOME10", categoryTarget: "all", discountPercent: 10, isActive: true },
    { id: "c2", code: "MAIL20", categoryTarget: "mail", discountPercent: 20, isActive: true }
  ];
}

document.addEventListener("DOMContentLoaded", initApp);
