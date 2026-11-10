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
                              String quote, boolean previewable) {
    }

    public record ProblemDto(int number, String statement, boolean fromClass, List<CitationDto> sources) {
    }

    public record GradeDto(Verdict verdict, String feedback, List<String> steps, String solution) {
    }

    public record ProblemSecret(String solution, String finalAnswer) {
    }

    public record BotMeta(List<CitationDto> citations, ProblemDto problem, ProblemSecret secret, GradeDto grade) {

        public static BotMeta citations(List<CitationDto> citations) {
            return new BotMeta(citations, null, null, null);
        }

        public static BotMeta problem(ProblemDto problem, ProblemSecret secret) {
            return new BotMeta(List.of(), problem, secret, null);
        }

        public static BotMeta grade(GradeDto grade) {
            return new BotMeta(List.of(), null, null, grade);
        }
    }

    public record MessageDto(Long id, BotRole role, BotMessageKind kind, String content,
                             List<CitationDto> citations, ProblemDto problem, GradeDto grade, Instant createdAt) {
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

    public record SendRequest(@NotBlank @Size(max = 4000) String body) {
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
