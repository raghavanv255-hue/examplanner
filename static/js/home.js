/* ═══════════════════════════════════════════════════════
   HOME.JS — ExamPlanner Landing Page Interactions
═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Scroll Reveal ─────────────────────────────────
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ── Countdown Timer (live) ─────────────────────────
  function updateCountdown() {
    const now   = new Date();
    const exam  = new Date(now.getTime() + (2 * 24 + 14) * 3600 * 1000);
    const diff  = exam - new Date();
    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const dEl = document.querySelectorAll('.ct-num');
    if (dEl[0]) dEl[0].textContent = String(days).padStart(2, '0');
    if (dEl[1]) dEl[1].textContent = String(hours).padStart(2, '0');
    if (dEl[2]) dEl[2].textContent = String(mins).padStart(2, '0');
  }
  updateCountdown();
  setInterval(updateCountdown, 60000);

  // ── Progress bar animation ─────────────────────────
  const progObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.prog-fill').forEach(bar => {
          const width = bar.style.width;
          bar.style.width = '0';
          setTimeout(() => { bar.style.width = width; }, 100);
        });
        progObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  const appCard = document.querySelector('.app-card');
  if (appCard) progObserver.observe(appCard);

  // ── Smooth scroll for anchor links ────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ── Navbar background on scroll ───────────────────
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.style.background = window.scrollY > 80
        ? 'rgba(15,15,19,0.99)'
        : 'rgba(15,15,19,0.92)';
    }, { passive: true });
  }

  // ── Demo loading unit animation ───────────────────
  const loadingCards = document.querySelectorAll('.fc-upload');
  if (loadingCards.length) {
    setInterval(() => {
      loadingCards.forEach(card => {
        card.style.transform = 'scale(1.02)';
        setTimeout(() => { card.style.transform = 'scale(1)'; }, 300);
      });
    }, 3000);
  }

});
