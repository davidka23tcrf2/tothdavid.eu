(() => {
  // ── LOADER ─────────────────────────────────────
  const loader = document.getElementById('loader');
  window.addEventListener('load', () => {
    // small extra delay so fonts fully render
    setTimeout(() => loader.classList.add('hidden'), 400);
  });

  // ── SLIDE ENGINE ───────────────────────────────
  const slides = document.querySelectorAll('.slide');
  const total = slides.length;
  const progressBar = document.getElementById('progressBar');
  const navDots = document.getElementById('navDots');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  let current = 0;
  let isAnimating = false;

  // Build nav dots
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.classList.add('nav-dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goTo(i));
    navDots.appendChild(dot);
  });
  const dots = document.querySelectorAll('.nav-dot');

  function updateProgress() {
    progressBar.style.width = ((current + 1) / total) * 100 + '%';
  }

  function goTo(index) {
    if (index === current || isAnimating || index < 0 || index >= total) return;
    isAnimating = true;
    const dir = index > current ? 1 : -1;
    const prev = slides[current];
    const next = slides[index];

    prev.classList.remove('active');
    if (dir === 1) prev.classList.add('exit-up');

    if (dir === -1) {
      next.style.transition = 'none';
      next.style.transform = 'translateY(-40px) scale(0.97)';
      next.style.opacity = '0';
      void next.offsetWidth;
      next.style.transition = '';
      next.style.transform = '';
      next.style.opacity = '';
    }

    next.classList.add('active');
    dots[current].classList.remove('active');
    dots[index].classList.add('active');
    current = index;
    updateProgress();
    updateArrows();

    setTimeout(() => { prev.classList.remove('exit-up'); isAnimating = false; }, 750);
  }

  function goNext() { goTo(current + 1); }
  function goPrev() { goTo(current - 1); }
  function updateArrows() {
    prevBtn.classList.toggle('disabled', current === 0);
    nextBtn.classList.toggle('disabled', current === total - 1);
  }

  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    if (e.key === 'End') { e.preventDefault(); goTo(total - 1); }
  });

  // Touch swipe
  let tx = 0, ty = 0;
  document.addEventListener('touchstart', e => { tx = e.changedTouches[0].screenX; ty = e.changedTouches[0].screenY; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].screenX - tx;
    const dy = e.changedTouches[0].screenY - ty;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) dx < 0 ? goNext() : goPrev();
  }, { passive: true });

  // Wheel
  let wt;
  document.addEventListener('wheel', e => {
    e.preventDefault();
    clearTimeout(wt);
    wt = setTimeout(() => { e.deltaY > 0 ? goNext() : goPrev(); }, 80);
  }, { passive: false });

  // Particles
  const pc = document.getElementById('particles');
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    p.style.left = Math.random() * 100 + '%';
    const s = Math.random() * 2.5 + 1;
    p.style.width = p.style.height = s + 'px';
    p.style.animationDuration = (Math.random() * 18 + 12) + 's';
    p.style.animationDelay = (Math.random() * 18) + 's';
    p.style.opacity = Math.random() * 0.2;
    pc.appendChild(p);
  }

  updateProgress();
  updateArrows();
})();
