/**
 * WhatsApp Privacy Blur Addon — Content Script (Version 3.1.0 - Total Avatar & Nav Fix)
 * 
 * Prinsip Mutlak:
 * 1. HANYA Foto Profil (Gambar asli, inisial huruf, ikon default), Nama Kontak, Foto Akun Sendiri di pojok kiri bawah, dan Meta AI yang di-blur.
 * 2. Berlaku di DAFTAR UTAMA maupun di DALAM ARSIP (Archived Chats).
 * 3. PESAN OBROLAN, preview pesan baris kedua, jam, tanda centang status 100% JERNIH NORMAL (DILARANG BLUR).
 * 4. SIDEBAR KIRI NAVIGASI (Chat, Status, Komunitas, Telepon/Panggilan, Saluran, Media/Bintang, Pengaturan) 100% JERNIH (DILARANG BLUR).
 * 5. Tanda lingkaran hijau status/story WA TETAP TERLIHAT JELAS & TAJAM (tidak blur).
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
    }

    // B. Nama Kontak di Header (#main header) - TIDAK DIUBAH
    const titleCandidates = headerBtn.querySelectorAll('span[title], div[title], ._ak8q, [data-testid="conversation-info-header-chat-title"], [data-testid="chat-title"]');
    titleCandidates.forEach(el => {
      if (!el.closest('.wa-privacy-header-avatar') && !el.classList.contains('wa-privacy-header-name')) {
        el.classList.add('wa-privacy-header-name');
      }
    });

    // Independent Hover di Header
    if (!headerBtn.dataset.waHoverBound) {
      headerBtn.dataset.waHoverBound = 'true';

      headerBtn.addEventListener('mousemove', (e) => {
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
  // 2. Drawer Info Kontak (Profil Besar & Inisial)
  // --------------------------------------------------------------------------
  function setupDrawerElements() {
    const drawers = document.querySelectorAll(
      '[data-animate-drawer-right="true"], div[data-testid="contact-info"], div[data-testid="chat-info-drawer"]'
    );

    drawers.forEach(drawer => {
      // A. Foto Profil Besar / Lingkaran Inisial ("GP", foto asli, dsb.)
      const drawerImgs = drawer.querySelectorAll('img:not(.emoji), [data-testid="profile-pic"], [data-testid="avatar"]');
      drawerImgs.forEach(img => {
        if (!img.classList.contains('wa-privacy-drawer-avatar')) {
          img.classList.add('wa-privacy-drawer-avatar');
        }
        attachDirectHover(img);
      });

      // Deteksi wadah lingkaran avatar besar ("GP")
      const allDivs = drawer.querySelectorAll('div[role="button"] > div, div');
      allDivs.forEach(d => {
        const txt = (d.textContent || '').trim();
        const isInitialText = /^[\p{L}\p{N}]{1,3}$/u.test(txt);
        if ((d.offsetWidth >= 50 && d.offsetWidth <= 250 && d.offsetHeight >= 50 && d.offsetHeight <= 250) || isInitialText) {
          const comp = window.getComputedStyle(d);
          if (comp.borderRadius === '50%' || comp.borderRadius.includes('50%') || comp.borderRadius.includes('9999px') || isInitialText) {
            if (!d.classList.contains('wa-privacy-drawer-avatar')) {
              d.classList.add('wa-privacy-drawer-avatar');
            }
            attachDirectHover(d);
          }
        }
      });

      // B. Nama Kontak Besar di Drawer ("Gatut P" - TIDAK DIUBAH)
      const headings = drawer.querySelectorAll('h2, [data-testid="contact-info-title"], [data-testid="chat-info-title"]');
      headings.forEach(h => {
        if (!h.classList.contains('wa-privacy-drawer-name')) {
          h.classList.add('wa-privacy-drawer-name');
        }
        attachDirectHover(h);
      });

      // C. Nomor Telepon / Info Status di Drawer (TIDAK DIUBAH)
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

      // D. Grup Bersama (Shared Groups) di Drawer (TIDAK DIUBAH)
      const sharedRows = drawer.querySelectorAll('div[role="listitem"], div[role="button"][tabindex="0"]');
      sharedRows.forEach(row => {
        if (row.offsetTop > 250) {
          const groupAvatar = row.querySelector('img:not(.emoji)') || row.querySelector('._ak8h') || row.firstElementChild;
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
  // 3. Sidebar Chat List, Arsip, Meta AI, & Profil Pojok Kiri Bawah
  // --------------------------------------------------------------------------
  function setupSidebarAndControls() {
    // A. Ambil semua cell frame di Sidebar Utama MAUPUN di dalam Arsip (Archived Chats)
    const cellFrames = document.querySelectorAll(
      '#pane-side [data-testid="cell-frame-container"], ' +
      'div[data-testid="archived-chats"] [data-testid="cell-frame-container"], ' +
      'div[data-animate-drawer-left="true"] [data-testid="cell-frame-container"]'
    );

    cellFrames.forEach(cell => {
      // 1. Lewati tombol header "Diarsipkan" di daftar utama (bukan chat di dalam arsip)
      const isArchivedHeaderBtn = cell.closest('[data-testid="archived"]') && 
                                  !cell.closest('div[data-testid="archived-chats"]') &&
                                  !cell.closest('div[data-animate-drawer-left="true"]');
      if (isArchivedHeaderBtn) return;

      // 2. Nama Kontak Chat di Baris Atas (TIDAK DIUBAH)
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
      // BARIS KEDUA (PREVIEW PESAN, STIKER, JAM) 100% TIDAK PERNAH DISENTUH.

      // 3. Avatar Kontak (Foto gambar asli maupun lingkaran inisial):
      // Di WhatsApp Web, wadah avatar berada persis di sebelah kiri cell teks (previousElementSibling atau child pertama row)
      const avatarContainer = cell.previousElementSibling || 
                              (cell.parentElement && cell.parentElement.firstElementChild !== cell ? cell.parentElement.firstElementChild : null);
      if (!avatarContainer) return;

      // Cek apakah ada story ring (lingkaran hijau status WA)
      const statusSvg = avatarContainer.querySelector('svg._ak8i, circle[stroke], svg[class*="_ak8i"]');
      if (statusSvg) {
        // Jaga lingkaran hijau tetap 100% jernih dan terlihat
        statusSvg.style.setProperty('filter', 'none', 'important');
        statusSvg.style.setProperty('-webkit-filter', 'none', 'important');
        statusSvg.style.setProperty('opacity', '1', 'important');

        // Hapus blur dari wadah svg ring itu sendiri jika ada
        avatarContainer.classList.remove('wa-privacy-avatar');
        avatarContainer.style.removeProperty('filter');
        avatarContainer.style.removeProperty('-webkit-filter');

        // Blur hanya foto / inisial di DALAM ring
        const innerAvatar = avatarContainer.querySelector('img:not(.emoji)') ||
                            avatarContainer.querySelector('div:not(:has(svg))') ||
                            avatarContainer.lastElementChild;
        if (innerAvatar && innerAvatar !== statusSvg) {
          if (!innerAvatar.classList.contains('wa-privacy-avatar')) {
            innerAvatar.classList.add('wa-privacy-avatar');
          }
          attachDirectHover(innerAvatar);
        }
      } else {
        // Tanpa story ring: Blur wadah avatar & img di dalamnya (meliputi gambar asli maupun inisial lingkaran huruf "A", "T")
        if (!avatarContainer.classList.contains('wa-privacy-avatar')) {
          avatarContainer.classList.add('wa-privacy-avatar');
        }
        attachDirectHover(avatarContainer);

        const img = avatarContainer.querySelector('img:not(.emoji)');
        if (img) {
          if (!img.classList.contains('wa-privacy-avatar')) {
            img.classList.add('wa-privacy-avatar');
          }
          attachDirectHover(img);
        }
      }
    });

    // B. Foto Profil Pengguna di Pojok Kiri Bawah ("Kontak Anda")
    const userProfileButtons = document.querySelectorAll(
      'nav button:last-child img, ' +
      'nav button:last-child > div, ' +
      'nav div[role="button"]:last-child img, ' +
      'nav div[role="button"]:last-child > div, ' +
      'header[role="navigation"] button:last-child img, ' +
      'header[role="navigation"] div[role="button"]:last-child img, ' +
      '[data-testid="profile-pic-btn"] img, ' +
      '[data-testid="profile-pic-btn"], ' +
      'div[role="button"][aria-label*="Profil" i] img, ' +
      'div[role="button"][aria-label*="Profile" i] img, ' +
      'button[aria-label*="Profil" i] img, ' +
      'button[aria-label*="Profile" i] img'
    );
    userProfileButtons.forEach(btn => {
      if (!btn.classList.contains('wa-privacy-user-avatar')) {
        btn.classList.add('wa-privacy-user-avatar');
      }
      attachDirectHover(btn);
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
  // Master Runner (TIDAK MENYENTUH PESAN ATAU IKON NAVIGASI APAPUN)
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

  console.log('[WA Privacy Blur Addon] Version 3.1.0 Total Avatar & Nav Fix Loaded.');
})();
