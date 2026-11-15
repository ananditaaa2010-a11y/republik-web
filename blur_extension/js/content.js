/**
 * Blur & Lock Privacy Extension — Content Script (Manifest V3)
 * Operates directly on the official web.whatsapp.com
 */

(function () {
  'use strict';

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

    // A. Set Dynamic CSS Variables for Adjustable Blur Intensity
    const intensity = Math.max(3, Math.min(30, parseInt(s.blurIntensity, 10) || 10));
    const avatarIntensity = Math.max(4, intensity + 2);
    docEl.style.setProperty('--wa-blur-intensity', `${intensity}px`);
    docEl.style.setProperty('--wa-blur-avatar-intensity', `${avatarIntensity}px`);

    // B. Master Toggle
    if (s.enabled !== false) {
      body.classList.add('wa-blur-master-enabled');
      body.classList.remove('wa-blur-disabled');
    } else {
      body.classList.remove('wa-blur-master-enabled');
      body.classList.add('wa-blur-disabled');
    }

    // C. Granular Feature Toggles
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

    // D. Lock Screen Status Check
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

    // Keypad event listeners
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

    // Trap keyboard events while locked
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
      void card.offsetWidth; // Force reflow
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
      // PIN Correct -> Unlock!
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
      // PIN Incorrect -> Shake & Retry
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

    // Stop WhatsApp Web from receiving keys
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
  // 3. CONTINUOUS DOM ELEMENT TAGGING (AUTO OBSERVER & SCROLLING)
  // ==========================================================================
  function isPhoneNumber(text) {
    if (!text) return false;
    const clean = text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\s]/g, '').trim();
    const digits = clean.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 16) return false;
    return /^(\+?\d{8,16}|08\d{7,14})$/.test(clean.replace(/[\-\(\)\.]/g, '')) ||
           /^(\+?62|08)[0-9\s.-]{7,16}$/.test(text.trim());
  }

  function attachDirectHover(el) {
    if (!el || el._hasDirectHoverAttached) return;
    el._hasDirectHoverAttached = true;

    el.addEventListener('mouseenter', () => {
      el.style.setProperty('filter', 'none', 'important');
      el.style.setProperty('-webkit-filter', 'none', 'important');
      const allChildren = el.querySelectorAll('*');
      for (let i = 0; i < allChildren.length; i++) {
        allChildren[i].style.setProperty('filter', 'none', 'important');
        allChildren[i].style.setProperty('-webkit-filter', 'none', 'important');
      }
    });

    el.addEventListener('mouseleave', () => {
      el.style.removeProperty('filter');
      el.style.removeProperty('-webkit-filter');
      const allChildren = el.querySelectorAll('*');
      for (let i = 0; i < allChildren.length; i++) {
        allChildren[i].style.removeProperty('filter');
        allChildren[i].style.removeProperty('-webkit-filter');
      }
    });
  }

  function attachRowHover(row, elementsToReveal) {
    if (!row || row._hasRowHoverAttached) return;
    row._hasRowHoverAttached = true;

    row.addEventListener('mouseenter', () => {
      elementsToReveal.forEach(el => {
        if (el) {
          el.style.setProperty('filter', 'none', 'important');
          el.style.setProperty('-webkit-filter', 'none', 'important');
          const children = el.querySelectorAll('*');
          for (let i = 0; i < children.length; i++) {
            children[i].style.setProperty('filter', 'none', 'important');
            children[i].style.setProperty('-webkit-filter', 'none', 'important');
          }
        }
      });
    });

    row.addEventListener('mouseleave', () => {
      elementsToReveal.forEach(el => {
        if (el) {
          el.style.removeProperty('filter');
          el.style.removeProperty('-webkit-filter');
          const children = el.querySelectorAll('*');
          for (let i = 0; i < children.length; i++) {
            children[i].style.removeProperty('filter');
            children[i].style.removeProperty('-webkit-filter');
          }
        }
      });
    });
  }

  // Header Elements (Profil & Nama Kontak di Atas Bubble Chat)
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
      attachDirectHover(headerAvatar);
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
        attachDirectHover(el);
      }
    });

    // Event listener langsung pada container profil & nama kontak di atas bubble chat
    // Saat cursor mengarah ke situ: nonaktifkan blur (jernih)
    // Saat cursor tidak mengarah ke situ: kembalikan blur
    if (!headerBtn._hasHeaderHoverRevealBound) {
      headerBtn._hasHeaderHoverRevealBound = true;
      headerBtn.addEventListener('mouseenter', () => {
        if (currentSettings.enabled !== false) {
          const targets = headerBtn.querySelectorAll('.wa-privacy-header-avatar, .wa-privacy-header-name, img:not(.emoji), [data-testid="avatar"], span[title], ._ak8q');
          targets.forEach(t => {
            t.style.setProperty('filter', 'none', 'important');
            t.style.setProperty('-webkit-filter', 'none', 'important');
          });
        }
      });
      headerBtn.addEventListener('mouseleave', () => {
        const targets = headerBtn.querySelectorAll('.wa-privacy-header-avatar, .wa-privacy-header-name, img:not(.emoji), [data-testid="avatar"], span[title], ._ak8q');
        targets.forEach(t => {
          t.style.removeProperty('filter');
          t.style.removeProperty('-webkit-filter');
        });
      });
    }
  }

  // Drawer Elements (Info Kontak, Grup, Media)
  function setupDrawerElements() {
    const drawers = document.querySelectorAll(
      '[data-animate-drawer-right="true"], div[data-testid="contact-info"], div[data-testid="chat-info-drawer"], div[data-testid="group-info-drawer"]'
    );

    drawers.forEach(drawer => {
      // 1. Header (Tombol Tutup X, "Info kontak", Edit Pensil) -> Proteksi jernih
      const drawerHeader = drawer.querySelector('header');
      if (drawerHeader) {
        drawerHeader.classList.add('wa-privacy-drawer-protected');
      }

      // 2. Foto Profil Besar di Bagian Atas Drawer
      const topSection = drawerHeader ? drawerHeader.nextElementSibling : drawer;
      if (topSection) {
        const avatarCandidates = topSection.querySelectorAll(
          'div[role="button"]:not([data-testid*="btn"]), div[tabindex="0"], div._ak8h, [data-testid="profile-pic"], [data-testid="avatar"], [data-testid="default-user"], [data-testid="default-group"]'
        );
        avatarCandidates.forEach(btn => {
          if (btn.closest('[data-testid="media-gallery"]')) return;
          const img = btn.querySelector('img:not(.emoji)');
          if (img) {
            if (!img.classList.contains('wa-privacy-drawer-avatar')) {
              img.classList.add('wa-privacy-drawer-avatar');
            }
            attachDirectHover(img);
            attachDirectHover(btn);
          } else {
            if (!btn.classList.contains('wa-privacy-drawer-avatar')) {
              btn.classList.add('wa-privacy-drawer-avatar');
            }
            attachDirectHover(btn);
          }
        });
      }

      // Pastikan semua avatar profil di drawer (selain gallery media) tersamarkan
      const drawerAvatars = drawer.querySelectorAll('[data-testid="profile-pic"], [data-testid="avatar"], img[src*="pps.whatsapp.net"]');
      drawerAvatars.forEach(av => {
        if (!av.closest('[data-testid="media-gallery"]') && !av.classList.contains('wa-privacy-drawer-avatar') && !av.classList.contains('wa-privacy-shared-avatar')) {
          av.classList.add('wa-privacy-drawer-avatar');
          attachDirectHover(av);
        }
      });

      // 3. Nama Kontak di Drawer ("Alpin")
      const headings = drawer.querySelectorAll('h2, [data-testid="contact-info-title"], [data-testid="chat-info-title"], span[data-testid="contact-info-title"]');
      headings.forEach(h => {
        if (!h.classList.contains('wa-privacy-drawer-name')) {
          h.classList.add('wa-privacy-drawer-name');
        }
        attachDirectHover(h);
      });

      // 4. Nomor Telepon di Bawah Nama ("+62 858-1755-6573")
      const spans = drawer.querySelectorAll('span, div');
      spans.forEach(sp => {
        if (sp.children.length === 0) {
          const txt = (sp.textContent || '').trim();
          if (isPhoneNumber(txt)) {
            if (!sp.classList.contains('wa-privacy-number')) {
              sp.classList.add('wa-privacy-number');
            }
            attachDirectHover(sp);
          }
        }
      });

      // 5. Tombol Aksi Cepat ("Suara", "Video", "Cari") -> Harus Jernih (Proteksi)
      const actionButtons = drawer.querySelectorAll(
        '[data-testid="audio-call-btn"], [data-testid="video-call-btn"], [data-testid="search-btn"], ' +
        'div[role="button"]:has(span[data-icon="audio-call"]), div[role="button"]:has(span[data-icon="video-call"]), div[role="button"]:has(span[data-icon="search"])'
      );
      actionButtons.forEach(btn => {
        btn.classList.add('wa-privacy-drawer-protected');
      });

      // 6. Baris Pengaturan ("Pesan berbintang", "Bisukan notifikasi", "Pesan sementara", "Obrolan terbatas", "Tema obrolan", "Enkripsi")
      const settingRows = drawer.querySelectorAll(
        'div[role="button"]:has([data-icon="star"]), div[role="button"]:has([data-icon="notifications"]), ' +
        'div[role="button"]:has([data-icon="timer"]), div[role="button"]:has([data-icon="lock"]), ' +
        'div[role="button"]:has([data-icon="paint-palette"]), div[role="button"]:has([data-icon="security-padlock"])'
      );
      settingRows.forEach(row => {
        row.classList.add('wa-privacy-drawer-protected');
      });

      // 7. Bagian Grup Bersama ("11 grup yang sama" / "groups in common")
      const groupHeadings = Array.from(drawer.querySelectorAll('span, div, h3')).filter(el => {
        const t = (el.textContent || '').trim();
        return /\d+\s+grup yang sama/i.test(t) || /\d+\s+groups in common/i.test(t);
      });
      groupHeadings.forEach(gh => {
        gh.classList.add('wa-privacy-drawer-protected');
        const container = gh.closest('section, div[role="region"]') || gh.parentElement?.parentElement;
        if (container) {
          const rows = container.querySelectorAll('div[role="listitem"], div[role="button"]:not([data-testid*="btn"])');
          rows.forEach(row => {
            if (row.contains(gh)) return;
            const gAvatar = row.querySelector('img:not(.emoji), ._ak8h, [data-testid="avatar"], [data-testid="default-group"]');
            if (gAvatar && !gAvatar.classList.contains('wa-privacy-shared-avatar')) {
              gAvatar.classList.add('wa-privacy-shared-avatar');
            }
            const gTitle = row.querySelector('span[title], [data-testid="cell-frame-title"], span[dir="auto"]');
            if (gTitle && !gTitle.classList.contains('wa-privacy-shared-name')) {
              gTitle.classList.add('wa-privacy-shared-name');
            }
            if (gAvatar || gTitle) {
              attachRowHover(row, [gAvatar, gTitle]);
            }
          });
        }
      });

      // 8. Info Status / Bio Kontak
      const aboutHeaders = Array.from(drawer.querySelectorAll('span, div, h3')).filter(el => {
        const t = (el.textContent || '').trim();
        return t === 'Tentang' || t === 'About' || t.startsWith('Tentang dan') || t.startsWith('About and');
      });
      aboutHeaders.forEach(ah => {
        ah.classList.add('wa-privacy-drawer-protected');
        const sec = ah.closest('section, div[role="region"]') || ah.parentElement;
        if (sec) {
          const bioTexts = sec.querySelectorAll('span[dir="auto"], div._ak8q');
          bioTexts.forEach(bt => {
            if (bt !== ah && !bt.classList.contains('wa-privacy-drawer-about')) {
              bt.classList.add('wa-privacy-drawer-about');
              attachDirectHover(bt);
            }
          });
        }
      });

      const groupDescs = drawer.querySelectorAll('[data-testid="group-description"], [data-testid="chat-info-description"], [data-testid="contact-info-about"]');
      groupDescs.forEach(gd => {
        if (!gd.classList.contains('wa-privacy-group-info') && !gd.classList.contains('wa-privacy-drawer-about')) {
          gd.classList.add('wa-privacy-group-info');
        }
        attachDirectHover(gd);
      });

      // 9. Tombol Bagian Bawah ("Tambah favorit", "Tambah ke daftar", "Ekspor", "Bersihkan", "Blokir", "Laporkan") -> 100% Jernih
      const bottomActions = drawer.querySelectorAll(
        'div[role="button"]:has([data-icon="heart"]), div[role="button"]:has([data-icon="contact-card"]), ' +
        'div[role="button"]:has([data-icon="download"]), div[role="button"]:has([data-icon="delete"]), ' +
        'div[role="button"]:has([data-icon="block"]), div[role="button"]:has([data-icon="thumb-down"]), ' +
        '[data-testid="block-contact"], [data-testid="report-contact"]'
      );
      bottomActions.forEach(ba => {
        ba.classList.add('wa-privacy-drawer-protected');
      });

      // 10. Gallery Media Thumbnails -> 100% Jernih sesuai web.whatsapp.com asli
      const mediaGalleryImgs = drawer.querySelectorAll('[data-testid="media-gallery"] img, [data-testid="image-thumb"]');
      mediaGalleryImgs.forEach(m => {
        m.classList.remove('wa-privacy-media');
        m.style.removeProperty('filter');
        m.style.removeProperty('-webkit-filter');
      });
    });
  }

  // Sidebar Chat List, Arsip, & Profil Pojok Bawah
  function setupSidebarAndControls() {
    const cellFrames = document.querySelectorAll(
      '#pane-side [data-testid="cell-frame-container"], ' +
      'div[data-testid="archived-chats"] [data-testid="cell-frame-container"]'
    );

    cellFrames.forEach(cell => {
      const isArchivedHeaderBtn = cell.closest('[data-testid="archived"]') && 
                                  !cell.closest('div[data-testid="archived-chats"]');
      if (isArchivedHeaderBtn) return;

      // Contact Name (Disamarkan, namun teks (Anda) tetap jernih sesuai https://web.whatsapp.com)
      const titleEl = cell.querySelector('[data-testid="cell-frame-title"]') ||
                      cell.querySelector('div._ak8q');
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
              attachDirectHover(s);
            }
          });
        } else {
          titleEl.classList.add('wa-privacy-name');
          attachDirectHover(titleEl);
          innerSpans.forEach(s => {
            s.classList.add('wa-privacy-name');
            attachDirectHover(s);
          });
        }
      }

      // CATATAN: Preview Pesan Terakhir (baris kedua) TIDAK DI-BLUR, 100% Jernih persis seperti web.whatsapp.com asli

      // Contact Avatar (Foto maupun Inisial non-foto)
      const row = cell.closest('div[role="listitem"]') || 
                  cell.closest('div[role="row"]') || 
                  cell.parentElement;
      if (!row) return;

      // Status Ring Hijau (Selalu dilindungi jernih)
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
          if (!innerAvatar.classList.contains('wa-privacy-avatar')) {
            innerAvatar.classList.add('wa-privacy-avatar');
          }
          attachDirectHover(innerAvatar);
        }
        return;
      }

      // Foto Gambar
      const imgs = Array.from(row.querySelectorAll('img')).filter(img => !cell.contains(img) && !img.classList.contains('emoji'));
      if (imgs.length > 0) {
        imgs.forEach(img => {
          if (!img.classList.contains('wa-privacy-avatar')) {
            img.classList.add('wa-privacy-avatar');
          }
          attachDirectHover(img);
        });
        return;
      }

      // Inisial Tanpa Foto ("A", "T", siluet)
      const elementsOutsideCell = Array.from(row.querySelectorAll('div, span')).filter(el => {
        if (cell === el || cell.contains(el) || el.contains(cell)) return false;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (w >= 30 && w <= 70 && h >= 30 && h <= 70) return true;
        const txt = (el.textContent || '').trim();
        return /^[\p{L}\p{N}]{1,2}$/u.test(txt);
      });

      if (elementsOutsideCell.length > 0) {
        const initialAvatar = elementsOutsideCell[0];
        if (!initialAvatar.classList.contains('wa-privacy-avatar')) {
          initialAvatar.classList.add('wa-privacy-avatar');
        }
        attachDirectHover(initialAvatar);
      } else {
        const sib = cell.previousElementSibling;
        if (sib && !cell.contains(sib)) {
          if (!sib.classList.contains('wa-privacy-avatar')) {
            sib.classList.add('wa-privacy-avatar');
          }
          attachDirectHover(sib);
        }
      }
    });

    // Foto Profil Pengguna di Pojok Kiri Bawah ("Kontak Anda")
    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
      if (img.closest('#pane-side') || img.closest('#main') || img.closest('[data-animate-drawer-right="true"]')) return;
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.left >= 0 && rect.left < 80) {
        if (!img.classList.contains('wa-privacy-user-avatar')) {
          img.classList.add('wa-privacy-user-avatar');
        }
        attachDirectHover(img);
        const btn = img.closest('button') || img.closest('div[role="button"]');
        if (btn) attachDirectHover(btn);
      }
    });

    // Meta AI
    const metaAiElements = document.querySelectorAll(
      'button[aria-label*="Meta AI" i], ' +
      'div[aria-label*="Meta AI" i], ' +
      'button[title*="Meta AI" i], ' +
      'div[title*="Meta AI" i], ' +
      'span[data-icon="meta-ai"], ' +
      'span[data-icon*="meta-ai"], ' +
      '[data-testid*="meta-ai" i]'
    );
    metaAiElements.forEach(el => {
      if (!el.classList.contains('wa-privacy-meta-ai')) {
        el.classList.add('wa-privacy-meta-ai');
      }
      attachDirectHover(el);
    });
  }

  // Conversation Content & Media di Ruang Chat (#main) -> SELALU JERNIH sesuai web.whatsapp.com asli
  function setupConversationElements() {
    const mainEl = document.getElementById('main');
    if (!mainEl) return;

    // Bersihkan kelas blur dari pesan atau media di #main agar obrolan 100% jernih dan terbaca
    const textMessages = mainEl.querySelectorAll(
      '.wa-privacy-conversation-msg, .wa-privacy-media, div[role="row"] .copyable-text, div[role="row"] .selectable-text'
    );
    textMessages.forEach(msg => {
      msg.classList.remove('wa-privacy-conversation-msg', 'wa-privacy-media');
      msg.style.removeProperty('filter');
      msg.style.removeProperty('-webkit-filter');
    });
  }

  // Drawer Chat Baru
  function setupNewChatDrawerElements() {
    const newChatDrawers = document.querySelectorAll('div[data-animate-drawer-left="true"]');
    newChatDrawers.forEach(drawer => {
      if (drawer.querySelector('[data-testid="archived-chats"]')) return;

      const contactItems = drawer.querySelectorAll('div[role="listitem"], div[role="button"][tabindex="0"]');
      contactItems.forEach(item => {
        const isActionBtn = item.querySelector('[data-icon="community"], [data-icon="groups"], [data-icon="new-group"]');
        if (isActionBtn) return;

        const avatar = item.querySelector('img:not(.emoji)') ||
                       item.querySelector('[data-testid="avatar"]') ||
                       item.querySelector('[data-testid="chat-avatar"]') ||
                       item.querySelector('._ak8h');
        if (avatar && !avatar.classList.contains('wa-privacy-new-chat-avatar')) {
          avatar.classList.add('wa-privacy-new-chat-avatar');
          attachDirectHover(avatar);
        }

        const titleEl = item.querySelector('[data-testid="cell-frame-title"]') ||
                        item.querySelector('span[title]') ||
                        item.querySelector('span[dir="auto"]');
        if (titleEl && !titleEl.classList.contains('wa-privacy-new-chat-name')) {
          titleEl.classList.add('wa-privacy-new-chat-name');
          attachDirectHover(titleEl);
        }

        const textElements = Array.from(item.querySelectorAll('span[dir="auto"]'));
        if (textElements.length > 1) {
          const aboutEl = textElements[1];
          if (!aboutEl.classList.contains('wa-privacy-new-chat-about') && !aboutEl.classList.contains('wa-privacy-new-chat-name')) {
            aboutEl.classList.add('wa-privacy-new-chat-about');
            attachDirectHover(aboutEl);
          }
        }
      });
    });
  }

  // Master Runner (Debounced)
  function tagAll() {
    // Bersihkan elemen inject yang tidak diinginkan
    document.querySelectorAll('.wa-rail-btn').forEach(b => b.remove());

    setupHeaderElements();
    setupDrawerElements();
    setupSidebarAndControls();
    setupConversationElements();
    setupNewChatDrawerElements();
  }

  let isScheduled = false;
  function scheduleTagAll() {
    if (isScheduled) return;
    isScheduled = true;
    requestAnimationFrame(() => {
      tagAll();
      isScheduled = false;
    });
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
    // Check localStorage cache first
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
    tagAll();

    // Observe all scrolling, dynamic DOM updates, incoming messages, and drawer openings
    const observer = new MutationObserver(() => {
      scheduleTagAll();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Blur & Lock Privacy Extension] Active on WhatsApp Web.');
})();
