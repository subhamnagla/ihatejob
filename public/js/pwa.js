// Install and offline support, shared by every page.
//
// Every install control carries data-install. They all stay hidden until the
// browser actually offers to install, because a button that does nothing when
// clicked is worse than no button at all. On iOS, where there is no install
// event, they appear and explain the Share-sheet route instead of pretending.
//
// Clicking one opens a dialog rather than firing the browser's prompt straight
// away: the prompt can only be shown once, so someone who taps to find out what
// installing means should be able to read that and back out with Cancel without
// spending it.
//
// The dialog is built here rather than sitting in three HTML files, so the
// landing page, the builder and the journeys page cannot drift apart.

const IS_STANDALONE = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  // iPadOS 13+ reports itself as a Mac; a touch point gives it away.
  || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const IS_SAFARI = /safari/i.test(navigator.userAgent)
  && !/chrome|crios|fxios|edgios|opr/i.test(navigator.userAgent);

const POINTS = [
  ['Its own icon', 'on your home screen or app list, like any other app'],
  ['No browser bar', 'it opens full screen'],
  ['Works with no signal', 'the builder and your CV are already on the device'],
  ['Nothing to sign up for', 'no app store, no account, no extra download'],
];

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
  + ' stroke-linecap="round" stroke-linejoin="round">'
  + '<rect x="6" y="2.5" width="12" height="19" rx="2.6"/>'
  + '<path d="M12 7v7m0 0-2.6-2.6M12 14l2.6-2.6"/></svg>';

// Dismissing the banner has to stick, or it is nagware. It comes back after a
// month in case someone changes their mind, but never within one.
const SNOOZE_KEY = 'ihatejob.install-snoozed';
const SNOOZE_DAYS = 30;

function snoozed() {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY));
    return Boolean(at) && (Date.now() - at) < SNOOZE_DAYS * 86400000;
  } catch { return false; }     // private mode: show it, do not crash
}

function snooze() {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* private mode */ }
}

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
  // card further down the page. They appear and disappear together.
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

  /* --- the banner -------------------------------------------------------- */

  // The quiet controls only work for someone already looking for them. This is
  // the one that arrives unasked, so it has to be easy to be rid of: an X that
  // is remembered, and no second banner for a month.

  let bar = null;

  function buildBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'install-bar';
    bar.id = 'installBar';
    bar.hidden = true;
    bar.innerHTML = '<span class="install-bar-mark" aria-hidden="true">' + ICON + '</span>'
      + '<div class="install-bar-copy">'
      + '<b>Install ihatejob</b>'
      + '<span>' + (IS_IOS && !deferred
        ? 'Add to your home screen, in three taps'
        : 'Works offline, no browser bar') + '</span>'
      + '</div>'
      + '<button class="btn btn-primary btn-sm" type="button" data-install-bar-go>Install</button>'
      + '<button class="btn btn-icon btn-sm install-bar-x" type="button" data-install-dismiss'
      + ' aria-label="Not now">&#10005;</button>';

    // Inside the app shell it has to be a flex child of .app or it overlaps the
    // fixed-height workspace; everywhere else it sits above the sticky nav.
    const shell = document.querySelector('.app');
    (shell || document.body).prepend(bar);

    bar.addEventListener('click', (e) => {
      if (e.target.closest('[data-install-dismiss]')) {
        bar.hidden = true;
        snooze();
        return;
      }
      if (!e.target.closest('[data-install-bar-go]')) return;
      // The banner already says what installing does, so on a browser that can
      // install, go straight there rather than explaining it twice. iOS has
      // nothing to call, so it gets the dialog and its instructions.
      if (deferred) accept();
      else open();
    });
    return bar;
  }

  function showBar() {
    if (snoozed()) return;
    buildBar().hidden = false;
  }

  const hideBar = () => { if (bar) bar.hidden = true; };

  /* --- the dialog -------------------------------------------------------- */

  let dialog = null;
  let lastFocus = null;

  function build() {
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.className = 'modal-backdrop';
    dialog.id = 'installModal';
    dialog.innerHTML = '<div class="modal install-modal" role="dialog" aria-modal="true"'
      + ' aria-labelledby="installTitle">'
      + '<div class="install-head">'
      + '<span class="install-mark" aria-hidden="true">' + ICON + '</span>'
      + '<div><h2 id="installTitle">Install ihatejob</h2>'
      + '<p class="install-sub"></p></div>'
      + '</div>'
      + '<ul class="install-points">' + POINTS.map(([b, rest]) => (
        '<li><b>' + b + '</b> &mdash; ' + rest + '</li>'
      )).join('') + '</ul>'
      + '<ol class="install-steps" hidden>'
      + '<li>Tap the <b>Share</b> button in Safari&rsquo;s toolbar.</li>'
      + '<li>Scroll down and choose <b>Add to Home Screen</b>.</li>'
      + '<li>Tap <b>Add</b>.</li>'
      + '</ol>'
      + '<div class="modal-actions">'
      + '<button class="btn" type="button" data-install-cancel>Cancel</button>'
      + '<button class="btn btn-primary" type="button" data-install-go>Install</button>'
      + '</div></div>';
    document.body.appendChild(dialog);

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-install-cancel]')) close();
      else if (e.target.closest('[data-install-go]')) accept();
    });
    return dialog;
  }

  function close() {
    if (!dialog) return;
    dialog.classList.remove('open');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function open() {
    const el = build();
    // Chrome can install; iOS Safari cannot be asked, only told how.
    const iosRoute = !deferred && IS_IOS;
    el.querySelector('.install-sub').textContent = iosRoute
      ? 'Safari does not have an install button, but it can still do this in three taps.'
      : 'Keeps a copy on your device. It stays the same site, with the same data.';
    el.querySelector('.install-points').hidden = iosRoute;
    el.querySelector('.install-steps').hidden = !iosRoute;
    el.querySelector('[data-install-go]').hidden = iosRoute;
    el.querySelector('[data-install-cancel]').textContent = iosRoute ? 'Got it' : 'Cancel';

    lastFocus = document.activeElement;
    el.classList.add('open');
    // Cancel takes focus, not Install: nothing here should be one stray Enter
    // away from happening.
    el.querySelector('[data-install-cancel]').focus();
  }

  async function accept() {
    if (!deferred) {
      close();
      say('Your browser did not offer to install this one. It works the same in a tab.');
      return;
    }
    const offer = deferred;
    deferred = null;
    close();
    hideBar();
    offer.prompt();
    const { outcome } = await offer.userChoice;
    showAll(false);
    if (outcome === 'dismissed') {
      // Turning down the browser's own prompt is an answer. Do not put the
      // banner straight back up.
      snooze();
      say('No problem - it works the same in the browser.');
    }
  }

  // Delegated, so a control rendered later still works.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-install]')) { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialog && dialog.classList.contains('open')) close();
  });

  /* --- Chrome, Edge, Android --------------------------------------------- */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // keep the browser's own mini-bar out of the way
    deferred = e;
    showAll(true);
    showBar();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    close();
    hideBar();
    showAll(false);
    say('Installed. It opens from your home screen or app list, and works offline.');
  });

  /* --- iOS Safari, which has no install event ---------------------------- */
  if (IS_IOS && IS_SAFARI) {
    showAll(true);
    showBar();
  }
}
