package com.bsru.studentportal.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The advisor of one cohort (students admitted in the same year, e.g. 2566 = student ids 66xxxxxxxx).
 * One cohort has one advisor; an advisor may look after several cohorts. Set by the admin only.
 */
@Entity
@Table(name = "cohort_advisors")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CohortAdvisor {

    /** Buddhist-era admission year, e.g. 2566 */
    @Id
    @Column(name = "admission_year", nullable = false)
    private Integer admissionYear;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "advisor_id", nullable = false)
    private Advisor advisor;
}
