/**
 * WhatsApp Privacy Blur Addon — Content Script (Version 4.0.0 - Modular Privacy Suite)
 * 
 * Fitur:
 * 1. Blur all messages in chat list (.wa-blur-chat-list)
 * 2. Blur contact names (.wa-blur-contact-names)
 * 3. Blur profile photos & non-photo initials (.wa-blur-profile-photos)
 * 4. Blur conversation content in #main (.wa-blur-conversation)
 * 5. Blur media (images, videos, documents, audio) (.wa-blur-media)
 * 6. Blur preview of latest messages (.wa-blur-latest-message)
 * 7. Blur group names & group info (.wa-blur-group-info)
 * 8. Blur status updates & contact info (.wa-blur-status-info)
 * 9. Unblur on hover (.wa-blur-hover-reveal)
 * 10. Adjustable blur intensity (CSS Variables)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'wa_privacy_blur_config';

  const DEFAULT_SETTINGS = {
    enabled: true,
    blurIntensity: 10,
    blurChatList: false,
    blurContactNames: true,
    blurProfilePhotos: true,
    blurConversation: false,
    blurMedia: true,
    blurLatestMessage: true,
    blurGroupInfo: true,
    blurStatusInfo: true,
    unblurOnHover: true
  };

  let currentSettings = { ...DEFAULT_SETTINGS };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch (e) {
      console.warn('[WA Privacy Blur] Error loading settings from storage:', e);
    }
  }

  function applySettings(newSettings) {
    if (newSettings && typeof newSettings === 'object') {
      currentSettings = { ...currentSettings, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
      } catch (e) {}
    }

    const s = currentSettings;
    const body = document.body;
    if (!body) return;

    // 1. Set CSS Variables for adjustable blur intensity
    const intensity = Math.max(3, Math.min(30, parseInt(s.blurIntensity, 10) || 10));
    const avatarIntensity = Math.max(4, intensity + 2);
    document.documentElement.style.setProperty('--wa-blur-intensity', `${intensity}px`);
    document.documentElement.style.setProperty('--wa-blur-avatar-intensity', `${avatarIntensity}px`);

    // 2. Master Toggle
    if (s.enabled !== false) {
      body.classList.add('wa-blur-master-enabled');
      body.classList.remove('wa-blur-disabled');
    } else {
      body.classList.remove('wa-blur-master-enabled');
      body.classList.add('wa-blur-disabled');
    }

    // 3. Feature Classes
    const toggleClass = (cls, condition) => {
      if (condition) body.classList.add(cls);
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
  }

  // Expose global updater for Electron host IPC
  window.__applyPrivacySettings = applySettings;
  window.addEventListener('wa-privacy-sync', (e) => {
    if (e.detail) applySettings(e.detail);
  });

  function showToast(message) {
    let toast = document.getElementById('wa-privacy-blur-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wa-privacy-blur-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(17, 27, 33, 0.94);
        color: #00a884;
        border: 1px solid rgba(0, 168, 132, 0.45);
        padding: 10px 18px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        z-index: 999999;
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 2000);
  }

  function toggleMaster() {
    currentSettings.enabled = !currentSettings.enabled;
    applySettings(currentSettings);
    showToast(currentSettings.enabled ? '🛡️ Privacy Blur: AKTIF' : '👁️ Privacy Blur: NONAKTIF');
  }

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleMaster();
    }
  });

  function isPhoneNumber(text) {
    if (!text) return false;
    const clean = text.trim();
    const digits = clean.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 16) return false;
    return /^(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}$/.test(clean) ||
           /^(\+?62|08)[0-9\s.-]{7,16}$/.test(clean);
  }

  function attachDirectHover(el) {
    if (!el || el._hasDirectHoverAttached) return;
    el._hasDirectHoverAttached = true;

    el.addEventListener('mouseenter', () => {
      if (currentSettings.enabled && currentSettings.unblurOnHover) {
        el.style.setProperty('filter', 'none', 'important');
        el.style.setProperty('-webkit-filter', 'none', 'important');
      }
    });

    el.addEventListener('mouseleave', () => {
      el.style.removeProperty('filter');
      el.style.removeProperty('-webkit-filter');
    });
  }

  // --------------------------------------------------------------------------
  // 1. Header di Atas Bubble Chat (#main header)
  // --------------------------------------------------------------------------
  function setupHeaderElements() {
    const mainHeader = document.querySelector('#main header');
    if (!mainHeader) return;

    const headerBtn = mainHeader.querySelector('div[role="button"]') || mainHeader.firstElementChild;
    if (!headerBtn) return;

    // A. Foto Profil di Header (#main header)
    const headerAvatar = headerBtn.querySelector('img:not(.emoji)') ||
                         headerBtn.querySelector('._ak8h') ||
                         headerBtn.querySelector('[data-testid="conversation-info-header-chat-avatar"]') ||
                         headerBtn.querySelector('[data-testid="avatar"]') ||
                         headerBtn.firstElementChild;

    if (headerAvatar && !headerAvatar.classList.contains('wa-privacy-header-avatar')) {
      headerAvatar.classList.add('wa-privacy-header-avatar');
      attachDirectHover(headerAvatar);
    }

    // B. Nama Kontak & Info di Header (#main header)
    const titleCandidates = headerBtn.querySelectorAll(
      'span[title], div[title], ._ak8q, [data-testid="conversation-info-header-chat-title"], [data-testid="chat-title"]'
    );
    titleCandidates.forEach(el => {
      if (!el.closest('.wa-privacy-header-avatar')) {
        const titleText = el.getAttribute('title') || el.textContent || '';
        if (titleText.includes(',')) {
          // Group participants list in header
          if (!el.classList.contains('wa-privacy-group-info')) el.classList.add('wa-privacy-group-info');
        } else {
          if (!el.classList.contains('wa-privacy-header-name')) el.classList.add('wa-privacy-header-name');
        }
        attachDirectHover(el);
      }
    });

    // Independent hover on header
    if (!headerBtn.dataset.waHoverBound) {
      headerBtn.dataset.waHoverBound = 'true';
      headerBtn.addEventListener('mousemove', (e) => {
        if (!currentSettings.enabled || !currentSettings.unblurOnHover) return;
        const curAvatar = headerBtn.querySelector('.wa-privacy-header-avatar') || headerAvatar;
        const curTitle = headerBtn.querySelector('.wa-privacy-header-name');

        const onAvatar = curAvatar && (curAvatar === e.target || curAvatar.contains(e.target));
        const onTitle = curTitle && (curTitle === e.target || curTitle.contains(e.target));

        if (curAvatar) {
          if (onAvatar) {
            curAvatar.style.setProperty('filter', 'none', 'important');
            curAvatar.style.setProperty('-webkit-filter', 'none', 'important');
          } else {
            curAvatar.style.removeProperty('filter');
            curAvatar.style.removeProperty('-webkit-filter');
          }
        }

        if (curTitle) {
          if (onTitle) {
            curTitle.style.setProperty('filter', 'none', 'important');
            curTitle.style.setProperty('-webkit-filter', 'none', 'important');
          } else {
            curTitle.style.removeProperty('filter');
            curTitle.style.removeProperty('-webkit-filter');
          }
        }
      });

      headerBtn.addEventListener('mouseleave', () => {
        const curAvatar = headerBtn.querySelector('.wa-privacy-header-avatar') || headerAvatar;
        const curTitle = headerBtn.querySelector('.wa-privacy-header-name');
        if (curAvatar) {
          curAvatar.style.removeProperty('filter');
          curAvatar.style.removeProperty('-webkit-filter');
        }
        if (curTitle) {
          curTitle.style.removeProperty('filter');
          curTitle.style.removeProperty('-webkit-filter');
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. Drawer Info Kontak & Grup
  // --------------------------------------------------------------------------
  function setupDrawerElements() {
    const drawers = document.querySelectorAll(
      '[data-animate-drawer-right="true"], div[data-testid="contact-info"], div[data-testid="chat-info-drawer"], div[data-testid="group-info-drawer"]'
    );

    drawers.forEach(drawer => {
      // A. Foto Profil Besar / Lingkaran Inisial
      const drawerImgs = drawer.querySelectorAll('img:not(.emoji), [data-testid="profile-pic"], [data-testid="avatar"]');
      drawerImgs.forEach(img => {
        if (!img.classList.contains('wa-privacy-drawer-avatar')) {
          img.classList.add('wa-privacy-drawer-avatar');
        }
        attachDirectHover(img);
      });

      // Deteksi inisial besar lingkaran ("GP")
      const allDivs = drawer.querySelectorAll('div[role="button"] > div, div');
      allDivs.forEach(d => {
        const txt = (d.textContent || '').trim();
        const isInitialText = /^[\p{L}\p{N}]{1,3}$/u.test(txt);
        if ((d.offsetWidth >= 50 && d.offsetWidth <= 250 && d.offsetHeight >= 50 && d.offsetHeight <= 250) || isInitialText) {
          const comp = window.getComputedStyle(d);
          if (comp.borderRadius === '50%' || comp.borderRadius.includes('50%') || isInitialText) {
            if (!d.classList.contains('wa-privacy-drawer-avatar')) {
              d.classList.add('wa-privacy-drawer-avatar');
            }
            attachDirectHover(d);
          }
        }
      });

      // B. Nama Kontak Besar di Drawer
      const headings = drawer.querySelectorAll('h2, [data-testid="contact-info-title"], [data-testid="chat-info-title"]');
      headings.forEach(h => {
        if (!h.classList.contains('wa-privacy-drawer-name')) {
          h.classList.add('wa-privacy-drawer-name');
        }
        attachDirectHover(h);
      });

      // C. Nomor Telepon & Info Status
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

      // D. Deskripsi Grup
      const groupDescs = drawer.querySelectorAll('[data-testid="group-description"], [data-testid="chat-info-description"]');
      groupDescs.forEach(gd => {
        if (!gd.classList.contains('wa-privacy-group-info')) {
          gd.classList.add('wa-privacy-group-info');
        }
        attachDirectHover(gd);
      });

      // E. Media Gallery di Drawer
      const mediaGalleryImgs = drawer.querySelectorAll('[data-testid="media-gallery"] img, [data-testid="image-thumb"]');
      mediaGalleryImgs.forEach(m => {
        if (!m.classList.contains('wa-privacy-media')) {
          m.classList.add('wa-privacy-media');
        }
        attachDirectHover(m);
      });
    });
  }

  // --------------------------------------------------------------------------
  // 3. Sidebar Chat List, Arsip, Meta AI, & Profil Pojok Kiri Bawah
  // --------------------------------------------------------------------------
  function setupSidebarAndControls() {
    const cellFrames = document.querySelectorAll(
      '#pane-side [data-testid="cell-frame-container"], ' +
      'div[data-testid="archived-chats"] [data-testid="cell-frame-container"]'
    );

    cellFrames.forEach(cell => {
      // 1. Lewati tombol header "Diarsipkan" di daftar utama
      const isArchivedHeaderBtn = cell.closest('[data-testid="archived"]') && 
                                  !cell.closest('div[data-testid="archived-chats"]');
      if (isArchivedHeaderBtn) return;

      // 2. Tag seluruh cell teks chat list untuk fitur "blurChatList"
      if (!cell.classList.contains('wa-privacy-chat-list-msg')) {
        cell.classList.add('wa-privacy-chat-list-msg');
      }
      attachDirectHover(cell);

      // 3. Contact Name: Baris Pertama
      const titleEl = cell.querySelector('[data-testid="cell-frame-title"]');
      if (titleEl) {
        const txt = (titleEl.textContent || '').trim();
        if (isPhoneNumber(txt)) {
          if (!titleEl.classList.contains('wa-privacy-number')) {
            titleEl.classList.add('wa-privacy-number');
          }
        } else {
          if (!titleEl.classList.contains('wa-privacy-name')) {
            titleEl.classList.add('wa-privacy-name');
          }
        }
        attachDirectHover(titleEl);
      }

      // 4. Contact Display Last Chat: Baris Kedua Preview Pesan Terakhir
      const lastChild = cell.lastElementChild;
      if (lastChild && lastChild !== titleEl && !lastChild.contains(titleEl)) {
        if (!lastChild.classList.contains('wa-privacy-last-chat')) {
          lastChild.classList.add('wa-privacy-last-chat');
        }
        attachDirectHover(lastChild);
      }
      if (cell.children.length > 1) {
        const secondChild = cell.children[1];
        if (secondChild && secondChild !== titleEl && !secondChild.contains(titleEl)) {
          if (!secondChild.classList.contains('wa-privacy-last-chat')) {
            secondChild.classList.add('wa-privacy-last-chat');
          }
          attachDirectHover(secondChild);
        }
      }

      // 5. Contact Profile: Avatar (Foto Asli maupun Inisial / Tanpa Foto)
      const row = cell.closest('div[role="listitem"]') || 
                  cell.closest('div[role="row"]') || 
                  cell.parentElement;
      if (!row) return;

      // 5.1 Cek Story Ring Hijau
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

      // 5.2 Foto Asli (img)
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

      // 5.3 Kontak Tanpa Foto (Lingkaran Inisial Huruf & Siluet)
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

    // B. Foto Profil Pengguna di Pojok Kiri Bawah ("Kontak Anda")
    const userProfileImgs = document.querySelectorAll(
      'nav img, ' +
      'header[role="navigation"] img, ' +
      'header > div:first-child img, ' +
      'div[role="navigation"] img, ' +
      '[data-testid="profile-pic-btn"] img, ' +
      '[data-testid="profile-pic-btn"], ' +
      'div[role="button"][aria-label*="Profil" i] img, ' +
      'button[aria-label*="Profil" i] img, ' +
      'div[role="button"][aria-label*="Profile" i] img, ' +
      'button[aria-label*="Profile" i] img, ' +
      'div[role="button"][aria-label*="Anda" i] img, ' +
      'button[aria-label*="Anda" i] img, ' +
      'div[role="button"][aria-label*="You" i] img, ' +
      'button[aria-label*="You" i] img'
    );
    userProfileImgs.forEach(img => {
      if (!img.classList.contains('wa-privacy-user-avatar')) {
        img.classList.add('wa-privacy-user-avatar');
      }
      attachDirectHover(img);
      const btn = img.closest('button') || img.closest('div[role="button"]');
      if (btn) attachDirectHover(btn);
    });

    // Deteksi foto profil pojok kiri bawah berdasarkan posisi (rect.left < 80)
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

    // C. Fitur Meta AI
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

  // --------------------------------------------------------------------------
  // 4. Conversation Content & Media di Dalam Obrolan (#main)
  // --------------------------------------------------------------------------
  function setupConversationElements() {
    const mainEl = document.getElementById('main');
    if (!mainEl) return;

    // A. Pesan Teks di Ruang Chat
    const textMessages = mainEl.querySelectorAll(
      'div[role="row"] .copyable-text:not([contenteditable="true"]), ' +
      'div[role="row"] .selectable-text:not([contenteditable="true"]), ' +
      '[data-testid="quoted-message"]'
    );
    textMessages.forEach(msg => {
      if (!msg.classList.contains('wa-privacy-conversation-msg')) {
        msg.classList.add('wa-privacy-conversation-msg');
      }
      attachDirectHover(msg);
    });

    // B. Media di Ruang Chat (Gambar, Video, Voice Notes, Dokumen, Stiker)
    const mediaElements = mainEl.querySelectorAll(
      'img:not(.emoji), video, audio, [data-testid="media-canvas"], ' +
      '[data-testid="audio-player"], [data-testid="audio-track"], [data-testid="ptt-playback"], ' +
      '[data-testid="document-thumb"], [data-testid="document-container"], [data-testid="sticker"]'
    );
    mediaElements.forEach(med => {
      // Jangan blur header avatar
      if (med.closest('header')) return;
      if (!med.classList.contains('wa-privacy-media')) {
        med.classList.add('wa-privacy-media');
      }
      attachDirectHover(med);
    });
  }

  // --------------------------------------------------------------------------
  // 5. New Chat Drawer (Drawer Chat Baru)
  // --------------------------------------------------------------------------
  function setupNewChatDrawerElements() {
    const newChatDrawers = document.querySelectorAll('div[data-animate-drawer-left="true"]');
    newChatDrawers.forEach(drawer => {
      if (drawer.querySelector('[data-testid="archived-chats"]')) return;

      const contactItems = drawer.querySelectorAll('div[role="listitem"], div[role="button"][tabindex="0"]');
      contactItems.forEach(item => {
        const isActionBtn = item.querySelector('[data-icon="community"], [data-icon="groups"], [data-icon="new-group"]');
        if (isActionBtn) return;

        // A. Avatar Kontak di Chat Baru
        const avatar = item.querySelector('img:not(.emoji)') ||
                       item.querySelector('[data-testid="avatar"]') ||
                       item.querySelector('[data-testid="chat-avatar"]') ||
                       item.querySelector('._ak8h');
        if (avatar && !avatar.classList.contains('wa-privacy-new-chat-avatar')) {
          avatar.classList.add('wa-privacy-new-chat-avatar');
          attachDirectHover(avatar);
        }

        // B. Nama Kontak di Chat Baru
        const titleEl = item.querySelector('[data-testid="cell-frame-title"]') ||
                        item.querySelector('span[title]') ||
                        item.querySelector('span[dir="auto"]');
        if (titleEl && !titleEl.classList.contains('wa-privacy-new-chat-name')) {
          titleEl.classList.add('wa-privacy-new-chat-name');
          attachDirectHover(titleEl);
        }

        // C. Info / Bio / Nomor di bawah nama
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

  // --------------------------------------------------------------------------
  // Master Runner
  // --------------------------------------------------------------------------
  function tagAll() {
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

  function init() {
    loadSettings();
    applySettings();
    tagAll();

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

  console.log('[WA Privacy Blur Addon] Version 4.0.0 Modular Privacy Suite Loaded.');
})();
