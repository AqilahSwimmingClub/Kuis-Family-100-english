# Family 100 — English Challenge

Implementasi berdasarkan lampiran pengguna; pengguna meminta eksekusi langsung sampai siap deployment.

## Tujuan
Game lisan Bahasa Inggris kelas 5, SDN SATRIA JAYA 01, tahun 2026/2027, dikendalikan guru di satu perangkat. React + TypeScript + Vite, Tailwind, Lucide, Framer Motion, Web Audio, LocalStorage. Semua aset lokal tanpa backend atau kredensial.

## Arsitektur
Bank data 30 pertanyaan terkurasi: 10 tiap bab, 4 jawaban berbobot 40/30/20/10. Schema Zod memvalidasi bank dan snapshot. Reducer murni mengelola ronde, kredit tiap jawaban, kesalahan dan steal. Total skor dihitung dari ledger kredit per ronde ditambah koreksi manual. Riwayat snapshot mendukung undo; reset hanya mengosongkan ledger ronde aktif.

UI terdiri atas beranda, pengaturan, bank soal, papan permainan, leaderboard dan refleksi. Lima kartu skor selalu hadir; panel guru dapat disembunyikan. Navigasi ronde mempertahankan kredit. Setelah tiga kesalahan tim utama berhenti; guru dapat memilih satu tim lain untuk satu kesempatan steal. Show All tidak memberikan poin. Jawaban yang terbuka tidak dapat dinilai ulang. Timer berhenti saat pause, habis, atau ronde selesai. Seri menggunakan peringkat bersama; tidak ada pemenang acak.

## Data dan pemulihan
Simpan snapshot versi 1, bank, pengaturan, tim, timer, ledger dan histori undo lokal. Impor bersifat atomik dan tervalidasi; data gagal tidak menimpa permainan. Cadangan snapshot valid sebelumnya digunakan untuk pemulihan. Ekspor JSON penuh, CSV skor, dan ringkasan cetak. Bank saat game baru disalin sehingga edit bank tidak mengubah permainan aktif. Urutan soal dapat dipindah sebelum mulai.

## Desain
Panggung biru gelap dengan aksen emas, cyan dan ungu; papan LED, flip jawaban, konfeti CSS, tipografi besar dan responsif. Kontrol bernama jelas dengan label aksesibilitas, status penyimpanan dan dialog konfirmasi. Footer kredit wajib.

## Validasi
Unit test bank, distribusi giliran, double scoring, steal, reset, undo, navigasi, koreksi, validasi data dan pemulihan. Pengujian UI/browser meliputi mulai game, reveal, salah/steal, refresh, impor buruk dan viewport mobile. ESLint tanpa warning, TypeScript dan production build wajib lulus. Vercel menggunakan dist; deployment publik memerlukan akun pengguna dan tidak dilakukan otomatis.
