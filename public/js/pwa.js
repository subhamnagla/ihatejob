// Install and offline support, shared by the landing page and the builder.
//
// The install button only appears when the browser actually offers to install:
// a button that does nothing when clicked is worse than no button. On iOS,
// where there is no install event at all, it explains the Share-sheet route
// instead of pretending.

const IS_STANDALONE = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

export function initPWA({ onToast } = {}) {
  const say = onToast || (() => {});
  const btn = document.getElementById('btnInstall');

  /* --- service worker ---------------------------------------------------- */
  // file:// has no service worker support, and neither do some private modes.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[ihatejob] Offline support unavailable:', err.message);
      });
    });
  }

  if (!btn || IS_STANDALONE) return;   // already installed: nothing to offer

  /* --- Chrome, Edge, Android --------------------------------------------- */
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // keep the browser's own mini-bar out of the way
    deferred = e;
    btn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    btn.hidden = true;
    say('Installed. It opens from your home screen or app list, and works offline.');
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
    if (outcome === 'dismissed') say('No problem - it works the same in the browser.');
  });

  /* --- iOS Safari, which has no install event ---------------------------- */
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
  if (isIOS && isSafari) {
    btn.hidden = false;
    btn.addEventListener('click', () => {
      say('In Safari, tap the Share button, then "Add to Home Screen".');
    });
  }
}
