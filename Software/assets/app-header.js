/**
 * Altiview — Paramètres et compte (barre du haut)
 * Deux commandes ajoutées à droite du basculement jour / nuit :
 *   · Paramètres : raccourcis clavier modifiables (enregistrés sur ce poste)
 *   · Compte     : identité locale, accès aux vols et aux avions, déconnexion
 * Aucun serveur n'est contacté : tout reste dans le navigateur de l'appareil.
 */
(function () {
    'use strict';

    const SHORTCUT_KEY = 'altiview-shortcuts';
    const ACCOUNT_KEY = 'altiview-account';
    const LANGUAGE_KEY = 'altiview-vfr-language';

    const DEFAULTS = [
        { id: 'fit', key: 'f', label: 'Recentrer sur la route' },
        { id: 'fullscreen', key: 'p', label: 'Plein écran' },
        { id: 'layers', key: 'c', label: 'Couches et fonds' },
        { id: 'dock', key: 'n', label: 'Panneau Flight Deck' },
        { id: 'menu', key: 'm', label: 'Menu de gauche' },
        { id: 'basemap', key: 'b', label: 'Fond de carte suivant' },
        { id: 'ruler', key: 'r', label: 'Règle (cap et distance)' },
        { id: 'invert', key: 'i', label: 'Inverser la route' },
        { id: 'search', key: '/', label: 'Recherche' },
        { id: 'help', key: '?', label: 'Rappel des raccourcis' }
    ];

    function readJson(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; }
    }

    const Settings = {
        getShortcuts() {
            const saved = readJson(SHORTCUT_KEY, {});
            return DEFAULTS.map(d => ({ ...d, key: saved[d.id] || d.key }));
        },
        keyFor(id) {
            const s = this.getShortcuts().find(x => x.id === id);
            return s ? s.key : null;
        },
        saveShortcut(id, key) {
            const saved = readJson(SHORTCUT_KEY, {});
            saved[id] = key;
            try { localStorage.setItem(SHORTCUT_KEY, JSON.stringify(saved)); } catch (e) {}
            window.dispatchEvent(new CustomEvent('altiview-shortcuts-changed'));
        },
        resetShortcuts() {
            try { localStorage.removeItem(SHORTCUT_KEY); } catch (e) {}
            window.dispatchEvent(new CustomEvent('altiview-shortcuts-changed'));
        },
        getAccount() { return readJson(ACCOUNT_KEY, null); },
        saveAccount(acc) {
            try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc)); } catch (e) {}
            paintAccount();
        },
        signOut() {
            try { localStorage.removeItem(ACCOUNT_KEY); } catch (e) {}
            paintAccount();
        }
    };

    function styles() {
        if (document.getElementById('altiHeaderStyles')) return;
        const st = document.createElement('style');
        st.id = 'altiHeaderStyles';
        st.textContent = `
            .hud-icon-btn { display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9px;
                            border:1px solid var(--line); background:transparent; color:var(--text-secondary); cursor:pointer; transition:color .15s, border-color .15s, background .15s; }
            .hud-icon-btn:hover { color:var(--cyan); border-color:var(--cyan); background:var(--cyan-soft); }
            .hud-account { position:relative; }
            .hud-account-btn { display:flex; align-items:center; gap:8px; height:34px; padding:0 10px 0 5px; border-radius:9px;
                               border:1px solid color-mix(in srgb, var(--accent) 55%, transparent); background:var(--accent-soft);
                               color:var(--accent-ink); cursor:pointer; font-family:var(--f-mono); font-size:11px; font-weight:600; letter-spacing:.06em;
                               transition:border-color .15s, background .15s, color .15s; }
            .hud-account-btn:hover { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 26%, transparent); color:var(--accent-ink); }
            .hud-account-btn[aria-expanded="true"] { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 26%, transparent); }
            .hud-avatar { width:26px; height:26px; border-radius:50%; background:var(--accent); color:var(--on-accent);
                          display:flex; align-items:center; justify-content:center; font-family:var(--f-mono); font-size:10px; font-weight:700; }
            .hud-avatar.empty { background:color-mix(in srgb, var(--accent) 24%, transparent); color:var(--accent-ink);
                                border:1px solid color-mix(in srgb, var(--accent) 55%, transparent); }
            .hud-account-btn:hover .hud-avatar.empty { color:var(--accent-ink); border-color:var(--accent); }
            .hud-account-name { max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .language-switch { height:32px; padding:3px; display:inline-flex; align-items:stretch; gap:2px; flex:none;
                               border:1px solid var(--line-strong); border-radius:10px; background:var(--panel-2); color:var(--text-secondary);
                               font:700 9px/1 var(--f-mono); letter-spacing:.06em; cursor:pointer; }
            .language-switch span { min-width:25px; padding:0 5px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center;
                                    transition:color .15s ease, background-color .15s ease, box-shadow .15s ease; }
            .language-switch span.active { background:var(--accent); color:var(--on-accent); box-shadow:0 2px 8px rgba(255,169,77,.22); }
            .language-switch:hover { border-color:var(--text-secondary); }
            .hud-menu { position:absolute; top:42px; right:0; min-width:210px; background:var(--panel); border:1px solid var(--line); border-radius:12px;
                        box-shadow:var(--shadow); padding:6px; display:none; z-index:4000; }
            .hud-menu.open { display:block; }
            .hud-menu button { display:flex; align-items:center; gap:9px; width:100%; padding:9px 10px; border:0; border-radius:8px; background:transparent;
                               color:var(--text); font-size:13px; text-align:left; cursor:pointer; }
            .hud-menu button:hover { background:var(--panel-hover); }
            .hud-menu .sep { height:1px; background:var(--line); margin:5px 4px; }
            .hud-menu button.danger { color:var(--danger); }
            .hud-menu-head { padding:8px 10px 6px; font-family:var(--f-mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }

            .alti-modal { display:none; position:fixed; inset:0; background:rgba(4,8,14,.6); backdrop-filter:blur(4px); z-index:99992; align-items:center; justify-content:center; padding:20px; }
            .alti-modal.open { display:flex; }
            .alti-modal-card { background:var(--panel); border:1px solid var(--line); border-radius:16px; width:100%; max-width:520px; max-height:90vh; overflow:auto; box-shadow:var(--shadow); }
            .alti-modal-head { display:flex; align-items:center; justify-content:space-between; padding:15px 18px; border-bottom:1px solid var(--line);
                               font-family:var(--f-mono); font-size:12px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--cyan); }
            .alti-modal-body { padding:16px 18px 18px; display:flex; flex-direction:column; gap:12px; }
            .alti-modal-close { background:none; border:0; color:var(--muted); font-size:22px; line-height:1; cursor:pointer; }
            .alti-sc-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:7px 10px; border:1px solid var(--line); border-radius:10px; background:var(--panel-2); }
            .alti-sc-row span { font-size:13px; }
            .alti-sc-key { font-family:var(--f-mono); font-size:11px; font-weight:700; min-width:52px; text-align:center; padding:5px 9px; border-radius:7px;
                           border:1px solid var(--line-strong); background:var(--panel); color:var(--text); cursor:pointer; }
            .alti-sc-key.capturing { border-color:var(--accent); color:var(--accent-ink); background:var(--accent-soft); }
            .alti-hint { font-size:11.5px; color:var(--text-secondary); line-height:1.5; margin:0; }
            .alti-field { display:flex; flex-direction:column; gap:5px; }
            .alti-field label { font-family:var(--f-mono); font-size:10.5px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--text-secondary); }
            .alti-field input { background:var(--panel-2) !important; border:1px solid var(--line) !important; border-radius:8px !important; color:var(--text) !important;
                                font-size:13px !important; padding:9px 11px !important; }
            .alti-modal-foot { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; }
            .alti-btn { font-family:var(--f-mono); font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; padding:9px 14px; border-radius:8px;
                        cursor:pointer; border:1px solid var(--line-strong); background:transparent; color:var(--text); }
            .alti-btn:hover { border-color:var(--cyan); color:var(--cyan); background:var(--cyan-soft); }
            .alti-btn.primary { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
            @media (max-width: 600px) {
                #btnAppSettings { display:none; }
                .hud-account-name { display:none; }
                .hud-account-btn { padding:0 5px; }
                .language-switch { width:34px; height:30px; }
                .language-switch span { display:none; width:100%; min-width:0; padding:0; }
                .language-switch span.active { display:inline-flex; }
            }
        `;
        document.head.appendChild(st);
    }

    function readLanguage() {
        try { return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'fr'; }
        catch (e) { return 'fr'; }
    }

    function paintLanguageSwitch(button, language) {
        button.querySelectorAll('[data-lang-option]').forEach(option => {
            option.classList.toggle('active', option.dataset.langOption === language);
        });
        button.setAttribute('aria-checked', language === 'fr' ? 'true' : 'false');
        button.setAttribute('aria-label', language === 'fr' ? 'Afficher en anglais' : 'Afficher en français');
        button.title = language === 'fr' ? 'Langue : français' : 'Language: English';
    }

    function initSharedHeaderControls() {
        const header = document.querySelector('.tablet-hud');
        const left = header && header.querySelector('.hud-left');
        const right = header && header.querySelector('.hud-right');
        if (!header || !left || !right) return;

        // L'appareil reste près de la marque sur chaque module, comme sur la carte.
        const aircraft = header.querySelector('#hudAircraftTag');
        const brand = left.querySelector('.hud-brand');
        if (aircraft && aircraft.parentElement !== left) {
            if (brand) brand.insertAdjacentElement('afterend', aircraft);
            else left.appendChild(aircraft);
        }

        // La carte possède déjà sa commande, reliée au rendu des points VFR.
        // Les autres modules reçoivent la même commande et partagent son choix.
        let languageSwitch = header.querySelector('#languageSwitch');
        if (!languageSwitch) {
            languageSwitch = document.createElement('button');
            languageSwitch.type = 'button';
            languageSwitch.id = 'languageSwitch';
            languageSwitch.className = 'language-switch';
            languageSwitch.setAttribute('role', 'switch');
            languageSwitch.innerHTML = '<span data-lang-option="fr">FR</span><span data-lang-option="en">EN</span>';
            right.insertBefore(languageSwitch, right.querySelector('#themeSwitch') || right.firstChild);

            languageSwitch.addEventListener('click', () => {
                const language = readLanguage() === 'fr' ? 'en' : 'fr';
                try { localStorage.setItem(LANGUAGE_KEY, language); } catch (e) {}
                document.documentElement.lang = language;
                paintLanguageSwitch(languageSwitch, language);
                window.dispatchEvent(new CustomEvent('altiview-language-changed', { detail: { language } }));
            });
        }

        const language = readLanguage();
        document.documentElement.lang = language;
        paintLanguageSwitch(languageSwitch, language);
    }

    function modal(id, title, bodyHtml) {
        let el = document.getElementById(id);
        if (el) return el;
        el = document.createElement('div');
        el.id = id;
        el.className = 'alti-modal';
        el.innerHTML = `
            <div class="alti-modal-card">
                <div class="alti-modal-head"><span>${title}</span><button type="button" class="alti-modal-close" aria-label="Fermer">&times;</button></div>
                <div class="alti-modal-body">${bodyHtml}</div>
            </div>`;
        document.body.appendChild(el);
        el.querySelector('.alti-modal-close').addEventListener('click', () => el.classList.remove('open'));
        el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
        return el;
    }

    function openSettings() {
        const el = modal('altiSettingsModal', 'Paramètres',
            '<p class="alti-hint">Raccourcis clavier de la carte. Cliquez une touche puis appuyez sur la nouvelle, ou sur Échap pour annuler. Les réglages restent sur cet appareil.</p>'
          + '<div id="altiScList" style="display:flex; flex-direction:column; gap:6px;"></div>'
          + '<div class="alti-modal-foot"><button type="button" class="alti-btn" id="altiIntroAgain">Revoir la prise en main</button>'
          + '<button type="button" class="alti-btn" id="altiScReset">Réinitialiser</button>'
          + '<button type="button" class="alti-btn primary" id="altiScDone">Terminé</button></div>');
        const list = el.querySelector('#altiScList');

        const paint = () => {
            list.innerHTML = '';
            Settings.getShortcuts().forEach(sc => {
                const row = document.createElement('div');
                row.className = 'alti-sc-row';
                row.innerHTML = '<span></span><button type="button" class="alti-sc-key"></button>';
                row.querySelector('span').textContent = sc.label;
                const btn = row.querySelector('.alti-sc-key');
                btn.textContent = sc.key === ' ' ? 'Espace' : sc.key;
                btn.addEventListener('click', () => {
                    btn.classList.add('capturing');
                    btn.textContent = '…';
                    const onKey = ev => {
                        ev.preventDefault();
                        window.removeEventListener('keydown', onKey, true);
                        btn.classList.remove('capturing');
                        if (ev.key !== 'Escape') Settings.saveShortcut(sc.id, ev.key.length === 1 ? ev.key.toLowerCase() : ev.key);
                        paint();
                    };
                    window.addEventListener('keydown', onKey, true);
                });
                list.appendChild(row);
            });
        };
        paint();
        el.querySelector('#altiScReset').onclick = () => { Settings.resetShortcuts(); paint(); };
        el.querySelector('#altiIntroAgain').onclick = () => {
            try { localStorage.removeItem('altiview-map-intro-seen'); } catch (e) {}
            el.classList.remove('open');
            if (window.AltiviewMapIntro) window.AltiviewMapIntro.open();
            else window.location.href = 'VFR.html';
        };
        el.querySelector('#altiScDone').onclick = () => el.classList.remove('open');
        el.classList.add('open');
    }

    function openAccount() {
        const acc = Settings.getAccount() || { name: '', email: '' };
        const el = modal('altiAccountModal', 'Mon compte',
            '<p class="alti-hint">Compte local : ces informations restent sur cet appareil et servent à pré-remplir vos dossiers de vol. Aucune donnée n\'est envoyée.</p>'
          + '<div class="alti-field"><label for="altiAccName">Nom du pilote</label><input type="text" id="altiAccName" placeholder="Prénom Nom"></div>'
          + '<div class="alti-field"><label for="altiAccMail">Courriel (facultatif)</label><input type="email" id="altiAccMail" placeholder="pilote@exemple.fr"></div>'
          + '<div class="alti-modal-foot"><span></span><button type="button" class="alti-btn primary" id="altiAccSave">Enregistrer</button></div>');
        el.querySelector('#altiAccName').value = acc.name || '';
        el.querySelector('#altiAccMail').value = acc.email || '';
        el.querySelector('#altiAccSave').onclick = () => {
            Settings.saveAccount({ name: el.querySelector('#altiAccName').value.trim(), email: el.querySelector('#altiAccMail').value.trim() });
            el.classList.remove('open');
        };
        el.classList.add('open');
    }

    const USER_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="M20 21v-1.8A4.2 4.2 0 0 0 15.8 15H8.2A4.2 4.2 0 0 0 4 19.2V21"/><circle cx="12" cy="7.5" r="3.8"/></svg>';

    function initials(name) {
        if (!name) return '—';
        return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    }

    function paintAccount() {
        const btn = document.getElementById('btnAccountMenu');
        if (!btn) return;
        const acc = Settings.getAccount();
        const avatar = btn.querySelector('.hud-avatar');
        if (acc && acc.name) {
            avatar.textContent = initials(acc.name);
            avatar.classList.remove('empty');
        } else {
            avatar.innerHTML = USER_ICON;
            avatar.classList.add('empty');
        }
        btn.querySelector('.hud-account-name').textContent = acc && acc.name ? acc.name : 'Compte';
        const out = document.getElementById('altiSignOut');
        if (out) out.style.display = acc ? 'flex' : 'none';
    }

    function build() {
        styles();
        initSharedHeaderControls();
        const right = document.querySelector('.hud-right');
        if (!right || document.getElementById('btnAccountMenu')) return;

        const gear = document.createElement('button');
        gear.type = 'button';
        gear.id = 'btnAppSettings';
        gear.className = 'hud-icon-btn';
        gear.title = 'Paramètres et raccourcis clavier';
        gear.setAttribute('aria-label', 'Paramètres');
        gear.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
        gear.addEventListener('click', openSettings);

        const wrap = document.createElement('div');
        wrap.className = 'hud-account';
        wrap.innerHTML = `
            <button type="button" class="hud-account-btn" id="btnAccountMenu" aria-haspopup="true" aria-expanded="false">
                <span class="hud-avatar empty"></span><span class="hud-account-name">Compte</span>
            </button>
            <div class="hud-menu" id="accountMenu" role="menu">
                <div class="hud-menu-head">Pilote</div>
                <button type="button" id="altiMyAccount" role="menuitem">Mon compte</button>
                <button type="button" id="altiMyFlights" role="menuitem">Mes vols</button>
                <button type="button" id="altiMyAircraft" role="menuitem">Mes avions</button>
                <button type="button" class="danger" id="altiSignOut" role="menuitem">Se déconnecter</button>
            </div>`;

        right.appendChild(gear);
        right.appendChild(wrap);

        const menu = wrap.querySelector('#accountMenu');
        const btn = wrap.querySelector('#btnAccountMenu');
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const open = menu.classList.toggle('open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', () => menu.classList.remove('open'));
        wrap.querySelector('#altiMyAccount').addEventListener('click', () => { menu.classList.remove('open'); openAccount(); });
        wrap.querySelector('#altiMyFlights').addEventListener('click', () => { window.location.href = 'infos_vol.html'; });
        wrap.querySelector('#altiMyAircraft').addEventListener('click', () => {
            menu.classList.remove('open');
            if (window.AircraftProfiles && typeof window.AircraftProfiles.openModal === 'function') window.AircraftProfiles.openModal('fleet');
            else window.location.href = 'perfo.html';
        });
        wrap.querySelector('#altiSignOut').addEventListener('click', () => { menu.classList.remove('open'); Settings.signOut(); });

        paintAccount();
        placeTools();
        window.addEventListener('resize', placeTools);
    }

    // Sur telephone, Profils / PDF / Donnees rejoignent la barre du haut,
    // a gauche du basculement jour / nuit ; la barre du bas ne garde que les modules.
    function placeTools() {
        const footer = document.querySelector('.sidebar-footer');
        const right = document.querySelector('.hud-right');
        const sidebar = document.querySelector('.tablet-sidebar');
        if (!footer || !right || !sidebar) return;
        const compactLayout = window.innerWidth <= 900;
        if (compactLayout && !footer.classList.contains('in-hud')) {
            right.insertBefore(footer, document.getElementById('themeSwitch') || right.firstChild);
            footer.classList.add('in-hud');
        } else if (!compactLayout && footer.classList.contains('in-hud')) {
            sidebar.appendChild(footer);
            footer.classList.remove('in-hud');
        }
    }

    window.AltiviewSettings = Settings;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
})();
