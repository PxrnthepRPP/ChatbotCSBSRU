/* ============================================================
   BSRU Student Portal — Advisor Dashboard (advisee status summary)
   ============================================================ */

import { getBatch } from '../../utils.js';
import { loadComponentCSS } from '../../css-loader.js';
import { currentAdvisees, riskCardHtml } from './risk.js';
import { bindAdviseeButtons } from './history.js';

export function renderAdvisorDashboard() {
    const myStudents = currentAdvisees();
    const total = myStudents.length;
    
    // Academic Status breakdown
    const studying = myStudents.filter(s => s.status === 'กำลังศึกษา');
    const graduated = myStudents.filter(s => s.status === 'จบการศึกษา');
    const onLeave = myStudents.filter(s => s.status === 'พักการศึกษา');
    const dismissed = myStudents.filter(s => s.status === 'พ้นสภาพ');

    const studyingPct = total > 0 ? ((studying.length / total) * 100).toFixed(1) : '0.0';
    const graduatedPct = total > 0 ? ((graduated.length / total) * 100).toFixed(1) : '0.0';
    const onLeavePct = total > 0 ? ((onLeave.length / total) * 100).toFixed(1) : '0.0';
    const dismissedPct = total > 0 ? ((dismissed.length / total) * 100).toFixed(1) : '0.0';

    const avgGpa = total ? (myStudents.reduce((a, c) => a + c.gpa, 0) / total).toFixed(2) : '0.00';

    // Batch breakdown
    const batches = [...new Set(myStudents.map(s => getBatch(s.studentId)))].sort().reverse();
    const batchBreakdown = batches.map(b => {
        const count = myStudents.filter(s => getBatch(s.studentId) === b).length;
        return `<div class="stat-card"><div class="stat-icon blue">📦</div><div><div class="stat-value">${count}</div><div class="stat-label">รุ่น ${b} (Batch ${b})</div></div></div>`;
    }).join('');

    document.getElementById('advisorDashboardContent').innerHTML = `
        <!-- Top Stat Cards (4 Cards) -->
        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon purple">👥</div><div><div class="stat-value">${total}</div><div class="stat-label">นักศึกษาทั้งหมด</div></div></div>
            <div class="stat-card"><div class="stat-icon green">📗</div><div><div class="stat-value">${studying.length}</div><div class="stat-label">กำลังศึกษา (ยังไม่จบ)</div></div></div>
            <div class="stat-card"><div class="stat-icon blue">🎓</div><div><div class="stat-value">${graduated.length}</div><div class="stat-label">จบการศึกษาแล้ว</div></div></div>
            <div class="stat-card"><div class="stat-icon amber">⏸️</div><div><div class="stat-value">${onLeave.length + dismissed.length}</div><div class="stat-label">พักการเรียน / พ้นสภาพ</div></div></div>
        </div>

        ${riskCardHtml()}

        <!-- Advisee Academic Status Breakdown Card -->
        <div class="chart-card">
            <div class="chart-card-header">
                <div class="chart-card-title">
                    <span class="chart-card-icon">📊</span>
                    สรุปสถานภาพการศึกษาของนักศึกษาในความดูแล
                </div>
                <div class="chart-card-subtitle">Advisee Academic Status Summary — นักศึกษาในที่ปรึกษาทั้งหมด ${total} คน (GPA เฉลี่ย ${avgGpa})</div>
            </div>
            <div class="career-list-scroll" style="max-height: 400px; padding-right: 4px;">
                <div class="career-item">
                    <div class="career-item-header">
                        <div class="career-name-group">
                            <span class="career-icon">📗</span>
                            <span class="career-name">กำลังศึกษา (ยังไม่จบ)</span>
                        </div>
                        <div class="career-stat-group">
                            <span class="career-count">${studying.length} คน</span>
                            <span class="career-badge badge-green">${studyingPct}%</span>
                        </div>
                    </div>
                    <div class="career-progress-bg">
                        <div class="career-progress-fill" style="width: ${studyingPct}%; background: linear-gradient(90deg, #16a34a, #22c55e);"></div>
                    </div>
                </div>

                <div class="career-item">
                    <div class="career-item-header">
                        <div class="career-name-group">
                            <span class="career-icon">🎓</span>
                            <span class="career-name">จบการศึกษาแล้ว</span>
                        </div>
                        <div class="career-stat-group">
                            <span class="career-count">${graduated.length} คน</span>
                            <span class="career-badge badge-blue">${graduatedPct}%</span>
                        </div>
                    </div>
                    <div class="career-progress-bg">
                        <div class="career-progress-fill" style="width: ${graduatedPct}%; background: linear-gradient(90deg, #2563eb, #3b82f6);"></div>
                    </div>
                </div>

                <div class="career-item item-business">
                    <div class="career-item-header">
                        <div class="career-name-group">
                            <span class="career-icon">⏸️</span>
                            <span class="career-name">พักการศึกษา (ลาพักการเรียน)</span>
                        </div>
                        <div class="career-stat-group">
                            <span class="career-count">${onLeave.length} คน</span>
                            <span class="career-badge badge-business">${onLeavePct}%</span>
                        </div>
                    </div>
                    <div class="career-progress-bg">
                        <div class="career-progress-fill fill-business" style="width: ${onLeavePct}%;"></div>
                    </div>
                </div>

                <div class="career-item item-unemployed">
                    <div class="career-item-header">
                        <div class="career-name-group">
                            <span class="career-icon">⛔</span>
                            <span class="career-name">พ้นสภาพการเป็นนักศึกษา</span>
                        </div>
                        <div class="career-stat-group">
                            <span class="career-count">${dismissed.length} คน</span>
                            <span class="career-badge badge-unemployed">${dismissedPct}%</span>
                        </div>
                    </div>
                    <div class="career-progress-bg">
                        <div class="career-progress-fill fill-unemployed" style="width: ${dismissedPct}%;"></div>
                    </div>
                </div>
            </div>
            <div class="career-list-footer">
                <div class="career-legend-hint">
                    <span class="career-legend-dot" style="background:#22c55e"></span>
                    <span>กำลังศึกษา (ยังไม่จบ)</span>
                </div>
                <div class="career-legend-hint">
                    <span class="career-legend-dot" style="background:#3b82f6"></span>
                    <span>จบการศึกษาแล้ว</span>
                </div>
                <div class="career-legend-hint">
                    <span class="career-legend-dot" style="background:#f59e0b"></span>
                    <span>พักการเรียน</span>
                </div>
                <div class="career-legend-hint">
                    <span class="career-legend-dot" style="background:#ef4444"></span>
                    <span>พ้นสภาพ</span>
                </div>
            </div>
        </div>

        <!-- Bottom Card: Batch Breakdown -->
        <div class="card">
            <div class="card-title">📦 จำนวนนักศึกษาในความดูแลแยกตามรุ่น</div>
            <div class="stat-row" style="margin-bottom:0">${batchBreakdown}</div>
        </div>
    `;

    // Load component CSS for progress bars
    loadComponentCSS('statusChart');
    bindAdviseeButtons(document.getElementById('advisorDashboardContent'));
}
