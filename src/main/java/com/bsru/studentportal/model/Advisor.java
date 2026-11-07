package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "advisors")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Advisor {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(name = "name_th", nullable = false)
    private String nameTh;

    @Column(name = "name_en", nullable = false)
    private String nameEn;

    @Column(nullable = false)
    private String email;

    private String phone;

    private String department;

    @Column(name = "can_admin", nullable = false, columnDefinition = "boolean default false not null")
    private boolean canAdmin = false;

    public Advisor(String id, String nameTh, String nameEn, String email, String phone, String department) {
        this.id = id;
        this.nameTh = nameTh;
        this.nameEn = nameEn;
        this.email = email;
        this.phone = phone;
        this.department = department;
        this.canAdmin = false;
    }
}
