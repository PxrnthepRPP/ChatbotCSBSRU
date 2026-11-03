import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { apiErrorText, fetchCached, fetchFresh } from './shared.js';
import { renderAdminSectionsCard } from './sections.js';

/* ============================================================
   REGISTRATION REQUESTS — students send their course cart,
   the admin confirms or rejects each request.
   ============================================================ */
const REQUEST_TIME = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export async function renderEnrollmentRequestsCard({ cached = false } = {}) {
    const container = document.getElementById('adminEnrollmentRequestsCard');
    if (!container) return;

    let requests;
    try {
        requests = await (cached ? fetchCached : fetchFresh)('/enrollments/pending');
    } catch (err) {
        container.innerHTML = '';
        return;
    }
    // The dashboard may have re-rendered while waiting for the API
    if (!container.isConnected) return;

    const rows = requests.map(r => `
        <tr data-id="${r.enrollmentId}">
            <td><input type="checkbox" class="req-check" value="${r.enrollmentId}"></td>
            <td><strong>${esc(r.studentId)}</strong><div style="font-size:0.82rem">${esc(r.studentName)}</div></td>
            <td><span class="badge badge-purple">${esc(r.studentSection)}</span></td>
            <td><span class="badge badge-blue">${esc(r.section.courseCode)}</span><div style="font-size:0.82rem">${esc(r.section.courseName)}</div></td>
            <td>${r.section.term}/${r.section.academicYear} · ${esc(r.section.sectionNo)}</td>
            <td class="hide-mobile">${esc(r.section.dayName)} ${esc(r.section.startTime)}–${esc(r.section.endTime)}</td>
            <td class="hide-mobile">${r.section.enrolledCount}${r.section.capacity ? ' / ' + r.section.capacity : ''}</td>
            <td class="hide-mobile" style="font-size:0.8rem">${esc(REQUEST_TIME.format(new Date(r.requestedAt)))}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-sm btn-orange req-confirm">ยืนยัน</button>
                <button class="btn btn-sm btn-ghost req-reject">ไม่อนุมัติ</button>
            </td>
        </tr>`).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card-title">📝 คำขอลงทะเบียนของนักศึกษา
                ${requests.length ? `<span class="badge badge-amber" style="font-size:0.75rem">รอยืนยัน ${requests.length}</span>` : ''}
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                นักศึกษาเลือกวิชาแล้วกดยืนยันลงทะเบียน คำขอจะมารอที่นี่ · คำขอที่รออยู่จองที่นั่งไว้แล้ว · ไม่อนุมัติแล้วที่นั่งจะว่าง และนักศึกษาจะเห็นเหตุผล
            </p>
            ${requests.length ? `
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <button class="btn btn-sm btn-orange" id="reqConfirmSelected">ยืนยันที่เลือก</button>
                <button class="btn btn-sm btn-ghost" id="reqRejectSelected">ไม่อนุมัติที่เลือก</button>
            </div>` : ''}
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th><input type="checkbox" id="reqCheckAll" title="เลือกทั้งหมด"></th><th>นักศึกษา</th><th>Sec</th><th>วิชา</th><th>ภาค · กลุ่ม</th><th class="hide-mobile">วัน-เวลา</th><th class="hide-mobile">ที่นั่ง</th><th class="hide-mobile">ส่งเมื่อ</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">ไม่มีคำขอที่รอยืนยัน</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;

    const review = async (ids, status) => {
        if (ids.length === 0) {
            showToast('error', 'กรุณาเลือกคำขออย่างน้อย 1 รายการ');
            return;
        }
        let note = null;
        if (status === 'REJECTED') {
            note = prompt(`เหตุผลที่ไม่อนุมัติ ${ids.length} รายการ (นักศึกษาจะเห็นข้อความนี้)`);
            if (note === null) return;
            if (!note.trim()) {
                showToast('error', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ');
                return;
            }
        }
        try {
            const result = await fetchAPI('/enrollments/review', 'PATCH', { enrollmentIds: ids, status, note }, 8000);
            showToast('success', status === 'CONFIRMED'
                ? `ยืนยันการลงทะเบียน ${result.updated} รายการแล้ว`
                : `ไม่อนุมัติ ${result.updated} รายการแล้ว`);
            renderEnrollmentRequestsCard();
            renderAdminSectionsCard();
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    };

    const selectedIds = () => [...container.querySelectorAll('.req-check:checked')].map(c => Number(c.value));
    container.querySelector('#reqCheckAll')?.addEventListener('change', e => {
        container.querySelectorAll('.req-check').forEach(c => { c.checked = e.target.checked; });
    });
    container.querySelector('#reqConfirmSelected')?.addEventListener('click', () => review(selectedIds(), 'CONFIRMED'));
    container.querySelector('#reqRejectSelected')?.addEventListener('click', () => review(selectedIds(), 'REJECTED'));
    container.querySelectorAll('tr[data-id]').forEach(row => {
        const id = Number(row.dataset.id);
        row.querySelector('.req-confirm').addEventListener('click', () => review([id], 'CONFIRMED'));
        row.querySelector('.req-reject').addEventListener('click', () => review([id], 'REJECTED'));
    });
}
