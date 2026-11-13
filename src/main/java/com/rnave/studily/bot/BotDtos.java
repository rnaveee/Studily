package com.rnave.studily.bot;

import com.rnave.studily.filebank.BankFileDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class BotDtos {

    public enum Verdict {
        CORRECT, PARTIAL, INCORRECT
    }

    public record CitationDto(int index, long fileId, String fileName, Integer page, Integer pageTo,
                              String quote, boolean previewable, Integer offset) {

        public CitationDto(int index, long fileId, String fileName, Integer page, Integer pageTo,
                           String quote, boolean previewable) {
            this(index, fileId, fileName, page, pageTo, quote, previewable, null);
        }
    }

    public record ProblemDto(int number, String statement, boolean fromClass, List<CitationDto> sources) {
    }

    public record GradeDto(Verdict verdict, String feedback, List<String> steps, String solution) {
    }

    public record ProblemSecret(String solution, String finalAnswer) {
    }

    public record AttachmentDto(long fileId, String name) {
    }

    public record BotMeta(List<CitationDto> citations, ProblemDto problem, ProblemSecret secret, GradeDto grade,
                          List<AttachmentDto> attachments, List<String> images) {

        public static BotMeta citations(List<CitationDto> citations) {
            return new BotMeta(citations, null, null, null, null, null);
        }

        public static BotMeta problem(ProblemDto problem, ProblemSecret secret) {
            return new BotMeta(List.of(), problem, secret, null, null, null);
        }

        public static BotMeta grade(GradeDto grade) {
            return new BotMeta(List.of(), null, null, grade, null, null);
        }

        public static BotMeta attachments(List<AttachmentDto> attachments) {
            return new BotMeta(List.of(), null, null, null, attachments, null);
        }

        public static BotMeta question(List<AttachmentDto> attachments, List<String> images) {
            return new BotMeta(List.of(), null, null, null,
                    attachments.isEmpty() ? null : attachments, images.isEmpty() ? null : images);
        }
    }

    public record MessageDto(Long id, BotRole role, BotMessageKind kind, String content,
                             List<CitationDto> citations, ProblemDto problem, GradeDto grade,
                             List<AttachmentDto> attachments, List<String> images, Instant createdAt) {
    }

    public record ChatSummaryDto(Long id, BotMode mode, Long courseId, String courseName, String title,
                                 Difficulty difficulty, Instant updatedAt) {
    }

    public record ChatDto(Long id, BotMode mode, Long courseId, String courseName, String title,
                          Difficulty difficulty, Instant updatedAt, String topic, boolean temporary,
                          Long parentChatId, List<MessageDto> messages, List<BankFileDto> files) {
    }

    public record StatusDto(boolean enabled, boolean chatPaused, boolean practicePaused,
                            int chatRemainingToday, int practiceRemainingToday, long readyFiles) {
    }

    public record CreateChatRequest(Long courseId, Long parentChatId) {
    }

    public record RenameRequest(@NotBlank @Size(max = 120) String title) {
    }

    public record SendRequest(@Size(max = 4000) String body, @Size(max = 10) List<Long> fileIds,
                              @Size(max = 4) List<ImageInput> images) {
    }

    public record ImageInput(@Size(max = 12_000_000) String data) {
    }

    public record SetCourseRequest(@NotNull Long courseId) {
    }

    public record StartPracticeRequest(@NotNull Long courseId, @NotNull Difficulty difficulty,
                                       @Size(max = 300) String topic) {
    }

    public record AnswerResultDto(MessageDto userMessage, MessageDto grade, Long helpChatId, String question) {
    }

    public record MetaEvent(long chatId, String searchQuery) {
    }

    public record DeltaEvent(String text) {
    }

    public record DoneEvent(MessageDto message) {
    }

    public record ErrorEvent(String code, String message) {
    }
}
