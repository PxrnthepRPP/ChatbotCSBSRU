/* ============================================================
   BSRU Student Portal — Student Profile, Career Tracking & Bio
   ============================================================ */

import { esc, statusBadge, showToast, admissionYearFromId } from '../../utils.js';
import { MOCK_STUDENTS_POOL, MOCK_ADVISORS } from '../admin.js';
import { fetchAPI } from '../../api.js';
import { STANDARD_CAREERS, EMPLOYMENT_STATUSES, SALARY_RANGES } from '../../components/careerCatalog.js';
import { showPetitionToast } from './petitionsView.js';
import { apiErrorMessage } from './timetableView.js';

/* ============================================================
   EDITABLE STUDENT DATA STORE
   Stores student-editable fields keyed by studentId.
   ============================================================ */
export const studentEditableData = {};

export function getStudentFullData(studentId) {
    const base = MOCK_STUDENTS_POOL.find(s => s.studentId === studentId) || MOCK_STUDENTS_POOL[0];
    const creditsMap = { 4: 120, 3: 96, 2: 48, 1: 18 };

    // Initialize editable data from localStorage or defaults
    if (!studentEditableData[studentId]) {
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem('studentEditableData_' + studentId));
        } catch (e) {}

        studentEditableData[studentId] = saved || {
            email: base.nameEn.split(' ')[0].toLowerCase() + '.' + base.nameEn.split(' ')[1][0].toLowerCase() + '@bsru.ac.th',
            phone: '08' + Math.floor(10000000 + Math.random() * 90000000),
            birthDate: Math.floor(1 + Math.random() * 28) + ' ' + ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][Math.floor(Math.random() * 12)] + ' 2546',
            religion: 'พุทธ',
            address: '123 ถ.อิสรภาพ แขวงหิรัญรูจี เขตธนบุรี กรุงเทพฯ 10600',
            avatar: null,
        };
    }
    const editable = studentEditableData[studentId];

    return {
        ...base,
        faculty: 'คณะวิทยาศาสตร์และเทคโนโลยี',
        department: 'สาขาวิทยาการคอมพิวเตอร์',
        advisor: MOCK_ADVISORS.find(a => a.id === base.advisor)?.nameTh || 'ผศ.ดร.วิชัย เทคโนโลยี',
        email: editable.email,
        phone: editable.phone,
        credits: creditsMap[base.year] || 48,
        admitYear: admissionYearFromId(base.studentId) || 2566,
        birthDate: editable.birthDate,
        religion: editable.religion || 'พุทธ',
        address: editable.address,
        avatar: editable.avatar || null,
        careerPath: editable.careerPath !== undefined ? editable.careerPath : (base.careerPath || ''),
        employmentStatus: editable.employmentStatus !== undefined ? editable.employmentStatus : (base.employmentStatus || ''),
        companyName: editable.companyName !== undefined ? editable.companyName : (base.companyName || ''),
        salaryRange: editable.salaryRange !== undefined ? editable.salaryRange : (base.salaryRange || ''),
    };
}

/**
 * Open Modal for Graduate Career Tracking & Employment Status
 */
export function openStudentCareerModal(s, onComplete) {
    const crudModal = document.getElementById('crudModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    if (!crudModal || !modalTitle || !modalBody) return;

    const currentCareer = s.careerPath || '';
    const isStandardCareer = STANDARD_CAREERS.some(c => c.id === currentCareer || c.name === currentCareer);
    const selectedCareerId = isStandardCareer ? currentCareer : (currentCareer ? 'other' : '');
    const customCareerVal = isStandardCareer ? '' : currentCareer;

    const careerOpts = `
        <option value="">-- เลือกสายอาชีพหลักของคุณ --</option>
        ${STANDARD_CAREERS.map(c => `<option value="${esc(c.id)}" ${selectedCareerId === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}
    `;

    const empStatusOpts = `
        <option value="">-- เลือกสถานะการทำงานปัจจุบัน --</option>
        ${EMPLOYMENT_STATUSES.map(es => `<option value="${esc(es.label)}" ${s.employmentStatus === es.label ? 'selected' : ''}>${esc(es.label)}</option>`).join('')}
    `;

    const salaryOpts = `
        <option value="">-- ไม่ระบุ --</option>
        ${SALARY_RANGES.map(sr => `<option value="${esc(sr)}" ${s.salaryRange === sr ? 'selected' : ''}>${esc(sr)}</option>`).join('')}
    `;

    modalTitle.textContent = '💼 อัปเดตข้อมูลสายอาชีพบัณฑิต (Career Tracking)';
    modalBody.innerHTML = `
        <div style="font-size:0.84rem;color:var(--g-600);margin-bottom:14px;line-height:1.5;">
            ข้อมูลนี้จะถูกนำไปรวบรวมเป็นสถิติสายอาชีพของบัณฑิตสาขาวิชาวิทยาการคอมพิวเตอร์ BSRU เพื่อการพัฒนาหลักสูตรและการติดตามภาวะการมีงานทำ
        </div>
        <div class="modal-field">
            <label>สถานะการทำงานปัจจุบัน <span style="color:var(--red-500)">*</span></label>
            <select id="smfEmpStatus">${empStatusOpts}</select>
        </div>
        <div class="modal-field">
            <label>สายอาชีพหลัก <span style="color:var(--red-500)">*</span></label>
            <select id="smfCareerSelect">${careerOpts}</select>
        </div>
        <div class="modal-field" id="smfCareerCustomWrap" style="${selectedCareerId === 'other' ? 'display:block;' : 'display:none;'}">
            <label>ระบุสายอาชีพเพิ่มเติม</label>
            <input id="smfCareerCustom" placeholder="พิมพ์ชื่อตำแหน่งหรือสายอาชีพ..." value="${esc(customCareerVal)}">
        </div>
        <div class="modal-field">
            <label>สถานที่ทำงาน / หน่วยงาน / บริษัท</label>
            <input id="smfCompany" placeholder="เช่น Agoda, SCB TechX, ธุรกิจส่วนตัว..." value="${esc(s.companyName || '')}">
        </div>
        <div class="modal-field">
            <label>ช่วงเงินเดือนเริ่มต้น / ปัจจุบัน (ไม่บังคับ)</label>
            <select id="smfSalary">${salaryOpts}</select>
        </div>
    `;

    const careerSelect = document.getElementById('smfCareerSelect');
    const careerCustomWrap = document.getElementById('smfCareerCustomWrap');
    careerSelect.addEventListener('change', () => {
        careerCustomWrap.style.display = careerSelect.value === 'other' ? 'block' : 'none';
    });

    const saveBtn = document.getElementById('modalSave');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', () => {
        const empStatus = document.getElementById('smfEmpStatus').value;
        const careerSelectVal = document.getElementById('smfCareerSelect').value;
        const careerCustomVal = document.getElementById('smfCareerCustom').value.trim();
        const finalCareer = careerSelectVal === 'other' ? careerCustomVal : careerSelectVal;
        const companyName = document.getElementById('smfCompany').value.trim();
        const salaryRange = document.getElementById('smfSalary').value;

        if (!finalCareer && !empStatus) {
            alert('กรุณาเลือกสถานะการทำงานหรือสายอาชีพ');
            return;
        }

        // Update editable data & local storage
        if (!studentEditableData[s.studentId]) studentEditableData[s.studentId] = {};
        studentEditableData[s.studentId].careerPath = finalCareer;
        studentEditableData[s.studentId].employmentStatus = empStatus;
        studentEditableData[s.studentId].companyName = companyName;
        studentEditableData[s.studentId].salaryRange = salaryRange;
        try {
            localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
        } catch (e) {}

        // Update base pool
        const poolItem = MOCK_STUDENTS_POOL.find(item => item.studentId === s.studentId);
        if (poolItem) {
            poolItem.careerPath = finalCareer;
            poolItem.employmentStatus = empStatus;
            poolItem.companyName = companyName;
            poolItem.salaryRange = salaryRange;
        }

        // Update in-memory student object
        s.careerPath = finalCareer;
        s.employmentStatus = empStatus;
        s.companyName = companyName;
        s.salaryRange = salaryRange;

        // Async API sync
        fetchAPI(`/students/${s.studentId}/career`, 'PATCH', {
            careerPath: finalCareer,
            employmentStatus: empStatus,
            companyName: companyName,
            salaryRange: salaryRange,
        }).catch(() => {});

        crudModal.classList.remove('open');
        showPetitionToast('success', 'บันทึกข้อมูลสายอาชีพเรียบร้อยแล้ว ขอบคุณสำหรับข้อมูล 🎓');

        if (typeof onComplete === 'function') onComplete();
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('bsru:career-updated', { detail: s }));
        }
    });

    crudModal.classList.add('open');
}

export function updateTopbarAvatar(avatarUrl) {
    const topbarAvatar = document.getElementById('topbarAvatar');
    if (topbarAvatar) {
        if (avatarUrl) {
            topbarAvatar.innerHTML = `<img src="${avatarUrl}" class="topbar-avatar-img" alt="User Avatar">`;
        } else {
            topbarAvatar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>`;
        }
    }
}

export function applyDbProfile(target, db, audit, timetable) {
    const term = (timetable || []).find(t => t.registration) || (timetable || [])[0];
    Object.assign(target, {
        fromDb: true,
        studentId: db.studentId,
        nameTh: db.nameTh,
        nameEn: db.nameEn,
        year: db.year,
        status: db.status,
        gpa: db.gpa ?? target.gpa,
        advisor: db.advisor?.nameTh || '-',
        faculty: db.faculty || target.faculty,
        department: db.department || target.department,
        admitYear: db.admissionYear || target.admitYear,
        studentSection: db.studentSection || null,
        email: db.email || '-',
        phone: db.phone || '-',
        birthDate: db.birthDate ? isoToThaiDate(db.birthDate) : '-',
        religion: db.religion || '-',
        address: db.address || '-',
        careerPath: db.careerPath || '',
        employmentStatus: db.employmentStatus || '',
        companyName: db.companyName || '',
        salaryRange: db.salaryRange || '',
        credits: audit?.summary?.totalEarnedCredits ?? target.credits,
        currentCourses: term ? term.sessions.length : target.currentCourses,
    });
    return target;
}

/**
 * Replace the offline sample profile with the student's record in the database, so the profile page,
 * the advisor's view and the chatbot show the same data. The avatar stays in this browser.
 */
export async function loadProfileFromDb(student, studentId, onUpdate) {
    let db, audit, timetable;
    try {
        [db, audit, timetable] = await Promise.all([
            fetchAPI(`/students/${encodeURIComponent(studentId)}`),
            fetchAPI(`/students/${encodeURIComponent(studentId)}/graduation-audit`).catch(() => null),
            fetchAPI(`/students/${encodeURIComponent(studentId)}/timetable`).catch(() => null),
        ]);
    } catch (err) {
        console.warn('[Profile] Backend unavailable, showing sample profile:', err.message);
        return;
    }
    applyDbProfile(student, db, audit, timetable);
    renderBibliography(student);
    if (typeof onUpdate === 'function') {
        onUpdate();
    }
}

/* ============================================================
   THAI DATE CONVERSION HELPERS
   ============================================================ */
export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** Convert Thai date string e.g. "15 ม.ค. 2546" to ISO date "2003-01-15" */
export function thaiDateToISO(thaiDateStr) {
    if (!thaiDateStr) return '';
    const parts = thaiDateStr.trim().split(/\s+/);
    if (parts.length < 3) return '';
    const day = parseInt(parts[0], 10);
    const monthIdx = THAI_MONTHS_SHORT.indexOf(parts[1]);
    const yearBE = parseInt(parts[2], 10);
    if (isNaN(day) || monthIdx === -1 || isNaN(yearBE)) return '';
    const yearCE = yearBE - 543;
    const yStr = String(yearCE).padStart(4, '0');
    const mStr = String(monthIdx + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
}

/** Convert ISO date "2003-01-15" to Thai date string "15 ม.ค. 2546" */
export function isoToThaiDate(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = isoDateStr.split('-');
    if (parts.length < 3) return isoDateStr;
    const yearCE = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(yearCE) || isNaN(month) || isNaN(day)) return isoDateStr;
    const yearBE = yearCE + 543;
    const monthName = THAI_MONTHS_SHORT[month - 1] || '';
    return `${day} ${monthName} ${yearBE}`;
}

/* ============================================================
   BIBLIOGRAPHY — View / Edit Mode
   ============================================================ */
export function renderBibliography(s) {
    const container = document.getElementById('bibliographyContent');
    if (!container) return;

    function renderViewMode() {
        const avatarHTML = s.avatar
            ? `<img src="${s.avatar}" alt="${esc(s.nameTh)}" class="profile-avatar-img" id="profileAvatarImg">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        container.innerHTML = `
        <div class="card profile-hero-card">
            <div class="profile-hero-top">
                <div class="profile-avatar-block">
                    <div class="profile-avatar-wrap" id="avatarWrap" title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์">
                        ${avatarHTML}
                        <label class="avatar-upload-overlay" for="directAvatarFile">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            <span>เปลี่ยนรูป</span>
                        </label>
                        <input type="file" id="directAvatarFile" accept="image/png, image/jpeg, image/webp" style="display:none">
                    </div>
                    <div class="profile-avatar-actions">
                        <label class="btn btn-xs btn-ghost profile-avatar-btn" for="directAvatarFile">
                            📷 เปลี่ยนรูป
                        </label>
                        ${s.avatar ? `<button class="btn btn-xs btn-ghost profile-avatar-btn text-danger" id="directRemoveAvatarBtn" title="รีเซ็ตรูปโปรไฟล์">🗑️ ลบรูป</button>` : ''}
                    </div>
                </div>

                <div class="profile-headline">
                    <div class="profile-name">${esc(s.nameTh)}</div>
                    <div class="profile-id-badge">
                        <span class="id-tag">รหัส ${esc(s.studentId)}</span>
                        <span class="id-divider">•</span>
                        <span class="name-en">${esc(s.nameEn)}</span>
                    </div>
                    <div class="profile-chips">
                        <span class="badge badge-green"><span class="badge-dot"></span>${esc(s.status)}</span>
                        <span class="profile-chip">ชั้นปีที่ ${s.year}</span>
                        <span class="profile-chip">เข้าศึกษาปี ${s.admitYear}</span>
                        ${s.studentSection ? `<span class="profile-chip" title="Sec ตอนแรกเข้า ใช้อ้างอิงเท่านั้น Sec ของแต่ละวิชาดูในตารางเรียน">Sec แรกเข้า ${esc(s.studentSection)}</span>` : ''}
                    </div>
                    <button class="btn btn-sm btn-orange profile-edit-btn" id="bioEditBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        แก้ไขข้อมูลส่วนตัว
                    </button>
                </div>
            </div>

            <!-- Profile Info Sections Grid -->
            <div class="profile-sections-container">
                <!-- Section 1: ข้อมูลการศึกษา -->
                <div class="profile-section-box">
                    <div class="profile-section-title">
                        <div class="pst-icon">🎓</div>
                        <span>ข้อมูลด้านการศึกษา</span>
                    </div>
                    <div class="profile-rows-list">
                        <div class="p-row">
                            <span class="p-label">คณะ</span>
                            <span class="p-val">${esc(s.faculty)}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">สาขาวิชา</span>
                            <span class="p-val">${esc(s.department)}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">ชั้นปี</span>
                            <span class="p-val">ปี ${s.year}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">สถานภาพ</span>
                            <span class="p-val"><span class="badge badge-green">${esc(s.status)}</span></span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">อาจารย์ที่ปรึกษา</span>
                            <span class="p-val p-advisor">${esc(s.advisor)}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">ปีที่เข้าศึกษา</span>
                            <span class="p-val">${s.admitYear}</span>
                        </div>
                    </div>
                </div>

                <!-- Section 2: ข้อมูลส่วนตัวและการติดต่อ -->
                <div class="profile-section-box">
                    <div class="profile-section-title">
                        <div class="pst-icon">👤</div>
                        <span>ข้อมูลส่วนตัวและการติดต่อ</span>
                    </div>
                    <div class="profile-rows-list">
                        <div class="p-row">
                            <span class="p-label">วันเกิด</span>
                            <span class="p-val">${esc(s.birthDate)}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">ศาสนา</span>
                            <span class="p-val">${esc(s.religion || 'พุทธ')}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">อีเมล</span>
                            <a href="mailto:${esc(s.email)}" class="p-val p-link">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                ${esc(s.email)}
                            </a>
                        </div>
                        <div class="p-row">
                            <span class="p-label">โทรศัพท์</span>
                            <a href="tel:${esc(s.phone)}" class="p-val p-link">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                ${esc(s.phone)}
                            </a>
                        </div>
                        <div class="p-row p-row-address">
                            <span class="p-label">ที่อยู่ปัจจุบัน</span>
                            <div class="p-val-address">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--brand-500);flex-shrink:0;margin-top:2px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                                <span>${esc(s.address)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 3: ข้อมูลสายอาชีพและภาวะการมีงานทำ -->
                <div class="profile-section-box" style="border-left:3px solid var(--primary)">
                    <div class="profile-section-title" style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:6px">
                            <div class="pst-icon">💼</div>
                            <span>ข้อมูลสายอาชีพและภาวะการมีงานทำ</span>
                        </div>
                        <button class="btn btn-xs btn-outline" id="bioCareerEditBtn" style="font-size:0.78rem">
                            ✏️ อัปเดต
                        </button>
                    </div>
                    <div class="profile-rows-list">
                        <div class="p-row">
                            <span class="p-label">สถานะการทำงาน</span>
                            <span class="p-val">${esc(s.employmentStatus || (s.careerPath ? 'ทำงานตรงสาย (IT & CS)' : 'ยังไม่ได้ระบุ'))}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">สายอาชีพหลัก</span>
                            <span class="p-val" style="font-weight:700;color:var(--primary)">${esc(s.careerPath || 'ยังไม่ได้ระบุ')}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">สถานที่ทำงาน</span>
                            <span class="p-val">${esc(s.companyName || '-')}</span>
                        </div>
                        <div class="p-row">
                            <span class="p-label">ช่วงเงินเดือน</span>
                            <span class="p-val">${esc(s.salaryRange || '-')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">🎓</div><div><div class="stat-value">${s.gpa.toFixed(2)}</div><div class="stat-label">GPA สะสม</div></div></div>
            <div class="stat-card"><div class="stat-icon green">📚</div><div><div class="stat-value">${s.credits}</div><div class="stat-label">หน่วยกิตสะสม</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">📅</div><div><div class="stat-value">ปี ${s.year}</div><div class="stat-label">ชั้นปีปัจจุบัน</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">📖</div><div><div class="stat-value">${s.currentCourses ?? 6}</div><div class="stat-label">วิชาที่ลงเรียน</div></div></div>
        </div>`;

        document.getElementById('bioEditBtn').addEventListener('click', renderEditMode);
        document.getElementById('bioCareerEditBtn')?.addEventListener('click', () => openStudentCareerModal(s, () => renderBibliography(s)));

        // Direct Avatar File Upload
        document.getElementById('directAvatarFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showPetitionToast('error', '⚠️ กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, WebP)');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                showPetitionToast('error', '⚠️ ขนาดไฟล์รูปภาพเกิน 2MB กรุณาเลือกรูปภาพที่มีขนาดเล็กลง');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                studentEditableData[s.studentId].avatar = dataUrl;
                try {
                    localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
                } catch (err) {}
                updateTopbarAvatar(dataUrl);
                showPetitionToast('success', 'เปลี่ยนรูปโปรไฟล์สำเร็จแล้ว ✅');
                s.avatar = dataUrl;
                renderViewMode();
            };
            reader.readAsDataURL(file);
        });

        // Direct Avatar Removal / Reset
        document.getElementById('directRemoveAvatarBtn')?.addEventListener('click', () => {
            studentEditableData[s.studentId].avatar = null;
            try {
                localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
            } catch (err) {}
            updateTopbarAvatar(null);
            showPetitionToast('info', 'รีเซ็ตรูปโปรไฟล์เป็นค่าเริ่มต้นเรียบร้อยแล้ว');
            s.avatar = null;
            renderViewMode();
        });
    }

    function renderEditMode() {
        const religions = ['พุทธ', 'อิสลาม', 'คริสต์', 'ฮินดู', 'ซิกข์', 'อื่นๆ / ไม่ระบุ'];
        const relOpts = religions.map(r => `<option value="${r}" ${s.religion === r ? 'selected' : ''}>${r}</option>`).join('');
        const birthDateISO = thaiDateToISO(s.birthDate);
        const todayISO = new Date().toISOString().split('T')[0];

        const avatarHTML = s.avatar
            ? `<img src="${s.avatar}" alt="${esc(s.nameTh)}" class="profile-avatar-img">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        container.innerHTML = `
        <div class="card app-form-panel" style="margin-bottom:0">
            <div class="app-form-header">
                <div>
                    <div class="app-form-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        แก้ไขข้อมูลส่วนตัวนักศึกษา (Edit Profile)
                    </div>
                    <div class="app-form-subtitle">ปรับปรุงข้อมูลติดต่อและข้อมูลทั่วไปของคุณ</div>
                </div>
            </div>

            <!-- Profile Picture Section inside Edit Form -->
            <div style="display:flex;gap:16px;align-items:center;background:var(--g-50);padding:14px 18px;border-radius:var(--radius-md);border:1px solid var(--g-200);margin-bottom:20px;flex-wrap:wrap">
                <div class="profile-avatar-wrap" style="width:76px;height:76px;border-radius:50%" id="editFormAvatarWrap">
                    ${avatarHTML}
                </div>
                <div style="flex:1;min-width:200px">
                    <div style="font-weight:700;font-size:0.85rem;color:var(--g-800);margin-bottom:2px">รูปภาพโปรไฟล์ (Profile Picture)</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">รองรับไฟล์ JPG, PNG, WebP ขนาดไม่เกิน 2MB</div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <label class="btn btn-sm btn-outline" for="editFormAvatarInput" style="cursor:pointer;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px">
                            📁 เลือกรูปใหม่
                        </label>
                        <input type="file" id="editFormAvatarInput" accept="image/png, image/jpeg, image/webp" style="display:none">
                        ${s.avatar ? `<button type="button" class="btn btn-sm btn-ghost" id="editFormRemoveAvatarBtn" style="color:var(--red-600);font-size:0.8rem">🗑️ ลบรูปโปรไฟล์</button>` : ''}
                    </div>
                </div>
            </div>

            <div class="app-form-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ชื่อ-สกุล (ภาษาไทย) <span class="req">*</span>
                    </label>
                    <input type="text" class="app-input" id="bioNameTh" value="${esc(s.nameTh)}" placeholder="เช่น สมชาย ใจดี">
                    <span style="font-size:0.72rem;color:var(--text-muted)">เฉพาะตัวอักษรภาษาไทย</span>
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        ชื่อ-สกุล (English) <span class="req">*</span>
                    </label>
                    <input type="text" class="app-input" id="bioNameEn" value="${esc(s.nameEn)}" placeholder="e.g. Somchai Jaidee">
                    <span style="font-size:0.72rem;color:var(--text-muted)">เฉพาะตัวอักษรภาษาอังกฤษ (A-Z, a-z)</span>
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        Email <span class="req">*</span>
                    </label>
                    <input type="email" class="app-input" id="bioEmail" value="${esc(s.email)}" placeholder="username@bsru.ac.th">
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        หมายเลขโทรศัพท์ <span class="req">*</span>
                    </label>
                    <input type="tel" class="app-input" id="bioPhone" value="${esc(s.phone)}" maxlength="10" placeholder="08xxxxxxxx" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
                    <span style="font-size:0.72rem;color:var(--text-muted)">ตัวเลข 10 หลัก (เช่น 0812345678)</span>
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        วันเกิด (เลือกจากปฏิทิน)
                    </label>
                    <input type="date" class="app-input" id="bioBirthDate" value="${birthDateISO}" max="${todayISO}">
                </div>
                <div class="app-form-group">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                        ศาสนา
                    </label>
                    <select class="app-select" id="bioReligion">${relOpts}</select>
                </div>
                <div class="app-form-group" style="grid-column: 1 / -1">
                    <label class="app-form-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        ที่อยู่ปัจจุบัน
                    </label>
                    <textarea class="app-textarea" id="bioAddress" rows="2" placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์">${esc(s.address)}</textarea>
                </div>
            </div>

            <!-- Read-only fields info -->
            <div style="margin-top:18px;padding:14px 18px;background:rgba(31,71,133,0.04);border-radius:var(--radius-lg);border:1px solid var(--brand-100)">
                <div style="font-size:0.8rem;font-weight:700;color:var(--brand-700);margin-bottom:8px;display:flex;align-items:center;gap:6px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    ข้อมูลที่จัดการโดยระบบ (Read-only System Fields)
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:6px 16px;font-size:0.82rem;color:var(--g-700)">
                    <span>📌 รหัสนักศึกษา: <strong>${esc(s.studentId)}</strong></span>
                    <span>📌 คณะ: <strong>${esc(s.faculty)}</strong></span>
                    <span>📌 สาขา: <strong>${esc(s.department)}</strong></span>
                    <span>📌 ชั้นปี: <strong>ปี ${s.year}</strong></span>
                    <span>📌 สถานภาพ: <strong>${esc(s.status)}</strong></span>
                    <span>📌 อาจารย์ที่ปรึกษา: <strong>${esc(s.advisor)}</strong></span>
                    <span>📌 ปีเข้าศึกษา: <strong>${s.admitYear}</strong></span>
                </div>
            </div>

            <div class="app-form-actions">
                <button class="app-btn-primary" id="bioSaveBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    บันทึกข้อมูล
                </button>
                <button class="app-btn-ghost" id="bioCancelBtn">ยกเลิก</button>
            </div>
        </div>`;

        // Real-time error clearing on input
        ['bioNameTh', 'bioNameEn', 'bioEmail', 'bioPhone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => el.classList.remove('is-invalid'));
        });

        // Edit form avatar upload
        document.getElementById('editFormAvatarInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showPetitionToast('error', '⚠️ กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, WebP)');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                showPetitionToast('error', '⚠️ ขนาดไฟล์รูปภาพเกิน 2MB กรุณาเลือกรูปภาพที่มีขนาดเล็กลง');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                studentEditableData[s.studentId].avatar = dataUrl;
                try {
                    localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
                } catch (err) {}
                updateTopbarAvatar(dataUrl);
                s.avatar = dataUrl;
                const wrap = document.getElementById('editFormAvatarWrap');
                if (wrap) wrap.innerHTML = `<img src="${dataUrl}" class="profile-avatar-img" alt="Preview">`;
                showPetitionToast('success', 'อัปเดตรูปภาพโปรไฟล์เรียบร้อยแล้ว ✅');
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('editFormRemoveAvatarBtn')?.addEventListener('click', () => {
            studentEditableData[s.studentId].avatar = null;
            try {
                localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
            } catch (err) {}
            updateTopbarAvatar(null);
            s.avatar = null;
            const wrap = document.getElementById('editFormAvatarWrap');
            if (wrap) wrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            showPetitionToast('info', 'รีเซ็ตรูปโปรไฟล์แล้ว');
        });

        document.getElementById('bioCancelBtn').addEventListener('click', renderViewMode);
        document.getElementById('bioSaveBtn').addEventListener('click', async () => {
            const elNameTh = document.getElementById('bioNameTh');
            const elNameEn = document.getElementById('bioNameEn');
            const elEmail = document.getElementById('bioEmail');
            const elPhone = document.getElementById('bioPhone');
            const elBirthDate = document.getElementById('bioBirthDate');
            const elReligion = document.getElementById('bioReligion');
            const elAddress = document.getElementById('bioAddress');

            const nameTh = elNameTh.value.trim();
            const nameEn = elNameEn.value.trim();
            const email = elEmail.value.trim();
            const phone = elPhone.value.trim();
            const birthDateISO = elBirthDate.value;
            const religion = elReligion.value.trim();
            const address = elAddress.value.trim();

            // Clear previous errors
            [elNameTh, elNameEn, elEmail, elPhone].forEach(el => el.classList.remove('is-invalid'));

            // 1. Required fields check
            let hasError = false;
            if (!nameTh) { elNameTh.classList.add('is-invalid'); hasError = true; }
            if (!nameEn) { elNameEn.classList.add('is-invalid'); hasError = true; }
            if (!email) { elEmail.classList.add('is-invalid'); hasError = true; }
            if (!phone) { elPhone.classList.add('is-invalid'); hasError = true; }

            if (hasError) {
                showPetitionToast('error', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
                return;
            }

            // 2. Thai Name Validation
            const thaiRegex = /^[\u0E00-\u0E7F\s.]+$/;
            if (!thaiRegex.test(nameTh)) {
                elNameTh.classList.add('is-invalid');
                showPetitionToast('error', '⚠️ ชื่อ-สกุล (ภาษาไทย) ต้องเป็นตัวอักษรภาษาไทยเท่านั้น');
                elNameTh.focus();
                return;
            }

            // 3. English Name Validation
            const engRegex = /^[A-Za-z\s.]+$/;
            if (!engRegex.test(nameEn)) {
                elNameEn.classList.add('is-invalid');
                showPetitionToast('error', '⚠️ ชื่อ-สกุล (English) ต้องเป็นตัวอักษรภาษาอังกฤษเท่านั้น');
                elNameEn.focus();
                return;
            }

            // 4. Phone Number Validation
            const phoneRegex = /^0[0-9]{9}$/;
            if (!phoneRegex.test(phone)) {
                elPhone.classList.add('is-invalid');
                showPetitionToast('error', '⚠️ หมายเลขโทรศัพท์ต้องเป็นตัวเลข 10 หลัก (ขึ้นต้นด้วย 0 เช่น 0812345678)');
                elPhone.focus();
                return;
            }

            // 5. Convert birthDate from calendar picker to Thai format
            let formattedBirthDate = s.birthDate;
            if (birthDateISO) {
                formattedBirthDate = isoToThaiDate(birthDateISO);
            }

            if (s.fromDb) {
                try {
                    const saved = await fetchAPI(`/students/${encodeURIComponent(s.studentId)}/profile`, 'PUT', {
                        nameTh, nameEn, email, phone, birthDate: birthDateISO || null, religion, address,
                    }, 10000);
                    applyDbProfile(s, saved, { summary: { totalEarnedCredits: s.credits } }, null);
                } catch (err) {
                    showPetitionToast('error', esc(apiErrorMessage(err)));
                    return;
                }
                showPetitionToast('success', 'บันทึกข้อมูลส่วนตัวลงฐานข้อมูลเรียบร้อยแล้ว ✅');
                renderViewMode();
                return;
            }

            // Update base data in pool
            const poolEntry = MOCK_STUDENTS_POOL.find(st => st.studentId === s.studentId);
            if (poolEntry) {
                poolEntry.nameTh = nameTh;
                poolEntry.nameEn = nameEn;
            }

            // Update editable store (preserving avatar)
            studentEditableData[s.studentId] = {
                ...studentEditableData[s.studentId],
                email,
                phone,
                birthDate: formattedBirthDate,
                religion,
                address
            };
            try {
                localStorage.setItem('studentEditableData_' + s.studentId, JSON.stringify(studentEditableData[s.studentId]));
            } catch (err) {}

            // Refresh student object and re-render
            const updated = getStudentFullData(s.studentId);
            s = updated;
            showPetitionToast('success', 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว ✅');
            renderViewMode();
        });
    }

    renderViewMode();
}
