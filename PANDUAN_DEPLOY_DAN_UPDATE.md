# Panduan Compile `.exe` & Setup Auto-Update (Tim Deployment)

Dokumen ini disusun untuk memudahkan Anda dan **Tim Deployment / DevOps** dalam melakukan compile aplikasi ke file `.exe` (yang otomatis disimpan di folder `apk/`), serta menghubungkannya ke **GitHub Releases** untuk sistem auto-update otomatis tanpa perlu instal ulang.

---

## 📁 1. Lokasi Output Compile (`apk/`)

Sistem build telah dikonfigurasi di [`package.json`](./package.json) agar semua hasil kompilasi aplikasi langsung tersimpan di dalam folder:
```
d:\laragon\www\Version-1-Republik-Web\Source code\apk\
```

---

## 🔨 2. Cara Meng-compile Aplikasi ke File `.exe`

Pastikan Anda berada di direktori project, lalu jalankan perintah berikut di terminal:

### A. Compile Installer Windows (NSIS Installer)
```bash
npm run dist
```
Perintah ini akan menghasilkan file di dalam folder **`apk/`**:
- **`Republik Web Setup 2.0.0.exe`** — File installer untuk dibagikan ke pengguna.
- **`latest.yml`** — File metadata penanda versi dan checksum keamanan (wajib ada untuk auto-update).
- **`Republik Web Setup 2.0.0.exe.blockmap`** — File patch diferensial (agar update selanjutnya hanya mengunduh data yang berubah).

### B. Compile Versi Portable (Langsung Jalan Tanpa Install)
Jika Anda membutuhkan versi standalone yang tidak perlu diinstal:
```bash
npm run dist:portable
```

---

## 🚀 3. Langkah Setup untuk Tim Deployment (Koneksi ke GitHub)

Bagian ini yang perlu dilakukan oleh Tim Deployment saat source code sudah di-push ke repository GitHub:

### Langkah 1: Atur Nama Repository di `package.json`
Buka file [`package.json`](./package.json) dan sesuaikan bagian `publish` (ganti tulisan huruf besar):
```json
"publish": [
  {
    "provider": "github",
    "owner": "USERNAME_ATAU_ORGANISASI_GITHUB",
    "repo": "NAMA_REPOSITORY_GITHUB"
  }
]
```

### Langkah 2: Buat GitHub Personal Access Token (PAT)
1. Buka akun GitHub -> **Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)**.
2. Buat token baru dengan mencentang scope **`repo`**.
3. Salin token tersebut (contoh: `ghp_xxxxxxxxxxxxxxxxxxxx`).

### Langkah 3: Alur Rilis Versi Baru (Otomatis Upload ke GitHub)
Setiap kali ada perbaikan bug atau penambahan fitur baru:

1. **Naikkan nomor versi** di [`package.json`](./package.json), misalnya:
   ```json
   "version": "2.0.1"
   ```
2. Set token GitHub di terminal:
   - **PowerShell:**
     ```powershell
     $env:GH_TOKEN="ghp_token_anda_disini"
     ```
   - **Command Prompt (CMD):**
     ```cmd
     set GH_TOKEN=ghp_token_anda_disini
     ```
3. Jalankan perintah publish:
   ```bash
   npm run dist:publish
   ```
   *Perintah ini akan langsung meng-compile file ke folder `apk/` dan sekaligus mengunggah release baru ke tab **Releases** di GitHub secara otomatis!*

---

## 🌐 4. Opsi Alternatif: Upload Manual ke GitHub Releases
Jika Tim Deployment lebih memilih upload manual lewat web browser:
1. Jalankan `npm run dist` (hasilnya ada di folder `apk/`).
2. Buka repository GitHub di browser -> Klik menu **Releases** -> Klik **Draft a new release**.
3. Isi tag versi (misal: `v2.0.1`).
4. Tarik dan lepas (*drag and drop*) 3 file dari folder `apk/`:
   - `Republik Web Setup 2.0.1.exe`
   - `latest.yml`
   - `Republik Web Setup 2.0.1.exe.blockmap`
5. Klik **Publish release**.

---

## 📲 5. Bagaimana Pengalaman Pengguna Saat Ada Update?

1. Pengguna membuka aplikasi Republik Web seperti biasa di laptop/PC mereka.
2. Di latar belakang (background), aplikasi mengecek repository GitHub.
3. Begitu rilis baru terdeteksi, aplikasi diam-diam mengunduh patch update.
4. Muncul dialog konfirmasi ramah:
   > **"Pembaruan Siap Dipasang"**  
   > *Republik Web v2.0.1 telah berhasil diunduh. Mulai ulang aplikasi sekarang untuk menerapkan pembaruan? Semua sesi login akun Anda tetap aman.*  
   > **[Mulai Ulang Sekarang]** &bull; **[Nanti Saja]**
5. Saat pengguna memilih **Mulai Ulang Sekarang**, aplikasi memperbarui dirinya secara otomatis dalam beberapa detik. Semua sesi login WhatsApp, Telegram, dan Gmail tetap aktif tanpa perlu instal ulang.
