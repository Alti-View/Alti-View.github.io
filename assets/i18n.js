/* ALTIVIEW · FR / EN
   French is the source text in the HTML. English is swapped in node by node (text, attributes, meta),
   including text the other scripts write later, through a MutationObserver. French is restored exactly. */
(function () {
  'use strict';

  var EN = {
    /* head */
    'Altiview · Préparation et conduite du vol VFR': 'Altiview · VFR flight planning and flying',
    "Altiview réunit météo, NavLog, carte des espaces aériens, performances, checklists et procédures d'urgence dans une seule application pour pilotes VFR. Prepare, fly, improve.": 'Altiview brings weather, NavLog, airspace map, performance, checklists and emergency procedures together in one app for VFR pilots. Prepare, fly, improve.',
    'Altiview · Tout votre vol, une seule application': 'Altiview · Your entire flight, in one app',
    'Préparation et conduite du vol VFR dans une seule application : météo, NavLog, carte, performances, checklists, urgences.': 'VFR flight planning and flying in a single app: weather, NavLog, map, performance, checklists, emergencies.',

    /* nav */
    'Aller au contenu': 'Skip to content',
    'Altiview, retour en haut de page': 'Altiview, back to top',
    'Navigation principale': 'Main navigation',
    'Performances': 'Performance',
    'Plateformes': 'Platforms',
    'Abonnements': 'Pricing',
    'Se connecter': 'Log in',
    'Mode jour': 'Day mode',
    'Ouvrir le menu': 'Open menu',
    'Fermer le menu': 'Close menu',

    /* hero */
    'Tout votre vol, une seule application': 'Your entire flight, in one app',
    'Tout': 'Your', 'votre': 'entire', 'vol,': 'flight,', 'une': 'in', 'seule': 'one', 'application': 'app',
    "Carte interactive, calcul automatique des performances, dossier de vol en PDF, checklists et procédures d'urgence. Préparez votre navigation au sol, gardez l'essentiel sous les yeux en vol.": 'Interactive map, automatic performance calculations, PDF flight file, checklists and emergency procedures. Plan your trip on the ground, keep what matters in sight in the air.',
    "Voir l'application": 'See the app',
    'Pour les pilotes privés, élèves pilotes et instructeurs.': 'For private pilots, student pilots and instructors.',
    'ASSIETTE': 'PITCH', 'INCLINAISON': 'BANK',
    'DÉFILER': 'SCROLL', 'Défiler vers la suite': 'Scroll down',

    /* 01 constat */
    '01 · Le constat': '01 · The problem',
    "Aujourd'hui, un vol se prépare en morceaux": 'Today, a flight is planned in pieces',
    'Le METAR sur un site, les NOTAM sur un autre, la carte VAC en PDF, le devis de masse et centrage sur un tableur, le log de nav au crayon, la checklist sur papier. Chaque outil fait son travail. Altiview les fait travailler ensemble.': 'The METAR on one site, NOTAMs on another, the approach chart in a PDF, weight and balance in a spreadsheet, the nav log in pencil, the checklist on paper. Each tool does its job. Altiview makes them work together.',
    'Cartes AZBA': 'AZBA charts', 'SUP AIP': 'AIP SUP', 'Carte VAC · PDF': 'VAC chart · PDF', 'Carte OACI 1:500 000': 'ICAO chart 1:500,000',
    'Devis de masse · tableur': 'W&B · spreadsheet', 'Log de nav · crayon': 'Nav log · pencil', 'Manuel de vol': 'Flight manual',
    'Checklist plastifiée': 'Laminated checklist', 'Calculatrice': 'Calculator', 'Plan de vol': 'Flight plan',
    'Un seul dossier de vol': 'One flight file',

    /* 02 modules */
    '5 outils, une seule plateforme': '5 tools, one platform',
    'Chaque module reprend les données des autres. Vous chargez votre avion une fois, vous tracez votre route une fois, et tout le reste suit.': "Each module reuses the others' data. Load your aircraft once, draw your route once, and everything else follows.",
    'Préparation de vol': 'Flight preparation',
    'Log de nav, METAR et TAF décodés, NOTAM triés par catégorie, carburant et briefing avant vol, réunis dans un seul dossier.': 'Nav log, decoded METAR and TAF, NOTAMs sorted by category, fuel and pre-flight briefing, all in one file.',
    'Log de nav : altitude, distance, vitesse et temps estimé par branche': 'Nav log: altitude, distance, speed and estimated time per leg',
    'NOTAM décodés et classés : pistes, navigation, obstacles…': 'NOTAMs decoded and sorted: runways, navigation, obstacles…',
    'Check I.M.S.A.F.E. et documents de bord avant de monter à bord': 'I.M.S.A.F.E. check and on-board documents before you climb in',
    'Dossier de vol complet exporté en PDF': 'Complete flight file exported as PDF',
    'Carte interactive': 'Interactive map',
    'Carte interactive pour préparer et planifier vos vols. Filtrez vos vols par altitude.': 'Interactive map to prepare and plan your flights. Filter your flights by altitude.',
    'CTR, TMA, zones P, R et D, RMZ, TMZ et secteurs SIV': 'CTR, TMA, P, R and D areas, RMZ, TMZ and FIS sectors',
    'Coupe verticale : votre profil face aux planchers et plafonds': 'Vertical profile: your flight path against floors and ceilings',
    'Espaces aériens traversés listés branche par branche': 'Airspace crossed, listed leg by leg',
    'Vent en altitude repris dans le log de nav': 'Winds aloft carried into the nav log',
    'Performances aéronef': 'Aircraft performance',
    'Masse et centrage. Distances de décollage/atterrissage, vent de travers, autonomie, vitesses caractéristiques…': 'Weight and balance. Take-off/landing distances, crosswind, endurance, V-speeds…',
    "Centrage vérifié dans l'enveloppe technique": 'CG checked against the technical envelope',
    'Autonomie, réserve finale et distance franchissable': 'Endurance, final reserve and range',
    'Devis de masse et centrage': 'Weight and balance sheet',
    "Checklists organisées dans l'ordre des phases de vol.": 'Checklists organized by phase of flight.',
    "De la visite prévol à l'arrêt moteur": 'From pre-flight inspection to engine shutdown',
    'Une liste par avion de votre flotte': 'One list per aircraft in your fleet',
    'Import et export JSON pour les partager en club': 'JSON import and export to share them at your club',
    "Procédures d'urgence": 'Emergency procedures',
    "Actions mémoire, checklists d'urgence rapides, calculateur de plané et message de détresse prêt pour le 121.5 MHz.": 'Memory items, quick emergency checklists, glide calculator and a distress call ready for 121.5 MHz.',
    'Vitesse de finesse maximale toujours visible': 'Best glide speed always in view',
    'Distance de plané et temps avant contact sol': 'Glide distance and time to touchdown',
    "Des checklists d'urgence à portée de main": 'Emergency checklists within reach',

    /* 03 navigation */
    'Vérification des espaces aériens': 'Airspace check',
    'Tracez la navigation sur la carte : Altiview construit le log de nav et vérifie chaque branche avec les espaces aériens, du plancher au plafond.': 'Draw your route on the map: Altiview builds the nav log and checks every leg against airspace, from floor to ceiling.',
    'LOG DE NAV · EXEMPLE': 'NAV LOG · EXAMPLE',
    'Branche': 'Leg', 'Rm': 'MC', 'Temps': 'Time',
    'DÉP → PT1': 'DEP → WP1', 'PT1 → PT2': 'WP1 → WP2', 'PT2 → PT3': 'WP2 → WP3', 'PT3 → ARR': 'WP3 → ARR',
    'DÉP': 'DEP', 'PT1': 'WP1', 'PT2': 'WP2', 'PT3': 'WP3',
    'BRANCHE': 'LEG', 'CARBURANT': 'FUEL',
    'Route volée': 'Flown route', 'Route prévue': 'Planned route', 'Espaces aériens': 'Airspace',

    /* 04 performances */
    '04 · Performances': '04 · Performance',
    "Des profils d'avions prédéfinis": 'Predefined aircraft profiles',
    'Altiview part des performances de votre aéronef et les applique aux conditions réelles du jour.': "Altiview starts from your aircraft's performance and applies it to the actual conditions of the day.",
    'Avion précédent': 'Previous aircraft', 'Avion suivant': 'Next aircraft', 'PROFIL': 'PROFILE',
    "Changer d'avion, profil actuel : Robin DR-400": 'Change aircraft, current profile: Robin DR-400',
    'Vitesse de croisière': 'Cruise speed', 'Masse max': 'MTOW', 'Carburant utilisable': 'Usable fuel',
    'Consommation': 'Fuel burn', 'Autonomie': 'Endurance', 'Distance franchissable': 'Range',
    'Profils constructeur prêts': 'Built-in manufacturer profiles',
    'Ou créez le profil de votre avion à partir de son manuel de vol, puis partagez-le en JSON.': "Or build your own aircraft's profile from its flight manual, then share it as JSON.",
    'Moteur': 'Engine', 'Places': 'Seats', 'Carburant': 'Fuel',
    "Quadriplace à aile haute haubanée, avionique Garmin. L'avion le plus construit de l'histoire.": 'Strut-braced high-wing four-seater with Garmin avionics. The most-built aircraft in history.',
    'Avion de voyage français à structure bois, aile Jodel et visibilité avant exceptionnelle.': 'French wooden touring aircraft with a Jodel wing and outstanding forward visibility.',
    'Aile basse tout métal, robuste et stable, apprécié en voyage comme en vol aux instruments.': 'All-metal low wing, rugged and stable, valued for touring and instrument flying alike.',
    'Cellule composite, moteur diesel au Jet A-1 et gestion FADEC à levier unique.': 'Composite airframe, Jet A-1 diesel engine and single-lever FADEC control.',
    'Biplace école à aile haute, économique et tolérant.': 'High-wing two-seat trainer, economical and forgiving.',
    'Lycoming IO-360-L2A · 180 ch': 'Lycoming IO-360-L2A · 180 hp', 'Lycoming O-235 · 118 ch': 'Lycoming O-235 · 118 hp',
    'Lycoming O-360-A4M · 180 ch': 'Lycoming O-360-A4M · 180 hp', 'Austro Engine AE300 · 168 ch': 'Austro Engine AE300 · 168 hp',
    'Lycoming O-235-L2C · 110 ch': 'Lycoming O-235-L2C · 110 hp',

    /* 05 aperçu */
    '05 · Aperçu': '05 · Preview',
    'Ordinateur, tablette ou téléphone': 'Computer, tablet or phone',
    "Une carte fluide, une interface pensée pour le cockpit, et des informations lisibles d'un coup d'œil.": 'A smooth map, an interface designed for the cockpit, and information you can read at a glance.',
    "Modules de l'application": 'App modules',
    'Préparation': 'Planning', 'Carte': 'Map', 'Urgences': 'Emergencies',
    'Navigation du 10 septembre · départ 14:30 UTC · 2 POB': 'Flight of 10 September · departure 14:30 UTC · 2 POB',
    'MÉTÉO DÉPART': 'DEPARTURE WEATHER', 'Vent': 'Wind', 'Visibilité': 'Visibility', '10 km et plus': '10 km or more',
    'Nuages': 'Clouds', 'quelques-uns à 3 500 ft': 'few at 3,500 ft', 'Rosée': 'Dew point',
    '6 ACTIFS': '6 ACTIVE', 'Pistes et voies de circulation': 'Runways and taxiways', 'Navigation et radio': 'Navigation and radio',
    'Obstacles et dangers': 'Obstacles and hazards', 'LOG DE NAV': 'NAV LOG',
    'Altitude de croisière 3 500 ft · couches CTR, TMA, P, R, D': 'Cruise altitude 3,500 ft · CTR, TMA, P, R, D layers',
    'ESPACES TRAVERSÉS': 'AIRSPACE CROSSED', 'TMA · plancher 4500 ft': 'TMA · floor 4500 ft', 'Sous': 'Below', 'Zone R · SFC / 2500': 'R area · SFC / 2500',
    'Masse et centrage · autonomie · profil': 'Weight and balance · endurance · profile:',
    'MASSE AU DÉCOLLAGE': 'TAKE-OFF WEIGHT', 'MARGE / MTOW': 'MARGIN / MTOW', 'AUTONOMIE': 'ENDURANCE',
    'ENVELOPPE DE CENTRAGE': 'CG ENVELOPE', 'DANS LES LIMITES': 'WITHIN LIMITS', 'L UTILISABLES': 'L USABLE',
    'Réserve finale': 'Final reserve', 'Navigation prévue': 'Planned flight',
    'Avant décollage · touchez un item pour le valider': 'Before take-off · tap an item to check it',
    'AVANT DÉCOLLAGE': 'BEFORE TAKE-OFF', 'Freins': 'Brakes', 'SERRÉS': 'SET', 'Portes et ceintures': 'Doors and belts', 'FERMÉES': 'CLOSED',
    'Commandes de vol': 'Flight controls', 'LIBRES': 'FREE', 'Instruments et altimètre': 'Instruments and altimeter', 'CALÉS': 'SET',
    'RÉSERVOIR PLEIN': 'FULLEST TANK', 'Volets': 'Flaps', 'DÉCOLLAGE': 'TAKE-OFF', 'Transpondeur': 'Transponder', 'Phares': 'Lights', 'ALLUMÉS': 'ON',
    'Panne moteur en vol': 'Engine failure in flight',
    "Piloter d'abord, meilleure finesse, puis actions mémoire.": 'Fly the aircraft first, best glide, then memory items.',
    'FINESSE MAX': 'BEST GLIDE', 'DISTANCE DE PLANÉ': 'GLIDE DISTANCE', 'AVANT CONTACT SOL': 'TO TOUCHDOWN',
    'MESSAGE DE DÉTRESSE': 'DISTRESS CALL', '121,5 MHz': '121.5 MHz',
    'panne moteur': 'engine failure', '10 NM sud-ouest de Biarritz': '10 NM south-west of Biarritz', '4 500 ft': '4,500 ft', 'en descente,': 'descending,',
    'intention atterrissage en campagne, 2 personnes à bord.': 'intending to land in a field, 2 persons on board.',
    'Conçu pour tous les supports': 'Built for every device',
    'Altiview sur ordinateur portable': 'Altiview on a laptop', 'Altiview sur téléphone': 'Altiview on a phone',

    /* 06 abonnements */
    '06 · Abonnements': '06 · Pricing',
    'Nos abonnements': 'Our plans',
    'Commencez gratuitement pendant votre formation, passez au plan complet quand vous partez en navigation, équipez tout le club quand il le faut.': "Start free while you train, move to the full plan when you start flying cross-country, equip the whole club when it's time.",
    'Élève & découverte': 'Student & discovery', '0 euro': 'free', '/ accès anticipé': '/ early access',
    'Pour les élèves pilotes et les curieux qui veulent tester Altiview lors de leurs premiers vols.': 'For student pilots and the curious who want to try Altiview on their first flights.',
    '1 profil avion standardisé (C152 ou DR-400)': '1 standard aircraft profile (C152 or DR-400)',
    'NavLog automatique et calcul de cap': 'Automatic NavLog and heading calculation',
    'METAR et TAF décodés en clair': 'METAR and TAF decoded in plain language',
    'Checklists de base': 'Basic checklists', 'Consultation sur mobile et tablette': 'View on phone and tablet',
    'Rejoindre la liste': 'Join the list',
    'Recommandé': 'Recommended', 'Pilote VFR': 'VFR pilot', '9 euros par mois': '9 euros per month', '/ mois': '/ month',
    "L'instrument complet pour préparer et conduire tous vos vols de navigation en toute sérénité.": 'The complete instrument to plan and fly all your cross-country flights with peace of mind.',
    'Tous les modules inclus': 'All modules included', ': NavLog, météo, carte, centrage, checklists': ': NavLog, weather, map, weight and balance, checklists',
    'Profils avions illimités avec manuels de vol': 'Unlimited aircraft profiles with flight manuals',
    'Relief 3D et profil de route vertical': '3D terrain and vertical route profile',
    'Calculateur de vent traversier et devis de masse': 'Crosswind calculator and weight and balance',
    'Alertes NOTAM, SUP AIP et zones AZBA': 'NOTAM, AIP SUP and AZBA alerts',
    'Mode hors ligne complet pour la tablette': 'Full offline mode for the tablet',
    'Prendre place en avant-première': 'Get early access',
    'Aéroclub & flotte': 'Flying club & fleet', 'Sur mesure': 'Custom',
    'Pour les aéroclubs, écoles ATO et DTO et propriétaires en copropriété qui veulent équiper leur flotte.': 'For flying clubs, ATO and DTO schools and shared owners who want to equip their fleet.',
    "Gestion centralisée de la flotte d'avions": 'Central management of the aircraft fleet',
    'Profils machine partagés avec fiches de pesée à jour': 'Shared aircraft profiles with up-to-date weighing reports',
    'Espaces instructeurs et suivi des élèves': 'Instructor spaces and student tracking',
    'Exports réglementaires et archivage des dossiers de vol': 'Regulatory exports and flight file archiving',
    'Support prioritaire et accompagnement du club': 'Priority support and club onboarding',
    'Nous contacter': 'Contact us',

    /* 07 questions */
    'Questions de pilotes': 'Pilot questions',
    'Altiview remplace-t-il la documentation officielle ?': 'Does Altiview replace official documentation?',
    'Non. Altiview est une aide à la préparation. Les publications officielles (AIP, cartes VAC, NOTAM, SUP AIP), le manuel de vol de l\'avion et votre jugement de commandant de bord restent la référence.': 'No. Altiview is a planning aid. Official publications (AIP, VAC charts, NOTAMs, AIP SUPs), the aircraft flight manual and your judgment as pilot in command remain the reference.',
    'Quels avions sont pris en charge ?': 'Which aircraft are supported?',
    "Cinq profils constructeur sont prêts : Cessna 172, Robin DR-400, Piper PA-28, Diamond DA-40 et Cessna 152. Vous pouvez créer le profil de votre avion à partir de son manuel de vol, puis l'exporter en JSON pour le partager avec votre aéroclub.": "Five manufacturer profiles are ready: Cessna 172, Robin DR-400, Piper PA-28, Diamond DA-40 and Cessna 152. You can build your own aircraft's profile from its flight manual, then export it as JSON to share with your flying club.",
    "Sur quel appareil l'utiliser ?": 'Which device can I use?',
    "Altiview fonctionne dans le navigateur : sur ordinateur pour préparer au sol, sur tablette pour garder l'essentiel sous les yeux en vol.": 'Altiview runs in the browser: on a computer to plan on the ground, on a tablet to keep what matters in sight in flight.',
    "D'où viennent les données aéronautiques ?": 'Where does the aeronautical data come from?',
    "La carte s'appuie sur OpenAIP pour les terrains, points de report, balises et espaces aériens européens. La météo METAR et TAF des terrains de la route est récupérée puis décodée. Les NOTAM se collent depuis votre briefing SOFIA ou Olivia et sont triés automatiquement.": 'The map relies on OpenAIP for European airfields, reporting points, navaids and airspace. METAR and TAF weather for the airfields on your route is fetched and decoded. NOTAMs are pasted from your SOFIA or Olivia briefing and sorted automatically.',
    'Que se passe-t-il après mon inscription ?': 'What happens after I sign up?',
    "Nous vous écrivons à l'ouverture des premiers accès, et uniquement au sujet d'Altiview. Votre adresse n'est ni revendue ni partagée.": "We'll email you when the first access opens, and only about Altiview. Your address is never sold or shared.",

    /* 08 contact */
    "D'autres questions ? Contactez-nous": 'More questions? Contact us',
    'Réservez votre place en avant-première, posez une question sur un abonnement ou présentez-nous votre club. Nous vous répondons par e-mail.': "Book your early-access spot, ask about a plan or tell us about your club. We'll reply by email.",
    'Objet': 'Subject',
    'Abonnement Pilote VFR': 'VFR pilot plan', 'Offre Élève et découverte': 'Student and discovery plan', 'Aéroclub et flotte': 'Flying club and fleet', 'Autre question': 'Other question',
    'Vous êtes': 'You are', 'Pilote privé (PPL)': 'Private pilot (PPL)', 'Pilote LAPL': 'LAPL pilot', 'Élève pilote': 'Student pilot', 'Instructeur': 'Instructor', 'Aéroclub ou école': 'Flying club or school',
    'Votre message': 'Your message', 'Envoyer': 'Send',
    "Votre messagerie s'ouvre avec le message prêt à partir. Rien ne s'ouvre ? Écrivez-nous directement à": 'Your email app opens with the message ready to go. Nothing opened? Email us directly at',

    /* footer */
    'La préparation et la conduite du vol VFR, dans une seule application.': 'VFR flight planning and flying, in a single app.',
    'Produit': 'Product', 'Légal': 'Legal', 'Mentions légales': 'Legal notice', 'Confidentialité': 'Privacy',
    'Instagram @altiview.eu (nouvel onglet)': 'Instagram @altiview.eu (new tab)',
    'X @altivieweu (nouvel onglet)': 'X @altivieweu (new tab)',
    'TikTok @altiview2 (nouvel onglet)': 'TikTok @altiview2 (new tab)',
    "Altiview est une aide à la préparation du vol. Il ne remplace ni la documentation aéronautique officielle (AIP, cartes VAC, NOTAM), ni le manuel de vol de l'avion, ni le jugement du commandant de bord.": 'Altiview is a flight planning aid. It does not replace official aeronautical documentation (AIP, VAC charts, NOTAMs), the aircraft flight manual, or the judgment of the pilot in command.',
    'CONÇU POUR LES PILOTES VFR': 'BUILT FOR VFR PILOTS',

    /* legal page */
    'Altiview · Mentions légales et confidentialité': 'Altiview · Legal notice and privacy',
    "← Retour à l'accueil": '← Back to home',
    'Mentions légales et confidentialité': 'Legal notice and privacy',
    'Éditeur du site :': 'Site publisher:', '[nom ou raison sociale à compléter]': '[name or company name to complete]',
    '[adresse à compléter]': '[address to complete]', '[SIREN à compléter]': '[company number to complete]',
    'Directeur de la publication :': 'Publication director:', '[nom à compléter]': '[name to complete]',
    'Contact :': 'Contact:', 'Hébergement :': 'Hosting:', '[hébergeur, adresse et téléphone à compléter]': '[host, address and phone number to complete]',
    'Usage :': 'Use:',
    'Données collectées :': 'Data collected:',
    "aucune par le site lui-même. Le formulaire de contact ouvre votre messagerie : l'objet, votre profil et votre message nous parviennent par e-mail, avec votre adresse, uniquement si vous l'envoyez.": 'none by the site itself. The contact form opens your own email app: the subject, your profile and your message reach us by email, with your address, only if you send it.',
    'Finalité :': 'Purpose:',
    "répondre à vos messages et vous informer de l'ouverture de l'accès anticipé à Altiview. Aucune revente, aucun partage avec des tiers.": 'to reply to your messages and let you know when Altiview early access opens. No selling, no sharing with third parties.',
    'Durée de conservation :': 'Retention period:', '[à compléter]': '[to complete]',
    'Vos droits :': 'Your rights:',
    "vous pouvez demander l'accès, la rectification ou la suppression de vos données à tout moment en écrivant à": 'you can ask for access to, correction or deletion of your data at any time by writing to',
    'Cookies :': 'Cookies:',
    'ce site ne dépose aucun cookie de suivi. Il mémorise uniquement vos choix de mode nuit ou jour et de langue dans votre navigateur.': 'this site sets no tracking cookies. It only remembers your night/day mode and language choices in your browser.'
  };

  /* flags fill their rounded box edge to edge (slice): no letterbox strips around them */
  function usFlag() {                                   /* 19:10, 13 stripes, 50 stars in 9 alternating rows of 6 and 5 */
    var stars = '';
    for (var r = 0; r < 9; r++) for (var c = 0, n = r % 2 ? 5 : 6; c < n; c++) {
      stars += '<circle cx="' + (((r % 2 ? 2 : 1) + 2 * c) * 0.6333).toFixed(3) + '" cy="' + ((r + 1) * 0.5385).toFixed(3) + '" r=".2"/>';
    }
    return '<svg viewBox="0 0 19 10" preserveAspectRatio="xMinYMid slice"><path fill="#B22234" d="M0 0h19v10H0z"/>' +
      '<path d="M0 1.154h19M0 2.692h19M0 4.231h19M0 5.769h19M0 7.308h19M0 8.846h19" stroke="#fff" stroke-width=".769"/>' +
      '<path fill="#3C3B6E" d="M0 0h7.6v5.385H0z"/><g fill="#fff">' + stars + '</g></svg>';
  }
  var FLAG = {
    fr: '<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><path fill="#002654" d="M0 0h1v2H0z"/><path fill="#fff" d="M1 0h1v2H1z"/><path fill="#CE1126" d="M2 0h1v2H2z"/></svg>',
    en: usFlag()
  };

  var ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
  var origText = new WeakMap(), origAttr = new WeakMap();
  var lang = 'fr';
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function en(fr) { return EN[norm(fr)]; }

  function trText(n) {
    var raw = n.nodeValue, t = en(raw);
    if (t === undefined) return;
    origText.set(n, raw);
    var lead = /^\s*/.exec(raw)[0], trail = /\s*$/.exec(raw)[0];
    if (/^[:;,.!?]/.test(t)) lead = '';                 /* French puts a space before ':'; English does not */
    n.nodeValue = lead + t + trail;
  }
  function trAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (v === null) continue;
      var t = en(v); if (t === undefined) continue;
      var m = origAttr.get(el) || {}; m[a] = v; origAttr.set(el, m);
      el.setAttribute(a, t);
    }
  }
  function each(root, onText, onEl) {
    if (root.nodeType === 3) { onText(root); return; }
    if (root.nodeType !== 1) return;
    onEl(root);
    /* elements are always visited (a textarea's placeholder gets translated); only the text inside
       script, style and textarea is left alone, so what a visitor typed is never touched */
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeType === 3 && n.parentNode && SKIP[n.parentNode.nodeName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    for (var n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) onText(n); else onEl(n); }
  }
  function toEN(root) { each(root, trText, trAttrs); }
  function toFR(root) {
    each(root, function (n) { var o = origText.get(n); if (o !== undefined) { n.nodeValue = o; origText.delete(n); } },
      function (el) { var m = origAttr.get(el); if (m) { for (var a in m) el.setAttribute(a, m[a]); origAttr.delete(el); } });
  }

  /* head: title and share texts */
  var metas = [].slice.call(document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]'));
  var headFR = { title: document.title, metas: metas.map(function (m) { return m.getAttribute('content'); }) };
  function head(l) {
    document.title = l === 'en' ? (en(headFR.title) || headFR.title) : headFR.title;
    metas.forEach(function (m, i) { var fr = headFR.metas[i]; m.setAttribute('content', l === 'en' ? (en(fr) || fr) : fr); });
  }

  /* text the other scripts write later (aircraft sheet, 3D labels, form errors) follows the language */
  new MutationObserver(function (muts) {
    if (lang !== 'en') return;
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'characterData') trText(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) toEN(m.addedNodes[j]);
    }
  }).observe(document.body, { childList: true, characterData: true, subtree: true });

  /* the switcher: a flag button next to "Se connecter", opening French / English */
  var ui = null;
  (function buildSwitcher() {
    var ctrl = document.querySelector('.nav-ctrl'); if (!ctrl) return;
    var wrap = document.createElement('div'); wrap.className = 'lang';
    wrap.innerHTML =
      '<button class="lang-btn" id="langBtn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="langMenu">' +
        '<span class="flag" aria-hidden="true"></span><span class="lang-code" aria-hidden="true"></span>' +
        '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></button>' +
      '<div class="lang-menu" id="langMenu" role="menu" hidden>' +
        '<button type="button" role="menuitemradio" data-lang="fr" lang="fr"><span class="flag" aria-hidden="true">' + FLAG.fr + '</span>Français</button>' +
        '<button type="button" role="menuitemradio" data-lang="en" lang="en"><span class="flag" aria-hidden="true">' + FLAG.en + '</span>English / US</button>' +
      '</div>';
    ctrl.insertBefore(wrap, ctrl.querySelector('.menu-btn'));
    var btn = wrap.querySelector('.lang-btn'), menu = wrap.querySelector('.lang-menu'), items = [].slice.call(menu.querySelectorAll('[data-lang]'));
    function open(v, focusIdx) {
      menu.hidden = !v; btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v && focusIdx != null) items[focusIdx].focus();
    }
    btn.addEventListener('click', function () { open(menu.hidden); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); open(true, Math.max(0, items.findIndex(function (it) { return it.getAttribute('data-lang') === lang; }))); }
    });
    items.forEach(function (it, i) {
      it.addEventListener('click', function () { setLang(it.getAttribute('data-lang'), true); open(false); btn.focus(); });
      it.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      });
    });
    document.addEventListener('click', function (e) { if (!menu.hidden && !wrap.contains(e.target)) open(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); } });
    ui = function () {
      items.forEach(function (it) { it.setAttribute('aria-checked', it.getAttribute('data-lang') === lang ? 'true' : 'false'); });
      btn.querySelector('.flag').innerHTML = FLAG[lang];
      btn.querySelector('.lang-code').textContent = lang.toUpperCase();
      btn.setAttribute('aria-label', lang === 'en' ? 'Language: English. Change language' : 'Langue : français. Changer de langue');
    };
  })();

  function setLang(l, save) {
    l = l === 'en' ? 'en' : 'fr';
    if (l !== lang) {
      if (l === 'en') toEN(document.body); else toFR(document.body);
      lang = l;
      document.documentElement.lang = l;
      head(l);
      document.dispatchEvent(new CustomEvent('altiview:lang', { detail: l }));
    }
    if (save) { try { localStorage.setItem('altiview-lang', l); } catch (e) {} }
    if (ui) ui();
  }
  window.AltiI18n = { set: setLang, get: function () { return lang; }, t: function (fr) { return lang === 'en' ? (en(fr) || fr) : fr; } };

  var start = 'fr';
  try { start = localStorage.getItem('altiview-lang') || 'fr'; } catch (e) {}
  var q = /[?&]lang=(en|fr)\b/.exec(location.search); if (q) start = q[1];
  setLang(start, false);
})();
