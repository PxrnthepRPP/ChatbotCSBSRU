package com.bsru.studentportal.service;

import com.bsru.studentportal.model.FaqEntry;
import com.bsru.studentportal.repository.FaqEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FaqServiceTest {

    private final FaqEntryRepository repo = mock(FaqEntryRepository.class);
    private final FaqService service = new FaqService(repo);

    private static FaqEntry faq(long id, String q, String alt, boolean exact, boolean active) {
        return FaqEntry.builder().id(id).category("ลงทะเบียน").question(q).alternatives(alt)
                .answer("คำตอบ " + id).exactAnswer(exact).active(active).build();
    }

    @Test
    void sameQuestionWithPoliteWordsAndSpacesIsAnExactMatch() {
        when(repo.findByActiveTrue()).thenReturn(List.of(faq(1, "ลงทะเบียนเรียนได้ถึงวันไหน", null, true, true)));
        Optional<FaqService.Match> m = service.bestMatch("ลงทะเบียน เรียนได้ถึงวันไหนครับ");
        assertTrue(m.isPresent());
        assertTrue(m.get().answersExactly());
    }

    @Test
    void alternativePhrasingMatches() {
        when(repo.findByActiveTrue()).thenReturn(List.of(faq(1, "ลงทะเบียนเรียนได้ถึงวันไหน", "ปิดลงทะเบียนวันไหน\nลงวิชาได้ถึงเมื่อไหร่", true, true)));
        assertTrue(service.bestMatch("ปิดลงทะเบียนวันไหนคะ").map(FaqService.Match::answersExactly).orElse(false));
    }

    @Test
    void faqMarkedForAiIsNeverSentWordForWord() {
        when(repo.findByActiveTrue()).thenReturn(List.of(faq(1, "ลงทะเบียนเรียนได้ถึงวันไหน", null, false, true)));
        FaqService.Match m = service.bestMatch("ลงทะเบียนเรียนได้ถึงวันไหน").orElseThrow();
        assertFalse(m.answersExactly());
    }

    @Test
    void unrelatedQuestionDoesNotMatch() {
        when(repo.findByActiveTrue()).thenReturn(List.of(faq(1, "ลงทะเบียนเรียนได้ถึงวันไหน", null, true, true)));
        assertTrue(service.bestMatch("ขอใบลาป่วยหน่อย").isEmpty());
    }

    @Test
    void createNeedsQuestionAndAnswer() {
        assertThrows(ResponseStatusException.class, () -> service.create(FaqEntry.builder().question(" ").answer("x").build()));
        assertThrows(ResponseStatusException.class, () -> service.create(FaqEntry.builder().question("x").answer("").build()));
    }

    @Test
    void createDefaultsCategoryAndKeepsFlags() {
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        FaqEntry saved = service.create(FaqEntry.builder().question(" ถาม ").answer(" ตอบ ").exactAnswer(false).active(true).build());
        assertEquals("ทั่วไป", saved.getCategory());
        assertEquals("ถาม", saved.getQuestion());
        assertFalse(saved.isExactAnswer());
    }

    @Test
    void csvRoundTripHandlesQuotesCommasAndLineBreaks() {
        when(repo.findAllByOrderByCategoryAscIdAsc()).thenReturn(List.of(
                FaqEntry.builder().id(7L).category("ทั่วไป").question("ถาม, \"พิเศษ\"").alternatives("a\nb")
                        .answer("บรรทัด1\nบรรทัด2").exactAnswer(true).active(false).build()));
        String csv = service.exportCsv();
        List<List<String>> rows = FaqService.parseCsv(csv.substring(1));
        assertEquals(2, rows.size());
        assertEquals("ถาม, \"พิเศษ\"", rows.get(1).get(2));
        assertEquals("a | b", rows.get(1).get(3));
        assertEquals("บรรทัด1\nบรรทัด2", rows.get(1).get(4));
        assertEquals("ไม่", rows.get(1).get(6));
    }

    @Test
    void importAddsNewRowsAndReportsBadOnes() {
        when(repo.existsById(any())).thenReturn(false);
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        FaqService.ImportResult r = service.importCsv(
                "id,หมวด,คำถาม,คำถามแบบอื่น,คำตอบ,ตอบตามนี้เป๊ะ,เปิดใช้\n,ทุน,ขอทุนยังไง,,ยื่นที่กองพัฒฯ,ใช่,ใช่\n,ทุน,,,ไม่มีคำถาม,,\n");
        assertEquals(1, r.created());
        assertEquals(1, r.errors().size());
    }
}
