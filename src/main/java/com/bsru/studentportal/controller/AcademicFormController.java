package com.bsru.studentportal.controller;

import com.bsru.studentportal.dto.FormAttachmentDto;
import com.bsru.studentportal.service.AcademicFormCatalogService;
import com.bsru.studentportal.service.AcademicFormCatalogService.AcademicFormInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping({"/api/forms", "/api/uploads/forms"})
@RequiredArgsConstructor
public class AcademicFormController {

    /**
     * แบบฟอร์ม PDF ทางการทั้ง 16 ฉบับอยู่ใน classpath (src/main/resources/forms) ซึ่งเป็นแหล่งข้อมูลเดียว
     * ทั้ง /api/forms/** และ /api/uploads/forms/** (ลิงก์เก่า) ให้บริการจากที่นี่
     */
    private static final String CLASSPATH_FORMS_DIR = "forms/";

    private final AcademicFormCatalogService formCatalogService;

    @GetMapping
    public ResponseEntity<List<FormAttachmentDto>> listForms() {
        List<FormAttachmentDto> forms = formCatalogService.getAllForms().stream()
                .map(AcademicFormInfo::toAttachmentDto)
                .toList();
        return ResponseEntity.ok(forms);
    }

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<?> getFormPdf(
            @PathVariable String fileName,
            @RequestParam(defaultValue = "false") boolean download
    ) {
        Optional<AcademicFormInfo> formOpt = formCatalogService.findByFileName(fileName);
        if (formOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ไม่พบเอกสารแบบฟอร์มที่ระบุ: " + fileName));
        }

        AcademicFormInfo form = formOpt.get();
        Resource resource = resolveFormResource(form.fileName());
        if (resource == null || !resource.exists()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "ไม่พบไฟล์เอกสารในระบบ: " + form.fileName()));
        }

        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(Objects.requireNonNull(form.downloadName()), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(Objects.requireNonNull(MediaType.APPLICATION_PDF))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(resource);
    }

    private Resource resolveFormResource(String safeFileName) {
        // safeFileName มาจาก whitelist ของ AcademicFormCatalogService จึงไม่สามารถออกนอกโฟลเดอร์ forms/ ได้
        return new ClassPathResource(CLASSPATH_FORMS_DIR + safeFileName);
    }
}
