package com.rnave.studily.gpa;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.gpa.GradingScaleService.CustomBandDto;
import com.rnave.studily.gpa.GradingScaleService.CustomBandRequest;
import com.rnave.studily.gpa.GradingScaleService.CustomScaleRequest;
import com.rnave.studily.gpa.GradingScaleService.GpaScaleDto;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GradingScaleServiceTest {

    private CustomGradingScaleRepository customRepository;
    private UserRepository userRepository;
    private GradingScaleService service;
    private User user;

    @BeforeEach
    void setUp() {
        customRepository = mock(CustomGradingScaleRepository.class);
        userRepository = mock(UserRepository.class);
        service = new GradingScaleService(customRepository, userRepository);
        user = new User();
        user.setId(5L);
        when(customRepository.save(any(CustomGradingScale.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static CustomGradingScale row(String name, int[] mins, String[] letters, double[] points) {
        CustomGradingScale row = new CustomGradingScale();
        row.setUserId(5L);
        row.setName(name);
        for (int i = 0; i < mins.length; i++) {
            row.getBands().add(new CustomGradeBand((short) mins[i], letters[i], BigDecimal.valueOf(points[i])));
        }
        return row;
    }

    private static CustomGradingScale savedNduRow() {
        return row("NDU", new int[]{90, 70, 0}, new String[]{"A", "C", "F"}, new double[]{4.0, 2.0, 0.0});
    }

    private static List<CustomBandRequest> validBands() {
        return List.of(new CustomBandRequest(0, "F", 0.0), new CustomBandRequest(90, "A", 4.0),
                new CustomBandRequest(70, "C", 2.0));
    }

    @Test
    void scaleForUsesSavedCustomBandsWhenCustomIsSelected() {
        user.setGpaScale(GpaScale.CUSTOM);
        when(customRepository.findById(5L)).thenReturn(Optional.of(savedNduRow()));
        GradingScale scale = service.scaleFor(user);
        assertThat(scale.key()).isEqualTo(GpaScale.CUSTOM);
        assertThat(scale.letterFor(70)).isEqualTo("C");
        assertThat(scale.pointsFor(70)).isEqualTo(2.0);
    }

    @Test
    void scaleForFallsBackToSchoolDefaultWhenCustomRowIsMissing() {
        user.setGpaScale(GpaScale.CUSTOM);
        user.setSchoolKey("uvic");
        when(customRepository.findById(5L)).thenReturn(Optional.empty());
        assertThat(service.scaleFor(user).key()).isEqualTo(GpaScale.NINE_POINT);
    }

    @Test
    void scaleForUsesSchoolDefaultWhenNothingIsSelected() {
        user.setSchoolKey("uvic");
        assertThat(service.scaleFor(user).key()).isEqualTo(GpaScale.NINE_POINT);
        verify(customRepository, never()).findById(any());
    }

    @Test
    void scaleForUsesTheExplicitPreset() {
        user.setGpaScale(GpaScale.FOUR_THREE_THREE);
        user.setSchoolKey("uvic");
        assertThat(service.scaleFor(user).key()).isEqualTo(GpaScale.FOUR_THREE_THREE);
    }

    @Test
    void selectingCustomWithoutASavedRowIsRejectedAndNotSaved() {
        when(customRepository.findById(5L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.select(user, GpaScale.CUSTOM)).isInstanceOf(BadRequestException.class);
        verify(userRepository, never()).save(any());
        assertThat(user.getGpaScale()).isNull();
    }

    @Test
    void selectingCustomWithASavedRowSetsAndSavesIt() {
        when(customRepository.findById(5L)).thenReturn(Optional.of(savedNduRow()));
        GpaScaleDto dto = service.select(user, GpaScale.CUSTOM);
        assertThat(user.getGpaScale()).isEqualTo(GpaScale.CUSTOM);
        verify(userRepository).save(user);
        assertThat(dto.scale()).isEqualTo(GpaScale.CUSTOM);
        assertThat(dto.explicit()).isTrue();
    }

    @Test
    void selectingAPresetSetsAndSavesIt() {
        GpaScaleDto dto = service.select(user, GpaScale.NINE_POINT);
        assertThat(user.getGpaScale()).isEqualTo(GpaScale.NINE_POINT);
        verify(userRepository).save(user);
        assertThat(dto.scale()).isEqualTo(GpaScale.NINE_POINT);
        assertThat(dto.explicit()).isTrue();
    }

    @Test
    void selectingNullGoesBackToAutomatic() {
        user.setGpaScale(GpaScale.NINE_POINT);
        user.setSchoolKey("sfu");
        GpaScaleDto dto = service.select(user, null);
        assertThat(user.getGpaScale()).isNull();
        verify(userRepository).save(user);
        assertThat(dto.explicit()).isFalse();
        assertThat(dto.scale()).isEqualTo(GpaScale.FOUR_THREE_THREE);
    }

    @Test
    void saveCustomStoresSortedBandsSelectsCustomAndReturnsThem() {
        when(customRepository.findById(5L)).thenReturn(Optional.empty());
        GpaScaleDto dto = service.saveCustom(user, new CustomScaleRequest("NDU", validBands()));

        ArgumentCaptor<CustomGradingScale> captor = ArgumentCaptor.forClass(CustomGradingScale.class);
        verify(customRepository).save(captor.capture());
        CustomGradingScale saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(5L);
        assertThat(saved.getName()).isEqualTo("NDU");
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(saved.getBands()).extracting(CustomGradeBand::getMinPercent)
                .containsExactly((short) 90, (short) 70, (short) 0);

        assertThat(user.getGpaScale()).isEqualTo(GpaScale.CUSTOM);
        verify(userRepository).save(user);
        assertThat(dto.scale()).isEqualTo(GpaScale.CUSTOM);
        assertThat(dto.explicit()).isTrue();
        assertThat(dto.custom().name()).isEqualTo("NDU");
        assertThat(dto.custom().bands()).extracting(CustomBandDto::letter).containsExactly("A", "C", "F");
        assertThat(dto.custom().bands().get(1).points()).isEqualTo(2.0);
    }

    @Test
    void savingAgainReplacesTheExistingBands() {
        CustomGradingScale existing = row("Old", new int[]{80, 40, 0}, new String[]{"X", "Y", "Z"},
                new double[]{3, 2, 0});
        when(customRepository.findById(5L)).thenReturn(Optional.of(existing));
        GpaScaleDto dto = service.saveCustom(user, new CustomScaleRequest("New", validBands()));

        assertThat(existing.getBands()).extracting(CustomGradeBand::getLetter).containsExactly("A", "C", "F");
        assertThat(existing.getName()).isEqualTo("New");
        assertThat(dto.custom().bands()).hasSize(3);
    }

    @Test
    void bandMissingAFieldIsRejected() {
        List<CustomBandRequest> noPoints = List.of(new CustomBandRequest(0, "F", null),
                new CustomBandRequest(50, "A", 4.0));
        List<CustomBandRequest> noMin = List.of(new CustomBandRequest(0, "F", 0.0),
                new CustomBandRequest(null, "A", 4.0));
        List<CustomBandRequest> noLetter = List.of(new CustomBandRequest(0, null, 0.0),
                new CustomBandRequest(50, "A", 4.0));
        List<CustomBandRequest> nullBand = new ArrayList<>(List.of(new CustomBandRequest(0, "F", 0.0)));
        nullBand.add(null);
        for (List<CustomBandRequest> bands : List.of(noPoints, noMin, noLetter, nullBand)) {
            assertThatThrownBy(() -> service.saveCustom(user, new CustomScaleRequest("x", bands)))
                    .isInstanceOf(BadRequestException.class);
        }
        verify(customRepository, never()).save(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void nullRequestOrNullBandsAreRejected() {
        assertThatThrownBy(() -> service.saveCustom(user, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.saveCustom(user, new CustomScaleRequest("x", null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void blankNameBecomesNull() {
        when(customRepository.findById(5L)).thenReturn(Optional.empty());
        GpaScaleDto dto = service.saveCustom(user, new CustomScaleRequest("   ", validBands()));
        assertThat(dto.custom().name()).isNull();
    }

    @Test
    void nameIsTrimmed() {
        when(customRepository.findById(5L)).thenReturn(Optional.empty());
        GpaScaleDto dto = service.saveCustom(user, new CustomScaleRequest("  NDU  ", validBands()));
        assertThat(dto.custom().name()).isEqualTo("NDU");
    }

    @Test
    void fortyCharacterNameIsAcceptedAndFortyOneIsRejected() {
        when(customRepository.findById(5L)).thenReturn(Optional.empty());
        assertThat(service.saveCustom(user, new CustomScaleRequest("n".repeat(40), validBands())).custom().name())
                .hasSize(40);
        assertThatThrownBy(() -> service.saveCustom(user, new CustomScaleRequest("n".repeat(41), validBands())))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void invalidBandsSaveNothing() {
        List<CustomBandRequest> noZero = List.of(new CustomBandRequest(50, "A", 4.0),
                new CustomBandRequest(10, "F", 0.0));
        assertThatThrownBy(() -> service.saveCustom(user, new CustomScaleRequest("x", noZero)))
                .isInstanceOf(BadRequestException.class);
        verify(customRepository, never()).save(any());
        verify(userRepository, never()).save(any());
        assertThat(user.getGpaScale()).isNull();
    }

    @Test
    void tooLongNameSavesNothing() {
        assertThatThrownBy(() -> service.saveCustom(user, new CustomScaleRequest("n".repeat(41), validBands())))
                .isInstanceOf(BadRequestException.class);
        verify(customRepository, never()).save(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void deleteWhileCustomIsSelectedRemovesRowAndResetsSelection() {
        CustomGradingScale existing = savedNduRow();
        user.setGpaScale(GpaScale.CUSTOM);
        user.setSchoolKey("uvic");
        when(customRepository.findById(5L)).thenReturn(Optional.of(existing));
        GpaScaleDto dto = service.deleteCustom(user);
        verify(customRepository).delete(existing);
        assertThat(user.getGpaScale()).isNull();
        verify(userRepository).save(user);
        assertThat(dto.explicit()).isFalse();
        assertThat(dto.custom()).isNull();
        assertThat(dto.scale()).isEqualTo(GpaScale.NINE_POINT);
    }

    @Test
    void deleteWhilePresetIsSelectedKeepsTheSelection() {
        CustomGradingScale existing = savedNduRow();
        user.setGpaScale(GpaScale.FOUR_POINT);
        when(customRepository.findById(5L)).thenReturn(Optional.of(existing));
        GpaScaleDto dto = service.deleteCustom(user);
        verify(customRepository).delete(existing);
        assertThat(user.getGpaScale()).isEqualTo(GpaScale.FOUR_POINT);
        verify(userRepository, never()).save(any());
        assertThat(dto.explicit()).isTrue();
        assertThat(dto.custom()).isNull();
    }

    @Test
    void deleteWithNoRowIsIdempotent() {
        when(customRepository.findById(5L)).thenReturn(Optional.empty());
        GpaScaleDto dto = service.deleteCustom(user);
        verify(customRepository, never()).delete(any());
        assertThat(dto.custom()).isNull();
        assertThat(dto.explicit()).isFalse();
    }

    @Test
    void prefsFallsBackToSchoolDefaultWhenCustomRowIsMissing() {
        user.setGpaScale(GpaScale.CUSTOM);
        user.setSchoolKey("uvic");
        when(customRepository.findById(5L)).thenReturn(Optional.empty());
        GpaScaleDto dto = service.prefs(user);
        assertThat(dto.scale()).isEqualTo(GpaScale.NINE_POINT);
        assertThat(dto.defaultScale()).isEqualTo(GpaScale.NINE_POINT);
        assertThat(dto.explicit()).isFalse();
        assertThat(dto.custom()).isNull();
    }

    @Test
    void prefsIncludesSavedCustomBandsEvenWhenAPresetIsSelected() {
        user.setGpaScale(GpaScale.FOUR_POINT);
        when(customRepository.findById(5L)).thenReturn(Optional.of(savedNduRow()));
        GpaScaleDto dto = service.prefs(user);
        assertThat(dto.scale()).isEqualTo(GpaScale.FOUR_POINT);
        assertThat(dto.custom().bands()).hasSize(3);
    }
}
