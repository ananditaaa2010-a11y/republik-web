# Republik Web — Multi-Account Desktop Workspace (v2.0.0)

Aplikasi desktop berbasis engine **Chromium (Electron)** untuk mengelola banyak akun **WhatsApp Web**, **Telegram Web**, dan **Gmail** sekaligus dalam satu jendela aplikasi (ala Ferdium / Franz) dengan performa cepat, memori efisien, dan isolasi sesi penuh.

---

## 🎯 Fitur Utama

1. **Multi-Platform & Multi-Akun:**
   - Mendukung WhatsApp Web, Telegram Web, dan Gmail dalam satu aplikasi.
   - Tambah akun tanpa batas untuk kebutuhan CS, Sales, atau Akun Pribadi.

2. **Isolasi Penuh (Session Partitioning):**
   - Setiap akun dialokasikan ke partisi penyimpanan mandiri: `persist:account_<id>`.
   - Cookie, IndexedDB, dan Cache terisolasi penuh sehingga akun tidak akan saling logout atau bentrok.

3. **Auto Text & Quick Reply Manager:**
   - Template pesan cepat dengan ekspansi tombol **Tab**.
   - Variabel dinamis otomatis: `{nama}`, `{jam}`, `{tanggal}`, `{hari}`, `{waktu}`.

4. **Notifikasi Universal & Badge Counter:**
   - Deteksi jumlah unread message (badge counter pada setiap ikon akun).
   - Pengaturan notifikasi universal (suara, badge, preview pengirim & pesan).
   - Mode Jangan Ganggu (Mute).

5. **Navigasi Sidebar Dock:**
   - Beralih akun instan dalam 1 klik.
   - Kustomisasi icon akun (Emoji, gambar custom, atau icon resmi platform).
   - Menu klik kanan: Ubah nama & warna, ubah icon, muat ulang, atau hapus akun.

6. **Keamanan & Link External:**
   - Semua tautan eksternal dibuka otomatis di browser default sistem operasi Anda.
   - Deteksi dan pemulihan otomatis Google Botguard rejection pada Gmail.

---

## 🚀 Cara Menjalankan Aplikasi

Pastikan dependensi sudah terinstal:
```bash
npm install
```

Jalankan aplikasi dalam mode development:
```bash
npm start
```
*Atau klik dua kali file **`start.bat`**.*

---

## 🔨 Build Installer (.exe)

Compile installer untuk Windows ke dalam folder `apk/`:
```bash
npm run dist
```
Lihat panduan lengkap di [`PANDUAN_DEPLOY_DAN_UPDATE.md`](./PANDUAN_DEPLOY_DAN_UPDATE.md).

---

## 📁 Struktur Proyek

```
Source code/
├── package.json               # Konfigurasi dependensi Electron & builder
├── start.bat                  # Shortcut 1-klik menjalankan aplikasi
├── assets/                    # Ikon dan aset grafis aplikasi
├── src/
│   ├── config/
│   │   └── constants.js       # Konfigurasi platform URL & User-Agent Chromium
│   ├── main/
│   │   ├── index.js           # Main process Electron & pendaftaran window utama
│   │   ├── accountStore.js    # Penyimpanan konfigurasi akun lokal (JSON)
│   │   ├── autoTextStore.js   # Penyimpanan template auto text (JSON)
│   │   ├── notificationStore.js # Penyimpanan pengaturan notifikasi (JSON)
│   │   ├── autoUpdaterManager.js # Manajemen update otomatis via GitHub Releases
│   │   └── viewManager.js     # WebContentsView manager multi-platform
│   ├── preload/
│   │   ├── shellPreload.js    # Bridge komunikasi UI Sidebar dengan sistem
│   │   ├── viewPreload.js     # Tracker unread messages & engine auto text
│   │   ├── autoTextPreload.js # Bridge modal Auto Text
│   │   ├── modalPreload.js    # Bridge modal tambah/edit akun
│   │   └── notificationPreload.js # Bridge modal pengaturan notifikasi
│   └── renderer/
│       ├── index.html         # Shell antarmuka sidebar & workspace
│       ├── css/style.css      # Desain tema gelap modern (Ferdium look)
│       ├── js/app.js          # Controller pergantian akun, event listener, dan badge
│       ├── addAccountModal.html
│       ├── editAccountModal.html
│       ├── autoTextModal.html
│       ├── notificationSettingsModal.html
│       ├── iconPickerModal.html
│       └── helpModal.html
```
