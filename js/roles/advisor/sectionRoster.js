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

/** Section roster modal using the portal's standard modal + app-form-panel theme */
export function openSectionStudentsModal(section, students) {
    let overlay = document.getElementById('advSectionRosterModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'advSectionRosterModal';
        overlay.className = 'modal-overlay';
        overlay.setAttribute('data-own-escape', '');
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    } else {
        overlay.className = 'modal-overlay';
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

    const metaLine = [
        section.dayName ? `${esc(section.dayName)} ${esc(section.startTime)}–${esc(section.endTime)}` : '',
        section.room ? `ห้อง ${esc(section.room)}` : '',
        section.credits ? `${esc(section.credits)} หน่วยกิต` : '',
        section.instructorName ? esc(section.instructorName) : '',
    ].filter(Boolean).join(' · ');

    overlay.innerHTML = `
        <div class="modal-card" style="max-width:940px;width:94vw;max-height:88vh;overflow:auto">
            <div class="modal-header">
                <h3>รายชื่อนักศึกษา ${esc(section.courseCode)} กลุ่ม ${esc(section.sectionNo)} (${esc(section.term)}/${esc(section.academicYear)})</h3>
                <button type="button" class="modal-close" id="advSectionRosterClose" aria-label="ปิด">✕</button>
            </div>
            <div class="modal-body" style="max-height:none">
                <div class="app-form-panel" style="margin-top:0">
                    <div class="app-form-header">
                        <div>
                            <div class="app-form-title">👥 ${esc(section.courseCode)} ${esc(section.courseName)} · Sec ${esc(section.sectionNo)} · ภาค ${esc(section.term)}/${esc(section.academicYear)}</div>
                            <div class="app-form-subtitle" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                                <span class="badge badge-blue">ที่นั่ง ${esc(seatSummaryValue)} · ${esc(seatSummarySub)}</span>
                                <span class="badge badge-green">ยืนยันแล้ว ${confirmedCount} คน</span>
                                <span class="badge badge-amber">รอยืนยัน ${pendingCount} คน</span>
                            </div>
                        </div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                            <button type="button" class="btn btn-sm btn-ghost" id="advSectionRosterExport" ${totalCount === 0 ? 'disabled title="ยังไม่มีรายชื่อให้ส่งออก"' : 'title="ส่งออกรายชื่อเป็นไฟล์ CSV (รองรับ Excel)"'} style="padding:4px 10px;font-size:0.8rem">📥 ส่งออก CSV</button>
                            <button type="button" class="btn btn-sm btn-ghost" id="advSectionRosterClosePanel" style="padding:4px 10px;font-size:0.8rem">✕ ปิด</button>
                        </div>
                    </div>
                    ${metaLine ? `<p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 10px">${metaLine}</p>` : ''}

                    <div class="batch-filter-bar" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">
                        <div class="audit-view-btn-group" role="tablist" aria-label="กรองตามสถานะลงทะเบียน">
                            <button type="button" class="audit-view-btn active" data-status-tab="ALL">ทั้งหมด (${totalCount})</button>
                            <button type="button" class="audit-view-btn" data-status-tab="ENROLLED">ยืนยันแล้ว (${confirmedCount})</button>
                            <button type="button" class="audit-view-btn" data-status-tab="PENDING">รอยืนยัน (${pendingCount})</button>
                        </div>
                        ${batches.length > 1 ? `
                        <select class="batch-select" id="advRosterBatchFilter" aria-label="กรองตามรุ่นรหัสนักศึกษา">
                            <option value="ALL">ทุกรุ่น (${totalCount})</option>
                            ${batches.map(b => `<option value="${esc(b)}">รุ่น ${esc(b)}</option>`).join('')}
                        </select>` : ''}
                        <div class="toolbar-search" style="flex:1;min-width:200px">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="advRosterSearchInput" placeholder="ค้นหารหัสนักศึกษา, ชื่อ-นามสกุล, อีเมล...">
                        </div>
                        <div class="filter-result-count" id="advRosterCountText">
                            แสดง <strong>${totalCount}</strong> จาก ${totalCount} คน
                        </div>
                    </div>

                    <div class="table-wrap" style="margin-bottom:0">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width:52px;text-align:center">#</th>
                                    <th>รหัสนักศึกษา</th>
                                    <th>ชื่อ-นามสกุล</th>
                                    <th>รุ่น / ชั้นปี</th>
                                    <th class="hide-mobile">ช่องทางติดต่อ</th>
                                    <th>สถานะลงทะเบียน</th>
                                </tr>
                            </thead>
                            <tbody id="advRosterTableBody"></tbody>
                        </table>
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
                                    ? 'เมื่อนักศึกษาลงทะเบียนวิชานี้ รายชื่อจะแสดงในหน้านี้อัตโนมัติ'
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

            const stBadge = st.status === 'PENDING'
                ? '<span class="badge badge-amber">รอยืนยัน</span>'
                : '<span class="badge badge-green">ยืนยันแล้ว</span>';

            const contactParts = [
                st.email ? `<a href="mailto:${esc(st.email)}" style="color:var(--brand-500)">${esc(st.email)}</a>` : '',
                st.phone ? `<a href="tel:${esc(st.phone)}" style="color:var(--text-muted)">${esc(st.phone)}</a>` : '',
            ].filter(Boolean).join('<br>');

            return `
                <tr>
                    <td style="text-align:center;color:var(--text-muted)">${idx + 1}</td>
                    <td><strong>${esc(st.studentId || '-')}</strong></td>
                    <td>
                        <div>${esc(st.nameTh || '-')}</div>
                        ${st.nameEn ? `<div style="font-size:0.75rem;color:var(--text-muted)">${esc(st.nameEn)}</div>` : ''}
                    </td>
                    <td>
                        ${batch ? `<span class="batch-tag batch-${esc(batch)}">รุ่น ${esc(batch)}</span> ` : ''}
                        ${yearSecParts ? `<span style="font-size:0.8rem;color:var(--text-muted)">${yearSecParts}</span>` : (!batch ? '<span style="color:var(--text-muted)">-</span>' : '')}
                    </td>
                    <td class="hide-mobile" style="font-size:0.8rem">${contactParts || '<span style="color:var(--text-muted)">-</span>'}</td>
                    <td>${stBadge}</td>
                </tr>`;
        }).join('');
    };

    renderRows();

    overlay.querySelector('#advSectionRosterClose')?.addEventListener('click', closeRoster);
    overlay.querySelector('#advSectionRosterClosePanel')?.addEventListener('click', closeRoster);
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
