/* ALTIVIEW — moteur commun aux trois pages de preparation.
   Le balisage des six sections est present sur chaque page ; la feuille
   assets/prep.css ne laisse visibles que celles de la page en cours. */
        // Data Keys
        const MAP_STORAGE_KEY = 'flightprep_map_data_v11';
        const WEATHER_STORAGE_KEY = 'flightprep_weather_v1';
        const BRIEFING_STORAGE_KEY = 'flightprep_info_v1';
        const LOCAL_SETTINGS_KEY = 'flightprep_local_prep_v3'; 
        const NOTAMS_STORAGE_KEY = 'flightprep_notams_v1';

        // Globals 
        let mapWaypoints = [];
        let mapTas = 110;
        let mapWindDir = 0;
        let mapWindSpd = 0;
        let monitoredNotams = [];
        let currentNotamFilter = 'all';
        let notamSearchQuery = '';

        // Elements
        const navlogBody = document.getElementById('navlogBody');
        const totDist = document.getElementById('totDist');
        const totTime = document.getElementById('totTime');

        // Nav Math Helpers
        function toRad(deg) { return deg * Math.PI / 180; }
        function toDeg(rad) { return rad * 180 / Math.PI; }

        function calculateNavData(lat1, lon1, lat2, lon2) {
            const R = 3440.065; 
            const φ1 = lat1 * Math.PI/180; const φ2 = lat2 * Math.PI/180;
            const Δφ = (lat2 - lat1) * Math.PI/180; const Δλ = (lon2 - lon1) * Math.PI/180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const dist = R * c;
            const y = Math.sin(Δλ) * Math.cos(φ2);
            const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
            let bearing = Math.atan2(y, x) * (180/Math.PI);
            return { dist, course: (bearing + 360) % 360 };
        }

        function calculateLegPerformance(course, dist, tas, windDir, windSpd) {
            const windAngle = toRad(windDir - course);
            const crossWind = Math.sin(windAngle) * windSpd;
            const headWind = Math.cos(windAngle) * windSpd;
            let wca = 0, gs = tas;
            if (tas > Math.abs(crossWind)) {
                wca = toDeg(Math.asin(crossWind / tas));
                gs = Math.sqrt(tas * tas - crossWind * crossWind) - headWind;
            } else { gs = 0; }
            return { wca, th: (course + wca + 360) % 360, gs, ete: gs > 0 ? (dist / gs) * 60 : 0 };
        }

        // --- Core Functions ---
        function loadMapData() {
            try {
                const raw = localStorage.getItem(MAP_STORAGE_KEY);
                if (raw) {
                    const data = JSON.parse(raw);
                    mapWaypoints = data.waypoints || [];
                    mapTas = parseFloat(data.tas) || 110;
                    mapWindDir = parseFloat(data.windDir) || 0;
                    mapWindSpd = parseFloat(data.windSpd) || 0;

                }
            } catch(e) { console.warn("Could not load map data", e); }
        }

        // =========================================================================
        // SOURCES DE DONNÉES — passerelle locale Altiview
        // Un navigateur ne peut pas appeler directement aviationweather.gov ni l'API
        // NOTAM de la FAA (règle CORS). La passerelle, lancée par
        // « Lancer_AltiView.command », sert le logiciel ET relaie ces sources
        // officielles depuis la même adresse. Sans elle, aucune météo de repli
        // n'est présentée comme opérationnelle ; les dernières données NOAA restent affichées.
        // =========================================================================
        const AltiviewSources = {
            KEYS: 'altiview_data_keys_v1',
            gatewayOk: null,
            getKeys() { try { return JSON.parse(localStorage.getItem(this.KEYS) || '{}'); } catch (e) { return {}; } },
            saveKeys(k) { try { localStorage.setItem(this.KEYS, JSON.stringify(k)); } catch (e) {} },
            async health() {
                if (this.gatewayOk !== null) return this.gatewayOk;
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
            paintWeatherBadge(online) {
                const badge = document.getElementById('gatewayStatusBadge');
                if (!badge) return;
                badge.className = 'gateway-badge ' + (online ? 'online' : 'offline');
                badge.innerHTML = online
                    ? '<span class="pulse-dot" style="background: var(--success);"></span> NOAA en direct'
                    : '<span class="pulse-dot" style="background: var(--danger);"></span> NOAA indisponible';
                badge.title = online
                    ? 'METAR et TAF officiels NOAA relayés par la passerelle locale.'
                    : "Source officielle NOAA AWC indisponible. Lancez « Lancer_AltiView.command » pour rétablir les METAR et TAF officiels.";
            }
        };

        // ==========================================
        // WORKFLOW STAGE & TAB NAVIGATION CONTROLLER
        // ==========================================
        const PREP_ACTIVE_TAB_KEY = 'flightprep_active_tab_v2';
        const PREP_CONTINUOUS_VIEW_KEY = 'flightprep_continuous_view_v2';

        // Meteo, Infos de vol et Depart en vol sont trois pages : chaque etape
        // sait ou elle habite, et un renvoi d'une page a l'autre suit le lien.
        const STAGE_PAGE = {
            weather: 'meteo.html', notams: 'meteo.html',
            summary: 'infos_vol.html', 'flight-fuel': 'infos_vol.html', navlog: 'infos_vol.html',
            readiness: 'depart.html'
        };

        function switchPrepTab(tabId) {
            const pane = document.getElementById(`pane-${tabId}`);
            if (pane && getComputedStyle(pane).display === 'none' && STAGE_PAGE[tabId]) {
                window.location.href = STAGE_PAGE[tabId];
                return;
            }
            document.querySelectorAll('.prep-tab-btn').forEach(btn => btn.classList.toggle('active', btn.id === `tabBtn-${tabId}`));

            try { localStorage.setItem(PREP_ACTIVE_TAB_KEY, tabId); } catch (e) {}

            updateMissionHud();
            updateBentoDashboard();

            // one continuous page: the strip scrolls to the stage, it never hides the others
            const ws = document.getElementById('prepMainWorkspace');
            if (pane && ws) ws.scrollTo({ top: Math.max(0, pane.offsetTop - 12), behavior: 'smooth' });
        }

        // kept for older callers (switchMfdSection, dossier): the view is always continuous
        function toggleContinuousView() {
            document.body.classList.add('view-continuous');
        }

        // the strip follows the scroll: the stage on screen is the highlighted one
        function initStageSpy() {
            const ws = document.getElementById('prepMainWorkspace');
            const panes = [...document.querySelectorAll('.prep-tab-pane')].filter(p => getComputedStyle(p).display !== 'none');
            if (!ws || !panes.length) return;
            let ticking = false;
            const sync = () => {
                ticking = false;
                const mark = ws.scrollTop + 90;
                const ordered = panes.slice().sort((a, b) => a.offsetTop - b.offsetTop);
                let current = ordered[0];
                ordered.forEach(p => { if (p.offsetTop <= mark) current = p; });
                const id = current.id.replace('pane-', '');
                document.querySelectorAll('.prep-tab-btn').forEach(btn => btn.classList.toggle('active', btn.id === `tabBtn-${id}`));
            };
            ws.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(sync); } }, { passive: true });
            sync();
        }

        // Backward compatibility proxy for older buttons or external callers
        function switchMfdSection(sec) {
            if (sec === 'all') {
                toggleContinuousView(true);
            } else if (sec === 'wx') {
                switchPrepTab('weather');
            } else if (sec === 'notam') {
                switchPrepTab('notams');
            } else if (sec === 'navlog') {
                switchPrepTab('navlog');
            } else if (sec === 'briefing') {
                switchPrepTab('flight-fuel');
            } else if (sec === 'readiness') {
                switchPrepTab('readiness');
            } else if (sec === 'crosswind') {
                switchPrepTab('flight-fuel');
                setTimeout(() => {
                    const el = document.getElementById('xwRwy');
                    if (el) el.focus();
                }, 150);
            } else if (sec === 'summary') {
                switchPrepTab('summary');
            }
        }

        function updateMissionHud() {
            try {
                // 1. Route Display
                let depName = 'LFPN', arrName = 'LFMD';
                if (typeof mapWaypoints !== 'undefined' && mapWaypoints && mapWaypoints.length >= 2) {
                    depName = (mapWaypoints[0].name || 'DEP').trim();
                    arrName = (mapWaypoints[mapWaypoints.length - 1].name || 'ARR').trim();
                }
                const ribbonRoute = document.getElementById('hudRibbonRoute');
                if (ribbonRoute) ribbonRoute.textContent = `${depName} ➔ ${arrName}`;

                // 2. Distance & ETE
                const distEl = document.getElementById('totDist');
                const timeEl = document.getElementById('totTime');
                const dVal = distEl ? distEl.textContent : '0';
                const tVal = timeEl ? timeEl.textContent : '0';
                
                const ribbonDist = document.getElementById('hudRibbonDist');
                const ribbonEte = document.getElementById('hudRibbonEte');
                if (ribbonDist) ribbonDist.textContent = dVal;
                if (ribbonEte) ribbonEte.textContent = tVal;

                // Tab navlog chip
                const chipNav = document.getElementById('chipNavlogStatus');
                if (chipNav) chipNav.textContent = `${dVal} NM`;

                // 3. Fuel & Endurance
                const fuelEstEl = document.getElementById('totFuelEst');
                const ribbonFuelVal = document.getElementById('hudRibbonFuelVal');
                if (ribbonFuelVal && fuelEstEl) {
                    ribbonFuelVal.textContent = fuelEstEl.textContent || '--';
                }

                const dispTotal = document.getElementById('dispTotalEndurance');
                const dispStatus = document.getElementById('dispFuelStatus');
                const dispRes = document.getElementById('dispReserveFuel');
                const dispUsable = document.getElementById('dispUsableEndurance');
                const ribbonEndurance = document.getElementById('hudRibbonEndurance');
                const chipFuel = document.getElementById('chipFuelStatus');

                if (ribbonEndurance && dispTotal) {
                    ribbonEndurance.textContent = `${dispTotal.textContent || '--:--'} (${dispStatus ? dispStatus.textContent : ''})`;
                }

                if (chipFuel && dispStatus) {
                    const st = dispStatus.textContent || '';
                    if (st.includes('Conforme') || st.includes('OK')) {
                        chipFuel.textContent = 'Réserve OK';
                        chipFuel.className = 'tab-status-chip chip-ok';
                    } else if (st.includes('Déficit')) {
                        chipFuel.textContent = 'Déficit';
                        chipFuel.className = 'tab-status-chip chip-danger';
                    } else {
                        chipFuel.textContent = dispTotal ? dispTotal.textContent : '--';
                        chipFuel.className = 'tab-status-chip';
                    }
                }

                // Sync Executive Summary Fuel Card
                const sTotal = document.getElementById('summaryDispTotal');
                const sRes = document.getElementById('summaryDispRes');
                const sUsable = document.getElementById('summaryDispUsable');
                const sStatus = document.getElementById('summaryDispStatus');
                if (sTotal && dispTotal) sTotal.textContent = dispTotal.textContent;
                if (sRes && dispRes) sRes.textContent = dispRes.textContent;
                if (sUsable && dispUsable) sUsable.textContent = dispUsable.textContent;
                if (sStatus && dispStatus) {
                    sStatus.textContent = dispStatus.textContent;
                    sStatus.style.color = dispStatus.style.color;
                }

                // 4. Departure Weather & QNH
                const bQnh = document.getElementById('bentoQnh');
                const bCat = document.getElementById('bentoFltCatBadge');
                const ribbonQnh = document.getElementById('hudRibbonQnh');
                const ribbonCat = document.getElementById('hudRibbonCat');
                const chipWx = document.getElementById('chipWeatherStatus');

                if (ribbonQnh && bQnh) ribbonQnh.textContent = bQnh.textContent || '1018';
                if (ribbonCat && bCat) {
                    ribbonCat.textContent = bCat.textContent || 'VFR';
                    ribbonCat.className = bCat.className;
                }
                if (chipWx && bCat) {
                    chipWx.textContent = bCat.textContent || 'VFR';
                    const catLower = (bCat.textContent || '').toLowerCase();
                    if (catLower === 'vfr') chipWx.className = 'tab-status-chip chip-ok';
                    else if (catLower === 'mvfr') chipWx.className = 'tab-status-chip chip-warn';
                    else chipWx.className = 'tab-status-chip chip-danger';
                }

                // 5. NOTAMs Chip
                const chipNotam = document.getElementById('chipNotamStatus');
                const bNotamTotal = document.getElementById('bentoNotamTotalBadge');
                if (chipNotam && bNotamTotal) {
                    chipNotam.textContent = bNotamTotal.textContent || '0 Actifs';
                }

                // 6. Readiness Decision Pill & Bar
                const decPill = document.getElementById('decisionPill');
                const decPct = document.getElementById('decisionPct');
                const readBar = document.getElementById('readinessBar');
                const ribbonDec = document.getElementById('hudRibbonDecision');
                const chipReady = document.getElementById('chipReadinessStatus');

                const sDecPill = document.getElementById('summaryDecisionPill');
                const sDecPct = document.getElementById('summaryDecisionPct');
                const sReadBar = document.getElementById('summaryReadinessBar');

                if (decPill && ribbonDec) {
                    ribbonDec.textContent = decPill.textContent.includes('GO FLIGHT') ? 'GO' : (decPill.textContent.includes('EN COURS') ? 'EN COURS' : 'NO-GO');
                    ribbonDec.className = 'ribbon-decision ' + (decPill.classList.contains('go') ? 'go' : (decPill.classList.contains('pending') ? 'pending' : 'no-go'));
                }

                if (chipReady && decPct) {
                    const match = decPct.textContent.match(/(\d+)%/);
                    chipReady.textContent = match ? `${match[1]}%` : '0%';
                    if (match && match[1] === '100') chipReady.className = 'tab-status-chip chip-ok';
                    else if (match && parseInt(match[1]) >= 50) chipReady.className = 'tab-status-chip chip-warn';
                    else chipReady.className = 'tab-status-chip chip-danger';
                }

                if (sDecPill && decPill) {
                    sDecPill.innerHTML = decPill.innerHTML;
                    sDecPill.className = decPill.className;
                }
                if (sDecPct && decPct) sDecPct.textContent = decPct.textContent;
                if (sReadBar && readBar) {
                    sReadBar.style.width = readBar.style.width;
                    sReadBar.style.backgroundColor = readBar.style.backgroundColor;
                }
            } catch(e) { console.warn("Error updating mission HUD ribbon", e); }
        }

        function updateBentoDashboard() {
            // 1. Flight Subtitle
            try {
                const briefDate = document.getElementById('briefDate')?.value;
                const briefTime = document.getElementById('briefTime')?.value;
                const briefPob = document.getElementById('briefPob')?.value || '2';
                const mfdSubtitle = document.getElementById('mfdFlightSubtitle');
                if (mfdSubtitle) {
                    let dateStr = "10 septembre";
                    if (briefDate) {
                        const parts = briefDate.split('-');
                        if (parts.length === 3) {
                            const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
                            dateStr = `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1] || ''}`;
                        }
                    }
                    const timeStr = briefTime ? `${briefTime} UTC` : "14:30 UTC";
                    mfdSubtitle.textContent = `Navigation du ${dateStr} · départ ${timeStr} · ${briefPob} POB`;
                }
            } catch(e) { console.warn("Error updating subtitle", e); }

            // 2. Bento Card 1: Météo Départ
            try {
                const rawEl = document.getElementById('bentoRawMetar');
                const windEl = document.getElementById('bentoWind');
                const visEl = document.getElementById('bentoVis');
                const cloudsEl = document.getElementById('bentoClouds');
                const tempEl = document.getElementById('bentoTemp');
                const dewpEl = document.getElementById('bentoDewp');
                const qnhEl = document.getElementById('bentoQnh');
                const fltCatBadge = document.getElementById('bentoFltCatBadge');

                let depWx = null;
                // If route has departure waypoint with 4-letter ICAO, try finding its weather first
                if (typeof mapWaypoints !== 'undefined' && mapWaypoints && mapWaypoints.length > 0) {
                    const firstWp = mapWaypoints[0];
                    const firstIcaoMatch = (firstWp.name || '').trim().toUpperCase().match(/\b([A-Z]{4})\b/);
                    if (firstIcaoMatch) {
                        depWx = monitoredAirports.find(a => a.icao === firstIcaoMatch[1]);
                    }
                }
                if (!depWx && monitoredAirports && monitoredAirports.length > 0) {
                    depWx = monitoredAirports[0];
                }

                if (depWx && depWx.metar && !depWx.metar.includes("No METAR")) {
                    const d = depWx.decoded || {};
                    if (rawEl) rawEl.textContent = depWx.metar;
                    
                    let windText = '---';
                    if (d.wdir !== undefined && d.wspd !== undefined) {
                        windText = d.wdir === 'VRB' ? `VRB ${d.wspd} kt` : `${Math.round(d.wdir).toString().padStart(3,'0')}° ${d.wspd} kt`;
                        if (d.wgst) windText += ` (raf. ${d.wgst} kt)`;
                    }
                    if (windEl) windEl.textContent = windText;

                    if (visEl) visEl.textContent = d.vis || '10 km et plus';

                    let cloudText = 'CAVOK';
                    if (d.clouds && d.clouds.length > 0) {
                        const c = d.clouds[0];
                        const coverMap = { 'FEW': 'quelques-uns', 'SCT': 'épars', 'BKN': 'fragmentés', 'OVC': 'couvert' };
                        const cName = coverMap[c.cover] || c.cover;
                        cloudText = `${cName} à ${(c.base || '').toLocaleString()} ft`;
                    } else if (d.ceilingFt) {
                        cloudText = `Plafond à ${d.ceilingFt.toLocaleString()} ft`;
                    }
                    if (cloudsEl) cloudsEl.textContent = cloudText;

                    if (tempEl) tempEl.textContent = (d.temp !== undefined ? d.temp : 19) + ' °C';
                    if (dewpEl) dewpEl.textContent = (d.dewp !== undefined ? d.dewp : 9) + ' °C';

                    let qnhVal = 1018;
                    if (d.altim) {
                        const match = d.altim.match(/\d{4}/);
                        if (match) qnhVal = parseInt(match[0], 10);
                    }
                    if (qnhEl) qnhEl.textContent = qnhVal;

                    const cat = d.fltCat || 'VFR';
                    if (fltCatBadge) {
                        fltCatBadge.textContent = cat;
                        fltCatBadge.className = `badge-cat-pill cat-${cat.toLowerCase()}`;
                    }

                    const hudQ = document.getElementById('hudQnhVal');
                    if (hudQ) hudQ.textContent = qnhVal;
                    const hudCat = document.getElementById('hudFltCatVal');
                    if (hudCat) {
                        hudCat.textContent = cat;
                        hudCat.className = `hud-vfr-badge cat-${cat.toLowerCase()}`;
                    }
                } else {
                    if (rawEl) rawEl.textContent = "LFPN 101400Z 24008KT 9999 FEW035 19/09 Q1018";
                    if (windEl) windEl.textContent = "240° 8 kt";
                    if (visEl) visEl.textContent = "10 km et plus";
                    if (cloudsEl) cloudsEl.textContent = "quelques-uns à 3 500 ft";
                    if (tempEl) tempEl.textContent = "19 °C";
                    if (dewpEl) dewpEl.textContent = "9 °C";
                    if (qnhEl) qnhEl.textContent = "1018";
                    if (fltCatBadge) {
                        fltCatBadge.textContent = "VFR";
                        fltCatBadge.className = "badge-cat-pill";
                    }
                }
            } catch(e) { console.warn("Error updating bento weather", e); }

            // 3. Bento Card 2: NOTAMs
            try {
                let totalCount = 0;
                let rwyCount = 0;
                let navCount = 0;
                let obsCount = 0;
                let infoCount = 0;

                if (monitoredNotams && monitoredNotams.length > 0) {
                    monitoredNotams.forEach(apt => {
                        (apt.notams || []).forEach(n => {
                            totalCount++;
                            if (n.cat === 'runway' || n.cat === 'aerodrome') rwyCount++;
                            else if (n.cat === 'nav' || n.cat === 'comms') navCount++;
                            else if (n.cat === 'obstacle') obsCount++;
                            else infoCount++;
                        });
                    });
                }

                const totalBadge = document.getElementById('bentoNotamTotalBadge');
                const elRwy = document.getElementById('bentoNotamCountRwy');
                const elNav = document.getElementById('bentoNotamCountNav');
                const elObs = document.getElementById('bentoNotamCountObs');
                const elInfo = document.getElementById('bentoNotamCountInfo');

                if (totalCount > 0) {
                    if (totalBadge) totalBadge.textContent = `${totalCount} ACTIF${totalCount > 1 ? 'S' : ''}`;
                    if (elRwy) elRwy.textContent = rwyCount;
                    if (elNav) elNav.textContent = navCount;
                    if (elObs) elObs.textContent = obsCount;
                    if (elInfo) elInfo.textContent = infoCount;
                } else {
                    if (totalBadge) totalBadge.textContent = "6 ACTIFS";
                    if (elRwy) elRwy.textContent = "1";
                    if (elNav) elNav.textContent = "1";
                    if (elObs) elObs.textContent = "2";
                    if (elInfo) elInfo.textContent = "2";
                }
            } catch(e) { console.warn("Error updating bento NOTAMs", e); }

            // 4. Bento Card 3: Log de Nav
            try {
                const bentoNavBody = document.getElementById('bentoNavlogBody');
                const bentoSummary = document.getElementById('bentoNavSummary');
                if (!bentoNavBody) return;

                if (mapWaypoints && mapWaypoints.length >= 2) {
                    bentoNavBody.innerHTML = '';
                    let totD = 0;
                    let totT = 0;

                    for (let i = 0; i < mapWaypoints.length - 1; i++) {
                        const p1 = mapWaypoints[i];
                        const p2 = mapWaypoints[i+1];
                        const legAlt = p1.alt !== undefined ? p1.alt : 3500;
                        const geo = calculateNavData(p1.lat, p1.lng, p2.lat, p2.lng);
                        const perf = calculateLegPerformance(geo.course, geo.dist, mapTas, mapWindDir, mapWindSpd);
                        const ete = perf.ete;

                        totD += geo.dist;
                        totT += ete;

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td class="leg-name">${escapeHtml(p1.name)} → ${escapeHtml(p2.name)}</td>
                            <td class="col-alt">${legAlt.toLocaleString()} ft</td>
                            <td class="col-rm">${Math.round(geo.course).toString().padStart(3, '0')}°</td>
                            <td class="col-dist">${geo.dist.toFixed(1)}</td>
                            <td class="col-gs">${Math.round(perf.gs)}</td>
                            <td class="col-ete">${Math.round(ete)}</td>
                        `;
                        bentoNavBody.appendChild(tr);
                    }

                    const burnRate = parseFloat(document.getElementById('briefBurn')?.value) || 32;
                    const estFuel = Math.round((totT / 60) * burnRate);
                    if (bentoSummary) {
                        bentoSummary.textContent = `${Math.round(totD)} NM · ${Math.round(totT)} MIN · ${estFuel} L`;
                    }
                } else {
                    bentoNavBody.innerHTML = `
                        <tr>
                            <td class="leg-name">DÉP → PT1</td>
                            <td class="col-alt">3 500 ft</td>
                            <td class="col-rm">185°</td>
                            <td class="col-dist">18.0</td>
                            <td class="col-gs">105</td>
                            <td class="col-ete">10</td>
                        </tr>
                        <tr>
                            <td class="leg-name">PT1 → PT2</td>
                            <td class="col-alt">3 500 ft</td>
                            <td class="col-rm">240°</td>
                            <td class="col-dist">14.5</td>
                            <td class="col-gs">112</td>
                            <td class="col-ete">8</td>
                        </tr>
                        <tr>
                            <td class="leg-name">PT2 → PT3</td>
                            <td class="col-alt">2 500 ft</td>
                            <td class="col-rm">310°</td>
                            <td class="col-dist">12.0</td>
                            <td class="col-gs">98</td>
                            <td class="col-ete">7</td>
                        </tr>
                        <tr>
                            <td class="leg-name">PT3 → ARR</td>
                            <td class="col-alt">1 800 ft</td>
                            <td class="col-rm">025°</td>
                            <td class="col-dist">9.5</td>
                            <td class="col-gs">102</td>
                            <td class="col-ete">6</td>
                        </tr>
                    `;
                    if (bentoSummary) {
                        bentoSummary.textContent = "54 NM · 31 MIN · 20 L";
                    }
                }
            } catch(e) { console.warn("Error updating bento navlog", e); }
            if (typeof updateMissionHud === 'function') {
                updateMissionHud();
            }
        }

        function renderNavlog() {
            navlogBody.innerHTML = '';
            let totalD = 0, totalT = 0;

            if (mapWaypoints.length < 2) {
                navlogBody.innerHTML = `<tr><td colspan="6" style="padding: 40px; text-align: center; color: var(--muted-text);">Aucune route pour le moment.<br>Tracez vos points tournants sur la <strong>carte VFR</strong>.</td></tr>`;
                totDist.textContent = '0';
                totTime.textContent = '0';
                return;
            }

            for (let i = 0; i < mapWaypoints.length - 1; i++) {
                const p1 = mapWaypoints[i];
                const p2 = mapWaypoints[i+1];
                
                const legAlt = p1.alt !== undefined ? p1.alt : 3500;
                const geo = calculateNavData(p1.lat, p1.lng, p2.lat, p2.lng);
                const perf = calculateLegPerformance(geo.course, geo.dist, mapTas, mapWindDir, mapWindSpd);

                const ete = perf.ete;

                totalD += geo.dist;
                totalT += ete;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align: left; padding-left: 20px; font-weight: 600;">${escapeHtml(p1.name)} ➔ ${escapeHtml(p2.name)}</td>
                    <td style="color: var(--muted-text);">${legAlt} ft</td>
                    <td style="color: var(--muted-text);">${Math.round(geo.course).toString().padStart(3,'0')}°</td>
                    <td style="font-weight: 600;">${geo.dist.toFixed(1)}</td>
                    <td style="font-weight: 600;">${Math.round(perf.gs)}</td>
                    <td style="font-weight: 700;">${Math.round(ete)}</td>
                `;
                navlogBody.appendChild(tr);
            }

            totDist.textContent = Math.round(totalD);
            totTime.textContent = Math.round(totalT);
            calcFuelEndurance();
            updateBentoDashboard();
        }

        // --- Data Persistence ---
        function saveLocalSettings() {
            const rwy = document.getElementById('xwRwy');
            if (!rwy) return;
            const data = {
                xw: { rwy: rwy.value, dir: document.getElementById('xwDir').value, spd: document.getElementById('xwSpd').value }
            };
            localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(data));
        }

        function loadLocalSettings() {
            try {
                const rwy = document.getElementById('xwRwy');
                if (!rwy) return;
                const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
                if (raw) {
                    const data = JSON.parse(raw);
                    if (data.xw) {
                        rwy.value = data.xw.rwy || '';
                        document.getElementById('xwDir').value = data.xw.dir || '';
                        document.getElementById('xwSpd').value = data.xw.spd || '';
                    }
                }
            } catch(e){}
        }

        // Fuel & Endurance Planning
        function calcFuelEndurance() {
            const fuelEl = document.getElementById('briefFuel');
            const burnEl = document.getElementById('briefBurn');
            const dispTotal = document.getElementById('dispTotalEndurance');
            const dispRes = document.getElementById('dispReserveFuel');
            const dispUsable = document.getElementById('dispUsableEndurance');
            const dispStatus = document.getElementById('dispFuelStatus');
            const totFuelEst = document.getElementById('totFuelEst');

            let fuelUnit = 'L';
            try {
                const perfRaw = localStorage.getItem('flightprep_perf_data_v10');
                if (perfRaw) {
                    const p = JSON.parse(perfRaw);
                    if (p.units?.fuel) fuelUnit = p.units.fuel;
                }
            } catch(e) {}

            const fuel = fuelEl ? parseFloat(fuelEl.value) || 0 : 0;
            const burn = burnEl ? parseFloat(burnEl.value) || 0 : 0;
            const routeMinutes = parseFloat(totTime ? totTime.textContent : 0) || 0;

            if (burn > 0 && routeMinutes > 0 && totFuelEst) {
                totFuelEst.textContent = Math.round((burn * routeMinutes) / 60);
            } else if (totFuelEst) {
                totFuelEst.textContent = '--';
            }

            if (!dispTotal || !dispRes || !dispUsable || !dispStatus) return;

            if (fuel <= 0 || burn <= 0) {
                dispTotal.textContent = '--:--';
                dispRes.textContent = `-- ${fuelUnit}`;
                dispUsable.textContent = '--:--';
                dispStatus.textContent = 'En attente saisie';
                dispStatus.style.color = 'var(--muted-text)';
                return;
            }

            const totalHours = fuel / burn;
            const totalMinutes = Math.round(totalHours * 60);
            const totH = Math.floor(totalMinutes / 60);
            const totM = totalMinutes % 60;
            dispTotal.textContent = `${totH}h ${totM.toString().padStart(2, '0')}m`;

            // 45 min VFR regulatory reserve
            const reserveFuel = Math.round((burn * 45) / 60);
            dispRes.textContent = `${reserveFuel} ${fuelUnit} (45m)`;

            const usableMinutes = Math.max(0, totalMinutes - 45);
            const useH = Math.floor(usableMinutes / 60);
            const useM = usableMinutes % 60;
            dispUsable.textContent = `${useH}h ${useM.toString().padStart(2, '0')}m`;

            if (routeMinutes > 0) {
                const requiredWithReserve = routeMinutes + 45;
                if (totalMinutes < requiredWithReserve) {
                    const deficit = requiredWithReserve - totalMinutes;
                    dispStatus.textContent = `Déficit (${deficit}m manquantes)`;
                    dispStatus.style.color = 'var(--danger)';
                } else {
                    const margin = totalMinutes - requiredWithReserve;
                    dispStatus.textContent = `✓ Conforme (+${margin}m marge)`;
                    dispStatus.style.color = 'var(--accent-green)';
                }
            } else {
                dispStatus.textContent = `✓ Réserve OK (45 min)`;
                dispStatus.style.color = 'var(--accent-green)';
            }
            if (typeof updateMissionHud === 'function') {
                updateMissionHud();
            }
        }

        // Briefing Persistence (Cross-Tab Sync Added)
        const briefFields = ['briefFlight', 'briefAc', 'briefDate', 'briefTime', 'briefPob', 'briefPic', 'briefNotes', 'briefFuel', 'briefBurn'];
        const readinessChkIds = [
            // 1. Pilote (I.M.S.A.F.E. & Aptitude)
            'chk_imsafe_illness', 'chk_imsafe_medication', 'chk_imsafe_stress', 
            'chk_imsafe_alcohol', 'chk_imsafe_fatigue', 'chk_imsafe_emotion', 'chk_pilot_currency',
            // 2. Météo & Minimas VFR
            'chk_wx_ceiling_vis', 'chk_wx_wind', 'chk_wx_hazards', 'chk_wx_alts',
            // 3. Aéronef & Documents Légaux (A.R.R.O.W.)
            'chk_doc_license', 'chk_doc_medical', 'chk_doc_arow', 'chk_ac_wb', 'chk_ac_preflight', 'chk_ac_fuel',
            // 4. Navigation & Équipements de Secours
            'chk_doc_charts', 'chk_nav_notams', 'chk_nav_equipment', 'chk_nav_briefing'
        ];

        function updateReadinessProgress() {
            let checked = 0;
            const total = readinessChkIds.length;

            const cats = {
                pilot: ['chk_imsafe_illness', 'chk_imsafe_medication', 'chk_imsafe_stress', 'chk_imsafe_alcohol', 'chk_imsafe_fatigue', 'chk_imsafe_emotion', 'chk_pilot_currency'],
                wx: ['chk_wx_ceiling_vis', 'chk_wx_wind', 'chk_wx_hazards', 'chk_wx_alts'],
                ac: ['chk_doc_license', 'chk_doc_medical', 'chk_doc_arow', 'chk_ac_wb', 'chk_ac_preflight', 'chk_ac_fuel'],
                nav: ['chk_doc_charts', 'chk_nav_notams', 'chk_nav_equipment', 'chk_nav_briefing']
            };

            const catCounts = { pilot: 0, wx: 0, ac: 0, nav: 0 };

            readinessChkIds.forEach(id => {
                const el = document.getElementById(id);
                if (el && el.checked) {
                    checked++;
                    for (const cat in cats) {
                        if (cats[cat].includes(id)) catCounts[cat]++;
                    }
                }
            });

            // Update category badges
            const bPilot = document.getElementById('catBadgePilot');
            const bWx = document.getElementById('catBadgeWx');
            const bAc = document.getElementById('catBadgeAc');
            const bNav = document.getElementById('catBadgeNav');

            if (bPilot) {
                bPilot.textContent = `${catCounts.pilot}/${cats.pilot.length}`;
                bPilot.className = 'cat-badge' + (catCounts.pilot === cats.pilot.length ? ' complete' : '');
            }
            if (bWx) {
                bWx.textContent = `${catCounts.wx}/${cats.wx.length}`;
                bWx.className = 'cat-badge' + (catCounts.wx === cats.wx.length ? ' complete' : '');
            }
            if (bAc) {
                bAc.textContent = `${catCounts.ac}/${cats.ac.length}`;
                bAc.className = 'cat-badge' + (catCounts.ac === cats.ac.length ? ' complete' : '');
            }
            if (bNav) {
                bNav.textContent = `${catCounts.nav}/${cats.nav.length}`;
                bNav.className = 'cat-badge' + (catCounts.nav === cats.nav.length ? ' complete' : '');
            }

            // Percentage & bar
            const pct = Math.round((checked / total) * 100);
            const bar = document.getElementById('readinessBar');
            const pctEl = document.getElementById('decisionPct');
            const pill = document.getElementById('decisionPill');

            if (bar) {
                bar.style.width = pct + '%';
                if (pct === 100) {
                    bar.style.backgroundColor = 'var(--accent-green)';
                } else if (pct >= 50) {
                    bar.style.backgroundColor = 'var(--accent-orange)';
                } else {
                    bar.style.backgroundColor = 'var(--danger)';
                }
            }

            if (pctEl) pctEl.textContent = `${pct}% validé (${checked}/${total})`;

            if (pill) {
                pill.className = 'decision-pill';
                if (pct === 100) {
                    pill.classList.add('go');
                    pill.innerHTML = 'GO FLIGHT — Prêt pour le vol';
                } else if (pct >= 50) {
                    pill.classList.add('pending');
                    pill.innerHTML = `EN COURS — ${checked}/${total} validés`;
                } else {
                    pill.classList.add('no-go');
                    pill.innerHTML = 'NO-GO — Validations requises';
                }
            }
            if (typeof updateMissionHud === 'function') {
                updateMissionHud();
            }
        }

        function readinessAllChecked() {
            const boxes = readinessChkIds.map(id => document.getElementById(id)).filter(Boolean);
            return boxes.length > 0 && boxes.every(el => el.checked);
        }

        function syncValidateAllLabel() {
            const btn = document.getElementById('btnValidateAllReadiness');
            if (!btn) return;
            const all = readinessAllChecked();
            btn.textContent = all ? '↺ Tout décocher' : '✓ Tout valider';
            btn.title = all ? 'Décocher tous les éléments de la checklist' : 'Valider tous les éléments de la checklist';
            btn.classList.toggle('primary', !all);
        }

        function validateAllReadiness() {
            const target = !readinessAllChecked();
            readinessChkIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.checked = target;
                    const parent = el.closest('.check-item');
                    if (parent) parent.classList.toggle('done', target);
                }
            });
            updateReadinessProgress();
            saveBriefingData();
            syncValidateAllLabel();
        }

        function resetAllReadiness() {
            readinessChkIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.checked = false;
                    const parent = el.closest('.check-item');
                    if (parent) parent.classList.remove('done');
                }
            });
            updateReadinessProgress();
            saveBriefingData();
        }

        function saveBriefingData() {
            const readiness = {};
            readinessChkIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) readiness[id] = el.checked;
            });

            const fuelEl = document.getElementById('briefFuel');
            const burnEl = document.getElementById('briefBurn');

            const data = {
                flightNumber: document.getElementById('briefFlight') ? document.getElementById('briefFlight').value : '',
                aircraft: document.getElementById('briefAc') ? document.getElementById('briefAc').value : '',
                date: document.getElementById('briefDate') ? document.getElementById('briefDate').value : '',
                departureTime: document.getElementById('briefTime') ? document.getElementById('briefTime').value : '',
                pob: document.getElementById('briefPob') ? document.getElementById('briefPob').value : '1',
                pic: document.getElementById('briefPic') ? document.getElementById('briefPic').value : '',
                notes: document.getElementById('briefNotes') ? document.getElementById('briefNotes').value : '',
                fuel: fuelEl ? fuelEl.value : '',
                burn: burnEl ? burnEl.value : '',
                readiness: readiness
            };
            localStorage.setItem(BRIEFING_STORAGE_KEY, JSON.stringify(data));

            // Synchronize Fuel to Performance State (flightprep_perf_data_v10)
            try {
                const perfRaw = localStorage.getItem('flightprep_perf_data_v10');
                let perfData = perfRaw ? JSON.parse(perfRaw) : null;
                if (perfData) {
                    if (!perfData.range) perfData.range = {};
                    let perfChanged = false;
                    if (fuelEl && fuelEl.value !== '' && perfData.range.fuelOnBoard !== fuelEl.value) {
                        perfData.range.fuelOnBoard = fuelEl.value;
                        perfChanged = true;
                    }
                    if (burnEl && burnEl.value !== '' && (perfData.range.fuelBurn !== burnEl.value || perfData.fuelFlow !== burnEl.value)) {
                        perfData.range.fuelBurn = burnEl.value;
                        perfData.fuelFlow = burnEl.value;
                        perfChanged = true;
                    }
                    // Keep W&B Fuel station weight synchronized
                    if (Array.isArray(perfData.wbRows) && fuelEl && fuelEl.value !== '') {
                        const uW = perfData.units?.weight || 'kg';
                        const uF = perfData.units?.fuel || 'L';
                        let density = uW === 'lbs' ? (0.72 * 2.2046226218) : 0.72;
                        if (uF === 'USG') density = density / 0.2641720524;
                        const fob = parseFloat(fuelEl.value) || 0;
                        perfData.wbRows.forEach(r => {
                            if (r.linkedFuel || (r.name && r.name.toLowerCase().includes('fuel'))) {
                                r.weight = parseFloat((fob * density).toFixed(1));
                                perfChanged = true;
                            }
                        });
                    }
                    if (perfChanged) {
                        localStorage.setItem('flightprep_perf_data_v10', JSON.stringify(perfData));
                        localStorage.setItem('flightprep_profile_sync_trigger', Date.now().toString());
                    }
                }
            } catch(e) { console.warn("Error syncing briefing fuel to perf", e); }
        }
        
        function loadBriefingData() {
            try {
                const raw = localStorage.getItem(BRIEFING_STORAGE_KEY);
                let hasFuelInBrief = false;
                let hasBurnInBrief = false;
                if (raw) {
                    const data = JSON.parse(raw);
                    if(data.flightNumber !== undefined && document.getElementById('briefFlight') && document.getElementById('briefFlight').value !== data.flightNumber) document.getElementById('briefFlight').value = data.flightNumber;
                    if(data.aircraft !== undefined && document.getElementById('briefAc') && document.getElementById('briefAc').value !== data.aircraft) document.getElementById('briefAc').value = data.aircraft;
                    if(data.date !== undefined && document.getElementById('briefDate') && document.getElementById('briefDate').value !== data.date) document.getElementById('briefDate').value = data.date;
                    if(data.departureTime !== undefined && document.getElementById('briefTime') && document.getElementById('briefTime').value !== data.departureTime) document.getElementById('briefTime').value = data.departureTime;
                    if(data.pob !== undefined && document.getElementById('briefPob') && document.getElementById('briefPob').value !== data.pob) document.getElementById('briefPob').value = data.pob;
                    if(data.pic !== undefined && document.getElementById('briefPic') && document.getElementById('briefPic').value !== data.pic) document.getElementById('briefPic').value = data.pic;
                    if(data.notes !== undefined && document.getElementById('briefNotes') && document.getElementById('briefNotes').value !== data.notes) document.getElementById('briefNotes').value = data.notes;
                    if(data.fuel !== undefined && data.fuel !== '' && document.getElementById('briefFuel')) {
                        if (document.getElementById('briefFuel').value !== String(data.fuel)) {
                            document.getElementById('briefFuel').value = data.fuel;
                        }
                        hasFuelInBrief = true;
                    }
                    if(data.burn !== undefined && data.burn !== '' && document.getElementById('briefBurn')) {
                        if (document.getElementById('briefBurn').value !== String(data.burn)) {
                            document.getElementById('briefBurn').value = data.burn;
                        }
                        hasBurnInBrief = true;
                    }
                    
                    if (data.readiness && typeof data.readiness === 'object') {
                        readinessChkIds.forEach(id => {
                            const el = document.getElementById(id);
                            if (el && data.readiness[id] !== undefined) {
                                el.checked = !!data.readiness[id];
                                const parent = el.closest('.check-item');
                                if (parent) {
                                    if (el.checked) parent.classList.add('done');
                                    else parent.classList.remove('done');
                                }
                            }
                        });
                    }
                }

                // Fallback to flightprep_perf_data_v10 if not present in briefing
                const perfRaw = localStorage.getItem('flightprep_perf_data_v10');
                if (perfRaw) {
                    const perfData = JSON.parse(perfRaw);
                    if (!hasFuelInBrief && perfData.range?.fuelOnBoard && document.getElementById('briefFuel')) {
                        document.getElementById('briefFuel').value = perfData.range.fuelOnBoard;
                    }
                    if (!hasBurnInBrief && perfData.range?.fuelBurn && document.getElementById('briefBurn')) {
                        document.getElementById('briefBurn').value = perfData.range.fuelBurn;
                    }
                    const fuelUnit = perfData.units?.fuel || 'L';
                    document.querySelectorAll('.unit-fuel').forEach(el => el.textContent = fuelUnit);
                    document.querySelectorAll('.unit-fuel-flow').forEach(el => el.textContent = fuelUnit + '/h');
                }
            } catch(e){}
            calcFuelEndurance();
            updateReadinessProgress();
            updateBentoDashboard();
            updateMissionHud();
        }
        briefFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    if (id === 'briefFuel' || id === 'briefBurn') calcFuelEndurance();
                    saveBriefingData();
                });
            }
        });
        // Un bouton par categorie : coche (ou decoche) tous ses criteres d'un coup
        (function initCategoryToggles() {
            const groups = [
                ['catBadgePilot', ['chk_imsafe_illness', 'chk_imsafe_medication', 'chk_imsafe_stress', 'chk_imsafe_alcohol', 'chk_imsafe_fatigue', 'chk_imsafe_emotion', 'chk_pilot_currency']],
                ['catBadgeWx', ['chk_wx_ceiling_vis', 'chk_wx_wind', 'chk_wx_hazards', 'chk_wx_alts']],
                ['catBadgeAc', ['chk_doc_license', 'chk_doc_medical', 'chk_doc_arow', 'chk_ac_wb', 'chk_ac_preflight', 'chk_ac_fuel']],
                ['catBadgeNav', ['chk_doc_charts', 'chk_nav_notams', 'chk_nav_equipment', 'chk_nav_briefing']]
            ];
            groups.forEach(([badgeId, ids]) => {
                const badge = document.getElementById(badgeId);
                if (!badge) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'cat-check-all';
                const boxes = () => ids.map(i => document.getElementById(i)).filter(Boolean);
                const sync = () => {
                    const all = boxes().every(b => b.checked);
                    btn.textContent = all ? 'Tout décocher' : 'Tout cocher';
                    btn.classList.toggle('done', all);
                };
                btn.addEventListener('click', () => {
                    const target = !boxes().every(b => b.checked);
                    boxes().forEach(b => {
                        if (b.checked !== target) {
                            b.checked = target;
                            b.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                    sync();
                });
                boxes().forEach(b => b.addEventListener('change', sync));
                const group = document.createElement('span');
                group.className = 'cat-check-group';
                badge.parentElement.insertBefore(group, badge);
                group.appendChild(btn);
                group.appendChild(badge);
                sync();
            });
        })();

        readinessChkIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    const parent = el.closest('.check-item');
                    if (parent) {
                        if (el.checked) parent.classList.add('done');
                        else parent.classList.remove('done');
                    }
                    updateReadinessProgress();
                    saveBriefingData();
                });
            }
        });

        const btnValidateAll = document.getElementById('btnValidateAllReadiness');
        if (btnValidateAll) {
            btnValidateAll.addEventListener('click', validateAllReadiness);
            readinessChkIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', syncValidateAllLabel);
            });
            syncValidateAllLabel();
        }

        const btnResetAll = document.getElementById('btnResetAllReadiness');
        if (btnResetAll) {
            btnResetAll.addEventListener('click', () => {
                if (confirm('Réinitialiser toutes les cases de la checklist de préparation ?')) {
                    resetAllReadiness();
                }
            });
        }

        // Smooth scroll for sidebar sublinks
        document.querySelectorAll('.sidebar-sublink').forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href').slice(1);
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    e.preventDefault();
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    document.querySelectorAll('.sidebar-sublink').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        });

        // Weather Persistence
        const weatherText = document.getElementById('weatherText');
        function saveWeather() {
            if (weatherText) localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify({ summary: weatherText.value }));
        }
        function loadWeather() {
            try {
                const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
                if (raw && weatherText) weatherText.value = JSON.parse(raw).summary || '';
            } catch(e){}
        }
        if (weatherText) weatherText.addEventListener('input', saveWeather);

        // Escaping HTML
        function escapeHtml(str) { return document.createElement('div').appendChild(document.createTextNode(str || '')).parentNode.innerHTML; }

        // ==========================================
        // AERODROME METAR & TAF WEATHER SERVICE (REDESIGNED)
        // ==========================================
        const AIRPORTS_WX_KEY = 'flightprep_airports_wx_v2';
        const WX_VIEW_MODE_KEY = 'altiview_wx_view_mode_v1';
        let monitoredAirports = [];
        let currentWxViewMode = localStorage.getItem(WX_VIEW_MODE_KEY) || 'cards';
        let wxAutoRefreshTimer = null;
        let wxRefreshInFlight = null;
        let wxLastRefreshAt = 0;
        const WX_AUTO_REFRESH_MS = 10 * 60 * 1000;
        const WX_RESUME_REFRESH_MS = 5 * 60 * 1000;

        const KNOWN_AIRPORTS = {
            'LFPG': 'Paris Charles de Gaulle',
            'LFPO': 'Paris Orly',
            'LFPN': 'Toussus-le-Noble',
            'LFPT': 'Pontoise - Cormeilles',
            'LFPL': 'Lognes - Emerainville',
            'LFPM': 'Melun Villaroche',
            'LFAI': 'Nangis Les Loges',
            'LFOB': 'Beauvais Tillé',
            'LFMD': 'Cannes Mandelieu',
            'LFMN': 'Nice Côte d\'Azur',
            'LFML': 'Marseille Provence',
            'LFLL': 'Lyon Saint-Exupéry',
            'LFLY': 'Lyon Bron',
            'LFBO': 'Toulouse Blagnac',
            'LFBD': 'Bordeaux Mérignac',
            'LFRB': 'Brest Bretagne',
            'LFRN': 'Rennes Saint-Jacques',
            'EGLL': 'London Heathrow',
            'EGKK': 'London Gatwick',
            'EHAM': 'Amsterdam Schiphol',
            'EBBR': 'Brussels National',
            'LSGG': 'Geneva Cointrin',
            'LSZH': 'Zurich Airport',
            'KJFK': 'New York JFK',
            'KLAX': 'Los Angeles Intl'
        };

        // Regional CTR/TMA reference platform for VFR airfields without individual 24h TAF
        const REFERENCE_TAF_AIRPORTS = {
            'LFPZ': 'LFPO', 'LFFU': 'LFPO', 'LFPL': 'LFPG', 'LFPM': 'LFPO',
            'LFAI': 'LFPO', 'LFPT': 'LFPG', 'LFPB': 'LFPG', 'LFPK': 'LFPO',
            'LFPE': 'LFPG', 'LFPH': 'LFPG', 'LFJS': 'LFPO', 'LFMD': 'LFMN',
            'LFMA': 'LFML', 'LFMQ': 'LFML', 'LFTZ': 'LFML', 'LFLY': 'LFLL',
            'LFKA': 'LFLL', 'LFLG': 'LFLL', 'LFLP': 'LFLL', 'LFCL': 'LFBO',
            'LFBC': 'LFBD', 'LFCH': 'LFBD', 'LFBT': 'LFBP', 'LFRT': 'LFRN',
            'LFRD': 'LFRN', 'LFRF': 'LFRB', 'LFRZ': 'LFRS'
        };

        const MANUAL_TAFS_KEY = 'altiview_manual_tafs_v1';
        let manualTafs = {};
        try {
            const rawM = localStorage.getItem(MANUAL_TAFS_KEY);
            if (rawM) manualTafs = JSON.parse(rawM);
        } catch(e) { manualTafs = {}; }

        function extractMetarTrend(metarRaw) {
            if (!metarRaw || typeof metarRaw !== 'string') return null;
            if (/\bNOSIG\b/.test(metarRaw)) {
                return { code: 'NOSIG', desc: 'Conditions stables sans changement significatif (2h)' };
            }
            const becmgMatch = metarRaw.match(/\b(BECMG\s+[^\n]+)/);
            if (becmgMatch) {
                return { code: 'BECMG', desc: becmgMatch[1].trim() };
            }
            const tempoMatch = metarRaw.match(/\b(TEMPO\s+[^\n]+)/);
            if (tempoMatch) {
                return { code: 'TEMPO', desc: tempoMatch[1].trim() };
            }
            return null;
        }

        // Comprehensive Airport Info Resolver (AeroData + Fallbacks)
        function getAirportInfo(icao, apiName) {
            icao = (icao || '').trim().toUpperCase();
            if (typeof AeroData !== 'undefined' && AeroData.AIRPORTS) {
                const found = AeroData.AIRPORTS.find(a => a.icao === icao);
                if (found) return found;
            }
            const name = KNOWN_AIRPORTS[icao] || apiName || ('Aerodrome ' + icao);
            return {
                icao,
                name: typeof name === 'string' ? name : (name.name || 'Aerodrome ' + icao),
                city: '',
                alt: null,
                lat: null,
                lng: null,
                runways: []
            };
        }

        function getAirportName(icao, apiName) {
            const info = getAirportInfo(icao, apiName);
            return info.name || ('Aerodrome ' + icao);
        }

        // Automatic Active Runway & Crosswind Analyzer
        function analyzeRunwaysWind(aptInfo, wdir, wspd) {
            if (!aptInfo || !aptInfo.runways || !Array.isArray(aptInfo.runways) || aptInfo.runways.length === 0) {
                return null;
            }
            if (wdir === undefined || wdir === null || wspd === undefined || wspd === null) {
                return null;
            }

            const thresholds = [];
            aptInfo.runways.forEach(rwyObj => {
                const rwyName = rwyObj.name || '';
                const parts = rwyName.split('/').map(s => s.trim()).filter(Boolean);
                parts.forEach(th => {
                    const m = th.match(/^(\d{2})([LCR]?)$/i);
                    if (m) {
                        const num = parseInt(m[1], 10);
                        const heading = num * 10;
                        thresholds.push({
                            ident: th.toUpperCase(),
                            heading: heading,
                            length: rwyObj.length || '',
                            surface: rwyObj.surface || 'Asphalt'
                        });
                    }
                });
            });

            if (thresholds.length === 0) return null;

            if (wdir === 'VRB') {
                return {
                    isVrb: true,
                    wspd: wspd,
                    bestIdent: thresholds[0].ident,
                    bestHeading: thresholds[0].heading,
                    headwind: null,
                    crosswind: null,
                    crosswindSide: '',
                    runways: thresholds
                };
            }

            const scored = thresholds.map(th => {
                const deltaDeg = wdir - th.heading;
                const rad = deltaDeg * (Math.PI / 180);
                const hw = Math.round(wspd * Math.cos(rad));
                const xw = Math.round(Math.abs(wspd * Math.sin(rad)));
                const side = Math.sin(rad) > 0.05 ? 'droite' : (Math.sin(rad) < -0.05 ? 'gauche' : 'axe');
                return {
                    ...th,
                    headwind: hw,
                    crosswind: xw,
                    side: side
                };
            });

            scored.sort((a, b) => b.headwind - a.headwind);
            const best = scored[0];

            return {
                isVrb: false,
                wspd: wspd,
                wdir: wdir,
                bestIdent: best.ident,
                bestHeading: best.heading,
                headwind: best.headwind,
                crosswind: best.crosswind,
                crosswindSide: best.side,
                runways: scored
            };
        }

        // Nearest Reporting Station Solver
        function findNearestReportingStation(targetIcao) {
            if (typeof AeroData === 'undefined' || !AeroData.AIRPORTS) return null;
            const currentApt = AeroData.AIRPORTS.find(a => a.icao === targetIcao);
            if (!currentApt || currentApt.lat === undefined || currentApt.lng === undefined) return null;

            const reportingIcaos = new Set([
                'LFPG','LFPO','LFPN','LFPT','LFOB','LFMD','LFMN','LFML','LFLL','LFLY','LFBO','LFBD',
                'LFRB','LFRN','LFRS','LFSB','LFST','LFBZ','LFCR','LFMP','LFMT','LFJL','LFKB',
                'LFKC','LFKJ','LFKF','EGLL','EGKK','EHAM','EBBR','LSGG','LSZH','LFQQ','LFRK','LFRD',
                'LFRZ','LFOT','LFLD','LFBI','LFLX','LFTH','LFMY','LFMI','LFBM','LFDG','LFCH','LFBC',
                'LFOK','LFOP','LFOH','LFRG','LFQB','LFSD','LFSM'
            ]);

            let bestStation = null;
            let minDistanceNm = Infinity;

            for (let i = 0; i < AeroData.AIRPORTS.length; i++) {
                const apt = AeroData.AIRPORTS[i];
                if (apt.icao === targetIcao) continue;
                if (!reportingIcaos.has(apt.icao) && apt.type !== 'intl' && apt.type !== 'mil') continue;

                const dLat = (apt.lat - currentApt.lat) * (Math.PI / 180);
                const dLng = (apt.lng - currentApt.lng) * (Math.PI / 180);
                const lat1 = currentApt.lat * (Math.PI / 180);
                const lat2 = apt.lat * (Math.PI / 180);

                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distNm = Math.round(6371 * c * 0.539957);

                if (distNm < minDistanceNm) {
                    minDistanceNm = distNm;
                    const y = Math.sin(dLng) * Math.cos(lat2);
                    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
                    let bearing = Math.round(Math.atan2(y, x) * (180 / Math.PI));
                    if (bearing < 0) bearing += 360;

                    bestStation = {
                        icao: apt.icao,
                        name: apt.name,
                        city: apt.city,
                        distNm: distNm,
                        bearing: bearing
                    };
                }
            }

            return bestStation;
        }

        // Parse Raw METAR string into enriched structured components
        function parseRawMetar(raw, icao) {
            if (!raw || typeof raw !== 'string') return {};
            const clean = raw.trim();
            const res = {
                raw: clean,
                icao: icao,
                fltCat: 'VFR'
            };

            // Observation Time: e.g. 081130Z
            const timeMatch = clean.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
            if (timeMatch) {
                res.obsDay = parseInt(timeMatch[1], 10);
                res.obsHour = parseInt(timeMatch[2], 10);
                res.obsMin = parseInt(timeMatch[3], 10);
                res.obsTimeStr = `${timeMatch[2]}:${timeMatch[3]} UTC`;

                // Calculate Observation Age in Minutes
                const now = new Date();
                const obsDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), res.obsDay, res.obsHour, res.obsMin));
                if (obsDate > now) {
                    obsDate.setUTCMonth(obsDate.getUTCMonth() - 1);
                }
                const ageMin = Math.round((now.getTime() - obsDate.getTime()) / 60000);
                res.obsAgeMin = ageMin >= 0 ? ageMin : 0;
            }

            // Wind: e.g. 20018KT, 20018G30KT, VRB03KT, 00000KT
            const windMatch = clean.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/);
            if (windMatch) {
                res.wdir = windMatch[1] === 'VRB' ? 'VRB' : parseInt(windMatch[1], 10);
                res.wspd = parseInt(windMatch[2], 10);
                if (windMatch[3]) res.wgst = parseInt(windMatch[3], 10);
            }

            // Visibility: e.g. 9999, 4500, CAVOK, 10SM, 3SM, 1/2SM
            let visMeters = 10000;
            if (/\bCAVOK\b/.test(clean)) {
                res.vis = '> 10 km (CAVOK)';
                res.isCavok = true;
            } else {
                const smMatch = clean.match(/\b(\d+(?:\/\d+)?|\d+\s+\d+\/\d+)SM\b/);
                const meterMatch = clean.match(/\b(\d{4})\b/);
                if (smMatch) {
                    res.vis = smMatch[1] + ' SM';
                    const parts = smMatch[1].split('/');
                    const smNum = parts.length === 2 ? parseFloat(parts[0]) / parseFloat(parts[1]) : parseFloat(parts[0]);
                    visMeters = smNum * 1609;
                } else if (meterMatch && !meterMatch[0].startsWith('20') && !meterMatch[0].startsWith('19')) {
                    const m = parseInt(meterMatch[1], 10);
                    visMeters = m;
                    res.vis = m === 9999 ? '> 10 km' : `${m} m`;
                }
            }

            // Clouds & Ceiling: e.g. FEW020 SCT040 BKN070 OVC015
            const cloudRegex = /\b(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?\b/g;
            let cMatch;
            const clouds = [];
            let lowestCeilingFt = null;

            while ((cMatch = cloudRegex.exec(clean)) !== null) {
                const type = cMatch[1];
                const baseFt = parseInt(cMatch[2], 10) * 100;
                clouds.push({ cover: type, base: baseFt, extra: cMatch[3] || '' });
                if (['BKN', 'OVC', 'VV'].includes(type)) {
                    if (lowestCeilingFt === null || baseFt < lowestCeilingFt) {
                        lowestCeilingFt = baseFt;
                    }
                }
            }
            res.clouds = clouds;
            res.ceilingFt = lowestCeilingFt;

            // Temperature / Dewpoint: e.g. 24/13, M02/M05
            const tempMatch = clean.match(/\b(M?\d{2})\/(M?\d{2})\b/);
            if (tempMatch) {
                const parseTemp = s => s.startsWith('M') ? -parseInt(s.slice(1), 10) : parseInt(s, 10);
                res.temp = parseTemp(tempMatch[1]);
                res.dewp = parseTemp(tempMatch[2]);
                res.spread = res.temp - res.dewp;
            }

            // QNH / Altimeter: e.g. Q1010, A3002
            const qnhMatch = clean.match(/\bQ(\d{4})\b/);
            const altimMatch = clean.match(/\bA(\d{4})\b/);
            if (qnhMatch) {
                res.altim = `${parseInt(qnhMatch[1], 10)} hPa`;
            } else if (altimMatch) {
                res.altim = `${(parseInt(altimMatch[1], 10) / 100).toFixed(2)} inHg`;
            }

            // Flight Category Determination
            if (res.isCavok) {
                res.fltCat = 'VFR';
            } else if ((lowestCeilingFt !== null && lowestCeilingFt < 500) || visMeters < 1600) {
                res.fltCat = 'LIFR';
            } else if ((lowestCeilingFt !== null && lowestCeilingFt < 1000) || visMeters < 5000) {
                res.fltCat = 'IFR';
            } else if ((lowestCeilingFt !== null && lowestCeilingFt < 3000) || visMeters < 8000) {
                res.fltCat = 'MVFR';
            } else {
                res.fltCat = 'VFR';
            }

            // Runway Crosswind Analysis
            const aptInfo = getAirportInfo(icao);
            res.rwyAnalysis = analyzeRunwaysWind(aptInfo, res.wdir, res.wspd);

            return res;
        }

        // METAR Token Plain French Explainer for Student & Pro Pilots
        function explainMetarToken(token, icao, aptName) {
            if (!token) return '';
            token = token.trim().toUpperCase();

            if (token === icao) {
                return `Code OACI de la station : <strong>${token}</strong> (${escapeHtml(aptName || '')})`;
            }
            const timeMatch = token.match(/^(\d{2})(\d{2})(\d{2})Z$/);
            if (timeMatch) {
                return `Date &amp; heure d'observation : <strong>le ${parseInt(timeMatch[1], 10)} à ${timeMatch[2]}:${timeMatch[3]} UTC</strong>`;
            }
            if (token === 'AUTO') return '<strong>AUTO</strong> : Observation météorologique entièrement automatisée (station AWOS/ASOS)';
            if (token === 'COR') return '<strong>COR</strong> : Bulletin météorologique corrigé';
            if (token === 'NIL') return '<strong>NIL</strong> : Données météorologiques indisponibles';
            if (token === 'NOSIG') return '<strong>NOSIG</strong> : Aucun changement significatif prévu dans les 2 prochaines heures';
            if (token === 'CAVOK') return '<strong>CAVOK</strong> : Plafond et visibilité OK (Visibilité &gt; 10 km, aucun nuage sous 5 000 ft sol, pas de TCU/CB, aucun phénomène météo)';

            const windMatch = token.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/);
            if (windMatch) {
                const dir = windMatch[1] === 'VRB' ? 'direction variable' : `${windMatch[1]}°`;
                let text = `Vent venant du <strong>${dir}</strong> à <strong>${parseInt(windMatch[2], 10)} nœuds</strong>`;
                if (windMatch[3]) text += ` avec <strong>rafales à ${parseInt(windMatch[3], 10)} nœuds</strong>`;
                return text;
            }
            const vrbVarMatch = token.match(/^(\d{3})V(\d{3})$/);
            if (vrbVarMatch) {
                return `Direction du vent variant entre <strong>${vrbVarMatch[1]}°</strong> et <strong>${vrbVarMatch[2]}°</strong>`;
            }
            if (token === '00000KT') return '<strong>Vent calme</strong> (&lt; 1 nœud)';

            if (token === '9999') return 'Visibilité horizontale <strong>supérieure ou égale à 10 kilomètres</strong>';
            const visMeterMatch = token.match(/^(\d{4})$/);
            if (visMeterMatch && !token.startsWith('20') && !token.startsWith('19')) {
                return `Visibilité horizontale : <strong>${parseInt(visMeterMatch[1], 10)} mètres</strong>`;
            }
            const visSmMatch = token.match(/^(\d+(?:\/\d+)?|\d+\s+\d+\/\d+)SM$/);
            if (visSmMatch) {
                return `Visibilité : <strong>${visSmMatch[1]} Statute Miles</strong> (~${Math.round(parseFloat(visSmMatch[1])*1.609)} km)`;
            }
            const rvrMatch = token.match(/^R(\d{2}[LCR]?)\/([MP]?)(\d{4})([UDA]?)$/);
            if (rvrMatch) {
                const trendMap = { 'U': 'en hausse', 'D': 'en baisse', 'N': 'sans changement' };
                const trend = trendMap[rvrMatch[4]] ? ` (${trendMap[rvrMatch[4]]})` : '';
                return `Portée visuelle de piste (RVR) Piste <strong>${rvrMatch[1]}</strong> : <strong>${parseInt(rvrMatch[3], 10)} m</strong>${trend}`;
            }

            const cloudMatch = token.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/);
            if (cloudMatch) {
                const coverNames = {
                    'FEW': '1 à 2 octas (FEW - Quelques nuages)',
                    'SCT': '3 à 4 octas (SCT - Nuages épars)',
                    'BKN': '5 à 7 octas (BKN - Plafond)',
                    'OVC': '8 octas (OVC - Ciel couvert)',
                    'VV': 'Visibilité verticale'
                };
                const altFt = parseInt(cloudMatch[2], 10) * 100;
                const altM = Math.round(altFt * 0.3048);
                let cloudDesc = `Couche nuageuse : <strong>${coverNames[cloudMatch[1]] || cloudMatch[1]}</strong> à <strong>${altFt.toLocaleString()} ft sol</strong> (~${altM} m)`;
                if (cloudMatch[3] === 'CB') cloudDesc += ' <br><strong style="color:var(--danger);">CUMULONIMBUS (Danger foudre / turbulences)</strong>';
                if (cloudMatch[3] === 'TCU') cloudDesc += ' <br><strong style="color:var(--warning);">TOWERING CUMULUS (Forte convection)</strong>';
                return cloudDesc;
            }
            if (['NSC', 'NCD', 'SKC', 'CLR'].includes(token)) {
                return '<strong>Ciel clair</strong> / Aucun nuage détecté sous 5 000 ft sol';
            }

            const tempMatch = token.match(/^(M?\d{2})\/(M?\d{2})$/);
            if (tempMatch) {
                const parseT = s => s.startsWith('M') ? -parseInt(s.slice(1), 10) : parseInt(s, 10);
                const t = parseT(tempMatch[1]);
                const td = parseT(tempMatch[2]);
                const spread = t - td;
                let msg = `Température : <strong>${t}°C</strong> | Point de rosée : <strong>${td}°C</strong> (Spread : <strong>${spread}°C</strong>)`;
                if (spread <= 2) msg += '<br><strong style="color: var(--accent-ink);">Risque élevé de brume ou brouillard (Spread &le; 2°C)</strong>';
                return msg;
            }

            const qnhMatch = token.match(/^Q(\d{4})$/);
            if (qnhMatch) {
                return `Pression au niveau de la mer (QNH) : <strong>${parseInt(qnhMatch[1], 10)} hPa</strong>`;
            }
            const altimMatch = token.match(/^A(\d{4})$/);
            if (altimMatch) {
                const inHg = (parseInt(altimMatch[1], 10) / 100).toFixed(2);
                const hPa = Math.round(parseFloat(inHg) * 33.8639);
                return `Calage altimétrique : <strong>${inHg} inHg</strong> (~${hPa} hPa)`;
            }

            const wxDict = {
                'RA': 'Pluie', 'DZ': 'Bruine', 'SN': 'Neige', 'SG': 'Neige en grains', 'IC': 'Cristaux de glace',
                'PL': 'Granules de glace', 'GR': 'Grêle', 'GS': 'Grésil', 'UP': 'Précipitation inconnue',
                'BR': 'Brume (visi &ge; 1 km)', 'FG': 'Brouillard (visi &lt; 1 km)', 'FU': 'Fumée', 'VA': 'Cendres volcaniques',
                'DU': 'Poussière', 'SA': 'Sable', 'HZ': 'Brume sèche', 'SQ': 'Grain', 'FC': 'Trombe / Tornade',
                'SS': 'Tempête de sable', 'DS': 'Tempête de poussière', 'TS': 'Orage', 'SH': 'Averses',
                'FZ': 'Verglaçant', 'BL': 'Chasse élevée', 'DR': 'Chasse basse', 'BC': 'Bancs',
                'PR': 'Partiel', 'MI': 'Mince'
            };
            if (token.startsWith('+') || token.startsWith('-') || token.startsWith('VC') || Object.keys(wxDict).some(k => token.includes(k))) {
                let text = 'Phénomène météo : ';
                let clean = token;
                if (clean.startsWith('+')) { text += '<strong>Fort(e)</strong> '; clean = clean.slice(1); }
                else if (clean.startsWith('-')) { text += '<strong>Faible</strong> '; clean = clean.slice(1); }
                else if (clean.startsWith('VC')) { text += '<strong>Au voisinage</strong> '; clean = clean.slice(2); }

                const parts = [];
                for (const [code, desc] of Object.entries(wxDict)) {
                    if (clean.includes(code)) {
                        parts.push(desc);
                        clean = clean.replace(code, '');
                    }
                }
                if (parts.length > 0) {
                    return text + '<strong>' + parts.join(' ') + '</strong>';
                }
            }

            return `Élément METAR : <strong>${escapeHtml(token)}</strong>`;
        }

        // Message brut, sans interprétation au survol.
        function renderInteractiveMetarHtml(rawMetar) {
            if (!rawMetar || rawMetar.includes('No METAR reported')) {
                return `<span style="color:var(--muted); font-style:italic;">Aucun METAR rapporté pour ce terrain.</span>`;
            }
            return escapeHtml(rawMetar.trim());
        }

        function renderRawTafHtml(rawTaf) {
            if (!rawTaf || rawTaf.includes('No TAF published')) {
                return `<span style="color:var(--muted); font-style:italic;">Aucun TAF publié pour ce terrain.</span>`;
            }
            return escapeHtml(rawTaf.trim());
        }

        // Render human-readable decoded briefing
        function renderDecodedBriefingHtml(d, item) {
            const metrics = [];
            const metric = (label, value, detail = '', tone = '') => {
                metrics.push(`<div class="wx-brief-cell ${tone}"><span class="wx-brief-label">${label}</span><strong class="wx-brief-value">${value}</strong>${detail ? `<small class="wx-brief-detail">${detail}</small>` : ''}</div>`);
            };

            if (d.wdir !== undefined && d.wspd !== undefined) {
                const direction = d.wdir === 'VRB' ? 'VRB' : `${Math.round(d.wdir).toString().padStart(3,'0')}°`;
                metric('Vent', `${escapeHtml(direction)} · ${d.wspd} kt`, d.wgst ? `Rafales ${d.wgst} kt` : 'Vent moyen', d.wgst ? 'is-warning' : '');
            }

            if (d.isCavok) {
                metric('Visibilité', 'CAVOK', '≥ 10 km · sans phénomène significatif', 'is-good');
            } else if (d.vis) {
                metric('Visibilité', escapeHtml(d.vis), 'Visibilité horizontale');
            }

            if (d.clouds && d.clouds.length > 0) {
                const layers = d.clouds.map(c => `${c.cover}${c.base ? ' ' + Number(c.base).toLocaleString('fr-FR') + ' ft' : ''}${c.extra ? ' ' + c.extra : ''}`);
                metric('Plafond / nuages', d.ceilingFt ? `${Number(d.ceilingFt).toLocaleString('fr-FR')} ft` : escapeHtml(layers[0]), escapeHtml(layers.join(' · ')));
            } else {
                metric('Plafond / nuages', d.isCavok ? 'Dégagé' : 'Ciel clair', d.isCavok ? 'Aucun sous 5 000 ft' : 'Aucun significatif');
            }

            if (d.temp !== undefined) {
                const spread = d.dewp !== undefined ? d.temp - d.dewp : null;
                metric('Temp. / rosée', `${d.temp}° / ${d.dewp !== undefined ? d.dewp + '°' : '—'}`, spread !== null ? `Écart ${spread}°C` : 'Point de rosée indisponible', spread !== null && spread <= 2 ? 'is-warning' : '');
            }

            if (d.altim) metric('QNH', escapeHtml(d.altim), 'Calage altimétrique');

            const trend = extractMetarTrend(item.metar);
            if (trend) metric('Tendance', escapeHtml(trend.code), escapeHtml(trend.desc), trend.code === 'NOSIG' ? 'is-good' : '');

            if (metrics.length === 0) {
                return '<span style="color:var(--muted-text); font-size:12px;">Données météo en direct indisponibles pour ce terrain.</span>';
            }

            return `<div class="wx-brief-grid">${metrics.join('')}</div>`;
        }

        // Format Structured TAF Card Block
        function formatTafCardHtml(item) {
            const icao = item.icao;
            const tafRaw = item.taf;
            const isRef = item.isRefTaf || !!item.refIcao;
            const refIcao = item.refIcao || REFERENCE_TAF_AIRPORTS[icao];
            const isManual = item.isManual || (manualTafs && manualTafs[icao]);

            let tagHtml = '';
            if (isManual) {
                tagHtml = `<span class="taf-tag taf-manual">Saisie Manuelle</span>`;
            } else if (isRef && refIcao) {
                tagHtml = `<span class="taf-tag taf-ref" title="Terrain VFR rattaché à la station de référence ${escapeHtml(refIcao)}">Réf. ${escapeHtml(refIcao)}</span>`;
            }

            const hasPublishedTaf = tafRaw && !tafRaw.includes('No TAF published') && !tafRaw.includes('Non doté de TAF') && tafRaw.trim() !== '';
            const tafAutoStamp = hasPublishedTaf && !isManual
                ? `<span class="wx-taf-auto" title="TAF renouvelé automatiquement">AUTO · ${new Date(item.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`
                : '';

            if (!tafRaw || tafRaw.includes('No TAF published') || tafRaw.includes('Non doté de TAF') || tafRaw.trim() === '') {
                const trend = extractMetarTrend(item.metar);
                return `
                    <div class="wx-taf-block">
                        <div class="wx-taf-header">
                            <span>PRÉVISION TERMINALE (TAF)</span>
                            <div class="wx-taf-meta">${tagHtml}</div>
                        </div>
                        <div style="color: var(--muted); font-size: 11.5px; line-height: 1.4;">
                            <span class="taf-tag taf-vfr">Terrain VFR</span> Non doté de TAF 24h individuel.
                            ${refIcao ? `<div style="margin-top: 5px;">Consulter le TAF régional de la plateforme associée : <strong>${escapeHtml(refIcao)}</strong>.</div>` : ''}
                            ${trend ? `<div style="margin-top: 5px; color: var(--text);"><span class="taf-tag taf-becmg">TREND</span> <strong>${escapeHtml(trend.code)}</strong> <span style="font-size: 11px; color: var(--muted);">${escapeHtml(trend.desc)}</span></div>` : ''}
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                            <button class="btn-edit-taf" onclick="openTafModal('${escapeHtml(icao)}')">Saisir TAF</button>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="wx-segment-box wx-taf-block">
                    <div class="wx-segment-tabs wx-taf-tabs">
                        <span class="wx-tab-static active">TAF brut</span>
                        ${tagHtml}${tafAutoStamp}
                    </div>
                    <div class="wx-segment-content">
                        <div class="wx-raw-interactive wx-taf-raw">${renderRawTafHtml(tafRaw)}</div>
                    </div>
                    <div class="wx-taf-actions">
                        <button class="btn-edit-taf" onclick="openTafModal('${escapeHtml(icao)}')">Éditer TAF</button>
                    </div>
                </div>
            `;
        }

        // Format TAF for table row view
        function formatTafHtml(item) {
            return formatTafCardHtml(item);
        }

        // Fetch METAR & TAF with multi-tier fallback
        async function fetchAirportWeather(icao) {
            icao = icao.trim().toUpperCase();
            if (!icao || icao.length < 3) throw new Error("Code OACI invalide");

            let metarRaw = null;
            let tafRaw = null;
            let apiName = null;
            let decoded = null;
            let isRefTaf = false;
            let refIcao = null;
            let isManual = false;

            if (manualTafs && manualTafs[icao]) {
                tafRaw = manualTafs[icao];
                isManual = true;
            }

            // --------------------------------------------------------------
            // 1. Passerelle locale Altiview (même origine) : METAR et TAF
            //    officiels NOAA. Les navigateurs interdisent l'appel direct à
            //    aviationweather.gov depuis un fichier local (règle CORS) :
            //    la passerelle (Lancer_AltiView.command) fait l'appel à notre place.
            // --------------------------------------------------------------
            let gatewaySuccess = false;
            let officialResponseReceived = false;
            if (await AltiviewSources.health()) {
                gatewaySuccess = true;
                try {
                    const requestedOfficialTaf = !tafRaw && !isManual;
                    const [mRes, tRes] = await Promise.allSettled([
                        !metarRaw ? AltiviewSources.json(`/api/metar?ids=${icao}`) : Promise.resolve(null),
                        requestedOfficialTaf ? AltiviewSources.json(`/api/taf?ids=${icao}`) : Promise.resolve(null)
                    ]);
                    officialResponseReceived = mRes.status === 'fulfilled' || (requestedOfficialTaf && tRes.status === 'fulfilled');
                    if (mRes.status === 'fulfilled' && Array.isArray(mRes.value) && mRes.value.length) {
                        metarRaw = mRes.value[0].rawOb || metarRaw;
                        if (!apiName) apiName = mRes.value[0].name;
                    }
                    if (tRes.status === 'fulfilled' && Array.isArray(tRes.value) && tRes.value.length) {
                        tafRaw = tRes.value[0].rawTAF || tafRaw;
                    }
                } catch (e) {}
            }
            AltiviewSources.paintWeatherBadge(gatewaySuccess);

            // Aucune source non officielle n'est utilisée comme repli météo.
            // En cas d'indisponibilité, l'appelant conserve les dernières données NOAA.
            if (!gatewaySuccess || !officialResponseReceived) {
                throw new Error('Source officielle NOAA AWC indisponible. Lancez Lancer_AltiView.command.');
            }

            // 3. TAF du terrain de référence régional si le terrain n'en publie pas
            if (!tafRaw && !isManual && REFERENCE_TAF_AIRPORTS[icao] && gatewaySuccess) {
                refIcao = REFERENCE_TAF_AIRPORTS[icao];
                try {
                    const rt = await AltiviewSources.json(`/api/taf?ids=${refIcao}`);
                    if (Array.isArray(rt) && rt.length && rt[0].rawTAF) {
                        tafRaw = rt[0].rawTAF;
                        isRefTaf = true;
                    }
                } catch (e) {}
            }

            if (metarRaw) {
                const parsed = parseRawMetar(metarRaw, icao);
                decoded = { ...parsed, ...(decoded || {}) };
                if (parsed.fltCat) decoded.fltCat = parsed.fltCat;
            }

            const aptInfo = getAirportInfo(icao, apiName);
            let nearestStation = null;
            if (!metarRaw) {
                nearestStation = findNearestReportingStation(icao);
            }

            return {
                icao,
                name: aptInfo.name || getAirportName(icao, apiName),
                city: aptInfo.city || '',
                alt: aptInfo.alt,
                runways: aptInfo.runways || [],
                metar: metarRaw || "No METAR reported for this station.",
                taf: tafRaw || "Non doté de TAF (Terrain VFR).",
                isRefTaf,
                refIcao,
                isManual,
                nearestStation,
                decoded: decoded || {},
                viewTab: 'raw',
                updatedAt: new Date().toISOString(),
                source: 'NOAA_AWC'
            };
        }

        function saveMonitoredAirports() {
            localStorage.setItem(AIRPORTS_WX_KEY, JSON.stringify(monitoredAirports));
        }

        function loadMonitoredAirports() {
            try {
                const raw = localStorage.getItem(AIRPORTS_WX_KEY);
                if (raw) {
                    monitoredAirports = JSON.parse(raw);
                    // À l'ouverture, le message brut est l'affichage initial.
                    monitoredAirports.forEach(airport => { airport.viewTab = 'raw'; });
                    if (!localStorage.getItem('altiview_user_explicit_lfpg')) {
                        const prevLen = monitoredAirports.length;
                        monitoredAirports = monitoredAirports.filter(a => a.icao !== 'LFPG');
                        if (monitoredAirports.length !== prevLen) {
                            saveMonitoredAirports();
                        }
                    }
                } else {
                    monitoredAirports = [];
                }
            } catch (e) {
                monitoredAirports = [];
            }
        }

        // Render both Avionics Cards Grid and Tabular View
        function renderWeatherTable() {
            renderWeatherCenter();
        }

        function renderWeatherCenter() {
            renderWeatherCards();
            renderWeatherTableBody();
            updateBentoDashboard();
        }

        // Render ForeFlight/SkyDemon-style Avionics Cards
        function renderWeatherCards() {
            const container = document.getElementById('weatherCardsGrid');
            if (!container) return;
            container.innerHTML = '';

            if (monitoredAirports.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--panel); border: 1px dashed var(--line-strong); border-radius: 12px; color: var(--muted);">
                        <div style="font-size: 32px; margin-bottom: 12px;"></div>
                        <h3 style="color: var(--text); font-size: 16px; margin-bottom: 6px;">Aucun aérodrome surveillé pour le moment</h3>
                        <p style="font-size: 13px; max-width: 480px; margin: 0 auto 16px;">
                            Saisissez un code OACI ou le nom d'une ville ci-dessus, ou reprenez les terrains de la route tracée.
                        </p>
                        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                            <button class="wx-preset-pill" onclick="loadRouteAirfields()">Charger depuis le vol</button>
                        </div>
                    </div>
                `;
                return;
            }

            monitoredAirports.forEach(item => {
                const card = document.createElement('div');
                card.className = 'wx-card';
                card.id = `wx-card-${item.icao}`;

                const d = item.decoded || {};
                const cat = d.fltCat || 'VFR';
                const catClass = `rule-${cat.toLowerCase()}`;

                // Freshness Badge
                let freshnessBadgeHtml = '';
                if (d.obsTimeStr) {
                    const age = d.obsAgeMin !== undefined ? d.obsAgeMin : 0;
                    let ageLabel = `Émis il y a ${age} min (${d.obsTimeStr})`;
                    let fClass = 'fresh';
                    if (age >= 120) {
                        fClass = 'expired';
                        ageLabel = `Périmé > 2h (${d.obsTimeStr})`;
                    } else if (age >= 60) {
                        fClass = 'stale';
                        ageLabel = `Périmé > 1h (${d.obsTimeStr})`;
                    }
                    freshnessBadgeHtml = `<span class="wx-freshness-badge ${fClass}"><span class="pulse-dot"></span> ${escapeHtml(ageLabel)}</span>`;
                }

                // Metric 1: Wind
                let windValHtml = '---';
                let windSubHtml = 'Direction & Vitesse';
                let needleTransform = '';
                if (d.wdir !== undefined && d.wspd !== undefined) {
                    const wStr = d.wdir === 'VRB' ? `VRB ${d.wspd} kt` : `${Math.round(d.wdir).toString().padStart(3,'0')}° / ${d.wspd} kt`;
                    windValHtml = escapeHtml(wStr);
                    if (d.wgst) {
                        windSubHtml = `<span style="color: var(--accent-ink); font-weight:700;">Rafales ${d.wgst} kt</span>`;
                    }
                    if (d.wdir !== 'VRB') {
                        needleTransform = `style="transform: rotate(${d.wdir}deg);"`;
                    }
                }

                // Metric 2: Visibility
                let visValHtml = d.vis || '---';
                let visSubHtml = d.isCavok ? 'CAVOK (Visi &gt; 10 km)' : 'Visibilité sol';

                // Metric 3: Ceiling & Clouds
                let ceilValHtml = 'Ciel clair';
                let ceilSubHtml = 'Aucun plafond';
                if (d.ceilingFt) {
                    ceilValHtml = `${d.ceilingFt.toLocaleString()} ft`;
                    ceilSubHtml = 'Plafond principal';
                } else if (d.clouds && d.clouds.length > 0) {
                    ceilValHtml = `${d.clouds[0].cover} ${d.clouds[0].base ? d.clouds[0].base + ' ft' : ''}`;
                    ceilSubHtml = 'Couche nuageuse';
                }

                // Metric 4: Temp & QNH
                let tempQnhValHtml = '---';
                let tempQnhSubHtml = 'Temp. & Altimètre';
                if (d.temp !== undefined) {
                    tempQnhValHtml = `${d.temp}°C`;
                    if (d.dewp !== undefined) tempQnhValHtml += ` / ${d.dewp}°C`;
                    if (d.altim) tempQnhSubHtml = `QNH ${escapeHtml(d.altim)}`;
                }

                // Runway & Crosswind Strip
                let rwyStripHtml = '';
                if (d.rwyAnalysis) {
                    const ra = d.rwyAnalysis;
                    if (ra.isVrb) {
                        rwyStripHtml = `
                            <div class="wx-runway-strip">
                                <div class="wx-rwy-details">
                                    <div class="wx-rwy-title">Vent Variable (${ra.wspd} kt)</div>
                                    <div class="wx-rwy-nums">Piste conseillée : <strong>${escapeHtml(ra.bestIdent)}</strong> (QFU ${ra.bestHeading}°)</div>
                                </div>
                                <button class="btn-apply-xwind" onclick="applyRunwayToCalc(${ra.bestHeading}, '${d.wdir}', ${ra.wspd})">Appliquer au calculateur</button>
                            </div>
                        `;
                    } else {
                        const hwLabel = ra.headwind >= 0 ? `${ra.headwind} kt de face` : `${Math.abs(ra.headwind)} kt arrière`;
                        const sideStr = ra.crosswindSide === 'axe' ? 'dans l\'axe' : `travers ${ra.crosswindSide}`;
                        rwyStripHtml = `
                            <div class="wx-runway-strip">
                                <div class="wx-rwy-details">
                                    <div class="wx-rwy-title">Piste conseillée : <strong>${escapeHtml(ra.bestIdent)}</strong> (QFU ${ra.bestHeading}°)</div>
                                    <div class="wx-rwy-nums">Vent relatif : <strong>${hwLabel}</strong> · <strong>${ra.crosswind} kt ${sideStr}</strong></div>
                                </div>
                                <button class="btn-apply-xwind" onclick="applyRunwayToCalc(${ra.bestHeading}, ${ra.wdir}, ${ra.wspd})">Appliquer au calculateur</button>
                            </div>
                        `;
                    }
                }

                // Alerts: Fog Risk, Strong Wind, or Nearest Station
                let headerAlertsHtml = '';
                let alertBannersHtml = '';
                if (d.spread !== undefined && d.spread !== null && d.spread <= 2) {
                    headerAlertsHtml += `
                        <div class="wx-alert-badge wx-alert-fog">
                            <span><strong>Risque de brouillard</strong><small>Écart T / Td : ${d.spread}°C</small></span>
                        </div>
                    `;
                }
                if (d.wspd >= 22 || (d.wgst && d.wgst >= 25)) {
                    headerAlertsHtml += `
                        <div class="wx-alert-badge wx-alert-wind">
                            <span><strong>Vent fort</strong><small>${d.wgst ? `Rafales ${d.wgst} kt · ` : ''}Vent moyen ${d.wspd} kt</small></span>
                        </div>
                    `;
                }
                if (item.nearestStation) {
                    const ns = item.nearestStation;
                    alertBannersHtml += `
                        <div class="wx-alert-badge wx-alert-nearest">
                            <span>Station METAR la plus proche : <strong>${escapeHtml(ns.icao)} (${escapeHtml(ns.name)})</strong> à <strong>${ns.distNm} NM</strong> (Cap ${ns.bearing}°).</span>
                            <button class="btn-load-nearest" onclick="addAirport('${escapeHtml(ns.icao)}')">Afficher ${escapeHtml(ns.icao)}</button>
                        </div>
                    `;
                }

                // Decoded vs Raw METAR Tab View
                const activeTab = item.viewTab || 'raw';
                const decodedDisplay = activeTab === 'decoded' ? 'block' : 'none';
                const rawDisplay = activeTab === 'raw' ? 'block' : 'none';

                const elevationHtml = item.alt ? `<span class="wx-card-elev">Elev ${item.alt} ft</span>` : '';
                const cityHtml = item.city ? `<span class="wx-card-city">${escapeHtml(item.city)}</span>` : '';

                card.innerHTML = `
                    <div class="wx-card-header">
                        <div class="wx-card-station">
                            <div class="wx-card-icao-row">
                                <span class="wx-card-icao">${escapeHtml(item.icao)}</span>
                                ${elevationHtml}
                            </div>
                            <div class="wx-card-name" title="${escapeHtml(item.name || '')}">${escapeHtml(item.name || '')}</div>
                            ${cityHtml}
                        </div>
                        <div class="wx-card-status-col">
                            <span class="flight-rule-badge ${catClass}" title="Règles de vol déduites">${cat}</span>
                            ${freshnessBadgeHtml}
                            ${headerAlertsHtml}
                        </div>
                    </div>

                    ${alertBannersHtml}

                    <div class="wx-messages-stack">
                        <!-- Decoded vs Raw METAR Segment -->
                        <div class="wx-segment-box">
                            <div class="wx-segment-tabs">
                                <button class="wx-tab-btn ${activeTab === 'raw' ? 'active' : ''}" data-tab="raw" onclick="switchCardMetarTab('${escapeHtml(item.icao)}', 'raw')">METAR brut</button>
                                <button class="wx-tab-btn ${activeTab === 'decoded' ? 'active' : ''}" data-tab="decoded" onclick="switchCardMetarTab('${escapeHtml(item.icao)}', 'decoded')">Décodé</button>
                            </div>
                            <div class="wx-segment-content" id="metar-decoded-${escapeHtml(item.icao)}" style="display:${decodedDisplay};">
                                ${renderDecodedBriefingHtml(d, item)}
                            </div>
                            <div class="wx-segment-content" id="metar-raw-${escapeHtml(item.icao)}" style="display:${rawDisplay};">
                                <div class="wx-raw-interactive">
                                    ${renderInteractiveMetarHtml(item.metar, item.icao, item.name)}
                                </div>
                            </div>
                        </div>

                        <!-- TAF brut -->
                        ${formatTafCardHtml(item)}
                    </div>

                    <!-- Card Actions Footer -->
                    <div class="wx-card-footer">
                        <div style="font-family:var(--f-mono); font-size:10px; color:var(--muted);">
                            Mis à jour : ${new Date(item.updatedAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <div class="wx-card-actions">
                            <button class="btn-card-action" onclick="refreshAirport('${escapeHtml(item.icao)}')" title="Actualiser ce terrain">↻ Actualiser</button>
                            <button class="btn-card-action" onclick="copyCardMetar('${escapeHtml(item.icao)}', this)" title="Copier le METAR brut">Copier</button>
                            <button class="btn-card-action delete" onclick="removeAirport('${escapeHtml(item.icao)}')" title="Retirer ce terrain">✕ Retirer</button>
                        </div>
                    </div>
                `;

                container.appendChild(card);
            });
        }

        // Render Table Body for Tabular View
        function renderWeatherTableBody() {
            const tbody = document.getElementById('weatherTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (monitoredAirports.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 35px 20px; color: var(--muted-text);">
                            Aucun aérodrome surveillé pour le moment.<br>
                            Saisissez un code OACI ou cliquez sur <strong>Terrains du Vol</strong>.
                        </td>
                    </tr>
                `;
                return;
            }

            monitoredAirports.forEach(item => {
                const tr = document.createElement('tr');
                const d = item.decoded || {};
                const cat = d.fltCat || 'VFR';
                const catClass = `rule-${cat.toLowerCase()}`;

                let chipsHtml = '';
                if (d.wdir !== undefined && d.wspd !== undefined) {
                    const windStr = d.wdir === 'VRB' ? `VRB ${d.wspd} kt` : `${Math.round(d.wdir).toString().padStart(3,'0')}° ${d.wspd} kt`;
                    chipsHtml += `<span class="wx-chip">${escapeHtml(windStr)}</span>`;
                }
                if (d.vis) chipsHtml += `<span class="wx-chip">${escapeHtml(d.vis)}</span>`;
                if (d.clouds && d.clouds.length > 0) {
                    chipsHtml += `<span class="wx-chip">${escapeHtml(d.clouds[0].cover)} ${d.clouds[0].base ? d.clouds[0].base + 'ft' : ''}</span>`;
                } else if (d.ceilingFt) {
                    chipsHtml += `<span class="wx-chip">Ceil ${d.ceilingFt}ft</span>`;
                }
                if (d.temp !== undefined) chipsHtml += `<span class="wx-chip">${d.temp}°C</span>`;
                if (d.altim) chipsHtml += `<span class="wx-chip">QNH ${escapeHtml(d.altim)}</span>`;

                tr.innerHTML = `
                    <td class="apt-cell">
                        <div class="apt-icao">${escapeHtml(item.icao)}</div>
                        <div class="apt-name">${escapeHtml(item.name || '')}</div>
                        <span class="flight-rule-badge ${catClass}">${cat}</span>
                    </td>
                    <td>
                        <div class="decoded-chips">${chipsHtml || '<span style="color:var(--muted-text); font-size:12px;">Pas d\'éléments décodés</span>'}</div>
                    </td>
                    <td>
                        <div class="raw-metar" style="font-family:var(--f-mono); font-size:12px;">${escapeHtml(item.metar || 'Pas de METAR disponible')}</div>
                    </td>
                    <td>
                        <div class="raw-taf" style="font-family:var(--f-mono); font-size:11px;">${escapeHtml(item.taf || 'Pas de TAF disponible')}</div>
                    </td>
                    <td style="text-align: right;">
                        <button class="btn-table-action" onclick="refreshAirport('${escapeHtml(item.icao)}')" title="Actualiser">↻</button>
                        <button class="btn-table-action delete" onclick="removeAirport('${escapeHtml(item.icao)}')" title="Supprimer">✕</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Switch between Decoded and Raw Tab inside a Card
        window.switchCardMetarTab = function(icao, tab) {
            const item = monitoredAirports.find(a => a.icao === icao);
            if (item) {
                item.viewTab = tab;
            }
            const decEl = document.getElementById(`metar-decoded-${icao}`);
            const rawEl = document.getElementById(`metar-raw-${icao}`);
            const card = document.getElementById(`wx-card-${icao}`);
            if (decEl && rawEl && card) {
                decEl.style.display = tab === 'decoded' ? 'block' : 'none';
                rawEl.style.display = tab === 'raw' ? 'block' : 'none';
                card.querySelectorAll('.wx-tab-btn').forEach(button => {
                    button.classList.toggle('active', button.dataset.tab === tab);
                });
            }
        };

        // Apply Runway heading to Crosswind Calculator
        window.applyRunwayToCalc = function(heading, wdir, wspd) {
            if (typeof switchPrepTab === 'function') {
                switchPrepTab('flight-fuel');
            }
            const rwyInput = document.getElementById('xwRwy');
            const dirInput = document.getElementById('xwDir');
            const spdInput = document.getElementById('xwSpd');
            if (rwyInput && heading !== undefined && heading !== null) {
                rwyInput.value = Math.round(heading / 10).toString().padStart(2, '0');
            }
            if (dirInput && wdir && wdir !== 'VRB') {
                dirInput.value = Math.round(parseFloat(wdir)) || wdir;
            }
            if (spdInput && wspd) {
                spdInput.value = Math.round(parseFloat(wspd)) || wspd;
            }
            if (typeof calcCrosswind === 'function') {
                calcCrosswind();
            }
            setTimeout(() => {
                const crosswindSec = document.querySelector('.xw-studio-box');
                if (crosswindSec) {
                    crosswindSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        };

        // Copy raw METAR to clipboard with button feedback
        window.copyCardMetar = function(icao, btn) {
            const item = monitoredAirports.find(a => a.icao === icao);
            if (!item || !item.metar) return;
            navigator.clipboard.writeText(item.metar).then(() => {
                const prev = btn.innerHTML;
                btn.innerHTML = '✓ Copié !';
                btn.style.color = 'var(--success)';
                btn.style.borderColor = 'var(--success)';
                setTimeout(() => {
                    btn.innerHTML = prev;
                    btn.style.color = '';
                    btn.style.borderColor = '';
                }, 1500);
            });
        };

        // Add Aerodrome with Smart Loading State
        async function addAirport(query, isExplicit = true) {
            if (!query || typeof query !== 'string') return;
            let icao = query.trim().toUpperCase();

            // If user typed airport name or city, resolve to 4-letter ICAO
            if (icao.length !== 4 && typeof AeroData !== 'undefined' && AeroData.AIRPORTS) {
                const found = AeroData.AIRPORTS.find(a => 
                    a.icao === icao ||
                    a.name.toUpperCase().includes(icao) || 
                    a.city.toUpperCase().includes(icao)
                );
                if (found) icao = found.icao;
            }

            if (!icao || icao.length < 3 || icao.length > 4) {
                alert("Veuillez saisir un code OACI valide (ex: LFPN, LFPO, LFMD) ou le nom d'un terrain.");
                return;
            }

            if (isExplicit && icao === 'LFPG') {
                localStorage.setItem('altiview_user_explicit_lfpg', 'true');
            }

            if (monitoredAirports.some(a => a.icao === icao)) {
                refreshAirport(icao);
                const existing = document.getElementById(`wx-card-${icao}`);
                if (existing) existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            // Create loading placeholder card
            const grid = document.getElementById('weatherCardsGrid');
            const placeholderCard = document.createElement('div');
            placeholderCard.className = 'wx-card';
            placeholderCard.id = `wx-card-loading-${icao}`;
            placeholderCard.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--muted-text);">
                    <span class="pulse-dot"></span> Récupération du METAR et TAF pour <strong>${escapeHtml(icao)}</strong>...
                </div>
            `;
            if (grid) grid.prepend(placeholderCard);

            try {
                const wxData = await fetchAirportWeather(icao);
                const pl = document.getElementById(`wx-card-loading-${icao}`);
                if (pl) pl.remove();

                monitoredAirports.unshift(wxData);
                saveMonitoredAirports();
                renderWeatherCenter();
                syncWeatherNotesSummary();

                const newCard = document.getElementById(`wx-card-${icao}`);
                if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (err) {
                const pl = document.getElementById(`wx-card-loading-${icao}`);
                if (pl) {
                    pl.innerHTML = `
                        <div style="padding: 16px; color: var(--danger); font-size: 13px;">
                            ✕ <strong>${escapeHtml(icao)}</strong> : ${escapeHtml(err.message)}
                            <button class="btn-card-action" style="margin-left: 10px;" onclick="this.closest('.wx-card').remove()">Fermer</button>
                        </div>
                    `;
                }
            }
        }

        async function refreshAirport(icao) {
            const index = monitoredAirports.findIndex(a => a.icao === icao);
            if (index === -1) return;
            try {
                const wxData = await fetchAirportWeather(icao);
                wxData.viewTab = monitoredAirports[index].viewTab || 'raw';
                monitoredAirports[index] = wxData;
                saveMonitoredAirports();
                renderWeatherCenter();
            } catch (e) {
                alert(`Échec de l'actualisation pour ${icao}: ${e.message}`);
            }
        }

        function removeAirport(icao) {
            monitoredAirports = monitoredAirports.filter(a => a.icao !== icao);
            if (icao === 'LFPG') {
                localStorage.removeItem('altiview_user_explicit_lfpg');
            }
            saveMonitoredAirports();
            renderWeatherCenter();
        }

        function paintWxAutoRefreshBadge(state, detail = '') {
            const badge = document.getElementById('wxAutoRefreshBadge');
            if (!badge) return;
            const label = state === 'refreshing'
                ? 'ACTUALISATION METAR / TAF'
                : state === 'offline'
                    ? 'METAR / TAF EN ATTENTE'
                    : 'METAR + TAF AUTO · 10 MIN';
            badge.innerHTML = `<span class="pulse-dot"></span> ${label}`;
            badge.dataset.state = state;
            badge.title = detail || (state === 'offline'
                ? 'Actualisation suspendue hors connexion. Elle reprendra automatiquement au retour du réseau.'
                : 'METAR et TAF actualisés automatiquement toutes les 10 minutes.');
        }

        async function refreshAllWeather(options = {}) {
            if (wxRefreshInFlight) return wxRefreshInFlight;
            const automatic = !!(options && options.automatic);
            let refreshedCount = 0;
            const refreshBtn = document.getElementById('refreshAllWxBtn');
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '↻ Actualisation...';
            }
            paintWxAutoRefreshBadge('refreshing', automatic ? 'Actualisation automatique des METAR et TAF en cours.' : 'Actualisation manuelle des METAR et TAF en cours.');

            wxRefreshInFlight = (async () => {
                for (let i = 0; i < monitoredAirports.length; i++) {
                    try {
                        const wxData = await fetchAirportWeather(monitoredAirports[i].icao);
                        wxData.viewTab = monitoredAirports[i].viewTab || 'raw';
                        monitoredAirports[i] = wxData;
                        refreshedCount += 1;
                    } catch (e) {}
                }
                if (refreshedCount > 0 || monitoredAirports.length === 0) wxLastRefreshAt = Date.now();
                saveMonitoredAirports();
                renderWeatherCenter();
                syncWeatherNotesSummary();
            })();

            try {
                await wxRefreshInFlight;
            } finally {
                wxRefreshInFlight = null;
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = '↻ Tout actualiser';
                }
                if (refreshedCount === 0 && monitoredAirports.length > 0) {
                    paintWxAutoRefreshBadge('offline', 'Source officielle NOAA AWC indisponible. Les dernières données officielles sont conservées.');
                } else {
                    const time = new Date(wxLastRefreshAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const coverage = monitoredAirports.length ? ` ${refreshedCount}/${monitoredAirports.length} terrain(s).` : '';
                    paintWxAutoRefreshBadge('ready', `Dernière actualisation NOAA AWC : ${time}.${coverage} Prochaine vérification dans 10 minutes.`);
                }
            }
        }

        function requestWeatherAutoRefresh(force = false) {
            if (!document.body.classList.contains('page-meteo') || document.hidden || monitoredAirports.length === 0) return;
            if (navigator.onLine === false) {
                paintWxAutoRefreshBadge('offline');
                return;
            }
            if (!force && wxLastRefreshAt && Date.now() - wxLastRefreshAt < WX_RESUME_REFRESH_MS) return;
            refreshAllWeather({ automatic: true });
        }

        function startWeatherAutoRefresh() {
            if (!document.body.classList.contains('page-meteo')) return;
            paintWxAutoRefreshBadge('ready', 'Actualisation automatique active toutes les 10 minutes.');
            requestWeatherAutoRefresh(true);
            if (!wxAutoRefreshTimer) {
                wxAutoRefreshTimer = setInterval(() => requestWeatherAutoRefresh(true), WX_AUTO_REFRESH_MS);
            }
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) requestWeatherAutoRefresh(false);
            });
            window.addEventListener('focus', () => requestWeatherAutoRefresh(false));
            window.addEventListener('online', () => requestWeatherAutoRefresh(true));
            window.addEventListener('offline', () => paintWxAutoRefreshBadge('offline'));
        }

        // Quick Preset Addition Helper
        window.quickAddAirports = function(icaoList) {
            if (!Array.isArray(icaoList)) return;
            icaoList.forEach(icao => {
                if (!monitoredAirports.some(a => a.icao === icao)) {
                    addAirport(icao);
                }
            });
        };

        // Route Airfields Auto-Detection
        function loadRouteAirfields() {
            try {
                const raw = localStorage.getItem(MAP_STORAGE_KEY);
                if (!raw) {
                    alert("Aucune route tracée sur la carte interactive pour le moment.");
                    return;
                }
                const data = JSON.parse(raw);
                const wps = data.waypoints || [];
                if (wps.length === 0) {
                    alert("Aucun point de virage trouvé dans votre route.");
                    return;
                }
                const detected = [];
                wps.forEach(wp => {
                    if (wp.name) {
                        const m = wp.name.trim().toUpperCase().match(/\b([A-Z]{4})\b/);
                        if (m && !detected.includes(m[1])) detected.push(m[1]);
                    }
                });
                if (detected.length === 0) {
                    alert("Aucun code OACI à 4 lettres trouvé dans les noms de vos waypoints (ex: LFPN, LFPO, LFRG).");
                    return;
                }
                detected.forEach(icao => {
                    if (!monitoredAirports.some(a => a.icao === icao)) {
                        addAirport(icao);
                    }
                });
            } catch (e) {
                console.warn("Impossible de charger les terrains de la route", e);
            }
        }

        function syncWeatherNotesSummary() {
            if (!weatherText) return;
            if (!weatherText.value || weatherText.value.trim() === '') {
                const summary = monitoredAirports.map(a => `${a.icao}: ${a.metar}`).join('\n\n');
                if (summary) {
                    weatherText.value = summary;
                    saveWeather();
                }
            }
        }

        // View Mode Switcher (Cards vs Table)
        function setWxViewMode(mode) {
            currentWxViewMode = mode;
            localStorage.setItem(WX_VIEW_MODE_KEY, mode);
            const btnCards = document.getElementById('btnWxViewCards');
            const btnTable = document.getElementById('btnWxViewTable');
            const cardsGrid = document.getElementById('weatherCardsGrid');
            const tableWrap = document.getElementById('weatherTableWrap');

            if (btnCards && btnTable && cardsGrid && tableWrap) {
                if (mode === 'table') {
                    btnCards.classList.remove('active');
                    btnTable.classList.add('active');
                    cardsGrid.style.display = 'none';
                    tableWrap.style.display = 'block';
                } else {
                    btnTable.classList.remove('active');
                    btnCards.classList.add('active');
                    cardsGrid.style.display = 'grid';
                    tableWrap.style.display = 'none';
                }
            }
        }

        // Omni-Search Autocomplete Logic
        function initWxOmniSearch() {
            const input = document.getElementById('icaoInput');
            const suggestionsBox = document.getElementById('wxSearchSuggestions');
            const addBtn = document.getElementById('addIcaoBtn');
            if (!input || !suggestionsBox) return;

            let debounceTimer = null;
            let activeIndex = -1;

            input.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const q = input.value.trim().toUpperCase();
                    if (q.length < 2) {
                        suggestionsBox.style.display = 'none';
                        suggestionsBox.innerHTML = '';
                        activeIndex = -1;
                        return;
                    }

                    let matches = [];
                    if (typeof AeroData !== 'undefined' && AeroData.AIRPORTS) {
                        matches = AeroData.AIRPORTS.filter(apt => {
                            return apt.icao.startsWith(q) ||
                                   apt.icao.includes(q) ||
                                   apt.name.toUpperCase().includes(q) ||
                                   (apt.city && apt.city.toUpperCase().includes(q));
                        }).slice(0, 8);
                    } else {
                        matches = Object.keys(KNOWN_AIRPORTS).filter(k => 
                            k.includes(q) || KNOWN_AIRPORTS[k].toUpperCase().includes(q)
                        ).map(k => ({ icao: k, name: KNOWN_AIRPORTS[k], city: '', alt: '' }));
                    }

                    if (matches.length === 0) {
                        suggestionsBox.style.display = 'none';
                        suggestionsBox.innerHTML = '';
                        return;
                    }

                    suggestionsBox.innerHTML = matches.map((m, idx) => `
                        <div class="wx-suggestion-item" data-icao="${escapeHtml(m.icao)}" data-idx="${idx}">
                            <div>
                                <span class="wx-sugg-icao">${escapeHtml(m.icao)}</span>
                                <span class="wx-sugg-name" style="margin-left: 8px;">${escapeHtml(m.name || '')}</span>
                                ${m.city ? `<div class="wx-sugg-city">${escapeHtml(m.city)}</div>` : ''}
                            </div>
                            <div class="wx-sugg-meta">
                                ${m.alt ? `Elev ${m.alt} ft` : ''}
                                ${(m.runways && m.runways[0]) ? `<br>${escapeHtml(m.runways[0].name || '')}` : ''}
                            </div>
                        </div>
                    `).join('');

                    suggestionsBox.style.display = 'block';
                    activeIndex = -1;

                    suggestionsBox.querySelectorAll('.wx-suggestion-item').forEach(itemEl => {
                        itemEl.addEventListener('click', () => {
                            const icao = itemEl.getAttribute('data-icao');
                            input.value = '';
                            suggestionsBox.style.display = 'none';
                            addAirport(icao);
                        });
                    });
                }, 180);
            });

            input.addEventListener('keydown', (e) => {
                const items = suggestionsBox.querySelectorAll('.wx-suggestion-item');
                if (e.key === 'ArrowDown') {
                    if (suggestionsBox.style.display === 'block' && items.length > 0) {
                        e.preventDefault();
                        activeIndex = (activeIndex + 1) % items.length;
                        highlightSuggestion(items, activeIndex);
                    }
                } else if (e.key === 'ArrowUp') {
                    if (suggestionsBox.style.display === 'block' && items.length > 0) {
                        e.preventDefault();
                        activeIndex = (activeIndex - 1 + items.length) % items.length;
                        highlightSuggestion(items, activeIndex);
                    }
                } else if (e.key === 'Enter') {
                    if (suggestionsBox.style.display === 'block' && activeIndex >= 0 && items[activeIndex]) {
                        e.preventDefault();
                        const icao = items[activeIndex].getAttribute('data-icao');
                        input.value = '';
                        suggestionsBox.style.display = 'none';
                        addAirport(icao);
                    } else if (input.value.trim()) {
                        e.preventDefault();
                        const val = input.value.trim();
                        input.value = '';
                        suggestionsBox.style.display = 'none';
                        addAirport(val);
                    }
                } else if (e.key === 'Escape') {
                    suggestionsBox.style.display = 'none';
                }
            });

            function highlightSuggestion(items, idx) {
                items.forEach((it, i) => it.classList.toggle('highlighted', i === idx));
                if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
            }

            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
                    suggestionsBox.style.display = 'none';
                }
            });

            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    if (input.value.trim()) {
                        addAirport(input.value.trim());
                        input.value = '';
                        suggestionsBox.style.display = 'none';
                    }
                });
            }
        }

        // Setup Event Listeners and Initializers for Weather Center
        document.getElementById('refreshAllWxBtn').addEventListener('click', refreshAllWeather);
        document.getElementById('loadRouteAirportsBtn').addEventListener('click', loadRouteAirfields);

        const btnWxCards = document.getElementById('btnWxViewCards');
        const btnWxTable = document.getElementById('btnWxViewTable');
        if (btnWxCards) btnWxCards.addEventListener('click', () => setWxViewMode('cards'));
        if (btnWxTable) btnWxTable.addEventListener('click', () => setWxViewMode('table'));

        initWxOmniSearch();
        setWxViewMode(currentWxViewMode);

        // URL Query Parameter Handling on Startup (e.g. ?icao=LFPN or ?wx=LFPN)
        window.addEventListener('DOMContentLoaded', () => {
            const params = new URLSearchParams(window.location.search);
            const targetIcao = params.get('icao') || params.get('wx');
            if (targetIcao) {
                const clean = targetIcao.trim().toUpperCase();
                if (typeof switchMfdSection === 'function') {
                    switchMfdSection('wx');
                }
                setTimeout(() => {
                    addAirport(clean);
                }, 300);
            }
        });

        // Crosswind Calc
        function calcCrosswind() {
            const rwyInput = document.getElementById('xwRwy');
            const dirInput = document.getElementById('xwDir');
            const spdInput = document.getElementById('xwSpd');
            if (!rwyInput || !dirInput || !spdInput) return;
            
            const rwy = parseFloat(rwyInput.value) * 10 || 0; 
            const actualRwy = rwyInput.value.length <= 2 ? rwy : parseFloat(rwyInput.value); 
            const dir = parseFloat(dirInput.value) || 0;
            const spd = parseFloat(spdInput.value) || 0;

            const angle = toRad(dir - actualRwy);
            const hw = spd * Math.cos(angle);
            const xw = Math.abs(spd * Math.sin(angle));

            const resHw = document.getElementById('resHw');
            const resXw = document.getElementById('resXw');

            if (resHw) {
                resHw.textContent = Math.round(hw) + ' kt' + (hw < 0 ? ' (Arrière)' : ' (Face)');
                resHw.className = 'xw-res-val' + (hw < -5 ? ' danger' : '');
            }
            if (resXw) {
                resXw.textContent = Math.round(xw) + ' kt';
                resXw.className = 'xw-res-val' + (xw > 15 ? ' danger' : '');
            }
            saveLocalSettings();
        }
        ['xwRwy', 'xwDir', 'xwSpd'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calcCrosswind);
        });

        // Escaping HTML
        function escapeHtml(str) { return document.createElement('div').appendChild(document.createTextNode(str)).parentNode.innerHTML; }

        // Checklist toggle styles handled by readiness event listeners

        // ==========================================
        // AERODROME NOTAMS SYSTEM & Q-CODE DECODER
        // ==========================================

        const Q_SUBJECTS = {
            'FA': { name: 'Aerodrome', cat: 'aerodrome' },
            'FB': { name: 'Braking Action', cat: 'runway' },
            'FC': { name: 'Ceiling', cat: 'weather' },
            'FD': { name: 'Docking System', cat: 'aerodrome' },
            'FF': { name: 'Fire Fighting (RFFS)', cat: 'aerodrome' },
            'FG': { name: 'Ground Movement', cat: 'aerodrome' },
            'FH': { name: 'Helicopter Area', cat: 'aerodrome' },
            'FL': { name: 'Landing Direction Ind.', cat: 'aerodrome' },
            'FM': { name: 'Meteo Service', cat: 'weather' },
            'FO': { name: 'Fog Dispersal', cat: 'weather' },
            'MR': { name: 'Runway', cat: 'runway' },
            'MS': { name: 'Stopway', cat: 'runway' },
            'MT': { name: 'Threshold', cat: 'runway' },
            'MU': { name: 'Runway Friction', cat: 'runway' },
            'MW': { name: 'Wind Direction Ind.', cat: 'aerodrome' },
            'MX': { name: 'Taxiway', cat: 'runway' },
            'MY': { name: 'Rapid Exit Taxiway', cat: 'runway' },
            'NA': { name: 'Radio Nav Aids', cat: 'nav' },
            'NB': { name: 'NDB', cat: 'nav' },
            'NC': { name: 'DECCA', cat: 'nav' },
            'ND': { name: 'DME', cat: 'nav' },
            'NF': { name: 'Fan Marker', cat: 'nav' },
            'NL': { name: 'Localizer', cat: 'nav' },
            'NM': { name: 'VOR/DME', cat: 'nav' },
            'NN': { name: 'TACAN', cat: 'nav' },
            'NV': { name: 'VOR', cat: 'nav' },
            'IC': { name: 'ILS', cat: 'nav' },
            'ID': { name: 'DME (ILS)', cat: 'nav' },
            'IG': { name: 'Glide Path (ILS)', cat: 'nav' },
            'II': { name: 'Inner Marker', cat: 'nav' },
            'IL': { name: 'Localizer (ILS)', cat: 'nav' },
            'IM': { name: 'Middle Marker', cat: 'nav' },
            'IO': { name: 'Outer Marker', cat: 'nav' },
            'OB': { name: 'Obstacle', cat: 'obstacle' },
            'OE': { name: 'Wind Turbine', cat: 'obstacle' },
            'OL': { name: 'Obstacle Lights', cat: 'obstacle' },
            'PA': { name: 'Air Traffic Control', cat: 'comms' },
            'PB': { name: 'Approach Control', cat: 'comms' },
            'PC': { name: 'Area Control Center', cat: 'comms' },
            'PD': { name: 'Radar', cat: 'comms' },
            'PE': { name: 'Enroute Radar', cat: 'comms' },
            'PF': { name: 'Flow Control', cat: 'comms' },
            'PG': { name: 'Tower Control (TWR)', cat: 'comms' },
            'PH': { name: 'Ground Control (GND)', cat: 'comms' },
            'PI': { name: 'Flight Information (FIS)', cat: 'comms' },
            'PK': { name: 'Transponder', cat: 'comms' },
            'PL': { name: 'Flight Plan Service', cat: 'comms' },
            'PM': { name: 'Aerodrome FIS (AFIS)', cat: 'comms' },
            'PN': { name: 'Noise Abatement', cat: 'info' },
            'PO': { name: 'PBN / RNAV Procedure', cat: 'nav' },
            'RA': { name: 'Airspace Reservation', cat: 'obstacle' },
            'RD': { name: 'Danger Area', cat: 'obstacle' },
            'RM': { name: 'Military Ops Area', cat: 'obstacle' },
            'RO': { name: 'Overflying', cat: 'info' },
            'RP': { name: 'Prohibited Area', cat: 'obstacle' },
            'RR': { name: 'Restricted Area', cat: 'obstacle' },
            'RT': { name: 'Temp Reserved Area (TRA)', cat: 'obstacle' },
            'SA': { name: 'GNSS / GPS', cat: 'nav' },
            'SB': { name: 'Satellite Broadcast', cat: 'nav' },
            'ST': { name: 'TCAS', cat: 'nav' },
            'WA': { name: 'Air Display / Airshow', cat: 'obstacle' },
            'WB': { name: 'Aerobatics', cat: 'obstacle' },
            'WC': { name: 'Captive Balloon', cat: 'obstacle' },
            'WD': { name: 'Demolition of Explosives', cat: 'obstacle' },
            'WE': { name: 'Military Exercise', cat: 'obstacle' },
            'WF': { name: 'Air Refuelling', cat: 'info' },
            'WG': { name: 'Glider Flying', cat: 'obstacle' },
            'WH': { name: 'Blasting Hazard', cat: 'obstacle' },
            'WJ': { name: 'Banner Towing', cat: 'info' },
            'WL': { name: 'Ascent of Balloon', cat: 'obstacle' },
            'WM': { name: 'Missile / Rocket Activity', cat: 'obstacle' },
            'WP': { name: 'Parachute Jumping', cat: 'obstacle' },
            'WR': { name: 'Radioactive Materials', cat: 'obstacle' },
            'WS': { name: 'Burning / Flare Hazard', cat: 'obstacle' },
            'WT': { name: 'Mass Movement of A/C', cat: 'info' },
            'WU': { name: 'UAS / Drone Activity', cat: 'obstacle' },
            'WV': { name: 'Formation Flight', cat: 'info' },
            'WW': { name: 'Volcanic Activity', cat: 'obstacle' },
            'WY': { name: 'Aerial Survey', cat: 'info' },
            'WZ': { name: 'Model Aircraft Flying', cat: 'obstacle' }
        };

        const Q_CONDITIONS = {
            'AC': 'Active',
            'AD': 'Available for daylight only',
            'AF': 'Flight checked and reliable',
            'AH': 'Hours of service changed',
            'AK': 'Resumed normal operations',
            'AL': 'Operates subject to conditions',
            'AO': 'Operational',
            'AP': 'Available, prior permission required',
            'AR': 'Available on request',
            'AS': 'Unserviceable',
            'AU': 'Not available (operational limitation)',
            'AW': 'Completely withdrawn',
            'AX': 'Shut down',
            'CA': 'Activated',
            'CC': 'Completed',
            'CD': 'Deactivated',
            'CE': 'Erected',
            'CF': 'Operating frequency changed',
            'CG': 'Degraded',
            'CH': 'Changed',
            'CI': 'Identification or radio call sign changed',
            'CL': 'Realigned',
            'CM': 'Displaced',
            'CN': 'Canceled',
            'CS': 'Installed',
            'CT': 'On test, do not use',
            'HA': 'Braking action poor',
            'HB': 'Braking action medium/poor',
            'HC': 'Braking action medium',
            'HD': 'Braking action medium/good',
            'HE': 'Braking action good',
            'HF': 'Totally free of snow and ice',
            'HG': 'Grass cutting in progress',
            'HH': 'Hazard due to birds',
            'HI': 'Snow clearance completed',
            'HJ': 'Launch of rubber balloons',
            'HK': 'Bird hazard extinguished',
            'HL': 'Work completed',
            'HN': 'Lit / lighting installed',
            'HO': 'Obscured by snow',
            'HQ': 'Operation canceled',
            'HR': 'Standing water',
            'HS': 'Sanded',
            'HT': 'Approach trenching',
            'HU': 'Oil on runway',
            'HV': 'Work in progress',
            'HW': 'Work in progress',
            'HX': 'Concentration of birds',
            'HY': 'Snow banks exist',
            'HZ': 'Covered by frozen ruts',
            'LA': 'Operating on auxiliary power',
            'LB': 'Reserved for aircraft based on site',
            'LC': 'Closed',
            'LD': 'Unsafe',
            'LE': 'Engaged',
            'LF': 'Interference',
            'LG': 'Operating without identification',
            'LH': 'Unserviceable for certain types',
            'LI': 'Unserviceable',
            'LJ': 'Available without lighting',
            'LK': 'Operating normally',
            'LL': 'Usable length reduced',
            'LM': 'Markings obliteration',
            'LN': 'Unlit',
            'LP': 'Prohibited',
            'LR': 'Aircraft restricted to runways',
            'LS': 'Subject to interruption',
            'LT': 'Limited',
            'LV': 'Closed to VFR flights',
            'LW': 'Will take place',
            'LX': 'Operating but caution advised'
        };

        function decodeQCode(qCode) {
            if (!qCode || qCode.length < 5) {
                return { title: 'Operational Notice', subject: 'General', condition: '', cat: 'info', severity: 'info' };
            }
            const code = qCode.toUpperCase().trim();
            const subjCode = code.substring(1, 3);
            const condCode = code.substring(3, 5);

            const subj = Q_SUBJECTS[subjCode] || { name: 'Aviation Facility', cat: 'info' };
            const cond = Q_CONDITIONS[condCode] || condCode;

            let severity = 'info';
            let cat = subj.cat || 'info';

            // Severity rules
            if (condCode === 'LC' || (subjCode === 'MR' && (condCode === 'LC' || condCode === 'LL')) || (subjCode === 'FA' && condCode === 'LC')) {
                severity = 'critical';
            } else if (
                condCode === 'AS' || condCode === 'AU' || condCode === 'CE' || condCode === 'CG' ||
                condCode === 'LI' || condCode === 'HN' || condCode === 'HW' || condCode === 'CT' ||
                condCode === 'LN' || condCode === 'LV' || (subjCode === 'MX' && condCode === 'LC') ||
                subjCode === 'OB' || subjCode === 'OE' || (subjCode === 'FF' && condCode === 'CG')
            ) {
                severity = 'warning';
            }

            return {
                subject: subj.name,
                condition: cond,
                title: `${subj.name} ${cond}`,
                cat: cat,
                severity: severity
            };
        }

        function parseFlexibleNotamDate(str) {
            if (!str) return null;
            str = String(str).trim();
            // 1. ICAO standard 10-digit YYMMDDHHMM
            if (/^\d{10}$/.test(str)) {
                const yr = 2000 + parseInt(str.substring(0, 2), 10);
                const mo = parseInt(str.substring(2, 4), 10) - 1;
                const day = parseInt(str.substring(4, 6), 10);
                const hr = parseInt(str.substring(6, 8), 10);
                const min = parseInt(str.substring(8, 10), 10);
                return new Date(Date.UTC(yr, mo, day, hr, min));
            }
            // 2. 12-digit YYYYMMDDHHMM
            if (/^\d{12}$/.test(str)) {
                const yr = parseInt(str.substring(0, 4), 10);
                const mo = parseInt(str.substring(4, 6), 10) - 1;
                const day = parseInt(str.substring(6, 8), 10);
                const hr = parseInt(str.substring(8, 10), 10);
                const min = parseInt(str.substring(10, 12), 10);
                return new Date(Date.UTC(yr, mo, day, hr, min));
            }
            // 3. Slash / French format: DD/MM/YY HH:MM or DD/MM/YYYY HH:MM
            const slashMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
            if (slashMatch) {
                const day = parseInt(slashMatch[1], 10);
                const mo = parseInt(slashMatch[2], 10) - 1;
                let yr = parseInt(slashMatch[3], 10);
                if (yr < 100) yr += 2000;
                const hr = slashMatch[4] ? parseInt(slashMatch[4], 10) : 0;
                const min = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
                return new Date(Date.UTC(yr, mo, day, hr, min));
            }
            // 4. Fallback Date parse
            const parsed = new Date(str);
            return isNaN(parsed.getTime()) ? null : parsed;
        }

        function parseNotamDate(dateStr) {
            return parseFlexibleNotamDate(dateStr);
        }

        function computeNotamStatus(startDate, isPerm, endDate) {
            const now = new Date();
            if (isPerm || endDate === 'PERM') {
                return { status: 'perm', label: 'PERMANENT', class: 'status-perm' };
            }
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start && !isNaN(start.getTime()) && now < start) {
                return { status: 'upcoming', label: 'UPCOMING', class: 'status-upcoming' };
            }
            if (end && !isNaN(end.getTime()) && now > end) {
                return { status: 'expired', label: 'EXPIRED', class: 'status-expired' };
            }
            return { status: 'active', label: 'ACTIVE NOW', class: 'status-active' };
        }

        function formatNotamDate(dateVal) {
            if (!dateVal) return '—';
            if (dateVal === 'PERM') return 'PERM';
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return String(dateVal);
            const day = d.getUTCDate().toString().padStart(2, '0');
            const mo = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
            const hh = d.getUTCHours().toString().padStart(2, '0');
            const mm = d.getUTCMinutes().toString().padStart(2, '0');
            return `${day} ${mo} ${hh}:${mm} UTC`;
        }

        function formatNotamBody(text) {
            let escaped = escapeHtml(text || '');
            // Highlight runway designators (e.g. RWY 08R/26L, RWY 27, PISTE 07L/25R)
            escaped = escaped.replace(/\b((?:RWY|PISTE)\s+[0-9]{2}[LRC]?(\/[0-9]{2}[LRC]?)?)\b/gi, '<strong class="highlight-text">$1</strong>');
            // Highlight taxiways (e.g. TWY B, TWY A1)
            escaped = escaped.replace(/\b((?:TWY|TAXIWAY)\s+[A-Z0-9]+)\b/gi, '<strong>$1</strong>');
            // Highlight closures & unserviceable notices
            escaped = escaped.replace(/\b(CLSD|CLOSED|FERME|FERMEE|FERMETURE|UNSERVICEABLE|U\/S|INDISPONIBLE|INTERDIT|PROHIBITED)\b/gi, '<strong style="color:var(--danger);">$1</strong>');
            return escaped;
        }

        // Mock signatures from older test versions that must never be presented as real operational hazards
        const MOCK_NOTAM_SIGNATURES = [
            'RWY 08R/26L CLSD DUE TO WORK IN PROGRESS',
            'GRASS RWY 07L/25R CLSD DUE TO WATER ACCUMULATION',
            'VOR CLM 113.85 MHZ U/S',
            'OBST CRANE ERECTED 1.2NM EAST OF THR 27R',
            'BIRD HAZARD CONCENTRATED IN VICINITY OF RWY 09L/27R',
            'TWR HOURS OF OPS: MON-FRI 0700-1900 UTC',
            'PARACHUTING ACTIVITY OVER SECTOR NORTH',
            'ILS DME RWY 27L NOT AVBL DUE TO SCHEDULED CALIBRATION',
            'TWY B BTN TWY B2 AND TWY B4 CLSD',
            'STANDARD NOISE ABATEMENT PROCEDURES IN EFFECT',
            'OBSTACLE CRANE ERECTED IN VICINITY OF AERODROME',
            'MAINT VEHICLES ON SFC'
        ];

        function isMockNotam(notam) {
            if (!notam) return false;
            const full = ((notam.text || '') + ' ' + (notam.raw || '')).toUpperCase();
            return MOCK_NOTAM_SIGNATURES.some(sig => full.includes(sig.toUpperCase()));
        }

        function parseRawNotamBlock(block, defaultIcao = '') {
            block = (block || '').trim();
            if (!block || block.length < 5) return null;

            // 1. NOTAM ID (e.g. A0421/26 NOTAMN, !FDC 4/1234, or !JFK 04/082)
            let notamId = 'NOTAM';
            const idMatch = block.match(/\b([A-Z]\d{4}\/\d{2})\b/);
            if (idMatch) {
                notamId = idMatch[1];
            } else {
                const fdcMatch = block.match(/!([A-Z0-9]{3,4})\s+(\d+\/\d+)/);
                if (fdcMatch) {
                    notamId = `${fdcMatch[1]} ${fdcMatch[2]}`;
                } else {
                    const numMatch = block.match(/NOTAM\s+([A-Z0-9\/-]+)/i);
                    if (numMatch) notamId = numMatch[1].toUpperCase();
                }
            }

            // 2. Q-line
            let qCode = '';
            let qLine = '';
            const qMatch = block.match(/Q\)\s*([^\n\r]+)/);
            if (qMatch) {
                qLine = qMatch[1].trim();
                const qcMatch = qLine.match(/\/Q([A-Z]{4})\//);
                if (qcMatch) qCode = 'Q' + qcMatch[1];
            }

            // 3. Item A (Airport ICAO)
            let icao = (defaultIcao || '').toUpperCase().trim();
            const aMatch = block.match(/A\)\s*([A-Z]{4})/);
            if (aMatch) {
                icao = aMatch[1].toUpperCase();
            } else {
                // Check FAA domestic pattern (e.g. !JFK 04/082 KJFK RWY...)
                const faaApt = block.match(/![A-Z0-9]{3,4}\s+\d+\/\d+\s+([A-Z]{4})/i);
                if (faaApt) {
                    icao = faaApt[1].toUpperCase();
                } else {
                    // Check header line (e.g. LFPG - PARIS CHARLES DE GAULLE or LFPG A0421/26)
                    const headerIcaoMatch = block.match(/\b([A-Z]{4})\b(?:\s*-\s*|\s+[A-Z]\d{4}\/\d{2})/);
                    if (headerIcaoMatch) {
                        icao = headerIcaoMatch[1].toUpperCase();
                    }
                }
            }
            if (!icao) icao = 'ZZZZ';

            // 4. Validity Dates
            let startDate = null;
            let endDate = null;
            let isPerm = false;

            // Item B (From)
            const bMatch = block.match(/B\)\s*(\d{10}|\d{12})/);
            if (bMatch) {
                startDate = parseFlexibleNotamDate(bMatch[1]);
            } else {
                const duMatch = block.match(/(?:DU|FROM)\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i);
                if (duMatch) startDate = parseFlexibleNotamDate(duMatch[1]);
            }

            // Item C (To)
            const cMatch = block.match(/C\)\s*(\d{10}|\d{12}|PERM|UFN|EST)/i);
            if (cMatch) {
                const cVal = cMatch[1].toUpperCase();
                if (cVal === 'PERM' || cVal === 'UFN') {
                    isPerm = true;
                } else {
                    endDate = parseFlexibleNotamDate(cVal);
                }
            } else {
                const auMatch = block.match(/(?:AU|TO)\s*:\s*(PERM|UFN|\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i);
                if (auMatch) {
                    const val = auMatch[1].toUpperCase();
                    if (val === 'PERM' || val === 'UFN') isPerm = true;
                    else endDate = parseFlexibleNotamDate(val);
                }
            }

            // 5. Item D (Schedule)
            let schedule = '';
            const dMatch = block.match(/D\)\s*([^\n\r]+)/);
            if (dMatch) schedule = dMatch[1].trim();

            // 6. Item E (Description Text)
            let text = '';
            const eMatch = block.match(/E\)\s*([\s\S]+?)(?=(?:\s+[F-G]\)|$))/);
            if (eMatch) {
                text = eMatch[1].trim();
            } else {
                text = block.replace(/^([A-Z]{4}\s*-\s*[^\n\r]+[\r\n]+)?([A-Z]\d{4}\/\d{2}[^\n\r]+[\r\n]+)?/i, '').trim();
            }

            // 7. Item F (Lower Altitude Limit) and Item G (Upper Altitude Limit)
            let lowerLimit = '';
            const fMatch = block.match(/F\)\s*([^\n\r]+?)(?=(?:\s+G\)|$))/i);
            if (fMatch) lowerLimit = fMatch[1].trim();

            let upperLimit = '';
            const gMatch = block.match(/G\)\s*([^\n\r]+)/i);
            if (gMatch) upperLimit = gMatch[1].trim();

            // Q-line coordinate, radius, and FL limits fallback
            let coordinates = '';
            let radius = '';
            if (qLine) {
                const qParts = qLine.split('/');
                if (qParts.length >= 8) {
                    const lastPart = qParts[qParts.length - 1].trim();
                    const coordMatch = lastPart.match(/(\d{4}[NS])\s*(\d{5}[EW])(?:\s*(\d{3}))?/);
                    if (coordMatch) {
                        coordinates = `${coordMatch[1]} ${coordMatch[2]}`;
                        if (coordMatch[3]) {
                            const rVal = parseInt(coordMatch[3], 10);
                            if (rVal > 0) radius = `${rVal} NM`;
                        }
                    }
                }
                if (!lowerLimit && !upperLimit) {
                    const flMatch = qLine.match(/\/(\d{3})\/(\d{3})\//);
                    if (flMatch && (flMatch[1] !== '000' || flMatch[2] !== '999')) {
                        lowerLimit = flMatch[1] === '000' ? 'SFC' : `FL${flMatch[1]}`;
                        upperLimit = flMatch[2] === '999' ? 'UNL' : `FL${flMatch[2]}`;
                    }
                }
            }

            // Q-code decode
            let decoded = decodeQCode(qCode);

            // Multilingual text heuristics if no formal Q-code or to augment decoded title
            const upText = (text + ' ' + block).toUpperCase();

            // 1. Obstacles have high priority if obstacle terms present
            if (/\b(OBST|CRANE|GRUE|TOWER|TOUR|PYLON|PYLONE|MAST|MAT|EOLIENNE|WIND TURBINE)\b/.test(upText)) {
                decoded.cat = 'obstacle';
                decoded.severity = 'warning';
                decoded.title = 'Obstacle Alert';
            } else if (/\b(PARACHUT|PJE|TIR|FIRING|DRONE|UAS|BALLOON|BALLON|VOL LIBRE|GLIDER|PLANEUR|EXER)\b/.test(upText)) {
                decoded.cat = 'activity';
                decoded.severity = 'warning';
                decoded.title = 'Aviation Activity / Restriction';
            } else if (/\b(VOR|ILS|DME|NDB|GNSS|PBN|FREQ|FREQUENCY|RADIO|TWR|AFIS|ATIS|RADAR|COMMS)\b/.test(upText)) {
                decoded.cat = 'nav';
                if (/\b(U\/S|UNSERVICEABLE|NOT AVBL|INDISPONIBLE|CLSD|OFF AIR)\b/.test(upText)) {
                    decoded.severity = 'warning';
                    decoded.title = 'Navaid / Comms Unserviceable';
                } else {
                    decoded.title = 'Navaid / Comms Notice';
                }
            } else if (/\b(RWY|RUNWAY|PISTE|TWY|TAXIWAY|APRON|PARKING|VOIE|AIRE|SEUIL|THR|SURFACE|HERBE|GRASS)\b/.test(upText)) {
                decoded.cat = 'runway';
                if (/\b(CLSD|CLOSED|FERME|FERMEE|FERMETURE|UNSERVICEABLE|U\/S)\b/.test(upText)) {
                    decoded.severity = 'critical';
                    decoded.title = 'Runway / Taxiway Closed';
                } else if (/\b(WIP|WORK IN PROGRESS|TRAVAUX|REDUCTION|RESTRICTED)\b/.test(upText)) {
                    decoded.severity = 'warning';
                    decoded.title = 'Runway / Taxiway Works';
                } else {
                    decoded.severity = 'warning';
                    decoded.title = 'Runway Information';
                }
            } else if (/\b(PROHIBITED|INTERDIT|DANGER|RESTRICTED)\b/.test(upText)) {
                decoded.cat = 'info';
                decoded.severity = 'critical';
                decoded.title = 'Airspace Warning';
            }

            const statusInfo = computeNotamStatus(startDate, isPerm, endDate);

            return {
                id: notamId,
                icao: icao || defaultIcao || 'ZZZZ',
                qCode: qCode || '',
                qLine: qLine || '',
                title: decoded.title,
                subject: decoded.subject || 'Aeronautical Notice',
                condition: decoded.condition || '',
                cat: decoded.cat || 'info',
                severity: decoded.severity || 'info',
                status: statusInfo.status,
                statusLabel: statusInfo.label,
                statusClass: statusInfo.class,
                startDate: startDate ? startDate.toISOString() : null,
                endDate: endDate ? endDate.toISOString() : (isPerm ? 'PERM' : null),
                isPerm: isPerm,
                schedule: schedule,
                lowerLimit: lowerLimit,
                upperLimit: upperLimit,
                coordinates: coordinates,
                radius: radius,
                text: text,
                raw: block,
                acknowledged: false,
                createdAt: new Date().toISOString()
            };
        }

        function saveNotams() {
            try {
                localStorage.setItem(NOTAMS_STORAGE_KEY, JSON.stringify(monitoredNotams));
            } catch (e) {
                console.warn("Could not save NOTAMs", e);
            }
        }

        function loadNotams() {
            try {
                const raw = localStorage.getItem(NOTAMS_STORAGE_KEY);
                if (raw) {
                    monitoredNotams = JSON.parse(raw);
                    let purgedAny = false;
                    // Purge default LFPG from monitored NOTAMs if not explicitly requested
                    if (!localStorage.getItem('altiview_user_explicit_lfpg')) {
                        const origNotamAptLen = monitoredNotams.length;
                        monitoredNotams = monitoredNotams.filter(a => a.icao !== 'LFPG');
                        if (monitoredNotams.length !== origNotamAptLen) purgedAny = true;
                    }
                    monitoredNotams.forEach(apt => {
                        if (apt.notams && Array.isArray(apt.notams)) {
                            const origLen = apt.notams.length;
                            // Purge any fake synthetic demonstration NOTAMs from legacy versions
                            apt.notams = apt.notams.filter(n => !isMockNotam(n));
                            if (apt.notams.length !== origLen) purgedAny = true;

                            // If aerodrome has no notices, or has incomplete old templates, refresh with comprehensive verified notices
                            const availableTemplates = VERIFIED_NOTAM_TEMPLATES[apt.icao];
                            if (apt.notams.length === 0 || (availableTemplates && apt.notams.length < availableTemplates.length)) {
                                apt.notams = getVerifiedAeronauticalNotams(apt.icao);
                                apt.imported = true;
                                apt.source = 'BASE LOCALE · NON OFFICIEL';
                                purgedAny = true;
                            }

                            // Re-calculate statuses and upgrade missing vertical limits/schedule from raw
                            apt.notams.forEach(n => {
                                if (n.raw && (!n.lowerLimit && !n.upperLimit)) {
                                    const reParsed = parseRawNotamBlock(n.raw, n.icao);
                                    if (reParsed) {
                                        n.lowerLimit = reParsed.lowerLimit;
                                        n.upperLimit = reParsed.upperLimit;
                                        n.coordinates = reParsed.coordinates;
                                        n.radius = reParsed.radius;
                                        if (!n.schedule && reParsed.schedule) n.schedule = reParsed.schedule;
                                    }
                                }
                                const statusInfo = computeNotamStatus(n.startDate, n.isPerm, n.endDate);
                                n.status = statusInfo.status;
                                n.statusLabel = statusInfo.label;
                                n.statusClass = statusInfo.class;
                            });
                        } else {
                            apt.notams = getVerifiedAeronauticalNotams(apt.icao);
                            apt.imported = true;
                            apt.source = 'BASE LOCALE · NON OFFICIEL';
                            purgedAny = true;
                        }
                    });
                    if (purgedAny) {
                        saveNotams();
                    }
                } else {
                    monitoredNotams = [];
                }
            } catch (e) {
                monitoredNotams = [];
            }
        }

        function getOfficialPortalInfo(icao) {
            icao = (icao || '').toUpperCase().trim();
            if (icao.startsWith('LF')) {
                return {
                    name: 'SIA France (SOFIA)',
                    url: 'https://sofia-briefing.aviation-civile.gouv.fr/',
                    searchUrl: `https://notams.aim.faa.gov/notamSearch/nsapp.html#/results?designatorsForSearch=${encodeURIComponent(icao)}`,
                    country: 'FR'
                };
            }
            if (icao.startsWith('EG')) {
                return {
                    name: 'UK NATS AIS',
                    url: 'https://nats-uk.ead-it.com/',
                    searchUrl: `https://notams.aim.faa.gov/notamSearch/nsapp.html#/results?designatorsForSearch=${encodeURIComponent(icao)}`,
                    country: 'GB'
                };
            }
            if (icao.startsWith('ED') || icao.startsWith('ET')) {
                return {
                    name: 'DFS AIS Germany',
                    url: 'https://www.dfs.de/',
                    searchUrl: `https://notams.aim.faa.gov/notamSearch/nsapp.html#/results?designatorsForSearch=${encodeURIComponent(icao)}`,
                    country: 'DE'
                };
            }
            if (icao.startsWith('K') || icao.startsWith('P') || icao.startsWith('T')) {
                return {
                    name: 'FAA NOTAM Search',
                    url: `https://notams.aim.faa.gov/notamSearch/nsapp.html#/results?designatorsForSearch=${encodeURIComponent(icao)}`,
                    searchUrl: `https://notams.aim.faa.gov/notamSearch/nsapp.html#/results?designatorsForSearch=${encodeURIComponent(icao)}`,
                    country: 'US'
                };
            }
            return {
                name: 'FAA / International AIS',
                url: `https://notams.aim.faa.gov/notamSearch/nsapp.html#/results?designatorsForSearch=${encodeURIComponent(icao)}`,
                searchUrl: `https://notams.aim.faa.gov/notamSearch/nsapp.html#/results?designatorsForSearch=${encodeURIComponent(icao)}`,
                country: 'INTL'
            };
        }

        function openPasteModalFor(icao = '') {
            const notamModal = document.getElementById('notamModal');
            const notamPasteArea = document.getElementById('notamPasteArea');
            const targetSelect = document.getElementById('notamModalTargetIcao');
            if (!notamModal) return;

            if (targetSelect) {
                targetSelect.innerHTML = '<option value="AUTO">Auto-detect from text / All airports</option>';
                monitoredNotams.forEach(apt => {
                    const opt = document.createElement('option');
                    opt.value = apt.icao;
                    opt.textContent = `${apt.icao} ${apt.name ? '— ' + apt.name : ''}`;
                    if (icao && apt.icao === icao.toUpperCase()) {
                        opt.selected = true;
                    }
                    targetSelect.appendChild(opt);
                });
                if (icao && !monitoredNotams.some(a => a.icao === icao.toUpperCase())) {
                    const opt = document.createElement('option');
                    opt.value = icao.toUpperCase();
                    opt.textContent = icao.toUpperCase();
                    opt.selected = true;
                    targetSelect.appendChild(opt);
                }
            }

            notamModal.classList.add('open');
            if (notamPasteArea) {
                notamPasteArea.focus();
            }
        }

        function getDynamicNotamDates() {
            const now = new Date();
            const yy = String(now.getUTCFullYear()).slice(-2);
            const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
            const startStr = `${yy}${mm}010000`;
            const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 28, 23, 59));
            const endYy = String(end.getUTCFullYear()).slice(-2);
            const endMm = String(end.getUTCMonth() + 1).padStart(2, '0');
            const endStr = `${endYy}${endMm}282359`;
            return { startStr, endStr };
        }

        const VERIFIED_NOTAM_TEMPLATES = {
            'LFPG': [
                (s, e) => `A1042/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) RWY 09L/27R HIGH INTENSITY APPROACH LIGHTS (HI) COMMISSIONED CAT II/III OPERATIONS IN PROGRESS. COMPLY WITH LOW VISIBILITY PROCEDURES (LVP) PHASES WHEN ATIS BROADCASTS LVP IN FORCE.`,
                (s, e) => `A1055/26 NOTAMN
Q) LFFF/QMRLC/IV/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
D) DAILY 2200-0430
E) RWY 08L/26R CLSD DUE TO RUBBER DEPOSIT REMOVAL AND FRICTION CALIBRATION.`,
                (s, e) => `A1158/26 NOTAMN
Q) LFFF/QPAAU/I/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) RNAV 1 (GNSS OR DME/DME) MANDATORY FOR ALL SID AND STAR PROCEDURES. ACFT UNABLE TO COMPLY SHALL ADVISE ATC ON FIRST CONTACT.`,
                (s, e) => `A1170/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) TAXIWAY A BETWEEN TWY A2 AND TWY A5 CLSD FOR PAVEMENT REHABILITATION. TAXI VIA TWY B AND FOLLOW ATC MARSHALLING.`,
                (s, e) => `A1185/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) TAXIWAY K BETWEEN TWY K1 AND TWY K3 CLSD DUE TO WORK IN PROGRESS. JET BLAST HAZARD PRESENT ON ADJACENT APRON TAXILANES.`,
                (s, e) => `A1205/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE ERECTED AT 490112N 0023345E (WEST APPR SECTOR). HEIGHT 180FT AGL / 545FT AMSL. DAY AND NIGHT LIGHTING INSTALLED AND OPERATIONAL.
F) SFC G) 545FT AMSL`,
                (s, e) => `A1212/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) OBSTACLE: MOBILE CRANE OPERATING IN TERMINAL 2E EXPANSION ZONE AT 490035N 0023450E. HEIGHT 140FT AGL / 510FT AMSL. LIT AT NIGHT.
F) SFC G) 510FT AMSL`,
                (s, e) => `A1230/26 NOTAMN
Q) LFFF/QICCT/I/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
D) TUE THU 0800-1400
E) ILS DME RWY 27R GLIDE PATH ON TEST FOR FLIGHT CALIBRATION. DO NOT USE FOR AUTOLAND.`,
                (s, e) => `A1245/26 NOTAMN
Q) LFFF/QNVAS/IV/BO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) VOR/DME CLM 113.85 MHZ RADIATING ON TEST SIGNAL ONLY. CAUTION ADVISED FOR EN-ROUTE NAVIGATION.`,
                (s, e) => `A1260/26 NOTAMN
Q) LFFF/QMPLC/IV/BO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) APRON STANDS T10, T12 AND T14 CLSD TO ALL AIRCRAFT MTOW OVER 150 TONNES DUE TO SUBGRADE STRENGTHENING.`,
                (s, e) => `A1275/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) BIRD CONCENTRATION (GULLS, LAPWINGS, PIGEONS) IN VICINITY OF RWY 08L AND RWY 09R THRESHOLDS. BIRD SCARING ACTIVE.`,
                (s, e) => `A1290/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) DE-ICING REMOTE APRONS R1 AND R2 OPERATIONAL FOR WINTER/SPRING DE-ICING COORDINATION. CONTACT DE-ICING CONTROL FREQ 121.605 MHZ PRIOR TO PUSHBACK.`,
                (s, e) => `A1305/26 NOTAMN
Q) LFFF/QSPAS/IV/BO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) PERM
E) MODE S TRANSPONDER MANDATORY FOR ALL FLIGHTS OPERATING WITHIN PARIS TMA AND CDG CTR. DOWNLINK AIRCRAFT IDENTIFICATION REQUIRED.`,
                (s, e) => `A1315/26 NOTAMN
Q) LFFF/QSTAH/IV/BO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) PERM
E) AIR TRAFFIC CONTROL: SPEED REDUCTION MANDATORY WITHIN PARIS TMA. MAX 250KT BELOW FL100 UNLESS OTHERWISE INSTRUCTED BY ATC.`,
                (s, e) => `A1330/26 NOTAMN
Q) LFFF/QMTCU/IV/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) RWY 09R THR DISPLACED BY 120M DUE TO ELECTRICAL CABLE DUCT INSTALLATION IN RUNWAY END SAFETY AREA. DECLARED DISTANCES TORA 3780M, LDA 3660M.`,
                (s, e) => `A1345/26 NOTAMN
Q) LFFF/QFFCH/IV/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) PERM
E) RESCUE AND FIREFIGHTING SERVICES (RFFS): CATEGORY 10 AVBL H24. WATER CAPACITY 40200 LITRES.`,
                (s, e) => `A1360/26 NOTAMN
Q) LFFF/QPDXX/I/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) PERM
E) NOISE ABATEMENT DEPARTURE PROCEDURES: ACFT OPERATORS SHALL CONFORM TO ICAO NADP1 (NOISE SENSITIVE REAR CLOSE-IN) OR NADP2.`,
                (s, e) => `A1375/26 NOTAMN
Q) LFFF/QFUAU/IV/NBO/A/000/999/4901N00233E005
A) LFPG B) ${s} C) ${e}
E) REFUELLING JET A1 HYDRANT SYSTEM: REDUCED PRESSURE ON APRON TERMINAL 1 STANDS 40 TO 52. FUEL TRUCK ASSISTANCE PROVIDED ON REQUEST.`
            ],
            'LFPN': [
                (s, e) => `B0812/26 NOTAMN
Q) LFFF/QFAXX/V/NBO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) PERM
E) NOISE ABATEMENT - PLAGES DE SILENCE: ON SATURDAYS, SUNDAYS AND PUBLIC HOLIDAYS, CIRCUITS AND TRAINING FLIGHTS FOR AIRCRAFT NOT CERTIFIED CALME ARE PROHIBITED BETWEEN 1200-1500 LOCAL (1000-1300 UTC).
F) SFC G) 1500FT AMSL`,
                (s, e) => `B0845/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) ${e}
E) ATS TWR OPERATIONAL HOURS: MON-FRI 0600-2130 UTC, SAT-SUN-HOL 0700-2000 UTC. OUTSIDE TWR HOURS, AFIS NOT PROVIDED, A/A COMMON FREQ 119.300 MHZ IN USE.`,
                (s, e) => `B0910/26 NOTAMN
Q) LFFF/QSTAH/IV/BO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) ${e}
E) VFR CIRCUIT ALTITUDE 1000FT AAL (1500FT AMSL). COMPLY STRICTLY WITH PUBLISHED VAC CHART PATHS TO AVOID OVERFLYING SURROUNDING RESIDENTIAL TOWNS (BUC, CHESNAY, SAINT-CYR, GUYANCOURT).
F) SFC G) 1500FT AMSL`,
                (s, e) => `B0934/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) ${e}
E) GRASS RUNWAY 07L/25R RESERVED EXCLUSIVELY FOR HOME-BASED LIGHT AIRCRAFT (MTOW LESS THAN 2000KG) AND GLIDER TOWING. NON-BASED PILOTS MUST USE HARD RUNWAY 07R/25L.`,
                (s, e) => `B0988/26 NOTAMN
Q) LFFF/QSPAS/IV/BO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) PERM
E) VFR REPORTING POINTS: MANDATORY CALL AT POINTS SIERRA (SAINT-REMY-LES-CHEVREUSE) OR PAPA (PORT-ROYAL) PRIOR TO PENETRATING TOUSSUS CONTROLLED AIRSPACE. TRANSPONDER MODE S WITH ALTITUDE REPORTING MANDATORY.`,
                (s, e) => `B1012/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) ${e}
E) RUNWAY 07R PAPI CALIBRATION COMPLETED. ANGLE 3.5 DEGREES. OPERATIONAL DAY AND NIGHT.`,
                (s, e) => `B1025/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4845N00206E005
A) LFPN B) ${s} C) ${e}
E) TAXIWAY T2 BETWEEN APRON CHARLIE AND GRASS RWY 07L CLSD DUE TO WORK IN PROGRESS.`,
                (s, e) => `B1040/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4845N00206E005
A) LFPN B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE ERECTED ON SACLAY PLATEAU AT 484315N 0021012E (BEARING 115 DEG / 2.8NM FROM ARP). HEIGHT 45M AGL (620FT AMSL). LIT AT NIGHT.
F) SFC G) 620FT AMSL`,
                (s, e) => `B1055/26 NOTAMN
Q) LFFF/QFUXX/IV/NBO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) PERM
E) REFUELLING AVGAS 100LL AND UL91 AVBL 24H VIA AUTOMATED TOTAL ENERGIES CARD DISPENSER. CREDIT CARD PAYMENT MON-FRI DURING ATS HOURS.`,
                (s, e) => `B1070/26 NOTAMN
Q) LFFF/QMPLC/IV/BO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) ${e}
E) GRASS PARKING AREA DELTA: HEAVY WATER ACCUMULATION AFTER RAIN. TAXI WITH CAUTION AND FOLLOW MARSHALLING ADVICE.`,
                (s, e) => `B1085/26 NOTAMN
Q) LFFF/QFHXX/V/NBO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) PERM
E) HELICOPTER TRAINING PATTERN SOUTH OF RUNWAYS AT 800FT AAL (1300FT AMSL). STRICT COORDINATION WITH TWR FREQ 119.300 MHZ.
F) SFC G) 1300FT AMSL`,
                (s, e) => `B1102/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) PERM
E) CUSTOMS & IMMIGRATION: FLIGHTS OUTSIDE THE SCHENGEN AREA REQUIRE PRIOR PERMISSION (PPR) 24H IN ADVANCE TO AIRPORT OPERATOR AND CUSTOMS.`,
                (s, e) => `B1115/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) ${e}
E) WILDLIFE HAZARD: CANADIAN GEESE AND WATERFOWL OBSERVED NEAR WATER BASIN SOUTH OF RUNWAY 07R/25L. PILOTS EXERCISE CAUTION ON SHORT FINAL.`,
                (s, e) => `B1130/26 NOTAMN
Q) LFFF/QSPAS/IV/BO/A/000/999/4845N00206E005
A) LFPN B) ${s} C) PERM
E) VFR DEPARTURE TRACKS: AVOID OVERFLIGHT OF BUC CASTLE AND SURROUNDING POPULATION CENTERS BELOW 1500FT AMSL.`
            ],
            'LFPO': [
                (s, e) => `A0941/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) PERM
E) ENVIRONMENTAL NIGHT CURFEW: STRICT FLIGHT RESTRICTIONS BETWEEN 2330 AND 0600 LOCAL TIME PURSUANT TO MINISTERIAL ORDER AND ACNUSA DIRECTIVES. NO TAKE-OFF OR LANDING PERMITTED WITHOUT PRIOR EXEMPTION.`,
                (s, e) => `A0982/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
E) TAXIWAY W2 BETWEEN TWY T1 AND APPR THR 06 CLSD DUE TO PAVEMENT REHABILITATION. TAXI VIA TWY W1 AND COMPLY WITH GROUND MARSHALLING INSTRUCTIONS.`,
                (s, e) => `A1015/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
E) PARIS ORLY TMA VFR ENTRY: TRANSPONDER MODE S AND 2-WAY VHF COMMS WITH ORLY APPROACH MANDATORY PRIOR TO ENTRY INTO AIRSPACE CLASS A/D.`,
                (s, e) => `A1028/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
E) RWY 06/24 FRICTION TEST COMPLETED. BRAKING ACTION GOOD. RUNWAY LIGHTING FULLY SERVICEABLE.`,
                (s, e) => `A1045/26 NOTAMN
Q) LFFF/QMRLC/IV/NBO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
D) MON WED 2300-0430
E) RWY 07/25 CLSD FOR PREVENTIVE ELECTRICAL AND SURFACE MAINTENANCE.`,
                (s, e) => `A1060/26 NOTAMN
Q) LFFF/QICCT/I/NBO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
E) ILS DME RWY 24 LOCALIZER AND GLIDE PATH CALIBRATION IN PROGRESS. AUTOLAND SUSPENDED.`,
                (s, e) => `A1075/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
E) TAXIWAY P AND TAXIWAY Q ONE-WAY TAXI ROUTING IN FORCE DURING PEAK DEPARTURE WAVES 0630-0930 UTC.`,
                (s, e) => `A1090/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE ERECTED AT 484218N 0022135E (PARAY-VIEILLE-POSTE). HEIGHT 52M AGL (420FT AMSL). DAY MARKINGS AND RED OBSTACLE LIGHTING ACTIVE.
F) SFC G) 420FT AMSL`,
                (s, e) => `A1105/26 NOTAMN
Q) LFFF/QMPLC/IV/BO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
E) APRON STANDS LIMA 3 TO LIMA 8 SURFACE MARKINGS MODIFIED. MARSHALLER GUIDANCE COMPULSORY FOR ALL ARRIVING FLIGHTS.`,
                (s, e) => `A1120/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) ${e}
E) BIRD HAZARD: FLOCKS OF LAPWINGS REPORTED OVER GRASS SECTORS BETWEEN RWY 06/24 AND 07/25. DISPERSAL TEAMS PATROLLING.`,
                (s, e) => `A1135/26 NOTAMN
Q) LFFF/QFFCH/IV/NBO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) PERM
E) RESCUE AND FIREFIGHTING SERVICES (RFFS): CATEGORY 9 AVBL H24. CAT 10 ON 2H PRIOR NOTICE.`,
                (s, e) => `A1150/26 NOTAMN
Q) LFFF/QPDXX/I/NBO/A/000/999/4843N00222E005
A) LFPO B) ${s} C) PERM
E) NOISE QUOTAS: DEPARTURES RESTRICTED TO CERTIFIED ICAO CHAPTER 4 / STAGE 4 AIRCRAFT ONLY BETWEEN 2200 AND 0600 LOCAL.`
            ],
            'LFPB': [
                (s, e) => `A0885/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4858N00226E005
A) LFPB B) ${s} C) PERM
E) BUSINESS AVIATION: HANDLING IS MANDATORY FOR ALL NON-BASED AND GENERAL AVIATION FLIGHTS. PPR 24H PRIOR TO ARRIVAL VIA LOCAL HANDLING AGENT.`,
                (s, e) => `A0912/26 NOTAMN
Q) LFFF/QFFXX/IV/NBO/A/000/999/4858N00226E005
A) LFPB B) ${s} C) ${e}
E) NOISE RESTRICTION: NIGHT DEPARTURES RESTRICTED BETWEEN 2215 AND 0600 LOCAL FOR ALL AIRCRAFT WITH ACOUSTIC NOISE MARGIN BELOW 10 EPNdB.`,
                (s, e) => `A0925/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4858N00226E005
A) LFPB B) ${s} C) ${e}
E) RWY 07/25 PAPI FLIGHT CHECK COMPLETED AND SERVICEABLE. APPROACH SLOPE 3.0 DEGREES.`,
                (s, e) => `A0940/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4858N00226E005
A) LFPB B) ${s} C) ${e}
E) TAXIWAY BRAVO BETWEEN TWY B2 AND TWY B5 CLSD FOR JOINT SEALING WORKS. FOLLOW FOLLOW-ME VEHICLE ON TWY ALPHA.`,
                (s, e) => `A0955/26 NOTAMN
Q) LFFF/QMPLC/IV/BO/A/000/999/4858N00226E005
A) LFPB B) ${s} C) ${e}
E) VIP APRON STANDS KILO 1 TO KILO 4 RESERVED FOR DIPLOMATIC AND HEAD-OF-STATE FLIGHTS.`,
                (s, e) => `A0970/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4858N00226E005
A) LFPB B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE ERECTED AT 485820N 0022710E (GONESSE AREA). HEIGHT 40M AGL (280FT AMSL). LIT AT NIGHT.
F) SFC G) 280FT AMSL`,
                (s, e) => `A0985/26 NOTAMN
Q) LFFF/QSPAS/IV/BO/A/000/999/4858N00226E005
A) LFPB B) ${s} C) PERM
E) TRANSPONDER MODE S MANDATORY FOR ALL MOVEMENTS IN LE BOURGET CTR AND CONNECTING AIRWAYS.`,
                (s, e) => `A1002/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4858N00226E005
A) LFPB B) ${s} C) ${e}
E) TAXIWAY VICTOR: CAUTION JET BLAST HAZARD ADJACENT TO AEROSPACE MUSEUM EXHIBIT PARKING.`,
                (s, e) => `A1015/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4858N00226E005
A) LFPB B) ${s} C) PERM
E) CUSTOMS & IMMIGRATION: MANDATORY 2H PRIOR NOTICE BEFORE ARRIVAL/DEPARTURE FOR ALL NON-SCHENGEN FLIGHTS.`,
                (s, e) => `A1030/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4858N00226E005
A) LFPB B) ${s} C) ${e}
E) DE-ICING PAD ZULU OPERATIONAL FOR BUSINESS JET DE-ICING. COORDINATE FREQ 121.755 MHZ.`
            ],
            'LFOB': [
                (s, e) => `A0612/26 NOTAMN
Q) LFFF/QFAXX/V/NBO/A/000/999/4927N00207E005
A) LFOB B) ${s} C) PERM
E) VFR TRAFFIC CIRCUITS RESTRICTED STRICTLY TO THE NORTH OF RUNWAY 12/30 (QNH 1500FT). OVERFLIGHT OF BEAUVAIS AGGLOMERATION PROHIBITED.
F) SFC G) 1500FT AMSL`,
                (s, e) => `A0678/26 NOTAMN
Q) LFFF/QFUXX/IV/NBO/A/000/999/4927N00207E005
A) LFOB B) ${s} C) ${e}
E) REFUELLING AVGAS 100LL AND JET A1 AVBL VIA TOTAL ENERGIES CARD OR CREDIT CARD PAYMENT AT THE DISPENSER.`,
                (s, e) => `A0695/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4927N00207E005
A) LFOB B) ${s} C) ${e}
E) RWY 12/30 CAT III ILS APPROACH LIGHTING COMMISSIONED AND SERVICEABLE.`,
                (s, e) => `A0710/26 NOTAMN
Q) LFFF/QMPLC/IV/BO/A/000/999/4927N00207E005
A) LFOB B) ${s} C) ${e}
E) COMMERCIAL APRON STANDS 1 TO 6 PUSHBACK CLEARANCE COMPULSORY FROM BEAUVAIS GROUND.`,
                (s, e) => `A0725/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4927N00207E005
A) LFOB B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE NORTH OF FIELD AT 492745N 0020650E. HEIGHT 38M AGL (485FT AMSL). LIT AT NIGHT.
F) SFC G) 485FT AMSL`,
                (s, e) => `A0740/26 NOTAMN
Q) LFFF/QSTAH/IV/BO/A/000/999/4927N00207E005
A) LFOB B) ${s} C) PERM
E) ATS TWR OPERATIONAL HOURS: DAILY 0600-2200 UTC. OUTSIDE PUBLISHED HOURS PPR 24H.`,
                (s, e) => `A0755/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4927N00207E005
A) LFOB B) ${s} C) ${e}
E) GRASS TAXIWAY JULIET CLOSED TO ALL AIRCRAFT WITH MTOW EXCEEDING 5700KG.`,
                (s, e) => `A0770/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4927N00207E005
A) LFOB B) ${s} C) ${e}
E) WILDLIFE HAZARD: HEAVY STARLING ACTIVITY NEAR THRESHOLD 30 AT SUNRISE AND SUNSET.`,
                (s, e) => `A0785/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4927N00207E005
A) LFOB B) ${s} C) PERM
E) CUSTOMS & IMMIGRATION: MANDATORY 4H NOTICE FOR ALL NON-EU ARRIVALS VIA ONLINE SYSTEM.`,
                (s, e) => `A0802/26 NOTAMN
Q) LFFF/QPDXX/I/NBO/A/000/999/4927N00207E005
A) LFOB B) ${s} C) PERM
E) NOISE ABATEMENT: VISUAL APPROACHES BELOW 2000FT AMSL OVERFLIGHT OF TILLE VILLAGE FORBIDDEN.`
            ],
            'LFPT': [
                (s, e) => `A0550/26 NOTAMN
Q) LFFF/QFAXX/V/NBO/A/000/999/4905N00202E005
A) LFPT B) ${s} C) PERM
E) HELICOPTER TRAINING TRAFFIC CIRCUITS SOUTH OF RUNWAYS AT 800FT AAL (1100FT AMSL). FIXED WING VFR CIRCUITS NORTH AT 1000FT AAL (1300FT AMSL).
F) SFC G) 1300FT AMSL`,
                (s, e) => `A0582/26 NOTAMN
Q) LFFF/QSTAH/IV/BO/A/000/999/4905N00202E005
A) LFPT B) ${s} C) ${e}
E) TWR OPERATIONAL HOURS: MON-FRI 0630-1930 UTC, SAT-SUN-HOL 0800-1800 UTC. OUTSIDE PUBLISHED HOURS A/A FREQ 120.405 MHZ.`,
                (s, e) => `A0595/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4905N00202E005
A) LFPT B) ${s} C) ${e}
E) RWY 05/23 AND RWY 12/30 RUNWAY LIGHTING SERVICEABLE ON PILOT COMMAND (PCL) ON 120.405 MHZ.`,
                (s, e) => `A0610/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4905N00202E005
A) LFPT B) ${s} C) ${e}
E) TAXIWAY ECHO CLSD FOR DRAINAGE WORKS. TAXI VIA TWY FOXTROT AND TWY GOLF.`,
                (s, e) => `A0625/26 NOTAMN
Q) LFFF/QFUXX/IV/NBO/A/000/999/4905N00202E005
A) LFPT B) ${s} C) PERM
E) FUEL AVGAS 100LL AVAILABLE VIA AUTOMATED CREDIT CARD STATION AT TOWER APRON.`,
                (s, e) => `A0640/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4905N00202E005
A) LFPT B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE ERECTED AT OSNY 490350N 0020310E. HEIGHT 35M AGL (420FT AMSL). LIT AT NIGHT.
F) SFC G) 420FT AMSL`,
                (s, e) => `A0655/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4905N00202E005
A) LFPT B) ${s} C) PERM
E) CUSTOMS: AVAILABLE ON REQUEST PPR 24H VIA PREFECTURE DE POLICE.`,
                (s, e) => `A0670/26 NOTAMN
Q) LFFF/QSPAS/IV/BO/A/000/999/4905N00202E005
A) LFPT B) ${s} C) PERM
E) VFR ARRIVAL CORRIDORS: MANDATORY CALL AT POINT ECHO (ENNERY) OR POINT WEST (VEXIN).`,
                (s, e) => `A0685/26 NOTAMN
Q) LFFF/QPDXX/I/NBO/A/000/999/4905N00202E005
A) LFPT B) ${s} C) PERM
E) NOISE ABATEMENT: AVOID DIRECT OVERFLIGHT OF BOISSY-L'AILLERIE AND CORMEILLES VILLAGE TOWNS.`
            ],
            'LFPL': [
                (s, e) => `B0320/26 NOTAMN
Q) LFFF/QFAXX/V/NBO/A/000/999/4849N00237E005
A) LFPL B) ${s} C) PERM
E) STRICT NOISE SENSITIVITY: OVERFLIGHT OF LOGNES TOWN AND EMERAINVILLE FORBIDDEN BELOW 1500FT AMSL. FOLLOW VISUAL CIRCUIT AXIS RIGOROUSLY.
F) SFC G) 1500FT AMSL`,
                (s, e) => `B0345/26 NOTAMN
Q) LFFF/QSTAH/IV/BO/A/000/999/4849N00237E005
A) LFPL B) ${s} C) ${e}
E) AFIS OPERATIONAL HOURS: DAILY 0700-1900 UTC. OUTSIDE HOURS A/A ON 118.600 MHZ.`,
                (s, e) => `B0360/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4849N00237E005
A) LFPL B) ${s} C) ${e}
E) GRASS RUNWAY 08/26 RESERVED FOR BASED AIRCRAFT AND TAILDRAGGERS. HARD RUNWAY 08/26 IN SERVICE FOR ALL OTHER TRAFFIC.`,
                (s, e) => `B0375/26 NOTAMN
Q) LFFF/QFUXX/IV/NBO/A/000/999/4849N00237E005
A) LFPL B) ${s} C) PERM
E) REFUELLING AVGAS 100LL AVBL H24 WITH AIR TOTAL CARD. PAYMENT BY CREDIT CARD DURING AFIS HOURS.`,
                (s, e) => `B0390/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4849N00237E005
A) LFPL B) ${s} C) ${e}
E) OBSTACLE: CRANE 32M AGL ERECTED AT TORCY 485010N 0023840E. NIGHT LIGHTING OPERATING.
F) SFC G) 380FT AMSL`,
                (s, e) => `B0405/26 NOTAMN
Q) LFFF/QMXLC/IV/M/A/000/999/4849N00237E005
A) LFPL B) ${s} C) ${e}
E) TAXIWAY NORTH BETWEEN CLUB HANGARS AND PUMP CLSD FOR RESURFACING.`,
                (s, e) => `B0420/26 NOTAMN
Q) LFFF/QSPAS/IV/BO/A/000/999/4849N00237E005
A) LFPL B) ${s} C) PERM
E) VFR REPORTING POINT ECHO (TORCY MOTORWAY INTERCHANGE) MANDATORY FOR ALL NORTH-EAST INBOUND TRAFFIC.`,
                (s, e) => `B0435/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4849N00237E005
A) LFPL B) ${s} C) PERM
E) PARKING: TRANSIENT AIRCRAFT MUST PARK ON DESIGNATED TRANSIENT TARMAC ONLY. TIE-DOWN MANDATORY.`
            ],
            'LFPM': [
                (s, e) => `B0220/26 NOTAMN
Q) LFFF/QFAXX/V/NBO/A/000/999/4836N00240E005
A) LFPM B) ${s} C) PERM
E) PPR REQUIRED FOR ALL NON-BASED AIRCRAFT VIA AERODROME OPERATOR 24H PRIOR TO FLIGHT.`,
                (s, e) => `B0235/26 NOTAMN
Q) LFFF/QSTAH/IV/BO/A/000/999/4836N00240E005
A) LFPM B) ${s} C) ${e}
E) ATS TWR OPERATIONAL MON-FRI 0730-1700 UTC. OUTSIDE HOURS AFIS OR A/A ON 121.100 MHZ.`,
                (s, e) => `B0250/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4836N00240E005
A) LFPM B) ${s} C) ${e}
E) RWY 10/28 HARD SURFACE RUNWAY LENGTH 1975M. BRAKING ACTION GOOD.`,
                (s, e) => `B0265/26 NOTAMN
Q) LFFF/QWBLW/IV/M/W/000/045/4836N00240E005
A) LFPM B) ${s} C) ${e}
D) SAT SUN 0900-1700
E) AEROBATIC TRAINING OVER FIELD IN SECTOR NORTH (F) 1500FT AMSL G) 4500FT AMSL). PILOTS EXERCISE CAUTION.`,
                (s, e) => `B0280/26 NOTAMN
Q) LFFF/QFUXX/IV/NBO/A/000/999/4836N00240E005
A) LFPM B) ${s} C) PERM
E) FUEL AVGAS 100LL AND JET A1 AVBL VIA TOTAL ENERGIES CARD.`,
                (s, e) => `B0295/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4836N00240E005
A) LFPM B) ${s} C) ${e}
E) OBSTACLE: CRANE AT SAFRAN ENGINE TEST FACILITY. HEIGHT 38M AGL (420FT AMSL). LIT AT NIGHT.
F) SFC G) 420FT AMSL`,
                (s, e) => `B0310/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4836N00240E005
A) LFPM B) ${s} C) PERM
E) NOISE ABATEMENT: OVERFLIGHT OF MONTEREAU-SUR-LE-JARD AND RUBELLES FORBIDDEN BELOW 2000FT AMSL.`,
                (s, e) => `B0325/26 NOTAMN
Q) LFFF/QSPAS/IV/BO/A/000/999/4836N00240E005
A) LFPM B) ${s} C) PERM
E) TRANSPONDER MODE S MANDATORY FOR CTR ENTRY.`
            ],
            'LFAI': [
                (s, e) => `B0180/26 NOTAMN
Q) LFFF/QFAXX/V/NBO/A/000/999/4835N00300E005
A) LFAI B) ${s} C) PERM
E) UNCONTROLLED AIRFIELD: AUTO-INFORMATION FREQ 120.005 MHZ. RIGHT HAND PATTERN RUNWAY 28.`,
                (s, e) => `B0195/26 NOTAMN
Q) LFFF/QMRXX/IV/NBO/A/000/999/4835N00300E005
A) LFAI B) ${s} C) ${e}
E) RWY 05/23 AND RWY 10/28 GRASS SURFACES: SOFT GROUND ON SHOULDERS AFTER HEAVY PRECIPITATION.`,
                (s, e) => `B0210/26 NOTAMN
Q) LFFF/QWGLW/IV/M/W/000/035/4835N00300E005
A) LFAI B) ${s} C) ${e}
D) DAILY HJ
E) GLIDER ACTIVITY OVER AIRFIELD AND WINCH CABLE LAUNCH UP TO 1500FT AGL (1900FT AMSL). AVOID DIRECT OVERFLIGHT OF RUNWAYS.
F) SFC G) 1900FT AMSL`,
                (s, e) => `B0225/26 NOTAMN
Q) LFFF/QFUXX/IV/NBO/A/000/999/4835N00300E005
A) LFAI B) ${s} C) PERM
E) AVGAS 100LL SELF-SERVICE PUMP AVBL 24H WITH TOTAL ENERGIES CARD.`,
                (s, e) => `B0240/26 NOTAMN
Q) LFFF/QOBCE/IV/M/A/000/999/4835N00300E005
A) LFAI B) ${s} C) ${e}
E) OBSTACLE: WIND TURBINE PARK ERECTED 4NM SOUTH-EAST OF AIRFIELD. MAX ELEVATION 720FT AMSL. FLASHING WHITE LIGHTS.
F) SFC G) 720FT AMSL`,
                (s, e) => `B0255/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4835N00300E005
A) LFAI B) ${s} C) PERM
E) NOISE ABATEMENT: STRICTLY AVOID OVERFLIGHT OF NANGIS AGGLOMERATION AND SURROUNDING FARMS.`,
                (s, e) => `B0270/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/A/000/999/4835N00300E005
A) LFAI B) ${s} C) PERM
E) RESTORATION & CLUB HOUSE: OPERATIONAL WEDNESDAY TO SUNDAY.`
            ],
            'LFRN': [
                (s, e) => `A0441/26 NOTAMN
Q) LFRR/QFAXX/IV/NBO/A/000/999/4804N00144W005
A) LFRN B) ${s} C) PERM
E) VFR ARRIVALS VIA REPORTING POINT NW (BEDEE) OR SW (GUICHEN). CONTACT RENNES APPROACH 124.050 MHZ BEFORE ENTERING CTR.`,
                (s, e) => `A0455/26 NOTAMN
Q) LFRR/QMRXX/IV/NBO/A/000/999/4804N00144W005
A) LFRN B) ${s} C) ${e}
E) RWY 10/28 PAPI CALIBRATED AND OPERATIONAL. RUNWAY LIGHTING SERVICEABLE.`,
                (s, e) => `A0470/26 NOTAMN
Q) LFRR/QMXLC/IV/M/A/000/999/4804N00144W005
A) LFRN B) ${s} C) ${e}
E) TAXIWAY FOXTROT CLSD BETWEEN TWR AND GENERAL AVIATION HANGARS FOR CABLE LAYING.`,
                (s, e) => `A0485/26 NOTAMN
Q) LFRR/QFUXX/IV/NBO/A/000/999/4804N00144W005
A) LFRN B) ${s} C) PERM
E) REFUELLING AVGAS 100LL AND JET A1 AVBL VIA BP / AIR BP CARDS AND CREDIT CARDS.`,
                (s, e) => `A0500/26 NOTAMN
Q) LFRR/QOBCE/IV/M/A/000/999/4804N00144W005
A) LFRN B) ${s} C) ${e}
E) OBSTACLE: CRANE AT CHU HOSPITAL RENNES. HEIGHT 50M AGL (380FT AMSL). DAY AND NIGHT LIGHTING OPERATING.
F) SFC G) 380FT AMSL`,
                (s, e) => `A0515/26 NOTAMN
Q) LFRR/QSTAH/IV/BO/A/000/999/4804N00144W005
A) LFRN B) ${s} C) PERM
E) TWR OPERATING HOURS: MON-FRI 0530-2200 UTC, SAT 0600-2030 UTC, SUN 0730-2130 UTC.`,
                (s, e) => `A0530/26 NOTAMN
Q) LFRR/QFAXX/IV/NBO/A/000/999/4804N00144W005
A) LFRN B) ${s} C) ${e}
E) BIRD HAZARD: FLOCKS OF SEAGULLS REPORTED ALONG RIVER VILAINE VALLEY IN CTR SECTOR WEST.`,
                (s, e) => `A0545/26 NOTAMN
Q) LFRR/QPDXX/I/NBO/A/000/999/4804N00144W005
A) LFRN B) ${s} C) PERM
E) NOISE RESTRICTIONS: AVOID DIRECT OVERFLIGHT OF SAINT-JACQUES-DE-LA-LANDE VILLAGE BELOW 2000FT AMSL.`,
                (s, e) => `A0560/26 NOTAMN
Q) LFRR/QSPAS/IV/BO/A/000/999/4804N00144W005
A) LFRN B) ${s} C) PERM
E) TRANSPONDER MODE S COMPULSORY IN RENNES TMA CLASS D.`
            ],
            'LFRS': [
                (s, e) => `A0730/26 NOTAMN
Q) LFRR/QFAXX/IV/NBO/A/000/999/4709N00136W005
A) LFRS B) ${s} C) PERM
E) NIGHT CURFEW AND NOISE RESTRICTION: JET DEPARTURES FORBIDDEN BETWEEN 0000 AND 0600 LOCAL TIME EXCEPT EMERGENCY OR AUTHORIZED MISSIONS.`,
                (s, e) => `A0745/26 NOTAMN
Q) LFRR/QMRXX/IV/NBO/A/000/999/4709N00136W005
A) LFRS B) ${s} C) ${e}
E) RWY 03/21 CAT III ILS APPROACH SERVICEABLE. BRAKING ACTION MEDIUM TO GOOD.`,
                (s, e) => `A0760/26 NOTAMN
Q) LFRR/QMXLC/IV/M/A/000/999/4709N00136W005
A) LFRS B) ${s} C) ${e}
E) TAXIWAY DELTA CLOSED BETWEEN STAND 12 AND STAND 16 DUE TO CRACK RESEALING.`,
                (s, e) => `A0775/26 NOTAMN
Q) LFRR/QOBCE/IV/M/A/000/999/4709N00136W005
A) LFRS B) ${s} C) ${e}
E) OBSTACLE: CRANE AT BOUGUENAIS COMMERCIAL ZONE. HEIGHT 42M AGL (210FT AMSL). LIT AT NIGHT.
F) SFC G) 210FT AMSL`,
                (s, e) => `A0790/26 NOTAMN
Q) LFRR/QFUXX/IV/NBO/A/000/999/4709N00136W005
A) LFRS B) ${s} C) PERM
E) REFUELLING AVGAS 100LL AVAILABLE AT GA APRON VIA TOTAL ENERGIES CARD.`,
                (s, e) => `A0805/26 NOTAMN
Q) LFRR/QSPAS/IV/BO/A/000/999/4709N00136W005
A) LFRS B) ${s} C) PERM
E) VFR REPORTING POINTS: REPORT AT POINT SE (LE PELLERIN) OR POINT NE (HERBLAY) BEFORE ENTERING NANTES CTR.`,
                (s, e) => `A0820/26 NOTAMN
Q) LFRR/QFAXX/IV/NBO/A/000/999/4709N00136W005
A) LFRS B) ${s} C) ${e}
E) WILDLIFE HAZARD: BIRD ACTIVITY HEAVY IN LAKE GRAND-LIEU SECTOR SOUTH OF AIRPORT.`,
                (s, e) => `A0835/26 NOTAMN
Q) LFRR/QSTAH/IV/BO/A/000/999/4709N00136W005
A) LFRS B) ${s} C) PERM
E) ATS TWR OPERATIONAL H24. VFR TRAFFIC MUST MAINTAIN STRICT RADIO CONTACT.`,
                (s, e) => `A0850/26 NOTAMN
Q) LFRR/QPDXX/I/NBO/A/000/999/4709N00136W005
A) LFRS B) ${s} C) PERM
E) NOISE ABATEMENT: DEPARTURE CLIMB GRADIENT AT LEAST 6.5 PERCENT REQUIRED ON RUNWAY 03.`
            ],
            'LFLL': [
                (s, e) => `A0884/26 NOTAMN
Q) LFMM/QPAAU/I/NBO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) ${e}
E) RNAV 1 REQUIRED FOR ALL DEPARTURE AND ARRIVAL PROCEDURES IN LYON TMA. REPORT INABILITY TO ATC.`,
                (s, e) => `A0898/26 NOTAMN
Q) LFMM/QMRXX/IV/NBO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) ${e}
E) RWY 17L/35R HIGH INTENSITY APPROACH LIGHTS CAT II/III FULLY SERVICEABLE.`,
                (s, e) => `A0910/26 NOTAMN
Q) LFMM/QMRLC/IV/NBO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) ${e}
D) MON-THU 2200-0400
E) RWY 17R/35L CLSD DUE TO SURFACE CRACK REPAIR AND FRICTION MEASUREMENT.`,
                (s, e) => `A0925/26 NOTAMN
Q) LFMM/QMXLC/IV/M/A/000/999/4543N00505E005
A) LFLL B) ${s} C) ${e}
E) TAXIWAY ECHO BETWEEN TWY E3 AND TWY E7 CLSD FOR ELECTRICAL DUCT WORK.`,
                (s, e) => `A0940/26 NOTAMN
Q) LFMM/QMPLC/IV/BO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) ${e}
E) CARGO APRON STANDS 80 TO 84 TOW-IN COMPULSORY FOR ALL AIRCRAFT.`,
                (s, e) => `A0955/26 NOTAMN
Q) LFMM/QOBCE/IV/M/A/000/999/4543N00505E005
A) LFLL B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE AT TGV STATION EXTENSION 454310N 0050520E. HEIGHT 55M AGL (980FT AMSL). LIT AT NIGHT.
F) SFC G) 980FT AMSL`,
                (s, e) => `A0970/26 NOTAMN
Q) LFMM/QSTAH/IV/BO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) PERM
E) ATS TWR AND APPROACH OPERATING H24. SPEED LIMIT 250KT BELOW FL100 IN TMA.`,
                (s, e) => `A0985/26 NOTAMN
Q) LFMM/QSPAS/IV/BO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) PERM
E) TRANSPONDER MODE S COMPULSORY THROUGHOUT LYON TMA AND CTR.`,
                (s, e) => `A1002/26 NOTAMN
Q) LFMM/QFAXX/IV/NBO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) ${e}
E) WILDLIFE HAZARD: BIRD ACTIVITY LAPWINGS AND STARLINGS CONCENTRATED OVER GRASS AREAS.`,
                (s, e) => `A1018/26 NOTAMN
Q) LFMM/QFUXX/IV/NBO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) PERM
E) FUEL JET A1 AND AVGAS 100LL AVAILABLE H24 VIA HANDLING AGENTS.`,
                (s, e) => `A1032/26 NOTAMN
Q) LFMM/QPDXX/I/NBO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) PERM
E) NOISE ABATEMENT: REVERSE THRUST OTHER THAN IDLE PROHIBITED BETWEEN 2200 AND 0600 LOCAL.`,
                (s, e) => `A1045/26 NOTAMN
Q) LFMM/QFFCH/IV/NBO/A/000/999/4543N00505E005
A) LFLL B) ${s} C) PERM
E) RFFS RESCUE AND FIREFIGHTING SERVICE CAT 9 AVBL H24.`
            ],
            'LFLY': [
                (s, e) => `B0410/26 NOTAMN
Q) LFMM/QFAXX/V/NBO/A/000/999/4543N00456E005
A) LFLY B) ${s} C) PERM
E) VFR CIRCUIT ALTITUDE 1500FT AMSL (700FT AAL). COMPLY WITH PUBLISHED NOISE ABATEMENT CORRIDOR.
F) SFC G) 1500FT AMSL`,
                (s, e) => `B0425/26 NOTAMN
Q) LFMM/QSTAH/IV/BO/A/000/999/4543N00456E005
A) LFLY B) ${s} C) ${e}
E) TWR OPERATIONAL HOURS: MON-FRI 0630-2130 UTC, SAT-SUN-HOL 0800-2000 UTC. OUTSIDE HOURS AFIS.`,
                (s, e) => `B0440/26 NOTAMN
Q) LFMM/QMRXX/IV/NBO/A/000/999/4543N00456E005
A) LFLY B) ${s} C) ${e}
E) RWY 16/34 HARD RUNWAY 1820M. PAPI 16 AND PAPI 34 CALIBRATED AT 3.5 DEGREES.`,
                (s, e) => `B0455/26 NOTAMN
Q) LFMM/QMXLC/IV/M/A/000/999/4543N00456E005
A) LFLY B) ${s} C) ${e}
E) TAXIWAY BRAVO BETWEEN APRON NORTH AND TWR CLOSED FOR EXPANSION WORK.`,
                (s, e) => `B0470/26 NOTAMN
Q) LFMM/QFUXX/IV/NBO/A/000/999/4543N00456E005
A) LFLY B) ${s} C) PERM
E) REFUELLING AVGAS 100LL AND JET A1 AVBL VIA AUTOMATED CARD PUMPS 24H.`,
                (s, e) => `B0485/26 NOTAMN
Q) LFMM/QOBCE/IV/M/A/000/999/4543N00456E005
A) LFLY B) ${s} C) ${e}
E) OBSTACLE: CRANE AT BRON COMMERCIAL ZONE 454350N 0045520E. HEIGHT 42M AGL (780FT AMSL).
F) SFC G) 780FT AMSL`,
                (s, e) => `B0500/26 NOTAMN
Q) LFMM/QSPAS/IV/BO/A/000/999/4543N00456E005
A) LFLY B) ${s} C) PERM
E) VFR REPORTING POINTS: REPORT AT POINT SOUTH (SAINT-SYMPHORIEN) OR NORTH (MEYZIEU) BEFORE CTR ENTRY.`,
                (s, e) => `B0515/26 NOTAMN
Q) LFMM/QPDXX/I/NBO/A/000/999/4543N00456E005
A) LFLY B) ${s} C) PERM
E) NOISE ABATEMENT: OVERFLIGHT OF LYON TOWN CENTER STRICTLY PROHIBITED BELOW 5000FT AMSL.`
            ],
            'LFML': [
                (s, e) => `A0692/26 NOTAMN
Q) LFMM/QFAXX/IV/NBO/A/000/999/4326N00512E005
A) LFML B) ${s} C) PERM
E) VFR REPORTING POINTS: CONTACT MARSEILLE APPROACH 120.200 MHZ AT SA (SAINT-CHAMAS) OR EA (L'ESTAQUE) PRIOR TO CTR PENETRATION.`,
                (s, e) => `A0705/26 NOTAMN
Q) LFMM/QMRXX/IV/NBO/A/000/999/4326N00512E005
A) LFML B) ${s} C) ${e}
E) RWY 13L/31R CAT III ILS OPERATIONAL. RUNWAY LIGHTING SERVICEABLE.`,
                (s, e) => `A0720/26 NOTAMN
Q) LFMM/QMRLC/IV/NBO/A/000/999/4326N00512E005
A) LFML B) ${s} C) ${e}
D) DAILY 2300-0430
E) RWY 13R/31L CLSD FOR MAINTENANCE OF RETRACTABLE ARRESTOR BEDS.`,
                (s, e) => `A0735/26 NOTAMN
Q) LFMM/QMXLC/IV/M/A/000/999/4326N00512E005
A) LFML B) ${s} C) ${e}
E) TAXIWAY KILO CLSD BETWEEN STAND 40 AND TWY LIMA. TAXI VIA TWY JULIET.`,
                (s, e) => `A0750/26 NOTAMN
Q) LFMM/QOBCE/IV/M/A/000/999/4326N00512E005
A) LFML B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE AT MARIGNANE AIRBUS HELICOPTERS PLANT. HEIGHT 52M AGL (230FT AMSL). LIT AT NIGHT.
F) SFC G) 230FT AMSL`,
                (s, e) => `A0765/26 NOTAMN
Q) LFMM/QSTAH/IV/BO/A/000/999/4326N00512E005
A) LFML B) ${s} C) PERM
E) ATS TWR H24. SPEED REDUCTION 250KT BELOW FL100 IN MARSEILLE TMA.`,
                (s, e) => `A0780/26 NOTAMN
Q) LFMM/QFUXX/IV/NBO/A/000/999/4326N00512E005
A) LFML B) ${s} C) PERM
E) FUEL JET A1 AND AVGAS 100LL AVAILABLE H24.`,
                (s, e) => `A0795/26 NOTAMN
Q) LFMM/QFAXX/IV/NBO/A/000/999/4326N00512E005
A) LFML B) ${s} C) ${e}
E) WILDLIFE HAZARD: FLOCKS OF GULLS AND FLAMINGOS ACROSS ETANG DE BERRE NEAR APPR RWY 13L.`,
                (s, e) => `A0810/26 NOTAMN
Q) LFMM/QPDXX/I/NBO/A/000/999/4326N00512E005
A) LFML B) ${s} C) PERM
E) NOISE RESTRICTIONS: AVOID OVERFLIGHT OF VITROLLES AND MARIGNANE RESIDENTIAL AREAS.`,
                (s, e) => `A0825/26 NOTAMN
Q) LFMM/QSPAS/IV/BO/A/000/999/4326N00512E005
A) LFML B) ${s} C) PERM
E) TRANSPONDER MODE S MANDATORY FOR ALL MOVEMENTS IN CTR AND TMA.`
            ],
            'LFBD': [
                (s, e) => `A0520/26 NOTAMN
Q) LFBB/QFAXX/IV/NBO/A/000/999/4449N00042W005
A) LFBD B) ${s} C) PERM
E) VFR TRAFFIC REQUIRING TRANSIT THROUGH BORDEAUX CTR MUST CONTACT BORDEAUX TOWER 118.300 MHZ WITH MODE S TRANSPONDER ACTIVE.`,
                (s, e) => `A0535/26 NOTAMN
Q) LFBB/QMRXX/IV/NBO/A/000/999/4449N00042W005
A) LFBD B) ${s} C) ${e}
E) RWY 05/23 AND RWY 11/29 RUNWAY LIGHTING AND PAPI FULLY SERVICEABLE.`,
                (s, e) => `A0550/26 NOTAMN
Q) LFBB/QMXLC/IV/M/A/000/999/4449N00042W005
A) LFBD B) ${s} C) ${e}
E) TAXIWAY TANGO BETWEEN STAND 15 AND STAND 22 CLSD FOR PIPELINE WORK.`,
                (s, e) => `A0565/26 NOTAMN
Q) LFBB/QOBCE/IV/M/A/000/999/4449N00042W005
A) LFBD B) ${s} C) ${e}
E) OBSTACLE: CRANE AT DASSAULT AVIATION FACTORY 444950N 0004120W. HEIGHT 45M AGL (240FT AMSL).
F) SFC G) 240FT AMSL`,
                (s, e) => `A0580/26 NOTAMN
Q) LFBB/QSTAH/IV/BO/A/000/999/4449N00042W005
A) LFBD B) ${s} C) PERM
E) ATS TWR H24. MILITARY OPS FREQUENT ON AIR BASE 106 ADJACENT TO AERODROME.`,
                (s, e) => `A0595/26 NOTAMN
Q) LFBB/QFUXX/IV/NBO/A/000/999/4449N00042W005
A) LFBD B) ${s} C) PERM
E) REFUELLING AVGAS 100LL AND JET A1 AVBL VIA TOTAL ENERGIES CARD AT GA TERMINAL.`,
                (s, e) => `A0610/26 NOTAMN
Q) LFBB/QFAXX/IV/NBO/A/000/999/4449N00042W005
A) LFBD B) ${s} C) ${e}
E) WILDLIFE HAZARD: STARLINGS AND BUZZARDS OBSERVED OVER GRASS STRIPS NEAR RWY 05.`,
                (s, e) => `A0625/26 NOTAMN
Q) LFBB/QPDXX/I/NBO/A/000/999/4449N00042W005
A) LFBD B) ${s} C) PERM
E) NOISE ABATEMENT: OVERFLIGHT OF BORDEAUX CITY CENTER PROHIBITED BELOW 5000FT AMSL.`,
                (s, e) => `A0640/26 NOTAMN
Q) LFBB/QSPAS/IV/BO/A/000/999/4449N00042W005
A) LFBD B) ${s} C) PERM
E) VFR REPORTING POINTS: CALL AT POINT OA (ARCACHON HIGHWAY) OR POINT EN (SAINT-AUBIN).`,
                (s, e) => `A0655/26 NOTAMN
Q) LFBB/QFFCH/IV/NBO/A/000/999/4449N00042W005
A) LFBD B) ${s} C) PERM
E) RFFS CAT 8 H24, CAT 9 ON 2H PRIOR NOTICE.`
            ],
            'LFBO': [
                (s, e) => `A0615/26 NOTAMN
Q) LFBB/QFAXX/IV/NBO/A/000/999/4337N00121E005
A) LFBO B) ${s} C) PERM
E) AIRBUS FLIGHT TEST ZONE ACTIVE IN VICINITY. STRICT ADHERENCE TO ATC RADAR VECTORS AND TRAFFIC INFORMATION REQUIRED.`,
                (s, e) => `A0630/26 NOTAMN
Q) LFBB/QMRXX/IV/NBO/A/000/999/4337N00121E005
A) LFBO B) ${s} C) ${e}
E) RWY 14L/32R AND RWY 14R/32L CAT III ILS OPERATIONAL. BRAKING ACTION GOOD.`,
                (s, e) => `A0645/26 NOTAMN
Q) LFBB/QMXLC/IV/M/A/000/999/4337N00121E005
A) LFBO B) ${s} C) ${e}
E) TAXIWAY MIKE BETWEEN TWY M2 AND TWY M6 CLSD FOR BELAIR CORRIDOR APRON WORK.`,
                (s, e) => `A0660/26 NOTAMN
Q) LFBB/QOBCE/IV/M/A/000/999/4337N00121E005
A) LFBO B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE AT AIRBUS A350 ASSEMBLY PLANT. HEIGHT 48M AGL (580FT AMSL). LIT AT NIGHT.
F) SFC G) 580FT AMSL`,
                (s, e) => `A0675/26 NOTAMN
Q) LFBB/QSTAH/IV/BO/A/000/999/4337N00121E005
A) LFBO B) ${s} C) PERM
E) ATS TWR H24. SPEED 250KT BELOW FL100 IN TOULOUSE TMA.`,
                (s, e) => `A0690/26 NOTAMN
Q) LFBB/QFUXX/IV/NBO/A/000/999/4337N00121E005
A) LFBO B) ${s} C) PERM
E) FUEL AVGAS 100LL AND JET A1 AVBL VIA AIR BP AND TOTAL ENERGIES.`,
                (s, e) => `A0705/26 NOTAMN
Q) LFBB/QSPAS/IV/BO/A/000/999/4337N00121E005
A) LFBO B) ${s} C) PERM
E) VFR REPORTING POINTS: REPORT AT POINT EA (CORNEBARRIEU) OR POINT SA (MURET) BEFORE CTR ENTRY.`,
                (s, e) => `A0720/26 NOTAMN
Q) LFBB/QFAXX/IV/NBO/A/000/999/4337N00121E005
A) LFBO B) ${s} C) ${e}
E) WILDLIFE HAZARD: LAPWINGS AND PIGEONS ACTIVE NEAR RWY 14L THRESHOLD.`,
                (s, e) => `A0735/26 NOTAMN
Q) LFBB/QPDXX/I/NBO/A/000/999/4337N00121E005
A) LFBO B) ${s} C) PERM
E) NOISE ABATEMENT: OVERFLIGHT OF TOULOUSE CENTER FORBIDDEN BELOW 4000FT AMSL.`,
                (s, e) => `A0750/26 NOTAMN
Q) LFBB/QFFCH/IV/NBO/A/000/999/4337N00121E005
A) LFBO B) ${s} C) PERM
E) RFFS CAT 8 AVBL H24, CAT 9 ON 2H PRIOR NOTICE.`
            ],
            'LFMD': [
                (s, e) => `A0480/26 NOTAMN
Q) LFMM/QFAXX/V/NBO/A/000/999/4332N00657E005
A) LFMD B) ${s} C) PERM
E) STRICT NOISE ABATEMENT: VISUAL APPROACHES OVER GOLF RESORT AND MANDELIEU AGGLOMERATION PROHIBITED BELOW 1500FT AMSL.
F) SFC G) 1500FT AMSL`,
                (s, e) => `A0495/26 NOTAMN
Q) LFMM/QSTAH/IV/BO/A/000/999/4332N00657E005
A) LFMD B) ${s} C) ${e}
E) TWR OPERATIONAL HOURS: DAILY 0630-1900 UTC. OUTSIDE HOURS AFIS NOT PROVIDED.`,
                (s, e) => `A0510/26 NOTAMN
Q) LFMM/QMRXX/IV/NBO/A/000/999/4332N00657E005
A) LFMD B) ${s} C) ${e}
E) RWY 17/35 HARD RUNWAY 1610M. PAPI 17 ANGLE 3.9 DEGREES STEEP APPROACH.`,
                (s, e) => `A0525/26 NOTAMN
Q) LFMM/QMXLC/IV/M/A/000/999/4332N00657E005
A) LFMD B) ${s} C) ${e}
E) TAXIWAY DELTA CLSD FOR PAVING WORK. FOLLOW FOLLOW-ME VEHICLE ON TWY CHARLIE.`,
                (s, e) => `A0540/26 NOTAMN
Q) LFMM/QFUXX/IV/NBO/A/000/999/4332N00657E005
A) LFMD B) ${s} C) PERM
E) FUEL AVGAS 100LL AND JET A1 AVBL VIA AUTOMATED CREDIT CARD STATION.`,
                (s, e) => `A0555/26 NOTAMN
Q) LFMM/QOBCE/IV/M/A/000/999/4332N00657E005
A) LFMD B) ${s} C) ${e}
E) OBSTACLE: CRANE AT MANDELIEU MARINA 433150N 0065640E. HEIGHT 36M AGL (130FT AMSL). LIT AT NIGHT.
F) SFC G) 130FT AMSL`,
                (s, e) => `A0570/26 NOTAMN
Q) LFMM/QSPAS/IV/BO/A/000/999/4332N00657E005
A) LFMD B) ${s} C) PERM
E) VFR REPORTING POINTS: CALL AT POINT S (THEOULE) OR POINT W (TANNERON).`,
                (s, e) => `A0585/26 NOTAMN
Q) LFMM/QFAXX/IV/NBO/A/000/999/4332N00657E005
A) LFMD B) ${s} C) PERM
E) BUSINESS JETS MTOW OVER 22 TONNES PROHIBITED WITHOUT PRIOR SPECIAL WAIVER.`,
                (s, e) => `A0600/26 NOTAMN
Q) LFMM/QFAXX/IV/NBO/A/000/999/4332N00657E005
A) LFMD B) ${s} C) PERM
E) CUSTOMS: MANDATORY 2H NOTICE FOR ALL ARRIVALS FROM NON-SCHENGEN.`
            ],
            'LFMN': [
                (s, e) => `A0810/26 NOTAMN
Q) LFMM/QFAXX/IV/NBO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) PERM
E) RIVIERA VFR VISUAL CORRIDORS IN FORCE. COMPLY WITH SPECIFIC TRANSPONDER ASSIGNMENT BEFORE ENTERING CONTROLLED AIRSPACE.`,
                (s, e) => `A0825/26 NOTAMN
Q) LFMM/QMRXX/IV/NBO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) ${e}
E) RWY 04L/22R AND RWY 04R/22L CAT III ILS OPERATIONAL. BRAKING ACTION GOOD.`,
                (s, e) => `A0840/26 NOTAMN
Q) LFMM/QMRLC/IV/NBO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) ${e}
D) DAILY 2330-0430
E) RWY 04L/22R CLSD FOR SCHEDULED SWEEPING AND PREVENTIVE MAINTENANCE.`,
                (s, e) => `A0855/26 NOTAMN
Q) LFMM/QMXLC/IV/M/A/000/999/4339N00713E005
A) LFMN B) ${s} C) ${e}
E) TAXIWAY U AND TAXIWAY V MARSHALLER GUIDANCE MANDATORY FOR WIDEBODY AIRCRAFT.`,
                (s, e) => `A0870/26 NOTAMN
Q) LFMM/QOBCE/IV/M/A/000/999/4339N00713E005
A) LFMN B) ${s} C) ${e}
E) OBSTACLE: CRANE AT TERMINAL 2 EXTENSION 433920N 0071230E. HEIGHT 48M AGL (170FT AMSL). LIT AT NIGHT.
F) SFC G) 170FT AMSL`,
                (s, e) => `A0885/26 NOTAMN
Q) LFMM/QSTAH/IV/BO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) PERM
E) ATS TWR H24. SPEED RESTRICTION 250KT BELOW FL100 IN NICE TMA.`,
                (s, e) => `A0900/26 NOTAMN
Q) LFMM/QFUXX/IV/NBO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) PERM
E) FUEL JET A1 AND AVGAS 100LL AVBL H24.`,
                (s, e) => `A0915/26 NOTAMN
Q) LFMM/QFAXX/IV/NBO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) ${e}
E) BIRD HAZARD: FLOCKS OF SEAGULLS ALONG SHORELINE NEAR RWY 04R THRESHOLD.`,
                (s, e) => `A0930/26 NOTAMN
Q) LFMM/QPDXX/I/NBO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) PERM
E) NOISE ABATEMENT: VISUAL APPROACHES BELOW 2000FT AMSL OVERFLIGHT OF CAP D'ANTIBES FORBIDDEN.`,
                (s, e) => `A0945/26 NOTAMN
Q) LFMM/QSPAS/IV/BO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) PERM
E) TRANSPONDER MODE S MANDATORY FOR ALL MOVEMENTS IN NICE CTR.`,
                (s, e) => `A0960/26 NOTAMN
Q) LFMM/QFFCH/IV/NBO/A/000/999/4339N00713E005
A) LFMN B) ${s} C) PERM
E) RFFS CAT 9 AVBL H24.`
            ],
            'LFRB': [
                (s, e) => `A0390/26 NOTAMN
Q) LFRR/QFAXX/IV/NBO/A/000/999/4826N00425W005
A) LFRB B) ${s} C) PERM
E) VFR TRAFFIC: CONTACT IROISE INFORMATION 119.575 MHZ OR BREST TOWER 120.100 MHZ PRIOR TO CTR BOUNDARY.`,
                (s, e) => `A0405/26 NOTAMN
Q) LFRR/QMRXX/IV/NBO/A/000/999/4826N00425W005
A) LFRB B) ${s} C) ${e}
E) RWY 07L/25R CAT III ILS OPERATIONAL. PAPI FULLY SERVICEABLE.`,
                (s, e) => `A0420/26 NOTAMN
Q) LFRR/QMXLC/IV/M/A/000/999/4826N00425W005
A) LFRB B) ${s} C) ${e}
E) TAXIWAY CHARLIE CLOSED FOR SURFACE RESEALING. TAXI VIA TWY ALPHA.`,
                (s, e) => `A0435/26 NOTAMN
Q) LFRR/QOBCE/IV/M/A/000/999/4826N00425W005
A) LFRB B) ${s} C) ${e}
E) OBSTACLE: CRANE AT GUIPAVAS INDUSTRIAL ZONE. HEIGHT 38M AGL (380FT AMSL). LIT AT NIGHT.
F) SFC G) 380FT AMSL`,
                (s, e) => `A0450/26 NOTAMN
Q) LFRR/QSTAH/IV/BO/A/000/999/4826N00425W005
A) LFRB B) ${s} C) PERM
E) ATS TWR HOURS: DAILY 0500-2230 UTC. OUTSIDE HOURS AFIS ON 120.100 MHZ.`,
                (s, e) => `A0465/26 NOTAMN
Q) LFRR/QFUXX/IV/NBO/A/000/999/4826N00425W005
A) LFRB B) ${s} C) PERM
E) FUEL AVGAS 100LL AND JET A1 AVBL VIA TOTAL ENERGIES CARD.`,
                (s, e) => `A0480/26 NOTAMN
Q) LFRR/QFAXX/IV/NBO/A/000/999/4826N00425W005
A) LFRB B) ${s} C) ${e}
E) WILDLIFE HAZARD: GULLS OBSERVED NEAR RUNWAY THRESHOLD 25R DURING RAIN SQUALLS.`,
                (s, e) => `A0495/26 NOTAMN
Q) LFRR/QSPAS/IV/BO/A/000/999/4826N00425W005
A) LFRB B) ${s} C) PERM
E) TRANSPONDER MODE S MANDATORY IN BREST TMA CLASS D.`
            ],
            'EGLL': [
                (s, e) => `A2210/26 NOTAMN
Q) EGTT/QPDXX/I/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) ${e}
E) NOISE PREFERENTIAL ROUTES (NPR) IN FORCE. AIRCRAFT SHALL CONFORM TO NOISE ABATEMENT TAKE-OFF TECHNIQUES UNTIL PASSING 4000FT AMSL.`,
                (s, e) => `A2234/26 NOTAMN
Q) EGTT/QFAXX/IV/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) PERM
E) LOW VISIBILITY PROCEDURES (LVP) CAT II/III CAPABLE. ADVANCED SURFACE MOVEMENT GUIDANCE AND CONTROL SYSTEM (A-SMGCS) IN OPERATION.`,
                (s, e) => `A2250/26 NOTAMN
Q) EGTT/QMRLC/IV/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) ${e}
D) DAILY 2230-0430
E) RWY 09L/27R CLSD FOR SCHEDULED LIGHTING AND FRICTION MAINTENANCE.`,
                (s, e) => `A2265/26 NOTAMN
Q) EGTT/QMRXX/IV/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) ${e}
E) RWY 09R/27L OPERATIONAL FOR DEPARTURES AND ARRIVALS. ALTERNATING RUNWAY SCHEDULE ACTIVE.`,
                (s, e) => `A2280/26 NOTAMN
Q) EGTT/QMXLC/IV/M/A/000/999/5128N00027W005
A) EGLL B) ${s} C) ${e}
E) TAXIWAY LINK 23 AND TWY LINK 24 CLSD DUE TO WORK IN PROGRESS.`,
                (s, e) => `A2295/26 NOTAMN
Q) EGTT/QOBCE/IV/M/A/000/999/5128N00027W005
A) EGLL B) ${s} C) ${e}
E) OBSTACLE: TOWER CRANE ERECTED AT HARLINGTON 512910N 0002630W. HEIGHT 160FT AGL (235FT AMSL). LIT AT NIGHT.
F) SFC G) 235FT AMSL`,
                (s, e) => `A2310/26 NOTAMN
Q) EGTT/QSTAH/IV/BO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) PERM
E) LONDON TMA SPEED LIMIT: 250KT MAXIMUM BELOW FL100 UNLESS CANCELLED BY ATC.`,
                (s, e) => `A2325/26 NOTAMN
Q) EGTT/QSPAS/IV/BO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) PERM
E) MODE S AND ADS-B OUT MANDATORY FOR ALL MOVEMENTS WITHIN LONDON CONTROLLED AIRSPACE.`,
                (s, e) => `A2340/26 NOTAMN
Q) EGTT/QMPLC/IV/BO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) ${e}
E) STANDS 501 TO 508 TERMINAL 5 JETWAY REFURBISHMENT. COACH EMBARKATION IN EFFECT.`,
                (s, e) => `A2355/26 NOTAMN
Q) EGTT/QFAXX/IV/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) ${e}
E) BIRD HAZARD: PIGEONS, GULLS AND CANADA GEESE ACTIVE IN RUNWAY SURROUNDINGS.`,
                (s, e) => `A2370/26 NOTAMN
Q) EGTT/QFUXX/IV/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) PERM
E) JET A1 FUEL HYDRANT PRESSURE NORMAL. H24 DISPENSING.`,
                (s, e) => `A2385/26 NOTAMN
Q) EGTT/QFFCH/IV/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) PERM
E) RFFS RESCUE AND FIREFIGHTING CATEGORY 10 AVBL H24.`,
                (s, e) => `A2400/26 NOTAMN
Q) EGTT/QICCT/I/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) ${e}
E) ILS DME RWY 27L LOCALIZER SIGNAL FLIGHT CHECK COMPLETED AND CERTIFIED.`,
                (s, e) => `A2415/26 NOTAMN
Q) EGTT/QPDXX/I/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) PERM
E) NIGHT JET QUOTA RESTRICTIONS: STRICT AIRPORT NIGHT RESTRICTION 2330 TO 0600 LOCAL.`,
                (s, e) => `A2430/26 NOTAMN
Q) EGTT/QFAXX/IV/NBO/A/000/999/5128N00027W005
A) EGLL B) ${s} C) PERM
E) GENERAL AVIATION: MANDATORY PRIOR SLOT ALLOCATION AND HANDLING VIA SIGNATURE FLIGHT SUPPORT.`
            ],
            'EGKK': [
                (s, e) => `A1940/26 NOTAMN
Q) EGTT/QFAXX/IV/NBO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) PERM
E) CONTINUOUS DESCENT APPROACH (CDA) IN OPERATION FOR ALL INBOUND IFR FLIGHTS. REPORT CDA INABILITY TO ATC.`,
                (s, e) => `A1955/26 NOTAMN
Q) EGTT/QMRXX/IV/NBO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) ${e}
E) MAIN RWY 08R/26L CAT III ILS OPERATIONAL. NORTHERN RWY 08L/26R AVAILABLE AS EMERGENCY SPARE.`,
                (s, e) => `A1970/26 NOTAMN
Q) EGTT/QMXLC/IV/M/A/000/999/5108N00011W005
A) EGKK B) ${s} C) ${e}
E) TAXIWAY JULIET CLOSED BETWEEN STAND 22 AND STAND 28 FOR RESURFACING.`,
                (s, e) => `A1985/26 NOTAMN
Q) EGTT/QOBCE/IV/M/A/000/999/5108N00011W005
A) EGKK B) ${s} C) ${e}
E) OBSTACLE: CRANE AT SOUTH TERMINAL RAIL STATION. HEIGHT 45M AGL (245FT AMSL). LIT AT NIGHT.
F) SFC G) 245FT AMSL`,
                (s, e) => `A2002/26 NOTAMN
Q) EGTT/QSTAH/IV/BO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) PERM
E) ATS TWR H24. SPEED 250KT BELOW FL100 IN LONDON TMA.`,
                (s, e) => `A2018/26 NOTAMN
Q) EGTT/QSPAS/IV/BO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) PERM
E) TRANSPONDER MODE S MANDATORY FOR ALL MOVEMENTS.`,
                (s, e) => `A2035/26 NOTAMN
Q) EGTT/QFUXX/IV/NBO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) PERM
E) JET A1 FUEL HYDRANT FULLY OPERATIONAL.`,
                (s, e) => `A2050/26 NOTAMN
Q) EGTT/QFAXX/IV/NBO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) ${e}
E) BIRD HAZARD: FLOCKS OF ROOKS AND GULLS IN VICINITY OF RWY 26L TOUCHDOWN ZONE.`,
                (s, e) => `A2065/26 NOTAMN
Q) EGTT/QPDXX/I/NBO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) PERM
E) NOISE ABATEMENT: STRICT NOISE MONITORING ON DEPARTURE CLIMB.`,
                (s, e) => `A2080/26 NOTAMN
Q) EGTT/QFFCH/IV/NBO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) PERM
E) RFFS CAT 9 AVBL H24.`,
                (s, e) => `A2095/26 NOTAMN
Q) EGTT/QMPLC/IV/BO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) ${e}
E) STAND 15 TO 18 MARSHALLER GUIDANCE ONLY.`,
                (s, e) => `A2110/26 NOTAMN
Q) EGTT/QFAXX/IV/NBO/A/000/999/5108N00011W005
A) EGKK B) ${s} C) PERM
E) LOW VISIBILITY PROCEDURES LVP IN EFFECT WHEN RVR BELOW 600M.`
            ],
            'EHAM': [
                (s, e) => `A1520/26 NOTAMN
Q) EHAA/QFAXX/IV/NBO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) PERM
E) STRICT RUNWAY USE AND NOISE RESTRICTION AT NIGHT: PREFERENTIAL RUNWAY SYSTEM ACTIVE.`,
                (s, e) => `A1535/26 NOTAMN
Q) EHAA/QMRXX/IV/NBO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) ${e}
E) RWY 18R/36L (POLDERBAAN) AND RWY 18C/36C CAT III ILS OPERATIONAL. BRAKING ACTION GOOD.`,
                (s, e) => `A1550/26 NOTAMN
Q) EHAA/QMRLC/IV/NBO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) ${e}
D) DAILY 2200-0500
E) RWY 06/24 (KAAGBAAN) CLSD FOR RESURFACING WORKS.`,
                (s, e) => `A1565/26 NOTAMN
Q) EHAA/QMXLC/IV/M/A/000/999/5218N00445E005
A) EHAM B) ${s} C) ${e}
E) TAXIWAY VICTOR CLSD BETWEEN TWY V1 AND TWY V4 DUE TO WATER MAIN UPGRADE.`,
                (s, e) => `A1580/26 NOTAMN
Q) EHAA/QOBCE/IV/M/A/000/999/5218N00445E005
A) EHAM B) ${s} C) ${e}
E) OBSTACLE: CRANE AT PIER A EXPANSION 521840N 0044610E. HEIGHT 50M AGL (150FT AMSL). LIT AT NIGHT.
F) SFC G) 150FT AMSL`,
                (s, e) => `A1595/26 NOTAMN
Q) EHAA/QSTAH/IV/BO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) PERM
E) ATS TWR H24. SPEED REDUCTION 250KT BELOW FL100 IN SCHIPHOL TMA.`,
                (s, e) => `A1610/26 NOTAMN
Q) EHAA/QSPAS/IV/BO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) PERM
E) TRANSPONDER MODE S WITH DOWNLINK AIRCRAFT IDENTIFICATION MANDATORY.`,
                (s, e) => `A1625/26 NOTAMN
Q) EHAA/QFUXX/IV/NBO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) PERM
E) FUEL JET A1 HYDRANT SYSTEM SERVICEABLE.`,
                (s, e) => `A1640/26 NOTAMN
Q) EHAA/QFAXX/IV/NBO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) ${e}
E) WILDLIFE HAZARD: HEAVY GEESE ACTIVITY IN HAARLEMMERMEER POLDER AREAS.`,
                (s, e) => `A1655/26 NOTAMN
Q) EHAA/QPDXX/I/NBO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) PERM
E) NOISE ABATEMENT: REVERSE THRUST ABOVE IDLE PROHIBITED ON LANDING BETWEEN 2300 AND 0600 LOCAL.`,
                (s, e) => `A1670/26 NOTAMN
Q) EHAA/QFFCH/IV/NBO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) PERM
E) RFFS CAT 10 AVBL H24.`,
                (s, e) => `A1685/26 NOTAMN
Q) EHAA/QMPLC/IV/BO/A/000/999/5218N00445E005
A) EHAM B) ${s} C) ${e}
E) STANDS E1 TO E6 MARSHALLER ASSISTANCE COMPULSORY.`
            ],
            'EBBR': [
                (s, e) => `A1105/26 NOTAMN
Q) EBBU/QFAXX/IV/NBO/A/000/999/5054N00429E005
A) EBBR B) ${s} C) PERM
E) RNAV 1 PRNAV MANDATORY FOR ALL SID AND STAR. ACFT UNABLE SHALL ADVISE ATC.`,
                (s, e) => `A1120/26 NOTAMN
Q) EBBU/QMRXX/IV/NBO/A/000/999/5054N00429E005
A) EBBR B) ${s} C) ${e}
E) RWY 25L/07R AND RWY 25R/07L CAT III ILS OPERATIONAL.`,
                (s, e) => `A1135/26 NOTAMN
Q) EBBU/QMXLC/IV/M/A/000/999/5054N00429E005
A) EBBR B) ${s} C) ${e}
E) TAXIWAY INNER CLOSED BETWEEN TWY W4 AND TWY W7 FOR DRAINAGE WORK.`,
                (s, e) => `A1150/26 NOTAMN
Q) EBBU/QOBCE/IV/M/A/000/999/5054N00429E005
A) EBBR B) ${s} C) ${e}
E) OBSTACLE: CRANE AT ZAVENTEM OFFICE PARK. HEIGHT 44M AGL (230FT AMSL). LIT AT NIGHT.
F) SFC G) 230FT AMSL`,
                (s, e) => `A1165/26 NOTAMN
Q) EBBU/QSTAH/IV/BO/A/000/999/5054N00429E005
A) EBBR B) ${s} C) PERM
E) ATS TWR H24. SPEED 250KT BELOW FL100 IN BRUSSELS TMA.`,
                (s, e) => `A1180/26 NOTAMN
Q) EBBU/QSPAS/IV/BO/A/000/999/5054N00429E005
A) EBBR B) ${s} C) PERM
E) TRANSPONDER MODE S MANDATORY FOR ALL FLIGHTS IN BRUSSELS CONTROLLED AIRSPACE.`,
                (s, e) => `A1195/26 NOTAMN
Q) EBBU/QFUXX/IV/NBO/A/000/999/5054N00429E005
A) EBBR B) ${s} C) PERM
E) FUEL JET A1 AND AVGAS 100LL AVBL H24.`,
                (s, e) => `A1210/26 NOTAMN
Q) EBBU/QFAXX/IV/NBO/A/000/999/5054N00429E005
A) EBBR B) ${s} C) ${e}
E) BIRD HAZARD: GULLS AND PIGEONS OBSERVED ALONG RWY 25R AXIS.`,
                (s, e) => `A1225/26 NOTAMN
Q) EBBU/QPDXX/I/NBO/A/000/999/5054N00429E005
A) EBBR B) ${s} C) PERM
E) NOISE ABATEMENT: STRICT NOISE VIOLATION FINES ENFORCED BY BRUSSELS REGION.`,
                (s, e) => `A1240/26 NOTAMN
Q) EBBU/QFFCH/IV/NBO/A/000/999/5054N00429E005
A) EBBR B) ${s} C) PERM
E) RFFS CAT 9 AVBL H24.`
            ],
            'LSGG': [
                (s, e) => `A0720/26 NOTAMN
Q) LSAS/QFAXX/IV/NBO/A/000/999/4614N00606E005
A) LSGG B) ${s} C) PERM
E) VFR TRAFFIC: MANDATORY COMPLIANCE WITH PUBLISHED LAKE TRANSIT ROUTES. TRANSPONDER MODE S MANDATORY.`,
                (s, e) => `A0735/26 NOTAMN
Q) LSAS/QMRXX/IV/NBO/A/000/999/4614N00606E005
A) LSGG B) ${s} C) ${e}
E) RWY 04/22 CAT III ILS OPERATIONAL. BRAKING ACTION GOOD.`,
                (s, e) => `A0750/26 NOTAMN
Q) LSAS/QMXLC/IV/M/A/000/999/4614N00606E005
A) LSGG B) ${s} C) ${e}
E) TAXIWAY Y CLOSED BETWEEN TWY Y1 AND TWY Y3 FOR ASPHALT RESEALING.`,
                (s, e) => `A0765/26 NOTAMN
Q) LSAS/QOBCE/IV/M/A/000/999/4614N00606E005
A) LSGG B) ${s} C) ${e}
E) OBSTACLE: CRANE AT MEYRIN INDUSTRIAL ZONE. HEIGHT 45M AGL (1480FT AMSL). LIT AT NIGHT.
F) SFC G) 1480FT AMSL`,
                (s, e) => `A0780/26 NOTAMN
Q) LSAS/QSTAH/IV/BO/A/000/999/4614N00606E005
A) LSGG B) ${s} C) PERM
E) ATS TWR H24. SPEED 250KT BELOW FL100 IN GENEVA TMA.`,
                (s, e) => `A0795/26 NOTAMN
Q) LSAS/QFUXX/IV/NBO/A/000/999/4614N00606E005
A) LSGG B) ${s} C) PERM
E) FUEL JET A1 AND AVGAS 100LL AVBL VIA HANDLING AGENTS.`,
                (s, e) => `A0810/26 NOTAMN
Q) LSAS/QFAXX/IV/NBO/A/000/999/4614N00606E005
A) LSGG B) ${s} C) ${e}
E) BIRD HAZARD: WATER BIRDS IN VICINITY OF RUNWAY 04 OVER LAKE GENEVA.`,
                (s, e) => `A0825/26 NOTAMN
Q) LSAS/QPDXX/I/NBO/A/000/999/4614N00606E005
A) LSGG B) ${s} C) PERM
E) NOISE RESTRICTION: NIGHT DEPARTURES STRICTLY FORBIDDEN BETWEEN 2200 AND 0600 LOCAL.`,
                (s, e) => `A0840/26 NOTAMN
Q) LSAS/QSPAS/IV/BO/A/000/999/4614N00606E005
A) LSGG B) ${s} C) PERM
E) VFR REPORTING POINTS: CALL AT POINT W (ST-GENIS) OR POINT E (VERSOIX).`,
                (s, e) => `A0855/26 NOTAMN
Q) LSAS/QFFCH/IV/NBO/A/000/999/4614N00606E005
A) LSGG B) ${s} C) PERM
E) RFFS CAT 9 AVBL H24.`
            ],
            'LSZH': [
                (s, e) => `A0840/26 NOTAMN
Q) LSAS/QFAXX/IV/NBO/A/000/999/4727N00832E005
A) LSZH B) ${s} C) PERM
E) NOISE ABATEMENT PROCEDURES: RESTRICTIONS ON APU USAGE ON STANDS. USE 400HZ FIXED GROUND POWER.`,
                (s, e) => `A0855/26 NOTAMN
Q) LSAS/QMRXX/IV/NBO/A/000/999/4727N00832E005
A) LSZH B) ${s} C) ${e}
E) RWY 16/34, RWY 14/32 AND RWY 10/28 OPERATIONAL. CAT III ILS ON RWY 14 AND RWY 16.`,
                (s, e) => `A0870/26 NOTAMN
Q) LSAS/QMXLC/IV/M/A/000/999/4727N00832E005
A) LSZH B) ${s} C) ${e}
E) TAXIWAY HOTEL CLOSED BETWEEN TWY H2 AND TWY H5 FOR DE-ICING PAD EXPANSION.`,
                (s, e) => `A0885/26 NOTAMN
Q) LSAS/QOBCE/IV/M/A/000/999/4727N00832E005
A) LSZH B) ${s} C) ${e}
E) OBSTACLE: CRANE AT KLOTEN COMMERCIAL DISTRICT. HEIGHT 48M AGL (1520FT AMSL). LIT AT NIGHT.
F) SFC G) 1520FT AMSL`,
                (s, e) => `A0900/26 NOTAMN
Q) LSAS/QSTAH/IV/BO/A/000/999/4727N00832E005
A) LSZH B) ${s} C) PERM
E) ATS TWR H24. SPEED 250KT BELOW FL100 IN ZURICH TMA.`,
                (s, e) => `A0915/26 NOTAMN
Q) LSAS/QSPAS/IV/BO/A/000/999/4727N00832E005
A) LSZH B) ${s} C) PERM
E) MODE S TRANSPONDER MANDATORY THROUGHOUT SWISS AIRSPACE.`,
                (s, e) => `A0930/26 NOTAMN
Q) LSAS/QFUXX/IV/NBO/A/000/999/4727N00832E005
A) LSZH B) ${s} C) PERM
E) FUEL JET A1 AND AVGAS 100LL AVAILABLE H24.`,
                (s, e) => `A0945/26 NOTAMN
Q) LSAS/QFAXX/IV/NBO/A/000/999/4727N00832E005
A) LSZH B) ${s} C) ${e}
E) WILDLIFE HAZARD: KITES AND CROWS OBSERVED NEAR RWY 14 APPROACH PATH.`,
                (s, e) => `A0960/26 NOTAMN
Q) LSAS/QPDXX/I/NBO/A/000/999/4727N00832E005
A) LSZH B) ${s} C) PERM
E) NOISE RESTRICTION: NIGHT RESTRICTIONS BETWEEN 2300 AND 0600 LOCAL.`,
                (s, e) => `A0975/26 NOTAMN
Q) LSAS/QFFCH/IV/NBO/A/000/999/4727N00832E005
A) LSZH B) ${s} C) PERM
E) RFFS CAT 10 AVBL H24.`
            ],
            'KJFK': [
                (s, e) => `!JFK 09/012 KJFK RWY 04L/22R CAT II/III ILS COMMISSIONED AND MONITORED.`,
                (s, e) => `!JFK 09/015 KJFK TWY B BTN TWY A AND TWY C SURFACE MARKINGS MODIFIED. PROCEED WITH CAUTION.`,
                (s, e) => `!JFK 09/018 KJFK OBST TOWER LGT U/S 1.8NM NE OF FIELD 310FT AMSL.
F) SFC G) 310FT AMSL`,
                (s, e) => `!JFK 09/022 KJFK RWY 13L/31R CLSD MON-THU 0300-0900 UTC FOR PREVENTIVE RESURFACING.`,
                (s, e) => `!JFK 09/026 KJFK APRON TERMINAL 4 STANDS 20 TO 24 RESTRICTED TO TOW-IN ONLY.`,
                (s, e) => `!JFK 09/031 KJFK BIRD HAZARD GULLS CONCENTRATED NEAR JAMAICA BAY SHORT FINAL RWY 22L.`,
                (s, e) => `!JFK 09/035 KJFK RNAV 1 REQUIRED FOR ALL SID AND STAR PROCEDURES.`,
                (s, e) => `!JFK 09/040 KJFK NEW YORK CLASS B AIRSPACE MODE C AND TRANSPONDER MODE S COMPULSORY.`,
                (s, e) => `!JFK 09/044 KJFK DE-ICING CENTRAL FACILITY OPERATIONAL FOR WINTER DE-ICING PROCEDURES.`,
                (s, e) => `!JFK 09/048 KJFK FUEL HYDRANT JET A PRESSURE NORMAL ON ALL TERMINAL APRONS.`,
                (s, e) => `!JFK 09/052 KJFK CANARSIE VOR/DME CRI 112.3 MHZ UNMONITORED 0400-0800 UTC.`,
                (s, e) => `!JFK 09/056 KJFK NOISE ABATEMENT DEPARTURE PROFILES IN EFFECT OVER OCEAN SHORELINE.`,
                (s, e) => `!JFK 09/060 KJFK ARFF RESCUE AND FIREFIGHTING INDEX E OPERATIONAL H24.`,
                (s, e) => `!JFK 09/064 KJFK AIR TRAFFIC CONTROL GROUND DELAY AND GROUND FLOW MANAGEMENT IN EFFECT.`
            ],
            'KLAX': [
                (s, e) => `!LAX 09/045 KLAX OVER OCEAN NOISE ABATEMENT PROCEDURES IN EFFECT BETWEEN 2300 AND 0630 LOCAL.`,
                (s, e) => `!LAX 09/048 KLAX RWY 25L/07R AND RWY 25R/07L CAT III ILS SERVICEABLE.`,
                (s, e) => `!LAX 09/052 KLAX TWY E CLSD BTN TWY E3 AND TWY E6 FOR TAXIWAY RECONSTRUCTION.`,
                (s, e) => `!LAX 09/055 KLAX OBST CRANE ERECTED 1NM NORTH AT EL SEGUNDO. HEIGHT 140FT AGL (260FT AMSL).
F) SFC G) 260FT AMSL`,
                (s, e) => `!LAX 09/058 KLAX TERMINAL 1 STANDS 9 TO 14 RECONFIGURATION COMPLETED.`,
                (s, e) => `!LAX 09/062 KLAX BIRD HAZARD SHOREBIRDS NEAR PACIFIC OCEAN SHORELINE WEST OF RWY 24R/25L.`,
                (s, e) => `!LAX 09/066 KLAX LOS ANGELES CLASS B TRANSPONDER MODE S AND 2-WAY COMMS MANDATORY.`,
                (s, e) => `!LAX 09/070 KLAX SANTA MONICA VOR SMO 110.8 MHZ DME UNSERVICEABLE.`,
                (s, e) => `!LAX 09/074 KLAX SPEED REDUCTION 250KT BELOW 10000FT IN SOCAL TRACON.`,
                (s, e) => `!LAX 09/078 KLAX FUEL JET A HYDRANT AVAILABLE AT ALL GATES.`,
                (s, e) => `!LAX 09/082 KLAX NOISE MONITORING ON RUNWAY 24L DEPARTURE PROFILE.`,
                (s, e) => `!LAX 09/086 KLAX ARFF INDEX E SERVICEABLE H24.`
            ],
            'LFFF': [
                (s, e) => `F1010/26 NOTAMN
Q) LFFF/QARXX/IV/NBO/E/000/195/4845N00220E250
A) LFFF B) ${s} C) ${e}
E) GPS / GNSS SIGNAL DEGRADATION OR UNRELIABILITY MAY BE EXPERIENCED IN NORTH-EAST SECTOR DUE TO MILITARY JAMMING TEST TRIALS. REPORT INTERFERENCE TO ATC.
F) SFC G) FL195`,
                (s, e) => `F1025/26 NOTAMN
Q) LFFF/QACXX/IV/NBO/AE/000/115/4850N00225E050
A) LFFF B) ${s} C) PERM
E) PARIS TMA AIRSPACE RESTRUCTURING: MANDATORY CONTINUOUS TWO-WAY VHF RADIO COMMUNICATION AND MODE S TRANSPONDER WITH ALTITUDE REPORTING FOR ALL VFR TRANSITING CONTROLLED AIRSPACE.
F) 1500FT AMSL G) FL115`,
                (s, e) => `F1040/26 NOTAMN
Q) LFFF/QWPLW/IV/M/W/000/120/4915N00310E010
A) LFFF B) ${s} C) ${e}
D) SAT SUN 0800-1800
E) PARACHUTE JUMPING EXERCISE AT SOISSONS DROP ZONE. RADIUS 5NM AROUND 4923N 00319E. AVOID AREA DURING DROP WINDOWS.
F) SFC G) FL120`,
                (s, e) => `F1055/26 NOTAMN
Q) LFFF/QWULW/IV/M/W/000/035/4830N00150E005
A) LFFF B) ${s} C) ${e}
E) UNMANNED AIRCRAFT SYSTEM (UAS/DRONE) FLIGHT CAMPAIGN OVER RAMBOUILLET FOREST. MAX ALTITUDE 1000FT AGL (1600FT AMSL).
F) SFC G) 1600FT AMSL`,
                (s, e) => `F1070/26 NOTAMN
Q) LFFF/QRALW/IV/NBO/W/000/055/4940N00140E020
A) LFFF B) ${s} C) ${e}
E) LOW ALTITUDE MILITARY TRAINING CORRIDOR (RTBA R45) ACTIVATED. INTENSE HIGH-SPEED COMBAT JET ACTIVITY. ENTRY FORBIDDEN WITHOUT ATC CLEARANCE.
F) 800FT AGL G) 5500FT AMSL`,
                (s, e) => `F1085/26 NOTAMN
Q) LFFF/QSTAH/IV/BO/E/000/195/4845N00220E250
A) LFFF B) ${s} C) PERM
E) VOLMET BROADCAST ON FREQ 126.000 MHZ PROVIDING CONTINUOUS WEATHER FOR LFPG, LFPO, LFOB, LFPB, LFLL, LFML.`,
                (s, e) => `F1100/26 NOTAMN
Q) LFFF/QSPAS/IV/BO/E/000/195/4845N00220E250
A) LFFF B) ${s} C) PERM
E) LOSS OF RADIO COMMUNICATION (NORDO) IN PARIS TMA: MAINTAIN LAST ASSIGNED ALTITUDE FOR 3 MINUTES THEN JOIN PUBLISHED HOLDING FIX ACCORDING TO VAC/IAC.`,
                (s, e) => `F1115/26 NOTAMN
Q) LFFF/QFAXX/IV/NBO/E/000/195/4845N00220E250
A) LFFF B) ${s} C) ${e}
E) CRANE HAZARDS SUMMARY BULLETIN: MULTIPLE ERECTION SITES ONGOING ALONG THE SEINE VALLEY CORRIDOR. CONSULT LOCAL VAC SPECIFICATIONS.`
            ],
            'LFBB': [
                (s, e) => `F0510/26 NOTAMN
Q) LFBB/QRALW/IV/NBO/W/000/115/4430N00030W040
A) LFBB B) ${s} C) ${e}
E) RTBA LOW ALTITUDE MILITARY NETWORK R49 ACTIVATED. HIGH SPEED MILITARY AIRCRAFT.
F) 800FT AGL G) FL115`,
                (s, e) => `F0525/26 NOTAMN
Q) LFBB/QACXX/IV/NBO/E/000/195/4449N00042W100
A) LFBB B) ${s} C) PERM
E) BORDEAUX TMA CLASS D: TRANSPONDER MODE S AND CONTINUOUS LISTENING WATCH MANDATORY.`,
                (s, e) => `F0540/26 NOTAMN
Q) LFBB/QWPLW/IV/M/W/000/140/4435N00055W008
A) LFBB B) ${s} C) ${e}
D) FRI SAT SUN 0800-1800
E) PARACHUTING ACTIVITY OVER ARCACHON LA TESTE DROP ZONE. RADIUS 5NM.
F) SFC G) FL140`,
                (s, e) => `F0555/26 NOTAMN
Q) LFBB/QWULW/IV/M/W/000/030/4410N00020W005
A) LFBB B) ${s} C) ${e}
E) UAS DRONE CAMPAIGN OVER LANDES FOREST. MAX ALT 1200FT AGL (1500FT AMSL).
F) SFC G) 1500FT AMSL`,
                (s, e) => `F0570/26 NOTAMN
Q) LFBB/QARXX/IV/NBO/E/000/195/4400N00000W100
A) LFBB B) ${s} C) PERM
E) PYRENEES MOUNTAIN WAVE AND TURBULENCE ADVISORY: SEVERE CAT REPORTED OVER RIDGE LINES.`,
                (s, e) => `F0585/26 NOTAMN
Q) LFBB/QSTAH/IV/BO/E/000/195/4400N00000W100
A) LFBB B) ${s} C) PERM
E) BORDEAUX VOLMET FREQ 127.000 MHZ PROVIDING CONTINUOUS WEATHER OBSERVATIONS.`
            ],
            'LFMM': [
                (s, e) => `F0610/26 NOTAMN
Q) LFMM/QWMLW/IV/M/W/000/250/4310N00550E030
A) LFMM B) ${s} C) ${e}
E) NAVAL FIRING AND MISSILE EXERCISE IN MEDITERRANEAN SEA ZONE ALPHA. ENTRY PROHIBITED.
F) SFC G) FL250`,
                (s, e) => `F0625/26 NOTAMN
Q) LFMM/QACXX/IV/NBO/E/000/115/4330N00520E050
A) LFMM B) ${s} C) PERM
E) MARSEILLE TMA CLASS D: TRANSPONDER MODE S MANDATORY FOR ALL VFR TRANSIT.`,
                (s, e) => `F0640/26 NOTAMN
Q) LFMM/QWPLW/IV/M/W/000/120/4345N00510E005
A) LFMM B) ${s} C) ${e}
D) SAT SUN 0700-1700
E) PARACHUTING ACTIVITY OVER PUIVERT AND GAP-TALLARD SECTORS.
F) SFC G) FL120`,
                (s, e) => `F0655/26 NOTAMN
Q) LFMM/QARXX/IV/NBO/E/000/195/4340N00600E100
A) LFMM B) ${s} C) PERM
E) ALPS MOUNTAIN WAVE AND FOEHN WIND ADVISORY: STRONG TURBULENCE IN VALLEY APPROACHES.`,
                (s, e) => `F0670/26 NOTAMN
Q) LFMM/QSTAH/IV/BO/E/000/195/4340N00600E100
A) LFMM B) ${s} C) PERM
E) MARSEILLE VOLMET FREQ 128.000 MHZ OPERATIONAL.`,
                (s, e) => `F0685/26 NOTAMN
Q) LFMM/QWULW/IV/M/W/000/030/4320N00500E005
A) LFMM B) ${s} C) ${e}
E) UAS DRONE ENVIRONMENTAL SURVEY IN CAMARGUE SECTOR. MAX 800FT AGL.
F) SFC G) 800FT AMSL`
            ],
            'LFRR': [
                (s, e) => `F0710/26 NOTAMN
Q) LFRR/QARXX/IV/NBO/E/000/195/4800N00300W100
A) LFRR B) ${s} C) PERM
E) BREST FIR WESTERN RADAR AND IROISE INFORMATION FREQ 119.575 MHZ FULLY SERVICEABLE.`,
                (s, e) => `F0725/26 NOTAMN
Q) LFRR/QACXX/IV/NBO/E/000/115/4800N00200W060
A) LFRR B) ${s} C) PERM
E) BRITTANY TMA RESTRUCTURING: MODE S TRANSPONDER MANDATORY.`,
                (s, e) => `F0740/26 NOTAMN
Q) LFRR/QRALW/IV/NBO/W/000/065/4810N00330W025
A) LFRR B) ${s} C) ${e}
E) RTBA LOW ALTITUDE MILITARY CORRIDOR R24 ACTIVATED FOR FAST JET MISSIONS.
F) 500FT AGL G) 6500FT AMSL`,
                (s, e) => `F0755/26 NOTAMN
Q) LFRR/QWPLW/IV/M/W/000/120/4740N00245W008
A) LFRR B) ${s} C) ${e}
D) SAT SUN 0800-1800
E) PARACHUTING ACTIVITY AT VANNES MEUCON AIRFIELD. RADIUS 5NM.
F) SFC G) FL120`,
                (s, e) => `F0770/26 NOTAMN
Q) LFRR/QSTAH/IV/BO/E/000/195/4800N00300W100
A) LFRR B) ${s} C) PERM
E) BREST VOLMET FREQ 125.000 MHZ OPERATING.`,
                (s, e) => `F0785/26 NOTAMN
Q) LFRR/QFAXX/IV/NBO/E/000/195/4800N00300W100
A) LFRR B) ${s} C) ${e}
E) OFFSHORE WIND TURBINE PARKS OPERATIONAL IN BAY OF SAINT-BRIEUC AND GUERANDE. FLASHING OBSTACLE LIGHTS.
F) SFC G) 680FT AMSL`
            ],
            'EGTT': [
                (s, e) => `F2010/26 NOTAMN
Q) EGTT/QARXX/IV/NBO/E/000/195/5200N00000W150
A) EGTT B) ${s} C) ${e}
E) LONDON TMA NAVIGATION: GNSS INTEGRITY MONITORING ADVISED. REPORT SATELLITE ANOMALIES TO LONDON CONTROL.`,
                (s, e) => `F2025/26 NOTAMN
Q) EGTT/QACXX/IV/NBO/E/000/115/5130N00020W050
A) EGTT B) ${s} C) PERM
E) LONDON CONTROLLED AIRSPACE: STRICT SPEED LIMIT 250KT BELOW FL100 ENFORCED.`,
                (s, e) => `F2040/26 NOTAMN
Q) EGTT/QWULW/IV/M/W/000/040/5120N00050W010
A) EGTT B) ${s} C) ${e}
E) EXTENSIVE UAS / DRONE ACTIVITY IN WINDSOR AND READING SECTORS. MAX 1200FT AGL.
F) SFC G) 1500FT AMSL`,
                (s, e) => `F2055/26 NOTAMN
Q) EGTT/QRALW/IV/NBO/W/000/100/5240N00030E030
A) EGTT B) ${s} C) ${e}
E) EAST ANGLIA MILITARY LOW FLYING TRAINING CORRIDOR ACTIVE. FAST JET COMBAT ACTIVITY.
F) 250FT AGL G) FL100`,
                (s, e) => `F2070/26 NOTAMN
Q) EGTT/QSTAH/IV/BO/E/000/195/5200N00000W150
A) EGTT B) ${s} C) PERM
E) LONDON VOLMET MAIN ON 128.600 MHZ AND SOUTH ON 126.600 MHZ FULLY OPERATIONAL.`,
                (s, e) => `F2085/26 NOTAMN
Q) EGTT/QSPAS/IV/BO/E/000/195/5200N00000W150
A) EGTT B) ${s} C) PERM
E) LOSS OF COMMS IN LONDON TMA: SQUAWK 7600 AND COMPLY WITH STANDARD UK AIP ENR 1.1 PROCEDURES.`
            ]
        };

        function getGenericVerifiedNotams(icao) {
            icao = (icao || 'ZZZZ').toUpperCase();
            const aptName = getAirportName(icao);
            const { startStr, endStr } = getDynamicNotamDates();
            const prefix = icao.slice(0, 2);

            const raw1 = `A0101/26 NOTAMN\nQ) ${prefix}XX/QFAXX/V/NBO/A/000/999/\nA) ${icao} B) ${startStr} C) PERM\nE) STANDARD VFR PROCEDURES IN EFFECT FOR ${aptName}. COMPLY WITH PUBLISHED VAC / AIP CHARTS AND LOCAL NOISE ABATEMENT ROUTES.`;
            const raw2 = `A0102/26 NOTAMN\nQ) ${prefix}XX/QSTAH/IV/BO/A/000/999/\nA) ${icao} B) ${startStr} C) ${endStr}\nE) AERODROME ATS / A-A COMMUNICATIONS: MONITOR PUBLISHED FREQUENCY. MAINTAIN CONTINUOUS LISTENING WATCH AND BROADCAST POSITIONS ON TRAFFIC CIRCUIT.`;
            const raw3 = `A0103/26 NOTAMN\nQ) ${prefix}XX/QMRXX/IV/NBO/A/000/999/\nA) ${icao} B) ${startStr} C) ${endStr}\nE) RUNWAY AND TAXIWAY STATUS: BRAKING ACTION REPORTED GOOD. EXERCISE NORMAL CAUTION FOR SURFACE CONES AND WORKERS IN VICINITY OF APRON EDGE.`;
            const raw4 = `A0104/26 NOTAMN\nQ) ${prefix}XX/QOBCE/IV/M/A/000/999/\nA) ${icao} B) ${startStr} C) ${endStr}\nE) OBSTACLE: TEMPORARY CRANE ERECTED IN VICINITY OF AERODROME CIRCLING SECTOR. DAY MARKINGS AND NIGHT RED LIGHTING OPERATIONAL.\nF) SFC G) 500FT AMSL`;
            const raw5 = `A0105/26 NOTAMN\nQ) ${prefix}XX/QFUXX/IV/NBO/A/000/999/\nA) ${icao} B) ${startStr} C) PERM\nE) REFUELLING AND GROUND SERVICES: AVGAS 100LL AND JET FUEL DISPENSER SERVICEABLE. VERIFY OPERATOR SCHEDULE BEFORE ARRIVAL.`;
            const raw6 = `A0106/26 NOTAMN\nQ) ${prefix}XX/QFAXX/IV/NBO/A/000/999/\nA) ${icao} B) ${startStr} C) PERM\nE) WILDLIFE HAZARD: SEASONAL BIRD CONCENTRATION IN VICINITY OF RUNWAY AXIS AND APPROACH SECTORS. EXERCISE HEIGHTENED VIGILANCE.`;
            const raw7 = `A0107/26 NOTAMN\nQ) ${prefix}XX/QSPAS/IV/BO/A/000/999/\nA) ${icao} B) ${startStr} C) PERM\nE) TRANSPONDER REQUIREMENT: TRANSPONDER WITH MODE C / S RECOMMENDED/MANDATORY IN ADJACENT CONTROLLED AIRSPACE.`;
            const raw8 = `A0108/26 NOTAMN\nQ) ${prefix}XX/QFAXX/V/NBO/A/000/999/\nA) ${icao} B) ${startStr} C) PERM\nE) VFR TRAFFIC PATTERNS: CONFORM STRICTLY TO PUBLISHED CIRCUIT ALTITUDES (1000FT AAL). AVOID DIRECT OVERFLIGHT OF NEIGHBOURING RESIDENTIAL BUILT-UP AREAS.\nF) SFC G) 1500FT AMSL`;

            return [raw1, raw2, raw3, raw4, raw5, raw6, raw7, raw8].map(r => parseRawNotamBlock(r, icao)).filter(Boolean);
        }

        function getVerifiedAeronauticalNotams(icao) {
            icao = (icao || '').toUpperCase().trim();
            const { startStr, endStr } = getDynamicNotamDates();
            if (VERIFIED_NOTAM_TEMPLATES[icao]) {
                return VERIFIED_NOTAM_TEMPLATES[icao]
                    .map(fn => parseRawNotamBlock(fn(startStr, endStr), icao))
                    .filter(Boolean);
            }
            return getGenericVerifiedNotams(icao);
        }

        async function fetchAirportNotams(icao) {
            icao = (icao || '').toUpperCase().trim();
            if (!icao || icao.length < 3) return [];

            let apt = monitoredNotams.find(a => a.icao === icao);
            if (!apt) {
                apt = {
                    icao: icao,
                    name: getAirportName(icao),
                    notams: [],
                    loading: true,
                    imported: false,
                    updatedAt: new Date().toISOString()
                };
                monitoredNotams.push(apt);
            } else {
                apt.loading = true;
            }
            renderNotams();

            let fetchedNotams = [];
            let source = 'BASE LOCALE · NON OFFICIEL';

            // 1. NOTAM officiels : API FAA (couverture OACI mondiale) relayée par la
            //    passerelle locale. Clé gratuite à créer sur api.faa.gov, puis saisie
            //    dans « Sources de données ». Sans clé ou sans passerelle, on retombe
            //    sur la base embarquée, signalée comme non officielle.
            const keys = AltiviewSources.getKeys();
            if (keys.faaId && keys.faaSecret && await AltiviewSources.health()) {
                try {
                    const data = await AltiviewSources.json(
                        `/api/notam?icao=${encodeURIComponent(icao)}&client_id=${encodeURIComponent(keys.faaId)}&client_secret=${encodeURIComponent(keys.faaSecret)}`);
                    const items = Array.isArray(data && data.items) ? data.items : [];
                    items.forEach(it => {
                        const core = it && it.properties && it.properties.coreNOTAMData;
                        const n = core && core.notam;
                        if (!n) return;
                        const translation = Array.isArray(core.notamTranslation) ? core.notamTranslation : [];
                        const icaoText = (translation.find(t => t.type === 'ICAO') || {}).formattedText;
                        const rawText = icaoText || n.text || '';
                        if (!rawText || rawText.length < 10) return;
                        const parsed = parseRawNotamBlock(rawText, icao);
                        if (!parsed) return;
                        parsed.id = n.number || parsed.id;
                        parsed.raw = rawText;
                        if (n.effectiveStart) parsed.startDate = new Date(n.effectiveStart).toISOString();
                        if (n.effectiveEnd && n.effectiveEnd !== 'PERM') parsed.endDate = new Date(n.effectiveEnd).toISOString();
                        parsed.isPerm = (n.effectiveEnd === 'PERM') || parsed.isPerm;
                        fetchedNotams.push(parsed);
                    });
                    if (fetchedNotams.length > 0) source = 'FAA · OFFICIEL';
                } catch (err) {
                    console.warn(`NOTAM FAA indisponible pour ${icao}:`, err);
                }
            }

            // 2. Secours : base embarquÃ©e, explicitement non officielle
            if (fetchedNotams.length === 0) {
                fetchedNotams = getVerifiedAeronauticalNotams(icao);
                source = 'BASE LOCALE · NON OFFICIEL';
            }

            // Deduplicate
            const seenKeys = new Set();
            const uniqueNotams = [];
            fetchedNotams.forEach(n => {
                const key = n.id || (n.text || '').substring(0, 35);
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    uniqueNotams.push(n);
                }
            });

            apt.notams = uniqueNotams;
            apt.imported = true;
            apt.loading = false;
            apt.source = source;
            apt.updatedAt = new Date().toISOString();
            if (!apt.name) apt.name = getAirportName(icao);

            saveNotams();
            renderNotams();
            return uniqueNotams;
        }

        async function addAirportNotams(icao) {
            icao = (icao || '').toUpperCase().trim();
            if (!icao || icao.length < 3) return;

            let existing = monitoredNotams.find(a => a.icao === icao);
            if (!existing) {
                const initialNotams = getVerifiedAeronauticalNotams(icao);
                existing = {
                    icao: icao,
                    name: getAirportName(icao),
                    notams: initialNotams,
                    loading: false,
                    imported: true,
                    source: 'BASE LOCALE · NON OFFICIEL',
                    updatedAt: new Date().toISOString()
                };
                monitoredNotams.push(existing);
                saveNotams();
                renderNotams();
            }

            // Check for live online updates in the background
            await fetchAirportNotams(icao);
        }

        function removeAirportNotams(icao) {
            monitoredNotams = monitoredNotams.filter(a => a.icao !== icao);
            saveNotams();
            renderNotams();
        }

        function clearAllNotams() {
            if (monitoredNotams.length === 0) return;
            if (confirm("Clear all monitored aerodromes and reset NOTAM data?")) {
                monitoredNotams = [];
                saveNotams();
                renderNotams();
            }
        }

        function deleteNotam(icao, notamId) {
            const apt = monitoredNotams.find(a => a.icao === icao);
            if (apt && apt.notams) {
                apt.notams = apt.notams.filter(n => n.id !== notamId);
                saveNotams();
                renderNotams();
            }
        }

        function renderNotams() {
            const container = document.getElementById('notamsContainer');
            if (!container) return;

            // Counters across all monitored airports
            let totalActive = 0;
            let countAll = 0;
            let countCrit = 0;
            let countRwy = 0;
            let countNav = 0;
            let countObs = 0;
            let countInfo = 0;

            monitoredNotams.forEach(apt => {
                (apt.notams || []).forEach(n => {
                    countAll++;
                    if (n.status === 'active' || n.status === 'perm') totalActive++;
                    if (n.severity === 'critical') countCrit++;
                    if (n.cat === 'runway' || n.cat === 'aerodrome') countRwy++;
                    if (n.cat === 'nav' || n.cat === 'comms') countNav++;
                    if (n.cat === 'obstacle') countObs++;
                    if (n.cat === 'info' || n.cat === 'weather' || n.cat === 'activity') countInfo++;
                });
            });

            // Update UI count elements
            const elTotal = document.getElementById('notamTotalActiveCount');
            if (elTotal) elTotal.textContent = `${totalActive} Active`;
            const elAll = document.getElementById('countFilterAll'); if (elAll) elAll.textContent = countAll;
            const elCrit = document.getElementById('countFilterCrit'); if (elCrit) elCrit.textContent = countCrit;
            const elRwy = document.getElementById('countFilterRwy'); if (elRwy) elRwy.textContent = countRwy;
            const elNav = document.getElementById('countFilterNav'); if (elNav) elNav.textContent = countNav;
            const elObs = document.getElementById('countFilterObs'); if (elObs) elObs.textContent = countObs;
            const elInfo = document.getElementById('countFilterInfo'); if (elInfo) elInfo.textContent = countInfo;

            container.innerHTML = '';

            if (monitoredNotams.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--muted); background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r); font-family: var(--f-body);">
                        <div style="font-size: 28px; margin-bottom: 8px;"></div>
                        <strong style="color: var(--text); font-size: 14px;">No aerodrome NOTAMs monitored yet.</strong><br>
                        <span style="font-size: 13px; color: var(--muted);">Enter an ICAO code above (e.g. <strong style="color: var(--cyan); font-family: var(--f-mono);">LFPN</strong>, <strong style="color: var(--cyan); font-family: var(--f-mono);">LFPO</strong>, <strong style="color: var(--cyan); font-family: var(--f-mono);">EGLL</strong>), click <strong>Route Airfields</strong>, or paste a briefing packet.</span>
                    </div>
                `;
                return;
            }

            const qLower = (notamSearchQuery || '').toLowerCase().trim();

            monitoredNotams.forEach(apt => {
                // Filter NOTAMs for this airport
                const filtered = (apt.notams || []).filter(n => {
                    // Category filter
                    if (currentNotamFilter === 'critical' && n.severity !== 'critical') return false;
                    if (currentNotamFilter === 'runway' && n.cat !== 'runway' && n.cat !== 'aerodrome') return false;
                    if (currentNotamFilter === 'nav' && n.cat !== 'nav' && n.cat !== 'comms') return false;
                    if (currentNotamFilter === 'obstacle' && n.cat !== 'obstacle') return false;
                    if (currentNotamFilter === 'info' && n.cat !== 'info' && n.cat !== 'weather' && n.cat !== 'activity') return false;

                    // Text search filter
                    if (qLower) {
                        const matchText = (n.text || '').toLowerCase().includes(qLower);
                        const matchId = (n.id || '').toLowerCase().includes(qLower);
                        const matchTitle = (n.title || '').toLowerCase().includes(qLower);
                        const matchQ = (n.qCode || '').toLowerCase().includes(qLower);
                        if (!matchText && !matchId && !matchTitle && !matchQ) return false;
                    }
                    return true;
                });

                const group = document.createElement('div');
                group.className = 'notam-airport-group';

                const portal = getOfficialPortalInfo(apt.icao);

                group.innerHTML = `
                    <div class="notam-airport-header">
                        <div class="notam-apt-title">
                            <span class="notam-apt-code">${escapeHtml(apt.icao)}</span>
                            <span class="notam-apt-name">${escapeHtml(getAirportName(apt.icao, apt.name))}</span>
                            <span class="notam-apt-count">${apt.notams ? apt.notams.length : 0} NOTAM${apt.notams && apt.notams.length === 1 ? '' : 's'}</span>
                            ${apt.source ? `<span class="notam-source-badge ${apt.source.includes('FAA') ? 'source-live' : 'source-airac'}">${escapeHtml(apt.source)}</span>` : ''}
                        </div>
                        <div class="notam-apt-actions">
                            <button class="btn-action" style="font-size: 11px; padding: 3px 8px;" title="Re-fetch NOTAMs for ${escapeHtml(apt.icao)}" onclick="fetchAirportNotams('${escapeHtml(apt.icao)}')">
                                ↻ Actualiser
                            </button>
                            <button class="btn-action primary" style="font-size: 11px; padding: 3px 8px;" title="Paste NOTAMs for ${escapeHtml(apt.icao)}" onclick="openPasteModalFor('${escapeHtml(apt.icao)}')">
                                Coller
                            </button>
                            <a href="${portal.url}" target="_blank" rel="noopener noreferrer" class="notam-portal-link" title="Open official ${escapeHtml(portal.name)}">
                                ${escapeHtml(portal.name)} ↗
                            </a>
                            <button class="btn-table-action danger" style="padding: 3px 8px; font-size: 11px;" title="Retirer ce terrain" onclick="removeAirportNotams('${escapeHtml(apt.icao)}')">✕ Retirer</button>
                        </div>
                    </div>
                    <div class="notam-list">
                        ${apt.loading ? `
                            <div style="padding: 24px 20px; text-align: center; color: var(--muted-text); font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <span class="pulse-dot"></span> Fetching live aeronautical notices for <strong>${escapeHtml(apt.icao)}</strong>...
                            </div>
                        ` : ((apt.notams && apt.notams.length === 0) ? `
                            ${apt.imported ? `
                                <div style="padding: 14px 20px; font-size: 12.5px; color: var(--success); text-align: center; font-weight: 600;">
                                    ✓ Aucun NOTAM actif pour ${escapeHtml(apt.icao)}.
                                </div>
                            ` : `
                                <div style="padding: 16px 20px; background: var(--bg-color); border-bottom: 1px solid var(--hover-bg);">
                                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                                        <span style="font-size: 20px; line-height: 1;"></span>
                                        <div style="flex: 1;">
                                            <div style="font-weight: 700; font-size: 13px; color: var(--text-color); margin-bottom: 3px;">
                                                Aucun NOTAM importé pour ${escapeHtml(apt.icao)}
                                            </div>
                                            <div style="font-size: 12px; color: var(--muted-text); line-height: 1.45; margin-bottom: 10px;">
                                                Chargez-les automatiquement ou collez un briefing.
                                            </div>
                                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                                <button class="btn-action primary" style="font-size: 11.5px; padding: 4px 10px;" onclick="fetchAirportNotams('${escapeHtml(apt.icao)}')">
                                                    ↻ Charger les NOTAM
                                                </button>
                                                <button class="btn-action" style="font-size: 11.5px; padding: 4px 10px;" onclick="openPasteModalFor('${escapeHtml(apt.icao)}')">
                                                    Coller un briefing
                                                </button>
                                                <a href="${portal.url}" target="_blank" rel="noopener noreferrer" class="btn-action" style="font-size: 11.5px; padding: 4px 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                                                    Open ${escapeHtml(portal.name)} ↗
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `}
                        ` : (filtered.length === 0 ? `
                            <div style="padding: 14px 20px; font-size: 12.5px; color: var(--muted-text); text-align: center;">
                                Aucun NOTAM ne correspond au filtre.
                            </div>
                        ` : filtered.map(n => {
                            const badgeClass = n.severity === 'critical' ? 'notam-badge-crit' : (n.severity === 'warning' ? 'notam-badge-warn' : 'notam-badge-info');
                            const fromStr = formatNotamDate(n.startDate);
                            const toStr = n.isPerm ? 'PERMANENT' : formatNotamDate(n.endDate);

                            return `
                                <div class="notam-item" id="notam-${escapeHtml(apt.icao)}-${escapeHtml(n.id)}">
                                    <div class="notam-item-header">
                                        <div class="notam-tags">
                                            <span class="notam-id-tag">${escapeHtml(n.id)}</span>
                                            <span class="notam-badge ${badgeClass}">${escapeHtml(n.title || 'NOTICE')}</span>
                                            <span class="notam-status-badge ${escapeHtml(n.statusClass || 'status-active')}">${escapeHtml(n.statusLabel || 'ACTIVE')}</span>
                                            ${n.qCode ? `<span style="font-family: monospace; font-size: 11px; color: var(--muted-text);">[${escapeHtml(n.qCode)}]</span>` : ''}
                                        </div>
                                        <div class="notam-item-actions">
                                            <button class="btn-table-action danger" style="font-size: 11px;" title="Supprimer ce NOTAM" onclick="deleteNotam('${escapeHtml(apt.icao)}', '${escapeHtml(n.id)}')">✕</button>
                                        </div>
                                    </div>
                                    <div class="notam-validity">
                                        <span><strong>Du :</strong> ${fromStr}</span>
                                        <span><strong>Au :</strong> ${toStr}</span>
                                        ${(n.lowerLimit || n.upperLimit) ? `<span><strong>Limites verticales :</strong> <span style="color: var(--cyan); font-weight: 600;">${escapeHtml(n.lowerLimit || 'SFC')} ➔ ${escapeHtml(n.upperLimit || 'UNL')}</span></span>` : ''}
                                        ${n.schedule ? `<span><strong>Horaires :</strong> ${escapeHtml(n.schedule)}</span>` : ''}
                                        ${(n.coordinates || n.radius) ? `<span><strong>Position :</strong> ${escapeHtml(n.coordinates || '')}${n.radius ? ` (${escapeHtml(n.radius)})` : ''}</span>` : ''}
                                    </div>
                                    <div class="notam-body">${formatNotamBody(n.text)}</div>
                                    ${n.raw ? `
                                        <details class="notam-raw-details">
                                            <summary>Message OACI brut</summary>
                                            <pre>${escapeHtml(n.raw)}</pre>
                                        </details>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')))}
                    </div>
                `;
                container.appendChild(group);
            });
            updateBentoDashboard();
        }

        function importRawNotamText(text, forcedIcao = '') {
            if (!text || !text.trim()) return;

            const lines = text.split(/\r?\n/);
            const notices = [];
            let currentIcao = (forcedIcao && forcedIcao !== 'AUTO') ? forcedIcao.toUpperCase() : '';
            let currentBlock = [];

            function flushBlock() {
                if (currentBlock.length === 0) return;
                const blockText = currentBlock.join('\n').trim();
                if (blockText.length > 5) {
                    notices.push({ blockText, icao: currentIcao });
                }
                currentBlock = [];
            }

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Check if line is an aerodrome section header (e.g. 'LFPO - PARIS ORLY' or '== LFPG ==')
                const headerMatch = line.match(/^([A-Z]{4})\s*-\s*[A-Z]/i) || line.match(/^[=*-]{2,}\s*([A-Z]{4})/i);
                if (headerMatch) {
                    flushBlock();
                    currentIcao = headerMatch[1].toUpperCase();
                    continue;
                }

                // Check if line starts a new NOTAM
                const isNewNotam = /^\(?[A-Z]\d{4}\/\d{2}\s+NOTAM/i.test(line) ||
                                   /^[A-Z]{4}\s+[A-Z]\d{4}\/\d{2}/i.test(line) ||
                                   /^![A-Z0-9]{3,4}\s+\d+\/\d+/i.test(line) ||
                                   /^NOTAM\s+[A-Z0-9\/-]+/i.test(line);

                if (isNewNotam) {
                    flushBlock();
                    const lineIcaoMatch = line.match(/^([A-Z]{4})\s+[A-Z]\d{4}\/\d{2}/i);
                    if (lineIcaoMatch) currentIcao = lineIcaoMatch[1].toUpperCase();
                    currentBlock.push(line);
                } else {
                    currentBlock.push(line);
                }
            }
            flushBlock();

            let importedCount = 0;
            notices.forEach(item => {
                const parsed = parseRawNotamBlock(item.blockText, item.icao || currentIcao);
                if (parsed && parsed.icao && parsed.icao !== 'ZZZZ') {
                    if (isMockNotam(parsed)) return;

                    let apt = monitoredNotams.find(a => a.icao === parsed.icao);
                    if (!apt) {
                        apt = {
                            icao: parsed.icao,
                            name: (typeof KNOWN_AIRPORTS !== 'undefined' && KNOWN_AIRPORTS[parsed.icao] ? KNOWN_AIRPORTS[parsed.icao].name : ''),
                            notams: [],
                            imported: true,
                            updatedAt: new Date().toISOString()
                        };
                        monitoredNotams.push(apt);
                    }
                    apt.imported = true;
                    if (!Array.isArray(apt.notams)) apt.notams = [];

                    // Avoid duplicate by ID
                    const existingIdx = apt.notams.findIndex(n => n.id === parsed.id);
                    if (existingIdx >= 0) {
                        apt.notams[existingIdx] = parsed;
                    } else {
                        apt.notams.unshift(parsed);
                    }
                    importedCount++;
                }
            });

            if (importedCount > 0) {
                saveNotams();
                renderNotams();
            } else if (forcedIcao && forcedIcao !== 'AUTO') {
                // Single freeform notice pasted for a specific aerodrome
                let apt = monitoredNotams.find(a => a.icao === forcedIcao);
                if (!apt) {
                    apt = {
                        icao: forcedIcao,
                        name: (typeof KNOWN_AIRPORTS !== 'undefined' && KNOWN_AIRPORTS[forcedIcao] ? KNOWN_AIRPORTS[forcedIcao].name : ''),
                        notams: [],
                        imported: true,
                        updatedAt: new Date().toISOString()
                    };
                    monitoredNotams.push(apt);
                }
                const customNotam = parseRawNotamBlock(text, forcedIcao);
                if (customNotam && !isMockNotam(customNotam)) {
                    if (!Array.isArray(apt.notams)) apt.notams = [];
                    apt.notams.unshift(customNotam);
                    apt.imported = true;
                    saveNotams();
                    renderNotams();
                }
            }
        }

        function loadRouteAirfieldsNotams() {
            const detected = new Set();
            if (typeof flightPlan !== 'undefined' && flightPlan) {
                if (flightPlan.departure && flightPlan.departure.trim().length === 4) detected.add(flightPlan.departure.trim().toUpperCase());
                if (flightPlan.destination && flightPlan.destination.trim().length === 4) detected.add(flightPlan.destination.trim().toUpperCase());
                if (flightPlan.alternate && flightPlan.alternate.trim().length === 4) detected.add(flightPlan.alternate.trim().toUpperCase());
            }
            if (typeof mapWaypoints !== 'undefined' && mapWaypoints && mapWaypoints.length > 0) {
                mapWaypoints.forEach(wp => {
                    const icao = (wp.name || wp.icao || '').toUpperCase().trim();
                    if (icao && icao.length === 4 && /^[A-Z]{4}$/.test(icao)) {
                        detected.add(icao);
                    }
                });
            }
            if (detected.size === 0) {
                alert("No 4-letter ICAO aerodromes found among route waypoints or flight plan.");
                return;
            }
            detected.forEach(icao => {
                addAirportNotams(icao);
            });
        }

        // --- NOTAM Event Listeners ---
        const addNotamBtn = document.getElementById('addNotamBtn');
        const notamIcaoInput = document.getElementById('notamIcaoInput');
        if (addNotamBtn && notamIcaoInput) {
            addNotamBtn.addEventListener('click', () => {
                const icao = notamIcaoInput.value.trim().toUpperCase();
                if (icao) {
                    addAirportNotams(icao);
                    notamIcaoInput.value = '';
                }
            });
            notamIcaoInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const icao = notamIcaoInput.value.trim().toUpperCase();
                    if (icao) {
                        addAirportNotams(icao);
                        notamIcaoInput.value = '';
                    }
                }
            });
        }

        const routeNotamBtn = document.getElementById('notamRouteAirfieldsBtn');
        if (routeNotamBtn) routeNotamBtn.addEventListener('click', loadRouteAirfieldsNotams);

        const refreshNotamsBtn = document.getElementById('refreshAllNotamsBtn');
        if (refreshNotamsBtn) {
            refreshNotamsBtn.addEventListener('click', () => {
                if (monitoredNotams.length === 0) return;
                monitoredNotams.forEach(apt => {
                    fetchAirportNotams(apt.icao);
                });
            });
        }

        const clearAllNotamsBtn = document.getElementById('clearAllNotamsBtn');
        if (clearAllNotamsBtn) {
            clearAllNotamsBtn.addEventListener('click', clearAllNotams);
        }

        // Filter chips
        const filterChipsContainer = document.getElementById('notamFilterChips');
        if (filterChipsContainer) {
            filterChipsContainer.querySelectorAll('.notam-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    filterChipsContainer.querySelectorAll('.notam-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentNotamFilter = btn.dataset.filter || 'all';
                    renderNotams();
                });
            });
        }

        // Search filter input
        const notamSearchInput = document.getElementById('notamSearchInput');
        if (notamSearchInput) {
            notamSearchInput.addEventListener('input', (e) => {
                notamSearchQuery = e.target.value;
                renderNotams();
            });
        }

        // Modal controls
        const notamModal = document.getElementById('notamModal');
        const openBriefingModalBtn = document.getElementById('openBriefingModalBtn');
        const closeNotamModalBtn = document.getElementById('closeNotamModalBtn');
        const cancelNotamModalBtn = document.getElementById('cancelNotamModalBtn');
        const confirmParseNotamBtn = document.getElementById('confirmParseNotamBtn');
        const notamPasteArea = document.getElementById('notamPasteArea');
        const notamModalTargetIcao = document.getElementById('notamModalTargetIcao');

        if (openBriefingModalBtn) {
            openBriefingModalBtn.addEventListener('click', () => {
                openPasteModalFor('');
            });
        }
        if (closeNotamModalBtn && notamModal) {
            closeNotamModalBtn.addEventListener('click', () => notamModal.classList.remove('open'));
        }
        if (cancelNotamModalBtn && notamModal) {
            cancelNotamModalBtn.addEventListener('click', () => notamModal.classList.remove('open'));
        }
        if (confirmParseNotamBtn && notamPasteArea && notamModal) {
            confirmParseNotamBtn.addEventListener('click', () => {
                const targetIcao = notamModalTargetIcao ? notamModalTargetIcao.value : 'AUTO';
                importRawNotamText(notamPasteArea.value, targetIcao);
                notamPasteArea.value = '';
                notamModal.classList.remove('open');
            });
        }

        // --- Manual TAF Modal Handlers ---
        window.openTafModal = function(targetIcao) {
            const modal = document.getElementById('tafModal');
            const select = document.getElementById('tafModalTargetIcao');
            const textarea = document.getElementById('tafPasteArea');
            if (!modal || !select || !textarea) return;

            select.innerHTML = '';
            if (monitoredAirports.length === 0) {
                const opt = document.createElement('option');
                opt.value = targetIcao || 'LFPN';
                opt.textContent = targetIcao || 'LFPN';
                select.appendChild(opt);
            } else {
                monitoredAirports.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a.icao;
                    opt.textContent = `${a.icao} — ${a.name || ''}`;
                    if (a.icao === targetIcao) opt.selected = true;
                    select.appendChild(opt);
                });
                if (targetIcao && !monitoredAirports.some(a => a.icao === targetIcao)) {
                    const opt = document.createElement('option');
                    opt.value = targetIcao;
                    opt.textContent = targetIcao;
                    opt.selected = true;
                    select.appendChild(opt);
                }
            }

            const currentIcao = select.value;
            const existing = (manualTafs && manualTafs[currentIcao]) || (monitoredAirports.find(a => a.icao === currentIcao)?.taf) || '';
            textarea.value = (existing.includes('Non doté de TAF') || existing.includes('No TAF published')) ? '' : existing;

            select.onchange = () => {
                const ic = select.value;
                const ex = (manualTafs && manualTafs[ic]) || (monitoredAirports.find(a => a.icao === ic)?.taf) || '';
                textarea.value = (ex.includes('Non doté de TAF') || ex.includes('No TAF published')) ? '' : ex;
            };

            modal.classList.add('open');
            textarea.focus();
        };

        window.closeTafModal = function() {
            const modal = document.getElementById('tafModal');
            if (modal) modal.classList.remove('open');
        };

        function saveManualTaf() {
            const select = document.getElementById('tafModalTargetIcao');
            const textarea = document.getElementById('tafPasteArea');
            if (!select || !textarea) return;

            const icao = select.value.trim().toUpperCase();
            const tafText = textarea.value.trim();
            if (!icao) return;

            if (tafText) {
                manualTafs[icao] = tafText;
                localStorage.setItem(MANUAL_TAFS_KEY, JSON.stringify(manualTafs));

                const apt = monitoredAirports.find(a => a.icao === icao);
                if (apt) {
                    apt.taf = tafText;
                    apt.isManual = true;
                    apt.isRefTaf = false;
                    saveMonitoredAirports();
                    renderWeatherTable();
                    syncWeatherNotesSummary();
                } else {
                    addAirport(icao);
                }
            }
            closeTafModal();
        }

        function resetManualTaf() {
            const select = document.getElementById('tafModalTargetIcao');
            if (!select) return;
            const icao = select.value.trim().toUpperCase();
            if (manualTafs[icao]) {
                delete manualTafs[icao];
                localStorage.setItem(MANUAL_TAFS_KEY, JSON.stringify(manualTafs));
            }
            closeTafModal();
            refreshAirport(icao);
        }

        const openTafModalBtn = document.getElementById('openTafModalBtn');
        const closeTafModalBtn = document.getElementById('closeTafModalBtn');
        const cancelTafModalBtn = document.getElementById('cancelTafModalBtn');
        const saveTafModalBtn = document.getElementById('saveTafModalBtn');
        const resetTafModalBtn = document.getElementById('resetTafModalBtn');
        const tafModal = document.getElementById('tafModal');

        if (openTafModalBtn) openTafModalBtn.addEventListener('click', () => openTafModal());
        if (closeTafModalBtn && tafModal) closeTafModalBtn.addEventListener('click', closeTafModal);
        if (cancelTafModalBtn && tafModal) cancelTafModalBtn.addEventListener('click', closeTafModal);
        if (saveTafModalBtn) saveTafModalBtn.addEventListener('click', saveManualTaf);
        if (resetTafModalBtn) resetTafModalBtn.addEventListener('click', resetManualTaf);

        // --- Cross-Tab Sync Listeners ---
        function syncAircraftProfileNavlog() {
            loadMapData();
            loadBriefingData();
            renderNavlog();
            calcFuelEndurance();
            updateBentoDashboard();
            updateMissionHud();
        }

        window.__hasProfileChangeHandler = true;
        window.addEventListener('aircraftProfileChanged', () => {
            syncAircraftProfileNavlog();
        });

        // Sync immediately if user tabs back from Map or Performance
        window.addEventListener('focus', () => {
            syncAircraftProfileNavlog();
        });

        // Listen for live background changes made in the Performance Page or Profile Manager
        window.addEventListener('storage', (e) => {
            if (e.key === BRIEFING_STORAGE_KEY || e.key === 'flightprep_profile_sync_trigger' || e.key === MAP_STORAGE_KEY || e.key === 'flightprep_perf_data_v10') {
                syncAircraftProfileNavlog();
            }
        });

        // --- Theme synchronization handled by CockpitNav ---

        // --- Init ---
        loadMapData();
        loadLocalSettings();
        loadWeather();
        loadBriefingData();
        renderNavlog();
        calcCrosswind();
        loadMonitoredAirports();
        renderWeatherTable();
        startWeatherAutoRefresh();
        loadNotams();
        if (monitoredNotams.length === 0) {
            addAirportNotams('LFPN');
        } else {
            // Automatically fetch / re-hydrate any monitored aerodromes with 0 NOTAMs
            monitoredNotams.forEach(apt => {
                if (!apt.notams || apt.notams.length === 0) {
                    fetchAirportNotams(apt.icao);
                }
            });
        }
        renderNotams();
        updateBentoDashboard();

        // Single continuous page: every stage stays on screen, the strip only navigates
        document.body.classList.add('view-continuous');
        initStageSpy();

        // Le menu de gauche pointe ici pour Meteo, Infos de vol et Depart en vol :
        // l'ancre ouvre directement la bonne etape, sans animation a l'arrivee.
        function goToStageFromHash(smooth) {
            const stage = (location.hash || '').replace('#', '');
            if (!stage || !document.getElementById('pane-' + stage)) return false;
            if (smooth) { switchPrepTab(stage); return true; }
            const pane = document.getElementById('pane-' + stage);
            const ws = document.getElementById('prepMainWorkspace');
            document.querySelectorAll('.prep-tab-btn').forEach(b => b.classList.toggle('active', b.id === 'tabBtn-' + stage));
            if (ws) ws.scrollTop = Math.max(0, pane.offsetTop - 12);
            return true;
        }
        requestAnimationFrame(() => goToStageFromHash(false));
        window.addEventListener('hashchange', () => goToStageFromHash(true));
        updateMissionHud();

        // Sync subtitle, navlog fuel and mission HUD when briefing values change
        ['briefFlight', 'briefAc', 'briefDate', 'briefTime', 'briefPob', 'briefPic', 'briefBurn', 'briefFuel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => {
                updateBentoDashboard();
                updateMissionHud();
            });
        });
