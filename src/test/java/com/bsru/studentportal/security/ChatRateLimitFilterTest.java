package com.bsru.studentportal.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChatRateLimitFilterTest {

    private ChatRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ChatRateLimitFilter();
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Sliding window: 15 rapid chat requests are allowed, 16th returns HTTP 429")
    void testAllowsFifteenRequestsThenRejectsSixteenth() throws Exception {
        String testIp = "10.0.0.1";

        for (int i = 1; i <= 15; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/chat");
            request.setRemoteAddr(testIp);
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            filter.doFilter(request, response, chain);
            assertEquals(200, response.getStatus(), "Request #" + i + " should be allowed");
        }

        // 16th request from the same IP must be rejected with 429
        MockHttpServletRequest request16 = new MockHttpServletRequest("POST", "/api/chat");
        request16.setRemoteAddr(testIp);
        MockHttpServletResponse response16 = new MockHttpServletResponse();
        MockFilterChain chain16 = new MockFilterChain();

        filter.doFilter(request16, response16, chain16);
        assertEquals(429, response16.getStatus(), "Request #16 must return HTTP 429");
        assertTrue(response16.getContentAsString().contains("คุณส่งข้อความถี่เกินไป"),
                "Response must contain Thai rate limit message");
    }

    @Test
    @DisplayName("IP isolation: exhausting quota for one IP does not block another IP")
    void testIndependentBucketsPerIp() throws Exception {
        String exhaustedIp = "192.168.1.10";
        String freshIp = "192.168.1.20";

        // Exhaust IP 1
        for (int i = 1; i <= 15; i++) {
            MockHttpServletRequest reqA = new MockHttpServletRequest("POST", "/api/chat");
            reqA.setRemoteAddr(exhaustedIp);
            filter.doFilter(reqA, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 16th request for exhausted IP is 429
        MockHttpServletRequest reqA16 = new MockHttpServletRequest("POST", "/api/chat");
        reqA16.setRemoteAddr(exhaustedIp);
        MockHttpServletResponse resA16 = new MockHttpServletResponse();
        filter.doFilter(reqA16, resA16, new MockFilterChain());
        assertEquals(429, resA16.getStatus());

        // Fresh IP should still be permitted
        MockHttpServletRequest reqB = new MockHttpServletRequest("POST", "/api/chat");
        reqB.setRemoteAddr(freshIp);
        MockHttpServletResponse resB = new MockHttpServletResponse();
        filter.doFilter(reqB, resB, new MockFilterChain());
        assertEquals(200, resB.getStatus());
    }

    @Test
    @DisplayName("User isolation: authenticated user key overrides IP and isolates per user")
    void testAuthenticatedUserOverridesIp() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("student", null, List.of(new SimpleGrantedAuthority("ROLE_STUDENT")))
        );

        // Send 15 requests from different IP addresses under the same authenticated username
        for (int i = 1; i <= 15; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
            req.setRemoteAddr("172.16.0." + i);
            filter.doFilter(req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 16th request with yet another IP must still be blocked because user matches
        MockHttpServletRequest req16 = new MockHttpServletRequest("POST", "/api/chat");
        req16.setRemoteAddr("172.16.0.99");
        MockHttpServletResponse res16 = new MockHttpServletResponse();
        filter.doFilter(req16, res16, new MockFilterChain());

        assertEquals(429, res16.getStatus(), "Authenticated user should be throttled regardless of varying IP");
    }

    @Test
    @DisplayName("Non-chat endpoints and other methods bypass rate limiting")
    void testNonChatEndpointsBypassed() throws Exception {
        MockHttpServletRequest getReq = new MockHttpServletRequest("GET", "/api/health");
        MockHttpServletResponse getRes = new MockHttpServletResponse();
        filter.doFilter(getReq, getRes, new MockFilterChain());
        assertEquals(200, getRes.getStatus());

        MockHttpServletRequest postNonChat = new MockHttpServletRequest("POST", "/api/petitions");
        MockHttpServletResponse postRes = new MockHttpServletResponse();
        filter.doFilter(postNonChat, postRes, new MockFilterChain());
        assertEquals(200, postRes.getStatus());
    }

    @Test
    @DisplayName("Trailing slash /api/chat/ is properly intercepted and rate limited")
    void testTrailingSlashSupport() throws Exception {
        String testIp = "10.0.0.5";

        for (int i = 1; i <= 15; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat/");
            req.setRemoteAddr(testIp);
            filter.doFilter(req, new MockHttpServletResponse(), new MockFilterChain());
        }

        MockHttpServletRequest req16 = new MockHttpServletRequest("POST", "/api/chat/");
        req16.setRemoteAddr(testIp);
        MockHttpServletResponse res16 = new MockHttpServletResponse();
        filter.doFilter(req16, res16, new MockFilterChain());

        assertEquals(429, res16.getStatus(), "Trailing slash endpoint must be rate-limited on 16th request");
    }

    @Test
    @DisplayName("X-Forwarded-For header is parsed and prioritized for anonymous callers")
    void testXForwardedForHeaderUsed() throws Exception {
        String clientIp = "203.0.113.195";

        for (int i = 1; i <= 15; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/chat");
            req.addHeader("X-Forwarded-For", clientIp + ", 10.0.0.1");
            req.setRemoteAddr("127.0.0.1");
            filter.doFilter(req, new MockHttpServletResponse(), new MockFilterChain());
        }

        MockHttpServletRequest req16 = new MockHttpServletRequest("POST", "/api/chat");
        req16.addHeader("X-Forwarded-For", clientIp + ", 10.0.0.1");
        req16.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse res16 = new MockHttpServletResponse();
        filter.doFilter(req16, res16, new MockFilterChain());

        assertEquals(429, res16.getStatus(), "Client identified by X-Forwarded-For must be throttled");
    }
}
