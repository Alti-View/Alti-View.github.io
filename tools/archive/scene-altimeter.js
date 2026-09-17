/* ALTIVIEW · performances: 3D altimeter, hands wound by scroll */
(function () {
  'use strict';
  var K = window.AltiKit;
  var stage = document.getElementById('altStage');
  var canvas = document.getElementById('altCanvas');
  var roPa = document.getElementById('roPa'), roOat = document.getElementById('roOat'), roDa = document.getElementById('roDa');
  var TARGET = 4500, ISA_DEV = 15;
  var TAU = Math.PI * 2;
  function nf(n) { return Math.round(n).toLocaleString('fr-FR'); }

  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function drawDial(cv) {
    var ctx = cv.getContext('2d'), S = cv.width, c = S / 2;
    ctx.clearRect(0, 0, S, S);
    var g = ctx.createRadialGradient(c, c * 0.85, S * 0.05, c, c, c);
    g.addColorStop(0, '#11171F'); g.addColorStop(1, '#05070A');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.translate(c, c);
    ctx.fillStyle = '#E9EDF0';
    for (var i = 0; i < 50; i++) {
      var major = i % 5 === 0, w = major ? S * 0.011 : S * 0.0055, l = major ? S * 0.066 : S * 0.036;
      ctx.save(); ctx.rotate(i / 50 * TAU); ctx.fillRect(-w / 2, -c * 0.965, w, l); ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 ' + Math.round(S * 0.15) + 'px "Big Shoulders Display","Arial Narrow",sans-serif';
    for (var n = 0; n < 10; n++) { var a = n / 10 * TAU; ctx.fillText(String(n), Math.sin(a) * c * 0.7, -Math.cos(a) * c * 0.7 + S * 0.004); }
    ctx.fillStyle = '#93A7B8';
    ctx.font = '500 ' + Math.round(S * 0.036) + 'px "IBM Plex Mono",monospace';
    ctx.fillText('ALT', 0, -c * 0.33);
    ctx.fillText('100 FT', 0, c * 0.38);
    /* low-altitude crosshatch flag */
    ctx.save(); rrect(ctx, -c * 0.11, -c * 0.555, c * 0.22, c * 0.09, S * 0.005); ctx.clip();
    ctx.fillStyle = '#E9EDF0'; ctx.fillRect(-c * 0.12, -c * 0.56, c * 0.24, c * 0.1);
    ctx.fillStyle = '#07090C';
    for (var k = -8; k < 8; k++) { var x0 = k * c * 0.045; ctx.beginPath(); ctx.moveTo(x0, -c * 0.56); ctx.lineTo(x0 + c * 0.022, -c * 0.56); ctx.lineTo(x0 + c * 0.112, -c * 0.46); ctx.lineTo(x0 + c * 0.09, -c * 0.46); ctx.fill(); }
    ctx.restore();
    /* pressure setting window */
    var wx = c * 0.3, ww = c * 0.27, wh = c * 0.13;
    ctx.fillStyle = '#020304'; rrect(ctx, wx, -wh / 2, ww, wh, S * 0.008); ctx.fill();
    ctx.strokeStyle = '#3A4B5F'; ctx.lineWidth = S * 0.003; ctx.stroke();
    ctx.fillStyle = '#FFA94D'; ctx.font = '500 ' + Math.round(S * 0.05) + 'px "IBM Plex Mono",monospace';
    ctx.fillText('1013', wx + ww / 2, S * 0.003);
    ctx.fillStyle = '#93A7B8'; ctx.font = '500 ' + Math.round(S * 0.024) + 'px "IBM Plex Mono",monospace';
    ctx.fillText('hPa', wx + ww / 2, wh / 2 + S * 0.026);
    ctx.restore();
  }

  K.ready.then(function (T) {
    var lite = K.lite();
    var renderer = K.renderer(canvas);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(26, 1, 0.1, 50);
    camera.position.set(0, 0, 7.6);
    K.envFor(renderer, scene);
    var key = new T.DirectionalLight(0xffffff, 1.25); key.position.set(-3, 4, 6); scene.add(key);
    var warm = new T.PointLight(0xffa94d, 5, 9, 2); warm.position.set(2.4, -2.4, 2.4); scene.add(warm);

    var inst = new T.Group(); scene.add(inst);
    inst.add(K.instrumentCase());

    var cv = document.createElement('canvas'); cv.width = cv.height = lite ? 768 : 1024;
    drawDial(cv);
    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var dial = new T.Mesh(new T.CircleGeometry(1.12, 128), new T.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0 }));
    dial.position.z = -0.22; inst.add(dial);

    var handMat = new T.MeshStandardMaterial({ color: 0xEEF1F3, roughness: 0.42, metalness: 0.15 });
    function hand(pts, z, mat) {
      var s = new T.Shape(); pts.forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); }); s.closePath();
      var m = new T.Mesh(new T.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false }), mat || handMat);
      m.position.z = z; inst.add(m); return m;
    }
    var h10k = hand([[-0.012, -0.1], [0.012, -0.1], [0.012, 0.8], [0.045, 0.8], [0, 0.97], [-0.045, 0.8], [-0.012, 0.8]], -0.195,
      new T.MeshStandardMaterial({ color: 0xC9D2DA, roughness: 0.5, metalness: 0.1 }));
    var h1000 = hand([[-0.05, -0.14], [0.05, -0.14], [0.078, 0.3], [0, 0.56], [-0.078, 0.3]], -0.175);
    var h100 = hand([[-0.028, -0.24], [0.028, -0.24], [0.024, 0.72], [0, 0.93], [-0.024, 0.72]], -0.155);
    var cap = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.05, 32), new T.MeshStandardMaterial({ color: 0x3A4B5F, metalness: 0.9, roughness: 0.3 }));
    cap.rotation.x = Math.PI / 2; cap.position.z = -0.12; inst.add(cap);

    var glass = K.glass(1.12); glass.position.z = 0.06; inst.add(glass);
    var glare = glass.userData.glare.material.uniforms;

    var st = { init: false, alt: 0, ry: -0.3, rx: 0.08, at: 0, a: '', o: '', d: '' };
    function update(dt, t) {
      var rm = K.reduced();
      var r = stage.getBoundingClientRect(), vh = innerHeight;
      var p = K.clamp((vh - r.top) / (vh * 0.5 + r.height * 0.5), 0, 1);
      var tAlt = rm ? TARGET : TARGET * p * p * (3 - 2 * p);
      var px = K.pointer.x, py = K.pointer.y;
      var tRy = rm ? -0.3 : -0.3 + px * 0.1, tRx = rm ? 0.08 : 0.08 + py * 0.06;
      if (!st.init || rm) { st.alt = tAlt; st.ry = tRy; st.rx = tRx; st.init = true; }
      else if (dt > 0) { st.alt = K.damp(st.alt, tAlt, 0.06, dt); st.ry = K.damp(st.ry, tRy, 0.05, dt); st.rx = K.damp(st.rx, tRx, 0.05, dt); }
      var shown = st.alt + (rm ? 0 : Math.sin(t * 2.3) * 2.5 + Math.sin(t * 5.1) * 1.2);
      h100.rotation.z = -(shown % 1000) / 1000 * TAU;
      h1000.rotation.z = -(shown % 10000) / 10000 * TAU;
      h10k.rotation.z = -(shown / 100000) * TAU;
      inst.rotation.set(st.rx, st.ry, 0);
      glare.uOff.value.set(px, -py);

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

    var s = { stage: stage, canvas: canvas, scene: scene, camera: camera, renderer: renderer, update: update };
    K.add(s);

    /* redraw the dial once the display face is really loaded */
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('800 100px "Big Shoulders Display"'), document.fonts.load('500 40px "IBM Plex Mono"')])
        .then(function () { drawDial(cv); tex.needsUpdate = true; K.renderOnce(s); }).catch(function () {});
    }
  }).catch(function (e) { if (window.console) console.warn('Altiview altimeter 3D:', e && e.message); });
})();
