package com.bsru.studentportal.service;

import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.StudentAdminService.StudentAdminException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Service for parsing, validating, importing, and exporting student records via CSV.
 */
@Service
@RequiredArgsConstructor
public class StudentCsvService {

    private final StudentRepository studentRepository;
    private final AdvisorRepository advisorRepository;
    private final AccountService accountService;

    public Map<String, Object> processCsvImport(
            String rawBody,
            MultipartFile file,
            HttpServletRequest request,
            String assignedAdvisorId) throws Exception {

        String csvText = null;
        if (file != null && !file.isEmpty()) {
            csvText = new String(file.getBytes(), StandardCharsets.UTF_8);
        } else if (rawBody != null && !rawBody.isBlank()) {
            String trimmed = rawBody.trim();
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                try {
                    JsonNode root = new ObjectMapper().readTree(trimmed);
                    if (root.has("csvData")) {
                        csvText = root.get("csvData").asText();
                    } else if (root.has("csv")) {
                        csvText = root.get("csv").asText();
                    } else {
                        csvText = rawBody;
                    }
                } catch (Exception e) {
                    csvText = rawBody;
                }
            } else {
                csvText = rawBody;
            }
        } else if (request != null) {
            try (var inputStream = request.getInputStream()) {
                if (inputStream != null) {
                    byte[] streamBytes = inputStream.readAllBytes();
                    if (streamBytes.length > 0) {
                        csvText = new String(streamBytes, StandardCharsets.UTF_8);
                    }
                }
            }
        }

        if (csvText == null || csvText.trim().isEmpty()) {
            throw new StudentAdminException(HttpStatus.BAD_REQUEST, "ไฟล์ CSV ว่างเปล่า");
        }

        if (csvText.startsWith("\uFEFF")) {
            csvText = csvText.substring(1);
        }

        List<String> rawLines = Arrays.stream(csvText.split("\\r?\\n"))
                .map(String::trim)
                .filter(l -> !l.isEmpty())
                .toList();

        if (rawLines.isEmpty()) {
            throw new StudentAdminException(HttpStatus.BAD_REQUEST, "ไฟล์ CSV ไม่มีข้อมูล");
        }

        // Header inspection
        List<String> headers = parseCsvLine(rawLines.get(0));
        int studentIdCol = -1;
        int nameThCol = -1;
        int nameEnCol = -1;
        int emailCol = -1;
        int phoneCol = -1;
        int facultyCol = -1;
        int majorCol = -1;
        int yearCol = -1;
        int statusCol = -1;
        int advisorIdCol = -1;
        int gpaCol = -1;
        int careerPathCol = -1;
        int birthDateCol = -1;
        int nationalIdCol = -1;

        boolean headerPresent = false;
        for (int i = 0; i < headers.size(); i++) {
            String h = headers.get(i).trim().toLowerCase().replace("_", "").replace("-", "");
            if (h.equals("studentid") || h.equals("id") || h.equals("รหัสนักศึกษา")) {
                studentIdCol = i;
                headerPresent = true;
            } else if (h.equals("nameth") || h.equals("name") || h.contains("ชื่อไทย") || h.contains("ชื่อสกุล")) {
                nameThCol = i;
            } else if (h.equals("nameen") || h.contains("อังกฤษ")) {
                nameEnCol = i;
            } else if (h.equals("email") || h.equals("อีเมล")) {
                emailCol = i;
            } else if (h.equals("phone") || h.equals("tel") || h.equals("เบอร์โทร") || h.equals("เบอร์โทรศัพท์")) {
                phoneCol = i;
            } else if (h.equals("faculty") || h.equals("คณะ")) {
                facultyCol = i;
            } else if (h.equals("major") || h.equals("department") || h.equals("สาขา") || h.equals("สาขาวิชา")) {
                majorCol = i;
            } else if (h.equals("year") || h.equals("ชั้นปี")) {
                yearCol = i;
            } else if (h.equals("status") || h.equals("สถานะ")) {
                statusCol = i;
            } else if (h.equals("advisorid") || h.equals("advisor") || h.contains("อาจารย์ที่ปรึกษา")) {
                advisorIdCol = i;
            } else if (h.equals("gpa") || h.equals("เกรดเฉลี่ย")) {
                gpaCol = i;
            } else if (h.equals("careerpath") || h.equals("career") || h.equals("สายอาชีพ")) {
                careerPathCol = i;
            } else if (h.equals("nationalid") || h.equals("citizenid") || h.equals("idcard") || h.contains("บัตรประชาชน")
                    || h.contains("ประจำตัวประชาชน")) {
                nationalIdCol = i;
            } else if (h.equals("birthdate") || h.equals("birth_date") || h.equals("dob") || h.contains("วันเกิด") || h.contains("วันเดือนปีเกิด")) {
                birthDateCol = i;
            }
        }

        int startRow = 1;
        if (!headerPresent) {
            if (!headers.isEmpty() && headers.get(0).matches("\\d{10}")) {
                studentIdCol = 0;
                nameThCol = 1;
                nameEnCol = headers.size() > 2 ? 2 : -1;
                emailCol = headers.size() > 3 ? 3 : -1;
                phoneCol = headers.size() > 4 ? 4 : -1;
                facultyCol = headers.size() > 5 ? 5 : -1;
                majorCol = headers.size() > 6 ? 6 : -1;
                yearCol = headers.size() > 7 ? 7 : -1;
                statusCol = headers.size() > 8 ? 8 : -1;
                advisorIdCol = headers.size() > 9 ? 9 : -1;
                nationalIdCol = headers.size() > 10 ? 10 : -1;
                startRow = 0;
            } else {
                throw new StudentAdminException(HttpStatus.BAD_REQUEST, "โครงสร้างไฟล์ CSV ไม่ถูกต้อง หรือไม่มีคอลัมน์ studentId");
            }
        }

        int importedCount = 0;
        int skippedCount = 0;
        List<String> errors = new ArrayList<>();
        Set<String> batchProcessedIds = new HashSet<>();
        Set<String> batchNationalIds = new HashSet<>();

        for (int rowIdx = startRow; rowIdx < rawLines.size(); rowIdx++) {
            List<String> cols = parseCsvLine(rawLines.get(rowIdx));
            if (cols.isEmpty() || cols.stream().allMatch(String::isBlank)) continue;

            String sid = (studentIdCol >= 0 && studentIdCol < cols.size()) ? cols.get(studentIdCol).trim() : "";
            if (!sid.matches("\\d{10}")) {
                errors.add("แถวที่ " + (rowIdx + 1) + ": รหัสนักศึกษาไม่ถูกต้อง ('" + sid + "')");
                continue;
            }

            if (batchProcessedIds.contains(sid) || studentRepository.existsById(sid)) {
                skippedCount++;
                batchProcessedIds.add(sid);
                continue;
            }

            // National ID: required, valid check digit, not used by another student (first password = initials + this)
            String nationalId = NationalId.normalize((nationalIdCol >= 0 && nationalIdCol < cols.size()) ? cols.get(nationalIdCol).trim() : "");
            String nidProblem = NationalId.problem(nationalId);
            if (nidProblem == null && (batchNationalIds.contains(nationalId)
                    || studentRepository.existsByNationalIdAndStudentIdNot(nationalId, sid))) {
                nidProblem = "เลขบัตรประชาชนซ้ำกับนักศึกษาคนอื่น";
            }
            if (nidProblem != null) {
                errors.add("แถวที่ " + (rowIdx + 1) + " (" + sid + "): " + nidProblem);
                continue;
            }
            batchNationalIds.add(nationalId);

            batchProcessedIds.add(sid);
            Student s = new Student();
            s.setStudentId(sid);
            s.setNationalId(nationalId);

            String nameTh = (nameThCol >= 0 && nameThCol < cols.size()) ? cols.get(nameThCol).trim() : "";
            s.setNameTh(nameTh.isEmpty() ? "นักศึกษาใหม่" : nameTh);

            String nameEn = (nameEnCol >= 0 && nameEnCol < cols.size()) ? cols.get(nameEnCol).trim() : null;
            s.setNameEn(nameEn != null && !nameEn.isEmpty() ? nameEn : null);

            String email = (emailCol >= 0 && emailCol < cols.size()) ? cols.get(emailCol).trim() : "";
            s.setEmail(email.isEmpty() ? sid + "@bsru.ac.th" : email);

            String phone = (phoneCol >= 0 && phoneCol < cols.size()) ? cols.get(phoneCol).trim() : null;
            s.setPhone(phone != null && !phone.isEmpty() ? phone : null);

            String faculty = (facultyCol >= 0 && facultyCol < cols.size()) ? cols.get(facultyCol).trim() : "";
            s.setFaculty(faculty.isEmpty() ? "คณะวิทยาศาสตร์และเทคโนโลยี" : faculty);

            String major = (majorCol >= 0 && majorCol < cols.size()) ? cols.get(majorCol).trim() : "";
            s.setDepartment(major.isEmpty() ? "สาขาวิทยาการคอมพิวเตอร์" : major);

            s.setStudentSection("D1");

            int year = 1;
            if (yearCol >= 0 && yearCol < cols.size()) {
                try {
                    year = Integer.parseInt(cols.get(yearCol).trim());
                    if (year < 1 || year > 8) year = 1;
                } catch (Exception ignored) {}
            }
            s.setYear(year);

            String rawStatus = (statusCol >= 0 && statusCol < cols.size()) ? cols.get(statusCol).trim() : "กำลังศึกษา";
            String normStatus = "กำลังศึกษา";
            if (rawStatus.equalsIgnoreCase("GRADUATED") || rawStatus.equals("จบการศึกษา")) {
                normStatus = "จบการศึกษา";
            } else if (rawStatus.equalsIgnoreCase("ON_LEAVE") || rawStatus.equals("พักการศึกษา")) {
                normStatus = "พักการศึกษา";
            } else if (rawStatus.equalsIgnoreCase("DISMISSED") || rawStatus.equals("พ้นสภาพ")) {
                normStatus = "พ้นสภาพ";
            }
            s.setStatus(normStatus);

            try {
                s.setAdmissionYear(2500 + Integer.parseInt(sid.substring(0, 2)));
            } catch (Exception e) {
                s.setAdmissionYear(2566);
            }

            if (birthDateCol >= 0 && birthDateCol < cols.size()) {
                String rawDob = cols.get(birthDateCol).trim();
                LocalDate parsedDob = parseFlexibleDate(rawDob);
                if (parsedDob != null) {
                    s.setBirthDate(parsedDob);
                }
            }

            if (assignedAdvisorId != null && !assignedAdvisorId.isBlank()) {
                advisorRepository.findById(assignedAdvisorId).ifPresent(s::setAdvisor);
            } else if (advisorIdCol >= 0 && advisorIdCol < cols.size()) {
                String advId = cols.get(advisorIdCol).trim();
                if (!advId.isEmpty()) {
                    advisorRepository.findById(advId).ifPresent(s::setAdvisor);
                }
            }

            if (gpaCol >= 0 && gpaCol < cols.size()) {
                try {
                    s.setGpa(Double.parseDouble(cols.get(gpaCol).trim()));
                } catch (Exception ignored) {
                    s.setGpa(0.00);
                }
            } else {
                s.setGpa(0.00);
            }

            if (careerPathCol >= 0 && careerPathCol < cols.size()) {
                String cp = cols.get(careerPathCol).trim();
                s.setCareerPath(cp.isEmpty() ? null : cp);
            }

            studentRepository.save(s);
            if (accountService != null) {
                try {
                    accountService.createStudentAccount(sid);
                } catch (Exception ignored) {}
            }
            importedCount++;
        }

        if (importedCount == 0 && skippedCount == 0) {
            throw new StudentAdminException(HttpStatus.BAD_REQUEST, "ไม่มีข้อมูลนักศึกษาที่ถูกต้องในไฟล์ CSV"
                    + (errors.isEmpty() ? "" : ": " + String.join(" · ", errors.subList(0, Math.min(3, errors.size())))
                    + (errors.size() > 3 ? " (และอีก " + (errors.size() - 3) + " แถว)" : "")));
        }

        int totalRows = importedCount + skippedCount;
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("message", "นำเข้าข้อมูลนักศึกษาสำเร็จ " + importedCount + " รายการ" + (skippedCount > 0 ? " (ข้าม " + skippedCount + " รายการที่ซ้ำ)" : "")
                + (importedCount > 0 ? " · ชื่อผู้ใช้ = รหัสนักศึกษา, รหัสผ่านเริ่มต้น = อักษรแรกของชื่อและนามสกุล (อังกฤษ พิมพ์ใหญ่) + เลขบัตรประชาชน 13 หลัก เช่น SJ1101700203450" : ""));
        resp.put("total", totalRows);
        resp.put("totalRows", totalRows);
        resp.put("importedCount", importedCount);
        resp.put("skippedCount", skippedCount);
        resp.put("errors", errors);

        return resp;
    }

    public byte[] exportCsv() throws Exception {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            // Prepend UTF-8 BOM bytes (0xEF, 0xBB, 0xBF)
            baos.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

            try (OutputStreamWriter writer = new OutputStreamWriter(baos, StandardCharsets.UTF_8)) {
                writer.write("studentId,nameTh,nameEn,email,phone,faculty,major,year,status,advisorId,gpa,careerPath\n");

                List<Student> students = studentRepository.findAll(Sort.by(Sort.Direction.ASC, "studentId"));
                for (Student s : students) {
                    String advisorId = s.getAdvisor() != null ? s.getAdvisor().getId() : "";
                    String gpaStr = s.getGpa() != null ? String.format("%.2f", s.getGpa()) : "0.00";
                    int year = s.getYear() != null ? s.getYear() : 1;

                    writer.write(String.format("%s,%s,%s,%s,%s,%s,%s,%d,%s,%s,%s,%s\n",
                            escapeCsv(s.getStudentId()),
                            escapeCsv(s.getNameTh()),
                            escapeCsv(s.getNameEn()),
                            escapeCsv(s.getEmail()),
                            escapeCsv(s.getPhone()),
                            escapeCsv(s.getFaculty()),
                            escapeCsv(s.getDepartment()),
                            year,
                            escapeCsv(s.getStatus()),
                            escapeCsv(advisorId),
                            gpaStr,
                            escapeCsv(s.getCareerPath())
                    ));
                }
                writer.flush();
            }
            return baos.toByteArray();
        }
    }

    public static List<String> parseCsvLine(String line) {
        List<String> tokens = new ArrayList<>();
        if (line == null) return tokens;
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                tokens.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        tokens.add(sb.toString().trim());
        return tokens;
    }

    public static String escapeCsv(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    public static LocalDate parseFlexibleDate(String text) {
        if (text == null || text.isBlank()) return null;
        String s = text.trim();
        try {
            // yyyy-MM-dd or yyyy/MM/dd
            if (s.matches("^\\d{4}[/-]\\d{1,2}[/-]\\d{1,2}$")) {
                String[] parts = s.split("[/-]");
                int y = Integer.parseInt(parts[0]);
                int m = Integer.parseInt(parts[1]);
                int d = Integer.parseInt(parts[2]);
                if (y > 2400) y -= 543;
                return LocalDate.of(y, m, d);
            }
            // dd/MM/yyyy or dd-MM-yyyy
            if (s.matches("^\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}$")) {
                String[] parts = s.split("[/-]");
                int d = Integer.parseInt(parts[0]);
                int m = Integer.parseInt(parts[1]);
                int y = Integer.parseInt(parts[2]);
                if (y > 2400) y -= 543;
                return LocalDate.of(y, m, d);
            }
        } catch (Exception ignored) {}
        return null;
    }
}

