import { esc, getBatch } from '../../utils.js';

/** Full-screen roster view for a course section */
export function openSectionStudentsModal(section, students) {
    let overlay = document.getElementById('advSectionRosterModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'advSectionRosterModal';
        overlay.className = 'modal-overlay';
        overlay.style.padding = '0';
        document.body.appendChild(overlay);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    }

    let searchQuery = '';
    let statusFilter = 'ALL';
    const confirmedCount = students.filter(st => st.status !== 'PENDING').length;
    const pendingCount = students.filter(st => st.status === 'PENDING').length;
    const seatText = section.capacity ? `${students.length} / ${section.capacity} ???????` : `${students.length} ??`;

    const closeRoster = () => {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    };

    overlay.innerHTML = `
        <div class="modal-card" style="width:100vw !important;max-width:100vw !important;height:100vh !important;max-height:100vh !important;margin:0 !important;border-radius:0 !important;display:flex;flex-direction:column;overflow:hidden">
            <div class="modal-header" style="padding:16px 24px;flex-shrink:0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
                <div>
                    <h3 style="margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:1.15rem">
                        <span>?? ????????????????????????</span>
                        <span class="badge badge-blue">${esc(section.courseCode)}</span>
                        <span>${esc(section.courseName)}</span>
                        <span class="badge badge-green">????? ${esc(section.sectionNo)}</span>
                    </h3>
                    <div style="font-size:0.84rem;color:var(--text-muted);margin-top:4px">
                        ???????? ${esc(section.term)}/${esc(section.academicYear)} ? ${esc(section.dayName)} ${esc(section.startTime)}?${esc(section.endTime)} ? ???? ${esc(section.room || '-')} ? ????????? <strong>${esc(seatText)}</strong>
                    </div>
                </div>
                <button type="button" class="btn btn-sm btn-orange" id="advSectionRosterClose" style="padding:8px 16px">
                    ? ??????????? (Esc)
                </button>
            </div>
            <div class="modal-body" style="padding:20px 24px;flex:1;display:flex;flex-direction:column;overflow:hidden;gap:14px">
                <div class="batch-filter-bar" style="margin:0;flex-shrink:0">
                    <label>?????</label>
                    <select class="batch-select" id="advRosterStatusFilter">
                        <option value="ALL">??????? (${students.length} ??)</option>
                        <option value="ENROLLED">?????????? (${confirmedCount} ??)</option>
                        <option value="PENDING">?????????????? (${pendingCount} ??)</option>
                    </select>
                    <div class="filter-result-count" id="advRosterCountText">???? <strong>${students.length}</strong> ??? ${students.length} ??</div>
                    <div class="toolbar-search" style="margin-left:auto">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="advRosterSearchInput" placeholder="????????????????? ????????-???????...">
                    </div>
                </div>
                <div class="card" style="padding:0;flex:1;overflow:auto;margin:0">
                    <table class="data-table" style="width:100%">
                        <thead style="position:sticky;top:0;z-index:2">
                            <tr>
                                <th style="width:64px;text-align:center">#</th>
                                <th style="width:160px">????????????</th>
                                <th style="width:100px">????</th>
                                <th>????-???????</th>
                                <th class="hide-mobile" style="width:140px">?????? / ?????</th>
                                <th class="hide-mobile">????????????</th>
                                <th style="width:160px">??????????????</th>
                            </tr>
                        </thead>
                        <tbody id="advRosterTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>`;

    const renderRows = () => {
        const q = searchQuery.toLowerCase();
        const filtered = students.filter(st => {
            if (statusFilter === 'PENDING' && st.status !== 'PENDING') return false;
            if (statusFilter === 'ENROLLED' && st.status === 'PENDING') return false;
            if (!q) return true;
            return (st.studentId || '').toLowerCase().includes(q)
                || (st.nameTh || '').toLowerCase().includes(q)
                || (st.nameEn || '').toLowerCase().includes(q);
        });

        const countEl = overlay.querySelector('#advRosterCountText');
        if (countEl) {
            countEl.innerHTML = `???? <strong>${filtered.length}</strong> ??? ${students.length} ??`;
        }

        const tbody = overlay.querySelector('#advRosterTableBody');
        if (!tbody) return;
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--text-muted)">${students.length === 0 ? '????????????????????????????????????????' : '?????????????????????????????'}</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((st, idx) => {
            const batch = getBatch(st.studentId || '');
            const yearSec = [st.year ? `?? ${esc(st.year)}` : '', st.studentSection ? `Sec ${esc(st.studentSection)}` : ''].filter(Boolean).join(' ? ') || '-';
            const contact = [st.email ? esc(st.email) : '', st.phone ? esc(st.phone) : ''].filter(Boolean).join(' ? ') || '-';
            const stBadge = st.status === 'PENDING'
                ? '<span class="badge badge-amber">??????????????</span>'
                : '<span class="badge badge-green">??????????</span>';
            return `
                <tr>
                    <td style="text-align:center;color:var(--text-muted)">${idx + 1}</td>
                    <td><strong>${esc(st.studentId)}</strong></td>
                    <td>${batch ? `<span class="batch-tag batch-${batch}">???? ${batch}</span>` : '-'}</td>
                    <td>
                        <div style="font-weight:600">${esc(st.nameTh)}</div>
                        ${st.nameEn ? `<div style="font-size:0.78rem;color:var(--text-muted)">${esc(st.nameEn)}</div>` : ''}
                    </td>
                    <td class="hide-mobile">${yearSec}</td>
                    <td class="hide-mobile" style="font-size:0.82rem;color:var(--text-muted)">${contact}</td>
                    <td>${stBadge}</td>
                </tr>`;
        }).join('');
    };

    renderRows();

    overlay.querySelector('#advSectionRosterClose')?.addEventListener('click', closeRoster);
    overlay.querySelector('#advRosterStatusFilter')?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        renderRows();
    });
    overlay.querySelector('#advRosterSearchInput')?.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderRows();
    });

    document.body.style.overflow = 'hidden';
    overlay.classList.add('open');
    overlay.querySelector('#advRosterSearchInput')?.focus();
}
