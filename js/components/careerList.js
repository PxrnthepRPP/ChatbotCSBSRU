/* ================================================================
   BSRU Student Portal — Career Path Data List Component (Progress Bar)
   ================================================================
   Aggregates career path data from graduated students and renders
   a scrollable Data List with Progress Bars (pure HTML/CSS, no Chart.js).
   Highlights "ว่างงาน" (unemployed) in red/orange.
   ================================================================ */

/**
 * Aggregate career paths from graduated students.
 * Computes counts and percentages (0 - 100%).
 * @param {Array<{status: string, careerPath?: string}>} students
 * @returns {{ career: string, count: number, percentage: number }[]} sorted by count DESC
 */
export function aggregateCareerList(students) {
    const graduated = students.filter(s => s.status === 'จบการศึกษา' && s.careerPath);
    const totalGraduated = graduated.length;
    const counts = {};

    graduated.forEach(s => {
        const career = s.careerPath.trim();
        counts[career] = (counts[career] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([career, count]) => {
            const percentage = totalGraduated > 0 ? parseFloat(((count / totalGraduated) * 100).toFixed(1)) : 0;
            return { career, count, percentage };
        })
        .sort((a, b) => b.count - a.count || a.career.localeCompare(b.career, 'th'));
}

/**
 * Determine the category of a career path.
 * @param {string} career
 * @returns {'unemployed' | 'business' | 'direct_tech'}
 */
function getCareerCategory(career) {
    if (career.includes('ว่างงาน')) return 'unemployed';
    if (career.includes('เจ้าของธุรกิจ') || career.includes('ธุรกิจส่วนตัว') || career.includes('ฟรีแลนซ์')) return 'business';
    return 'direct_tech';
}

/**
 * Render the Career Data List into the container element.
 * @param {string} containerId - ID of the container element
 * @param {Array} students - Array of student records
 */
export function renderCareerDataList(containerId, students) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = aggregateCareerList(students);
    const graduatedStudents = students.filter(s => s.status === 'จบการศึกษา');
    const totalGraduated = graduatedStudents.length;

    // ── Empty State ──
    if (data.length === 0) {
        container.innerHTML = `
            <div class="chart-card career-list-card">
                <div class="chart-card-header">
                    <div class="chart-card-title">
                        <span class="chart-card-icon">💼</span>
                        สถิติสายอาชีพบัณฑิต
                    </div>
                    <div class="chart-card-subtitle">Graduate Career Distribution</div>
                </div>
                <div class="chart-empty-state">
                    <div class="chart-empty-icon">📭</div>
                    <div class="chart-empty-text">ยังไม่มีข้อมูลบัณฑิต</div>
                    <div class="chart-empty-sub">เมื่อมีข้อมูลบัณฑิตสำเร็จการศึกษา รายการสายอาชีพจะแสดงที่นี่</div>
                </div>
            </div>`;
        return;
    }

    // ── HTML Rows Construction ──
    const rowsHtml = data.map((item, index) => {
        const category = getCareerCategory(item.career);
        
        let fillClass = 'fill-default';
        let badgeClass = 'badge-career';
        let itemClass = '';
        let icon = '💻';

        if (category === 'unemployed') {
            fillClass = 'fill-unemployed';
            badgeClass = 'badge-unemployed';
            itemClass = 'item-unemployed';
            icon = '⚠️';
        } else if (category === 'business') {
            fillClass = 'fill-business';
            badgeClass = 'badge-business';
            itemClass = 'item-business';
            icon = '🏢';
        }

        return `
            <div class="career-item ${itemClass}">
                <div class="career-item-header">
                    <div class="career-name-group">
                        <span class="career-rank">#${index + 1}</span>
                        <span class="career-icon">${icon}</span>
                        <span class="career-name">${item.career}</span>
                    </div>
                    <div class="career-stat-group">
                        <span class="career-count">${item.count} คน</span>
                        <span class="career-badge ${badgeClass}">${item.percentage}%</span>
                    </div>
                </div>
                <div class="career-progress-bg">
                    <div class="career-progress-fill ${fillClass}" style="width: ${Math.min(100, Math.max(0, item.percentage))}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    // ── Outer Component Structure ──
    container.innerHTML = `
        <div class="chart-card career-list-card">
            <div class="chart-card-header career-list-header">
                <div>
                    <div class="chart-card-title">
                        <span class="chart-card-icon">💼</span>
                        สรุปสายอาชีพบัณฑิต (${data.length} สายอาชีพ)
                    </div>
                    <div class="chart-card-subtitle">Graduate Career Breakdown — บัณฑิตทั้งหมด ${totalGraduated} คน</div>
                </div>
            </div>
            <div class="career-list-scroll">
                ${rowsHtml}
            </div>
            <div class="career-list-footer">
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
}
