/* ================================================================
   BSRU Student Portal — Change Password dialog (every role)
   ================================================================
   forced = true is used right after logging in with a first / reset
   password: the dialog cannot be dismissed until the password is changed
   (the user may still log out).
   ================================================================ */

import { fetchAPI } from '../api.js';
import { esc, showToast } from '../utils.js';

function errorText(err) {
    const match = /\{.*\}$/s.exec(err.message || '');
    if (match) {
        try { return JSON.parse(match[0]).error || err.message; } catch (e) { /* not JSON */ }
    }
    return err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

/**
 * @param {{forced?: boolean, onChanged?: () => void, onLogout?: () => void}} options
 */
export function openChangePasswordModal({ forced = false, onChanged, onLogout } = {}) {
    document.getElementById('pwModal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'pwModal';
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
        <div class="modal-card" style="max-width:440px;width:92vw">
            <div class="modal-header">
                <h3>🔑 ${forced ? 'ตั้งรหัสผ่านใหม่ก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน'}</h3>
                ${forced ? '' : '<button class="modal-close" id="pwClose" aria-label="ปิด">✕</button>'}
            </div>
            <div class="modal-body">
                ${forced ? '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">บัญชีนี้ใช้รหัสผ่านเริ่มต้น (หรือถูกรีเซ็ต) กรุณาตั้งรหัสผ่านใหม่ตามมาตรฐานความปลอดภัยขั้นสูง</p>' : ''}
                <div class="modal-field"><label>รหัสผ่านปัจจุบัน</label><input type="password" id="pwCurrent" autocomplete="current-password"></div>
                <div class="modal-field"><label>รหัสผ่านใหม่</label><input type="password" id="pwNew" autocomplete="new-password"></div>
                <div class="modal-field"><label>ยืนยันรหัสผ่านใหม่</label><input type="password" id="pwConfirm" autocomplete="new-password"></div>
                
                <div class="pw-checklist" style="font-size:0.78rem;margin-top:10px;background:var(--bg-secondary,#f9fafb);padding:10px 12px;border-radius:6px;border:1px solid var(--border-color,#e5e7eb);line-height:1.6">
                    <div style="font-weight:600;margin-bottom:4px;color:var(--text-main,#374151)">🔒 มาตรฐานรหัสผ่านขั้นสูง:</div>
                    <div id="chkLen" style="color:var(--text-muted);display:flex;align-items:center;gap:6px"><span>⚪</span> ความยาวอย่างน้อย 8 ตัวอักษร</div>
                    <div id="chkUpper" style="color:var(--text-muted);display:flex;align-items:center;gap:6px"><span>⚪</span> ตัวอักษรพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว</div>
                    <div id="chkLower" style="color:var(--text-muted);display:flex;align-items:center;gap:6px"><span>⚪</span> ตัวอักษรพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว</div>
                    <div id="chkNum" style="color:var(--text-muted);display:flex;align-items:center;gap:6px"><span>⚪</span> ตัวเลข (0-9) อย่างน้อย 1 ตัว</div>
                </div>

                <div id="pwError" style="display:none;color:var(--red-600);font-size:0.85rem;margin-top:8px"></div>
            </div>
            <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 20px">
                ${forced ? '<button class="btn btn-ghost" id="pwLogout">ออกจากระบบ</button>' : '<button class="btn btn-ghost" id="pwCancel">ยกเลิก</button>'}
                <button class="btn btn-primary" id="pwSave">บันทึกรหัสผ่าน</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    if (!forced) {
        overlay.querySelector('#pwClose').addEventListener('click', close);
        overlay.querySelector('#pwCancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    } else {
        overlay.querySelector('#pwLogout').addEventListener('click', () => { close(); onLogout?.(); });
    }

    const errorBox = overlay.querySelector('#pwError');
    const showError = msg => { errorBox.textContent = msg; errorBox.style.display = msg ? 'block' : 'none'; };
    const pwNewInput = overlay.querySelector('#pwNew');
    overlay.querySelector('#pwCurrent').focus();

    const updateChecklist = () => {
        const val = pwNewInput.value || '';
        const setItem = (id, valid) => {
            const el = overlay.querySelector('#' + id);
            if (!el) return;
            if (valid) {
                el.style.color = '#16a34a';
                el.querySelector('span').textContent = '✅';
            } else {
                el.style.color = 'var(--text-muted)';
                el.querySelector('span').textContent = '⚪';
            }
        };

        setItem('chkLen', val.length >= 8);
        setItem('chkUpper', /[A-Z]/.test(val));
        setItem('chkLower', /[a-z]/.test(val));
        setItem('chkNum', /\d/.test(val));
    };

    pwNewInput.addEventListener('input', updateChecklist);

    overlay.querySelector('#pwSave').addEventListener('click', async () => {
        const current = overlay.querySelector('#pwCurrent').value;
        const next = pwNewInput.value;
        const confirmValue = overlay.querySelector('#pwConfirm').value;
        if (!current || !next) return showError('กรุณากรอกรหัสผ่านให้ครบ');

        if (next.length < 8) return showError('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
        if (!/[A-Z]/.test(next)) return showError('รหัสผ่านใหม่ต้องมีตัวอักษรพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว');
        if (!/[a-z]/.test(next)) return showError('รหัสผ่านใหม่ต้องมีตัวอักษรพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว');
        if (!/\d/.test(next)) return showError('รหัสผ่านใหม่ต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว');
        if (next !== confirmValue) return showError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');

        const saveBtn = overlay.querySelector('#pwSave');
        saveBtn.disabled = true;
        try {
            await fetchAPI('/auth/change-password', 'POST', { currentPassword: current, newPassword: next }, 10000);
        } catch (err) {
            showError(errorText(err));
            saveBtn.disabled = false;
            return;
        }
        close();
        showToast('success', esc('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว'));
        onChanged?.();
    });
}
