// End-to-end checks for the expedition site: layout on phones and desktops, both languages,
// accessibility of the photo viewer and carousel, swipe, forced dark mode, links and the 404 page.
import { test, expect, chromium } from '@playwright/test';
import sharp from 'sharp';

const PAGES = [{ path: '', lang: 'cs' }, { path: 'en/', lang: 'en' }];
const WIDTHS = [320, 360, 390, 768, 1024, 1440];
// the embedded Google Map loads its own tiles, which sometimes fail; that isn't our page
const external = url => !url.startsWith('http://localhost');

// Scrolls through the whole page so every reveal animation and lazy image has run
async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(40); }
  await page.waitForTimeout(1200);
}

for (const { path, lang } of PAGES) {
  for (const width of WIDTHS) {
    test(`${lang} at ${width}px: no sideways scroll, no errors, no broken requests`, async ({ browser }) => {
      const phone = width < 700;
      const ctx = await browser.newContext({ viewport: { width, height: phone ? 740 : 900 }, isMobile: phone, hasTouch: phone });
      const page = await ctx.newPage();
      const problems = [];
      page.on('pageerror', e => problems.push(`script error: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error' && !external(m.location().url || '')) problems.push(`console: ${m.text()}`); });
      page.on('response', r => { if (r.status() >= 400 && !external(r.url())) problems.push(`HTTP ${r.status()} ${r.url()}`); });
      page.on('requestfailed', r => { if (!external(r.url())) problems.push(`failed ${r.url()}`); });
      await page.goto(path);
      await scrollThrough(page);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(clientWidth);
      expect(problems).toEqual([]);
      await ctx.close();
    });
  }

  test(`${lang}: own language, title and alternate links`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page).toHaveTitle(lang === 'cs' ? /Stříbrná expedice/ : /Silver DOFE expedition/);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('.lang-link[aria-current="page"]')).toHaveText(lang === 'cs' ? 'CZ' : 'EN');
    // only this language's text is on the page
    const html = await page.content();
    expect(html).not.toContain('data-l=');
    expect(html).not.toContain('DofE');
    await expect(page.locator('.footer-contact a[href="mailto:olysarp@gmail.com"]')).toHaveCount(1);
  });
}

test('language switch keeps the current section', async ({ page }) => {
  await page.goto('');
  await page.locator('#den-2').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 200));
  await expect(page.locator('.lang-link[hreflang="en"]')).toHaveAttribute('href', /\/en\/#den-2$/);
});

test('gallery photos open with the keyboard; focus moves into the viewer and back', async ({ page }) => {
  await page.goto('');
  const first = page.locator('.gallery .zoom').first();
  await first.focus();
  await page.keyboard.press('Enter');
  const box = page.locator('#lightbox');
  await expect(box).toBeVisible();
  const n = await page.locator('.gallery .zoom').count();
  await expect(page.locator('#lb-count')).toHaveText(`1 / ${n}`);
  await expect(page.locator('[data-lb-close]')).toBeFocused();
  // Tab stays inside the dialog
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#lightbox'))).toBe(true);
  }
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lb-count')).toHaveText(`2 / ${n}`);
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
  // focus returns to the photo that is now shown (the second one)
  await expect(page.locator('.gallery .zoom').nth(1)).toBeFocused();
  expect(await page.evaluate(() => document.getElementById('app').inert)).toBe(false);
});

test('carousel pause button stops the slideshow', async ({ page }) => {
  await page.goto('');
  const pause = page.locator('[data-pause]');
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(0, 0); // not hovering, so only the button holds it
  const before = await page.locator('.slide.on').getAttribute('data-slide');
  await page.waitForTimeout(6500);
  await expect(page.locator('.slide.on')).toHaveAttribute('data-slide', before);
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the carousel starts paused and never advances by itself', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('[data-pause]')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(6500);
    await expect(page.locator('.slide.on')).toHaveAttribute('data-slide', '0');
    await expect(page.locator('.hero-title')).toBeVisible();
  });
});

async function swipe(page, locator, dx) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  const y = b.y + b.height / 2, x = b.x + b.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
}

test('swipe changes photos in the carousel and in the viewer', async ({ page }) => {
  await page.goto('');
  const carousel = page.locator('[data-carousel]');
  // wait until the hero has finished its entrance animation
  await page.waitForFunction(() => { const c = document.querySelector('[data-carousel]'); return getComputedStyle(c).opacity === '1' && !c.style.transform; });
  await page.locator('[data-pause]').click();
  await swipe(page, carousel, -160);
  await expect(page.locator('.slide.on')).toHaveAttribute('data-slide', '1');
  await expect(page.locator('#lightbox')).toBeHidden(); // a swipe is not a tap
  await swipe(page, carousel, 160);
  await expect(page.locator('.slide.on')).toHaveAttribute('data-slide', '0');

  await page.locator('.gallery .zoom').first().click();
  await expect(page.locator('#lb-count')).toHaveText(/^1 \//);
  await swipe(page, page.locator('#lb-img'), -160);
  await expect(page.locator('#lb-count')).toHaveText(/^2 \//);
  await expect(page.locator('#lightbox')).toBeVisible();
});

test('forced dark mode (Chrome "auto dark mode") keeps the page light', async () => {
  const browser = await chromium.launch({ args: ['--enable-features=WebContentsForceDark', '--force-dark-mode', '--blink-settings=forceDarkModeEnabled=true'] });
  const page = await browser.newPage({ colorScheme: 'dark', viewport: { width: 390, height: 740 } });
  await page.goto(test.info().project.use.baseURL);
  await page.waitForTimeout(800);
  const { data } = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
  const i = (300 * 390 + 8) * 3; // a pixel of plain page background near the left edge
  expect(data[i], 'background must stay light').toBeGreaterThan(200);
  await browser.close();
});

test('all internal links and #anchors lead somewhere', async ({ page, request }) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    const { hashes, urls } = await page.evaluate(() => {
      const hashes = [], urls = new Set();
      for (const a of document.querySelectorAll('a[href]')) {
        const u = new URL(a.href);
        if (u.origin !== location.origin) continue;
        if (u.pathname === location.pathname && u.hash) hashes.push(u.hash.slice(1));
        else urls.add(u.pathname);
      }
      return { hashes, urls: [...urls] };
    });
    for (const id of hashes) expect(await page.locator(`[id="${id}"]`).count(), `#${id} on ${path || '/'}`).toBe(1);
    for (const u of urls) expect((await request.get(u)).status(), u).toBe(200);
  }
});

test('404 page is styled even at a deep address', async ({ page }) => {
  const res = await page.goto('some/deep/missing/page');
  expect(res.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Tady stezka končí');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(245, 234, 216)');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)).toContain('Young Serif');
});

test('sitemap and robots.txt list both languages', async ({ request }) => {
  const robots = await request.get('robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m);
  const map = await request.get('sitemap.xml');
  expect(map.status()).toBe(200);
  const xml = await map.text();
  expect(xml).toMatch(/<loc>https:\/\/\S+\/<\/loc>/);
  expect(xml).toMatch(/<loc>https:\/\/\S+\/en\/<\/loc>/);
  expect(xml.match(/hreflang="(cs|en|x-default)"/g)).toHaveLength(6);
});

test('photo files are named by content hash (so a replaced photo is never served stale)', async ({ page }) => {
  await page.goto('');
  const src = await page.locator('.gallery img').first().getAttribute('src');
  expect(src).toMatch(/\/img\/[\w-]+-[\w-]{6,}-\d+\.jpeg$/);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  test('the photo viewer loads a size that fits the screen, not the largest one', async ({ page }) => {
    await page.goto('');
    await page.locator('.gallery .zoom').first().tap();
    await expect(page.locator('#lightbox')).toBeVisible();
    // 390px × 2 = 780 device pixels → the 800px version
    await expect(page.locator('#lb-img')).toHaveAttribute('src', /-800\.webp$/);
  });
});

test('gallery is grouped by day and its count matches the photos', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.gallery-day')).toHaveCount(4);
  await expect(page.locator('.gallery-day-title').first()).toContainText('Den 1');
  const n = await page.locator('.gallery .zoom').count();
  await expect(page.locator('.gallery-head p')).toContainText(`${n} fotek`);
});

test('day 3 drone video: file and poster load, it plays on screen and the button pauses it', async ({ page, request }) => {
  await page.goto('');
  const vid = page.locator('#den-3 [data-video]');
  await expect(vid).toHaveCount(1);
  expect((await request.get(await vid.locator('source').getAttribute('src'))).status()).toBe(200);
  await vid.scrollIntoViewIfNeeded();
  await expect(vid).toHaveAttribute('poster', /\/img\//);
  expect((await request.get(await vid.getAttribute('poster'))).status()).toBe(200);
  await expect.poll(() => vid.evaluate(v => v.paused)).toBe(false);
  const btn = page.locator('[data-video-toggle]');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  await expect.poll(() => vid.evaluate(v => v.paused)).toBe(true);
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
});

test('heavy parts wait: hero photos 2–5 until the page has loaded, the map and video poster until scrolled near', async ({ page, request }) => {
  const html = await (await request.get('')).text();
  const slides = (html.match(/data-slide="\d+"/g) || []).length;
  expect((html.match(/<template data-slide-img>/g) || []).length).toBe(slides - 1);
  await page.goto('', { waitUntil: 'domcontentloaded' });
  const map = page.locator('.route-map > iframe');
  await expect(map).not.toHaveAttribute('src', /./);
  await expect(page.locator('[data-video]')).not.toHaveAttribute('poster', /./);
  await expect(page.locator('[data-carousel] img')).toHaveCount(slides); // woken after load
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute('src', /google/);
});

test.describe('video with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('does not start by itself', async ({ page }) => {
    await page.goto('');
    const vid = page.locator('[data-video]');
    await vid.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(await vid.evaluate(v => v.paused)).toBe(true);
    await expect(page.locator('[data-video-toggle]')).toHaveAttribute('aria-pressed', 'true');
  });
});
