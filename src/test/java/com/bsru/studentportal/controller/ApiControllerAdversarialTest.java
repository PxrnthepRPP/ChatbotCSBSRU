package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.CareerUpdateRequest;
import com.bsru.studentportal.dto.PetitionRequest;
import com.bsru.studentportal.dto.PetitionStatusUpdateRequest;
import com.bsru.studentportal.model.AcademicPetition;
import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AcademicPetitionRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.AcademicRecordService;
import com.bsru.studentportal.service.GraduationAuditService;
import com.bsru.studentportal.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.Year;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApiControllerAdversarialTest {

    @Mock
    private StudentRepository studentRepository;

    @Mock
    private AdvisorRepository advisorRepository;

    @Mock
    private AcademicPetitionRepository petitionRepository;

    @Mock
    private AcademicRecordService academicRecordService;

    @Mock
    private GraduationAuditService graduationAuditService;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private ApiController apiController;

    private Authentication studentAuth;
    private Authentication advisorAuth;
    private Authentication adminAuth;

    private Student student1;
    private Student student2;
    private Advisor advisor1;
    private Advisor advisor2;

    @BeforeEach
    void setUp() {
        // student "6621100042" (or "student" alias)
        studentAuth = new UsernamePasswordAuthenticationToken(
                "6621100042", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        // advisor "ADV-01" (or "advisor" alias)
        advisorAuth = new UsernamePasswordAuthenticationToken(
                "ADV-01", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));

        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        advisor1 = new Advisor("ADV-01", "ผศ.ดร.สมชาย", "Somchai", "somchai@bsru.ac.th", "0812345678", "CS");
        advisor2 = new Advisor("ADV-02", "อ.วิภา", "Wipha", "wipha@bsru.ac.th", "0898765432", "CS");

        student1 = new Student();
        student1.setStudentId("6621100042");
        student1.setNameTh("ทดสอบ นักศึกษา");
        student1.setAdvisor(advisor1);

        student2 = new Student();
        student2.setStudentId("6621100099");
        student2.setNameTh("นักศึกษา อื่น");
        student2.setAdvisor(advisor2);
    }

    // =========================================================================
    // Challenge 1: Caller Student ID Check on POST /api/petitions
    // =========================================================================

    @Test
    @DisplayName("Challenge 1.1: Malicious student attempts to submit petition for another student -> returns 403")
    void testSubmitPetition_StudentCaller_TriesToSpoofAnotherStudent_Returns403() {
        PetitionRequest request = new PetitionRequest();
        request.setTitle("ขอผ่อนผันค่าเทอม");
        request.setType("การเงิน");
        request.setStudentId("6621100099"); // Another student's ID

        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("ไม่อนุญาตให้ยื่นคำร้องแทนนักศึกษาคนอื่น"));
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 1.2: Student caller with null studentId in body -> uses authenticated studentId")
    void testSubmitPetition_StudentCaller_WithNullStudentIdInBody_SucceedsWithCallerId() {
        PetitionRequest request = new PetitionRequest();
        request.setTitle("ขอหนังสือรับรอง");
        request.setType("เอกสาร");
        request.setStudentId(null);

        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(List.of());
        when(petitionRepository.existsById(anyString())).thenReturn(false);
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AcademicPetition saved = (AcademicPetition) response.getBody();
        assertNotNull(saved);
        assertEquals("6621100042", saved.getStudent().getStudentId());
        assertEquals("รออาจารย์ที่ปรึกษาพิจารณา", saved.getStatus());
    }

    @Test
    @DisplayName("Challenge 1.3: Student caller with blank studentId in body -> uses authenticated studentId")
    void testSubmitPetition_StudentCaller_WithBlankStudentIdInBody_SucceedsWithCallerId() {
        PetitionRequest request = new PetitionRequest();
        request.setTitle("ขอหนังสือรับรอง");
        request.setType("เอกสาร");
        request.setStudentId("   ");

        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(List.of());
        when(petitionRepository.existsById(anyString())).thenReturn(false);
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AcademicPetition saved = (AcademicPetition) response.getBody();
        assertNotNull(saved);
        assertEquals("6621100042", saved.getStudent().getStudentId());
    }

    @Test
    @DisplayName("Challenge 1.4: Student caller with whitespace padded spoofed ID -> returns 403")
    void testSubmitPetition_StudentCaller_WithWhitespacePaddedMismatch_Returns403() {
        PetitionRequest request = new PetitionRequest();
        request.setTitle("ขอหนังสือรับรอง");
        request.setType("เอกสาร");
        request.setStudentId(" 6621100099 ");

        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 1.5: Null/anonymous authentication calling POST /api/petitions -> returns 403")
    void testSubmitPetition_NullAuthentication_Returns403() {
        PetitionRequest request = new PetitionRequest();
        request.setTitle("ขอหนังสือรับรอง");
        request.setType("เอกสาร");

        ResponseEntity<?> response = apiController.submitPetition(request, null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 1.6: Advisor attempting to submit petition -> returns 403")
    void testSubmitPetition_AdvisorCaller_Returns403() {
        PetitionRequest request = new PetitionRequest();
        request.setTitle("ขอหนังสือรับรอง");
        request.setType("เอกสาร");
        request.setStudentId("6621100042");

        ResponseEntity<?> response = apiController.submitPetition(request, advisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 1.7: Student not found in DB -> returns 404 (all.get(0) fallback is eliminated)")
    void testSubmitPetition_StudentNotFoundInDb_Returns404_NoFallback() {
        PetitionRequest request = new PetitionRequest();
        request.setTitle("ขอหนังสือรับรอง");
        request.setType("เอกสาร");

        when(studentRepository.findById("6621100042")).thenReturn(Optional.empty());

        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(studentRepository, never()).findAll();
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 1.8: Missing required fields (title or type) -> returns 400 Bad Request")
    void testSubmitPetition_MissingTitleOrType_Returns400() {
        PetitionRequest req1 = new PetitionRequest();
        req1.setTitle("");
        req1.setType("เอกสาร");
        assertEquals(HttpStatus.BAD_REQUEST, apiController.submitPetition(req1, studentAuth).getStatusCode());

        PetitionRequest req2 = new PetitionRequest();
        req2.setTitle("หัวข้อ");
        req2.setType("   ");
        assertEquals(HttpStatus.BAD_REQUEST, apiController.submitPetition(req2, studentAuth).getStatusCode());
    }

    // =========================================================================
    // Challenge 2: Petition ID Generation & Collision Stress Testing
    // =========================================================================

    @Test
    @DisplayName("Challenge 2.1: Non-numeric petition IDs in DB do not crash ID generation")
    void testPetitionIdGeneration_WithNonNumericIdsInDb_SafelyParsesAndIncrements() {
        int yearBE = Year.now().getValue() + 543;
        String prefix = String.format("PET-%d-", yearBE);

        // Simulated malformed and mixed IDs already in the DB
        List<String> malformedIds = List.of(
                prefix + "ABC",
                prefix + "draft",
                prefix + "001-rev",
                prefix + "003",
                prefix + "special_char");

        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(malformedIds);
        when(petitionRepository.existsById(prefix + "004")).thenReturn(false);
        when(petitionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PetitionRequest request = new PetitionRequest("ทั่วไป", "หัวข้อ", "รายละเอียด", null, null);
        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AcademicPetition saved = (AcademicPetition) response.getBody();
        assertNotNull(saved);
        assertEquals(prefix + "004", saved.getId(), "Must detect max valid integer (3) and increment to 004");
    }

    @Test
    @DisplayName("Challenge 2.2: Huge integer overflow suffix in DB does not crash sequence parsing")
    void testPetitionIdGeneration_WithLargeNumberSuffix_SafelyHandlesOverflow() {
        int yearBE = Year.now().getValue() + 543;
        String prefix = String.format("PET-%d-", yearBE);

        List<String> extremeIds = List.of(
                prefix + "99999999999999999999999999999999", // Exceeds Integer.MAX_VALUE
                prefix + "005");

        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(extremeIds);
        when(petitionRepository.existsById(prefix + "006")).thenReturn(false);
        when(petitionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PetitionRequest request = new PetitionRequest("ทั่วไป", "หัวข้อ", "รายละเอียด", null, null);
        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AcademicPetition saved = (AcademicPetition) response.getBody();
        assertEquals(prefix + "006", saved.getId());
    }

    @Test
    @DisplayName("Challenge 2.3: Sequence numbers with gaps avoid collisions and take max + 1")
    void testPetitionIdGeneration_WithSequenceGaps_DoesNotReuseOldNumbers() {
        int yearBE = Year.now().getValue() + 543;
        String prefix = String.format("PET-%d-", yearBE);

        // Gap: 001 exists, 002-009 deleted, 010 exists
        List<String> idsWithGaps = List.of(prefix + "001", prefix + "010");

        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(idsWithGaps);
        when(petitionRepository.existsById(prefix + "011")).thenReturn(false);
        when(petitionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PetitionRequest request = new PetitionRequest("ทั่วไป", "หัวข้อ", "รายละเอียด", null, null);
        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AcademicPetition saved = (AcademicPetition) response.getBody();
        assertEquals(prefix + "011", saved.getId());
    }

    @Test
    @DisplayName("Challenge 2.4: Secondary collision loop advances sequence if ID exists in DB")
    void testPetitionIdGeneration_ExistsByIdCollisionLoop_AdvancesSequenceUntilUnique() {
        int yearBE = Year.now().getValue() + 543;
        String prefix = String.format("PET-%d-", yearBE);

        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(List.of(prefix + "001"));

        // Simulate concurrent insertion: 002 and 003 already exist
        when(petitionRepository.existsById(prefix + "002")).thenReturn(true);
        when(petitionRepository.existsById(prefix + "003")).thenReturn(true);
        when(petitionRepository.existsById(prefix + "004")).thenReturn(false);
        when(petitionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PetitionRequest request = new PetitionRequest("ทั่วไป", "หัวข้อ", "รายละเอียด", null, null);
        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AcademicPetition saved = (AcademicPetition) response.getBody();
        assertEquals(prefix + "004", saved.getId());
    }

    @Test
    @DisplayName("Challenge 2.5: Sequence over 999 does not truncate digits")
    void testPetitionIdGeneration_SequenceOver999_DoesNotTruncate() {
        int yearBE = Year.now().getValue() + 543;
        String prefix = String.format("PET-%d-", yearBE);

        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(petitionRepository.findPetitionIdsStartingWith(anyString())).thenReturn(List.of(prefix + "999"));
        when(petitionRepository.existsById(prefix + "1000")).thenReturn(false);
        when(petitionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PetitionRequest request = new PetitionRequest("ทั่วไป", "หัวข้อ", "รายละเอียด", null, null);
        ResponseEntity<?> response = apiController.submitPetition(request, studentAuth);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        AcademicPetition saved = (AcademicPetition) response.getBody();
        assertEquals(prefix + "1000", saved.getId());
    }

    // =========================================================================
    // Challenge 3: PATCH /api/petitions/{id}/status Privilege Escalation
    // =========================================================================

    @Test
    @DisplayName("Challenge 3.1: Student caller cannot update petition status -> returns 403")
    void testUpdatePetitionStatus_StudentCaller_Returns403() {
        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("อนุมัติ", "student self-approval");

        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("นักศึกษาไม่ได้รับอนุญาตให้แก้ไขสถานะคำร้อง"));
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 3.2: Cross-advisor privilege escalation: Advisor A cannot approve Advisor B's advisee -> returns 403")
    void testUpdatePetitionStatus_CrossAdvisorEscalation_Returns403() {
        // student2 belongs to advisor2 ("ADV-02")
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-002");
        petition.setStudent(student2);
        petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");

        when(petitionRepository.findById("PET-2569-002")).thenReturn(Optional.of(petition));

        // advisorAuth is "ADV-01"
        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("รอผู้ดูแลระบบอนุมัติ",
                "Advisor 1 trying to approve Advisor 2 student");
        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-002", req, advisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertTrue(response.getBody().toString()
                .contains("อาจารย์สามารถแก้ไขสถานะได้เฉพาะคำร้องของนักศึกษาในความดูแลเท่านั้น"));
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 3.3: Assigned advisor can update status for own advisee -> returns 200")
    void testUpdatePetitionStatus_AssignedAdvisor_Succeeds() {
        // student1 belongs to advisor1 ("ADV-01")
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);
        petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("รอผู้ดูแลระบบอนุมัติ", "เห็นควรส่งต่อ");
        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, advisorAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AcademicPetition updated = (AcademicPetition) response.getBody();
        assertNotNull(updated);
        assertEquals("รอผู้ดูแลระบบอนุมัติ", updated.getStatus());
        assertEquals("เห็นควรส่งต่อ", updated.getAdminComment());
    }

    @Test
    @DisplayName("Challenge 3.4: Student has no assigned advisor -> advisor attempt returns 403")
    void testUpdatePetitionStatus_StudentHasNoAdvisor_AdvisorReturns403() {
        Student unassignedStudent = new Student();
        unassignedStudent.setStudentId("6621100099");
        unassignedStudent.setAdvisor(null);

        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-003");
        petition.setStudent(unassignedStudent);
        petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");

        when(petitionRepository.findById("PET-2569-003")).thenReturn(Optional.of(petition));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("รอผู้ดูแลระบบอนุมัติ", "endorse");
        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-003", req, advisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 3.5: Non-existent petition ID -> returns 404 Not Found")
    void testUpdatePetitionStatus_PetitionNotFound_Returns404() {
        when(petitionRepository.findById("NON-EXISTENT")).thenReturn(Optional.empty());

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("อนุมัติ", "approve");
        ResponseEntity<?> response = apiController.updatePetitionStatus("NON-EXISTENT", req, adminAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    @DisplayName("Challenge 3.6: Unauthenticated caller updating petition status -> returns 403")
    void testUpdatePetitionStatus_AnonymousCaller_Returns403() {
        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("อนุมัติ", "anon");
        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 3.7: Admin caller can update any petition regardless of advisor")
    void testUpdatePetitionStatus_AdminCaller_CanUpdateAnyAdviseePetition() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-002");
        petition.setStudent(student2); // Student of Advisor 2
        petition.setStatus("รอผู้ดูแลระบบอนุมัติ");

        when(petitionRepository.findById("PET-2569-002")).thenReturn(Optional.of(petition));
        when(petitionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("อนุมัติ", "Admin final approval");
        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-002", req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AcademicPetition updated = (AcademicPetition) response.getBody();
        assertEquals("อนุมัติ", updated.getStatus());
        assertEquals("Admin final approval", updated.getAdminComment());
    }

    @Test
    @DisplayName("Challenge 3.8: Advisor cannot directly approve petition to 'อนุมัติ' bypassing Admin -> returns 400 Bad Request")
    void testUpdatePetitionStatus_AdvisorAttemptsDirectApprove_Returns400BadRequest() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);
        petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
        req.setStatus("อนุมัติ");
        req.setAdvisorComment("Advisor trying to approve directly");

        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, advisorAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("อาจารย์ที่ปรึกษาไม่สามารถอนุมัติคำร้องโดยตรงได้"));
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 3.9: Advisor can endorse petition to 'รอผู้ดูแลระบบอนุมัติ' with advisorComment and timestamp")
    void testUpdatePetitionStatus_AdvisorEndorsesPetition_SetsAdvisorCommentAndTimestamp() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);
        petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
        req.setStatus("รอผู้ดูแลระบบอนุมัติ");
        req.setAdvisorComment("เห็นชอบ ควรเสนอต่อสาขาและผู้ดูแลระบบ");

        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, advisorAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AcademicPetition updated = (AcademicPetition) response.getBody();
        assertNotNull(updated);
        assertEquals("รอผู้ดูแลระบบอนุมัติ", updated.getStatus());
        assertEquals("เห็นชอบ ควรเสนอต่อสาขาและผู้ดูแลระบบ", updated.getAdvisorComment());
        assertNotNull(updated.getAdvisorReviewedAt(), "Advisor review timestamp must be set");
    }

    @Test
    @DisplayName("Challenge 3.10: Advisor can reject petition to 'ไม่อนุมัติ' with advisorComment and timestamp")
    void testUpdatePetitionStatus_AdvisorRejectsPetition_SetsAdvisorCommentAndTimestamp() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);
        petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
        req.setStatus("ไม่อนุมัติ");
        req.setAdvisorComment("เอกสารแนบไม่สมบูรณ์ ข้อมูลไม่สอดคล้องกับระเบียบ");

        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, advisorAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AcademicPetition updated = (AcademicPetition) response.getBody();
        assertNotNull(updated);
        assertEquals("ไม่อนุมัติ", updated.getStatus());
        assertEquals("เอกสารแนบไม่สมบูรณ์ ข้อมูลไม่สอดคล้องกับระเบียบ", updated.getAdvisorComment());
        assertNotNull(updated.getAdvisorReviewedAt(), "Advisor review timestamp must be set");
    }

    @Test
    @DisplayName("Challenge 3.11: Admin can make final rejection to 'ไม่อนุมัติ' with adminComment and timestamp")
    void testUpdatePetitionStatus_AdminRejectsPetition_SetsAdminCommentAndTimestamp() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);
        petition.setStatus("รอผู้ดูแลระบบอนุมัติ");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
        req.setStatus("ไม่อนุมัติ");
        req.setAdminComment("ไม่อนุมัติตามระเบียบข้อบังคับคณะฯ");

        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AcademicPetition updated = (AcademicPetition) response.getBody();
        assertNotNull(updated);
        assertEquals("ไม่อนุมัติ", updated.getStatus());
        assertEquals("ไม่อนุมัติตามระเบียบข้อบังคับคณะฯ", updated.getAdminComment());
        assertNotNull(updated.getAdminReviewedAt(), "Admin review timestamp must be set");
    }

    @Test
    @DisplayName("Challenge 3.12: Admin can make final approval to 'อนุมัติ' with adminComment and timestamp")
    void testUpdatePetitionStatus_AdminApprovesPetition_SetsAdminCommentAndTimestamp() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);
        petition.setStatus("รอผู้ดูแลระบบอนุมัติ");
        petition.setAdvisorComment("อาจารย์เห็นชอบ");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));
        when(petitionRepository.save(any(AcademicPetition.class))).thenAnswer(inv -> inv.getArgument(0));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest();
        req.setStatus("อนุมัติ");
        req.setAdminComment("อนุมัติคำร้องเรียบร้อย");

        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AcademicPetition updated = (AcademicPetition) response.getBody();
        assertNotNull(updated);
        assertEquals("อนุมัติ", updated.getStatus());
        assertEquals("อาจารย์เห็นชอบ", updated.getAdvisorComment(), "Advisor comment must be preserved");
        assertEquals("อนุมัติคำร้องเรียบร้อย", updated.getAdminComment());
        assertNotNull(updated.getAdminReviewedAt(), "Admin review timestamp must be set");
    }

    @Test
    @DisplayName("Challenge 3.13: Advisor providing invalid target status returns 400 Bad Request")
    void testUpdatePetitionStatus_AdvisorInvalidStatus_Returns400() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);
        petition.setStatus("รออาจารย์ที่ปรึกษาพิจารณา");

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("INVALID_STATUS", "invalid");
        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, advisorAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("สถานะที่ระบุไม่ถูกต้องสำหรับการพิจารณาของอาจารย์ที่ปรึกษา"));
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 3.14: Admin providing invalid target status returns 400 Bad Request")
    void testUpdatePetitionStatus_AdminInvalidStatus_Returns400() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));

        PetitionStatusUpdateRequest req = new PetitionStatusUpdateRequest("INVALID_STATUS", "invalid");
        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", req, adminAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("สถานะที่ระบุไม่ถูกต้องสำหรับการพิจารณาของผู้ดูแลระบบ"));
        verify(petitionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 3.15: Null or blank status in payload returns 400 Bad Request")
    void testUpdatePetitionStatus_BlankOrNullStatus_Returns400() {
        AcademicPetition petition = new AcademicPetition();
        petition.setId("PET-2569-001");
        petition.setStudent(student1);

        when(petitionRepository.findById("PET-2569-001")).thenReturn(Optional.of(petition));

        PetitionStatusUpdateRequest blankReq = new PetitionStatusUpdateRequest("   ", "comment");
        ResponseEntity<?> response = apiController.updatePetitionStatus("PET-2569-001", blankReq, adminAuth);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("status is required"));
        verify(petitionRepository, never()).save(any());
    }

    // =========================================================================
    // Challenge 4: PATCH /api/students/{studentId}/career IDOR Check
    // =========================================================================

    @Test
    @DisplayName("Challenge 4.1: Student can update their own career information -> returns 200")
    void testUpdateCareer_StudentUpdatesOwnProfile_Succeeds() {
        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(studentRepository.save(any(Student.class))).thenAnswer(inv -> inv.getArgument(0));

        CareerUpdateRequest req = new CareerUpdateRequest("Fullstack Developer", "Employed", "Tech Corp",
                "30,000 - 40,000");
        ResponseEntity<?> response = apiController.updateStudentCareer("6621100042", req, studentAuth);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Student updated = (Student) response.getBody();
        assertNotNull(updated);
        assertEquals("Fullstack Developer", updated.getCareerPath());
        assertEquals("Employed", updated.getEmploymentStatus());
        assertEquals("Tech Corp", updated.getCompanyName());
        assertEquals("30,000 - 40,000", updated.getSalaryRange());
        assertNotNull(updated.getCareerUpdatedAt());
    }

    @Test
    @DisplayName("Challenge 4.2: Malicious student attempts to alter another student's career -> returns 403")
    void testUpdateCareer_StudentAttemptsToUpdateAnotherStudent_Returns403() {
        CareerUpdateRequest req = new CareerUpdateRequest("Malicious Path", "Unemployed", "Fake Co", "0");
        ResponseEntity<?> response = apiController.updateStudentCareer("6621100099", req, studentAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertTrue(response.getBody().toString().contains("นักศึกษาสามารถแก้ไขข้อมูลสายอาชีพของตนเองเท่านั้น"));
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 4.3: Advisor attempting to update student career directly -> returns 403")
    void testUpdateCareer_AdvisorAttemptsToUpdateStudentCareer_Returns403() {
        CareerUpdateRequest req = new CareerUpdateRequest("Advisor Suggested Path", "Employed", "Advisor Co", "50,000");
        ResponseEntity<?> response = apiController.updateStudentCareer("6621100042", req, advisorAuth);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 4.4: Unauthenticated caller updating career -> returns 403")
    void testUpdateCareer_UnauthenticatedCaller_Returns403() {
        CareerUpdateRequest req = new CareerUpdateRequest("Path", "Employed", "Co", "50,000");
        ResponseEntity<?> response = apiController.updateStudentCareer("6621100042", req, null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Challenge 4.5: Admin can update any student's career information -> returns 200")
    void testUpdateCareer_AdminCanUpdateStudentCareer() {
        when(studentRepository.findById("6621100042")).thenReturn(Optional.of(student1));
        when(studentRepository.save(any(Student.class))).thenAnswer(inv -> inv.getArgument(0));

        CareerUpdateRequest req = new CareerUpdateRequest("DevOps Engineer", "Employed", "Cloud Inc", "45,000");
        ResponseEntity<?> response = apiController.updateStudentCareer("6621100042", req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Student updated = (Student) response.getBody();
        assertEquals("DevOps Engineer", updated.getCareerPath());
    }

    @Test
    @DisplayName("Challenge 4.6: Update career for non-existent student ID -> returns 404")
    void testUpdateCareer_StudentNotFoundInDb_Returns404() {
        when(studentRepository.findById("NON_EXISTENT")).thenReturn(Optional.empty());

        CareerUpdateRequest req = new CareerUpdateRequest("DevOps", "Employed", "Cloud", "45k");
        ResponseEntity<?> response = apiController.updateStudentCareer("NON_EXISTENT", req, adminAuth);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(studentRepository, never()).save(any());
    }

    // =========================================================================
    // Challenge 5: GET /api/petitions Scoping Verification
    // =========================================================================

    @Test
    @DisplayName("Challenge 5.1: Student only gets their own petitions")
    void testGetAllPetitions_StudentCaller_OnlySeesOwnPetitions() {
        AcademicPetition ownPetition = new AcademicPetition();
        ownPetition.setId("PET-2569-001");
        ownPetition.setStudent(student1);

        when(petitionRepository.findByStudentStudentIdOrderBySubmittedAtDesc("6621100042"))
                .thenReturn(List.of(ownPetition));

        ResponseEntity<?> response = apiController.getAllPetitions(studentAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> list = (List<?>) response.getBody();
        assertNotNull(list);
        assertEquals(1, list.size());
        verify(petitionRepository).findByStudentStudentIdOrderBySubmittedAtDesc("6621100042");
        verify(petitionRepository, never()).findAll();
    }

    @Test
    @DisplayName("Challenge 5.2: Advisor only gets petitions of their advisees")
    void testGetAllPetitions_AdvisorCaller_OnlySeesAdviseesPetitions() {
        AcademicPetition adviseePetition = new AcademicPetition();
        adviseePetition.setId("PET-2569-001");
        adviseePetition.setStudent(student1);

        when(petitionRepository.findByStudentAdvisorIdOrderBySubmittedAtDesc("ADV-01"))
                .thenReturn(List.of(adviseePetition));

        ResponseEntity<?> response = apiController.getAllPetitions(advisorAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> list = (List<?>) response.getBody();
        assertNotNull(list);
        assertEquals(1, list.size());
        verify(petitionRepository).findByStudentAdvisorIdOrderBySubmittedAtDesc("ADV-01");
        verify(petitionRepository, never()).findAll();
    }

    @Test
    @DisplayName("Challenge 5.3: Admin caller retrieves all petitions")
    void testGetAllPetitions_AdminCaller_SeesAllPetitions() {
        when(petitionRepository.findAll(any(org.springframework.data.domain.Sort.class))).thenReturn(List.of(new AcademicPetition(), new AcademicPetition()));

        ResponseEntity<?> response = apiController.getAllPetitions(adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> list = (List<?>) response.getBody();
        assertNotNull(list);
        assertEquals(2, list.size());
        verify(petitionRepository).findAll(any(org.springframework.data.domain.Sort.class));
    }

    @Test
    @DisplayName("Challenge 5.4: Unauthenticated caller calling GET /api/petitions -> returns 403")
    void testGetAllPetitions_Unauthenticated_Returns403() {
        ResponseEntity<?> response = apiController.getAllPetitions(null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(petitionRepository, never()).findAll();
    }
}
