const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require('../data/sia-vfr.js');
const data = require('../aero_data.js');
const integrity = require('../assets/vfr-integrity.js');
const language = require('../assets/vfr-language.js');

test('All source records preserve their coordinates and replace the legacy list', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/sia-vfr-source.json')));
    assert.equal(data.VFR_WAYPOINTS.length, raw.points.length);
    assert.equal(new Set(data.VFR_WAYPOINTS.map(p => p.id)).size, raw.points.length);
    const source = new Map(raw.points.map(p => [String(p.id), p]));
    for (const p of data.VFR_WAYPOINTS) {
        assert.equal(p.publishedLat, source.get(p.sourceId).coordinates.latitude);
        assert.equal(p.publishedLng, source.get(p.sourceId).coordinates.longitude);
        assert.equal(p.compulsory, null);
        assert.equal(p.alt, '');
        assert(Number.isFinite(p.lat) && Number.isFinite(p.lng));
    }
    assert(!data.VFR_WAYPOINTS.some(p => p.id === 'LFPN-N'));
});

test('Airport/code and landmark searches return exact sourced point identities', () => {
    const result = data.searchAll('LFPN S').find(r => r.type === 'vfr' && r.data.code === 'S');
    assert(result);
    assert.equal(result.data.publishedLat, '484235N');
    assert(Math.abs(result.lat - (48 + 42/60 + 35/3600)) < 1e-10);
    assert(!result.sub.includes('undefined'));
    assert(data.searchAll('Ferrières').some(r => r.type === 'vfr'));
});

test('VFR point labels have reversible French display names', () => {
    assert.equal(language.description({ desc: 'VRP-West of Lubec' }, 'fr'), 'À l’ouest de Lubec');
    assert.equal(language.displayName({ desc: 'VRP-Motorway interchange' }, 'fr'), 'Échangeur autoroutier');
    assert.equal(language.description({ desc: 'VRP-West of Lubec' }, 'en'), 'West of Lubec');
    assert.equal(language.description({ desc: '' }, 'fr'), 'Point de report publié par le SIA');
});

test('The main bar provides a persistent French and English VFR language switch', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /id="languageSwitch"/);
    assert.match(html, /data-lang-option="fr"/);
    assert.match(html, /data-lang-option="en"/);
    assert.match(html, /localStorage\.setItem\(VFR_LANGUAGE_KEY, uiLanguage\)/);
    assert.match(html, /spotlightRender\(searchChart\(val\), val\)/);
    assert.match(html, /assets\/vfr-language\.js/);
});

test('The selected aircraft registration and model sit on the left of the main bar', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /<div class="hud-left">[\s\S]*?id="hudAircraftTag"[\s\S]*?<\/div>[\s\S]*?class="spotlight-search-wrap"/);
    const right = html.match(/<div class="hud-right">([\s\S]*?)<\/header>/)?.[1] || '';
    assert.doesNotMatch(right, /id="hudAircraftTag"/);
});

test('Every active module shares the aircraft placement and language control', () => {
    const pages = ['VFR.html', 'meteo.html', 'infos_vol.html', 'perfo.html', 'depart.html', 'checklists.html', 'emergency.html'];
    for (const page of pages) {
        const html = fs.readFileSync(path.join(root, page), 'utf8');
        assert.match(html, /assets\/app-header\.js/, `${page} must load the shared header`);
        assert.match(html, /id="hudAircraftTag"/, `${page} must expose the active aircraft`);
    }

    const header = fs.readFileSync(path.join(root, 'assets/app-header.js'), 'utf8');
    assert.match(header, /function initSharedHeaderControls\(\)/);
    assert.match(header, /brand\.insertAdjacentElement\('afterend', aircraft\)/);
    assert.match(header, /languageSwitch\.innerHTML = '<span data-lang-option="fr">FR<\/span><span data-lang-option="en">EN<\/span>'/);
    assert.match(header, /localStorage\.setItem\(LANGUAGE_KEY, language\)/);
});

test('METAR and TAF refresh automatically without overlapping requests', () => {
    const prep = fs.readFileSync(path.join(root, 'assets/prep.js'), 'utf8');
    const meteo = fs.readFileSync(path.join(root, 'meteo.html'), 'utf8');
    const map = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    const server = fs.readFileSync(path.join(root, 'server.py'), 'utf8');
    assert.match(prep, /const WX_AUTO_REFRESH_MS = 10 \* 60 \* 1000/);
    assert.match(prep, /AltiviewSources\.json\(`\/api\/taf\?ids=\$\{icao\}`\)/);
    assert.match(prep, /if \(wxRefreshInFlight\) return wxRefreshInFlight/);
    assert.match(prep, /requestWeatherAutoRefresh\(true\)/);
    assert.match(prep, /document\.addEventListener\('visibilitychange'/);
    assert.match(prep, /window\.addEventListener\('online'/);
    assert.match(prep, /loadMonitoredAirports\(\);[\s\S]*renderWeatherTable\(\);[\s\S]*startWeatherAutoRefresh\(\);/);
    assert.match(prep, /class="wx-taf-auto"/);
    assert.match(meteo, /METAR \+ TAF AUTO/);
    assert.doesNotMatch(meteo, /id="gatewayStatusBadge"/);
    assert.match(prep, /source: 'NOAA_AWC'/);
    assert.doesNotMatch(prep + map + server, /metar\.vatsim\.net/i);
    assert.match(meteo, /class="wx-official-chart-link"[\s\S]*href="https:\/\/aviation\.meteo\.fr\/login\.php"[\s\S]*WINTEM · TEMSI/);
    assert.doesNotMatch(prep + meteo, /wxChartOverlay|\/api\/aeroweb\/charts/);
});

test('UTC cycle boundaries do not mistake downloaded or future data for current data', () => {
    const m = { count: 1, effectiveFrom: '2026-09-03', effectiveUntil: '2026-10-01' };
    assert.equal(integrity.status(m, new Date('2026-09-02T23:59:59Z')), 'future');
    assert.equal(integrity.status(m, new Date('2026-09-03T00:00:00Z')), 'current');
    assert.equal(integrity.status(m, new Date('2026-09-30T23:59:59Z')), 'current');
    assert.equal(integrity.status(m, new Date('2026-10-01T00:00:00Z')), 'expired');
    assert.equal(integrity.status(null), 'missing');
    assert.equal(integrity.status({ ...m, effectiveUntil: 'bad' }), 'missing');
});

test('Saved route audit flags deletion or relocation without moving the route', () => {
    const p = data.VFR_WAYPOINTS.find(p => p.airport === 'LFPN');
    const route = [{ ...p, vfrSourceId: p.id }];
    assert.equal(integrity.routeIssues(route, [p]).length, 0);
    assert.equal(integrity.routeIssues(route, []).length, 1);
    assert.equal(integrity.routeIssues(route, [{ ...p, lat: p.lat + .01 }]).length, 1);
    assert.equal(route[0].lat, p.lat);
});

test('Missing snapshot never falls back to unsourced points', () => {
    const context = { module: { exports: {} } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'aero_data.js'), 'utf8'), context);
    assert.equal(context.module.exports.VFR_WAYPOINTS.length, 0);
});

test('A sourced VFR point requires an explicit route altitude', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /vfr-planned-altitude[^>]*required/);
    assert.match(html, /if \(vfrSourceId && \(!Number\.isFinite\(plannedAltitude\)/);
    assert.match(html, /alt: vfrSourceId \? plannedAltitude : 3500/);
    assert.match(html, /sel\.type === 'vfr'\)/);
});

test('VFR points use a small simple triangle and established labels', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /vfr-triangle/);
    assert.match(html, /width="14" height="13"/);
    assert.match(html, /iconSize: \[18, 25\], iconAnchor: \[9, 7\]/);
    assert.match(html, /font-size: 9px/);
    assert.doesNotMatch(html, /vfr-labels/);
});

test('Search selection only navigates unless a flight role is explicitly chosen', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /<span><b>Entrée<\/b> afficher<\/span>/);
    assert.match(html, /const mode = e\.shiftKey \? 'departure' : \(\(e\.altKey \|\| e\.ctrlKey \|\| e\.metaKey\) \? 'arrival' : 'goto'\);/);
    assert.doesNotMatch(html, /<span><b>Entrée<\/b> ajouter<\/span>/);
});

test('French airport VAC link opens the current SIA PDF directly', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /function siaVacCyclePath\(\)/);
    assert.match(html, /eAIP_\$\{day\}_\$\{months\[Number\(month\) - 1\]\}_\$\{year\}/);
    assert.match(html, /Atlas-VAC\/PDF_AIPparSSection\/VAC\/AD\/AD-2\.\$\{code\}\.pdf/);
    assert.doesNotMatch(html, /code\.startsWith\('LF'\) \? \{ url: 'https:\/\/www\.sia\.aviation-civile\.gouv\.fr\/vaip'/);
});

test('Airport VAC link is a compact action beside the elevation', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /\.vac-chart-link \{/);
    assert.match(html, /<div class="aero-popup-header">[\s\S]*Elev: \$\{apt\.alt\} ft AMSL[\s\S]*class="vac-chart-link"/);
    assert.doesNotMatch(html, /class="btn-popup-action vac"/);
});

test('Airport popup does not show fuel information', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.doesNotMatch(html, /<span class="aero-popup-label">Fuel<\/span>/);
});

test('Airspace ceiling control accepts a manual altitude', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /window\.prompt\(/);
    assert.match(html, /const chosen = Number\(value\.trim\(\)\);/);
    assert.match(html, /Number\.isInteger\(chosen\) \|\| chosen < 0 \|\| chosen > 60000/);
    assert.doesNotMatch(html, /const ALT_STEPS =/);
});

test('The top SIA information strip is not displayed', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.doesNotMatch(html, /class="vfr-data-strip"/);
    assert.doesNotMatch(html, /id="vfrDataDialog"/);
});

test('Search menu is centered in the top bar', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /\.spotlight-search-wrap \{[\s\S]*left: 50%;[\s\S]*transform: translateX\(-50%\);/);
    assert.doesNotMatch(html, /--map-shift/);
});

test('Touch layouts keep airspace controls compact', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /@media \(min-width: 601px\) and \(max-width: 1100px\) and \(orientation: portrait\)/);
    assert.match(html, /\.chart-ctrl-cluster\.topleft \{ top: 10px; left: 10px; gap: 6px; \}/);
    assert.match(html, /flex-direction: column;/);
    assert.match(html, /max-height: calc\(100dvh - 188px\);/);
    assert.match(html, /width: 28px;/);
    assert.match(html, /Même colonne étroite sur tous les formats/);
    assert.doesNotMatch(html, /grid-template-columns: repeat\(4, 34px\)/);
    assert.match(html, /Rail des calques : icônes nettes, indicateur de sélection discret/);
    assert.match(html, /\.layer-btn\.active::before/);
    assert.match(html, /if \(bar\.parentElement !== home\) home\.appendChild\(bar\);/);
});

test('Compact layouts move secondary tools to the top bar', () => {
    const header = fs.readFileSync(path.join(root, 'assets/app-header.js'), 'utf8');
    assert.match(header, /const compactLayout = window\.innerWidth <= 900;/);
    assert.match(header, /if \(compactLayout && !footer\.classList\.contains\('in-hud'\)\)/);
});

test('iPad flight plan summary is compact and the airspace inspector is hidden', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    assert.match(html, /@media \(min-width: 601px\) and \(max-width: 900px\) \{[\s\S]*\.flight-deck-hud \{[\s\S]*flex-direction: row;/);
    assert.match(html, /\.hud-metric-item:nth-child\(3\), \.hud-metric-item:nth-child\(4\) \{ display: none; \}/);
    assert.match(html, /\.airspace-mini-card,[\s\S]*\.airspace-detail-modal,[\s\S]*#btnInspectorToggle \{ display: none !important; \}/);
});

test('VFR chart uses the lightweight France database and lazy optional tools', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    const slimPath = path.join(root, 'data/aero-fr.js');
    assert.match(html, /<script src="data\/aero-fr\.js"><\/script>/);
    assert.doesNotMatch(html, /<script src="aero_data\.js"><\/script>/);
    assert(fs.statSync(slimPath).size < fs.statSync(path.join(root, 'aero_data.js')).size / 2);
    assert.match(html, /async function loadAircraftProfiles\(\)/);
    assert.match(html, /await loadScriptOnce\('flight_dossier\.js'\)/);
    assert.doesNotMatch(html, /<script src="assets\/three\/three\.global\.js"><\/script>/);
});

test('Every chart inline script parses', () => {
    const html = fs.readFileSync(path.join(root, 'VFR.html'), 'utf8');
    for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
        new vm.Script(match[1]);
    }
    assert(!html.includes('const LiveVfrPoints'));
    assert(!html.includes('Route remains entirely in Uncontrolled Airspace'));
});
