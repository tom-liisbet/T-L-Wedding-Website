// ── Mobile nav toggle ──
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', function () {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Close menu after tapping a link
  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') links.classList.remove('open');
  });
})();

// ── Countdown (home page only) ──
(function () {
  const container = document.getElementById('countdown');
  if (!container) return;

  function updateCountdown() {
    const wedding = new Date('2026-09-05T17:00:00');
    const now  = new Date();
    const diff = wedding - now;

    if (diff <= 0) {
      container.innerHTML =
        '<p style="font-family:Cormorant Garamond,serif;font-size:1.5rem;color:var(--gold)">Today is the day!</p>';
      return;
    }

    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);

    document.getElementById('cd-days').textContent  = String(days).padStart(2,'0');
    document.getElementById('cd-hours').textContent = String(hours).padStart(2,'0');
    document.getElementById('cd-mins').textContent  = String(mins).padStart(2,'0');
    document.getElementById('cd-secs').textContent  = String(secs).padStart(2,'0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
})();
