package com.bsru.studentportal.service;

import com.bsru.studentportal.model.GraduationAudit;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.GraduationAuditRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("GraduationAuditService Unit Tests")
class GraduationAuditServiceTest {

    @Mock
    private GraduationAuditRepository repository;

    @Mock
    private StudentRepository studentRepository;

    private ObjectMapper objectMapper;
    private GraduationAuditService auditService;

    private final String studentId = "6421100042";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        auditService = new GraduationAuditService(repository, studentRepository, objectMapper);
    }

    @Nested
    @DisplayName("Group Evaluation Rules")
    class GroupRulesTests {

        @Test
        @DisplayName("ONE_PER_GROUP rule: passes when required distinct groups are taken without violations")
        void testOnePerGroup_PassWhenRequiredDistinctGroupsTaken() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาศึกษาทั่วไป",
                      "subsections": [
                        {
                          "title": "กลุ่มวิชาภาษาและการสื่อสาร",
                          "rule": "ONE_PER_GROUP",
                          "groupsRequired": 3,
                          "minCr": 9,
                          "groups": [
                            {
                              "code": "G1",
                              "courses": [
                                { "code": "TH101", "name": "Thai 1", "ca": 3, "pt": 12.0 }
                              ]
                            },
                            {
                              "code": "G2",
                              "courses": [
                                { "code": "EN101", "name": "English 1", "ca": 3, "pt": 12.0 }
                              ]
                            },
                            {
                              "code": "G3",
                              "courses": [
                                { "code": "JP101", "name": "Japanese 1", "ca": 3, "pt": 12.0 }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            assertNotNull(result);
            assertEquals(1, result.units().size());

            GraduationAuditService.Unit unit = result.units().get(0);
            assertEquals("กลุ่มวิชาภาษาและการสื่อสาร", unit.title());
            assertEquals("PASS", unit.status());
            assertEquals(9, unit.minCr());
            assertEquals(9, unit.passCr());

            JsonNode groupNode = result.audit().path("sections").get(0).path("subsections").get(0);
            assertEquals("PASS", groupNode.path("status").asText());
            assertEquals(9, groupNode.path("passCr").asInt());
            assertEquals(3, groupNode.path("groupsPassed").asInt());
            assertFalse(groupNode.hasNonNull("violation"));
        }

        @Test
        @DisplayName("ONE_PER_GROUP rule: flags violation and sets status=FAIL when >1 course passed in same group")
        void testOnePerGroup_ViolationWhenMoreThanOneCoursePassedInSameGroup() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาศึกษาทั่วไป",
                      "subsections": [
                        {
                          "title": "กลุ่มวิชาภาษาและการสื่อสาร",
                          "rule": "ONE_PER_GROUP",
                          "groupsRequired": 3,
                          "minCr": 9,
                          "groups": [
                            {
                              "code": "G1",
                              "courses": [
                                { "code": "TH101", "name": "Thai 1", "ca": 3, "pt": 12.0 },
                                { "code": "TH102", "name": "Thai 2", "ca": 3, "pt": 12.0 }
                              ]
                            },
                            {
                              "code": "G2",
                              "courses": [
                                { "code": "EN101", "name": "English 1", "ca": 3, "pt": 12.0 }
                              ]
                            },
                            {
                              "code": "G3",
                              "courses": [
                                { "code": "JP101", "name": "Japanese 1", "ca": 0, "pt": 0.0 }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            assertNotNull(result);
            GraduationAuditService.Unit unit = result.units().get(0);
            assertEquals("FAIL", unit.status());

            JsonNode node = result.audit().path("sections").get(0).path("subsections").get(0);
            assertEquals("FAIL", node.path("status").asText());
            assertTrue(node.hasNonNull("violation"));
            assertTrue(node.path("violation").asText().contains("G1 เรียนเกินกลุ่มละ 1 วิชา"));
            assertTrue(unit.note().contains("G1 เรียนเกินกลุ่มละ 1 วิชา"));
        }

        @Test
        @DisplayName("CHOOSE_ONE rule: selects maximum earned credits among child plans and clears child statuses")
        void testChooseOne_SelectsMaximumCreditsAndClearsChildStatuses() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาเฉพาะ",
                      "subsections": [
                        {
                          "title": "แผนการฝึกประสบการณ์วิชาชีพหรือสหกิจศึกษา",
                          "rule": "CHOOSE_ONE",
                          "minCr": 6,
                          "groups": [
                            {
                              "title": "แผนฝึกงาน",
                              "courses": [
                                { "code": "CS498", "name": "Internship", "ca": 6, "pt": 24.0 }
                              ]
                            },
                            {
                              "title": "แผนสหกิจศึกษา",
                              "courses": [
                                { "code": "CS499", "name": "Co-op", "ca": 3, "pt": 12.0 }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            assertNotNull(result);
            GraduationAuditService.Unit unit = result.units().get(0);
            assertEquals("PASS", unit.status());
            assertEquals(6, unit.minCr());
            assertEquals(6, unit.passCr());

            JsonNode categoryNode = result.audit().path("sections").get(0).path("subsections").get(0);
            assertEquals("PASS", categoryNode.path("status").asText());
            assertEquals(6, categoryNode.path("passCr").asInt());

            // Children status must be null so competing unchosen track does not trigger failure
            JsonNode planA = categoryNode.path("groups").get(0);
            JsonNode planB = categoryNode.path("groups").get(1);
            assertTrue(planA.path("status").isNull());
            assertTrue(planB.path("status").isNull());
        }

        @Test
        @DisplayName("CHOOSE_ONE rule: fails when highest earned credits among child plans is below required minCr")
        void testChooseOne_FailsWhenBestCreditsBelowMinimum() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาเฉพาะ",
                      "subsections": [
                        {
                          "title": "แผนปฏิบัติการ",
                          "rule": "CHOOSE_ONE",
                          "minCr": 6,
                          "groups": [
                            {
                              "title": "แผน A",
                              "courses": [
                                { "code": "C1", "name": "Course 1", "ca": 3, "pt": 12.0 }
                              ]
                            },
                            {
                              "title": "แผน B",
                              "courses": [
                                { "code": "C2", "name": "Course 2", "ca": 2, "pt": 8.0 }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            GraduationAuditService.Unit unit = result.units().get(0);
            assertEquals("FAIL", unit.status());
            assertEquals(3, unit.passCr()); // max(3, 2) = 3 < 6
        }

        @Test
        @DisplayName("REQUIREMENT rule: passes when every course has passed: true, passCr is null")
        void testRequirement_PassWhenAllCoursesPassed() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดทักษะและการทดสอบมาตรฐาน",
                      "groups": [
                        {
                          "title": "เกณฑ์มาตรฐานภาษาอังกฤษและดิจิทัล",
                          "rule": "REQUIREMENT",
                          "courses": [
                            { "code": "CEFR", "name": "English CEFR B2", "passed": true },
                            { "code": "DL", "name": "Digital Literacy", "passed": true }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            GraduationAuditService.Unit unit = result.units().get(0);
            assertEquals("PASS", unit.status());
            assertEquals("ผ่านครบ", unit.note());

            JsonNode group = result.audit().path("sections").get(0).path("groups").get(0);
            assertEquals("PASS", group.path("status").asText());
            assertTrue(group.path("passCr").isNull());
        }

        @Test
        @DisplayName("REQUIREMENT rule: fails when any course has passed: false or missing")
        void testRequirement_FailWhenAnyCourseNotPassed() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดทักษะและการทดสอบมาตรฐาน",
                      "groups": [
                        {
                          "title": "เกณฑ์มาตรฐานภาษาอังกฤษและดิจิทัล",
                          "rule": "REQUIREMENT",
                          "courses": [
                            { "code": "CEFR", "name": "English CEFR B2", "passed": true },
                            { "code": "DL", "name": "Digital Literacy", "passed": false }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            GraduationAuditService.Unit unit = result.units().get(0);
            assertEquals("FAIL", unit.status());
            assertTrue(unit.note().contains("ยังไม่ผ่าน: DL Digital Literacy"));

            JsonNode group = result.audit().path("sections").get(0).path("groups").get(0);
            assertEquals("FAIL", group.path("status").asText());
            assertTrue(group.path("passCr").isNull());
        }

        @Test
        @DisplayName("evaluateSum rule: fails when any child node fails, passes only when all pass and credits sufficient")
        void testEvaluateSum_FailsWhenAnyChildFails() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาเฉพาะ",
                      "subsections": [
                        {
                          "title": "กลุ่มวิชาแกน",
                          "minCr": 6,
                          "groups": [
                            {
                              "title": "วิชาแกน 1",
                              "minCr": 3,
                              "courses": [
                                { "code": "CS101", "name": "Intro", "ca": 3, "pt": 12.0 }
                              ]
                            },
                            {
                              "title": "วิชาแกน 2",
                              "minCr": 3,
                              "courses": [
                                { "code": "CS102", "name": "OOP", "ca": 0, "pt": 0.0 }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            GraduationAuditService.Unit unit = result.units().get(0);
            assertEquals("FAIL", unit.status());
            assertEquals(3, unit.passCr()); // earned 3 out of 6
        }
    }

    @Nested
    @DisplayName("GPA Threshold and Overall Graduation Status")
    class GpaThresholdTests {

        @Test
        @DisplayName("GPA below 2.00 threshold: overall status is 'ยังไม่ผ่านเงื่อนไข' even when all course units pass")
        void testGpaBelowThresholdCausesGraduationFailure() {
            // Student took 2 courses:
            // C1: 3 credits @ 2.0 = 6.0 points
            // C2: 3 credits @ 1.5 = 4.5 points
            // Total credits: 6/6 earned (All units PASS)
            // GPA: 10.5 / 6 = 1.75 (< 2.00)
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาศึกษาทั่วไป",
                      "groups": [
                        {
                          "title": "กลุ่มวิชาทั่วไป",
                          "minCr": 6,
                          "courses": [
                            { "code": "G1", "name": "Thai", "ca": 3, "attempted": 3, "pt": 6.0 },
                            { "code": "G2", "name": "English", "ca": 3, "attempted": 3, "pt": 4.5 }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            JsonNode summary = result.audit().path("summary");
            assertEquals("ยังไม่ผ่านเงื่อนไข", summary.path("status").asText());
            assertEquals(1.75, summary.path("currentGpa").asDouble());
            assertEquals(2.0, summary.path("minGpa").asDouble());
            assertEquals(1, summary.path("passedCategories").asLong());
            assertEquals(1, summary.path("totalCategories").asLong());

            // pendingRequirements must contain explicit GPA shortfall notice
            JsonNode pending = summary.path("pendingRequirements");
            boolean foundGpaWarning = false;
            for (JsonNode req : pending) {
                if (req.asText().contains("GPA 1.75 ต่ำกว่าเกณฑ์ 2.00")) {
                    foundGpaWarning = true;
                    break;
                }
            }
            assertTrue(foundGpaWarning, "pendingRequirements must contain Thai GPA shortfall message");
        }

        @Test
        @DisplayName("GPA meets threshold (>= 2.00) and all units pass: status is 'ผ่านเงื่อนไข'")
        void testGpaMeetsThresholdAndUnitsPass() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาศึกษาทั่วไป",
                      "groups": [
                        {
                          "title": "กลุ่มวิชาทั่วไป",
                          "minCr": 6,
                          "courses": [
                            { "code": "G1", "name": "Thai", "ca": 3, "attempted": 3, "pt": 9.0 },
                            { "code": "G2", "name": "English", "ca": 3, "attempted": 3, "pt": 9.0 }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            JsonNode summary = result.audit().path("summary");
            assertEquals("ผ่านเงื่อนไข", summary.path("status").asText());
            assertEquals(3.00, summary.path("currentGpa").asDouble());
            assertEquals(0, summary.path("pendingRequirements").size());
        }

        @Test
        @DisplayName("Custom minGpa in root: honors specified threshold (e.g., minGpa: 2.50)")
        void testCustomMinGpaThreshold() {
            String json = """
                {
                  "minGpa": 2.50,
                  "sections": [
                    {
                      "title": "หมวดวิชาเฉพาะ",
                      "groups": [
                        {
                          "title": "กลุ่มวิชาเฉพาะ",
                          "minCr": 3,
                          "courses": [
                            { "code": "CS101", "name": "CS", "ca": 3, "attempted": 3, "pt": 6.9 }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            JsonNode summary = result.audit().path("summary");
            assertEquals("ยังไม่ผ่านเงื่อนไข", summary.path("status").asText());
            assertEquals(2.30, summary.path("currentGpa").asDouble());
            assertEquals(2.50, summary.path("minGpa").asDouble());

            JsonNode pending = summary.path("pendingRequirements");
            boolean found = false;
            for (JsonNode p : pending) {
                if (p.asText().contains("GPA 2.30 ต่ำกว่าเกณฑ์ 2.50")) {
                    found = true;
                    break;
                }
            }
            assertTrue(found);
        }

        @Test
        @DisplayName("Failing grade (attempted > 0, ca == 0) counts in gpaCredits divisor, lowering GPA")
        void testFailingGradeIncreasesGpaCreditsDivisor() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชา",
                      "groups": [
                        {
                          "title": "วิชาบังคับ",
                          "minCr": 3,
                          "courses": [
                            { "code": "CS101", "name": "Passed Course", "ca": 3, "attempted": 3, "pt": 12.0 },
                            { "code": "CS102", "name": "Failed Course F", "ca": 0, "attempted": 3, "pt": 0.0 }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            // Total credits earned = 3, gpaCredits = 3 + 3 = 6
            // GPA = 12.0 / 6 = 2.00
            JsonNode summary = result.audit().path("summary");
            assertEquals(2.00, summary.path("currentGpa").asDouble());
            assertEquals(3, summary.path("totalEarnedCredits").asInt());
        }
    }

    @Nested
    @DisplayName("Category Credit Capping (Preventing Elective Inflation)")
    class CreditCappingTests {

        @Test
        @DisplayName("Category credit capping: earned credits capped at min required, preventing elective inflation")
        void testCategoryCreditCappingPreventsElectiveInflation() {
            // Category 1: Electives: minCr = 6, student earned 12 credits (excess of 6)
            // Category 2: Core: minCr = 12, student earned 6 credits (deficit of 6)
            // Without capping: total earned = 12 + 6 = 18 / 18 -> false impression of graduation
            // With capping: total earned = min(12, 6) + min(6, 12) = 6 + 6 = 12 / 18
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาเลือกเสรี",
                      "groups": [
                        {
                          "title": "วิชาเลือกเสรี",
                          "minCr": 6,
                          "courses": [
                            { "code": "E1", "name": "Elec 1", "ca": 6, "attempted": 6, "pt": 24.0 },
                            { "code": "E2", "name": "Elec 2", "ca": 6, "attempted": 6, "pt": 24.0 }
                          ]
                        }
                      ]
                    },
                    {
                      "title": "หมวดวิชาเฉพาะบังคับ",
                      "groups": [
                        {
                          "title": "วิชาเฉพาะบังคับ",
                          "minCr": 12,
                          "courses": [
                            { "code": "C1", "name": "Core 1", "ca": 6, "attempted": 6, "pt": 24.0 }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            JsonNode summary = result.audit().path("summary");
            assertEquals(18, summary.path("totalRequiredCredits").asInt());
            // Capped: min(12, 6) + min(6, 12) = 6 + 6 = 12
            assertEquals(12, summary.path("totalEarnedCredits").asInt(),
                    "totalEarnedCredits must cap excess credits per category at minCr");
            assertEquals("ยังไม่ผ่านเงื่อนไข", summary.path("status").asText());
        }
    }

    @Nested
    @DisplayName("Pending Requirements Extraction")
    class PendingRequirementsTests {

        @Test
        @DisplayName("Pending requirements: unreleased term markers ('-- 1/69') are extracted with course info")
        void testPendingRequirementExtractionFromDashedTerms() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาเฉพาะ",
                      "groups": [
                        {
                          "title": "วิชาบังคับ",
                          "minCr": 6,
                          "courses": [
                            {
                              "code": "CS301",
                              "name": "Software Engineering",
                              "ca": 3,
                              "attempted": 3,
                              "pt": 12.0,
                              "terms": { "t1": "A 1/66" }
                            },
                            {
                              "code": "CS401",
                              "name": "Big Data Architecture",
                              "ca": 3,
                              "attempted": 3,
                              "pt": 0.0,
                              "terms": { "t2": "-- 1/69" }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            JsonNode pending = result.audit().path("summary").path("pendingRequirements");
            boolean foundCourseNotice = false;
            for (JsonNode p : pending) {
                if (p.asText().contains("รอผลรายวิชา CS401 Big Data Architecture (1/69)")) {
                    foundCourseNotice = true;
                    break;
                }
            }
            assertTrue(foundCourseNotice, "Pending course term marker '-- 1/69' must be extracted into pendingRequirements");
        }

        @Test
        @DisplayName("Pending requirements: deficient categories are extracted with title and shortfall note")
        void testPendingRequirementExtractionForDeficientCategories() {
            String json = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชาศึกษาทั่วไป",
                      "subsections": [
                        {
                          "title": "กลุ่มมนุษยศาสตร์",
                          "minCr": 6,
                          "groups": [
                            {
                              "courses": [
                                { "code": "HU101", "name": "Philosophy", "ca": 3, "attempted": 3, "pt": 9.0 }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            GraduationAuditService.AuditResult result = auditService.compute(json);

            JsonNode pending = result.audit().path("summary").path("pendingRequirements");
            boolean found = false;
            for (JsonNode p : pending) {
                if (p.asText().contains("กลุ่มมนุษยศาสตร์") && p.asText().contains("ขาดอีก 3")) {
                    found = true;
                    break;
                }
            }
            assertTrue(found, "Deficient category note must be listed in pendingRequirements");
        }
    }

    @Nested
    @DisplayName("Sheet Storage, Validation and GPA Synchronization")
    class SheetStorageTests {

        @Test
        @DisplayName("save: strips computed fields, saves clean JSON, and synchronizes student profile GPA")
        void testSaveStripsComputedAndSyncsGpa() {
            // Input JSON with pre-existing computed fields
            String dirtyJson = """
                {
                  "summary": { "status": "DUMMY", "currentGpa": 9.99 },
                  "sections": [
                    {
                      "title": "หมวดวิชาศึกษาทั่วไป",
                      "status": "PASS",
                      "passCr": 30,
                      "gpa": "4.00",
                      "groups": [
                        {
                          "title": "วิชาทั่วไป",
                          "minCr": 3,
                          "courses": [
                            { "code": "GE101", "name": "Thai", "ca": 3, "attempted": 3, "pt": 12.0 }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

            Student mockStudent = new Student();
            mockStudent.setStudentId(studentId);
            mockStudent.setGpa(2.50);
            when(studentRepository.findById(studentId)).thenReturn(Optional.of(mockStudent));

            GraduationAuditService.AuditResult savedResult = auditService.save(studentId, dirtyJson);

            assertNotNull(savedResult);
            // Verify repository.save was called with clean JSON lacking original summary
            ArgumentCaptor<GraduationAudit> auditCaptor = ArgumentCaptor.forClass(GraduationAudit.class);
            verify(repository).save(auditCaptor.capture());

            GraduationAudit captured = auditCaptor.getValue();
            assertEquals(studentId, captured.getStudentId());
            assertFalse(captured.getData().contains("\"DUMMY\""), "Saved data must strip computed fields");

            // Verify student GPA synchronized to computed GPA (4.00)
            verify(studentRepository).save(mockStudent);
            assertEquals(4.00, mockStudent.getGpa(), 0.001);
        }

        @Test
        @DisplayName("save: throws IllegalArgumentException when JSON is malformed")
        void testSaveThrowsOnMalformedJson() {
            String malformed = "{ invalid json: 123 ";

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> auditService.save(studentId, malformed));

            assertTrue(ex.getMessage().contains("ไฟล์ไม่ใช่ JSON ที่ถูกต้อง"));
            verify(repository, never()).save(any());
        }

        @Test
        @DisplayName("save: throws IllegalArgumentException when sections array is missing or empty")
        void testSaveThrowsOnMissingSections() {
            String noSections = "{ \"minGpa\": 2.0 }";

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                    () -> auditService.save(studentId, noSections));

            assertTrue(ex.getMessage().contains("ไม่พบ \"sections\" (โครงหมวดวิชา) ในไฟล์"));
            verify(repository, never()).save(any());
        }

        @Test
        @DisplayName("auditOf and rawOf: retrieve stored sheet and computed audit")
        void testAuditOfAndRawOf() {
            String sheet = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชา",
                      "groups": [
                        {
                          "courses": [
                            { "code": "C1", "name": "Course", "ca": 3, "attempted": 3, "pt": 12.0 }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;
            GraduationAudit audit = new GraduationAudit(studentId, sheet);
            when(repository.findById(studentId)).thenReturn(Optional.of(audit));

            Optional<String> raw = auditService.rawOf(studentId);
            assertTrue(raw.isPresent());
            assertEquals(sheet, raw.get());

            Optional<GraduationAuditService.AuditResult> result = auditService.auditOf(studentId);
            assertTrue(result.isPresent());
            assertEquals(1, result.get().units().size());
        }

        @Test
        @DisplayName("syncAllProfileGpas: synchronizes GPA across all stored audit sheets")
        void testSyncAllProfileGpas() {
            String sheet = """
                {
                  "sections": [
                    {
                      "title": "หมวดวิชา",
                      "groups": [
                        {
                          "courses": [
                            { "code": "C1", "name": "Course", "ca": 3, "attempted": 3, "pt": 9.0 }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;
            GraduationAudit audit = new GraduationAudit(studentId, sheet);
            when(repository.findAll()).thenReturn(List.of(audit));

            Student student = new Student();
            student.setStudentId(studentId);
            student.setGpa(0.0);
            when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

            auditService.syncAllProfileGpas();

            verify(studentRepository).save(student);
            assertEquals(3.00, student.getGpa(), 0.001);
        }
    }
}
