/* ALTIVIEW · page behaviour (theme, menu, entrances, scroll drives, aircraft profiles, NavLog, devices, pricing, contact) */
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var nav = $('#nav');
  /* strings this script writes itself follow the page language (i18n.js sets <html lang>) */
  function isEN() { return root.lang === 'en'; }
  function L(fr, en) { return isEN() ? en : fr; }

  /* ---------- NUIT / JOUR ---------- */
  var sw = $('#themeSwitch');
  var metaTheme = document.querySelector('meta[name="theme-color"]');
  function applyTheme(t, save) {
    root.setAttribute('data-theme', t);
    sw.setAttribute('aria-checked', t === 'day' ? 'true' : 'false');
    metaTheme.setAttribute('content', t === 'day' ? '#E8EDF1' : '#0A1119');
    if (save) { try { localStorage.setItem('altiview-theme', t); } catch (e) {} }
    document.dispatchEvent(new CustomEvent('altiview:theme', { detail: t }));
  }
  applyTheme(root.getAttribute('data-theme') === 'day' ? 'day' : 'night', false);
  sw.addEventListener('click', function () {
    applyTheme(root.getAttribute('data-theme') === 'day' ? 'night' : 'day', true);
  });

  /* ---------- burger menu (under 1300px) ---------- */
  var menuBtn = $('#menuBtn');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? L('Fermer le menu', 'Close menu') : L('Ouvrir le menu', 'Open menu'));
  }
  menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  $$('#navLinks a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
  });
  matchMedia('(min-width: 1301px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });

  /* ---------- arrival screen, then the hero entrance ---------- */
  var hero = $('.hero'), intro = $('#intro');
  function startHero() { requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add('in'); }); }); }
  function endIntro() {
    if (!intro) return;
    intro.remove(); intro = null;                      /* nothing of it stays in the page */
    root.style.overflow = '';
    startHero();                                       /* the headline plays once the screen is out of the way, not behind it */
  }
  if (!intro || reducedMQ.matches || location.hash) { if (intro) { intro.remove(); intro = null; } startHero(); }
  else {
    root.style.overflow = 'hidden';                    /* no scrolling while it plays */
    setTimeout(endIntro, 2000);
    intro.addEventListener('click', endIntro);         /* a click or any key skips it */
    addEventListener('keydown', endIntro, { once: true });
  }

  /* ---------- price drums and check stagger, built before the entrances fire ---------- */
  $$('.drum').forEach(function (d) {
    var n = +d.getAttribute('data-d') || 0, col = document.createElement('span');
    [7, 8, 9, 10].forEach(function (o) { var g = document.createElement('i'); g.textContent = (n + o) % 10; col.appendChild(g); });
    d.textContent = ''; d.appendChild(col);
    d.style.setProperty('--n', 3);                     /* a short roll of four digits landing on the price: nothing tall hides inside the card */
  });
  $$('.plan').forEach(function (p) { $$('li', p).forEach(function (li, i) { li.style.setProperty('--k', i); }); });

  /* ---------- entrances (IntersectionObserver), stagger retired after ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      el.classList.add('in');
      io.unobserve(el);
      setTimeout(function () { el.classList.add('done'); }, 2400);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  $$('.rv, #bento, #pricing').forEach(function (el) { io.observe(el); });

  /* the recommended plan's border light only runs while the section is on screen */
  var pricing = $('#pricing');
  new IntersectionObserver(function (es) { pricing.classList.toggle('live', es[es.length - 1].isIntersecting); }).observe(pricing);

  /* ---------- scroll drives: nav state, pinned convergence field, tablet ---------- */
  var pin = $('#fieldPin'), field = $('#field'), tablet = $('#tablet');
  var cache = { nav: null, p: -1, t: -1 };
  var ticking = false;

  function sizeField() {
    field.style.setProperty('--fw', field.clientWidth + 'px');
    field.style.setProperty('--fh', field.clientHeight + 'px');
  }
  function drive() {
    ticking = false;
    var vh = innerHeight;
    var scrolled = scrollY > 24;
    if (scrolled !== cache.nav) { cache.nav = scrolled; nav.classList.toggle('scrolled', scrolled); }

    var rm = reducedMQ.matches;
    /* the field is sticky inside its pin; progress runs while it stays centred on screen */
    var fh = field.offsetHeight, pr = pin.getBoundingClientRect();
    var stick = (vh - fh) / 2 + 34;
    var raw = clamp((stick - pr.top) / Math.max(1, pr.height - fh), 0, 1);
    var p = rm ? 1 : clamp((raw - 0.1) / 0.7, 0, 1);   /* a beat scattered, the merge, a beat merged */
    p = Math.round(p * p * (3 - 2 * p) * 500) / 500;
    if (p !== cache.p) { cache.p = p; field.style.setProperty('--p', p); }

    var tr = tablet.getBoundingClientRect();
    var t = rm ? 1 : clamp((vh - tr.top) / (vh * 0.75), 0, 1);
    t = Math.round(t * 500) / 500;
    if (t !== cache.t) { cache.t = t; tablet.style.setProperty('--t', t); }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(drive); } }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', function () { sizeField(); onScroll(); }, { passive: true });
  reducedMQ.addEventListener('change', function () { cache.p = cache.t = -1; drive(); });
  sizeField(); drive();

  /* ---------- aircraft profiles: picker, stage chip, data sheet, NavLog, 3D swap ----------
     Figures from the built-in manufacturer profiles of the Altiview app. */
  var FLEET = [
    { id: 'c172', name: 'Cessna 172', short: 'C172', reg: 'F-HJAK', vg: 68, gr: 9, cruise: 115, mtow: 1157, fuel: 201, burn: 38, engine: 'Lycoming IO-360-L2A · 180 ch', seats: '4', fuelType: 'AVGAS 100LL',
      desc: 'Quadriplace à aile haute haubanée, avionique Garmin. L\'avion le plus construit de l\'histoire.' },
    { id: 'dr400', name: 'Robin DR-400', short: 'DR-400', reg: 'F-HBIQ', vg: 65, gr: 10, cruise: 105, mtow: 900, fuel: 110, burn: 24, engine: 'Lycoming O-235 · 118 ch', seats: '2 + 2', fuelType: 'AVGAS 100LL',
      desc: 'Avion de voyage français à structure bois, aile Jodel et visibilité avant exceptionnelle.' },
    { id: 'pa28', name: 'Piper PA-28', short: 'PA-28', reg: 'F-GIEC', vg: 76, gr: 9, cruise: 118, mtow: 1157, fuel: 182, burn: 36, engine: 'Lycoming O-360-A4M · 180 ch', seats: '4', fuelType: 'AVGAS 100LL',
      desc: 'Aile basse tout métal, robuste et stable, apprécié en voyage comme en vol aux instruments.' },
    { id: 'da40', name: 'Diamond DA-40', short: 'DA-40', reg: 'F-MORIS', vg: 73, gr: 10, cruise: 130, mtow: 1310, fuel: 147, burn: 22, engine: 'Austro Engine AE300 · 168 ch', seats: '4', fuelType: 'Jet A-1',
      desc: 'Cellule composite, moteur diesel au Jet A-1 et gestion FADEC à levier unique.' },
    { id: 'c152', name: 'Cessna 152', short: 'C152', reg: 'F-GDDJ', vg: 60, gr: 8.5, cruise: 95, mtow: 757, fuel: 95, burn: 22, engine: 'Lycoming O-235-L2C · 110 ch', seats: '2', fuelType: 'AVGAS 100LL',
      desc: 'Biplace école à aile haute, économique et tolérant.' }
  ];
  window.AltiState = window.AltiState || {};
  var acIdx = 1;
  var picks = $$('.ac-pick [data-ac]'), hudName = $('#acHud'), hudNow = $('.ac-now'), stats = $('#acStats'), sheet = $('#acSheet'), live = $('#acLive');
  function fmtN(n) { return Math.round(n).toLocaleString(isEN() ? 'en-US' : 'fr-FR'); }
  function fmtH(m) { m = Math.round(m); return Math.floor(m / 60) + ' h ' + ('0' + (m % 60)).slice(-2); }
  function figures(a) { var h = a.fuel / a.burn; return { cruise: a.cruise, mtow: a.mtow, fuel: a.fuel, burn: a.burn, endur: h * 60, range: a.cruise * (h - 0.5) }; }
  var shown = figures(FLEET[acIdx]), tweenRaf = null;
  function renderStats(v) {
    $$('[data-k]', stats).forEach(function (el) { var k = el.getAttribute('data-k'); var s = k === 'endur' ? fmtH(v[k]) : fmtN(v[k]); if (el.textContent !== s) el.textContent = s; });
  }
  function tweenTo(target) {
    cancelAnimationFrame(tweenRaf);
    if (reducedMQ.matches || document.hidden) { shown = target; renderStats(shown); return; }   /* no frames to animate with */
    var from = {}, t0 = performance.now(), D = 750;
    Object.keys(target).forEach(function (k) { from[k] = shown[k]; });
    (function step(now) {
      var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      Object.keys(target).forEach(function (key) { shown[key] = from[key] + (target[key] - from[key]) * e; });
      renderStats(shown);
      if (k < 1) tweenRaf = requestAnimationFrame(step);
    })(t0);
  }

  /* the navigation NavLog is flown by the same aircraft: leg times from its cruise speed, fuel from its burn */
  var LEG_NM = [12, 18, 15, 9];
  var nlHead = $('#nlHead'), nlTimes = $$('#legs .lt'), nlTotal = $('#nlTotal'), navlog = $('.navlog');
  function updateNavLog(a, flash) {
    var mins = LEG_NM.map(function (d) { return Math.round(d / a.cruise * 60); });
    var total = mins.reduce(function (s, m) { return s + m; }, 0);   /* the total is the sum of the planned legs */
    nlHead.textContent = a.short + ' · TAS ' + a.cruise + ' KT';
    nlTimes.forEach(function (td, i) { td.textContent = mins[i] + ' min'; });
    nlTotal.textContent = total + ' min';
    window.AltiState.nav = { cruise: a.cruise, burn: a.burn, minutes: total, fuel: a.burn * total / 60, legs: mins };
    if (flash) { navlog.classList.remove('upd'); void navlog.offsetWidth; navlog.classList.add('upd'); }
  }

  function hudLabel() { hudNow.setAttribute('aria-label', L('Changer d\'avion, profil actuel : ', 'Change aircraft, current profile: ') + FLEET[acIdx].name); }
  function setAircraft(i, focus) {
    i = (i + FLEET.length) % FLEET.length;
    var changed = i !== acIdx; acIdx = i;
    var a = FLEET[i];
    picks.forEach(function (b, j) { var on = j === i; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    if (focus) picks[i].focus();
    if (!changed) return;
    hudName.textContent = a.name;
    hudLabel();
    sheet.classList.add('sw');
    setTimeout(function () {
      $('#acName').textContent = a.name; $('#acReg').textContent = a.reg;
      $('#acEngine').textContent = a.engine; $('#acSeats').textContent = a.seats; $('#acFuelType').textContent = a.fuelType;
      sheet.classList.remove('sw');
    }, reducedMQ.matches ? 0 : 220);
    tweenTo(figures(a));
    stats.classList.remove('upd'); void stats.offsetWidth; stats.classList.add('upd');
    updateNavLog(a, true);
    updateScreens(a);
    live.textContent = L('Profil sélectionné : ', 'Selected profile: ') + a.name;
    window.AltiState.aircraft = a.id;
    document.dispatchEvent(new CustomEvent('altiview:aircraft', { detail: { id: a.id } }));
  }
  picks.forEach(function (b, j) {
    b.addEventListener('click', function () { setAircraft(j); });
    b.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = j + 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = j - 1;
      if (n !== null) { e.preventDefault(); setAircraft(n, true); }
    });
  });
  $$('.ac-arr').forEach(function (b) { b.addEventListener('click', function () { setAircraft(acIdx + (+b.getAttribute('data-dir'))); }); });
  hudNow.addEventListener('click', function () { setAircraft(acIdx + 1); });
  window.AltiState.aircraft = FLEET[acIdx].id;
  renderStats(shown);
  updateNavLog(FLEET[acIdx], false);

  /* language switch: numbers and the labels this script owns are re-rendered */
  document.addEventListener('altiview:lang', function () {
    renderStats(shown); hudLabel(); live.textContent = '';   /* a one-off announcement, never left in the old language */
    updateScreens(FLEET[acIdx]);
    menuBtn.setAttribute('aria-label', nav.classList.contains('open') ? L('Fermer le menu', 'Close menu') : L('Ouvrir le menu', 'Open menu'));
  });

  /* ---------- app screens: the tablet is the master, laptop and iPhone get copies ---------- */
  var master = $('#tablet .screen');
  $$('.dev-slot').forEach(function (slot, k) {
    var c = master.cloneNode(true), suf = '-d' + k;
    $$('[id]', c).forEach(function (el) { el.id += suf; });
    $$('[aria-controls],[aria-labelledby]', c).forEach(function (el) {
      ['aria-controls', 'aria-labelledby'].forEach(function (a) { var v = el.getAttribute(a); if (v) el.setAttribute(a, v + suf); });
    });
    slot.appendChild(c);
    initScreen(c, +slot.getAttribute('data-pane') || 0);
  });
  initScreen(master, 0);

  /* the app screens (tablet, laptop, phone) fly the aircraft picked in Performances.
     Only numbers and names are written here; the words around them stay static and get translated. */
  function setAll(cls, v) { v = String(v); $$('.' + cls).forEach(function (el) { if (el.textContent !== v) el.textContent = v; }); }
  function fmtD(n) { var s = n.toFixed(1); return isEN() ? s : s.replace('.', ','); }
  function updateScreens(a) {
    var nav = window.AltiState.nav, f = figures(a);
    var glideNM = 4500 * a.gr / 6076.1, glideS = Math.round(glideNM / a.vg * 3600);   /* engine failure at 4,500 ft, best glide */
    setAll('s-reg', a.reg); setAll('s-short', a.short); setAll('s-name', a.name);
    setAll('s-tow', fmtN(a.mtow - 73)); setAll('s-endur', fmtH(f.endur));
    setAll('s-fuel', fmtN(a.fuel)); setAll('s-burn', fmtN(a.burn)); setAll('s-navmin', nav.minutes);
    setAll('s-nlmin', nav.minutes); setAll('s-nlfuel', fmtN(nav.fuel)); setAll('s-gs', a.cruise);
    $$('.screen').forEach(function (scr) { $$('.s-lt', scr).forEach(function (td, i) { td.textContent = nav.legs[i]; }); });
    setAll('s-vg', a.vg); setAll('s-gd', fmtD(glideNM));
    setAll('s-gt', Math.floor(glideS / 60) + ' min ' + ('0' + (glideS % 60)).slice(-2));
  }
  updateScreens(FLEET[acIdx]);

  function initScreen(scr, start) {
    var tabs = $$('[role="tab"]', scr);
    var panes = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = j === i, pane = panes[j];
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (on) {
          pane.hidden = false;
          requestAnimationFrame(function () { pane.classList.add('on'); });
        } else if (pane.classList.contains('on') || !pane.hidden) {
          pane.classList.remove('on');
          setTimeout(function () { if (!pane.classList.contains('on')) pane.hidden = true; }, 500);
        }
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = -1;
        if (k === 'ArrowDown' || k === 'ArrowRight') n = (i + 1) % tabs.length;
        if (k === 'ArrowUp' || k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        if (k === 'Home') n = 0;
        if (k === 'End') n = tabs.length - 1;
        if (n > -1) { e.preventDefault(); select(n, true); }
      });
    });
    if (start) select(start);

    /* checklist items: tap to validate */
    var items = $$('.chk li', scr), bar = scr.querySelector('.progress'), count = scr.querySelector('.chk-count');
    function chk() {
      var done = items.filter(function (li) { return li.classList.contains('ok'); }).length;
      count.textContent = done + ' / ' + items.length;
      bar.style.setProperty('--w', (done / items.length * 100) + '%');
      items.forEach(function (li) { li.setAttribute('aria-checked', li.classList.contains('ok') ? 'true' : 'false'); });
    }
    items.forEach(function (li) {
      li.setAttribute('role', 'checkbox');
      li.tabIndex = 0;
      function toggle() { li.classList.toggle('ok'); chk(); }
      li.addEventListener('click', toggle);
      li.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
    });
    chk();
  }

  /* clock in every app bar: Paris time, labelled as such */
  var PARIS = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  function clock() { var s = PARIS.format(new Date()) + ' PARIS'; $$('.utc').forEach(function (u) { if (u.textContent !== s) u.textContent = s; }); }
  clock(); setInterval(clock, 5000);

  /* ---------- plan buttons preselect the subject of the contact form ---------- */
  var planSel = $('#f-plan');
  $$('[data-plan]').forEach(function (a) {
    a.addEventListener('click', function () { planSel.value = a.getAttribute('data-plan'); });
  });

  /* ---------- contact: opens the visitor's own email app, already filled in ----------
     subject = the "Objet" choice, first line = "Vous êtes", then the message. Nothing is sent by the site. */
  var CONTACT = 'altiview@outlook.com';
  var form = $('#wl'), note = $('#wlNote');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var role = $('#f-role'), msg = $('#f-msg').value.trim();
    var subject = planSel.options[planSel.selectedIndex].text;
    var body = role.options[role.selectedIndex].text + (msg ? '\r\n\r\n' + msg : '');
    note.hidden = false;
    window.location.href = 'mailto:' + CONTACT + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  });

  /* ---------- pause every CSS loop on hidden tabs ---------- */
  document.addEventListener('visibilitychange', function () { document.body.classList.toggle('paused', document.hidden); });
})();
