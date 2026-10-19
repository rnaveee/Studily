package com.rnave.studily.moderation;

import com.rnave.studily.user.User;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BannedEmailsTest {

    @Test
    void normalize_trimsAndLowercases() {
        assertThat(BannedEmails.normalize("  Foo@Example.COM ")).isEqualTo("foo@example.com");
    }

    @Test
    void normalize_stripsPlusTag() {
        assertThat(BannedEmails.normalize("foo+bar@example.com")).isEqualTo("foo@example.com");
    }

    @Test
    void normalize_gmailDropsDotsAndMapsGooglemail() {
        assertThat(BannedEmails.normalize("First.Last+x@googlemail.com")).isEqualTo("firstlast@gmail.com");
    }

    @Test
    void normalize_keepsDotsOnOtherDomains() {
        assertThat(BannedEmails.normalize("a.b@sfu.ca")).isEqualTo("a.b@sfu.ca");
    }

    @Test
    void normalize_splitsAtLastAt() {
        assertThat(BannedEmails.normalize("a@b@example.com")).isEqualTo("a@b@example.com");
    }

    @Test
    void hash_isStableHexOfNormalized() {
        assertThat(BannedEmails.hash("A.B@gmail.com")).isEqualTo(BannedEmails.hash("ab@gmail.com")).hasSize(64);
    }

    @Test
    void ban_insertsOnlyOnce() {
        BannedEmailRepository repo = mock(BannedEmailRepository.class);
        BannedEmails emails = new BannedEmails(repo);
        User u = new User();
        u.setId(5L);
        u.setEmail("x@example.com");
        emails.ban(u);
        verify(repo).save(any(BannedEmail.class));
        when(repo.existsByUserId(5L)).thenReturn(true);
        org.mockito.Mockito.clearInvocations(repo);
        emails.ban(u);
        verify(repo, never()).save(any(BannedEmail.class));
    }
}
