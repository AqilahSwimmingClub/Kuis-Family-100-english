import { expect, test } from "@playwright/test";

const subjects = [
  "Bahasa Inggris",
  "Matematika",
  "IPAS",
  "Bahasa Indonesia",
  "Pendidikan Pancasila",
  "Seni Rupa",
  "Koding dan AI",
];

test("homepage presents all subjects and every subject card selects its real bank", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Educational Game Center/i);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "FAMILY 100",
  );
  const stats = page.getByRole("region", { name: "Statistik bank soal" });
  await expect(stats).toContainText("1.091");
  await expect(stats).toContainText("49");
  await expect(page.locator(".edu-subject-card")).toHaveCount(7);
  for (const subject of subjects) {
    await page
      .getByRole("link", { name: `MAIN SEKARANG — ${subject}` })
      .click();
    await expect(page.locator("#subjects input:checked")).toHaveCount(1);
    await expect(page.locator("#subjects input:checked")).toHaveAttribute(
      "data-sub",
      subject,
    );
    await page.goto("/");
  }
  await page.getByRole("link", { name: "MULAI BERMAIN", exact: true }).click();
  await expect(page.locator("#start")).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("link", { name: "LANJUTKAN PERMAINAN", exact: true })
    .click();
  await expect(page.locator("#setup")).toBeVisible();
  await expect(page.locator("#resume")).toBeDisabled();
  await page.goto("/");
  await page
    .getByRole("link", { name: "Buka English Challenge", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "START GAME", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("touch navigation and section links work", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Buka navigasi" });
  if (await toggle.isVisible()) {
    await toggle.click();
    await page.getByRole("link", { name: "Mata Pelajaran", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await toggle.click();
  }
  await page.getByRole("link", { name: "Mata Pelajaran", exact: true }).click();
  await expect(page).toHaveURL(/#mata-pelajaran$/);
  await expect(
    page.getByRole("heading", { name: "Pilih petualangan belajarmu" }),
  ).toBeInViewport();
  if (await toggle.isVisible()) {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
  }
  await page.getByRole("link", { name: "Cara Bermain", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Enam langkah menuju keseruan" }),
  ).toBeInViewport();
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole("link", { name: "Bank Soal", exact: true }).click();
  await expect(page.locator("#bankView")).toBeVisible();
});

const sizes = [
  { name: "phone-360", width: 360, height: 720 },
  { name: "phone-393", width: 393, height: 873 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "tablet-11inch", width: 1200, height: 800 },
  { name: "desktop", width: 1366, height: 768 },
  { name: "full-hd", width: 1920, height: 1080 },
];
for (const size of sizes)
  test(`homepage fits ${size.name} with accessible touch targets`, async ({
    page,
  }, info) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator(".floating-subject")).toHaveCount(7);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      heroFits:
        document.querySelector("h1")!.getBoundingClientRect().right <=
        innerWidth,
      smallTargets: [...document.querySelectorAll("a,button")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            !element.classList.contains("edu-skip") &&
            rect.height < 44
          );
        })
        .map((element) => element.textContent),
    }));
    expect(layout.overflow).toBe(false);
    expect(layout.heroFits).toBe(true);
    expect(layout.smallTargets).toEqual([]);
    await page.screenshot({
      path: `test-results/homepage-${size.name}-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });

test("reduced motion stops the seven floating icons and keeps content visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const card of await page.locator(".floating-subject").all()) {
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS("animation-name", "none");
    await expect(card).toHaveCSS("opacity", "1");
  }
  await expect(
    page.getByRole("link", { name: "MULAI BERMAIN", exact: true }),
  ).toBeVisible();
});
