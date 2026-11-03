/* ============================================================
   BSRU Student Portal — Student Grades & Academic Transcript View
   ============================================================ */

import { esc, fmt, gradeClass } from '../../utils.js';
import { fetchAPI } from '../../api.js';

/* ============================================================
   MOCK DATA — Grades grouped by semester
   ============================================================ */
export const MOCK_GRADES = {
    semesters: [
        {
            label: 'Term 1/2569',
            courses: [
                { code: 'CS2301', name: 'ระบบฐานข้อมูล', credits: 3, grade: 'A', point: 4.0 },
                { code: 'CS2302', name: 'การเขียนโปรแกรมเว็บ', credits: 3, grade: 'A', point: 4.0 },
                { code: 'CS2303', name: 'ระบบจัดการฐานข้อมูล (Lab)', credits: 1, grade: 'A', point: 4.0 },
                { code: 'CS2401', name: 'วิศวกรรมความต้องการ', credits: 3, grade: 'B+', point: 3.5 },
                { code: 'MA2101', name: 'สถิติสำหรับวิทยาการคอมพิวเตอร์', credits: 3, grade: 'B', point: 3.0 },
                { code: 'GE1301', name: 'จิตวิทยาทั่วไป', credits: 3, grade: 'A', point: 4.0 },
            ],
        },
        {
            label: 'Term 2/2568',
            courses: [
                { code: 'CS2101', name: 'โครงสร้างข้อมูล', credits: 3, grade: 'A', point: 4.0 },
                { code: 'CS2102', name: 'การวิเคราะห์อัลกอริทึม', credits: 3, grade: 'B+', point: 3.5 },
                { code: 'CS2201', name: 'สถาปัตยกรรมคอมพิวเตอร์', credits: 3, grade: 'A', point: 4.0 },
                { code: 'CS2103', name: 'ระบบปฏิบัติการ', credits: 3, grade: 'B+', point: 3.5 },
                { code: 'GE1201', name: 'คณิตศาสตร์ดิสครีต', credits: 3, grade: 'B', point: 3.0 },
                { code: 'GE1102', name: 'ภาษาอังกฤษเพื่อการสื่อสาร', credits: 3, grade: 'A', point: 4.0 },
            ],
        },
        {
            label: 'Term 2/2569',
            courses: [
                { code: 'CS3101', name: 'ปัญญาประดิษฐ์', credits: 3, grade: '-', point: null },
                { code: 'CS3102', name: 'วิศวกรรมซอฟต์แวร์', credits: 3, grade: '-', point: null },
                { code: 'CS3201', name: 'ระบบฐานข้อมูลขั้นสูง', credits: 3, grade: '-', point: null },
                { code: 'CS3301', name: 'เครือข่ายคอมพิวเตอร์', credits: 3, grade: '-', point: null },
                { code: 'CS3103', name: 'การพัฒนาเว็บแอปพลิเคชัน', credits: 3, grade: '-', point: null },
                { code: 'GE2301', name: 'ภาษาอังกฤษเชิงวิชาการ', credits: 3, grade: '-', point: null },
            ],
        },
    ],
};

/* ============================================================
   GRADES HELPERS
   ============================================================ */

/** Build the semester <select> options for grades */
export function buildGradesSemesterOptions(grades, selectedIdx) {
    return grades.semesters.map((sem, i) =>
        `<option value="${i}"${i === selectedIdx ? ' selected' : ''}>${esc(sem.label)}</option>`
    ).join('');
}

/** Build the grades table body for a given semester index */
export function buildGradesBody(grades, idx) {
    const sem = grades.semesters[idx];
    const done = sem.courses.filter(c => c.point !== null);
    const tp = done.reduce((a, c) => a + c.point * c.credits, 0);
    const tc = done.reduce((a, c) => a + c.credits, 0);
    const semGpa = tc > 0 ? (tp / tc).toFixed(2) : '-';
    const rows = sem.courses.map(c =>
        `<tr><td><strong>${esc(c.code)}</strong></td><td>${esc(c.name)}</td><td style="text-align:center">${c.credits}</td><td style="text-align:center"><span class="grade ${gradeClass(c.grade)}">${c.grade}</span></td><td style="text-align:center" class="hide-mobile">${c.point !== null ? c.point.toFixed(1) : '-'}</td></tr>`
    ).join('');
    // Narrow screens: one card per course so credits and grade are visible without scrolling sideways
    const cards = sem.courses.map(c => `
        <div class="grade-card" role="listitem">
            <div class="grade-card-main">
                <div class="grade-card-code">${esc(c.code)} · ${c.credits} หน่วยกิต</div>
                <div class="grade-card-name">${esc(c.name)}</div>
            </div>
            <span class="grade ${gradeClass(c.grade)}">${c.grade}</span>
        </div>`).join('');

    return `
        <div class="table-wrap grades-table-wrap">
            <table class="data-table">
                <thead><tr><th>รหัส</th><th>ชื่อวิชา</th><th style="text-align:center">หน่วยกิต</th><th style="text-align:center">เกรด</th><th style="text-align:center" class="hide-mobile">คะแนน</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div class="grades-cards" role="list">${cards}</div>
        <div style="display:flex;justify-content:flex-end;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:0.85rem">
            <span>หน่วยกิตลงทะเบียน: <strong>${sem.courses.reduce((a, c) => a + c.credits, 0)}</strong></span>
            <span>GPA: <strong style="color:var(--brand-600)">${semGpa}</strong></span>
        </div>`;
}

/** Cumulative GPA over every course that has a released grade */
export function cumulativeGpa(semesters) {
    const done = semesters.flatMap(s => s.courses).filter(c => c.point !== null);
    const credits = done.reduce((a, c) => a + c.credits, 0);
    return credits > 0 ? done.reduce((a, c) => a + c.point * c.credits, 0) / credits : 0;
}

/** Convert GET /students/{id}/grades into the shape the grades table renders */
export function gradesFromApi(report) {
    const semesters = report.semesters.map(sem => ({
        label: sem.label,
        courses: sem.courses.map(c => ({
            code: c.code,
            name: c.name,
            credits: c.credits,
            grade: c.grade ?? '-',
            point: c.gradePoint ?? null,
        })),
    }));
    // Credits earned = graded courses that were passed (an F earns nothing)
    const earnedCredits = report.semesters.reduce((sum, sem) => sum + sem.courses
        .filter(c => c.gradePoint != null && c.grade !== 'F').reduce((a, c) => a + c.credits, 0), 0);
    return { semesters, gpa: report.gpa ?? 0, earnedCredits };
}

export function renderGrades(student, studentId = student.studentId) {
    const container = document.getElementById('gradesContent');
    let currentIdx = 0; // default to most recent semester
    // Show the offline sample first, then replace it with the database records when the backend answers
    let grades = { semesters: MOCK_GRADES.semesters, gpa: cumulativeGpa(MOCK_GRADES.semesters) };

    fetchAPI(`/students/${encodeURIComponent(studentId)}/grades`)
        .then(report => {
            grades = gradesFromApi(report);
            currentIdx = 0;
            render(currentIdx);
        })
        .catch(err => console.warn('[Grades] Backend unavailable, showing sample grades:', err.message));

    function render(idx) {
        if (grades.semesters.length === 0) {
            container.innerHTML = `<div class="card"><div class="card-title">📖 ผลการเรียนรายภาคเรียน (Studied Result)</div><p>ยังไม่มีข้อมูลผลการเรียนในระบบ</p></div>`;
            return;
        }
        const sem = grades.semesters[idx];
        container.innerHTML = `
            <div class="stat-row">
                <div class="stat-card"><div class="stat-icon purple">📊</div><div><div class="stat-value">${grades.gpa.toFixed(2)}</div><div class="stat-label">GPA สะสม</div></div></div>
                <div class="stat-card"><div class="stat-icon green">📚</div><div><div class="stat-value">${grades.earnedCredits ?? student.credits}</div><div class="stat-label">หน่วยกิตสะสม</div></div></div>
                <div class="stat-card"><div class="stat-icon amber">📋</div><div><div class="stat-value">${grades.semesters.length}</div><div class="stat-label">ภาคเรียนทั้งหมด</div></div></div>
            </div>
            <div class="card">
                <div class="card-title">📖 ผลการเรียนรายภาคเรียน (Studied Result)</div>
                <div class="batch-filter-bar" style="margin-bottom:16px">
                    <label>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Semester
                    </label>
                    <select class="batch-select" id="gradesSemesterSelect">
                        ${buildGradesSemesterOptions(grades, idx)}
                    </select>
                    <span class="filter-result-count">Showing: <strong>${esc(sem.label)}</strong></span>
                </div>
                <div id="gradesTableBody">
                    ${buildGradesBody(grades, idx)}
                </div>
            </div>`;

        // Attach change listener
        document.getElementById('gradesSemesterSelect').addEventListener('change', (e) => {
            currentIdx = parseInt(e.target.value, 10);
            render(currentIdx);
        });
    }

    render(currentIdx);
}
