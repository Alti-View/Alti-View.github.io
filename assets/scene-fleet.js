/* ALTIVIEW · performances: the five built-in aircraft profiles in 3D, swapped on selection */
(function () {
  'use strict';
  var K = window.AltiKit;
  var stage = document.getElementById('planeStage');
  var canvas = document.getElementById('planeCanvas');
  var D2R = Math.PI / 180;

  K.ready.then(function (T) {
    var FM = K.fleetModels;
    if (!FM) throw new Error('fleet models missing');
    var lite = K.lite();
    var renderer = K.renderer(canvas);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 3.1, 13.2); camera.lookAt(0, -0.1, 0);        /* a little above, so wing dihedral reads */
    K.envFor(renderer, scene);
    scene.add(new T.HemisphereLight(0xdfe9f3, 0x2a3440, 0.9));
    var key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(-6, 9, 8); scene.add(key);
    var rim = new T.DirectionalLight(0x4fd8c4, 1.2); rim.position.set(6, 3, -8); scene.add(rim);
    var warm = new T.PointLight(0xffa94d, 8, 22, 2); warm.position.set(4, -3, 5); scene.add(warm);

    var M = FM.materials(T);
    var fleet = {}, decals = [];
    function make(id) {
      var g = FM.build(T, id, M, { lite: lite });
      g.visible = false; scene.add(g); decals.push(g.userData.decal);
      return g;
    }

    /* soft clouds streaming past behind the aircraft */
    var cc = document.createElement('canvas'); cc.width = cc.height = 128;
    var cx = cc.getContext('2d'), grd = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grd; cx.fillRect(0, 0, 128, 128);
    var cloudTex = new T.CanvasTexture(cc), clouds = [];
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var q = 0; q < (lite ? 6 : 10); q++) {
      var cs = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, toneMapped: false }));
      var sc = 3 + rnd() * 4; cs.scale.set(sc * 1.9, sc, 1);
      cs.position.set(-16 + rnd() * 32, -4 + rnd() * 8, -4 - rnd() * 10);
      cs.userData.v = 2.5 + rnd() * 2; cs.userData.o = 0.6 + rnd() * 0.4;
      scene.add(cs); clouds.push(cs);
    }
    function onTheme() {
      var day = K.theme() === 'day';
      clouds.forEach(function (c2) { c2.material.color.setHex(day ? 0x8FA2B4 : 0xB8C7D6); c2.material.opacity = c2.userData.o * (day ? 0.32 : 0.13); });
    }
    onTheme();

    /* which aircraft is on stage, and the fly-out / fly-in swap */
    var cur = null, prev = null, tr = 1;
    function show(id) {
      if (!FM.SPECS[id] || (cur && cur.userData.id === id)) return;
      var g = fleet[id] || (fleet[id] = make(id));
      if (prev) { prev.visible = false; prev = null; }
      if (cur && !K.reduced()) { prev = cur; tr = 0; } else if (cur) cur.visible = false;
      cur = g; g.visible = true;
    }
    show((window.AltiState && window.AltiState.aircraft) || 'dr400');

    var st = { init: false, yaw: -40, pitch: 2, roll: 0 };
    function place(g, d, y, rollDeg, nx, nz) {
      g.position.set(nx * d, y, nz * d);
      g.rotation.set(rollDeg * D2R, st.yaw * D2R, st.pitch * D2R);
    }
    function blink(g, t, rm) {
      var L = g.userData.lights;
      L.beacon.visible = rm || (t % 1.3) < 0.12;
      var on = !rm && (t % 1.1) < 0.06; L.strobes.forEach(function (s) { s.visible = on; });
    }
    function update(dt, t) {
      var rm = K.reduced();
      var r = stage.getBoundingClientRect(), vh = innerHeight;
      var p = K.clamp((vh - r.top) / (vh * 0.5 + r.height * 0.5), 0, 1);
      var e = p * p * (3 - 2 * p);
      var px = K.pointer.x, py = K.pointer.y;
      var tYaw = rm ? -30 : -46 + 26 * e + px * 8;                          /* turns as it climbs, stays three-quarter */
      var tPitch = rm ? 3 : 2 + 7 * Math.sin(Math.PI * e) - py * 3;        /* nose up in the climb, level at cruise */
      var tRoll = rm ? -4 : Math.sin(t * 0.7) * 2.2 + Math.sin(t * 1.6 + 1) * 0.8 - px * 6;
      if (!st.init || rm) { st.yaw = tYaw; st.pitch = tPitch; st.roll = tRoll; st.init = true; }
      else if (dt > 0) { st.yaw = K.damp(st.yaw, tYaw, 0.05, dt); st.pitch = K.damp(st.pitch, tPitch, 0.05, dt); st.roll = K.damp(st.roll, tRoll, 0.06, dt); }
      var yr = st.yaw * D2R, nx = Math.cos(yr), nz = -Math.sin(yr);
      var baseY = rm ? 0 : Math.sin(t * 0.9) * 0.08 + e * 0.25 - 0.1;

      var kin = 1, kout = 1;
      if (prev) {
        if (dt > 0) tr = Math.min(1, tr + dt / 1.15);
        kout = tr * tr * tr; kin = 1 - Math.pow(1 - tr, 3);
      }
      place(cur, -(1 - kin) * 15, baseY, st.roll - (1 - kin) * 22, nx, nz);   /* arrives from behind in a bank */
      if (prev) {
        place(prev, kout * 15, baseY + kout * 1.4, st.roll + kout * 10, nx, nz);   /* leaves ahead, climbing away */
        if (tr >= 1) { prev.visible = false; prev = null; }
      }
      [cur, prev].forEach(function (g) { if (!g) return; if (!rm) g.userData.prop.rotation.x += dt * 42; blink(g, t, rm); });
      if (!rm && dt > 0) clouds.forEach(function (c2) {
        c2.position.x -= c2.userData.v * dt * (0.6 + e * 0.8);
        if (c2.position.x < -18) { c2.position.x = 18; c2.position.y = -4 + rnd() * 8; }
      });
    }

    var sceneObj = { stage: stage, canvas: canvas, scene: scene, camera: camera, renderer: renderer, update: update, onTheme: onTheme };
    K.add(sceneObj);
    document.addEventListener('altiview:aircraft', function (ev) {
      show(ev.detail && ev.detail.id);
      if (K.reduced()) K.renderOnce(sceneObj); else K.kick();
    });
    if (document.fonts && document.fonts.load) {
      document.fonts.load('800 100px "Big Shoulders Display"').then(function () {
        decals.forEach(function (d) { d.draw(); d.tex.needsUpdate = true; }); K.renderOnce(sceneObj);
      }).catch(function () {});
    }
    /* build the other four in idle moments so a switch never stutters */
    var queue = Object.keys(FM.SPECS).filter(function (id) { return !fleet[id]; });
    (function warmUp() {
      if (!queue.length) return;
      var id = queue.shift(); if (!fleet[id]) fleet[id] = make(id);
      (window.requestIdleCallback || function (f) { return setTimeout(f, 200); })(warmUp);
    })();
  }).catch(function (e) { if (window.console) console.warn('Altiview fleet 3D:', e && e.message); });
})();
