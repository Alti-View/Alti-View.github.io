const { test } = require('node:test');
const assert = require('node:assert/strict');
const perf = require('../assets/performance-calculations.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('fuel density conversions preserve the same physical mass', () => {
    assert(Math.abs(perf.fuelDensity('kg', 'L') - 0.72) < 1e-12);
    assert(Math.abs(perf.fuelDensity('lbs', 'USG') - 6.008691) < 1e-5);
});

test('range removes taxi and final reserve exactly once', () => {
    const r = perf.calculateRange({ fuelOnBoard: 100, fuelCapacity: 120, burnPerHour: 20, taxiFuel: 5, reserveMinutes: 45, tas: 100 });
    assert.equal(r.reserveFuel, 15);
    assert.equal(r.tripFuelAvailable, 80);
    assert.equal(r.enduranceHours, 4);
    assert.equal(r.rangeNm, 400);
    assert.deepEqual(r.issues, []);
});

test('fuel plan distinguishes tank capacity, fuel on board, trip and reserves', () => {
    const p = perf.calculateFuelPlan({ fuelOnBoard: 80, fuelCapacity: 100, burnPerHour: 24, taxiFuel: 3, tripMinutes: 90, climbMinutes: 8, climbExtraRatio: .25, alternateMinutes: 20, reserveMinutes: 30 });
    assert.equal(p.tripFuel, 36);
    assert.equal(p.climbExtraFuel, 0.8);
    assert.equal(p.alternateFuel, 8);
    assert.equal(p.reserveFuel, 12);
    assert.equal(p.requiredBlockFuel, 59.8);
    assert(!p.issues.includes('shortfall'));
});

test('weight and balance checks taxi-adjusted takeoff mass and landing MLW', () => {
    const result = perf.calculateWeightBalance({
        rows: [
            { weight: 900, arm: 100 },
            { weight: 100, arm: 120, linkedFuel: true }
        ],
        fuelDensity: 1,
        taxiFuel: 10,
        expectedBurnToDestination: 60,
        hasRoute: true,
        mtow: 995,
        mlw: 945,
        fwdLimit: 90,
        aftLimit: 110
    });
    assert.equal(result.ramp.weight, 1000);
    assert.equal(result.takeoff.weight, 990);
    assert.equal(result.landing.weight, 940);
    assert.equal(result.zeroFuel.weight, 900);
    assert.equal(result.checks.mtow, true);
    assert.equal(result.checks.mlw, true);
    assert.equal(result.ok, true);
});

test('weight and balance reports MLW and CG failures', () => {
    const result = perf.calculateWeightBalance({
        rows: [{ weight: 900, arm: 80 }, { weight: 100, arm: 120, linkedFuel: true }],
        fuelDensity: 1, taxiFuel: 0, expectedBurnToDestination: 20, hasRoute: true,
        mtow: 1100, mlw: 950, fwdLimit: 90, aftLimit: 110
    });
    assert.equal(result.checks.mlw, false);
    assert(result.issues.includes('mlw'));
    assert(result.issues.includes('cg'));
});

test('standard atmosphere and wind components use signed headwind', () => {
    const sea = perf.calculateAtmosphere({ elevationFt: 0, qnhHpa: 1013.25, temperatureC: 15, windSpeedKt: 20, windAngleDeg: 0 });
    assert(Math.abs(sea.densityAltitudeFt) < 1e-9);
    assert(Math.abs(sea.headwindKt - 20) < 1e-9);
    const tail = perf.calculateAtmosphere({ elevationFt: 0, qnhHpa: 1013.25, temperatureC: 15, windSpeedKt: 20, windAngleDeg: 180 });
    assert(Math.abs(tail.headwindKt + 20) < 1e-9);
    assert(Math.abs(tail.crosswindKt) < 1e-9);
});

test('aircraft profiles preserve and performance state restores the empty-weight row', () => {
    const root = path.resolve(__dirname, '..');
    const profiles = fs.readFileSync(path.join(root, 'aircraft_profiles.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'perfo.html'), 'utf8');
    assert.match(profiles, /linkedEmpty: !!r\.linkedEmpty/);
    assert.match(html, /wbRows\.unshift\(\{[\s\S]*?name: 'Masse à vide'[\s\S]*?linkedEmpty: true/);
});

test('performance PDF keeps its content and reuses the flight dossier design system', () => {
    const root = path.resolve(__dirname, '..');
    const html = fs.readFileSync(path.join(root, 'perfo.html'), 'utf8');
    const dossier = fs.readFileSync(path.join(root, 'flight_dossier.js'), 'utf8');
    assert.match(html, /id="exportPdfBtn"[\s\S]*?Export PDF/);
    assert.match(html, /FlightDossier\.getDocumentStyles\(\)/);
    assert.match(html, /FlightDossier\.getDocumentMark\(\)/);
    assert.match(html, /buildPerformancePdfHtml\(\)/);
    assert.match(html, /_Performances_/);
    assert.doesNotMatch(html, /FlightDossier\.open\(\)/);
    assert.match(dossier, /getDocumentStyles: dossierStyles/);
    assert.match(dossier, /getDocumentMark: \(\) => DSR_MARK/);
});

test('every performance page inline script parses', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'perfo.html'), 'utf8');
    for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
        new vm.Script(match[1]);
    }
});
