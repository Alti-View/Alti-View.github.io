/* ALTIVIEW · espace pilote : connexion, inscription, récupération de mot de passe.
   Les comptes vivent chez Supabase. La clé ci-dessous est la clé PUBLIQUE (publishable) :
   elle est faite pour vivre dans la page, toute la sécurité tient aux règles RLS
   déclarées dans supabase/setup.sql. La clé service_role, elle, ne doit jamais approcher ce fichier. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://qwoakspccpvcxsvlhjos.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_shsfW7of4YmsF1CtWiCfrg__NjReVn5';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function isEN() { return root.lang === 'en'; }
  function L(fr, en) { return isEN() ? en : fr; }
  var reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');

  var auth = $('#auth');
  if (!auth) return;
  var authPanel = $('#authPanel');
  var views = { login: $('#authLogin'), signup: $('#authSignup'), forgot: $('#authForgot'), code: $('#authCode'), reset: $('#authReset'), account: $('#authAccount'), profile: $('#authProfile') };
  var titles = { login: 'authTitle', signup: 'authTitle2', forgot: 'authTitle3', code: 'authTitle4', reset: 'authTitle5', account: 'authTitle6', profile: 'authTitle7' };
  var back = null, tick = null, pendingMail = '', session = null, profile = null;

  var sb = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;

  /* ---------- le panneau ---------- */
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }

  function show(view) {
    var v = views[view] ? view : 'login';
    if (v === 'profile') fillProfileForm();
    for (var k in views) views[k].hidden = k !== v;
    auth.classList.toggle('wide', v === 'signup');
    authPanel.setAttribute('aria-labelledby', titles[v]);
    authPanel.scrollTop = 0;
    if (v !== 'code') stopTimer();
    var first = $$('input,select', views[v])[0];
    if (first) setTimeout(function () { first.focus(); }, 60);
  }
  function open(view) {
    back = document.activeElement;
    auth.hidden = false;
    root.style.overflow = 'hidden';
    show(view || (session ? 'account' : 'login'));
  }
  function close() {
    if (auth.hidden) return;
    auth.hidden = true;
    root.style.overflow = '';
    stopTimer();
    $$('.sent-note', auth).forEach(function (n) { n.hidden = true; });
    if (back && back.focus) back.focus();
    back = null;
  }

  $$('[data-auth]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var a = el.getAttribute('data-auth');
      e.preventDefault();
      if (a === 'close') close();
      else if (a === 'plans') { close(); location.hash = '#abonnements'; }   /* changer de formule passe par le paiement */
      else if (views[a]) show(a);
      else open();
    });
  });

  addEventListener('keydown', function (e) {
    if (auth.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;                                     /* le focus reste dans le panneau */
    var f = $$('a[href],button:not([disabled]),input,select', authPanel).filter(function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- champs ---------- */
  $$('.pass-eye').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = document.getElementById(b.getAttribute('data-eye')), on = i.type === 'password';
      i.type = on ? 'text' : 'password';
      b.classList.toggle('on', on);
      b.setAttribute('aria-label', on ? L('Masquer le mot de passe', 'Hide password') : L('Afficher le mot de passe', 'Show password'));
    });
  });

  var pairs = [[$('#sg-pass'), $('#sg-pass2')], [$('#rs-pass'), $('#rs-pass2')]];
  function matchPass() {
    pairs.forEach(function (p) {
      p[1].setCustomValidity(p[1].value && p[1].value !== p[0].value ? L('Les deux mots de passe sont différents.', 'The two passwords do not match.') : '');
    });
  }
  pairs.forEach(function (p) { p.forEach(function (i) { i.addEventListener('input', matchPass); }); });

  /* ---------- code à 6 chiffres ---------- */
  var otp = $$('.otp-i'), codeTimer = $('#codeTimer'), resend = $('#resend'), left = 0;
  function fmtTime(s) { return (s / 60 | 0) + ':' + ('0' + (s % 60)).slice(-2); }
  function startTimer() {
    stopTimer(); left = 600;
    codeTimer.textContent = fmtTime(left);
    tick = setInterval(function () {
      left--; codeTimer.textContent = fmtTime(Math.max(0, left));
      if (left <= 0) stopTimer();
    }, 1000);
  }
  function coolResend() {
    var s = 30;
    resend.disabled = true;
    var c = setInterval(function () {
      s--; resend.textContent = L('Renvoyer le code', 'Send a new code') + (s > 0 ? ' (' + s + ')' : '');
      if (s <= 0) { clearInterval(c); resend.disabled = false; }
    }, 1000);
  }
  otp.forEach(function (i, k) {
    i.addEventListener('input', function () {
      i.value = i.value.replace(/\D/g, '').slice(0, 1);
      if (i.value && otp[k + 1]) otp[k + 1].focus();
    });
    i.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !i.value && otp[k - 1]) { otp[k - 1].focus(); otp[k - 1].value = ''; e.preventDefault(); }
      if (e.key === 'ArrowLeft' && otp[k - 1]) otp[k - 1].focus();
      if (e.key === 'ArrowRight' && otp[k + 1]) otp[k + 1].focus();
    });
    i.addEventListener('paste', function (e) {                       /* un code collé depuis la boîte mail remplit les six cases */
      var d = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      if (!d) return;
      e.preventDefault();
      for (var n = 0; n < otp.length - k; n++) otp[k + n].value = d.charAt(n) || '';
      otp[Math.min(k + d.length, otp.length - 1)].focus();
    });
  });
  function codeValue() { return otp.map(function (i) { return i.value; }).join(''); }

  function mask(mail) {
    var at = mail.indexOf('@'); if (at < 1) return mail;
    var u = mail.slice(0, at);
    return (u.length > 2 ? u.charAt(0) + '•••' + u.charAt(u.length - 1) : u.charAt(0) + '•••') + mail.slice(at);
  }

  /* ---------- messages ---------- */
  function guard(form) { matchPass(); if (form.checkValidity()) return true; form.reportValidity(); return false; }
  function say(note, msg, kind) {
    note.textContent = msg;
    note.classList.toggle('err', kind === 'err');
    note.hidden = false;
    note.scrollIntoView({ block: 'nearest', behavior: reducedMQ.matches ? 'auto' : 'smooth' });
  }
  function busy(btn, on) {
    if (on) { btn.setAttribute('data-label', btn.innerHTML); btn.disabled = true; btn.textContent = L('Un instant…', 'One moment…'); }
    else if (btn.getAttribute('data-label')) { btn.innerHTML = btn.getAttribute('data-label'); btn.disabled = false; btn.removeAttribute('data-label'); }
  }
  function human(e) {                                                /* les messages de Supabase sont en anglais et techniques */
    var m = ((e && e.message) || '').toLowerCase();
    if (m.indexOf('invalid login credentials') >= 0) return L('Adresse e-mail ou mot de passe incorrect.', 'Wrong email address or password.');
    if (m.indexOf('email not confirmed') >= 0) return L("Votre adresse n'est pas encore confirmée. Ouvrez le lien reçu par e-mail.", 'Your address is not confirmed yet. Open the link we emailed you.');
    if (m.indexOf('already registered') >= 0 || m.indexOf('already exists') >= 0) return L('Un compte existe déjà avec cette adresse.', 'An account already exists with this address.');
    if (m.indexOf('sending') >= 0 && m.indexOf('email') >= 0) return L("L'e-mail de confirmation n'a pas pu partir, le compte n'a donc pas été créé. Réessayez dans quelques minutes.", 'The confirmation email could not be sent, so the account was not created. Try again in a few minutes.');
    if (m.indexOf('signups not allowed') >= 0 || m.indexOf('signup is disabled') >= 0) return L('Les inscriptions sont fermées pour le moment.', 'Sign-ups are closed at the moment.');
    if (m.indexOf('token') >= 0 || m.indexOf('otp') >= 0 || m.indexOf('expired') >= 0) return L('Code expiré ou incorrect. Demandez-en un nouveau.', 'Expired or wrong code. Ask for a new one.');
    if (m.indexOf('security purposes') >= 0 || m.indexOf('rate limit') >= 0 || m.indexOf('too many') >= 0) return L('Trop de tentatives. Patientez une minute.', 'Too many attempts. Wait a minute.');
    if (m.indexOf('different from the old') >= 0) return L("Choisissez un mot de passe différent de l'ancien.", 'Choose a password different from the old one.');
    if (m.indexOf('at least') >= 0 || m.indexOf('too short') >= 0) return L('Mot de passe trop court : 8 caractères minimum.', 'Password too short: 8 characters minimum.');
    if (m.indexOf('weak') >= 0 || m.indexOf('pwned') >= 0 || m.indexOf('easy to guess') >= 0) return L('Mot de passe trop simple, choisissez-en un autre.', 'Password too easy to guess, choose another one.');
    if (m.indexOf('session') >= 0 || m.indexOf('jwt') >= 0) return L('Votre session de récupération a expiré. Redemandez un code.', 'Your recovery session has expired. Ask for a new code.');
    if (m.indexOf('fetch') >= 0 || m.indexOf('network') >= 0) return L('Serveur injoignable. Vérifiez votre connexion.', 'Cannot reach the server. Check your connection.');
    return (e && e.message) || L('Une erreur est survenue.', 'Something went wrong.');
  }
  function offline(note) {
    say(note, L("Le service de comptes n'a pas pu être chargé. Réessayez dans un instant.", 'The account service could not be loaded. Try again in a moment.'), 'err');
  }

  /* ---------- connexion par fournisseur (Google, Apple) ---------- */
  $$('[data-sso]').forEach(function (b) {
    b.addEventListener('click', function () {
      var view = b.closest('.auth-view');
      var note = $('.sent-note', view) || loginNote;
      if (!sb) return offline(note);
      b.disabled = true;
      sb.auth.signInWithOAuth({                                      /* la page part chez le fournisseur et revient avec la session */
        provider: b.getAttribute('data-sso'),
        options: { redirectTo: location.origin + location.pathname }
      }).then(function (r) {
        if (r && r.error) { b.disabled = false; say(note, human(r.error), 'err'); }
      }).catch(function (err) { b.disabled = false; say(note, human(err), 'err'); });
    });
  });

  /* ---------- état connecté ---------- */
  var navBtns = $$('#nav [data-auth="open"]');                       /* les deux « Se connecter » de la barre, pas le bouton du hero */
  function fullName(meta) {
    var f = meta.first_name || meta.given_name || '', l = meta.last_name || meta.family_name || '';
    return (f + ' ' + l).trim() || meta.full_name || meta.name || '';
  }
  function navState() {
    var meta = (session && session.user && session.user.user_metadata) || {};
    /* la fiche enregistrée passe devant : c'est elle que « Mon profil » vient de modifier */
    var name = (profile && profile.first_name) || meta.first_name || meta.given_name || fullName(meta).split(' ')[0] || '';
    navBtns.forEach(function (b) {
      b.textContent = session ? (name || L('Mon espace', 'My account')) : L('Se connecter', 'Log in');
    });
    var pill = $('#navPlan'), plan = planOf(profile || {}, meta);
    if (pill) {                                             /* le grade passe devant la formule : un fondateur porte son grade */
      var founder = profile && profile.grade === 'founder';
      var kind = founder ? 'p-founder' : /pro/i.test(plan) ? 'p-pro' : /roclub/i.test(plan) ? 'p-club' : /pilote/i.test(plan) ? 'p-vfr' : '';
      /* abrégé dans la barre, nom complet au survol : la place est comptée à droite */
      var short = { 'p-founder': 'Co-Founder', 'p-pro': 'Pro', 'p-vfr': 'VFR', 'p-club': 'Club' }[kind] || '';
      pill.className = 'nav-plan ' + kind;
      pill.textContent = short;
      pill.setAttribute('title', founder ? L("Fondateur d'Altiview", 'Altiview founder') : plan);
      pill.hidden = !session || !kind;
    }
    if (!session) return;
    /* la fiche enregistrée fait autorité, les données du fournisseur ne servent que de secours */
    var p = profile || {};
    var full = [p.first_name || meta.first_name || meta.given_name, p.last_name || meta.last_name || meta.family_name]
      .filter(Boolean).join(' ') || fullName(meta);
    $('#myMail').textContent = session.user.email || '';
    $('#myName').textContent = full || L('À compléter', 'To complete');
    $('#myClub').textContent = p.club || meta.club || L('À compléter', 'To complete');
    var badge = $('#myPlan');
    badge.textContent = p.grade === 'founder' ? 'Co-Founder' : (plan || L('Aucune', 'None'));
    badge.className = 'ac-badge ' + (kindOf(p.grade, plan) || 'b-none');
    /* main.js s'en sert pour remettre l'identifiant du pilote dans les liens de paiement */
    document.dispatchEvent(new CustomEvent('altiview:auth'));
  }
  /* La formule affichée est celle qui est réellement payée : c'est le webhook Stripe qui
     renseigne subscription_plan et subscription_status. La colonne `plan`, saisie à
     l'inscription, ne sert que de secours pour les comptes sans abonnement Stripe —
     et un abonnement expiré ou résilié ne doit pas la faire réapparaître. */
  function planOf(p, meta) {
    var st = p.subscription_status || '';
    if (st) return /active|trialing/.test(st) ? (p.subscription_plan || p.plan || '') : '';
    return p.plan || meta.plan || '';
  }
  function kindOf(grade, plan) {
    if (grade === 'founder') return 'b-founder';
    if (/pro/i.test(plan)) return 'b-pro';
    if (/roclub/i.test(plan)) return 'b-club';
    if (/pilote/i.test(plan)) return 'b-vfr';
    return '';
  }

  /* ---------- connexion ---------- */
  var loginForm = $('#loginForm'), loginNote = $('#loginNote');
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!guard(loginForm)) return;
    if (!sb) return offline(loginNote);
    var btn = $('button[type=submit]', loginForm);
    busy(btn, true); loginNote.hidden = true;
    sb.auth.signInWithPassword({ email: $('#lg-mail').value.trim(), password: $('#lg-pass').value })
      .then(function (r) {
        busy(btn, false);
        if (r.error) return say(loginNote, human(r.error), 'err');
        loginForm.reset();
        close();
      })
      .catch(function (err) { busy(btn, false); say(loginNote, human(err), 'err'); });
  });

  /* ---------- inscription ---------- */
  var signupForm = $('#signupForm'), signupNote = $('#signupNote');
  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!guard(signupForm)) return;
    if (!sb) return offline(signupNote);
    var btn = $('button[type=submit]', signupForm), mail = $('#sg-mail').value.trim();
    busy(btn, true); signupNote.hidden = true;
    sb.auth.signUp({
      email: mail,
      password: $('#sg-pass').value,
      options: {
        emailRedirectTo: location.origin + location.pathname,
        data: {
          first_name: $('#sg-first').value.trim(),
          last_name: $('#sg-last').value.trim(),
          role: $('#sg-role').value,
          plan: $('#sg-plan').value,
          club: $('#sg-club').value.trim(),
          news: $('#signupForm [name=news]').checked
        }
      }
    }).then(function (r) {
      busy(btn, false);
      if (r.error) return say(signupNote, human(r.error), 'err');
      signupForm.reset();
      say(signupNote, L('Compte créé. Ouvrez l\'e-mail de confirmation envoyé à ' + mask(mail) + ' pour activer votre espace.',
        'Account created. Open the confirmation email sent to ' + mask(mail) + ' to activate your space.'));
    }).catch(function (err) { busy(btn, false); say(signupNote, human(err), 'err'); });
  });

  /* ---------- mot de passe oublié : envoi du code ---------- */
  var forgotForm = $('#forgotForm'), forgotNote = $('#forgotNote');
  function sendCode(mail, note, btn) {
    if (!sb) { offline(note); return; }
    if (btn) busy(btn, true);
    /* redirectTo sert au modèle par défaut de Supabase, qui envoie un lien tant que le SMTP
       personnalisé n'est pas activé : le lien ramène ici et ouvre l'écran du nouveau mot de passe.
       Une fois le modèle « Reset password » remplacé par le nôtre, c'est le code à 6 chiffres qui arrive. */
    sb.auth.resetPasswordForEmail(mail, { redirectTo: location.origin + location.pathname }).then(function (r) {
      if (btn) busy(btn, false);
      /* on avance toujours, même si l'adresse est inconnue : la page ne dit jamais qui a un compte */
      if (r.error && /security purposes|rate limit|too many/i.test(r.error.message || '')) return say(note, human(r.error), 'err');
      pendingMail = mail;
      $('#codeMail').textContent = mask(mail);
      otp.forEach(function (i) { i.value = ''; });
      show('code');
      startTimer(); coolResend();
      say($('#codeNote'), L('Si un compte existe pour cette adresse, le code vient de partir. Pensez aux indésirables.',
        'If an account exists for this address, the code is on its way. Check your spam folder.'));
    }).catch(function (err) { if (btn) busy(btn, false); say(note, human(err), 'err'); });
  }
  forgotForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!guard(forgotForm)) return;
    forgotNote.hidden = true;
    sendCode($('#fg-mail').value.trim(), forgotNote, $('button[type=submit]', forgotForm));
  });
  resend.addEventListener('click', function () {
    startTimer(); coolResend();
    sendCode(pendingMail, $('#codeNote'), null);
    otp[0].focus();
  });

  /* ---------- vérification du code ---------- */
  var codeForm = $('#codeForm'), codeNote = $('#codeNote');
  codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!guard(codeForm)) return;
    if (!sb) return offline(codeNote);
    var btn = $('button[type=submit]', codeForm);
    busy(btn, true); codeNote.hidden = true;
    sb.auth.verifyOtp({ email: pendingMail, token: codeValue(), type: 'recovery' }).then(function (r) {
      busy(btn, false);
      if (r.error) return say(codeNote, human(r.error), 'err');
      stopTimer();
      show('reset');
    }).catch(function (err) { busy(btn, false); say(codeNote, human(err), 'err'); });
  });

  /* ---------- nouveau mot de passe ---------- */
  var resetForm = $('#resetForm'), resetNote = $('#resetNote');
  resetForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!guard(resetForm)) return;
    if (!sb) return offline(resetNote);
    var btn = $('button[type=submit]', resetForm);
    busy(btn, true); resetNote.hidden = true;
    sb.auth.updateUser({ password: $('#rs-pass').value }).then(function (r) {
      busy(btn, false);
      if (r.error) return say(resetNote, human(r.error), 'err');
      resetForm.reset();
      say(resetNote, L('Mot de passe enregistré. Vous êtes connecté.', 'Password saved. You are signed in.'));
      setTimeout(close, 1800);
    }).catch(function (err) { busy(btn, false); say(resetNote, human(err), 'err'); });
  });

  /* ---------- mon profil : prénom, nom, aéroclub, profil pilote ----------
     La formule ne se modifie pas ici : elle se change en payant, et les règles RLS
     interdisent d'écrire les colonnes d'abonnement depuis le navigateur. */
  function fillProfileForm() {
    var p = profile || {}, meta = (session && session.user && session.user.user_metadata) || {};
    $('#pf-first').value = p.first_name || meta.first_name || meta.given_name || '';
    $('#pf-last').value = p.last_name || meta.last_name || meta.family_name || '';
    $('#pf-club').value = p.club || meta.club || '';
    var role = p.role || meta.role || '';
    if (role) $('#pf-role').value = role;
    var badge = $('#pfPlan'), plan = planOf(p, meta);
    badge.textContent = p.grade === 'founder' ? 'Co-Founder' : (plan || L('Aucune', 'None'));
    badge.className = 'ac-badge ' + (kindOf(p.grade, plan) || 'b-none');
  }
  var profileForm = $('#profileForm'), profileNote = $('#profileNote');
  profileForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!guard(profileForm)) return;
    if (!sb || !session) return offline(profileNote);
    var btn = $('button[type=submit]', profileForm);
    busy(btn, true); profileNote.hidden = true;
    var patch = {
      first_name: $('#pf-first').value.trim(),
      last_name: $('#pf-last').value.trim(),
      club: $('#pf-club').value.trim(),
      role: $('#pf-role').value
    };
    sb.from('profiles').update(patch).eq('id', session.user.id).then(function (r) {
      busy(btn, false);
      if (r && r.error) return say(profileNote, human(r.error), 'err');
      /* la même chose dans le compte lui-même, pour que les deux sources restent d'accord */
      sb.auth.updateUser({ data: patch }).catch(function () {});
      loadProfile();
      say(profileNote, L('Profil enregistré.', 'Profile saved.'));
    }).catch(function (err) { busy(btn, false); say(profileNote, human(err), 'err'); });
  });

  /* ---------- déconnexion ---------- */
  $('#signout').addEventListener('click', function () {
    if (!sb) return;
    sb.auth.signOut().then(function () { close(); });
  });

  /* ---------- session ----------
     La fiche du pilote fait autorité sur la formule et le grade : les règles RLS
     n'autorisent chacun qu'à lire sa propre ligne. */
  function loadProfile() {
    if (!session) { profile = null; navState(); return Promise.resolve(); }
    return sb.from('profiles')
      .select('first_name,last_name,club,role,plan,grade,subscription_status,subscription_plan')
      .eq('id', session.user.id).maybeSingle()
      .then(function (r) { profile = (r && r.data) || null; navState(); })
      .catch(function () { profile = null; navState(); });
  }
  /* ---------- retour de paiement ----------
     Stripe renvoie le pilote avec ?paiement=ok. Le webhook met la fiche à jour de son côté,
     ce qui prend une seconde ou deux : on relit la fiche jusqu'à voir l'abonnement arriver. */
  function afterPayment() {
    if (!/[?&]paiement=ok/.test(location.search)) return;
    history.replaceState(null, '', location.pathname + location.hash);   /* un rechargement ne doit pas rejouer le message */
    open('account');
    var note = $('#accountNote'), tries = 0, max = 24;   /* ~60 s : Stripe met parfois une dizaine de secondes à livrer l'événement */
    say(note, L('Paiement confirmé, merci. Activation de votre formule en cours…',
      'Payment confirmed, thank you. Your plan is being activated…'));
    (function poll() {
      loadProfile().then(function () {                   /* on attend la lecture, sinon on teste une fiche encore vide */
        var p = profile || {};
        if (/active|trialing/.test(p.subscription_status || '')) {
          var nm = p.subscription_plan ? ' ' + p.subscription_plan : '';
          say(note, L('Paiement confirmé. Votre formule' + nm + ' est active, le reçu arrive par e-mail.',
            'Payment confirmed. Your' + nm + ' plan is active, the receipt is on its way by email.'));
          return;
        }
        if (++tries >= max) {                            /* le paiement est encaissé quoi qu'il arrive : ne jamais inquiéter le pilote */
          say(note, L("Paiement confirmé. L'activation prend un peu plus longtemps que d'habitude : rechargez la page dans une minute.",
            'Payment confirmed. Activation is taking longer than usual: reload the page in a minute.'));
          return;
        }
        setTimeout(poll, 2500);
      });
    })();
  }

  if (sb) {
    sb.auth.getSession().then(function (r) { session = (r.data && r.data.session) || null; navState(); loadProfile(); afterPayment(); });
    sb.auth.onAuthStateChange(function (event, s) {
      session = s || null;
      navState();
      loadProfile();
      if (event === 'PASSWORD_RECOVERY') { open('reset'); }        /* arrivée par le lien de récupération d'un e-mail */
    });
  }
  /* ---------- autocomplétion des aérodromes ----------
     Liste dessinée par nous : le menu natif d'un <datalist> suit l'apparence du système
     et devient illisible en mode jour sur Safari. */
  function attachAero(input) {
    var src = window.AltiAerodromes;
    if (!input || !src) return;
    input.removeAttribute('list');
    input.setAttribute('autocomplete', 'off');
    var fld = input.closest('.fld') || input.parentNode;
    fld.style.position = 'relative';
    var box = document.createElement('ul');
    box.className = 'aero-sug';
    box.hidden = true;
    fld.appendChild(box);
    var items = [], cur = -1;

    function draw(list) {
      items = list; cur = -1;
      box.innerHTML = list.map(function (a, i) { return '<li data-i="' + i + '"><b>' + a[0] + '</b>' + a[1] + '</li>'; }).join('');
      box.hidden = !list.length;
      /* le panneau a son propre défilement : sans ça la liste reste coupée en bas */
      if (!box.hidden) setTimeout(function () {
        box.scrollIntoView({ block: 'nearest', behavior: reducedMQ.matches ? 'auto' : 'smooth' });
      }, 20);
    }
    function pick(i) {
      if (!items[i]) return;
      input.value = items[i][0] + ' · ' + items[i][1];
      box.hidden = true;
    }
    function mark() { $$('li', box).forEach(function (li, i) { li.classList.toggle('on', i === cur); }); }

    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { box.hidden = true; return; }
      draw(src.filter(function (a) {                                  /* par code OACI ou par nom de terrain */
        return a[0].toLowerCase().indexOf(q) === 0 || a[1].toLowerCase().indexOf(q) >= 0;
      }).slice(0, 7));
    });
    input.addEventListener('keydown', function (e) {
      if (box.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); cur = (cur + 1) % items.length; mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cur = (cur - 1 + items.length) % items.length; mark(); }
      else if (e.key === 'Enter' && cur >= 0) { e.preventDefault(); pick(cur); }
      else if (e.key === 'Escape') box.hidden = true;
    });
    box.addEventListener('mousedown', function (e) {                  /* mousedown, sinon le blur ferme avant le clic */
      var li = e.target.closest('li');
      if (li) { e.preventDefault(); pick(+li.getAttribute('data-i')); }
    });
    input.addEventListener('blur', function () { setTimeout(function () { box.hidden = true; }, 120); });
  }
  attachAero($('#sg-club'));
  attachAero($('#pf-club'));

  /* main.js attache l'identifiant du pilote aux liens de paiement Stripe */
  window.AltiAuth = { user: function () { return session && session.user ? session.user : null; } };
  document.addEventListener('altiview:lang', navState);
})();
