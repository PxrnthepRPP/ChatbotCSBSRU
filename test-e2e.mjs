// test-e2e.mjs - Comprehensive E2E API Test Suite for BSRU Student Portal
const BASE_URL = 'http://localhost:8080/api';

const results = [];

function recordResult(testName, passed, details, latencyMs = 0) {
  results.push({ testName, passed, details, latencyMs });
  const badge = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${badge} | ${testName} (${latencyMs}ms) -> ${details}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 BSRU STUDENT PORTAL - END-TO-END (E2E) API TEST');
  console.log('====================================================\n');

  let adminToken = null;
  let advisorToken = null;
  let studentToken = null;
  let targetStudentCode = null;
  let createdPetitionId = null;

  // 1. Health Check
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.status === 'UP';
    recordResult(
      'System Health Check (GET /api/health)',
      pass,
      `Status: ${data.status}, DB: ${data.database}, Students: ${data.studentsCount}, Petitions: ${data.petitionsCount}`,
      ms
    );
  } catch (err) {
    recordResult('System Health Check (GET /api/health)', false, err.message);
  }

  // 2. Authentication - Student
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'student', password: '1234' }),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.role === 'ROLE_STUDENT' && !!data.token;
    studentToken = data.token;
    recordResult(
      'Student Login (POST /api/auth/login)',
      pass,
      `User: ${data.username}, Role: ${data.role}, DisplayName: ${data.displayName}`,
      ms
    );
  } catch (err) {
    recordResult('Student Login (POST /api/auth/login)', false, err.message);
  }

  // 3. Authentication - Advisor
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'advisor', password: '1234' }),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.role === 'ROLE_ADVISOR' && !!data.token;
    advisorToken = data.token;
    recordResult(
      'Advisor Login (POST /api/auth/login)',
      pass,
      `User: ${data.username}, Role: ${data.role}, DisplayName: ${data.displayName}`,
      ms
    );
  } catch (err) {
    recordResult('Advisor Login (POST /api/auth/login)', false, err.message);
  }

  // 4. Authentication - Admin
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '1234' }),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.role === 'ROLE_ADMIN' && !!data.token;
    adminToken = data.token;
    recordResult(
      'Admin Login (POST /api/auth/login)',
      pass,
      `User: ${data.username}, Role: ${data.role}, DisplayName: ${data.displayName}`,
      ms
    );
  } catch (err) {
    recordResult('Admin Login (POST /api/auth/login)', false, err.message);
  }

  // 5. Authentication Validation - Empty / Invalid Username
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '1234' }),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 400 && !!data.error;
    recordResult(
      'Auth Validation: Reject Blank Username (400 Bad Request)',
      pass,
      `Status Code: ${res.status}, Error Message: ${data.error}`,
      ms
    );
  } catch (err) {
    recordResult('Auth Validation: Reject Blank Username (400 Bad Request)', false, err.message);
  }

  // 6. Students List API (GET /api/students)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && Array.isArray(data) && data.length > 0;
    if (pass) {
      targetStudentCode = data[0].studentId;
    }
    recordResult(
      'Retrieve Students List (GET /api/students)',
      pass,
      `Total count: ${data.length}, First student: ${data[0]?.nameTh} (${data[0]?.studentId})`,
      ms
    );
  } catch (err) {
    recordResult('Retrieve Students List (GET /api/students)', false, err.message);
  }

  // 7. Student Detail API (GET /api/students/:studentId)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students/${targetStudentCode}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.studentId === targetStudentCode;
    recordResult(
      'Retrieve Student Profile Detail (GET /api/students/:studentId)',
      pass,
      `StudentId: ${data.studentId}, Name: ${data.nameTh}, GPA: ${data.gpa}, Year: ${data.year}, Status: ${data.status}`,
      ms
    );
  } catch (err) {
    recordResult('Retrieve Student Profile Detail (GET /api/students/:studentId)', false, err.message);
  }

  // 8. Student Career Update (PATCH /api/students/:studentId/career)
  try {
    const t0 = performance.now();
    const updateBody = {
      careerPath: 'Full-Stack Developer',
      employmentStatus: 'มีงานทำแล้ว (ตรงสาย)',
      companyName: 'BSRU Tech Innovations Ltd.',
      salaryRange: '30,001 - 45,000 บาท',
    };
    const res = await fetch(`${BASE_URL}/students/${targetStudentCode}/career`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(updateBody),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass =
      res.status === 200 &&
      data.careerPath === 'Full-Stack Developer' &&
      data.companyName === 'BSRU Tech Innovations Ltd.';
    recordResult(
      'Graduate Career Tracking Update (PATCH /api/students/:studentId/career)',
      pass,
      `Updated Career: ${data.careerPath}, Status: ${data.employmentStatus}, Company: ${data.companyName}`,
      ms
    );
  } catch (err) {
    recordResult('Graduate Career Tracking Update (PATCH /api/students/:studentId/career)', false, err.message);
  }

  // 9. Advisors List API (GET /api/advisors)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/advisors`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && Array.isArray(data) && data.length > 0;
    recordResult(
      'Retrieve Advisors List (GET /api/advisors)',
      pass,
      `Total count: ${data.length}, First advisor: ${data[0]?.nameTh} (ID: ${data[0]?.id}, Dept: ${data[0]?.department})`,
      ms
    );
  } catch (err) {
    recordResult('Retrieve Advisors List (GET /api/advisors)', false, err.message);
  }

  // 10. Academic Petition Creation (POST /api/petitions)
  try {
    const t0 = performance.now();
    const petitionPayload = {
      studentId: targetStudentCode,
      type: 'คำร้องขอสอบหัวข้อโครงงานวิจัย',
      title: 'ขอสอบหัวข้อปริญญานิพนธ์ประจำภาคเรียนที่ 1/2569',
      details: 'ขออนุมัติสอบหัวข้อโครงงานวิจัยเรื่อง ระบบผู้ช่วยอัจฉริยะสำหรับนักศึกษาด้วย RAG และ Gemini',
      attachment: 'documents/e2e_proposal_2026.pdf',
    };
    const res = await fetch(`${BASE_URL}/petitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(petitionPayload),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 201 && !!data.id && data.status === 'รอดำเนินการ';
    if (pass) {
      createdPetitionId = data.id;
    }
    recordResult(
      'Submit Academic Petition (POST /api/petitions)',
      pass,
      `Created Petition ID: ${data.id}, Type: ${data.type}, Title: "${data.title}", Status: ${data.status}`,
      ms
    );
  } catch (err) {
    recordResult('Submit Academic Petition (POST /api/petitions)', false, err.message);
  }

  // 11. Academic Petitions List (GET /api/petitions)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/petitions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && Array.isArray(data) && data.length > 0;
    recordResult(
      'Retrieve Petitions List (GET /api/petitions)',
      pass,
      `Total Petitions in DB: ${data.length}, Found newly created: ${data.some((p) => p.id === createdPetitionId)}`,
      ms
    );
  } catch (err) {
    recordResult('Retrieve Petitions List (GET /api/petitions)', false, err.message);
  }

  // 12. Admin Review Petition Status (PATCH /api/petitions/:id/status)
  if (createdPetitionId) {
    try {
      const t0 = performance.now();
      const reviewPayload = {
        status: 'อนุมัติ',
        adminComment: 'อนุมัติหัวข้อโครงงานวิจัยเรียบร้อย นัดหมายสอบหัวข้อวันที่ 10 พฤศจิกายน 2569 ณ ห้องประชุม CS-301',
      };
      const res = await fetch(`${BASE_URL}/petitions/${createdPetitionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(reviewPayload),
      });
      const data = await res.json();
      const ms = Math.round(performance.now() - t0);
      const pass = res.status === 200 && data.status === 'อนุมัติ' && data.adminComment.includes('อนุมัติ');
      recordResult(
        'Admin Review & Approve Petition (PATCH /api/petitions/:id/status)',
        pass,
        `Petition ID: ${data.id}, Status: ${data.status}, Comment: ${data.adminComment}`,
        ms
      );
    } catch (err) {
      recordResult('Admin Review & Approve Petition (PATCH /api/petitions/:id/status)', false, err.message);
    }
  }

  // 13. AI Chatbot Assistant (POST /api/chat)
  try {
    const t0 = performance.now();
    const chatPayload = {
      message: 'เกณฑ์การสำเร็จการศึกษาสาขาวิทยาการคอมพิวเตอร์ต้องเรียนกี่หน่วยกิต',
      sessionId: 'e2e-test-session-001',
    };
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatPayload),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && typeof data.reply === 'string' && data.reply.length > 10;
    recordResult(
      'AI Chatbot RAG Assistant (POST /api/chat)',
      pass,
      `SessionId: ${data.sessionId}, Length: ${data.reply?.length} chars, Preview: "${data.reply?.substring(0, 80).replace(/\n/g, ' ')}..."`,
      ms
    );
  } catch (err) {
    recordResult('AI Chatbot RAG Assistant (POST /api/chat)', false, err.message);
  }

  // 14. Admin Knowledge Ingestion (POST /api/admin/knowledge/ingest)
  try {
    const t0 = performance.now();
    const ingestPayload = {
      content: 'ข้อบังคับมหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา ว่าด้วยการลงทะเบียนเรียนข้ามสถาบัน พ.ศ. 2569: นักศึกษาที่มีความประสงค์จะลงทะเบียนเรียนรายวิชาในสถาบันอุดมศึกษาอื่นเพื่อเทียบโอนหน่วยกิต จะต้องได้รับความเห็นชอบจากอาจารย์ที่ปรึกษาและคณบดีก่อนเปิดภาคเรียนอย่างน้อย 30 วัน',
      source: 'bsru_cross_institution_2026.pdf',
    };
    const res = await fetch(`${BASE_URL}/admin/knowledge/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(ingestPayload),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.message.includes('successfully');
    recordResult(
      'Admin Knowledge Ingestion to Vector DB (POST /api/admin/knowledge/ingest)',
      pass,
      `Message: ${data.message}, Source: ${data.source}, Chars: ${data.contentLength}`,
      ms
    );
  } catch (err) {
    recordResult('Admin Knowledge Ingestion to Vector DB (POST /api/admin/knowledge/ingest)', false, err.message);
  }

  // 15. Security Boundary: Reject Unauthorized Request without Bearer Token
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/admin/knowledge/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Test unauth' }),
    });
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 401 || res.status === 403;
    recordResult(
      'Security Boundary: Reject Unauthorized Request without Token (401/403)',
      pass,
      `HTTP Status: ${res.status} (Access Denied as expected)`,
      ms
    );
  } catch (err) {
    recordResult('Security Boundary: Reject Unauthorized Request without Token (401/403)', false, err.message);
  }

  // Summary
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log('\n====================================================');
  console.log(`📊 E2E API TEST SUMMARY: ${passedCount}/${total} PASSED (${failedCount} FAILED)`);
  console.log('====================================================\n');

  return { total, passedCount, failedCount, results };
}

runTests().then((res) => {
  if (res.failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
