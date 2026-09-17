/* ALTIVIEW · the five built-in aircraft as parametric 3D models, shared by the performance and navigation scenes */
(function () {
  'use strict';
  var K = window.AltiKit;
  var D2R = Math.PI / 180;
  var NAVY = 0x22313F, AMBER = 0xFFA94D, CYAN = 0x4FD8C4;

  /* each aircraft in metres, nose along +X, right wing along +Z, fuselage axis at y = 0 */
  var SPECS = {
    c172: {
      reg: 'F-HJAK', span: 11.0,
      prof: [[0, -4.6], [0.06, -4.55], [0.14, -4.0], [0.24, -3.0], [0.36, -2.0], [0.46, -1.1], [0.52, -0.2], [0.53, 0.7], [0.5, 1.6], [0.44, 2.4], [0.36, 3.0], [0.2, 3.35], [0, 3.42]],
      sq: { z: 0.84, belly: 0.82, top: 0.8 }, rise: { x0: -1.2, k: 0.1 },
      paint: { stripe: NAVY, line: CYAN, belly: null, trim: NAVY },
      canopy: { type: 'cabin', pts: [[1.2, 0.15], [0.72, 0.78], [-0.55, 0.78], [-2.0, 0.28], [-2.0, 0.05], [1.15, 0.05]], half: 0.42, posts: [[0.02, 0.6, 0.42], [-0.62, 0.58, 0.42]] },
      wing: { y: 0.84, x: -0.08, chord: 1.63, t: 0.13, cam: 0.03, panels: [{ len: 2.6, dih: 1.7, tip: 1.63 }, { len: 2.9, dih: 1.7, tip: 1.12, te: true }], struts: { a: [0.35, -0.28, 0.42], b: [0.3, 0.74, 2.55] } },
      tail: { stab: { x: -4.1, y: 0.38, c: 0.95, half: 1.7 }, fin: [[-3.3, 0.35], [-4.25, 0.35], [-4.55, 1.75], [-4.15, 1.75], [-3.6, 0.8]], rudder: [[-4.25, 0.35], [-4.62, 0.35], [-4.78, 1.75], [-4.55, 1.75]], beacon: [-4.45, 1.8] },
      gear: { spats: true, spatLen: 0.5, main: { attach: [-0.1, -0.4, 0.35], wheel: [-0.15, -1.15, 1.25] }, nose: { attach: [2.6, -0.3], wheel: [2.65, -1.05] } },
      prop: { x: 3.4, blades: 2, r: 0.95, spinner: [0.18, 0.4] }, decal: { x: -2.4, y: 0.05 }
    },
    dr400: {
      reg: 'F-HBIQ', span: 8.72,
      prof: [[0, -3.75], [0.07, -3.7], [0.16, -3.2], [0.26, -2.4], [0.38, -1.4], [0.48, -0.4], [0.53, 0.5], [0.52, 1.4], [0.49, 1.95], [0.45, 2.45], [0.36, 2.85], [0.2, 3.02], [0, 3.06]],
      sq: { z: 0.9, belly: 0.86, top: 1 }, rise: { x0: -0.3, k: 0.07 },
      paint: { stripe: AMBER, line: NAVY, belly: NAVY, trim: AMBER },
      canopy: { type: 'bubble', x: 0.45, y: 0.3, s: [1.05, 0.55, 0.47], heads: [[0.3, 0.62, 0.2], [0.3, 0.62, -0.2]] },
      wing: { y: -0.42, x: 0.15, chord: 1.65, t: 0.14, cam: 0.025, panels: [{ len: 1.9, dih: 0, tip: 1.65 }, { len: 2.5, dih: 14, tip: 1.65 }] },
      tail: { stab: { x: -3.25, y: 0.2, c: 0.8, half: 1.5 }, fin: [[-2.95, 0.25], [-3.62, 0.25], [-3.78, 1.42], [-3.5, 1.42], [-3.1, 0.62]], rudder: [[-3.62, 0.25], [-3.82, 0.25], [-3.98, 1.42], [-3.78, 1.42]], beacon: [-3.66, 1.47] },
      gear: { spats: true, spatLen: 0.5, main: { attach: [0.15, -0.5, 1.3], wheel: [0.1, -1.08, 1.4] }, nose: { attach: [2.35, -0.38], wheel: [2.35, -1.0] } },
      prop: { x: 3.06, blades: 2, r: 0.92, spinner: [0.17, 0.42] }, decal: { x: -1.9, y: 0.06 }
    },
    pa28: {
      reg: 'F-GIEC', span: 10.8,
      prof: [[0, -4.1], [0.06, -4.05], [0.13, -3.6], [0.24, -2.7], [0.37, -1.7], [0.48, -0.7], [0.52, 0.3], [0.5, 1.3], [0.45, 2.1], [0.36, 2.7], [0.2, 3.05], [0, 3.12]],
      sq: { z: 0.88, belly: 0.82, top: 0.78 }, rise: { x0: -1.0, k: 0.05 },
      paint: { stripe: AMBER, line: NAVY, belly: null, trim: NAVY },
      canopy: { type: 'cabin', pts: [[1.15, 0.2], [0.55, 0.82], [-0.75, 0.8], [-1.8, 0.3], [-1.8, 0.05], [1.1, 0.05]], half: 0.43, posts: [[-0.12, 0.62, 0.44]], roof: [-0.75, 0.55, 0.81] },
      wing: { y: -0.36, x: 0.05, chord: 1.6, t: 0.15, cam: 0.03, panels: [{ len: 2.3, dih: 7, tip: 1.6 }, { len: 3.1, dih: 7, tip: 1.07, te: true }] },
      tail: { stab: { x: -3.75, y: 0.12, c: 0.8, half: 1.63 }, fin: [[-3.0, 0.25], [-3.85, 0.25], [-4.15, 1.45], [-3.75, 1.45], [-3.3, 0.7]], rudder: [[-3.85, 0.25], [-4.2, 0.25], [-4.35, 1.45], [-4.15, 1.45]], beacon: [-4.05, 1.5] },
      gear: { spats: true, spatLen: 0.48, main: { attach: [0.05, -0.45, 1.55], wheel: [0.0, -1.05, 1.6] }, nose: { attach: [2.3, -0.35], wheel: [2.35, -1.0] } },
      prop: { x: 3.12, blades: 2, r: 0.95, spinner: [0.17, 0.4] }, decal: { x: -2.2, y: 0.02 }
    },
    da40: {
      reg: 'F-MORIS', span: 11.6,
      prof: [[0, -4.7], [0.05, -4.65], [0.1, -4.0], [0.16, -3.0], [0.28, -2.0], [0.44, -1.0], [0.53, 0.0], [0.54, 0.8], [0.5, 1.6], [0.42, 2.3], [0.3, 2.85], [0.16, 3.15], [0, 3.22]],
      sq: { z: 0.9, belly: 0.8, top: 0.85 }, rise: { x0: -1.5, k: 0.06 },
      paint: { stripe: CYAN, line: null, belly: null, trim: AMBER },
      canopy: { type: 'bubble', x: 0.1, y: 0.28, s: [1.35, 0.56, 0.5], heads: [[0.25, 0.62, 0.2], [0.25, 0.62, -0.2]] },
      wing: { y: -0.32, x: 0.2, chord: 1.45, t: 0.15, cam: 0.03, panels: [{ len: 1.1, dih: 5, tip: 1.45 }, { len: 4.7, dih: 5, tip: 0.78 }, { len: 0.36, dih: 70, tip: 0.4, winglet: true }] },
      tail: { stab: { x: -4.35, y: 1.65, c: 0.72, half: 1.5 }, fin: [[-3.25, 0.2], [-4.1, 0.2], [-4.55, 1.62], [-4.1, 1.62], [-3.55, 0.7]], rudder: [[-4.1, 0.2], [-4.4, 0.2], [-4.72, 1.62], [-4.55, 1.62]], beacon: [-4.4, 1.75] },
      gear: { spats: true, spatLen: 0.45, main: { attach: [0.25, -0.42, 1.3], wheel: [0.2, -1.0, 1.45] }, nose: { attach: [2.35, -0.3], wheel: [2.4, -0.95] } },
      prop: { x: 3.22, blades: 3, r: 0.9, spinner: [0.2, 0.5] }, decal: { x: -2.3, y: 0.02 }
    },
    c152: {
      reg: 'F-GDDJ', span: 10.1,
      prof: [[0, -4.05], [0.05, -4.0], [0.13, -3.5], [0.22, -2.6], [0.34, -1.7], [0.44, -0.8], [0.48, 0.1], [0.47, 0.9], [0.44, 1.6], [0.37, 2.3], [0.2, 2.72], [0, 2.78]],
      sq: { z: 0.8, belly: 0.82, top: 0.78 }, rise: { x0: -1.0, k: 0.1 },
      paint: { stripe: NAVY, line: AMBER, belly: null, trim: AMBER },
      canopy: { type: 'cabin', pts: [[1.0, 0.12], [0.55, 0.72], [-0.45, 0.72], [-1.7, 0.25], [-1.7, 0.03], [0.95, 0.03]], half: 0.38, posts: [[-0.02, 0.55, 0.36]] },
      wing: { y: 0.78, x: -0.1, chord: 1.6, t: 0.13, cam: 0.03, panels: [{ len: 2.35, dih: 1, tip: 1.6 }, { len: 2.7, dih: 1, tip: 1.1, te: true }], struts: { a: [0.3, -0.25, 0.38], b: [0.25, 0.7, 2.3] } },
      tail: { stab: { x: -3.6, y: 0.36, c: 0.9, half: 1.5 }, fin: [[-2.9, 0.33], [-3.72, 0.33], [-3.95, 1.55], [-3.6, 1.55], [-3.15, 0.75]], rudder: [[-3.72, 0.33], [-4.05, 0.33], [-4.2, 1.55], [-3.95, 1.55]], beacon: [-3.9, 1.6] },
      gear: { spats: false, main: { attach: [-0.2, -0.38, 0.32], wheel: [-0.25, -1.05, 1.15] }, nose: { attach: [2.1, -0.28], wheel: [2.15, -0.98] } },
      prop: { x: 2.78, blades: 2, r: 0.88, spinner: [0.15, 0.34] }, decal: { x: -2.1, y: 0.04 }
    }
  };

  /* NACA-style section, leading edge at +c/2, one closed counter-clockwise loop */
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
  /* lofted skin between a root and a tip section (shared vertices, smooth shading) */
  function loft(T, root, tip, span, dx, dy) {
    var n = root.length, pos = new Float32Array(n * 6), idx = [];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = root[i][0]; pos[i * 3 + 1] = root[i][1]; pos[i * 3 + 2] = 0;
      var o = (n + i) * 3; pos[o] = tip[i][0] + dx; pos[o + 1] = tip[i][1] + dy; pos[o + 2] = span;
    }
    for (i = 0; i < n; i++) { var a = i, b = (i + 1) % n, c = n + i, d = n + (i + 1) % n; idx.push(a, b, d, a, d, c); }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function shapeOf(T, pts) { var s = new T.Shape(); pts.forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); }); return s; }
  function radiusAt(prof, x) {
    for (var i = 1; i < prof.length; i++) if (x <= prof[i][1]) { var a = prof[i - 1], b = prof[i], f = (x - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * f; }
    return 0;
  }
  function riseAt(sp, x) { return x < sp.rise.x0 ? (sp.rise.x0 - x) * sp.rise.k : 0; }
  function rod(T, parent, a, b, r, mat, sx) {
    var A = new T.Vector3(a[0], a[1], a[2]), d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
    var m = new T.Mesh(new T.CylinderGeometry(r, r, 1, 10), mat);
    m.scale.set(sx || 1, L, 1); m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); parent.add(m); return m;
  }

  /* one material set per scene (each scene tints its own copy if it needs to) */
  function materials(T) {
    var M = {
      paint: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05 }),
      white: new T.MeshStandardMaterial({ color: 0xF1F4F6, roughness: 0.34, metalness: 0.05 }),
      dark: new T.MeshStandardMaterial({ color: 0x1A2029, roughness: 0.6, metalness: 0.3 }),
      glass: new T.MeshPhysicalMaterial({ color: 0x0E1E2A, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.84, envMapIntensity: 1.8 }),
      disc: new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false, side: T.DoubleSide }),
      red: new T.MeshBasicMaterial({ color: 0xFF4D4D, toneMapped: false }),
      green: new T.MeshBasicMaterial({ color: 0x3DDC84, toneMapped: false }),
      strobe: new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      SPH: new T.SphereGeometry(1, 24, 14)
    };
    M.whiteDS = new T.MeshStandardMaterial({ color: 0xF1F4F6, roughness: 0.34, metalness: 0.05, side: T.DoubleSide });
    return M;
  }

  /* returns a group, nose +X, centred vertically, scaled so every type has the same visual size (8.8 units) */
  function build(T, id, M, opts) {
    var sp = SPECS[id], lite = opts && opts.lite, model = new T.Group(), N = lite ? 12 : 16, SPH = M.SPH;
    var trim = new T.MeshStandardMaterial({ color: sp.paint.trim, roughness: 0.35, metalness: 0.2, emissive: sp.paint.trim, emissiveIntensity: 0.12 });
    var lights = { strobes: [], beacon: null };

    /* fuselage: lathe, sides pulled in, belly and roof flattened, tail cone swept up, livery painted in */
    var prof = sp.prof, x0 = prof[0][1], x1 = prof[prof.length - 1][1];
    var fg = new T.LatheGeometry(prof.map(function (p) { return new T.Vector2(p[0], p[1]); }), lite ? 28 : 44);
    fg.rotateZ(-Math.PI / 2);
    var fp = fg.attributes.position, cols = new Float32Array(fp.count * 3);
    var cW = new T.Color(0xF1F4F6), cS = new T.Color(sp.paint.stripe);
    var cL = sp.paint.line != null ? new T.Color(sp.paint.line) : null, cB = sp.paint.belly != null ? new T.Color(sp.paint.belly) : null;
    for (var i = 0; i < fp.count; i++) {
      var x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i);
      var v = y / Math.max(0.001, radiusAt(prof, x)), c = cW;
      if (x > x0 + 0.35 && x < x1 - 0.4) { if (v > -0.2 && v < -0.04) c = cS; else if (cL && v >= -0.04 && v < 0.03) c = cL; }
      if (cB && v < -0.74) c = cB;
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      z *= sp.sq.z; y *= (y < 0 ? sp.sq.belly : sp.sq.top); y += riseAt(sp, x);
      fp.setXYZ(i, x, y, z);
    }
    fg.setAttribute('color', new T.BufferAttribute(cols, 3));
    fg.computeVertexNormals();
    model.add(new T.Mesh(fg, M.paint));

    /* cockpit: bubble canopy or a glazed cabin with door posts */
    var cn = sp.canopy;
    if (cn.type === 'bubble') {
      var dome = new T.Mesh(new T.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
      dome.scale.set(cn.s[0], cn.s[1], cn.s[2]); dome.position.set(cn.x, cn.y, 0); model.add(dome);
      (cn.heads || []).forEach(function (h) { var hd = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), M.dark); hd.position.set(h[0], h[1], h[2]); model.add(hd); });
    } else {
      var cg = new T.ExtrudeGeometry(shapeOf(T, cn.pts), { depth: cn.half * 2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 4 });
      cg.translate(0, 0, -cn.half); model.add(new T.Mesh(cg, M.glass));
      (cn.posts || []).forEach(function (p) { var b = new T.Mesh(new T.BoxGeometry(0.07, p[2], cn.half * 2 + 0.08), M.white); b.position.set(p[0], p[1], 0); model.add(b); });
      if (cn.roof) { var rf = new T.Mesh(new T.BoxGeometry(cn.roof[1] - cn.roof[0], 0.05, cn.half * 2 + 0.07), M.white); rf.position.set((cn.roof[0] + cn.roof[1]) / 2, cn.roof[2], 0); model.add(rf); }
    }

    /* wings: chained panels (dihedral breaks, taper, winglets), trimmed tips, nav lights and strobes */
    var w = sp.wing;
    [1, -1].forEach(function (s) {
      var parent = new T.Group(); parent.position.set(w.x, w.y, 0); model.add(parent);
      var c0 = w.chord, prevDih = 0;
      w.panels.forEach(function (p) {
        var g = new T.Group(); g.rotation.x = -s * (p.dih - prevDih) * D2R; parent.add(g); prevDih = p.dih;
        var dx = p.te ? (p.tip - c0) / 2 : (p.tip - c0) * 0.25;
        var m = new T.Mesh(loft(T, foil(c0, w.t, w.cam, N), foil(p.tip, w.t, w.cam, N), p.len, dx, 0), M.white);
        m.scale.z = s; g.add(m);
        var anchor = new T.Group(); anchor.position.set(dx, 0, s * p.len); g.add(anchor);
        parent = anchor; c0 = p.tip;
      });
      var tip = new T.Mesh(SPH, trim); tip.scale.set(c0 * 0.5, Math.max(0.05, c0 * w.t * 0.6), 0.1); parent.add(tip);
      var nl = new T.Mesh(SPH, s > 0 ? M.green : M.red); nl.scale.setScalar(0.05); nl.position.set(c0 * 0.36, 0.03, s * 0.07); parent.add(nl);
      var sb = new T.Mesh(SPH, M.strobe); sb.scale.setScalar(0.045); sb.position.set(-c0 * 0.3, 0.03, s * 0.09); parent.add(sb); lights.strobes.push(sb);
      if (w.struts) rod(T, model, [w.struts.a[0], w.struts.a[1], w.struts.a[2] * s], [w.struts.b[0], w.struts.b[1], w.struts.b[2] * s], 0.035, M.white, 2.2);
    });

    /* tail: stabiliser (low or on top of the fin), fin, trimmed rudder, beacon */
    var st = sp.tail.stab, SL = foil(st.c, 0.1, 0, 12);
    var sg = loft(T, SL, SL, st.half * 2, 0, 0); sg.translate(0, 0, -st.half);
    var stab = new T.Mesh(sg, M.white); stab.position.set(st.x, st.y, 0); model.add(stab);
    [-st.half, st.half].forEach(function (zz) { var cp = new T.Mesh(new T.ShapeGeometry(shapeOf(T, SL)), M.whiteDS); cp.position.set(st.x, st.y, zz); model.add(cp); });
    function slab(pts, mat, depth) {
      var g = new T.ExtrudeGeometry(shapeOf(T, pts), { depth: depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
      g.translate(0, 0, -depth / 2); model.add(new T.Mesh(g, mat));
    }
    slab(sp.tail.fin, M.white, 0.07);
    slab(sp.tail.rudder, trim, 0.065);
    var bc = new T.Mesh(SPH, M.red); bc.scale.setScalar(0.055); bc.position.set(sp.tail.beacon[0], sp.tail.beacon[1], 0); model.add(bc); lights.beacon = bc;

    /* fixed tricycle gear: faired wheels or bare wheels on spring legs */
    var gr = sp.gear;
    function wheel(p, len) {
      if (gr.spats) {
        var sp2 = new T.Mesh(SPH, M.white); sp2.scale.set(len, 0.23, 0.15); sp2.position.set(p[0], p[1], p[2]); model.add(sp2);
        var wh = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.1, 20), M.dark); wh.rotation.x = Math.PI / 2; wh.position.set(p[0], p[1] - 0.06, p[2]); model.add(wh);
      } else {
        var ty = new T.Mesh(new T.TorusGeometry(0.17, 0.065, 10, 24), M.dark); ty.position.set(p[0], p[1], p[2]); model.add(ty);
        var hb = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.1, 16), M.white); hb.rotation.x = Math.PI / 2; hb.position.set(p[0], p[1], p[2]); model.add(hb);
      }
    }
    [1, -1].forEach(function (s) {
      var a = gr.main.attach, b = gr.main.wheel;
      rod(T, model, [a[0], a[1], a[2] * s], [b[0], b[1] + 0.12, b[2] * s], 0.04, gr.spats ? M.white : M.dark, 1.6);
      wheel([b[0], b[1], b[2] * s], gr.spatLen || 0.5);
    });
    rod(T, model, [gr.nose.attach[0], gr.nose.attach[1], 0], [gr.nose.wheel[0], gr.nose.wheel[1] + 0.1, 0], 0.035, M.dark, 1);
    wheel([gr.nose.wheel[0], gr.nose.wheel[1], 0], (gr.spatLen || 0.5) * 0.8);

    /* propeller: 2 or 3 dark blades with painted tips, trimmed spinner, blur disc */
    var pr = sp.prop, prop = new T.Group(); prop.position.set(pr.x, 0, 0); model.add(prop);
    for (var k = 0; k < pr.blades; k++) {
      var piv = new T.Group(); piv.rotation.x = k * Math.PI * 2 / pr.blades; prop.add(piv);
      var bl = new T.Mesh(new T.BoxGeometry(0.04, pr.r, 0.13), M.dark); bl.position.y = pr.r / 2; piv.add(bl);
      var tp = new T.Mesh(new T.BoxGeometry(0.045, 0.13, 0.135), trim); tp.position.y = pr.r * 0.93; piv.add(tp);
    }
    var spG = new T.ConeGeometry(pr.spinner[0], pr.spinner[1], 28); spG.rotateZ(-Math.PI / 2);
    var spinner = new T.Mesh(spG, trim); spinner.position.set(pr.x + pr.spinner[1] / 2 - 0.02, 0, 0); model.add(spinner);
    var dG = new T.CircleGeometry(pr.r, 48); dG.rotateY(Math.PI / 2);
    var disc = new T.Mesh(dG, M.disc); disc.position.set(pr.x - 0.01, 0, 0); model.add(disc);

    /* registration on both sides of the tail cone */
    var rc = document.createElement('canvas'); rc.width = 512; rc.height = 128;
    var rx = rc.getContext('2d');
    var draw = function () {
      rx.clearRect(0, 0, 512, 128); rx.fillStyle = '#22313F';
      rx.font = '800 104px "Big Shoulders Display","Arial Narrow",sans-serif'; rx.textAlign = 'center'; rx.textBaseline = 'middle';
      rx.fillText(sp.reg, 256, 68);
    };
    draw();
    var tex = new T.CanvasTexture(rc); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    var regMat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
    var hz = radiusAt(prof, sp.decal.x) * sp.sq.z + 0.012;
    [1, -1].forEach(function (s) {
      var d = new T.Mesh(new T.PlaneGeometry(0.82, 0.205), regMat);
      d.position.set(sp.decal.x, sp.decal.y + riseAt(sp, sp.decal.x), hz * s); if (s < 0) d.rotation.y = Math.PI; model.add(d);
    });

    /* centre vertically, then scale every type to the same visual size */
    model.updateMatrixWorld(true);
    var box = new T.Box3().setFromObject(model), ctr = box.getCenter(new T.Vector3());
    model.position.y = -ctr.y;
    var grp = new T.Group(); grp.rotation.order = 'YZX'; grp.add(model);
    grp.scale.setScalar(8.8 / Math.max(sp.span, (x1 - x0) * 1.25));
    grp.userData = { id: id, prop: prop, lights: lights, decal: { draw: draw, tex: tex } };
    return grp;
  }

  if (K) K.fleetModels = { SPECS: SPECS, materials: materials, build: build };
})();
