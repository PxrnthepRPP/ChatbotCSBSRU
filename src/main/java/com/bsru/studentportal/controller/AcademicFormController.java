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
@RequestMapping("/api/forms")
@RequiredArgsConstructor
public class AcademicFormController {

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
        Resource resource = new ClassPathResource("forms/" + form.fileName());
        if (!resource.exists()) {
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
}

