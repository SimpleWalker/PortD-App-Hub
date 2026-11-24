/* Freeze Test: makes its own page stop responding, for 15 seconds or for good. A busy loop on the page's thread is
   the point: nothing can run while it lasts. The only saved data is the theme, in settings.json. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const SHORT = 15000;
  let settings = { theme: 'auto' }, beats = 0, armTimer = null;

  /* the heartbeat: the clock stops while the page is frozen */
  const tick = () => { beats++; $('beat').textContent = 'Answering · ' + new Date().toLocaleTimeString(); };
  setInterval(tick, 250);

  $('shortBtn').onclick = () => {
    const start = Date.now(), end = start + SHORT;
    while (Date.now() < end) { /* frozen on purpose */ }
    tick();
    $('status').textContent = 'Recovered at ' + new Date().toLocaleTimeString() + ', after ' + Math.round((Date.now() - start) / 1000) + ' seconds.';
  };
  /* Freeze for good stops every open program until all program windows are closed: a second click within 3 s */
  const disarm = () => { clearTimeout(armTimer); armTimer = null; $('goodBtn').classList.remove('armed'); $('goodBtn').textContent = 'Freeze for good'; };
  $('goodBtn').onclick = () => {
    if (!armTimer) {
      $('goodBtn').classList.add('armed'); $('goodBtn').textContent = 'Click again to freeze for good';
      $('status').textContent = 'Other open programs will freeze too. Click again within 3 seconds to go ahead.';
      armTimer = setTimeout(() => { disarm(); $('status').textContent = ''; }, 3000);
      return;
    }
    disarm();
    $('status').textContent = 'Frozen for good. Close this window to end it.';
    setTimeout(() => { for (;;) { /* frozen on purpose */ } }, 50);      /* lets the message above show first */
  };

  // ---- theme
  const SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">';
  const THEMES = {
    auto: [SVG + '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor"/></svg>', 'Theme: follows the system'],
    light: [SVG + '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></svg>', 'Theme: light'],
    dark: [SVG + '<path d="M13 10.5A5.5 5.5 0 0 1 5.5 3a5.5 5.5 0 1 0 7.5 7.5z" fill="currentColor"/></svg>', 'Theme: dark']
  };
  function showTheme() { const t = THEMES[settings.theme] || THEMES.auto; $('themeBtn').innerHTML = t[0]; $('themeBtn').title = t[1] + ' (click to change)'; $('themeBtn').setAttribute('aria-label', t[1]); }
  $('themeBtn').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme] || 'auto'; Host.applyTheme(settings.theme); showTheme(); Host.saveSettings(settings); };

  // expose for testing
  window.__fz = { get beats() { return beats; }, get armed() { return !!armTimer; } };

  (async () => {
    settings = await Host.loadSettings(settings);
    Host.applyTheme(settings.theme); showTheme(); Host.watchTheme(() => settings.theme);
    tick();
  })();
})();
