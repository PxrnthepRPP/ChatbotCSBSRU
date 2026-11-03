/* ============================================================
   BSRU Student Portal — Student Petitions View & Upload
   ============================================================ */

import { esc, statusBadge, showToast, petitionStatus } from '../../utils.js';
import { fetchAPI, uploadFileAPI, viewPdfAttachmentAPI } from '../../api.js';
import { MOCK_PETITIONS_LOG } from '../admin.js';

// Ensure window.viewPdfAttachment is available for inline onclick
if (typeof window !== 'undefined' && !window.viewPdfAttachment) {
    window.viewPdfAttachment = viewPdfAttachmentAPI;
}

/* ============================================================
   PETITION — Toast Notification
   ============================================================ */
export function showPetitionToast(type, message) {
    // Remove existing toast
    const existing = document.querySelector('.petition-toast');
    if (existing) existing.remove();

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `petition-toast petition-toast-${type}`;
    toast.innerHTML = `
        <div class="petition-toast-icon">${icons[type] || icons.info}</div>
        <span class="petition-toast-msg">${message}</span>
        <button class="petition-toast-close" aria-label="ปิด">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Close button
    toast.querySelector('.petition-toast-close').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    });

    // Auto dismiss after 5s
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

/* ============================================================
   PETITION — Mock API Call
   ============================================================ */
export function mockPetitionSubmit(data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate 90% success rate
            const success = Math.random() > 0.1;
            if (success) {
                const petitionId = 'PET-' + new Date().getFullYear() + '-' + String(Math.floor(100 + Math.random() * 900));
                resolve({ success: true, petitionId, message: 'Petition submitted successfully' });
            } else {
                resolve({ success: false, message: 'เซิร์ฟเวอร์ไม่สามารถประมวลผลคำร้องได้ในขณะนี้' });
            }
        }, 1500); // Simulate network delay
    });
}

/* ============================================================
   ACADEMIC PETITIONS VIEW
   ============================================================ */
export async function renderPetitions(student) {
    const container = document.getElementById('petitionsContent');
    if (!container) return;

    let displayList = [];
    try {
        const liveList = await fetchAPI('/petitions');
        if (Array.isArray(liveList)) {
            displayList = liveList.map(p => ({ ...p, status: petitionStatus(p.status) }));
        }
    } catch (err) {
        console.warn('Backend petitions unavailable, falling back to mock:', err);
    }

    if (displayList.length === 0) {
        const myPetitions = MOCK_PETITIONS_LOG.filter(p => p.studentId === student.studentId);
        displayList = myPetitions.length > 0 ? myPetitions : MOCK_PETITIONS_LOG.slice(0, 3);
    }

    const historyCards = displayList.map(p => {
        const pid = p.id || '';
        const hasAttachment = Boolean(p.attachment || p.attachmentPath || p.attachmentName);
        const fileName = p.attachmentName || p.attachment || 'เอกสารแนบ.pdf';

        return `
        <div class="petition-history-card">
            <div class="petition-history-top">
                <span class="petition-history-id">${esc(pid)}</span>
                <span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span>
            </div>
            <div class="petition-history-type">${esc(p.type)}</div>
            <div class="petition-history-title">${esc(p.title)}</div>
            ${p.details ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${esc(p.details)}</div>` : ''}

            ${p.advisorComment ? `
                <div style="font-size:0.78rem;background:var(--brand-50, #eff6ff);padding:6px 10px;border-radius:var(--radius-sm);color:var(--brand-700, #1d4ed8);margin-bottom:6px;border-left:3px solid #3b82f6">
                    👨‍🏫 <strong>ความเห็นอาจารย์ที่ปรึกษา:</strong> ${esc(p.advisorComment)}
                    ${p.advisorReviewedAt ? `<span style="font-size:0.72rem;color:var(--text-muted);margin-left:6px">(${esc(String(p.advisorReviewedAt).substring(0, 16))})</span>` : ''}
                </div>
            ` : ''}

            ${p.adminComment ? `
                <div style="font-size:0.78rem;background:#fef3c7;padding:6px 10px;border-radius:var(--radius-sm);color:#92400e;margin-bottom:6px;border-left:3px solid #f59e0b">
                    🛡️ <strong>ความเห็นผู้ดูแลระบบ:</strong> ${esc(p.adminComment)}
                    ${p.adminReviewedAt ? `<span style="font-size:0.72rem;color:var(--text-muted);margin-left:6px">(${esc(String(p.adminReviewedAt).substring(0, 16))})</span>` : ''}
                </div>
            ` : ''}

            <div class="petition-history-date" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
                <div style="display:flex;align-items:center;gap:4px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>${esc(String(p.submittedAt || '').substring(0, 16))}</span>
                </div>
                ${hasAttachment ? `
                    <button type="button" class="btn btn-xs btn-outline" style="margin-left:auto;font-size:0.75rem;padding:2px 8px;cursor:pointer;" onclick="window.viewPdfAttachment('${esc(pid)}')">
                        📎 ดูไฟล์ PDF (${esc(fileName)})
                    </button>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');

    const pendingCount = displayList.filter(p => p.status === 'รออาจารย์ที่ปรึกษาพิจารณา' || p.status === 'รอดำเนินการ' || p.status === 'รอผู้ดูแลระบบอนุมัติ').length;
    const approvedCount = displayList.filter(p => p.status === 'อนุมัติ').length;

    container.innerHTML = `
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">📝</div><div><div class="stat-value">${displayList.length}</div><div class="stat-label">คำร้องของคุณ</div></div></div>
            <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${approvedCount}</div><div class="stat-label">อนุมัติแล้ว</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">⏳</div><div><div class="stat-value">${pendingCount}</div><div class="stat-label">รอดำเนินการ/พิจารณา</div></div></div>
        </div>

        <div class="card petition-form-card">
            <div class="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <path d="M12 18v-6"/><path d="M9 15h6"/>
                </svg>
                ยื่นคำร้องใหม่ <span class="header-en">Submit New Petition</span>
            </div>
            <p class="petition-form-desc">กรอกรายละเอียดคำร้องวิชาการของคุณด้านล่าง ไฟล์แนบรองรับเฉพาะ .pdf ขนาดไม่เกิน 5 MB</p>

            <form id="petitionForm" class="petition-form" autocomplete="off">
                <div class="petition-form-grid">
                    <div class="petition-field">
                        <label for="petitionType">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                            ประเภทคำร้อง <span class="field-required">*</span>
                        </label>
                        <select id="petitionType" name="petitionType" required>
                            <option value="" disabled selected>— เลือกประเภทคำร้อง —</option>
                            <option value="proposal-defense">ยื่นขอสอบหัวข้อโปรเจคจบ (Proposal Defense Request)</option>
                            <option value="final-defense">ยื่นสอบจบปริญญานิพนธ์ (Final Defense Request)</option>
                            <option value="general">คำร้องทั่วไป (General Petition)</option>
                        </select>
                    </div>

                    <div class="petition-field">
                        <label for="petitionTitle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            ชื่อหัวข้อ / Project Title <span class="field-required">*</span>
                        </label>
                        <input type="text" id="petitionTitle" name="projectTitle" placeholder="ระบุชื่อหัวข้อโปรเจคหรือชื่อเรื่องคำร้อง" required />
                    </div>
                </div>

                <div class="petition-field">
                    <label for="petitionDetails">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        รายละเอียดเพิ่มเติม / เหตุผล
                    </label>
                    <textarea id="petitionDetails" name="details" rows="4" placeholder="อธิบายรายละเอียดหรือเหตุผลประกอบคำร้อง..."></textarea>
                </div>

                <div class="petition-field">
                    <label for="petitionFile">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                        แนบไฟล์ (PDF เท่านั้น ขนาดไม่เกิน 5MB)
                    </label>
                    <div class="petition-file-upload" id="petitionFileDropZone">
                        <input type="file" id="petitionFile" name="attachment" accept=".pdf" />
                        <div class="petition-file-placeholder" id="petitionFilePlaceholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span>คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</span>
                            <small>รองรับเฉพาะ .pdf ขนาดไม่เกิน 5 MB</small>
                        </div>
                        <div class="petition-file-selected" id="petitionFileSelected" style="display:none">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span id="petitionFileName">file.pdf</span>
                            <button type="button" class="petition-file-remove" id="petitionFileRemove" aria-label="ลบไฟล์">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="petition-form-actions">
                    <button type="reset" class="btn btn-ghost">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                        ล้างฟอร์ม
                    </button>
                    <button type="submit" class="btn btn-primary btn-submit-petition" id="petitionSubmitBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        ยื่นคำร้อง
                    </button>
                </div>
            </form>
        </div>

        <div class="card">
            <div class="card-title">📋 ประวัติคำร้องที่ผ่านมา <span class="header-en">Petition History</span></div>
            <div class="petition-history-list">
                ${historyCards}
            </div>
        </div>
    `;

    // ── File input UX enhancement ──
    const fileInput = document.getElementById('petitionFile');
    const placeholder = document.getElementById('petitionFilePlaceholder');
    const selectedUI = document.getElementById('petitionFileSelected');
    const fileNameSpan = document.getElementById('petitionFileName');
    const removeBtn = document.getElementById('petitionFileRemove');
    const dropZone = document.getElementById('petitionFileDropZone');

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameSpan.textContent = fileInput.files[0].name;
            placeholder.style.display = 'none';
            selectedUI.style.display = 'flex';
        }
    });

    removeBtn.addEventListener('click', () => {
        fileInput.value = '';
        placeholder.style.display = 'flex';
        selectedUI.style.display = 'none';
    });

    // Drag-and-drop visual feedback
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
                fileInput.files = e.dataTransfer.files;
                fileNameSpan.textContent = file.name;
                placeholder.style.display = 'none';
                selectedUI.style.display = 'flex';
            } else {
                showPetitionToast('error', '⚠️ รองรับเฉพาะไฟล์ PDF เท่านั้น');
            }
        }
    });

    // ── Form Submission (Real Spring Boot 2-Step REST API Integration) ──
    const form = document.getElementById('petitionForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('petitionSubmitBtn');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="petition-spinner"></span> กำลังส่งคำร้อง...`;

        const file = fileInput.files[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
                showPetitionToast('error', '⚠️ รองรับเฉพาะไฟล์ PDF เท่านั้น');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHTML;
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showPetitionToast('error', '⚠️ ขนาดไฟล์ PDF เกิน 5MB กรุณาเลือกไฟล์ที่มีขนาดเล็กลง');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHTML;
                return;
            }
        }

        const typeMap = {
            'proposal-defense': 'ยื่นขอสอบหัวข้อโปรเจคจบ',
            'final-defense': 'ยื่นสอบจบปริญญานิพนธ์',
            'general': 'คำร้องทั่วไป',
        };

        const petitionPayload = {
            type: typeMap[form.petitionType.value] || form.petitionType.value,
            title: form.projectTitle.value.trim(),
            details: form.details.value.trim(),
            attachment: file ? file.name : null,
            studentId: student.studentId || '6421100042',
        };

        try {
            console.log('📤 [Student] Submitting Academic Petition to Spring Boot Backend...', petitionPayload);
            const savedPetition = await fetchAPI('/petitions', 'POST', petitionPayload);
            console.log('✅ [Student] Petition Saved Successfully:', savedPetition);

            // Step 2: Upload attachment binary if file selected
            if (file && savedPetition && savedPetition.id) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('attachment', file);
                await uploadFileAPI(`/petitions/${encodeURIComponent(savedPetition.id)}/attachment`, formData);
            }

            showPetitionToast('success', `คำร้อง ${savedPetition.id} ถูกบันทึกและส่งเรียบร้อยแล้ว ✅`);
            form.reset();
            fileInput.value = '';
            placeholder.style.display = 'flex';
            selectedUI.style.display = 'none';
            await renderPetitions(student);
        } catch (err) {
            console.error('❌ [Student] Failed to submit petition to Backend:', err);
            showPetitionToast('error', `ไม่สามารถส่งคำร้องได้: ${err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ'}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
        }
    });
}
