import { esc, getBatch } from '../../utils.js';

/** Extract a clean avatar initial from Thai/English student name */
function studentInitial(st) {
    const cleanEn = (st.nameEn || '').replace(/^(Mr\.|Ms\.|Mrs\.|Miss)\s*/i, '').trim();
    if (cleanEn) {
        const parts = cleanEn.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    }
    const cleanTh = (st.nameTh || '').replace(/^(นางสาว|น\.ส\.|นาย|นาง|ด\.ช\.|ด\.ญ\.)\s*/, '').trim();
    const consonant = cleanTh.match(/[ก-ฮ]/);
    return consonant ? consonant[0] : 'นศ';
}

/** Escape a single CSV cell */
function csvCell(val) {
    const str = String(val ?? '').replace(/"/g, '""');
    return /[",\r\n]/.test(str) ? `"${str}"` : str;
}

/** Download the roster as an Excel-compatible UTF-8 CSV file */
function downloadRosterCsv(section, rows) {
    const headers = [
        'ลำดับ',
        'รหัสนักศึกษา',
        'รุ่น',
        'ชื่อ-นามสกุล (ไทย)',
        'ชื่อ-นามสกุล (อังกฤษ)',
        'ชั้นปี',
        'กลุ่มเรียน (Sec)',
        'อีเมล',
        'เบอร์โทรศัพท์',
        'สถานะลงทะเบียน',
    ];
    const lines = [
        headers.map(csvCell).join(','),
        ...rows.map((st, idx) => {
            const batch = getBatch(st.studentId || '');
            const statusText = st.status === 'PENDING' ? 'รอยืนยัน' : 'ยืนยันแล้ว';
            return [
                idx + 1,
                st.studentId || '',
                batch ? `รุ่น ${batch}` : '',
                st.nameTh || '',
                st.nameEn || '',
                st.year ? `ปี ${st.year}` : '',
                st.studentSection || '',
                st.email || '',
                st.phone || '',
                statusText,
            ].map(csvCell).join(',');
        }),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeCode = (section.courseCode || 'course').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeSec = (section.sectionNo || 'sec').replace(/[^a-zA-Z0-9_-]/g, '');
    a.href = url;
    a.download = `รายชื่อนักศึกษา_${safeCode}_Sec${safeSec}_${section.term || 1}-${section.academicYear || ''}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** Full-screen roster view for a course section */
export function openSectionStudentsModal(section, students) {
    let overlay = document.getElementById('advSectionRosterModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'advSectionRosterModal';
        overlay.className = 'modal-overlay roster-overlay';
        document.body.appendChild(overlay);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    } else {
        overlay.classList.add('roster-overlay');
    }

    const list = Array.isArray(students) ? students : [];
    let searchQuery = '';
    let statusFilter = 'ALL';
    let batchFilter = 'ALL';

    const totalCount = list.length;
    const confirmedCount = list.filter(st => st.status !== 'PENDING').length;
    const pendingCount = list.filter(st => st.status === 'PENDING').length;

    const capacity = Number(section.capacity) > 0 ? Number(section.capacity) : null;
    const seatPct = capacity ? Math.min(100, Math.round((totalCount / capacity) * 100)) : 0;
    const seatsLeft = capacity !== null ? Math.max(0, capacity - totalCount) : null;
    const seatFillTone = seatPct >= 95 ? 'red' : seatPct >= 75 ? 'amber' : '';
    const seatSummaryValue = capacity ? `${totalCount} / ${capacity}` : `${totalCount} คน`;
    const seatSummarySub = capacity
        ? (seatsLeft > 0 ? `ว่างอีก ${seatsLeft} ที่นั่ง (${seatPct}%)` : 'ที่นั่งเต็มแล้ว (100%)')
        : 'ไม่จำกัดจำนวนที่นั่ง';

    const batches = [...new Set(list.map(st => getBatch(st.studentId || '')).filter(Boolean))].sort().reverse();

    const closeRoster = () => {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    };

    const getFiltered = () => {
        const q = searchQuery.toLowerCase();
        return list.filter(st => {
            if (statusFilter === 'PENDING' && st.status !== 'PENDING') return false;
            if (statusFilter === 'ENROLLED' && st.status === 'PENDING') return false;
            if (batchFilter !== 'ALL' && getBatch(st.studentId || '') !== batchFilter) return false;
            if (!q) return true;
            return (st.studentId || '').toLowerCase().includes(q)
                || (st.nameTh || '').toLowerCase().includes(q)
                || (st.nameEn || '').toLowerCase().includes(q)
                || (st.email || '').toLowerCase().includes(q)
                || (st.phone || '').toLowerCase().includes(q);
        });
    };

    overlay.innerHTML = `
        <div class="roster-shell" style="width:100vw;height:100vh">
            <!-- ═══ Hero Header ═══ -->
            <header class="roster-hero">
                <div class="roster-hero-inner">
                    <div class="roster-hero-main">
                        <div class="roster-eyebrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            <span>รายชื่อนักศึกษาในกลุ่มเรียน · Class Roster</span>
                        </div>
                        <div class="roster-title-row">
                            <span class="roster-course-code">${esc(section.courseCode)}</span>
                            <h3 class="roster-course-name">${esc(section.courseName)}</h3>
                            <span class="roster-sec-pill">กลุ่ม ${esc(section.sectionNo)}</span>
                        </div>
                        <div class="roster-meta-list">
                            <span class="roster-meta-chip">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                ภาคเรียน ${esc(section.term)}/${esc(section.academicYear)}
                            </span>
                            <span class="roster-meta-chip">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                ${esc(section.dayName)} ${esc(section.startTime)}–${esc(section.endTime)}
                            </span>
                            <span class="roster-meta-chip">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                ห้อง ${esc(section.room || '-')}
                            </span>
                            ${section.credits ? `
                            <span class="roster-meta-chip">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                ${esc(section.credits)} หน่วยกิต
                            </span>` : ''}
                            ${section.instructorName ? `
                            <span class="roster-meta-chip">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                ${esc(section.instructorName)}
                            </span>` : ''}
                        </div>
                    </div>
                    <div class="roster-hero-actions">
                        <button type="button" class="roster-btn-export" id="advSectionRosterExport" ${totalCount === 0 ? 'disabled title="ยังไม่มีรายชื่อให้ส่งออก"' : 'title="ส่งออกรายชื่อเป็นไฟล์ CSV (รองรับ Excel)"'}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            ส่งออก CSV
                        </button>
                        <button type="button" class="roster-btn-close" id="advSectionRosterClose">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            ปิดหน้าต่าง
                            <span class="roster-kbd">Esc</span>
                        </button>
                    </div>
                </div>
            </header>

            <!-- ═══ Main Content Body ═══ -->
            <div class="roster-body">
                <div class="roster-container">
                    <!-- KPI Summary Strip -->
                    <div class="roster-kpi-grid">
                        <div class="roster-kpi-card">
                            <div class="roster-kpi-icon brand">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10"/><path d="M7 12h6"/></svg>
                            </div>
                            <div class="roster-kpi-content">
                                <div class="roster-kpi-label">จำนวนที่นั่งในกลุ่มเรียน</div>
                                <div class="roster-kpi-value-row">
                                    <span class="roster-kpi-value">${esc(seatSummaryValue)}</span>
                                    <span class="roster-kpi-sub">${esc(seatSummarySub)}</span>
                                </div>
                                ${capacity ? `<div class="roster-seat-bar"><div class="roster-seat-fill ${seatFillTone}" style="width:${seatPct}%"></div></div>` : ''}
                            </div>
                        </div>

                        <div class="roster-kpi-card is-clickable is-active" data-kpi-filter="ALL" role="button" tabindex="0" title="คลิกเพื่อแสดงนักศึกษาทั้งหมด">
                            <div class="roster-kpi-icon blue">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            </div>
                            <div class="roster-kpi-content">
                                <div class="roster-kpi-label">นักศึกษาทั้งหมด</div>
                                <div class="roster-kpi-value-row">
                                    <span class="roster-kpi-value">${totalCount}</span>
                                    <span class="roster-kpi-sub">คน</span>
                                </div>
                            </div>
                        </div>

                        <div class="roster-kpi-card is-clickable" data-kpi-filter="ENROLLED" role="button" tabindex="0" title="คลิกเพื่อกรองเฉพาะนักศึกษาที่ยืนยันแล้ว">
                            <div class="roster-kpi-icon green">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            </div>
                            <div class="roster-kpi-content">
                                <div class="roster-kpi-label">ยืนยันการลงทะเบียนแล้ว</div>
                                <div class="roster-kpi-value-row">
                                    <span class="roster-kpi-value">${confirmedCount}</span>
                                    <span class="roster-kpi-sub">คน</span>
                                </div>
                            </div>
                        </div>

                        <div class="roster-kpi-card is-clickable" data-kpi-filter="PENDING" role="button" tabindex="0" title="คลิกเพื่อกรองเฉพาะคำขอที่รอยืนยัน">
                            <div class="roster-kpi-icon amber">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                            <div class="roster-kpi-content">
                                <div class="roster-kpi-label">รอยืนยันการลงทะเบียน</div>
                                <div class="roster-kpi-value-row">
                                    <span class="roster-kpi-value">${pendingCount}</span>
                                    <span class="roster-kpi-sub">คน</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Filter & Search Toolbar -->
                    <div class="roster-toolbar">
                        <div class="roster-toolbar-left">
                            <div class="roster-seg-group" role="tablist" aria-label="กรองตามสถานะลงทะเบียน">
                                <button type="button" class="roster-seg-btn active" data-status-tab="ALL">
                                    ทั้งหมด <span class="roster-seg-count">${totalCount}</span>
                                </button>
                                <button type="button" class="roster-seg-btn" data-status-tab="ENROLLED">
                                    ยืนยันแล้ว <span class="roster-seg-count">${confirmedCount}</span>
                                </button>
                                <button type="button" class="roster-seg-btn" data-status-tab="PENDING">
                                    รอยืนยัน <span class="roster-seg-count">${pendingCount}</span>
                                </button>
                            </div>
                            ${batches.length > 1 ? `
                            <select class="roster-batch-select" id="advRosterBatchFilter" aria-label="กรองตามรุ่นรหัสนักศึกษา">
                                <option value="ALL">ทุกรุ่น (${totalCount})</option>
                                ${batches.map(b => `<option value="${esc(b)}">รุ่น ${esc(b)}</option>`).join('')}
                            </select>` : ''}
                        </div>

                        <div class="roster-toolbar-right">
                            <div class="roster-result-text" id="advRosterCountText">
                                แสดง <strong>${totalCount}</strong> จาก ${totalCount} คน
                            </div>
                            <div class="roster-search-box">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" id="advRosterSearchInput" placeholder="ค้นหารหัสนักศึกษา, ชื่อ-นามสกุล, อีเมล...">
                                <button type="button" class="roster-search-clear" id="advRosterSearchClear" title="ล้างคำค้นหา">✕</button>
                            </div>
                        </div>
                    </div>

                    <!-- Student Roster Table Card -->
                    <div class="roster-table-card">
                        <div class="roster-table-scroll">
                            <table class="roster-table">
                                <thead>
                                    <tr>
                                        <th style="width:64px;text-align:center">#</th>
                                        <th style="width:160px">รหัสนักศึกษา</th>
                                        <th>ชื่อ-นามสกุล</th>
                                        <th style="width:200px">รุ่น / ชั้นปี</th>
                                        <th class="hide-mobile" style="width:260px">ช่องทางติดต่อ</th>
                                        <th style="width:160px">สถานะลงทะเบียน</th>
                                    </tr>
                                </thead>
                                <tbody id="advRosterTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    const syncFilterUi = () => {
        overlay.querySelectorAll('[data-status-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.statusTab === statusFilter);
        });
        overlay.querySelectorAll('[data-kpi-filter]').forEach(card => {
            card.classList.toggle('is-active', card.dataset.kpiFilter === statusFilter);
        });
        const clearBtn = overlay.querySelector('#advRosterSearchClear');
        if (clearBtn) clearBtn.classList.toggle('visible', searchQuery.length > 0);
    };

    const renderRows = () => {
        syncFilterUi();
        const filtered = getFiltered();

        const countEl = overlay.querySelector('#advRosterCountText');
        if (countEl) {
            countEl.innerHTML = `แสดง <strong>${filtered.length}</strong> จาก ${totalCount} คน`;
        }

        const tbody = overlay.querySelector('#advRosterTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
            const hasActiveFilter = statusFilter !== 'ALL' || batchFilter !== 'ALL' || searchQuery !== '';
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">
                        <div class="roster-empty">
                            <div class="roster-empty-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                    ${totalCount === 0
                                        ? '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>'
                                        : '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'}
                                </svg>
                            </div>
                            <div class="roster-empty-title">
                                ${totalCount === 0 ? 'ยังไม่มีนักศึกษาลงทะเบียนในกลุ่มเรียนนี้' : 'ไม่พบรายชื่อนักศึกษาตามเงื่อนไขที่ค้นหา'}
                            </div>
                            <div class="roster-empty-sub">
                                ${totalCount === 0
                                    ? 'เมื่อนักศึกษาส่งคำขอลงทะเบียนหรือได้รับการอนุมัติ รายชื่อจะแสดงในหน้านี้อัตโนมัติ'
                                    : 'ลองเปลี่ยนตัวกรองสถานะ หรือค้นหาด้วยรหัสนักศึกษาและชื่ออีกครั้ง'}
                            </div>
                            ${hasActiveFilter ? '<button type="button" class="btn btn-sm btn-ghost" id="advRosterResetFiltersBtn" style="margin-top:6px">ล้างตัวกรองทั้งหมด</button>' : ''}
                        </div>
                    </td>
                </tr>`;

            tbody.querySelector('#advRosterResetFiltersBtn')?.addEventListener('click', () => {
                statusFilter = 'ALL';
                batchFilter = 'ALL';
                searchQuery = '';
                const sInput = overlay.querySelector('#advRosterSearchInput');
                if (sInput) sInput.value = '';
                const bSelect = overlay.querySelector('#advRosterBatchFilter');
                if (bSelect) bSelect.value = 'ALL';
                renderRows();
            });
            return;
        }

        tbody.innerHTML = filtered.map((st, idx) => {
            const batch = getBatch(st.studentId || '');
            const yearSecParts = [
                st.year ? `ปี ${esc(st.year)}` : '',
                st.studentSection ? `Sec ${esc(st.studentSection)}` : '',
            ].filter(Boolean).join(' · ');

            const emailItem = st.email
                ? `<a class="roster-contact-item" href="mailto:${esc(st.email)}" title="ส่งอีเมล">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        <span>${esc(st.email)}</span>
                   </a>`
                : '';
            const phoneItem = st.phone
                ? `<a class="roster-contact-item" href="tel:${esc(st.phone)}" title="โทรศัพท์">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        <span>${esc(st.phone)}</span>
                   </a>`
                : '';
            const contactHtml = (emailItem || phoneItem)
                ? `<div class="roster-contact-list">${emailItem}${phoneItem}</div>`
                : '<span style="color:var(--text-muted)">-</span>';

            const stBadge = st.status === 'PENDING'
                ? '<span class="roster-status-pill pending">รอยืนยัน</span>'
                : '<span class="roster-status-pill enrolled">ยืนยันแล้ว</span>';

            return `
                <tr>
                    <td style="text-align:center"><span class="roster-row-num">${idx + 1}</span></td>
                    <td><span class="roster-sid-code">${esc(st.studentId || '-')}</span></td>
                    <td>
                        <div class="roster-student-cell">
                            <div class="roster-avatar">${esc(studentInitial(st))}</div>
                            <div>
                                <div class="roster-name-th">${esc(st.nameTh || '-')}</div>
                                ${st.nameEn ? `<div class="roster-name-en">${esc(st.nameEn)}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="roster-cohort-stack">
                            ${batch ? `<span class="batch-tag batch-${esc(batch)}">รุ่น ${esc(batch)}</span>` : ''}
                            ${yearSecParts ? `<span class="roster-year-pill">${yearSecParts}</span>` : (!batch ? '<span style="color:var(--text-muted)">-</span>' : '')}
                        </div>
                    </td>
                    <td class="hide-mobile">${contactHtml}</td>
                    <td>${stBadge}</td>
                </tr>`;
        }).join('');
    };

    renderRows();

    overlay.querySelector('#advSectionRosterClose')?.addEventListener('click', closeRoster);
    overlay.querySelector('#advSectionRosterExport')?.addEventListener('click', () => {
        const rowsToExport = getFiltered();
        downloadRosterCsv(section, rowsToExport.length > 0 ? rowsToExport : list);
    });

    overlay.querySelectorAll('[data-status-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            statusFilter = btn.dataset.statusTab;
            renderRows();
        });
    });

    overlay.querySelectorAll('[data-kpi-filter]').forEach(card => {
        const applyKpi = () => {
            statusFilter = card.dataset.kpiFilter;
            renderRows();
        };
        card.addEventListener('click', applyKpi);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                applyKpi();
            }
        });
    });

    overlay.querySelector('#advRosterBatchFilter')?.addEventListener('change', (e) => {
        batchFilter = e.target.value;
        renderRows();
    });

    const searchInput = overlay.querySelector('#advRosterSearchInput');
    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderRows();
    });

    overlay.querySelector('#advRosterSearchClear')?.addEventListener('click', () => {
        searchQuery = '';
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        renderRows();
    });

    document.body.style.overflow = 'hidden';
    overlay.classList.add('open');
    searchInput?.focus();
}
