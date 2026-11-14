const { WebContentsView, BrowserWindow, session, ipcMain, app, shell, Menu, MenuItem, clipboard } = require('electron');
const path = require('path');
const {
  WHATSAPP_WEB_URL,
  CHROME_USER_AGENT,
  FIREFOX_USER_AGENT,
  PLATFORM_URLS,
  SIDEBAR_WIDTH
} = require('../config/constants');

const APP_ICON_PATH = path.join(__dirname, '../../assets/icon.png');

class ViewManager {
  constructor(mainWindow, accountStore, notificationStore) {
    this.mainWindow = mainWindow;
    this.accountStore = accountStore;
    this.notificationStore = notificationStore;
    this.views = new Map(); // accountId -> WebContentsView
    this.loadingViews = new Map(); // accountId -> Promise<WebContentsView> (prevents race conditions)
    this.activeAccountId = null;
    this.sidebarWidth = SIDEBAR_WIDTH || 64; // Exactly match CSS sidebar width
    this.addModalWindow = null;
    this.editModalWindow = null;
    this.helpModalWindow = null;
    this.autoTextModalWindow = null;
    this.notificationModalWindow = null;

    this.setupWindowEvents();
    this.setupIPC();
  }

  getViewBounds() {
    // getContentBounds() returns true client area without OS titlebar/frame
    const { width, height } = this.mainWindow.getContentBounds();
    return {
      x: this.sidebarWidth,
      y: 0,
      width: Math.max(0, width - this.sidebarWidth),
      height: Math.max(0, height)
    };
  }

  updateActiveViewBounds() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isMinimized()) return; // Prevent collapsing bounds to 0x0 on minimize
    if (this.activeAccountId && this.views.has(this.activeAccountId)) {
      const activeView = this.views.get(this.activeAccountId);
      activeView.setBounds(this.getViewBounds());
    }
  }

  setupWindowEvents() {
    // Update view layout on all resize, maximize, and restore events (ignoring minimized state)
    const onResize = () => {
      if (this.mainWindow && !this.mainWindow.isMinimized()) {
        this.updateActiveViewBounds();
      }
    };
    this.mainWindow.on('resize', onResize);
    this.mainWindow.on('maximize', onResize);
    this.mainWindow.on('unmaximize', onResize);
    this.mainWindow.on('restore', onResize);
    this.mainWindow.on('enter-full-screen', onResize);
    this.mainWindow.on('leave-full-screen', onResize);
  }

  setupIPC() {
    // Badge update from WhatsApp Web view
    ipcMain.on('view:badge-updated', (event, count) => {
      const notifSettings = this.notificationStore ? this.notificationStore.getSettings() : { showBadge: true };
      for (const [accId, view] of this.views.entries()) {
        if (view.webContents.id === event.sender.id) {
          const finalCount = (notifSettings.showBadge !== false) ? count : 0;
          this.mainWindow.webContents.send('account:badge-updated', { accountId: accId, count: finalCount });
          break;
        }
      }
    });

    // Add account confirmed from native modal
    ipcMain.on('account:add-confirmed', async (event, { name, color, platform, icon }) => {
      const validPlatform = ['whatsapp', 'telegram', 'gmail'].includes(platform) ? platform : 'whatsapp';
      const safeColor = (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : undefined;
      const safeIcon = typeof icon === 'string' ? icon : '';
      const newAcc = this.accountStore.addAccount(name, safeColor, validPlatform, safeIcon);
      await this.switchAccount(newAcc.id);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('accounts:changed', {
          accounts: this.accountStore.getAccounts(),
          activeAccountId: newAcc.id
        });
      }
    });

    // Edit account confirmed from native modal
    ipcMain.on('account:edit-confirmed', (event, { id, name, color, platform, icon }) => {
      const updates = {};
      if (typeof name === 'string' && name.trim()) updates.name = name.trim().slice(0, 50);
      if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) updates.color = color;
      if (platform && ['whatsapp', 'telegram', 'gmail'].includes(platform)) updates.platform = platform;
      if (typeof icon === 'string') updates.icon = icon;

      this.accountStore.updateAccount(id, updates);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('accounts:changed', {
          accounts: this.accountStore.getAccounts(),
          activeAccountId: this.accountStore.getActiveAccountId()
        });
      }

      // Close whichever modal triggered this
      if (this.editIconModalWindow && !this.editIconModalWindow.isDestroyed()) {
        this.editIconModalWindow.close();
      }
      if (this.editModalWindow && !this.editModalWindow.isDestroyed()) {
        this.editModalWindow.close();
      }
    });

    // Toggle blur on active WhatsApp view from sidebar button
    ipcMain.on('view:toggle-blur', () => {
      if (this.activeAccountId && this.views.has(this.activeAccountId)) {
        const activeView = this.views.get(this.activeAccountId);
        if (activeView && !activeView.webContents.isDestroyed()) {
          activeView.webContents.executeJavaScript(`
            (function() {
              const STORAGE_KEY = 'wa_privacy_blur_enabled';
              const isCurrentlyDisabled = document.body.classList.toggle('wa-blur-disabled');
              const isEnabled = !isCurrentlyDisabled;
              localStorage.setItem(STORAGE_KEY, isEnabled);

              let toast = document.getElementById('wa-privacy-blur-toast');
              if (!toast) {
                toast = document.createElement('div');
                toast.id = 'wa-privacy-blur-toast';
                toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:rgba(17,27,33,0.92);color:#00a884;border:1px solid rgba(0,168,132,0.4);padding:10px 18px;border-radius:8px;font-family:sans-serif;font-size:13px;font-weight:600;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.3s ease,transform 0.3s ease;pointer-events:none;';
                document.body.appendChild(toast);
              }
              toast.innerText = isEnabled ? '🛡️ Privacy Blur: AKTIF' : '👁️ Privacy Blur: NONAKTIF';
              toast.style.opacity = '1';
              toast.style.transform = 'translateY(0)';
              clearTimeout(toast._timeout);
              toast._timeout = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
              }, 2000);
            })();
          `).catch(() => {});
        }
      }
    });
  }

  async getOrCreateView(accountId) {
    if (this.views.has(accountId)) {
      return this.views.get(accountId);
    }
    if (this.loadingViews.has(accountId)) {
      return this.loadingViews.get(accountId);
    }

    const loaderPromise = (async () => {
      const partition = `persist:account_${accountId}`;
      const ses = session.fromPartition(partition);
      const accounts = this.accountStore.getAccounts();
      const account = accounts.find(a => a.id === accountId);
      const platform = (account && account.platform) || 'whatsapp';
      const targetUrl = (PLATFORM_URLS && PLATFORM_URLS[platform]) || WHATSAPP_WEB_URL;
      const isGmail = platform === 'gmail';

      // Default session User-Agent to clean Chrome desktop
      ses.setUserAgent(CHROME_USER_AGENT, 'en-US,en;q=0.9');

      // Single, consolidated request headers handler for this session
      ses.webRequest.onBeforeSendHeaders((details, callback) => {
        const headers = { ...details.requestHeaders };
        delete headers['X-Requested-With'];
        const url = details.url || '';

        // Only use the bypass User-Agent during actual Google login challenge/credential entry
        const isGoogleLogin = platform === 'gmail' && url.includes('accounts.google.com') && (
          url.includes('/signin') ||
          url.includes('/ServiceLogin') ||
          url.includes('/InteractiveLogin')
        );

        // Normalize and clean all casing variations of sec-ch-ua and User-Agent
        for (const k of Object.keys(headers)) {
          const lk = k.toLowerCase();
          if (lk.startsWith('sec-ch-ua') || lk === 'user-agent') {
            delete headers[k];
          }
        }

        if (isGoogleLogin) {
          headers['User-Agent'] = 'https://accounts.google.com/';
        } else {
          headers['User-Agent'] = CHROME_USER_AGENT;
          headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="133", "Google Chrome";v="133"';
          headers['sec-ch-ua-mobile'] = '?0';
          headers['sec-ch-ua-platform'] = '"Windows"';
        }

        callback({ cancel: false, requestHeaders: headers });
      });

      // Grant permissions for notifications, camera, microphone, speaker, and VoIP WebRTC calling
      const allowedPermissions = [
        'notifications',
        'media',
        'camera',
        'microphone',
        'speaker-selection',
        'audio-capture',
        'video-capture',
        'background-sync',
        'display-capture'
      ];

      ses.setPermissionRequestHandler((webContents, permission, callback) => {
        if (allowedPermissions.includes(permission)) {
          return callback(true);
        }
        callback(false);
      });

      ses.setPermissionCheckHandler((webContents, permission) => {
        return allowedPermissions.includes(permission);
      });

      const view = new WebContentsView({
        webPreferences: {
          partition,
          preload: path.join(__dirname, '../preload/viewPreload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
          webSecurity: true,
          backgroundThrottling: false // Keep background instances active like Brave tabs
        }
      });

      // Explicitly disable background throttling on WebContents instance
      if (view.webContents && typeof view.webContents.setBackgroundThrottling === 'function') {
        view.webContents.setBackgroundThrottling(false);
      }

      // Prevent white flash by setting dark background color for WhatsApp/Telegram/Gmail
      if (typeof view.setBackgroundColor === 'function') {
        try {
          view.setBackgroundColor('#111b21');
        } catch (e) {}
      }

      view.webContents.setUserAgent(CHROME_USER_AGENT);

      // If user landed on myaccount.google.com after login, smoothly redirect to Gmail inbox
      if (isGmail) {
        view.webContents.on('did-navigate', (event, url) => {
          if (url && url.startsWith('https://myaccount.google.com')) {
            console.log('[Gmail] On myaccount.google.com, redirecting to Gmail inbox...');
            setImmediate(() => {
              if (view && !view.webContents.isDestroyed()) {
                view.webContents.loadURL('https://mail.google.com/mail/u/0/');
              }
            });
          }
        });
      }

      // Ensure child windows/popups inherit consistent User-Agent
      view.webContents.on('did-create-window', (childWindow) => {
        childWindow.webContents.setUserAgent(CHROME_USER_AGENT);
        childWindow.webContents.setWindowOpenHandler(({ url }) => {
          if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
            shell.openExternal(url).catch(() => {});
          }
          return { action: 'deny' };
        });
      });

      // Handle new windows / popups securely
      view.webContents.setWindowOpenHandler(({ url }) => {
        // Special case: Google account authentication (only for auth flow)
        if (platform === 'gmail' && url.includes('accounts.google.com/')) {
          setImmediate(() => {
            if (view && !view.webContents.isDestroyed()) {
              view.webContents.loadURL(url);
            }
          });
          return { action: 'deny' };
        }

        // For all chat and email links (WhatsApp, Telegram, Gmail):
        // Always open directly in the user's default OS browser!
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
          shell.openExternal(url).catch(() => {});
        }
        return { action: 'deny' };
      });

      // Define strictly allowed internal URLs per platform
      const isUrlAllowedInView = (targetUrl) => {
        if (!targetUrl) return false;
        if (targetUrl === 'about:blank' || targetUrl.startsWith('blob:')) return true;
        if (platform === 'whatsapp') {
          return targetUrl.startsWith('https://web.whatsapp.com') ||
                 targetUrl.includes('whatsapp.com') ||
                 targetUrl.includes('whatsapp.net');
        }
        if (platform === 'telegram') {
          return targetUrl.startsWith('https://web.telegram.org') || targetUrl.includes('telegram.org');
        }
        if (platform === 'gmail') {
          return targetUrl.startsWith('https://mail.google.com') ||
                 targetUrl.startsWith('https://accounts.google.com') ||
                 targetUrl.startsWith('https://myaccount.google.com') ||
                 targetUrl.includes('google.com');
        }
        return false;
      };

      // Prevent view from navigating away from the platform's core web application
      view.webContents.on('will-navigate', (event, targetUrl) => {
        if (!isUrlAllowedInView(targetUrl)) {
          event.preventDefault();
          shell.openExternal(targetUrl).catch(() => {});
        }
      });

      view.webContents.on('will-frame-navigate', (event) => {
        if (event.isMainFrame && !isUrlAllowedInView(event.url)) {
          event.preventDefault();
          shell.openExternal(event.url).catch(() => {});
        }
      });

      // Load Privacy Blur Add-on for WhatsApp Web
      if (platform === 'whatsapp') {
        const fs = require('fs');
        let extPath = path.join(__dirname, '../../blur_extension');
        if (app.isPackaged) {
          const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'blur_extension');
          if (fs.existsSync(unpackedPath)) {
            extPath = unpackedPath;
          }
        }
        try {
          await ses.loadExtension(extPath, { allowFileAccess: true });
        } catch (e) {
          if (!e.message || (!e.message.includes('already loaded') && !e.message.includes('Extension already exists'))) {
            console.log('[Extension] ses.loadExtension notice:', e.message);
          }
        }

        // Guaranteed CSS & script injection on dom-ready and did-finish-load
        const injectBlur = async () => {
          try {
            const fs = require('fs');
            const cssPath = path.join(extPath, 'css/blur.css');
            const jsPath = path.join(extPath, 'js/content.js');
            if (fs.existsSync(cssPath)) {
              const css = fs.readFileSync(cssPath, 'utf8');
              await view.webContents.insertCSS(css);
            }
            if (fs.existsSync(jsPath)) {
              const js = fs.readFileSync(jsPath, 'utf8');
              await view.webContents.executeJavaScript(js);
            }
          } catch (err) {
            console.warn('[Blur Addon] Injection notice:', err.message);
          }
        };

        view.webContents.on('dom-ready', injectBlur);
        view.webContents.on('did-finish-load', injectBlur);
      }

      // User-friendly offline screen if internet disconnects or Wi-Fi captive portal blocks traffic
      view.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        // -3 is ERR_ABORTED, standard when a navigation is cancelled or redirected
        if (isMainFrame && errorCode !== -3) {
          console.warn(`[ViewManager] Page load failed (${errorCode}): ${errorDescription} on ${validatedURL}`);
          const offlineHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Koneksi Terputus</title>
              <style>
                body {
                  margin: 0; padding: 0;
                  background-color: #111b21;
                  color: #e9edef;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  display: flex; align-items: center; justify-content: center;
                  height: 100vh; text-align: center; user-select: none;
                }
                .card {
                  max-width: 480px; padding: 36px 32px;
                  background: #202c33; border-radius: 12px;
                  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                }
                .icon { font-size: 52px; margin-bottom: 16px; }
                h2 { margin: 0 0 12px; font-size: 20px; color: #f1f5f9; }
                p { margin: 0 0 24px; font-size: 14px; color: #8696a0; line-height: 1.6; }
                .btn {
                  background-color: #00a884; color: #111b21;
                  border: none; padding: 12px 28px; border-radius: 8px;
                  font-size: 14px; font-weight: 700; cursor: pointer;
                  transition: background-color 0.2s, transform 0.1s;
                }
                .btn:hover { background-color: #02906f; }
                .btn:active { transform: scale(0.98); }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">📡</div>
                <h2>Koneksi Terputus / Tidak Ada Internet</h2>
                <p>Halaman tidak dapat dimuat karena jaringan internet terputus.<br>
                Jika menggunakan <b>Wifi.id</b> atau Wi-Fi publik, pastikan sudah login pada halaman browser terlebih dahulu.</p>
                <button class="btn" onclick="location.href='${targetUrl}'">Muat Ulang Halaman</button>
              </div>
            </body>
            </html>
          `;
          view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlineHtml)}`).catch(() => {});
        }
      });

      // Load platform URL
      view.webContents.loadURL(targetUrl);

      // Auto-recovery from Google Botguard rejection & poisoned cookies
      if (platform === 'gmail') {
        view.webContents.on('did-navigate', async (event, url) => {
          if (url && url.includes('accounts.google.com') && (url.includes('signin/rejected') || url.includes('rejected') || url.includes('rrk='))) {
            console.warn('[Gmail Auth] Detected Botguard rejection. Purging poisoned cookies...');
            await this.clearGoogleAuthCookies(ses);
          }
        });
      }

      // Native Context Menu for text selection, copy/paste, link, image & reload
      view.webContents.on('context-menu', (event, params) => {
        const menu = new Menu();

        // 1. Spellcheck suggestions (if available)
        if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
          for (const suggestion of params.dictionarySuggestions) {
            menu.append(new MenuItem({
              label: suggestion,
              click: () => view.webContents.replaceMisspelling(suggestion)
            }));
          }
          menu.append(new MenuItem({ type: 'separator' }));
        }

        // 2. Editable text field actions (input box, textarea, contenteditable chat inputs)
        if (params.isEditable) {
          menu.append(new MenuItem({ label: 'Urungkan (Undo)', role: 'undo', enabled: params.editFlags.canUndo }));
          menu.append(new MenuItem({ label: 'Ulangi (Redo)', role: 'redo', enabled: params.editFlags.canRedo }));
          menu.append(new MenuItem({ type: 'separator' }));
          menu.append(new MenuItem({ label: 'Potong (Cut)', role: 'cut', enabled: params.editFlags.canCut }));
          menu.append(new MenuItem({ label: 'Salin (Copy)', role: 'copy', enabled: params.editFlags.canCopy }));
          menu.append(new MenuItem({ label: 'Tempel (Paste)', role: 'paste', enabled: params.editFlags.canPaste }));
          menu.append(new MenuItem({ label: 'Tempel Teks Murni', role: 'pasteAndMatchStyle', enabled: params.editFlags.canPaste }));
          menu.append(new MenuItem({ type: 'separator' }));
          menu.append(new MenuItem({ label: 'Pilih Semua (Select All)', role: 'selectAll', enabled: params.editFlags.canSelectAll }));
        } else if (params.selectionText && params.selectionText.trim().length > 0) {
          // Selected text outside editable areas
          menu.append(new MenuItem({ label: 'Salin (Copy)', role: 'copy', enabled: params.editFlags.canCopy }));
          menu.append(new MenuItem({ label: 'Pilih Semua (Select All)', role: 'selectAll', enabled: params.editFlags.canSelectAll }));
          menu.append(new MenuItem({ type: 'separator' }));
          const previewText = params.selectionText.trim().length > 25
            ? params.selectionText.trim().slice(0, 25) + '...'
            : params.selectionText.trim();
          menu.append(new MenuItem({
            label: `Cari di Google "${previewText}"`,
            click: () => shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(params.selectionText.trim())}`)
          }));
        }

        // 3. Link actions
        if (params.linkURL) {
          if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
          menu.append(new MenuItem({
            label: 'Buka Link di Browser Eksternal',
            click: () => shell.openExternal(params.linkURL)
          }));
          menu.append(new MenuItem({
            label: 'Salin Alamat Link',
            click: () => clipboard.writeText(params.linkURL)
          }));
        }

        // 4. Media/Image actions
        if (params.mediaType === 'image' && params.srcURL) {
          if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
          menu.append(new MenuItem({
            label: 'Salin Gambar',
            click: () => view.webContents.copyImageAt(params.x, params.y)
          }));
          menu.append(new MenuItem({
            label: 'Salin Alamat Gambar',
            click: () => clipboard.writeText(params.srcURL)
          }));
        }

        // 5. General page utilities (Reload, Inspect)
        if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({
          label: 'Muat Ulang Halaman (Reload)',
          click: () => view.webContents.reload()
        }));
        menu.append(new MenuItem({
          label: 'Inspeksi Elemen (DevTools)',
          click: () => view.webContents.inspectElement(params.x, params.y)
        }));

        menu.popup({ window: this.mainWindow });
      });

      this.views.set(accountId, view);
      this.loadingViews.delete(accountId);
      return view;
    })();

    this.loadingViews.set(accountId, loaderPromise);
    return loaderPromise;
  }

  /**
   * Preload all accounts in parallel at startup (like Brave browser tabs).
   * Prioritizes the active account first, then warms up remaining accounts in background with smooth stagger.
   */
  async preloadAllAccounts() {
    const accounts = this.accountStore.getAccounts();
    if (accounts.length === 0) return;

    const activeId = this.accountStore.getActiveAccountId() || accounts[0].id;

    // 1. Instantly display active account first so UI is ready immediately
    await this.switchAccount(activeId);

    // 2. Preload remaining accounts smoothly in background with gentle stagger to prevent CPU/IO spikes
    const otherAccounts = accounts.filter(a => a.id !== activeId);
    otherAccounts.forEach((acc, index) => {
      setTimeout(() => {
        if (!this.views.has(acc.id) && !this.loadingViews.has(acc.id)) {
          console.log(`[ViewManager] Background preloading account: ${acc.name} (${acc.id})`);
          this.getOrCreateView(acc.id).catch(err => {
            console.error(`[ViewManager] Error preloading background view for ${acc.id}:`, err);
          });
        }
      }, 1000 + (index * 1200));
    });
  }

  async switchAccount(accountId) {
    if (this.activeAccountId === accountId && this.views.has(accountId)) {
      this.updateActiveViewBounds();
      return;
    }

    const previousId = this.activeAccountId;
    if (previousId && this.views.has(previousId) && previousId !== accountId) {
      const prevView = this.views.get(previousId);
      try {
        // Move previous view off-screen while keeping it attached so background VoIP/WebRTC calls and audio stay active
        prevView.setBounds({ x: -10000, y: -10000, width: 0, height: 0 });
      } catch (e) {}
    }

    const nextView = await this.getOrCreateView(accountId);
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.contentView) {
        const children = this.mainWindow.contentView.children || [];
        if (!children.includes(nextView)) {
          this.mainWindow.contentView.addChildView(nextView);
        }
      }
    } catch (e) {
      try {
        this.mainWindow.contentView.addChildView(nextView);
      } catch (err) {}
    }
    nextView.setBounds(this.getViewBounds());

    this.activeAccountId = accountId;
    this.accountStore.setActiveAccountId(accountId);
  }

  reloadAccount(accountId) {
    if (this.views.has(accountId)) {
      const view = this.views.get(accountId);
      view.webContents.reload();
    }
  }

  openDevTools(accountId) {
    if (this.views.has(accountId)) {
      const view = this.views.get(accountId);
      view.webContents.openDevTools({ mode: 'detach' });
    }
  }

  async removeAccount(accountId) {
    if (!accountId) return;

    // 1. Immediately remove from accountStore so data model is always up to date
    this.accountStore.removeAccount(accountId);

    // 2. Clean up WebContentsView
    if (this.views.has(accountId)) {
      const view = this.views.get(accountId);
      try {
        this.mainWindow.contentView.removeChildView(view);
      } catch (e) {}
      try {
        if (view.webContents && !view.webContents.isDestroyed()) {
          if (typeof view.webContents.destroy === 'function') {
            view.webContents.destroy();
          } else if (typeof view.webContents.close === 'function') {
            view.webContents.close();
          }
        }
      } catch (err) {
        console.warn(`[ViewManager] Error cleaning up webContents for ${accountId}:`, err.message);
      }
      this.views.delete(accountId);
    }
    if (this.loadingViews.has(accountId)) {
      this.loadingViews.delete(accountId);
    }

    // 3. Switch to next remaining account if any
    const remaining = this.accountStore.getAccounts();
    if (remaining.length > 0) {
      await this.switchAccount(remaining[0].id);
    } else {
      this.activeAccountId = null;
    }

    // 4. Notify renderer that accounts list and active account have changed
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('accounts:changed', {
        accounts: this.accountStore.getAccounts(),
        activeAccountId: this.activeAccountId
      });
    }

    // 5. Clean up persistent partition storage asynchronously without blocking UI
    try {
      const ses = session.fromPartition(`persist:account_${accountId}`);
      await ses.clearStorageData();
    } catch (err) {
      console.warn(`[ViewManager] Failed to clear storage for ${accountId}:`, err.message);
    }
  }

  openAddAccountModal() {
    if (this.addModalWindow && !this.addModalWindow.isDestroyed()) {
      this.addModalWindow.focus();
      return;
    }

    this.addModalWindow = new BrowserWindow({
      parent: this.mainWindow,
      modal: true,
      width: 500,
      height: 640,
      icon: APP_ICON_PATH,
      resizable: false,
      title: 'Tambah Akun Multi-Platform',
      autoHideMenuBar: true,
      backgroundColor: '#0f172a',
      webPreferences: {
        preload: path.join(__dirname, '../preload/modalPreload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.addModalWindow.loadFile(path.join(__dirname, '../renderer/addAccountModal.html'));

    this.addModalWindow.on('closed', () => {
      this.addModalWindow = null;
    });
  }

  openEditAccountModal(accountId) {
    if (this.editModalWindow && !this.editModalWindow.isDestroyed()) {
      this.editModalWindow.focus();
      return;
    }

    const account = this.accountStore.getAccounts().find(a => a.id === accountId);
    if (!account) return;

    this.editModalWindow = new BrowserWindow({
      parent: this.mainWindow,
      modal: true,
      width: 500,
      height: 640,
      icon: APP_ICON_PATH,
      resizable: false,
      title: 'Ubah Akun',
      autoHideMenuBar: true,
      backgroundColor: '#0f172a',
      webPreferences: {
        preload: path.join(__dirname, '../preload/modalPreload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.editModalWindow.loadFile(path.join(__dirname, '../renderer/editAccountModal.html'), {
      query: {
        id: account.id,
        name: account.name || '',
        color: account.color || '#10b981',
        platform: account.platform || 'whatsapp',
        icon: account.icon || ''
      }
    });

    this.editModalWindow.on('closed', () => {
      this.editModalWindow = null;
    });
  }

  openEditIconModal(accountId) {
    if (this.editIconModalWindow && !this.editIconModalWindow.isDestroyed()) {
      this.editIconModalWindow.focus();
      return;
    }

    const account = this.accountStore.getAccounts().find(a => a.id === accountId);
    if (!account) return;

    this.editIconModalWindow = new BrowserWindow({
      parent: this.mainWindow,
      modal: true,
      width: 420,
      height: 480,
      icon: APP_ICON_PATH,
      resizable: false,
      title: 'Ubah Icon Akun',
      autoHideMenuBar: true,
      backgroundColor: '#0f172a',
      webPreferences: {
        preload: path.join(__dirname, '../preload/modalPreload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.editIconModalWindow.loadFile(path.join(__dirname, '../renderer/iconPickerModal.html'), {
      query: {
        id: account.id,
        icon: account.icon || '',
        platform: account.platform || 'whatsapp',
        name: account.name || ''
      }
    });

    this.editIconModalWindow.on('closed', () => {
      this.editIconModalWindow = null;
    });
  }

  openHelpModal() {
    if (this.helpModalWindow && !this.helpModalWindow.isDestroyed()) {
      this.helpModalWindow.focus();
      return;
    }

    this.helpModalWindow = new BrowserWindow({
      parent: this.mainWindow,
      modal: true,
      width: 620,
      height: 620,
      icon: APP_ICON_PATH,
      resizable: false,
      title: 'Panduan Republik Web',
      autoHideMenuBar: true,
      backgroundColor: '#0f172a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.helpModalWindow.loadFile(path.join(__dirname, '../renderer/helpModal.html'));

    this.helpModalWindow.on('closed', () => {
      this.helpModalWindow = null;
    });
  }

  broadcastAutoTexts(items) {
    if (!this.views) return;
    for (const [id, view] of this.views) {
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.send('autotext:sync', items);
      }
    }
  }

  openAutoTextModal() {
    if (this.autoTextModalWindow && !this.autoTextModalWindow.isDestroyed()) {
      this.autoTextModalWindow.focus();
      return;
    }

    this.autoTextModalWindow = new BrowserWindow({
      parent: this.mainWindow,
      modal: true,
      width: 720,
      height: 640,
      icon: APP_ICON_PATH,
      resizable: true,
      minWidth: 620,
      minHeight: 520,
      title: 'Auto Text & Template Pesan',
      autoHideMenuBar: true,
      backgroundColor: '#0f172a',
      webPreferences: {
        preload: path.join(__dirname, '../preload/autoTextPreload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.autoTextModalWindow.loadFile(path.join(__dirname, '../renderer/autoTextModal.html'));

    this.autoTextModalWindow.on('closed', () => {
      this.autoTextModalWindow = null;
    });
  }

  openNotificationSettingsModal() {
    if (this.notificationModalWindow && !this.notificationModalWindow.isDestroyed()) {
      this.notificationModalWindow.focus();
      return;
    }

    this.notificationModalWindow = new BrowserWindow({
      parent: this.mainWindow,
      modal: true,
      width: 620,
      height: 660,
      icon: APP_ICON_PATH,
      resizable: false,
      title: 'Pengaturan Notifikasi Universal',
      autoHideMenuBar: true,
      backgroundColor: '#0f172a',
      webPreferences: {
        preload: path.join(__dirname, '../preload/notificationPreload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.notificationModalWindow.loadFile(path.join(__dirname, '../renderer/notificationSettingsModal.html'));

    this.notificationModalWindow.on('closed', () => {
      this.notificationModalWindow = null;
    });
  }

  /**
   * Remove poisoned Google auth cookies (__Host-GAPS, OTZ, NID) that cause immediate rejection loops.
   */
  async clearGoogleAuthCookies(ses) {
    if (!ses || !ses.cookies) return;
    try {
      const domains = ['google.com', 'accounts.google.com', 'mail.google.com'];
      for (const dom of domains) {
        const cookies = await ses.cookies.get({ domain: dom });
        for (const c of cookies) {
          if (
            c.name.startsWith('__Host-') ||
            c.name === 'OTZ' ||
            c.name === 'NID' ||
            c.name.startsWith('__Secure-') ||
            c.name.includes('GAPS')
          ) {
            const scheme = c.secure ? 'https://' : 'http://';
            const cookieUrl = scheme + c.domain.replace(/^\./, '') + c.path;
            await ses.cookies.remove(cookieUrl, c.name).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[Gmail Auth] Failed clearing cookies:', e.message);
    }
  }
}

module.exports = ViewManager;
