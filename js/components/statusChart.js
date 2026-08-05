/* ================================================================
   BSRU Student Portal — Status Donut Chart Component
   ================================================================
   Aggregates student status data and renders a Chart.js Doughnut
   chart with custom legend. Uses the global `Chart` from CDN.
   ================================================================ */

// ── Status Configuration ──
const STATUS_CONFIG = {
    'กำลังศึกษา': {
        color: '#22c55e',
        bgLight: 'rgba(34, 197, 94, 0.12)',
        icon: '📗',
        order: 1,
    },
    'จบการศึกษา': {
        color: '#3b82f6',
        bgLight: 'rgba(59, 130, 246, 0.12)',
        icon: '🎓',
        order: 2,
    },
    'พักการศึกษา': {
        color: '#f59e0b',
        bgLight: 'rgba(245, 158, 11, 0.12)',
        icon: '⏸️',
        order: 3,
    },
    'พ้นสภาพ': {
        color: '#ef4444',
        bgLight: 'rgba(239, 68, 68, 0.12)',
        icon: '⛔',
        order: 4,
    },
};

// All known statuses (for the chart to always show all segments)
const ALL_STATUSES = Object.keys(STATUS_CONFIG).sort(
    (a, b) => STATUS_CONFIG[a].order - STATUS_CONFIG[b].order
);

let _chartInstance = null;

/**
 * Aggregate student data by status field.
 * Always returns counts for ALL known statuses (0 if none).
 * @param {Array<{status: string}>} students
 * @returns {{ status: string, count: number }[]}
 */
export function aggregateStudentStatus(students) {
    const counts = {};
    ALL_STATUSES.forEach(s => counts[s] = 0);

    students.forEach(student => {
        const status = student.status;
        if (status in counts) {
            counts[status]++;
        } else {
            // Unknown status — group under itself
            counts[status] = (counts[status] || 0) + 1;
        }
    });

    return ALL_STATUSES
        .filter(s => s in counts)
        .map(s => ({ status: s, count: counts[s] }));
}

/**
 * Render (or re-render) the Status Donut Chart into the given container.
 * @param {string} containerId  — ID of the wrapper div (not the canvas)
 * @param {Array<{status: string}>} students — raw student array
 */
export function renderStatusDonutChart(containerId, students) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = aggregateStudentStatus(students);
    const total = data.reduce((sum, d) => sum + d.count, 0);

    // Build inner HTML: canvas + custom legend
    container.innerHTML = `
        <div class="chart-card">
            <div class="chart-card-header">
                <div class="chart-card-title">
                    <span class="chart-card-icon">📊</span>
                    สัดส่วนสถานภาพนักศึกษา
                </div>
                <div class="chart-card-subtitle">Student Status Distribution</div>
            </div>
            <div class="chart-card-body">
                <div class="chart-canvas-wrap">
                    <canvas id="statusDonutCanvas"></canvas>
                    <div class="chart-center-label">
                        <span class="chart-center-value">${total}</span>
                        <span class="chart-center-text">ทั้งหมด</span>
                    </div>
                </div>
                <div class="chart-legend" id="statusChartLegend">
                    ${data.map(d => {
                        const cfg = STATUS_CONFIG[d.status] || { color: '#9ca3af', bgLight: 'rgba(156,163,175,0.12)', icon: '❓' };
                        const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0.0';
                        return `
                            <div class="chart-legend-item">
                                <div class="legend-color-dot" style="background:${cfg.color}"></div>
                                <div class="legend-info">
                                    <span class="legend-label">${cfg.icon} ${d.status}</span>
                                    <span class="legend-value">${d.count} คน <span class="legend-pct">(${pct}%)</span></span>
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // Destroy previous chart instance if exists
    if (_chartInstance) {
        _chartInstance.destroy();
        _chartInstance = null;
    }

    // Create Chart.js Doughnut
    const canvas = document.getElementById('statusDonutCanvas');
    if (!canvas || typeof Chart === 'undefined') {
        container.innerHTML = `
            <div class="chart-card">
                <div class="chart-error">
                    <span>⚠️</span> ไม่สามารถโหลดกราฟได้ — กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
                </div>
            </div>`;
        return;
    }

    const ctx = canvas.getContext('2d');

    _chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.status),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: data.map(d => {
                    const cfg = STATUS_CONFIG[d.status];
                    return cfg ? cfg.color : '#9ca3af';
                }),
                borderColor: '#ffffff',
                borderWidth: 3,
                borderRadius: 6,
                spacing: 2,
                hoverBorderWidth: 0,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '68%',
            plugins: {
                legend: {
                    display: false, // We use custom legend
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.92)',
                    titleFont: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 13, weight: '600' },
                    bodyFont: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12 },
                    padding: { top: 10, bottom: 10, left: 14, right: 14 },
                    cornerRadius: 10,
                    displayColors: true,
                    boxWidth: 12,
                    boxHeight: 12,
                    boxPadding: 4,
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed;
                            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                            return ` ${value} คน (${pct}%)`;
                        },
                    },
                },
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 900,
                easing: 'easeOutQuart',
            },
        },
    });
}

/**
 * Destroy the chart instance (for cleanup).
 */
export function destroyStatusChart() {
    if (_chartInstance) {
        _chartInstance.destroy();
        _chartInstance = null;
    }
}
