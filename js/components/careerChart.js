/* ================================================================
   BSRU Student Portal — Career Path Horizontal Bar Chart Component
   ================================================================
   Aggregates career path data from graduated students and renders
   a Chart.js horizontal bar chart. Highlights "ว่างงาน" bar in red.
   Uses the global `Chart` from CDN.
   ================================================================ */

// ── Career color palette ──
const CAREER_COLORS = {
    default: {
        bg: 'rgba(42, 94, 168, 0.85)',       // brand-400
        hoverBg: 'rgba(42, 94, 168, 1)',
        border: 'rgba(30, 61, 114, 1)',       // brand-500
    },
    business: {
        bg: 'rgba(245, 158, 11, 0.85)',       // amber-500
        hoverBg: 'rgba(217, 119, 6, 1)',      // amber-600
        border: 'rgba(217, 119, 6, 1)',
    },
    unemployed: {
        bg: 'rgba(239, 68, 68, 0.85)',        // red-500
        hoverBg: 'rgba(220, 38, 38, 1)',      // red-600
        border: 'rgba(220, 38, 38, 1)',
    },
};

let _careerChartInstance = null;

/**
 * Aggregate career paths from graduated students.
 * @param {Array<{status: string, careerPath?: string}>} students
 * @returns {{ career: string, count: number }[]}  sorted by count DESC
 */
export function aggregateCareerPaths(students) {
    const graduated = students.filter(s => s.status === 'จบการศึกษา' && s.careerPath);
    const counts = {};

    graduated.forEach(s => {
        const career = s.careerPath;
        counts[career] = (counts[career] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([career, count]) => ({ career, count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Determine category of a career path.
 */
function getCategory(label) {
    if (label.includes('ว่างงาน')) return 'unemployed';
    if (label.includes('เจ้าของธุรกิจ') || label.includes('ธุรกิจส่วนตัว') || label.includes('ฟรีแลนซ์')) return 'business';
    return 'default';
}

/**
 * Render (or re-render) the Career Horizontal Bar Chart.
 * @param {string} containerId — ID of the wrapper div
 * @param {Array} students — raw student array
 */
export function renderCareerBarChart(containerId, students) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = aggregateCareerPaths(students);
    const totalGraduated = students.filter(s => s.status === 'จบการศึกษา').length;

    // ── Empty state ──
    if (data.length === 0) {
        container.innerHTML = `
            <div class="chart-card career-chart-card">
                <div class="chart-card-header">
                    <div class="chart-card-title">
                        <span class="chart-card-icon">💼</span>
                        สายอาชีพบัณฑิตที่จบการศึกษา
                    </div>
                    <div class="chart-card-subtitle">Graduate Career Distribution</div>
                </div>
                <div class="chart-empty-state">
                    <div class="chart-empty-icon">📭</div>
                    <div class="chart-empty-text">ยังไม่มีข้อมูลบัณฑิต</div>
                    <div class="chart-empty-sub">เมื่อมีนักศึกษาจบการศึกษาและกรอกข้อมูลอาชีพ กราฟจะแสดงที่นี่</div>
                </div>
            </div>`;
        return;
    }

    // ── Build colors array ──
    const bgColors = data.map(d => CAREER_COLORS[getCategory(d.career)].bg);
    const hoverBgColors = data.map(d => CAREER_COLORS[getCategory(d.career)].hoverBg);
    const borderColors = data.map(d => CAREER_COLORS[getCategory(d.career)].border);

    // ── Build HTML ──
    container.innerHTML = `
        <div class="chart-card career-chart-card">
            <div class="chart-card-header">
                <div class="chart-card-title">
                    <span class="chart-card-icon">💼</span>
                    สายอาชีพบัณฑิตที่จบการศึกษา
                </div>
                <div class="chart-card-subtitle">Graduate Career Distribution — บัณฑิตทั้งหมด ${totalGraduated} คน</div>
            </div>
            <div class="career-chart-body">
                <canvas id="careerBarCanvas"></canvas>
            </div>
            <div class="career-chart-footer">
                <div class="career-legend-hint">
                    <span class="career-legend-dot career-legend-dot--normal"></span>
                    <span>งานตรงสาย (IT & CS)</span>
                </div>
                <div class="career-legend-hint">
                    <span class="career-legend-dot career-legend-dot--business"></span>
                    <span>ธุรกิจส่วนตัว / อิสระ</span>
                </div>
                <div class="career-legend-hint">
                    <span class="career-legend-dot career-legend-dot--unemployed"></span>
                    <span>ว่างงาน (ติดตาม)</span>
                </div>
            </div>
        </div>
    `;

    // ── Destroy previous instance ──
    if (_careerChartInstance) {
        _careerChartInstance.destroy();
        _careerChartInstance = null;
    }

    const canvas = document.getElementById('careerBarCanvas');
    if (!canvas || typeof Chart === 'undefined') {
        container.innerHTML = `
            <div class="chart-card career-chart-card">
                <div class="chart-error">
                    <span>⚠️</span> ไม่สามารถโหลดกราฟได้ — กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
                </div>
            </div>`;
        return;
    }

    const ctx = canvas.getContext('2d');

    // ── Dynamic height based on number of bars ──
    const barHeight = 38;
    const minHeight = 200;
    const calculatedHeight = Math.max(minHeight, data.length * barHeight + 60);
    canvas.parentElement.style.height = calculatedHeight + 'px';

    _careerChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.career),
            datasets: [{
                label: 'จำนวนบัณฑิต',
                data: data.map(d => d.count),
                backgroundColor: bgColors,
                hoverBackgroundColor: hoverBgColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.7,
                categoryPercentage: 0.85,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { right: 20 },
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 11 },
                        color: '#6b7280',
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.04)',
                        drawBorder: false,
                    },
                    title: {
                        display: true,
                        text: 'จำนวน (คน)',
                        font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12, weight: '600' },
                        color: '#9ca3af',
                    },
                },
                y: {
                    ticks: {
                        font: { family: "'Noto Sans Thai', 'Inter', sans-serif", size: 12.5, weight: '500' },
                        color: '#374151',
                        crossAlign: 'far',
                        callback: function (value) {
                            const label = this.getLabelForValue(value);
                            // Highlight ว่างงาน label
                            return label;
                        },
                    },
                    grid: {
                        display: false,
                    },
                },
            },
            plugins: {
                legend: {
                    display: false,
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
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.x;
                            const pct = totalGraduated > 0 ? ((value / totalGraduated) * 100).toFixed(1) : '0.0';
                            return ` ${value} คน (${pct}%)`;
                        },
                    },
                },
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart',
            },
        },
    });
}

/**
 * Destroy the career chart instance (for cleanup).
 */
export function destroyCareerChart() {
    if (_careerChartInstance) {
        _careerChartInstance.destroy();
        _careerChartInstance = null;
    }
}
