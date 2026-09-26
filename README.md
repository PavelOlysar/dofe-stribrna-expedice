# Naše stříbrná DofE expedice

Bilingual (Czech / English) one-page story of our Silver-level Duke of Edinburgh's Award expedition:
four days on foot from Nová Bystřice to Vysočany via Landštejn, Slavonice and the Austrian border
(27–30 August 2026, 82.9 km).

Designed in Claude Design and implemented as a plain static site: no build step, no dependencies.

## Run locally

Open `index.html` in a browser, or serve the folder (recommended, so everything behaves as online):

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy

Any static host works: upload the folder as it is.

- **GitHub Pages:** repo *Settings → Pages → Deploy from a branch → `main` / root*.
  `404.html` is picked up automatically.
- **Netlify / Vercel / Cloudflare Pages:** no build command, publish directory `/`.

After the site has its final address, update the social-preview tags in `index.html`
(`og:image` must be an absolute URL, and add `og:url`) so link previews show the photo.

## Structure

| File | What it is |
| --- | --- |
| `index.html` | The whole page. Every text exists twice: `<span data-l="cs">` and `<span data-l="en">`. |
| `styles.css` | Design-system tokens and base components (colours, type, buttons, tags). |
| `page.css` | Page-specific styles: language switch, carousel, day cards, Keen card, signpost, tracker… |
| `hover.css` | Hover effects carried over from the design. |
| `script.js` | Language switch, hero carousel, lightbox, scroll progress / active nav, reveal animations, trail tracker, signpost tilt. |
| `404.html` | "Lost the trail" page. |
| `assets/` | Logos, icons, social preview image and `photos/` (resized to max 1800 px, metadata stripped). |

### Editing text

Find the sentence in `index.html` and change both language versions. The language choice is remembered
in the visitor's browser (`localStorage`, key `expedice-lang`).

### Adding or replacing photos

Keep the same file names in `assets/photos/`, or update the `src` in `index.html`.
Resize large phone photos first (max ~1800 px on the long edge, JPEG quality ~80) to keep the page fast.

## Credits

Text and photos © the expedition members. DofE and KEEN logos belong to their respective owners
and are used only to refer to the programme and the challenge.
