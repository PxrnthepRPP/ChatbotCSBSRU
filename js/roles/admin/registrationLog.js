import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { apiErrorText, fetchCached, fetchFresh } from './shared.js';
import { renderAdminSectionsCard } from './sections.js';

/* ============================================================
   REGISTRATION LOG — students register courses themselves and the
   registration is confirmed straight away. The admin does not approve
   anything; this card is the record of who registered what and when,
   with search, CSV export and "withdraw" for a wrong entry.
   ============================================================ */
const LOG_TIME = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const PAGE_SIZE = 50;

let logTermFilter = 'all';
let logSearch = '';
let logShown = PAGE_SIZE;

export async function renderRegistrationLogCard({ cached = false } = {}) {
    const container = document.getElementById('adminRegistrationLogCard');
    if (!container) return;

    let records;
    try {
        records = await (cached ? fetchCached : fetchFresh)('/enrollments');
    } catch (err) {
        container.innerHTML = '';
        return;
    }
    // The dashboard may have re-rendered while waiting for the API
    if (!container.isConnected) return;

    const terms = [...new Set(records.map(r => `${r.section.term}/${r.section.academicYear}`))];
    const q = logSearch.trim().toLowerCase();
    const filtered = records.filter(r =>
        (logTermFilter === 'all' || `${r.section.term}/${r.section.academicYear}` === logTermFilter) &&
        (!q || r.studentId.toLowerCase().includes(q) || (r.studentName || '').toLowerCase().includes(q)
            || r.section.courseCode.toLowerCase().includes(q) || (r.section.courseName || '').toLowerCase().includes(q)));
    const students = new Set(filtered.map(r => r.studentId)).size;

    const rows = filtered.slice(0, logShown).map(r => `
        <tr data-id="${r.enrollmentId}">
            <td style="font-size:0.8rem;white-space:nowrap">${esc(LOG_TIME.format(new Date(r.registeredAt)))}</td>
            <td><strong>${esc(r.studentId)}</strong><div style="font-size:0.82rem">${esc(r.studentName || '')}</div></td>
            <td><span class="badge badge-blue">${esc(r.section.courseCode)}</span><div style="font-size:0.82rem">${esc(r.section.courseName)} (${r.section.credits} หน่วยกิต)</div></td>
            <td>${r.section.term}/${r.section.academicYear} · ${esc(r.section.sectionNo)}</td>
            <td class="hide-mobile">${esc(r.section.dayName)} ${esc(r.section.startTime)}–${esc(r.section.endTime)}</td>
            <td class="hide-mobile">${esc(r.section.instructorName || '-')}</td>
            <td class="hide-mobile">${esc(r.section.room || '-')}</td>
            <td><button type="button" class="btn btn-sm btn-ghost log-drop" title="ถอนรายวิชานี้ออกจากตารางเรียนของนักศึกษา">ถอน</button></td>
        </tr>`).join('');

    const option = (value, label) => `<option value="${value}" ${logTermFilter === value ? 'selected' : ''}>${label}</option>`;

    container.innerHTML = `
        <div class="card">
            <div class="card-title">📝 บันทึกการลงทะเบียนเรียน
                <span class="badge badge-green" style="font-size:0.75rem">${records.length} รายการ</span>
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
                นักศึกษาลงทะเบียนเองและบันทึกลงตารางเรียนทันที ไม่ต้องกดยืนยัน · ผู้ดูแลระบบดูประวัติได้ที่นี่
                และถอนรายการที่ลงผิดได้ · ถ้าข้อมูลวิชาไม่ถูกต้อง แก้ได้ที่การ์ด "รายวิชาในระบบ" ด้านล่าง
            </p>
            <div class="batch-filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <label>ภาคเรียน</label>
                <select class="batch-select" id="logTermFilter" aria-label="กรองตามภาคเรียน">
                    ${option('all', 'ทุกภาคเรียน')}
                    ${terms.map(t => option(t, t)).join('')}
                </select>
                <input type="search" class="app-input" id="logSearch" placeholder="ค้นหารหัส/ชื่อนักศึกษา หรือวิชา" value="${esc(logSearch)}" style="max-width:260px">
                <span class="filter-result-count">${filtered.length} รายการ · ${students} คน</span>
                <button type="button" class="btn btn-sm btn-ghost" id="logExport" ${filtered.length ? '' : 'disabled'}>⬇️ ดาวน์โหลด CSV</button>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>ลงทะเบียนเมื่อ</th><th>นักศึกษา</th><th>วิชา</th><th>ภาค · Sec</th><th class="hide-mobile">วัน-เวลา</th><th class="hide-mobile">อาจารย์</th><th class="hide-mobile">ห้อง</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">ยังไม่มีการลงทะเบียนตามเงื่อนไขที่เลือก</td></tr>'}</tbody>
                </table>
            </div>
            ${filtered.length > logShown ? `<div style="text-align:center;margin-top:10px"><button type="button" class="btn btn-sm btn-ghost" id="logMore">แสดงเพิ่ม (${filtered.length - logShown} รายการ)</button></div>` : ''}
        </div>`;

    container.querySelector('#logTermFilter').addEventListener('change', e => {
        logTermFilter = e.target.value;
        logShown = PAGE_SIZE;
        renderRegistrationLogCard({ cached: true });
    });
    let searchTimer = null;
    container.querySelector('#logSearch').addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            logSearch = e.target.value;
            logShown = PAGE_SIZE;
            await renderRegistrationLogCard({ cached: true });
            const box = document.getElementById('logSearch');
            if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
        }, 300);
    });
    container.querySelector('#logMore')?.addEventListener('click', () => {
        logShown += PAGE_SIZE;
        renderRegistrationLogCard({ cached: true });
    });
    container.querySelector('#logExport').addEventListener('click', () => exportCsv(filtered));

    container.querySelectorAll('tr[data-id]').forEach(row => {
        const r = filtered.find(x => String(x.enrollmentId) === row.dataset.id);
        row.querySelector('.log-drop').addEventListener('click', async () => {
            if (!await confirmDialog(`ถอน ${r.section.courseCode} ${r.section.courseName} ออกจากตารางเรียนของ ${r.studentId} ${r.studentName || ''}?`)) return;
            try {
                await fetchAPI(`/students/${encodeURIComponent(r.studentId)}/enrollments/${r.section.sectionId}`, 'DELETE', null, 8000);
                showToast('info', esc(`ถอน ${r.section.courseCode} ของ ${r.studentId} แล้ว`));
                renderRegistrationLogCard();
                renderAdminSectionsCard();
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
            }
        });
    });
}

function exportCsv(records) {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['ลงทะเบียนเมื่อ', 'รหัสนักศึกษา', 'ชื่อนักศึกษา', 'Sec นักศึกษา', 'ปีการศึกษา', 'ภาคเรียน', 'รหัสวิชา',
        'ชื่อวิชา', 'หน่วยกิต', 'Sec', 'วัน', 'เวลาเริ่ม', 'เวลาสิ้นสุด', 'ห้อง', 'อาจารย์ผู้สอน'];
    const lines = records.map(r => [LOG_TIME.format(new Date(r.registeredAt)), r.studentId, r.studentName, r.studentSection,
        r.section.academicYear, r.section.term, r.section.courseCode, r.section.courseName, r.section.credits,
        r.section.sectionNo, r.section.dayName, r.section.startTime, r.section.endTime, r.section.room,
        r.section.instructorName].map(cell).join(','));
    const blob = new Blob(['﻿' + [header.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `registration-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
