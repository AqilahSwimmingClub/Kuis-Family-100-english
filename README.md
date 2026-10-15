# FAMILY 100 — EDUCATIONAL GAME CENTER

Refleksi pembelajaran **SDN SATRIA JAYA 01 · KELAS 5 · Tahun Pelajaran 2026/2027**. Homepage bertema putih memperkenalkan tujuh mata pelajaran, 49 bab/unit, dan 1.091 soal. Guru mengoperasikan perangkat, siswa berdiskusi dan menjawab bersama.

## Pilihan permainan

- `/`: homepage umum dengan statistik yang diturunkan dari bank soal asli saat Vite berjalan/build; halaman ini tidak mengunduh seluruh bank soal.
- `/game-center/`: pilih mata pelajaran, bab/unit, jumlah soal, dan 2–12 kelompok. Family 100, pilihan ganda, serta jawaban singkat tersedia. Guru tetap memandu pemilihan tim; catatan kesempatan bukan jaminan rotasi otomatis.
- `/game-center/?subject=Matematika`: membuka pengaturan dengan satu mapel terpilih. Semua kartu mapel memakai parameter yang sama, sesuai nama mapel dalam data.
- `/game-center/?resume=1`: memulihkan progres lokal yang valid; jika belum ada, menampilkan pengaturan. Progres rusak tidak dihapus.
- `/game-center/?view=bank`: telusuri soal dengan pencarian, filter mapel/jenis, pagination, serta jawaban/pembahasan yang dibuka secara manual.
- `/?mode=english`: English Challenge lama tetap tersedia dengan skor, timer, editor, impor/ekspor, dan penyimpanan aslinya.

Data Game Center tetap berada dalam delapan berkas `public/game-center/data/bank-part-*.txt`. Homepage memakai ringkasan kecil yang dihasilkan `vite.config.ts`; tidak ada salinan bank soal untuk homepage. Animasi ikon menghormati reduced motion. Tidak ada backend atau secret baru.

## Menjalankan

Node.js 22.12+ (disarankan Node 24) dan npm.

```sh
npm ci
npm run dev
```

```sh
npm run lint
npm test
npm run build
npm run preview
```

`npm run test:e2e` menjalankan pengujian Chromium; otomatis memakai `/usr/bin/chromium` jika tersedia, atau tentukan `CHROMIUM_PATH`. Jika belum ada browser, persiapan: `PLAYWRIGHT_BROWSERS_PATH=/tmp/family100-browsers npx playwright install chromium`; gunakan variabel yang sama ketika menjalankan test. Cache npm berada di `/tmp/family100-npm-cache`, bukan source aplikasi.

## Cara bermain English Challenge

1. START GAME membuka pengaturan nama/anggota lima tim dan urutan soal. Mulai permainan setelah siap.
2. Giliran utama mengikuti Team 1–5 berulang: 30 soal bawaan memberikan tepat enam ronde per tim. Bank kustom dengan jumlah kelipatan lima juga dapat dimainkan.
3. Klik jawaban tertutup atau pilih jawaban di panel guru lalu REVEAL ANSWER. Poin otomatis masuk ke penerima yang dipilih, hanya sekali per jawaban.
4. WRONG menambah kesalahan. Setelah tiga kesalahan, pilih tim lain dan tekan STEAL jika fitur aktif. Tim perebut hanya mendapat satu kesempatan; hanya poin jawaban yang dibuka yang diberikan. Poin sebelumnya tetap.
5. SHOW ALL ANSWERS mengakhiri ronde dan membuka jawaban untuk refleksi **tanpa** menambah skor. NEXT QUESTION mempertahankan hasil ronde; PREVIOUS QUESTION membuka kembali ronde tersimpan. Gunakan RESET ROUND untuk mengulang ronde, UNDO untuk koreksi aksi terakhir, atau koreksi skor manual.
6. Timer berhenti saat pause dan tidak berjalan di luar layar permainan. Saat habis, tekan ulang timer untuk melanjutkan penilaian. Tanpa batas waktu tersedia di Settings. Steal mendapat timer baru.
7. Layar akhir menampilkan ENGLISH CHAMPION!, peringkat bersama untuk skor seri, dan refleksi tiga bab. Tidak ada pemilihan juara acak.

## Fitur guru dan data English Challenge

- Bank berisi 30 soal berbeda, sepuluh per bab: Food and Taste, Food Quantities, Prices and Shopping. Semua jawaban total 100 poin; bobot merupakan desain permainan edukasi, bukan survei.
- Editor soal mendukung tambah, edit, hapus, serta impor/ekspor bank JSON. Setiap soal: `id`, `chapter` (1–3), `en`, `idn`, `answers` (4–6 objek `{text, points}`), `explanation`, `competency`. ID unik, teks tidak kosong, poin bilangan bulat positif dan total 100. Ekspor bank bawaan menjadi contoh format.
- Bank aktif disalin saat game baru. Edit bank tidak mengubah skor game yang sudah berjalan. Jumlah soal game harus kelipatan lima agar giliran adil. Urutan dapat digeser sebelum mulai.
- LocalStorage menyimpan snapshot versi 1 pada `family100.session.v1`, termasuk bank, pengaturan, tim, game dan undo hingga 30 aksi terakhir (dibatasi ukuran untuk bank besar). Cadangan valid sebelumnya disimpan terpisah. Jika data utama rusak, aplikasi mencoba cadangan; jika keduanya gagal, memulai data bawaan dengan pesan. Kegagalan penyimpanan ditampilkan; gunakan ekspor JSON untuk cadangan.
- EXPORT GAME mengekspor progres lengkap, IMPORT GAME DATA memvalidasi sebelum mengganti data. Impor dan game baru meminta konfirmasi. Batas impor 2 MB. JSON dari sumber tidak dikenal tidak dieksekusi.
- EXPORT RESULT menghasilkan CSV peringkat; tombol cetak menghasilkan ringkasan dan refleksi. Nilai CSV yang menyerupai formula dinetralkan.
- Mode proyektor, fullscreen, terjemahan, suara sintetis Web Audio, timer 10/15/20/30 detik atau tanpa batas. Animasi menghormati preferensi reduced motion. Audio aktif setelah interaksi pengguna dan tidak membutuhkan file eksternal.
- Aset dibundel lokal. Setelah halaman selesai dimuat, permainan tidak memerlukan koneksi internet; refresh saat benar-benar offline tidak dijamin karena aplikasi ini tidak memasang service worker.
- Data hanya tersimpan pada browser/perangkat yang dipakai, bukan tersinkron antarperangkat. Ekspor berkala sebelum menghapus data browser.

## Deployment Vercel

Impor repositori ke Vercel, pilih **Vite**, Node **24.x**, build `npm run build`, output `dist`, install `npm ci`. Root directory adalah root repositori ini. `vercel.json` sudah disediakan; tidak ada environment variable, API key, database atau backend. Build dapat diunggah sebagai situs statis ke hosting lain. Publikasi Vercel memerlukan akses akun pengguna.

## Struktur

- `src/data/questions.ts`: bank soal terkurasi.
- `src/game/engine.ts`: reducer murni, skor, ranking dan undo.
- `src/game/schemas.ts`: validasi bank/progres termasuk konsistensi ledger.
- `src/game/storage.ts`: penyimpanan, pemulihan, ekspor.
- `src/components/`: halaman dan kontrol guru.
- `src/game/*.test.ts`, `src/App.test.tsx`, `e2e/`: unit, UI dan browser test.

**Dirancang & Dikembangkan oleh FAHMI DJAWAS, S.Pd.**  
**© 2026 Semua Hak Dilindungi**
