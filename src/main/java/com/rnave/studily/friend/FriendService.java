package com.rnave.studily.friend;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.PageResponse;
import com.rnave.studily.config.UnauthorizedException;
import com.rnave.studily.friend.FriendDtos.FriendRequestDto;
import com.rnave.studily.friend.FriendDtos.PublicUserDto;
import com.rnave.studily.friend.FriendDtos.RelationshipDto;
import com.rnave.studily.friend.FriendDtos.RelationshipStatus;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FriendService {

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public FriendService(FriendRequestRepository friendRequestRepository, UserRepository userRepository,
                          CurrentUser currentUser) {
        this.friendRequestRepository = friendRequestRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<FriendRequestDto> incoming() {
        Long me = currentUser.id();
        return friendRequestRepository.findByAddresseeIdAndStatusOrderByCreatedAtDesc(me, FriendRequestStatus.PENDING)
                .stream().map(f -> toDto(f, me)).toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestDto> pendingSent() {
        Long me = currentUser.id();
        return friendRequestRepository.findByRequesterIdAndStatusOrderByCreatedAtDesc(me, FriendRequestStatus.PENDING)
                .stream().map(f -> toDto(f, me)).toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestDto> friends() {
        Long me = currentUser.id();
        return friendRequestRepository.findFriendsOf(me)
                .stream().map(f -> toDto(f, me)).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<RelationshipDto> schoolmates(int page, int size) {
        User me = currentUser.entity();
        if (me.getSchool() == null || me.getSchool().isBlank()) {
            return PageResponse.empty();
        }
        Slice<User> mates = userRepository.findBySchoolIgnoreCaseAndIdNotOrderByNameAsc(
                me.getSchool(), me.getId(),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        if (mates.isEmpty()) {
            return PageResponse.empty();
        }
        Map<Long, FriendRequest> relations = relationsByOtherUserId(me.getId());
        List<RelationshipDto> items = mates.getContent().stream()
                .map(u -> toRelationshipDto(u, me.getId(), relations.get(u.getId())))
                .toList();
        return new PageResponse<>(items, mates.hasNext());
    }

    @Transactional(readOnly = true)
    public PageResponse<RelationshipDto> searchByUsername(String query, int page, int size) {
        String q = query == null ? "" : query.trim();
        if (q.startsWith("@")) {
            q = q.substring(1);
        }
        if (q.isBlank()) {
            return PageResponse.empty();
        }
        User me = currentUser.entity();
        Slice<User> found = userRepository.findByUsernameContainingIgnoreCaseAndIdNotOrderByUsernameAsc(
                q, me.getId(),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        if (found.isEmpty()) {
            return PageResponse.empty();
        }
        Map<Long, FriendRequest> relations = relationsByOtherUserId(me.getId());
        List<RelationshipDto> items = found.getContent().stream()
                .map(u -> toRelationshipDto(u, me.getId(), relations.get(u.getId())))
                .toList();
        return new PageResponse<>(items, found.hasNext());
    }

    @Transactional(readOnly = true)
    public RelationshipDto publicUser(Long userId) {
        User me = currentUser.entity();
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (target.getId().equals(me.getId())) {
            return new RelationshipDto(PublicUserDto.from(target), RelationshipStatus.SELF, null);
        }
        FriendRequest relation = friendRequestRepository.findBetween(me.getId(), target.getId()).orElse(null);
        return toRelationshipDto(target, me.getId(), relation);
    }

    @Transactional
    public FriendRequestDto sendRequest(Long targetUserId) {
        User me = currentUser.entity();
        if (targetUserId.equals(me.getId())) {
            throw new IllegalArgumentException("You can't add yourself as a friend");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Optional<FriendRequest> existing = friendRequestRepository.findBetween(me.getId(), target.getId());
        if (existing.isPresent()) {
            FriendRequest req = existing.get();
            if (req.getStatus() == FriendRequestStatus.ACCEPTED) {
                throw new ConflictException("You're already friends");
            }
            if (req.getRequester().getId().equals(me.getId())) {
                throw new ConflictException("Friend request already sent");
            }
            req.setStatus(FriendRequestStatus.ACCEPTED);
            req.setRespondedAt(Instant.now());
            return toDto(friendRequestRepository.save(req), me.getId());
        }

        FriendRequest req = new FriendRequest();
        req.setRequester(me);
        req.setAddressee(target);
        return toDto(friendRequestRepository.save(req), me.getId());
    }

    @Transactional
    public FriendRequestDto accept(Long requestId) {
        Long me = currentUser.id();
        FriendRequest req = requireParticipant(requestId, me);
        if (!req.getAddressee().getId().equals(me)) {
            throw new UnauthorizedException("Only the recipient can accept this request");
        }
        if (req.getStatus() != FriendRequestStatus.PENDING) {
            throw new ConflictException("Request is no longer pending");
        }
        req.setStatus(FriendRequestStatus.ACCEPTED);
        req.setRespondedAt(Instant.now());
        return toDto(friendRequestRepository.save(req), me);
    }

    @Transactional
    public void remove(Long requestId) {
        Long me = currentUser.id();
        friendRequestRepository.delete(requireParticipant(requestId, me));
    }

    private FriendRequest requireParticipant(Long requestId, Long me) {
        FriendRequest req = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Friend request not found"));
        if (!req.getRequester().getId().equals(me) && !req.getAddressee().getId().equals(me)) {
            throw new UnauthorizedException("Not part of this friend request");
        }
        return req;
    }

    private Map<Long, FriendRequest> relationsByOtherUserId(Long me) {
        return friendRequestRepository.findByRequesterIdOrAddresseeId(me, me).stream()
                .collect(Collectors.toMap(f -> otherUserId(f, me), f -> f));
    }

    private Long otherUserId(FriendRequest f, Long me) {
        return f.getRequester().getId().equals(me) ? f.getAddressee().getId() : f.getRequester().getId();
    }

    private RelationshipDto toRelationshipDto(User other, Long me, FriendRequest relation) {
        if (relation == null) {
            return new RelationshipDto(PublicUserDto.from(other), RelationshipStatus.NONE, null);
        }
        RelationshipStatus status;
        if (relation.getStatus() == FriendRequestStatus.ACCEPTED) {
            status = RelationshipStatus.FRIENDS;
        } else if (relation.getRequester().getId().equals(me)) {
            status = RelationshipStatus.OUTGOING_PENDING;
        } else {
            status = RelationshipStatus.INCOMING_PENDING;
        }
        return new RelationshipDto(PublicUserDto.from(other), status, relation.getId());
    }

    private FriendRequestDto toDto(FriendRequest f, Long me) {
        User other = f.getRequester().getId().equals(me) ? f.getAddressee() : f.getRequester();
        return new FriendRequestDto(f.getId(), PublicUserDto.from(other), f.getStatus(), f.getCreatedAt(), f.getRespondedAt());
    }
}
