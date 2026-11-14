const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class AccountStore {
  constructor() {
    this.userDataPath = app.getPath('userData');
    this.configPath = path.join(this.userDataPath, 'accounts-config.json');
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[AccountStore] Error loading config:', e);
    }
    // Default config with 1 primary WhatsApp account
    return {
      activeAccountId: 'acc_1',
      accounts: [
        {
          id: 'acc_1',
          name: 'WhatsApp Utama',
          platform: 'whatsapp',
          phone: '',
          color: '#10b981',
          createdAt: Date.now()
        }
      ]
    };
  }

  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[AccountStore] Error saving config:', e);
    }
  }

  getAccounts() {
    return (this.data.accounts || []).map(a => ({
      ...a,
      platform: a.platform || 'whatsapp'
    }));
  }

  getActiveAccountId() {
    return this.data.activeAccountId || (this.data.accounts && this.data.accounts[0] ? this.data.accounts[0].id : null);
  }

  setActiveAccountId(id) {
    this.data.activeAccountId = id;
    this.save();
  }

  addAccount(name, color, platform = 'whatsapp', icon = '') {
    if (!Array.isArray(this.data.accounts)) {
      this.data.accounts = [];
    }
    const id = 'acc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const validPlatform = ['whatsapp', 'telegram', 'gmail'].includes(platform) ? platform : 'whatsapp';

    const defaultColors = {
      whatsapp: '#10b981',
      telegram: '#229ed9',
      gmail: '#ea4335'
    };
    const finalColor = (color && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : defaultColors[validPlatform];

    const platformAccounts = this.data.accounts.filter(a => (a.platform || 'whatsapp') === validPlatform);
    const defaultNames = {
      whatsapp: `WhatsApp ${platformAccounts.length + 1}`,
      telegram: `Telegram ${platformAccounts.length + 1}`,
      gmail: `Gmail ${platformAccounts.length + 1}`
    };

    const newAcc = {
      id,
      name: (typeof name === 'string' && name.trim()) ? name.trim() : defaultNames[validPlatform],
      platform: validPlatform,
      phone: '',
      color: finalColor,
      icon: (typeof icon === 'string') ? icon : '',
      createdAt: Date.now()
    };
    this.data.accounts.push(newAcc);
    this.data.activeAccountId = id;
    this.save();
    return newAcc;
  }

  updateAccount(id, updates) {
    if (!id || !Array.isArray(this.data.accounts)) return null;
    const acc = this.data.accounts.find(a => a.id === id);
    if (acc) {
      Object.assign(acc, updates);
      this.save();
      return acc;
    }
    return null;
  }

  removeAccount(id) {
    if (!id) return;
    this.data.accounts = (this.data.accounts || []).filter(a => a.id !== id);
    if (this.data.activeAccountId === id) {
      this.data.activeAccountId = this.data.accounts[0] ? this.data.accounts[0].id : null;
    }
    this.save();
  }
}

module.exports = AccountStore;
