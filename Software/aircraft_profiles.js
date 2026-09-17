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
            description: 'Lycoming IO-360-L2A 180 ch, quadriplace de voyage, avionique Garmin.',
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
            description: 'Lycoming O-235 118 ch, cellule bois française très efficace, excellente visibilité vers l\'avant.',
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
            description: 'Lycoming O-360-A4M 180 ch, aile basse tout métal robuste, plateforme IFR stable.',
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
            description: 'Austro AE300 168 ch, turbo-diesel Jet-A1, commande monomanette FADEC.',
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
            description: 'Lycoming O-235-L2C 110 ch, biplace école VFR, économique et tolérant.',
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
                fuelCapacity: parseFloat(perfData.profile?.fuelCapacity) || 0,
                fuelDensity: parseFloat(perfData.profile?.fuelDensity) || 0.72
            },
            speeds: Array.isArray(perfData.speeds) ? perfData.speeds : [],
            range: {
                fuelOnBoard: parseFloat(perfData.range?.fuelOnBoard) || 0,
                fuelBurn: parseFloat(perfData.range?.fuelBurn) || 0,
                reserveMin: parseFloat(perfData.range?.reserveMin) || 45,
                cruiseTas: perfData.range?.cruiseTas || 'Vc',
                taxiFuel: parseFloat(perfData.range?.taxiFuel) || 0,
                climbMinutes: parseFloat(perfData.range?.climbMinutes) || 8,
                alternateMinutes: parseFloat(perfData.range?.alternateMinutes) || 20
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
            fuelCapacity: parseFloat(obj.profile?.fuelCapacity || obj.fuelCapacity || 0),
            fuelDensity: parseFloat(obj.profile?.fuelDensity || obj.fuelDensity || 0.72)
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
            taxiFuel: parseFloat(obj.range?.taxiFuel || 0),
            climbMinutes: parseFloat(obj.range?.climbMinutes || 8),
            alternateMinutes: parseFloat(obj.range?.alternateMinutes || 20)
        };

        // W&B Rows & CG Limits
        let wbRows = [];
        if (Array.isArray(obj.wbRows)) {
            wbRows = obj.wbRows.map(r => ({
                id: r.id || 'station_' + Math.random().toString(36).substr(2, 6),
                name: String(r.name || 'Station'),
                weight: parseFloat(r.weight) || 0,
                arm: parseFloat(r.arm) || 0,
                linkedEmpty: !!r.linkedEmpty,
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
    const ORIGIN_KEY = 'flightprep_profile_origin_v1';
    function setProfileOrigin(shapeKey) {
        try { localStorage.setItem(ORIGIN_KEY, shapeKey || 'import'); } catch (e) {}
    }
    function getProfileOrigin() {
        try { return localStorage.getItem(ORIGIN_KEY) || ''; } catch (e) { return ''; }
    }

    function importAircraftProfile(profileInput) {
        const normalized = validateAndNormalizeAircraftProfile(profileInput);

        // 1. Update Performance State (flightprep_perf_data_v10)
        const perfData = {
            units: normalized.units,
            profile: normalized.profile,
            speeds: normalized.speeds,
            range: normalized.range,
            fuelFlow: normalized.range?.fuelBurn || 35,
            fuelCapacity: normalized.profile?.fuelCapacity || 110,
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
        if (normalized.range) {
            if (normalized.range.fuelOnBoard !== undefined) {
                briefData.fuel = normalized.range.fuelOnBoard;
            }
            if (normalized.range.fuelBurn !== undefined) {
                briefData.burn = normalized.range.fuelBurn;
            }
        }
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
    // ---------------------------------------------------------------
    // Schemas d'avion : vue de dessus posee sur un plateau tournant.
    // Les proportions distinguent les familles (aile haute / basse,
    // aile cranquee du DR400, empennage en T du DA40).
    // ---------------------------------------------------------------
    // ---------------------------------------------------------------
    // Schemas d'avion : vue de dessus dessinee au trait, qui tourne sur
    // elle-meme. Le trait reste lisible a tous les angles, contrairement
    // a une silhouette pleine ecrasee par la perspective.
    // Les cotes sont en metres reels, mises a l'echelle du cadre.
    // ---------------------------------------------------------------
    const AIRCRAFT_SHAPES = {
        c172:  { span: 11.0, len: 8.3, wing: 'straight', pos: 'high', tail: 'conv', cabin: 4 },
        c152:  { span: 10.2, len: 7.3, wing: 'straight', pos: 'high', tail: 'conv', cabin: 2 },
        dr400: { span: 8.7,  len: 6.9, wing: 'crank',    pos: 'low',  tail: 'conv', cabin: 4 },
        pa28:  { span: 10.7, len: 7.3, wing: 'taper',    pos: 'low',  tail: 'stab', cabin: 4 },
        da40:  { span: 11.9, len: 8.1, wing: 'taper',    pos: 'low',  tail: 'tee',  cabin: 4 },
        // Profil venu d'un fichier : aucun modele connu, silhouette neutre
        // et identique pour tous les imports.
        import:{ span: 10.8, len: 7.8, wing: 'straight', pos: 'low', tail: 'conv', cabin: 4, neutral: true }
    };

    function shapeFor(key, type) {
        if (AIRCRAFT_SHAPES[key]) return AIRCRAFT_SHAPES[key];
        const t = String(type || '').toUpperCase();
        if (t.indexOf('DR4') >= 0) return AIRCRAFT_SHAPES.dr400;
        if (t.indexOf('DA4') >= 0) return AIRCRAFT_SHAPES.da40;
        if (t.indexOf('PA') === 0) return AIRCRAFT_SHAPES.pa28;
        if (t.indexOf('C15') >= 0) return AIRCRAFT_SHAPES.c152;
        return AIRCRAFT_SHAPES.c172;
    }

    // Vignette 3D quand le moteur est chargé, dessin au trait sinon :
    // la fenêtre reste utilisable sur une machine sans WebGL.
    function aircraftSchematic(key, type) {
        if (window.AltiKit && window.AltiviewCard3D) {
            const s = shapeFor(key, type);
            const id = (window.AltiKit.fleetModels && AltiKit.fleetModels.SPECS[key]) ? key : modelIdFor(type);
            if (id) return `<div class="ac-turn ac-3d-wrap"><canvas class="ac-3d" data-model="${id}" aria-hidden="true"></canvas></div>`;
            void s;
        }
        return aircraftSchematicFlat(key, type);
    }

    function modelIdFor(type) {
        const t = String(type || '').toUpperCase();
        if (t.indexOf('DR4') >= 0) return 'dr400';
        if (t.indexOf('DA4') >= 0) return 'da40';
        if (t.indexOf('PA') === 0) return 'pa28';
        if (t.indexOf('C15') >= 0) return 'c152';
        if (t.indexOf('C17') >= 0 || t.indexOf('172') >= 0) return 'c172';
        return 'c172';
    }

    function aircraftSchematicFlat(key, type) {
        const s = shapeFor(key, type);

        // cadre 220 x 220, nez en haut, meme echelle pour toute la flotte
        const K = 168 / 12.0;                 // px par metre
        const cx = 110;
        const half = (s.span * K) / 2;        // demi-envergure
        const L = s.len * K;                  // longueur hors tout
        const noseY = 110 - L / 2;
        const tailY = noseY + L;

        const bodyW = 9;                      // demi-largeur du fuselage
        const wingY = noseY + L * (s.pos === 'high' ? 0.26 : 0.34);
        const chord = L * 0.20;
        const stabY = tailY - L * 0.16;
        const stabHalf = half * 0.40;
        const stabChord = L * 0.10;

        // --- aile
        let wing;
        if (s.wing === 'crank') {
            const kx = half * 0.42, ky = wingY + chord * 0.30;
            wing = `M${cx - half} ${ky} L${cx - kx} ${wingY} H${cx + kx} L${cx + half} ${ky}`
                 + ` v${chord * 0.62} L${cx + kx} ${wingY + chord} H${cx - kx} L${cx - half} ${ky + chord * 0.62} Z`;
        } else if (s.wing === 'taper') {
            const tip = chord * 0.58, ty = wingY + chord * 0.16;
            wing = `M${cx - half} ${ty} L${cx - half * 0.34} ${wingY} H${cx + half * 0.34} L${cx + half} ${ty}`
                 + ` v${tip} L${cx + half * 0.34} ${wingY + chord} H${cx - half * 0.34} L${cx - half} ${ty + tip} Z`;
        } else {
            wing = `M${cx - half} ${wingY} H${cx + half} v${chord} H${cx - half} Z`;
        }

        // --- fuselage : nez, cabine, poutre arriere
        const body = `M${cx} ${noseY}`
            + ` C${cx + bodyW * 0.8} ${noseY + L * 0.04} ${cx + bodyW} ${noseY + L * 0.12} ${cx + bodyW} ${noseY + L * 0.22}`
            + ` L${cx + bodyW} ${noseY + L * 0.48}`
            + ` L${cx + bodyW * 0.42} ${tailY - L * 0.04}`
            + ` L${cx + bodyW * 0.42} ${tailY} H${cx - bodyW * 0.42}`
            + ` L${cx - bodyW * 0.42} ${tailY - L * 0.04}`
            + ` L${cx - bodyW} ${noseY + L * 0.48}`
            + ` L${cx - bodyW} ${noseY + L * 0.22}`
            + ` C${cx - bodyW} ${noseY + L * 0.12} ${cx - bodyW * 0.8} ${noseY + L * 0.04} ${cx} ${noseY} Z`;

        // --- empennage horizontal
        const stab = s.tail === 'tee'
            ? `M${cx - stabHalf} ${stabY + stabChord * 0.55} L${cx - stabHalf * 0.25} ${stabY} H${cx + stabHalf * 0.25}`
              + ` L${cx + stabHalf} ${stabY + stabChord * 0.55} v${stabChord * 0.5} L${cx + stabHalf * 0.25} ${stabY + stabChord}`
              + ` H${cx - stabHalf * 0.25} L${cx - stabHalf} ${stabY + stabChord * 1.05} Z`
            : `M${cx - stabHalf} ${stabY + stabChord * 0.5} L${cx - bodyW * 0.5} ${stabY} H${cx + bodyW * 0.5}`
              + ` L${cx + stabHalf} ${stabY + stabChord * 0.5} v${stabChord * 0.55} H${cx - stabHalf} Z`;

        // --- derive vue de dessus, cabine, haubans
        const fin = `M${cx - 2.6} ${stabY - L * 0.06} L${cx - 1.2} ${tailY - L * 0.01} h2.4 L${cx + 2.6} ${stabY - L * 0.06} Z`;
        const cabX = bodyW * 0.62;
        const cabTop = noseY + L * 0.20;
        const cabBot = cabTop + L * (s.cabin >= 4 ? 0.30 : 0.22);
        const cabin = `M${cx - cabX} ${cabTop} H${cx + cabX} V${cabBot} H${cx - cabX} Z`;
        const struts = s.pos === 'high'
            ? `<path d="M${cx - bodyW * 0.7} ${wingY + chord * 2.1} L${cx - half * 0.52} ${wingY + chord}
                        M${cx + bodyW * 0.7} ${wingY + chord * 2.1} L${cx + half * 0.52} ${wingY + chord}"/>`
            : '';

        const propR = Math.max(22, half * 0.30);

        return `
            <div class="ac-turn${s.neutral ? ' ac-turn-import' : ''}" aria-hidden="true">
                <div class="ac-turn-inner">
                    <svg viewBox="0 0 220 220" class="ac-plan">
                        <g class="ac-disc">
                            <circle cx="${cx}" cy="110" r="${half + 8}"/>
                            <circle cx="${cx}" cy="110" r="${half * 0.55}"/>
                        </g>
                        <g class="ac-fill">
                            <path d="${wing}"/>
                            <path d="${stab}"/>
                            <path d="${body}"/>
                            <path d="${fin}"/>
                        </g>
                        <g class="ac-line">
                            <path d="${wing}"/>
                            <path d="${stab}"/>
                            <path d="${body}"/>
                            <path d="${fin}"/>
                        </g>
                        <g class="ac-detail">
                            <path d="${cabin}"/>
                            <path d="M${cx - half * 0.92} ${wingY + chord * 0.72} H${cx - half * 0.42}
                                     M${cx + half * 0.42} ${wingY + chord * 0.72} H${cx + half * 0.92}"/>
                            ${struts}
                        </g>
                        <g class="ac-prop">
                            <circle cx="${cx}" cy="${noseY + 1}" r="${propR}"/>
                            <path d="M${cx - propR} ${noseY + 1} H${cx + propR}"/>
                        </g>
                    </svg>
                </div>
            </div>`;
    }

    function renderProfileModalHtml() {
        return `
        <div id="aircraftProfileModal" class="profile-modal-overlay" style="display:none !important;">
            <div class="profile-modal-dialog">
                <div class="profile-modal-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:24px;"></span>
                        <div>
                            <h3 style="margin:0; font-size:17px; font-weight:800; color:var(--text-color);">Profils avion</h3>
                            <span style="font-size:12px; color:var(--muted-text);">Choisissez, modifiez ou importez un avion ; le profil est partagé par tous les modules</span>
                        </div>
                    </div>
                    <button class="profile-modal-close" onclick="AircraftProfiles.closeModal()">&times;</button>
                </div>

                <div class="profile-modal-tabs">
                    <button class="profile-tab-btn active" data-tab="presets">Modèles constructeur</button>
                    <button class="profile-tab-btn" data-tab="fleet">Mes avions</button>
                    <button class="profile-tab-btn" data-tab="import">Importer</button>
                    <button class="profile-tab-btn" data-tab="export">Exporter</button>
                </div>

                <div class="profile-modal-body">
                    <!-- PRESETS TAB -->
                    <div class="profile-tab-pane active" id="pane-presets">
                        <div style="font-size:13px; color:var(--muted-text); margin-bottom:14px;">
                            Partez d&rsquo;un modèle constructeur vérifié (manuel de vol) : vitesses, masse et centrage, consommation et check-lists sont configurés d&rsquo;un coup. Bouton <strong>Modifier</strong> pour en faire votre propre avion.
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
                                            <span class="preset-tag">CONSTRUCTEUR</span>
                                        </div>
                                        ${aircraftSchematic(key, p.type)}
                                        <div class="preset-desc">${escapeHtml(p.description)}</div>
                                        <div class="preset-specs">
                                            <span><strong>Croisière :</strong> ${vCruise} kt</span>
                                            <span><strong>Conso :</strong> ${p.range.fuelBurn} L/h</span>
                                            <span><strong>MTOW :</strong> ${p.profile.mtow} kg</span>
                                            <span><strong>Carburant :</strong> ${p.profile.fuelCapacity} L</span>
                                        </div>
                                        <div style="display:flex; gap:8px; margin-top:10px;">
                                            <button class="btn-action primary small" style="flex:1;">Charger ${escapeHtml(p.type)}</button>
                                            <button class="btn-action small" onclick="event.stopPropagation(); AircraftProfiles.editProfile('preset', '${key}')">Modifier</button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- MES AVIONS : profils personnels, modifiables -->
                    <div class="profile-tab-pane" id="pane-fleet">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
                            <div style="font-size:13px; color:var(--muted-text);">Vos avions, modifiables à volonté. Un profil enregistré ici garde vos valeurs (masses, vitesses, consommation).</div>
                            <button class="btn-action primary small" onclick="AircraftProfiles.newFromActive()">+ Créer depuis le profil actif</button>
                        </div>
                        <div class="preset-grid" id="fleetGrid"></div>
                    </div>

                    <!-- EDITEUR DE PROFIL -->
                    <div class="profile-tab-pane" id="pane-edit">
                        <div style="font-size:13px; color:var(--muted-text); margin-bottom:12px;" id="editIntro">Modifiez les valeurs de l'avion, puis enregistrez.</div>
                        <div class="profile-edit-grid">
                            <label>Nom<input type="text" id="editName"></label>
                            <label>Immatriculation<input type="text" id="editReg"></label>
                            <label>Type<input type="text" id="editType"></label>
                            <label>MTOW (kg)<input type="number" id="editMtow" step="1"></label>
                            <label>Carburant utilisable (L)<input type="number" id="editFuelCap" step="1"></label>
                            <label>Consommation (L/h)<input type="number" id="editBurn" step="0.5"></label>
                            <label>Vitesse de croisière (kt)<input type="number" id="editCruise" step="1"></label>
                            <label>Masse à vide (kg)<input type="number" id="editEmpty" step="1"></label>
                        </div>
                        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:16px;">
                            <button class="btn-action small" onclick="AircraftProfiles.cancelEdit()">Annuler</button>
                            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                                <button class="btn-action small" onclick="AircraftProfiles.saveEdit(false)">Enregistrer</button>
                                <button class="btn-action primary small" onclick="AircraftProfiles.saveEdit(true)">Enregistrer et charger</button>
                            </div>
                        </div>
                    </div>

                    <!-- IMPORT TAB -->
                    <div class="profile-tab-pane" id="pane-import">
                        <div class="profile-dropzone" id="profileDropzone">
                            <span style="font-size:32px; margin-bottom:8px; display:block;"></span>
                            <strong>Déposez ici un profil avion (.json)</strong>
                            <div style="font-size:12px; color:var(--muted-text); margin:6px 0 12px 0;">ou parcourez votre ordinateur</div>
                            <input type="file" id="profileFileInput" accept=".json,application/json" style="display:none;">
                            <button class="btn-action small" onclick="document.getElementById('profileFileInput').click()">Choisir un fichier JSON</button>
                        </div>

                        <div style="margin: 18px 0 8px 0; font-size:12.5px; font-weight:700; color:var(--text-color);">
                            Ou collez le code JSON du profil :
                        </div>
                        <textarea id="profilePasteArea" class="profile-paste-box" placeholder='Collez ici le JSON du profil avion...'></textarea>
                        
                        <div id="importErrorBox" class="profile-error-box" style="display:none;"></div>

                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
                            <button class="btn-action" onclick="AircraftProfiles.closeModal()">Annuler</button>
                            <button class="btn-action primary" onclick="AircraftProfiles.handlePastedImport()">Appliquer le profil</button>
                        </div>
                    </div>

                    <!-- EXPORT TAB -->
                    <div class="profile-tab-pane" id="pane-export">
                        <div style="font-size:13px; color:var(--muted-text); margin-bottom:14px;">
                            Exportez l&rsquo;avion actif avec ses vitesses, ses stations de centrage, sa consommation et ses procédures :
                        </div>

                        <div class="profile-summary-box" id="profileExportSummary"></div>

                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                            <button class="btn-action" onclick="AircraftProfiles.copyJsonToClipboard()">Copier le JSON</button>
                            <button class="btn-action primary" onclick="AircraftProfiles.exportAndDownload()">Télécharger le fichier .json</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    function injectGlobalProfileButtonCss() {
        if (typeof document === 'undefined' || !document.createElement || !document.head) return;
        if (document.getElementById('aircraftProfileButtonStyles')) return;
        const style = document.createElement('style');
        style.id = 'aircraftProfileButtonStyles';
        style.textContent = `
            .btn-aircraft-profile {
                background: var(--panel-2, #0D1621) !important;
                color: var(--cyan, #4FD8C4) !important;
                border: 1px solid var(--line-strong, #3A4B5F) !important;
                font-family: var(--f-mono, 'IBM Plex Mono', monospace) !important;
                font-size: 11.5px !important;
                font-weight: 700 !important;
                letter-spacing: .08em !important;
                text-transform: uppercase !important;
                border-radius: var(--r-sm, 8px) !important;
                transition: all 0.2s ease !important;
            }
            .btn-aircraft-profile:hover {
                border-color: var(--cyan, #4FD8C4) !important;
                background: var(--cyan-soft, rgba(79, 216, 196, 0.12)) !important;
                color: var(--cyan, #4FD8C4) !important;
                transform: translateY(-1px);
                box-shadow: 0 0 16px rgba(79, 216, 196, 0.35) !important;
            }
            .btn-aircraft-profile:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    // Auto-inject global button styles so all pages share the exact same cockpit theme
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectGlobalProfileButtonCss);
        } else {
            injectGlobalProfileButtonCss();
        }
    }

    function injectProfileEditCss() {
        if (document.getElementById('profileEditCss')) return;
        const st = document.createElement('style');
        st.id = 'profileEditCss';
        st.textContent = `
            .profile-edit-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; }
            .profile-edit-grid label { display:flex; flex-direction:column; gap:5px; font-family:var(--f-mono); font-size:10.5px;
                                       font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--text-secondary); }
            .profile-edit-grid input { background:var(--panel-2) !important; border:1px solid var(--line) !important; border-radius:8px !important;
                                       color:var(--text) !important; font-family:var(--f-mono) !important; font-size:13.5px !important; padding:9px 11px !important; }
            :root .btn-delete-profile { border-color:color-mix(in srgb, var(--danger) 45%, transparent) !important; }
            /* profil importe : cadre et etiquette distincts, invariables */
            .preset-card.is-import { border-color:color-mix(in srgb, var(--cyan) 45%, transparent);
                                     background:linear-gradient(180deg, color-mix(in srgb, var(--cyan) 6%, transparent), transparent 58%), var(--panel-2); }
            .preset-tag.tag-import { background:var(--cyan-soft) !important; color:var(--cyan) !important;
                                     border-color:color-mix(in srgb, var(--cyan) 45%, transparent) !important; }
            .ac-turn-import .ac-line path { stroke:var(--cyan); }
            .ac-turn-import .ac-detail path { stroke:var(--cyan); opacity:.4; }
            /* Schema de l'avion : vue de dessus au trait, qui tourne sur elle-meme.
               L'inclinaison reste faible pour que la silhouette reste lisible. */
            .ac-turn { height:120px; margin:12px 0 6px; display:flex; align-items:center; justify-content:center;
                       perspective:900px; perspective-origin:50% 50%; }
            .ac-turn-inner { width:150px; height:150px; transform-style:preserve-3d;
                             animation:acSpin 14s linear infinite; }
            .preset-card:hover .ac-turn-inner { animation-duration:6s; }
            @keyframes acSpin {
                from { transform:rotateX(22deg) rotateZ(0deg); }
                to   { transform:rotateX(22deg) rotateZ(360deg); }
            }
            .ac-plan { width:100%; height:100%; display:block; overflow:visible; }
            .ac-3d-wrap { perspective:none; height:118px; }
            .ac-3d { width:100%; height:100%; display:block; }
            .ac-3d-wrap.no3d::after { content:'Modèle 3D indisponible'; font-family:var(--f-mono); font-size:9px;
                                      letter-spacing:.1em; text-transform:uppercase; color:var(--muted-text); }
            /* corps rempli d'une teinte de panneau, contour net : lisible en clair comme en sombre */
            .ac-fill path { fill:var(--panel-2, #0D1621); stroke:none; }
            .ac-line path { fill:none; stroke:var(--text-color); stroke-width:2.6;
                            stroke-linejoin:round; stroke-linecap:round; opacity:.92; }
            .ac-detail path { fill:none; stroke:var(--text-color); stroke-width:1.5;
                              stroke-linejoin:round; stroke-linecap:round; opacity:.45; }
            .ac-prop circle { fill:none; stroke:var(--cyan); stroke-width:1.6; stroke-dasharray:3 5; opacity:.65; }
            .ac-prop path { stroke:var(--cyan); stroke-width:2.6; stroke-linecap:round; opacity:.85; }
            .ac-disc circle { fill:none; stroke:var(--cyan); stroke-width:1; opacity:.16; }
            @media (prefers-reduced-motion: reduce) {
                .ac-turn-inner, .preset-card:hover .ac-turn-inner { animation:none; transform:rotateX(22deg) rotateZ(-18deg); }
            }
        `;
        document.head.appendChild(st);
    }

    function injectProfileModalCss() {
        if (typeof document === 'undefined' || !document.createElement || !document.head) return;
        if (document.getElementById('aircraftProfileStyles')) return;
        const style = document.createElement('style');
        style.id = 'aircraftProfileStyles';
        style.textContent = `
            .profile-modal-overlay {
                position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
                background: rgba(10, 17, 25, 0.85) !important; backdrop-filter: blur(8px) !important; -webkit-backdrop-filter: blur(8px) !important;
                z-index: 2147483647 !important; display: none !important; align-items: center !important; justify-content: center !important;
                padding: 20px !important; box-sizing: border-box !important;
            }
            .profile-modal-overlay.open {
                display: flex !important;
            }
            .profile-modal-dialog {
                background: var(--panel, #111B29); color: var(--text, #E9EFF3);
                border: 1px solid var(--line-strong, #3A4B5F); border-radius: var(--r, 14px);
                width: 720px; max-width: 95vw; max-height: 90vh;
                display: flex; flex-direction: column; box-shadow: var(--shadow, 0 30px 80px -30px rgba(0, 0, 0, 0.65));
                overflow: hidden; animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: var(--f-body, system-ui, sans-serif);
            }
            @keyframes popIn {
                from { transform: scale(0.96); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            .profile-modal-header {
                padding: 16px 22px; border-bottom: 1px solid var(--line, #243141);
                display: flex; align-items: center; justify-content: space-between;
                background: var(--panel-2, #0D1621);
            }
            .profile-modal-header h3 {
                margin: 0; font-family: var(--f-display, 'Big Shoulders Display', sans-serif);
                font-size: 20px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
                color: var(--text, #E9EFF3);
            }
            .profile-modal-close {
                background: transparent; border: none; font-size: 20px; font-weight: 700;
                color: var(--muted, #93A7B8); cursor: pointer; line-height: 1; transition: color 0.15s;
            }
            .profile-modal-close:hover {
                color: var(--text, #E9EFF3);
            }
            .profile-modal-tabs {
                display: flex; border-bottom: 1px solid var(--line, #243141);
                background: var(--panel-2, #0D1621);
            }
            .profile-tab-btn {
                padding: 12px 18px; border: none; background: transparent;
                color: var(--muted, #93A7B8); font-family: var(--f-mono, monospace);
                font-weight: 700; font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase;
                cursor: pointer; border-right: 1px solid var(--line, #243141);
                transition: background 0.15s ease, color 0.15s ease;
            }
            .profile-tab-btn:hover {
                color: var(--text, #E9EFF3); background: var(--panel-hover, #172436);
            }
            .profile-tab-btn.active {
                background: var(--panel, #111B29); color: var(--cyan, #4FD8C4);
                border-bottom: 2px solid var(--cyan, #4FD8C4); margin-bottom: -1px;
            }
            .profile-modal-body {
                padding: 20px; overflow-y: auto; flex: 1; background: var(--panel, #111B29);
            }
            .profile-tab-pane { display: none; }
            .profile-tab-pane.active { display: block; }
            
            .preset-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;
            }
            .preset-card {
                border: 1px solid var(--line, #243141); border-radius: var(--r-sm, 8px);
                padding: 14px; background: var(--panel-2, #0D1621); cursor: pointer;
                transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
            }
            .preset-card:hover {
                transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                border-color: var(--cyan, #4FD8C4);
            }
            .preset-header {
                display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;
            }
            .preset-title { font-family: var(--f-display, sans-serif); font-size: 17px; font-weight: 800; letter-spacing: .02em; color: var(--text, #E9EFF3); text-transform: uppercase; }
            .preset-sub { font-family: var(--f-mono, monospace); font-size: 11px; color: var(--muted, #93A7B8); margin-top: 2px; }
            .preset-tag {
                font-family: var(--f-mono, monospace); font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
                background: var(--cyan-soft, rgba(79, 216, 196, 0.12)); color: var(--cyan, #4FD8C4);
                border: 1px solid var(--line-strong, #3A4B5F); white-space: nowrap;
            }
            .preset-desc {
                font-size: 12px; color: var(--muted, #93A7B8); line-height: 1.45; margin-bottom: 10px;
            }
            .preset-specs {
                display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-size: 11px;
                padding: 8px 10px; background: var(--panel, #111B29); border-radius: 4px;
                border: 1px solid var(--line, #243141); font-family: var(--f-mono, monospace);
                color: var(--text, #E9EFF3);
            }
            .profile-dropzone {
                border: 1.5px dashed var(--line-strong, #3A4B5F); border-radius: var(--r-sm, 8px);
                padding: 28px 20px; text-align: center; background: var(--panel-2, #0D1621);
                cursor: pointer; transition: all 0.2s ease;
            }
            .profile-dropzone.dragover, .profile-dropzone:hover { background: var(--panel-hover, #172436); border-color: var(--cyan, #4FD8C4); }
            .profile-paste-box {
                width: 100%; height: 140px; box-sizing: border-box; font-family: var(--f-mono, monospace);
                font-size: 11.5px; padding: 12px; border: 1px solid var(--line-strong, #3A4B5F);
                border-radius: var(--r-sm, 8px); background: var(--panel-2, #0D1621); color: var(--text, #E9EFF3);
                resize: vertical; outline: none;
            }
            .profile-paste-box:focus { border-color: var(--accent, #FFA94D); }
            .profile-error-box {
                margin-top: 10px; padding: 10px 14px; background: var(--danger-soft, rgba(244, 63, 94, 0.14)); color: var(--danger, #F43F5E);
                border: 1px solid var(--danger, #F43F5E); border-radius: 6px; font-size: 12px; font-weight: 600; font-family: var(--f-mono, monospace);
            }
            .profile-summary-box {
                padding: 14px 16px; background: var(--panel-2, #0D1621); border: 1px solid var(--line, #243141);
                border-radius: var(--r-sm, 8px); font-size: 12.5px; line-height: 1.6; font-family: var(--f-mono, monospace); color: var(--text, #E9EFF3);
            }
        `;
        document.head.appendChild(style);
        injectProfileEditCss();
    }

    function initModalDom() {
        if (typeof document === 'undefined' || !document.createElement || !document.body) return;
        if (document.getElementById('aircraftProfileModal')) return;
        injectProfileModalCss();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderProfileModalHtml();
        const modalEl = wrapper.querySelector('#aircraftProfileModal') || wrapper.firstElementChild;
        if (modalEl) {
            modalEl.classList.remove('open');
            modalEl.style.setProperty('display', 'none', 'important');
            modalEl.style.visibility = 'hidden';
            modalEl.style.opacity = '0';
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
                setProfileOrigin('import');
                registerImported(normalized);
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
            setProfileOrigin('import');
            registerImported(normalized);
            showSuccessAndReload(`✓ Successfully applied profile for ${normalized.name}!`);
        } catch (err) {
            showError(err.message);
        }
    }

    // ---------------------------------------------------------------
    // Profils personnels : chaque avion peut etre modifie et conserve
    // ---------------------------------------------------------------
    const CUSTOM_KEY = 'flightprep_custom_aircraft_v1';
    let editingDraft = null;

    function getCustomProfiles() {
        try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (e) { return []; }
    }
    function setCustomProfiles(list) {
        try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch (e) {}
    }
    function activeProfileObject() {
        let perf = {};
        try { perf = JSON.parse(localStorage.getItem(PERF_STORAGE_KEY) || '{}'); } catch (e) {}
        const base = JSON.parse(JSON.stringify(AIRCRAFT_PRESETS[Object.keys(AIRCRAFT_PRESETS)[0]]));
        base.name = (perf.profile && perf.profile.type) ? ('Mon ' + perf.profile.type) : 'Mon avion';
        base.reg = (perf.profile && (perf.profile.reg || perf.profile.registration)) || base.reg;
        base.type = (perf.profile && perf.profile.type) || base.type;
        base.description = 'Profil personnel enregistré depuis les performances en cours.';
        if (perf.profile) base.profile = Object.assign({}, base.profile, perf.profile);
        if (Array.isArray(perf.speeds) && perf.speeds.length) base.speeds = perf.speeds;
        if (Array.isArray(perf.wbRows) && perf.wbRows.length) base.wbRows = perf.wbRows;
        if (perf.range) base.range = Object.assign({}, base.range, perf.range);
        if (perf.fuelFlow) base.range.fuelBurn = perf.fuelFlow;
        return base;
    }

    function renderFleet() {
        const grid = document.getElementById('fleetGrid');
        if (!grid) return;
        const list = getCustomProfiles();
        if (!list.length) {
            grid.innerHTML = '<div style="padding:22px; border:1px dashed var(--line-strong); border-radius:12px; text-align:center; color:var(--muted-text); font-size:13px;">Aucun avion enregistré. Partez d\'un modèle constructeur (bouton Modifier) ou du profil actif.</div>';
            return;
        }
        grid.innerHTML = list.map(item => {
            const d = item.data || {};
            const cruise = (d.speeds || []).find(sp => sp.name === 'Vc');
            return `
                <div class="preset-card${item.imported ? ' is-import' : ''}">
                    <div class="preset-header">
                        <div>
                            <strong class="preset-title">${escapeHtml(d.name || 'Avion')}</strong>
                            <div class="preset-sub">${escapeHtml(d.reg || '')} &bull; ${escapeHtml(d.type || '')}</div>
                        </div>
                        <span class="preset-tag${item.imported ? ' tag-import' : ''}">${item.imported ? 'IMPORTÉ' : 'MON AVION'}</span>
                    </div>
                    ${aircraftSchematic(item.shapeKey || '', d.type)}
                    <div class="preset-specs">
                        <span><strong>Croisière :</strong> ${cruise ? cruise.value : '—'} kt</span>
                        <span><strong>Conso :</strong> ${(d.range && d.range.fuelBurn) || '—'} L/h</span>
                        <span><strong>MTOW :</strong> ${(d.profile && d.profile.mtow) || '—'} kg</span>
                        <span><strong>À vide :</strong> ${(d.profile && d.profile.emptyWeight) || '—'} kg</span>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        <button class="btn-action primary small" style="flex:1;" onclick="AircraftProfiles.loadCustom('${item.id}')">Charger</button>
                        <button class="btn-action small" onclick="AircraftProfiles.editProfile('custom', '${item.id}')">Modifier</button>
                        <button class="btn-action small btn-danger btn-delete-profile" onclick="AircraftProfiles.deleteCustom('${item.id}')">Supprimer</button>
                    </div>
                </div>`;
        }).join('');
    }

    function goToTab(tab) {
        const modal = document.getElementById('aircraftProfileModal');
        if (!modal) return;
        // l'editeur n'a pas d'onglet propre : on garde Mes avions en surbrillance
        const lit = tab === 'edit' ? 'fleet' : tab;
        modal.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === lit));
        modal.querySelectorAll('.profile-tab-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + tab));
    }

    function editProfile(source, id) {
        let data = null;
        if (source === 'preset') data = JSON.parse(JSON.stringify(AIRCRAFT_PRESETS[id] || {}));
        else if (source === 'custom') {
            const item = getCustomProfiles().find(x => x.id === id);
            data = item ? JSON.parse(JSON.stringify(item.data)) : null;
        } else data = activeProfileObject();
        if (!data || !data.profile) return;
        const shapeKey = source === 'preset' ? id
            : (source === 'custom' ? (getCustomProfiles().find(x => x.id === id) || {}).shapeKey : '');
        editingDraft = { id: source === 'custom' ? id : null, shapeKey: shapeKey || '', data: data };
        const cruise = (data.speeds || []).find(sp => sp.name === 'Vc');
        const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val === undefined || val === null ? '' : val; };
        set('editName', data.name); set('editReg', data.reg); set('editType', data.type);
        set('editMtow', data.profile.mtow); set('editFuelCap', data.profile.fuelCapacity);
        set('editBurn', data.range && data.range.fuelBurn); set('editCruise', cruise && cruise.value);
        set('editEmpty', data.profile.emptyWeight);
        const intro = document.getElementById('editIntro');
        if (intro) intro.textContent = source === 'custom'
            ? 'Modification de votre avion. Les valeurs remplacent celles enregistrées.'
            : "Copie du modèle constructeur : vos modifications seront enregistrées dans Mes avions, le modèle d'origine reste intact.";
        goToTab('edit');
    }

    function cancelEdit() { editingDraft = null; renderFleet(); goToTab('fleet'); }

    function saveEdit(alsoLoad) {
        if (!editingDraft) return;
        const num = elId => { const el = document.getElementById(elId); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? null : v; };
        const txt = elId => { const el = document.getElementById(elId); return el ? el.value.trim() : ''; };
        const d = editingDraft.data;
        d.name = txt('editName') || d.name;
        d.reg = txt('editReg') || d.reg;
        d.type = txt('editType') || d.type;
        if (num('editMtow') !== null) d.profile.mtow = num('editMtow');
        if (num('editFuelCap') !== null) d.profile.fuelCapacity = num('editFuelCap');
        d.range = d.range || {};
        if (num('editBurn') !== null) d.range.fuelBurn = num('editBurn');
        const cruise = (d.speeds || []).find(sp => sp.name === 'Vc');
        if (cruise && num('editCruise') !== null) cruise.value = num('editCruise');
        if (num('editEmpty') !== null) d.profile.emptyWeight = num('editEmpty');

        const list = getCustomProfiles();
        if (editingDraft.id) {
            const item = list.find(x => x.id === editingDraft.id);
            if (item) { item.data = d; item.shapeKey = editingDraft.shapeKey; }
            else list.push({ id: editingDraft.id, shapeKey: editingDraft.shapeKey, data: d });
        } else {
            editingDraft.id = 'ac-' + Date.now().toString(36);
            list.push({ id: editingDraft.id, shapeKey: editingDraft.shapeKey, data: d });
        }
        setCustomProfiles(list);
        renderFleet();
        if (alsoLoad) {
            const normalized = importAircraftProfile(d);
            setProfileOrigin(editingDraft.shapeKey || 'import');
            showSuccessAndReload('Avion enregistré et chargé : ' + normalized.name);
        } else {
            showToast('Avion enregistré dans Mes avions');
            editingDraft = null;
            goToTab('fleet');
        }
    }

    // Un profil importe rejoint Mes avions : il y garde sa fiche, sa livree
    // neutre et son etiquette, quelles que soient les valeurs du fichier.
    function registerImported(normalized) {
        try {
            const list = getCustomProfiles();
            const id = 'ac-imp-' + Date.now().toString(36);
            const data = JSON.parse(JSON.stringify(normalized || {}));
            data.name = data.name || 'Profil importé';
            list.push({ id: id, shapeKey: 'import', imported: true, data: data });
            setCustomProfiles(list);
        } catch (e) {}
    }

    function loadCustom(id) {
        const item = getCustomProfiles().find(x => x.id === id);
        if (!item) return;
        const normalized = importAircraftProfile(item.data);
        setProfileOrigin(item.shapeKey || 'import');
        showSuccessAndReload('Avion chargé : ' + normalized.name);
    }

    function deleteCustom(id) {
        const item = getCustomProfiles().find(x => x.id === id);
        if (!item) return;
        if (!confirm('Supprimer « ' + ((item.data && item.data.name) || 'cet avion') + ' » ?')) return;
        setCustomProfiles(getCustomProfiles().filter(x => x.id !== id));
        renderFleet();
    }

    function newFromActive() { editProfile('active'); }

    function loadPreset(presetKey) {
        const preset = AIRCRAFT_PRESETS[presetKey];
        if (!preset) return;
        const normalized = importAircraftProfile(preset);
        setProfileOrigin(presetKey);
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
        toast.innerHTML = (type === 'success' ? '✓ ' : '') + escapeHtml(msg);
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
                ${escapeHtml(profileName)} (${escapeHtml(profileReg)})
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
                showToast('Copie impossible. Utilisez le bouton Télécharger.', 'error');
            });
        } else {
            showToast('Presse-papiers indisponible. Utilisez le bouton Télécharger.', 'error');
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
                fuelCapacity: parseFloat(perfData.profile?.fuelCapacity) || 0,
                fuelDensity: parseFloat(perfData.profile?.fuelDensity) || 0.72
            },
            speeds: Array.isArray(perfData.speeds) ? perfData.speeds : [],
            range: {
                fuelOnBoard: parseFloat(perfData.range?.fuelOnBoard) || 0,
                fuelBurn: parseFloat(perfData.range?.fuelBurn) || 0,
                reserveMin: parseFloat(perfData.range?.reserveMin) || 45,
                cruiseTas: perfData.range?.cruiseTas || 'Vc',
                taxiFuel: parseFloat(perfData.range?.taxiFuel) || 0,
                climbMinutes: parseFloat(perfData.range?.climbMinutes) || 8,
                alternateMinutes: parseFloat(perfData.range?.alternateMinutes) || 20
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
        modal.classList.add('open');
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';

        // Select default tab
        renderFleet();
        if (window.AltiviewCard3D) setTimeout(() => AltiviewCard3D.mount(modal), 30);
        const tabBtn = modal.querySelector(`.profile-tab-btn[data-tab="${defaultTab}"]`);
        if (tabBtn) tabBtn.click();
    }

    function closeModal() {
        if (window.AltiviewCard3D) AltiviewCard3D.unmount();
        const modal = document.getElementById('aircraftProfileModal');
        if (modal) {
            modal.classList.remove('open');
            modal.style.setProperty('display', 'none', 'important');
            modal.style.visibility = 'hidden';
            modal.style.opacity = '0';
        }
        const errBox = document.getElementById('importErrorBox');
        if (errBox) errBox.style.display = 'none';
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Modal is initialized strictly on demand (when openModal is called by the pilot)
    // to prevent unwanted modal popups on initial page loads.

    // Export API
    global.AircraftProfiles = {
        SCHEMA_VERSION,
        PRESETS: AIRCRAFT_PRESETS,
        exportProfile: exportAircraftProfile,
        importProfile: importAircraftProfile,
        validateProfile: validateAndNormalizeAircraftProfile,
        openModal: openModal,
        getProfileOrigin: getProfileOrigin,
        setProfileOrigin: setProfileOrigin,
        editProfile: editProfile,
        saveEdit: saveEdit,
        cancelEdit: cancelEdit,
        loadCustom: loadCustom,
        deleteCustom: deleteCustom,
        newFromActive: newFromActive,
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
