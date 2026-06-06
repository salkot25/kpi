# Dashboard KPI P2TL - PT PLN (Persero) ULP Salatiga Kota

Dashboard pemantauan kinerja KPI P2TL (Penertiban Pemakaian Tenaga Listrik) berbasis web yang modern, responsif (Mobile-First), dan terintegrasi secara real-time dengan Google Sheets menggunakan Google Apps Script (GAS) Web App API.

Aplikasi ini dibangun menggunakan arsitektur bersih (**Clean Architecture**), prinsip **SOLID**, serta menerapkan **PLN Corporate Design System** dengan aturan warna 60:30:10 dan grid kelipatan 4px.

---

## 🚀 Fitur Utama

1. **Dashboard Analisis & KPI**:
    - **Tab KPI & Breakdown**:
     - Ringkasan Kinerja Harian, Bulanan, Semester (I/II), dan Kumulatif pencapaian kWh dengan ring persentase dinamis.
     - Visualisasi tren realisasi & target temuan kWh sepanjang tahun melalui grafik batang interaktif (SVG Bar Chart) dengan pilihan filter granularitas waktu: **Per Hari** (detail harian bulan berjalan), **Per Minggu** (detail mingguan bulan berjalan), dan **Per Bulan** (detail bulanan sepanjang tahun).
     - Distribusi komposisi temuan kasus (donut chart) berdasarkan tipe tarif pelanggan, golongan pelanggaran, dan kapasitas daya.
   - **Tab Executive Summary**:
     - Ringkasan metrik tahunan (Total Temuan Kasus, Estimasi Energi Diselamatkan dalam kWh, dan nilai Tagihan Susulan).
     - **Sasaran Operasi per Kategori**: Progres pencapaian target pemeriksaan pelanggan (LKBK Macet, 3 Phasa, TO DLPD, Pengembangan TO, dll.) yang disajikan dengan visual bar progress modern.
     - **Log Realisasi Laporan**: Tabel riwayat pengiriman log realisasi harian yang tersinkron langsung ke Google Sheets lengkap dengan fitur pencarian tanggal.
     - Daftar **Top 5 Kasus Temuan Terbesar** berdasarkan nilai Rupiah Tagihan Susulan (TS) untuk membantu eksekutif memonitor temuan bernilai tinggi.

2. **Form Input & Kirim Laporan**:
   - Perekaman data sasaran operasi P2TL per tanggal (LKBK Macet, 3 Phasa, TO DLPD, Pengembangan TO, TS Periodik, TS Macet, dan Lainnya).
   - Fitur *Auto-Save Draft* secara lokal (Offline-First) untuk menjaga data input jika terjadi kendala jaringan.
   - Pembuatan format laporan otomatis siap kirim ke WhatsApp.
   - Kirim data ke Google Sheets dan teruskan ke aplikasi WhatsApp dengan satu klik.

3. **Manajemen Target Bulanan**:
   - Konfigurasi target target kWh bulanan secara dinamis langsung dari antarmuka aplikasi.
   - Kalkulasi target harian secara dinamis berdasarkan jumlah hari aktif pada bulan terpilih, serta target kumulatif tahunan penuh sampai bulan berjalan.

4. **Konfigurasi & Pengaturan**:
   - Integrasi URL Google Apps Script Web App.
   - Fitur tes koneksi dan log debugger struktur sheet untuk memverifikasi kecocokan header kolom database secara otomatis.
   - Pengaturan nomor WhatsApp tujuan default dan sinkronisasi tema tampilan.
   - Dukungan tema gelap (Dark Mode) dan terang (Light Mode) yang konsisten.

---

## 🏗️ Arsitektur Sistem

Aplikasi ini memisahkan kekhawatiran program (*Separation of Concerns*) dengan mengimplementasikan Clean Architecture pada sisi Frontend dan Serverless API pada sisi Backend.

### 1. Backend: Google Apps Script (`backend/p2tl-backend.gs`)
Berjalan di atas spreadsheet Google Sheets sebagai database. Script Apps Script diekspos sebagai Web App API yang menangani operasi berikut:
- **`doGet(e)`**:
  - Mengambil target harian/kumulatif untuk tanggal tertentu.
  - Membaca data real-time pada sheet `Realisasi` untuk melakukan kompilasi data statistik tahunan (tren bulanan, klasifikasi tarif/daya/golongan, dan top 5 temuan terbesar) secara dinamis.
  - Membaca log transaksi pengiriman laporan dari sheet `Realisasi_Logs`.
  - Mengambil target bulanan dari sheet `Targets_Bulanan` dan konfigurasi dari sheet `Settings`.
- **`doPost(e)`**:
  - Menyimpan record realisasi baru ke sheet `Realisasi_Logs`.
  - Mengupdate target bulanan dan menyimpan pengaturan sistem (nomor WA, tema).

### 2. Frontend: React + TypeScript + Vite (`src/`)
Frontend diatur menggunakan struktur folder Clean Architecture:

```text
src/
├── core/                   # Lapisan Domain (Pure Logic, bebas dependensi eksternal)
│   ├── entities/           # Kontrak data dan interface entitas (report.entity.ts)
│   ├── repositories/       # Abstraksi interface penanganan data (p2tl.repository.ts)
│   └── usecases/           # Logika bisnis utama & kalkulator laporan (generate-report.usecase.ts)
│
├── data/                   # Lapisan Data (Implementasi & Komunikasi Eksternal)
│   └── repositories/       # Implementasi repository konkret (gas-p2tl.repository.ts)
│
├── design-system/          # Desain Token Korporat PLN
│   └── tokens.ts           # Definisi palet warna 60:30:10, spacing 4px, shadow, border radius
│
├── presentation/           # Lapisan Presentasi (Antarmuka Pengguna/UI)
│   ├── components/         # Komponen reusable murni (Button, InputField)
│   └── pages/              # Kontainer halaman (Dashboard, DashboardAnalytics, MonthlyTargets)
│
├── App.tsx                 # Entry point inisialisasi halaman
└── index.css               # Import font Inter, Tailwind CSS, dan kustomisasi gaya global
```

---

## 🎨 Design System & Visual Guidelines

Mengacu pada identitas korporat **PT PLN (Persero)**, aplikasi didesain ulang dengan pendekatan modern, clean, dan minimalis:

### Aturan Warna 60:30:10
- **60% Dominan (Latar Belakang)**: Menggunakan warna netral slate bersih (`slate-50` pada Light Mode / `slate-950` pada Dark Mode) untuk memberikan kesan lapang dan fokus pada data.
- **30% Sekunder (Kontainer & Menu)**: Menggunakan warna putih bersih/abu-abu gelap (`slate-900` pada Dark Mode) untuk komponen kartu. Warna brand utama **PLN Blue** (`#075E9B` / `#0A8FE0`) diterapkan pada area sidebar menu, header navigasi, indikator aktif, dan pagination tabel.
- **10% Aksen (Highlights & Status)**: Aksen **PLN Yellow** (`#F7DD0E`) digunakan sebagai highlight status aktif. Status/badge operasional menggunakan warna indikator sukses (`emerald-500`), peringatan (`amber-500`), dan bahaya/kritis (`rose-500`).

### Spacing Kelipatan 4px Grid
Semua tata letak layout menggunakan basis unit spacing kelipatan 4px (diatur via tokens):
- `xs`: 4px | `sm`: 8px | `md`: 12px | `lg`: 16px | `xl`: 20px | `xxl`: 24px | `xxxl`: 32px
- Border Radius menggunakan standar `rounded-xl` (12px) dan `rounded-2xl` (16px) untuk kelenturan bentuk elemen visual.

### Responsivitas Mobile-First
- **Tampilan Mobile (<1024px)**: Menu sidebar disembunyikan secara default dan digantikan oleh *Mobile Bottom Navbar Menu* yang ramah sentuhan, memastikan kenyamanan pengisian laporan langsung oleh petugas di lapangan.
- **Tampilan Desktop (≥1024px)**: Sidebar kiri PLN Blue yang informatif dan dapat di-*collapse* untuk memaksimalkan area kerja analisis.

---

## 🛠️ Langkah Instalasi Lokal

### 1. Prasyarat
Pastikan komputer Anda sudah terinstal:
- [Node.js](https://nodejs.org/) (versi 18 ke atas disarankan)
- npm (bawaan dari Node.js)

### 2. Klon & Install Dependensi
Buka terminal pada folder proyek `d:\Antigravity\p2tl` dan jalankan perintah berikut:
```bash
# Install seluruh library dependensi frontend
npm install
```

### 3. Menjalankan Server Pengembangan
Jalankan aplikasi di lingkungan lokal dengan perintah:
```bash
npm run dev
```
Setelah berhasil berjalan, buka browser di alamat `http://localhost:5173`.

### 4. Membangun Bundle Produksi
Untuk mengompilasi dan mengoptimasi aplikasi agar siap dideploy ke server production:
```bash
npm run build
```
Hasil kompilasi akan berada pada folder `/dist`.

---

## ⚙️ Panduan Setup Backend (Google Sheets)

Untuk menghubungkan dashboard ini dengan database Google Sheets Anda:

1. Buka spreadsheet Google Sheets target Anda.
2. Pastikan terdapat sheet dengan nama **`Realisasi`** yang berisi log transaksi data temuan P2TL dengan minimal kolom-kolom berikut (nama kolom boleh bervariasi karena script menggunakan pencarian pintar berbasis kecocokan kata kunci):
   - `NOAGENDA` (Nomor Agenda)
   - `IDPEL` (ID Pelanggan)
   - `NAMA` (Nama Pelanggan)
   - `GOL` (Golongan Pelanggaran, e.g. P1, P2, P3, P4)
   - `TARIF/DAYA` (e.g. R1/900 VA)
   - `KWH` (kWh Temuan)
   - `TS` (Rupiah Tagihan Susulan)
   - `TANGGAL REGISTER` (Tanggal temuan dicatat)
3. Masuk ke menu **Extensions** -> **Apps Script**.
4. Hapus seluruh kode bawaan editor, lalu salin dan tempel isi file `backend/p2tl-backend.gs` dari proyek ini ke dalam editor Apps Script.
5. Klik **Save** (ikon disket).
6. Lakukan deployment:
   - Klik **Deploy** -> **New Deployment**.
   - Pilih jenis deployment **Web App**.
   - Isi deskripsi sesuka Anda.
   - Pada pilihan **Execute as**, pilih **Me (email anda)**.
   - Pada pilihan **Who has access**, ubah menjadi **Anyone** (sangat penting agar frontend dapat mengakses API tanpa terkendala autentikasi Google).
   - Klik **Deploy**.
7. Salin URL Web App yang dihasilkan (format URL: `https://script.google.com/macros/s/.../exec`).
8. Buka Dashboard P2TL di browser, navigasikan ke menu **Pengaturan**, tempelkan URL tersebut ke kolom **Google Apps Script Web App URL**, kemudian klik **Simpan URL**.
9. Lakukan **Tes Koneksi** untuk memverifikasi status koneksi API.
