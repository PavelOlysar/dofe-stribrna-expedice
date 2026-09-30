# Naše stříbrná DOFE expedice

Bilingual (Czech / English) one-page story of our Silver-level Duke of Edinburgh's Award (DOFE) expedition:
four days on foot from Nová Bystřice to Vysočany via Landštejn, Slavonice and the Austrian border
(27–30 August 2026, 82.9 km).

Designed in Claude Design and built as a static site with [Eleventy](https://www.11ty.dev/).
Czech lives at `/`, English at `/en/`.

## Editing text

Every story is a plain Markdown file, one per language:

| File | What it is |
| --- | --- |
| `src/content/cs/uvod.md` · `src/content/en/uvod.md` | The intro before Day 1 |
| `src/content/cs/den-1.md` … `den-4.md` (and `en/`) | The four days. `title:` at the top is the day's heading. |
| `src/content/cs/keen.md` (and `en/`) | The Keen Challenge card: title, task, button, photo caption, and the story as the text |
| `src/content/cs/zaver.md` (and `en/`) | The closing card: kicker, the quote, sign-off |

Inside a day file:

- Paragraphs are separated by an empty line.
- The line `<!-- fotky -->` (or `<!-- keen -->` on Day 3) marks where the photo pair (or the Keen card) goes.
  Text above it sits next to the "Den N v kostce" card; text below it comes after the photos.
- Glossary words with a tooltip are written like
  `<span class="term" tabindex="0" data-tip="The explanation">word</span>`.

Short texts that aren't stories (navigation, buttons, stats, the route cards, "v kostce" rows, photo notes,
gallery captions, photo descriptions) are in `src/_data/`:

| File | Contents |
| --- | --- |
| `i18n.json` | Navigation, buttons, labels, page title and description, stats |
| `days.json` | Per day: km, trail colour, route-card stops, "v kostce" rows, photo pair with handwritten notes, the day 3 video |
| `gallery.json` | The gallery photos: file, day, caption, description, tilt, tape colour |
| `slides.json` | The hero slideshow photos and their descriptions |
| `signpost.json` | The signpost arrows in the hero |
| `site.js` | Site address and the contact email in the footer |

Every text there has a `cs` and an `en` version: change both.

## Adding photos or a video

Put the new photos (and/or a video) in any folder, then run:

```sh
npm run media -- path/to/folder
```

This works on a Mac only, because it uses the built-in `sips` and Swift/AVFoundation. It:

- resizes each photo to 1800 px, strips its metadata (location, camera), and saves it as
  `src/assets/photos/gallery/den<N>-<HHMM>.jpg` (the day and time come from when it was taken);
- converts a video to a web MP4 (H.264, 1080p, about 13 MB per 25 s) in `src/assets/video/`,
  and saves a poster frame for it;
- moves the whole folder to `_originals/` (kept on your computer, never published);
- prints ready-made entries for `src/_data/gallery.json`. Paste them in and write each photo's
  `caption` (the handwritten text under the polaroid) and `alt` (a one-sentence description for
  screen readers), in `cs` and `en`.

The gallery groups photos by their `day`, and the count in "28 fotek z cesty" updates by itself.
The Day 3 drone video is set in `src/_data/days.json` (`video` on day 3).

The build makes every photo in several sizes (480–1800 px) and formats (AVIF, WebP, JPEG), so phones
download small versions.

## Run locally

Needs Node.js 20 or newer.

```sh
npm install          # once
npm run dev          # live preview at http://localhost:8080, reloads on every save
```

`npm run build` writes the finished site to `_site/`.

**Using VS Code's Live Server ("Go Live")?** The project folder itself has no `index.html` any more (the page is
built into `_site/`), so Live Server is set to serve `_site/` (`.vscode/settings.json`). Keep `npm run watch`
running in a terminal: it rebuilds `_site/` on every save, and Live Server reloads the page.

## Checks

```sh
npx playwright install chromium   # once
npm run check                     # build + HTML validation + browser tests
```

The tests (`tests/site.spec.js`) open the built site in Chromium and check:

- no sideways scrolling and no errors at widths from 320 to 1440 px, in both languages;
- forced dark mode on phones keeps the page light;
- the photo viewer works with the keyboard and moves focus correctly;
- the slideshow pause button works, and the animations, slideshow and video stay on even with the system's Reduce Motion;
- swiping works;
- all internal links resolve;
- the 404 page is styled.

## Deploy

The site is hosted on Cloudflare Workers at <https://dofe-stribrna-expedice.olysarp.workers.dev/>.
Cloudflare (Workers Builds) runs `npm run build` and publishes `_site/` on every push to `main`.
GitHub Actions (`.github/workflows/site.yml`) runs the checks on every push; it doesn't publish anything.

`src/_headers` sets how long browsers cache files (photos for a year, CSS for 10 minutes).

With a custom domain later, set `SITE_ORIGIN` in the Cloudflare build settings (see `src/_data/site.js`)
so link previews, canonical links and the sitemap use the new address.

## Structure

| Path | What it is |
| --- | --- |
| `src/index.njk` | The page; builds both `/` (cs) and `/en/` |
| `src/404.njk` · `src/sitemap.njk` · `src/robots.njk` | The 404 page, the sitemap for search engines, robots.txt |
| `src/_headers` | Cache rules for Cloudflare |
| `src/_includes/` | Layout and page sections (`partials/`: nav, hero, route, day, finale, gallery, footer…) |
| `src/css/styles.css` | Design-system tokens and base components (colours, type, buttons, tags) |
| `src/css/page.css` | Page styles, in page order |
| `src/js/script.js` | Inlined into the page by the build: menu, slideshow, photo viewer, scroll progress, trail tracker, reveal animations |
| `src/assets/` | Logos, icons, link-preview image, the paper grain tile, self-hosted fonts (`fonts/`) and `photos/` |
| `eleventy.config.js` | Build setup: photo sizes, language helpers |
| `tools/` | `prepare-media.mjs` (`npm run media`) and the video encoder it uses |
| `tests/` | Browser tests and a small static server for them |

## Credits

Text and photos © the expedition members. DOFE and KEEN logos belong to their respective owners
and are used only to refer to the programme and the challenge. Fonts (Figtree, Young Serif,
Delicious Handrawn) are under the SIL Open Font License; see `src/assets/fonts/`.
