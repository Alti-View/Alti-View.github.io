(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.AltiviewPerformance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const KG_TO_LBS = 2.2046226218;
    const CM_TO_IN = 0.3937007874;
    const L_TO_USG = 0.2641720524;

    const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const nonNegative = value => Math.max(0, finite(value));

    function fuelDensity(weightUnit = 'kg', fuelUnit = 'L', kgPerLitre = 0.72) {
        const perLitre = nonNegative(kgPerLitre) * (weightUnit === 'lbs' ? KG_TO_LBS : 1);
        return fuelUnit === 'USG' ? perLitre / L_TO_USG : perLitre;
    }

    function calculateRange(input) {
        const fuelOnBoard = nonNegative(input.fuelOnBoard);
        const fuelCapacity = nonNegative(input.fuelCapacity);
        const burn = nonNegative(input.burnPerHour);
        const taxi = nonNegative(input.taxiFuel);
        const reserveMinutes = nonNegative(input.reserveMinutes);
        const tas = nonNegative(input.tas);
        const reserveFuel = burn * reserveMinutes / 60;
        const tripFuelAvailable = Math.max(0, fuelOnBoard - taxi - reserveFuel);
        const enduranceHours = burn > 0 ? tripFuelAvailable / burn : 0;
        const issues = [];
        if (burn <= 0) issues.push('burn');
        if (fuelCapacity > 0 && fuelOnBoard > fuelCapacity + 1e-9) issues.push('capacity');
        if (fuelOnBoard + 1e-9 < taxi + reserveFuel) issues.push('reserve');
        return {
            fuelOnBoard, fuelCapacity, burn, taxi, reserveMinutes, reserveFuel,
            tripFuelAvailable, enduranceHours, rangeNm: enduranceHours * tas, tas, issues
        };
    }

    function calculateFuelPlan(input) {
        const fuelOnBoard = nonNegative(input.fuelOnBoard);
        const fuelCapacity = nonNegative(input.fuelCapacity);
        const burn = nonNegative(input.burnPerHour);
        const taxiFuel = nonNegative(input.taxiFuel);
        const tripMinutes = nonNegative(input.tripMinutes);
        const climbMinutes = nonNegative(input.climbMinutes);
        const climbExtraRatio = nonNegative(input.climbExtraRatio);
        const alternateMinutes = nonNegative(input.alternateMinutes);
        const reserveMinutes = nonNegative(input.reserveMinutes);
        const climbExtraFuel = burn * climbMinutes / 60 * climbExtraRatio;
        const tripFuel = burn * tripMinutes / 60;
        const alternateFuel = burn * alternateMinutes / 60;
        const reserveFuel = burn * reserveMinutes / 60;
        const requiredBlockFuel = taxiFuel + climbExtraFuel + tripFuel + alternateFuel + reserveFuel;
        const expectedBurnToDestination = taxiFuel + climbExtraFuel + tripFuel;
        const issues = [];
        if (burn <= 0) issues.push('burn');
        if (tripMinutes <= 0) issues.push('route');
        if (fuelCapacity > 0 && fuelOnBoard > fuelCapacity + 1e-9) issues.push('capacity');
        if (requiredBlockFuel > fuelOnBoard + 1e-9) issues.push('shortfall');
        return {
            fuelOnBoard, fuelCapacity, burn, taxiFuel, tripMinutes, climbMinutes,
            climbExtraRatio, alternateMinutes, reserveMinutes, climbExtraFuel,
            tripFuel, alternateFuel, reserveFuel, requiredBlockFuel,
            expectedBurnToDestination, remainingFuel: fuelOnBoard - requiredBlockFuel, issues
        };
    }

    function stageFrom(weight, moment) {
        return { weight, moment, cg: weight > 0 ? moment / weight : 0 };
    }

    function calculateWeightBalance(input) {
        const rows = Array.isArray(input.rows) ? input.rows : [];
        let rampWeight = 0;
        let rampMoment = 0;
        let fuelWeight = 0;
        let fuelMoment = 0;
        const issues = [];

        for (const row of rows) {
            const weight = finite(row.weight);
            const arm = finite(row.arm);
            if (weight < 0) issues.push('negative-weight');
            const acceptedWeight = Math.max(0, weight);
            rampWeight += acceptedWeight;
            rampMoment += acceptedWeight * arm;
            if (row.linkedFuel) {
                fuelWeight += acceptedWeight;
                fuelMoment += acceptedWeight * arm;
            }
        }

        const averageFuelArm = fuelWeight > 0 ? fuelMoment / fuelWeight : 0;
        const density = nonNegative(input.fuelDensity);
        const removeFuel = volume => {
            const requestedMass = nonNegative(volume) * density;
            const removedMass = Math.min(fuelWeight, requestedMass);
            return { mass: removedMass, moment: removedMass * averageFuelArm };
        };
        const taxi = removeFuel(input.taxiFuel);
        const destination = removeFuel(nonNegative(input.expectedBurnToDestination));
        const ramp = stageFrom(rampWeight, rampMoment);
        const takeoff = stageFrom(rampWeight - taxi.mass, rampMoment - taxi.moment);
        const landing = input.hasRoute
            ? stageFrom(rampWeight - destination.mass, rampMoment - destination.moment)
            : null;
        const zeroFuel = stageFrom(rampWeight - fuelWeight, rampMoment - fuelMoment);

        const fwd = finite(input.fwdLimit);
        const aft = finite(input.aftLimit);
        const mtow = nonNegative(input.mtow);
        const mlw = nonNegative(input.mlw);
        const envelopeValid = fwd > 0 && aft > fwd;
        const inEnvelope = stage => !!stage && stage.weight > 0 && envelopeValid && stage.cg >= fwd && stage.cg <= aft;
        const checks = {
            rampEnvelope: inEnvelope(ramp),
            takeoffEnvelope: inEnvelope(takeoff),
            zeroFuelEnvelope: inEnvelope(zeroFuel),
            landingEnvelope: landing ? inEnvelope(landing) : null,
            mtow: mtow > 0 && takeoff.weight <= mtow + 1e-9,
            mlw: landing ? (mlw > 0 && landing.weight <= mlw + 1e-9) : null
        };
        if (!envelopeValid) issues.push('envelope');
        if (!checks.mtow) issues.push('mtow');
        if (checks.mlw === false) issues.push('mlw');
        if (!checks.rampEnvelope || !checks.takeoffEnvelope || !checks.zeroFuelEnvelope || checks.landingEnvelope === false) issues.push('cg');
        if (destination.mass + 1e-9 < nonNegative(input.expectedBurnToDestination) * density) issues.push('fuel-burn');

        return {
            ramp, takeoff, landing, zeroFuel, fuelWeight, averageFuelArm, checks, issues,
            mtowMargin: mtow - takeoff.weight,
            mlwMargin: landing ? mlw - landing.weight : null,
            ok: issues.length === 0
        };
    }

    function calculateAtmosphere(input) {
        const elevationFt = finite(input.elevationFt);
        const qnhHpa = finite(input.qnhHpa) || 1013.25;
        const temperatureC = finite(input.temperatureC);
        const windSpeedKt = nonNegative(input.windSpeedKt);
        const windAngleDeg = Math.min(180, Math.abs(finite(input.windAngleDeg)));
        const pressureAltitudeFt = elevationFt + (1013.25 - qnhHpa) * 27;
        const isaTemperatureC = 15 - 1.9812 * pressureAltitudeFt / 1000;
        const densityAltitudeFt = pressureAltitudeFt + 120 * (temperatureC - isaTemperatureC);
        const radians = windAngleDeg * Math.PI / 180;
        const headwindKt = windSpeedKt * Math.cos(radians);
        const crosswindKt = Math.abs(windSpeedKt * Math.sin(radians));
        return { pressureAltitudeFt, isaTemperatureC, densityAltitudeFt, headwindKt, crosswindKt };
    }

    return {
        KG_TO_LBS, CM_TO_IN, L_TO_USG, fuelDensity,
        calculateRange, calculateFuelPlan, calculateWeightBalance, calculateAtmosphere
    };
});
