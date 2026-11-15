const { ipcRenderer, webFrame } = require('electron');

// 0. Hardened anti-bot & Edge Emulation: spoof navigator.webdriver & navigator.userAgentData
try {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true
  });

  const edgeBrands = [
    { brand: "Not(A:Brand", version: "99" },
    { brand: "Microsoft Edge", version: "133" },
    { brand: "Chromium", version: "133" }
  ];

  if (navigator.userAgentData) {
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => ({
        brands: edgeBrands,
        mobile: false,
        platform: "Windows",
        getHighEntropyValues: async () => ({
          brands: edgeBrands,
          mobile: false,
          platform: "Windows",
          platformVersion: "15.0.0",
          architecture: "x86",
          bitness: "64",
          model: "",
          uaFullVersion: "133.0.3065.92",
          fullVersionList: edgeBrands
        })
      }),
      configurable: true
    });
  }

  // Also execute into main world so page scripts see Edge environment natively
  if (webFrame && typeof webFrame.executeJavaScript === 'function') {
    webFrame.executeJavaScript(`
      (function() {
        try {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
          const brands = [
            { brand: "Not(A:Brand", version: "99" },
            { brand: "Microsoft Edge", version: "133" },
            { brand: "Chromium", version: "133" }
          ];
          if (navigator.userAgentData) {
            Object.defineProperty(navigator, 'userAgentData', {
              get: () => ({
                brands: brands,
                mobile: false,
                platform: "Windows",
                getHighEntropyValues: async () => ({
                  brands: brands,
                  mobile: false,
                  platform: "Windows",
                  platformVersion: "15.0.0",
                  architecture: "x86",
                  bitness: "64",
                  model: "",
                  uaFullVersion: "133.0.3065.92",
                  fullVersionList: brands
                })
              }),
              configurable: true
            });
          }
        } catch(e) {}
      })();
    `);
  }
} catch (e) {}

// 0. Native Notification Bridge for WhatsApp, Telegram, and Gmail
try {
  class NativeNotificationBridge extends EventTarget {
    constructor(title, options = {}) {
      super();
      this.title = title || '';
      this.body = options.body || '';
      this.icon = options.icon || '';
      this.tag = options.tag || '';

      ipcRenderer.send('notification:show', {
        title: this.title,
        body: this.body,
        icon: this.icon,
        tag: this.tag
      });

      setTimeout(() => {
        const ev = new Event('show');
        this.dispatchEvent(ev);
        if (typeof this.onshow === 'function') this.onshow(ev);
      }, 50);
    }

    static get permission() {
      return 'granted';
    }

    static requestPermission(callback) {
      if (typeof callback === 'function') {
        callback('granted');
      }
      return Promise.resolve('granted');
    }

    close() {
      const ev = new Event('close');
      this.dispatchEvent(ev);
      if (typeof this.onclose === 'function') this.onclose(ev);
    }
  }

  Object.defineProperty(window, 'Notification', {
    value: NativeNotificationBridge,
    writable: true,
    configurable: true
  });

  if (window.ServiceWorkerRegistration && window.ServiceWorkerRegistration.prototype) {
    window.ServiceWorkerRegistration.prototype.showNotification = function(title, options = {}) {
      ipcRenderer.send('notification:show', {
        title: title || '',
        body: options.body || '',
        icon: options.icon || '',
        tag: options.tag || ''
      });
      return Promise.resolve();
    };
  }

  if (navigator.permissions && navigator.permissions.query) {
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(param) {
      if (param && ['notifications', 'microphone', 'camera', 'speaker-selection'].includes(param.name)) {
        return Promise.resolve({ state: 'granted', onchange: null });
      }
      return origQuery(param);
    };
  }
} catch (e) {}

// Skip badge observers or DOM injections on authentication pages
const isAuthPage = window.location.hostname && (
  window.location.hostname.includes('accounts.google.com') ||
  window.location.hostname.includes('oauth.telegram.org')
);

if (!isAuthPage) {
  // 1. Unread badge tracker for WhatsApp Web, Telegram, and Gmail
  let lastUnreadCount = 0;

  function parseUnreadCountFromTitle() {
    const match = document.title.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function checkUnread() {
    const count = parseUnreadCountFromTitle();
    if (count !== lastUnreadCount) {
      lastUnreadCount = count;
      ipcRenderer.send('view:badge-updated', count);
    }
  }

  // 2. Suppress "browser no longer supported" notification bar on Gmail cleanly via CSS
  function suppressUnsupportedBrowserBanner() {
    if (!window.location.hostname || !window.location.hostname.includes('mail.google.com')) return;

    // Inject CSS rule — handled natively by Chromium CSS engine without JS overhead or layout thrashing
    const styleId = 'republik-gmail-banner-fix';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        div[role="alert"]:has(a[href*="support.google.com"]),
        div[aria-live="polite"]:has(a[href*="support.google.com"]),
        div:has(> *[aria-label*="tidak lagi didukung"]),
        div:has(> *[aria-label*="no longer supported"]),
        .bno {
          display: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  // Observe document title changes & Gmail banner
  window.addEventListener('DOMContentLoaded', () => {
    const titleEl = document.querySelector('title');
    if (titleEl) {
      const titleObserver = new MutationObserver(() => checkUnread());
      titleObserver.observe(titleEl, { childList: true, characterData: true });
    }
    // Lightweight fallback check every 5s instead of 2s to minimize background wakeups
    setInterval(checkUnread, 5000);

    // One-time CSS injection for Gmail banner fix (zero CPU cost, zero layout thrashing)
    suppressUnsupportedBrowserBanner();
  });

  // 3. Universal Auto Text Engine (Tab Trigger for WhatsApp, Telegram, Gmail)
  let autoTexts = [];
  const autoTextMap = new Map();

  function updateAutoTexts(items) {
    if (!Array.isArray(items)) return;
    autoTexts = items;
    autoTextMap.clear();
    for (const item of items) {
      if (item && item.shortcut) {
        const rawKey = item.shortcut.trim().toLowerCase();
        const strippedKey = rawKey.replace(/^[\/!#@.]+/, '');
        autoTextMap.set(rawKey, item);
        if (strippedKey && strippedKey !== rawKey) {
          autoTextMap.set(strippedKey, item);
        }
      }
    }
  }

  function findTemplate(word) {
    if (!word) return null;
    const lower = word.toLowerCase();
    if (autoTextMap.has(lower)) return autoTextMap.get(lower);

    const stripped = lower.replace(/^[\/!#@.]+/, '');
    if (stripped && autoTextMap.has(stripped)) return autoTextMap.get(stripped);

    const withSlash = '/' + stripped;
    if (autoTextMap.has(withSlash)) return autoTextMap.get(withSlash);

    return null;
  }

  // Initial load
  ipcRenderer.invoke('autotext:get').then(updateAutoTexts).catch(() => {});
  // Live sync from main process
  ipcRenderer.on('autotext:sync', (event, items) => {
    updateAutoTexts(items);
  });

  function detectRecipientName() {
    try {
      const host = window.location.hostname || '';

      // WhatsApp Web
      if (host.includes('whatsapp.com')) {
        const header = document.querySelector('#main header');
        if (header) {
          const els = header.querySelectorAll(
            '[data-testid="conversation-info-header-chat-title"], div[role="button"] span[title], span[title], span[dir="auto"]'
          );
          for (const el of els) {
            const raw = el.getAttribute('title') || el.textContent || el.innerText || '';
            const clean = cleanRecipientName(raw);
            if (clean) return clean;
          }
        }
      }

      // Telegram Web
      if (host.includes('web.telegram.org')) {
        const els = document.querySelectorAll(
          '.chat-info .peer-title, .top .peer-title, .ChatInfo .title, header .chat-title, .user-title, .chat-title'
        );
        for (const el of els) {
          const raw = el.textContent || el.innerText || '';
          const clean = cleanRecipientName(raw);
          if (clean) return clean;
        }
      }

      // Gmail
      if (host.includes('mail.google.com')) {
        const els = document.querySelectorAll(
          'div[name="to"] span[email], .vR .vN, div[people-kit-id] span, span[email]'
        );
        for (const el of els) {
          const raw = el.textContent || el.innerText || el.getAttribute('email') || '';
          const clean = cleanRecipientName(raw);
          if (clean) return clean;
        }
      }
    } catch (e) {
      // quiet fallback
    }
    return 'Kak';
  }

  function cleanRecipientName(raw) {
    if (!raw) return '';
    let str = raw.trim();
    const blacklist = [
      'online', 'typing...', 'mengetik...', 'terakhir dilihat', 'last seen',
      'click here for', 'ketuk di sini', 'pesan berbintang', 'info kontak',
      'group info', 'info grup', 'mute notifications', 'bisukan'
    ];
    if (blacklist.some(b => str.toLowerCase().includes(b))) return '';
    str = str.replace(/\(.*?\)/g, '').trim();
    return str || '';
  }

  function resolveVariables(templateText) {
    if (!templateText) return '';
    const now = new Date();
    const recipient = detectRecipientName();
    const pad = (n) => String(n).padStart(2, '0');
    const jam = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const tanggal = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hari = days[now.getDay()];

    const hour = now.getHours();
    let waktu = 'pagi';
    if (hour >= 11 && hour < 15) {
      waktu = 'siang';
    } else if (hour >= 15 && hour < 18) {
      waktu = 'sore';
    } else if (hour >= 18 || hour < 5) {
      waktu = 'malam';
    }

    let res = templateText;
    if (recipient.trim().toLowerCase() === 'kak') {
      res = res.replace(/(?:kak|kakak)\s+\{nama\}/gi, 'Kak');
    }

    return res
      .replace(/\{nama\}/gi, recipient)
      .replace(/\{jam\}/gi, jam)
      .replace(/\{tanggal\}/gi, tanggal)
      .replace(/\{hari\}/gi, hari)
      .replace(/\{waktu\}/gi, waktu);
  }

  function showAutoTextToast(shortcut) {
    try {
      let toast = document.getElementById('republik-autotext-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'republik-autotext-toast';
        toast.style.cssText = `
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: rgba(16, 185, 129, 0.95);
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          z-index: 999999;
          pointer-events: none;
          transition: opacity 0.25s ease, transform 0.25s ease;
          opacity: 0;
          transform: translateY(10px);
        `;
        (document.body || document.documentElement).appendChild(toast);
      }
      toast.textContent = `⚡ Auto Text: ${shortcut}`;
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
      clearTimeout(toast._timeout);
      toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
      }, 1200);
    } catch (e) {}
  }

  function getDeepestLastTextNode(node) {
    let curr = node;
    while (curr) {
      if (curr.nodeType === Node.TEXT_NODE) {
        return { node: curr, offset: curr.textContent.length };
      }
      if (curr.nodeType === Node.ELEMENT_NODE && curr.childNodes && curr.childNodes.length > 0) {
        curr = curr.lastChild;
      } else {
        curr = curr.previousSibling;
      }
    }
    return null;
  }

  function findTextNodeBeforeCaret(containerNode, caretOffset) {
    if (!containerNode) return null;

    if (containerNode.nodeType === Node.TEXT_NODE) {
      if (caretOffset > 0) {
        return { node: containerNode, offset: caretOffset };
      }
      let prev = containerNode.previousSibling;
      while (!prev && containerNode.parentElement) {
        containerNode = containerNode.parentElement;
        prev = containerNode.previousSibling;
      }
      if (prev) {
        return getDeepestLastTextNode(prev);
      }
      return null;
    }

    if (containerNode.nodeType === Node.ELEMENT_NODE) {
      let target = null;
      if (caretOffset > 0 && caretOffset <= containerNode.childNodes.length) {
        target = containerNode.childNodes[caretOffset - 1];
      } else if (containerNode.childNodes.length > 0) {
        target = containerNode.lastChild;
      }

      while (target) {
        if (target.nodeType === Node.TEXT_NODE) {
          return { node: target, offset: target.textContent.length };
        }
        if (target.nodeType === Node.ELEMENT_NODE) {
          if (target.childNodes && target.childNodes.length > 0) {
            target = target.lastChild;
          } else {
            target = target.previousSibling;
          }
        } else {
          break;
        }
      }
    }
    return null;
  }

  let isExpanding = false;

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.repeat) return; // Prevent key repeat when Tab is held down
    if (isExpanding) return; // Prevent double-triggering while expansion is in progress
    if (autoTextMap.size === 0) return;

    // 1. Check textarea or standard input first
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || (activeEl.tagName === 'INPUT' && /^(text|search)$/i.test(activeEl.type)))) {
      const val = activeEl.value || '';
      const pos = activeEl.selectionStart;
      const textBefore = val.slice(0, pos);
      const match = textBefore.match(/([\/!#@.]*[a-zA-Z0-9_!#@.-]+)[\s\u200B-\u200D\uFEFF]*$/);
      if (match) {
        const fullWord = match[1];
        const tpl = findTemplate(fullWord);
        if (tpl) {
          e.preventDefault();
          e.stopPropagation();
          const expanded = resolveVariables(tpl.content || tpl.text || '');
          const matchFullLength = match[0].length;
          const start = pos - matchFullLength;
          activeEl.setRangeText(expanded, start, pos, 'end');
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          activeEl.dispatchEvent(new Event('change', { bubbles: true }));
          showAutoTextToast(tpl.shortcut || fullWord);
          return;
        }
      }
    }

    // 2. Check contenteditable elements (WhatsApp Web Lexical, Telegram Web, Gmail)
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;

    const caretInfo = findTextNodeBeforeCaret(range.startContainer, range.startOffset);
    if (!caretInfo || !caretInfo.node) return;

    const textNode = caretInfo.node;
    const textOffset = caretInfo.offset;
    const textBefore = textNode.textContent.slice(0, textOffset);
    const match = textBefore.match(/([\/!#@.]*[a-zA-Z0-9_!#@.-]+)[\s\u200B-\u200D\uFEFF]*$/);
    if (!match) return;

    let fullWord = match[1];
    let startNode = textNode;
    let deleteCount = match[0].length;
    let kwStart = textOffset - match[0].length;

    // Cross-node detection: check if preceding text node ends with a prefix symbol like '/'
    // (e.g. when WhatsApp Web splits '/' and 'reken' into separate DOM spans)
    if (kwStart === 0 && !/^[\/!#@.]/.test(fullWord)) {
      let prevNode = textNode.previousSibling;
      while (prevNode && prevNode.nodeType !== Node.TEXT_NODE) {
        if (prevNode.lastChild) prevNode = prevNode.lastChild;
        else prevNode = prevNode.previousSibling;
      }
      if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
        const prevMatch = prevNode.textContent.match(/([\/!#@.]+)$/);
        if (prevMatch) {
          const combinedWord = prevMatch[1] + fullWord;
          if (findTemplate(combinedWord) || findTemplate(fullWord)) {
            startNode = prevNode;
            kwStart = prevNode.textContent.length - prevMatch[1].length;
            fullWord = combinedWord;
            deleteCount += prevMatch[1].length;
          }
        }
      }
    }

    const tpl = findTemplate(fullWord);
    if (!tpl) return;

    // Found match - prevent default Tab key jump immediately
    e.preventDefault();
    e.stopPropagation();

    // Identify editable root container
    const isWhatsApp = window.location.hostname && window.location.hostname.includes('whatsapp.com');
    const editableContainer =
      (activeEl && activeEl.isContentEditable ? activeEl : null) ||
      (textNode.parentElement ? textNode.parentElement.closest('[contenteditable="true"]') : null) ||
      document.querySelector('#main footer div[contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
      document.querySelector('div[role="textbox"][contenteditable="true"]') ||
      activeEl;

    // Ensure focus on editable container
    if (editableContainer && typeof editableContainer.focus === 'function') {
      editableContainer.focus();
    }

    const expanded = resolveVariables(tpl.content || tpl.text || '');

    // Invoke native replacement via Electron IPC:
    // Electron's sendInputEvent sends real OS-level Backspace keystrokes to erase the keyword
    // character-by-character from Lexical's internal state tree and DOM,
    // then cleanly pastes the expanded template text!
    isExpanding = true;
    ipcRenderer.invoke('autotext:pasteNative', { text: expanded, deleteCount }).then(() => {
      if (editableContainer) {
        try {
          editableContainer.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: expanded }));
          editableContainer.dispatchEvent(new Event('input', { bubbles: true }));
          editableContainer.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) {}
      }
    }).catch(() => {
      try {
        document.execCommand('insertText', false, expanded);
      } catch (err) {}
    }).finally(() => {
      setTimeout(() => {
        isExpanding = false;
      }, 150);
    });

    showAutoTextToast(tpl.shortcut || fullWord);
  }, true);
}
