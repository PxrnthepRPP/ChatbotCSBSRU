package com.bsru.studentportal.security;

import com.bsru.studentportal.config.SecurityConfig;
import com.bsru.studentportal.controller.AdvisorController;
import com.bsru.studentportal.controller.ApiController;
import com.bsru.studentportal.controller.KnowledgeController;
import com.bsru.studentportal.controller.PetitionFileController;
import com.bsru.studentportal.controller.StudentAdminController;
import com.bsru.studentportal.dto.PetitionRequest;
import com.bsru.studentportal.dto.PetitionStatusUpdateRequest;
import com.bsru.studentportal.dto.StudentRequest;
import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.AdvisingNoteRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.AcademicRecordService;
import com.bsru.studentportal.service.AccountService;
import com.bsru.studentportal.service.AdvisorInsightService;
import com.bsru.studentportal.service.GraduationAuditService;
import com.bsru.studentportal.service.KnowledgeIngestionService;
import com.bsru.studentportal.service.NotificationService;
import com.bsru.studentportal.service.StudentAdminService;
import com.bsru.studentportal.service.StudentCsvService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {
        KnowledgeController.class,
        ApiController.class,
        AdvisorController.class,
        StudentAdminController.class,
        PetitionFileController.class
})
@AutoConfigureMockMvc(addFilters = true)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtUtil.class, StudentCsvService.class})
@DisplayName("RBAC Security Integration Tests")
class RbacSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private ObjectMapper objectMapper;

    // ApiController mocks
    @MockBean
    private StudentRepository studentRepository;

    @MockBean
    private AdvisorRepository advisorRepository;

    @MockBean
    private AcademicPetitionRepository petitionRepository;

    @MockBean
    private AcademicRecordService academicRecordService;

    @MockBean
    private GraduationAuditService graduationAuditService;

    @MockBean
    private NotificationService notificationService;

    // KnowledgeController mock
    @MockBean
    private KnowledgeIngestionService knowledgeIngestionService;

    // AdvisorController mocks
    @MockBean
    private AdvisorInsightService advisorInsightService;

    @MockBean
    private StudentAdminService studentAdminService;

    @MockBean
    private AdvisingNoteRepository advisingNoteRepository;

    // StudentAdminController mock
    @MockBean
    private AccountService accountService;

    private String adminToken;
    private String advisorToken;
    private String advisorWithAdminToken;
    private String studentToken;

    private Student demoStudent;
    private Student otherStudent;
    private Advisor demoAdvisor;
    private Advisor otherAdvisor;

    @BeforeEach
    void setUp() {
        // Tokens
        adminToken = jwtUtil.generateToken("admin", "ROLE_ADMIN", Map.of("role", "ROLE_ADMIN"));
        advisorToken = jwtUtil.generateToken("advisor", "ROLE_ADVISOR", Map.of("role", "ROLE_ADVISOR"));
        advisorWithAdminToken = jwtUtil.generateToken("advisor-admin", "ROLE_ADVISOR,ROLE_ADMIN", Map.of("role", "ROLE_ADVISOR,ROLE_ADMIN", "canAdmin", true));
        studentToken = jwtUtil.generateToken("student", "ROLE_STUDENT", Map.of("role", "ROLE_STUDENT"));

        // Domain models
        demoAdvisor = new Advisor();
        demoAdvisor.setId("ADV-01");
        demoAdvisor.setNameTh("อาจารย์ที่ปรึกษา ตัวอย่าง");

        otherAdvisor = new Advisor();
        otherAdvisor.setId("ADV-99");
        otherAdvisor.setNameTh("อาจารย์ท่านอื่น");

        demoStudent = new Student();
        demoStudent.setStudentId("6621100042");
        demoStudent.setNameTh("สมชาย นักศึกษา");
        demoStudent.setAdvisor(demoAdvisor);

        otherStudent = new Student();
        otherStudent.setStudentId("6621100099");
        otherStudent.setNameTh("สมศรี นักศึกษาอื่น");
        otherStudent.setAdvisor(otherAdvisor);
    }

    // =========================================================================
    // 1. /api/admin/** Boundary Tests
    // =========================================================================
    @Nested
    @DisplayName("Admin Endpoints Boundary (/api/admin/**)")
    class AdminBoundaryTests {

        @Test
        @DisplayName("Unauthenticated request to /api/admin/knowledge returns HTTP 401 Unauthorized with Thai message")
        void unauthenticated_AdminKnowledge_Returns401() throws Exception {
            mockMvc.perform(get("/api/admin/knowledge"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error", containsString("กรุณาเข้าสู่ระบบก่อนใช้งาน (Unauthorized)")));
        }

        @Test
        @DisplayName("Student caller to /api/admin/knowledge returns HTTP 403 Forbidden")
        void student_AdminKnowledge_Returns403() throws Exception {
            mockMvc.perform(get("/api/admin/knowledge")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (Forbidden)")));
        }

        @Test
        @DisplayName("Advisor caller to /api/admin/knowledge returns HTTP 403 Forbidden")
        void advisor_AdminKnowledge_Returns403() throws Exception {
            mockMvc.perform(get("/api/admin/knowledge")
                            .header("Authorization", "Bearer " + advisorToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (Forbidden)")));
        }

        @Test
        @DisplayName("Admin caller to /api/admin/knowledge returns HTTP 200 OK")
        void admin_AdminKnowledge_Returns200() throws Exception {
            when(knowledgeIngestionService.listDocuments()).thenReturn(Collections.emptyList());

            mockMvc.perform(get("/api/admin/knowledge")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON));
        }

        @Test
        @DisplayName("Student caller to /api/admin/knowledge/ingest returns HTTP 403 Forbidden")
        void student_AdminIngest_Returns403() throws Exception {
            mockMvc.perform(post("/api/admin/knowledge/ingest")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"content\":\"test knowledge\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Student caller to DELETE /api/admin/knowledge/{id} returns HTTP 403 Forbidden")
        void student_AdminDelete_Returns403() throws Exception {
            mockMvc.perform(delete("/api/admin/knowledge/DOC-123")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden());
        }
    }

    // =========================================================================
    // 2. /api/advisors/** Boundary Tests
    // =========================================================================
    @Nested
    @DisplayName("Advisor Endpoints Boundary (/api/advisors/**)")
    class AdvisorBoundaryTests {

        @Test
        @DisplayName("Unauthenticated request to /api/advisors/me returns HTTP 401 Unauthorized")
        void unauthenticated_AdvisorMe_Returns401() throws Exception {
            mockMvc.perform(get("/api/advisors/me"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Student caller to /api/advisors/me returns HTTP 403 Forbidden")
        void student_AdvisorMe_Returns403() throws Exception {
            mockMvc.perform(get("/api/advisors/me")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("เฉพาะอาจารย์ที่ปรึกษาเท่านั้น")));
        }

        @Test
        @DisplayName("Student caller to /api/advisors/me/advisees returns HTTP 403 Forbidden")
        void student_AdvisorAdvisees_Returns403() throws Exception {
            mockMvc.perform(get("/api/advisors/me/advisees")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("เฉพาะอาจารย์ที่ปรึกษาเท่านั้น")));
        }

        @Test
        @DisplayName("Advisor caller to /api/advisors/me returns HTTP 200 OK")
        void advisor_AdvisorMe_Returns200() throws Exception {
            when(advisorRepository.findById("ADV-01")).thenReturn(Optional.of(demoAdvisor));

            mockMvc.perform(get("/api/advisors/me")
                            .header("Authorization", "Bearer " + advisorToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value("ADV-01"));
        }

        @Test
        @DisplayName("Advisor caller to /api/advisors/me/advisees returns HTTP 200 OK")
        void advisor_AdvisorAdvisees_Returns200() throws Exception {
            when(advisorInsightService.risksOf("ADV-01")).thenReturn(Collections.emptyList());

            mockMvc.perform(get("/api/advisors/me/advisees")
                            .header("Authorization", "Bearer " + advisorToken))
                    .andExpect(status().isOk());
        }
    }

    // =========================================================================
    // 3. /api/petitions/** Boundary Tests
    // =========================================================================
    @Nested
    @DisplayName("Petitions Endpoints Boundary (/api/petitions/**)")
    class PetitionsBoundaryTests {

        @Test
        @DisplayName("Unauthenticated request to GET /api/petitions returns HTTP 401 Unauthorized")
        void unauthenticated_PetitionsList_Returns401() throws Exception {
            mockMvc.perform(get("/api/petitions"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Student caller GET /api/petitions returns HTTP 200 with own advisee list only")
        void student_PetitionsList_Returns200() throws Exception {
            when(petitionRepository.findByStudentStudentIdOrderBySubmittedAtDesc("6621100042"))
                    .thenReturn(Collections.emptyList());

            mockMvc.perform(get("/api/petitions")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("Student submitting petition for own studentId succeeds with HTTP 201 Created")
        void student_SubmitPetitionForOwnId_Returns201() throws Exception {
            when(studentRepository.findById("6621100042")).thenReturn(Optional.of(demoStudent));
            when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(Collections.emptyList());

            AcademicPetition saved = new AcademicPetition();
            saved.setId("PET-2569-001");
            saved.setStudent(demoStudent);
            saved.setTitle("คำร้องขอลงทะเบียนล่าช้า");
            saved.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            when(petitionRepository.save(any(AcademicPetition.class))).thenReturn(saved);

            PetitionRequest req = new PetitionRequest();
            req.setStudentId("6621100042");
            req.setTitle("คำร้องขอลงทะเบียนล่าช้า");
            req.setType("REGISTRATION");

            mockMvc.perform(post("/api/petitions")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").value("PET-2569-001"));
        }

        @Test
        @DisplayName("Student submitting petition with other studentId (spoofing) returns HTTP 403 Forbidden")
        void student_SubmitPetitionForOtherId_Returns403() throws Exception {
            PetitionRequest req = new PetitionRequest();
            req.setStudentId("6621100099"); // Spoofed ID (caller is 6621100042)
            req.setTitle("คำร้องขอแก้เกรด");
            req.setType("GRADE_CHANGE");

            mockMvc.perform(post("/api/petitions")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("ไม่อนุญาตให้ยื่นคำร้องแทนนักศึกษาคนอื่น")));
        }

        @Test
        @DisplayName("Student attempting to update petition status returns HTTP 403 Forbidden")
        void student_UpdatePetitionStatus_Returns403() throws Exception {
            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
            req.setStatus("อนุมัติ");

            mockMvc.perform(patch("/api/petitions/PET-2569-001/status")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("นักศึกษาไม่ได้รับอนุญาตให้แก้ไขสถานะคำร้อง")));
        }

        @Test
        @DisplayName("Advisor cannot directly approve petition with status 'อนุมัติ' (returns HTTP 400 Bad Request)")
        void advisor_DirectApprovePetition_Returns400() throws Exception {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-001");
            petition.setStudent(demoStudent);
            petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
            req.setStatus("อนุมัติ"); // Advisor must endorse "รอผู้ดูแลระบบอนุมัติ", not direct "อนุมัติ"

            mockMvc.perform(patch("/api/petitions/PET-2569-001/status")
                            .header("Authorization", "Bearer " + advisorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error", containsString("อาจารย์ที่ปรึกษาไม่สามารถอนุมัติคำร้องโดยตรงได้")));
        }

        @Test
        @DisplayName("Advisor updating status of non-advisee student petition returns HTTP 403 Forbidden")
        void advisor_UpdateNonAdviseePetition_Returns403() throws Exception {
            AcademicPetition otherPetition = new AcademicPetition();
            otherPetition.setId("PET-2569-099");
            otherPetition.setStudent(otherStudent); // student advised by ADV-99, caller is ADV-01
            otherPetition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            when(petitionRepository.findById("PET-2569-099")).thenReturn(Optional.of(otherPetition));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
            req.setStatus("รอผู้ดูแลระบบอนุมัติ");

            mockMvc.perform(patch("/api/petitions/PET-2569-099/status")
                            .header("Authorization", "Bearer " + advisorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("อาจารย์สามารถแก้ไขสถานะได้เฉพาะคำร้องของนักศึกษาในความดูแลเท่านั้น")));
        }

        @Test
        @DisplayName("Advisor endorsing advisee petition to 'รอผู้ดูแลระบบอนุมัติ' succeeds with HTTP 200 OK")
        void advisor_EndorseAdviseePetition_Returns200() throws Exception {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-001");
            petition.setStudent(demoStudent);
            petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");
            when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
            req.setStatus("รอผู้ดูแลระบบอนุมัติ");
            req.setAdvisorComment("เห็นชอบตามคำร้อง");

            mockMvc.perform(patch("/api/petitions/PET-2569-001/status")
                            .header("Authorization", "Bearer " + advisorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("รอผู้ดูแลระบบอนุมัติ"))
                    .andExpect(jsonPath("$.advisorComment").value("เห็นชอบตามคำร้อง"));
        }

        @Test
        @DisplayName("Admin approving petition to 'อนุมัติ' succeeds with HTTP 200 OK")
        void admin_ApprovePetition_Returns200() throws Exception {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-001");
            petition.setStudent(demoStudent);
            petition.setStatus("รอผู้ดูแลระบบอนุมัติ");
            when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));
            when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(i -> i.getArgument(0));

            PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
            req.setStatus("อนุมัติ");

            mockMvc.perform(patch("/api/petitions/PET-2569-001/status")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("อนุมัติ"));
        }

        @Test
        @DisplayName("Student uploading attachment to other student's petition returns HTTP 403 Forbidden")
        void student_UploadAttachmentToOtherStudentPetition_Returns403() throws Exception {
            AcademicPetition petition = new AcademicPetition();
            petition.setId("PET-2569-099");
            petition.setStudent(otherStudent); // Owned by 6621100099
            when(petitionRepository.findById("PET-2569-099")).thenReturn(Optional.of(petition));

            MockMultipartFile file = new MockMultipartFile(
                    "file", "petition.pdf", "application/pdf", "%PDF-1.4 sample content".getBytes()
            );

            mockMvc.perform(multipart("/api/petitions/PET-2569-099/attachment")
                            .file(file)
                            .header("Authorization", "Bearer " + studentToken)) // Caller is 6621100042
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("ไม่อนุญาตให้อัปโหลดไฟล์แนบสำหรับคำร้องของผู้อื่น")));
        }
    }

    // =========================================================================
    // 4. /api/students/** Boundary Tests
    // =========================================================================
    @Nested
    @DisplayName("Students Profile & Administration Boundary (/api/students/**)")
    class StudentsBoundaryTests {

        @Test
        @DisplayName("Unauthenticated request to GET /api/students/{id} returns HTTP 401 Unauthorized")
        void unauthenticated_StudentProfile_Returns401() throws Exception {
            mockMvc.perform(get("/api/students/6621100042"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("Student viewing own profile returns HTTP 200 OK")
        void student_ViewOwnProfile_Returns200() throws Exception {
            when(studentRepository.findById("6621100042")).thenReturn(Optional.of(demoStudent));

            mockMvc.perform(get("/api/students/6621100042")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.studentId").value("6621100042"));
        }

        @Test
        @DisplayName("Student viewing another student's profile returns HTTP 403 Forbidden")
        void student_ViewOtherProfile_Returns403() throws Exception {
            mockMvc.perform(get("/api/students/6621100099")
                            .header("Authorization", "Bearer " + studentToken)) // Caller is 6621100042
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("Students can only view their own profile")));
        }

        @Test
        @DisplayName("Student viewing own grades returns HTTP 200 OK")
        void student_ViewOwnGrades_Returns200() throws Exception {
            AcademicRecordService.GradeReport report = new AcademicRecordService.GradeReport(
                    "6621100042", Collections.emptyList(), 0, null
            );
            when(academicRecordService.gradesOf("6621100042")).thenReturn(report);

            mockMvc.perform(get("/api/students/6621100042/grades")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.studentId").value("6621100042"));
        }

        @Test
        @DisplayName("Student viewing another student's grades returns HTTP 403 Forbidden")
        void student_ViewOtherGrades_Returns403() throws Exception {
            mockMvc.perform(get("/api/students/6621100099/grades")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("Students can only view their own grades")));
        }

        @Test
        @DisplayName("Student viewing own graduation audit returns HTTP 200 OK")
        void student_ViewOwnGraduationAudit_Returns200() throws Exception {
            ObjectMapper om = new ObjectMapper();
            GraduationAuditService.AuditResult auditResult = new GraduationAuditService.AuditResult(
                    om.readTree("{\"studentId\":\"6621100042\",\"summary\":{}}"),
                    Collections.emptyList()
            );
            when(graduationAuditService.auditOf("6621100042")).thenReturn(Optional.of(auditResult));

            mockMvc.perform(get("/api/students/6621100042/graduation-audit")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.studentId").value("6621100042"));
        }

        @Test
        @DisplayName("Student viewing another student's graduation audit returns HTTP 403 Forbidden")
        void student_ViewOtherGraduationAudit_Returns403() throws Exception {
            mockMvc.perform(get("/api/students/6621100099/graduation-audit")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("Students can only view their own graduation audit")));
        }

        @Test
        @DisplayName("Student listing all students returns HTTP 403 Forbidden")
        void student_ListAllStudents_Returns403() throws Exception {
            mockMvc.perform(get("/api/students")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("Student calling CSV export returns HTTP 403 Forbidden")
        void student_ExportCsv_Returns403() throws Exception {
            mockMvc.perform(get("/api/students/export-csv")
                            .header("Authorization", "Bearer " + studentToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("เฉพาะผู้ดูแลระบบเท่านั้น")));
        }

        @Test
        @DisplayName("Advisor calling CSV export returns HTTP 403 Forbidden")
        void advisor_ExportCsv_Returns403() throws Exception {
            mockMvc.perform(get("/api/students/export-csv")
                            .header("Authorization", "Bearer " + advisorToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("เฉพาะผู้ดูแลระบบเท่านั้น")));
        }

        @Test
        @DisplayName("Student calling CSV import returns HTTP 403 Forbidden")
        void student_ImportCsv_Returns403() throws Exception {
            mockMvc.perform(post("/api/students/import-csv")
                            .header("Authorization", "Bearer " + studentToken)
                            .contentType("text/csv")
                            .content("studentId,nameTh\n6621100001,Test"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("เฉพาะผู้ดูแลระบบเท่านั้น")));
        }

        @Test
        @DisplayName("Admin calling CSV export returns HTTP 200 OK with text/csv and UTF-8 BOM bytes")
        void admin_ExportCsv_Returns200WithUtf8Bom() throws Exception {
            when(studentRepository.findAll(any(Sort.class))).thenReturn(List.of(demoStudent));

            byte[] responseBytes = mockMvc.perform(get("/api/students/export-csv")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", containsString("text/csv")))
                    .andExpect(header().string("Content-Disposition", containsString("students_bsru.csv")))
                    .andReturn().getResponse().getContentAsByteArray();

            // Verify UTF-8 BOM bytes at start of file: 0xEF, 0xBB, 0xBF
            assertTrue(responseBytes.length >= 3);
            assertEquals((byte) 0xEF, responseBytes[0]);
            assertEquals((byte) 0xBB, responseBytes[1]);
            assertEquals((byte) 0xBF, responseBytes[2]);
        }

        @Test
        @DisplayName("Admin calling CSV import succeeds with HTTP 200 OK")
        void admin_ImportCsv_Returns200() throws Exception {
            when(studentRepository.findById(anyString())).thenReturn(Optional.empty());
            when(studentRepository.save(any(Student.class))).thenAnswer(i -> i.getArgument(0));

            String csvContent = "studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId,gpa,careerPath\n" +
                    "6621100001,ทดสอบ ระบบ,Test System,test@bsru.ac.th,0812345678,วิทยาศาสตร์และเทคโนโลยี,วิทยาการคอมพิวเตอร์,1,กำลังศึกษา,ADV-01,3.50,Software Engineer";

            mockMvc.perform(post("/api/students/import-csv")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType("text/csv; charset=UTF-8")
                            .content(csvContent))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.importedCount").value(1));
        }

        @Test
        @DisplayName("Advisor with admin privilege calling CSV export returns HTTP 200 OK with text/csv and UTF-8 BOM bytes")
        void advisorWithAdmin_ExportCsv_Returns200WithUtf8Bom() throws Exception {
            when(studentRepository.findAll(any(Sort.class))).thenReturn(List.of(demoStudent));

            byte[] responseBytes = mockMvc.perform(get("/api/students/export-csv")
                            .header("Authorization", "Bearer " + advisorWithAdminToken))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", containsString("text/csv")))
                    .andExpect(header().string("Content-Disposition", containsString("students_bsru.csv")))
                    .andReturn().getResponse().getContentAsByteArray();

            assertTrue(responseBytes.length >= 3);
            assertEquals((byte) 0xEF, responseBytes[0]);
            assertEquals((byte) 0xBB, responseBytes[1]);
            assertEquals((byte) 0xBF, responseBytes[2]);
        }

        @Test
        @DisplayName("Advisor with admin privilege calling CSV import succeeds with HTTP 200 OK")
        void advisorWithAdmin_ImportCsv_Returns200() throws Exception {
            when(studentRepository.findById(anyString())).thenReturn(Optional.empty());
            when(studentRepository.save(any(Student.class))).thenAnswer(i -> i.getArgument(0));

            String csvContent = "studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId,gpa,careerPath\n" +
                    "6621100002,ทดสอบ ผ่านอาจารย์แอดมิน,Test Admin Advisor,test2@bsru.ac.th,0812345679,วิทยาศาสตร์และเทคโนโลยี,วิทยาการคอมพิวเตอร์,1,กำลังศึกษา,ADV-01,3.50,Software Engineer";

            mockMvc.perform(post("/api/students/import-csv")
                            .header("Authorization", "Bearer " + advisorWithAdminToken)
                            .contentType("text/csv; charset=UTF-8")
                            .content(csvContent))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.importedCount").value(1));
        }

        @Test
        @DisplayName("Advisor with admin privilege calling create student succeeds with HTTP 201 Created")
        void advisorWithAdmin_CreateStudent_Returns201() throws Exception {
            when(studentAdminService.create(any(StudentRequest.class))).thenReturn(demoStudent);

            mockMvc.perform(post("/api/students")
                            .header("Authorization", "Bearer " + advisorWithAdminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"studentId\":\"6621100042\",\"nameTh\":\"สมชาย นักศึกษา\"}"))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("Normal advisor without admin privilege calling create student returns HTTP 403 Forbidden")
        void advisor_CreateStudent_Returns403() throws Exception {
            mockMvc.perform(post("/api/students")
                            .header("Authorization", "Bearer " + advisorToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"studentId\":\"6621100042\",\"nameTh\":\"สมชาย นักศึกษา\"}"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error", containsString("เฉพาะผู้ดูแลระบบเท่านั้น")));
        }
    }
}
