# 🛡️ Blur & Lock Privacy Extension (Google Chrome Extension — Manifest V3)

Ekstensi Chrome resmi berbasis **Manifest V3** untuk melindungi privasi Anda langsung pada situs resmi **WhatsApp Web** (`https://web.whatsapp.com/`).

---

## ✨ Fitur Utama:

1. **Lock Now dengan Layar Pengunci PIN:**
   - Kunci WhatsApp Web secara instan dengan satu tombol dari popup.
   - Layar kunci PIN full-screen yang aman, modern, dan elegan.
   - PIN 4 digit yang dapat diatur dan diubah kapan saja.
   - Animasi getar saat PIN salah & proteksi input penuh.
2. **Blur Isi Percakapan (*Conversation Content*):**
   - Menyamarkan teks gelembung obrolan di ruang chat yang sedang dibuka (`#main`).
3. **Blur Nama Kontak & Grup:**
   - Menyamarkan nama kontak di daftar chat, header percakapan, info kontak, dan drawer chat baru.
4. **Blur Foto Profil & Inisial:**
   - Menyamarkan semua foto profil asli, lingkaran inisial huruf tanpa foto, dan foto profil Anda di pojok kiri bawah. Lingkaran hijau status/story WA tetap jernih.
5. **Blur Media & Dokumen:**
   - Menyamarkan foto, video, pesan suara/voice note, dokumen/file, dan stiker.
6. **Blur Preview Pesan Terakhir:**
   - Menyamarkan baris cuplikan pesan terakhir di daftar kontak.
7. **Blur Semua Teks Chat List:**
   - Opsi untuk menyamarkan seluruh baris daftar percakapan samping.
8. **Blur Info & Anggota Grup:**
   - Menyamarkan deskripsi grup dan rincian nama anggota grup.
9. **Blur Status Cerita & Bio Info:**
   - Menyamarkan pembaruan status cerita (story), nomor telepon, dan bio info.
10. **Hover to Reveal:**
    - Arahkan kursor mouse ke elemen yang ter-blur untuk melihat isinya sementara secara instan.
11. **Adjustable Blur Intensity:**
    - Slider intensitas blur (3 px – 25 px) yang dapat diatur sesuai keinginan melalui popup.
12. **Perlindungan Otomatis Dinamis:**
    - Elemen baru akibat scrolling, membuka chat baru, atau pesan masuk baru otomatis langsung terproteksi secara instan via `MutationObserver`.

---

## 📁 Struktur Berkas Ekstensi:

```
blur_extension/
├── manifest.json       # Manifest V3 Configuration
├── popup/              # Popup UI Ekstensi Chrome
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── css/
│   ├── blur.css        # Stylesheet Efek Blur & Proteksi Elemen
│   └── lock.css        # Stylesheet Layar Kunci PIN (Lock Now)
├── js/
│   ├── background.js   # Service Worker (Manifest V3)
│   └── content.js      # Content Script langsung di web.whatsapp.com
└── icons/              # Ikon Ekstensi (16px, 32px, 48px, 128px)
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 Cara Memasang di Google Chrome / Microsoft Edge:

1. Buka browser **Google Chrome** atau **Microsoft Edge**.
2. Buka halaman ekstensi:
   - Di Chrome: ketik `chrome://extensions/` di address bar.
   - Di Edge: ketik `edge://extensions/` di address bar.
3. Aktifkan **Developer mode** (Mode Pengembang) di pojok kanan atas.
4. Klik tombol **Load unpacked** (Muat yang belum dibongkar) di pojok kiri atas.
5. Pilih folder ekstensi ini:
   `D:\Seven Inc Galuh\WA_multi_account_blur\blur_extension`
6. Ekstensi **Blur & Lock Privacy Extension** akan langsung terpasang!
7. Sematkan (*pin*) ikon ekstensi di toolbar browser Anda.
8. Buka [WhatsApp Web](https://web.whatsapp.com/) dan nikmati seluruh proteksi privasi!
