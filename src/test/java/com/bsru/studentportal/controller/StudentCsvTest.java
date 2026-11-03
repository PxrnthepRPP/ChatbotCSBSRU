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

@ExtendWith(MockitoExtension.class)
class StudentCsvTest {

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

    private StudentAdminController studentAdminController;

    private Authentication adminAuth;
    private Authentication studentAuth;
    private MockHttpServletRequest httpServletRequest;

    @BeforeEach
    void setUp() {
        studentAdminController = new StudentAdminController(
                studentAdminService,
                accountService,
                studentRepository,
                advisorRepository,
                advisingNoteRepository
        );

        adminAuth = new UsernamePasswordAuthenticationToken(
                "admin", "n/a", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        studentAuth = new UsernamePasswordAuthenticationToken(
                "6621100042", "n/a", List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));

        httpServletRequest = new MockHttpServletRequest();
    }

    @Test
    @DisplayName("CSV Import: Valid CSV rows import new students and skip existing ones")
    void testImportCsv_validRows_importsNewStudentsAndSkipsDuplicates() throws Exception {
        String csv = "studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId\n"
                + "6621109901,สมชาย เรียนดี,Somchai Reandee,somchai@bsru.ac.th,0812345671,วิทยาศาสตร์,วิทยาการคอมพิวเตอร์,1,STUDYING,ADV-01\n"
                + "6621109902,สมหญิง มุ่งมั่น,Somying Mungmun,somying@bsru.ac.th,0812345672,วิทยาศาสตร์,วิทยาการคอมพิวเตอร์,1,STUDYING,ADV-01";

        // 6621109901 is new, 6621109902 already exists in database
        when(studentRepository.existsById("6621109901")).thenReturn(false);
        when(studentRepository.existsById("6621109902")).thenReturn(true);
        when(advisorRepository.findById("ADV-01")).thenReturn(Optional.of(new Advisor("ADV-01", "อ.วิชัย", "Wichai", null, null, null)));

        ResponseEntity<?> response = studentAdminController.importCsv(csv, null, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("success"));
        assertEquals(1, body.get("importedCount"));
        assertEquals(1, body.get("skippedCount"));
        assertEquals(2, body.get("total"));

        // Verify new student was saved and account provisioned
        ArgumentCaptor<Student> captor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository, times(1)).save(captor.capture());
        assertEquals("6621109901", captor.getValue().getStudentId());
        assertEquals("สมชาย เรียนดี", captor.getValue().getNameTh());
        assertEquals("กำลังศึกษา", captor.getValue().getStatus());

        verify(accountService, times(1)).createStudentAccount("6621109901");
        verify(accountService, never()).createStudentAccount("6621109902");
    }

    @Test
    @DisplayName("CSV Import: Malformed header with missing studentId column returns 400 Bad Request")
    void testImportCsv_malformedHeader_returns400BadRequest() {
        String invalidCsv = "invalid,header,only\nmissing_fields_here";

        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                studentAdminController.importCsv(invalidCsv, null, httpServletRequest, adminAuth)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("studentId") || ex.getMessage().contains("ไม่ถูกต้อง"));
    }

    @Test
    @DisplayName("CSV Import: Empty or blank content returns 400 Bad Request")
    void testImportCsv_emptyContent_returns400BadRequest() {
        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                studentAdminController.importCsv("   \n\n  ", null, httpServletRequest, adminAuth)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("CSV Import: Non-admin caller receives 403 Forbidden")
    void testImportCsv_nonAdmin_throws403Forbidden() {
        String csv = "studentId,nameTh\n6621109901,สมชาย เรียนดี";

        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                studentAdminController.importCsv(csv, null, httpServletRequest, studentAuth)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("CSV Import: UTF-8 BOM is stripped cleanly before parsing")
    void testImportCsv_withUtf8Bom_stripsBomAndImports() throws Exception {
        String csvWithBom = "\uFEFFstudentId,nameTh\n6621109905,ทดสอบ บีโอเอ็ม";

        when(studentRepository.existsById("6621109905")).thenReturn(false);

        ResponseEntity<?> response = studentAdminController.importCsv(csvWithBom, null, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(1, body.get("importedCount"));
    }

    @Test
    @DisplayName("CSV Import: JSON payload wrapping csvData succeeds")
    void testImportCsv_jsonWrappedData_succeeds() throws Exception {
        String jsonPayload = "{\"csvData\": \"studentId,nameTh\\n6621109908,นายเจสัน ข้อมูล\"}";

        when(studentRepository.existsById("6621109908")).thenReturn(false);

        ResponseEntity<?> response = studentAdminController.importCsv(jsonPayload, null, httpServletRequest, adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(1, body.get("importedCount"));
    }

    @Test
    @DisplayName("CSV Export: Produces text/csv with UTF-8 BOM bytes 0xEF, 0xBB, 0xBF")
    void testExportCsv_containsUtf8BomAndHeaders() throws Exception {
        Student s1 = new Student();
        s1.setStudentId("6621100042");
        s1.setNameTh("สมชาย ใจดี");
        s1.setNameEn("Somchai Jaidee");
        s1.setEmail("somchai@bsru.ac.th");
        s1.setFaculty("คณะวิทยาศาสตร์และเทคโนโลยี");
        s1.setDepartment("สาขาวิทยาการคอมพิวเตอร์");
        s1.setYear(3);
        s1.setStatus("กำลังศึกษา");
        s1.setGpa(3.42);
        s1.setCareerPath("Software Developer");

        when(studentRepository.findAll(any(Sort.class))).thenReturn(List.of(s1));

        ResponseEntity<byte[]> response = studentAdminController.exportCsv(adminAuth);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        byte[] bytes = response.getBody();
        assertNotNull(bytes);
        assertTrue(bytes.length >= 3);

        // Check BOM bytes: 0xEF, 0xBB, 0xBF
        assertEquals((byte) 0xEF, bytes[0]);
        assertEquals((byte) 0xBB, bytes[1]);
        assertEquals((byte) 0xBF, bytes[2]);

        String content = new String(bytes, StandardCharsets.UTF_8);
        assertTrue(content.contains("studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId,gpa,careerPath"));
        assertTrue(content.contains("6621100042"));
        assertTrue(content.contains("สมชาย ใจดี"));
        assertTrue(content.contains("Software Developer"));
    }

    @Test
    @DisplayName("CSV Export: Non-admin caller receives 403 Forbidden")
    void testExportCsv_nonAdmin_throws403Forbidden() {
        StudentAdminException ex = assertThrows(StudentAdminException.class, () ->
                studentAdminController.exportCsv(studentAuth)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }
}
