package com.rnave.studily.friend;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.UnauthorizedException;
import com.rnave.studily.friend.FriendDtos.FriendRequestDto;
import com.rnave.studily.friend.FriendDtos.RelationshipDto;
import com.rnave.studily.friend.FriendDtos.RelationshipStatus;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FriendServiceTest {

    private FriendRequestRepository friendRequestRepository;
    private UserRepository userRepository;
    private CurrentUser currentUser;
    private FriendService friendService;

    private User me;
    private User other;

    @BeforeEach
    void setUp() {
        friendRequestRepository = mock(FriendRequestRepository.class);
        userRepository = mock(UserRepository.class);
        currentUser = mock(CurrentUser.class);
        friendService = new FriendService(friendRequestRepository, userRepository, currentUser);

        me = new User();
        me.setId(1L);
        me.setSchool("SFU");

        other = new User();
        other.setId(2L);
        other.setUsername("otherstudent");
        other.setName("Other Student");
        other.setSchool("SFU");
    }

    @Test
    void sendRequest_toSelf_throwsIllegalArgument() {
        when(currentUser.entity()).thenReturn(me);

        assertThatThrownBy(() -> friendService.sendRequest(1L))
                .isInstanceOf(IllegalArgumentException.class);
        verify(friendRequestRepository, never()).save(any());
    }

    @Test
    void sendRequest_toUnknownUser_throwsNotFound() {
        when(currentUser.entity()).thenReturn(me);
        when(userRepository.findById(2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> friendService.sendRequest(2L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void sendRequest_whenAlreadyFriends_throwsConflict() {
        when(currentUser.entity()).thenReturn(me);
        when(userRepository.findById(2L)).thenReturn(Optional.of(other));

        FriendRequest existing = new FriendRequest();
        existing.setRequester(me);
        existing.setAddressee(other);
        existing.setStatus(FriendRequestStatus.ACCEPTED);
        when(friendRequestRepository.findBetween(1L, 2L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> friendService.sendRequest(2L))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void sendRequest_whenAlreadySentByMe_throwsConflict() {
        when(currentUser.entity()).thenReturn(me);
        when(userRepository.findById(2L)).thenReturn(Optional.of(other));

        FriendRequest existing = new FriendRequest();
        existing.setRequester(me);
        existing.setAddressee(other);
        existing.setStatus(FriendRequestStatus.PENDING);
        when(friendRequestRepository.findBetween(1L, 2L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> friendService.sendRequest(2L))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void sendRequest_whenTheyAlreadyRequestedMe_autoAccepts() {
        when(currentUser.entity()).thenReturn(me);
        when(userRepository.findById(2L)).thenReturn(Optional.of(other));

        FriendRequest existing = new FriendRequest();
        existing.setRequester(other);
        existing.setAddressee(me);
        existing.setStatus(FriendRequestStatus.PENDING);
        when(friendRequestRepository.findBetween(1L, 2L)).thenReturn(Optional.of(existing));
        when(friendRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FriendRequestDto result = friendService.sendRequest(2L);

        assertThat(result.status()).isEqualTo(FriendRequestStatus.ACCEPTED);
        assertThat(existing.getStatus()).isEqualTo(FriendRequestStatus.ACCEPTED);
        assertThat(existing.getRespondedAt()).isNotNull();
    }

    @Test
    void sendRequest_whenNoExistingRelation_createsPendingRequest() {
        when(currentUser.entity()).thenReturn(me);
        when(userRepository.findById(2L)).thenReturn(Optional.of(other));
        when(friendRequestRepository.findBetween(1L, 2L)).thenReturn(Optional.empty());
        when(friendRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FriendRequestDto result = friendService.sendRequest(2L);

        assertThat(result.status()).isEqualTo(FriendRequestStatus.PENDING);
        assertThat(result.user().id()).isEqualTo(2L);
    }

    @Test
    void accept_byNonAddressee_throwsUnauthorized() {
        when(currentUser.id()).thenReturn(3L);

        FriendRequest req = new FriendRequest();
        req.setId(10L);
        req.setRequester(me);
        req.setAddressee(other);
        req.setStatus(FriendRequestStatus.PENDING);
        when(friendRequestRepository.findById(10L)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> friendService.accept(10L))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void accept_whenAlreadyAccepted_throwsConflict() {
        when(currentUser.id()).thenReturn(2L);

        FriendRequest req = new FriendRequest();
        req.setId(10L);
        req.setRequester(me);
        req.setAddressee(other);
        req.setStatus(FriendRequestStatus.ACCEPTED);
        when(friendRequestRepository.findById(10L)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> friendService.accept(10L))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void remove_byOutsider_throwsUnauthorized() {
        when(currentUser.id()).thenReturn(3L);

        FriendRequest req = new FriendRequest();
        req.setId(10L);
        req.setRequester(me);
        req.setAddressee(other);
        when(friendRequestRepository.findById(10L)).thenReturn(Optional.of(req));

        assertThatThrownBy(() -> friendService.remove(10L))
                .isInstanceOf(UnauthorizedException.class);
        verify(friendRequestRepository, never()).delete(any());
    }

    @Test
    void schoolmates_emptyWhenCallerHasNoSchool() {
        me.setSchool(null);
        when(currentUser.entity()).thenReturn(me);

        assertThat(friendService.schoolmates()).isEmpty();
        verify(userRepository, never()).findBySchoolIgnoreCaseAndIdNotOrderByNameAsc(any(), any());
    }

    @Test
    void schoolmates_mapsRelationshipStatusPerUser() {
        when(currentUser.entity()).thenReturn(me);

        User pendingOutgoing = new User();
        pendingOutgoing.setId(2L);
        User pendingIncoming = new User();
        pendingIncoming.setId(3L);
        User friend = new User();
        friend.setId(4L);
        User stranger = new User();
        stranger.setId(5L);

        when(userRepository.findBySchoolIgnoreCaseAndIdNotOrderByNameAsc(eq("SFU"), eq(1L)))
                .thenReturn(List.of(pendingOutgoing, pendingIncoming, friend, stranger));

        FriendRequest outgoing = new FriendRequest();
        outgoing.setId(100L);
        outgoing.setRequester(me);
        outgoing.setAddressee(pendingOutgoing);
        outgoing.setStatus(FriendRequestStatus.PENDING);

        FriendRequest incoming = new FriendRequest();
        incoming.setId(101L);
        incoming.setRequester(pendingIncoming);
        incoming.setAddressee(me);
        incoming.setStatus(FriendRequestStatus.PENDING);

        FriendRequest accepted = new FriendRequest();
        accepted.setId(102L);
        accepted.setRequester(me);
        accepted.setAddressee(friend);
        accepted.setStatus(FriendRequestStatus.ACCEPTED);

        when(friendRequestRepository.findByRequesterIdOrAddresseeId(1L, 1L))
                .thenReturn(List.of(outgoing, incoming, accepted));

        List<RelationshipDto> result = friendService.schoolmates();

        assertThat(result).hasSize(4);
        assertThat(statusFor(result, 2L)).isEqualTo(RelationshipStatus.OUTGOING_PENDING);
        assertThat(statusFor(result, 3L)).isEqualTo(RelationshipStatus.INCOMING_PENDING);
        assertThat(statusFor(result, 4L)).isEqualTo(RelationshipStatus.FRIENDS);
        assertThat(statusFor(result, 5L)).isEqualTo(RelationshipStatus.NONE);
    }

    private RelationshipStatus statusFor(List<RelationshipDto> dtos, Long userId) {
        return dtos.stream()
                .filter(d -> d.user().id().equals(userId))
                .findFirst()
                .orElseThrow()
                .status();
    }
}
