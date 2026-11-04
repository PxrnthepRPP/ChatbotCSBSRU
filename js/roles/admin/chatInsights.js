/* ============================================================
   BSRU Student Portal — Admin: chat usage history & statistics
   - usage numbers, questions per day / hour, by role and by how they were answered
   - most asked questions and questions the bot could not answer (turn either into a FAQ)
   - satisfaction (3 levels)
   - who may look back at their own chats: per role, with per-person overrides
   - one person's chats at a time (never a mixed list of everyone's messages)
   ============================================================ */

import { esc, showToast } from '../../utils.js';
import { fetchAPI } from '../../api.js';
import { loadComponentCSS } from '../../css-loader.js';
import { renderSafeMarkdown } from '../../components/chatbot.js';
import { apiErrorText } from './shared.js';
import { openFaqEditor } from './faq.js';

const ROLE_LABEL = { STUDENT: 'นักศึกษา', ADVISOR: 'อาจารย์', ADMIN: 'ผู้ดูแลระบบ', GUEST: 'ผู้ใช้ทั่วไป (ไม่ล็อกอิน)' };
const SOURCE_LABEL = {
    FAQ_EXACT: 'ตอบจาก FAQ ตรงตัว', FAQ_SUGGESTED: 'ใช้ FAQ ประกอบ', AI: 'AI ตอบ',
    FALLBACK: 'ระบบตอบสำรอง (ไม่ใช้ AI)', NO_ANSWER: 'ตอบไม่ได้',
};
const LEVEL = { 1: { emoji: '😞', label: 'ไม่พอใจ' }, 2: { emoji: '😐', label: 'พอใช้' }, 3: { emoji: '😊', label: 'พอใจมาก' } };
const DATE_TIME = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });
const when = iso => iso ? DATE_TIME.format(new Date(iso)) : '-';

let rangeDays = 30;
let peopleSearch = '';

export async function renderChatInsights() {
    const container = document.getElementById('chatInsightsContent');
    if (!container) return;
    loadComponentCSS('faqInsights');
    container.innerHTML = '<div class="card"><p style="color:var(--text-muted)">กำลังโหลดสถิติ...</p></div>';
    let data, access, people;
    try {
        [data, access, people] = await Promise.all([
            fetchAPI(`/admin/chat-insights/analytics?days=${rangeDays}`, 'GET', null, 15000),
            fetchAPI('/admin/chat-insights/access', 'GET', null, 10000),
            fetchAPI(`/admin/chat-insights/people${peopleSearch ? `?q=${encodeURIComponent(peopleSearch)}` : ''}`, 'GET', null, 10000),
        ]);
    } catch (err) {
        container.innerHTML = `<div class="card"><p style="color:var(--red-500)">${esc(apiErrorText(err))}</p></div>`;
        return;
    }
    if (!container.isConnected) return;

    const sat = data.satisfaction;
    const noAnswer = data.bySource.NO_ANSWER || 0;
    const satPct = level => sat.total ? Math.round((sat.byLevel[level] || 0) * 100 / sat.total) : 0;

    container.innerHTML = `
        <div class="ci-range">
            <label for="ciRange">ช่วงเวลา</label>
            <select id="ciRange" class="batch-select">
                ${[7, 30, 90, 365].map(d => `<option value="${d}" ${d === rangeDays ? 'selected' : ''}>${d === 365 ? '1 ปี' : d + ' วัน'}ล่าสุด</option>`).join('')}
            </select>
            <button type="button" class="btn btn-sm btn-ghost" id="ciRefresh">รีเฟรช</button>
        </div>

        <div class="stat-row">
            <div class="stat-card"><div class="stat-icon blue">💬</div><div><div class="stat-value">${data.questions}</div><div class="stat-label">คำถามทั้งหมด</div></div></div>
            <div class="stat-card"><div class="stat-icon purple">👥</div><div><div class="stat-value">${data.people}</div><div class="stat-label">ผู้ใช้ที่ถาม</div></div></div>
            <div class="stat-card"><div class="stat-icon red">❔</div><div><div class="stat-value">${noAnswer}</div><div class="stat-label">ตอบไม่ได้ (${data.questions ? Math.round(noAnswer * 100 / data.questions) : 0}%)</div></div></div>
            <div class="stat-card"><div class="stat-icon green">⭐</div><div><div class="stat-value">${sat.average != null ? sat.average.toFixed(2) : '-'}<span style="font-size:0.8rem;font-weight:400"> / 3</span></div><div class="stat-label">ความพึงพอใจเฉลี่ย (${sat.total} คน)</div></div></div>
        </div>

        <div class="ci-grid">
            <div class="card">
                <div class="card-title">📈 จำนวนคำถามรายวัน</div>
                ${barChart(data.perDay.map(d => ({ label: DAY.format(new Date(d.date)), value: d.count })))}
            </div>
            <div class="card">
                <div class="card-title">🕐 ช่วงเวลาที่ใช้งาน</div>
                ${barChart(data.perHour.map((v, h) => ({ label: `${String(h).padStart(2, '0')}`, value: v })))}
            </div>
            <div class="card">
                <div class="card-title">👤 แยกตามผู้ใช้</div>
                ${hbars(Object.entries(data.byRole).map(([k, v]) => ({ label: ROLE_LABEL[k] || k, value: v })))}
            </div>
            <div class="card">
                <div class="card-title">🤖 วิธีที่ระบบตอบ</div>
                ${hbars(Object.entries(data.bySource).map(([k, v]) => ({ label: SOURCE_LABEL[k] || k, value: v })))}
            </div>
        </div>

        <div class="card">
            <div class="card-title">⭐ ความพึงพอใจ (${sat.total} ครั้ง)</div>
            <div class="ci-sat">
                ${[3, 2, 1].map(l => `
                    <div class="ci-sat-item">
                        <div class="ci-sat-emoji">${LEVEL[l].emoji}</div>
                        <div><strong>${LEVEL[l].label}</strong><div class="ci-muted">${sat.byLevel[l] || 0} ครั้ง · ${satPct(l)}%</div></div>
                        <div class="ci-bar"><span style="width:${satPct(l)}%"></span></div>
                    </div>`).join('')}
            </div>
            <div class="table-wrap" style="margin-top:12px">
                <table class="data-table">
                    <thead><tr><th>ผู้ใช้</th>${[3, 2, 1].map(l => `<th style="text-align:center">${LEVEL[l].emoji} ${LEVEL[l].label}</th>`).join('')}</tr></thead>
                    <tbody>${Object.entries(sat.byRole).map(([role, lv]) => `<tr><td>${esc(ROLE_LABEL[role] || role)}</td>${[3, 2, 1].map(l => `<td style="text-align:center">${lv[l] || 0}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>
        </div>

        <div class="ci-grid">
            <div class="card">
                <div class="card-title">🔥 คำถามที่ถูกถามบ่อย</div>
                ${questionTable(data.topQuestions, 'ci-top')}
            </div>
            <div class="card">
                <div class="card-title">❔ คำถามที่ระบบตอบไม่ได้ <span class="ci-muted" style="font-weight:400">(ควรเพิ่มเป็น FAQ)</span></div>
                ${questionTable(data.unanswered, 'ci-unanswered')}
            </div>
        </div>

        <div class="card">
            <div class="card-title">❓ FAQ ที่ถูกใช้ตอบบ่อย</div>
            ${data.topFaqs.length ? `<div class="table-wrap"><table class="data-table">
                <thead><tr><th>หมวด</th><th>คำถาม</th><th style="text-align:center">ใช้ตอบ</th><th>ล่าสุด</th></tr></thead>
                <tbody>${data.topFaqs.map(f => `<tr><td><span class="badge badge-purple">${esc(f.category || 'ทั่วไป')}</span></td><td>${esc(f.question)}</td><td style="text-align:center">${f.hitCount}</td><td class="ci-muted">${esc(when(f.lastHitAt))}</td></tr>`).join('')}</tbody>
            </table></div>` : '<p class="ci-muted">ยังไม่มี FAQ ที่ถูกใช้ตอบ</p>'}
        </div>

        ${accessCard(access)}

        <div class="card">
            <div class="toolbar">
                <div class="card-title" style="margin-bottom:0">🗂️ ประวัติแชทรายบุคคล</div>
                <div class="toolbar-search">
                    <input type="text" id="ciPeopleSearch" placeholder="ค้นหารหัส / ชื่อ..." value="${esc(peopleSearch)}" aria-label="ค้นหาผู้ใช้">
                </div>
            </div>
            <p class="ci-muted" style="margin:0 0 10px">เลือกดูได้ทีละคน · ผู้ใช้ทุกคนเห็นได้เฉพาะแชทของตัวเองเท่านั้น (ถ้าได้รับอนุญาต)</p>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>ผู้ใช้</th><th>บทบาท</th><th style="text-align:center">คำถาม</th><th>ใช้ล่าสุด</th><th>ดูแชทเก่าของตัวเอง</th><th></th></tr></thead>
                    <tbody>${people.length ? people.map(p => `
                        <tr data-key="${esc(p.personKey)}">
                            <td><strong>${esc(p.displayName)}</strong><div class="ci-muted">${esc(p.personKey)}</div></td>
                            <td>${esc(ROLE_LABEL[p.role] || p.role)}</td>
                            <td style="text-align:center">${p.questions}</td>
                            <td class="ci-muted">${esc(when(p.lastAt))}</td>
                            <td>
                                <select class="batch-select ci-person-access" aria-label="สิทธิ์ดูแชทเก่าของ ${esc(p.displayName)}">
                                    <option value="" ${p.override == null ? 'selected' : ''}>ตามบทบาท (${access.roles[p.role] ? 'ได้' : 'ไม่ได้'})</option>
                                    <option value="true" ${p.override === true ? 'selected' : ''}>อนุญาต</option>
                                    <option value="false" ${p.override === false ? 'selected' : ''}>ไม่อนุญาต</option>
                                </select>
                            </td>
                            <td><button type="button" class="btn btn-sm btn-primary ci-view-log">ดูแชท</button></td>
                        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">ยังไม่มีประวัติการใช้งาน</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;

    container.querySelector('#ciRange').addEventListener('change', e => { rangeDays = Number(e.target.value); renderChatInsights(); });
    container.querySelector('#ciRefresh').addEventListener('click', renderChatInsights);
    const search = container.querySelector('#ciPeopleSearch');
    let t;
    search.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        clearTimeout(t);
        peopleSearch = search.value.trim();
        renderChatInsights();
    });
    search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { peopleSearch = search.value.trim(); renderChatInsights(); }, 700);
    });

    container.querySelectorAll('.ci-make-faq').forEach(btn => btn.addEventListener('click', () =>
        openFaqEditor({ question: btn.dataset.question })));

    container.querySelectorAll('.ci-role-access').forEach(box => box.addEventListener('change', async () => {
        try {
            await fetchAPI(`/admin/chat-insights/access/roles/${box.dataset.role}`, 'PUT', { allowed: box.checked }, 8000);
            showToast('success', esc(`${ROLE_LABEL[box.dataset.role]}: ${box.checked ? 'ดูแชทเก่าของตัวเองได้' : 'ดูแชทเก่าไม่ได้'}`));
            renderChatInsights();
        } catch (err) {
            box.checked = !box.checked;
            showToast('error', esc(apiErrorText(err)));
        }
    }));

    container.querySelectorAll('.ci-override-remove').forEach(btn => btn.addEventListener('click', () =>
        setPersonAccess(btn.dataset.key, null)));

    container.querySelector('#ciOverrideAdd')?.addEventListener('click', () => {
        const key = container.querySelector('#ciOverrideKey').value.trim();
        const value = container.querySelector('#ciOverrideValue').value === 'true';
        if (!key) return showToast('error', 'กรุณาใส่ผู้ใช้ เช่น student:6421100042');
        setPersonAccess(key.includes(':') ? key : (/^\d{10}$/.test(key) ? `student:${key}` : `advisor:${key}`), value);
    });

    container.querySelectorAll('tr[data-key]').forEach(row => {
        const key = row.dataset.key;
        row.querySelector('.ci-view-log').addEventListener('click', () => openPersonLog(key, row.querySelector('strong').textContent));
        row.querySelector('.ci-person-access').addEventListener('change', e =>
            setPersonAccess(key, e.target.value === '' ? null : e.target.value === 'true'));
    });
}

async function setPersonAccess(personKey, allowed) {
    try {
        await fetchAPI('/admin/chat-insights/access/people', 'PUT', { personKey, allowed }, 8000);
        showToast('success', esc(allowed == null ? `${personKey}: กลับไปใช้สิทธิ์ตามบทบาท` : `${personKey}: ${allowed ? 'อนุญาต' : 'ไม่อนุญาต'}ให้ดูแชทเก่าของตัวเอง`));
        renderChatInsights();
    } catch (err) {
        showToast('error', esc(apiErrorText(err)));
    }
}

function accessCard(access) {
    return `
        <div class="card">
            <div class="card-title">🔐 สิทธิ์ดูประวัติแชทย้อนหลังของตัวเอง</div>
            <p class="ci-muted" style="margin:0 0 12px">ตั้งตามบทบาทก่อน แล้วถ้าต้องการให้บางคนต่างจากบทบาทของเขา ตั้งรายคนทับได้ ·
                ผู้ที่ได้รับอนุญาตจะเห็นปุ่ม 🕘 ในหน้าต่างแชท และเห็นเฉพาะแชทของตัวเอง ·
                ไม่ว่าจะเห็นหรือไม่ AI จะจำบทสนทนาเก่าของคนนั้นได้เสมอ (เฉพาะของคนนั้น)</p>
            <div class="ci-roles">
                ${Object.entries(access.roles).map(([role, allowed]) => `
                    <label class="faq-check"><input type="checkbox" class="ci-role-access" data-role="${role}" ${allowed ? 'checked' : ''}>
                        <span>${esc(ROLE_LABEL[role] || role)}</span></label>`).join('')}
            </div>
            <div class="ci-override-add">
                <input type="text" id="ciOverrideKey" class="ci-input" placeholder="รหัสนักศึกษา / รหัสอาจารย์ เช่น 6421100042 หรือ ADV-01" aria-label="ผู้ใช้ที่จะตั้งสิทธิ์">
                <select id="ciOverrideValue" class="batch-select" aria-label="สิทธิ์"><option value="true">อนุญาต</option><option value="false">ไม่อนุญาต</option></select>
                <button type="button" class="btn btn-sm btn-orange" id="ciOverrideAdd">ตั้งสิทธิ์รายคน</button>
            </div>
            ${access.people.length ? `<div class="table-wrap" style="margin-top:10px"><table class="data-table">
                <thead><tr><th>ผู้ใช้ที่ตั้งรายคน</th><th>บทบาท</th><th>สิทธิ์</th><th></th></tr></thead>
                <tbody>${access.people.map(p => `<tr><td><strong>${esc(p.displayName)}</strong><div class="ci-muted">${esc(p.personKey)}</div></td>
                    <td>${esc(ROLE_LABEL[p.role] || p.role)}</td>
                    <td>${p.allowed ? '<span class="badge badge-green">อนุญาต</span>' : '<span class="badge badge-red">ไม่อนุญาต</span>'}</td>
                    <td><button type="button" class="btn btn-sm btn-ghost ci-override-remove" data-key="${esc(p.personKey)}">ใช้ตามบทบาท</button></td></tr>`).join('')}</tbody>
            </table></div>` : ''}
        </div>`;
}

function questionTable(list, cls) {
    if (!list.length) return '<p class="ci-muted">ยังไม่มีข้อมูลในช่วงนี้</p>';
    return `<div class="table-wrap"><table class="data-table ${cls}">
        <thead><tr><th>คำถาม</th><th style="text-align:center">ครั้ง</th><th>ตอบโดย</th><th></th></tr></thead>
        <tbody>${list.map(q => `<tr>
            <td>${esc(q.question)}<div class="ci-muted">ล่าสุด ${esc(when(q.lastAt))}</div></td>
            <td style="text-align:center"><strong>${q.count}</strong></td>
            <td class="ci-muted">${esc(SOURCE_LABEL[q.lastSource] || '-')}</td>
            <td><button type="button" class="btn btn-sm btn-ghost ci-make-faq" data-question="${esc(q.question)}" title="สร้างคำถามที่พบบ่อยจากคำถามนี้">+ FAQ</button></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

function barChart(points) {
    const max = Math.max(1, ...points.map(p => p.value));
    const step = Math.ceil(points.length / 10);
    return `<div class="ci-chart" role="img" aria-label="กราฟแท่ง">
        ${points.map((p, i) => `<div class="ci-col" title="${esc(p.label)}: ${p.value}">
            <span class="ci-col-bar" style="height:${Math.round(p.value * 100 / max)}%"></span>
            <span class="ci-col-label">${i % step === 0 ? esc(p.label) : ''}</span>
        </div>`).join('')}
    </div>`;
}

function hbars(items) {
    const max = Math.max(1, ...items.map(i => i.value));
    return items.map(i => `<div class="ci-hbar">
        <span class="ci-hbar-label">${esc(i.label)}</span>
        <span class="ci-bar"><span style="width:${Math.round(i.value * 100 / max)}%"></span></span>
        <strong>${i.value}</strong>
    </div>`).join('');
}

async function openPersonLog(personKey, name) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
        <div class="modal-card" style="max-width:760px;width:94vw;max-height:88vh;display:flex;flex-direction:column" role="dialog" aria-labelledby="ciLogTitle">
            <div class="modal-header">
                <h3 id="ciLogTitle">ประวัติแชท: ${esc(name)}</h3>
                <button type="button" class="modal-close" aria-label="ปิด">✕</button>
            </div>
            <div class="modal-body ci-log"><p class="ci-muted">กำลังโหลด...</p></div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    overlay.querySelector('.modal-close').focus();
    const body = overlay.querySelector('.ci-log');
    try {
        const list = await fetchAPI(`/admin/chat-insights/people/log?key=${encodeURIComponent(personKey)}`, 'GET', null, 15000);
        if (!list.length) { body.innerHTML = '<p class="ci-muted">ไม่มีข้อความ</p>'; return; }
        const dayFmt = new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' });
        const timeFmt = new Intl.DateTimeFormat('th-TH', { timeStyle: 'short' });
        let lastDay = '';
        body.innerHTML = list.map(m => {
            const d = new Date(m.createdAt);
            const day = dayFmt.format(d);
            const head = day !== lastDay ? `<div class="ci-log-day">${esc(day)}</div>` : '';
            lastDay = day;
            const user = m.sender === 'USER';
            return `${head}<div class="ci-log-msg ${user ? 'user' : 'bot'}">
                <div class="ci-log-meta">${user ? '🧑 ผู้ใช้' : '🤖 แชทบอท'} · ${esc(timeFmt.format(d))}${m.source && !user ? ` · ${esc(SOURCE_LABEL[m.source] || m.source)}` : ''}</div>
                <div>${user ? esc(m.message) : renderSafeMarkdown(m.message)}</div>
            </div>`;
        }).join('');
        body.scrollTop = body.scrollHeight;
    } catch (err) {
        body.innerHTML = `<p style="color:var(--red-500)">${esc(apiErrorText(err))}</p>`;
    }
}
