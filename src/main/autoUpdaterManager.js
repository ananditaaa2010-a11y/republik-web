const { app, ipcMain, dialog, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');

class AutoUpdaterManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isChecking = false;
    this.updateDownloaded = false;

    // Configure autoUpdater
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    this.setupEvents();
    this.setupIPC();
  }

  isConfigured() {
    // Check if publish settings are configured with real values (not default placeholder)
    try {
      const pkg = require('../../package.json');
      const publish = pkg && pkg.build && pkg.build.publish && pkg.build.publish[0];
      if (!publish || !publish.owner || publish.owner === 'YOUR_GITHUB_OWNER') {
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  setupEvents() {
    autoUpdater.on('checking-for-update', () => {
      this.isChecking = true;
      console.log('[AutoUpdater] Memeriksa pembaruan...');
      this.sendToRenderer('updater:status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      this.isChecking = false;
      console.log(`[AutoUpdater] Versi baru ditemukan: v${info.version}`);
      this.sendToRenderer('updater:status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.isChecking = false;
      console.log('[AutoUpdater] Aplikasi sudah versi terbaru.');
      this.sendToRenderer('updater:status', {
        status: 'up-to-date',
        version: info ? info.version : app.getVersion()
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.floor(progressObj.percent || 0);
      this.sendToRenderer('updater:status', {
        status: 'downloading',
        percent
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.isChecking = false;
      this.updateDownloaded = true;
      console.log(`[AutoUpdater] Pembaruan v${info.version} selesai diunduh dan siap dipasang.`);

      this.sendToRenderer('updater:status', {
        status: 'downloaded',
        version: info.version
      });

      this.promptInstall(info.version);
    });

    autoUpdater.on('error', (err) => {
      this.isChecking = false;
      console.warn('[AutoUpdater] Error saat memeriksa/mengunduh update:', err ? err.message : err);
      this.sendToRenderer('updater:status', {
        status: 'error',
        message: err ? err.message : 'Gagal memeriksa pembaruan'
      });
    });
  }

  promptInstall(newVersion) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Pembaruan Siap Dipasang',
      message: `Republik Web v${newVersion} telah berhasil diunduh.`,
      detail: 'Mulai ulang aplikasi sekarang untuk menerapkan pembaruan? Semua sesi login akun Anda tetap aman.',
      buttons: ['Mulai Ulang Sekarang', 'Nanti Saja'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        // Quit and install immediately
        setImmediate(() => {
          app.isQuitting = true;
          autoUpdater.quitAndInstall(false, true);
        });
      }
    }).catch(() => {});
  }

  setupIPC() {
    ipcMain.handle('updater:check', async () => {
      if (!app.isPackaged) {
        return {
          success: false,
          message: 'Auto-updater dinonaktifkan dalam mode development.'
        };
      }

      if (!this.isConfigured()) {
        return {
          success: false,
          message: 'Pengaturan GitHub repository belum dikonfigurasi di package.json oleh tim deployment.'
        };
      }

      try {
        const result = await autoUpdater.checkForUpdates();
        return {
          success: true,
          updateInfo: result ? result.updateInfo : null
        };
      } catch (err) {
        return {
          success: false,
          message: err.message
        };
      }
    });

    ipcMain.handle('updater:install', () => {
      if (this.updateDownloaded) {
        app.isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
        return { success: true };
      }
      return { success: false, message: 'Belum ada pembaruan yang selesai diunduh.' };
    });
  }

  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  init() {
    // Only check for updates in packaged .exe production build
    if (app.isPackaged && this.isConfigured()) {
      // Delay check slightly so window loads fast without network competition
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(err => {
          console.warn('[AutoUpdater] Initial check error:', err.message);
        });
      }, 5000);
    } else {
      if (!app.isPackaged) {
        console.log('[AutoUpdater] Mode Development: Pengecekan update otomatis dinonaktifkan.');
      } else {
        console.log('[AutoUpdater] Konfigurasi GitHub repo masih placeholder. Menunggu konfigurasi tim deploy.');
      }
    }
  }
}

module.exports = AutoUpdaterManager;
