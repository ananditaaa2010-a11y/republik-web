/**
 * WhatsApp Privacy Blur Addon — Content Script (Version 2.3.0 - Ultra Safe)
 * 
 * Strict Specification:
 * 1. Sidebar Chat List:
 *    - HANYA Foto profil dan Nama kontak chat yang di-blur.
 *    - Preview pesan, jam, stiker, dan status: 100% JERNIH.
 *    - "WhatsApp", Filter chips ("Semua", "Belum dibaca", dll.), "Diarsipkan": 100% JERNIH.
 * 2. Header di Atas Bubble Chat (#main header):
 *    - HANYA Foto profil dan Nama kontak yang di-blur.
 *    - Hover mandiri: kursor ke foto -> foto saja buka; kursor ke nama -> nama saja buka.
 * 3. Chat Bubbles (#main):
 *    - 100% JERNIH (TIDAK ADA BLUR PADA PESAN SAMA SEKALI).
 * 4. Drawer Info Kontak (Saat Profil Diklik):
 *    - Foto profil besar (lingkaran "GP", foto asli, dll.) ter-blur + hover.
 *    - Nama kontak besar ("Gatut P") ter-blur + hover.
 *    - Nomor telepon ter-blur + hover.
 *    - Grup bersama ter-blur + hover.
 * 5. Meta AI & Profil Pojok Kiri Bawah:
 *    - Ter-blur + hover.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'wa_privacy_blur_enabled';
  let isBlurEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';

  function applyBlurState() {
    if (isBlurEnabled) {
      document.body.classList.remove('wa-blur-disabled');
    } else {
      document.body.classList.add('wa-blur-disabled');
    }
  }

  function showToast(message) {
    let toast = document.getElementById('wa-privacy-blur-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wa-privacy-blur-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(17, 27, 33, 0.92);
        color: #00a884;
        border: 1px solid rgba(0, 168, 132, 0.4);
        padding: 10px 18px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: opacity 0.3s ease, transform 0.3s ease;
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

  function toggleBlur() {
    isBlurEnabled = !isBlurEnabled;
    localStorage.setItem(STORAGE_KEY, isBlurEnabled);
    applyBlurState();
    showToast(isBlurEnabled ? '🛡️ Privacy Blur: AKTIF' : '👁️ Privacy Blur: NONAKTIF');
  }

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleBlur();
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
      if (isBlurEnabled) {
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
    const mainHeader = document.querySelector('#main header') || document.querySelector('header');
    if (!mainHeader) return;

    const headerBtn = mainHeader.querySelector('div[role="button"]') || mainHeader.firstElementChild;
    if (!headerBtn) return;

    // A. Foto Profil di Header
    const avatarEl = headerBtn.firstElementChild;
    if (avatarEl && avatarEl.offsetWidth > 0 && avatarEl.offsetWidth < 90) {
      if (!avatarEl.classList.contains('wa-privacy-header-avatar')) {
        avatarEl.classList.add('wa-privacy-header-avatar');
      }
      attachDirectHover(avatarEl);
    }

    // B. Nama Kontak di Header
    const titleEl = headerBtn.querySelector('span[title]') ||
                    headerBtn.querySelector('._ak8q') ||
                    headerBtn.querySelector('[data-testid="conversation-info-header-chat-title"]') ||
                    headerBtn.querySelector('[data-testid="chat-title"]') ||
                    headerBtn.lastElementChild?.firstElementChild;

    if (titleEl && titleEl !== avatarEl) {
      if (!titleEl.classList.contains('wa-privacy-header-name')) {
        titleEl.classList.add('wa-privacy-header-name');
      }
      attachDirectHover(titleEl);
    }

    // Zero-fail hit engine di atas header
    if (!mainHeader._hasHeaderHitEngine) {
      mainHeader._hasHeaderHitEngine = true;
      mainHeader.addEventListener('mousemove', (e) => {
        if (!isBlurEnabled) return;

        const curAvatar = headerBtn.firstElementChild;
        const curTitle = headerBtn.querySelector('span[title]') ||
                         headerBtn.querySelector('._ak8q') ||
                         headerBtn.querySelector('[data-testid="conversation-info-header-chat-title"]') ||
                         headerBtn.querySelector('[data-testid="chat-title"]') ||
                         headerBtn.lastElementChild?.firstElementChild;

        if (curAvatar) {
          const rect = curAvatar.getBoundingClientRect();
          const isOverAvatar = (
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom
          );
          if (isOverAvatar) {
            curAvatar.style.setProperty('filter', 'none', 'important');
            curAvatar.style.setProperty('-webkit-filter', 'none', 'important');
          } else {
            curAvatar.style.removeProperty('filter');
            curAvatar.style.removeProperty('-webkit-filter');
          }
        }

        if (curTitle) {
          const rect = curTitle.getBoundingClientRect();
          const isOverTitle = (
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom
          );
          if (isOverTitle) {
            curTitle.style.setProperty('filter', 'none', 'important');
            curTitle.style.setProperty('-webkit-filter', 'none', 'important');
          } else {
            curTitle.style.removeProperty('filter');
            curTitle.style.removeProperty('-webkit-filter');
          }
        }
      });

      mainHeader.addEventListener('mouseleave', () => {
        const curAvatar = headerBtn.firstElementChild;
        const curTitle = headerBtn.querySelector('span[title]') ||
                         headerBtn.querySelector('._ak8q') ||
                         headerBtn.lastElementChild?.firstElementChild;
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
  // 2. Drawer Info Kontak (HANYA MENGINSPEKSI DRAWER KANAN RESMI)
  // --------------------------------------------------------------------------
  function setupDrawerElements() {
    // KHUSUS DRAWER INFO KONTAK (TIDAK BOLEH MEMINDAI SECTION / REGION LAIN)
    const drawers = document.querySelectorAll(
      '[data-animate-drawer-right="true"], div[data-testid="contact-info"], div[data-testid="chat-info-drawer"]'
    );

    drawers.forEach(drawer => {
      // A. Foto Profil Besar di Drawer (Lingkaran inisial "GP", foto asli, dsb.)
      const drawerImgs = drawer.querySelectorAll('img, [data-testid="profile-pic"], [data-testid="avatar"]');
      drawerImgs.forEach(img => {
        if (!img.classList.contains('wa-privacy-drawer-avatar')) {
          img.classList.add('wa-privacy-drawer-avatar');
        }
        attachDirectHover(img);
      });

      // Deteksi wadah lingkaran avatar besar ("GP")
      const allDivs = drawer.querySelectorAll('div[role="button"] > div, div');
      allDivs.forEach(d => {
        if (d.offsetWidth >= 60 && d.offsetWidth <= 250 && d.offsetHeight >= 60 && d.offsetHeight <= 250) {
          const comp = window.getComputedStyle(d);
          if (comp.borderRadius === '50%' || comp.borderRadius.includes('50%') || comp.borderRadius.includes('9999px')) {
            if (!d.classList.contains('wa-privacy-drawer-avatar')) {
              d.classList.add('wa-privacy-drawer-avatar');
            }
            attachDirectHover(d);
          }
        }
      });

      // B. Nama Kontak Besar di Drawer ("Gatut P")
      const headings = drawer.querySelectorAll('h2, [data-testid="contact-info-title"], [data-testid="chat-info-title"]');
      headings.forEach(h => {
        if (!h.classList.contains('wa-privacy-drawer-name')) {
          h.classList.add('wa-privacy-drawer-name');
        }
        attachDirectHover(h);
      });

      // C. Nomor Telepon / Info Status di Drawer
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

      // D. Grup Bersama (Shared Groups) di Drawer
      const sharedRows = drawer.querySelectorAll('div[role="listitem"], div[role="button"][tabindex="0"]');
      sharedRows.forEach(row => {
        if (row.offsetTop > 250) {
          const groupAvatar = row.querySelector('img') || row.querySelector('._ak8h') || row.firstElementChild;
          if (groupAvatar && groupAvatar.offsetWidth > 0 && groupAvatar.offsetWidth < 75) {
            if (!groupAvatar.classList.contains('wa-privacy-shared-avatar')) {
              groupAvatar.classList.add('wa-privacy-shared-avatar');
            }
            attachDirectHover(groupAvatar);
          }

          const groupTitle = row.querySelector('span[title]') || row.querySelector('._ak8q');
          if (groupTitle) {
            if (!groupTitle.classList.contains('wa-privacy-shared-name')) {
              groupTitle.classList.add('wa-privacy-shared-name');
            }
            attachDirectHover(groupTitle);
          }
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 3. Sidebar Chat List, Meta AI, & Profil Pojok Kiri Bawah
  // --------------------------------------------------------------------------
  function setupSidebarAndControls() {
    // A. Sidebar Chat List
    const cellFrames = document.querySelectorAll('#pane-side [data-testid="cell-frame-container"]');
    cellFrames.forEach(cell => {
      // JANGAN PERNAH SENTUH JIKA INI BARIS ARSIP ATAU FILTER
      if (cell.closest('[data-testid="archived"]') || 
          cell.closest('button') || 
          cell.textContent.includes('Diarsipkan')) {
        return;
      }

      // 1. Avatar Foto Profil di sebelah kiri chat
      const avatarEl = cell.previousElementSibling || 
                       cell.parentElement?.querySelector('img') || 
                       cell.parentElement?.querySelector('._ak8h') || 
                       cell.parentElement?.firstElementChild;

      if (avatarEl && avatarEl.offsetWidth > 0 && avatarEl.offsetWidth < 75) {
        if (!avatarEl.querySelector('[data-icon*="archiv"]') && !avatarEl.classList.contains('wa-privacy-avatar')) {
          avatarEl.classList.add('wa-privacy-avatar');
        }
        attachDirectHover(avatarEl);
      }

      // 2. Nama Kontak Chat di Baris Atas
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
      // BARIS KEDUA (PREVIEW PESAN, STIKER, JAM) 100% TIDAK DISENTUH.
    });

    // B. Profil Pengguna di Pojok Kiri Bawah
    const userProfileButtons = document.querySelectorAll(
      'header > div:first-child img, ' +
      'nav button:last-child img, ' +
      'nav div[role="button"]:last-child img, ' +
      '[data-testid="profile-pic-btn"]'
    );
    userProfileButtons.forEach(btn => {
      if (!btn.classList.contains('wa-privacy-avatar')) {
        btn.classList.add('wa-privacy-avatar');
      }
      attachDirectHover(btn);
    });

    // C. Fitur Meta AI
    const metaAiElements = document.querySelectorAll(
      'button[aria-label*="Meta AI"], ' +
      'div[aria-label*="Meta AI"], ' +
      'button[title*="Meta AI"], ' +
      'div[title*="Meta AI"], ' +
      'span[data-icon*="meta-ai"], ' +
      'span[data-icon*="ai-"], ' +
      '[data-testid="meta-ai-button"]'
    );
    metaAiElements.forEach(el => {
      if (!el.classList.contains('wa-privacy-meta-ai')) {
        el.classList.add('wa-privacy-meta-ai');
      }
      attachDirectHover(el);
    });
  }

  // --------------------------------------------------------------------------
  // Master Runner (TIDAK MENYENTUH PESAN ATAU TULISAN SISTEM APAPUN)
  // --------------------------------------------------------------------------
  function tagAll() {
    setupHeaderElements();
    setupDrawerElements();
    setupSidebarAndControls();
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
    applyBlurState();
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

  console.log('[WA Privacy Blur Addon] Version 2.3.0 Ultra Safe Loaded.');
})();
