/* ============================================================
   BSRU Student Portal — in-app confirmation dialog
   ============================================================
   Replaces window.confirm(): matches the app's design, can't be suppressed by the browser,
   and the destructive action gets a red button. Keyboard support (Esc = cancel, focus trap,
   focus return) comes from modalA11y.js because this is a regular .modal-overlay.

   if (!await confirmDialog('ลบ "นายสมชาย" หรือไม่?')) return;
   ============================================================ */

import { esc } from '../utils.js';

/** Guess the button for the common messages; callers can pass their own */
function defaultConfirmText(message) {
    if (/ลบ/.test(message)) return 'ลบ';
    if (/ล้าง/.test(message)) return 'ล้าง';
    if (/รีเซ็ต/.test(message)) return 'รีเซ็ต';
    if (/ถอน|ยกเลิก/.test(message)) return 'ยืนยัน';
    return 'ยืนยัน';
}

/**
 * @param {string} message  plain text; line breaks are kept
 * @param {{title?: string, confirmText?: string, cancelText?: string, danger?: boolean}} [opts]
 * @returns {Promise<boolean>} true when the user confirmed
 */
export function confirmDialog(message, opts = {}) {
    const confirmText = opts.confirmText || defaultConfirmText(message);
    const danger = opts.danger ?? /ลบ|ล้าง|รีเซ็ต|ถอน/.test(message);
    const title = opts.title || 'ยืนยันการทำรายการ';

    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card" style="max-width:420px" role="alertdialog" aria-labelledby="cfTitle" aria-describedby="cfMsg">
                <div class="modal-header">
                    <h3 id="cfTitle">${esc(title)}</h3>
                    <button type="button" class="modal-close" data-modal-close aria-label="ยกเลิก">✕</button>
                </div>
                <div class="modal-body">
                    <p id="cfMsg" style="white-space:pre-line;margin:0;line-height:1.6">${esc(message)}</p>
                </div>
                <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 20px">
                    <button type="button" class="btn btn-ghost" data-cf="cancel">${esc(opts.cancelText || 'ยกเลิก')}</button>
                    <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-cf="ok">${esc(confirmText)}</button>
                </div>
            </div>`;

        let done = false;
        const finish = result => {
            if (done) return;
            done = true;
            overlay.classList.remove('open');
            overlay.remove();
            resolve(result);
        };
        overlay.querySelector('[data-cf="ok"]').addEventListener('click', () => finish(true));
        overlay.querySelector('[data-cf="cancel"]').addEventListener('click', () => finish(false));
        overlay.querySelector('[data-modal-close]').addEventListener('click', () => finish(false));
        overlay.addEventListener('click', e => { if (e.target === overlay) finish(false); });

        document.body.appendChild(overlay);
        overlay.classList.add('open');
        // Safe default: focus Cancel for destructive actions, the action otherwise
        requestAnimationFrame(() => overlay.querySelector(danger ? '[data-cf="cancel"]' : '[data-cf="ok"]').focus());
    });
}
