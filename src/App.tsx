import { lazy, Suspense } from "react";
import { HomePage } from "./components/HomePage";

const EnglishChallenge = lazy(() => import("./EnglishChallenge"));

export default function App() {
  return new URLSearchParams(window.location.search).get("mode") ===
    "english" ? (
    <Suspense
      fallback={<main className="page">Memuat English Challenge…</main>}
    >
      <EnglishChallenge />
    </Suspense>
  ) : (
    <HomePage />
  );
}
