// Prepares photos and videos from a folder for the site (macOS: uses the built-in sips and Swift/AVFoundation).
//
//   npm run media -- path/to/folder
//
// Photos → src/assets/photos/gallery/den<N>-<HHMM>.jpg: auto-rotated, max 1800 px, metadata stripped.
//          The day comes from the capture date (EXIF, or a date in the file name).
// Videos → src/assets/video/den<N>-dron.mp4 (H.264 1080p at 4 Mbps; 720p if that's over 15 MB) plus a poster
//          frame src/assets/photos/den<N>-dron-poster.jpg.
// Afterwards the whole folder is moved to _originals/ (not published) and new gallery.json entries are
// printed: paste them into src/_data/gallery.json and write the captions.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const FIRST_DAY = new Date(2026, 7, 27); // 27 Aug 2026 = day 1
const MAX_VIDEO_MB = 15;
const PHOTOS = 'src/assets/photos/gallery';
const VIDEOS = 'src/assets/video';
const POSTERS = 'src/assets/photos';

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) { console.error('Usage: npm run media -- <folder>'); process.exit(1); }
fs.mkdirSync(PHOTOS, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });

// capture time: EXIF (via sips), else yyyymmdd_hhmmss in the file name
function takenAt(file) {
  try {
    const out = execFileSync('sips', ['-g', 'creation', file], { encoding: 'utf8' });
    const m = out.match(/creation: (\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/);
    if (m) return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
  } catch (e) { /* not an image sips can read */ }
  const m = path.basename(file).match(/(20\d\d)(\d\d)(\d\d)_(\d\d)(\d\d)/);
  if (m) return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
  throw new Error(`No capture date for ${file}`);
}
const dayOf = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - FIRST_DAY) / 864e5) + 1;
const hhmm = d => String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
const mb = f => (fs.statSync(f).size / 1048576).toFixed(1) + ' MB';

const files = fs.readdirSync(dir).filter(f => !f.startsWith('.')).map(f => path.join(dir, f));
const photos = files.filter(f => /\.(jpe?g|png|heic|webp)$/i.test(f));
const videos = files.filter(f => /\.(mp4|mov|m4v)$/i.test(f));

// ── photos ──
const entries = [];
for (const file of photos.map(f => ({ f, t: takenAt(f) })).sort((a, b) => a.t - b.t)) {
  let name = `den${dayOf(file.t)}-${hhmm(file.t)}`;
  let n = 2;
  while (entries.some(e => e.src === `gallery/${name}.jpg`)) name = `den${dayOf(file.t)}-${hhmm(file.t)}-${n++}`;
  const out = path.join(PHOTOS, name + '.jpg');
  await sharp(file.f).rotate().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  entries.push({ src: `gallery/${name}.jpg`, day: dayOf(file.t) });
  console.log(`photo  ${path.basename(file.f)} → ${out} (${mb(out)})`);
}

// ── videos ── (tools/encode-video.swift: H.264 via macOS's own encoder, with a sensible bitrate)
const swift = (...a) => execFileSync('swift', ['tools/encode-video.swift', ...a], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
for (const file of videos) {
  const name = `den${dayOf(takenAt(file))}-dron`;
  const out = path.join(VIDEOS, name + '.mp4');
  console.log(swift('video', file, out, '1920', '4'));
  if (fs.statSync(out).size / 1048576 > MAX_VIDEO_MB) console.log(swift('video', file, out, '1280', '2.5'));
  const poster = path.join(POSTERS, name + '-poster.jpg');
  const tmp = path.join(os.tmpdir(), name + '-frame.jpg');
  swift('frame', out, tmp, '0.15');
  await sharp(tmp).jpeg({ quality: 82, mozjpeg: true }).toFile(poster);
  fs.rmSync(tmp, { force: true });
  console.log(`poster → ${poster} (${mb(poster)})`);
}

// ── keep the originals out of the published site ──
const keep = path.join('_originals', path.basename(path.resolve(dir)));
fs.mkdirSync('_originals', { recursive: true });
fs.renameSync(dir, keep);
console.log(`\nOriginals moved to ${keep}`);

// alternating tilt + tape colour, like the existing polaroids
const TILT = [-2.5, 1.8, -1.2, 2.6, -1.8, 1.1, -2.2, 2.2, -0.8, 1.6, -2.8, 1.3];
const TAPE = ['color-accent-200', 'color-accent-2-300', 'color-neutral-300'];
console.log('\nNew gallery.json entries (add captions and descriptions):');
console.log(JSON.stringify(entries.map((e, i) => ({
  ...e, caption: { cs: '', en: '' }, alt: { cs: '', en: '' },
  rotate: TILT[i % TILT.length], tape: { rotate: i % 2 ? 4 : -5, color: TAPE[i % 3] }
})), null, 2));
