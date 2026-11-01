// test-wp7-frontend.mjs — Automated verification for WP-7 Frontend Architecture & Infra
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function check(name, fn) {
    try {
        fn();
        passed++;
        console.log(`✅ PASS | ${name}`);
    } catch (err) {
        failed++;
        console.error(`❌ FAIL | ${name} -> ${err.message}`);
    }
}

console.log('======================================================================');
console.log('🧪 WP-7 ARCHITECTURE, DYNAMIC API URL & MODULAR FRONTEND TEST SUITE');
console.log('======================================================================');

const { resolveApiBaseUrl } = await import('../js/api.js');

// 1. Dynamic API URL resolution across environments
check('Dynamic URL: Node.js default fallback -> http://localhost:8080/api', () => {
    delete globalThis.window;
    delete process.env.API_BASE_URL;
    assert.equal(resolveApiBaseUrl(), 'http://localhost:8080/api');
});

check('Dynamic URL: XAMPP localhost port 80 -> http://localhost:8080/api', () => {
    globalThis.window = { location: { protocol: 'http:', hostname: 'localhost', port: '' } };
    assert.equal(resolveApiBaseUrl(), 'http://localhost:8080/api');
});

check('Dynamic URL: Mobile Wi-Fi LAN IP on XAMPP -> http://192.168.1.45:8080/api', () => {
    globalThis.window = { location: { protocol: 'http:', hostname: '192.168.1.45', port: '' } };
    assert.equal(resolveApiBaseUrl(), 'http://192.168.1.45:8080/api');
});

check('Dynamic URL: Docker Nginx port 3000 -> /api', () => {
    globalThis.window = { location: { protocol: 'http:', hostname: 'localhost', port: '3000' } };
    assert.equal(resolveApiBaseUrl(), '/api');
});

check('Dynamic URL: Production HTTPS reverse proxy -> /api', () => {
    globalThis.window = { location: { protocol: 'https:', hostname: 'portal.bsru.ac.th', port: '' } };
    assert.equal(resolveApiBaseUrl(), '/api');
});

check('Dynamic URL: Explicit window.__API_BASE_URL__ override respected', () => {
    globalThis.window = {
        __API_BASE_URL__: 'https://staging-api.bsru.ac.th/api',
        location: { protocol: 'http:', hostname: 'localhost', port: '' },
    };
    assert.equal(resolveApiBaseUrl(), 'https://staging-api.bsru.ac.th/api');
    delete globalThis.window;
});

// 2. Nginx & Docker Compose configuration checks
check('Nginx reverse proxy config exists and proxies /api/ with 120s timeout & 10M body limit', () => {
    const nginx = fs.readFileSync('nginx.conf', 'utf8');
    assert.match(nginx, /location\s+\/api\//);
    assert.match(nginx, /proxy_pass\s+http:\/\/backend:8080\/api\/;/);
    assert.match(nginx, /proxy_read_timeout\s+120s;/);
    assert.match(nginx, /client_max_body_size\s+10M;/);
});

check('docker-compose.yml mounts nginx.conf and petition_uploads volume', () => {
    const compose = fs.readFileSync('docker-compose.yml', 'utf8');
    assert.match(compose, /nginx\.conf:\/etc\/nginx\/conf\.d\/default\.conf/);
    assert.match(compose, /petition_uploads:\/app\/uploads/);
});

// 3. Modular student.js decomposition & Vanilla ES6 .js extensions
const expectedModules = [
    'js/roles/student/profile.js',
    'js/roles/student/timetableView.js',
    'js/roles/student/gradesView.js',
    'js/roles/student/graduationView.js',
    'js/roles/student/petitionsView.js',
    'js/roles/student/activityView.js',
];

check('student.js decomposed into 5 dedicated submodules under js/roles/student/', () => {
    for (const mod of expectedModules) {
        assert.ok(fs.existsSync(mod), `Missing submodule: ${mod}`);
    }
    const coordStat = fs.statSync('js/roles/student.js');
    assert.ok(coordStat.size < 15000, `student.js coordinator should be lightweight (<15KB), got ${coordStat.size}B`);
});

check('student.js preserves initStudentDashboard() export & explicit .js extensions everywhere', () => {
    const coordinator = fs.readFileSync('js/roles/student.js', 'utf8');
    assert.match(coordinator, /export\s+function\s+initStudentDashboard\s*\(/);

    function walkJs(dir) {
        let out = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) out = out.concat(walkJs(full));
            else if (entry.name.endsWith('.js')) out.push(full);
        }
        return out;
    }

    for (const file of walkJs('js')) {
        const clean = fs.readFileSync(file, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        const importRe = /\bimport\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
        let m;
        while ((m = importRe.exec(clean)) !== null) {
            assert.ok(m[1].endsWith('.js'), `${file} has import without .js extension: ${m[1]}`);
        }
    }
});

check('advisor.js removes bulk AI risk button and provides per-student AI risk analysis buttons', () => {
    const advisorJs = fs.readFileSync('js/roles/advisor.js', 'utf8');
    assert.ok(!advisorJs.includes('วิเคราะห์ความเสี่ยงทั้งหมด'), 'Bulk AI risk analysis button text must be removed');
    assert.ok(!advisorJs.includes('adv-ai-all-btn'), 'Bulk adv-ai-all-btn class must be removed');
    assert.ok(!advisorJs.includes('ASK_ALL'), 'Unused ASK_ALL prompt constant must be removed');
    const oneBtnMatches = advisorJs.match(/adv-ai-one-btn/g) || [];
    assert.ok(oneBtnMatches.length >= 4, `Expected per-student adv-ai-one-btn in risk card, modal, advisees list, and event binder (found ${oneBtnMatches.length})`);
});

check('advisor petitions page (พิจารณาคำร้องนักศึกษา) is completely removed from advisor UI', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const mainJs = fs.readFileSync('js/main.js', 'utf8');
    const advisorJs = fs.readFileSync('js/roles/advisor.js', 'utf8');

    assert.ok(!html.includes('mod-advisor-petitions'), 'mod-advisor-petitions section must be removed from index.html');
    assert.ok(!html.includes('advisorPetitionsContent'), 'advisorPetitionsContent container must be removed from index.html');
    assert.ok(!mainJs.includes('advisor-petitions'), 'advisor-petitions nav/route must be removed from js/main.js');
    assert.ok(!mainJs.includes('renderAdvisorPetitions'), 'renderAdvisorPetitions import/call must be removed from js/main.js');
    assert.ok(!advisorJs.includes('renderAdvisorPetitions'), 'renderAdvisorPetitions must be removed from js/roles/advisor.js');
});

check('advisor course section roster opens in full-screen modal instead of inline appended div', () => {
    const advisorJs = fs.readFileSync('js/roles/advisor.js', 'utf8');
    assert.ok(!advisorJs.includes('advSectionStudents'), 'Inline appended #advSectionStudents div must be removed');
    assert.ok(advisorJs.includes('openSectionStudentsModal'), 'Full-screen openSectionStudentsModal must exist');
    assert.ok(advisorJs.includes('advSectionRosterModal'), 'Full-screen #advSectionRosterModal overlay must exist');
    assert.ok(advisorJs.includes('100vw') && advisorJs.includes('100vh'), 'Roster modal must use 100vw x 100vh full-screen dimensions');
});

const { BSRU_ACTIVITY_CRITERIA } = await import('../js/roles/student/activityView.js');
check('BSRU_ACTIVITY_CRITERIA includes all 17 official BSRU activity categories and exact required counts (sum = 37)', () => {
    assert.equal(BSRU_ACTIVITY_CRITERIA.length, 17);
    const totalMin = BSRU_ACTIVITY_CRITERIA.reduce((sum, c) => sum + c.minRequired, 0);
    assert.equal(totalMin, 37);
    const names = BSRU_ACTIVITY_CRITERIA.map(c => c.name);
    for (const expectedName of [
        'ปฐมนิเทศรวม', 'วันพิราลัย', 'วันสถาปนา ราชภัฏ', 'จิตสาธารณะ', 'ชมรม/ชุมนุม',
        'กิจกรรมเลือก (มหาวิทยาลัย)', 'อบรมทักษะชีวิต ชั้นปี 2', 'อบรมคุณธรรมจริยธรรม',
        'อบรมทักษะชีวิต ชั้นปี 3', 'พัฒนาทักษะดิจิทัลเพื่อรองรับการทำงาน', 'กิจกรรมบังคับ (คณะ)',
        'ปฐมนิเทศคณะ', 'ศึกษาแหล่งเรียนรู้กรุงธนบุรีศึกษา', 'ปัจฉิมนิเทศ',
        'ทักษะดิจิทัลสำหรับนักศึกษาใหม่', 'ทักษะดิจิทัลสำหรับนักศึกษาชั้นปีสุดท้าย', 'กิจกรรมเลือก (คณะ)'
    ]) {
        assert.ok(names.includes(expectedName), `Missing BSRU activity category: ${expectedName}`);
    }
});

const { CLIENT_FORMS_CATALOG, matchClientForms } = await import('../js/components/chatbot.js');
check('All 16 official BSRU academic/registrar PDF forms exist in src/main/resources/forms and match chatbot queries', () => {
    assert.equal(CLIENT_FORMS_CATALOG.length, 16);
    for (const form of CLIENT_FORMS_CATALOG) {
        const resourcePath = path.join('src', 'main', 'resources', 'forms', form.fileName);
        assert.ok(fs.existsSync(resourcePath), `Missing Spring resource PDF form: ${resourcePath}`);
        assert.ok(fs.statSync(resourcePath).size > 1000, `PDF form appears empty: ${resourcePath}`);
    }
    assert.equal(matchClientForms('ขอใบรายงานผลการศึกษา ทบ.4')[0]?.fileName, 'R4.pdf');
    assert.equal(matchClientForms('ขอใบลาป่วยหน่อยครับ')[0]?.fileName, 'leave-form.pdf');
    assert.equal(matchClientForms('แบบฟอร์มจิตอาสา กยศ')[0]?.fileName, 'volunteer-form.pdf');
    assert.equal(matchClientForms('มีแบบฟอร์มคำร้องและเอกสารอะไรให้ดาวน์โหลดบ้าง').length, 16);

    const chatbotJs = fs.readFileSync('js/components/chatbot.js', 'utf8');
    assert.ok(chatbotJs.includes('cw-attachment-card'), 'chatbot.js must render interactive PDF attachment cards');
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);

