package com.bsru.studentportal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** What a student may change on their own profile page. birthDate is ISO yyyy-MM-dd. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StudentProfileRequest {
    private String nameTh;
    private String nameEn;
    private String email;
    private String phone;
    private String birthDate;
    private String religion;
    private String address;
}
