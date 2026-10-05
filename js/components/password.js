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
                ${forced ? '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">บัญชีนี้ใช้รหัสผ่านเริ่มต้น (หรือถูกรีเซ็ต) กรุณาตั้งรหัสผ่านใหม่ของคุณเอง</p>' : ''}
                <div class="modal-field"><label>รหัสผ่านปัจจุบัน</label><input type="password" id="pwCurrent" autocomplete="current-password"></div>
                <div class="modal-field"><label>รหัสผ่านใหม่</label><input type="password" id="pwNew" autocomplete="new-password"></div>
                <div class="modal-field"><label>ยืนยันรหัสผ่านใหม่</label><input type="password" id="pwConfirm" autocomplete="new-password"></div>
                <p style="font-size:0.78rem;color:var(--text-muted)">อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรภาษาอังกฤษและตัวเลข และต้องไม่เหมือนชื่อผู้ใช้</p>
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
    overlay.querySelector('#pwCurrent').focus();

    overlay.querySelector('#pwSave').addEventListener('click', async () => {
        const current = overlay.querySelector('#pwCurrent').value;
        const next = overlay.querySelector('#pwNew').value;
        const confirmValue = overlay.querySelector('#pwConfirm').value;
        if (!current || !next) return showError('กรุณากรอกรหัสผ่านให้ครบ');
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
