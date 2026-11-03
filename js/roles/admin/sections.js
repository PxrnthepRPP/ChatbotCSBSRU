import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { apiErrorText } from './shared.js';

/* ============================================================
   CLASS SECTIONS — teachers request, admin approves.
   Students can only register for APPROVED sections.
   ============================================================ */
const SECTION_STATUS = {
    PENDING: { label: 'รออนุมัติ', badge: 'badge-amber' },
    APPROVED: { label: 'อนุมัติแล้ว', badge: 'badge-green' },
    REJECTED: { label: 'ไม่อนุมัติ', badge: 'badge-red' },
};

/** Status badge of a section, with the admin's note as a tooltip (shared with the advisor page) */
export function sectionStatusBadge(section) {
    const st = SECTION_STATUS[section.approvalStatus] || SECTION_STATUS.APPROVED;
    const note = section.reviewNote ? ` title="${esc(section.reviewNote)}"` : '';
    return `<span class="badge ${st.badge}"${note}>${st.label}</span>`;
}

let adminSectionStatusFilter = null;  // null = choose automatically on first render
let adminSectionTermFilter = 'all';

export async function renderAdminSectionsCard() {
    const container = document.getElementById('adminSectionsCard');
    if (!container) return;

    let sections;
    try {
        sections = await fetchAPI('/sections/mine');
    } catch (err) {
        container.innerHTML = `<div class="card"><div class="card-title">📚 จัดการกลุ่มเรียน</div><p style="color:var(--text-muted)">เชื่อมต่อ backend ไม่ได้ จึงยังจัดการกลุ่มเรียนไม่ได้</p></div>`;
        return;
    }
    // The dashboard may have re-rendered while waiting for the API
    if (!container.isConnected) return;

    const pendingCount = sections.filter(s => s.approvalStatus === 'PENDING').length;
    if (adminSectionStatusFilter === null) adminSectionStatusFilter = pendingCount > 0 ? 'PENDING' : 'all';

    const terms = [...new Set(sections.map(s => `${s.term}/${s.academicYear}`))];
    const shown = sections.filter(s =>
        (adminSectionStatusFilter === 'all' || s.approvalStatus === adminSectionStatusFilter) &&
        (adminSectionTermFilter === 'all' || `${s.term}/${s.academicYear}` === adminSectionTermFilter));

    const rows = shown.map(s => `
        <tr data-section-id="${s.sectionId}">
            <td><span class="badge badge-blue">${esc(s.courseCode)}</span><div style="font-size:0.82rem">${esc(s.courseName)} (${s.credits} หน่วยกิต)</div></td>
            <td>${s.term}/${s.academicYear}</td>
            <td class="hide-mobile">${esc(s.sectionNo)}</td>
            <td>${esc(s.dayName)} ${esc(s.startTime)}–${esc(s.endTime)}</td>
            <td class="hide-mobile">${esc(s.room || '-')}</td>
            <td class="hide-mobile">${esc(s.instructorName || '-')}</td>
            <td>${s.enrolledCount}${s.capacity ? ' / ' + s.capacity : ''}</td>
            <td>${sectionStatusBadge(s)}${s.reviewNote ? `<div style="font-size:0.75rem;color:var(--text-muted)">${esc(s.reviewNote)}</div>` : ''}</td>
            <td style="white-space:nowrap">
                <div class="action-btns" style="display:inline-flex;align-items:center;gap:6px">
                    ${s.approvalStatus !== 'APPROVED' ? '<button class="btn btn-sm btn-orange sec-approve">อนุมัติ</button>' : ''}
                    ${s.approvalStatus !== 'REJECTED' ? '<button class="btn btn-sm btn-ghost sec-reject">ไม่อนุมัติ</button>' : ''}
                    <button type="button" class="btn btn-sm btn-ghost btn-icon sec-delete" title="ลบกลุ่มเรียน" aria-label="ลบกลุ่มเรียน">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        </tr>`).join('');

    const option = (value, label, selected) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`;

    container.innerHTML = `
        <div class="card">
            <div class="card-title">📚 จัดการกลุ่มเรียน
                ${pendingCount > 0 ? `<span class="badge badge-amber" style="font-size:0.75rem">รออนุมัติ ${pendingCount}</span>` : ''}
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                อาจารย์เป็นผู้เพิ่ม/แก้ไขกลุ่มเรียน แล้วส่งมาให้อนุมัติ · นักศึกษาลงทะเบียนได้เฉพาะกลุ่มที่อนุมัติแล้ว ·
                ถ้าอาจารย์แก้กลุ่มที่อนุมัติไปแล้ว จะกลับมารออนุมัติใหม่ (นักศึกษาที่ลงไว้แล้วยังอยู่ในกลุ่มเดิม)
            </p>
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <label>สถานะ</label>
                <select class="batch-select" id="secStatusFilter" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸ªà¸à¸²à¸à¸°à¸à¸¥à¸¸à¹à¸¡à¹à¸£à¸µà¸¢à¸">
                    ${option('all', 'ทั้งหมด', adminSectionStatusFilter)}
                    ${option('PENDING', 'รออนุมัติ', adminSectionStatusFilter)}
                    ${option('APPROVED', 'อนุมัติแล้ว', adminSectionStatusFilter)}
                    ${option('REJECTED', 'ไม่อนุมัติ', adminSectionStatusFilter)}
                </select>
                <label>ภาคเรียน</label>
                <select class="batch-select" id="secTermFilter" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸ à¸²à¸à¹à¸£à¸µà¸¢à¸">
                    ${option('all', 'ทุกภาคเรียน', adminSectionTermFilter)}
                    ${terms.map(t => option(t, t, adminSectionTermFilter)).join('')}
                </select>
            </div>
            <div class="table-wrap">
                <table class="data-table" id="adminSectionsTable">
                    <thead><tr><th>วิชา</th><th>ภาค</th><th class="hide-mobile">Sec</th><th>วัน-เวลา</th><th class="hide-mobile">ห้อง</th><th class="hide-mobile">อาจารย์</th><th>นักศึกษา</th><th>สถานะ</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">ไม่มีกลุ่มเรียนตามเงื่อนไขที่เลือก</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;

    container.querySelector('#secStatusFilter').addEventListener('change', e => {
        adminSectionStatusFilter = e.target.value;
        renderAdminSectionsCard();
    });
    container.querySelector('#secTermFilter').addEventListener('change', e => {
        adminSectionTermFilter = e.target.value;
        renderAdminSectionsCard();
    });

    const review = async (section, status, note, message) => {
        try {
            await fetchAPI(`/sections/${section.sectionId}/review`, 'PATCH', { status, note }, 8000);
            showToast('success', esc(message));
            renderAdminSectionsCard();
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    };

    container.querySelectorAll('tr[data-section-id]').forEach(row => {
        const section = sections.find(s => String(s.sectionId) === row.dataset.sectionId);
        const label = `${section.courseCode} กลุ่ม ${section.sectionNo} (${section.term}/${section.academicYear})`;

        row.querySelector('.sec-approve')?.addEventListener('click', () =>
            review(section, 'APPROVED', null, `อนุมัติ ${label} แล้ว นักศึกษาลงทะเบียนได้`));

        row.querySelector('.sec-reject')?.addEventListener('click', () => {
            const note = prompt(`เหตุผลที่ไม่อนุมัติ ${label} (อาจารย์จะเห็นข้อความนี้)`);
            if (note === null) return;
            if (!note.trim()) {
                showToast('error', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ');
                return;
            }
            review(section, 'REJECTED', note.trim(), `ไม่อนุมัติ ${label} แล้ว`);
        });

        row.querySelector('.sec-delete').addEventListener('click', async () => {
            const warning = section.enrolledCount > 0
                ? `\nนักศึกษา ${section.enrolledCount} คนที่ลงกลุ่มนี้จะถูกถอนออกจากตารางเรียนด้วย` : '';
            if (!await confirmDialog(`ลบ ${label}?${warning}`)) return;
            try {
                await fetchAPI(`/sections/${section.sectionId}`, 'DELETE', null, 8000);
                showToast('info', esc(`ลบ ${label} แล้ว`));
                renderAdminSectionsCard();
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
            }
        });
    });
}
