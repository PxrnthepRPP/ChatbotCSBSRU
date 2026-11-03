/* ================================================================
   BSRU Student Portal — Year-over-Year Trend Analytics Component
   ================================================================
   Provides:
   1. GPA Trend Line Chart (Chart.js Line)
   2. Status Stacked Bar Chart (Chart.js Stacked Bar)
   3. Career Shift Matrix (HTML Table with Trend Indicators)
   ================================================================ */

import { getBatch } from '../utils.js';

// ── Color Palette ──
const CHART_COLORS = {
    primary: '#6366f1',
    primaryLight: 'rgba(99, 102, 241, 0.15)',
    green: '#22c55e',
    greenLight: 'rgba(34, 197, 94, 0.15)',
    blue: '#3b82f6',
    blueLight: 'rgba(59, 130, 246, 0.15)',
    amber: '#f59e0b',
    amberLight: 'rgba(245, 158, 11, 0.15)',
    red: '#ef4444',
    redLight: 'rgba(239, 68, 68, 0.15)',
    purple: '#a855f7',
    purpleLight: 'rgba(168, 85, 247, 0.15)',
};

const STATUS_COLORS = {
    'กำลังศึกษา': { bg: CHART_COLORS.green, fill: CHART_COLORS.greenLight },
    'จบการศึกษา': { bg: CHART_COLORS.blue, fill: CHART_COLORS.blueLight },
    'พักการศึกษา': { bg: CHART_COLORS.amber, fill: CHART_COLORS.amberLight },
    'พ้นสภาพ':   { bg: CHART_COLORS.red, fill: CHART_COLORS.redLight },
};

// Track Chart.js instances for cleanup
let _gpaTrendChart = null;
let _statusStackedChart = null;

/**
 * Aggregate students into batch-level statistics.
 * @param {Array} students
 * @param {string[]} selectedBatches - batches to include (already filtered)
 * @returns {{ batch: string, yearBE: number, total: number, graduated: number, studying: number, onLeave: number, dismissed: number, avgGpa: number, employmentRate: number|null }[]}
 */
export function aggregateByBatch(students, selectedBatches) {
    const batchMap = {};

    students.forEach(s => {
        const batch = getBatch(s.studentId);
        if (selectedBatches && !selectedBatches.includes(batch)) return;
        if (!batchMap[batch]) {
            batchMap[batch] = { batch, students: [] };
        }
        batchMap[batch].students.push(s);
    });

    return Object.values(batchMap)
        .map(({ batch, students: batchStudents }) => {
            const total = batchStudents.length;
            const graduated = batchStudents.filter(s => s.status === 'จบการศึกษา').length;
            const studying = batchStudents.filter(s => s.status === 'กำลังศึกษา').length;
            const onLeave = batchStudents.filter(s => s.status === 'พักการศึกษา').length;
            const dismissed = batchStudents.filter(s => s.status === 'พ้นสภาพ').length;
            const avgGpa = total > 0
                ? parseFloat((batchStudents.reduce((sum, s) => sum + (s.gpa || 0), 0) / total).toFixed(2))
                : 0;
            const gradWithCareer = batchStudents.filter(s => s.status === 'จบการศึกษา' && s.careerPath && s.careerPath !== 'ว่างงาน').length;
            const employmentRate = graduated > 0
                ? parseFloat(((gradWithCareer / graduated) * 100).toFixed(1))
                : null;   // no graduates yet: no rate (a 0% point would read as "nobody found work")

            return {
                batch,
                yearBE: 2500 + parseInt(batch, 10),
                total,
                graduated,
                studying,
                onLeave,
                dismissed,
                avgGpa,
                employmentRate,
            };
        })
        .sort((a, b) => a.batch.localeCompare(b.batch));
}

/**
 * Render GPA Trend Line Chart
 */
export function renderGpaTrendChart(containerId, students, selectedBatches) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const batchData = aggregateByBatch(students, selectedBatches);

    if (batchData.length < 2) {
        container.innerHTML = `
            <div class="trend-chart-card">
                <div class="trend-chart-header">
                    <div class="trend-chart-title"><span class="trend-chart-icon">📈</span> แนวโน้ม GPA เฉลี่ยตามรุ่น</div>
                    <div class="trend-chart-subtitle">GPA Trend by Batch</div>
                </div>
                <div class="trend-empty-state">
                    <div class="trend-empty-icon">📊</div>
                    <div class="trend-empty-text">ต้องเลือกข้อมูลอย่างน้อย 2 รุ่นเพื่อแสดงแนวโน้ม</div>
                </div>
            </div>`;
        return;
    }

    const labels = batchData.map(d => `รุ่น ${d.batch}`);
    const gpaValues = batchData.map(d => d.avgGpa);
    const empValues = batchData.map(d => d.employmentRate);

    container.innerHTML = `
        <div class="trend-chart-card">
            <div class="trend-chart-header">
                <div class="trend-chart-title"><span class="trend-chart-icon">📈</span> แนวโน้ม GPA เฉลี่ยและอัตราได้งาน</div>
                <div class="trend-chart-subtitle">GPA Trend & Employment Rate by Batch (${batchData.length} รุ่น)${batchData.some(d => d.employmentRate === null) ? ' · เส้นอัตราได้งานเว้นช่วงรุ่นที่ยังไม่มีบัณฑิต' : ''}</div>
            </div>
            <div class="trend-chart-body">
                <canvas id="gpaTrendCanvas"></canvas>
            </div>
        </div>`;

    if (_gpaTrendChart) { _gpaTrendChart.destroy(); _gpaTrendChart = null; }

    const canvas = document.getElementById('gpaTrendCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    _gpaTrendChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'GPA เฉลี่ย',
                    data: gpaValues,
                    borderColor: CHART_COLORS.primary,
                    backgroundColor: CHART_COLORS.primaryLight,
                    borderWidth: 3,
                    pointBackgroundColor: CHART_COLORS.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y',
                },
                {
                    label: 'อัตราได้งาน (%)',
                    data: empValues,
                    borderColor: CHART_COLORS.green,
                    backgroundColor: CHART_COLORS.greenLight,
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointBackgroundColor: CHART_COLORS.green,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y1',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 },
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 12,
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.92)',
                    titleFont: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 13, weight: '600' },
                    bodyFont: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 },
                    padding: { top: 10, bottom: 10, left: 14, right: 14 },
                    cornerRadius: 10,
                },
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'GPA เฉลี่ย', font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 } },
                    min: 0,
                    max: 4,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: { font: { family: "'Inter', sans-serif", size: 11 } },
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'อัตราได้งาน (%)', font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 } },
                    min: 0,
                    max: 100,
                    grid: { drawOnChartArea: false },
                    ticks: { font: { family: "'Inter', sans-serif", size: 11 }, callback: v => v + '%' },
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 } },
                },
            },
            animation: { duration: 900, easing: 'easeOutQuart' },
        },
    });
}

/**
 * Render Status Stacked Bar Chart
 */
export function renderStatusStackedBar(containerId, students, selectedBatches) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const batchData = aggregateByBatch(students, selectedBatches);

    if (batchData.length < 2) {
        container.innerHTML = `
            <div class="trend-chart-card">
                <div class="trend-chart-header">
                    <div class="trend-chart-title"><span class="trend-chart-icon">📊</span> สัดส่วนสถานะตามรุ่น</div>
                    <div class="trend-chart-subtitle">Student Status Comparison by Batch</div>
                </div>
                <div class="trend-empty-state">
                    <div class="trend-empty-icon">📊</div>
                    <div class="trend-empty-text">ต้องเลือกข้อมูลอย่างน้อย 2 รุ่นเพื่อแสดงการเปรียบเทียบ</div>
                </div>
            </div>`;
        return;
    }

    const labels = batchData.map(d => `รุ่น ${d.batch}`);
    const statusKeys = ['กำลังศึกษา', 'จบการศึกษา', 'พักการศึกษา', 'พ้นสภาพ'];
    const statusIcons = { 'กำลังศึกษา': '📗', 'จบการศึกษา': '🎓', 'พักการศึกษา': '⏸️', 'พ้นสภาพ': '⛔' };

    container.innerHTML = `
        <div class="trend-chart-card">
            <div class="trend-chart-header">
                <div class="trend-chart-title"><span class="trend-chart-icon">📊</span> สัดส่วนสถานะนักศึกษาตามรุ่น</div>
                <div class="trend-chart-subtitle">Student Status Comparison by Batch (${batchData.length} รุ่น)</div>
            </div>
            <div class="trend-chart-body">
                <canvas id="statusStackedCanvas"></canvas>
            </div>
        </div>`;

    if (_statusStackedChart) { _statusStackedChart.destroy(); _statusStackedChart = null; }

    const canvas = document.getElementById('statusStackedCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const datasets = statusKeys.map(status => ({
        label: `${statusIcons[status] || ''} ${status}`,
        data: batchData.map(bd => {
            const all = students.filter(s => getBatch(s.studentId) === bd.batch);
            return all.filter(s => s.status === status).length;
        }),
        backgroundColor: STATUS_COLORS[status]?.bg || '#9ca3af',
        borderColor: STATUS_COLORS[status]?.bg || '#9ca3af',
        borderWidth: 1,
        borderRadius: 4,
    }));

    _statusStackedChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 },
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 12,
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.92)',
                    titleFont: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 13, weight: '600' },
                    bodyFont: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 },
                    padding: { top: 10, bottom: 10, left: 14, right: 14 },
                    cornerRadius: 10,
                    callbacks: {
                        label: ctx => {
                            const batchTotal = batchData[ctx.dataIndex].total;
                            const pct = batchTotal > 0 ? ((ctx.parsed.y / batchTotal) * 100).toFixed(1) : '0';
                            return ` ${ctx.dataset.label}: ${ctx.parsed.y} คน (${pct}%)`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 } },
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'จำนวนนักศึกษา (คน)', font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 } },
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: { font: { family: "'Inter', sans-serif", size: 11 }, stepSize: 1 },
                },
            },
            animation: { duration: 900, easing: 'easeOutQuart' },
        },
    });
}

/**
 * Render Career Shift Matrix — an HTML table comparing career distributions across batches with trend arrows.
 */
export function renderCareerShiftMatrix(containerId, students, selectedBatches) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const batchData = aggregateByBatch(students, selectedBatches);
    if (batchData.length < 2) {
        container.innerHTML = `
            <div class="trend-chart-card">
                <div class="trend-chart-header">
                    <div class="trend-chart-title"><span class="trend-chart-icon">🔄</span> เปรียบเทียบสายอาชีพข้ามรุ่น</div>
                    <div class="trend-chart-subtitle">Career Shift Matrix</div>
                </div>
                <div class="trend-empty-state">
                    <div class="trend-empty-icon">🔄</div>
                    <div class="trend-empty-text">ต้องเลือกข้อมูลอย่างน้อย 2 รุ่นที่มีบัณฑิตเพื่อแสดงการเปรียบเทียบ</div>
                </div>
            </div>`;
        return;
    }

    // Collect all career paths across selected batches (only graduated)
    const batchesWithGrads = batchData.filter(bd => bd.graduated > 0);
    if (batchesWithGrads.length < 2) {
        container.innerHTML = `
            <div class="trend-chart-card">
                <div class="trend-chart-header">
                    <div class="trend-chart-title"><span class="trend-chart-icon">🔄</span> เปรียบเทียบสายอาชีพข้ามรุ่น</div>
                    <div class="trend-chart-subtitle">Career Shift Matrix</div>
                </div>
                <div class="trend-empty-state">
                    <div class="trend-empty-icon">🔄</div>
                    <div class="trend-empty-text">ต้องมีข้อมูลบัณฑิตจากอย่างน้อย 2 รุ่นจึงจะเปรียบเทียบได้</div>
                </div>
            </div>`;
        return;
    }

    // Build career percentages per batch
    const allCareers = new Set();
    const batchCareerPcts = {}; // { batch: { career: pct } }

    batchesWithGrads.forEach(bd => {
        const grads = students.filter(s => getBatch(s.studentId) === bd.batch && s.status === 'จบการศึกษา' && s.careerPath);
        const total = grads.length;
        const counts = {};
        grads.forEach(s => {
            const c = s.careerPath.trim();
            counts[c] = (counts[c] || 0) + 1;
            allCareers.add(c);
        });
        batchCareerPcts[bd.batch] = {};
        for (const [career, count] of Object.entries(counts)) {
            batchCareerPcts[bd.batch][career] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
        }
    });

    // Sort careers by total count across all batches
    const careerTotals = {};
    allCareers.forEach(c => {
        careerTotals[c] = batchesWithGrads.reduce((sum, bd) => sum + (batchCareerPcts[bd.batch]?.[c] || 0), 0);
    });
    const sortedCareers = [...allCareers].sort((a, b) => careerTotals[b] - careerTotals[a]);

    // Determine trend between first and last batch with grads
    function getTrend(career) {
        const firstBatch = batchesWithGrads[0].batch;
        const lastBatch = batchesWithGrads[batchesWithGrads.length - 1].batch;
        const firstPct = batchCareerPcts[firstBatch]?.[career] || 0;
        const lastPct = batchCareerPcts[lastBatch]?.[career] || 0;
        const diff = lastPct - firstPct;

        if (career === 'ว่างงาน') {
            // For unemployment, down is good
            if (diff < -5) return '<span class="trend-arrow trend-good">📉 ↓</span>';
            if (diff > 5) return '<span class="trend-arrow trend-bad">📈 ↑</span>';
            return '<span class="trend-arrow trend-neutral">➡️</span>';
        }

        if (diff > 10) return '<span class="trend-arrow trend-hot">🚀 ↑↑</span>';
        if (diff > 3) return '<span class="trend-arrow trend-up">📈 ↑</span>';
        if (diff < -5) return '<span class="trend-arrow trend-down">📉 ↓</span>';
        return '<span class="trend-arrow trend-neutral">➡️</span>';
    }

    // Build header
    const batchHeaders = batchesWithGrads.map(bd => `<th class="career-matrix-batch-header">รุ่น ${bd.batch}</th>`).join('');

    // Build rows
    const rows = sortedCareers.map((career, i) => {
        const isUnemployed = career === 'ว่างงาน';
        const rowClass = isUnemployed ? 'career-matrix-row-unemployed' : '';
        const icon = isUnemployed ? '⚠️' : '💻';
        const cells = batchesWithGrads.map(bd => {
            const pct = batchCareerPcts[bd.batch]?.[career] || 0;
            const cellClass = pct === 0 ? 'career-matrix-zero' : (pct >= 20 ? 'career-matrix-high' : '');
            return `<td class="career-matrix-cell ${cellClass}">${pct > 0 ? pct + '%' : '-'}</td>`;
        }).join('');

        return `
            <tr class="${rowClass}">
                <td class="career-matrix-name">
                    <span class="career-matrix-rank">#${i + 1}</span>
                    <span>${icon} ${career}</span>
                </td>
                ${cells}
                <td class="career-matrix-trend">${getTrend(career)}</td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="trend-chart-card career-matrix-card">
            <div class="trend-chart-header">
                <div class="trend-chart-title"><span class="trend-chart-icon">🔄</span> เปรียบเทียบสายอาชีพข้ามรุ่น (Career Shift Matrix)</div>
                <div class="trend-chart-subtitle">เปรียบเทียบ % สายอาชีพบัณฑิตจาก ${batchesWithGrads.length} รุ่นที่มีข้อมูล</div>
            </div>
            <div class="career-matrix-scroll">
                <table class="career-matrix-table">
                    <thead>
                        <tr>
                            <th class="career-matrix-name-header">สายอาชีพ</th>
                            ${batchHeaders}
                            <th class="career-matrix-trend-header">Trend</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="career-matrix-legend">
                <span class="career-matrix-legend-item"><span class="trend-arrow trend-hot">🚀 ↑↑</span> เติบโตมาก</span>
                <span class="career-matrix-legend-item"><span class="trend-arrow trend-up">📈 ↑</span> เพิ่มขึ้น</span>
                <span class="career-matrix-legend-item"><span class="trend-arrow trend-neutral">➡️</span> คงที่</span>
                <span class="career-matrix-legend-item"><span class="trend-arrow trend-down">📉 ↓</span> ลดลง</span>
            </div>
        </div>`;
}

/**
 * Destroy all trend chart instances.
 */
export function destroyTrendCharts() {
    if (_gpaTrendChart) { _gpaTrendChart.destroy(); _gpaTrendChart = null; }
    if (_statusStackedChart) { _statusStackedChart.destroy(); _statusStackedChart = null; }
}
