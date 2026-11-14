const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class AutoTextStore {
  constructor() {
    this.userDataPath = app.getPath('userData');
    this.configPath = path.join(this.userDataPath, 'auto-texts.json');
    this.data = this.load();
  }

  getDefaults() {
    return [
      {
        id: 'tpl_hello',
        shortcut: 'hello',
        title: 'Sapaan Pelanggan',
        content: 'Halo {nama}, selamat datang! Ada yang bisa kami bantu hari ini?'
      },
      {
        id: 'tpl_ongkir',
        shortcut: 'ongkir',
        title: 'Format Cek Ongkir',
        content: 'Halo {nama}, untuk pengecekan ongkos kirim mohon infokan Kelurahan, Kecamatan, dan Kota/Kabupaten tujuan ya Kak.'
      },
      {
        id: 'tpl_rek',
        shortcut: 'rek',
        title: 'Info Rekening Pembayaran',
        content: 'Pembayaran dapat ditransfer melalui:\nBank BCA: 1234-5678-90\na/n Republik Web Official\n\nJika sudah transfer, mohon kirimkan bukti pembayarannya ya {nama}. Terima kasih!'
      },
      {
        id: 'tpl_closing',
        shortcut: 'closing',
        title: 'Salam Penutup / Closing',
        content: 'Terima kasih banyak {nama}! Pesanan Kakak segera kami proses dan kami infokan resinya jika sudah dikirim ya.'
      }
    ];
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('[AutoTextStore] Error loading auto-texts:', e);
    }
    const defaults = this.getDefaults();
    this.save(defaults);
    return defaults;
  }

  save(items) {
    try {
      if (Array.isArray(items)) {
        this.data = items;
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[AutoTextStore] Error saving auto-texts:', e);
    }
  }

  getAll() {
    return Array.isArray(this.data) ? this.data : [];
  }

  saveItem(item) {
    if (!item || !item.shortcut) return null;
    const cleanShortcut = item.shortcut.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanShortcut) return null;

    if (!Array.isArray(this.data)) this.data = [];

    // Find existing by ID first
    let existingIndex = item.id ? this.data.findIndex(t => t.id === item.id) : -1;

    // If adding a new item, check if there's already an item with the same shortcut
    if (existingIndex < 0) {
      const strippedNew = cleanShortcut.replace(/^[\/!#@.]+/, '');
      existingIndex = this.data.findIndex(t => (t.shortcut || '').replace(/^[\/!#@.]+/, '') === strippedNew);
    }

    if (existingIndex >= 0) {
      this.data[existingIndex] = {
        ...this.data[existingIndex],
        shortcut: cleanShortcut,
        title: (item.title || cleanShortcut).trim(),
        content: (item.content || '').trim(),
        updatedAt: Date.now()
      };
      this.save();
      return this.data[existingIndex];
    } else {
      const newItem = {
        id: 'tpl_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        shortcut: cleanShortcut,
        title: (item.title || cleanShortcut).trim(),
        content: (item.content || '').trim(),
        createdAt: Date.now()
      };
      this.data.unshift(newItem);
      this.save();
      return newItem;
    }
  }

  deleteItem(id) {
    if (!id || !Array.isArray(this.data)) return false;
    const initialLen = this.data.length;
    this.data = this.data.filter(t => t.id !== id);
    if (this.data.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  resetDefaults() {
    const defaults = this.getDefaults();
    this.save(defaults);
    return defaults;
  }
}

module.exports = AutoTextStore;
