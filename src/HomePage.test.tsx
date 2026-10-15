import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

it("makes all seven subjects the main identity and provides working navigation", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "FAMILY 100",
  );
  expect(
    screen.getByText("EDUCATIONAL GAME CENTER", { exact: true }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /MULAI BERMAIN/ })).toHaveAttribute(
    "href",
    "/game-center/",
  );
  expect(
    screen.getByRole("link", { name: /LANJUTKAN PERMAINAN/ }),
  ).toHaveAttribute("href", "/game-center/?resume=1");
  expect(screen.getByRole("link", { name: "Bank Soal" })).toHaveAttribute(
    "href",
    "/game-center/?view=bank",
  );
  const subjects = screen.getByRole("region", {
    name: "Pilih petualangan belajarmu",
  });
  const cards = within(subjects).getAllByRole("article");
  expect(cards).toHaveLength(7);
  for (const name of [
    "Bahasa Inggris",
    "Matematika",
    "IPAS",
    "Bahasa Indonesia",
    "Seni Rupa",
    "Pendidikan Pancasila",
    "Koding dan AI",
  ]) {
    expect(
      within(subjects).getByRole("link", { name: `MAIN SEKARANG — ${name}` }),
    ).toHaveAttribute(
      "href",
      `/game-center/?subject=${encodeURIComponent(name)}`,
    );
  }
  expect(
    screen.getByRole("link", { name: /Buka English Challenge/ }),
  ).toHaveAttribute("href", "/?mode=english");
});

it("opens and closes the touch navigation with accessible state", () => {
  render(<App />);
  const toggle = screen.getByRole("button", { name: "Buka navigasi" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("link", { name: "Mata Pelajaran" }));
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});

it("returns keyboard focus to the menu toggle when Escape closes navigation", () => {
  render(<App />);
  const toggle = screen.getByRole("button", { name: "Buka navigasi" });
  fireEvent.click(toggle);
  const link = screen.getByRole("link", { name: "Mata Pelajaran" });
  link.focus();
  fireEvent.keyDown(link, { key: "Escape" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveFocus();
});
