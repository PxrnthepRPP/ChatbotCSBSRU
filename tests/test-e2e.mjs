// test-e2e.mjs - Comprehensive E2E API Test Suite for BSRU Student Portal
const BASE_URL = 'http://localhost:8080/api';

const results = [];

function recordResult(testName, passed, details, latencyMs = 0) {
  results.push({ testName, passed, details, latencyMs });
  const badge = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${badge} | ${testName} (${latencyMs}ms) -> ${details}`);
}

async function runTests() {
  console.log('======================================================================');
  console.log('🚀 BSRU STUDENT PORTAL - COMPREHENSIVE END-TO-END (E2E) TEST SUITE');
  console.log('======================================================================\n');

  let adminToken = null;
  let advisorToken = null;
  let studentToken = null;
  let studentUserId = null;
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
      body: JSON.stringify({ username: 'student', password: 'password' }),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.role === 'ROLE_STUDENT' && !!data.token;
    studentToken = data.token;
    studentUserId = data.userId;
    recordResult(
      'Student Login (POST /api/auth/login)',
      pass,
      `User: ${data.username}, Role: ${data.role}, DisplayName: ${data.displayName}, StudentID: ${studentUserId}`,
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
      body: JSON.stringify({ username: 'advisor', password: 'password' }),
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
      body: JSON.stringify({ username: 'admin', password: 'password' }),
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

  // 5. Auth Validation - Blank Username (400 Bad Request)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: 'password' }),
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 400 && !!data.error;
    recordResult(
      'Auth Security: Reject Blank Username (400 Bad Request)',
      pass,
      `Status: ${res.status}, Message: ${data.error}`,
      ms
    );
  } catch (err) {
    recordResult('Auth Security: Reject Blank Username (400 Bad Request)', false, err.message);
  }

  // 6. Auth Validation - Invalid Password (401 Unauthorized)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test_invalid_user', password: 'wrongpassword' }),
    });
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 401;
    recordResult(
      'Auth Security: Reject Invalid Password (401 Unauthorized)',
      pass,
      `Status: ${res.status} (Access Rejected)`,
      ms
    );
  } catch (err) {
    recordResult('Auth Security: Reject Invalid Password (401 Unauthorized)', false, err.message);
  }

  // 7. Students List API (GET /api/students as Admin)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && Array.isArray(data) && data.length > 0;
    if (pass) {
      // Pick another student code different from the logged in student
      const otherStudent = data.find((s) => s.studentId !== studentUserId);
      targetStudentCode = otherStudent ? otherStudent.studentId : data[0].studentId;
    }
    recordResult(
      'Retrieve Students List (GET /api/students)',
      pass,
      `Total count: ${data.length}, Sample student: ${data[0]?.nameTh} (${data[0]?.studentId})`,
      ms
    );
  } catch (err) {
    recordResult('Retrieve Students List (GET /api/students)', false, err.message);
  }

  // 8. Student Profile Self-Access (GET /api/students/:studentId as Student)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students/${studentUserId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.studentId === studentUserId;
    recordResult(
      'Student Profile Self-Access (GET /api/students/:selfId)',
      pass,
      `StudentId: ${data.studentId}, Name: ${data.nameTh}, GPA: ${data.gpa}, Year: ${data.year}, Status: ${data.status}`,
      ms
    );
  } catch (err) {
    recordResult('Student Profile Self-Access (GET /api/students/:selfId)', false, err.message);
  }

  // 9. Student Privacy Boundary: Block Student from Viewing Another Student (403 Forbidden)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students/${targetStudentCode}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 403;
    recordResult(
      'Student Privacy Boundary: Reject Viewing Other Student Profile (403 Forbidden)',
      pass,
      `Status: ${res.status} (Access Denied as expected to protect privacy)`,
      ms
    );
  } catch (err) {
    recordResult('Student Privacy Boundary: Reject Viewing Other Student Profile (403 Forbidden)', false, err.message);
  }

  // 10. Admin Access to Any Student Profile (GET /api/students/:studentId as Admin)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students/${targetStudentCode}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.studentId === targetStudentCode;
    recordResult(
      'Admin Access to Any Student Profile (GET /api/students/:targetId)',
      pass,
      `StudentId: ${data.studentId}, Name: ${data.nameTh}, GPA: ${data.gpa}`,
      ms
    );
  } catch (err) {
    recordResult('Admin Access to Any Student Profile (GET /api/students/:targetId)', false, err.message);
  }

  // 11. Student Academic Records & Grades (GET /api/students/:studentId/grades)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students/${studentUserId}/grades`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && (data.gpa !== undefined || Array.isArray(data.terms));
    recordResult(
      'Academic Records & Grades (GET /api/students/:id/grades)',
      pass,
      `GPA: ${data.gpa ?? 'N/A'}, Total Credits: ${data.totalCredits ?? 'N/A'}, Terms: ${data.terms?.length ?? 0}`,
      ms
    );
  } catch (err) {
    recordResult('Academic Records & Grades (GET /api/students/:id/grades)', false, err.message);
  }

  // 12. Graduation Progress (GET /api/students/:studentId/graduation-progress)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students/${studentUserId}/graduation-progress`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && data.requiredCredits > 0;
    recordResult(
      'Graduation Progress Tracking (GET /api/students/:id/graduation-progress)',
      pass,
      `Credits: ${data.earnedCredits}/${data.requiredCredits}, Status: ${data.status}, Core: ${data.coreEarned}/${data.coreRequired}`,
      ms
    );
  } catch (err) {
    recordResult('Graduation Progress Tracking (GET /api/students/:id/graduation-progress)', false, err.message);
  }

  // 13. Student Timetable (GET /api/students/:studentId/timetable)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/students/${studentUserId}/timetable`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && Array.isArray(data);
    recordResult(
      'Student Timetable Schedule (GET /api/students/:id/timetable)',
      pass,
      `Terms count: ${data.length}, First term: ${data[0]?.termLabel || data[0]?.academicYear || 'Term 1'}, Courses: ${data[0]?.sections?.length || 0}`,
      ms
    );
  } catch (err) {
    recordResult('Student Timetable Schedule (GET /api/students/:id/timetable)', false, err.message);
  }

  // 14. Student Career Update (PATCH /api/students/:studentId/career)
  try {
    const t0 = performance.now();
    const updateBody = {
      careerPath: 'Full-Stack Developer',
      employmentStatus: 'มีงานทำแล้ว (ตรงสาย)',
      companyName: 'BSRU Tech Innovations Ltd.',
      salaryRange: '30,001 - 45,000 บาท',
    };
    const res = await fetch(`${BASE_URL}/students/${studentUserId}/career`, {
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
      'Graduate Career Tracking Update (PATCH /api/students/:id/career)',
      pass,
      `Career: ${data.careerPath}, Status: ${data.employmentStatus}, Company: ${data.companyName}`,
      ms
    );
  } catch (err) {
    recordResult('Graduate Career Tracking Update (PATCH /api/students/:id/career)', false, err.message);
  }

  // 15. Advisors List API (GET /api/advisors)
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

  // 16. Advisor Profile (GET /api/advisors/me as Advisor)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/advisors/me`, {
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && !!data.id;
    recordResult(
      'Advisor Profile Insight (GET /api/advisors/me)',
      pass,
      `ID: ${data.id}, Name: ${data.nameTh}, Email: ${data.email}`,
      ms
    );
  } catch (err) {
    recordResult('Advisor Profile Insight (GET /api/advisors/me)', false, err.message);
  }

  // 17. Advisor Advisees & Risk Check (GET /api/advisors/me/advisees as Advisor)
  try {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/advisors/me/advisees`, {
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const pass = res.status === 200 && Array.isArray(data);
    recordResult(
      'Advisor Advisees & Risk Screening (GET /api/advisors/me/advisees)',
      pass,
      `Total Advisees: ${data.length}, Risk screening active`,
      ms
    );
  } catch (err) {
    recordResult('Advisor Advisees & Risk Screening (GET /api/advisors/me/advisees)', false, err.message);
  }

  // 18. Academic Petition Creation (POST /api/petitions)
  try {
    const t0 = performance.now();
    const petitionPayload = {
      studentId: studentUserId,
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

  // 19. Academic Petitions List (GET /api/petitions)
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

  // 20. Admin Review Petition Status (PATCH /api/petitions/:id/status)
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

  // 21. AI Chatbot Assistant (POST /api/chat)
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

  // 22. Admin Knowledge Ingestion (POST /api/admin/knowledge/ingest)
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

  // 23. Security Boundary: Reject Unauthorized Ingestion without Token (401/403)
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

  console.log('\n======================================================================');
  console.log(`📊 E2E API TEST SUMMARY: ${passedCount}/${total} PASSED (${failedCount} FAILED)`);
  console.log('======================================================================\n');

  return { total, passedCount, failedCount, results };
}

runTests().then((res) => {
  if (res.failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
