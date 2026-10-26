package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.flashcard.FlashcardDtos.FlashcardSetDto;
import com.rnave.studily.flashcard.FlashcardDtos.FolderDto;
import com.rnave.studily.flashcard.FlashcardDtos.FolderRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class FlashcardFolderService {

    static final int MAX_FOLDERS = 100;

    private final FlashcardFolderRepository folderRepository;
    private final FlashcardSetRepository setRepository;
    private final FlashcardSetService setService;
    private final CurrentUser currentUser;

    public FlashcardFolderService(FlashcardFolderRepository folderRepository, FlashcardSetRepository setRepository,
                                  FlashcardSetService setService, CurrentUser currentUser) {
        this.folderRepository = folderRepository;
        this.setRepository = setRepository;
        this.setService = setService;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<FolderDto> list() {
        Long userId = currentUser.id();
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : folderRepository.setCounts(userId)) {
            counts.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return folderRepository.findByUserIdOrderByPositionAscIdAsc(userId).stream()
                .map(f -> dto(f, counts.getOrDefault(f.getId(), 0)))
                .toList();
    }

    @Transactional(readOnly = true)
    public FlashcardFolder requireOwned(Long id) {
        return folderRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Folder not found"));
    }

    @Transactional
    public FolderDto create(FolderRequest req) {
        Long userId = currentUser.id();
        String name = cleanName(req.name());
        if (folderRepository.countByUserId(userId) >= MAX_FOLDERS) {
            throw new BadRequestException("You can have up to " + MAX_FOLDERS + " folders");
        }
        if (folderRepository.existsByUserIdAndNameIgnoreCase(userId, name)) {
            throw new ConflictException("You already have a folder with that name");
        }
        FlashcardFolder folder = new FlashcardFolder();
        folder.setUser(currentUser.entity());
        folder.setName(name);
        folder.setPosition(req.position() != null ? Math.max(0, req.position())
                : (int) folderRepository.countByUserId(userId));
        return dto(folderRepository.save(folder), 0);
    }

    @Transactional
    public FolderDto update(Long id, FolderRequest req) {
        FlashcardFolder folder = requireOwned(id);
        String name = cleanName(req.name());
        if (folderRepository.existsByUserIdAndNameIgnoreCaseAndIdNot(currentUser.id(), name, id)) {
            throw new ConflictException("You already have a folder with that name");
        }
        folder.setName(name);
        if (req.position() != null) {
            folder.setPosition(Math.max(0, req.position()));
        }
        return dto(folderRepository.save(folder), setCount(folder));
    }

    @Transactional
    public void delete(Long id) {
        FlashcardFolder folder = requireOwned(id);
        setRepository.clearFolder(folder.getId());
        folderRepository.delete(folder);
    }

    @Transactional
    public FlashcardSetDto moveSet(Long setId, Long folderId) {
        FlashcardSet set = setService.requireOwned(setId);
        set.setFolder(folderId == null ? null : requireOwned(folderId));
        return FlashcardSetDto.from(setRepository.save(set));
    }

    private int setCount(FlashcardFolder folder) {
        return setRepository.findByUserIdAndFolderIdOrderByCreatedAtDesc(currentUser.id(), folder.getId()).size();
    }

    private static FolderDto dto(FlashcardFolder f, int setCount) {
        return new FolderDto(f.getId(), f.getName(), f.getPosition(), setCount, f.getCreatedAt());
    }

    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) {
            throw new BadRequestException("Folder name can't be empty");
        }
        if (name.length() > 60) {
            throw new BadRequestException("Folder name can be at most 60 characters");
        }
        return name;
    }
}
