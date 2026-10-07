package com.bsru.studentportal.service;

import com.bsru.studentportal.model.Advisor;
import com.bsru.studentportal.model.CohortAdvisor;
import com.bsru.studentportal.model.Student;
import com.bsru.studentportal.repository.AdvisorRepository;
import com.bsru.studentportal.repository.CohortAdvisorRepository;
import com.bsru.studentportal.repository.StudentRepository;
import com.bsru.studentportal.service.StudentAdminService.StudentAdminException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Advisors are set per cohort (admission year): one cohort has one advisor, an advisor may have several
 * cohorts. Every real student of the cohort gets that advisor. Simulated (sample) students keep the
 * advisor who created them and are not part of this rule.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CohortAdvisorService {

    public record CohortView(int admissionYear, String advisorId, String advisorName,
                             long realStudents, long simulatedStudents) {}

    private final CohortAdvisorRepository cohortRepository;
    private final AdvisorRepository advisorRepository;
    private final StudentRepository studentRepository;

    /** Buddhist-era admission year of a student; from the first two digits of the id when not stored */
    public static int cohortOf(Student s) {
        if (s.getAdmissionYear() != null) return s.getAdmissionYear();
        return 2500 + Integer.parseInt(s.getStudentId().substring(0, 2));
    }

    @Transactional(readOnly = true)
    public Optional<Advisor> advisorOfCohort(int admissionYear) {
        return cohortRepository.findById(admissionYear).map(CohortAdvisor::getAdvisor);
    }

    /** Every cohort that has real students or an advisor, newest first */
    @Transactional(readOnly = true)
    public List<CohortView> list() {
        List<Student> students = studentRepository.findAll();
        Map<Integer, CohortAdvisor> assigned = cohortRepository.findAll().stream()
                .collect(Collectors.toMap(CohortAdvisor::getAdmissionYear, Function.identity()));
        TreeSet<Integer> years = new TreeSet<>(Comparator.reverseOrder());
        years.addAll(assigned.keySet());
        students.stream().filter(s -> !s.isSimulated()).forEach(s -> years.add(cohortOf(s)));
        return years.stream().map(year -> {
            Advisor a = Optional.ofNullable(assigned.get(year)).map(CohortAdvisor::getAdvisor).orElse(null);
            long real = students.stream().filter(s -> !s.isSimulated() && cohortOf(s) == year).count();
            long simulated = students.stream().filter(s -> s.isSimulated() && cohortOf(s) == year).count();
            return new CohortView(year, a == null ? null : a.getId(), a == null ? null : a.getNameTh(), real, simulated);
        }).toList();
    }

    /** Sets (or clears, with a blank id) the advisor of a cohort and applies it to its real students */
    @Transactional
    public CohortView assign(int admissionYear, String advisorId) {
        if (admissionYear < 2500 || admissionYear > 2700) {
            throw new StudentAdminException(HttpStatus.BAD_REQUEST, "ปีที่เข้าศึกษาต้องเป็นปี พ.ศ. เช่น 2566");
        }
        Advisor advisor = null;
        if (advisorId == null || advisorId.isBlank()) {
            cohortRepository.deleteById(admissionYear);
        } else {
            advisor = advisorRepository.findById(advisorId.trim())
                    .orElseThrow(() -> new StudentAdminException(HttpStatus.BAD_REQUEST, "ไม่พบอาจารย์รหัส " + advisorId));
            cohortRepository.save(new CohortAdvisor(admissionYear, advisor));
        }
        final Advisor target = advisor;
        List<Student> changed = studentRepository.findAll().stream()
                .filter(s -> !s.isSimulated() && cohortOf(s) == admissionYear && !sameAdvisor(s.getAdvisor(), target))
                .peek(s -> s.setAdvisor(target))
                .toList();
        studentRepository.saveAll(changed);
        return list().stream().filter(c -> c.admissionYear() == admissionYear).findFirst()
                .orElse(new CohortView(admissionYear, null, null, 0, 0));
    }

    /**
     * Keeps every real student's advisor equal to their cohort's advisor. Runs after the data seeder, so
     * advisors set one by one in the past are cleared until the admin assigns the cohort.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void syncAll() {
        Map<Integer, Advisor> byYear = cohortRepository.findAll().stream()
                .collect(Collectors.toMap(CohortAdvisor::getAdmissionYear, CohortAdvisor::getAdvisor));
        List<Student> changed = studentRepository.findAll().stream()
                .filter(s -> !s.isSimulated())
                .filter(s -> !sameAdvisor(s.getAdvisor(), byYear.get(cohortOf(s))))
                .peek(s -> s.setAdvisor(byYear.get(cohortOf(s))))
                .toList();
        if (!changed.isEmpty()) {
            studentRepository.saveAll(changed);
            log.info("Cohort advisors: updated the advisor of {} real students", changed.size());
        }
    }

    private static boolean sameAdvisor(Advisor a, Advisor b) {
        return a == null ? b == null : b != null && a.getId().equals(b.getId());
    }
}
