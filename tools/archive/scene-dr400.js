/* ALTIVIEW · performances: a Robin DR400-120 in 3D, climbing with the scroll */
(function () {
  'use strict';
  var K = window.AltiKit;
  var stage = document.getElementById('planeStage');
  var canvas = document.getElementById('planeCanvas');
  var roPa = document.getElementById('roPa'), roOat = document.getElementById('roOat'), roDa = document.getElementById('roDa');
  var TARGET = 4500, ISA_DEV = 15, D2R = Math.PI / 180;
  function nf(n) { return Math.round(n).toLocaleString('fr-FR'); }

  /* NACA-style section, leading edge at +c/2, as one closed counter-clockwise loop */
  function foil(c, t, camber, N) {
    var up = [], lo = [];
    for (var i = 0; i <= N; i++) {
      var s = (1 - Math.cos(i / N * Math.PI)) / 2;
      var yt = 5 * t * (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s * s * s - 0.1036 * s * s * s * s);
      var yc = camber * 4 * s * (1 - s), X = c / 2 - s * c;
      up.push([X, (yc + yt) * c]); lo.push([X, (yc - yt) * c]);
    }
    var loop = up.slice();
    for (var j = N - 1; j >= 1; j--) loop.push(lo[j]);
    return loop;
  }
  /* a smooth surface swept along +Z (shared vertices, so the skin shades smoothly) */
  function surf(T, loop, span) {
    var n = loop.length, pos = new Float32Array(n * 6), idx = [];
    for (var k = 0; k < 2; k++) for (var i = 0; i < n; i++) { var o = (k * n + i) * 3; pos[o] = loop[i][0]; pos[o + 1] = loop[i][1]; pos[o + 2] = k * span; }
    for (i = 0; i < n; i++) { var a = i, b = (i + 1) % n, c = n + i, d = n + (i + 1) % n; idx.push(a, b, d, a, d, c); }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function cap(T, loop) {
    var s = new T.Shape(); loop.forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); });
    return new T.ShapeGeometry(s);
  }
  function tailY(x) { return x < -0.3 ? (-0.3 - x) * 0.07 : 0; }

  K.ready.then(function (T) {
    var lite = K.lite();
    var renderer = K.renderer(canvas);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 3.1, 13.2); camera.lookAt(0, -0.1, 0);        /* a little above, so the wing dihedral shows */
    K.envFor(renderer, scene);
    scene.add(new T.HemisphereLight(0xdfe9f3, 0x2a3440, 0.9));
    var key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(-6, 9, 8); scene.add(key);
    var rim = new T.DirectionalLight(0x4fd8c4, 1.2); rim.position.set(6, 3, -8); scene.add(rim);
    var warm = new T.PointLight(0xffa94d, 8, 22, 2); warm.position.set(4, -3, 5); scene.add(warm);

    var paint = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05 });
    var white = new T.MeshStandardMaterial({ color: 0xF1F4F6, roughness: 0.34, metalness: 0.05 });
    var whiteDS = white.clone(); whiteDS.side = T.DoubleSide;
    var amber = new T.MeshStandardMaterial({ color: 0xFFA94D, roughness: 0.35, metalness: 0.2, emissive: 0xFF8A1A, emissiveIntensity: 0.15 });
    var dark = new T.MeshStandardMaterial({ color: 0x1A2029, roughness: 0.6, metalness: 0.3 });
    var glass = new T.MeshPhysicalMaterial({ color: 0x0E1E2A, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.82, envMapIntensity: 1.8 });

    /* the aircraft, built in metres, nose along +X, right wing along +Z; yaw, then pitch, then roll */
    var ac = new T.Group(); ac.rotation.order = 'YZX'; scene.add(ac);

    /* fuselage: a lathe with a flatter belly, sides pulled in, tail cone swept up, cheat line painted in */
    var prof = [[0, -3.75], [0.07, -3.7], [0.16, -3.2], [0.26, -2.4], [0.38, -1.4], [0.48, -0.4], [0.53, 0.5], [0.52, 1.4], [0.49, 1.95], [0.45, 2.45], [0.36, 2.85], [0.2, 3.02], [0, 3.06]];
    function radiusAt(x) {
      for (var i = 1; i < prof.length; i++) if (x <= prof[i][1]) { var a = prof[i - 1], b = prof[i], f = (x - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * f; }
      return 0;
    }
    var fg = new T.LatheGeometry(prof.map(function (p) { return new T.Vector2(p[0], p[1]); }), lite ? 28 : 44);
    fg.rotateZ(-Math.PI / 2);
    var fp = fg.attributes.position, cols = new Float32Array(fp.count * 3);
    var cW = new T.Color(0xF1F4F6), cA = new T.Color(0xFFA94D), cN = new T.Color(0x22313F);
    for (var i = 0; i < fp.count; i++) {
      var x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i);
      var v = y / Math.max(0.001, radiusAt(x)), c = cW;
      if (x > -3.45 && x < 2.7) { if (v > -0.2 && v < -0.04) c = cA; else if (v >= -0.04 && v < 0.03) c = cN; }
      if (v < -0.74) c = cN;
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      z *= 0.9; if (y < 0) y *= 0.86; y += tailY(x);
      fp.setXYZ(i, x, y, z);
    }
    fg.setAttribute('color', new T.BufferAttribute(cols, 3));
    fg.computeVertexNormals();
    ac.add(new T.Mesh(fg, paint));

    /* the big bubble canopy, with two heads behind the glass */
    var dome = new T.Mesh(new T.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    dome.scale.set(1.05, 0.55, 0.47); dome.position.set(0.45, 0.3, 0); ac.add(dome);
    [-0.2, 0.2].forEach(function (zz) { var h = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), dark); h.position.set(0.3, 0.62, zz); ac.add(h); });

    /* the Jodel wing: flat centre section, outer panels at 14 degrees of dihedral */
    var CH = 1.65, WL = foil(CH, 0.14, 0.025, lite ? 12 : 18), DIH = 14 * D2R;
    var cg = surf(T, WL, 3.8); cg.translate(0, 0, -1.9);
    var wc = new T.Mesh(cg, white); wc.position.set(0.15, -0.42, 0); ac.add(wc);
    var strobes = [];
    [1, -1].forEach(function (s) {
      var g = surf(T, WL, 2.5); if (s < 0) g.translate(0, 0, -2.5);
      var w = new T.Mesh(g, white); w.position.set(0.15, -0.42, 1.9 * s); w.rotation.x = -DIH * s; ac.add(w);
      var tip = new T.Mesh(new T.SphereGeometry(1, 24, 12), amber); tip.scale.set(CH * 0.5, 0.12, 0.13); tip.position.set(0, 0.01, 2.5 * s); w.add(tip);
      var nl = new T.Mesh(new T.SphereGeometry(0.05, 12, 8), new T.MeshBasicMaterial({ color: s > 0 ? 0x3DDC84 : 0xFF4D4D, toneMapped: false }));
      nl.position.set(0.62, 0.03, 2.56 * s); w.add(nl);
      var sb = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      sb.position.set(-0.55, 0.03, 2.58 * s); w.add(sb); strobes.push(sb);
    });

    /* low tail: stabilator, swept fin, amber rudder, red beacon on top */
    var SL = foil(0.8, 0.1, 0, 12);
    var sg = surf(T, SL, 3.0); sg.translate(0, 0, -1.5);
    var stab = new T.Mesh(sg, white); stab.position.set(-3.25, 0.2, 0); ac.add(stab);
    [-1.5, 1.5].forEach(function (zz) { var cp = new T.Mesh(cap(T, SL), whiteDS); cp.position.set(-3.25, 0.2, zz); ac.add(cp); });
    function slab(pts, mat, depth) {
      var s = new T.Shape(); pts.forEach(function (p, k) { if (k) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); });
      var g = new T.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
      g.translate(0, 0, -depth / 2); var m = new T.Mesh(g, mat); ac.add(m); return m;
    }
    slab([[-2.95, 0.25], [-3.62, 0.25], [-3.78, 1.42], [-3.5, 1.42], [-3.1, 0.62]], white, 0.07);
    slab([[-3.62, 0.25], [-3.82, 0.25], [-3.98, 1.42], [-3.78, 1.42]], amber, 0.065);
    var beacon = new T.Mesh(new T.SphereGeometry(0.055, 12, 8), new T.MeshBasicMaterial({ color: 0xFF4D4D, toneMapped: false }));
    beacon.position.set(-3.66, 1.47, 0); ac.add(beacon);

    /* fixed tricycle gear with wheel fairings */
    function spat(xx, zz, len) {
      var sp = new T.Mesh(new T.SphereGeometry(1, 24, 16), white); sp.scale.set(len, 0.23, 0.15); sp.position.set(xx, -1.06, zz); ac.add(sp);
      var wh = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.1, 20), dark); wh.rotation.x = Math.PI / 2; wh.position.set(xx, -1.12, zz); ac.add(wh);
    }
    [-1, 1].forEach(function (s) {
      var strut = new T.Mesh(new T.BoxGeometry(0.08, 0.6, 0.12), white); strut.position.set(0.15, -0.76, 1.35 * s); strut.rotation.x = -0.12 * s; ac.add(strut);
      spat(0.1, 1.4 * s, 0.5);
    });
    var ns = new T.Mesh(new T.BoxGeometry(0.07, 0.55, 0.07), dark); ns.position.set(2.35, -0.66, 0); ac.add(ns);
    spat(2.35, 0, 0.4);

    /* propeller: amber spinner, two dark blades with painted tips, a faint blur disc */
    var spG = new T.ConeGeometry(0.17, 0.42, 28); spG.rotateZ(-Math.PI / 2);
    var spinner = new T.Mesh(spG, amber); spinner.position.set(3.24, 0, 0); ac.add(spinner);
    var prop = new T.Group(); prop.position.set(3.06, 0, 0); ac.add(prop);
    prop.add(new T.Mesh(new T.BoxGeometry(0.04, 1.84, 0.13), dark));
    [-1, 1].forEach(function (s) { var tp = new T.Mesh(new T.BoxGeometry(0.045, 0.14, 0.135), amber); tp.position.y = s * 0.85; prop.add(tp); });
    var dG = new T.CircleGeometry(0.94, 48); dG.rotateY(Math.PI / 2);
    var disc = new T.Mesh(dG, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false, side: T.DoubleSide }));
    disc.position.set(3.05, 0, 0); ac.add(disc);

    /* registration on both sides of the tail cone */
    var rc = document.createElement('canvas'); rc.width = 512; rc.height = 128;
    var rx = rc.getContext('2d');
    function drawReg() {
      rx.clearRect(0, 0, 512, 128); rx.fillStyle = '#22313F';
      rx.font = '800 104px "Big Shoulders Display","Arial Narrow",sans-serif'; rx.textAlign = 'center'; rx.textBaseline = 'middle';
      rx.fillText('F-ALTV', 256, 68);
    }
    drawReg();
    var regTex = new T.CanvasTexture(rc); regTex.colorSpace = T.SRGBColorSpace; regTex.anisotropy = 4;
    var regMat = new T.MeshBasicMaterial({ map: regTex, transparent: true, depthWrite: false, toneMapped: false });
    [1, -1].forEach(function (s) {
      var d = new T.Mesh(new T.PlaneGeometry(0.82, 0.205), regMat);
      d.position.set(-1.9, 0.06 + tailY(-1.9), 0.296 * s); if (s < 0) d.rotation.y = Math.PI; ac.add(d);
    });

    /* soft clouds streaming past behind the aircraft */
    var cc = document.createElement('canvas'); cc.width = cc.height = 128;
    var cx = cc.getContext('2d'), gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    var cloudTex = new T.CanvasTexture(cc), clouds = [];
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var k = 0; k < (lite ? 6 : 10); k++) {
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

    var st = { init: false, alt: 0, yaw: -40, pitch: 2, roll: 0, at: 0, a: '', o: '', d: '' };
    function update(dt, t) {
      var rm = K.reduced();
      var r = stage.getBoundingClientRect(), vh = innerHeight;
      var p = K.clamp((vh - r.top) / (vh * 0.5 + r.height * 0.5), 0, 1);
      var e = p * p * (3 - 2 * p);
      var px = K.pointer.x, py = K.pointer.y;
      var tAlt = rm ? TARGET : TARGET * e;
      var tYaw = rm ? -30 : -46 + 26 * e + px * 8;                        /* turns as it climbs, stays three-quarter so the cranked wing reads */
      var tPitch = rm ? 3 : 2 + 7 * Math.sin(Math.PI * e) - py * 3;      /* nose up in the climb, level at cruise */
      var tRoll = rm ? -4 : Math.sin(t * 0.7) * 2.2 + Math.sin(t * 1.6 + 1) * 0.8 - px * 6;
      if (!st.init || rm) { st.alt = tAlt; st.yaw = tYaw; st.pitch = tPitch; st.roll = tRoll; st.init = true; }
      else if (dt > 0) {
        st.alt = K.damp(st.alt, tAlt, 0.06, dt); st.yaw = K.damp(st.yaw, tYaw, 0.05, dt);
        st.pitch = K.damp(st.pitch, tPitch, 0.05, dt); st.roll = K.damp(st.roll, tRoll, 0.06, dt);
      }
      ac.rotation.set(st.roll * D2R, st.yaw * D2R, st.pitch * D2R);
      ac.position.y = rm ? 0 : Math.sin(t * 0.9) * 0.08 + e * 0.25 - 0.1;
      if (!rm) prop.rotation.x += dt * 42;
      beacon.visible = rm || (t % 1.3) < 0.12;
      var sOn = !rm && (t % 1.1) < 0.06; strobes.forEach(function (s) { s.visible = sOn; });
      if (!rm && dt > 0) clouds.forEach(function (c2) {
        c2.position.x -= c2.userData.v * dt * (0.6 + e * 0.8);
        if (c2.position.x < -18) { c2.position.x = 18; c2.position.y = -4 + rnd() * 8; }
      });

      var now = performance.now();
      if (now - st.at > 100 || dt === 0) {
        st.at = now;
        var pa = Math.round(st.alt / 10) * 10;
        var a = nf(pa) + ' ft', o = Math.round(15 - 1.98 * pa / 1000 + ISA_DEV) + ' °C', d = nf(pa + 120 * ISA_DEV) + ' ft';
        if (a !== st.a) { st.a = a; roPa.textContent = a; }
        if (o !== st.o) { st.o = o; roOat.textContent = o; }
        if (d !== st.d) { st.d = d; roDa.textContent = d; }
      }
    }

    var s = { stage: stage, canvas: canvas, scene: scene, camera: camera, renderer: renderer, update: update, onTheme: onTheme };
    K.add(s);
    if (document.fonts && document.fonts.load) {
      document.fonts.load('800 100px "Big Shoulders Display"').then(function () { drawReg(); regTex.needsUpdate = true; K.renderOnce(s); }).catch(function () {});
    }
  }).catch(function (e) { if (window.console) console.warn('Altiview DR400 3D:', e && e.message); });
})();
