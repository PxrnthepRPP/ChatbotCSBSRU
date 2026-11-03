/* ============================================================
   BSRU Student Portal — Admin Dashboard (overview, batch filter,
   charts, career statistics CSV)
   ============================================================ */

import { getBatch, showToast } from '../../utils.js';
import { loadComponentCSS } from '../../css-loader.js';
import { renderStatusDonutChart } from '../../components/statusChart.js';
import { renderCareerDataList, aggregateCareerList } from '../../components/careerList.js';
import { getCareerCategory } from '../../components/careerCatalog.js';
import { renderGpaTrendChart, renderStatusStackedBar, renderCareerShiftMatrix } from '../../components/yearTrendCharts.js';
import { MOCK_ADVISORS, MOCK_STUDENTS_POOL } from './mockData.js';
import { resolveBatchRange } from './shared.js';
import { renderRegistrationCard } from './registrationPeriods.js';
import { renderAdminSectionsCard } from './sections.js';
import { renderEnrollmentRequestsCard } from './enrollmentRequests.js';

let adminDashboardSelectedBatch = 'all';
let adminDashboardSelectedBatches = []; // Multi-select batch chips state

/**
 * Compute which batches are currently active based on selection mode.
 * @returns {string[]} Array of batch strings
 */
function getActiveBatches() {
    const allBatches = [...new Set(MOCK_STUDENTS_POOL.map(s => getBatch(s.studentId)))].sort().reverse();
    if (adminDashboardSelectedBatch === 'multi') return adminDashboardSelectedBatches;
    return resolveBatchRange(adminDashboardSelectedBatch, allBatches, MOCK_STUDENTS_POOL);
}

export function renderAdminDashboard() {
    const container = document.getElementById('adminDashboardContent');
    if (!container) return;

    const allBatches = [...new Set(MOCK_STUDENTS_POOL.map(s => getBatch(s.studentId)))].sort().reverse();
    const activeBatches = getActiveBatches();
    const isMultiMode = activeBatches.length > 1;

    // Build preset options for the dropdown
    const last4Label = allBatches.length >= 4 ? '⏱️ 4 ปีล่าสุด' : null;

    const batchOpts = [
        `<option value="all" ${adminDashboardSelectedBatch === 'all' ? 'selected' : ''}>ทุกรุ่น / ทุกปีการศึกษา (All Batches) — รวม ${MOCK_STUDENTS_POOL.length} คน</option>`,
        last4Label ? `<option value="last4" ${adminDashboardSelectedBatch === 'last4' ? 'selected' : ''}>${last4Label}</option>` : '',
        `<option value="multi" ${adminDashboardSelectedBatch === 'multi' ? 'selected' : ''}>🎛️ เลือกเองหลายรุ่น (Multi-Select)</option>`,
        `<option disabled>─── แยกตามรุ่น ───</option>`,
        ...allBatches.map(b => {
            const count = MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === b).length;
            const yearBE = 2500 + parseInt(b, 10);
            return `<option value="${b}" ${adminDashboardSelectedBatch === b ? 'selected' : ''}>รุ่น ${b} (เข้าปีการศึกษา ${yearBE}) — ${count} คน</option>`;
        }),
    ].filter(Boolean).join('');

    // Filter students by active batches
    const filteredStudents = MOCK_STUDENTS_POOL.filter(s => activeBatches.includes(getBatch(s.studentId)));

    const totalStudents = filteredStudents.length;
    const studying = filteredStudents.filter(s => s.status === 'กำลังศึกษา').length;
    const graduated = filteredStudents.filter(s => s.status === 'จบการศึกษา').length;
    const onLeave = filteredStudents.filter(s => s.status === 'พักการศึกษา').length;
    const dismissed = filteredStudents.filter(s => s.status === 'พ้นสภาพ').length;
    
    const advisorsCount = activeBatches.length === allBatches.length
        ? MOCK_ADVISORS.length
        : new Set(filteredStudents.map(s => s.advisor)).size;

    // Build selected text label
    let selectedBatchText;
    if (adminDashboardSelectedBatch === 'all') selectedBatchText = 'ทุกรุ่น / ทุกปีการศึกษา';
    else if (adminDashboardSelectedBatch === 'last4' || adminDashboardSelectedBatch === 'last3') selectedBatchText = '4 ปีล่าสุด';
    else if (adminDashboardSelectedBatch === 'multi') selectedBatchText = `เลือก ${activeBatches.length} รุ่น (${activeBatches.slice().reverse().join(', ')})`;
    else selectedBatchText = `รุ่น ${adminDashboardSelectedBatch} (เข้าปีการศึกษา 25${adminDashboardSelectedBatch})`;

    // Build multi-select chips panel (shown when mode is 'multi')
    const showChips = adminDashboardSelectedBatch === 'multi';
    const chipsHtml = showChips ? `
        <div class="batch-multi-panel" id="adminBatchChipsPanel">
            <div class="batch-multi-panel-header">
                <div class="batch-multi-panel-title">
                    <span class="batch-multi-icon">🏷️</span>
                    <span class="batch-multi-text">เลือกรุ่นที่ต้องการดูพร้อมกัน:</span>
                    <span class="batch-multi-count-pill">เลือกแล้ว ${adminDashboardSelectedBatches.length} / ${allBatches.length} รุ่น</span>
                </div>
                <div class="batch-multi-actions">
                    <button type="button" class="batch-quick-btn" id="btnBatchSelectAll" title="เลือกทุกรุ่น">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px"><polyline points="20 6 9 17 4 12"/></svg>
                        เลือกทั้งหมด
                    </button>
                    <button type="button" class="batch-quick-btn" id="btnBatchSelectLast4" title="เลือก 4 ปีล่าสุด">
                        ⏱️ 4 ปีล่าสุด
                    </button>
                    <button type="button" class="batch-quick-btn batch-quick-btn-clear" id="btnBatchClear" title="เลือกรุ่นล่าสุดรุ่นเดียว">
                        ↺ รุ่นล่าสุด
                    </button>
                </div>
            </div>
            <div class="batch-preset-chips" id="adminBatchChips" role="group" aria-label="เลือกรุ่นนักศึกษา">
                ${allBatches.map(b => {
                    const count = MOCK_STUDENTS_POOL.filter(s => getBatch(s.studentId) === b).length;
                    const isActive = adminDashboardSelectedBatches.includes(b);
                    return `<button type="button" class="batch-chip ${isActive ? 'active' : ''}" data-batch="${b}" aria-pressed="${isActive}">
                        <span class="chip-indicator" aria-hidden="true">${isActive ? '✓' : '＋'}</span>
                        <span class="chip-label">รุ่น ${b}</span>
                        <span class="chip-count">(${count})</span>
                    </button>`;
                }).join('')}
            </div>
        </div>` : '';

    container.innerHTML = `
        <div class="batch-filter-bar admin-dashboard-filter-bar" style="margin-bottom:20px">
            <label>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                เลือกดูตามรุ่น / ปีการศึกษา
            </label>
            <select class="batch-select" id="adminDashboardBatchSelect" aria-label="à¸à¸£à¸­à¸à¸à¸²à¸¡à¸£à¸¸à¹à¸">${batchOpts}</select>
            <span class="filter-result-count">
                กำลังแสดงข้อมูล: <strong>${selectedBatchText}</strong> (จำนวน <strong>${totalStudents}</strong> คน)
            </span>
        </div>
        ${chipsHtml}

        <div class="stat-row stat-row-5">
            <div class="stat-card">
                <div class="stat-icon purple">👩‍🏫</div>
                <div>
                    <div class="stat-value">${advisorsCount}</div>
                    <div class="stat-label">อาจารย์ที่ปรึกษา${activeBatches.length < allBatches.length ? ' (ประจำรุ่น)' : ''}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">👨‍🎓</div>
                <div>
                    <div class="stat-value">${totalStudents}</div>
                    <div class="stat-label">นักศึกษา${activeBatches.length < allBatches.length ? ' (รุ่นที่เลือก)' : 'ทั้งหมด'}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">✅</div>
                <div>
                    <div class="stat-value">${studying}</div>
                    <div class="stat-label">กำลังศึกษา</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon amber">🎓</div>
                <div>
                    <div class="stat-value">${graduated}</div>
                    <div class="stat-label">จบการศึกษา</div>
                </div>
            </div>
            ${(onLeave > 0 || dismissed > 0) ? `
            <div class="stat-card">
                <div class="stat-icon red">⚠️</div>
                <div>
                    <div class="stat-value">${onLeave + dismissed}</div>
                    <div class="stat-label">พัก/พ้นสภาพ</div>
                </div>
            </div>
            ` : ''}
        </div>

        <div id="adminRegistrationCard"></div>
        <div id="adminEnrollmentRequestsCard"></div>
        <div id="adminSectionsCard"></div>

        <div class="dashboard-grid">
            <div id="statusChartContainer"></div>
            <div id="careerListContainer"></div>
        </div>

        ${isMultiMode ? `
        <div class="analytics-section-header">
            <div class="analytics-section-title">📊 วิเคราะห์เปรียบเทียบข้ามรุ่น (Year-over-Year Analytics)</div>
            <span class="analytics-section-badge">${activeBatches.length} รุ่น</span>
        </div>
        <div class="trend-analytics-grid">
            <div id="gpaTrendContainer"></div>
            <div id="statusStackedContainer"></div>
        </div>
        <div id="careerShiftContainer" style="margin-bottom:20px"></div>
        ` : ''}

        <div class="card">
            <div class="card-title">📊 ภาพรวมระบบ — ${selectedBatchText}</div>
            <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.7">ระบบสารสนเทศนักศึกษา BSRU สาขาวิทยาการคอมพิวเตอร์ — สถิติของ <strong>${selectedBatchText}</strong> รวมทั้งสิ้น <strong>${totalStudents}</strong> คน (กำลังศึกษา ${studying} คน, จบการศึกษา ${graduated} คน, พักการศึกษา ${onLeave} คน, พ้นสภาพ ${dismissed} คน)</p>
        </div>
    `;

    // Event: dropdown change
    document.getElementById('adminDashboardBatchSelect').addEventListener('change', (e) => {
        adminDashboardSelectedBatch = e.target.value;
        // Initialize multi-select chips with all batches if switching to multi mode
        if (adminDashboardSelectedBatch === 'multi' && adminDashboardSelectedBatches.length === 0) {
            adminDashboardSelectedBatches = [...allBatches];
        }
        renderAdminDashboard();
    });

    // Event: multi-select batch chips & quick actions
    if (showChips) {
        document.querySelectorAll('#adminBatchChips .batch-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const batch = chip.dataset.batch;
                if (adminDashboardSelectedBatches.includes(batch)) {
                    // Prevent deselecting last chip (must keep at least 1)
                    if (adminDashboardSelectedBatches.length > 1) {
                        adminDashboardSelectedBatches = adminDashboardSelectedBatches.filter(b => b !== batch);
                    }
                } else {
                    adminDashboardSelectedBatches.push(batch);
                    // Maintain descending batch order matching allBatches
                    adminDashboardSelectedBatches = allBatches.filter(b => adminDashboardSelectedBatches.includes(b));
                }
                renderAdminDashboard();
            });
        });

        const btnAll = document.getElementById('btnBatchSelectAll');
        if (btnAll) {
            btnAll.addEventListener('click', () => {
                adminDashboardSelectedBatches = [...allBatches];
                renderAdminDashboard();
            });
        }

        const btnLast4 = document.getElementById('btnBatchSelectLast4');
        if (btnLast4) {
            btnLast4.addEventListener('click', () => {
                adminDashboardSelectedBatches = allBatches.slice(0, 4);
                renderAdminDashboard();
            });
        }

        const btnClear = document.getElementById('btnBatchClear');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                adminDashboardSelectedBatches = [allBatches[0]];
                renderAdminDashboard();
            });
        }
    }

    // Load chart CSS and render all components
    Promise.all([
        loadComponentCSS('statusChart'),
        loadComponentCSS('yearTrend'),
    ]).then(() => {
        renderStatusDonutChart('statusChartContainer', filteredStudents);
        renderCareerDataList('careerListContainer', filteredStudents);
        const careerHeader = document.querySelector('#careerListContainer .career-list-header');
        if (careerHeader && !document.getElementById('exportCareerCsvBtn')) {
            const expBtn = document.createElement('button');
            expBtn.id = 'exportCareerCsvBtn';
            expBtn.className = 'btn btn-sm btn-secondary';
            expBtn.style.marginLeft = 'auto';
            expBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:text-bottom;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                ส่งออก CSV
            `;
            expBtn.addEventListener('click', () => exportCareerStatisticsCsv(filteredStudents));
            careerHeader.appendChild(expBtn);
        }

        // Render Year-over-Year analytics when multiple batches selected
        if (isMultiMode) {
            const sortedActive = activeBatches.slice().sort();
            renderGpaTrendChart('gpaTrendContainer', MOCK_STUDENTS_POOL, sortedActive);
            renderStatusStackedBar('statusStackedContainer', MOCK_STUDENTS_POOL, sortedActive);
            renderCareerShiftMatrix('careerShiftContainer', MOCK_STUDENTS_POOL, sortedActive);
        }
    });

    renderRegistrationCard({ cached: true });
    renderEnrollmentRequestsCard({ cached: true });
    renderAdminSectionsCard({ cached: true });
}

export function exportCareerStatisticsCsv(students) {
    const list = students || (typeof filteredStudents !== 'undefined' ? filteredStudents : MOCK_STUDENTS_POOL);
    const data = aggregateCareerList(list);
    let csv = 'อันดับ,สายอาชีพ,หมวดหมู่,จำนวนบัณฑิต (คน),สัดส่วน (%)\n';
    data.forEach((item, index) => {
        const cat = getCareerCategory(item.career);
        const catName = cat === 'unemployed' ? 'ว่างงาน' : cat === 'business' ? 'ธุรกิจส่วนตัว' : 'งานตรงสาย IT/CS';
        const escField = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
        csv += `${index + 1},${escField(item.career)},${escField(catName)},${item.count},${item.percentage}%\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bsru_career_statistics_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'ส่งออกสถิติสายอาชีพบัณฑิตเป็นไฟล์ CSV (UTF-8 with BOM) เรียบร้อย');
}
