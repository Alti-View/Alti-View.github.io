/* ALTIVIEW · navigation: 3D route over stylised relief, flown by the aircraft selected in Performances, NavLog in sync */
(function () {
  'use strict';
  var K = window.AltiKit;
  var sec = document.getElementById('navigation');
  var stage = document.getElementById('routeStage');
  var canvas = document.getElementById('routeCanvas');
  var labelsEl = document.getElementById('routeLabels');
  var rows = Array.prototype.slice.call(document.querySelectorAll('#legs tr'));
  var lvLeg = document.getElementById('lvLeg'), lvAlt = document.getElementById('lvAlt'), lvFuel = document.getElementById('lvFuel');
  var narrowMQ = matchMedia('(max-width: 720px)');

  var NM = 0.4, FT = 0.00075, FIELD = 0.22;
  var LEGS = [[47, 12], [12, 18], [338, 15], [295, 9]];   /* Rm, NM : the same legs as the NavLog table */
  var WPT = ['LFBZ', 'VLP', 'BTZ', 'SJL', 'LESO'];
  /* fuel burnt over the whole route: set by main.js from the selected aircraft (burn x planned time) */
  function fuelTotal() { var n = window.AltiState && window.AltiState.nav; return n ? n.fuel : 12.4; }

  /* waypoints built from the NavLog headings and distances, then centred */
  var wp = [[0, 0]];
  LEGS.forEach(function (l) {
    var h = l[0] * Math.PI / 180, p = wp[wp.length - 1];
    wp.push([p[0] + Math.sin(h) * l[1] * NM, p[1] - Math.cos(h) * l[1] * NM]);
  });
  var xs = wp.map(function (p) { return p[0]; }), zs = wp.map(function (p) { return p[1]; });
  var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, cz = (Math.min.apply(null, zs) + Math.max.apply(null, zs)) / 2;
  wp = wp.map(function (p) { return [p[0] - cx, p[1] - cz]; });

  /* terrain height: value-noise fbm, carved into a valley along the route, flattened at both airfields */
  function hash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vn(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) { var s = 0, a = 0.5, f = 1; for (var i = 0; i < 5; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
  function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function segDist(px, pz, a, b) {
    var vx = b[0] - a[0], vz = b[1] - a[1], wx = px - a[0], wz = pz - a[1];
    var t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz))), dx = wx - vx * t, dz = wz - vz * t;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function routeDist(x, z) { var d = 1e9; for (var i = 0; i < wp.length - 1; i++) d = Math.min(d, segDist(x, z, wp[i], wp[i + 1])); return d; }
  function height(x, z) {
    var n = fbm(x * 0.11 + 3.1, z * 0.11 - 1.7);
    var r = 1 - Math.abs(fbm(x * 0.06 + 9.2, z * 0.06 + 4.4) * 2 - 1);
    var h = Math.pow(n, 1.5) * 2.6 + r * r * r * 2.2;
    var valley = 0.28 + n * 0.5;
    h = valley + (h - valley) * sstep(0.7, 3.8, routeDist(x, z));
    for (var i = 0; i < 2; i++) { var a = wp[i ? wp.length - 1 : 0]; h = FIELD + (h - FIELD) * sstep(0.7, 1.6, Math.hypot(x - a[0], z - a[1])); }
    return h;
  }
  function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  var GROUND = FIELD + 0.14;                                  /* the aircraft centre when its wheels touch the runway */
  var PROFILE = [
    [wp[0], GROUND], [lerp2(wp[0], wp[1], 0.35), 1400 * FT], [wp[1], 2500 * FT],
    [lerp2(wp[1], wp[2], 0.25), 3500 * FT], [wp[2], 3500 * FT], [wp[3], 3500 * FT],
    [lerp2(wp[3], wp[4], 0.5), 2000 * FT], [lerp2(wp[3], wp[4], 0.85), 1000 * FT], [wp[4], GROUND]
  ];

  var PAL = {
    night: { base: 0x0E1824, hi: 0x17283B, line: 0x1F2D3C, major: 0x31445A, planned: 0x93A7B8, track: 0x4FD8C4, as: 0x4FD8C4, amber: 0xFFA94D, drop: 0x3A4B5F, rwy: 0x93A7B8, skin: 0xFFFFFF },
    day: { base: 0xD9E1E8, hi: 0xEEF2F5, line: 0xC0CCD6, major: 0x97A8B7, planned: 0x475868, track: 0x0A7365, as: 0x0A7365, amber: 0xE07D18, drop: 0x8E9EAD, rwy: 0x475868, skin: 0xA7B5C3 }
  };

  K.ready.then(function (T) {
    var lite = K.lite();
    var renderer = K.renderer(canvas);
    renderer.toneMapping = T.NoToneMapping;
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(36, 1, 0.1, 200);
    var curve = new T.CatmullRomCurve3(PROFILE.map(function (p) { return new T.Vector3(p[0][0], p[1], p[0][1]); }), false, 'centripetal');

    /* relief with contour lines, dissolving into the page at a distance */
    var tg = new T.PlaneGeometry(64, 60, lite ? 120 : 220, lite ? 112 : 200);
    tg.rotateX(-Math.PI / 2);
    var pos = tg.attributes.position;
    for (var i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
    tg.computeVertexNormals();
    var terrainMat = new T.ShaderMaterial({
      transparent: true, premultipliedAlpha: true,
      uniforms: { uBase: { value: new T.Color() }, uHi: { value: new T.Color() }, uLine: { value: new T.Color() }, uMajor: { value: new T.Color() }, uCam: { value: camera.position } },
      vertexShader: 'varying float vH;varying vec3 vN;varying vec3 vW;void main(){vH=position.y;vN=normal;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: [
        'uniform vec3 uBase,uHi,uLine,uMajor,uCam;varying float vH;varying vec3 vN;varying vec3 vW;',
        'void main(){',
        ' float sh=.62+.38*max(dot(normalize(vN),normalize(vec3(-.45,.8,.35))),0.);',
        ' vec3 col=mix(uBase,uHi,clamp(vH/3.2,0.,1.))*sh;',
        ' float h=vH*5.;float w=fwidth(h);float d=abs(fract(h+.5)-.5);float ln=1.-smoothstep(0.,w*1.3,d);',
        ' float wm=fwidth(vH);float dm=abs(fract(vH+.5)-.5);float mj=1.-smoothstep(0.,wm*1.6,dm);',
        ' col=mix(col,uLine,ln*.85);col=mix(col,uMajor,mj*.9);',
        ' float a=1.-smoothstep(13.,30.,distance(vW,uCam));',
        ' a*=smoothstep(32.,23.,abs(vW.x))*smoothstep(30.,21.,abs(vW.z));',
        ' gl_FragColor=vec4(col,1.);',
        ' #include <colorspace_fragment>',
        ' gl_FragColor=vec4(gl_FragColor.rgb*a,a);',
        '}'
      ].join('\n')
    });
    scene.add(new T.Mesh(tg, terrainMat));

    /* planned route (dashed), its ground track, and the flown route that grows with progress */
    var pts = curve.getSpacedPoints(400);
    var planned = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0.8, toneMapped: false }));
    planned.computeLineDistances(); scene.add(planned);
    var track = new T.Line(new T.BufferGeometry().setFromPoints(pts.map(function (p) { return new T.Vector3(p.x, height(p.x, p.z) + 0.05, p.z); })),
      new T.LineDashedMaterial({ dashSize: 0.1, gapSize: 0.1, transparent: true, opacity: 0.6, toneMapped: false }));
    track.computeLineDistances(); scene.add(track);
    var tubeMat = new T.ShaderMaterial({
      uniforms: { uP: { value: 0 }, uCol: { value: new T.Color() } },
      vertexShader: 'varying float vU;void main(){vU=uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float uP;uniform vec3 uCol;varying float vU;\nvoid main(){if(vU>uP)discard;float hd=smoothstep(uP-.06,uP,vU);gl_FragColor=vec4(mix(uCol,vec3(1.),hd*.35),1.);\n#include <colorspace_fragment>\n}'
    });
    scene.add(new T.Mesh(new T.TubeGeometry(curve, lite ? 300 : 600, 0.035, 8, false), tubeMat));

    /* waypoints: position on the curve, drop lines, ground rings, markers */
    var U = [], wpY = [];
    wp.forEach(function (w) {
      var best = 0, bd = 1e9;
      for (var i = 0; i < pts.length; i++) { var d = Math.hypot(pts[i].x - w[0], pts[i].z - w[1]); if (d < bd) { bd = d; best = i; } }
      U.push(best / (pts.length - 1)); wpY.push(pts[best].y);
    });
    var dropMat = new T.LineBasicMaterial({ transparent: true, opacity: 0.7, toneMapped: false });
    var ringMat = new T.MeshBasicMaterial({ side: T.DoubleSide, transparent: true, opacity: 0.9, toneMapped: false });
    var markMat = new T.MeshBasicMaterial({ toneMapped: false });
    wp.forEach(function (w, i) {
      var gy = height(w[0], w[1]) + 0.04;
      if (wpY[i] - gy > 0.1) scene.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(w[0], gy, w[1]), new T.Vector3(w[0], wpY[i], w[1])]), dropMat));
      var ring = new T.Mesh(new T.RingGeometry(0.14, 0.19, 32), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(w[0], gy + 0.01, w[1]); scene.add(ring);
      if (i > 0 && i < wp.length - 1) { var m = new T.Mesh(new T.OctahedronGeometry(0.07), markMat); m.position.set(w[0], wpY[i], w[1]); scene.add(m); }
    });
    var rwyMat = new T.MeshBasicMaterial({ toneMapped: false });
    [[wp[0], 50], [wp[4], 290]].forEach(function (r) {
      var m = new T.Mesh(new T.BoxGeometry(0.09, 0.02, 0.9), rwyMat); m.position.set(r[0][0], FIELD + 0.02, r[0][1]); m.rotation.y = -r[1] * Math.PI / 180; scene.add(m);
    });

    /* airspaces: a TMA slab above the cruise (floor 4500 ft) and the arrival CTR */
    var asFill = new T.MeshBasicMaterial({ transparent: true, opacity: 0.07, depthWrite: false, side: T.DoubleSide, toneMapped: false });
    var asLine = new T.LineBasicMaterial({ transparent: true, opacity: 0.55, toneMapped: false });
    var c2 = wp[2], sh = new T.Shape();
    [[-2.6, 1.9], [2.3, 2.7], [3.2, -1.7], [-1.0, -3.1], [-3.3, -0.5]].forEach(function (p, i) { var x = c2[0] + p[0], z = c2[1] + p[1]; if (i) sh.lineTo(x, -z); else sh.moveTo(x, -z); });
    var floorY = 4500 * FT, ceilY = 6500 * FT;
    var slab = new T.ExtrudeGeometry(sh, { depth: ceilY - floorY, bevelEnabled: false });
    slab.rotateX(-Math.PI / 2); slab.translate(0, floorY, 0);
    var slabMesh = new T.Mesh(slab, asFill); slabMesh.renderOrder = 2; scene.add(slabMesh);
    scene.add(new T.LineSegments(new T.EdgesGeometry(slab), asLine));
    var ctrH = 1500 * FT, arr = wp[4];
    var ctr = new T.Mesh(new T.CylinderGeometry(2.1, 2.1, ctrH, 72, 1, true), asFill); ctr.position.set(arr[0], ctrH / 2, arr[1]); ctr.renderOrder = 2; scene.add(ctr);
    var ringPts = []; for (var j = 0; j < 72; j++) { var an = j / 72 * Math.PI * 2; ringPts.push(new T.Vector3(arr[0] + Math.cos(an) * 2.1, ctrH, arr[1] + Math.sin(an) * 2.1)); }
    scene.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(ringPts), asLine));

    /* the aircraft: the same 3D model as the one selected in Performances */
    scene.add(new T.HemisphereLight(0xffffff, 0x3a4b5f, 1.4));
    var sun = new T.DirectionalLight(0xffffff, 1.8); sun.position.set(-6, 12, 8); scene.add(sun);
    var FM = K.fleetModels, M = FM.materials(T);
    var plane = new T.Group(); scene.add(plane);                      /* +Z follows the route (lookAt) */
    var mount = new T.Group(); mount.rotation.y = -Math.PI / 2;       /* model nose +X turned to +Z */
    mount.scale.setScalar(lite ? 0.115 : 0.1); plane.add(mount);
    var models = {}, cur = null, decals = [];
    function setPlane(id) {
      if (!FM.SPECS[id] || (cur && cur.userData.id === id)) return;
      if (cur) cur.visible = false;
      cur = models[id];
      if (!cur) { cur = models[id] = FM.build(T, id, M, { lite: lite }); mount.add(cur); decals.push(cur.userData.decal); }
      cur.visible = true;
    }
    setPlane((window.AltiState && window.AltiState.aircraft) || 'dr400');
    var shadowRing = new T.Mesh(new T.RingGeometry(0.1, 0.15, 32), ringMat); shadowRing.rotation.x = -Math.PI / 2; scene.add(shadowRing);
    var aim = new T.Vector3();
    var stickArr = new Float32Array(6), stickGeo = new T.BufferGeometry();
    stickGeo.setAttribute('position', new T.BufferAttribute(stickArr, 3));
    var stick = new T.Line(stickGeo, new T.LineBasicMaterial({ transparent: true, opacity: 0.8, toneMapped: false })); stick.frustumCulled = false; scene.add(stick);

    /* HTML labels projected from 3D */
    var labels = [];
    function addLabel(text, v, cls) {
      var el = document.createElement('div'); el.className = 'wlabel' + (cls ? ' ' + cls : ''); el.textContent = text;
      labelsEl.appendChild(el); labels.push({ el: el, v: v, x: -1, y: -1, vis: null });
    }
    WPT.forEach(function (n, i) { addLabel(n, new T.Vector3(wp[i][0], wpY[i] + 0.36, wp[i][1])); });
    addLabel('TMA · 4500 ft / FL065', new T.Vector3(c2[0] + 2.3, ceilY + 0.12, c2[1] + 2.7), 'as');
    addLabel('CTR · SFC / 1500 ft', new T.Vector3(arr[0] - 1.6, ctrH + 0.18, arr[1] - 1.4), 'as');
    var tmp = new T.Vector3(), VW = 1, VH = 1;
    function placeLabels() {
      for (var i = 0; i < labels.length; i++) {
        var L = labels[i];
        tmp.copy(L.v).project(camera);
        var vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
        if (vis !== L.vis) { L.vis = vis; L.el.style.opacity = vis ? '' : '0'; }
        if (!vis) continue;
        var x = Math.round((tmp.x + 1) / 2 * VW), y = Math.round((1 - tmp.y) / 2 * VH);
        if (x !== L.x || y !== L.y) { L.x = x; L.y = y; L.el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-100%)'; }
      }
    }

    /* follow camera: the aircraft sits right of centre on desktop, centred on phones */
    var OFF0 = new T.Vector3(12.5, 8.6, 6.2), OFF = OFF0.clone();
    var right = new T.Vector3().crossVectors(OFF0.clone().negate().normalize(), new T.Vector3(0, 1, 0)).normalize();
    var shift = 3.2;
    var camPos = new T.Vector3(), camLook = new T.Vector3(), tPos = new T.Vector3(), tLook = new T.Vector3();

    function onTheme() {
      var c = PAL[K.theme()];
      terrainMat.uniforms.uBase.value.setHex(c.base); terrainMat.uniforms.uHi.value.setHex(c.hi);
      terrainMat.uniforms.uLine.value.setHex(c.line); terrainMat.uniforms.uMajor.value.setHex(c.major);
      planned.material.color.setHex(c.planned); track.material.color.setHex(c.track);
      asFill.color.setHex(c.as); asLine.color.setHex(c.as);
      tubeMat.uniforms.uCol.value.setHex(c.amber); markMat.color.setHex(c.amber);
      dropMat.color.setHex(c.drop); stick.material.color.setHex(c.drop); ringMat.color.setHex(c.track); rwyMat.color.setHex(c.rwy);
      M.paint.color.setHex(c.skin); M.white.color.setHex(c.skin === 0xFFFFFF ? 0xF1F4F6 : c.skin);   /* white airframe reads on a dark map, blue-grey on a light one */
    }
    onTheme();

    function progress(t) {
      if (K.reduced()) return 1;
      if (!narrowMQ.matches) { var r = sec.getBoundingClientRect(); return K.clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1); }
      return Math.min(1, (t % 26) / 22);            /* phones: gentle auto-play loop */
    }

    var st = { init: false, p: 0, roll: 0, leg: -1, at: 0, a: '', f: '' };
    function update(dt, t) {
      var rm = K.reduced();
      var target = progress(t), loop = narrowMQ.matches && !rm;
      if (!st.init || rm || loop) st.p = target;
      else if (dt > 0) st.p = K.damp(st.p, target, 0.08, dt);
      var u = K.clamp(st.p, 0.0005, 0.9995);
      tubeMat.uniforms.uP.value = st.p;
      var pp = curve.getPointAt(u), tg2 = curve.getTangentAt(u);
      plane.position.copy(pp);
      plane.lookAt(aim.copy(pp).add(tg2));                 /* nose follows the climb, cruise and descent */
      var tgb = curve.getTangentAt(Math.min(0.9995, u + 0.01));
      var dh = Math.atan2(tgb.x, -tgb.z) - Math.atan2(tg2.x, -tg2.z);
      if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
      var tRoll = K.clamp(dh * 3, -0.45, 0.45);             /* bank into the turn, right turn = right wing down */
      st.roll = (!st.init || dt === 0 || rm) ? tRoll : K.damp(st.roll, tRoll, 0.08, dt);
      plane.rotateZ(st.roll);
      if (cur) {
        if (!rm) cur.userData.prop.rotation.x += dt * 42;
        var L = cur.userData.lights;
        L.beacon.visible = rm || (t % 1.3) < 0.12;
        var on = !rm && (t % 1.1) < 0.06; L.strobes.forEach(function (s) { s.visible = on; });
      }
      shadowRing.position.set(pp.x, height(pp.x, pp.z) + 0.05, pp.z);
      stickArr[0] = pp.x; stickArr[1] = pp.y; stickArr[2] = pp.z; stickArr[3] = pp.x; stickArr[4] = height(pp.x, pp.z) + 0.03; stickArr[5] = pp.z;
      stickGeo.attributes.position.needsUpdate = true;

      var px = K.pointer.x, py = K.pointer.y;
      tLook.copy(pp).addScaledVector(right, -shift); tLook.y = pp.y * 0.5 + 0.4;
      tPos.copy(tLook).add(OFF).addScaledVector(right, px * 1.2); tPos.y += py * 0.8;
      if (!camPos.lengthSq() || rm || dt === 0 && !st.init) { camPos.copy(tPos); camLook.copy(tLook); }
      else if (dt > 0) { var k = 1 - Math.pow(0.95, dt * 60); camPos.lerp(tPos, k); camLook.lerp(tLook, k); }
      camera.position.copy(camPos); camera.lookAt(camLook); camera.updateMatrixWorld();
      placeLabels();
      st.init = true;

      var leg = 0; for (var i = 1; i < U.length - 1; i++) if (st.p >= U[i]) leg = i;
      if (leg !== st.leg) {
        st.leg = leg;
        rows.forEach(function (r, i) { r.classList.toggle('on', i === leg); r.classList.toggle('past', i < leg); });
        lvLeg.textContent = (leg + 1) + '/4';
      }
      var now = performance.now();
      if (now - st.at > 100 || dt === 0) {
        st.at = now;
        var en = document.documentElement.lang === 'en';
        var a = (Math.round(pp.y / FT / 50) * 50).toLocaleString(en ? 'en-US' : 'fr-FR') + ' ft';
        if (a !== st.a) { st.a = a; lvAlt.textContent = a; }
        var fv = (fuelTotal() * st.p).toFixed(1), f = (en ? fv : fv.replace('.', ',')) + ' L';
        if (f !== st.f) { st.f = f; lvFuel.textContent = f; }
      }
    }
    function resize(w, h) {
      VW = w; VH = h;
      shift = w < 721 ? 0 : 3.2;
      OFF.copy(OFF0).multiplyScalar(w / h < 1 ? 1.35 : 1);
    }

    var sceneObj = { stage: stage, readyEl: sec, canvas: canvas, scene: scene, camera: camera, renderer: renderer, update: update, resize: resize, onTheme: onTheme };
    K.add(sceneObj);
    document.addEventListener('altiview:aircraft', function (ev) {
      setPlane(ev.detail && ev.detail.id);
      st.f = ''; K.renderOnce(sceneObj); K.kick();
    });
    if (document.fonts && document.fonts.load) {
      document.fonts.load('800 100px "Big Shoulders Display"').then(function () {
        decals.forEach(function (d) { d.draw(); d.tex.needsUpdate = true; }); K.renderOnce(sceneObj);
      }).catch(function () {});
    }
  }).catch(function (e) { if (window.console) console.warn('Altiview route 3D:', e && e.message); });
})();
