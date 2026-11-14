// App state
let currentAccounts = [];
let activeAccountId = null;

// DOM Elements
const accountsListEl = document.getElementById('accountsList');
const btnAddAccount = document.getElementById('btnAddAccount');
const btnAutoText = document.getElementById('btnAutoText');
const btnReload = document.getElementById('btnReload');
const btnNotificationSettings = document.getElementById('btnNotificationSettings');
const btnToggleBlur = document.getElementById('btnToggleBlur');
const btnHelp = document.getElementById('btnHelp');

const api = window.republikAPI;

let currentNotifSettings = { enabled: true, showBadge: true };

// Initialize
async function init() {
  const data = await api.getAccounts();
  currentAccounts = data.accounts;
  activeAccountId = data.activeAccountId;
  renderAccounts();

  // Load and apply notification settings
  try {
    currentNotifSettings = await api.getNotificationSettings();
    updateNotificationButtonState(currentNotifSettings);
  } catch (e) {}

  // Listen to badge updates
  api.onBadgeUpdate(({ accountId, count }) => {
    if (currentNotifSettings && currentNotifSettings.showBadge === false) {
      updateBadge(accountId, 0);
    } else {
      updateBadge(accountId, count);
    }
  });

  // Listen to accounts list changes
  api.onAccountsChanged((data) => {
    currentAccounts = data.accounts;
    activeAccountId = data.activeAccountId;
    renderAccounts();
  });

  // Listen to live notification settings changes
  if (api.onNotificationSettingsChanged) {
    api.onNotificationSettingsChanged((settings) => {
      currentNotifSettings = settings;
      updateNotificationButtonState(settings);
      if (settings && settings.showBadge === false) {
        document.querySelectorAll('.account-badge').forEach(el => el.classList.remove('show'));
      }
    });
  }

  setupEventListeners();
}

function updateNotificationButtonState(settings) {
  if (!btnNotificationSettings) return;
  const isEnabled = settings && settings.enabled !== false;
  btnNotificationSettings.classList.toggle('muted', !isEnabled);
  btnNotificationSettings.title = isEnabled
    ? 'Pengaturan Notifikasi Universal (Aktif)'
    : 'Pengaturan Notifikasi Universal (Dimatikan / Jangan Ganggu)';
}

const PLATFORM_ICONS = {
  whatsapp: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>`,
  telegram: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>`,
  gmail: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`
};

function renderAccounts() {
  accountsListEl.innerHTML = '';

  currentAccounts.forEach((acc) => {
    const item = document.createElement('div');
    item.className = `account-item ${acc.id === activeAccountId ? 'active' : ''}`;
    item.dataset.id = acc.id;
    const platform = acc.platform || 'whatsapp';
    item.title = `${acc.name} [${platform.toUpperCase()}] (Klik kanan untuk opsi)`;

    let iconHtml = '';
    const hasCustomIcon = Boolean(acc.icon && typeof acc.icon === 'string' && acc.icon.trim());

    if (hasCustomIcon) {
      const iconStr = acc.icon.trim();
      if (iconStr.startsWith('data:image/') || iconStr.startsWith('http') || iconStr.startsWith('file://')) {
        iconHtml = `<img src="${iconStr}" class="account-custom-img" alt="${acc.name}">`;
      } else {
        // Emoji or text symbol
        iconHtml = `<span class="account-custom-emoji">${iconStr}</span>`;
      }
    } else {
      // Default: Clean, prominent official platform icon!
      const platformIconSvg = PLATFORM_ICONS[platform] || PLATFORM_ICONS.whatsapp;
      iconHtml = `<div class="account-main-icon">${platformIconSvg}</div>`;
    }

    // Platform sub-badge: only shown when a custom icon is active so the user can still recognize the platform
    const platformBadgeHtml = hasCustomIcon ? `
      <div class="account-platform-badge" title="${platform.toUpperCase()}">
        ${PLATFORM_ICONS[platform] || PLATFORM_ICONS.whatsapp}
      </div>
    ` : '';

    item.innerHTML = `
      <div class="account-icon-wrapper">${iconHtml}</div>
      ${platformBadgeHtml}
      <div class="account-badge" id="badge_${acc.id}">0</div>
    `;

    // Apply account custom color background
    if (acc.color) {
      item.style.backgroundColor = acc.color;
    }

    // Click to switch
    item.addEventListener('click', () => {
      switchAccount(acc.id);
    });

    // Right-click for native context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      api.showAccountContextMenu(acc.id);
    });

    accountsListEl.appendChild(item);
  });
}

async function switchAccount(id) {
  if (id === activeAccountId) return;
  activeAccountId = id;

  // Update UI active state immediately
  document.querySelectorAll('.account-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  await api.switchAccount(id);
}

function updateBadge(accountId, count) {
  const badgeEl = document.getElementById(`badge_${accountId}`);
  if (badgeEl) {
    if (count > 0) {
      badgeEl.innerText = count > 99 ? '99+' : count;
      badgeEl.classList.add('show');
    } else {
      badgeEl.classList.remove('show');
    }
  }
}

function setupEventListeners() {
  // Add Account button opens native dialog on top of WhatsApp Web
  btnAddAccount.addEventListener('click', () => {
    api.openAddAccountModal();
  });

  // Reload Active Account
  btnReload.addEventListener('click', () => {
    if (activeAccountId) {
      api.reloadAccount(activeAccountId);
    }
  });

  // Toggle Privacy Blur
  if (btnToggleBlur) {
    btnToggleBlur.addEventListener('click', () => {
      if (api.toggleBlur) {
        api.toggleBlur();
      }
    });
  }

  // Auto Text Manager
  if (btnAutoText) {
    btnAutoText.addEventListener('click', () => {
      api.openAutoTextModal();
    });
  }

  // Universal Notification Settings Modal
  if (btnNotificationSettings) {
    btnNotificationSettings.addEventListener('click', () => {
      api.openNotificationModal();
    });
  }

  // Help & User Guide
  if (btnHelp) {
    btnHelp.addEventListener('click', () => {
      api.openHelpModal();
    });
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
      if (activeAccountId) {
        api.reloadAccount(activeAccountId);
      }
    }
  });
}

init();
