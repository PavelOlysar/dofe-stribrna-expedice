// Expedition story page: language switch, hero carousel, lightbox, scroll progress,
// active nav and reveal-on-scroll animations. Ported from the Claude Design component.
(() => {
  'use strict';
  const root = document.getElementById('app');
  const $ = (sel, el = root) => el.querySelector(sel);
  const $$ = (sel, el = root) => [...el.querySelectorAll(sel)];
  const motionOn = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Language ─────────────────────────────────────────────── */
  const setLang = lang => {
    try { localStorage.setItem('expedice-lang', lang); } catch (e) {}
    document.documentElement.lang = lang;
    $$('[data-set-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
    $$('[data-aria-cs]').forEach(el => el.setAttribute('aria-label', el.dataset['aria' + (lang === 'en' ? 'En' : 'Cs')]));
    $$('[data-title-cs]').forEach(el => el.setAttribute('title', el.dataset['title' + (lang === 'en' ? 'En' : 'Cs')]));
    $$('[data-alt-cs]').forEach(el => el.setAttribute('alt', el.dataset['alt' + (lang === 'en' ? 'En' : 'Cs')]));
  };
  $$('[data-set-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.setLang)));
  setLang(document.documentElement.lang === 'en' ? 'en' : 'cs');

  /* ── Mobile menu (hamburger, ≤960px) ─────────────────────── */
  const nav = $('[data-site-nav]');
  const navToggle = $('.nav-toggle', nav);
  const setMenu = open => {
    nav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.dataset.ariaCs = open ? 'Zavřít menu' : 'Otevřít menu';
    navToggle.dataset.ariaEn = open ? 'Close menu' : 'Open menu';
    navToggle.setAttribute('aria-label', document.documentElement.lang === 'en' ? navToggle.dataset.ariaEn : navToggle.dataset.ariaCs);
  };
  navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  $$('.nav-links a', nav).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', e => { if (nav.classList.contains('open') && !nav.contains(e.target)) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); navToggle.focus(); } });
  matchMedia('(min-width: 961px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  /* ── Missing photos: show the design's placeholder caption instead of a broken image ── */
  const onMissing = img => {
    if (img.classList.contains('slot')) {
      const ph = document.createElement('div');
      ph.className = 'slot-ph' + (img.classList.contains('circle') ? ' circle' : '');
      ph.textContent = img.dataset.ph;
      img.replaceWith(ph);
    } else if (img.hasAttribute('data-gimg')) {
      const card = img.closest('[data-gcard]'); if (card) card.parentElement.hidden = true;
    }
  };
  $$('img.slot, img[data-gimg]').forEach(img => {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) onMissing(img);
    else img.addEventListener('error', () => onMissing(img), { once: true });
  });
  const hasImg = img => !!(img && img.isConnected && img.naturalWidth > 0);

  /* ── Hero carousel ────────────────────────────────────────── */
  const slides = $$('[data-slide]');
  let slide = 0, anim = null, paused = false, lb = null;
  const render = () => {
    slides.forEach((s, i) => s.classList.toggle('on', i === slide));
    $$('[data-fill]').forEach((f, i) => { f.style.transform = i < slide ? 'scaleX(1)' : 'scaleX(0)'; });
  };
  const startAuto = () => {
    anim && anim.cancel();
    const el = $(`[data-fill="${slide}"]`); if (!el) return;
    anim = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 5000, fill: 'forwards' });
    anim.onfinish = () => goTo(slide + 1);
    if (paused || lb != null) anim.pause();
  };
  const goTo = i => { const n = slides.length; slide = (i + n) % n; render(); startAuto(); };
  $$('[data-go]').forEach(b => b.addEventListener('click', () => goTo(+b.dataset.go)));
  $('[data-prev]').addEventListener('click', () => goTo(slide - 1));
  $('[data-next]').addEventListener('click', () => goTo(slide + 1));
  const carousel = $('[data-carousel]');
  carousel.addEventListener('mouseenter', () => { paused = true; anim && anim.pause(); });
  carousel.addEventListener('mouseleave', () => { paused = false; if (anim && lb == null) anim.play(); });

  /* ── Hero signpost: leans slightly toward the mouse, only when it's close ── */
  const spTilt = $('[data-sp-tilt]');
  const header = $('header');
  if (spTilt && motionOn && matchMedia('(hover: hover)').matches) {
    const RANGE = 160, MAX_DEG = 2.5;
    header.addEventListener('mousemove', e => {
      const r = spTilt.getBoundingClientRect();
      const gapX = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const gapY = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const near = Math.max(0, 1 - Math.hypot(gapX, gapY) / RANGE);
      const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      spTilt.style.transform = near ? `rotate(${dx * MAX_DEG * near}deg)` : '';
    });
    header.addEventListener('mouseleave', () => { spTilt.style.transform = ''; });
  }

  /* ── Lightbox ─────────────────────────────────────────────── */
  const ov = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCount = document.getElementById('lb-count');
  let items = [], from = null, closing = false;
  const flip = (a, b) => `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${Math.max(a.width / b.width, a.height / b.height)})`;
  const showCurrent = () => {
    lbImg.src = items[lb].getAttribute('src');
    lbCount.textContent = `${lb + 1} / ${items.length}`;
  };
  const openLb = (img, group) => {
    items = group === 'gallery' ? $$('[data-gimg]').filter(hasImg) : $$('img.slot').filter(hasImg);
    const idx = items.indexOf(img); if (idx < 0) return;
    from = img.getBoundingClientRect();
    lb = idx;
    $$('[data-lb-prev],[data-lb-next]', ov).forEach(b => { b.hidden = items.length < 2; });
    ov.hidden = false;
    showCurrent();
    document.documentElement.style.overflow = 'hidden';
    anim && anim.pause();
    if (!motionOn) return;
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    lbImg.style.opacity = '0';
    (lbImg.decode ? lbImg.decode() : Promise.resolve()).catch(() => {}).then(() => {
      lbImg.style.opacity = '';
      const f = lbImg.getBoundingClientRect();
      lbImg.animate([{ transform: flip(from, f), borderRadius: '28px' }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.25,1.05)' });
    });
  };
  const closeLb = () => {
    if (closing || lb == null) return;
    const done = () => {
      closing = false; lb = null; ov.hidden = true;
      ov.getAnimations().forEach(a => a.cancel()); lbImg.getAnimations().forEach(a => a.cancel());
      document.documentElement.style.overflow = '';
      if (!paused && anim) anim.play();
    };
    if (!motionOn) return done();
    closing = true;
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });
    const r = items[lb].getBoundingClientRect(), f = lbImg.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.top < innerHeight;
    lbImg.animate([{ transform: 'none' }, { transform: onScreen ? flip(r, f) : 'scale(.9)', opacity: onScreen ? 1 : 0 }], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    setTimeout(done, 320);
  };
  const stepLb = d => {
    const n = items.length; lb = (lb + d + n) % n; showCurrent();
    motionOn && lbImg.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' });
  };
  ov.addEventListener('click', closeLb);
  lbImg.addEventListener('click', e => e.stopPropagation());
  $('[data-lb-close]', ov).addEventListener('click', e => { e.stopPropagation(); closeLb(); });
  $('[data-lb-prev]', ov).addEventListener('click', e => { e.stopPropagation(); stepLb(-1); });
  $('[data-lb-next]', ov).addEventListener('click', e => { e.stopPropagation(); stepLb(1); });
  addEventListener('keydown', e => {
    if (lb == null) return;
    if (e.key === 'Escape') closeLb();
    else if (e.key === 'ArrowRight') stepLb(1);
    else if (e.key === 'ArrowLeft') stepLb(-1);
  });
  root.addEventListener('click', e => {
    if (ov.contains(e.target)) return;
    const card = e.target.closest('[data-gcard]');
    if (card) { const gi = $('[data-gimg]', card); if (hasImg(gi)) { e.preventDefault(); openLb(gi, 'gallery'); } return; }
    const img = e.target.closest('img.slot');
    if (hasImg(img)) { e.preventDefault(); openLb(img); }
  });
  root.addEventListener('pointerover', e => {
    const img = e.target.closest && e.target.closest('img.slot');
    if (img) img.style.cursor = hasImg(img) ? 'zoom-in' : '';
  });

  /* ── Scroll: progress bar, parallax, active nav ───────────── */
  let parallax = false;
  const bar = $('[data-progress]');
  const links = $$('[data-nav]');
  const sections = links.map(l => document.getElementById(l.dataset.nav));
  let raf = 0;
  const tick = () => {
    raf = 0;
    const se = document.scrollingElement || document.documentElement;
    const max = se.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, se.scrollTop / max) : 0})`;
    if (parallax) $$('[data-parallax]').forEach(el => { el.style.transform = `translateY(${se.scrollTop * parseFloat(el.dataset.parallax)}px)`; });
    let active = null;
    links.forEach((l, i) => { const s = sections[i]; if (s && s.getBoundingClientRect().top < 160) active = l; });
    links.forEach(l => {
      l.style.background = l === active ? 'var(--color-accent-200)' : '';
      l.style.color = l === active ? 'var(--color-accent-900)' : 'var(--color-text)';
    });
    trail();
  };

  /* ── Trail tracker: km "walked" while reading the four days ── */
  const pill = $('[data-trail-pill]');
  const DAY_KM = [18.9, 26.7, 24.2, 13.1], TOTAL = 82.9;
  const phone = matchMedia('(max-width: 560px)');
  let pillTimer = 0;
  const daySecs = DAY_KM.map((_, i) => document.getElementById(`den-${i + 1}`));
  const trail = () => {
    if (!pill || !daySecs[0]) return;
    const mid = innerHeight * 0.5;
    const first = daySecs[0].getBoundingClientRect(), last = daySecs[3].getBoundingClientRect();
    const inDays = first.top < mid && last.bottom > mid * 0.6;
    if (!phone.matches) pill.classList.toggle('on', inDays);
    else {
      // phones: show only while scrolling, then fade out so it never covers the text being read
      pill.classList.toggle('on', inDays);
      clearTimeout(pillTimer);
      if (inDays) pillTimer = setTimeout(() => pill.classList.remove('on'), 1200);
    }
    let km = 0, day = 1;
    daySecs.forEach((sec, i) => {
      const r = sec.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      km += DAY_KM[i] * p;
      if (r.top < mid) day = i + 1;
    });
    const en = document.documentElement.lang === 'en';
    $('[data-tp-day]', pill).textContent = day;
    $('[data-tp-km]', pill).textContent = en ? km.toFixed(1) : km.toFixed(1).replace('.', ',');
    const pct = (km / TOTAL) * 100 + '%';
    $('[data-tp-fill]', pill).style.width = pct;
    $('[data-tp-dot]', pill).style.left = pct;
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* ── Reveal-on-scroll ─────────────────────────────────────── */
  const setupReveal = () => {
    const FROM = { up: 'translateY(32px)', left: 'translateX(-32px)', pop: 'scale(.9) rotate(-2deg)', tilt: 'translateY(48px) rotate(3deg)', img: 'translateY(40px) scale(.94)', word: 'translateY(.55em) rotate(8deg)' };
    const EASE = 'cubic-bezier(.34,1.56,.64,1)';
    const els = $$('[data-reveal]');
    els.forEach(el => { el._d = +(el.dataset.delay || 0); });
    $$('[data-stagger]').forEach(g => {
      $$('[data-reveal]', g).filter(c => c.parentElement.closest('[data-stagger]') === g || c.closest('[data-stagger]') === g)
        .forEach((c, i) => { c._d += i * 120; });
    });
    const hide = (el, tf) => { el._t = el.style.transition; el.style.transition = 'none'; el.style.opacity = '0'; el.style.transform = tf; };
    els.forEach(el => {
      hide(el, FROM[el.dataset.reveal] || FROM.up);
      $$('[data-stop]', el).forEach(s => hide(s, 'translateX(-14px)'));
      $$('[data-line]', el).forEach(s => hide(s, 'scaleY(0)'));
      $$('[data-count]', el).forEach(c => { c._orig = c.firstChild && c.firstChild.nodeValue; if (c.firstChild) c.firstChild.nodeValue = '0'; });
    });
    const play = (el, d, dur = 900) => {
      el.style.transition = `opacity .6s ease ${d}ms, transform ${dur}ms ${EASE} ${d}ms`;
      el.style.opacity = ''; el.style.transform = '';
      setTimeout(() => { el.style.transition = el._t || ''; }, d + dur + 50);
    };
    const count = (c, d) => {
      const target = parseFloat(c.dataset.count), dec = +(c.dataset.dec || 0), t0 = performance.now() + d, dur = 1300;
      const step = now => {
        if (!c.firstChild) return;
        const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
        c.firstChild.nodeValue = p >= 1 ? c._orig : (target * e).toFixed(dec).replace('.', ',');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const show = el => {
      const d = el._d;
      play(el, d);
      $$('[data-note-text]', el).forEach(t => t.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 500, delay: d + 350, easing: 'ease-out', fill: 'backwards' }));
      $$('[data-draw]', el).forEach((p, i) => {
        const L = p.getTotalLength(); p.style.strokeDasharray = L;
        p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: i % 2 ? 200 : 650, delay: d + 550 + (i % 2 ? 640 : 0), easing: 'cubic-bezier(.5,0,.3,1)', fill: 'backwards' });
      });
      $$('[data-line]', el).forEach(s => play(s, d + 150, 800));
      $$('[data-stop]', el).forEach((s, i) => play(s, d + 250 + i * 130, 700));
      $$('[data-count]', el).forEach(c => count(c, d + 100));
    };
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { io.unobserve(en.target); show(en.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    const header = $('header');
    const heroVisible = header && header.getBoundingClientRect().top < innerHeight;
    requestAnimationFrame(() => els.forEach(el => {
      if (heroVisible && el.hasAttribute('data-hero') && header.contains(el)) show(el);
      else io.observe(el);
    }));
    parallax = true; onScroll();
  };

  const playIntroExtras = () => {
    const reveal = (el, frames, opts) => {
      if (!el) return;
      const a = el.animate(frames, { fill: 'both', ...opts });
      a.onfinish = () => { el.style.opacity = ''; a.cancel(); };
    };
    $$('[data-parallax]').forEach((el, i) => reveal(el,
      [{ opacity: 0, scale: '.6' }, { opacity: 1, scale: '1' }],
      { duration: 1400, delay: 150 + i * 220, easing: 'cubic-bezier(.34,1.4,.64,1)' }));
    reveal($('[data-badge]'), [
      { opacity: 0, transform: 'scale(.3) rotate(-70deg)' },
      { opacity: 1, transform: 'scale(1.1) rotate(8deg)', offset: .65 },
      { opacity: 1, transform: 'scale(.97) rotate(-2deg)', offset: .85 },
      { opacity: 1, transform: 'scale(1) rotate(0deg)' }
    ], { duration: 820, delay: 1300, easing: 'cubic-bezier(.3,.7,.4,1)' });
  };

  /* ── Boot ─────────────────────────────────────────────────── */
  render();
  tick();
  $$('[data-set-lang]').forEach(b => b.addEventListener('click', onScroll)); // refresh km decimal separator
  if (motionOn) { setupReveal(); playIntroExtras(); }
  else $$('[data-hero]').forEach(el => { el.style.opacity = ''; });
  setTimeout(startAuto, motionOn ? 1500 : 0);
})();
