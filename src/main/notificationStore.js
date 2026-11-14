const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class NotificationStore {
  constructor() {
    this.userDataPath = (app && typeof app.getPath === 'function')
      ? app.getPath('userData')
      : path.join(process.cwd(), '.temp_data');
    this.configPath = path.join(this.userDataPath, 'notification-settings.json');
    this.data = this.load();
  }

  getDefaults() {
    return {
      enabled: true,         // Master switch: global desktop notifications
      sound: true,           // Sound for notifications
      showPreview: true,     // Show message body / snippet
      showSenderName: true,  // Show sender / group name
      showAccountTag: true,  // Prefix account name e.g. [WhatsApp 1]
      showBadge: true,       // Show unread badges on sidebar dock
      accountSettings: {}    // Per-account settings: { [accountId]: { enabled: boolean, sound: boolean } }
    };
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...this.getDefaults(), ...parsed };
        }
      }
    } catch (e) {
      console.error('[NotificationStore] Error loading config:', e);
    }
    const defaults = this.getDefaults();
    this.save(defaults);
    return defaults;
  }

  save(data) {
    try {
      this.data = data || this.data;
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[NotificationStore] Error saving config:', e);
    }
  }

  getSettings() {
    return { ...this.data };
  }

  updateSettings(updates) {
    if (!updates || typeof updates !== 'object') return this.data;
    this.data = {
      ...this.data,
      ...updates,
      accountSettings: {
        ...(this.data.accountSettings || {}),
        ...(updates.accountSettings || {})
      }
    };
    this.save();
    return this.data;
  }

  isNotificationEnabledForAccount(accountId) {
    if (!this.data.enabled) return false;
    if (accountId && this.data.accountSettings && this.data.accountSettings[accountId]) {
      const acc = this.data.accountSettings[accountId];
      if (typeof acc.enabled === 'boolean') {
        return acc.enabled;
      }
    }
    return true;
  }

  isSoundEnabledForAccount(accountId) {
    if (!this.data.sound) return false;
    if (accountId && this.data.accountSettings && this.data.accountSettings[accountId]) {
      const acc = this.data.accountSettings[accountId];
      if (typeof acc.sound === 'boolean') {
        return acc.sound;
      }
    }
    return true;
  }
}

module.exports = NotificationStore;
