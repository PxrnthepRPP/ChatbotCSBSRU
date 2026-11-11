package com.bsru.studentportal.controller;

import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisingNoteRepository;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.AccountService;
import com.bsru.studentportal.service.StudentAdminService;
import com.bsru.studentportal.service.StudentAdminService.StudentAdminException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Adversarial and Stress Test Suite for CSV Bulk Import and Export.
 * Validates security boundaries, BOM encoding/stripping, multi-format payloads,
 * error handling, intra-batch and database deduplication, and status normalization.
 */
@ExtendWith(MockitoExtension.class)
class StudentCsvAdversarialTest {

    @Mock
    private StudentAdminService studentAdminService;
    @Mock
    private AccountService accountService;
    @Mock
    private StudentRepository studentRepository;
    @Mock
    private AdvisorRepository advisorRepository;
    @Mock
    private AdvisingNoteRepository advisingNoteRepository;

    private StudentAdminController controller;

    private Authentication adminAuth;
    private Authentication advisorAuth;
    private Authentication studentAuth;
    private MockHttpServletRequest httpServletRequest;

    @BeforeEach
    void setUp() {
        controller = new StudentAdminController(
                studentAdminService,
                accountService,
                studentRepository,
                advisorRepository,
                advisingNoteRepository
        );

        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        advisorAuth = new UsernamePasswordAuthenticationToken(
                "ADV-01", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADVISOR")));
        studentAuth = new UsernamePasswordAuthenticationToken(
                "6621100042", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        httpServletRequest = new MockHttpServletRequest();
    }

    // =========================================================================
    // 1. Security & RBAC Enforcement
    // =========================================================================

    @Test
    @DisplayName("Security: Non-admin student cannot import CSV (HTTP 403)")
    void testImportCsv_studentAuth_rejected403() {
        String csv = "nationalId,studentId,nameTh\n1662110111103,6621101111,ทดสอบ";
        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                controller.importCsv(csv, null, httpServletRequest, studentAuth));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        verify(studentRepository, never()).save(any());
        verify(accountService, never()).createStudentAccount(any());
    }

    @Test
    @DisplayName("Security: Advisor cannot import CSV (HTTP 403)")
    void testImportCsv_advisorAuth_rejected403() {
        String csv = "nationalId,studentId,nameTh\n1662110111103,6621101111,ทดสอบ";
        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                controller.importCsv(csv, null, httpServletRequest, advisorAuth));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Security: Anonymous/null authentication cannot import CSV (HTTP 403)")
    void testImportCsv_nullAuth_rejected403() {
        String csv = "nationalId,studentId,nameTh\n1662110111103,6621101111,ทดสอบ";
        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                controller.importCsv(csv, null, httpServletRequest, null));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    @DisplayName("Security: Non-admin student cannot export CSV (HTTP 403)")
    void testExportCsv_studentAuth_rejected403() {
        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                controller.exportCsv(studentAuth));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    @DisplayName("Security: Advisor cannot export CSV (HTTP 403)")
    void testExportCsv_advisorAuth_rejected403() {
        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                controller.exportCsv(advisorAuth));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    // =========================================================================
    // 2. Input Formats: Raw text, Multipart, JSON variations & Stream
    // =========================================================================

    @Test
    @DisplayName("Format: Multipart file upload with UTF-8 BOM bytes is supported and stripped")
    void testImportCsv_multipartWithBom_success() throws Exception {
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] csvBytes = ("nationalId,studentId,nameTh,faculty,major,year,status\n" +
                "1662110222207,6621102222,สมศักดิ์ รักชาติ,วิทยาการคอมพิวเตอร์,คณะวิทยาศาสตร์,2,กำลังศึกษา\n")
                .getBytes(StandardCharsets.UTF_8);

        byte[] fullContent = new byte[bom.length + csvBytes.length];
        System.arraycopy(bom, 0, fullContent, 0, bom.length);
        System.arraycopy(csvBytes, 0, fullContent, bom.length, csvBytes.length);

        MockMultipartFile file = new MockMultipartFile("file", "students.csv", "text/csv", fullContent);

        when(studentRepository.existsById("6621102222")).thenReturn(false);

        ResponseEntity<?> response = controller.importCsv(null, file, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(1, body.get("importedCount"));
        assertEquals(0, body.get("skippedCount"));

        ArgumentCaptor<Student> captor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository, times(1)).save(captor.capture());
        assertEquals("6621102222", captor.getValue().getStudentId());
        assertEquals("สมศักดิ์ รักชาติ", captor.getValue().getNameTh());
        verify(accountService, times(1)).createStudentAccount("6621102222");
    }

    @Test
    @DisplayName("Format: JSON payload with 'csv' property succeeds")
    void testImportCsv_jsonWithCsvProp_success() throws Exception {
        String jsonPayload = "{\"csv\": \"nationalId,studentId,nameTh\\n1662110333301,6621103333,มานะ กล้าหาญ\"}";
        when(studentRepository.existsById("6621103333")).thenReturn(false);

        ResponseEntity<?> response = controller.importCsv(jsonPayload, null, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(1, body.get("importedCount"));
        verify(studentRepository, times(1)).save(any(Student.class));
        verify(accountService, times(1)).createStudentAccount("6621103333");
    }

    @Test
    @DisplayName("Format: Raw InputStream fallback when rawBody and file are null")
    void testImportCsv_inputStreamFallback_success() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        String csvContent = "nationalId,studentId,nameTh\n1662110444404,6621104444,กานดา สดใส";
        req.setContent(csvContent.getBytes(StandardCharsets.UTF_8));

        when(studentRepository.existsById("6621104444")).thenReturn(false);

        ResponseEntity<?> response = controller.importCsv(null, null, req, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(1, body.get("importedCount"));
        verify(studentRepository, times(1)).save(any(Student.class));
    }

    // =========================================================================
    // 3. Deduplication & Intra-batch Duplicate Handling
    // =========================================================================

    @Test
    @DisplayName("Deduplication: Duplicate IDs inside the SAME batch are skipped gracefully")
    void testImportCsv_intraBatchDuplicates_skipped() throws Exception {
        String csv = "nationalId,studentId,nameTh\n" +
                "1662110555508,6621105555,คนแรก\n" +
                "1662110555508,6621105555,คนเดิมซ้ำแถวสอง\n" +
                "1662110666601,6621106666,คนใหม่";

        when(studentRepository.existsById("6621105555")).thenReturn(false);
        when(studentRepository.existsById("6621106666")).thenReturn(false);

        ResponseEntity<?> response = controller.importCsv(csv, null, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(2, body.get("importedCount"));
        assertEquals(1, body.get("skippedCount"));
        assertEquals(3, body.get("total"));

        verify(studentRepository, times(2)).save(any(Student.class));
        verify(accountService, times(1)).createStudentAccount("6621105555");
        verify(accountService, times(1)).createStudentAccount("6621106666");
    }

    // =========================================================================
    // 4. Data Normalization, Statuses & Thai Headers
    // =========================================================================

    @Test
    @DisplayName("Normalization: Status mapping (GRADUATED, ON_LEAVE, DISMISSED, STUDYING) & Thai headers")
    void testImportCsv_statusMappingAndThaiHeaders() throws Exception {
        String csv = "nationalId,รหัสนักศึกษา,ชื่อ-สกุล,สถานะ,เกรดเฉลี่ย,สายอาชีพ\n" +
                "1662110777101,6621107771,นักศึกษาที่หนึ่ง,GRADUATED,3.75,AI Engineer\n" +
                "1662110777209,6621107772,นักศึกษาที่สอง,ON_LEAVE,2.50,Data Analyst\n" +
                "1662110777306,6621107773,นักศึกษาที่สาม,DISMISSED,1.80,Web Developer";

        when(studentRepository.existsById(anyString())).thenReturn(false);

        ResponseEntity<?> response = controller.importCsv(csv, null, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(3, body.get("importedCount"));

        ArgumentCaptor<Student> captor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository, times(3)).save(captor.capture());
        List<Student> saved = captor.getAllValues();

        assertEquals("จบการศึกษา", saved.get(0).getStatus());
        assertEquals(3.75, saved.get(0).getGpa(), 0.001);
        assertEquals("AI Engineer", saved.get(0).getCareerPath());

        assertEquals("พักการศึกษา", saved.get(1).getStatus());
        assertEquals(2.50, saved.get(1).getGpa(), 0.001);

        assertEquals("พ้นสภาพ", saved.get(2).getStatus());
        assertEquals(1.80, saved.get(2).getGpa(), 0.001);
    }

    // =========================================================================
    // 5. Malformed Data & Edge Cases
    // =========================================================================

    @Test
    @DisplayName("Validation: Mixed valid and invalid rows imports valid ones and logs errors")
    void testImportCsv_partialInvalidRows_importsValidAndLogsErrors() throws Exception {
        String csv = "nationalId,studentId,nameTh\n" +
                "1662110888108,6621108881,ถูกต้อง\n" +
                "INVALID_ID,ผิดพลาด\n" +
                "1662110888205,6621108882,ถูกต้องคนที่สอง";

        when(studentRepository.existsById("6621108881")).thenReturn(false);
        when(studentRepository.existsById("6621108882")).thenReturn(false);

        ResponseEntity<?> response = controller.importCsv(csv, null, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(2, body.get("importedCount"));
        assertEquals(0, body.get("skippedCount"));

        @SuppressWarnings("unchecked")
        List<String> errors = (List<String>) body.get("errors");
        assertNotNull(errors);
        assertEquals(1, errors.size());
        assertTrue(errors.get(0).contains("INVALID_ID") || errors.get(0).contains("ไม่ถูกต้อง"));

        verify(studentRepository, times(2)).save(any(Student.class));
    }

    @Test
    @DisplayName("Validation: All rows having invalid student IDs results in 400 Bad Request")
    void testImportCsv_allRowsInvalid_returns400() {
        String csv = "nationalId,studentId,nameTh\n" +
                "NOT_AN_ID,คนแรก\n" +
                "SHORT,คนที่สอง";

        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                controller.importCsv(csv, null, httpServletRequest, adminAuth));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("ไม่มีข้อมูลนักศึกษาที่ถูกต้อง"));
    }

    @Test
    @DisplayName("Validation: Header only with no data rows returns 400 Bad Request")
    void testImportCsv_headerOnlyNoData_returns400() {
        String csv = "nationalId,studentId,nameTh,email\n";

        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                controller.importCsv(csv, null, httpServletRequest, adminAuth));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("Validation: Headerless CSV starting with valid 10-digit ID is accepted")
    void testImportCsv_headerlessWithValid10DigitId_accepted() throws Exception {
        String csv = "6621109999,สมศักดิ์ ไม่มีหัวตาราง,Somsak,somsak@bsru.ac.th,0899999999,วิทยาศาสตร์,วิทยาการคอมพิวเตอร์,1,STUDYING,ADV-01,1662110999902";

        when(studentRepository.existsById("6621109999")).thenReturn(false);
        when(advisorRepository.findById("ADV-01")).thenReturn(Optional.of(new Advisor("ADV-01", "อ.วิชัย", null, null, null, null)));

        ResponseEntity<?> response = controller.importCsv(csv, null, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(1, body.get("importedCount"));
        verify(studentRepository, times(1)).save(any(Student.class));
    }

    // =========================================================================
    // 6. CSV Export Verification (BOM & Quoting)
    // =========================================================================

    @Test
    @DisplayName("Export: Verify UTF-8 BOM, headers, and quote escaping for special characters")
    void testExportCsv_completeVerification() throws Exception {
        Student s = new Student();
        s.setStudentId("6621100042");
        s.setNameTh("นายทดสอบ \"มีเครื่องหมายคำพูด\" และ, จุลภาค");
        s.setNameEn("Test \"Quotes\" and, Comma");
        s.setEmail("test@bsru.ac.th");
        s.setFaculty("คณะวิทยาศาสตร์และเทคโนโลยี");
        s.setDepartment("สาขาวิทยาการคอมพิวเตอร์");
        s.setYear(4);
        s.setStatus("จบการศึกษา");
        s.setGpa(3.85);
        s.setCareerPath("Cloud Architect");

        when(studentRepository.findAll(any(Sort.class))).thenReturn(List.of(s));

        ResponseEntity<byte[]> response = controller.exportCsv(adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getHeaders().getContentType().toString().startsWith("text/csv"));
        assertTrue(response.getHeaders().getContentType().toString().contains("charset=UTF-8"));
        assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("students_bsru.csv"));

        byte[] body = response.getBody();
        assertNotNull(body);
        assertTrue(body.length >= 3);

        // Verify UTF-8 BOM bytes 0xEF, 0xBB, 0xBF
        assertEquals((byte) 0xEF, body[0]);
        assertEquals((byte) 0xBB, body[1]);
        assertEquals((byte) 0xBF, body[2]);

        String csvString = new String(body, StandardCharsets.UTF_8);
        assertTrue(csvString.startsWith("\uFEFF"));
        assertTrue(csvString.contains("studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId,gpa,careerPath"));
        assertTrue(csvString.contains("\"นายทดสอบ \"\"มีเครื่องหมายคำพูด\"\" และ, จุลภาค\""));
        assertTrue(csvString.contains("\"Test \"\"Quotes\"\" and, Comma\""));
        assertTrue(csvString.contains("3.85"));
        assertTrue(csvString.contains("Cloud Architect"));
    }
}
