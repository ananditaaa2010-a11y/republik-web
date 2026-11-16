/**
 * Blur & Lock Privacy Extension — Content Script (Manifest V3)
 * Operates directly on web.whatsapp.com with zero DOM disturbance
 */

(function () {
  'use strict';

  if (window.__waPrivacyBlurLoaded) {
    return;
  }
  window.__waPrivacyBlurLoaded = true;

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

  let currentSettings = { ...DEFAULT_SETTINGS };

  // ==========================================================================
  // 1. SETTINGS & CSS CLASS CONTROLLER
  // ==========================================================================
  function applySettings(settings) {
    if (settings && typeof settings === 'object') {
      currentSettings = { ...currentSettings, ...settings };
    }

    const s = currentSettings;
    const docEl = document.documentElement;
    const body = document.body;
    if (!docEl || !body) return;

    // Set Dynamic CSS Variables for Adjustable Blur Intensity
    const intensity = Math.max(3, Math.min(30, parseInt(s.blurIntensity, 10) || 10));
    const avatarIntensity = Math.max(4, intensity + 2);
    docEl.style.setProperty('--wa-blur-intensity', `${intensity}px`);
    docEl.style.setProperty('--wa-blur-avatar-intensity', `${avatarIntensity}px`);

    // Master Toggle
    if (s.enabled !== false) {
      body.classList.add('wa-blur-master-enabled');
      body.classList.remove('wa-blur-disabled');
    } else {
      body.classList.remove('wa-blur-master-enabled');
      body.classList.add('wa-blur-disabled');
    }

    // Granular Feature Toggles
    const toggleClass = (cls, cond) => {
      if (cond) body.classList.add(cls);
      else body.classList.remove(cls);
    };

    toggleClass('wa-blur-chat-list', s.blurChatList === true);
    toggleClass('wa-blur-contact-names', s.blurContactNames !== false);
    toggleClass('wa-blur-profile-photos', s.blurProfilePhotos !== false);
    toggleClass('wa-blur-conversation', s.blurConversation === true);
    toggleClass('wa-blur-media', s.blurMedia !== false);
    toggleClass('wa-blur-latest-message', s.blurLatestMessage !== false);
    toggleClass('wa-blur-group-info', s.blurGroupInfo !== false);
    toggleClass('wa-blur-status-info', s.blurStatusInfo !== false);
    toggleClass('wa-blur-hover-reveal', s.unblurOnHover !== false);

    // Lock Screen Status Check
    if (s.isLocked) {
      showLockOverlay();
    } else {
      hideLockOverlay();
    }
  }

  // Load settings from Chrome Extension Storage
  function loadSettingsFromStorage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(null, (items) => {
          if (items) {
            applySettings(items);
          }
        });
      }
    } catch (e) {
      console.warn('[Blur & Lock] Storage access error:', e);
    }
  }

  // Listen for real-time messages from extension popup or background
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'APPLY_SETTINGS') {
        applySettings(message.settings);
        tagAll();
        sendResponse({ success: true });
      } else if (message.action === 'TRIGGER_LOCK') {
        currentSettings.isLocked = true;
        showLockOverlay();
        sendResponse({ success: true });
      }
    });
  }

  // ==========================================================================
  // 2. PIN LOCK SCREEN OVERLAY ENGINE ("LOCK NOW")
  // ==========================================================================
  let lockOverlayEl = null;
  let enteredPin = '';

  function createLockOverlay() {
    if (document.getElementById('wa-privacy-lock-overlay')) {
      lockOverlayEl = document.getElementById('wa-privacy-lock-overlay');
      return;
    }

    lockOverlayEl = document.createElement('div');
    lockOverlayEl.id = 'wa-privacy-lock-overlay';
    lockOverlayEl.className = 'hidden';

    lockOverlayEl.innerHTML = `
      <div class="wa-lock-card" id="waLockCard">
        <div class="wa-lock-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 class="wa-lock-title">WhatsApp Web Terkunci</h2>
        <p class="wa-lock-subtitle">Masukkan 4 digit PIN keamanan Anda untuk membuka akses percakapan.</p>
        
        <div class="wa-lock-dots">
          <div class="wa-lock-dot" data-index="0"></div>
          <div class="wa-lock-dot" data-index="1"></div>
          <div class="wa-lock-dot" data-index="2"></div>
          <div class="wa-lock-dot" data-index="3"></div>
        </div>

        <div class="wa-lock-error" id="waLockError">PIN salah, silakan coba lagi</div>

        <div class="wa-lock-keypad">
          <button class="wa-lock-key" data-num="1">1</button>
          <button class="wa-lock-key" data-num="2">2</button>
          <button class="wa-lock-key" data-num="3">3</button>
          <button class="wa-lock-key" data-num="4">4</button>
          <button class="wa-lock-key" data-num="5">5</button>
          <button class="wa-lock-key" data-num="6">6</button>
          <button class="wa-lock-key" data-num="7">7</button>
          <button class="wa-lock-key" data-num="8">8</button>
          <button class="wa-lock-key" data-num="9">9</button>
          <button class="wa-lock-key action-key" id="waLockClear">C</button>
          <button class="wa-lock-key" data-num="0">0</button>
          <button class="wa-lock-key action-key" id="waLockBackspace">⌫</button>
        </div>

        <div class="wa-lock-hint">
          Proteksi aktif oleh <strong>Blur & Lock Privacy Extension</strong>
        </div>
      </div>
    `;

    document.documentElement.appendChild(lockOverlayEl);

    lockOverlayEl.querySelectorAll('.wa-lock-key[data-num]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        appendPinDigit(btn.dataset.num);
      });
    });

    const clearBtn = lockOverlayEl.querySelector('#waLockClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetPinInput();
      });
    }

    const bsBtn = lockOverlayEl.querySelector('#waLockBackspace');
    if (bsBtn) {
      bsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePinDigit();
      });
    }

    window.addEventListener('keydown', handleLockKeyDown, true);
  }

  function showLockOverlay() {
    if (!lockOverlayEl) {
      createLockOverlay();
    }
    enteredPin = '';
    updatePinDots();
    hideLockError();
    lockOverlayEl.classList.remove('hidden');
  }

  function hideLockOverlay() {
    if (lockOverlayEl) {
      lockOverlayEl.classList.add('hidden');
    }
    enteredPin = '';
  }

  function appendPinDigit(digit) {
    if (enteredPin.length >= 4) return;
    enteredPin += digit;
    updatePinDots();

    if (enteredPin.length === 4) {
      setTimeout(verifyPin, 100);
    }
  }

  function deletePinDigit() {
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      updatePinDots();
      hideLockError();
    }
  }

  function resetPinInput() {
    enteredPin = '';
    updatePinDots();
    hideLockError();
  }

  function updatePinDots() {
    if (!lockOverlayEl) return;
    const dots = lockOverlayEl.querySelectorAll('.wa-lock-dot');
    dots.forEach((dot, idx) => {
      if (idx < enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  function showLockError(msg) {
    if (!lockOverlayEl) return;
    const err = lockOverlayEl.querySelector('#waLockError');
    if (err) {
      if (msg) err.textContent = msg;
      err.classList.add('visible');
    }
    const card = lockOverlayEl.querySelector('#waLockCard');
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
  }

  function hideLockError() {
    if (!lockOverlayEl) return;
    const err = lockOverlayEl.querySelector('#waLockError');
    if (err) err.classList.remove('visible');
  }

  function verifyPin() {
    const savedPin = currentSettings.securityPin || '';
    if (!savedPin || enteredPin === savedPin) {
      currentSettings.isLocked = false;
      hideLockOverlay();
      try {
        window.dispatchEvent(new CustomEvent('wa-privacy-unlocked'));
        window.postMessage({ type: 'wa-privacy-unlocked' }, '*');
      } catch (e) {}
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'UNLOCK_SUCCESS' }).catch(() => {});
      }
    } else {
      showLockError('PIN salah, silakan coba lagi');
      setTimeout(() => {
        resetPinInput();
      }, 500);
    }
  }

  function handleLockKeyDown(e) {
    if (!currentSettings.isLocked || !lockOverlayEl || lockOverlayEl.classList.contains('hidden')) {
      return;
    }
    e.stopPropagation();

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      appendPinDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      deletePinDigit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      resetPinInput();
    }
  }

  // ==========================================================================
  // 3. TARGETED DOM ELEMENT TAGGING
  // ==========================================================================
  function isPhoneNumber(text) {
    if (!text) return false;
    const clean = text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\s]/g, '').trim();
    const digits = clean.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 16) return false;
    return /^(\+?\d{8,16}|08\d{7,14})$/.test(clean.replace(/[\-\(\)\.]/g, '')) ||
           /^(\+?62|08)[0-9\s.-]{7,16}$/.test(text.trim());
  }

  // Header Elements (Profil & Nama Kontak di Atas Percakapan)
  function setupHeaderElements() {
    const mainHeader = document.querySelector('#main header');
    if (!mainHeader) return;

    const headerBtn = mainHeader.querySelector('div[role="button"]') || mainHeader.firstElementChild;
    if (!headerBtn) return;

    const headerAvatar = headerBtn.querySelector('img:not(.emoji)') ||
                         headerBtn.querySelector('._ak8h') ||
                         headerBtn.querySelector('[data-testid="conversation-info-header-chat-avatar"]') ||
                         headerBtn.querySelector('[data-testid="avatar"]') ||
                         headerBtn.firstElementChild;

    if (headerAvatar && !headerAvatar.classList.contains('wa-privacy-header-avatar')) {
      headerAvatar.classList.add('wa-privacy-header-avatar');
    }

    const titleCandidates = headerBtn.querySelectorAll(
      'span[title], div[title], ._ak8q, [data-testid="conversation-info-header-chat-title"], [data-testid="chat-title"]'
    );
    titleCandidates.forEach(el => {
      if (!el.closest('.wa-privacy-header-avatar')) {
        const titleText = el.getAttribute('title') || el.textContent || '';
        if (titleText.includes(',')) {
          if (!el.classList.contains('wa-privacy-group-info')) el.classList.add('wa-privacy-group-info');
        } else {
          if (!el.classList.contains('wa-privacy-header-name')) el.classList.add('wa-privacy-header-name');
        }
      }
    });
  }

  // Drawer Info Kontak (Profil, Nama, Nomor, Grup Yang Sama)
  function setupDrawerElements() {
    const drawer = document.querySelector(
      '[data-animate-drawer-right="true"], [data-animate-drawer-right="false"], [data-animate-drawer-right], .wa-privacy-contact-drawer'
    );
    if (!drawer) return;

    // 1. Header Drawer (Tombol ✕, "Info kontak", Pensil) -> 100% CLEAR
    const drawerHeader = drawer.querySelector('header');
    if (drawerHeader) {
      drawerHeader.classList.add('wa-privacy-drawer-header', 'wa-privacy-clear');
    }

    // Scroll container
    const scrollContainer = (drawerHeader && drawerHeader.nextElementSibling) || drawer;

    // 2. KARTU 1 (Card 1: Profil Kontak di Paling Atas)
    const callBtnEl = drawer.querySelector('[data-icon="audio-call"], [data-icon="video-call"], [data-testid="audio-call-btn"]');
    const card1 = callBtnEl ? (callBtnEl.closest('section') || callBtnEl.parentElement?.parentElement?.parentElement) : (scrollContainer.querySelector('section') || scrollContainer.firstElementChild);

    if (card1) {
      card1.classList.add('wa-privacy-drawer-card1');

      // Proteksi Tombol Panggilan (Suara, Video, Cari) di Card 1 -> 100% CLEAR
      const callButtons = card1.querySelectorAll(
        '[data-icon="audio-call"], [data-icon="video-call"], [data-icon="search"], ' +
        '[data-testid="audio-call-btn"], [data-testid="video-call-btn"], [data-testid="search-btn"]'
      );
      callButtons.forEach(cb => {
        const btnWrapper = cb.closest('div[role="button"]') || cb.closest('button') || cb.parentElement;
        if (btnWrapper) {
          btnWrapper.classList.add('wa-privacy-clear');
          btnWrapper.classList.remove('wa-privacy-card1-avatar', 'wa-privacy-card1-name', 'wa-privacy-card1-number');
        }
      });

      // Foto Profil di Card 1 (HANYA avatar di atas nama)
      const avatarBtn = Array.from(card1.querySelectorAll('div[role="button"]:not(.wa-privacy-clear), img:not(.emoji), div._ak8h')).find(el => {
        return !el.closest('.wa-privacy-clear') &&
               !el.querySelector('[data-icon="audio-call"], [data-icon="video-call"], [data-icon="search"]');
      });

      if (avatarBtn) {
        avatarBtn.classList.add('wa-privacy-card1-avatar');
        const avImg = avatarBtn.querySelector('img');
        if (avImg) avImg.classList.add('wa-privacy-card1-avatar');
      }

      // Cari nomor telepon & nama kontak di Card 1
      const textSpans = Array.from(card1.querySelectorAll('span, div._ak8q, [dir="auto"], [dir="ltr"]')).filter(el => {
        if (el.closest('.wa-privacy-clear') || el.closest('.wa-privacy-card1-avatar')) return false;
        const txt = (el.textContent || '').trim();
        return txt.length > 0 && txt.length < 80;
      });

      const phoneEl = textSpans.find(el => isPhoneNumber((el.textContent || '').trim()));
      if (phoneEl) {
        phoneEl.classList.add('wa-privacy-card1-number');
      }

      const nameEl = textSpans.find(el => {
        return el !== phoneEl && !el.contains(phoneEl) && !phoneEl?.contains(el) && !isPhoneNumber((el.textContent || '').trim());
      });
      if (nameEl) {
        nameEl.classList.add('wa-privacy-card1-name');
      }
    }

    // 3. CARD 2, 3, 5: MEDIA, PENGATURAN, & FOOTER -> 100% CLEAR
    const protectedElements = drawer.querySelectorAll(
      '[data-testid="media-gallery"], [data-testid="media-gallery-title"], [data-testid="image-thumb"], ' +
      '[role="switch"], [data-icon="star"], [data-icon="notifications"], [data-icon="timer"], [data-icon="lock"], ' +
      '[data-icon="paint-palette"], [data-icon="security-padlock"], [data-icon="heart"], [data-icon="contact-card"], ' +
      '[data-icon="download"], [data-icon="delete"], [data-icon="block"], [data-icon="thumb-down"], ' +
      '[data-testid="block-contact"], [data-testid="report-contact"]'
    );
    protectedElements.forEach(pe => {
      const wrapper = pe.closest('div[role="button"]') || pe.closest('div[role="listitem"]') || pe.parentElement;
      if (wrapper) {
        wrapper.classList.add('wa-privacy-clear');
        wrapper.classList.remove('wa-privacy-card1-avatar', 'wa-privacy-card1-name', 'wa-privacy-card1-number', 'wa-privacy-shared-row', 'wa-privacy-shared-avatar', 'wa-privacy-shared-content');
      }
    });

    // 4. CARD 4: "GRUP YANG SAMA" / "GROUPS IN COMMON" (Grup PETAROENK & Anggotanya)
    const allDrawerNodes = Array.from(drawer.querySelectorAll('span, div, h2, h3'));
    const groupHeading = allDrawerNodes.find(el => {
      if (el.children.length > 2) return false;
      const txt = (el.textContent || '').trim().toLowerCase();
      return txt.includes('grup yang sama') || txt.includes('groups in common');
    });

    if (groupHeading) {
      groupHeading.classList.add('wa-privacy-clear', 'wa-privacy-group-heading');

      // Ambil elemen pembungkus langsung dari grup yang sama
      let parentBox = groupHeading.parentElement;
      while (parentBox && parentBox !== scrollContainer && parentBox.querySelectorAll('div[role="listitem"], div[role="button"]').length < 2) {
        parentBox = parentBox.parentElement;
      }

      if (parentBox && parentBox !== scrollContainer) {
        const rows = parentBox.querySelectorAll('div[role="listitem"], div[role="button"], div[role="row"]');
        rows.forEach(row => {
          if (row.contains(groupHeading) || row.closest('.wa-privacy-drawer-card1') || row.classList.contains('wa-privacy-clear')) return;
          const rowText = (row.textContent || '').trim().toLowerCase();
          if (rowText.includes('lainnya') || rowText.includes('more') || row.querySelector('[data-icon="chevron-down"]')) {
            row.classList.add('wa-privacy-clear');
            return;
          }

          // Baris Grup Bersama
          row.classList.add('wa-privacy-shared-row');

          // Foto Profil / Avatar Grup
          const gAvatar = row.querySelector('img:not(.emoji), [data-testid="avatar"], ._ak8h') || row.firstElementChild;
          if (gAvatar) {
            gAvatar.classList.add('wa-privacy-shared-avatar');
          }

          // Teks Grup (Nama PETAROENK & Nomor Anggota)
          const gTexts = row.querySelectorAll('span, div._ak8q, [data-testid="cell-frame-title"], [dir="auto"]');
          gTexts.forEach(gt => {
            if (gt !== gAvatar && !gAvatar?.contains(gt)) {
              gt.classList.add('wa-privacy-shared-content');
            }
          });
        });
      }
    }
  }

  // Sidebar Chat List, Arsip, & Profil Pojok Bawah
  function setupSidebarAndControls() {
    const cellFrames = document.querySelectorAll(
      '#pane-side [data-testid="cell-frame-container"], ' +
      'div[data-testid="archived-chats"] [data-testid="cell-frame-container"], ' +
      'div[data-animate-drawer-left="true"] [data-testid="cell-frame-container"]'
    );

    cellFrames.forEach(cell => {
      const row = cell.closest('div[role="listitem"]') || 
                  cell.closest('div[role="row"]') || 
                  cell.parentElement;
      if (!row) return;

      // Proteksi Tulisan 'Diarsipkan' / 'Archived' agar 100% CLEAR
      const isArchivedBtn = !!(
        cell.querySelector('[data-icon*="archiv"]') ||
        row.querySelector('[data-icon*="archiv"]') ||
        cell.closest('div[role="button"]:has([data-icon*="archiv"])') ||
        row.closest('div[role="button"]:has([data-icon*="archiv"])') ||
        (cell.textContent || '').trim().toLowerCase() === 'diarsipkan' ||
        (cell.textContent || '').trim().toLowerCase() === 'archived'
      );

      const titleEl = cell.querySelector('[data-testid="cell-frame-title"]') ||
                      cell.querySelector('div._ak8q');

      if (isArchivedBtn && !cell.closest('div[data-animate-drawer-left="true"]')) {
        if (titleEl) {
          titleEl.classList.remove('wa-privacy-name', 'wa-privacy-number');
          titleEl.classList.add('wa-privacy-archived-clear');
          titleEl.querySelectorAll('*').forEach(c => {
            c.classList.remove('wa-privacy-name', 'wa-privacy-number');
            c.classList.add('wa-privacy-archived-clear');
            c.style.setProperty('filter', 'none', 'important');
            c.style.setProperty('-webkit-filter', 'none', 'important');
          });
        }
        return;
      }

      // Contact Name (Disamarkan, teks (Anda) tetap jernih)
      if (titleEl) {
        const innerSpans = Array.from(titleEl.querySelectorAll('span'));
        const andaSpan = innerSpans.find(s => {
          const t = (s.textContent || '').trim();
          return t === '(Anda)' || t === '(You)' || t.startsWith('(Anda)') || t.startsWith('(You)');
        });

        if (andaSpan) {
          titleEl.classList.remove('wa-privacy-name', 'wa-privacy-number');
          titleEl.style.removeProperty('filter');
          titleEl.style.removeProperty('-webkit-filter');

          andaSpan.classList.add('wa-privacy-anda-clear');
          andaSpan.classList.remove('wa-privacy-name', 'wa-privacy-number');
          andaSpan.style.setProperty('filter', 'none', 'important');
          andaSpan.style.setProperty('-webkit-filter', 'none', 'important');

          innerSpans.forEach(s => {
            if (s !== andaSpan && !s.contains(andaSpan) && !andaSpan.contains(s) && (s.textContent || '').trim().length > 0) {
              s.classList.add('wa-privacy-name');
            }
          });
        } else {
          titleEl.classList.add('wa-privacy-name');
          innerSpans.forEach(s => {
            s.classList.add('wa-privacy-name');
          });
        }
      }

      // Contact Avatar (Di chat list biasa maupun di dalam arsipan)
      const statusSvg = row.querySelector('svg._ak8i, circle[stroke]');
      if (statusSvg && !cell.contains(statusSvg)) {
        statusSvg.style.setProperty('filter', 'none', 'important');
        statusSvg.style.setProperty('-webkit-filter', 'none', 'important');
        statusSvg.style.setProperty('opacity', '1', 'important');

        let p = statusSvg.parentElement;
        if (p && p !== row) {
          p.classList.remove('wa-privacy-avatar');
          p.style.removeProperty('filter');
        }

        const innerAvatar = row.querySelector('img:not(.emoji)') ||
                            (p ? Array.from(p.children).find(c => c !== statusSvg) : null);
        if (innerAvatar && innerAvatar !== statusSvg && !cell.contains(innerAvatar)) {
          innerAvatar.classList.add('wa-privacy-avatar');
        }
        return;
      }

      // Kumpulkan avatar (gambar, default silhouette SVG, inisial)
      const avatarTargets = [];
      const rowImgs = Array.from(row.querySelectorAll('img')).filter(img => !cell.contains(img) && !img.classList.contains('emoji'));
      avatarTargets.push(...rowImgs);

      const avatarSvgs = Array.from(row.querySelectorAll('[data-icon="default-user"], [data-icon="default-group"], [data-icon="community"], [data-icon*="avatar"]')).filter(svg => !cell.contains(svg));
      avatarTargets.push(...avatarSvgs);

      const avatarContainers = Array.from(row.querySelectorAll('div._ak8h, [data-testid="avatar"], [data-testid="chat-avatar"]')).filter(d => !cell.contains(d));
      avatarTargets.push(...avatarContainers);

      if (avatarTargets.length > 0) {
        avatarTargets.forEach(target => {
          target.classList.add('wa-privacy-avatar');
        });
      } else {
        const sib = cell.previousElementSibling;
        if (sib && !cell.contains(sib)) {
          sib.classList.add('wa-privacy-avatar');
        }
      }
    });

    // Profil Pengguna Pojok Kiri Bawah ("Kontak Anda")
    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
      if (img.closest('#pane-side') || img.closest('#main') || img.closest('[data-animate-drawer-right]') || img.closest('.wa-privacy-contact-drawer')) return;
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.left >= 0 && rect.left < 80) {
        img.classList.add('wa-privacy-user-avatar');
        const btn = img.closest('button') || img.closest('div[role="button"]');
        if (btn) btn.classList.add('wa-privacy-user-avatar');
      }
    });

    // Meta AI di Bilah Kiri
    const metaAiElements = document.querySelectorAll(
      'button[aria-label*="Meta AI" i], div[aria-label*="Meta AI" i], button[title*="Meta AI" i], div[title*="Meta AI" i], span[data-icon="meta-ai"], span[data-icon*="meta-ai"], [data-testid*="meta-ai" i]'
    );
    metaAiElements.forEach(el => {
      el.classList.add('wa-privacy-meta-ai');
      const parentBtn = el.closest('button') || el.closest('div[role="button"]');
      if (parentBtn) parentBtn.classList.add('wa-privacy-meta-ai');
    });
  }

  // Conversation Panel Protection: Pesan obrolan & media di #main selalu 100% CLEAR
  function setupConversationElements() {
    const convoPanel = document.querySelector('[data-testid="conversation-panel-messages"]');
    if (!convoPanel) return;
    const textMessages = convoPanel.querySelectorAll(
      '.wa-privacy-conversation-msg, .wa-privacy-media, div[role="row"] .copyable-text, div[role="row"] .selectable-text'
    );
    textMessages.forEach(msg => {
      msg.classList.remove('wa-privacy-conversation-msg', 'wa-privacy-media');
      msg.style.removeProperty('filter');
      msg.style.removeProperty('-webkit-filter');
    });
  }

  // Master Tagging Runner
  function tagAll() {
    document.querySelectorAll('.wa-rail-btn').forEach(b => b.remove());
    setupHeaderElements();
    setupDrawerElements();
    setupSidebarAndControls();
    setupConversationElements();
  }

  let tagDebounceTimer = null;
  function scheduleTagAll() {
    if (tagDebounceTimer) return;
    tagDebounceTimer = setTimeout(() => {
      tagDebounceTimer = null;
      tagAll();
    }, 40);
  }

  // Bridge for Electron / Host synchronization
  window.__applyPrivacySettings = function(settings) {
    try {
      localStorage.setItem('wa_privacy_blur_config', JSON.stringify(settings));
    } catch(e) {}
    applySettings(settings);
    scheduleTagAll();
  };

  window.addEventListener('wa-privacy-sync', (e) => {
    if (e && e.detail) {
      applySettings(e.detail);
      scheduleTagAll();
    }
  });

  function init() {
    applySettings(currentSettings);

    try {
      const cached = localStorage.getItem('wa_privacy_blur_config');
      if (cached) {
        const parsed = typeof cached === 'string' && (cached.startsWith('{') || cached.startsWith('"')) ? JSON.parse(cached) : cached;
        const finalObj = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
        if (finalObj && typeof finalObj === 'object') {
          applySettings(finalObj);
        }
      }
    } catch(e) {}

    loadSettingsFromStorage();

    // 1. Eksekusi penandaan awal
    tagAll();

    // 2. Event Klik: saat pengguna membuka info kontak, berpindah chat, atau membuka arsip
    document.addEventListener('click', () => {
      requestAnimationFrame(tagAll);
      setTimeout(tagAll, 80);
      setTimeout(tagAll, 250);
      setTimeout(tagAll, 600);
    }, { passive: true });

    // 3. Event Mouseover: saat kursor masuk ke area drawer atau chat list
    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (t && t.closest && (t.closest('[data-animate-drawer-right]') || t.closest('#pane-side') || t.closest('[data-animate-drawer-left]'))) {
        scheduleTagAll();
      }
    }, { passive: true });

    // 4. Interval Ringan: memastikan elemen dinamis WhatsApp terdeteksi seketika (<0.2ms overhead)
    setInterval(() => {
      if (document.querySelector('[data-animate-drawer-right], [data-animate-drawer-left], #pane-side')) {
        tagAll();
      }
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Blur & Lock Privacy Extension] Active.');
})();
