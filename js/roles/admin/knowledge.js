import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';

// ================================================================
// KNOWLEDGE BASE MANAGEMENT (WP-3)
// ================================================================
let adminKnowledgeDocuments = [];

export async function renderKnowledgeManagement() {
    const container = document.getElementById('manageKnowledgeContent');
    if (!container) return;

    // Render skeleton layout
    container.innerHTML = `
        <!-- Stat Row -->
        <div class="stat-row" id="kbStatRow">
            <div class="stat-card">
                <div class="stat-icon purple">📚</div>
                <div>
                    <div class="stat-value" id="kbDocCount">${adminKnowledgeDocuments.length}</div>
                    <div class="stat-label">เอกสารในคลังความรู้</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">🧩</div>
                <div>
                    <div class="stat-value" id="kbChunkCount">
                        ${adminKnowledgeDocuments.reduce((sum, d) => sum + (d.chunkCount || d.chunksCount || 1), 0)}
                    </div>
                    <div class="stat-label">ชิ้นส่วน Vector Embeddings</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">⚡</div>
                <div>
                    <div class="stat-value">PGVector + RAG</div>
                    <div class="stat-label">สถานะระบบค้นหาเชิงความหมาย</div>
                </div>
            </div>
        </div>

        <!-- Ingest Document Form Card -->
        <div class="card kb-form-card" style="margin-bottom: 24px;">
            <div class="card-header" style="margin-bottom: 16px;">
                <h3 style="font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px; color: var(--brand-600);">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    นำเข้าเอกสารความรู้ใหม่ (Knowledge Base Ingestion)
                </h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                    อัปโหลดไฟล์ข้อความ (.txt, .md, .csv) หรือวางเนื้อหาระเบียบ ข้อบังคับ หลักสูตร เพื่อสร้าง Vector Embeddings จัดเก็บลง PostgreSQL สำหรับ AI ตอบคำถาม
                </p>
            </div>

            <form id="kbIngestForm" onsubmit="return false;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="kbSourceInput" style="display: block; font-weight: 600; font-size: 0.88rem; margin-bottom: 6px;">
                            ชื่อเอกสาร / แหล่งที่มา (Document Source) <span style="color: var(--red-500); font-weight: 700;">*</span>
                        </label>
                        <input type="text" id="kbSourceInput" class="form-control" placeholder="เช่น bsru_curriculum_standard_2026.pdf หรือ ระเบียบการเทียบโอน.txt" style="width: 100%; padding: 10px 14px; border: 1.5px solid var(--g-300); border-radius: var(--radius-md); font-size: 0.9rem;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="kbFileInput" style="display: block; font-weight: 600; font-size: 0.88rem; margin-bottom: 6px;">
                            เลือกไฟล์จากเครื่อง (Optional File Auto-Fill)
                        </label>
                        <input type="file" id="kbFileInput" accept=".txt,.md,.markdown,.csv,.json,.pdf" style="width: 100%; padding: 8px 10px; border: 1.5px dashed var(--g-300); border-radius: var(--radius-md); font-size: 0.85rem; background: var(--g-50); cursor: pointer;">
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 16px;">
                    <label for="kbContentInput" style="display: block; font-weight: 600; font-size: 0.88rem; margin-bottom: 6px;">
                        เนื้อหาเอกสาร (Content Text) <span style="color: var(--red-500); font-weight: 700;">*</span>
                    </label>
                    <textarea id="kbContentInput" rows="6" class="form-control" placeholder="พิมพ์หรือวางเนื้อหาเอกสารวิชาการที่ต้องการบันทึกเข้าสู่ Vector Database..." style="width: 100%; padding: 12px 14px; border: 1.5px solid var(--g-300); border-radius: var(--radius-md); font-family: inherit; font-size: 0.9rem; line-height: 1.5;" required></textarea>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.88rem; cursor: pointer; user-select: none;">
                        <input type="checkbox" id="kbReplaceExisting" checked style="width: 16px; height: 16px; accent-color: var(--brand-600);">
                        <span>เขียนทับข้อมูลเดิมหากพบชื่อเอกสารซ้ำ (Replace Existing Chunks)</span>
                    </label>

                    <button type="button" class="btn btn-primary" id="kbIngestBtn" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; font-weight: 600;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        นำเข้าสู่คลังความรู้ (Ingest Document)
                    </button>
                </div>
            </form>
        </div>

        <!-- Document List Card -->
        <div class="card" style="padding: 0; overflow: hidden;">
            <div class="card-header" style="padding: 16px 20px; border-bottom: 1px solid var(--g-200); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0;">📚 รายการเอกสารในคลังความรู้ (Active Knowledge Store)</h3>
                    <p style="font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0 0;">เอกสารที่ระบบนำมาค้นหาเพื่อตอบคำถามนักศึกษาและอาจารย์</p>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button type="button" class="btn btn-sm btn-ghost" id="kbRefreshBtn" title="รีเฟรชรายการ" style="display: inline-flex; align-items: center; gap: 6px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;">
                            <polyline points="23 4 23 10 17 10"/>
                            <polyline points="1 20 1 14 7 14"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        รีเฟรช
                    </button>
                </div>
            </div>

            <div class="table-wrap">
                <table class="data-table" id="kbDocsTable">
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">ลำดับ</th>
                            <th>ชื่อเอกสาร / แหล่งที่มา</th>
                            <th style="width: 140px; text-align: center;">ชิ้นส่วน (Chunks)</th>
                            <th class="hide-mobile">ตัวอย่างเนื้อหา (Preview)</th>
                            <th style="width: 120px; text-align: center;">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="kbDocsTbody">
                        <tr><td colspan="5" style="text-align: center; padding: 32px; color: var(--text-muted);">กำลังโหลดข้อมูลคลังความรู้...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Wire File Picker Reader
    const fileInput = document.getElementById('kbFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const sourceInput = document.getElementById('kbSourceInput');
            if (sourceInput && (!sourceInput.value.trim() || sourceInput.value === 'manual_entry')) {
                sourceInput.value = file.name;
            }

            // Read text files directly
            if (file.type.startsWith('text/') || /\.(txt|md|markdown|csv|json)$/i.test(file.name)) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const contentArea = document.getElementById('kbContentInput');
                    if (contentArea) contentArea.value = evt.target.result;
                };
                reader.readAsText(file, 'UTF-8');
            } else if (/\.pdf$/i.test(file.name)) {
                showToast('info', 'เลือกไฟล์ PDF เรียบร้อย: กรุณาพิมพ์หรือวางข้อความสรุปเนื้อหาที่ต้องการนำเข้าสู่ Vector Store');
            }
        });
    }

    // Wire Ingest Submit Button
    const ingestBtn = document.getElementById('kbIngestBtn');
    if (ingestBtn) {
        ingestBtn.addEventListener('click', handleKnowledgeIngest);
    }

    // Wire Refresh Button
    const refreshBtn = document.getElementById('kbRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadKnowledgeDocuments());
    }

    // Load initial data
    await loadKnowledgeDocuments();
}

async function loadKnowledgeDocuments() {
    const tbody = document.getElementById('kbDocsTbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-muted);"><span class="petition-spinner"></span> กำลังดึงข้อมูลจาก Vector Database...</td></tr>`;

    try {
        const data = await fetchAPI('/admin/knowledge', 'GET', null, 15000);
        adminKnowledgeDocuments = Array.isArray(data) ? data : (data?.documents || []);
    } catch (err) {
        console.warn('⚠️ [Admin] Could not load live knowledge documents, using fallback mock view:', err.message);
        if (!adminKnowledgeDocuments || adminKnowledgeDocuments.length === 0) {
            adminKnowledgeDocuments = [];
        }
    }

    renderKnowledgeTableRows();
}

function renderKnowledgeTableRows() {
    const tbody = document.getElementById('kbDocsTbody');
    const docCountEl = document.getElementById('kbDocCount');
    const chunkCountEl = document.getElementById('kbChunkCount');
    if (!tbody) return;

    const totalChunks = adminKnowledgeDocuments.reduce((sum, d) => sum + (d.chunkCount || d.chunksCount || 1), 0);
    if (docCountEl) docCountEl.textContent = adminKnowledgeDocuments.length;
    if (chunkCountEl) chunkCountEl.textContent = totalChunks;

    if (adminKnowledgeDocuments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:36px;color:var(--text-muted);">ยังไม่มีเอกสารในคลังความรู้ AI คุณสามารถนำเข้าเอกสารฉบับแรกได้จากแบบฟอร์มด้านบน</td></tr>`;
        return;
    }

    tbody.innerHTML = adminKnowledgeDocuments.map((doc, idx) => {
        const docId = doc.id || doc.source || `doc-${idx}`;
        const sourceName = doc.source || doc.title || doc.id || 'เอกสารนิรนาม';
        const chunks = doc.chunkCount !== undefined ? doc.chunkCount : (doc.chunksCount !== undefined ? doc.chunksCount : 1);
        const preview = doc.snippet || doc.sampleText || doc.preview || doc.content || 'ไม่มีตัวอย่างข้อความ';

        return `
            <tr>
                <td style="text-align: center; font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; color: var(--brand-600); flex-shrink: 0;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span style="font-weight: 600; color: var(--text-main); word-break: break-all;">${esc(sourceName)}</span>
                    </div>
                </td>
                <td style="text-align: center;">
                    <span class="badge badge-purple" style="font-weight: 700; padding: 4px 10px; border-radius: 999px;">
                        ${chunks} Chunks
                    </span>
                </td>
                <td class="hide-mobile" style="color: var(--text-muted); font-size: 0.85rem; max-width: 380px;">
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(preview)}">
                        ${esc(preview)}
                    </div>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn btn-sm btn-danger delete-kb-btn" data-id="${esc(docId)}" data-source="${esc(sourceName)}" style="display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px;" title="ลบเอกสารและ Chunks ทั้งหมดออกจาก Vector Store">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        <span>ลบ</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach delete listeners
    tbody.querySelectorAll('.delete-kb-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const source = btn.dataset.source;
            handleKnowledgeDelete(id, source, btn);
        });
    });
}

async function handleKnowledgeIngest() {
    const sourceInput = document.getElementById('kbSourceInput');
    const contentInput = document.getElementById('kbContentInput');
    const replaceExistingBox = document.getElementById('kbReplaceExisting');
    const ingestBtn = document.getElementById('kbIngestBtn');

    const source = sourceInput?.value.trim();
    const content = contentInput?.value.trim();
    const replaceExisting = replaceExistingBox?.checked ?? true;

    if (!source) {
        showToast('error', 'กรุณาระบุชื่อเอกสารหรือแหล่งที่มา');
        sourceInput?.focus();
        return;
    }
    if (!content) {
        showToast('error', 'กรุณากรอกเนื้อหาเอกสารที่ต้องการนำเข้า');
        contentInput?.focus();
        return;
    }

    if (ingestBtn) {
        ingestBtn.disabled = true;
        ingestBtn.innerHTML = `<span class="petition-spinner"></span> กำลังนำเข้าและสร้าง Embeddings...`;
    }

    try {
        console.log(`📤 [Admin] Ingesting knowledge document "${source}" (${content.length} chars)...`);
        const res = await fetchAPI('/admin/knowledge/ingest', 'POST', {
            source,
            content,
            replaceExisting,
        }, 60000);

        console.log('✅ [Admin] Document ingested successfully:', res);
        showToast('success', `นำเข้าเอกสาร "${source}" เข้าสู่คลังความรู้สำเร็จแล้ว ✅`);

        // Reset form inputs
        if (sourceInput) sourceInput.value = '';
        if (contentInput) contentInput.value = '';
        const fileInput = document.getElementById('kbFileInput');
        if (fileInput) fileInput.value = '';

        await loadKnowledgeDocuments();
    } catch (err) {
        console.error('❌ [Admin] Knowledge ingestion failed:', err);
        showToast('error', `ไม่สามารถนำเข้าเอกสารได้: ${err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ'}`);
    } finally {
        if (ingestBtn) {
            ingestBtn.disabled = false;
            ingestBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                นำเข้าสู่คลังความรู้ (Ingest Document)
            `;
        }
    }
}

async function handleKnowledgeDelete(docId, docSource, btnElement) {
    if (!confirm(`คุณต้องการลบเอกสาร "${docSource}" และเวกเตอร์ชิ้นส่วนทั้งหมดออกจากคลังความรู้ใช่หรือไม่?`)) {
        return;
    }

    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = `<span class="petition-spinner"></span>`;
    }

    try {
        console.log(`🗑️ [Admin] Deleting document "${docSource}" (ID: ${docId}) from Vector Database...`);
        let deleted = false;
        // First try path variable DELETE /admin/knowledge/{id}
        try {
            await fetchAPI(`/admin/knowledge/${encodeURIComponent(docId)}`, 'DELETE', null, 15000);
            deleted = true;
        } catch (pathErr) {
            // Fallback to query param DELETE /admin/knowledge?source=...
            await fetchAPI(`/admin/knowledge?source=${encodeURIComponent(docSource)}`, 'DELETE', null, 15000);
            deleted = true;
        }

        if (deleted) {
            showToast('success', `ลบเอกสาร "${docSource}" ออกจากคลังความรู้สำเร็จ ✅`);
            adminKnowledgeDocuments = adminKnowledgeDocuments.filter(d => (d.id !== docId && d.source !== docSource && d.title !== docSource));
            renderKnowledgeTableRows();
        }
    } catch (err) {
        console.error('❌ [Admin] Failed to delete document:', err);
        showToast('error', `ไม่สามารถลบเอกสารได้: ${err.message || 'เกิดข้อผิดพลาด'}`);
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>ลบ</span>
            `;
        }
    }
}
