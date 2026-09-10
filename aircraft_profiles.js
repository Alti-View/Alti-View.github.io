// aircraft_profiles.js — FlightPrep Solution Aircraft Profile Management & Synchronization Engine
// Version: 1.0.0

(function(global) {
    'use strict';

    const SCHEMA_VERSION = '1.0';
    const PERF_STORAGE_KEY = 'flightprep_perf_data_v10';
    const BRIEFING_STORAGE_KEY = 'flightprep_info_v1';
    const MAP_STORAGE_KEY = 'flightprep_map_data_v11';
    const CHK_STORAGE_KEY = 'flightprep_checklists_data_v2';

    // -------------------------------------------------------------
    // 1. CURATED REAL-WORLD AIRCRAFT PRESETS
    // -------------------------------------------------------------
    const AIRCRAFT_PRESETS = {
        'c172': {
            schemaVersion: SCHEMA_VERSION,
            id: 'c172_skyhawk',
            name: 'Cessna 172S Skyhawk SP',
            type: 'C172',
            model: 'Cessna 172S Skyhawk',
            reg: 'F-HVGN',
            description: '180 HP Lycoming IO-360-L2A, 4-seat touring aircraft with Garmin avionics.',
            units: { weight: 'kg', arm: 'cm', fuel: 'L' },
            profile: {
                reg: 'F-HVGN',
                type: 'C172',
                emptyWeight: 744,
                emptyArm: 98.0,
                mtow: 1157,
                mlw: 1157,
                fuelCapacity: 201
            },
            speeds: [
                { name: 'Vs0', value: 40, unit: 'kt', desc: 'Stall speed (Full Flaps 30°)', type: 'normal' },
                { name: 'Vs1', value: 48, unit: 'kt', desc: 'Stall speed clean (Flaps 0°)', type: 'normal' },
                { name: 'Vr', value: 55, unit: 'kt', desc: 'Rotation speed', type: 'normal' },
                { name: 'Vx', value: 62, unit: 'kt', desc: 'Best angle of climb', type: 'normal' },
                { name: 'Vy', value: 74, unit: 'kt', desc: 'Best rate of climb', type: 'normal' },
                { name: 'Vfe', value: 85, unit: 'kt', desc: 'Max flap extended (Flaps 10-30°)', type: 'normal' },
                { name: 'Va', value: 105, unit: 'kt', desc: 'Maneuvering speed (at MTOW)', type: 'normal' },
                { name: 'Vno', value: 129, unit: 'kt', desc: 'Max structural cruising', type: 'normal' },
                { name: 'Vne', value: 163, unit: 'kt', desc: 'Never exceed speed', type: 'normal' },
                { name: 'Vc', value: 115, unit: 'kt', desc: 'Normal cruise TAS @ 75%', type: 'normal' },
                { name: 'Vapp', value: 65, unit: 'kt', desc: 'Final approach speed (Flaps 30°)', type: 'normal' },
                { name: 'Vg', value: 68, unit: 'kt', desc: 'Best glide speed (Max L/D)', type: 'emergency' },
                { name: 'Vforced', value: 65, unit: 'kt', desc: 'Forced landing without power', type: 'emergency' },
                { name: 'Vshort_to', value: 56, unit: 'kt', desc: 'Short-field takeoff speed', type: 'special' },
                { name: 'Vshort_ldg', value: 61, unit: 'kt', desc: 'Short-field landing speed', type: 'special' }
            ],
            range: {
                fuelOnBoard: 180,
                fuelBurn: 38,
                reserveMin: 45,
                cruiseTas: 'Vc',
                taxiFuel: 6
            },
            limits: { fwd: 89.0, aft: 120.0 },
            wbRows: [
                { id: 'pilot_front', name: 'Pilot + Front Pax', weight: 160, arm: 94.0, linkedFuel: false },
                { id: 'rear_pax', name: 'Rear Passengers', weight: 0, arm: 185.0, linkedFuel: false },
                { id: 'baggage_1', name: 'Baggage Area 1 (Max 54 kg)', weight: 15, arm: 241.0, linkedFuel: false },
                { id: 'baggage_2', name: 'Baggage Area 2 (Max 23 kg)', weight: 0, arm: 312.0, linkedFuel: false },
                { id: 'fuel_tanks', name: 'Usable Fuel Tanks', weight: 129.6, arm: 122.0, linkedFuel: true }
            ],
            checklists: [
                {
                    title: 'Pre-Flight Inspection',
                    items: [
                        { task: 'Control Locks', action: 'REMOVED' },
                        { task: 'Ignition Switch', action: 'OFF' },
                        { task: 'Master Switch', action: 'ON' },
                        { task: 'Fuel Quantity Indicators', action: 'CHECK' },
                        { task: 'Flaps', action: 'EXTEND FULL' },
                        { task: 'Master Switch', action: 'OFF' },
                        { task: 'Fuel Strainer / Sump', action: 'DRAINED & CHECKED' }
                    ]
                },
                {
                    title: 'Engine Start',
                    items: [
                        { task: 'Pre-Flight Inspection', action: 'COMPLETED' },
                        { task: 'Passenger Briefing', action: 'COMPLETED' },
                        { task: 'Brakes', action: 'TEST & SET' },
                        { task: 'Circuit Breakers', action: 'IN' },
                        { task: 'Beacon', action: 'ON' },
                        { task: 'Aux Fuel Pump', action: 'ON (PRIME 3-5 SEC) THEN OFF' },
                        { task: 'Propeller Area', action: 'CLEAR' },
                        { task: 'Ignition Switch', action: 'START' },
                        { task: 'Oil Pressure', action: 'CHECK GREEN WITHIN 30S' }
                    ]
                },
                {
                    title: 'Before Takeoff (Run-up)',
                    items: [
                        { task: 'Parking Brake', action: 'SET' },
                        { task: 'Cabin Doors & Windows', action: 'CLOSED & LATCHED' },
                        { task: 'Flight Controls', action: 'FREE & CORRECT' },
                        { task: 'Flight Instruments', action: 'CHECK & SET QNH' },
                        { task: 'Fuel Selector', action: 'BOTH' },
                        { task: 'Throttle', action: '1800 RPM' },
                        { task: 'Magnetos', action: 'CHECK (MAX DROP 150 RPM, DIFF 50)' },
                        { task: 'Carb Heat / Engine Gauges', action: 'CHECK GREEN' },
                        { task: 'Throttle', action: 'IDLE (650-750 RPM) THEN 1000 RPM' },
                        { task: 'Trim', action: 'SET TAKEOFF' },
                        { task: 'Flaps', action: 'SET 0° TO 10°' }
                    ]
                },
                {
                    title: 'Emergency: Engine Failure in Flight',
                    items: [
                        { task: 'Airspeed', action: '68 KIAS (BEST GLIDE)' },
                        { task: 'Landing Site', action: 'SELECT & HEAD TOWARDS' },
                        { task: 'Fuel Selector', action: 'BOTH' },
                        { task: 'Aux Fuel Pump', action: 'ON' },
                        { task: 'Mixture', action: 'RICH' },
                        { task: 'Ignition Switch', action: 'BOTH (OR START)' },
                        { task: 'Transponder', action: 'SQUAWK 7700' },
                        { task: 'Mayday Call', action: 'TRANSMIT 121.500 MHZ' }
                    ]
                }
            ]
        },

        'dr400': {
            schemaVersion: SCHEMA_VERSION,
            id: 'dr400_dauphin',
            name: 'Robin DR400-120 Dauphin 2+2',
            type: 'DR400',
            model: 'Robin DR400/120',
            reg: 'F-GKQX',
            description: '118 HP Lycoming O-235, high-efficiency French wooden airframe, outstanding forward visibility.',
            units: { weight: 'kg', arm: 'cm', fuel: 'L' },
            profile: {
                reg: 'F-GKQX',
                type: 'DR400',
                emptyWeight: 560,
                emptyArm: 38.0,
                mtow: 900,
                mlw: 900,
                fuelCapacity: 110
            },
            speeds: [
                { name: 'Vs0', value: 46, unit: 'kt', desc: 'Stall speed landing config (Flaps 2)', type: 'normal' },
                { name: 'Vs1', value: 51, unit: 'kt', desc: 'Stall speed clean (Flaps 0)', type: 'normal' },
                { name: 'Vr', value: 54, unit: 'kt', desc: 'Rotation speed', type: 'normal' },
                { name: 'Vx', value: 65, unit: 'kt', desc: 'Best angle of climb', type: 'normal' },
                { name: 'Vy', value: 76, unit: 'kt', desc: 'Best rate of climb', type: 'normal' },
                { name: 'Vfe', value: 92, unit: 'kt', desc: 'Max flaps extended', type: 'normal' },
                { name: 'Va', value: 116, unit: 'kt', desc: 'Maneuvering speed', type: 'normal' },
                { name: 'Vno', value: 140, unit: 'kt', desc: 'Max structural cruising', type: 'normal' },
                { name: 'Vne', value: 166, unit: 'kt', desc: 'Never exceed speed', type: 'normal' },
                { name: 'Vc', value: 105, unit: 'kt', desc: 'Economic cruising speed @ 72%', type: 'normal' },
                { name: 'Vapp', value: 65, unit: 'kt', desc: 'Final approach speed', type: 'normal' },
                { name: 'Vg', value: 73, unit: 'kt', desc: 'Best glide speed (Flaps 0)', type: 'emergency' },
                { name: 'Vforced', value: 65, unit: 'kt', desc: 'Forced landing touch speed', type: 'emergency' },
                { name: 'Vshort_to', value: 55, unit: 'kt', desc: 'Short-field takeoff speed', type: 'special' }
            ],
            range: {
                fuelOnBoard: 100,
                fuelBurn: 24,
                reserveMin: 45,
                cruiseTas: 'Vc',
                taxiFuel: 4
            },
            limits: { fwd: 25.0, aft: 48.0 },
            wbRows: [
                { id: 'front_seats', name: 'Front Seats (Pilot + Pax)', weight: 150, arm: 41.0, linkedFuel: false },
                { id: 'rear_seats', name: 'Rear Seats', weight: 0, arm: 119.0, linkedFuel: false },
                { id: 'baggage', name: 'Baggage Compartment (Max 40 kg)', weight: 10, arm: 168.0, linkedFuel: false },
                { id: 'fuel_tank', name: 'Main Fuselage Fuel Tank', weight: 72.0, arm: 102.0, linkedFuel: true }
            ],
            checklists: [
                {
                    title: 'Visite Pré-vol (Pre-Flight)',
                    items: [
                        { task: 'Documents de bord', action: 'VÉRIFIÉS' },
                        { task: 'Contact allumage', action: 'COUPÉ' },
                        { task: 'Interrupteur général (Master)', action: 'MARCHE' },
                        { task: 'Jauges essence & Volets', action: 'CONTRÔLÉS' },
                        { task: 'Éclairages & Phare', action: 'TESTÉS PUIS COUPÉS' },
                        { task: 'Purges essence (3)', action: 'EFFECTUÉES SANS EAU' }
                    ]
                },
                {
                    title: 'Mise en Route (Engine Start)',
                    items: [
                        { task: 'Frein de parc', action: 'SERRÉ' },
                        { task: 'Sélecteur carburant', action: 'OUVERT' },
                        { task: 'Réchauffage carburateur', action: 'FROID (POUSSÉ)' },
                        { task: 'Pompe électrique', action: 'MARCHE (CONTRÔLE PRESSION) PUIS ARRÊT' },
                        { task: 'Zone hélice', action: 'DÉGAGÉE' },
                        { task: 'Démarreur', action: 'ACTIONNÉ' },
                        { task: 'Pression d\'huile', action: 'DANS LE VERT (< 30 SEC)' }
                    ]
                },
                {
                    title: 'Urgence: Panne Moteur en Campagne',
                    items: [
                        { task: 'Vitesse de finesse max', action: '135 KM/H (73 KT)' },
                        { task: 'Champ choisi', action: 'FACE AU VENT' },
                        { task: 'Pompe électrique', action: 'MARCHE' },
                        { task: 'Réchauffage carburateur', action: 'CHAUD' },
                        { task: 'Réservoir', action: 'OUVERT' },
                        { task: 'Transpondeur', action: '7700' },
                        { task: 'Message de détresse', action: '121.500 MHZ MAYDAY' },
                        { task: 'Avant contact sol', action: 'ESSENCE ET CONTACT COUPÉS' }
                    ]
                }
            ]
        },

        'pa28': {
            schemaVersion: SCHEMA_VERSION,
            id: 'pa28_archer',
            name: 'Piper PA-28-181 Archer III',
            type: 'PA28',
            model: 'Piper PA-28-181 Archer',
            reg: 'N28181',
            description: '180 HP Lycoming O-360-A4M, rugged all-metal low-wing aircraft, stable IFR platform.',
            units: { weight: 'kg', arm: 'cm', fuel: 'L' },
            profile: {
                reg: 'N28181',
                type: 'PA28',
                emptyWeight: 720,
                emptyArm: 218.0,
                mtow: 1157,
                mlw: 1157,
                fuelCapacity: 182
            },
            speeds: [
                { name: 'Vs0', value: 45, unit: 'kt', desc: 'Stall speed full flaps (40°)', type: 'normal' },
                { name: 'Vs1', value: 50, unit: 'kt', desc: 'Stall speed clean', type: 'normal' },
                { name: 'Vr', value: 60, unit: 'kt', desc: 'Rotation speed', type: 'normal' },
                { name: 'Vx', value: 64, unit: 'kt', desc: 'Best angle of climb', type: 'normal' },
                { name: 'Vy', value: 76, unit: 'kt', desc: 'Best rate of climb', type: 'normal' },
                { name: 'Vfe', value: 102, unit: 'kt', desc: 'Max flaps extended', type: 'normal' },
                { name: 'Va', value: 113, unit: 'kt', desc: 'Maneuvering speed', type: 'normal' },
                { name: 'Vno', value: 125, unit: 'kt', desc: 'Max structural cruising', type: 'normal' },
                { name: 'Vne', value: 154, unit: 'kt', desc: 'Never exceed speed', type: 'normal' },
                { name: 'Vc', value: 118, unit: 'kt', desc: 'Cruise speed @ 75% power', type: 'normal' },
                { name: 'Vapp', value: 66, unit: 'kt', desc: 'Approach speed', type: 'normal' },
                { name: 'Vg', value: 76, unit: 'kt', desc: 'Best glide speed', type: 'emergency' }
            ],
            range: {
                fuelOnBoard: 170,
                fuelBurn: 36,
                reserveMin: 45,
                cruiseTas: 'Vc',
                taxiFuel: 5
            },
            limits: { fwd: 208.0, aft: 236.0 },
            wbRows: [
                { id: 'front_occupants', name: 'Front Occupants', weight: 160, arm: 204.0, linkedFuel: false },
                { id: 'rear_occupants', name: 'Rear Occupants', weight: 0, arm: 299.0, linkedFuel: false },
                { id: 'baggage', name: 'Baggage Area (Max 90 kg)', weight: 15, arm: 363.0, linkedFuel: false },
                { id: 'wing_fuel', name: 'Wing Fuel Tanks (AvGas)', weight: 122.4, arm: 241.0, linkedFuel: true }
            ],
            checklists: [
                {
                    title: 'Before Starting Engine',
                    items: [
                        { task: 'Preflight Inspection', action: 'COMPLETED' },
                        { task: 'Seat Belts & Harnesses', action: 'FASTENED' },
                        { task: 'Brakes', action: 'SET' },
                        { task: 'Circuit Breakers', action: 'CHECK IN' },
                        { task: 'Fuel Selector', action: 'DESIRED TANK' },
                        { task: 'Electric Fuel Pump', action: 'ON (CHECK PRESS) THEN OFF' },
                        { task: 'Propeller Area', action: 'CLEAR' },
                        { task: 'Starter', action: 'ENGAGE' },
                        { task: 'Oil Pressure', action: 'CHECK GREEN' }
                    ]
                },
                {
                    title: 'Before Takeoff (Run-up)',
                    items: [
                        { task: 'Flight Controls', action: 'FREE & CORRECT' },
                        { task: 'Flight Instruments', action: 'CHECK & SET' },
                        { task: 'Throttle', action: '2000 RPM' },
                        { task: 'Magnetos', action: 'CHECK (MAX DROP 175 RPM)' },
                        { task: 'Carb Heat', action: 'CHECK' },
                        { task: 'Electric Fuel Pump', action: 'ON' },
                        { task: 'Flaps', action: 'SET 0° TO 25°' },
                        { task: 'Trim Tab', action: 'SET TAKEOFF' }
                    ]
                },
                {
                    title: 'Emergency: Engine Power Loss in Flight',
                    items: [
                        { task: 'Airspeed', action: '76 KIAS (BEST GLIDE)' },
                        { task: 'Landing Area', action: 'SELECT & TURN INTO WIND' },
                        { task: 'Fuel Selector', action: 'SWITCH TANKS' },
                        { task: 'Electric Fuel Pump', action: 'ON' },
                        { task: 'Mixture', action: 'RICH' },
                        { task: 'Carb Heat', action: 'ON' },
                        { task: 'Transponder', action: '7700' },
                        { task: 'Mayday', action: '121.500 MHZ' }
                    ]
                }
            ]
        },

        'da40': {
            schemaVersion: SCHEMA_VERSION,
            id: 'da40_ng',
            name: 'Diamond DA40 NG (Austro Diesel)',
            type: 'DA40',
            model: 'Diamond DA40 NG',
            reg: 'OE-DNG',
            description: '168 HP Austro Engine AE300 Jet-A1 turbo-diesel with EECU FADEC single-lever control.',
            units: { weight: 'kg', arm: 'cm', fuel: 'L' },
            profile: {
                reg: 'OE-DNG',
                type: 'DA40',
                emptyWeight: 880,
                emptyArm: 241.0,
                mtow: 1310,
                mlw: 1280,
                fuelCapacity: 147
            },
            speeds: [
                { name: 'Vs0', value: 49, unit: 'kt', desc: 'Stall speed full flaps (LDG)', type: 'normal' },
                { name: 'Vs1', value: 53, unit: 'kt', desc: 'Stall speed clean (UP)', type: 'normal' },
                { name: 'Vr', value: 59, unit: 'kt', desc: 'Rotation speed (Flaps T/O)', type: 'normal' },
                { name: 'Vx', value: 66, unit: 'kt', desc: 'Best angle of climb', type: 'normal' },
                { name: 'Vy', value: 72, unit: 'kt', desc: 'Best rate of climb', type: 'normal' },
                { name: 'Vfe', value: 91, unit: 'kt', desc: 'Max flaps speed (LDG)', type: 'normal' },
                { name: 'Va', value: 108, unit: 'kt', desc: 'Maneuvering speed', type: 'normal' },
                { name: 'Vno', value: 130, unit: 'kt', desc: 'Max structural cruising', type: 'normal' },
                { name: 'Vne', value: 172, unit: 'kt', desc: 'Never exceed speed', type: 'normal' },
                { name: 'Vc', value: 130, unit: 'kt', desc: 'High cruise TAS @ 75% Load', type: 'normal' },
                { name: 'Vapp', value: 71, unit: 'kt', desc: 'Final approach speed (Flaps LDG)', type: 'normal' },
                { name: 'Vg', value: 88, unit: 'kt', desc: 'Best glide speed', type: 'emergency' }
            ],
            range: {
                fuelOnBoard: 140,
                fuelBurn: 22,
                reserveMin: 45,
                cruiseTas: 'Vc',
                taxiFuel: 4
            },
            limits: { fwd: 240.0, aft: 259.0 },
            wbRows: [
                { id: 'front_seats', name: 'Front Seats (Pilot + Pax)', weight: 160, arm: 230.0, linkedFuel: false },
                { id: 'rear_seats', name: 'Rear Seats', weight: 0, arm: 325.0, linkedFuel: false },
                { id: 'baggage_fwd', name: 'Baggage Compartment (Max 45 kg)', weight: 15, arm: 365.0, linkedFuel: false },
                { id: 'jet_fuel', name: 'Usable Jet-A1 Fuel', weight: 112.0, arm: 263.0, linkedFuel: true }
            ],
            checklists: [
                {
                    title: 'Engine Start (Austro AE300 Diesel)',
                    items: [
                        { task: 'Pre-flight Check', action: 'COMPLETED' },
                        { task: 'Power Lever', action: 'IDLE' },
                        { task: 'Electric Master', action: 'ON' },
                        { task: 'Engine Master', action: 'ON' },
                        { task: 'Glow Plugs Annunciator', action: 'EXTINGUISHED' },
                        { task: 'Start Key', action: 'START UNTIL ENGINE RUNS' },
                        { task: 'Oil Pressure', action: 'CHECK GREEN WITHIN 3 SEC' },
                        { task: 'Avionics Master', action: 'ON' }
                    ]
                },
                {
                    title: 'ECU Test & Before Takeoff',
                    items: [
                        { task: 'Parking Brake', action: 'SET' },
                        { task: 'Power Lever', action: 'IDLE' },
                        { task: 'Oil Temp & Coolant Temp', action: 'CHECK GREEN (> 50°C)' },
                        { task: 'ECU Test Button', action: 'PRESS & HOLD (AUTO CYCLE)' },
                        { task: 'ECU A & B Lights', action: 'EXTINGUISHED AFTER TEST' },
                        { task: 'Flaps', action: 'SET T/O' },
                        { task: 'Pitot Heat', action: 'AS REQUIRED' }
                    ]
                },
                {
                    title: 'Emergency: Engine Failure in Flight',
                    items: [
                        { task: 'Airspeed', action: '88 KIAS (BEST GLIDE)' },
                        { task: 'Landing Field', action: 'SELECT & HEAD TOWARDS' },
                        { task: 'Power Lever', action: 'IDLE' },
                        { task: 'Engine Master', action: 'CYCLE OFF THEN ON (RESTART)' },
                        { task: 'Emergency Fuel Valve', action: 'CHECK NORMAL' },
                        { task: 'Fuel Pumps (Main & Aux)', action: 'CHECK ON' },
                        { task: 'Transponder', action: 'SQUAWK 7700' },
                        { task: 'Mayday Call', action: 'TRANSMIT 121.500 MHZ' }
                    ]
                }
            ]
        },

        'c152': {
            schemaVersion: SCHEMA_VERSION,
            id: 'c152_trainer',
            name: 'Cessna 152 II',
            type: 'C152',
            model: 'Cessna 152',
            reg: 'F-GAZZ',
            description: '110 HP Lycoming O-235-L2C, beloved 2-seat basic VFR trainer, economical and forgiving.',
            units: { weight: 'kg', arm: 'cm', fuel: 'L' },
            profile: {
                reg: 'F-GAZZ',
                type: 'C152',
                emptyWeight: 510,
                emptyArm: 75.0,
                mtow: 757,
                mlw: 757,
                fuelCapacity: 95
            },
            speeds: [
                { name: 'Vs0', value: 35, unit: 'kt', desc: 'Stall speed flaps 30°', type: 'normal' },
                { name: 'Vs1', value: 40, unit: 'kt', desc: 'Stall speed clean', type: 'normal' },
                { name: 'Vr', value: 50, unit: 'kt', desc: 'Rotation speed', type: 'normal' },
                { name: 'Vx', value: 55, unit: 'kt', desc: 'Best angle of climb', type: 'normal' },
                { name: 'Vy', value: 67, unit: 'kt', desc: 'Best rate of climb', type: 'normal' },
                { name: 'Vfe', value: 85, unit: 'kt', desc: 'Max flaps extended', type: 'normal' },
                { name: 'Va', value: 104, unit: 'kt', desc: 'Maneuvering speed', type: 'normal' },
                { name: 'Vno', value: 111, unit: 'kt', desc: 'Max structural cruising', type: 'normal' },
                { name: 'Vne', value: 149, unit: 'kt', desc: 'Never exceed speed', type: 'normal' },
                { name: 'Vc', value: 95, unit: 'kt', desc: 'Normal cruise TAS @ 75%', type: 'normal' },
                { name: 'Vapp', value: 55, unit: 'kt', desc: 'Final approach speed', type: 'normal' },
                { name: 'Vg', value: 60, unit: 'kt', desc: 'Best glide speed', type: 'emergency' }
            ],
            range: {
                fuelOnBoard: 80,
                fuelBurn: 22,
                reserveMin: 45,
                cruiseTas: 'Vc',
                taxiFuel: 3
            },
            limits: { fwd: 78.0, aft: 93.0 },
            wbRows: [
                { id: 'seats', name: 'Pilot + Passenger', weight: 150, arm: 99.0, linkedFuel: false },
                { id: 'baggage', name: 'Baggage Area 1 (Max 54 kg)', weight: 10, arm: 163.0, linkedFuel: false },
                { id: 'fuel', name: 'Usable Fuel Tanks', weight: 57.6, arm: 107.0, linkedFuel: true }
            ],
            checklists: [
                {
                    title: 'Pre-Flight Inspection',
                    items: [
                        { task: 'Magneto Switch', action: 'OFF' },
                        { task: 'Master Switch', action: 'ON' },
                        { task: 'Fuel Gauges', action: 'CHECK QUANTITY' },
                        { task: 'Flaps', action: 'EXTEND FULL' },
                        { task: 'Master Switch', action: 'OFF' },
                        { task: 'Fuel Strainer', action: 'DRAIN & CHECK' }
                    ]
                },
                {
                    title: 'Engine Start',
                    items: [
                        { task: 'Pre-Flight Inspection', action: 'COMPLETED' },
                        { task: 'Brakes', action: 'TEST & SET' },
                        { task: 'Circuit Breakers', action: 'IN' },
                        { task: 'Carb Heat', action: 'COLD' },
                        { task: 'Mixture', action: 'RICH' },
                        { task: 'Prime', action: '2-3 STROKES AS REQ' },
                        { task: 'Throttle', action: 'OPEN 1/2 INCH' },
                        { task: 'Propeller Area', action: 'CLEAR' },
                        { task: 'Master Switch', action: 'ON' },
                        { task: 'Ignition Switch', action: 'START' },
                        { task: 'Oil Pressure', action: 'CHECK GREEN' }
                    ]
                },
                {
                    title: 'Before Takeoff (Run-up)',
                    items: [
                        { task: 'Cabin Doors', action: 'CLOSED & LATCHED' },
                        { task: 'Flight Controls', action: 'FREE & CORRECT' },
                        { task: 'Altimeter', action: 'SET QNH' },
                        { task: 'Throttle', action: '1700 RPM' },
                        { task: 'Magnetos', action: 'CHECK (MAX 125 RPM DROP)' },
                        { task: 'Carb Heat', action: 'CHECK OPERATION' },
                        { task: 'Engine Gauges', action: 'CHECK GREEN' },
                        { task: 'Throttle', action: '1000 RPM' },
                        { task: 'Elevator Trim', action: 'TAKEOFF SETTING' },
                        { task: 'Flaps', action: '0° TO 10°' }
                    ]
                },
                {
                    title: 'Emergency: Engine Failure in Flight',
                    items: [
                        { task: 'Airspeed', action: '60 KIAS (BEST GLIDE)' },
                        { task: 'Landing Site', action: 'SELECT' },
                        { task: 'Carb Heat', action: 'ON' },
                        { task: 'Fuel Shutoff Valve', action: 'ON' },
                        { task: 'Mixture', action: 'RICH' },
                        { task: 'Ignition Switch', action: 'BOTH (OR START)' },
                        { task: 'Transponder', action: 'SQUAWK 7700' },
                        { task: 'Radio 121.500', action: 'MAYDAY CALL' }
                    ]
                }
            ]
        }
    };

    // -------------------------------------------------------------
    // 2. EXPORT FUNCTIONALITY
    // -------------------------------------------------------------
    function exportAircraftProfile() {
        let perfData = {};
        try {
            const raw = localStorage.getItem(PERF_STORAGE_KEY);
            if (raw) perfData = JSON.parse(raw);
        } catch (e) {}

        let briefData = {};
        try {
            const raw = localStorage.getItem(BRIEFING_STORAGE_KEY);
            if (raw) briefData = JSON.parse(raw);
        } catch (e) {}

        let chkData = {};
        try {
            const raw = localStorage.getItem(CHK_STORAGE_KEY);
            if (raw) chkData = JSON.parse(raw);
        } catch (e) {}

        const profileName = (perfData.profile?.type || briefData.aircraft || 'AIRCRAFT').toUpperCase();
        const profileReg = (perfData.profile?.reg || briefData.flightNumber || 'UNKNOWN').toUpperCase();

        // Extract checklists matching this aircraft if available
        let matchingChecklists = [];
        if (chkData && Array.isArray(chkData.aircraft)) {
            const currentAc = chkData.aircraft.find(a => 
                (a.id && a.id === chkData.activeAircraftId) ||
                (a.name && (a.name.toUpperCase().includes(profileName) || profileName.includes(a.name.toUpperCase())))
            ) || chkData.aircraft[0];
            if (currentAc && Array.isArray(currentAc.checklists)) {
                matchingChecklists = currentAc.checklists;
            }
        }

        const exportObject = {
            schemaVersion: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            source: 'FlightPrep Solution',
            id: `${profileName.toLowerCase()}_${profileReg.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            name: `${profileName} (${profileReg})`,
            type: profileName,
            model: profileName,
            reg: profileReg,
            units: perfData.units || { weight: 'kg', arm: 'cm', fuel: 'L' },
            profile: {
                reg: profileReg,
                type: profileName,
                emptyWeight: parseFloat(perfData.profile?.emptyWeight) || 0,
                emptyArm: parseFloat(perfData.profile?.emptyArm) || 0,
                mtow: parseFloat(perfData.profile?.mtow) || 0,
                mlw: parseFloat(perfData.profile?.mlw) || 0,
                fuelCapacity: parseFloat(perfData.profile?.fuelCapacity) || 0
            },
            speeds: Array.isArray(perfData.speeds) ? perfData.speeds : [],
            range: {
                fuelOnBoard: parseFloat(perfData.range?.fuelOnBoard) || 0,
                fuelBurn: parseFloat(perfData.range?.fuelBurn) || 0,
                reserveMin: parseFloat(perfData.range?.reserveMin) || 45,
                cruiseTas: perfData.range?.cruiseTas || 'Vc',
                taxiFuel: parseFloat(perfData.range?.taxiFuel) || 0
            },
            limits: perfData.limits || { fwd: 0, aft: 0 },
            wbRows: Array.isArray(perfData.wbRows) ? perfData.wbRows : [],
            checklists: matchingChecklists
        };

        const jsonStr = JSON.stringify(exportObject, null, 2);
        const fileName = `${profileName}_${profileReg}_profile.json`.replace(/[\s\/\\:*?"<>|]/g, '_');

        // Trigger browser download if in browser
        if (typeof document !== 'undefined' && document.createElement && document.body && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        return exportObject;
    }

    // -------------------------------------------------------------
    // 3. VALIDATION & NORMALIZATION
    // -------------------------------------------------------------
    function validateAndNormalizeAircraftProfile(rawInput) {
        let obj = rawInput;
        if (typeof rawInput === 'string') {
            try {
                obj = JSON.parse(rawInput);
            } catch (err) {
                throw new Error('Invalid JSON format: ' + err.message);
            }
        }
        if (!obj || typeof obj !== 'object') {
            throw new Error('Aircraft profile data must be a valid JSON object.');
        }

        const type = (obj.type || obj.model || obj.profile?.type || 'AIRCRAFT').toUpperCase().trim();
        const reg = (obj.reg || obj.profile?.reg || 'F-GXXX').toUpperCase().trim();

        const profile = {
            reg: reg,
            type: type,
            emptyWeight: parseFloat(obj.profile?.emptyWeight || obj.emptyWeight || 0),
            emptyArm: parseFloat(obj.profile?.emptyArm || obj.emptyArm || 0),
            mtow: parseFloat(obj.profile?.mtow || obj.mtow || 0),
            mlw: parseFloat(obj.profile?.mlw || obj.mlw || obj.profile?.mtow || obj.mtow || 0),
            fuelCapacity: parseFloat(obj.profile?.fuelCapacity || obj.fuelCapacity || 0)
        };

        // Speeds array normalization
        let speeds = [];
        if (Array.isArray(obj.speeds)) {
            speeds = obj.speeds.map(s => ({
                name: String(s.name || 'V'),
                value: parseFloat(s.value) || 0,
                unit: s.unit || 'kt',
                desc: s.desc || '',
                type: s.type || 'normal'
            }));
        }

        // Range & Endurance
        const range = {
            fuelOnBoard: parseFloat(obj.range?.fuelOnBoard || profile.fuelCapacity || 0),
            fuelBurn: parseFloat(obj.range?.fuelBurn || obj.fuelBurn || 0),
            reserveMin: parseFloat(obj.range?.reserveMin || 45),
            cruiseTas: obj.range?.cruiseTas || 'Vc',
            taxiFuel: parseFloat(obj.range?.taxiFuel || 0)
        };

        // W&B Rows & CG Limits
        let wbRows = [];
        if (Array.isArray(obj.wbRows)) {
            wbRows = obj.wbRows.map(r => ({
                id: r.id || 'station_' + Math.random().toString(36).substr(2, 6),
                name: String(r.name || 'Station'),
                weight: parseFloat(r.weight) || 0,
                arm: parseFloat(r.arm) || 0,
                linkedFuel: !!r.linkedFuel
            }));
        }

        const limits = {
            fwd: parseFloat(obj.limits?.fwd || 0),
            aft: parseFloat(obj.limits?.aft || 0)
        };

        const units = obj.units || { weight: 'kg', arm: 'cm', fuel: 'L' };

        return {
            schemaVersion: SCHEMA_VERSION,
            id: obj.id || `${type.toLowerCase()}_${reg.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            name: obj.name || `${type} (${reg})`,
            type: type,
            model: obj.model || type,
            reg: reg,
            units: units,
            profile: profile,
            speeds: speeds,
            range: range,
            limits: limits,
            wbRows: wbRows,
            checklists: Array.isArray(obj.checklists) ? obj.checklists : []
        };
    }

    // -------------------------------------------------------------
    // 4. IMPORT & MULTI-PAGE SYNCHRONIZATION
    // -------------------------------------------------------------
    function importAircraftProfile(profileInput) {
        const normalized = validateAndNormalizeAircraftProfile(profileInput);

        // 1. Update Performance State (flightprep_perf_data_v10)
        const perfData = {
            units: normalized.units,
            profile: normalized.profile,
            speeds: normalized.speeds,
            range: normalized.range,
            wbRows: normalized.wbRows,
            limits: normalized.limits
        };
        localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify(perfData));

        // 2. Update Flight Prep Briefing State (flightprep_info_v1)
        let briefData = {};
        try {
            const raw = localStorage.getItem(BRIEFING_STORAGE_KEY);
            if (raw) briefData = JSON.parse(raw);
        } catch (e) {}
        briefData.flightNumber = normalized.reg;
        briefData.aircraft = normalized.type;
        localStorage.setItem(BRIEFING_STORAGE_KEY, JSON.stringify(briefData));

        // 3. Update VFR Map TAS (flightprep_map_data_v11)
        let cruiseSpeedVal = 110;
        const cruiseName = normalized.range.cruiseTas || 'Vc';
        const cruiseSpeedObj = normalized.speeds.find(s => s.name === cruiseName) ||
                               normalized.speeds.find(s => s.name.toLowerCase().includes('vc') || s.name.toLowerCase().includes('cruise')) ||
                               normalized.speeds[0];
        if (cruiseSpeedObj && cruiseSpeedObj.value > 0) {
            cruiseSpeedVal = cruiseSpeedObj.value;
        }

        try {
            const mapRaw = localStorage.getItem(MAP_STORAGE_KEY);
            const mapData = mapRaw ? JSON.parse(mapRaw) : {};
            mapData.tas = cruiseSpeedVal;
            localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(mapData));
        } catch (e) {}

        // 4. Update Checklists (flightprep_checklists_data_v2) if included in profile
        if (Array.isArray(normalized.checklists) && normalized.checklists.length > 0) {
            try {
                const chkRaw = localStorage.getItem(CHK_STORAGE_KEY);
                let chkState = chkRaw ? JSON.parse(chkRaw) : { aircraft: [] };
                if (!Array.isArray(chkState.aircraft)) chkState.aircraft = [];

                let existingAc = chkState.aircraft.find(a => 
                    (a.id && a.id === normalized.id) ||
                    (a.name && (a.name.toUpperCase().includes(normalized.type) || normalized.type.includes(a.name.toUpperCase())))
                );

                const formattedChecklists = normalized.checklists.map(c => ({
                    id: c.id || 'chk_' + Math.random().toString(36).substr(2, 9),
                    title: c.title || 'Checklist',
                    items: Array.isArray(c.items) ? c.items.map(it => ({
                        id: it.id || 'item_' + Math.random().toString(36).substr(2, 9),
                        task: it.task || it.text || '',
                        action: it.action || it.value || '',
                        text: it.task || it.text || '',
                        value: it.action || it.value || '',
                        checked: !!(it.checked || it.done),
                        done: !!(it.checked || it.done)
                    })) : []
                }));

                if (existingAc) {
                    existingAc.name = normalized.name;
                    existingAc.checklists = formattedChecklists;
                    chkState.activeAircraftId = existingAc.id;
                } else {
                    const newAc = {
                        id: normalized.id || 'ac_' + Math.random().toString(36).substr(2, 9),
                        name: normalized.name,
                        checklists: formattedChecklists
                    };
                    chkState.aircraft.push(newAc);
                    chkState.activeAircraftId = newAc.id;
                }
                localStorage.setItem(CHK_STORAGE_KEY, JSON.stringify(chkState));
            } catch (e) {
                console.warn('Could not sync checklists:', e);
            }
        }

        // 5. Broadcast to all open tabs and dispatch local event
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aircraftProfileChanged', { detail: normalized }));
            try {
                // Trigger storage event across tabs by updating a timestamp key
                localStorage.setItem('flightprep_profile_sync_trigger', Date.now().toString());
            } catch (e) {}
        }

        return normalized;
    }

    // -------------------------------------------------------------
    // 5. MODAL UI INJECTION & CONTROLLER
    // -------------------------------------------------------------
    function renderProfileModalHtml() {
        return `
        <div id="aircraftProfileModal" class="profile-modal-overlay" style="display:none;">
            <div class="profile-modal-dialog">
                <div class="profile-modal-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:24px;">✈️</span>
                        <div>
                            <h3 style="margin:0; font-size:17px; font-weight:800; color:var(--text-color);">Aircraft Profile Manager</h3>
                            <span style="font-size:12px; color:var(--muted-text);">Import, export, and synchronize fleet profiles across all flight prep modules</span>
                        </div>
                    </div>
                    <button class="profile-modal-close" onclick="AircraftProfiles.closeModal()">&times;</button>
                </div>

                <div class="profile-modal-tabs">
                    <button class="profile-tab-btn active" data-tab="presets">⚡ Built-in Presets</button>
                    <button class="profile-tab-btn" data-tab="import">📥 Import File / JSON</button>
                    <button class="profile-tab-btn" data-tab="export">📤 Export Active Profile</button>
                </div>

                <div class="profile-modal-body">
                    <!-- PRESETS TAB -->
                    <div class="profile-tab-pane active" id="pane-presets">
                        <div style="font-size:13px; color:var(--muted-text); margin-bottom:14px;">
                            Select a verified manufacturer POH aircraft profile to immediately configure Speeds, Weight &amp; Balance, Consumption, and Checklists:
                        </div>
                        <div class="preset-grid">
                            ${Object.keys(AIRCRAFT_PRESETS).map(key => {
                                const p = AIRCRAFT_PRESETS[key];
                                const vCruise = p.speeds.find(s => s.name === 'Vc')?.value || 110;
                                return `
                                    <div class="preset-card" onclick="AircraftProfiles.loadPreset('${key}')">
                                        <div class="preset-header">
                                            <div>
                                                <strong class="preset-title">${escapeHtml(p.name)}</strong>
                                                <div class="preset-sub">${escapeHtml(p.reg)} &bull; ${escapeHtml(p.type)}</div>
                                            </div>
                                            <span class="preset-tag">POH PRESET</span>
                                        </div>
                                        <div class="preset-desc">${escapeHtml(p.description)}</div>
                                        <div class="preset-specs">
                                            <span><strong>Cruise:</strong> ${vCruise} kt</span>
                                            <span><strong>Burn:</strong> ${p.range.fuelBurn} L/h</span>
                                            <span><strong>MTOW:</strong> ${p.profile.mtow} kg</span>
                                            <span><strong>Fuel:</strong> ${p.profile.fuelCapacity} L</span>
                                        </div>
                                        <button class="btn-action primary small" style="width:100%; margin-top:10px;">⚡ Load ${escapeHtml(p.type)} Profile</button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- IMPORT TAB -->
                    <div class="profile-tab-pane" id="pane-import">
                        <div class="profile-dropzone" id="profileDropzone">
                            <span style="font-size:32px; margin-bottom:8px; display:block;">📁</span>
                            <strong>Drag &amp; drop an aircraft profile (.json) here</strong>
                            <div style="font-size:12px; color:var(--muted-text); margin:6px 0 12px 0;">or browse from your computer</div>
                            <input type="file" id="profileFileInput" accept=".json,application/json" style="display:none;">
                            <button class="btn-action small" onclick="document.getElementById('profileFileInput').click()">Choose JSON File</button>
                        </div>

                        <div style="margin: 18px 0 8px 0; font-size:12.5px; font-weight:700; color:var(--text-color);">
                            Or Paste Profile JSON Code:
                        </div>
                        <textarea id="profilePasteArea" class="profile-paste-box" placeholder='Paste aircraft profile JSON here...'></textarea>
                        
                        <div id="importErrorBox" class="profile-error-box" style="display:none;"></div>

                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
                            <button class="btn-action" onclick="AircraftProfiles.closeModal()">Cancel</button>
                            <button class="btn-action primary" onclick="AircraftProfiles.handlePastedImport()">📥 Apply Aircraft Profile</button>
                        </div>
                    </div>

                    <!-- EXPORT TAB -->
                    <div class="profile-tab-pane" id="pane-export">
                        <div style="font-size:13px; color:var(--muted-text); margin-bottom:14px;">
                            Export your current configured aircraft profile with all custom speeds, weight &amp; balance stations, fuel burn, and flight procedures:
                        </div>

                        <div class="profile-summary-box" id="profileExportSummary"></div>

                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                            <button class="btn-action" onclick="AircraftProfiles.copyJsonToClipboard()">📋 Copy JSON to Clipboard</button>
                            <button class="btn-action primary" onclick="AircraftProfiles.exportAndDownload()">💾 Download .JSON File</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    function injectProfileModalCss() {
        if (typeof document === 'undefined' || !document.createElement || !document.head) return;
        if (document.getElementById('aircraftProfileStyles')) return;
        const style = document.createElement('style');
        style.id = 'aircraftProfileStyles';
        style.textContent = `
            .profile-modal-overlay {
                position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
                background: rgba(0, 0, 0, 0.75) !important; backdrop-filter: blur(4px) !important;
                z-index: 2147483647 !important; display: flex !important; align-items: center !important; justify-content: center !important;
                padding: 20px !important; box-sizing: border-box !important;
            }
            .profile-modal-dialog {
                background: var(--card-bg, #ffffff); color: var(--text-color, #111111);
                border: 2px solid var(--border-color, #111111); border-radius: 8px;
                width: 720px; max-width: 95vw; max-height: 90vh;
                display: flex; flex-direction: column; box-shadow: 0 16px 48px rgba(0,0,0,0.3);
                overflow: hidden; animation: popIn 0.15s ease-out;
            }
            @keyframes popIn {
                from { transform: scale(0.96); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            .profile-modal-header {
                padding: 16px 20px; border-bottom: 2px solid var(--border-color, #111111);
                display: flex; align-items: center; justify-content: space-between;
                background: var(--bg-color, #f6f4f0);
            }
            .profile-modal-close {
                background: transparent; border: none; font-size: 24px; font-weight: 700;
                color: var(--text-color, #111111); cursor: pointer; line-height: 1;
            }
            .profile-modal-tabs {
                display: flex; border-bottom: 2px solid var(--border-color, #111111);
                background: var(--bg-color, #f6f4f0);
            }
            .profile-tab-btn {
                padding: 12px 18px; border: none; background: transparent;
                color: var(--muted-text, #666666); font-weight: 700; font-size: 13px;
                cursor: pointer; border-right: 1px solid var(--border-color, #111111);
                transition: background 0.15s ease, color 0.15s ease;
            }
            .profile-tab-btn.active {
                background: var(--card-bg, #ffffff); color: var(--text-color, #111111);
                border-bottom: 2px solid var(--accent-blue, #1967d2); margin-bottom: -2px;
            }
            .profile-modal-body {
                padding: 20px; overflow-y: auto; flex: 1;
            }
            .profile-tab-pane { display: none; }
            .profile-tab-pane.active { display: block; }
            
            .preset-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;
            }
            .preset-card {
                border: 1.5px solid var(--border-color, #111111); border-radius: 6px;
                padding: 14px; background: var(--bg-color, #f6f4f0); cursor: pointer;
                transition: transform 0.12s ease, box-shadow 0.12s ease;
            }
            .preset-card:hover {
                transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.12);
                border-color: var(--accent-blue, #1967d2);
            }
            .preset-header {
                display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;
            }
            .preset-title { font-size: 14px; font-weight: 800; color: var(--text-color, #111111); }
            .preset-sub { font-size: 11.5px; color: var(--muted-text, #666); margin-top: 2px; }
            .preset-tag {
                font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 3px;
                background: rgba(25, 103, 210, 0.15); color: var(--accent-blue, #1967d2);
                border: 1px solid rgba(255, 255, 255, 0.3); white-space: nowrap;
            }
            .preset-desc {
                font-size: 11.5px; color: var(--muted-text, #666); line-height: 1.4; margin-bottom: 10px;
            }
            .preset-specs {
                display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-size: 11px;
                padding: 6px 8px; background: var(--card-bg, #ffffff); border-radius: 4px;
                border: 1px solid rgba(0,0,0,0.08);
            }
            .profile-dropzone {
                border: 2px dashed var(--border-color, #111111); border-radius: 6px;
                padding: 28px 20px; text-align: center; background: var(--bg-color, #f6f4f0);
                cursor: pointer; transition: background 0.15s ease;
            }
            .profile-dropzone.dragover { background: var(--hover-bg, #e4dfd3); }
            .profile-paste-box {
                width: 100%; height: 140px; box-sizing: border-box; font-family: monospace;
                font-size: 11.5px; padding: 10px; border: 1.5px solid var(--border-color, #111111);
                border-radius: 4px; background: var(--card-bg, #ffffff); color: var(--text-color, #111111);
                resize: vertical;
            }
            .profile-error-box {
                margin-top: 10px; padding: 10px 14px; background: #fce8e6; color: #c5221f;
                border: 1px solid #ea4335; border-radius: 4px; font-size: 12px; font-weight: 600;
            }
            .profile-summary-box {
                padding: 14px 16px; background: var(--bg-color, #f6f4f0); border: 1.5px solid var(--border-color, #111111);
                border-radius: 6px; font-size: 12.5px; line-height: 1.6;
            }
        `;
        document.head.appendChild(style);
    }

    function initModalDom() {
        if (typeof document === 'undefined' || !document.createElement || !document.body) return;
        if (document.getElementById('aircraftProfileModal')) return;
        injectProfileModalCss();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderProfileModalHtml();
        const modalEl = wrapper.querySelector('#aircraftProfileModal') || wrapper.firstElementChild;
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) closeModal();
            });
            document.body.appendChild(modalEl);
        }

        // Wire tabs
        const modal = document.getElementById('aircraftProfileModal') || modalEl;
        if (!modal) return;
        modal.querySelectorAll('.profile-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
                modal.querySelectorAll('.profile-tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const targetId = 'pane-' + btn.dataset.tab;
                const pane = document.getElementById(targetId);
                if (pane) pane.classList.add('active');

                if (btn.dataset.tab === 'export') {
                    updateExportSummary();
                }
            });
        });

        // Wire dropzone & file picker
        const dropzone = document.getElementById('profileDropzone');
        const fileInput = document.getElementById('profileFileInput');
        if (dropzone && fileInput) {
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    handleFileSelected(e.dataTransfer.files[0]);
                }
            });
            fileInput.addEventListener('change', () => {
                if (fileInput.files.length) {
                    handleFileSelected(fileInput.files[0]);
                }
            });
        }
    }

    function handleFileSelected(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const normalized = importAircraftProfile(content);
                showSuccessAndReload(`✓ Successfully loaded profile for ${normalized.name}!`);
            } catch (err) {
                showError(err.message);
            }
        };
        reader.readAsText(file);
    }

    function handlePastedImport() {
        const textarea = document.getElementById('profilePasteArea');
        const val = textarea ? textarea.value.trim() : '';
        if (!val) {
            showError('Please paste JSON profile data first.');
            return;
        }
        try {
            const normalized = importAircraftProfile(val);
            showSuccessAndReload(`✓ Successfully applied profile for ${normalized.name}!`);
        } catch (err) {
            showError(err.message);
        }
    }

    function loadPreset(presetKey) {
        const preset = AIRCRAFT_PRESETS[presetKey];
        if (!preset) return;
        const normalized = importAircraftProfile(preset);
        showSuccessAndReload(`✓ Successfully loaded preset: ${normalized.name}!`);
    }

    function showError(msg) {
        const box = document.getElementById('importErrorBox');
        if (box) {
            box.textContent = msg;
            box.style.display = 'block';
        } else {
            alert('Import Error: ' + msg);
        }
    }

    function showToast(msg, type = 'success') {
        if (typeof document === 'undefined' || !document.createElement || !document.body) return;
        let toast = document.getElementById('profileToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'profileToast';
            toast.style.cssText = `
                position: fixed; bottom: 24px; right: 24px; z-index: 100000;
                color: #ffffff; padding: 12px 20px; border-radius: 6px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13.5px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
                display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.2);
                transition: transform 0.25s ease, opacity 0.25s ease; transform: translateY(20px); opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        toast.style.background = type === 'success' ? '#0f766e' : '#b91c1c';
        toast.innerHTML = (type === 'success' ? '✅ ' : '⚠️ ') + escapeHtml(msg);
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });
        setTimeout(() => {
            if (toast) {
                toast.style.transform = 'translateY(20px)';
                toast.style.opacity = '0';
            }
        }, 4000);
    }

    function showSuccessAndReload(msg) {
        closeModal();
        showToast(msg, 'success');
        if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
            if (!window.__hasProfileChangeHandler) {
                setTimeout(() => {
                    if (window.location && typeof window.location.reload === 'function') {
                        window.location.reload();
                    }
                }, 600);
            }
        }
    }

    function updateExportSummary() {
        const box = document.getElementById('profileExportSummary');
        if (!box) return;

        let perfData = {};
        try {
            const raw = localStorage.getItem(PERF_STORAGE_KEY);
            if (raw) perfData = JSON.parse(raw);
        } catch (e) {}

        const profileName = perfData.profile?.type || 'AIRCRAFT';
        const profileReg = perfData.profile?.reg || 'F-GXXX';
        const speedsCount = Array.isArray(perfData.speeds) ? perfData.speeds.length : 0;
        const stationsCount = Array.isArray(perfData.wbRows) ? perfData.wbRows.length : 0;
        const cruiseSpd = perfData.range?.cruiseTas || 'Vc';
        const cruiseVal = perfData.speeds?.find(s => s.name === cruiseSpd)?.value || '—';

        box.innerHTML = `
            <div style="font-size:15px; font-weight:800; margin-bottom:8px; color:var(--text-color);">
                ✈️ ${escapeHtml(profileName)} (${escapeHtml(profileReg)})
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:8px;">
                <div><strong>MTOW:</strong> ${perfData.profile?.mtow || '—'} ${perfData.units?.weight || 'kg'}</div>
                <div><strong>Empty Weight:</strong> ${perfData.profile?.emptyWeight || '—'} ${perfData.units?.weight || 'kg'}</div>
                <div><strong>Fuel Capacity:</strong> ${perfData.profile?.fuelCapacity || '—'} ${perfData.units?.fuel || 'L'}</div>
                <div><strong>Fuel Burn:</strong> ${perfData.range?.fuelBurn || '—'} ${perfData.units?.fuel || 'L'}/h</div>
                <div><strong>Cruise Speed:</strong> ${cruiseVal} kt (${escapeHtml(cruiseSpd)})</div>
                <div><strong>Configured Speeds:</strong> ${speedsCount} speeds</div>
                <div><strong>W&amp;B Stations:</strong> ${stationsCount} loading points</div>
            </div>
        `;
    }

    function copyJsonToClipboard() {
        const exportObj = exportAircraftProfileInternal();
        const jsonStr = JSON.stringify(exportObj, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonStr).then(() => {
                showToast('Aircraft profile JSON copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Could not copy to clipboard. Please use Download button.', 'error');
            });
        } else {
            showToast('Clipboard access not supported. Please use Download button.', 'error');
        }
    }

    function exportAircraftProfileInternal() {
        let perfData = {};
        try {
            const raw = localStorage.getItem(PERF_STORAGE_KEY);
            if (raw) perfData = JSON.parse(raw);
        } catch (e) {}

        let briefData = {};
        try {
            const raw = localStorage.getItem(BRIEFING_STORAGE_KEY);
            if (raw) briefData = JSON.parse(raw);
        } catch (e) {}

        let chkData = {};
        try {
            const raw = localStorage.getItem(CHK_STORAGE_KEY);
            if (raw) chkData = JSON.parse(raw);
        } catch (e) {}

        const profileName = (perfData.profile?.type || briefData.aircraft || 'AIRCRAFT').toUpperCase();
        const profileReg = (perfData.profile?.reg || briefData.flightNumber || 'UNKNOWN').toUpperCase();

        let matchingChecklists = [];
        if (chkData && Array.isArray(chkData.aircraft)) {
            const currentAc = chkData.aircraft.find(a => 
                (a.id && a.id === chkData.activeAircraftId) ||
                (a.name && (a.name.toUpperCase().includes(profileName) || profileName.includes(a.name.toUpperCase())))
            ) || chkData.aircraft[0];
            if (currentAc && Array.isArray(currentAc.checklists)) {
                matchingChecklists = currentAc.checklists;
            }
        }

        return {
            schemaVersion: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            source: 'FlightPrep Solution',
            id: `${profileName.toLowerCase()}_${profileReg.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            name: `${profileName} (${profileReg})`,
            type: profileName,
            model: profileName,
            reg: profileReg,
            units: perfData.units || { weight: 'kg', arm: 'cm', fuel: 'L' },
            profile: {
                reg: profileReg,
                type: profileName,
                emptyWeight: parseFloat(perfData.profile?.emptyWeight) || 0,
                emptyArm: parseFloat(perfData.profile?.emptyArm) || 0,
                mtow: parseFloat(perfData.profile?.mtow) || 0,
                mlw: parseFloat(perfData.profile?.mlw) || 0,
                fuelCapacity: parseFloat(perfData.profile?.fuelCapacity) || 0
            },
            speeds: Array.isArray(perfData.speeds) ? perfData.speeds : [],
            range: {
                fuelOnBoard: parseFloat(perfData.range?.fuelOnBoard) || 0,
                fuelBurn: parseFloat(perfData.range?.fuelBurn) || 0,
                reserveMin: parseFloat(perfData.range?.reserveMin) || 45,
                cruiseTas: perfData.range?.cruiseTas || 'Vc',
                taxiFuel: parseFloat(perfData.range?.taxiFuel) || 0
            },
            limits: perfData.limits || { fwd: 0, aft: 0 },
            wbRows: Array.isArray(perfData.wbRows) ? perfData.wbRows : [],
            checklists: matchingChecklists
        };
    }

    function exportAndDownload() {
        exportAircraftProfile();
    }

    function openModal(defaultTab = 'presets') {
        initModalDom();
        const modal = document.getElementById('aircraftProfileModal');
        if (!modal) {
            console.error('AircraftProfiles: Modal element could not be found.');
            return;
        }
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        // Select default tab
        const tabBtn = modal.querySelector(`.profile-tab-btn[data-tab="${defaultTab}"]`);
        if (tabBtn) tabBtn.click();
    }

    function closeModal() {
        const modal = document.getElementById('aircraftProfileModal');
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
        const errBox = document.getElementById('importErrorBox');
        if (errBox) errBox.style.display = 'none';
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Auto-initialize when DOM is ready
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModalDom);
        } else {
            initModalDom();
        }
    }

    // Export API
    global.AircraftProfiles = {
        SCHEMA_VERSION,
        PRESETS: AIRCRAFT_PRESETS,
        exportProfile: exportAircraftProfile,
        importProfile: importAircraftProfile,
        validateProfile: validateAndNormalizeAircraftProfile,
        openModal: openModal,
        closeModal: closeModal,
        loadPreset: loadPreset,
        handlePastedImport: handlePastedImport,
        exportAndDownload: exportAndDownload,
        copyJsonToClipboard: copyJsonToClipboard
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.AircraftProfiles;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
