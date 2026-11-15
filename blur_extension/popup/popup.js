/**
 * Blur & Lock Privacy Extension — Popup Controller (Manifest V3)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusBadge = document.getElementById('statusBadge');
  const btnLockNow = document.getElementById('btnLockNow');
  const pinStatusText = document.getElementById('pinStatusText');
  const btnManagePin = document.getElementById('btnManagePin');

  const masterToggle = document.getElementById('masterToggle');
  const intensitySlider = document.getElementById('intensitySlider');
  const intensityDisplay = document.getElementById('intensityDisplay');

  const blurConversation = document.getElementById('blurConversation');
  const blurLatestMessage = document.getElementById('blurLatestMessage');
  const blurChatList = document.getElementById('blurChatList');
  const blurMedia = document.getElementById('blurMedia');
  const blurContactNames = document.getElementById('blurContactNames');
  const blurProfilePhotos = document.getElementById('blurProfilePhotos');
  const blurGroupInfo = document.getElementById('blurGroupInfo');
  const blurStatusInfo = document.getElementById('blurStatusInfo');
  const unblurOnHover = document.getElementById('unblurOnHover');

  const btnResetDefaults = document.getElementById('btnResetDefaults');

  // PIN Modal Elements
  const pinModalOverlay = document.getElementById('pinModalOverlay');
  const pinModalTitle = document.getElementById('pinModalTitle');
  const pinInputField = document.getElementById('pinInputField');
  const pinModalError = document.getElementById('pinModalError');
  const btnCancelPin = document.getElementById('btnCancelPin');
  const btnSavePin = document.getElementById('btnSavePin');

  let currentSettings = {};

  const DEFAULT_SETTINGS = {
    enabled: true,
    blurIntensity: 10,
    blurChatList: false,
    blurContactNames: true,
    blurProfilePhotos: true,
    blurConversation: false,
    blurMedia: false,
    blurLatestMessage: false,
    blurGroupInfo: true,
    blurStatusInfo: true,
    unblurOnHover: true,
    isLocked: false,
    securityPin: ''
  };

  // Load from chrome.storage.local
  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(null);
      currentSettings = { ...DEFAULT_SETTINGS, ...stored };
      renderUI();
    } catch (e) {
      console.error('[Popup] Error reading storage:', e);
    }
  }

  function renderUI() {
    const s = currentSettings;

    // Status Badge
    if (s.isLocked) {
      statusBadge.textContent = 'TERKUNCI';
      statusBadge.className = 'status-badge off';
      statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      statusBadge.style.color = '#ef4444';
      statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else if (s.enabled !== false) {
      statusBadge.textContent = 'AKTIF';
      statusBadge.className = 'status-badge';
      statusBadge.style.background = '';
      statusBadge.style.color = '';
      statusBadge.style.borderColor = '';
    } else {
      statusBadge.textContent = 'NONAKTIF';
      statusBadge.className = 'status-badge off';
      statusBadge.style.background = '';
      statusBadge.style.color = '';
      statusBadge.style.borderColor = '';
    }

    // PIN Status
    if (s.securityPin && s.securityPin.length >= 4) {
      pinStatusText.textContent = 'PIN Keamanan: Aktif (••••)';
      btnManagePin.textContent = 'Ubah PIN';
    } else {
      pinStatusText.textContent = 'PIN Keamanan: Belum diatur';
      btnManagePin.textContent = 'Atur PIN';
    }

    // Controls
    masterToggle.checked = s.enabled !== false;
    intensitySlider.value = s.blurIntensity || 10;
    intensityDisplay.textContent = (s.blurIntensity || 10) + ' px';

    blurConversation.checked = s.blurConversation === true;
    blurLatestMessage.checked = s.blurLatestMessage !== false;
    blurChatList.checked = s.blurChatList === true;
    blurMedia.checked = s.blurMedia !== false;
    blurContactNames.checked = s.blurContactNames !== false;
    blurProfilePhotos.checked = s.blurProfilePhotos !== false;
    blurGroupInfo.checked = s.blurGroupInfo !== false;
    blurStatusInfo.checked = s.blurStatusInfo !== false;
    unblurOnHover.checked = s.unblurOnHover !== false;
  }

  // Save and broadcast to WhatsApp Web tabs
  async function saveAndBroadcast() {
    currentSettings.enabled = masterToggle.checked;
    currentSettings.blurIntensity = parseInt(intensitySlider.value, 10) || 10;
    currentSettings.blurConversation = blurConversation.checked;
    currentSettings.blurLatestMessage = blurLatestMessage.checked;
    currentSettings.blurChatList = blurChatList.checked;
    currentSettings.blurMedia = blurMedia.checked;
    currentSettings.blurContactNames = blurContactNames.checked;
    currentSettings.blurProfilePhotos = blurProfilePhotos.checked;
    currentSettings.blurGroupInfo = blurGroupInfo.checked;
    currentSettings.blurStatusInfo = blurStatusInfo.checked;
    currentSettings.unblurOnHover = unblurOnHover.checked;

    await chrome.storage.local.set(currentSettings);

    renderUI();

    // Broadcast to content script
    chrome.runtime.sendMessage({
      action: 'SYNC_SETTINGS',
      settings: currentSettings
    }).catch(() => {});
  }

  // Event Listeners for Controls
  masterToggle.addEventListener('change', saveAndBroadcast);

  intensitySlider.addEventListener('input', (e) => {
    intensityDisplay.textContent = e.target.value + ' px';
  });
  intensitySlider.addEventListener('change', saveAndBroadcast);

  [
    blurConversation,
    blurLatestMessage,
    blurChatList,
    blurMedia,
    blurContactNames,
    blurProfilePhotos,
    blurGroupInfo,
    blurStatusInfo,
    unblurOnHover
  ].forEach(input => {
    input.addEventListener('change', saveAndBroadcast);
  });

  // Lock Now Action
  btnLockNow.addEventListener('click', async () => {
    if (!currentSettings.securityPin || currentSettings.securityPin.length < 4) {
      // Must set PIN first
      openPinModal(true);
      return;
    }

    // Trigger Lock
    try {
      await chrome.runtime.sendMessage({ action: 'LOCK_NOW' });
      currentSettings.isLocked = true;
      renderUI();
      // Close popup smoothly
      setTimeout(() => window.close(), 250);
    } catch (e) {
      console.error('Error locking WhatsApp Web:', e);
    }
  });

  // PIN Modal Management
  function openPinModal(isFirstTime = false) {
    pinModalTitle.textContent = isFirstTime ? 'Atur PIN Sebelum Kunci' : (currentSettings.securityPin ? 'Ubah PIN Keamanan' : 'Atur PIN Keamanan');
    pinInputField.value = '';
    pinModalError.textContent = '';
    pinModalOverlay.classList.add('active');
    setTimeout(() => pinInputField.focus(), 100);
  }

  function closePinModal() {
    pinModalOverlay.classList.remove('active');
    pinInputField.value = '';
    pinModalError.textContent = '';
  }

  btnManagePin.addEventListener('click', () => openPinModal(false));
  btnCancelPin.addEventListener('click', closePinModal);

  btnSavePin.addEventListener('click', async () => {
    const val = (pinInputField.value || '').trim();
    if (!/^\d{4}$/.test(val)) {
      pinModalError.textContent = 'Harap masukkan 4 digit angka (0-9).';
      pinInputField.focus();
      return;
    }

    currentSettings.securityPin = val;
    await chrome.storage.local.set({ securityPin: val });
    closePinModal();
    renderUI();
  });

  pinInputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnSavePin.click();
    } else if (e.key === 'Escape') {
      closePinModal();
    }
  });

  // Reset Defaults
  btnResetDefaults.addEventListener('click', async () => {
    if (confirm('Kembalikan semua opsi blur ke pengaturan default?')) {
      const pin = currentSettings.securityPin;
      currentSettings = { ...DEFAULT_SETTINGS, securityPin: pin };
      await chrome.storage.local.set(currentSettings);
      renderUI();
      chrome.runtime.sendMessage({
        action: 'SYNC_SETTINGS',
        settings: currentSettings
      }).catch(() => {});
    }
  });

  // Initial load
  await loadSettings();
});
