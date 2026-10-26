package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetDto;
import com.rnave.studily.flashcard.FlashcardDtos.FolderDto;
import com.rnave.studily.flashcard.FlashcardDtos.FolderRequest;
import com.rnave.studily.flashcard.FlashcardDtos.StudyGroupDto;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.user.Flairs;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlashcardFolderServiceTest {

    private FlashcardFolderRepository folderRepository;
    private FlashcardSetRepository setRepository;
    private CourseService courseService;
    private CurrentUser currentUser;
    private FlashcardFolderService folders;
    private FlashcardStudyService study;

    private final List<FlashcardFolder> stored = new ArrayList<>();
    private final AtomicLong ids = new AtomicLong(0);
    private final User me = user(1L);
    private final User other = user(2L);

    @BeforeEach
    void setUp() {
        folderRepository = mock(FlashcardFolderRepository.class);
        setRepository = mock(FlashcardSetRepository.class);
        courseService = mock(CourseService.class);
        currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(1L);
        when(currentUser.entity()).thenReturn(me);
        FlashcardSetService setService = new FlashcardSetService(setRepository, currentUser, courseService,
                mock(FriendRequestRepository.class), mock(Flairs.class), mock(FlashcardImageRepository.class));
        folders = new FlashcardFolderService(folderRepository, setRepository, setService, currentUser);
        study = new FlashcardStudyService(setService, folders, courseService);

        when(folderRepository.save(any(FlashcardFolder.class))).thenAnswer(inv -> {
            FlashcardFolder f = inv.getArgument(0);
            if (f.getId() == null) {
                f.setId(ids.incrementAndGet());
                stored.add(f);
            }
            return f;
        });
        when(folderRepository.findByIdAndUserId(anyLong(), anyLong())).thenAnswer(inv -> stored.stream()
                .filter(f -> f.getId().equals(inv.getArgument(0)) && f.getUser().getId().equals(inv.getArgument(1)))
                .findFirst());
        when(folderRepository.countByUserId(anyLong())).thenAnswer(inv -> stored.stream()
                .filter(f -> f.getUser().getId().equals(inv.getArgument(0))).count());
        when(folderRepository.existsByUserIdAndNameIgnoreCase(anyLong(), anyString())).thenAnswer(inv -> stored.stream()
                .anyMatch(f -> f.getUser().getId().equals(inv.getArgument(0))
                        && f.getName().equalsIgnoreCase(inv.getArgument(1))));
        when(folderRepository.existsByUserIdAndNameIgnoreCaseAndIdNot(anyLong(), anyString(), anyLong()))
                .thenAnswer(inv -> stored.stream()
                        .anyMatch(f -> f.getUser().getId().equals(inv.getArgument(0))
                                && f.getName().equalsIgnoreCase(inv.getArgument(1))
                                && !f.getId().equals(inv.getArgument(2))));
        when(folderRepository.findByUserIdOrderByPositionAscIdAsc(anyLong())).thenAnswer(inv -> stored.stream()
                .filter(f -> f.getUser().getId().equals(inv.getArgument(0))).toList());
        when(setRepository.save(any(FlashcardSet.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(Long id) {
        User u = new User();
        u.setId(id);
        return u;
    }

    private FlashcardFolder folderOf(User owner, String name) {
        FlashcardFolder f = new FlashcardFolder();
        f.setId(ids.incrementAndGet());
        f.setUser(owner);
        f.setName(name);
        stored.add(f);
        return f;
    }

    private FlashcardSet setOf(long id, User owner, FlashcardFolder folder, int cards) {
        FlashcardSet s = new FlashcardSet();
        s.setId(id);
        s.setUser(owner);
        s.setTitle("Set " + id);
        s.setFolder(folder);
        for (int i = 0; i < cards; i++) {
            Flashcard c = new Flashcard();
            c.setId(id * 100 + i);
            c.setSet(s);
            c.setFront("f");
            c.setBack("b");
            s.getCards().add(c);
        }
        when(setRepository.findByIdAndUserId(id, owner.getId())).thenReturn(Optional.of(s));
        return s;
    }

    @Test
    void create_trimsAndCollapsesName() {
        FolderDto dto = folders.create(new FolderRequest("  Bio   midterm ", null));

        assertThat(dto.name()).isEqualTo("Bio midterm");
        assertThat(dto.setCount()).isZero();
    }

    @Test
    void create_blankName_isRejected() {
        assertThatThrownBy(() -> folders.create(new FolderRequest("   ", null))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void create_duplicateNameIgnoringCase_isConflict() {
        folders.create(new FolderRequest("Bio", null));

        assertThatThrownBy(() -> folders.create(new FolderRequest("bIO", null))).isInstanceOf(ConflictException.class);
    }

    @Test
    void create_sameNameAsAnotherUsersFolder_isAllowed() {
        folderOf(other, "Bio");

        assertThat(folders.create(new FolderRequest("Bio", null)).id()).isNotNull();
    }

    @Test
    void create_overTheCap_isRejected() {
        when(folderRepository.countByUserId(1L)).thenReturn((long) FlashcardFolderService.MAX_FOLDERS);

        assertThatThrownBy(() -> folders.create(new FolderRequest("One more", null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void update_renamesAndRepositions() {
        FlashcardFolder f = folderOf(me, "Old");

        FolderDto dto = folders.update(f.getId(), new FolderRequest("New", 4));

        assertThat(dto.name()).isEqualTo("New");
        assertThat(dto.position()).isEqualTo(4);
    }

    @Test
    void update_renameToOwnNameWithDifferentCase_isAllowed() {
        FlashcardFolder f = folderOf(me, "bio");

        assertThat(folders.update(f.getId(), new FolderRequest("Bio", null)).name()).isEqualTo("Bio");
    }

    @Test
    void update_someoneElsesFolder_isNotFound() {
        FlashcardFolder theirs = folderOf(other, "Theirs");

        assertThatThrownBy(() -> folders.update(theirs.getId(), new FolderRequest("Mine now", null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void delete_someoneElsesFolder_isNotFound() {
        FlashcardFolder theirs = folderOf(other, "Theirs");

        assertThatThrownBy(() -> folders.delete(theirs.getId())).isInstanceOf(NotFoundException.class);
        assertThat(stored).contains(theirs);
    }

    @Test
    void delete_ownFolder_unfilesSetsFirst() {
        FlashcardFolder f = folderOf(me, "Bio");

        folders.delete(f.getId());

        verify(setRepository).clearFolder(f.getId());
        verify(folderRepository).delete(f);
    }

    @Test
    void moveSet_intoOwnFolder_andBackOut() {
        FlashcardFolder f = folderOf(me, "Bio");
        FlashcardSet s = setOf(10L, me, null, 3);

        FlashcardSetDto in = folders.moveSet(10L, f.getId());
        assertThat(in.folderId()).isEqualTo(f.getId());
        assertThat(s.getFolder()).isSameAs(f);

        FlashcardSetDto out = folders.moveSet(10L, null);
        assertThat(out.folderId()).isNull();
    }

    @Test
    void moveSet_intoSomeoneElsesFolder_isNotFound() {
        FlashcardFolder theirs = folderOf(other, "Theirs");
        FlashcardSet s = setOf(10L, me, null, 3);

        assertThatThrownBy(() -> folders.moveSet(10L, theirs.getId())).isInstanceOf(NotFoundException.class);
        assertThat(s.getFolder()).isNull();
    }

    @Test
    void moveSet_ofSomeoneElsesSet_isNotFound() {
        FlashcardFolder mine = folderOf(me, "Bio");
        setOf(20L, other, null, 3);

        assertThatThrownBy(() -> folders.moveSet(20L, mine.getId())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void study_folder_returnsOnlyOwnCompleteCardsTaggedWithSetId() {
        FlashcardFolder mine = folderOf(me, "Bio");
        FlashcardSet a = setOf(10L, me, mine, 2);
        FlashcardSet b = setOf(11L, me, mine, 3);
        FlashcardSet foreign = setOf(30L, other, mine, 4);
        when(setRepository.findByUserIdAndFolderIdOrderByCreatedAtDesc(1L, mine.getId())).thenReturn(List.of(a, b));
        when(setRepository.findByUserIdAndFolderIdOrderByCreatedAtDesc(2L, mine.getId())).thenReturn(List.of(foreign));

        StudyGroupDto group = study.group(mine.getId(), null);

        assertThat(group.title()).isEqualTo("Bio");
        assertThat(group.kind()).isEqualTo("folder");
        assertThat(group.setCount()).isEqualTo(2);
        assertThat(group.cards()).hasSize(5);
        assertThat(group.cards()).allSatisfy(c -> assertThat(c.setId()).isIn(10L, 11L));
        assertThat(group.truncated()).isFalse();
    }

    @Test
    void study_someoneElsesFolder_isNotFound() {
        FlashcardFolder theirs = folderOf(other, "Theirs");

        assertThatThrownBy(() -> study.group(theirs.getId(), null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void study_course_usesOwnedCourseAndItsSets() {
        Course course = new Course();
        course.setId(3L);
        course.setCode("BIO 101");
        when(courseService.requireOwned(3L)).thenReturn(course);
        FlashcardSet a = setOf(10L, me, null, 2);
        when(setRepository.findByUserIdAndCourseIdOrderByCreatedAtDesc(1L, 3L)).thenReturn(List.of(a));

        StudyGroupDto group = study.group(null, 3L);

        assertThat(group.kind()).isEqualTo("course");
        assertThat(group.title()).isEqualTo("BIO 101");
        assertThat(group.cards()).hasSize(2);
    }

    @Test
    void study_someoneElsesCourse_isNotFound() {
        when(courseService.requireOwned(9L)).thenThrow(new NotFoundException("Course not found"));

        assertThatThrownBy(() -> study.group(null, 9L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void study_needsExactlyOneScope() {
        assertThatThrownBy(() -> study.group(null, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> study.group(1L, 2L)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void study_overTheCardCap_isTruncated() {
        FlashcardFolder mine = folderOf(me, "Big");
        FlashcardSet a = setOf(10L, me, mine, FlashcardStudyService.MAX_CARDS);
        FlashcardSet b = setOf(11L, me, mine, 10);
        when(setRepository.findByUserIdAndFolderIdOrderByCreatedAtDesc(1L, mine.getId())).thenReturn(List.of(a, b));

        StudyGroupDto group = study.group(mine.getId(), null);

        assertThat(group.cards()).hasSize(FlashcardStudyService.MAX_CARDS);
        assertThat(group.truncated()).isTrue();
    }
}
