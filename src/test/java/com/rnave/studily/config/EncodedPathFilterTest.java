package com.rnave.studily.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class EncodedPathFilterTest {

    private final EncodedPathFilter filter = new EncodedPathFilter();

    private MockHttpServletResponse run(String uri, FilterChain chain) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        request.setRequestURI(uri);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }

    @Test
    void rejectsEncodedLettersThatCouldHideAnApiPrefix() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = run("/api/%61dmin/db/tables/users", chain);

        assertThat(response.getStatus()).isEqualTo(400);
        verify(chain, never()).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rejectsEncodedSlashDotAndBrokenEscapes() throws Exception {
        assertThat(run("/api/auth%2Flogin", mock(FilterChain.class)).getStatus()).isEqualTo(400);
        assertThat(run("/api/%2e%2e/admin", mock(FilterChain.class)).getStatus()).isEqualTo(400);
        assertThat(run("/api/auth/%zz", mock(FilterChain.class)).getStatus()).isEqualTo(400);
        assertThat(run("/api/auth/%4", mock(FilterChain.class)).getStatus()).isEqualTo(400);
    }

    @Test
    void allowsPlainAndHarmlessEncodedPaths() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = run("/api/users/some%20name/progress", chain);

        assertThat(response.getStatus()).isEqualTo(200);
        verify(chain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        assertThat(run("/api/courses/12", mock(FilterChain.class)).getStatus()).isEqualTo(200);
    }
}
