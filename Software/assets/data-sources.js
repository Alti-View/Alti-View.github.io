/**
 * Altiview — Sources de données
 * Fenêtre commune (préparation + carte) pour brancher les sources officielles.
 *
 * Un navigateur ne peut pas appeler aviationweather.gov, l'API NOTAM de la FAA ni
 * OpenAIP depuis un fichier local : ces serveurs refusent les appels d'une autre
 * origine (règle CORS). La passerelle livrée avec le logiciel
 * (« Lancer_AltiView.command ») sert les pages ET relaie ces sources, ce qui règle
 * le problème et permet d'avoir des données réelles et à jour.
 */
(function () {
    'use strict';

    const KEYS = 'altiview_data_keys_v1';

    const AltiviewData = {
        getKeys() { try { return JSON.parse(localStorage.getItem(KEYS) || '{}'); } catch (e) { return {}; } },
        saveKeys(k) { try { localStorage.setItem(KEYS, JSON.stringify(k)); } catch (e) {} },
        gatewayOk: null,
        async health(force) {
            if (this.gatewayOk !== null && !force) return this.gatewayOk;
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 2500);
                const r = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
                clearTimeout(t);
                this.gatewayOk = r.ok;
            } catch (e) { this.gatewayOk = false; }
            return this.gatewayOk;
        },
        async json(path) {
            const r = await fetch(path, { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        },
        openModal() { ensureModal(); refreshStatus(); document.getElementById('altiDataModal').style.display = 'flex'; },
        closeModal() { const m = document.getElementById('altiDataModal'); if (m) m.style.display = 'none'; }
    };

    function ensureStyles() {
        if (document.getElementById('altiDataStyles')) return;
        const st = document.createElement('style');
        st.id = 'altiDataStyles';
        st.textContent = `
            .alti-data-overlay { display:none; position:fixed; inset:0; background:rgba(4,8,14,.6); backdrop-filter:blur(4px); z-index:99998; align-items:center; justify-content:center; padding:20px; }
            .alti-data-card { background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:16px; width:100%; max-width:620px; max-height:92vh; overflow:auto; box-shadow:var(--shadow); }
            .alti-data-head { display:flex; justify-content:space-between; align-items:center; padding:15px 18px; border-bottom:1px solid var(--line);
                              font-family:var(--f-mono); font-size:12px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--cyan); }
            .alti-data-close { background:none; border:0; color:var(--muted); font-size:22px; line-height:1; cursor:pointer; }
            .alti-data-body { padding:16px 18px 18px; display:flex; flex-direction:column; gap:14px; }
            .alti-data-intro { font-size:12.5px; color:var(--text-secondary); line-height:1.55; margin:0; }
            .alti-status { display:flex; flex-direction:column; gap:6px; }
            .alti-status-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 11px; border:1px solid var(--line); border-radius:10px; background:var(--panel-2); }
            .alti-status-row .lbl { font-size:12.5px; font-weight:600; }
            .alti-status-row .sub { font-size:11px; color:var(--text-secondary); margin-top:1px; }
            .alti-pill { font-family:var(--f-mono); font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:3px 9px; border-radius:20px; white-space:nowrap; border:1px solid; }
            .alti-pill.ok { color:var(--success); border-color:color-mix(in srgb, var(--success) 50%, transparent); background:var(--success-soft); }
            .alti-pill.warn { color:var(--accent-ink); border-color:color-mix(in srgb, var(--accent) 55%, transparent); background:var(--accent-soft); }
            .alti-pill.off { color:var(--text-secondary); border-color:var(--line-strong); }
            .alti-field { display:flex; flex-direction:column; gap:5px; }
            .alti-field label { font-family:var(--f-mono); font-size:10.5px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--text-secondary); }
            .alti-field input { background:var(--panel-2) !important; border:1px solid var(--line) !important; border-radius:8px !important; color:var(--text) !important;
                                font-family:var(--f-mono) !important; font-size:12.5px !important; padding:9px 11px !important; }
            .alti-field .hint { font-size:11px; color:var(--muted); line-height:1.5; }
            .alti-field .hint a { color:var(--cyan); }
            .alti-data-foot { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; padding-top:4px; }
            .alti-btn { font-family:var(--f-mono); font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; padding:9px 14px; border-radius:8px; cursor:pointer;
                        border:1px solid var(--line-strong); background:transparent; color:var(--text); }
            .alti-btn:hover { border-color:var(--cyan); color:var(--cyan); background:var(--cyan-soft); }
            .alti-btn.primary { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
            .alti-btn.primary:hover { background:var(--accent-hover); color:var(--on-accent); }
            .alti-test { font-size:11.5px; color:var(--text-secondary); min-height:16px; }
        `;
        document.head.appendChild(st);
    }

    function ensureModal() {
        ensureStyles();
        if (document.getElementById('altiDataModal')) return;
        const k = AltiviewData.getKeys();
        const wrap = document.createElement('div');
        wrap.className = 'alti-data-overlay';
        wrap.id = 'altiDataModal';
        wrap.innerHTML = `
            <div class="alti-data-card">
                <div class="alti-data-head">
                    <span>Sources de données</span>
                    <button type="button" class="alti-data-close" id="altiDataCloseBtn" aria-label="Fermer">&times;</button>
                </div>
                <div class="alti-data-body">
                    <p class="alti-data-intro">
                        Pour des données réelles et à jour, lancez le logiciel avec <strong>Lancer_AltiView.command</strong> :
                        la passerelle locale relaie les sources officielles que le navigateur refuse d'appeler directement.
                        Les clés ci-dessous sont gratuites et restent sur cet ordinateur.
                    </p>
                    <div class="alti-status" id="altiDataStatus"></div>

                    <div class="alti-field">
                        <label for="altiFaaId">NOTAM — clé API FAA (client_id)</label>
                        <input type="text" id="altiFaaId" placeholder="client_id" value="${(k.faaId || '').replace(/"/g, '&quot;')}" autocomplete="off" spellcheck="false">
                        <input type="password" id="altiFaaSecret" placeholder="client_secret" value="${(k.faaSecret || '').replace(/"/g, '&quot;')}" autocomplete="off" spellcheck="false">
                        <span class="hint">Compte gratuit sur <a href="https://api.faa.gov" target="_blank" rel="noopener noreferrer">api.faa.gov</a> (NOTAM API). Couverture OACI mondiale, terrains français compris.</span>
                    </div>

                    <div class="alti-field">
                        <label for="altiOpenaip">Espaces aériens — clé OpenAIP</label>
                        <input type="password" id="altiOpenaip" placeholder="x-openaip-api-key" value="${(k.openaip || '').replace(/"/g, '&quot;')}" autocomplete="off" spellcheck="false">
                        <span class="hint">Compte gratuit sur <a href="https://www.openaip.net" target="_blank" rel="noopener noreferrer">openaip.net</a> (profil → API key). Données communautaires tenues à jour, non certifiées : la référence reste l'AIP du <a href="https://www.sia.aviation-civile.gouv.fr" target="_blank" rel="noopener noreferrer">SIA</a>.</span>
                    </div>

                    <div class="alti-test" id="altiDataTest"></div>
                    <div class="alti-data-foot">
                        <button type="button" class="alti-btn" id="altiDataTestBtn">Tester les sources</button>
                        <button type="button" class="alti-btn primary" id="altiDataSaveBtn">Enregistrer</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(wrap);

        document.getElementById('altiDataCloseBtn').addEventListener('click', () => AltiviewData.closeModal());
        wrap.addEventListener('click', e => { if (e.target === wrap) AltiviewData.closeModal(); });
        document.getElementById('altiDataSaveBtn').addEventListener('click', () => {
            AltiviewData.saveKeys({
                faaId: document.getElementById('altiFaaId').value.trim(),
                faaSecret: document.getElementById('altiFaaSecret').value.trim(),
                openaip: document.getElementById('altiOpenaip').value.trim()
            });
            const t = document.getElementById('altiDataTest');
            t.textContent = 'Clés enregistrées. Rechargez la page pour les appliquer.';
            refreshStatus();
        });
        document.getElementById('altiDataTestBtn').addEventListener('click', testSources);
    }

    function row(label, sub, state, text) {
        return `<div class="alti-status-row"><div><div class="lbl">${label}</div><div class="sub">${sub}</div></div><span class="alti-pill ${state}">${text}</span></div>`;
    }

    async function refreshStatus() {
        const box = document.getElementById('altiDataStatus');
        if (!box) return;
        box.innerHTML = row('Passerelle locale', 'Vérification…', 'off', '…');
        const ok = await AltiviewData.health(true);
        const k = AltiviewData.getKeys();
        box.innerHTML =
            row('Passerelle locale', ok ? 'Active — sources officielles relayées' : 'Non lancée — ouvrez Lancer_AltiView.command', ok ? 'ok' : 'warn', ok ? 'Active' : 'Inactive')
            + row('METAR / TAF', ok ? 'NOAA (aviationweather.gov), actualisés en direct' : 'Repli VATSIM : METAR seulement, pas de TAF', ok ? 'ok' : 'warn', ok ? 'Officiel' : 'Limité')
            + row('NOTAM', (ok && k.faaId && k.faaSecret) ? 'API FAA, actualisés en direct' : 'Base embarquée non officielle + copier-coller du briefing', (ok && k.faaId && k.faaSecret) ? 'ok' : 'warn', (ok && k.faaId && k.faaSecret) ? 'Officiel' : 'Clé requise')
            + row('Espaces aériens (carte)', (ok && k.openaip) ? 'OpenAIP, chargés autour de la zone affichée' : 'Base embarquée, sans cycle AIRAC vérifié', (ok && k.openaip) ? 'ok' : 'warn', (ok && k.openaip) ? 'OpenAIP' : 'Clé requise');
    }

    async function testSources() {
        const out = document.getElementById('altiDataTest');
        const k = AltiviewData.getKeys();
        out.textContent = 'Test en cours…';
        const lines = [];
        const ok = await AltiviewData.health(true);
        if (!ok) {
            out.textContent = "Passerelle non joignable : lancez « Lancer_AltiView.command », puis rouvrez cette page depuis http://127.0.0.1:8790.";
            return;
        }
        try {
            const m = await AltiviewData.json('/api/metar?ids=LFPN');
            lines.push(Array.isArray(m) && m.length ? `METAR ✓ (${m[0].rawOb ? m[0].rawOb.slice(0, 38) + '…' : 'reçu'})` : 'METAR ✗ (aucune donnée)');
        } catch (e) { lines.push('METAR ✗ (' + e.message + ')'); }
        if (k.faaId && k.faaSecret) {
            try {
                const n = await AltiviewData.json(`/api/notam?icao=LFPN&client_id=${encodeURIComponent(k.faaId)}&client_secret=${encodeURIComponent(k.faaSecret)}`);
                lines.push(n && Array.isArray(n.items) ? `NOTAM ✓ (${n.items.length} reçus)` : 'NOTAM ✗ (réponse inattendue)');
            } catch (e) { lines.push('NOTAM ✗ (clé refusée ou service indisponible)'); }
        } else lines.push('NOTAM — clé FAA non renseignée');
        if (k.openaip) {
            try {
                const a = await AltiviewData.json(`/api/openaip?path=airspaces&limit=1&key=${encodeURIComponent(k.openaip)}`);
                lines.push(a && (a.items || a.totalCount !== undefined) ? 'Espaces aériens ✓' : 'Espaces aériens ✗ (réponse inattendue)');
            } catch (e) { lines.push('Espaces aériens ✗ (clé refusée ou service indisponible)'); }
        } else lines.push('Espaces aériens — clé OpenAIP non renseignée');
        out.innerHTML = lines.join('<br>');
        refreshStatus();
    }

    window.AltiviewData = AltiviewData;

    function bind() {
        document.querySelectorAll('#btnDataSources, .btn-data-sources').forEach(b => {
            if (b.dataset.bound) return;
            b.dataset.bound = '1';
            b.addEventListener('click', e => { e.preventDefault(); AltiviewData.openModal(); });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
})();
