/* ALTIVIEW · vignettes 3D des profils avion.
   Même moteur et mêmes modèles que la scène de la page Performances, en plus
   petit : une vignette par fiche, montée à l'ouverture de la fenêtre et
   démontée à sa fermeture pour ne pas retenir de contextes WebGL. */
(function () {
    'use strict';
    var K = window.AltiKit;
    if (!K) return;
    var mounted = [];

    function mountOne(canvas) {
        var T = K.THREE, FM = K.fleetModels;
        var id = canvas.getAttribute('data-model');
        if (!FM || !FM.SPECS[id]) return null;

        var renderer = K.renderer(canvas);
        var scene = new T.Scene();
        var camera = new T.PerspectiveCamera(28, 1, 0.1, 100);
        camera.position.set(0, 2.6, 14.5);
        camera.lookAt(0, -0.2, 0);
        K.envFor(renderer, scene);
        scene.add(new T.HemisphereLight(0xdfe9f3, 0x2a3440, 0.95));
        var key = new T.DirectionalLight(0xffffff, 2.1); key.position.set(-6, 9, 8); scene.add(key);
        var rim = new T.DirectionalLight(0x4fd8c4, 1.0); rim.position.set(6, 3, -8); scene.add(rim);

        var plane = FM.build(T, id, FM.materials(T), { lite: true });
        scene.add(plane);

        var s = {
            stage: canvas.parentNode, canvas: canvas, scene: scene, camera: camera, renderer: renderer,
            update: function (dt, t) {
                // tour complet lent, nez légèrement plongeant : la silhouette reste lisible
                plane.rotation.set(0, -t * 0.42, 0.04 * Math.sin(t * 0.8));
                plane.position.y = Math.sin(t * 0.9) * 0.12;
                if (!K.reduced()) plane.userData.prop.rotation.x += dt * 38;
            }
        };
        K.add(s);
        return s;
    }

    function mount(root) {
        unmount();
        var canvases = (root || document).querySelectorAll('canvas.ac-3d');
        if (!canvases.length) return;
        K.ready.then(function () {
            [].forEach.call(canvases, function (c) {
                var s = mountOne(c);
                if (s) mounted.push(s);
            });
            K.kick();
        }).catch(function () {
            [].forEach.call(canvases, function (c) {
                if (c.parentNode) c.parentNode.classList.add('no3d');
            });
        });
    }

    function unmount() {
        mounted.forEach(function (s) {
            var i = K.scenes.indexOf(s);
            if (i >= 0) K.scenes.splice(i, 1);
            if (s.renderer && s.renderer.dispose) s.renderer.dispose();
            if (s.renderer && s.renderer.forceContextLoss) {
                try { s.renderer.forceContextLoss(); } catch (e) {}
            }
        });
        mounted = [];
    }

    window.AltiviewCard3D = { mount: mount, unmount: unmount };
})();
