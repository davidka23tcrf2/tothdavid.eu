/* ============================================================
   tothdavid.eu — a deck you flick through

   Three physical cards on a shallow coverflow arc. Drag or swipe to
   move the deck, tap the front card to open it, tap a side card to
   bring it forward. Arrow keys and the dots do the same thing.

   The canvas is decorative. The real links live in the DOM and stay
   reachable with a keyboard, a screen reader, or no WebGL at all.
   ============================================================ */

import * as THREE from "three";

const canvas = document.getElementById("deck");
const root = document.documentElement;
const chrome = document.querySelector(".chrome");
const dotsWrap = document.querySelector(".dots");
const hint = document.querySelector(".hint");
const rosterLinks = [...document.querySelectorAll(".roster .link")];

const calmQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/* Brand marks are the same 24x24 paths the previous site shipped. */
const CARDS = [
  {
    name: "GitHub",
    handle: "davidka23tcrf2",
    href: "https://github.com/davidka23tcrf2/",
    path: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z",
  },
  {
    name: "Instagram",
    handle: "@davidka23tcrf",
    href: "https://www.instagram.com/davidka23tcrf",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.822a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  },
  {
    name: "Facebook",
    handle: "Dávid Tóth",
    href: "https://www.facebook.com/profile.php?id=100031063698968",
    path: "M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z",
  },
];

const N = CARDS.length;

/* ---------- card face ---------- */

const PAPER = "#f3ece1";
const INK = "#15110d";
const INK_SOFT = "#6d6155";
const ACCENT = "#ff5a1f";

function paintCard(card, i) {
  const W = 768;
  const H = 1075;
  const M = 56;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");

  const wash = x.createLinearGradient(0, 0, W * 0.4, H);
  wash.addColorStop(0, "#f7f1e8");
  wash.addColorStop(1, "#e9dfd1");
  x.fillStyle = wash;
  x.fillRect(0, 0, W, H);

  x.strokeStyle = "rgba(21, 17, 13, 0.16)";
  x.lineWidth = 1.5;
  x.strokeRect(M * 0.5, M * 0.5, W - M, H - M);

  // index, top left
  x.fillStyle = INK_SOFT;
  x.font = "500 30px 'IBM Plex Mono', monospace";
  x.textBaseline = "alphabetic";
  if ("letterSpacing" in x) x.letterSpacing = "3px";
  x.fillText(`0${i + 1}`, M, M + 34);

  // accent tick, top right
  if ("letterSpacing" in x) x.letterSpacing = "0px";
  x.fillStyle = ACCENT;
  x.fillRect(W - M - 26, M + 12, 26, 4);

  // brand mark
  const S = 232;
  x.save();
  x.translate(W / 2 - S / 2, H * 0.40 - S / 2);
  x.scale(S / 24, S / 24);
  x.fillStyle = INK;
  x.fill(new Path2D(card.path));
  x.restore();

  // rule + name + handle, bottom left
  x.fillStyle = ACCENT;
  x.fillRect(M, H - 214, 72, 3);

  x.fillStyle = INK;
  x.font = "700 70px 'Fraunces', Georgia, serif";
  x.fillText(card.name, M, H - 130);

  x.fillStyle = INK_SOFT;
  x.font = "400 26px 'IBM Plex Mono', monospace";
  x.fillText(card.handle, M, H - 82);

  return c;
}

/* ---------- scene ---------- */

const CARD_W = 1.5;
const CARD_H = 2.1;
const CARD_D = 0.055;
const FOV = 38;

function boot() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  // ACES desaturates the paper toward olive; Neutral keeps it warm
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0x7d6552, 0x1a120c, 1.0));

  const key = new THREE.DirectionalLight(0xffe9cf, 3.1);
  key.position.set(2.4, 3.4, 4.2);
  scene.add(key);

  // just enough ember on the trailing edges; any more and the far card
  // turns into a solid orange slab
  const rim = new THREE.DirectionalLight(0xff7a3a, 0.55);
  rim.position.set(-3.6, 0.8, -2.4);
  scene.add(rim);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const geometry = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);

  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xd9cebe,
    roughness: 0.78,
    metalness: 0,
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: 0x2a231d,
    roughness: 0.85,
    metalness: 0,
  });

  const group = new THREE.Group();
  scene.add(group);

  const meshes = CARDS.map((card, i) => {
    const tex = new THREE.CanvasTexture(paintCard(card, i));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.needsUpdate = true;

    const faceMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.62,
      metalness: 0,
    });

    // BoxGeometry group order: +x, -x, +y, -y, +z (front), -z (back)
    const mesh = new THREE.Mesh(geometry, [
      edgeMat, edgeMat, edgeMat, edgeMat, faceMat, backMat,
    ]);
    mesh.userData.index = i;
    group.add(mesh);
    return mesh;
  });

  /* soft contact shadow so the deck sits on something */
  const shadowTex = (() => {
    const s = 256;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.55, "rgba(0,0,0,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 3.4, CARD_W * 1.5),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -CARD_H / 2 - 0.06;
  group.add(shadow);

  /* ---------- sizing ---------- */

  let viewW = 0;
  let viewH = 0;

  function measure() {
    let w = window.innerWidth || 0;
    let h = window.innerHeight || 0;
    if (w < 2 || h < 2) {
      w = root.clientWidth || 0;
      h = root.clientHeight || 0;
    }
    if (w < 2 || h < 2) {
      const r = canvas.getBoundingClientRect();
      w = Math.round(r.width);
      h = Math.round(r.height);
    }
    return [w, h];
  }

  function resize() {
    const [w, h] = measure();
    if (w < 2 || h < 2) return false;

    viewW = w;
    viewH = h;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);

    const aspect = w / h;
    camera.aspect = aspect;

    /* Pull the camera back far enough that the card fits vertically AND
       the neighbours still peek in at the sides. Narrow screens only need
       a sliver of neighbour, so they get a tighter framing. */
    const narrow = aspect < 0.85;
    centerBias = narrow ? 0 : 0.5;
    const wantWide = CARD_W * (narrow ? 1.5 : 2.9);
    const visH = Math.max(CARD_H / 0.52, wantWide / aspect);
    camera.position.set(0, 0.05, visH / (2 * Math.tan((FOV * Math.PI) / 360)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    render();
    return true;
  }

  /* ---------- deck state ---------- */

  let centerBias = 0.5; // how much the fan re-centres itself; 0 on narrow screens
  let index = 0; // continuous position
  let target = 0; // snapped destination
  let active = -1; // forces the first setActive() to apply

  const clampIdx = (v) => Math.max(0, Math.min(N - 1, v));

  /* resistance past the ends, like an iOS picker */
  function rubber(v) {
    if (v < 0) return v * 0.34;
    if (v > N - 1) return N - 1 + (v - (N - 1)) * 0.34;
    return v;
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    rosterLinks.forEach((a, n) => {
      a.classList.toggle("is-active", n === i);
      if (n === i) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    [...dotsWrap.querySelectorAll(".dot")].forEach((d, n) => {
      d.setAttribute("aria-selected", String(n === i));
      d.classList.toggle("is-active", n === i);
    });
  }

  function goTo(i) {
    target = clampIdx(i);
    wake();
  }

  /* ---------- layout ---------- */

  let clock = 0;

  function place() {
    let sum = 0;

    for (const mesh of meshes) {
      const o = mesh.userData.index - index;
      const a = Math.abs(o);
      const s = Math.sign(o);

      const x = s * (Math.min(a, 1) * 1.02 + Math.max(0, a - 1) * 0.66);
      mesh.position.x = x;
      mesh.position.z = -Math.min(a, 2.4) * 0.72;
      mesh.position.y = idle * Math.sin(clock * 0.7 + o * 1.4) * 0.035;

      mesh.rotation.y = -s * Math.min(a, 1.4) * 0.42;
      mesh.rotation.z = s * Math.min(a, 1.4) * 0.025;

      mesh.scale.setScalar(1 - Math.min(a, 2.4) * 0.095);
      sum += x;
    }

    /* At the first and last card the whole fan sits to one side. Sliding
       the group back keeps the ensemble centred on wide screens. Narrow
       screens have no room to give, so there the active card stays put. */
    group.position.x = (-sum / meshes.length) * centerBias;
    shadow.position.x = -group.position.x * 0.5;
  }

  /* ---------- pointer ---------- */

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startIndex = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let moved = 0;

  const dragSpan = () => Math.max(160, viewW * 0.42);

  function pickCard(clientX, clientY) {
    ndc.x = (clientX / viewW) * 2 - 1;
    ndc.y = -((clientY / viewH) * 2 - 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.object.userData.index : -1;
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startIndex = index;
    lastT = performance.now();
    velocity = 0;
    moved = 0;
    dismissHint();
    wake();
    // capture is a nicety; some synthetic pointers reject it
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* drag still works through the window listeners below */
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    index = rubber(startIndex - dx / dragSpan());

    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocity = ((lastX - e.clientX) / dragSpan() / dt) * 1000;
    lastX = e.clientX;
    lastT = now;
    wake();
  });

  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== pointerId)) return;
    dragging = false;

    if (moved < 10) {
      const hit = pickCard(e.clientX, e.clientY);
      if (hit >= 0 && hit === Math.round(index)) {
        window.open(CARDS[hit].href, "_blank", "noopener");
        target = hit;
      } else if (hit >= 0) {
        target = hit;
      } else {
        target = clampIdx(Math.round(index));
      }
    } else {
      // carry the flick, but never more than one card past the nearest
      const glide = Math.max(-1, Math.min(1, Math.round(velocity * 0.22)));
      target = clampIdx(Math.round(index) + glide);
    }
    wake();
  }

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", () => {
    dragging = false;
    target = clampIdx(Math.round(index));
    wake();
  });

  /* desktop: horizontal wheel / trackpad swipe */
  let wheelLock = 0;
  canvas.addEventListener(
    "wheel",
    (e) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 4) return;
      const now = performance.now();
      if (now < wheelLock) return;
      wheelLock = now + 240;
      goTo(Math.round(index) + Math.sign(d));
      dismissHint();
    },
    { passive: true }
  );

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      goTo(active - 1);
      dismissHint();
    } else if (e.key === "ArrowRight") {
      goTo(active + 1);
      dismissHint();
    }
  });

  dotsWrap.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    goTo(Number(b.dataset.go));
    dismissHint();
  });

  // keyboard users tabbing the real links drag the deck along with them
  rosterLinks.forEach((a, i) => a.addEventListener("focus", () => goTo(i)));

  function dismissHint() {
    if (hint && !hint.hidden) hint.hidden = true;
  }

  /* ---------- loop ---------- */

  let idle = calmQuery.matches ? 0 : 1;
  let running = true;
  let awake = 0;
  let last = performance.now();

  function wake() {
    awake = 1.6; // seconds of guaranteed rendering after any change
  }

  function render() {
    renderer.render(scene, camera);
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);

    if (!viewW && !resize()) return;

    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;

    if (!dragging) {
      const ease = calmQuery.matches ? 1 : Math.min(1, dt * 9);
      index += (target - index) * ease;
      if (Math.abs(target - index) < 0.0005) index = target;
    }

    setActive(clampIdx(Math.round(index)));

    // when nothing is moving and nothing floats, stop drawing
    const still = !dragging && index === target && idle === 0;
    awake = Math.max(0, awake - dt);
    if (still && awake === 0) return;

    place();
    render();
  }

  document.addEventListener("visibilitychange", () => {
    const was = running;
    running = !document.hidden;
    if (running && !was) {
      last = performance.now();
      wake();
      requestAnimationFrame(frame);
    }
  });

  let resizeTimer;
  const scheduleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      wake();
    }, 140);
  };
  window.addEventListener("resize", scheduleResize);
  if (window.ResizeObserver) new ResizeObserver(scheduleResize).observe(root);

  calmQuery.addEventListener?.("change", (e) => {
    idle = e.matches ? 0 : 1;
    wake();
  });

  /* ---------- go ---------- */

  async function start() {
    if (document.fonts?.ready) {
      try {
        await Promise.all([
          document.fonts.load('700 70px "Fraunces"'),
          document.fonts.load('400 26px "IBM Plex Mono"'),
        ]);
      } catch {
        /* system fallbacks are fine */
      }
      // repaint faces now that the real faces are available
      meshes.forEach((m, i) => {
        m.material[4].map.image = paintCard(CARDS[i], i);
        m.material[4].map.needsUpdate = true;
      });
    }

    root.classList.add("deck-on");
    dotsWrap.hidden = false;
    if (hint) hint.hidden = false;
    setActive(0);
    resize();
    wake();
    requestAnimationFrame(frame);
  }

  start();
  return true;
}

try {
  const ok = canvas.getContext ? boot() : false;
  if (!ok) root.classList.add("no-webgl");
} catch (err) {
  console.error(err);
  root.classList.remove("deck-on");
  root.classList.add("no-webgl");
}
