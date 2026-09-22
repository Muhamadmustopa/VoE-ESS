# Kotak Saran

Web app sederhana untuk kotak saran/masukan karyawan. Murni HTML, CSS, dan JavaScript (vanilla) di sisi frontend — datanya tersimpan di **Google Sheet**, lewat backend kecil pakai **Google Apps Script**. Tidak butuh server atau biaya hosting apa pun.

## Struktur file

```
kotak-saran/
├── index.html   # struktur halaman
├── style.css    # tampilan
├── script.js    # logika (form, kategori, panel admin, koneksi ke Apps Script)
├── Code.gs      # backend Apps Script — tempel ini ke Google Sheet kamu
└── README.md
```

## Setup (sekali saja)

### 1. Buat Google Sheet + backend-nya

1. Buka [sheets.google.com](https://sheets.google.com), buat spreadsheet baru (kosongin saja, tab `Entries` dan `Categories` akan dibuat otomatis sama script-nya).
2. Di menu, klik **Extensions > Apps Script**.
3. Hapus isi `Code.gs` bawaan, lalu copy-paste seluruh isi file `Code.gs` di folder ini ke situ.
4. Klik **Deploy > New deployment**.
   - Pilih tipe: **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
5. Klik **Deploy**, lalu **Authorize access** (pakai akun Google-mu — Apps Script ini yang akan menulis ke sheet-mu).
6. Setelah selesai, akan muncul **Web app URL** yang diakhiri `/exec`. Copy URL ini.

### 2. Sambungkan frontend ke backend

Buka `script.js`, baris paling atas:

```js
var APPS_SCRIPT_URL = "PASTE_URL_WEB_APP_KAMU_DI_SINI";
```

Ganti dengan URL `/exec` yang kamu dapat dari langkah 6 di atas.

### 3. Ganti PIN admin

Masih di `script.js`:

```js
var ADMIN_PIN = "admin123"; // ganti PIN ini sebelum deploy
```

PIN ini cuma penghalang tampilan (siapa pun yang buka DevTools bisa lihat isi `script.js`), bukan keamanan sungguhan — jangan andalkan untuk data sensitif. Kalau butuh proteksi lebih serius, batasi akses **Web app URL**-nya sendiri (misalnya lewat autentikasi tambahan di Apps Script), bukan cuma PIN di frontend.

### 4. Deploy frontend-nya

Push folder ini ke repo GitHub, lalu aktifkan **GitHub Pages** (Settings > Pages), atau deploy ke Netlify/Vercel sebagai static site. Tidak ada build step yang dibutuhkan.

## Cara pakai

- User memilih kategori, menulis masukan, boleh isi nama (opsional — kosong = anonim), lalu klik **Kirim masukan**. Ini langsung menambah baris baru di tab `Entries` pada Google Sheet.
- Klik **Panel admin** di bagian bawah, masukkan PIN, untuk melihat semua masukan, menyaring per kategori, menambah/menghapus kategori (masuk ke tab `Categories`), atau menghapus masukan.
- Panel admin otomatis memuat ulang data setiap 20 detik selagi terbuka, dan ada tombol **Muat ulang** untuk refresh manual.
- Tombol **Unduh semua sebagai JSON** mengekspor masukan yang lagi ditampilkan — tapi karena datanya sudah ada di Sheet, biasanya kamu cukup buka Sheet itu langsung buat olah data (pivot table, filter, dsb).

## Struktur data di Sheet

**Tab `Entries`**: `id | category | message | name | createdAt`
**Tab `Categories`**: `category` (satu kolom, satu kategori per baris)

## Catatan

- Karena backend-nya Apps Script, ada batas kuota harian dari Google (cukup longgar untuk kotak saran internal skala kantor biasa; lihat [dokumentasi kuota Apps Script](https://developers.google.com/apps-script/guides/services/quotas) kalau mau detail).
- Google Sheet bukan database real-time — makanya panel admin polling (nge-refresh) tiap 20 detik, bukan update instan seperti Firestore. Kalau butuh update sungguh-sungguh real-time, opsi seperti Firebase Firestore lebih cocok.
