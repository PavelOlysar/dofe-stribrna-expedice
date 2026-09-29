// Expedition story page: mobile menu, hero carousel, lightbox, scroll progress, active nav,
// trail tracker, the day-3 drone video and reveal-on-scroll animations. Each language has its own page,
// so this script never swaps texts, it only reads <html lang> for number formatting.
(() => {
  'use strict';
  const root = document.getElementById('app');
  const $ = (sel, el = root) => el.querySelector(sel);
  const $$ = (sel, el = root) => [...el.querySelectorAll(sel)];
  const lang = document.documentElement.lang;
  const dec = s => (lang === 'cs' ? String(s).replace('.', ',') : String(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // no Web Animations API (very old browsers) → behave as with reduced motion instead of crashing
  const motionOn = !reduceMotion && typeof Element.prototype.animate === 'function';
  // Safari < 14 only has the old addListener() on media queries
  const onMedia = (mq, fn) => mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn);
  // :focus-visible inside matches() throws on iOS 15.0–15.3
  const focusVisible = el => { try { return el.matches(':focus-visible'); } catch (e) { return false; } };

  // Horizontal swipe on an element (touch, pen or mouse drag). Returns a "was that a swipe?" check,
  // so the click that follows a swipe can be ignored.
  const onSwipe = (el, fn) => {
    let x0 = null, y0 = 0, swiped = false;
    el.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; swiped = false; });
    el.addEventListener('pointerup', e => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped = true; fn(dx < 0 ? 1 : -1); }
    });
    el.addEventListener('pointercancel', () => { x0 = null; });
    el.addEventListener('dragstart', e => e.preventDefault()); // a mouse drag on a photo would start a native image drag
    return () => { const s = swiped; swiped = false; return s; };
  };

  /* ── Mobile menu (hamburger, ≤960px) ─────────────────────── */
  const nav = $('[data-site-nav]');
  const navToggle = $('.nav-toggle', nav);
  const setMenu = open => {
    nav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? navToggle.dataset.labelClose : navToggle.dataset.labelOpen);
  };
  navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  $$('.nav-links a', nav).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', e => { if (nav.classList.contains('open') && !nav.contains(e.target)) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); navToggle.focus(); } });
  onMedia(matchMedia('(min-width: 961px)'), e => { if (e.matches) setMenu(false); });

  /* ── Hero carousel ────────────────────────────────────────── */
  // Auto-advances every 5 s unless: reduced motion is on (then it starts paused), the pause button
  // is pressed, the mouse is over it, keyboard focus is inside it, it's scrolled off screen,
  // the tab is hidden or the lightbox is open.
  const carousel = $('[data-carousel]');
  const slides = $$('[data-slide]', carousel);
  const pauseBtn = $('[data-pause]', carousel);
  let slide = 0, anim = null, lb = null;
  const hold = { user: reduceMotion, hover: false, focus: false, hidden: false, offscreen: false };
  const isHeld = () => hold.user || hold.hover || hold.focus || hold.hidden || hold.offscreen || lb != null;
  const applyHold = () => { if (anim) isHeld() ? anim.pause() : anim.play(); };
  const render = () => {
    slides.forEach((s, i) => {
      const on = i === slide;
      s.classList.toggle('on', on);
      if (on) { s.removeAttribute('aria-hidden'); s.inert = false; } else { s.setAttribute('aria-hidden', 'true'); s.inert = true; }
    });
    $$('[data-fill]', carousel).forEach((f, i) => { f.style.transform = i < slide ? 'scaleX(1)' : 'scaleX(0)'; });
  };
  const startAuto = () => {
    anim && anim.cancel();
    const el = $(`[data-fill="${slide}"]`, carousel);
    if (!el || !el.animate) return;
    anim = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 5000, fill: 'forwards' });
    anim.onfinish = () => goTo(slide + 1);
    applyHold();
  };
  const goTo = i => { const n = slides.length; slide = (i + n) % n; render(); startAuto(); };
  const setUserPause = p => {
    hold.user = p;
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.setAttribute('aria-label', p ? pauseBtn.dataset.labelPlay : pauseBtn.dataset.labelPause);
    applyHold();
  };
  pauseBtn.addEventListener('click', () => setUserPause(!hold.user));
  $$('[data-go]', carousel).forEach(b => b.addEventListener('click', () => goTo(+b.dataset.go)));
  $('[data-prev]', carousel).addEventListener('click', () => goTo(slide - 1));
  $('[data-next]', carousel).addEventListener('click', () => goTo(slide + 1));
  // mouse hover only: on touch screens a tap would otherwise pause it for good
  carousel.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hold.hover = true; applyHold(); } });
  carousel.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hold.hover = false; applyHold(); } });
  carousel.addEventListener('focusin', e => { hold.focus = focusVisible(e.target); applyHold(); });
  carousel.addEventListener('focusout', e => { if (!carousel.contains(e.relatedTarget)) { hold.focus = false; applyHold(); } });
  document.addEventListener('visibilitychange', () => { hold.hidden = document.hidden; applyHold(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { hold.offscreen = !en.isIntersecting; applyHold(); }).observe(carousel);
  const carouselSwiped = onSwipe(carousel, d => goTo(slide + d));
  if (reduceMotion) setUserPause(true);

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

  /* ── Lightbox (modal dialog) ──────────────────────────────── */
  const ov = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCount = document.getElementById('lb-count');
  const lbButtons = [...ov.querySelectorAll('button')];
  const behind = [root, document.querySelector('.skip-link')];
  let items = [], from = null, closing = false, opener = null;
  const imgOf = btn => btn.querySelector('img');
  // the size of a photo that fills this screen: the smallest WebP (or <img>) srcset entry at least as wide
  // as the screen in device pixels, or the largest one there is
  const fullSrc = img => {
    const src = img.closest('picture') && img.closest('picture').querySelector('source[type="image/webp"]');
    const set = (src && src.getAttribute('srcset')) || img.getAttribute('srcset');
    if (!set) return img.currentSrc || img.src;
    const sizes = set.split(',').map(c => { const [url, w] = c.trim().split(/\s+/); return { url, w: parseInt(w, 10) || 0 }; }).sort((a, b) => a.w - b.w);
    const need = innerWidth * (devicePixelRatio || 1);
    return (sizes.find(c => c.w >= need) || sizes[sizes.length - 1]).url;
  };
  const flip = (a, b) => `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${Math.max(a.width / b.width, a.height / b.height)})`;
  const showCurrent = () => {
    const img = imgOf(items[lb]);
    lbImg.src = fullSrc(img);
    lbImg.alt = img.alt;
    lbCount.textContent = `${lb + 1} / ${items.length}`;
  };
  const openLb = btn => {
    items = $$(`.zoom[data-group="${btn.dataset.group}"]`);
    const idx = items.indexOf(btn); if (idx < 0) return;
    opener = btn;
    from = imgOf(btn).getBoundingClientRect();
    lb = idx;
    ov.querySelectorAll('[data-lb-prev],[data-lb-next]').forEach(b => { b.hidden = items.length < 2; });
    ov.hidden = false;
    showCurrent();
    behind.forEach(el => { if (el) el.inert = true; });
    document.documentElement.style.overflow = 'hidden';
    applyHold();
    ov.querySelector('[data-lb-close]').focus({ preventScroll: true });
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
    const back = items[lb].closest('.slide[inert]') ? opener : items[lb]; // hidden carousel slides can't take focus
    const done = () => {
      closing = false; lb = null; ov.hidden = true;
      if (ov.getAnimations) { ov.getAnimations().forEach(a => a.cancel()); lbImg.getAnimations().forEach(a => a.cancel()); }
      behind.forEach(el => { if (el) el.inert = false; });
      document.documentElement.style.overflow = '';
      back.focus({ preventScroll: true });
      applyHold();
    };
    if (!motionOn) return done();
    closing = true;
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });
    const r = imgOf(items[lb]).getBoundingClientRect(), f = lbImg.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.top < innerHeight;
    lbImg.animate([{ transform: 'none' }, { transform: onScreen ? flip(r, f) : 'scale(.9)', opacity: onScreen ? 1 : 0 }], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    setTimeout(done, 320);
  };
  const stepLb = d => {
    if (lb == null || items.length < 2) return;
    const n = items.length; lb = (lb + d + n) % n; showCurrent();
    motionOn && lbImg.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' });
  };
  const lbSwiped = onSwipe(ov, stepLb);
  ov.addEventListener('click', e => { if (lbSwiped()) return; if (e.target === ov) closeLb(); });
  ov.querySelector('[data-lb-close]').addEventListener('click', closeLb);
  ov.querySelector('[data-lb-prev]').addEventListener('click', () => stepLb(-1));
  ov.querySelector('[data-lb-next]').addEventListener('click', () => stepLb(1));
  addEventListener('keydown', e => {
    if (lb == null) return;
    if (e.key === 'Escape') closeLb();
    else if (e.key === 'ArrowRight') stepLb(1);
    else if (e.key === 'ArrowLeft') stepLb(-1);
    else if (e.key === 'Tab') { // keep focus inside the dialog
      const f = lbButtons.filter(b => !b.hidden), i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  root.addEventListener('click', e => {
    // glossary terms: iOS doesn't focus a tapped span by itself, so the tooltip wouldn't show
    const term = e.target.closest('.term'); if (term) { term.focus(); return; }
    const zoom = e.target.closest('.zoom');
    if (!zoom) return;
    if (carousel.contains(zoom) && carouselSwiped()) return; // that was a swipe, not a tap
    openLb(zoom);
  });

  /* ── Drone video (day 3): plays silently while on screen ────── */
  // Not by itself with reduced motion or data-saver on; the button (or a tap on the video) plays/pauses.
  const vid = $('[data-video]');
  if (vid) {
    const btn = $('[data-video-toggle]');
    let held = reduceMotion || !!(navigator.connection && navigator.connection.saveData), inView = false;
    const sync = () => {
      btn.setAttribute('aria-pressed', String(vid.paused));
      btn.setAttribute('aria-label', vid.paused ? btn.dataset.labelPlay : btn.dataset.labelPause);
    };
    const play = () => { const p = vid.play(); if (p && p.catch) p.catch(sync); };
    const update = () => { if (inView && !held && !document.hidden) play(); else if (!vid.paused) vid.pause(); };
    const toggle = () => { held = !vid.paused; if (held) vid.pause(); else play(); };
    vid.addEventListener('play', sync);
    vid.addEventListener('pause', sync);
    btn.addEventListener('click', toggle);
    vid.addEventListener('click', toggle);
    document.addEventListener('visibilitychange', update);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { inView = en.isIntersecting; update(); }, { threshold: 0.35 }).observe(vid);
    }
    sync();
  }

  /* ── Scroll: progress bar, active nav, language links ─────── */
  const bar = $('[data-progress]');
  const links = $$('[data-nav]');
  const sections = links.map(l => document.getElementById(l.dataset.nav));
  // the CZ/EN links keep you in the same section of the other language
  const langLinks = $$('[data-lang-link]').map(a => ({ a, base: a.getAttribute('href') }));
  let raf = 0, activeId = '';
  const tick = () => {
    raf = 0;
    const se = document.scrollingElement || document.documentElement;
    const max = se.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, se.scrollTop / max) : 0})`;
    let active = null;
    links.forEach((l, i) => { const s = sections[i]; if (s && s.getBoundingClientRect().top < 160) active = l; });
    links.forEach(l => l.classList.toggle('is-active', l === active));
    const id = active ? active.dataset.nav : '';
    if (id !== activeId) { activeId = id; langLinks.forEach(({ a, base }) => { a.href = base + (id ? '#' + id : ''); }); }
    trail();
  };

  /* ── Trail tracker: km "walked" while reading the four days ── */
  const pill = $('[data-trail-pill]');
  const DAY_KM = pill ? pill.dataset.km.split(',').map(Number) : [];
  const TOTAL = DAY_KM.reduce((s, k) => s + k, 0);
  const phone = matchMedia('(max-width: 560px)');
  let pillTimer = 0;
  const daySecs = DAY_KM.map((_, i) => document.getElementById(`den-${i + 1}`));
  const trail = () => {
    if (!pill || !daySecs[0]) return;
    const mid = innerHeight * 0.5;
    const first = daySecs[0].getBoundingClientRect(), last = daySecs[daySecs.length - 1].getBoundingClientRect();
    const inDays = first.top < mid && last.bottom > mid * 0.6;
    pill.classList.toggle('on', inDays);
    if (phone.matches) {
      // phones: show only while scrolling, then fade out so it never covers the text being read
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
    $('[data-tp-day]', pill).textContent = day;
    $('[data-tp-km]', pill).textContent = dec(km.toFixed(1));
    const pct = (km / TOTAL) * 100 + '%';
    $('[data-tp-fill]', pill).style.width = pct;
    $('[data-tp-dot]', pill).style.left = pct;
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* ── Reveal-on-scroll ─────────────────────────────────────── */
  const setupReveal = () => {
    // story paragraphs come from Markdown, so they get their reveal here
    $$('.story-text > p, .day-row .prose > p').forEach(p => { p.dataset.reveal = 'up'; });
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
      const target = parseFloat(c.dataset.count), places = +(c.dataset.dec || 0), t0 = performance.now() + d, dur = 1300;
      const step = now => {
        if (!c.firstChild) return;
        const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
        c.firstChild.nodeValue = p >= 1 ? c._orig : dec((target * e).toFixed(places));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const draw = (p, duration, delay) => {
      const L = p.getTotalLength(); p.style.strokeDasharray = L;
      p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration, delay, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'backwards' });
    };
    const show = el => {
      const d = el._d;
      play(el, d);
      $$('[data-note-text]', el).forEach(t => t.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 500, delay: d + 350, easing: 'ease-out', fill: 'backwards' }));
      // photo-note arrows: a curve, then its short arrowhead
      $$('[data-draw]', el).forEach((p, i) => draw(p, i % 2 ? 200 : 650, d + 550 + (i % 2 ? 640 : 0)));
      $$('[data-line]', el).forEach(s => play(s, d + 150, 800));
      $$('[data-stop]', el).forEach((s, i) => play(s, d + 250 + i * 130, 700));
      $$('[data-count]', el).forEach(c => count(c, d + 100));
    };
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { io.unobserve(en.target); show(en.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    const heroVisible = header && header.getBoundingClientRect().top < innerHeight;
    requestAnimationFrame(() => els.forEach(el => {
      if (heroVisible && el.hasAttribute('data-hero') && header.contains(el)) show(el);
      else io.observe(el);
    }));
    onScroll();
  };

  const playIntroExtras = () => {
    const el = $('[data-badge]'); if (!el) return;
    const a = el.animate([
      { opacity: 0, transform: 'scale(.3) rotate(-70deg)' },
      { opacity: 1, transform: 'scale(1.1) rotate(8deg)', offset: .65 },
      { opacity: 1, transform: 'scale(.97) rotate(-2deg)', offset: .85 },
      { opacity: 1, transform: 'scale(1) rotate(0deg)' }
    ], { duration: 820, delay: 1300, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' });
    a.onfinish = () => { el.style.opacity = ''; a.cancel(); };
  };

  /* ── Boot ─────────────────────────────────────────────────── */
  render();
  tick();
  if (motionOn) { setupReveal(); playIntroExtras(); }
  else $$('[data-hero]').forEach(el => { el.style.opacity = ''; });
  setTimeout(startAuto, motionOn ? 1500 : 0);
  window.expediceReady = true; // tells the failsafe in <head> that the hero is handled
})();
