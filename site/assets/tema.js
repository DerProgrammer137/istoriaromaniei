/* Tema luminoasă / întunecată: se aplică înainte de afișare și se ține minte în browser. */
(function(){
  var KEY = 'tema', root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function current(){ return root.getAttribute('data-theme') || (mq && mq.matches ? 'dark' : 'light'); }
  try { var saved = localStorage.getItem(KEY); if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved); } catch (e) {}
  var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function paint(){
    var b = document.getElementById('theme-btn'); if (!b) return;
    var dark = current() === 'dark';
    b.innerHTML = (dark ? SUN : MOON) + '<span>' + (dark ? 'Mod luminos' : 'Mod întunecat') + '</span>';
    b.setAttribute('aria-label', dark ? 'Treci la modul luminos' : 'Treci la modul întunecat');
  }
  document.addEventListener('DOMContentLoaded', function(){
    var b = document.getElementById('theme-btn'); if (!b) return;
    b.addEventListener('click', function(){
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paint();
    });
    paint();
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', paint);
  if (window.MutationObserver) new MutationObserver(paint).observe(root, {attributes: true, attributeFilter: ['data-theme']});
})();
