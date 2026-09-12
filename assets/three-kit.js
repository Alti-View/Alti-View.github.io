/* ALTIVIEW · shared Three.js kit: loader, instrument case, glass, one render loop for every scene */
(function () {
  'use strict';
  var K = window.AltiKit = { scenes: [] };
  var reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var liteMQ = matchMedia('(max-width: 720px), (pointer: coarse)');
  K.reduced = function () { return reducedMQ.matches; };
  K.lite = function () { return liteMQ.matches; };
  K.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  /* frame-rate independent smoothing, k is the per-60fps-frame factor */
  K.damp = function (cur, target, k, dt) { return cur + (target - cur) * (1 - Math.pow(1 - k, dt * 60)); };
  K.theme = function () { return document.documentElement.getAttribute('data-theme') === 'day' ? 'day' : 'night'; };

  K.pointer = { x: 0, y: 0 };
  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    K.pointer.x = e.clientX / innerWidth * 2 - 1;
    K.pointer.y = e.clientY / innerHeight * 2 - 1;
    K.kick();
  }, { passive: true });
  addEventListener('scroll', function () { K.kick(); }, { passive: true });

  function webglOK() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
  }
  K.ready = webglOK()
    ? Promise.all([import('three'), import('three/addons/environments/RoomEnvironment.js')]).then(function (m) {
        K.THREE = m[0]; K.RoomEnvironment = m[1].RoomEnvironment; return m[0];
      })
    : Promise.reject(new Error('WebGL indisponible'));
  K.ready.catch(function () { /* the SVG fallbacks stay in place */ });

  K.renderer = function (canvas) {
    var T = K.THREE;
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, K.lite() ? 1.5 : 2));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    return r;
  };
  K.envFor = function (renderer, scene) {
    var T = K.THREE, pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new K.RoomEnvironment(), 0.04).texture;
    pm.dispose();
  };

  /* a panel-mount instrument: rounded square case, bevel, dark well, metal rim, four screws */
  K.instrumentCase = function () {
    var T = K.THREE, g = new T.Group();
    var s = 1.36, rr = 0.42, sh = new T.Shape();
    sh.moveTo(-s + rr, -s); sh.lineTo(s - rr, -s); sh.quadraticCurveTo(s, -s, s, -s + rr);
    sh.lineTo(s, s - rr); sh.quadraticCurveTo(s, s, s - rr, s); sh.lineTo(-s + rr, s);
    sh.quadraticCurveTo(-s, s, -s, s - rr); sh.lineTo(-s, -s + rr); sh.quadraticCurveTo(-s, -s, -s + rr, -s);
    var hole = new T.Path(); hole.absarc(0, 0, 1.13, 0, Math.PI * 2, true); sh.holes.push(hole);
    var geo = new T.ExtrudeGeometry(sh, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 5, curveSegments: 56 });
    geo.translate(0, 0, -0.24);
    g.add(new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x131D2A, metalness: 0.6, roughness: 0.46 })));

    var rim = new T.Mesh(new T.TorusGeometry(1.13, 0.055, 24, 180), new T.MeshStandardMaterial({ color: 0x2E3C4D, metalness: 0.95, roughness: 0.24 }));
    rim.position.z = 0.035; g.add(rim);

    var well = new T.Mesh(new T.CylinderGeometry(1.12, 1.12, 0.6, 128, 1, true),
      new T.MeshStandardMaterial({ color: 0x06090D, metalness: 0.3, roughness: 0.75, side: T.BackSide }));
    well.rotation.x = Math.PI / 2; well.position.z = -0.26; g.add(well);

    var sg = new T.CylinderGeometry(0.085, 0.085, 0.05, 32);
    var sm = new T.MeshStandardMaterial({ color: 0x4A5B6C, metalness: 0.95, roughness: 0.3 });
    var slg = new T.BoxGeometry(0.13, 0.02, 0.02);
    var slm = new T.MeshStandardMaterial({ color: 0x0A1119, roughness: 0.9 });
    [[1, 1, 0.4], [-1, 1, 1.9], [1, -1, -0.7], [-1, -1, 2.6]].forEach(function (p) {
      var m = new T.Mesh(sg, sm); m.rotation.x = Math.PI / 2; m.position.set(p[0] * 1.08, p[1] * 1.08, 0.06); g.add(m);
      var sl = new T.Mesh(slg, slm); sl.position.set(p[0] * 1.08, p[1] * 1.08, 0.088); sl.rotation.z = p[2]; g.add(sl);
    });
    return g;
  };

  /* cover glass: a faint reflective disc plus a soft glare band that slides with the pointer */
  K.glass = function (radius) {
    var T = K.THREE, g = new T.Group();
    g.add(new T.Mesh(new T.CircleGeometry(radius, 96), new T.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.08,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4, depthWrite: false
    })));
    var glare = new T.Mesh(new T.CircleGeometry(radius, 96), new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uOff: { value: new T.Vector2() }, uStr: { value: 0.1 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform vec2 uOff;uniform float uStr;void main(){vec2 p=vUv-.5+uOff*.07;float d=p.x*.75+p.y;' +
        'float b=smoothstep(.13,.0,abs(d-.2))*.9+smoothstep(.05,.0,abs(d-.38))*.4;float e=smoothstep(.5,.3,length(vUv-.5));' +
        'gl_FragColor=vec4(vec3(1.),b*uStr*e);}'
    }));
    glare.position.z = 0.002; g.add(glare);
    g.userData.glare = glare;
    return g;
  };

  /* ---------- scene registry and the single render loop ---------- */
  function size(s) {
    var w = s.stage.clientWidth, h = s.stage.clientHeight;
    if (!w || !h) return;
    s.renderer.setSize(w, h, false);
    s.camera.aspect = w / h;
    s.camera.updateProjectionMatrix();
    if (s.resize) s.resize(w, h);
    K.renderOnce(s);
  }
  K.renderOnce = function (s) { s.update(0, performance.now() / 1000); s.renderer.render(s.scene, s.camera); };

  K.add = function (s) {
    K.scenes.push(s);
    new ResizeObserver(function () { size(s); }).observe(s.stage);
    new IntersectionObserver(function (es) {
      s.visible = es[es.length - 1].isIntersecting;
      if (s.visible) { K.renderOnce(s); K.kick(); }
    }, { rootMargin: '120px' }).observe(s.stage);
    size(s);
    (s.readyEl || s.stage).classList.add('ready');
  };

  var raf = null, last = 0, acc = 0, odd = false;
  function frame(now) {
    raf = null;
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now; acc += dt;
    var lite = K.lite(), any = false;
    odd = !odd;
    for (var i = 0; i < K.scenes.length; i++) {
      var s = K.scenes[i];
      if (!s.visible) continue;
      any = true;
      if (lite && odd) continue;          /* phones and tablets render at half rate */
      s.update(acc, now / 1000);
      s.renderer.render(s.scene, s.camera);
    }
    if (!(lite && odd)) acc = 0;
    if (any && !document.hidden && !K.reduced()) raf = requestAnimationFrame(frame);
    else { last = 0; acc = 0; }
  }
  K.kick = function () { if (raf === null && !document.hidden && !K.reduced()) raf = requestAnimationFrame(frame); };

  document.addEventListener('visibilitychange', function () { if (!document.hidden) K.kick(); });
  reducedMQ.addEventListener('change', function () { K.scenes.forEach(K.renderOnce); K.kick(); });
  document.addEventListener('altiview:theme', function () {
    K.scenes.forEach(function (s) { if (s.onTheme) s.onTheme(); K.renderOnce(s); });
  });
})();
