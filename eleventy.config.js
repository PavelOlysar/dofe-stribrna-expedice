import { HtmlBasePlugin } from '@11ty/eleventy';
import Image from '@11ty/eleventy-img';
import path from 'node:path';

const PHOTOS = 'src/assets/photos/';

// Responsive photo: AVIF + WebP + JPEG at up to four widths (never upscaled)
async function photoMeta(file) {
  return Image(PHOTOS + file, {
    widths: [480, 800, 1200, 1800],
    formats: ['avif', 'webp', 'jpeg'],
    outputDir: '_site/img/',
    urlPath: '/img/',
    // the id is a hash of the photo's content: a replaced photo gets new file names, so no stale caches
    filenameFormat: (id, src, width, format) => `${path.parse(src).name}-${id}-${width}.${format}`,
    sharpAvifOptions: { quality: 55 },
    sharpWebpOptions: { quality: 72 },
    sharpJpegOptions: { quality: 78, mozjpeg: true }
  });
}

export default function (config) {
  config.addPlugin(HtmlBasePlugin);

  config.addPassthroughCopy({ 'src/assets/fonts': 'assets/fonts', 'src/assets/video': 'assets/video' });
  config.addPassthroughCopy({ 'src/assets/*.{png,svg,jpg,webp}': 'assets' });
  config.addPassthroughCopy({ 'src/css': 'css', 'src/js': 'js' });
  // cache rules for Cloudflare (ignored by other hosts)
  config.addPassthroughCopy({ 'src/_headers': '_headers' });
  config.addWatchTarget('src/css/');
  config.addWatchTarget('src/js/');

  // {cs, en} object → the string for this page's language (plain values pass through)
  config.addFilter('t', (v, lang) => (v && typeof v === 'object' && ('cs' in v || 'en' in v)) ? v[lang] : v);
  // 18.9 → "18,9" in Czech, "18.9" in English
  config.addFilter('num', (n, lang, dec = 1) => {
    const s = Number(n).toFixed(dec);
    return lang === 'cs' ? s.replace('.', ',') : s;
  });
  // Day boundaries on the trail pill, as % of the total distance
  config.addFilter('trailMarks', days => {
    const total = days.reduce((s, d) => s + d.km, 0);
    let run = 0;
    return days.slice(0, -1).map(d => ((run += d.km) / total * 100).toFixed(1));
  });
  // gallery photos of one day
  config.addFilter('byDay', (photos, n) => photos.filter(p => p.day === n));
  config.addFilter('fmt', (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k]));

  // Stories live in src/content/<lang>/<name>.md
  config.addCollection('stories', api => {
    const out = { cs: {}, en: {} };
    for (const item of api.getFilteredByGlob('./src/content/**/*.md')) {
      const lang = item.filePathStem.split('/').at(-2);
      out[lang][item.fileSlug] = item;
    }
    return out;
  });

  // A day's story is split at its marker line (<!-- fotky --> or <!-- keen -->):
  // the first part sits next to the "at a glance" card, the rest comes after the photos / Keen card.
  config.addFilter('storyParts', html => {
    const [before, after = ''] = String(html).split(/<!--\s*(?:fotky|keen)\s*-->/);
    return { before, after };
  });

  // <picture> for a photo. opts: { sizes, cls, loading, fetchpriority }
  config.addShortcode('photo', async (file, alt, opts = {}) => {
    const meta = await photoMeta(file);
    return Image.generateHTML(meta, {
      alt,
      sizes: opts.sizes || '100vw',
      class: opts.cls || undefined,
      loading: opts.loading || 'lazy',
      decoding: 'async',
      fetchpriority: opts.fetchpriority || undefined
    });
  });
  // URL of a photo at ~1200 px, for places that take a single URL (the <video> poster, set by script.js).
  // It lands in a data- attribute, which HtmlBasePlugin doesn't rewrite, so add the prefix here
  config.addShortcode('photoUrl', async file => {
    const meta = await photoMeta(file);
    const prefix = (process.env.PATH_PREFIX || '/').replace(/\/$/, '');
    return prefix + (meta.jpeg.find(m => m.width >= 1200) || meta.jpeg.at(-1)).url;
  });
  // Preload hint for the first hero photo
  config.addShortcode('photoPreload', async (file, sizes) => {
    const meta = await photoMeta(file);
    // imagesrcset isn't one of the attributes HtmlBasePlugin rewrites, so add the prefix here
    const prefix = (process.env.PATH_PREFIX || '/').replace(/\/$/, '');
    const set = meta.avif.map(m => prefix + m.srcset).join(', ');
    return `<link rel="preload" as="image" type="image/avif" imagesrcset="${set}" imagesizes="${sizes}" fetchpriority="high">`;
  });

  return {
    dir: { input: 'src', includes: '_includes', data: '_data', output: '_site' },
    pathPrefix: process.env.PATH_PREFIX || '/',
    templateFormats: ['njk', 'md'],
    markdownTemplateEngine: false,
    htmlTemplateEngine: 'njk'
  };
}
