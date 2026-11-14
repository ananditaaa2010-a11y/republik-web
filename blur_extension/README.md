# Blur & Privacy Add-on Extension (WhatsApp Web)

Folder ini disiapkan khusus untuk ekstensi Chrome/Chromium add-on blur privasi WhatsApp Web sesuai instruksi projek.

## 📁 Struktur Folder:

```
blur_extension/
├── manifest.json       # Konfigurasi ekstensi Chrome (Manifest v3 / v2)
├── css/                # File CSS efek blur & hover reveal
│   └── blur.css
├── js/                 # Content script untuk manipulasi DOM dan keyboard shortcuts
│   └── content.js
├── icons/              # Ikon ekstensi (16px, 48px, 128px)
└── popup/              # Antarmuka popup toggle fitur blur (Nama, Pesan, Media, Foto Profil, Input)
    ├── popup.html
    ├── popup.css
    └── popup.js
```

## 🎯 Target Fitur Privacy Blur:
1. **Blur Semua Pesan Terakhir** (Last message preview)
2. **Blur Isi Chat Saat Ini** (Current conversation text)
3. **Blur Nama Kontak & Grup** (Contact & Group names)
4. **Blur Foto Profil** (Profile pictures)
5. **Blur Media (Gambar & Video)** (Media preview / gallery)
6. **Blur Input Teks Pesan** (Message input field saat mengetik)
7. **Hover-to-Reveal** (Arahkan kursor mouse untuk membuka blur sementara)

