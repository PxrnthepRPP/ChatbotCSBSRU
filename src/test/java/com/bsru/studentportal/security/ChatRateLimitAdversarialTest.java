package com.bsru.studentportal.security;

import com.bsru.studentportal.config.SecurityConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class ChatRateLimitAdversarialTest {

    private ChatRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ChatRateLimitFilter();
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Adversarial: Malformed X-Forwarded-For header with only commas falls back safely without crashing")
    void testMalformedXForwardedForWithCommas() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
        req.addHeader("X-Forwarded-For", ",,,");
        req.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        assertDoesNotThrow(() -> filter.doFilter(req, res, chain));
        assertEquals(200, res.getStatus(),
                "Malformed X-Forwarded-For with only commas should safely fall back to remoteAddr and return HTTP 200");
    }

    @Test
    @DisplayName("Adversarial: Malformed single-comma X-Forwarded-For falls back safely without crashing")
    void testMalformedSingleCommaXff() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
        req.addHeader("X-Forwarded-For", ",");
        req.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        assertDoesNotThrow(() -> filter.doFilter(req, res, chain));
        assertEquals(200, res.getStatus(),
                "Malformed single-comma X-Forwarded-For should safely fall back to remoteAddr and return HTTP 200");
    }

    @Test
    @DisplayName("Adversarial: Leading comma in X-Forwarded-For correctly extracts non-empty IP without collision")
    void testMalformedLeadingCommaXffProducesEmptyIpBucket() throws Exception {
        // Exhaust the 15 quota under ", 10.0.0.1" (parsed as ip:10.0.0.1)
        for (int i = 0; i < 15; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
            req.addHeader("X-Forwarded-For", ", 10.0.0.1");
            filter.doFilter(req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 16th request for client 1 (10.0.0.1) is blocked with HTTP 429
        MockHttpServletRequest req1Blocked = new MockHttpServletRequest("POST", "/api/chat");
        req1Blocked.addHeader("X-Forwarded-For", ", 10.0.0.1");
        MockHttpServletResponse res1Blocked = new MockHttpServletResponse();
        filter.doFilter(req1Blocked, res1Blocked, new MockFilterChain());
        assertEquals(429, res1Blocked.getStatus(), "Client 1 should be rate-limited on 16th request");

        // Client 2 with leading comma ", 192.168.1.1" maps to ip:192.168.1.1 and must NOT suffer collision/starvation
        MockHttpServletRequest req2 = new MockHttpServletRequest("POST", "/api/chat");
        req2.addHeader("X-Forwarded-For", ", 192.168.1.1");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        filter.doFilter(req2, res2, new MockFilterChain());

        assertEquals(200, res2.getStatus(),
                "Client 2 with leading comma parses valid IP '192.168.1.1' and must not share empty bucket with client 1");

        // Verify that client keys are properly mapped to ip:10.0.0.1 and ip:192.168.1.1 without an empty 'ip:' bucket
        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);
        assertTrue(log.containsKey("ip:10.0.0.1"), "Expected bucket for ip:10.0.0.1");
        assertTrue(log.containsKey("ip:192.168.1.1"), "Expected bucket for ip:192.168.1.1");
        assertFalse(log.containsKey("ip:"), "Should not contain empty 'ip:' bucket");
    }

    @Test
    @DisplayName("Adversarial: Anonymous client can bypass rate limit via X-Forwarded-For IP spoofing")
    void testAnonymousIpSpoofingBypass() throws Exception {
        // An anonymous attacker sends 30 rapid requests, each spoofing a distinct X-Forwarded-For header
        int totalRequests = 30;
        int acceptedCount = 0;

        for (int i = 1; i <= totalRequests; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
            req.addHeader("X-Forwarded-For", "198.51.100." + i);
            req.setRemoteAddr("127.0.0.1"); // Physical IP is identical
            MockHttpServletResponse res = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            filter.doFilter(req, res, chain);
            if (res.getStatus() == 200) {
                acceptedCount++;
            }
        }

        // All 30 requests succeed because the filter naively trusts X-Forwarded-For from any caller
        assertEquals(totalRequests, acceptedCount,
                "All 30 requests bypassed rate limiting due to trusting untrusted X-Forwarded-For");
    }

    @Test
    @DisplayName("Adversarial: Authenticated user CANNOT bypass rate limiting by spoofing X-Forwarded-For")
    void testAuthenticatedUserCannotBypassViaXff() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("student1", null,
                        List.of(new SimpleGrantedAuthority("ROLE_STUDENT")))
        );

        int accepted = 0;
        int rejected = 0;

        for (int i = 1; i <= 20; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
            // Attacker tries to rotate X-Forwarded-For while authenticated
            req.addHeader("X-Forwarded-For", "203.0.113." + i);
            req.setRemoteAddr("127.0.0.1");
            MockHttpServletResponse res = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            filter.doFilter(req, res, chain);
            if (res.getStatus() == 200) {
                accepted++;
            } else if (res.getStatus() == 429) {
                rejected++;
            }
        }

        // Authenticated user is bound to user:student1, so first 15 succeed and last 5 are 429
        assertEquals(15, accepted, "First 15 requests for authenticated user must be accepted");
        assertEquals(5, rejected, "Subsequent 5 requests for authenticated user must be rejected with 429");
    }

    @Test
    @DisplayName("Adversarial: Sliding window boundary condition at 60,000ms vs 60,001ms")
    void testSlidingWindowBoundaryCondition() throws Exception {
        String testIp = "192.0.2.1";
        String clientKey = "ip:" + testIp;

        // Access internal requestLog via reflection to precisely test sliding window boundary
        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);

        long now = System.currentTimeMillis();

        // 1. Scenario A: 15 requests sent within the 60s window (now - 59,000ms)
        Deque<Long> queue = new ConcurrentLinkedDeque<>();
        for (int i = 0; i < 15; i++) {
            queue.addLast(now - 59_000L);
        }
        log.put(clientKey, queue);

        // Next request within the window must be rejected (429)
        MockHttpServletRequest reqBlocked = new MockHttpServletRequest("POST", "/api/chat");
        reqBlocked.setRemoteAddr(testIp);
        MockHttpServletResponse resBlocked = new MockHttpServletResponse();
        filter.doFilter(reqBlocked, resBlocked, new MockFilterChain());
        assertEquals(429, resBlocked.getStatus(), "Request at 59s into window must be blocked (HTTP 429)");

        // 2. Scenario B: 15 requests sent beyond the 60s window (now - 60,005ms)
        queue.clear();
        for (int i = 0; i < 15; i++) {
            queue.addLast(now - 60_005L);
        }
        log.put(clientKey, queue);

        // Next request at 60,005ms must slide the window, evicting expired timestamps and allowing the request
        MockHttpServletRequest reqAllowed = new MockHttpServletRequest("POST", "/api/chat");
        reqAllowed.setRemoteAddr(testIp);
        MockHttpServletResponse resAllowed = new MockHttpServletResponse();
        filter.doFilter(reqAllowed, resAllowed, new MockFilterChain());
        assertEquals(200, resAllowed.getStatus(), "Request past 60s window must slide and be accepted (HTTP 200)");

        // After eviction and 1 new request, the queue should have size 1
        assertEquals(1, queue.size(), "Expired timestamps must be evicted and current request recorded");
    }

    @Test
    @DisplayName("Adversarial: Multi-threaded concurrency with 50 simultaneous requests")
    void testMultiThreadedConcurrency() throws Exception {
        int threadCount = 50;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger status200 = new AtomicInteger(0);
        AtomicInteger status429 = new AtomicInteger(0);
        AtomicInteger otherStatus = new AtomicInteger(0);

        String targetIp = "198.18.0.1";

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await(); // Synchronize all 50 threads to hit filter at identical instant
                    MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
                    req.setRemoteAddr(targetIp);
                    MockHttpServletResponse res = new MockHttpServletResponse();
                    MockFilterChain chain = new MockFilterChain();

                    filter.doFilter(req, res, chain);

                    if (res.getStatus() == 200) {
                        status200.incrementAndGet();
                    } else if (res.getStatus() == 429) {
                        status429.incrementAndGet();
                    } else {
                        otherStatus.incrementAndGet();
                    }
                } catch (Exception e) {
                    otherStatus.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown(); // Fire all 50 threads simultaneously
        boolean finished = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished, "All threads should complete within timeout");
        assertEquals(15, status200.get(), "Concurrency test: EXACTLY 15 requests must be accepted");
        assertEquals(35, status429.get(), "Concurrency test: EXACTLY 35 requests must be rejected with 429");
        assertEquals(0, otherStatus.get(), "No unexpected status codes or thread exceptions");
    }

    @Test
    @DisplayName("Adversarial: Container bypass prevention - FilterRegistrationBean must be disabled")
    void testContainerBypassFilterRegistrationBeanDisabled() {
        SecurityConfig config = new SecurityConfig(null);
        ChatRateLimitFilter filterBean = config.chatRateLimitFilter();
        FilterRegistrationBean<ChatRateLimitFilter> registration = config.chatRateLimitFilterRegistration(filterBean);

        assertNotNull(registration, "FilterRegistrationBean must exist");
        assertFalse(registration.isEnabled(),
                "FilterRegistrationBean.isEnabled() must be FALSE to disable automatic Tomcat container registration");
    }

    @Test
    @DisplayName("Adversarial: Memory cleanup removes stale clients when map exceeds threshold")
    void testMemoryCleanupPrunesStaleEntries() throws Exception {
        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);

        long now = System.currentTimeMillis();

        // Populate 2,050 entries where 2,000 are expired (> 60s ago) and 50 are fresh
        for (int i = 0; i < 2000; i++) {
            Deque<Long> staleQueue = new ConcurrentLinkedDeque<>();
            staleQueue.addLast(now - 70_000L); // Expired
            log.put("ip:stale-" + i, staleQueue);
        }
        for (int i = 0; i < 50; i++) {
            Deque<Long> freshQueue = new ConcurrentLinkedDeque<>();
            freshQueue.addLast(now - 10_000L); // Active
            log.put("ip:fresh-" + i, freshQueue);
        }

        assertEquals(2050, log.size());

        // Trigger request to invoke periodic cleanup (size > 2000)
        MockHttpServletRequest triggerReq = new MockHttpServletRequest("POST", "/api/chat");
        triggerReq.setRemoteAddr("10.99.99.99");
        filter.doFilter(triggerReq, new MockHttpServletResponse(), new MockFilterChain());

        // All 2,000 stale entries should be pruned, leaving only the 50 fresh entries + 1 new entry = 51
        assertEquals(51, log.size(), "Periodic cleanup must prune all expired entries when size > 2000");
    }

    @Test
    @DisplayName("Adversarial: Extreme string variant - spaces with commas ', , ,' falls back safely without crashing")
    void testExtremeVariantOnlyCommasAndSpaces() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
        req.addHeader("X-Forwarded-For", ", , ,");
        req.setRemoteAddr("172.20.0.5");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        assertDoesNotThrow(() -> filter.doFilter(req, res, chain));
        assertEquals(200, res.getStatus());

        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);
        assertTrue(log.containsKey("ip:172.20.0.5"), "Should fall back safely to remoteAddr");
        assertFalse(log.containsKey("ip:"), "Should not contain empty bucket");
    }

    @Test
    @DisplayName("Adversarial: Extreme string variant - 'unknown, UNKNOWN, , 10.0.0.1:8080' skips case-insensitive unknowns and strips port")
    void testExtremeVariantUnknownsAndPortStripping() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
        req.addHeader("X-Forwarded-For", "unknown, UNKNOWN, , 10.0.0.1:8080");
        req.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        assertDoesNotThrow(() -> filter.doFilter(req, res, chain));
        assertEquals(200, res.getStatus());

        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);
        assertTrue(log.containsKey("ip:10.0.0.1"), "Expected bucket ip:10.0.0.1 with port stripped and unknowns skipped");
        assertFalse(log.containsKey("ip:unknown"));
        assertFalse(log.containsKey("ip:10.0.0.1:8080"));
    }

    @Test
    @DisplayName("Adversarial: Extreme string variant - null X-Forwarded-For falls back to X-Real-IP, remoteAddr, or unknown")
    void testExtremeVariantNullXffFallbackHierarchy() throws Exception {
        // 1. null XFF with X-Real-IP
        MockHttpServletRequest req1 = new MockHttpServletRequest("POST", "/api/chat");
        req1.addHeader("X-Real-IP", "198.51.100.42");
        req1.setRemoteAddr("127.0.0.1");
        filter.doFilter(req1, new MockHttpServletResponse(), new MockFilterChain());

        // 2. null XFF and null X-Real-IP with remoteAddr
        MockHttpServletRequest req2 = new MockHttpServletRequest("POST", "/api/chat");
        req2.setRemoteAddr("198.51.100.99");
        filter.doFilter(req2, new MockHttpServletResponse(), new MockFilterChain());

        // 3. null XFF, null X-Real-IP, and blank remoteAddr
        MockHttpServletRequest req3 = new MockHttpServletRequest("POST", "/api/chat");
        req3.setRemoteAddr("");
        filter.doFilter(req3, new MockHttpServletResponse(), new MockFilterChain());

        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);
        assertTrue(log.containsKey("ip:198.51.100.42"), "Should resolve X-Real-IP when XFF is null");
        assertTrue(log.containsKey("ip:198.51.100.99"), "Should resolve remoteAddr when XFF and X-Real-IP are null");
        assertTrue(log.containsKey("ip:unknown"), "Should resolve 'unknown' when all sources are blank");
    }

    @Test
    @DisplayName("Adversarial: Extreme string variant - IPv6 and bracket port notation behavior analysis")
    void testExtremeVariantIpv6AndBracketNotation() throws Exception {
        // Test standard compressed IPv6 (e.g. 2001:db8::1)
        MockHttpServletRequest reqIpv6 = new MockHttpServletRequest("POST", "/api/chat");
        reqIpv6.addHeader("X-Forwarded-For", "2001:db8::1");
        filter.doFilter(reqIpv6, new MockHttpServletResponse(), new MockFilterChain());

        // Test bracketed IPv6 with port (e.g. [2001:db8::1]:8080)
        MockHttpServletRequest reqBracket = new MockHttpServletRequest("POST", "/api/chat");
        reqBracket.addHeader("X-Forwarded-For", "[2001:db8::1]:8080");
        filter.doFilter(reqBracket, new MockHttpServletResponse(), new MockFilterChain());

        // Test uncompressed IPv6 without '::' (e.g. 2001:db8:85a3:0:0:8a2e:370:7334)
        MockHttpServletRequest reqUncompressed = new MockHttpServletRequest("POST", "/api/chat");
        reqUncompressed.addHeader("X-Forwarded-For", "2001:db8:85a3:0:0:8a2e:370:7334");
        filter.doFilter(reqUncompressed, new MockHttpServletResponse(), new MockFilterChain());

        Field field = ChatRateLimitFilter.class.getDeclaredField("requestLog");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Deque<Long>> log = (Map<String, Deque<Long>>) field.get(filter);

        // Verify standard compressed IPv6 is preserved
        assertTrue(log.containsKey("ip:2001:db8::1"), "Compressed IPv6 '2001:db8::1' should be preserved intact");

        // Verify empirical behavior of bracketed IPv6 and uncompressed IPv6:
        // Notice: current implementation does not strip port from [2001:db8::1]:8080 because of contains("::")
        boolean hasBracketKey = log.containsKey("ip:[2001:db8::1]:8080");
        // Notice: uncompressed IPv6 has colons without "::", so split(":")[0] truncates to "2001"
        boolean hasTruncatedKey = log.containsKey("ip:2001");

        assertTrue(hasBracketKey, "Empirical observation: [2001:db8::1]:8080 retains brackets and port");
        assertTrue(hasTruncatedKey, "Empirical observation: uncompressed IPv6 without '::' is truncated to first hextet '2001'");
    }
}
