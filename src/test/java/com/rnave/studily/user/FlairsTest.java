package com.rnave.studily.user;

import com.rnave.studily.progress.Flair;
import com.rnave.studily.progress.FlairRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlairsTest {

    private static final Instant NOW = Instant.parse("2026-10-08T18:00:00Z");
    private static final String BASE_URL = "https://badges.studily.ca/flairs/v1";

    private FlairRepository flairRepository;
    private Clock clock;
    private final List<Flair> catalog = new ArrayList<>();

    @BeforeEach
    void setUp() {
        flairRepository = mock(FlairRepository.class);
        clock = mock(Clock.class);
        when(clock.instant()).thenReturn(NOW);
        when(flairRepository.findAll()).thenAnswer(inv -> List.copyOf(catalog));
        catalog.add(flair("ring_mint", null));
        catalog.add(flair("ring_galaxy", "galaxy.webp"));
    }

    private static Flair flair(String code, String imageKey) {
        Flair f = new Flair();
        f.setCode(code);
        f.setImageKey(imageKey);
        return f;
    }

    private static User wearing(Long id, String code) {
        User u = new User();
        u.setId(id);
        u.setEquippedFlairCode(code);
        return u;
    }

    @Test
    void refOf_nothingEquipped_returnsNullWithoutLoadingCatalog() {
        Flairs flairs = new Flairs(flairRepository, clock, BASE_URL);

        assertThat(flairs.refOf(wearing(1L, null))).isNull();
        verify(flairRepository, never()).findAll();
    }

    @Test
    void refOf_equippedFlairWithoutImageKey_hasCodeAndNullImageUrl() {
        Flairs flairs = new Flairs(flairRepository, clock, BASE_URL);

        assertThat(flairs.refOf(wearing(1L, "ring_mint"))).isEqualTo(new FlairRef("ring_mint", null));
    }

    @Test
    void refOf_equippedFlairWithImageKey_buildsImageUrlFromBase() {
        Flairs flairs = new Flairs(flairRepository, clock, BASE_URL);

        assertThat(flairs.refOf(wearing(1L, "ring_galaxy")))
                .isEqualTo(new FlairRef("ring_galaxy", BASE_URL + "/galaxy.webp"));
    }

    @Test
    void refOf_codeMissingFromCatalog_stillReturnsCodeWithoutImage() {
        Flairs flairs = new Flairs(flairRepository, clock, BASE_URL);

        assertThat(flairs.refOf(wearing(1L, "ring_retired"))).isEqualTo(new FlairRef("ring_retired", null));
    }

    @Test
    void refOf_trailingSlashOnBaseUrl_isNotDoubled() {
        Flairs flairs = new Flairs(flairRepository, clock, BASE_URL + "/");

        assertThat(flairs.refOf(wearing(1L, "ring_galaxy")).imageUrl()).isEqualTo(BASE_URL + "/galaxy.webp");
    }

    @Test
    void imageUrl_nullOrBlankKey_returnsNull() {
        Flairs flairs = new Flairs(flairRepository, clock, BASE_URL);

        assertThat(flairs.imageUrl(null)).isNull();
        assertThat(flairs.imageUrl("")).isNull();
        assertThat(flairs.imageUrl("  ")).isNull();
        assertThat(flairs.imageUrl("aurora.webp")).isEqualTo(BASE_URL + "/aurora.webp");
    }

    @Test
    void refOf_manyCalls_loadCatalogOnce() {
        Flairs flairs = new Flairs(flairRepository, clock, BASE_URL);

        for (long id = 1; id <= 50; id++) {
            flairs.refOf(wearing(id, id % 2 == 0 ? "ring_galaxy" : "ring_mint"));
        }

        verify(flairRepository, times(1)).findAll();
    }

    @Test
    void refOf_afterCatalogTtl_reloadsAndPicksUpNewImageKey() {
        Flairs flairs = new Flairs(flairRepository, clock, BASE_URL);
        assertThat(flairs.refOf(wearing(1L, "ring_mint")).imageUrl()).isNull();
        catalog.set(0, flair("ring_mint", "mint.webp"));

        when(clock.instant()).thenReturn(NOW.plus(Duration.ofMinutes(5)).minusMillis(1));
        assertThat(flairs.refOf(wearing(1L, "ring_mint")).imageUrl()).isNull();
        verify(flairRepository, times(1)).findAll();

        when(clock.instant()).thenReturn(NOW.plus(Duration.ofMinutes(5)));
        assertThat(flairs.refOf(wearing(1L, "ring_mint")).imageUrl()).isEqualTo(BASE_URL + "/mint.webp");
        verify(flairRepository, times(2)).findAll();
    }
}
