// Install and offline support, shared by the landing page and the builder.
//
// Every install control on the page carries data-install. They all stay hidden
// until the browser actually offers to install, because a button that does
// nothing when clicked is worse than no button at all. On iOS, where there is
// no install event, they appear and explain the Share-sheet route instead of
// pretending.

const IS_STANDALONE = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  // iPadOS 13+ reports itself as a Mac; a touch point gives it away.
  || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const IS_SAFARI = /safari/i.test(navigator.userAgent)
  && !/chrome|crios|fxios|edgios|opr/i.test(navigator.userAgent);

const IOS_STEPS = 'In Safari, tap the Share button, then "Add to Home Screen".';

export function initPWA({ onToast } = {}) {
  const say = onToast || (() => {});

  /* --- service worker ---------------------------------------------------- */
  // file:// has no service worker support, and neither do some private modes.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[ihatejob] Offline support unavailable:', err.message);
      });
    });
  }

  // There can be several: a button in the bar, a row in the mobile menu, a
  // panel further down the page. They appear and disappear together.
  const showAll = (on) => {
    document.querySelectorAll('[data-install]').forEach((el) => {
      // A control can nominate a different element to reveal - the one in the
      // mobile menu needs its whole row shown, not just the button.
      const target = el.dataset.installShow
        ? document.getElementById(el.dataset.installShow) || el
        : el;
      target.hidden = !on;
    });
  };

  if (IS_STANDALONE) {         // already installed: nothing left to offer
    showAll(false);
    return;
  }

  let deferred = null;

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      showAll(false);
      if (outcome === 'dismissed') say('No problem - it works the same in the browser.');
      return;
    }
    if (IS_IOS) { say(IOS_STEPS); return; }
    // Only reachable if a control was shown without an offer behind it.
    say('Your browser does not offer to install this one. It works the same in a tab.');
  };

  // Delegated, so a control rendered later still works.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-install]')) { e.preventDefault(); install(); }
  });

  /* --- Chrome, Edge, Android --------------------------------------------- */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // keep the browser's own mini-bar out of the way
    deferred = e;
    showAll(true);
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    showAll(false);
    say('Installed. It opens from your home screen or app list, and works offline.');
  });

  /* --- iOS Safari, which has no install event ---------------------------- */
  if (IS_IOS && IS_SAFARI) showAll(true);
}
