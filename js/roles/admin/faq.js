/* ============================================================
   BSRU Student Portal — Admin: Frequently asked questions (FAQ)
   - add / edit / delete, categories, on/off per question
   - "answer exactly": a close match gets the answer word for word; otherwise the AI uses it as reference
   - try a question the way the chatbot matches it, CSV import / export, hit counts
   ============================================================ */

import { confirmDialog } from '../../components/confirmDialog.js';
import { esc, showToast } from '../../utils.js';
import { fetchAPI, API_BASE_URL } from '../../api.js';
import { loadComponentCSS } from '../../css-loader.js';
import { apiErrorText } from './shared.js';
import { attachFormDraft } from '../../components/formDraft.js';

let faqs = [];
let faqCategory = 'all';
let faqSearch = '';
let faqLoaded = false;

const DATE = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const when = iso => iso ? DATE.format(new Date(iso)) : '-';

export async function renderFaqManagement() {
    const container = document.getElementById('manageFaqContent');
    if (!container) return;
    loadComponentCSS('faqInsights');
    if (!faqLoaded) {
        container.innerHTML = '<div class="card"><p style="color:var(--text-muted)">กำลังโหลดคำถามที่พบบ่อย...</p></div>';
        await loadFaqs();
    }
    draw(container);
}

async function loadFaqs() {
    try {
        faqs = await fetchAPI('/admin/faqs', 'GET', null, 10000) || [];
        faqLoaded = true;
    } catch (err) {
        faqs = [];
        showToast('error', esc('โหลดคำถามที่พบบ่อยไม่สำเร็จ: ' + apiErrorText(err)));
    }
}

function draw(container) {
    const categories = [...new Set(faqs.map(f => f.category || 'ทั่วไป'))].sort((a, b) => a.localeCompare(b, 'th'));
    if (faqCategory !== 'all' && !categories.includes(faqCategory)) faqCategory = 'all';
    const q = faqSearch.trim().toLowerCase();
    const shown = faqs.filter(f => (faqCategory === 'all' || (f.category || 'ทั่วไป') === faqCategory)
        && (!q || [f.question, f.alternatives, f.answer].some(t => (t || '').toLowerCase().includes(q))));
    const active = faqs.filter(f => f.active).length;
    const hits = faqs.reduce((s, f) => s + (f.hitCount || 0), 0);

    const rows = shown.map(f => `
        <tr data-id="${f.id}" class="${f.active ? '' : 'faq-off'}">
            <td><span class="badge badge-purple">${esc(f.category || 'ทั่วไป')}</span></td>
            <td>
                <strong>${esc(f.question)}</strong>
                ${f.alternatives ? `<div class="faq-alt">หรือ: ${esc(f.alternatives.split('\n').join(' · '))}</div>` : ''}
                <div class="faq-answer-preview">${esc(f.answer)}</div>
            </td>
            <td>${f.exactAnswer ? '<span class="badge badge-blue" title="ถ้าคำถามตรงมาก ส่งคำตอบนี้เป๊ะ ๆ">ตอบตามนี้</span>' : '<span class="badge badge-amber" title="ให้ AI เรียบเรียงจากคำตอบนี้">AI เรียบเรียง</span>'}</td>
            <td style="text-align:center">${f.hitCount || 0}<div class="faq-alt">${f.lastHitAt ? esc(when(f.lastHitAt)) : ''}</div></td>
            <td>
                <label class="faq-switch" title="${f.active ? 'เปิดใช้อยู่' : 'ปิดอยู่'}">
                    <input type="checkbox" class="faq-toggle" ${f.active ? 'checked' : ''} aria-label="เปิดใช้ ${esc(f.question)}">
                    <span>${f.active ? 'เปิด' : 'ปิด'}</span>
                </label>
            </td>
            <td style="white-space:nowrap">
                <button type="button" class="btn btn-sm btn-warning faq-edit">แก้ไข</button>
                <button type="button" class="btn btn-sm btn-danger faq-delete">ลบ</button>
            </td>
        </tr>`).join('');

    container.innerHTML = `
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">❓</div><div><div class="stat-value">${faqs.length}</div><div class="stat-label">คำถามทั้งหมด</div></div></div>
            <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${active}</div><div class="stat-label">เปิดใช้อยู่</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">📂</div><div><div class="stat-value">${categories.length}</div><div class="stat-label">หมวด</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">💬</div><div><div class="stat-value">${hits}</div><div class="stat-label">ครั้งที่ใช้ตอบแชท</div></div></div>
        </div>

        <div class="card">
            <div class="card-title">🔎 ลองถามดูว่าแชทบอทจะจับคู่กับ FAQ ข้อไหน</div>
            <div class="faq-test-bar">
                <input type="text" id="faqTestInput" class="ci-input" placeholder="พิมพ์คำถามแบบที่ผู้ใช้ถาม เช่น ลงทะเบียนเรียนได้ถึงวันไหน" aria-label="คำถามทดสอบ">
                <button type="button" class="btn btn-sm btn-orange" id="faqTestBtn">ทดสอบ</button>
            </div>
            <div id="faqTestResult" class="faq-test-result"></div>
            <p class="faq-hint">ความใกล้เคียง 80% ขึ้นไป + "ตอบตามนี้" = ส่งคำตอบเป๊ะ ๆ · 45–79% หรือ "AI เรียบเรียง" = ให้ AI ใช้เป็นข้อมูลอ้างอิงตอบ · ต่ำกว่า 45% = ไม่ใช้</p>
        </div>

        <div class="card">
            <div class="toolbar">
                <div class="card-title" style="margin-bottom:0">❓ คำถามที่พบบ่อย (FAQ)</div>
                <select class="batch-select" id="faqCategoryFilter" aria-label="กรองตามหมวด">
                    <option value="all">ทุกหมวด (${faqs.length})</option>
                    ${categories.map(c => `<option value="${esc(c)}" ${c === faqCategory ? 'selected' : ''}>${esc(c)} (${faqs.filter(f => (f.category || 'ทั่วไป') === c).length})</option>`).join('')}
                </select>
                <div class="toolbar-search">
                    <input type="text" id="faqSearch" placeholder="ค้นหาคำถาม/คำตอบ..." value="${esc(faqSearch)}" aria-label="ค้นหาคำถามที่พบบ่อย">
                </div>
                <button type="button" class="btn btn-success" id="faqAddBtn">+ เพิ่มคำถาม</button>
                <button type="button" class="btn btn-primary" id="faqExportBtn">ส่งออก CSV</button>
                <button type="button" class="btn btn-secondary" id="faqImportBtn">นำเข้า CSV</button>
                <input type="file" id="faqImportInput" accept=".csv,text/csv" hidden>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>หมวด</th><th>คำถาม / คำตอบ</th><th>วิธีตอบ</th><th style="text-align:center">ใช้ตอบ (ครั้ง)</th><th>สถานะ</th><th></th></tr></thead>
                    <tbody>${rows || `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-muted)">${faqs.length ? 'ไม่พบคำถามที่ตรงกับการค้นหา' : 'ยังไม่มีคำถามที่พบบ่อย กด "+ เพิ่มคำถาม" หรือ "นำเข้า CSV"'}</td></tr>`}</tbody>
                </table>
            </div>
        </div>`;

    container.querySelector('#faqCategoryFilter').addEventListener('change', e => { faqCategory = e.target.value; draw(container); });
    const search = container.querySelector('#faqSearch');
    let t;
    search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
            faqSearch = search.value;
            draw(container);
            const again = container.querySelector('#faqSearch');
            again.focus();
            again.setSelectionRange(again.value.length, again.value.length);
        }, 300);
    });
    container.querySelector('#faqAddBtn').addEventListener('click', () => openFaqEditor());
    container.querySelector('#faqExportBtn').addEventListener('click', exportCsv);
    const fileInput = container.querySelector('#faqImportInput');
    container.querySelector('#faqImportBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => importCsv(fileInput));
    container.querySelector('#faqTestBtn').addEventListener('click', runTest);
    container.querySelector('#faqTestInput').addEventListener('keydown', e => { if (e.key === 'Enter') runTest(); });

    container.querySelectorAll('tr[data-id]').forEach(row => {
        const f = faqs.find(x => String(x.id) === row.dataset.id);
        row.querySelector('.faq-edit').addEventListener('click', () => openFaqEditor(f));
        row.querySelector('.faq-delete').addEventListener('click', async () => {
            if (!await confirmDialog(`ลบคำถาม "${f.question}"?`)) return;
            try {
                await fetchAPI(`/admin/faqs/${f.id}`, 'DELETE', null, 8000);
                faqs = faqs.filter(x => x.id !== f.id);
                showToast('info', 'ลบคำถามแล้ว');
                draw(container);
            } catch (err) {
                showToast('error', esc(apiErrorText(err)));
            }
        });
        row.querySelector('.faq-toggle').addEventListener('change', async e => {
            try {
                const saved = await fetchAPI(`/admin/faqs/${f.id}`, 'PUT', { ...f, active: e.target.checked }, 8000);
                Object.assign(f, saved);
                showToast('success', esc(saved.active ? 'เปิดใช้คำถามนี้แล้ว' : 'ปิดคำถามนี้แล้ว'));
                draw(container);
            } catch (err) {
                e.target.checked = !e.target.checked;
                showToast('error', esc(apiErrorText(err)));
            }
        });
    });
}

async function runTest() {
    const input = document.getElementById('faqTestInput');
    const out = document.getElementById('faqTestResult');
    const q = input.value.trim();
    if (!q) return;
    out.innerHTML = 'กำลังตรวจ...';
    try {
        const res = await fetchAPI(`/admin/faqs/test?q=${encodeURIComponent(q)}`, 'GET', null, 8000);
        out.innerHTML = !res.length
            ? '<span style="color:var(--text-muted)">ไม่ตรงกับ FAQ ข้อไหน แชทบอทจะตอบด้วย AI / ข้อมูลอื่นตามปกติ</span>'
            : res.map((m, i) => `<div>${i === 0 ? '👉 ' : ''}<strong>${Math.round(m.score * 100)}%</strong> · ${esc(m.question)}
                ${m.answersExactly ? '<span class="badge badge-blue">จะตอบตามนี้เป๊ะ ๆ</span>' : '<span class="badge badge-amber">ใช้เป็นข้อมูลอ้างอิงให้ AI</span>'}</div>`).join('');
    } catch (err) {
        out.innerHTML = `<span style="color:var(--red-500)">${esc(apiErrorText(err))}</span>`;
    }
}

/** Opens the add/edit form; `prefill` without an id starts a new FAQ (e.g. from a chat question) */
export function openFaqEditor(prefill = {}) {
    loadComponentCSS('faqInsights');
    const isEdit = !!prefill.id;
    const categories = [...new Set(faqs.map(f => f.category || 'ทั่วไป'))];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
        <div class="modal-card" style="max-width:640px;width:94vw;max-height:90vh;overflow:auto" role="dialog" aria-labelledby="faqEditTitle">
            <div class="modal-header">
                <h3 id="faqEditTitle">${isEdit ? 'แก้ไขคำถามที่พบบ่อย' : 'เพิ่มคำถามที่พบบ่อย'}</h3>
                <button type="button" class="modal-close" data-modal-close aria-label="ปิด">✕</button>
            </div>
            <div class="modal-body">
                <div class="modal-field"><label for="faqCat">หมวด</label>
                    <input id="faqCat" list="faqCatList" value="${esc(prefill.category || '')}" placeholder="เช่น การลงทะเบียน, คำร้อง, ทุนการศึกษา (ว่าง = ทั่วไป)">
                    <datalist id="faqCatList">${categories.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
                </div>
                <div class="modal-field"><label for="faqQ">คำถาม <span style="color:var(--red-500)">*</span></label>
                    <input id="faqQ" value="${esc(prefill.question || '')}" placeholder="เช่น ลงทะเบียนเรียนได้ถึงวันไหน" maxlength="1000"></div>
                <div class="modal-field"><label for="faqAlt">คำถามแบบอื่นที่มีความหมายเดียวกัน (บรรทัดละ 1 แบบ, ไม่บังคับ)</label>
                    <textarea id="faqAlt" rows="3" placeholder="เช่น&#10;ปิดลงทะเบียนวันไหน&#10;ลงวิชาได้ถึงเมื่อไหร่">${esc(prefill.alternatives || '')}</textarea></div>
                <div class="modal-field"><label for="faqA">คำตอบ <span style="color:var(--red-500)">*</span></label>
                    <textarea id="faqA" rows="6" maxlength="8000" placeholder="คำตอบที่ต้องการให้แชทบอทตอบ (ใช้ **ตัวหนา** และ - รายการ ได้)">${esc(prefill.answer || '')}</textarea></div>
                <label class="faq-check"><input type="checkbox" id="faqExact" ${prefill.exactAnswer === false ? '' : 'checked'}>
                    <span><strong>ตอบตามนี้เป๊ะ ๆ</strong> เมื่อคำถามตรงมาก (ไม่ติ๊ก = ให้ AI เรียบเรียงคำตอบจากข้อความนี้ทุกครั้ง)</span></label>
                <label class="faq-check"><input type="checkbox" id="faqActive" ${prefill.active === false ? '' : 'checked'}>
                    <span><strong>เปิดใช้</strong> (ปิดไว้ = เก็บไว้แต่แชทบอทไม่ใช้)</span></label>
                <div id="faqEditError" class="app-field-error" role="alert"></div>
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
                    <button type="button" class="btn btn-ghost" data-modal-close>ยกเลิก</button>
                    <button type="button" class="btn btn-orange" id="faqSave">บันทึก</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', close));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    overlay.querySelector(prefill.question ? '#faqA' : '#faqQ').focus();
    // Unsaved input survives closing the form by mistake; a new FAQ started from a chat question
    // gets its own draft so it never takes another question's text
    const faqDraft = attachFormDraft(overlay.querySelector('.modal-body'),
        isEdit ? `faq:edit:${prefill.id}` : `faq:add:${prefill.question || ''}`);

    overlay.querySelector('#faqSave').addEventListener('click', async () => {
        const body = {
            category: overlay.querySelector('#faqCat').value.trim(),
            question: overlay.querySelector('#faqQ').value.trim(),
            alternatives: overlay.querySelector('#faqAlt').value.trim(),
            answer: overlay.querySelector('#faqA').value.trim(),
            exactAnswer: overlay.querySelector('#faqExact').checked,
            active: overlay.querySelector('#faqActive').checked,
        };
        const errBox = overlay.querySelector('#faqEditError');
        const missing = [!body.question && 'คำถาม', !body.answer && 'คำตอบ'].filter(Boolean);
        if (missing.length) {
            errBox.textContent = 'กรุณากรอก ' + missing.join(' และ ');
            errBox.classList.add('visible');
            overlay.querySelector(!body.question ? '#faqQ' : '#faqA').focus();
            return;
        }
        try {
            const saved = isEdit
                ? await fetchAPI(`/admin/faqs/${prefill.id}`, 'PUT', body, 10000)
                : await fetchAPI('/admin/faqs', 'POST', body, 10000);
            const idx = faqs.findIndex(f => f.id === saved.id);
            if (idx >= 0) faqs[idx] = saved; else faqs.push(saved);
            faqLoaded = true;
            faqDraft.clear();
            close();
            showToast('success', isEdit ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มคำถามที่พบบ่อยแล้ว');
            const container = document.getElementById('manageFaqContent');
            if (container) draw(container);
        } catch (err) {
            errBox.textContent = apiErrorText(err);
            errBox.classList.add('visible');
        }
    });
}

async function exportCsv() {
    try {
        const token = localStorage.getItem('bsru_token') || sessionStorage.getItem('bsru_token');
        const res = await fetch(`${API_BASE_URL}/admin/faqs/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `faq-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
        showToast('error', esc('ส่งออกไม่สำเร็จ: ' + err.message));
    }
}

async function importCsv(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const csv = await file.text();
    if (!await confirmDialog(`นำเข้า "${file.name}"? แถวที่มี id ตรงกับของเดิมจะถูกแก้ไข แถวอื่นจะถูกเพิ่มใหม่`, { confirmText: 'นำเข้า', danger: false })) return;
    try {
        const r = await fetchAPI('/admin/faqs/import', 'POST', { csv }, 20000);
        showToast(r.errors?.length ? 'error' : 'success',
            esc(`เพิ่ม ${r.created} · แก้ไข ${r.updated}${r.errors?.length ? ` · ผิดพลาด ${r.errors.length} แถว: ${r.errors.slice(0, 3).join(' / ')}` : ''}`));
        faqLoaded = false;
        renderFaqManagement();
    } catch (err) {
        showToast('error', esc(apiErrorText(err)));
    }
}
