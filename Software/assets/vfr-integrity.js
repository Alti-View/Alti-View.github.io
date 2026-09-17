/* Data validity is independent of the rest of the chart's legacy layers. */
(function (root) {
    'use strict';
    const api = {
        status(metadata, now = new Date()) {
            if (!metadata || !Number.isInteger(metadata.count) || !metadata.count) return 'missing';
            const start = Date.parse(metadata.effectiveFrom + 'T00:00:00Z');
            const end = Date.parse(metadata.effectiveUntil + 'T00:00:00Z');
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'missing';
            if (now.getTime() < start) return 'future';
            return now.getTime() >= end ? 'expired' : 'current';
        },
        routeIssues(route, points) {
            const byId = new Map(points.map(p => [p.id, p]));
            return route.flatMap(wp => {
                if (!wp.vfrSourceId) return [];
                const p = byId.get(wp.vfrSourceId);
                if (!p) return [`${wp.name} : point absent du jeu SIA chargé`];
                if (Math.abs(p.lat - wp.lat) > 1e-8 || Math.abs(p.lng - wp.lng) > 1e-8)
                    return [`${wp.name} : coordonnées SIA modifiées, remplacer ce point dans la route`];
                return [];
            });
        }
    };
    root.AltiviewVfrIntegrity = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
