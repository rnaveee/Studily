package com.rnave.studily.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class WwwRedirectFilterTest {

    private final WwwRedirectFilter filter = new WwwRedirectFilter("https://studily.ca");

    private MockHttpServletRequest request(String method, String host, String path, String query) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServerName(host);
        request.setQueryString(query);
        return request;
    }

    @Test
    void wwwGet_redirectsPermanentlyToCanonicalHostKeepingPathAndQuery() throws Exception {
        MockHttpServletRequest request = request("GET", "www.studily.ca", "/messages/4", "tab=all&x=1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(301);
        assertThat(response.getHeader("Location")).isEqualTo("https://studily.ca/messages/4?tab=all&x=1");
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void wwwPost_uses308SoTheMethodAndBodySurvive() throws Exception {
        MockHttpServletRequest request = request("POST", "WWW.Studily.ca", "/api/auth/login", null);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, mock(FilterChain.class));

        assertThat(response.getStatus()).isEqualTo(308);
        assertThat(response.getHeader("Location")).isEqualTo("https://studily.ca/api/auth/login");
    }

    @Test
    void canonicalHost_passesThrough() throws Exception {
        MockHttpServletRequest request = request("GET", "studily.ca", "/dashboard", null);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(response.getHeader("Location")).isNull();
    }

    @Test
    void otherHosts_passThroughSoHealthChecksAndRailwayDomainsKeepWorking() throws Exception {
        for (String host : new String[] {"studily-production.up.railway.app", "www.evil.example", "localhost"}) {
            MockHttpServletRequest request = request("GET", host, "/actuator/health", null);
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);

            filter.doFilter(request, response, chain);

            verify(chain).doFilter(request, response);
        }
    }

    @Test
    void localBaseUrl_passesLocalRequestsThrough() throws Exception {
        WwwRedirectFilter local = new WwwRedirectFilter("http://localhost:5173");
        MockHttpServletRequest request = request("GET", "localhost", "/learn", null);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        local.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void malformedBaseUrl_disablesTheFilterInsteadOfFailingStartup() throws Exception {
        for (String bad : new String[] {"studily.ca", "https://stu dily.ca", ""}) {
            WwwRedirectFilter off = new WwwRedirectFilter(bad);
            MockHttpServletRequest request = request("GET", "www.studily.ca", "/", null);
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);

            off.doFilter(request, response, chain);

            verify(chain).doFilter(request, response);
        }
    }

    @Test
    void wwwBaseUrl_neverRedirects() throws Exception {
        WwwRedirectFilter www = new WwwRedirectFilter("https://www.studily.ca");
        MockHttpServletRequest request = request("GET", "www.studily.ca", "/", null);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        www.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }
}
