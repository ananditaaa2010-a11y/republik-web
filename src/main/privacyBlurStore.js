const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class PrivacyBlurStore {
  constructor() {
    this.userDataPath = (app && typeof app.getPath === 'function')
      ? app.getPath('userData')
      : path.join(process.cwd(), '.temp_data');
    this.configPath = path.join(this.userDataPath, 'privacy-blur-settings.json');
    this.data = this.load();
  }

  getDefaults() {
    return {
      enabled: true,               // Master toggle: Privacy Blur active/inactive
      blurIntensity: 10,           // Adjustable blur intensity (px), range 3 - 25
      blurChatList: false,         // Blur all messages in the chat list
      blurContactNames: true,      // Blur contact names
      blurProfilePhotos: true,     // Blur profile photos & non-photo initials/silhouettes
      blurConversation: false,     // Blur the content of conversations (messages in #main)
      blurMedia: true,             // Blur media such as images, videos, audio, documents
      blurLatestMessage: true,     // Blur preview of latest messages in chat list
      blurGroupInfo: true,         // Blur group names and group information
      blurStatusInfo: true,        // Blur status updates and contact information / about
      unblurOnHover: true          // Reveal / unblur when hovering over with mouse
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
      console.error('[PrivacyBlurStore] Error loading config:', e);
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
      console.error('[PrivacyBlurStore] Error saving config:', e);
    }
  }

  getSettings() {
    return { ...this.data };
  }

  updateSettings(updates) {
    if (!updates || typeof updates !== 'object') return this.data;
    this.data = {
      ...this.data,
      ...updates
    };
    this.save();
    return this.data;
  }

  toggleMaster() {
    this.data.enabled = !this.data.enabled;
    this.save();
    return this.data;
  }

  resetDefaults() {
    this.data = this.getDefaults();
    this.save();
    return this.data;
  }
}

module.exports = PrivacyBlurStore;
