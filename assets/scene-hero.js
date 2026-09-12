/* ALTIVIEW · hero: 3D artificial horizon driven by pointer and scroll */
(function () {
  'use strict';
  var K = window.AltiKit;
  var stage = document.getElementById('heroStage');
  var canvas = document.getElementById('heroCanvas');
  var hero = document.querySelector('.hero');
  var horizon = document.getElementById('heroHorizon');
  var hudP = document.getElementById('hudPitch'), hudR = document.getElementById('hudRoll');
  var D2R = Math.PI / 180;

  var VS = 'varying vec3 vP;varying vec3 vN;void main(){vP=position;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  /* sky / ground ball with horizon line and a 5-degree pitch ladder, all procedural */
  var FS = [
    'varying vec3 vP;varying vec3 vN;',
    'void main(){',
    ' vec3 p=normalize(vP);',
    ' float deg=degrees(asin(clamp(p.y,-1.,1.)));',
    ' vec3 skyH=vec3(.20,.50,.76),skyT=vec3(.035,.15,.29),gH=vec3(.48,.31,.16),gL=vec3(.14,.085,.045);',
    ' vec3 col=deg>0.?mix(skyH,skyT,smoothstep(0.,60.,deg)):mix(gH,gL,smoothstep(0.,60.,-deg));',
    ' float aa=fwidth(deg);',
    ' float hz=1.-smoothstep(.34,.34+aa*1.5,abs(deg));',
    ' float idx=floor((deg+2.5)/5.);',
    ' float m=deg-idx*5.;',
    ' float ten=1.-step(.5,abs(mod(idx,2.)));',
    ' float hw=mix(.085,.19,ten);',
    ' float lad=(1.-smoothstep(.2,.2+aa*1.5,abs(m)))*(1.-smoothstep(hw,hw+.006,abs(p.x)))*step(.5,abs(idx))*step(abs(deg),31.)*step(0.,p.z);',
    ' col=mix(col,vec3(.93,.95,.96),max(hz,lad*.9));',
    ' col*=mix(.42,1.,pow(clamp(vN.z,0.,1.),.7));',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  K.ready.then(function (T) {
    var lite = K.lite();
    var renderer = K.renderer(canvas);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(26, 1, 0.1, 50);
    camera.position.set(0, 0, 7.6);
    K.envFor(renderer, scene);
    var key = new T.DirectionalLight(0xffffff, 1.3); key.position.set(-3, 4, 6); scene.add(key);
    var warm = new T.PointLight(0xffa94d, 5, 9, 2); warm.position.set(2.6, -2.2, 2.4); scene.add(warm);

    var inst = new T.Group(); scene.add(inst);
    inst.add(K.instrumentCase());

    /* rolling assembly: the ball (pitch) and the bank index, rolled together */
    var roller = new T.Group(); inst.add(roller);
    var ball = new T.Mesh(new T.SphereGeometry(1, lite ? 72 : 120, lite ? 54 : 90), new T.ShaderMaterial({ vertexShader: VS, fragmentShader: FS }));
    ball.position.z = -1; roller.add(ball);
    var white = new T.MeshBasicMaterial({ color: 0xE9EFF3 });
    var tri = new T.Shape(); tri.moveTo(-0.05, 0.79); tri.lineTo(0.05, 0.79); tri.lineTo(0, 0.89); tri.closePath();
    var idx = new T.Mesh(new T.ShapeGeometry(tri), white); idx.position.z = 0.004; roller.add(idx);

    /* fixed face: dark mask ring with the bank scale, zero index in amber */
    var mask = new T.Mesh(new T.RingGeometry(0.9, 1.13, 160), new T.MeshStandardMaterial({ color: 0x0A0F15, roughness: 0.85, metalness: 0.1 }));
    mask.position.z = 0.008; inst.add(mask);
    [[10, 0], [20, 0], [30, 1], [45, 0], [60, 1]].forEach(function (d) {
      [-1, 1].forEach(function (s) {
        var a = d[0] * s * D2R, len = d[1] ? 0.13 : 0.075, rm = 0.925 + len / 2;
        var tk = new T.Mesh(new T.BoxGeometry(d[1] ? 0.024 : 0.016, len, 0.004), white);
        tk.position.set(Math.sin(a) * rm, Math.cos(a) * rm, 0.012); tk.rotation.z = -a; inst.add(tk);
      });
    });
    var amber = new T.MeshStandardMaterial({ color: 0xFFA94D, emissive: 0xFF8A1A, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.4 });
    var zt = new T.Shape(); zt.moveTo(-0.055, 1.075); zt.lineTo(0.055, 1.075); zt.lineTo(0, 0.945); zt.closePath();
    var zero = new T.Mesh(new T.ShapeGeometry(zt), amber); zero.position.z = 0.013; inst.add(zero);

    /* fixed aircraft symbol */
    var sym = new T.Group(); sym.position.z = 0.03; inst.add(sym);
    [-1, 1].forEach(function (s) {
      var wing = new T.Mesh(new T.BoxGeometry(0.34, 0.045, 0.03), amber); wing.position.set(s * 0.37, 0, 0); sym.add(wing);
      var bar = new T.Mesh(new T.BoxGeometry(0.235, 0.042, 0.03), amber); bar.position.set(s * 0.1, -0.06, 0); bar.rotation.z = s * 0.54; sym.add(bar);
    });
    var dot = new T.Mesh(new T.SphereGeometry(0.036, 20, 14), amber); dot.position.set(0, 0, 0.01); sym.add(dot);

    var glass = K.glass(1.12); glass.position.z = 0.06; inst.add(glass);
    var glare = glass.userData.glare.material.uniforms;

    var st = { init: false, pitch: 0, roll: 0, ry: 0, rx: 0, t0: performance.now() / 1000, at: 0, hp: '', hr: '', hz: '' };
    function isEN() { return document.documentElement.lang === 'en'; }
    function fmtPitch(v) { var s = Math.abs(v).toFixed(1); return (v >= -0.05 ? '+' : '−') + (isEN() ? s : s.replace('.', ',')) + '°'; }

    function update(dt, t) {
      var rm = K.reduced();
      var r = hero.getBoundingClientRect();
      var sp = K.clamp(-r.top / Math.max(1, r.height), 0, 1);
      var px = K.pointer.x, py = K.pointer.y;
      var erect = rm ? 0 : Math.exp(-(t - st.t0) * 1.3);          /* the gyro erects on load */
      var tbR = rm ? 0 : Math.sin(t * 0.63) * 1.2 + Math.sin(t * 1.71 + 1.3) * 0.4;
      var tbP = rm ? 0 : Math.sin(t * 0.47 + 0.6) * 0.5 + Math.sin(t * 1.37) * 0.15;
      var tRoll = rm ? 6 : px * 16 + tbR + 34 * erect;
      var tPitch = rm ? 2 : -py * 5 - sp * 16 + tbP - 9 * erect;   /* scrolling down pitches the nose down */
      var tRy = rm ? -0.12 : px * 0.22 - 0.1, tRx = rm ? 0.05 : py * 0.12 + 0.04;
      if (!st.init || rm) { st.roll = tRoll; st.pitch = tPitch; st.ry = tRy; st.rx = tRx; st.init = true; }
      else if (dt > 0) {
        st.roll = K.damp(st.roll, tRoll, 0.06, dt); st.pitch = K.damp(st.pitch, tPitch, 0.06, dt);
        st.ry = K.damp(st.ry, tRy, 0.05, dt); st.rx = K.damp(st.rx, tRx, 0.05, dt);
      }
      roller.rotation.z = st.roll * D2R;
      ball.rotation.x = st.pitch * D2R;
      inst.rotation.set(st.rx, st.ry, 0);
      glare.uOff.value.set(px, -py);

      var now = performance.now();
      if (now - st.at > 100 || dt === 0) {
        st.at = now;
        var a = fmtPitch(st.pitch);
        if (a !== st.hp) { st.hp = a; hudP.textContent = a; }
        var rr = Math.round(Math.abs(st.roll));
        var b = rr === 0 ? '0°' : rr + '° ' + (st.roll > 0 ? (isEN() ? 'R' : 'D') : (isEN() ? 'L' : 'G'));
        if (b !== st.hr) { st.hr = b; hudR.textContent = b; }
      }
      var hz = 'translate3d(0,' + (st.pitch * 7).toFixed(1) + 'px,0) rotate(' + (-st.roll * 0.4).toFixed(2) + 'deg)';
      if (hz !== st.hz) { st.hz = hz; horizon.style.transform = hz; }
    }

    K.add({ stage: stage, canvas: canvas, scene: scene, camera: camera, renderer: renderer, update: update });
  }).catch(function (e) { if (window.console) console.warn('Altiview hero 3D:', e && e.message); });
})();
