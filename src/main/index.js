const { app, BrowserWindow, ipcMain, Menu, dialog, Notification, Tray, nativeImage, shell } = require('electron');
const path = require('path');
const os = require('os');
const AccountStore = require('./accountStore');
const AutoTextStore = require('./autoTextStore');
const NotificationStore = require('./notificationStore');
const PrivacyBlurStore = require('./privacyBlurStore');
const ViewManager = require('./viewManager');
const AutoUpdaterManager = require('./autoUpdaterManager');

const APP_ICON_PATH = path.join(__dirname, '../../assets/icon.png');
const APP_ID = 'com.republikweb.desktop';

// Register AppUserModelId & Start Menu shortcut for Windows Action Center toast notifications (Windows 10/11)
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);

  try {
    const programsDir = path.join(process.env.APPDATA, 'Microsoft/Windows/Start Menu/Programs');
    const shortcutPath = path.join(programsDir, 'Republik Web.lnk');
    const targetExe = process.execPath;

    let needCreate = true;
    try {
      const existing = shell.readShortcutLink(shortcutPath);
      if (existing && existing.target.toLowerCase() === targetExe.toLowerCase() && existing.appUserModelId === APP_ID) {
        needCreate = false;
      }
    } catch (_) {
      needCreate = true;
    }

    if (needCreate) {
      shell.writeShortcutLink(shortcutPath, 'create', {
        target: targetExe,
        cwd: path.dirname(targetExe),
        appUserModelId: APP_ID,
        description: 'Republik Web — Multi-Account Workspace'
      });
    }
  } catch (err) {
    console.warn('[Shortcut] Could not register Start Menu shortcut:', err.message);
  }
}

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[UnhandledRejection]', reason);
});

// Prevent multiple instances from corrupting local storage partitions
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Isolate dev data from production app data so dev sessions never leak into local production builds
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'republik-web-dev'));
}

let mainWindow = null;
let viewManager = null;
let accountStore = null;
let autoTextStore = null;
let notificationStore = null;
let autoUpdaterManager = null;
let tray = null;
app.isQuitting = false;

// Hardened Chromium: disable automation flags to prevent WhatsApp & Google anti-bot detection
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
// Keep background timers, WebSocket connections, and VoIP/WebRTC active even when window is minimized
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// Allow ringtone and notification audio to play automatically without requiring prior user gesture
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Disable FedCM and Windows Native Occlusion (which suspends renderers when window is minimized)
app.commandLine.appendSwitch('disable-features', 'FedCm,CalculateNativeWinOcclusion');

// Set global User-Agent fallback to genuine Microsoft Edge desktop
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0';

let privacyBlurStore = null;

function createMainWindow() {
  accountStore = new AccountStore();
  autoTextStore = new AutoTextStore();
  notificationStore = new NotificationStore();
  privacyBlurStore = new PrivacyBlurStore();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 500,
    resizable: true,
    title: 'Republik Web — Multi-Account Workspace',
    icon: APP_ICON_PATH,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/shellPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // Keep background instances active when minimized
    }
  });

  viewManager = new ViewManager(mainWindow, accountStore, notificationStore, privacyBlurStore);
  autoUpdaterManager = new AutoUpdaterManager(mainWindow);

  // Load the shell HTML UI (Sidebar, Dock, Modals)
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    createTray();
    // Preload all accounts in parallel/background like Brave browser
    await viewManager.preloadAllAccounts();
    // Start background auto-updater check (only in packaged production build)
    if (autoUpdaterManager) {
      autoUpdaterManager.init();
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupIPCHandlers();
}

function setupIPCHandlers() {
  ipcMain.handle('accounts:openAddModal', () => {
    viewManager.openAddAccountModal();
    return { success: true };
  });

  ipcMain.handle('accounts:get', () => {
    return {
      accounts: accountStore.getAccounts(),
      activeAccountId: accountStore.getActiveAccountId()
    };
  });

  ipcMain.handle('accounts:switch', async (event, id) => {
    await viewManager.switchAccount(id);
    return { success: true };
  });

  ipcMain.handle('accounts:add', async (event, name, color) => {
    const safeName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 50) : 'WhatsApp';
    const safeColor = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#10b981';
    const newAcc = accountStore.addAccount(safeName, safeColor);
    await viewManager.switchAccount(newAcc.id);
    mainWindow.webContents.send('accounts:changed', {
      accounts: accountStore.getAccounts(),
      activeAccountId: newAcc.id
    });
    return newAcc;
  });

  ipcMain.handle('accounts:rename', (event, id, name) => {
    if (!id || typeof id !== 'string') return null;
    const safeName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 50) : 'WhatsApp';
    const updated = accountStore.updateAccount(id, { name: safeName });
    mainWindow.webContents.send('accounts:changed', {
      accounts: accountStore.getAccounts(),
      activeAccountId: accountStore.getActiveAccountId()
    });
    return updated;
  });

  ipcMain.handle('accounts:remove', async (event, id) => {
    if (!id || typeof id !== 'string') return { success: false };
    await viewManager.removeAccount(id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('accounts:changed', {
        accounts: accountStore.getAccounts(),
        activeAccountId: accountStore.getActiveAccountId()
      });
    }
    return { success: true };
  });

  ipcMain.handle('accounts:reload', (event, id) => {
    viewManager.reloadAccount(id);
    return { success: true };
  });

  ipcMain.handle('accounts:openDevTools', (event, id) => {
    viewManager.openDevTools(id);
    return { success: true };
  });

  ipcMain.handle('accounts:showContextMenu', async (event, id) => {
    const account = accountStore.getAccounts().find(a => a.id === id);
    if (!account) return { success: false };

    const isAccNotifEnabled = notificationStore ? notificationStore.isNotificationEnabledForAccount(id) : true;

    const menu = Menu.buildFromTemplate([
      {
        label: `${account.name} [${(account.platform || 'whatsapp').toUpperCase()}]`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: isAccNotifEnabled ? '🔔 Notifikasi: Aktif (Klik untuk Diamkan)' : '🔕 Notifikasi: Diam (Klik untuk Aktifkan)',
        click: () => {
          if (!notificationStore) return;
          const current = notificationStore.getSettings();
          const accs = current.accountSettings || {};
          accs[id] = {
            ...(accs[id] || {}),
            enabled: !isAccNotifEnabled
          };
          notificationStore.updateSettings({ accountSettings: accs });
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('notifications:settingsChanged', notificationStore.getSettings());
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Ubah Nama & Warna Akun',
        click: () => {
          viewManager.openEditAccountModal(id);
        }
      },
      {
        label: 'Ubah Icon Akun',
        click: () => {
          viewManager.openEditIconModal(id);
        }
      },
      {
        label: 'Muat Ulang (Reload)',
        click: () => {
          viewManager.reloadAccount(id);
        }
      },
      {
        label: 'Buka Developer Tools',
        click: () => {
          viewManager.openDevTools(id);
        }
      },
      { type: 'separator' },
      {
        label: 'Hapus Akun Ini',
        click: async () => {
          const accounts = accountStore.getAccounts();
          if (accounts.length <= 1) {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Hapus Akun',
              message: 'Minimal harus ada 1 akun WhatsApp.'
            });
            return;
          }

          const { response } = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: ['Batal', 'Hapus Akun'],
            defaultId: 0,
            cancelId: 0,
            title: 'Konfirmasi Hapus Akun',
            message: `Yakin ingin menghapus "${account.name}"?`,
            detail: 'Sesi login lokal akun ini akan dibersihkan dari aplikasi.'
          });

          if (response === 1) {
            await viewManager.removeAccount(id);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('accounts:changed', {
                accounts: accountStore.getAccounts(),
                activeAccountId: accountStore.getActiveAccountId()
              });
            }
          }
        }
      }
    ]);

    menu.popup({ window: mainWindow });
    return { success: true };
  });

  ipcMain.handle('app:openHelp', () => {
    viewManager.openHelpModal();
    return { success: true };
  });

  // Auto Text Quick Reply Handlers
  ipcMain.handle('autotext:get', () => {
    return autoTextStore.getAll();
  });

  ipcMain.handle('autotext:save', (event, item) => {
    const saved = autoTextStore.saveItem(item);
    viewManager.broadcastAutoTexts(autoTextStore.getAll());
    return { success: true, item: saved };
  });

  ipcMain.handle('autotext:delete', (event, id) => {
    const ok = autoTextStore.deleteItem(id);
    viewManager.broadcastAutoTexts(autoTextStore.getAll());
    return { success: ok };
  });

  ipcMain.handle('autotext:reset', () => {
    const defaults = autoTextStore.resetDefaults();
    viewManager.broadcastAutoTexts(defaults);
    return { success: true, items: defaults };
  });

  ipcMain.handle('autotext:openModal', () => {
    viewManager.openAutoTextModal();
    return { success: true };
  });

  ipcMain.handle('autotext:pasteNative', async (event, payload) => {
    try {
      const text = typeof payload === 'string' ? payload : (payload && payload.text ? payload.text : '');
      const deleteCount = typeof payload === 'object' && payload ? (payload.deleteCount || 0) : 0;
      const sender = event.sender;
      if (!sender || sender.isDestroyed()) return { success: false };

      const win = BrowserWindow.fromWebContents(sender);
      if (win && !win.isDestroyed() && !win.isFocused()) {
        win.focus();
      }

      if (deleteCount > 0) {
        for (let i = 0; i < deleteCount; i++) {
          sender.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
          sender.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
          if (deleteCount > 1 && i < deleteCount - 1) {
            await new Promise(r => setTimeout(r, 6));
          }
        }
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      const { clipboard } = require('electron');
      const prev = clipboard.readText();
      clipboard.writeText(text);
      if (!sender.isDestroyed()) {
        sender.paste();
      }
      setTimeout(() => {
        try {
          if (clipboard.readText() === text) {
            clipboard.writeText(prev);
          }
        } catch (e) {}
      }, 500);
      return { success: true };
    } catch (err) {
      console.error('[AutoText] Error in autotext:pasteNative:', err);
      return { success: false, error: err.message };
    }
  });

  // Universal Notification Settings Handlers
  ipcMain.handle('notifications:getSettings', () => {
    return notificationStore ? notificationStore.getSettings() : {};
  });

  ipcMain.handle('notifications:saveSettings', (event, settings) => {
    if (!notificationStore) return { success: false };
    const updated = notificationStore.updateSettings(settings);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('notifications:settingsChanged', updated);
    }
    return { success: true, settings: updated };
  });

  ipcMain.handle('notifications:openModal', () => {
    if (viewManager) {
      viewManager.openNotificationSettingsModal();
    }
    return { success: true };
  });

  // Privacy Blur Settings Handlers
  ipcMain.handle('privacy:getSettings', () => {
    return privacyBlurStore ? privacyBlurStore.getSettings() : {};
  });

  ipcMain.handle('privacy:saveSettings', (event, settings) => {
    if (!privacyBlurStore) return { success: false };
    const updated = privacyBlurStore.updateSettings(settings);
    if (viewManager) {
      viewManager.broadcastPrivacySettings(updated);
    }
    return { success: true, settings: updated };
  });

  ipcMain.handle('privacy:resetDefaults', () => {
    if (!privacyBlurStore) return {};
    const defaults = privacyBlurStore.resetDefaults();
    if (viewManager) {
      viewManager.broadcastPrivacySettings(defaults);
    }
    return defaults;
  });

  ipcMain.handle('privacy:openModal', () => {
    if (viewManager) {
      viewManager.openPrivacyBlurModal();
    }
    return { success: true };
  });

  ipcMain.handle('privacy:lockNow', () => {
    if (!privacyBlurStore) return { success: false };
    const settings = privacyBlurStore.getSettings();
    if (!settings.securityPin || settings.securityPin.length < 4) {
      if (viewManager) viewManager.openPrivacyBlurModal();
      return { success: false, needPin: true };
    }
    const updated = privacyBlurStore.updateSettings({ isLocked: true });
    if (viewManager) {
      viewManager.broadcastPrivacySettings(updated);
      viewManager.closePrivacyBlurModal();
    }
    return { success: true };
  });

  ipcMain.on('privacy:unlocked', () => {
    if (privacyBlurStore) {
      const updated = privacyBlurStore.updateSettings({ isLocked: false });
      if (viewManager) {
        viewManager.broadcastPrivacySettings(updated);
      }
    }
  });

  ipcMain.on('privacy:closeModal', () => {
    if (viewManager) {
      viewManager.closePrivacyBlurModal();
    }
  });

  ipcMain.on('view:toggle-blur', () => {
    if (viewManager) {
      viewManager.toggleBlur();
    }
  });

  function showDesktopNotification({ title, body, icon, silent = false, urgency = 'normal', timeoutType = 'default', isCall = false, onClick = null }) {
    const isWindows7 = process.platform === 'win32' && os.release().startsWith('6.1');
    let toastTriggered = false;

    // Flash taskbar when incoming call arrives
    if (isCall && mainWindow) {
      try {
        mainWindow.flashFrame(true);
      } catch (_) {}
    }

    // Windows 10 & 11: Action Center Toast Notification
    if (!isWindows7 && Notification.isSupported()) {
      try {
        const notif = new Notification({
          title: title || 'Republik Web',
          body: body || '',
          icon: icon || APP_ICON_PATH,
          silent: !!silent,
          urgency: urgency || 'normal',
          timeoutType: timeoutType || 'default'
        });

        if (typeof onClick === 'function') {
          notif.on('click', () => {
            if (mainWindow) {
              try { mainWindow.flashFrame(false); } catch (_) {}
            }
            onClick();
          });
        }

        notif.on('failed', (e, err) => {
          console.warn('[Notification] Toast failed, falling back to tray balloon:', err || e);
          fallbackToTrayBalloon({ title, body, onClick });
        });

        notif.show();
        toastTriggered = true;
      } catch (err) {
        console.warn('[Notification] Exception invoking Toast notification:', err.message);
      }
    }

    // Windows 7 / fallback: System Tray Balloon Notification
    if (!toastTriggered) {
      fallbackToTrayBalloon({ title, body, onClick });
    }
  }

  function fallbackToTrayBalloon({ title, body, onClick }) {
    if (!tray) {
      createTray();
    }
    if (tray && typeof tray.displayBalloon === 'function') {
      try {
        tray.displayBalloon({
          icon: APP_ICON_PATH,
          iconType: 'info',
          title: title || 'Republik Web',
          content: body || 'Pesan baru diterima'
        });

        if (typeof onClick === 'function') {
          const onBalloonClick = () => {
            onClick();
            if (tray) tray.removeListener('balloon-click', onBalloonClick);
          };
          tray.once('balloon-click', onBalloonClick);
        }
      } catch (err) {
        console.warn('[Notification] Tray balloon fallback failed:', err.message);
      }
    }
  }

  ipcMain.handle('notifications:test', () => {
    try {
      showDesktopNotification({
        title: 'Republik Web — Uji Notifikasi',
        body: 'Notifikasi universal berhasil diaktifkan dan berfungsi dengan baik!',
        icon: APP_ICON_PATH,
        silent: false,
        onClick: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
          }
        }
      });
      return { success: true };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  });

  // Windows Native Toast Notification Handler (Universal & Account Aware)
  ipcMain.on('notification:show', (event, data) => {
    try {
      const notifSettings = notificationStore ? notificationStore.getSettings() : { enabled: true, sound: true };

      // 1. Global Master Switch Check
      if (notifSettings.enabled === false) {
        return;
      }

      const { title, body, icon } = data || {};

      let senderAccountId = null;
      let senderAccount = null;
      if (viewManager && viewManager.views) {
        for (const [accId, v] of viewManager.views.entries()) {
          if (v && v.webContents && v.webContents.id === event.sender.id) {
            senderAccountId = accId;
            break;
          }
        }
      }

      if (senderAccountId && accountStore) {
        senderAccount = accountStore.getAccounts().find(a => a.id === senderAccountId);
      }

      // 2. Per-Account Toggle Check
      if (senderAccountId && notificationStore && !notificationStore.isNotificationEnabledForAccount(senderAccountId)) {
        return;
      }

      // 3. Title formatting (Account tag prefix)
      let finalTitle = title || 'Republik Web';
      if (notifSettings.showAccountTag !== false && senderAccount && senderAccount.name) {
        finalTitle = `[${senderAccount.name}] ${title || 'Republik Web'}`;
      }

      // 4. Message Privacy formatting (showPreview)
      let finalBody = body || '';
      if (notifSettings.showPreview === false) {
        finalBody = 'Pesan baru diterima';
      }

      // 5. Sound configuration
      const isSoundEnabled = notificationStore
        ? notificationStore.isSoundEnabledForAccount(senderAccountId)
        : (notifSettings.sound !== false);

      // 6. Icon handling (Safe Data URL conversion)
      let notifIcon = APP_ICON_PATH;
      if (icon && typeof icon === 'string') {
        if (icon.startsWith('data:image/')) {
          try {
            const img = nativeImage.createFromDataURL(icon);
            if (!img.isEmpty()) {
              notifIcon = img;
            }
          } catch (e) {
            notifIcon = APP_ICON_PATH;
          }
        } else if (icon.startsWith('http://') || icon.startsWith('https://')) {
          notifIcon = icon;
        }
      }

      const isCall = /panggilan|telepon|call|ringing/i.test(`${title || ''} ${body || ''}`);

      showDesktopNotification({
        title: finalTitle,
        body: finalBody,
        icon: notifIcon,
        silent: !isSoundEnabled,
        urgency: isCall ? 'critical' : 'normal',
        timeoutType: isCall ? 'never' : 'default',
        isCall,
        onClick: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.setAlwaysOnTop(true);
            mainWindow.focus();
            mainWindow.setAlwaysOnTop(false);
            if (senderAccountId && viewManager) {
              viewManager.switchAccount(senderAccountId);
            }
          }
        }
      });
    } catch (err) {
      console.warn('[Notification] Failed to show notification:', err.message);
    }
  });
}

function createTray() {
  if (tray) return;
  try {
    const icon = nativeImage.createFromPath(APP_ICON_PATH).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('Republik Web — Multi-Account Workspace');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Tampilkan Republik Web',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Keluar',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.warn('[Tray] Failed to initialize tray:', err.message);
  }
}

// App lifecycle
app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
