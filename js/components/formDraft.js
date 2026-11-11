/* ============================================================
   BSRU Student Portal — form drafts
   Keeps what someone typed into a form while it is still unsaved, so a form
   closed by mistake (click outside, Esc, another page, refresh) comes back
   filled in. Nothing is sent to the server: the draft only refills the form,
   and the record is saved only when the user presses the form's own save
   button (the caller then calls draft.clear()).

   Stored in sessionStorage per user: gone when the tab closes, and cleared
   on logout (clearAllFormDrafts), so the next person on the computer never
   sees it. Password and file inputs are never stored.
   ============================================================ */

import { esc } from '../utils.js';
import { getAuthState } from '../auth.js';

const PREFIX = 'formDraft:';
const SKIP_TYPES = new Set(['password', 'file', 'hidden', 'search', 'button', 'submit', 'reset']);
const SAVED_AT = new Intl.DateTimeFormat('th-TH', { timeStyle: 'short' });

function storageKey(key) {
    const user = getAuthState().user?.username || 'anon';
    return `${PREFIX}${user}:${key}`;
}

function read(key) {
    try {
        return JSON.parse(sessionStorage.getItem(storageKey(key)) || 'null');
    } catch (e) {
        return null;
    }
}

function write(key, value) {
    try {
        if (value) sessionStorage.setItem(storageKey(key), JSON.stringify(value));
        else sessionStorage.removeItem(storageKey(key));
    } catch (e) { /* storage full or blocked: drafts are a convenience only */ }
}

/** Fields that take part: inputs / selects / textareas with an id, not read-only, not secret */
function fieldsOf(root) {
    return [...root.querySelectorAll('input[id], select[id], textarea[id]')].filter(el =>
        !el.readOnly && !el.disabled && !SKIP_TYPES.has((el.type || '').toLowerCase()));
}

function snapshot(fields) {
    const values = {};
    fields.forEach(el => {
        values[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
    return values;
}

function apply(fields, values) {
    fields.forEach(el => {
        if (!(el.id in values)) return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!values[el.id];
        else el.value = values[el.id];
    });
    // Let the form's own handlers react (show/hide dependent fields, live checks, ...)
    fields.forEach(el => {
        if (!(el.id in values)) return;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

/**
 * Turn on drafts for the form inside `root`. Call it after the form is rendered and its own event
 * handlers are bound. `key` names the form and the record, e.g. "student:add" or "student:edit:6621100042".
 * If a draft exists it is filled back in and a notice with "ล้างฉบับร่าง" is shown at the top of `root`.
 * Returns { clear } — call clear() after the form was saved successfully.
 */
export function attachFormDraft(root, key) {
    if (!root) return { clear() {} };
    const fields = fieldsOf(root);
    const initial = snapshot(fields);
    const differs = (values) => Object.keys(values).some(id => values[id] !== initial[id]);

    let cleared = false;
    const save = () => {
        // After a successful save, or once the form was re-rendered, stop writing
        if (cleared || !fields.every(el => el.isConnected)) return;
        const values = snapshot(fields);
        write(key, differs(values) ? { savedAt: Date.now(), values } : null);
    };
    // Listen on the fields themselves: containers such as the shared modal body outlive this form
    fields.forEach(el => {
        el.addEventListener('input', save);
        el.addEventListener('change', save);
    });

    const draft = read(key);
    if (draft?.values && differs({ ...initial, ...draft.values })) {
        apply(fields, draft.values);
        const notice = document.createElement('div');
        notice.className = 'form-draft-notice';
        notice.setAttribute('role', 'status');
        notice.innerHTML = `<span>↺ กู้คืนข้อมูลที่กรอกค้างไว้ (บันทึกฉบับร่างเมื่อ ${esc(SAVED_AT.format(new Date(draft.savedAt)))} น.)
            · ข้อมูลยังไม่ถูกบันทึกลงระบบจนกว่าจะกดปุ่มบันทึก</span>
            <button type="button" class="btn btn-sm btn-ghost form-draft-discard">ล้างฉบับร่าง</button>`;
        notice.querySelector('.form-draft-discard').addEventListener('click', () => {
            write(key, null);
            apply(fields, initial);
            notice.remove();
        });
        root.prepend(notice);
    }

    return {
        clear() {
            cleared = true;
            write(key, null);
            root.querySelector('.form-draft-notice')?.remove();
        },
    };
}

/** Remove every draft (on logout) */
export function clearAllFormDrafts() {
    try {
        Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX)).forEach(k => sessionStorage.removeItem(k));
    } catch (e) { /* ignore */ }
}
