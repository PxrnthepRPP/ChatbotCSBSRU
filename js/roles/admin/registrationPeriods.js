import { showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { apiErrorText } from './shared.js';

/* ============================================================
   REGISTRATION PERIODS — when students may add/drop courses
   ============================================================ */

/** "2026-10-05T08:00:00" -> "2026-10-05T08:00" for <input type="datetime-local"> */
const toInputDateTime = (iso) => (iso || '').slice(0, 16);

export async function renderRegistrationCard() {
    const container = document.getElementById('adminRegistrationCard');
    if (!container) return;

    let periods;
    try {
        periods = await fetchAPI('/registration-periods');
        if (!container.isConnected) return;
    } catch (err) {
        container.innerHTML = `<div class="card"><div class="card-title">🗓️ ช่วงลงทะเบียนเรียน</div><p style="color:var(--text-muted)">เชื่อมต่อ backend ไม่ได้ จึงยังจัดการช่วงลงทะเบียนไม่ได้</p></div>`;
        return;
    }

    const rows = periods.map(p => `
        <tr data-year="${p.academicYear}" data-term="${p.term}">
            <td><strong>${p.term}/${p.academicYear}</strong></td>
            <td>${p.open
                ? '<span class="badge badge-green">เปิดอยู่</span>'
                : `<span class="badge badge-red">ปิดอยู่${p.forceClosed ? ' (ปิดด่วน)' : ''}</span>`}</td>
            <td><input type="datetime-local" class="app-input reg-opens" aria-label="à¹à¸§à¸¥à¸²à¹à¸à¸´à¸à¸¥à¸à¸à¸°à¹à¸à¸µà¸¢à¸" value="${toInputDateTime(p.opensAt)}"></td>
            <td><input type="datetime-local" class="app-input reg-closes" aria-label="à¹à¸§à¸¥à¸²à¸à¸´à¸à¸¥à¸à¸à¸°à¹à¸à¸µà¸¢à¸" value="${toInputDateTime(p.closesAt)}"></td>
            <td style="white-space:nowrap">
                <button class="btn btn-sm btn-ghost reg-save">บันทึกเวลา</button>
                <button class="btn btn-sm ${p.forceClosed ? 'btn-orange' : 'btn-danger'} reg-toggle" data-force-closed="${!p.forceClosed}">
                    ${p.forceClosed ? 'ยกเลิกปิดด่วน' : 'ปิดด่วน'}
                </button>
            </td>
        </tr>`).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card-title">🗓️ ช่วงลงทะเบียนเรียน (นักศึกษาเพิ่ม/ลบวิชาเองได้เฉพาะช่วงที่เปิด)</div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                เปิดอยู่ = เวลาปัจจุบันอยู่ในช่วงเปิด–ปิด และไม่ได้กดปิดด่วน · ผู้ดูแลระบบและอาจารย์ผู้สอนแก้ตารางเรียนได้ตลอดเวลา
            </p>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>ภาคเรียน</th><th>สถานะ</th><th>เปิด</th><th>ปิด</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">ยังไม่มีช่วงลงทะเบียน</td></tr>'}</tbody>
                </table>
            </div>
            <div class="batch-filter-bar" style="margin-top:12px;flex-wrap:wrap;gap:8px;align-items:flex-end">
                <strong style="font-size:0.85rem;width:100%">สร้างช่วงลงทะเบียนภาคเรียนใหม่</strong>
                <label class="reg-field">ปีการศึกษา<input type="number" class="app-input" id="regNewYear" placeholder="เช่น 2569" style="width:120px"></label>
                <label class="reg-field">ภาคเรียน<select class="batch-select" id="regNewTerm"><option value="1">ภาค 1</option><option value="2">ภาค 2</option><option value="3">ภาคฤดูร้อน</option></select></label>
                <label class="reg-field">เปิดลงทะเบียน<input type="datetime-local" class="app-input" id="regNewOpens"></label>
                <label class="reg-field">ปิดลงทะเบียน<input type="datetime-local" class="app-input" id="regNewCloses"></label>
                <button class="btn btn-sm btn-orange" id="regCreateBtn">สร้าง</button>
            </div>
        </div>`;

    const save = async (body, successMessage) => {
        try {
            await fetchAPI('/registration-periods', 'PUT', body, 8000);
            showToast('success', successMessage);
            renderRegistrationCard();
        } catch (err) {
            showToast('error', apiErrorText(err));
        }
    };

    container.querySelectorAll('tr[data-year]').forEach(row => {
        const base = { academicYear: Number(row.dataset.year), term: Number(row.dataset.term) };
        const label = `${base.term}/${base.academicYear}`;
        row.querySelector('.reg-save').addEventListener('click', () => save({
            ...base,
            opensAt: row.querySelector('.reg-opens').value,
            closesAt: row.querySelector('.reg-closes').value,
        }, `บันทึกช่วงลงทะเบียนภาคเรียน ${label} แล้ว`));
        const toggle = row.querySelector('.reg-toggle');
        toggle.addEventListener('click', () => {
            const forceClosed = toggle.dataset.forceClosed === 'true';
            save({ ...base, forceClosed },
                forceClosed ? `ปิดลงทะเบียนภาคเรียน ${label} ทันทีแล้ว` : `ยกเลิกปิดด่วน ภาคเรียน ${label} จะเปิดตามช่วงเวลาที่ตั้งไว้`);
        });
    });

    container.querySelector('#regCreateBtn').addEventListener('click', () => {
        const year = Number(document.getElementById('regNewYear').value);
        if (!year) {
            showToast('error', 'กรุณากรอกปีการศึกษา');
            return;
        }
        save({
            academicYear: year,
            term: Number(document.getElementById('regNewTerm').value),
            opensAt: document.getElementById('regNewOpens').value || null,
            closesAt: document.getElementById('regNewCloses').value || null,
            forceClosed: false,
        }, `สร้างช่วงลงทะเบียนภาคเรียนใหม่แล้ว`);
    });
}
