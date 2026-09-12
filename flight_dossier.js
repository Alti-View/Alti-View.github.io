/**
 * FlightPrep Solution — Universal In-Flight Dossier & Kneeboard Generator (6-Page Edition)
 * Page 1: Flight Plan, Navlog & Pilot Briefing (Flight Info, Briefing Remarks, IMSAFE, Docs, Navlog)
 * Page 2: Aerodrome Weather Briefing (Selected Airfields METAR & TAF ribbons + raw)
 * Page 3: Visual Route Chart & Aircraft Performance (Vector Minimap, V-Speeds, W&B, Fuel Endurance)
 * Page 4: Aerodrome NOTAMs (Selected Airfields categorized & decoded - directly before Checklists)
 * Page 5: Normal Flight Procedures Checklists (2-column kneeboard format)
 * Page 6: Emergency Procedures, Critical V-Speeds, Transponder Squawks & Light Gun Signals
 */

(function () {
    'use strict';

    // Storage Keys
    const MAP_KEY = 'flightprep_map_data_v11';
    const INFO_KEY = 'flightprep_info_v1';
    const PERF_KEY = 'flightprep_perf_data_v10';
    const CHK_KEY = 'flightprep_checklists_data_v2';
    const WEATHER_KEY = 'flightprep_weather_v1';
    const AIRPORTS_WX_KEY = 'flightprep_airports_wx_v2';
    const NOTAMS_KEY = 'flightprep_notams_v1';

    // Known Airport Coordinates & Names
    const KNOWN_AIRPORTS = {
        'LFPG': { name: 'Paris Charles de Gaulle', lat: 49.0097, lng: 2.5479, alt: 392 },
        'LFPO': { name: 'Paris Orly', lat: 48.7233, lng: 2.3794, alt: 291 },
        'LFPN': { name: 'Toussus-le-Noble', lat: 48.7519, lng: 2.1056, alt: 538 },
        'LFPT': { name: 'Pontoise - Cormeilles', lat: 49.0964, lng: 2.0408, alt: 325 },
        'LFPL': { name: 'Lognes - Emerainville', lat: 48.8219, lng: 2.6236, alt: 354 },
        'LFPM': { name: 'Melun Villaroche', lat: 48.6053, lng: 2.6719, alt: 305 },
        'LFAI': { name: 'Nangis Les Loges', lat: 48.5961, lng: 3.0069, alt: 427 },
        'LFOB': { name: 'Beauvais Tillé', lat: 49.4544, lng: 2.1128, alt: 358 },
        'LFAT': { name: "Le Touquet Côte d'Opale", lat: 50.5147, lng: 1.6214, alt: 36 },
        'LFMD': { name: 'Cannes Mandelieu', lat: 43.5419, lng: 6.9531, alt: 13 },
        'LFMN': { name: "Nice Côte d'Azur", lat: 43.6584, lng: 7.2159, alt: 12 },
        'LFML': { name: 'Marseille Provence', lat: 43.4367, lng: 5.2150, alt: 74 },
        'LFLL': { name: 'Lyon Saint-Exupéry', lat: 45.7256, lng: 5.0811, alt: 821 },
        'LFLY': { name: 'Lyon Bron', lat: 45.7289, lng: 4.9447, alt: 659 },
        'LFBO': { name: 'Toulouse Blagnac', lat: 43.6291, lng: 1.3638, alt: 499 },
        'LFBD': { name: 'Bordeaux Mérignac', lat: 44.8283, lng: -0.7156, alt: 162 },
        'LFRB': { name: 'Brest Bretagne', lat: 48.4478, lng: -4.4225, alt: 325 },
        'LFRN': { name: 'Rennes Saint-Jacques', lat: 48.0694, lng: -1.7347, alt: 124 },
        'EGLL': { name: 'London Heathrow', lat: 51.4700, lng: -0.4543, alt: 83 },
        'EGKK': { name: 'London Gatwick', lat: 51.1537, lng: -0.1821, alt: 202 },
        'EHAM': { name: 'Amsterdam Schiphol', lat: 52.3086, lng: 4.7639, alt: -11 },
        'EBBR': { name: 'Brussels National', lat: 50.9014, lng: 4.4844, alt: 184 },
        'LSGG': { name: 'Geneva Cointrin', lat: 46.2381, lng: 6.1089, alt: 1411 },
        'LSZH': { name: 'Zurich Airport', lat: 47.4647, lng: 8.5492, alt: 1416 }
    };

    // Math Helpers
    function toRad(deg) { return deg * Math.PI / 180; }
    function toDeg(rad) { return rad * 180 / Math.PI; }

    function calculateNavData(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in NM
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        let bearing = Math.atan2(y, x) * (180 / Math.PI);
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
        } else {
            gs = 0;
        }
        return { wca, th: (course + wca + 360) % 360, gs, ete: gs > 0 ? (dist / gs) * 60 : 0 };
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Default Emergency Checklists
    const DEFAULT_EMERGENCY_CHECKLISTS = [
        {
            title: "ENGINE FAILURE IN FLIGHT (FORCED LANDING)",
            items: [
                { text: "Airspeed (Best Glide)", value: "ESTABLISH (70 KT)" },
                { text: "Landing Site / Field", value: "SELECT & FLY TOWARDS" },
                { text: "Carburetor Heat", value: "ON" },
                { text: "Fuel Selector Valve", value: "BOTH" },
                { text: "Mixture Control", value: "FULL RICH" },
                { text: "Aux Fuel Pump", value: "ON (IF EQUIPPED)" },
                { text: "Ignition Switch", value: "BOTH (OR START)" },
                { text: "IF NO RESTART POSSIBLE:", value: "PREPARE TOUCHDOWN" },
                { text: "Transponder / Squawk", value: "7700" },
                { text: "Radio Mayday (121.5 MHz)", value: "TRANSMIT" },
                { text: "Mixture Control", value: "IDLE CUT-OFF" },
                { text: "Fuel Shutoff Valve", value: "OFF" },
                { text: "Ignition Switch", value: "OFF" },
                { text: "Wing Flaps", value: "AS REQUIRED" },
                { text: "Master Switch", value: "OFF BEFORE IMPACT" }
            ]
        },
        {
            title: "ENGINE FIRE IN FLIGHT",
            items: [
                { text: "Mixture Control", value: "IDLE CUT-OFF" },
                { text: "Fuel Shutoff Valve", value: "OFF" },
                { text: "Master Switch", value: "OFF" },
                { text: "Cabin Heat & Air", value: "OFF" },
                { text: "Airspeed", value: "INCREASE TO EXTINGUISH" },
                { text: "Forced Landing", value: "EXECUTE IMMEDIATELY" }
            ]
        },
        {
            title: "ELECTRICAL FIRE IN FLIGHT",
            items: [
                { text: "Master Switch", value: "OFF" },
                { text: "Avionics Power", value: "OFF" },
                { text: "All Other Switches", value: "OFF" },
                { text: "Cabin Vents", value: "OPEN (CLEAR SMOKE)" },
                { text: "Fire Extinguisher", value: "ACTIVATE IF REQ" },
                { text: "Flight", value: "LAND AS SOON AS PRACTICAL" }
            ]
        }
    ];

    // Default Normal Checklists
    const DEFAULT_NORMAL_CHECKLISTS = [
        {
            title: "Pre-Flight & Cockpit",
            items: [
                { text: "Aircraft Documents (AROW)", value: "ON BOARD" },
                { text: "Control Lock", value: "REMOVED" },
                { text: "Ignition Switch", value: "OFF / KEYS ON DASH" },
                { text: "Master Switch", value: "ON" },
                { text: "Fuel Quantity Gauges", value: "CHECKED" },
                { text: "Flaps", value: "EXTEND FULL" },
                { text: "Master Switch", value: "OFF" }
            ]
        },
        {
            title: "Engine Start & Taxi",
            items: [
                { text: "Pre-Flight Inspection", value: "COMPLETE" },
                { text: "Passenger Briefing", value: "ACCOMPLISHED" },
                { text: "Seatbelts & Harnesses", value: "FASTENED" },
                { text: "Brakes", value: "TEST & HOLD" },
                { text: "Circuit Breakers", value: "CHECK IN" },
                { text: "Beacon / Anti-Collision", value: "ON" },
                { text: "Propeller Area", value: "CLEAR" },
                { text: "Starter", value: "ENGAGE" },
                { text: "Oil Pressure (30s)", value: "CHECK GREEN" }
            ]
        },
        {
            title: "Before Takeoff (Run-Up)",
            items: [
                { text: "Parking Brake", value: "SET" },
                { text: "Flight Controls", value: "FREE & CORRECT" },
                { text: "Flight Instruments", value: "SET & CHECK" },
                { text: "Fuel Selector", value: "BOTH" },
                { text: "Elevator Trim", value: "SET TAKEOFF" },
                { text: "Throttle", value: "1700 - 1800 RPM" },
                { text: "Magnetos Check", value: "MAX 150 DROP / 50 DIFF" },
                { text: "Carburetor Heat", value: "CHECK DROP & CLEAR" },
                { text: "Engine Gauges & Ammeter", value: "CHECK GREEN" },
                { text: "Throttle", value: "IDLE CHECK (600-800 RPM)" },
                { text: "Flaps", value: "SET FOR TAKEOFF (0°-10°)" },
                { text: "Cabin Doors & Windows", value: "LATCHED" }
            ]
        },
        {
            title: "Cruise & Descent",
            items: [
                { text: "Power (Cruise RPM)", value: "SET PER POH" },
                { text: "Elevator Trim", value: "ADJUSTED" },
                { text: "Mixture", value: "LEANED (>3000FT)" },
                { text: "Engine Gauges", value: "MONITOR GREEN" },
                { text: "Altimeter Setting (QNH)", value: "UPDATE CURRENT" },
                { text: "Fuel Selector / Balance", value: "CHECKED" },
                { text: "Destination ATIS / WX", value: "OBTAINED" },
                { text: "Approach Briefing", value: "COMPLETED" }
            ]
        },
        {
            title: "Before Landing & After Landing",
            items: [
                { text: "Seatbelts & Harnesses", value: "SECURE" },
                { text: "Fuel Selector", value: "BOTH" },
                { text: "Mixture", value: "FULL RICH" },
                { text: "Carburetor Heat", value: "ON AS REQUIRED" },
                { text: "Landing Light", value: "ON" },
                { text: "Wing Flaps", value: "AS DESIRED (< Vfe)" },
                { text: "Runway Exit & Stop", value: "CLEAR OF RWY" },
                { text: "Flaps", value: "RETRACT FULL" },
                { text: "Carb Heat", value: "COLD / OFF" },
                { text: "Transponder", value: "ALT / AS REQ" }
            ]
        }
    ];

    // ==========================================
    // VECTOR MINIMAP GENERATOR (SVG) - FIXED
    // ==========================================
    function generateRouteMinimapSVG(waypoints) {
        const svgW = 720;
        const svgH = 320;

        if (!Array.isArray(waypoints) || waypoints.length === 0) {
            return `
                <div style="width: 100%; height: ${svgH}px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #faf8f5; border: 1.5px dashed #bbb; border-radius: 4px; color: #777; font-size: 13px; text-align: center; padding: 20px; box-sizing: border-box;">
                    <div style="font-size: 28px; margin-bottom: 8px;"></div>
                    <strong style="color: #333; margin-bottom: 4px;">No Flight Track Plotted</strong>
                    <span>Add waypoints in the Interactive Route Map or Flight Preparation page to render your visual flight chart.</span>
                </div>
            `;
        }

        const validWps = waypoints
            .map(wp => ({
                name: String(wp.name || 'WPT'),
                lat: parseFloat(wp.lat),
                lng: parseFloat(wp.lng),
                alt: wp.alt !== undefined ? wp.alt : 3500
            }))
            .filter(wp => !isNaN(wp.lat) && !isNaN(wp.lng));

        if (validWps.length === 0) {
            return `
                <div style="width: 100%; height: ${svgH}px; display: flex; align-items: center; justify-content: center; background: #faf8f5; border: 1.5px dashed #bbb; border-radius: 4px; color: #777; font-size: 13px;">
                    Invalid waypoint coordinates provided.
                </div>
            `;
        }

        if (validWps.length === 1) {
            const wp = validWps[0];
            return `
                <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="${svgH}" style="display:block; background:#faf8f5; border:1.5px solid #000; border-radius:4px; font-family:'Inter', Arial, sans-serif;">
                    <circle cx="${svgW / 2}" cy="${svgH / 2}" r="60" fill="none" stroke="#ddd" stroke-width="1" stroke-dasharray="4,4" />
                    <circle cx="${svgW / 2}" cy="${svgH / 2}" r="30" fill="none" stroke="#ccc" stroke-width="1" />
                    <circle cx="${svgW / 2}" cy="${svgH / 2}" r="8" fill="#188038" stroke="#fff" stroke-width="2" />
                    <text x="${svgW / 2}" y="${svgH / 2 - 18}" font-size="12" font-weight="800" fill="#111" text-anchor="middle">${escapeHtml(wp.name)}</text>
                    <text x="${svgW / 2}" y="${svgH / 2 + 25}" font-size="10" font-family="monospace" fill="#555" text-anchor="middle">${wp.lat.toFixed(4)}° / ${wp.lng.toFixed(4)}° &bull; ${wp.alt}ft</text>
                    <text x="14" y="22" font-size="10" font-weight="700" fill="#666">SINGLE WAYPOINT &bull; ADD DESTINATION FOR TRACK</text>
                </svg>
            `;
        }

        // Bounding box calculation
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        validWps.forEach(wp => {
            if (wp.lat < minLat) minLat = wp.lat;
            if (wp.lat > maxLat) maxLat = wp.lat;
            if (wp.lng < minLng) minLng = wp.lng;
            if (wp.lng > maxLng) maxLng = wp.lng;
        });

        let dLat = maxLat - minLat;
        let dLng = maxLng - minLng;
        if (dLat < 0.05) dLat = 0.05;
        if (dLng < 0.05) dLng = 0.05;

        // Apply 18% padding
        const padLat = dLat * 0.20;
        const padLng = dLng * 0.20;
        minLat -= padLat; maxLat += padLat;
        minLng -= padLng; maxLng += padLng;

        const avgLat = (minLat + maxLat) / 2;
        const cosLat = Math.cos(toRad(avgLat));

        const marginX = 55;
        const marginY = 40;
        const plotW = svgW - marginX * 2;
        const plotH = svgH - marginY * 2;

        const normX = lng => marginX + ((lng - minLng) / (maxLng - minLng)) * plotW;
        const normY = lat => marginY + ((maxLat - lat) / (maxLat - minLat)) * plotH;

        const points = validWps.map(wp => ({
            x: normX(wp.lng),
            y: normY(wp.lat),
            name: wp.name,
            alt: wp.alt,
            lat: wp.lat,
            lng: wp.lng
        }));

        const polylinePoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

        // Calculate distances & leg midpoints
        let totalDistNm = 0;
        const legTags = [];
        for (let i = 0; i < validWps.length - 1; i++) {
            const nav = calculateNavData(validWps[i].lat, validWps[i].lng, validWps[i + 1].lat, validWps[i + 1].lng);
            totalDistNm += nav.dist;
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            legTags.push({
                x: midX,
                y: midY,
                text: `${Math.round(nav.course).toString().padStart(3, '0')}° / ${nav.dist.toFixed(1)}nm`
            });
        }

        // Scale bar calculation
        let scaleNm = 20;
        if (totalDistNm < 25) scaleNm = 5;
        else if (totalDistNm < 50) scaleNm = 10;
        else if (totalDistNm > 150) scaleNm = 50;

        const totalDegLng = maxLng - minLng;
        const nmPerDegLng = 60 * (cosLat || 1);
        const totalPlotNm = totalDegLng * nmPerDegLng;
        const scaleBarPx = Math.max(35, Math.min(180, (scaleNm / (totalPlotNm || 1)) * plotW));

        // Background subtle grid lines
        const gridLines = [];
        for (let i = 1; i <= 3; i++) {
            const y = marginY + (plotH / 4) * i;
            gridLines.push(`<line x1="10" y1="${y.toFixed(1)}" x2="${svgW - 10}" y2="${y.toFixed(1)}" stroke="#ece8df" stroke-width="1" stroke-dasharray="4,4" />`);
        }
        for (let i = 1; i <= 4; i++) {
            const x = marginX + (plotW / 5) * i;
            gridLines.push(`<line x1="${x.toFixed(1)}" y1="10" x2="${x.toFixed(1)}" y2="${svgH - 10}" stroke="#ece8df" stroke-width="1" stroke-dasharray="4,4" />`);
        }

        return `
            <div style="width: 100%; height: ${svgH}px; position: relative; background: #faf8f5; border: 1.5px solid #000; border-radius: 4px; overflow: hidden; box-sizing: border-box;">
                <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="${svgH}" style="display:block; width:100%; height:100%; font-family:'Inter', -apple-system, sans-serif;">
                    <!-- Grid Lines -->
                    ${gridLines.join('')}

                    <!-- Flight Track Casing & Centerline -->
                    <polyline points="${polylinePoints}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
                    <polyline points="${polylinePoints}" fill="none" stroke="#111111" stroke-width="2.5" stroke-dasharray="8,4" stroke-linecap="round" stroke-linejoin="round" />

                    <!-- Leg Distance & Course Badges -->
                    ${legTags.map(tag => `
                        <g transform="translate(${tag.x.toFixed(1)}, ${tag.y.toFixed(1)})">
                            <rect x="-44" y="-10" width="88" height="20" rx="3" fill="#ffffff" stroke="#111111" stroke-width="1.2" />
                            <text x="0" y="4" font-size="9.5" font-weight="800" fill="#111111" text-anchor="middle">${escapeHtml(tag.text)}</text>
                        </g>
                    `).join('')}

                    <!-- Waypoint Pins & Labels -->
                    ${points.map((p, idx) => {
                        const isStart = idx === 0;
                        const isEnd = idx === points.length - 1;
                        const pinColor = isStart ? '#188038' : (isEnd ? '#c5221f' : '#1967d2');
                        const labelBg = isStart ? '#e6f4ea' : (isEnd ? '#fce8e6' : '#ffffff');
                        const yOffset = idx % 2 === 0 ? -18 : 22;

                        return `
                            <g>
                                <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" fill="#ffffff" stroke="${pinColor}" stroke-width="3" />
                                <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${pinColor}" />

                                <g transform="translate(${p.x.toFixed(1)}, ${(p.y + yOffset).toFixed(1)})">
                                    <rect x="-42" y="-10" width="84" height="20" rx="3" fill="${labelBg}" stroke="#111111" stroke-width="1" />
                                    <text x="0" y="4" font-size="10.5" font-weight="800" fill="#111111" text-anchor="middle">${escapeHtml(p.name)}</text>
                                </g>
                                <text x="${p.x.toFixed(1)}" y="${(p.y + yOffset + (idx % 2 === 0 ? -12 : 26)).toFixed(1)}" font-size="8.5" font-family="monospace" font-weight="700" fill="#444" text-anchor="middle">${p.alt}ft</text>
                            </g>
                        `;
                    }).join('')}

                    <!-- North Arrow -->
                    <g transform="translate(${svgW - 36}, 34)">
                        <circle cx="0" cy="0" r="16" fill="#ffffff" stroke="#111111" stroke-width="1.5" />
                        <polygon points="0,-12 -4,0 4,0" fill="#111111" />
                        <polygon points="0,12 -4,0 4,0" fill="#bbbbbb" />
                        <text x="0" y="-15" font-size="9" font-weight="900" fill="#111111" text-anchor="middle">N</text>
                    </g>

                    <!-- Scale Bar -->
                    <g transform="translate(20, ${svgH - 22})">
                        <rect x="-4" y="-12" width="${scaleBarPx + 64}" height="22" rx="3" fill="#ffffff" stroke="#999999" stroke-width="0.8" />
                        <line x1="0" y1="0" x2="${scaleBarPx}" y2="0" stroke="#111111" stroke-width="3" />
                        <line x1="0" y1="-4" x2="0" y2="4" stroke="#111111" stroke-width="2" />
                        <line x1="${scaleBarPx}" y1="-4" x2="${scaleBarPx}" y2="4" stroke="#111111" stroke-width="2" />
                        <text x="${scaleBarPx + 8}" y="3.5" font-size="9.5" font-weight="800" fill="#111111">${scaleNm} NM</text>
                    </g>

                    <!-- Header Watermark -->
                    <text x="14" y="20" font-size="10" font-weight="800" letter-spacing="0.5" fill="#555555">
                        VFR ROUTE PLOT &bull; TOTAL DIST: ${totalDistNm.toFixed(1)} NM &bull; ${validWps.length - 1} LEGS
                    </text>
                </svg>
            </div>
        `;
    }

    // ==========================================
    // BUILD COMPLETE 6-PAGE IN-FLIGHT DOSSIER
    // ==========================================
    // =====================================================================
    // DOSSIER DE VOL — 6 pages A4, mise en page imprimable (identité Altiview)
    // Toutes les données viennent des modules: préparation, carte, performances,
    // météo, NOTAM et checklists. Aucune donnée n'est inventée: ce qui manque
    // est affiché comme "à compléter".
    // =====================================================================
    // Marque Altiview reprise du logo du logiciel (triangle + avion)
    const DSR_MARK = '<svg class="dsr-mark" viewBox="250 190 1432 1432" width="20" height="20" aria-hidden="true">'
        + '<path d="M966 212 1366 990H566ZM966 540 820 916H1111Z" fill="#4BC8B6" fill-rule="evenodd"/>'
        + '<path d="M540 1120 346 1586H602L790 1120ZM1392 1120 1586 1586H1330L1142 1120Z" fill="#2F8579"/>'
        + '<circle cx="966" cy="362" r="44" fill="#8CF7E4"/>'
        + '<path d="M966 405 1020 920 1660 1177 1550 1250 1020 1138V1440L1166 1512 966 1473 766 1512 912 1440V1138L381 1250 272 1177 912 920Z" fill="#FFFFFF"/></svg>';

    function dossierStyles() {
        return `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
            .dsr { --ink:#0C1620; --navy:#111B29; --soft:#5A6672; --hair:#D7DDE3; --band:#F2F5F7; --tint:#EAF1F2;
                   --amber:#B35A00; --amber-soft:#FBEEDF; --teal:#0A6E60; --teal-soft:#E3F0EE; --red:#B3123A; --red-soft:#FBE7EC; --green:#12674C;
                   font-family:'IBM Plex Sans',-apple-system,Helvetica,Arial,sans-serif; color:var(--ink); background:#fff; line-height:1.45; }
            .dsr * { box-sizing:border-box; }
            .dsr td { background:#fff !important; color:var(--ink) !important; }
            .dsr th { background:#fff !important; color:var(--soft) !important; }
            .dsr, .dsr div, .dsr section, .dsr span, .dsr li, .dsr p, .dsr h2, .dsr h4 { color:var(--ink); }
            .dsr-page { padding:0 0 12px; min-height:1040px; display:flex; flex-direction:column; background:#fff !important; page-break-after:always; }
            .dsr-page:last-child { page-break-after:avoid; }
            .dsr-body { flex:1; padding:0 22px; }

            /* bandeau de marque : fond nuit + filet ambre, comme la barre du logiciel */
            .dsr-head { display:flex; justify-content:space-between; align-items:center; gap:16px;
                        background:var(--navy) !important; color:#fff !important; padding:9px 22px 8px; border-bottom:3px solid var(--amber); }
            .dsr-head * { color:#fff !important; }
            .dsr-brand { display:flex; align-items:center; gap:9px; font-family:'Big Shoulders Display','Arial Narrow',sans-serif;
                         font-size:21px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; line-height:1; }
            .dsr-brand em { font-style:normal; font-family:'IBM Plex Mono',monospace; font-size:8.5px; font-weight:600; letter-spacing:.2em; color:#F3B26B !important; }
            .dsr-mark { flex:0 0 auto; }
            .dsr-meta { font-family:'IBM Plex Mono',monospace; font-size:9px; text-align:right; line-height:1.5; letter-spacing:.03em; opacity:.92; }
            .dsr-ticks { height:7px; background:repeating-linear-gradient(90deg, var(--hair) 0 1px, transparent 1px 14px); margin:0 22px 2px; }

            .dsr-title { display:flex; align-items:center; gap:10px; margin:13px 0 11px; font-family:'Big Shoulders Display','Arial Narrow',sans-serif;
                         font-size:24px; font-weight:800; text-transform:uppercase; letter-spacing:.02em; color:var(--navy); }
            .dsr-title span.n { font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:700; letter-spacing:.1em; color:#fff !important;
                                background:var(--amber) !important; padding:4px 8px; border-radius:5px; }
            .dsr-title:after { content:''; flex:1; height:1px; background:var(--hair); }

            .dsr-foot { display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--hair); padding:6px 22px 0; margin-top:10px;
                        font-family:'IBM Plex Mono',monospace; font-size:7.6px; color:var(--soft); letter-spacing:.05em; text-transform:uppercase; }
            .dsr-foot b { color:var(--amber); font-weight:600; }

            .dsr-h3 { position:relative; font-family:'IBM Plex Mono',monospace; font-size:9.5px; font-weight:600; letter-spacing:.16em;
                      text-transform:uppercase; color:var(--teal); margin:0 0 6px; padding-left:11px; }
            .dsr-h3:before { content:''; position:absolute; left:0; top:3px; width:5px; height:5px; background:var(--teal); border-radius:1px; }
            .dsr-card { position:relative; border:1px solid var(--hair); border-left:3px solid var(--teal); border-radius:10px; padding:11px 13px; background:#fff !important; break-inside:avoid; }
                        .dsr-card.plain { border-left:1px solid var(--hair); }

            .dsr-hero { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; background:var(--band) !important;
                        border:1px solid var(--hair); border-left:5px solid var(--amber); border-radius:12px; padding:12px 16px; margin-bottom:12px; }
            .dsr-route { font-family:'Big Shoulders Display','Arial Narrow',sans-serif; font-size:40px; font-weight:800; line-height:1; letter-spacing:.01em; color:var(--navy); }
            .dsr-route small { font-family:'IBM Plex Mono',monospace; font-size:10.5px; font-weight:600; color:var(--soft); letter-spacing:.08em; display:block; margin-top:6px; text-transform:uppercase; }
            .dsr-stamp { font-family:'IBM Plex Mono',monospace; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em;
                         border:1.5px solid var(--ink); border-radius:20px; padding:5px 12px; white-space:nowrap; }
            .dsr-stamp.go { color:var(--green); border-color:var(--green); background:#E9F3EF !important; }
            .dsr-stamp.nogo { color:var(--red); border-color:var(--red); background:var(--red-soft) !important; }

            .dsr-grid { display:grid; gap:8px; }
            .dsr-g4 { grid-template-columns:repeat(4,1fr); }
            .dsr-g3 { grid-template-columns:repeat(3,1fr); }
            .dsr-g2 { grid-template-columns:1fr 1fr; }
            .dsr-tile { border:1px solid var(--hair); border-top:2px solid var(--navy); border-radius:9px; padding:8px 10px; background:var(--band) !important; }
            .dsr-tile .k { font-family:'IBM Plex Mono',monospace; font-size:7.6px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--soft); }
            .dsr-tile .v { font-family:'Big Shoulders Display','Arial Narrow',sans-serif; font-size:24px; font-weight:800; line-height:1.05; margin-top:3px; letter-spacing:.02em; }
            .dsr-tile .v small { font-family:'IBM Plex Mono',monospace; font-size:9px; color:var(--soft); font-weight:500; letter-spacing:.06em; }
            .dsr-tile.amber { border-top-color:var(--amber); background:var(--amber-soft) !important; }
            .dsr-tile.amber .v { color:var(--amber); }
            .dsr-tile.teal { border-top-color:var(--teal); background:var(--teal-soft) !important; }
            .dsr-tile.teal .v { color:var(--teal); }

            table.dsr-t { width:100%; border-collapse:collapse; }
            table.dsr-t th { font-family:'IBM Plex Mono',monospace; font-size:8px; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
                             color:var(--teal) !important; text-align:left; padding:7px; background:var(--band) !important; border-bottom:2px solid var(--navy); white-space:nowrap; }
            table.dsr-t td { font-size:10px; padding:6px 7px; border-bottom:1px solid var(--hair); vertical-align:middle; }
            table.dsr-t td.m { font-family:'IBM Plex Mono',monospace; font-size:10.5px; }
            table.dsr-t td.leg { font-weight:600; }
            table.dsr-t tr.alt td { background:#FAFBFC !important; }
            table.dsr-t tr.tot td { border-top:2px solid var(--navy); border-bottom:none; font-weight:700; background:var(--band) !important; }
            .dsr-fill { display:inline-block; min-width:42px; border-bottom:1px dotted #9AA6B2; }

            .dsr-chipline { display:flex; flex-wrap:wrap; gap:5px; }
            .dsr-chip { font-family:'IBM Plex Mono',monospace; font-size:8.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase;
                        border:1px solid var(--hair); border-radius:20px; padding:3px 9px; color:var(--soft); }
            .dsr-chip.on { border-color:var(--green); color:var(--green); background:#EDF6F2 !important; }
            .dsr-chip.off { border-color:var(--hair); color:#95A0AB; }
            .dsr-chip.cat { border-color:var(--teal); color:var(--teal); background:var(--teal-soft) !important; }
            .dsr-chip.red { border-color:var(--red); color:var(--red); background:var(--red-soft) !important; }
            .dsr-chip.amber { border-color:var(--amber); color:var(--amber); background:var(--amber-soft) !important; }
            .dsr-raw { font-family:'IBM Plex Mono',monospace; font-size:9px; line-height:1.55; background:var(--band) !important; border-left:3px solid var(--teal);
                       padding:7px 9px; border-radius:0 7px 7px 0; word-break:break-word; white-space:pre-wrap; }
            .dsr-empty { border:1px dashed #B8C2CC; border-radius:10px; padding:16px; text-align:center; font-size:10.5px; color:var(--soft); background:var(--band) !important; }
            .dsr-note { font-size:9.5px; color:var(--soft); margin:0 0 9px; }

            .dsr-cols { column-count:2; column-gap:12px; }
            .dsr-chk { break-inside:avoid; border:1px solid var(--hair); border-radius:9px; margin-bottom:9px; overflow:hidden; }
            .dsr-chk > h4 { margin:0; background:var(--navy) !important; color:#fff !important; font-family:'IBM Plex Mono',monospace; font-size:8.5px; font-weight:600;
                            letter-spacing:.1em; text-transform:uppercase; padding:5px 9px; }
            .dsr-chk ul { list-style:none; margin:0; padding:5px 9px 7px; }
            .dsr-chk li { display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:9px; padding:2.5px 0; border-bottom:1px dotted var(--hair); }
            .dsr-chk li:last-child { border-bottom:none; }
            .dsr-chk li b { font-family:'IBM Plex Mono',monospace; font-weight:600; text-align:right; white-space:nowrap; color:var(--teal); }
            .dsr-chk.emg { border-color:var(--red); }
            .dsr-chk.emg > h4 { background:var(--red) !important; }
            .dsr-chk.emg li b { color:var(--red); }

            .dsr-sig { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px; vertical-align:-1px; border:1px solid rgba(0,0,0,.25); }
            .dsr-wx { border:1px solid var(--hair); border-radius:10px; padding:10px 12px; margin-bottom:8px; break-inside:avoid; }
            .dsr-wx-head { display:flex; justify-content:space-between; align-items:baseline; gap:10px; margin-bottom:7px; }
            .dsr-wx-icao { font-family:'Big Shoulders Display','Arial Narrow',sans-serif; font-size:22px; font-weight:800; letter-spacing:.02em; color:var(--navy); }
            .dsr-wx-icao span { font-family:'IBM Plex Sans',sans-serif; font-size:10.5px; font-weight:500; color:var(--soft); margin-left:8px; letter-spacing:0; }
            .dsr-nt { border:1px solid var(--hair); border-left:3px solid var(--soft); border-radius:0 8px 8px 0; padding:8px 10px; margin-bottom:7px; break-inside:avoid; }
            .dsr-nt.crit { border-left-color:var(--red); background:var(--red-soft) !important; }
            .dsr-nt.warn { border-left-color:var(--amber); background:var(--amber-soft) !important; }
            .dsr-nt-head { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:3px; }
            .dsr-nt-id { font-family:'IBM Plex Mono',monospace; font-size:9.5px; font-weight:700; color:var(--navy); }
            .dsr-nt-val { font-family:'IBM Plex Mono',monospace; font-size:8.5px; color:var(--soft); margin-bottom:3px; }
            .dsr-nt-txt { font-size:9.5px; line-height:1.5; }
            .dsr-tight table.dsr-t td { padding:4px 6px; font-size:9px; }
            .dsr-tight .dsr-chk li { font-size:8px; padding:1.5px 0; }
            .dsr-tight .dsr-chk > h4 { padding:3px 7px; font-size:8px; }
            .dsr-tight .dsr-sig { width:8px; height:8px; margin-right:5px; }
            .dsr-tight .dsr-h3 { margin-bottom:4px; }
            .dsr-tight .dsr-cols { margin-bottom:6px !important; }
            .dsr-tight .dsr-title { margin:10px 0 8px; }
            .dsr-tight .dsr-foot { margin-top:6px; }
            .dsr-tight .dsr-chk { margin-bottom:7px; }
            .dsr-tight .dsr-card { padding:9px 11px; }
        </style>`;
    }

    function buildDossierHtml() {
        // ---- Sources: tous les modules de la suite -------------------------
        const info = JSON.parse(localStorage.getItem(INFO_KEY) || '{}');
        const mapData = JSON.parse(localStorage.getItem(MAP_KEY) || '{}');
        const perfData = JSON.parse(localStorage.getItem(PERF_KEY) || '{}');
        const chkData = JSON.parse(localStorage.getItem(CHK_KEY) || '{}');
        const airportsWx = JSON.parse(localStorage.getItem(AIRPORTS_WX_KEY) || '[]');
        const notamsData = JSON.parse(localStorage.getItem(NOTAMS_KEY) || '[]');

        const waypoints = Array.isArray(mapData.waypoints) ? mapData.waypoints : [];
        const tas = parseFloat(mapData.tas) || 110;
        const windDir = parseFloat(mapData.windDir) || 0;
        const windSpd = parseFloat(mapData.windSpd) || 0;

        const callsign = info.flightNumber && info.flightNumber !== 'N/A' ? info.flightNumber : (perfData.profile?.registration || '—');
        const aircraft = info.aircraft || perfData.profile?.type || 'Avion';
        const dateStr = info.date || new Date().toISOString().split('T')[0];
        const depTime = info.departureTime || info.time || info.hour || '';
        const pic = info.pic || '—';
        const pob = info.pob || '—';
        const notes = info.notes || '';
        const readiness = info.readiness || {};
        const imsafe = readiness.imsafe || {};
        const docs = readiness.documents || {};
        const totalPages = 6;
        const generatedAt = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const dep = waypoints.length ? (waypoints[0].name || '—') : '—';
        const arr = waypoints.length > 1 ? (waypoints[waypoints.length - 1].name || '—') : '—';

        // ---- Branches de navigation ---------------------------------------
        const legs = [];
        let totDist = 0, totTimeMin = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            const w1 = waypoints[i], w2 = waypoints[i + 1];
            const lat1 = parseFloat(w1.lat), lon1 = parseFloat(w1.lng);
            const lat2 = parseFloat(w2.lat), lon2 = parseFloat(w2.lng);
            if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) continue;
            const geo = calculateNavData(lat1, lon1, lat2, lon2);
            const perf = calculateLegPerformance(geo.course, geo.dist, tas, windDir, windSpd);
            totDist += geo.dist;
            totTimeMin += perf.ete;
            legs.push({
                from: w1.name || `WP${i + 1}`, to: w2.name || `WP${i + 2}`,
                alt: w1.alt !== undefined ? w1.alt : '—',
                tc: Math.round(geo.course), th: Math.round(perf.th),
                dist: geo.dist, gs: Math.round(perf.gs), ete: Math.round(perf.ete)
            });
        }
        const hrs = Math.floor(totTimeMin / 60), mins = Math.round(totTimeMin % 60);
        const eteStr = totTimeMin > 0 ? `${hrs > 0 ? hrs + 'h ' : ''}${mins}m` : '—';

        // ---- Performances, carburant, masse & centrage ---------------------
        const speeds = Array.isArray(perfData.speeds) ? perfData.speeds : [];
        const normalSpeeds = speeds.filter(s => s.type === 'normal');
        const emergencySpeeds = speeds.filter(s => s.type === 'emergency');
        const wbRows = Array.isArray(perfData.wbRows) ? perfData.wbRows : [];
        let tw = 0, tm = 0;
        wbRows.forEach(r => { const w = parseFloat(r.weight) || 0, a = parseFloat(r.arm) || 0; tw += w; tm += w * a; });
        const calcCg = tw > 0 ? (tm / tw).toFixed(1) : '—';
        const mtow = perfData.profile?.mtow || 0;
        const uW = perfData.units?.weight || 'kg';
        const uA = perfData.units?.arm || 'cm';
        const uF = perfData.units?.fuel || 'L';
        const margin = mtow ? (mtow - tw).toFixed(1) : '—';
        const fuelCap = perfData.fuelCapacity || perfData.profile?.fuelCapacity || 0;
        const fuelBurn = perfData.fuelFlow || perfData.range?.fuelBurn || parseFloat(info.burn) || 0;
        const tripFuel = (totTimeMin > 0 && fuelBurn > 0) ? ((totTimeMin / 60) * fuelBurn).toFixed(1) : '—';
        const reserveFuel = fuelBurn > 0 ? (fuelBurn * 0.75).toFixed(1) : '—';
        const enduranceH = (fuelCap > 0 && fuelBurn > 0) ? (fuelCap / fuelBurn) : 0;
        const enduranceStr = enduranceH > 0 ? `${Math.floor(enduranceH)}h ${Math.round((enduranceH % 1) * 60)}m` : '—';

        // ---- Go / No-Go ----------------------------------------------------
        const imsafeItems = [
            ['Maladie', imsafe.illness || readiness.chk_imsafe_illness],
            ['Médicaments', imsafe.medication || readiness.chk_imsafe_medication],
            ['Stress', imsafe.stress || readiness.chk_imsafe_stress],
            ['Alcool', imsafe.alcohol || readiness.chk_imsafe_alcohol],
            ['Fatigue', imsafe.fatigue || readiness.chk_imsafe_fatigue],
            ['Émotions', imsafe.emotion || readiness.chk_imsafe_emotion]
        ];
        const docItems = [
            ['Licence & qualifications', docs.license || readiness.chk_doc_license],
            ['Certificat médical', docs.medical || readiness.chk_doc_medical],
            ['Documents avion (A.R.O.W.)', docs.arow || readiness.chk_doc_arow],
            ['Cartes VFR & log de nav', docs.charts || readiness.chk_doc_charts]
        ];
        const checksDone = imsafeItems.filter(i => i[1]).length + docItems.filter(i => i[1]).length;
        const checksTotal = imsafeItems.length + docItems.length;
        const isGo = checksDone === checksTotal && legs.length > 0;

        // ---- Checklists normales ------------------------------------------
        let activeChecklists = DEFAULT_NORMAL_CHECKLISTS;
        if (chkData && Array.isArray(chkData.aircraft) && chkData.aircraft.length > 0) {
            const activeAc = (chkData.activeAircraftId && chkData.aircraft.find(a => a.id === chkData.activeAircraftId)) || chkData.aircraft[0];
            if (activeAc && Array.isArray(activeAc.checklists) && activeAc.checklists.length > 0) activeChecklists = activeAc.checklists;
        } else if (chkData && Array.isArray(chkData.checklists) && chkData.checklists.length > 0) {
            activeChecklists = chkData.checklists;
        }

        // ---- Fabrique de pages ---------------------------------------------
        const head = () => `
            <header class="dsr-head">
                <div class="dsr-brand">${DSR_MARK} Altiview <em>Dossier de vol</em></div>
                <div class="dsr-meta">
                    <div><strong>${escapeHtml(callsign)}</strong> · ${escapeHtml(aircraft)} · ${escapeHtml(String(pob))} POB</div>
                    <div>${escapeHtml(dateStr)}${depTime ? ' · ' + escapeHtml(depTime) + 'Z' : ''} · CDB ${escapeHtml(pic)}</div>
                </div>
            </header>
            <div class="dsr-ticks"></div>`;
        const foot = (n) => `
            <footer class="dsr-foot">
                <span>Document de travail — vérifier AIP, NOTAM et météo officiels · généré le ${escapeHtml(generatedAt)}</span>
                <span><b>${escapeHtml(dep)} ➔ ${escapeHtml(arr)}</b> · ${n}/${totalPages}</span>
            </footer>`;
        const title = (n, t) => `<h2 class="dsr-title"><span class="n">${n}</span>${escapeHtml(t)}</h2>`;
        const tile = (k, v, unit, cls) => `<div class="dsr-tile ${cls || ''}"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(String(v))}${unit ? ` <small>${escapeHtml(unit)}</small>` : ''}</div></div>`;

        // ---- Page 1: synthèse ----------------------------------------------
        const page1 = `
            <section class="dossier-page dsr-page">
                ${head()}
                <div class="dsr-body">
                    ${title('01', 'Synthèse du vol')}
                    <div class="dsr-hero">
                        <div class="dsr-route">${escapeHtml(dep)} ➔ ${escapeHtml(arr)}
                            <small>${legs.length} branche${legs.length > 1 ? 's' : ''} · TAS ${tas} kt · vent ${windDir}° / ${windSpd} kt</small>
                        </div>
                        <div class="dsr-stamp ${isGo ? 'go' : 'nogo'}">${isGo ? 'GO' : 'NO-GO'} · ${checksDone}/${checksTotal} validés</div>
                    </div>
                    <div class="dsr-grid dsr-g4" style="margin-bottom:10px;">
                        ${tile('Distance', totDist > 0 ? totDist.toFixed(1) : '—', 'NM')}
                        ${tile('Temps de vol', eteStr, '')}
                        ${tile('Carburant vol', tripFuel, uF, 'amber')}
                        ${tile('Autonomie', enduranceStr, '', 'teal')}
                    </div>
                    <div class="dsr-grid dsr-g4" style="margin-bottom:12px;">
                        ${tile('Réserve 45 min', reserveFuel, uF)}
                        ${tile('Emport carburant', fuelCap || '—', uF)}
                        ${tile('Masse au décollage', tw > 0 ? tw.toFixed(1) : '—', uW)}
                        ${tile('Centrage', calcCg, uA)}
                    </div>

                    <div class="dsr-h3">Route</div>
                    <div class="dsr-card" style="padding:6px; margin-bottom:12px;">
                        ${generateRouteMinimapSVG(waypoints)}
                    </div>

                    <div class="dsr-grid dsr-g2">
                        <div class="dsr-card">
                            <div class="dsr-h3">Aptitude du pilote (IMSAFE)</div>
                            <div class="dsr-chipline">
                                ${imsafeItems.map(([l, v]) => `<span class="dsr-chip ${v ? 'on' : 'off'}">${v ? '✓' : '○'} ${escapeHtml(l)}</span>`).join('')}
                            </div>
                            <div class="dsr-h3" style="margin-top:9px;">Documents</div>
                            <div class="dsr-chipline">
                                ${docItems.map(([l, v]) => `<span class="dsr-chip ${v ? 'on' : 'off'}">${v ? '✓' : '○'} ${escapeHtml(l)}</span>`).join('')}
                            </div>
                        </div>
                        <div class="dsr-card">
                            <div class="dsr-h3">Notes opérationnelles</div>
                            <div style="font-size:10px; white-space:pre-wrap; min-height:52px;">${notes ? escapeHtml(notes) : '<span style="color:#8C97A2;">—</span>'}</div>
                            <div class="dsr-h3" style="margin-top:9px;">Terrains de dégagement</div>
                            <div style="font-size:10px; color:#8C97A2;">À compléter en vol : <span class="dsr-fill" style="min-width:150px;"></span></div>
                        </div>
                    </div>
                </div>
                ${foot(1)}
            </section>`;

        // ---- Page 2: log de navigation --------------------------------------
        const legRows = legs.length ? legs.map((l, i) => `
            <tr class="${i % 2 ? 'alt' : ''}">
                <td class="leg">${escapeHtml(l.from)} ➔ ${escapeHtml(l.to)}</td>
                <td class="m">${escapeHtml(String(l.alt))}</td>
                <td class="m">${String(l.tc).padStart(3, '0')}°</td>
                <td class="m"><strong>${String(l.th).padStart(3, '0')}°</strong></td>
                <td class="m">${l.dist.toFixed(1)}</td>
                <td class="m">${l.gs}</td>
                <td class="m"><strong>${l.ete}′</strong></td>
                <td class="m"><span class="dsr-fill"></span></td>
                <td class="m"><span class="dsr-fill"></span></td>
            </tr>`).join('') : `<tr><td colspan="9" style="padding:18px; text-align:center; color:#8C97A2; font-size:10.5px;">Aucune branche : tracez la route sur la carte VFR.</td></tr>`;

        const page2 = `
            <section class="dossier-page dsr-page">
                ${head()}
                <div class="dsr-body">
                    ${title('02', 'Log de navigation')}
                    <p class="dsr-note">Caps vrais calculés avec le vent saisi (${windDir}° / ${windSpd} kt) et une TAS de ${tas} kt. Les deux dernières colonnes se remplissent en vol.</p>
                    <table class="dsr-t">
                        <thead>
                            <tr>
                                <th style="width:26%;">Branche</th><th>Alt</th><th>Rv</th><th>Cap vrai</th><th>Dist</th><th>GS</th><th>ETE</th><th>Heure</th><th>Carb.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${legRows}
                            ${legs.length ? `<tr class="tot">
                                <td>Total</td><td class="m">—</td><td class="m">—</td><td class="m">—</td>
                                <td class="m">${totDist.toFixed(1)}</td><td class="m">—</td><td class="m">${eteStr}</td><td></td><td></td>
                            </tr>` : ''}
                        </tbody>
                    </table>

                    <div class="dsr-grid dsr-g3" style="margin-top:14px;">
                        <div class="dsr-card">
                            <div class="dsr-h3">Carburant</div>
                            <table class="dsr-t"><tbody>
                                <tr><td>Emport</td><td class="m" style="text-align:right;">${fuelCap || '—'} ${uF}</td></tr>
                                <tr><td>Consommation</td><td class="m" style="text-align:right;">${fuelBurn || '—'} ${uF}/h</td></tr>
                                <tr><td>Vol</td><td class="m" style="text-align:right;">${tripFuel} ${uF}</td></tr>
                                <tr><td>Réserve 45 min</td><td class="m" style="text-align:right;">${reserveFuel} ${uF}</td></tr>
                                <tr><td><strong>Au bloc</strong></td><td class="m" style="text-align:right;"><strong>${(tripFuel !== '—' && reserveFuel !== '—') ? (parseFloat(tripFuel) + parseFloat(reserveFuel)).toFixed(1) : '—'} ${uF}</strong></td></tr>
                            </tbody></table>
                        </div>
                        <div class="dsr-card">
                            <div class="dsr-h3">Masse & centrage</div>
                            <table class="dsr-t"><tbody>
                                ${wbRows.length ? wbRows.slice(0, 4).map(r => `<tr><td>${escapeHtml(r.name || r.label || 'Élément')}</td><td class="m" style="text-align:right;">${(parseFloat(r.weight) || 0).toFixed(1)} ${uW}</td></tr>`).join('') : '<tr><td colspan="2" style="color:#8C97A2;">À calculer dans Performances</td></tr>'}
                                <tr><td><strong>Masse totale</strong></td><td class="m" style="text-align:right;"><strong>${tw > 0 ? tw.toFixed(1) : '—'} ${uW}</strong></td></tr>
                                <tr><td>Centrage</td><td class="m" style="text-align:right;">${calcCg} ${uA}</td></tr>
                                <tr><td>Marge MTOW</td><td class="m" style="text-align:right;">${margin} ${uW}</td></tr>
                            </tbody></table>
                        </div>
                        <div class="dsr-card">
                            <div class="dsr-h3">Vitesses (opérations normales)</div>
                            <div class="dsr-chipline">
                                ${normalSpeeds.length ? normalSpeeds.map(s => `<span class="dsr-chip cat">${escapeHtml(s.name)} ${escapeHtml(String(s.value))} ${escapeHtml(s.unit || 'kt')}</span>`).join('') : '<span style="font-size:10px; color:#8C97A2;">À saisir dans Performances</span>'}
                            </div>
                            <div class="dsr-h3" style="margin-top:10px;">Fréquences</div>
                            <div style="font-size:9.5px; color:#8C97A2; line-height:1.9;">
                                ATIS <span class="dsr-fill"></span> · TWR <span class="dsr-fill"></span><br>
                                APP <span class="dsr-fill"></span> · SIV <span class="dsr-fill"></span>
                            </div>
                        </div>
                    </div>
                </div>
                ${foot(2)}
            </section>`;

        // ---- Page 3: météo ---------------------------------------------------
        const monitored = Array.isArray(airportsWx) ? airportsWx : [];
        const wxCards = monitored.length ? monitored.map(apt => {
            const d = apt.decoded || {};
            const cat = apt.flightCategory || '—';
            const catCls = cat === 'VFR' ? 'cat' : (cat === 'MVFR' ? 'amber' : 'red');
            const wind = (d.wdir !== undefined && d.wdir !== null) ? `${d.wdir}° / ${d.wspd} kt${d.wgst ? ' raf. ' + d.wgst + ' kt' : ''}` : '—';
            const vis = d.vis || (d.isCavok ? 'CAVOK' : '—');
            const clouds = (d.clouds && d.clouds.length) ? d.clouds.map(c => `${c.cover}${Math.round(c.base / 100).toString().padStart(3, '0')}`).join(' ') : (d.isCavok ? 'Nil' : '—');
            const temps = (d.temp !== undefined && d.temp !== null) ? `${d.temp}° / ${d.dewp}°` : '—';
            const qnh = d.qnh ? `${d.qnh} hPa` : '—';
            const age = apt.updatedAt ? new Date(apt.updatedAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—';
            return `
                <div class="dsr-wx">
                    <div class="dsr-wx-head">
                        <div class="dsr-wx-icao">${escapeHtml(apt.icao || '')}<span>${escapeHtml(apt.name || '')}</span></div>
                        <div class="dsr-chipline">
                            <span class="dsr-chip ${catCls}">${escapeHtml(cat)}</span>
                            <span class="dsr-chip">${escapeHtml(apt.source || 'source ?')} · ${escapeHtml(age)}</span>
                        </div>
                    </div>
                    <div class="dsr-grid dsr-g4" style="margin-bottom:7px;">
                        ${tile('Vent', wind, '')}${tile('Visibilité', vis, '')}${tile('Nuages', clouds, '')}${tile('T / Td · QNH', temps + ' · ' + qnh, '')}
                    </div>
                    ${apt.metar ? `<div class="dsr-raw">${escapeHtml(apt.metar)}</div>` : ''}
                    ${apt.taf ? `<div class="dsr-raw" style="margin-top:5px; border-left-color:var(--amber);">${escapeHtml(apt.taf)}</div>` : ''}
                </div>`;
        }).join('') : `<div class="dsr-empty">Aucun terrain suivi. Ajoutez les codes OACI (départ, destination, dégagements) dans l'onglet Météo de la préparation.</div>`;

        const page3 = `
            <section class="dossier-page dsr-page">
                ${head()}
                <div class="dsr-body">
                    ${title('03', 'Météo — METAR & TAF')}
                    <p class="dsr-note">Relevés tels que reçus lors de la dernière actualisation. Revérifiez juste avant le départ : un METAR se périme en 30 à 60 minutes.</p>
                    ${wxCards}
                </div>
                ${foot(3)}
            </section>`;

        // ---- Page 4: NOTAM ---------------------------------------------------
        const notamGroups = (Array.isArray(notamsData) ? notamsData : []).filter(g => g && g.icao);
        const notamHtml = notamGroups.length ? notamGroups.map(g => {
            const list = Array.isArray(g.notams) ? g.notams : [];
            return `
                <div style="margin-bottom:11px;">
                    <div class="dsr-wx-head" style="border-bottom:1px solid var(--hair); padding-bottom:4px;">
                        <div class="dsr-wx-icao">${escapeHtml(g.icao)}<span>${escapeHtml(g.name || '')}</span></div>
                        <span class="dsr-chip">${list.length} NOTAM</span>
                    </div>
                    ${list.length ? list.slice(0, 8).map(n => {
                        const sev = n.severity === 'critical' ? 'crit' : (n.severity === 'warning' ? 'warn' : '');
                        const from = n.startDate ? new Date(n.startDate).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
                        const to = n.isPerm ? 'PERMANENT' : (n.endDate ? new Date(n.endDate).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
                        const vert = (n.lowerLimit || n.upperLimit) ? ` · ${escapeHtml(n.lowerLimit || 'SFC')} ➔ ${escapeHtml(n.upperLimit || 'UNL')}` : '';
                        return `
                            <div class="dsr-nt ${sev}">
                                <div class="dsr-nt-head">
                                    <span class="dsr-nt-id">${escapeHtml(n.id || '')}</span>
                                    ${n.title ? `<span class="dsr-chip ${sev === 'crit' ? 'red' : (sev === 'warn' ? 'amber' : '')}">${escapeHtml(n.title)}</span>` : ''}
                                </div>
                                <div class="dsr-nt-val">Du ${escapeHtml(from)} au ${escapeHtml(to)}${vert}${n.schedule ? ' · ' + escapeHtml(n.schedule) : ''}</div>
                                <div class="dsr-nt-txt">${escapeHtml((n.text || n.raw || '').slice(0, 420))}</div>
                            </div>`;
                    }).join('') : '<div class="dsr-empty" style="padding:10px;">Aucun NOTAM actif enregistré pour ce terrain.</div>'}
                    ${list.length > 8 ? `<div class="dsr-note">+ ${list.length - 8} NOTAM supplémentaires — voir le briefing complet.</div>` : ''}
                </div>`;
        }).join('') : `<div class="dsr-empty">Aucun NOTAM chargé. Importez-les depuis l'onglet NOTAM de la préparation (chargement automatique ou copier-coller du briefing officiel).</div>`;

        const page4 = `
            <section class="dossier-page dsr-page">
                ${head()}
                <div class="dsr-body">
                    ${title('04', 'NOTAM')}
                    <p class="dsr-note">Avis aux navigateurs pour les terrains du vol. Ce dossier ne remplace pas le briefing officiel : contrôlez les NOTAM le jour du vol.</p>
                    ${notamHtml}
                </div>
                ${foot(4)}
            </section>`;

        // ---- Page 5: checklists normales -------------------------------------
        const page5 = `
            <section class="dossier-page dsr-page">
                ${head()}
                <div class="dsr-body">
                    ${title('05', 'Checklists normales')}
                    <p class="dsr-note">Checklists de l'avion actif, dans l'ordre du vol.</p>
                    <div class="dsr-cols">
                        ${activeChecklists.map((chk, idx) => `
                            <div class="dsr-chk">
                                <h4>${String(idx + 1).padStart(2, '0')} · ${escapeHtml(chk.title)}</h4>
                                <ul>
                                    ${(chk.items || []).map(item => `<li><span>${escapeHtml(item.text)}</span><b>${escapeHtml(item.value || 'CHECK')}</b></li>`).join('')}
                                </ul>
                            </div>`).join('')}
                    </div>
                </div>
                ${foot(5)}
            </section>`;

        // ---- Page 6: urgences -------------------------------------------------
        const lights = [
            ['#2E8B57', false, 'Vert fixe', 'Autorisé à décoller', 'Autorisé à atterrir'],
            ['#2E8B57', true, 'Vert clignotant', 'Autorisé à circuler', 'Revenez pour atterrir *'],
            ['#B3123A', false, 'Rouge fixe', 'Arrêtez', 'Cédez le passage et continuez à tourner'],
            ['#B3123A', true, 'Rouge clignotant', "Dégagez l'aire d'atterrissage", "Aérodrome dangereux, n'atterrissez pas"],
            ['#FFFFFF', true, 'Blanc clignotant', 'Retournez au point de départ', "Atterrissez ici et gagnez l'aire de trafic *"],
            ['#D34D2E', false, 'Artifice rouge', '—', "N'atterrissez pas pour le moment"]
        ];
        const page6 = `
            <section class="dossier-page dsr-page dsr-tight">
                ${head()}
                <div class="dsr-body">
                    ${title("06", "Urgences & références")}
                    <div class="dsr-card" style="border-color:var(--red); border-left:4px solid var(--red); margin-bottom:11px;">
                        <div class="dsr-h3" style="color:var(--red);">Vitesses critiques</div>
                        <div class="dsr-chipline">
                            ${emergencySpeeds.length ? emergencySpeeds.map(s => `<span class="dsr-chip red">${escapeHtml(s.name)} ${escapeHtml(String(s.value))} ${escapeHtml(s.unit || 'kt')}</span>`).join('') : '<span style="font-size:10px; color:#8C97A2;">À saisir dans Performances</span>'}
                        </div>
                    </div>

                    <div class="dsr-cols" style="margin-bottom:10px;">
                        ${DEFAULT_EMERGENCY_CHECKLISTS.map(chk => `
                            <div class="dsr-chk emg">
                                <h4>${escapeHtml(chk.title)}</h4>
                                <ul>
                                    ${chk.items.map(item => `<li><span>${escapeHtml(item.text)}</span><b>${escapeHtml(item.value)}</b></li>`).join('')}
                                </ul>
                            </div>`).join('')}
                    </div>

                    <div class="dsr-grid dsr-g2">
                        <div class="dsr-card">
                            <div class="dsr-h3">Codes transpondeur</div>
                            <table class="dsr-t"><tbody>
                                <tr><td class="m"><strong>7700</strong></td><td>Urgence générale (MAYDAY / PAN-PAN)</td></tr>
                                <tr><td class="m"><strong>7600</strong></td><td>Panne radio</td></tr>
                                <tr><td class="m"><strong>7500</strong></td><td>Intervention illicite</td></tr>
                                <tr><td class="m">7000</td><td>VFR par défaut (Europe)</td></tr>
                            </tbody></table>
                            <div class="dsr-h3" style="margin-top:9px;">Fréquences de détresse</div>
                            <div style="font-size:10px;">121.500 MHz · 243.000 MHz · ELT 406 MHz</div>
                        </div>
                        <div class="dsr-card">
                            <div class="dsr-h3">Signaux lumineux (panne radio)</div>
                            <table class="dsr-t">
                                <thead><tr><th>Signal</th><th>Au sol</th><th>En vol</th></tr></thead>
                                <tbody>
                                    ${lights.map(([c, blink, label, ground, air]) => `
                                        <tr>
                                            <td style="white-space:nowrap;"><span class="dsr-sig" style="background:${c};"></span>${escapeHtml(label)}${blink ? '' : ''}</td>
                                            <td>${escapeHtml(ground)}</td>
                                            <td>${escapeHtml(air)}</td>
                                        </tr>`).join('')}
                                </tbody>
                            </table>
                            <div class="dsr-note" style="margin:6px 0 0;">* Les autorisations d'atterrir et de circuler sont données en temps utile. Accusé de réception : de jour, balancer les ailes ; de nuit, allumer et éteindre deux fois les phares.</div>
                        </div>
                    </div>
                </div>
                ${foot(6)}
            </section>`;

        return `<div id="dossierPrintContainer" class="dsr">${dossierStyles()}${page1}${page2}${page3}${page4}${page5}${page6}</div>`;
    }

    // ==========================================
    // PREVIEW MODAL & EXPORT ACTIONS
    // ==========================================
    function ensureModalExists() {
        if (document.getElementById('flightDossierModal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'flightDossierModal';
        modalDiv.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.65);
            z-index: 99999;
            align-items: center;
            justify-content: center;
            padding: 20px;
            backdrop-filter: blur(4px);
        `;

        modalDiv.innerHTML = `
            <div style="background: var(--card-bg, #fff); color: var(--text-color, #111); border: 2px solid var(--border-color, #111); border-radius: 8px; width: 100%; max-width: 900px; max-height: 94vh; display: flex; flex-direction: column; box-shadow: 0 16px 40px rgba(0,0,0,0.35); overflow: hidden;">
                <!-- Header Toolbar -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 2px solid var(--border-color, #111); background: var(--bg-color, #f6f4f0);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;"></span>
                        <div>
                            <div style="font-size: 15px; font-weight: 800; text-transform: uppercase;">Dossier de vol</div>
                            <div style="font-size: 11px; color: var(--muted-text, #666);">PrÃªt Ã  imprimer Â· 6 pages Â· kneeboard A5/A4</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button id="dossierPrintBtn" class="btn-action" style="padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--border-color, #111); border-radius: 4px; background: var(--card-bg, #fff); color: var(--text-color, #111);">
                            Print / Save as PDF
                        </button>
                        <button id="dossierDownloadBtn" class="btn-action primary" style="padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--border-color, #111); border-radius: 4px; background: var(--border-color, #111); color: var(--bg-color, #fff);">
                            Download PDF
                        </button>
                        <button id="dossierCloseBtn" style="padding: 5px 10px; font-size: 16px; border: 1px solid var(--border-color, #111); border-radius: 4px; background: transparent; cursor: pointer; margin-left: 6px; color: var(--text-color, #111);">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Preview Body (Scrollable) -->
                <div id="dossierModalBody" style="padding: 24px; overflow-y: auto; background: #525659; flex: 1;">
                    <!-- Injected at runtime -->
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        // Bind modal events
        document.getElementById('dossierCloseBtn').addEventListener('click', closeDossierModal);
        modalDiv.addEventListener('click', e => {
            if (e.target === modalDiv) closeDossierModal();
        });

        document.getElementById('dossierPrintBtn').addEventListener('click', () => {
            const printContent = document.getElementById('dossierPrintContainer');
            if (!printContent) return;

            // Create temporary iframe for clean printing
            const printFrame = document.createElement('iframe');
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            document.body.appendChild(printFrame);

            const doc = printFrame.contentWindow.document;
            doc.open();
            doc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Dossier de vol Altiview</title>
                    <style>
                        @page { size: A4 portrait; margin: 0.2in; }
                        body { margin: 0; padding: 0; background: #fff; font-family: 'Inter', -apple-system, sans-serif; }
                        .dossier-page { page-break-after: always; min-height: 98vh; box-sizing: border-box; }
                        .dossier-page:last-child { page-break-after: avoid; }
                    </style>
                </head>
                <body>
                    ${printContent.outerHTML}
                </body>
                </html>
            `);
            doc.close();

            printFrame.contentWindow.focus();
            setTimeout(() => {
                printFrame.contentWindow.print();
                setTimeout(() => printFrame.remove(), 1000);
            }, 500);
        });

        document.getElementById('dossierDownloadBtn').addEventListener('click', () => {
            const container = document.getElementById('dossierPrintContainer');
            if (!container) return;

            const dlBtn = document.getElementById('dossierDownloadBtn');
            const origText = dlBtn.innerHTML;
            dlBtn.innerHTML = '⏳ Generating PDF...';
            dlBtn.disabled = true;

            const info = JSON.parse(localStorage.getItem(INFO_KEY) || '{}');
            const filename = `Dossier_de_vol_${info.flightNumber && info.flightNumber !== 'N/A' ? info.flightNumber : 'Flight'}_${new Date().toISOString().split('T')[0]}.pdf`;

            if (typeof window.html2pdf === 'function') {
                const opt = {
                    margin: [0.15, 0.15, 0.15, 0.15],
                    filename: filename,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'], after: '.dossier-page' }
                };

                window.html2pdf().set(opt).from(container).save().then(() => {
                    dlBtn.innerHTML = origText;
                    dlBtn.disabled = false;
                }).catch(err => {
                    console.error("PDF generation failed:", err);
                    alert("Could not generate PDF directly. Opening print dialog instead.");
                    dlBtn.innerHTML = origText;
                    dlBtn.disabled = false;
                    window.print();
                });
            } else {
                alert("Opening print dialog to Save as PDF...");
                dlBtn.innerHTML = origText;
                dlBtn.disabled = false;
                window.print();
            }
        });
    }

    function openDossierModal() {
        ensureModalExists();
        const bodyEl = document.getElementById('dossierModalBody');
        if (bodyEl) {
            bodyEl.innerHTML = buildDossierHtml();
        }
        const modal = document.getElementById('flightDossierModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    function closeDossierModal() {
        const modal = document.getElementById('flightDossierModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function injectDefaultStyles() {
        if (document.getElementById('flightDossierDefaultStyles')) return;
        const style = document.createElement('style');
        style.id = 'flightDossierDefaultStyles';
        style.textContent = `
            .sidebar-export-wrap {
                padding: 20px 25px;
                box-sizing: border-box;
            }
            .btn-export-bw, .btn-export-dossier {
                background-color: var(--text-color, #111);
                color: var(--bg-color, #fff);
                border: 2px solid var(--text-color, #111);
                padding: 13px 16px;
                font-size: 13px;
                font-weight: 700;
                font-family: 'Inter', sans-serif;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                width: 100%;
                box-sizing: border-box;
            }
            .btn-export-bw:hover, .btn-export-dossier:hover {
                background-color: transparent;
                color: var(--text-color, #111);
            }
            .btn-export-bw:disabled, .btn-export-dossier:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    // Export to global scope
    window.FlightDossier = {
        open: openDossierModal,
        close: closeDossierModal,
        generateHtml: buildDossierHtml
    };

    // Auto-bind any button with id="exportFlightDocBtn" or class="btn-export-dossier"
    function bindButtons() {
        injectDefaultStyles();
        document.querySelectorAll('#exportFlightDocBtn, .btn-export-dossier, #exportFullDossierBtn').forEach(btn => {
            if (!btn.dataset.dossierBound) {
                btn.dataset.dossierBound = 'true';
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openDossierModal();
                });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindButtons);
    } else {
        bindButtons();
    }

})();
