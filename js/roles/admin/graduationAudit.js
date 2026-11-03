import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { apiErrorText } from './shared.js';

/* ============================================================
   GRADUATION AUDIT SHEETS — one JSON per student, same format as
   src/main/resources/graduation/<studentId>.json (see README.md there)
   ============================================================ */
const AUDIT_TEMPLATE_STUDENT = '6621100042';

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function bindGraduationAuditButtons() {
    document.querySelectorAll('.audit-dl-btn').forEach(btn => btn.addEventListener('click', async () => {
        const sid = btn.dataset.sid;
        try {
            downloadJson(await fetchAPI(`/students/${encodeURIComponent(sid)}/graduation-audit/raw`, 'GET', null, 10000), `${sid}.json`);
        } catch (err) {
            if (!/HTTP 404/.test(err.message || '')) {
                showToast('error', esc(apiErrorText(err)));
                return;
            }
            // No sheet yet: hand out an existing one as the template to fill in
            try {
                const template = await fetchAPI(`/students/${AUDIT_TEMPLATE_STUDENT}/graduation-audit/raw`, 'GET', null, 10000);
                downloadJson(template, `${sid}-template.json`);
                showToast('info', esc(`${sid} ยังไม่มีใบตรวจสอบจบ ดาวน์โหลดใบของ ${AUDIT_TEMPLATE_STUDENT} ไปเป็นแม่แบบแทน แก้รายวิชา/เกรดแล้วอัปโหลดกลับได้`));
            } catch (e) {
                showToast('error', esc(apiErrorText(e)));
            }
        }
    }));

    const input = document.getElementById('auditUploadInput');
    document.querySelectorAll('.audit-ul-btn').forEach(btn => btn.addEventListener('click', () => {
        input.dataset.sid = btn.dataset.sid;
        input.value = '';
        input.click();
    }));
    input?.addEventListener('change', async () => {
        const file = input.files[0];
        const sid = input.dataset.sid;
        if (!file || !sid) return;
        let text;
        try {
            text = await file.text();
            JSON.parse(text);
        } catch (e) {
            showToast('error', 'ไฟล์ไม่ใช่ JSON ที่ถูกต้อง');
            return;
        }
        try {
            const summary = await fetchAPI(`/students/${encodeURIComponent(sid)}/graduation-audit`, 'PUT', text, 15000);
            showToast('success', esc(`อัปโหลดใบตรวจสอบจบของ ${sid} แล้ว: ${summary.totalEarnedCredits}/${summary.totalRequiredCredits} หน่วยกิต · GPA ${Number(summary.currentGpa).toFixed(2)} · ผ่าน ${summary.passedCategories}/${summary.totalCategories} หมวด · ${summary.status}`));
        } catch (err) {
            showToast('error', esc(apiErrorText(err)));
        }
    });
}
