import { expect, type Page } from "@playwright/test";

export const SITE_IDS = [
  "giofyros-1",
  "giofyros-2",
  "almyros-1",
  "sabato-bn",
  "akerselva-oslo",
  "coselhas-coimbra",
  "calore-bn",
  "alna-oslo",
  "hovinbekken-oslo",
  "mondego-coimbra",
];

export const PAGES = ["/", "/check", "/clinic", "/data", "/standards", "/sites/giofyros-1"];

/** Collect uncaught exceptions and console errors (ignoring third-party map tiles). */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/tile\.openstreetmap|Failed to load resource.*(tile|favicon)/i.test(t)) return;
    errors.push(`console: ${t}`);
  });
  return {
    errors,
    assertClean: () => expect(errors, errors.join("\n")).toEqual([]),
  };
}

/** The layout must fit the device width: no sideways scroll and no zoomed-out, widened layout viewport. */
export async function noHorizontalOverflow(page: Page) {
  const device = page.viewportSize()!.width;
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(iw, `layout viewport widened to ${iw}px on a ${device}px screen`).toBeLessThanOrEqual(device + 1);
  expect(sw, `page scrolls horizontally: ${sw} > ${device}`).toBeLessThanOrEqual(device + 1);
}

export const uniqueVolunteer = () => `V-E2E${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
