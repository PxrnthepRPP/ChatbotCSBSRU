/* ============================================================
   BSRU Student Portal — keyboard support for every .modal-overlay
   ============================================================
   All modals in the app are a `.modal-overlay` shown with the `open` class (or created already open).
   Instead of wiring each one, this watches the DOM once and gives every modal:
     - focus moves into the modal when it opens, and back to the opener when it closes
     - Tab / Shift+Tab stay inside the modal
     - Escape presses the modal's own close button, so each modal's cleanup still runs.
       A modal with no close button (the forced password change) ignores Escape.
   Overlays that already handle Escape themselves opt out with `data-own-escape` (the section roster).
   ============================================================ */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CLOSE_BUTTON = '[data-modal-close], .modal-close, [id$="Close"]';

const openers = new WeakMap();   // overlay -> element that had focus before it opened
const known = new WeakSet();     // overlays currently treated as open

const isOpen = el => el.classList?.contains('modal-overlay') && el.classList.contains('open') && el.isConnected;

function visibleFocusables(overlay) {
    return [...overlay.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
}

/** The modal on top: the last open overlay in document order */
function topOverlay() {
    const open = [...document.querySelectorAll('.modal-overlay.open')];
    return open[open.length - 1] || null;
}

function onOpened(overlay) {
    if (known.has(overlay)) return;
    known.add(overlay);
    const prev = document.activeElement;
    if (prev && !overlay.contains(prev)) openers.set(overlay, prev);
    overlay.setAttribute('role', overlay.getAttribute('role') || 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    // Let the modal's own code focus a field first; only step in if focus is still outside
    requestAnimationFrame(() => {
        if (!isOpen(overlay) || overlay.contains(document.activeElement)) return;
        const target = visibleFocusables(overlay).find(el => !el.matches(CLOSE_BUTTON)) || visibleFocusables(overlay)[0];
        target?.focus();
    });
}

function onClosed(overlay) {
    if (!known.has(overlay)) return;
    known.delete(overlay);
    const opener = openers.get(overlay);
    openers.delete(overlay);
    // Only restore when focus was lost with the modal (not when the user already moved on)
    const lost = !document.activeElement || document.activeElement === document.body || overlay.contains(document.activeElement);
    if (opener?.isConnected && lost) opener.focus();
}

function scan() {
    document.querySelectorAll('.modal-overlay.open').forEach(onOpened);
}

export function initModalA11y() {
    if (initModalA11y.done) return;
    initModalA11y.done = true;

    new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'attributes' && m.target.classList?.contains('modal-overlay')) {
                isOpen(m.target) ? onOpened(m.target) : onClosed(m.target);
            }
            m.removedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('modal-overlay')) onClosed(n); });
        }
        scan();
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    scan();

    document.addEventListener('keydown', e => {
        const overlay = topOverlay();
        if (!overlay) return;

        if (e.key === 'Escape') {
            if (overlay.hasAttribute('data-own-escape')) return;
            const close = overlay.querySelector(CLOSE_BUTTON);
            if (close) {
                e.preventDefault();
                close.click();
            }
            return;
        }

        if (e.key === 'Tab') {
            const items = visibleFocusables(overlay);
            if (!items.length) { e.preventDefault(); return; }
            const first = items[0], last = items[items.length - 1];
            if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    });
}
