(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.AltiviewVfrLanguage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const replacements = [
        [/\bnorth[ -]?east of\b/gi, 'au nord-est de'],
        [/\bnorth[ -]?west of\b/gi, 'au nord-ouest de'],
        [/\bsouth[ -]?east of\b/gi, 'au sud-est de'],
        [/\bsouth[ -]?west of\b/gi, 'au sud-ouest de'],
        [/\bto the north of\b/gi, 'au nord de'],
        [/\bto the south of\b/gi, 'au sud de'],
        [/\bto the east of\b/gi, 'à l’est de'],
        [/\bto the west of\b/gi, 'à l’ouest de'],
        [/\bnorth of\b/gi, 'au nord de'],
        [/\bsouth of\b/gi, 'au sud de'],
        [/\beast of\b/gi, 'à l’est de'],
        [/\bwest of\b/gi, 'à l’ouest de'],
        [/\babeam\b/gi, 'par le travers de'],
        [/\boverhead\b/gi, 'à la verticale de'],
        [/\bover sea\b/gi, 'au-dessus de la mer'],
        [/\bmotorway interchange\b/gi, 'échangeur autoroutier'],
        [/\bhighway interchange\b/gi, 'échangeur autoroutier'],
        [/\broad interchange\b/gi, 'échangeur routier'],
        [/\binterchange\b/gi, 'échangeur'],
        [/\broad junction\b/gi, 'carrefour routier'],
        [/\broad intersection\b/gi, 'intersection routière'],
        [/\bhighway crossroads?\b/gi, 'carrefour autoroutier'],
        [/\bjunction between\b/gi, 'jonction entre'],
        [/\bring road\b/gi, 'boulevard périphérique'],
        [/\bintersection between\b/gi, 'intersection entre'],
        [/\bintersection\b/gi, 'intersection'],
        [/\bcrossroads?\b/gi, 'carrefour'],
        [/\broundabout\b/gi, 'rond-point'],
        [/\brailway station\b/gi, 'gare ferroviaire'],
        [/\brailway line\b/gi, 'voie ferrée'],
        [/\brailway\b/gi, 'voie ferrée'],
        [/\bhigh voltage line crossing\b/gi, 'croisement avec une ligne à haute tension'],
        [/\bpower plant\b/gi, 'centrale électrique'],
        [/\bgeophysics laboratory\b/gi, 'laboratoire de géophysique'],
        [/\blaboratory\b/gi, 'laboratoire'],
        [/\bindustrial estate\b/gi, 'zone industrielle'],
        [/\bactivity area\b/gi, 'zone d’activités'],
        [/\bwater tower\b/gi, 'château d’eau'],
        [/\btelevision relay station\b/gi, 'relais de télévision'],
        [/\bsignal station\b/gi, 'sémaphore'],
        [/\btoll ?gate\b/gi, 'péage'],
        [/\bfire watchtower\b/gi, 'tour de guet incendie'],
        [/\bhelipad\b/gi, 'hélisurface'],
        [/\blighthouse\b/gi, 'phare'],
        [/\bchimney\b/gi, 'cheminée'],
        [/\bantenna\b/gi, 'antenne'],
        [/\bbridge\b/gi, 'pont'],
        [/\bdam\b/gi, 'barrage'],
        [/\bharbou?r\b/gi, 'port'],
        [/\bport of\b/gi, 'port de'],
        [/\briver mouth\b/gi, 'embouchure du fleuve'],
        [/\bmouth of the river\b/gi, 'embouchure du fleuve'],
        [/\bconfluence of the river\b/gi, 'confluence du fleuve'],
        [/\bon the river\b/gi, 'sur la rivière'],
        [/\bon river\b/gi, 'sur la rivière'],
        [/\briver\b/gi, 'rivière'],
        [/\bcoast\b/gi, 'côte'],
        [/\bseawall\b/gi, 'digue'],
        [/\bbay\b/gi, 'baie'],
        [/\bbeach\b/gi, 'plage'],
        [/\bislands\b/gi, 'îles'],
        [/\bisland\b/gi, 'île'],
        [/\blake\b/gi, 'lac'],
        [/\bpond\b/gi, 'étang'],
        [/\breservoirs?\b/gi, 'réservoir'],
        [/\bquarry\b/gi, 'carrière'],
        [/\bsandpit\b/gi, 'sablière'],
        [/\bforest\b/gi, 'forêt'],
        [/\bcastle\b/gi, 'château'],
        [/\bchurch\b/gi, 'église'],
        [/\bcemetery\b/gi, 'cimetière'],
        [/\bstadium\b/gi, 'stade'],
        [/\bracecourse\b/gi, 'hippodrome'],
        [/\bwarehouses?\b/gi, 'entrepôts'],
        [/\bdistillery\b/gi, 'distillerie'],
        [/\bfactory\b/gi, 'usine'],
        [/\bplant\b/gi, 'usine'],
        [/\bairfield\b/gi, 'aérodrome'],
        [/\bairport\b/gi, 'aéroport'],
        [/\btown of\b/gi, 'ville de'],
        [/\bvillage of\b/gi, 'village de'],
        [/\btown\b/gi, 'ville'],
        [/\bvillage\b/gi, 'village'],
        [/\bpass\b/gi, 'col'],
        [/\btower\b/gi, 'tour'],
        [/\broad\b/gi, 'route'],
        [/\bmotorway\b/gi, 'autoroute'],
        [/\bhighway\b/gi, 'autoroute'],
        [/\bbetween\b/gi, 'entre'],
        [/\balong the\b/gi, 'le long de'],
        [/\bnear the\b/gi, 'près de la'],
        [/\bnear\b/gi, 'près de'],
        [/\bnorth side of\b/gi, 'côté nord de'],
        [/\bsouth side of\b/gi, 'côté sud de'],
        [/\beast side of\b/gi, 'côté est de'],
        [/\bwest side of\b/gi, 'côté ouest de'],
        [/\bnorth exit\b/gi, 'sortie nord'],
        [/\bsouth exit\b/gi, 'sortie sud'],
        [/\beast exit\b/gi, 'sortie est'],
        [/\bwest exit\b/gi, 'sortie ouest'],
        [/\bnorth\b/gi, 'nord'],
        [/\bsouth\b/gi, 'sud'],
        [/\beast\b/gi, 'est'],
        [/\bwest\b/gi, 'ouest'],
        [/\band\b/gi, 'et'],
        [/\bon the\b/gi, 'sur la'],
        [/\bat\b/gi, 'à'],
        [/\bof the\b/gi, 'de la'],
        [/\bof\b/gi, 'de']
    ];

    function cleanSource(value) {
        return String(value || '')
            .replace(/^\s*VRP\s*[-–—:]\s*/i, '')
            .replace(/\s*#\s*/g, ' · ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function frenchDescription(value) {
        let text = cleanSource(value);
        if (!text) return 'Point de report publié par le SIA';
        for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
        text = text.replace(/\s+([,.;:])/g, '$1').replace(/\s*\/\s*/g, ' / ').trim();
        return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
    }

    function description(point, language) {
        const raw = cleanSource(point && point.desc);
        if (language === 'en') return raw || 'SIA published reporting point';
        return frenchDescription(raw);
    }

    function displayName(point, language) {
        const value = description(point, language);
        const first = value.split(/\s+[·#]\s+|[.;](?:\s|$)/)[0].trim();
        return first || ((point && (point.name || point.code)) || 'VFR');
    }

    return { cleanSource, frenchDescription, description, displayName };
});
