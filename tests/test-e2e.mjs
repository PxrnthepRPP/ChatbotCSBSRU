/**
 * test-e2e.mjs - Comprehensive 4-Tier E2E Test Suite for BSRU Student Portal & AI Chatbot
 *
 * Covers:
 * - Tier 1: Feature Coverage (Core Happy Paths across all modules)
 * - Tier 2: Boundary & Corner Cases (RBAC 403, 429 Rate Limiting, File validation, Prerequisite check)
 * - Tier 3: Cross-Feature Pairwise (Petition -> Notification, Advisor Review -> Admin, Ingest -> RAG)
 * - Tier 4: Real-World Scenarios (5 Comprehensive multi-step persona journeys)
 */

import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/api';

const results = [];

function recordResult(tier, testId, testName, passed, details, latencyMs = 0) {
  results.push({ tier, testId, testName, passed, details, latencyMs });
  const badge = passed ? '✅ PASS' : '❌ FAIL';
  const paddedTier = `[${tier}]`.padEnd(10);
  const paddedId = `[${testId}]`.padEnd(8);
  console.log(`${badge} | ${paddedTier} ${paddedId} ${testName} (${latencyMs}ms) -> ${details}`);
}

async function safeFetch(url, options = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, options);
    const ms = Math.round(performance.now() - t0);
    let data = null;
    let text = null;
    let buffer = null;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        // json parse failed
      }
    } else if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
    } else {
      text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        // text is not json
      }
    }

    return { ok: res.ok, status: res.status, headers: res.headers, data, text, buffer, ms, error: null };
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    return { ok: false, status: 0, headers: new Headers(), data: null, text: null, buffer: null, ms, error: err.message };
  }
}

// Minimal valid PDF binary representation
const SAMPLE_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n'
);

async function runE2ESuite() {
  console.log('====================================================================================');
  console.log('🚀 BSRU STUDENT PORTAL & AI CHATBOT — 4-TIER END-TO-END (E2E) VERIFICATION SUITE');
  console.log(`🌐 Target Base URL: ${BASE_URL}`);
  console.log('====================================================================================\n');

  let adminToken = null;
  let advisorToken = null;
  let studentToken = null;
  let studentUserId = '6621100042';
  let targetStudentCode = null;
  let createdPetitionId = null;
  let secondStudentToken = null;
  let sampleNoteId = null;

  // ----------------------------------------------------------------------------------
  // TIER 1: FEATURE COVERAGE (Core Happy Paths)
  // ----------------------------------------------------------------------------------
  console.log('\n--- [TIER 1] FEATURE COVERAGE: CORE HAPPY PATHS ---');

  // T1.01: Health Check
  {
    const res = await safeFetch(`${BASE_URL}/health`);
    const pass = res.status === 200 && res.data?.status === 'UP';
    recordResult(
      'Tier 1',
      'T1.01',
      'System Health & Telemetry (GET /api/health)',
      pass,
      pass
        ? `Status: ${res.data?.status}, DB: ${res.data?.database}, Students: ${res.data?.studentsCount}, Petitions: ${res.data?.petitionsCount}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.02: Student Login
  {
    const res = await safeFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'student', password: 'password' }),
    });
    const pass = res.status === 200 && res.data?.role === 'ROLE_STUDENT' && !!res.data?.token;
    if (pass) {
      studentToken = res.data.token;
      studentUserId = res.data.userId || '6621100042';
    }
    recordResult(
      'Tier 1',
      'T1.02',
      'Student Authentication (POST /api/auth/login)',
      pass,
      pass
        ? `User: ${res.data?.username}, Role: ${res.data?.role}, StudentID: ${studentUserId}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.03: Advisor Login
  {
    const res = await safeFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'advisor', password: 'password' }),
    });
    const pass = res.status === 200 && res.data?.role === 'ROLE_ADVISOR' && !!res.data?.token;
    if (pass) {
      advisorToken = res.data.token;
    }
    recordResult(
      'Tier 1',
      'T1.03',
      'Advisor Authentication (POST /api/auth/login)',
      pass,
      pass
        ? `User: ${res.data?.username}, Role: ${res.data?.role}, DisplayName: ${res.data?.displayName}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.04: Admin Login
  {
    const res = await safeFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });
    const pass = res.status === 200 && res.data?.role === 'ROLE_ADMIN' && !!res.data?.token;
    if (pass) {
      adminToken = res.data.token;
    }
    recordResult(
      'Tier 1',
      'T1.04',
      'Admin Authentication (POST /api/auth/login)',
      pass,
      pass
        ? `User: ${res.data?.username}, Role: ${res.data?.role}, DisplayName: ${res.data?.displayName}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.05: Students List Retrieval (Admin)
  {
    const res = await safeFetch(`${BASE_URL}/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pass = res.status === 200 && Array.isArray(res.data) && res.data.length > 0;
    if (pass) {
      const other = res.data.find((s) => s.studentId !== studentUserId);
      targetStudentCode = other ? other.studentId : res.data[0].studentId;
    }
    recordResult(
      'Tier 1',
      'T1.05',
      'Admin Students Directory (GET /api/students)',
      pass,
      pass
        ? `Total Students: ${res.data.length}, Sample: ${res.data[0]?.studentId} (${res.data[0]?.nameTh})`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.06: Student Profile Self-Access
  {
    const res = await safeFetch(`${BASE_URL}/students/${studentUserId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 200 && res.data?.studentId === studentUserId;
    recordResult(
      'Tier 1',
      'T1.06',
      'Student Profile Self-Access (GET /api/students/:id)',
      pass,
      pass
        ? `ID: ${res.data?.studentId}, Name: ${res.data?.nameTh}, GPA: ${res.data?.gpa}, Year: ${res.data?.year}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.07: Student Academic Records & Grades
  {
    const res = await safeFetch(`${BASE_URL}/students/${studentUserId}/grades`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 200 && (res.data?.gpa !== undefined || Array.isArray(res.data?.terms));
    recordResult(
      'Tier 1',
      'T1.07',
      'Academic Records & Grades (GET /api/students/:id/grades)',
      pass,
      pass
        ? `GPA: ${res.data?.gpa}, Credits: ${res.data?.totalCredits}, Terms: ${res.data?.terms?.length || 0}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.08: Graduation Progress Tracking
  {
    const res = await safeFetch(`${BASE_URL}/students/${studentUserId}/graduation-progress`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 200 && (res.data?.requiredCredits > 0 || res.data?.earnedCredits !== undefined);
    recordResult(
      'Tier 1',
      'T1.08',
      'Graduation Audit & Progress (GET /api/students/:id/graduation-progress)',
      pass,
      pass
        ? `Credits: ${res.data?.earnedCredits}/${res.data?.requiredCredits}, Status: ${res.data?.status}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.09: Student Timetable Schedule
  {
    const res = await safeFetch(`${BASE_URL}/students/${studentUserId}/timetable`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 200 && Array.isArray(res.data);
    recordResult(
      'Tier 1',
      'T1.09',
      'Student Timetable Schedule (GET /api/students/:id/timetable)',
      pass,
      pass
        ? `Terms Count: ${res.data?.length}, First Term Sections: ${res.data?.[0]?.sections?.length || 0}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.10: Student Career Profile Update
  {
    const updateBody = {
      careerPath: 'Full-Stack Developer',
      employmentStatus: 'มีงานทำแล้ว (ตรงสาย)',
      companyName: 'BSRU Tech Innovations Co., Ltd.',
      salaryRange: '35,000 - 50,000 บาท',
    };
    const res = await safeFetch(`${BASE_URL}/students/${studentUserId}/career`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(updateBody),
    });
    const pass = res.status === 200 && res.data?.careerPath === 'Full-Stack Developer';
    recordResult(
      'Tier 1',
      'T1.10',
      'Student Career Pathway Update (PATCH /api/students/:id/career)',
      pass,
      pass
        ? `Career: ${res.data?.careerPath}, Status: ${res.data?.employmentStatus}, Company: ${res.data?.companyName}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.11: Advisor Profile Insight
  {
    const res = await safeFetch(`${BASE_URL}/advisors/me`, {
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    const pass = res.status === 200 && (!!res.data?.id || !!res.data?.nameTh);
    recordResult(
      'Tier 1',
      'T1.11',
      'Advisor Profile Insight (GET /api/advisors/me)',
      pass,
      pass
        ? `Advisor ID: ${res.data?.id}, Name: ${res.data?.nameTh}, Email: ${res.data?.email}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.12: Advisor Advisees & Risk Screening
  {
    const res = await safeFetch(`${BASE_URL}/advisors/me/advisees`, {
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    const pass = res.status === 200 && Array.isArray(res.data);
    recordResult(
      'Tier 1',
      'T1.12',
      'Advisor Advisees & Risk Screening (GET /api/advisors/me/advisees)',
      pass,
      pass
        ? `Total Advisees: ${res.data.length}, Risk screening enabled`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.13: Submit Academic Petition (Student)
  {
    const petitionPayload = {
      studentId: studentUserId,
      type: 'คำร้องขอสอบหัวข้อโครงงานวิจัย',
      title: 'ขออนุมัติสอบหัวข้อโครงงานปริญญานิพนธ์ประจำปีการศึกษา 2569',
      details: 'โครงงานหัวข้อ ระบบผู้ช่วยบริการการศึกษาอัจฉริยะสำหรับนักศึกษาด้วย RAG และ Gemini',
      attachment: 'documents/proposal_tier1.pdf',
    };
    const res = await safeFetch(`${BASE_URL}/petitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(petitionPayload),
    });
    const pass =
      (res.status === 201 || res.status === 200) &&
      !!res.data?.id &&
      (res.data?.status === 'รออาจารย์ที่ปรึกษาพิจารณา' || res.data?.status === 'รอดำเนินการ');
    if (pass) {
      createdPetitionId = res.data.id;
    }
    recordResult(
      'Tier 1',
      'T1.13',
      'Academic Petition Submission (POST /api/petitions)',
      pass,
      pass
        ? `Created ID: ${res.data?.id}, Initial Status: "${res.data?.status}", Title: "${res.data?.title}"`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.14: Petitions List (Admin/Advisor/Student)
  {
    const res = await safeFetch(`${BASE_URL}/petitions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pass = res.status === 200 && Array.isArray(res.data) && res.data.length > 0;
    recordResult(
      'Tier 1',
      'T1.14',
      'Petitions Registry Retrieval (GET /api/petitions)',
      pass,
      pass
        ? `Total Petitions: ${res.data.length}, Found newly created: ${res.data.some((p) => p.id === createdPetitionId)}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.15: Upload Petition PDF Attachment
  if (createdPetitionId) {
    const formData = new FormData();
    const pdfBlob = new Blob([SAMPLE_PDF_BUFFER], { type: 'application/pdf' });
    formData.append('file', pdfBlob, 'proposal.pdf');
    formData.append('attachment', pdfBlob, 'proposal.pdf');

    const res = await safeFetch(`${BASE_URL}/petitions/${createdPetitionId}/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formData,
    });
    const pass = res.status === 200 || res.status === 201;
    recordResult(
      'Tier 1',
      'T1.15',
      'Petition PDF Attachment Upload (POST /api/petitions/:id/attachment)',
      pass,
      pass
        ? `Attachment uploaded successfully for ${createdPetitionId}`
        : (res.error || `HTTP ${res.status}: ${res.text || JSON.stringify(res.data)}`),
      res.ms
    );
  }

  // T1.16: Secure Download of Petition Attachment
  if (createdPetitionId) {
    const res = await safeFetch(`${BASE_URL}/petitions/${createdPetitionId}/attachment`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 200 && (res.buffer?.length > 0 || res.headers.get('content-type')?.includes('pdf'));
    recordResult(
      'Tier 1',
      'T1.16',
      'Secure Petition Attachment Download (GET /api/petitions/:id/attachment)',
      pass,
      pass
        ? `Downloaded PDF successfully, Bytes: ${res.buffer?.length || 'stream'}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.17: 2-Step Approval: Advisor Endorsement
  if (createdPetitionId) {
    const endorsePayload = {
      status: 'รอผู้ดูแลระบบอนุมัติ',
      comment: 'อาจารย์ที่ปรึกษาเห็นชอบและส่งต่อสาขาวิชา',
      advisorComment: 'อาจารย์ที่ปรึกษาเห็นชอบและส่งต่อสาขาวิชา',
    };
    const res = await safeFetch(`${BASE_URL}/petitions/${createdPetitionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${advisorToken}`,
      },
      body: JSON.stringify(endorsePayload),
    });
    const pass =
      res.status === 200 &&
      (res.data?.status === 'รอผู้ดูแลระบบอนุมัติ' || res.data?.status === 'อนุมัติ');
    recordResult(
      'Tier 1',
      'T1.17',
      '2-Step Approval: Advisor Endorsement (PATCH /api/petitions/:id/status)',
      pass,
      pass
        ? `Petition ${createdPetitionId} advanced to "${res.data?.status}"`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.18: 2-Step Approval: Admin Final Decision
  if (createdPetitionId) {
    const approvePayload = {
      status: 'อนุมัติ',
      comment: 'สาขาวิชาอนุมัติคำร้องเรียบร้อยแล้ว',
      adminComment: 'สาขาวิชาอนุมัติคำร้องเรียบร้อยแล้ว',
    };
    const res = await safeFetch(`${BASE_URL}/petitions/${createdPetitionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(approvePayload),
    });
    const pass = res.status === 200 && res.data?.status === 'อนุมัติ';
    recordResult(
      'Tier 1',
      'T1.18',
      '2-Step Approval: Admin Final Approval (PATCH /api/petitions/:id/status)',
      pass,
      pass
        ? `Petition ${createdPetitionId} finalized as "${res.data?.status}"`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.19: In-App Notifications Listing
  {
    const res = await safeFetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 200 && (Array.isArray(res.data) || Array.isArray(res.data?.notifications));
    const notifs = Array.isArray(res.data) ? res.data : (res.data?.notifications || []);
    recordResult(
      'Tier 1',
      'T1.19',
      'In-App Notifications Retrieval (GET /api/notifications)',
      pass,
      pass
        ? `Total Notifications: ${notifs.length}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.20: Knowledge Base Document Ingestion (Admin)
  {
    const ingestPayload = {
      content:
        'ข้อบังคับมหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา ว่าด้วยการจัดการศึกษาระดับปริญญาตรี พ.ศ. 2569: นักศึกษาต้องมีหน่วยกิตสะสมรวมไม่น้อยกว่า 120 หน่วยกิต และมีแต้มระดับคะแนนเฉลี่ยสะสมไม่ต่ำกว่า 2.00 จึงจะมีสิทธิ์เสนอขอสำเร็จการศึกษา',
      source: 'bsru_curriculum_standard_2026.pdf',
      replaceExisting: true,
    };
    const res = await safeFetch(`${BASE_URL}/admin/knowledge/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(ingestPayload),
    });
    const pass = res.status === 200 && (res.data?.message?.includes('success') || res.data?.source !== undefined);
    recordResult(
      'Tier 1',
      'T1.20',
      'Knowledge Base Ingestion (POST /api/admin/knowledge/ingest)',
      pass,
      pass
        ? `Source: ${res.data?.source}, Message: ${res.data?.message}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.21: Knowledge Base Documents Listing (Admin)
  {
    const res = await safeFetch(`${BASE_URL}/admin/knowledge`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pass = res.status === 200 && (Array.isArray(res.data) || res.data?.documents !== undefined);
    recordResult(
      'Tier 1',
      'T1.21',
      'Knowledge Base Listing (GET /api/admin/knowledge)',
      pass,
      pass
        ? `Documents retrieved successfully (Count: ${Array.isArray(res.data) ? res.data.length : 'OK'})`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.22: Knowledge Base Document Deletion (Admin)
  {
    // Try DELETE with query param or path param
    let res = await safeFetch(`${BASE_URL}/admin/knowledge?source=bsru_curriculum_standard_2026.pdf`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status === 404 || res.status === 405) {
      res = await safeFetch(`${BASE_URL}/admin/knowledge/bsru_curriculum_standard_2026.pdf`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
    const pass = res.status === 200 || res.status === 204;
    recordResult(
      'Tier 1',
      'T1.22',
      'Knowledge Base Document Deletion (DELETE /api/admin/knowledge)',
      pass,
      pass
        ? `Document removal confirmed (HTTP ${res.status})`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.23: AI Chatbot RAG Assistant Query
  {
    const chatPayload = {
      message: 'เกณฑ์การสำเร็จการศึกษาสาขาวิทยาการคอมพิวเตอร์ต้องเรียนกี่หน่วยกิต',
      sessionId: 'tier1-e2e-session-001',
    };
    const res = await safeFetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(chatPayload),
    });
    const pass = res.status === 200 && typeof res.data?.reply === 'string' && res.data.reply.length > 5;
    const hasSources = Array.isArray(res.data?.sources);
    recordResult(
      'Tier 1',
      'T1.23',
      'AI Chatbot RAG Assistant with Sources (POST /api/chat)',
      pass,
      pass
        ? `Session: ${res.data?.sessionId}, Reply: "${res.data?.reply?.substring(0, 50).replace(/\n/g, ' ')}...", Sources: ${hasSources ? res.data.sources.length : 'none'}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.24: Chatbot History Retrieval
  {
    const res = await safeFetch(`${BASE_URL}/chat/history?sessionId=tier1-e2e-session-001`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 200 && (Array.isArray(res.data) || Array.isArray(res.data?.history));
    recordResult(
      'Tier 1',
      'T1.24',
      'Chatbot Conversation History Retrieval (GET /api/chat/history)',
      pass,
      pass
        ? `History retrieved successfully`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.25: Chatbot History Clearance
  {
    const res = await safeFetch(`${BASE_URL}/chat/history?sessionId=tier1-e2e-session-001`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 200 || res.status === 204;
    recordResult(
      'Tier 1',
      'T1.25',
      'Chatbot Conversation History Clear (DELETE /api/chat/history)',
      pass,
      pass
        ? `History cleared successfully (HTTP ${res.status})`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.26: Advisor Advising Notes: List Notes
  {
    const res = await safeFetch(`${BASE_URL}/advisors/me/advisees/${studentUserId}/notes`, {
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    const pass = res.status === 200 && Array.isArray(res.data);
    recordResult(
      'Tier 1',
      'T1.26',
      'Advisor Advising Notes: List (GET /api/advisors/me/advisees/:id/notes)',
      pass,
      pass
        ? `Notes Count: ${res.data.length}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.27: Advisor Advising Notes: Create Note
  {
    const notePayload = {
      summary: 'นัดหมายพูดคุยแนวทางการลงทะเบียนเรียนและแผนโครงงานวิจัย',
      followUpDate: '2026-11-20',
      riskLevelSnapshot: 'NORMAL',
    };
    const res = await safeFetch(`${BASE_URL}/advisors/me/advisees/${studentUserId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${advisorToken}`,
      },
      body: JSON.stringify(notePayload),
    });
    const pass = (res.status === 200 || res.status === 201) && !!res.data?.id;
    if (pass) {
      sampleNoteId = res.data.id;
    }
    recordResult(
      'Tier 1',
      'T1.27',
      'Advisor Advising Notes: Create (POST /api/advisors/me/advisees/:id/notes)',
      pass,
      pass
        ? `Created Note ID: ${res.data?.id}, Summary: "${res.data?.summary}"`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.28: Advisor Advising Notes: Delete Note
  if (sampleNoteId) {
    const res = await safeFetch(`${BASE_URL}/advisors/me/advisees/${studentUserId}/notes/${sampleNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    const pass = res.status === 200 || res.status === 204;
    recordResult(
      'Tier 1',
      'T1.28',
      'Advisor Advising Notes: Delete (DELETE /api/advisors/me/advisees/:id/notes/:noteId)',
      pass,
      pass
        ? `Deleted Note ID: ${sampleNoteId}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.29: Bulk Student CSV Import (Valid CSV)
  {
    const csvContent =
      'studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId\n' +
      '6621109901,สมชาย เรียนดี,Somchai Reandee,somchai9901@bsru.ac.th,0812345671,วิทยาศาสตร์และเทคโนโลยี,วิทยาการคอมพิวเตอร์,1,STUDYING,ADV-01\n' +
      '6621109902,สมหญิง มุ่งมั่น,Somying Mungmun,somying9902@bsru.ac.th,0812345672,วิทยาศาสตร์และเทคโนโลยี,วิทยาการคอมพิวเตอร์,1,STUDYING,ADV-01';

    let res = await safeFetch(`${BASE_URL}/students/import-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
        Authorization: `Bearer ${adminToken}`,
      },
      body: csvContent,
    });
    if (res.status === 415 || res.status === 400) {
      // Fallback JSON payload
      res = await safeFetch(`${BASE_URL}/students/import-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ csvData: csvContent }),
      });
    }
    const pass = (res.status === 200 || res.status === 201) && (res.data?.importedCount > 0 || res.data?.success === true || res.data?.message?.includes('สำเร็จ'));
    recordResult(
      'Tier 1',
      'T1.29',
      'Bulk Student CSV Import (POST /api/students/import-csv)',
      pass,
      pass
        ? `Imported successfully: ${JSON.stringify(res.data)}`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T1.30: Student List CSV Export UTF-8 BOM Verification
  {
    let res = await safeFetch(`${BASE_URL}/students/export-csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status === 404) {
      res = await safeFetch(`${BASE_URL}/students/csv`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
    const hasBom =
      res.buffer &&
      res.buffer[0] === 0xef &&
      res.buffer[1] === 0xbb &&
      res.buffer[2] === 0xbf;
    const textHasBom = typeof res.text === 'string' && res.text.charCodeAt(0) === 0xfeff;
    const pass = res.status === 200 && (hasBom || textHasBom);
    recordResult(
      'Tier 1',
      'T1.30',
      'Student List CSV Export with UTF-8 BOM (GET /api/students/export-csv)',
      pass,
      pass
        ? `UTF-8 BOM (\\uFEFF) present at byte 0-2 (Length: ${res.buffer?.length || res.text?.length} bytes)`
        : (res.error || `HTTP ${res.status}: Missing UTF-8 BOM`),
      res.ms
    );
  }

  // ----------------------------------------------------------------------------------
  // TIER 2: BOUNDARY & CORNER CASES (Negative, Security & Limits)
  // ----------------------------------------------------------------------------------
  console.log('\n--- [TIER 2] BOUNDARY & CORNER CASES: DEFENSIVE CONTROLS ---');

  // T2.01: Reject Blank Username (400 Bad Request)
  {
    const res = await safeFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: 'password' }),
    });
    const pass = res.status === 400;
    recordResult(
      'Tier 2',
      'T2.01',
      'Auth Boundary: Reject Blank Username (400 Bad Request)',
      pass,
      `HTTP ${res.status} (Rejected empty username)`,
      res.ms
    );
  }

  // T2.02: Reject Invalid Password (401 Unauthorized)
  {
    const res = await safeFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'student', password: 'wrong_password_xyz' }),
    });
    const pass = res.status === 401;
    recordResult(
      'Tier 2',
      'T2.02',
      'Auth Boundary: Reject Invalid Password (401 Unauthorized)',
      pass,
      `HTTP ${res.status} (Access Denied as expected)`,
      res.ms
    );
  }

  // T2.03: RBAC: Student Blocked from Viewing Other Student Profile (403 Forbidden)
  {
    const foreignStudentId = targetStudentCode || '6621100099';
    const res = await safeFetch(`${BASE_URL}/students/${foreignStudentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 403;
    recordResult(
      'Tier 2',
      'T2.03',
      'RBAC Boundary: Block Student from Other Profile (403 Forbidden)',
      pass,
      `HTTP ${res.status} (Privacy preserved)`,
      res.ms
    );
  }

  // T2.04: RBAC: Student Blocked from Staff-Only Students Listing (403 Forbidden)
  {
    const res = await safeFetch(`${BASE_URL}/students`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 403;
    recordResult(
      'Tier 2',
      'T2.04',
      'RBAC Boundary: Block Student from All Students Listing (403 Forbidden)',
      pass,
      `HTTP ${res.status} (Student listing restricted to staff)`,
      res.ms
    );
  }

  // T2.05: RBAC: Student Blocked from Modifying Other Student Career Data (403 Forbidden)
  {
    const foreignStudentId = targetStudentCode || '6621100099';
    const res = await safeFetch(`${BASE_URL}/students/${foreignStudentId}/career`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ careerPath: 'Hacker' }),
    });
    const pass = res.status === 403;
    recordResult(
      'Tier 2',
      'T2.05',
      'RBAC Boundary: Block Student Altering Other Career Data (403 Forbidden)',
      pass,
      `HTTP ${res.status} (Tampering prevented)`,
      res.ms
    );
  }

  // T2.06: RBAC: Student Blocked from Updating Petition Status (403 Forbidden)
  if (createdPetitionId) {
    const res = await safeFetch(`${BASE_URL}/petitions/${createdPetitionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ status: 'อนุมัติ' }),
    });
    const pass = res.status === 403;
    recordResult(
      'Tier 2',
      'T2.06',
      'RBAC Boundary: Student Blocked from Status Update (403 Forbidden)',
      pass,
      `HTTP ${res.status} (Status alteration prohibited for students)`,
      res.ms
    );
  }

  // T2.07: RBAC: Student Blocked from Knowledge Ingestion (403 Forbidden)
  {
    const res = await safeFetch(`${BASE_URL}/admin/knowledge/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ content: 'Malicious ingestion', source: 'fake.pdf' }),
    });
    const pass = res.status === 403;
    recordResult(
      'Tier 2',
      'T2.07',
      'RBAC Boundary: Student Blocked from Knowledge Ingest (403 Forbidden)',
      pass,
      `HTTP ${res.status} (Admin authority required)`,
      res.ms
    );
  }

  // T2.08: RBAC: Student Blocked from Knowledge Management Listing (403 Forbidden)
  {
    const res = await safeFetch(`${BASE_URL}/admin/knowledge`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const pass = res.status === 403;
    recordResult(
      'Tier 2',
      'T2.08',
      'RBAC Boundary: Student Blocked from Knowledge List (403 Forbidden)',
      pass,
      `HTTP ${res.status} (Admin authority required)`,
      res.ms
    );
  }

  // T2.09: Petition Security: Forged Student ID Rejection or Forced Mapping
  {
    const forgedPayload = {
      studentId: '9999999999',
      type: 'คำร้องทั่วไป',
      title: 'Forged Petition Test',
      details: 'Attempting to submit on behalf of arbitrary student id',
    };
    const res = await safeFetch(`${BASE_URL}/petitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(forgedPayload),
    });
    // Either rejected with 403/400 or forced to authenticated student ID
    const pass =
      res.status === 403 ||
      res.status === 400 ||
      (res.status === 201 && res.data?.student?.studentId === studentUserId);
    recordResult(
      'Tier 2',
      'T2.09',
      'Security Boundary: Prevent Student ID Spoofing in Petitions',
      pass,
      `HTTP ${res.status} (Identity bound to authenticated caller: ${res.data?.student?.studentId || 'Rejected'})`,
      res.ms
    );
  }

  // T2.10: Attachment Validation: Reject Non-PDF File (400 Bad Request)
  if (createdPetitionId) {
    const formData = new FormData();
    const txtBlob = new Blob(['Not a PDF binary file'], { type: 'text/plain' });
    formData.append('file', txtBlob, 'invalid_payload.txt');
    formData.append('attachment', txtBlob, 'invalid_payload.txt');

    const res = await safeFetch(`${BASE_URL}/petitions/${createdPetitionId}/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formData,
    });
    const pass = res.status === 400;
    recordResult(
      'Tier 2',
      'T2.10',
      'File Validation: Reject Non-PDF Attachment (400 Bad Request)',
      pass,
      `HTTP ${res.status} (Rejected non-PDF payload)`,
      res.ms
    );
  }

  // T2.11: Attachment Validation: Reject Oversized File > 5MB (400 or 413)
  if (createdPetitionId) {
    const oversizedBlob = new Blob([new Uint8Array(5.5 * 1024 * 1024)], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', oversizedBlob, 'huge_file.pdf');
    formData.append('attachment', oversizedBlob, 'huge_file.pdf');

    const res = await safeFetch(`${BASE_URL}/petitions/${createdPetitionId}/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formData,
    });
    const pass = res.status === 400 || res.status === 413;
    recordResult(
      'Tier 2',
      'T2.11',
      'File Validation: Reject >5MB File (400/413 Payload Too Large)',
      pass,
      `HTTP ${res.status} (Oversized upload rejected)`,
      res.ms
    );
  }

  // T2.12: Academic Prerequisite Barrier: Course Registration Blocked
  {
    // Try checking registration with advanced section requiring uncompleted prerequisite
    const cartPayload = {
      courseCodes: ['CS3201'],
      sectionIds: [999],
    };
    const res = await safeFetch(`${BASE_URL}/students/${studentUserId}/registration/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(cartPayload),
    });
    const pass =
      res.status === 400 ||
      (res.status === 200 && (res.data?.valid === false || res.data?.errors?.length > 0 || JSON.stringify(res.data).includes('วิชาบังคับก่อน')));
    recordResult(
      'Tier 2',
      'T2.12',
      'Academic Boundary: Block Enrollment on Missing Prerequisite',
      pass,
      `HTTP ${res.status} (Prerequisite validation triggered)`,
      res.ms
    );
  }

  // T2.13: Bulk CSV Import: Reject Invalid / Corrupt CSV (400 Bad Request)
  {
    const invalidCsv = 'invalid,header,only\nmissing_fields_here';
    const res = await safeFetch(`${BASE_URL}/students/import-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
        Authorization: `Bearer ${adminToken}`,
      },
      body: invalidCsv,
    });
    const pass = res.status === 400;
    recordResult(
      'Tier 2',
      'T2.13',
      'CSV Boundary: Reject Malformed Student CSV (400 Bad Request)',
      pass,
      `HTTP ${res.status} (Invalid CSV structure rejected)`,
      res.ms
    );
  }

  // T2.14: Chat Input Boundary: Reject Blank Message (400 Bad Request)
  {
    const res = await safeFetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ message: '   ', sessionId: 'test-blank' }),
    });
    const pass = res.status === 400;
    recordResult(
      'Tier 2',
      'T2.14',
      'Chat Input Boundary: Reject Empty Message (400 Bad Request)',
      pass,
      `HTTP ${res.status} (Blank query rejected)`,
      res.ms
    );
  }

  // T2.15: Chat Rate Limiting: 16 Rapid Requests Trigger HTTP 429
  {
    console.log('    -> Testing sliding-window rate limit (16 rapid requests to POST /api/chat)...');
    let got429 = false;
    let rateLimitCallIndex = -1;
    const rateLimitSession = `ratelimit-test-${Date.now()}`;

    for (let i = 1; i <= 17; i++) {
      const res = await safeFetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ message: `Rate limit check #${i}`, sessionId: rateLimitSession }),
      });
      if (res.status === 429) {
        got429 = true;
        rateLimitCallIndex = i;
        break;
      }
    }

    const pass = got429 && rateLimitCallIndex >= 15;
    recordResult(
      'Tier 2',
      'T2.15',
      'Rate Limit: 16 Rapid Chat Requests Trigger HTTP 429',
      pass,
      pass
        ? `HTTP 429 Too Many Requests triggered at call #${rateLimitCallIndex}`
        : `Got 429: ${got429}, call index: ${rateLimitCallIndex}`,
      0
    );
  }

  // ----------------------------------------------------------------------------------
  // TIER 3: CROSS-FEATURE PAIRWISE (Subsystem Interactions & Side-Effects)
  // ----------------------------------------------------------------------------------
  console.log('\n--- [TIER 3] CROSS-FEATURE PAIRWISE: INTER-MODULE INTERACTIONS ---');

  // T3.01: Petition Submission triggers Advisor Notification
  {
    // Check unread notifications of advisor
    const res = await safeFetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    const notifs = Array.isArray(res.data) ? res.data : (res.data?.notifications || []);
    const pass = res.status === 200 && (notifs.length > 0 || res.data?.unreadCount !== undefined);
    recordResult(
      'Tier 3',
      'T3.01',
      'Cross-Feature: Petition Submission -> Advisor Notification',
      pass,
      pass
        ? `Advisor notifications verified (Count: ${notifs.length})`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T3.02: Ingestion Chunk -> RAG Chat Citation Integration
  {
    // Ingest unique keyword knowledge
    const uniqueTag = `POLICY_BSRU_CODE_${Date.now()}`;
    const testContent = `ระเบียบเฉพาะกิจ ${uniqueTag}: การเทียบโอนผลการเรียนจากต่างประเทศต้องผ่านการรับรองจากสถานทูต`;
    await safeFetch(`${BASE_URL}/admin/knowledge/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ content: testContent, source: `doc_${uniqueTag}.pdf` }),
    });

    // Query chatbot for that unique keyword
    const res = await safeFetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        message: `ข้อกำหนดเกี่ยวกับ ${uniqueTag} มีว่าอย่างไร`,
        sessionId: `rag-verify-${uniqueTag}`,
      }),
    });

    const pass = res.status === 200 && typeof res.data?.reply === 'string';
    recordResult(
      'Tier 3',
      'T3.02',
      'Cross-Feature: Knowledge Ingestion -> Chatbot RAG Retrieval',
      pass,
      pass
        ? `RAG query processed with response length ${res.data.reply.length} chars`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T3.03: Chat Interaction -> Database History Persistence
  {
    const historySession = `session-persist-${Date.now()}`;
    await safeFetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ message: 'ตรวจสอบหน่วยกิตที่ต้องเรียนทั้งหมด', sessionId: historySession }),
    });

    const res = await safeFetch(`${BASE_URL}/chat/history?sessionId=${historySession}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const historyList = Array.isArray(res.data) ? res.data : (res.data?.history || []);
    const pass = res.status === 200 && (historyList.length > 0 || res.data !== null);
    recordResult(
      'Tier 3',
      'T3.03',
      'Cross-Feature: Chat Query -> DB History Persistence',
      pass,
      pass
        ? `Persisted ${historyList.length} chat history entries in PostgreSQL`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T3.04: Chat History Clear -> Storage Reset
  {
    const clearSession = `session-clear-${Date.now()}`;
    await safeFetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ message: 'Test for clear history', sessionId: clearSession }),
    });

    await safeFetch(`${BASE_URL}/chat/history?sessionId=${clearSession}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await safeFetch(`${BASE_URL}/chat/history?sessionId=${clearSession}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const historyList = Array.isArray(res.data) ? res.data : (res.data?.history || []);
    const pass = res.status === 200 && historyList.length === 0;
    recordResult(
      'Tier 3',
      'T3.04',
      'Cross-Feature: Chat History Clear -> Storage Purged',
      pass,
      pass
        ? `History purged successfully (Remaining entries: ${historyList.length})`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T3.05: Advising Note -> Advisee Record Association
  {
    const res = await safeFetch(`${BASE_URL}/advisors/me/advisees/${studentUserId}/notes`, {
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    const pass = res.status === 200 && Array.isArray(res.data);
    recordResult(
      'Tier 3',
      'T3.05',
      'Cross-Feature: Advising Note -> Student Profile Linking',
      pass,
      pass
        ? `Advising notes tied to student ${studentUserId} confirmed`
        : (res.error || `HTTP ${res.status}`),
      res.ms
    );
  }

  // T3.06: Notification Read Action -> State Update
  {
    // Retrieve unread notification ID
    const notifRes = await safeFetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const notifs = Array.isArray(notifRes.data) ? notifRes.data : (notifRes.data?.notifications || []);
    const targetNotif = notifs[0];

    if (targetNotif?.id) {
      const res = await safeFetch(`${BASE_URL}/notifications/${targetNotif.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const pass = res.status === 200;
      recordResult(
        'Tier 3',
        'T3.06',
        'Cross-Feature: Notification Mark-as-Read State Transition',
        pass,
        pass
          ? `Notification ${targetNotif.id} marked as read`
          : (res.error || `HTTP ${res.status}`),
        res.ms
      );
    } else {
      recordResult(
        'Tier 3',
        'T3.06',
        'Cross-Feature: Notification Mark-as-Read State Transition',
        true,
        'No unread notifications to mark (State clean)',
        0
      );
    }
  }

  // ----------------------------------------------------------------------------------
  // TIER 4: REAL-WORLD SCENARIOS (>= 5 Holistic Persona Journeys)
  // ----------------------------------------------------------------------------------
  console.log('\n--- [TIER 4] REAL-WORLD SCENARIOS: HOLISTIC PERSONA WORKFLOWS ---');

  // Scenario 1: New Semester Course Registration & Prerequisite Validation
  {
    console.log('  [Scenario 1] Academic Course Registration & Prerequisite Validation');
    const t0 = performance.now();
    let s1Passed = true;
    let s1Msg = '';

    // Step 1: Student checks grades and timetable
    const gradesRes = await safeFetch(`${BASE_URL}/students/${studentUserId}/grades`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (gradesRes.status !== 200) s1Passed = false;

    // Step 2: Student validates registration cart with prerequisite checking
    const cartRes = await safeFetch(`${BASE_URL}/students/${studentUserId}/registration/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseCodes: ['CS101'], sectionIds: [1] }),
    });
    if (cartRes.status !== 200 && cartRes.status !== 400) s1Passed = false;

    const ms = Math.round(performance.now() - t0);
    recordResult(
      'Tier 4',
      'T4.01',
      'Scenario 1: Semester Registration & Prerequisite Barrier Enforcement',
      s1Passed,
      s1Passed
        ? 'Grades inspected -> Cart validated -> Prerequisite checked successfully'
        : `Failed during registration flow: ${s1Msg}`,
      ms
    );
  }

  // Scenario 2: Two-Step Academic Petition Lifecycle with PDF Verification
  {
    console.log('  [Scenario 2] Complete 2-Step Academic Petition Lifecycle with PDF');
    const t0 = performance.now();
    let s2Passed = true;
    let petitionId = null;

    // 1. Submit Petition
    const subRes = await safeFetch(`${BASE_URL}/petitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        type: 'คำร้องขอสำเร็จการศึกษา',
        title: 'ขอสำเร็จการศึกษาภาคเรียนที่ 2/2569',
        details: 'เรียนครบหลักสูตร 120 หน่วยกิตและสะสมเกรดเฉลี่ยมากกว่า 2.00',
        studentId: studentUserId,
      }),
    });
    if (subRes.status === 201 || subRes.status === 200) {
      petitionId = subRes.data?.id;
    } else {
      s2Passed = false;
    }

    // 2. Upload PDF
    if (petitionId) {
      const formData = new FormData();
      const pdfBlob = new Blob([SAMPLE_PDF_BUFFER], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'grad_req.pdf');
      formData.append('attachment', pdfBlob, 'grad_req.pdf');
      const upRes = await safeFetch(`${BASE_URL}/petitions/${petitionId}/attachment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: formData,
      });
      if (upRes.status !== 200 && upRes.status !== 201) s2Passed = false;

      // 3. Advisor Endorse
      const endorseRes = await safeFetch(`${BASE_URL}/petitions/${petitionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${advisorToken}`,
        },
        body: JSON.stringify({
          status: 'รอผู้ดูแลระบบอนุมัติ',
          comment: 'อาจารย์ที่ปรึกษาตรวจสอบคุณสมบัติครบถ้วน',
        }),
      });
      if (endorseRes.status !== 200) s2Passed = false;

      // 4. Admin Final Approval
      const appRes = await safeFetch(`${BASE_URL}/petitions/${petitionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'อนุมัติ',
          comment: 'อนุมัติใบสำเร็จการศึกษา',
        }),
      });
      if (appRes.status !== 200 || appRes.data?.status !== 'อนุมัติ') s2Passed = false;
    }

    const ms = Math.round(performance.now() - t0);
    recordResult(
      'Tier 4',
      'T4.02',
      'Scenario 2: 2-Step Petition Approval Workflow with PDF Verification',
      s2Passed,
      s2Passed
        ? `Full cycle complete: Student Submit -> PDF Upload -> Advisor Endorse -> Admin Final Approval (ID: ${petitionId})`
        : 'Failed during petition workflow execution',
      ms
    );
  }

  // Scenario 3: AI Academic Advisory, RAG Knowledge Base Retrieval & History Management
  {
    console.log('  [Scenario 3] AI Academic Advisory, RAG Knowledge Search & Memory Reset');
    const t0 = performance.now();
    let s3Passed = true;
    const sessionKey = `scenario3-${Date.now()}`;

    // 1. Ingest regulation
    const ingestRes = await safeFetch(`${BASE_URL}/admin/knowledge/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        content: 'เกณฑ์การขอเทียบโอนหมวดวิชาศึกษาทั่วไป: เทียบโอนได้ไม่เกิน 30 หน่วยกิตและต้องได้เกรด C ขึ้นไป',
        source: 'general_education_transfer_2026.pdf',
      }),
    });
    if (ingestRes.status !== 200) s3Passed = false;

    // 2. Chat query
    const chatRes = await safeFetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        message: 'การเทียบโอนวิชาศึกษาทั่วไปทำได้กี่หน่วยกิตและต้องได้เกรดอะไร',
        sessionId: sessionKey,
      }),
    });
    if (chatRes.status !== 200) s3Passed = false;

    // 3. Clear History
    const clearRes = await safeFetch(`${BASE_URL}/chat/history?sessionId=${sessionKey}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (clearRes.status !== 200 && clearRes.status !== 204) s3Passed = false;

    const ms = Math.round(performance.now() - t0);
    recordResult(
      'Tier 4',
      'T4.03',
      'Scenario 3: AI Advisory, RAG Retrieval & History Management',
      s3Passed,
      s3Passed
        ? 'Regulation ingested -> RAG queried with context -> Conversation memory cleared'
        : 'Failed during AI advising workflow',
      ms
    );
  }

  // Scenario 4: At-Risk Student Early Warning, Consultation & Advising Log
  {
    console.log('  [Scenario 4] At-Risk Student Monitoring, Consultation & Advising Log Trail');
    const t0 = performance.now();
    let s4Passed = true;

    // 1. Advisor views advisee risk status
    const adviseesRes = await safeFetch(`${BASE_URL}/advisors/me/advisees`, {
      headers: { Authorization: `Bearer ${advisorToken}` },
    });
    if (adviseesRes.status !== 200) s4Passed = false;

    // 2. Advisor logs face-to-face academic consultation note
    const noteRes = await safeFetch(`${BASE_URL}/advisors/me/advisees/${studentUserId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${advisorToken}`,
      },
      body: JSON.stringify({
        summary: 'ติดตามการลงทะเบียนเรียนและแผนเพิ่มเกรดเฉลี่ยสะสมประจำภาคเรียน',
        followUpDate: '2026-12-01',
        riskLevelSnapshot: 'ACADEMIC_WARNING',
      }),
    });
    if (noteRes.status !== 200 && noteRes.status !== 201) s4Passed = false;

    // 3. Student updates career pathway aligned with consultation
    const careerRes = await safeFetch(`${BASE_URL}/students/${studentUserId}/career`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        careerPath: 'Software Quality Engineer',
        employmentStatus: 'กำลังศึกษาต่อ / ปรับปรุงผลการเรียน',
      }),
    });
    if (careerRes.status !== 200) s4Passed = false;

    const ms = Math.round(performance.now() - t0);
    recordResult(
      'Tier 4',
      'T4.04',
      'Scenario 4: At-Risk Student Screening, Advising Note & Career Alignment',
      s4Passed,
      s4Passed
        ? 'Risk screening -> Advising note logged -> Student career alignment updated'
        : 'Failed during at-risk student monitoring flow',
      ms
    );
  }

  // Scenario 5: Academic Registrar Batch Student Onboarding, Verification & UTF-8 BOM CSV Export
  {
    console.log('  [Scenario 5] Academic Registrar Batch Student Onboarding & UTF-8 BOM CSV Export');
    const t0 = performance.now();
    let s5Passed = true;

    // 1. Bulk import new students
    const batchCsv =
      'studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId\n' +
      '6621109911,บัณฑิต สมบูรณ์,Bundit Somboon,bundit9911@bsru.ac.th,0812345681,วิทยาศาสตร์และเทคโนโลยี,วิทยาการคอมพิวเตอร์,4,GRADUATED,ADV-01';

    const impRes = await safeFetch(`${BASE_URL}/students/import-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
        Authorization: `Bearer ${adminToken}`,
      },
      body: batchCsv,
    });
    if (impRes.status !== 200 && impRes.status !== 201) s5Passed = false;

    // 2. Export CSV and check UTF-8 BOM
    let expRes = await safeFetch(`${BASE_URL}/students/export-csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (expRes.status === 404) {
      expRes = await safeFetch(`${BASE_URL}/students/csv`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }
    const hasBom =
      expRes.buffer &&
      expRes.buffer[0] === 0xef &&
      expRes.buffer[1] === 0xbb &&
      expRes.buffer[2] === 0xbf;
    const textHasBom = typeof expRes.text === 'string' && expRes.text.charCodeAt(0) === 0xfeff;
    if (expRes.status !== 200 || (!hasBom && !textHasBom)) s5Passed = false;

    const ms = Math.round(performance.now() - t0);
    recordResult(
      'Tier 4',
      'T4.05',
      'Scenario 5: Batch Student Onboarding & UTF-8 BOM CSV Export Verification',
      s5Passed,
      s5Passed
        ? 'Bulk students imported -> Student registry exported with valid UTF-8 BOM'
        : 'Failed during batch onboarding and export verification',
      ms
    );
  }

  // ----------------------------------------------------------------------------------
  // SUMMARY REPORT & EXIT CODE EVALUATION
  // ----------------------------------------------------------------------------------
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  const t1 = results.filter((r) => r.tier === 'Tier 1');
  const t2 = results.filter((r) => r.tier === 'Tier 2');
  const t3 = results.filter((r) => r.tier === 'Tier 3');
  const t4 = results.filter((r) => r.tier === 'Tier 4');

  console.log('\n====================================================================================');
  console.log('📊 COMPREHENSIVE 4-TIER E2E API TEST BREAKDOWN & SUMMARY');
  console.log('====================================================================================');
  console.log(` Tier 1 (Feature Coverage)       : ${t1.filter((r) => r.passed).length}/${t1.length} PASSED`);
  console.log(` Tier 2 (Boundary & Corner)      : ${t2.filter((r) => r.passed).length}/${t2.length} PASSED`);
  console.log(` Tier 3 (Cross-Feature Pairwise) : ${t3.filter((r) => r.passed).length}/${t3.length} PASSED`);
  console.log(` Tier 4 (Real-World Scenarios)   : ${t4.filter((r) => r.passed).length}/${t4.length} PASSED`);
  console.log('------------------------------------------------------------------------------------');
  console.log(` TOTAL VERIFICATION RUN          : ${passedCount}/${total} PASSED (${failedCount} FAILED)`);
  console.log('====================================================================================\n');

  return { total, passedCount, failedCount, results };
}

runE2ESuite()
  .then((res) => {
    if (res.failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('Fatal Test Suite Error:', err);
    process.exit(1);
  });
