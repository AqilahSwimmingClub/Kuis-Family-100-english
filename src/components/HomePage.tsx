import { useRef, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Bookmark,
  Bot,
  Brush,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Earth,
  Flag,
  GraduationCap,
  Layers3,
  Lightbulb,
  Menu,
  MessageCircle,
  Palette,
  Pencil,
  Play,
  RotateCw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { catalog, number } from "../data/catalog";
import "./homepage.css";
import { SoundSettings } from "./SoundSettings";

const subjects = [
  {
    name: "Bahasa Inggris",
    icon: MessageCircle,
    secondary: "ABC",
    color: "#2563eb",
    tint: "#eff6ff",
    description: "Kata baru, cerita baru. Let’s learn together!",
    label: "BAHASA",
    visual: "english",
  },
  {
    name: "Matematika",
    icon: Calculator,
    secondary: "123",
    color: "#7c3aed",
    tint: "#f5f3ff",
    description: "Asah logika, temukan pola, pecahkan tantangan.",
    label: "LOGIKA",
    visual: "math",
  },
  {
    name: "IPAS",
    icon: Earth,
    secondary: Lightbulb,
    color: "#047857",
    tint: "#ecfdf5",
    description: "Jelajahi alam dan dunia di sekitar kita.",
    label: "EKSPLORASI",
    visual: "science",
  },
  {
    name: "Bahasa Indonesia",
    icon: BookOpen,
    secondary: Pencil,
    color: "#c2410c",
    tint: "#fff7ed",
    description: "Baca, ceritakan, dan sampaikan idemu.",
    label: "LITERASI",
    visual: "language",
  },
  {
    name: "Pendidikan Pancasila",
    icon: ShieldCheck,
    secondary: Star,
    color: "#b45309",
    tint: "#fffbeb",
    description: "Tumbuh bersama dalam nilai dan kebersamaan.",
    label: "KARAKTER",
    visual: "civics",
  },
  {
    name: "Seni Rupa",
    icon: Palette,
    secondary: Brush,
    color: "#be185d",
    tint: "#fdf2f8",
    description: "Bermain warna dan bebaskan imajinasimu.",
    label: "KREATIVITAS",
    visual: "art",
  },
  {
    name: "Koding dan AI",
    icon: Bot,
    secondary: Code2,
    color: "#0e7490",
    tint: "#ecfeff",
    description: "Kenali teknologi. Rangkai ide untuk masa depan.",
    label: "TEKNOLOGI",
    visual: "coding",
  },
].map((subject) => ({
  ...subject,
  ...catalog.subjects.find((item) => item.name === subject.name)!,
}));

const features = [
  {
    icon: RotateCw,
    title: "Giliran untuk semua",
    description:
      "Guru memilih tim menjawab, dengan kesempatan tiap tim tercatat selama permainan.",
  },
  {
    icon: Zap,
    title: "Final Steal",
    description:
      "Buka kesempatan rebutan untuk tim dengan poin ronde terendah.",
  },
  {
    icon: Lightbulb,
    title: "Refleksi pembelajaran",
    description: "Buka pembahasan dan diskusikan cara berpikir bersama siswa.",
  },
  {
    icon: Trophy,
    title: "Skor tim langsung",
    description: "Poin jawaban terakumulasi dan hasil akhir siap diunduh.",
  },
  {
    icon: Save,
    title: "Progres tersimpan",
    description:
      "Lanjutkan di browser yang sama atau cadangkan progres ke JSON.",
  },
  {
    icon: Users,
    title: "Kelompok fleksibel",
    description: "Atur 2–12 kelompok dan beri nama sesuai kreativitas kelas.",
  },
  {
    icon: Layers3,
    title: "Tiga jenis tantangan",
    description:
      "Family 100, pilihan ganda, dan uraian singkat dalam satu bank soal.",
  },
];
const steps = [
  "Pilih mata pelajaran",
  "Tentukan bab/unit",
  "Pilih jumlah pertanyaan",
  "Atur kelompok",
  "Mulai permainan",
  "Bahas jawaban & lihat hasil",
];
const style = (color: string, tint: string) =>
  ({ "--subject-color": color, "--subject-tint": tint }) as CSSProperties;

function LearningStage() {
  return (
    <div className="learning-stage" aria-hidden="true">
      <div className="learning-orbit orbit-outer" />
      <div className="learning-orbit orbit-inner" />
      <span className="stage-star star-a">✦</span>
      <span className="stage-star star-b">✦</span>
      <span className="stage-dot dot-a" />
      <span className="stage-dot dot-b" />
      <div className="learning-console">
        <div className="console-top">
          <span>
            <i /> KELAS 5 · GAME SHOW
          </span>
          <Sparkles size={16} />
        </div>
        <div className="console-trophy">
          <Trophy size={34} strokeWidth={1.7} />
        </div>
        <strong>
          SIAP JADI
          <br />
          <span>JUARA?</span>
        </strong>
        <div className="console-score">
          <span>KERJA SAMA</span>
          <b>100</b>
        </div>
        <div className="console-score">
          <span>SEMANGAT BELAJAR</span>
          <b>100</b>
        </div>
        <div className="console-bottom">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      {subjects.map((subject, i) => (
        <div
          key={subject.name}
          className={`floating-subject float-${subject.visual}`}
          style={
            {
              ...style(subject.color, subject.tint),
              "--float-delay": `${-i * 0.7}s`,
              "--entry-delay": `${i * 0.08}s`,
            } as CSSProperties
          }
        >
          <div className="floating-inner">
            <subject.icon size={32} strokeWidth={1.7} />
            <span className="floating-detail">
              {typeof subject.secondary === "string" ? (
                subject.secondary
              ) : (
                <subject.secondary size={15} />
              )}
            </span>
            <b>
              {subject.name === "Pendidikan Pancasila"
                ? "Pancasila"
                : subject.name === "Bahasa Indonesia"
                  ? "B. Indonesia"
                  : subject.name === "Bahasa Inggris"
                    ? "B. Inggris"
                    : subject.name}
            </b>
          </div>
        </div>
      ))}
      <div className="stage-caption">
        <span>
          <Check size={13} />
        </span>{" "}
        Semua punya kesempatan bersinar.
      </div>
    </div>
  );
}

export function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  return (
    <div className="education-home" id="beranda">
      <a className="edu-skip" href="#konten">
        Langsung ke konten
      </a>
      <header className="edu-header">
        <div className="edu-container edu-header-inner">
          <a className="edu-brand" href="/" aria-label="FAMILY 100 — Beranda">
            <span className="edu-brand-icon">
              <Trophy size={24} />
            </span>
            <span>
              FAMILY <b>100</b>
              <small>BELAJAR · BERMAIN · BERSAMA</small>
            </span>
          </a>
          <SoundSettings />
          <button
            ref={menuToggle}
            className="edu-menu-toggle"
            aria-label="Buka navigasi"
            aria-expanded={menuOpen}
            aria-controls="edu-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <nav
            id="edu-navigation"
            className={menuOpen ? "is-open" : ""}
            aria-label="Navigasi utama"
            onClick={() => setMenuOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && menuOpen) {
                setMenuOpen(false);
                menuToggle.current?.focus();
              }
            }}
          >
            <a href="#beranda" className="active">
              Beranda
            </a>
            <a href="#mata-pelajaran">Mata Pelajaran</a>
            <a href="/game-center/?view=bank">Bank Soal</a>
            <a href="#cara-bermain">Cara Bermain</a>
            <a className="edu-button edu-button-small" href="/game-center/">
              Mulai Game <ArrowRight size={16} />
            </a>
          </nav>
        </div>
      </header>
      <main id="konten">
        <section
          className="edu-container edu-hero"
          aria-labelledby="hero-heading"
        >
          <div className="edu-hero-copy">
            <div className="edu-eyebrow">
              <span>
                <GraduationCap size={16} />
              </span>{" "}
              REFLEKSI PEMBELAJARAN KELAS 5
            </div>
            <h1 id="hero-heading">
              FAMILY{" "}
              <span>
                100
                <svg viewBox="0 0 240 16" aria-hidden="true">
                  <path d="M5 11Q110 -2 235 8" />
                </svg>
              </span>
            </h1>
            <p className="edu-subtitle">EDUCATIONAL GAME CENTER</p>
            <p className="edu-tagline">
              Belajar Bersama <span>•</span> Bermain Bersama
              <br />
              Berprestasi Bersama<span className="tagline-spark"> ✦</span>
            </p>
            <p className="edu-description">
              Belajar jadi permainan! Pilih mata pelajaran, tentukan bab, atur
              kelompok, dan mulai petualangan belajar yang menyenangkan.
            </p>
            <div className="edu-hero-actions">
              <a className="edu-button" href="/game-center/">
                <Play size={17} fill="currentColor" /> MULAI BERMAIN{" "}
                <ArrowRight size={18} />
              </a>
              <a
                className="edu-button edu-button-outline"
                href="/game-center/?resume=1"
              >
                <RotateCw size={16} /> LANJUTKAN PERMAINAN
              </a>
            </div>
            <a className="edu-explore" href="#mata-pelajaran">
              JELAJAHI MATA PELAJARAN <ArrowDown size={15} />
            </a>
            <div className="edu-hero-note">
              <span className="edu-team-dots">
                <i>A</i>
                <i>B</i>
                <i>C</i>
              </span>
              <span>
                Untuk satu kelas, penuh kemungkinan.
                <small>SDN SATRIA JAYA 01 · TAHUN PELAJARAN 2026/2027</small>
              </span>
            </div>
          </div>
          <LearningStage />
        </section>
        <section
          className="edu-container edu-statistics"
          aria-label="Statistik bank soal"
        >
          <div>
            <span className="stat-icon">
              <BookOpen />
            </span>
            <p>
              <strong>{catalog.subjects.length}</strong>
              <span>Mata Pelajaran</span>
            </p>
          </div>
          <div>
            <span className="stat-icon">
              <Bookmark />
            </span>
            <p>
              <strong>{catalog.chapters}</strong>
              <span>Bab/Unit</span>
            </p>
          </div>
          <div>
            <span className="stat-icon">
              <Layers3 />
            </span>
            <p>
              <strong>{number(catalog.total)}</strong>
              <span>Bank Soal</span>
            </p>
          </div>
          <div>
            <span className="stat-icon">
              <Users />
            </span>
            <p>
              <strong className="stat-flexible">2–12</strong>
              <span>Kelompok Fleksibel</span>
            </p>
          </div>
        </section>
        <section
          className="edu-subject-section"
          id="mata-pelajaran"
          aria-labelledby="subjects-heading"
        >
          <div className="edu-container">
            <div className="edu-section-heading">
              <div>
                <p className="edu-eyebrow">
                  <span className="tiny-line" /> SATU TEMPAT, BANYAK PENGETAHUAN
                </p>
                <h2 id="subjects-heading">Pilih petualangan belajarmu</h2>
                <p>
                  Setiap mata pelajaran, kesempatan baru untuk jadi lebih tahu.
                </p>
              </div>
              <span className="edu-counter">
                <span /> {catalog.subjects.length} mata pelajaran siap dimainkan
              </span>
            </div>
            <div className="edu-subject-grid">
              {subjects.map((subject) => (
                <article
                  className={`edu-subject-card subject-${subject.visual}`}
                  key={subject.name}
                  style={style(subject.color, subject.tint)}
                >
                  <div className="subject-card-top">
                    <span className="subject-icon">
                      <subject.icon size={28} strokeWidth={1.7} />
                    </span>
                    <span className="subject-label">{subject.label}</span>
                  </div>
                  <h3>{subject.name}</h3>
                  <p>{subject.description}</p>
                  <div className="subject-count">
                    <b>{number(subject.count)}</b> soal <span>·</span>{" "}
                    {subject.chapters} bab/unit
                  </div>
                  <a
                    href={`/game-center/?subject=${encodeURIComponent(subject.name)}`}
                    aria-label={`MAIN SEKARANG — ${subject.name}`}
                  >
                    MAIN SEKARANG <ArrowRight size={17} />
                  </a>
                </article>
              ))}
            </div>
            <p className="edu-data-note">
              <ShieldCheck size={15} /> Satu bank soal bersama. Pilih satu atau
              gabungkan beberapa mata pelajaran di Game Center.
            </p>
          </div>
        </section>
        <section
          className="edu-container edu-features"
          aria-labelledby="features-heading"
        >
          <div className="edu-section-heading centered">
            <p className="edu-eyebrow">DIBUAT UNTUK SERUNYA BELAJAR BERSAMA</p>
            <h2 id="features-heading">Guru memandu. Siswa bersinar.</h2>
            <p>
              Kontrol yang mudah, ruang diskusi yang luas, dan semangat satu
              kelas.
            </p>
          </div>
          <div className="edu-feature-grid">
            {features.map((feature) => (
              <div key={feature.title} className="edu-feature">
                <span>
                  <feature.icon size={21} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
        <section
          className="edu-how-section"
          id="cara-bermain"
          aria-labelledby="how-heading"
        >
          <div className="edu-container">
            <div className="edu-section-heading centered">
              <p className="edu-eyebrow">SIAPKAN KELAS, NYALAKAN SEMANGAT</p>
              <h2 id="how-heading">Enam langkah menuju keseruan</h2>
              <p>
                Guru mengoperasikan permainan. Siswa berdiskusi dan menjawab
                bersama.
              </p>
            </div>
            <ol className="edu-steps">
              {steps.map((step, i) => (
                <li key={step}>
                  <span>0{i + 1}</span>
                  <h3>{step}</h3>
                  {i < steps.length - 1 && (
                    <ChevronRight size={18} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
            <a className="edu-button" href="/game-center/">
              Ayo, mulai petualangannya <ArrowRight size={18} />
            </a>
          </div>
        </section>
        <section
          className="edu-container edu-extra"
          aria-labelledby="extra-heading"
        >
          <div className="edu-extra-icon">
            <Flag size={30} />
          </div>
          <div>
            <p className="edu-eyebrow">MODE TAMBAHAN</p>
            <h2 id="extra-heading">Masih suka English Challenge?</h2>
            <p>
              Game show Bahasa Inggris klasik dengan lima tim, timer, dan bank
              soal yang dapat diedit tetap ada di sini.
            </p>
          </div>
          <a className="edu-button edu-button-outline" href="/?mode=english">
            Buka English Challenge <ArrowRight size={17} />
          </a>
        </section>
      </main>
      <footer className="edu-footer">
        <div className="edu-container">
          <div className="edu-footer-top">
            <a className="edu-brand" href="/">
              FAMILY <b>100</b>
              <Sparkles size={18} />
            </a>
            <span>Belajar hari ini. Bersinar esok hari.</span>
            <a href="#beranda">
              Kembali ke atas <ArrowDown size={14} />
            </a>
          </div>
          <p>
            Dirancang &amp; Dikembangkan oleh{" "}
            <strong>FAHMI DJAWAS, S.Pd.</strong>
          </p>
          <p>© 2026 Semua Hak Dilindungi</p>
          <small>
            SDN SATRIA JAYA 01 — KELAS 5 — TAHUN PELAJARAN 2026/2027
          </small>
          <div className="edu-footer-local">
            <CheckCircle2 size={13} /> Progres disimpan lokal di browser
            perangkat Anda.
          </div>
        </div>
      </footer>
    </div>
  );
}
