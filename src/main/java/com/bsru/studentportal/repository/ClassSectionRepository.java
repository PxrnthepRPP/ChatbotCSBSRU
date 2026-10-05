package com.bsru.studentportal.repository;

import com.bsru.studentportal.model.ClassSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassSectionRepository extends JpaRepository<ClassSection, Long> {
    List<ClassSection> findByAcademicYearAndTermOrderByCourseCodeAscSectionNoAsc(Integer academicYear, Integer term);

    List<ClassSection> findByAcademicYearAndTermAndCourseCodeIgnoreCaseOrderBySectionNoAsc(
            Integer academicYear, Integer term, String courseCode);

    List<ClassSection> findAllByOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc();

    List<ClassSection> findByInstructorIdOrderByAcademicYearDescTermDescCourseCodeAscSectionNoAsc(String instructorId);
}
