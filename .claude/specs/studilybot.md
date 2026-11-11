# StudilyBot spec (Nov 2026)

StudilyBot is one hub, `/study/studilybot`, with three modes: **Chat** ("Best for asking about coursework and answers"), **Recall** ("Best for practicing concepts like biology") and **Practice** ("Best for practicing calculations like physics or math"). All three share a per-course **file bank**, which feeds one RAG pipeline.

Approved plan: `~/.claude/plans/i-want-a-studilybot-shimmying-valiant.md`. Branch: `studilybot`.

## Rules for every agent (read first)
1. **No code comments or Javadoc**, anywhere. The whole project is comment-free.
2. Only edit the files your task **owns**. If you need a change in a file you don't own, stop and report it in your final message. Never work around the ownership by duplicating code.
3. Never change the **frozen contract files** listed below. Build against them exactly.
4. Follow the existing conventions:
   - Spring Boot 4.1 and Jackson **3** (`tools.jackson.databind.ObjectMapper`; the annotations stay `com.fasterxml.jackson.annotation.*`).
   - Lombok `@Getter`/`@Setter` entities.
   - `CurrentUser` (`currentUser.id()`, `currentUser.entity()`).
   - `NotFoundException` / `BadRequestException` / `TooManyRequestsException` from `com.rnave.studily.config`.
   - `SlidingWindowRateLimiter` for per-user rate limits.
   - Tests use JUnit 5 + Mockito + AssertJ. Copy the style of `src/test/java/com/rnave/studily/feynman/*Test.java`.
5. **Ownership checks**: every lookup by id goes through `findByIdAndUserId`-style queries. Another user's id must produce a **404**, never a 403.
6. **No new dependencies.** The AWS S3 SDK is already in `pom.xml`.
7. Every Claude or Voyage call records usage through `com.rnave.studily.parse.AiUsageRecorder.record(userId, feature, model, in, out, succeeded)`. Calls that fail or are refused record `succeeded=false`.
8. Models come from properties. Never hard-code them. The Claude client uses `app.parse.api-key`, exactly as `ClaudeFeynmanTutor` does.
9. Do **not** write `FeynmanScoringTest.overallUsesLatestAssessmentPerConcept` or `StudyDocumentReaderTest.readTextAddsUnitHeadersAndSkipsBlankPages`. Ryan writes those himself.
10. Build the backend with:
    `podman run --rm --network=host -v "$PWD":/app:z -v "$HOME/.m2":/root/.m2:z -w /app -e JWT_SECRET=ci-test-secret-not-for-production-use-64chars-minimum-xxxxxxxxxx docker.io/library/maven:3.9-eclipse-temurin-21 mvn -B -q package`
    Build the frontend with `cd frontend && npm run build`. Both must pass before you finish.
    - **Known failures you can ignore**: `LmsFeedImportTest.moodle_stagesCoursesFromCategoriesAndSkipsOpensEvents` and `LmsFeedImportTest.sourceUrlIsEnoughEvenWhenTheFeedHasNoCoursework`. They depend on the current date and fail on main too. Every other test must pass.
    - **In a git worktree**, `frontend/node_modules` is missing. Link it before building: `ln -s /home/rnaveee/IdeaProjects/Studily/frontend/node_modules frontend/node_modules`. Don't commit the symlink; it's already gitignored, but check with `git status`.
    - Local Postgres (`localhost:5432`, db `studily`, user/pass `postgres`) is shared by everyone. Never drop or reset it.
11. Commit your work in your worktree (`git add -A && git commit -m "<what and why>"`). Commit messages carry **no** Claude or co-author attribution.

## Reference code to port
`~/.cache/studily-rag-handbook/studily-rag/src/main/java/com/rnave/studily/{library,rag}` and its tests under `.../src/test/java/com/rnave/studily/{library,rag}`. Port them; don't reinvent them. When porting:
- Rename tables: `course_files` becomes `bank_files`, `document_chunks` becomes `bank_chunks`.
- Folders and URL import are removed.
- `billing` / credits / tiers are removed. Use `BotLimits` and `AiUsageRecorder` instead.
- `DocumentKind` becomes `BankFormat`, and the category enum is `BankFileKind`.
- The `pgvector` code becomes the `real[]` and exact-Java-cosine code described in Wave 1B.

## Frozen contract files (written in Wave 0; do not change)
- `src/main/resources/db/migration/V77__studilybot.sql`
- `filebank/`: `BankFile`, `BankFileRepository`, `BankFileDto`, `BankFileKind`, `BankFileStatus`, `BankFormat`, `FileStorage`
- `rag/Scope`
- `bot/`: `BotChat`, `BotMessage`, `BotChatRepository`, `BotMessageRepository`, `BotMode`, `BotRole`, `BotMessageKind`, `Difficulty`, `BotDtos`, `BotMessages` (meta JSON ↔ DTO), `BotLimits`
- `parse/AiFeature` (+ `BOT_CHAT`, `BOT_PRACTICE`, `EMBEDDINGS`), `parse/AiUsageRecorder`, `parse/ParsePricing` (+ the Voyage rates)
- `config/EmailVerificationFilter`: `/api/bot`, `/api/bank` and `/api/feynman` are locked to verified emails, except `/api/bot/status`, `/api/bank/status` and `/api/feynman/enabled`
- `application.properties`: the `app.storage.*`, `app.bank.*`, `app.rag.*` and `app.bot.*` blocks
- `frontend/src/features/studilybot/api.ts`: every TypeScript type, `bankApi`, `botApi` and `streamAnswer` (the SSE client)

## Wire protocol
### File bank (`/api/bank`, Wave 1A)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/bank/status` | – | `BankStatusDto(enabled, usedBytes, quotaBytes, fileCount, maxFiles, maxFileBytes, maxFilesPerRequest)` |
| GET | `/api/bank/courses/{courseId}/files` | – | `List<BankFileDto>`, newest first |
| POST | `/api/bank/courses/{courseId}/files` | multipart `files` (1..10), optional `kind` | `List<BankFileDto>` |
| PATCH | `/api/bank/files/{id}` | `{kind}` | `BankFileDto` |
| POST | `/api/bank/files/{id}/retry` | – | `BankFileDto`: re-queues a FAILED file (resets attempts) |
| DELETE | `/api/bank/files/{id}` | – | 204 |
| GET | `/api/bank/files/{id}/pages/{page}/preview` | – | `image/png` of that PDF page or PPTX slide, with `Cache-Control: private, max-age=86400`. 404 for DOCX, TEXT and MARKDOWN, or a page out of range |

### Bot (`/api/bot`, Wave 2D/2E)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/bot/status` | – | `StatusDto` |
| GET | `/api/bot/chats?mode=CHAT\|PRACTICE` | – | `List<ChatSummaryDto>`, non-temporary only, newest `updatedAt` first |
| POST | `/api/bot/chats` | `CreateChatRequest{courseId?, parentChatId?}` | `ChatDto` (mode CHAT) |
| GET | `/api/bot/chats/{id}` | – | `ChatDto`. Practice chats include PROBLEM and GRADE messages; the `secret` in meta is **never** sent |
| PATCH | `/api/bot/chats/{id}` | `RenameRequest` | `ChatDto` |
| DELETE | `/api/bot/chats/{id}` | – | 204 |
| POST | `/api/bot/chats/{id}/files` | multipart `files` | `List<BankFileDto>` |
| POST | `/api/bot/chats/{id}/messages` | `SendRequest{body}` | `text/event-stream` |
| POST | `/api/bot/practice` | `StartPracticeRequest{courseId, difficulty, topic?}` | `ChatDto` holding the first PROBLEM |
| POST | `/api/bot/practice/{id}/next` | – | `MessageDto` (PROBLEM) |
| POST | `/api/bot/practice/{id}/reveal` | – | `MessageDto` (GRADE, with `solution` set) |
| POST | `/api/bot/practice/{id}/answer` | multipart `text?`, `photo?` | `AnswerResultDto` |

Rules for `/api/bot/chats/{id}/files`: if the chat has a course, files go to that course's bank. Otherwise they go to the chat's own bank (`Scope.chat`). Help chats (`temporary`) can't take uploads; they return 400.

SSE events are sent in this order: `meta` `{chatId, searchQuery}`, then `delta` `{text}` repeatedly, then `done` `{message: MessageDto}`. When something goes wrong, the stream sends `error` `{code, message}` instead.

When a limit is hit, the endpoint returns a plain 429 JSON response **before** the stream opens.

### Recall (`/api/feynman`, Wave 2F; this extends the existing API)
- `POST /api/feynman/sessions` (multipart) adds two parameters:
  - `courseId` (required for new sessions)
  - `bankFileIds` (repeatable)
  Uploaded `files` are saved into the course bank, and their text is read for the plan. Selected bank files are read from storage. At most 3 materials in total, as today.
- `SessionSummaryDto` and `SessionDto` gain `courseId` and `courseName`. `DocumentDto` gains `bankFileId`. `GET /api/feynman/sessions?courseId=` filters by course.

## Wave 1A: file bank backend (package `com.rnave.studily.filebank`)
**Owns**: everything new in `filebank/` except the frozen files, and `src/test/java/com/rnave/studily/filebank/**`.

What to build:
- `S3FileStorage` (port it).
- `LocalFileStorage`: writes under `app.storage.local-dir`, guards against path traversal, and keys are `[A-Za-z0-9/_.-]` only.
- `FileStorageConfig`: one `@Bean FileStorage`. It picks S3 when the endpoint is set, local when `local-dir` is set, and otherwise a disabled implementation whose `configured()` returns false.
- `UploadInspector`: port it so it returns `BankFormat`. Keep the magic-byte checks and reject OLE2, executables and macro files.
- `StorageJanitor`: port it, reading `storage_trash`.
- `BankDtos`: `BankStatusDto` and `KindRequest(@NotNull BankFileKind kind)`.
- `BankController` and `BankService`, built to the table above.

`BankService` public methods, which other agents call (keep these signatures exact):
```java
public BankStatusDto status();
public boolean enabled();
public List<BankFileDto> courseFiles(Long courseId);
public List<BankFileDto> chatFiles(Long chatId);
public List<BankFile> upload(Scope scope, List<MultipartFile> files, BankFileKind kindOrNull);
public BankFileDto setKind(Long id, BankFileKind kind);
public BankFileDto retry(Long id);
public void delete(Long id);
public byte[] previewPng(Long id, int page);
public byte[] content(BankFile file);
public List<BankFile> ownedFiles(Collection<Long> ids);
static BankFileKind guessKind(String fileName);
```

How `BankService` behaves:
- `upload` checks that the course belongs to the current user (`CourseRepository`), unless the scope is a chat; the caller has already checked chat ownership.
- It enforces `app.bank.*`: bytes per file, files per request, files per user and the quota in bytes.
- It inspects each file, then computes sha256. If the same file already exists in the same scope, it returns the existing row instead of a duplicate.
- Storage keys look like `bank/{userId}/{uuid}`.
- It puts the object in storage before saving the row. If saving fails, it deletes the object.
- The `kind` defaults to `guessKind`:
  - names containing midterm, final, exam, practice, quiz or sample → PRACTICE_EXAM
  - assignment, hw, homework, problem set, pset, lab or tutorial → ASSIGNMENT
  - lecture, slides, week, chapter, ch or unit → LECTURE
  - notes → NOTES
  - otherwise OTHER
- `ownedFiles` throws `NotFoundException` if any id is missing or belongs to someone else.
- `previewPng` renders one page at 1280px on its long side:
  - PDFs with PDFBox `PDFRenderer` at a bounded DPI, with the `MemoryUsageSetting` limits used in `flashcard/generate/StudyDocumentReader`
  - PPTX with POI `XSLFSlide.draw`, with the same `ZipSecureFile` limits and the same timeout and executor pattern as StudyDocumentReader. Don't edit StudyDocumentReader; copy the pattern.
- `enabled()` is true when `storage.configured()` is true.
- Rate limit: 20 uploads per user per minute.

Tests to write: `BankServiceTest` (quota, dedupe, ownership 404, scope routing, `guessKind` table), `UploadInspectorTest` (port), `LocalFileStorageTest` (traversal is rejected).

## Wave 1B: RAG port (package `com.rnave.studily.rag`)
**Owns**: everything new in `rag/` except `Scope`, and `src/test/java/com/rnave/studily/rag/**`.

Port these: `TextCleaner`, `TextExtractor` (taking `BankFormat`, and using `app.bank.max-pages`), `Chunker`, `VoyageClient`, `Rrf`, `ClaudeConnection` (key `app.parse.api-key`), `QueryRewriter` (model `app.rag.rewrite-model`), `IngestionWorker`, `ChunkStore` and `Retriever`. Replace `RagProperties` with `@Value` fields or a small properties record for the keys in `app.rag.*`.

Public API used by Wave 2 (keep it exact):
```java
public record RetrievedChunk(long chunkId, long fileId, String fileName, BankFileKind fileKind, boolean previewable,
                             Integer pageFrom, Integer pageTo, String heading, String content, Double relevance) {
    public String location();
}
public class Retriever {
    public boolean enabled();
    public Retrieval retrieve(Scope scope, String query, int topK, AiFeature feature);
    public List<RetrievedChunk> sample(Scope scope, int count, Set<BankFileKind> preferKinds);
    public long readyFiles(Scope scope);
    public record Retrieval(List<RetrievedChunk> chunks) {}
}
public class QueryRewriter {
    public record HistoryTurn(boolean user, String text) {}
    public record Rewrite(String query, String model, long inputTokens, long outputTokens) {}
    public Rewrite rewrite(List<HistoryTurn> history, String question);
}
public class ClaudeConnection { public boolean configured(); public AnthropicClient client(); }
```

How the pieces behave:
- **Embeddings**: `bank_chunks.embedding` is `REAL[]`.
  - Write with `connection.createArrayOf("float4", Float[])`.
  - Read with `(Float[]) rs.getArray("embedding").getArray()`.
- **Semantic search** loads `id, embedding` for the scope:
  - course scope: `user_id = ? AND course_id = ?`
  - chat scope: `user_id = ? AND chat_id = ?`
  It L2-normalises the query, computes the dot product with each row in Java, keeps the top `limit` with a bounded min-heap, then fetches the full rows for those ids. Log the elapsed time at debug level.
- **Keyword search**: `content_tsv @@ websearch_to_tsquery('english', ?)` ranked by `ts_rank_cd`, with the same scope filter.
- **retrieve** works the same as the reference (hybrid search, then RRF, then rerank when Voyage is configured), minus the billing code:
  - Voyage embed and rerank tokens are recorded as usage rows under the **caller's** `feature`.
  - Drop chunks below `app.rag.min-relevance` after reranking.
- **sample** takes a random spread across READY files, round-robin by file. Files whose kind is in `preferKinds` come first when any exist. It makes no API calls.
- **IngestionWorker**:
  - Claim with `FOR UPDATE SKIP LOCKED` on `bank_files` (QUEUED, or PROCESSING with a stale lock). Use the reference's attempts, backoff and `MAX_ATTEMPTS`.
  - Process each file: download through `FileStorage`, extract, chunk, embed, then `ChunkStore.completeFile` in one transaction. `completeFile` deletes the file's old chunks, inserts the new ones with `user_id`, `course_id` and `chat_id` copied from the file, and sets the file READY with `chunk_count`, `page_count`, `embedding_model` and `indexed_at`.
  - Record the embed tokens as an `EMBEDDINGS` usage row for the file's user.
  - If this month's `EMBEDDINGS` spend is at or over `app.rag.embeddings-monthly-budget-usd`, push `next_attempt_at` back by an hour, set `status_detail` to "Waiting for indexing capacity", and leave the file QUEUED.
  - If the scope would go over `app.bank.max-chunks-per-scope`, mark the file FAILED with "This file bank is full".
  - When storage or Voyage isn't configured, do nothing.
- Tests: port the reference tests for Chunker, TextCleaner, TextExtractor, Rrf, VoyageClient, Retriever and IngestionWorker, and add `ChunkStoreTest` covering top-k, ordering and normalisation with a mocked `JdbcTemplate`, or by testing the pure scoring helper.

## Wave 1C: frontend shell, /study rename, course File bank UI
**Owns**:
- `frontend/src/App.tsx`, `frontend/src/routes.json`
- `components/Layout.tsx`, `components/MobileFooter.tsx`
- every `/learn` link (found with `grep -rn "/learn" frontend/src`)
- `features/learn/LearnPage.tsx`, `features/courses/CourseDetailPage.tsx`
- new: `features/studilybot/{BotMascot,StudilyBotHome,BotLayout,ChatThread,Composer,CourseSelect,CitationChip,ReportCard,FileBankPanel,useBotStatus}.tsx`, plus the route stubs `ChatMode.tsx`, `RecallMode.tsx` and `PracticeMode.tsx`. The stubs only render a heading; Wave 2G fills them in.

The `/learn` → `/study` rename:
- Rename every route. The `features/learn/` folder stays where it is.
- Add `<Route path="/learn/*" element={<LearnRedirect/>}>`, which replaces the `/learn` prefix with `/study` and keeps the search and hash.
- Update `routes.json`. The build fails if a route is missing, and every new route must be listed.
- Keep the `data-tour="nav-study"` selectors working.
- Delete `features/learn/AiChatPage.tsx`. `/study/ai` redirects to `/study/studilybot/chat`.

New routes. All are inside `VerifyGate`, except that the home page shows the mode cards to everyone:
- `/study/studilybot`
- `/study/studilybot/chat` and `/study/studilybot/chat/:id`
- `/study/studilybot/recall` and `/study/studilybot/recall/:id`
- `/study/studilybot/practice` and `/study/studilybot/practice/:id`

`BotMascot`:
- A friendly round robot drawn in inline SVG, using the theme tokens (`var(--accent)` and friends).
- CSS keyframes for idle bobbing, blinking eyes and an antenna pulse.
- Accepts `size` and `mood` (`idle`, `thinking` (faster pulse) or `happy`).
- Under `prefers-reduced-motion: reduce`, nothing animates.

The `/study` page (`LearnPage`) gets a prominent **StudilyBot** button or tile, with the mascot, that links to `/study/studilybot`.

`StudilyBotHome` shows three mode cards with the taglines quoted at the top of this spec, plus the mascot.

`BotLayout`, given a `mode`:
- Desktop: a sidebar listing the chats with New chat, rename and delete. The data source is a prop: `botApi.chats(mode)` for Chat and Practice, and `/feynman/sessions` for Recall.
- Mobile: the sidebar becomes a slide-in drawer.
- The main area is a slot.
- It looks like ChatGPT or Claude, but uses Studily's existing glass/neu design (see `index.css` and existing pages).

Shared components:
- `ChatThread`: message bubbles with markdown-lite (paragraphs, bold, lists, inline code), a typing indicator and auto-scroll.
- `Composer`:
  - a textarea with Enter to send and Shift+Enter for a new line
  - a paperclip button plus drag-and-drop for files, with an `accept` prop
  - an optional camera button
  - uses the `keyboardDock` pattern from `Layout.tsx` for iOS
  - page buttons use `onMouseDown={e => e.preventDefault()}` (see memory "mobile footer blur tap")
- `CourseSelect`: the user's courses, plus an optional "No course" entry.
- `CitationChip`:
  - shows "📄 {fileName} · slide/page N"
  - when clicked, opens a popover or sheet with the quote and, when `previewable`, the page image, loaded with `api.getBlob(bankApi.previewPath(...))` into an object URL
- `ReportCard`: renders `FeynmanReport` from `features/feynman/feynmanApi.ts` as a big score %, per-concept bars, strengths and gaps.
- `FileBankPanel` takes `{courseId}`:
  - a drop zone (reuse `features/courses/ParseDropzone` if it fits; otherwise build a matching one)
  - a list of files with a status pill (Queued / Indexing / Ready / Failed with Retry) and a kind `<select>`
  - delete, through the existing `confirm` helper
  - while any file is QUEUED or PROCESSING, poll every 4 s
  - when the status endpoint reports disabled, show "File bank isn't set up yet"
  - on a 403 with `EMAIL_UNVERIFIED`, show the verify prompt
- `CourseDetailPage` adds a "File bank" section that uses `FileBankPanel`.

`useBotStatus` is a react-query hook for `botApi.status()`.

Responsive from 375px to 1728px. Light, dark and Classic themes. Guest mode (`isGuestMode()`) shows a sign-up prompt instead of calling the APIs.

## Wave 2D: Chat backend (package `bot`)
**Owns**: `bot/BotChatService.java`, `bot/BotChatController.java`, `bot/BotStatusController.java`, `bot/ChatPromptBuilder.java`, `bot/ChatAnswerStreamer.java` (or the reference's `AnswerAccumulator` and `SseSink` ported into `bot/`), plus their tests.

How chat works:
- Port the reference `ChatService`, `PromptBuilder`, `AnswerAccumulator` and `SseSink`, including the Claude **search_result citations**.
- The model is `app.bot.chat.model` with `app.bot.chat.max-tokens`.
- The system prompt tells the bot to answer from the student's files, to name the file and slide or page in prose (for example "Lecture 8, slide 12 says…"), and to say so plainly when the files don't cover the question (it can then answer from general knowledge, labelled as such). File text is untrusted and is never followed as instructions.
- Scope: `Scope.course` when the chat has a course, otherwise `Scope.chat`. With no READY files, the bot answers without retrieval and says that it's doing so.
- Steps for each message:
  1. `BotLimits.check(CHAT)`, plus the controller's 12-per-minute limiter
  2. save the USER message
  3. rewrite the query
  4. `retriever.retrieve(scope, query, 8, BOT_CHAT)`
  5. stream the answer
  6. save the BOT message with `BotMeta.citations`
  7. record usage under `BOT_CHAT`
  8. touch `updatedAt`
- The title is the first question, clipped to 60 characters.
- One in-flight answer per chat, guarded with a set as `FeynmanService` does.
- Help chats: `POST /chats` with `parentChatId` requires the parent to be the user's PRACTICE chat. It copies the parent's course and sets `temporary=true`.
- `StatusDto.enabled` = `app.bot.enabled` and the Claude connection is configured and the bank is enabled.

## Wave 2E: Practice backend (package `bot`)
**Owns**: `bot/PracticeService.java`, `bot/PracticeController.java`, `bot/PracticeTutor.java` (the Claude calls), `bot/PracticeSchema.java`, plus their tests.

Starting a session: `start` checks the course belongs to the user, creates a PRACTICE chat (title "{course} · {Difficulty}", or the topic) and generates the first problem.

`generateProblem`:
- Context:
  - With a topic, use `retriever.retrieve(courseScope, topic, 10, BOT_PRACTICE)`.
  - Without one, use `retriever.sample(scope, 10, preferKinds)`. For CLASS, `preferKinds` = {PRACTICE_EXAM, ASSIGNMENT}; otherwise {LECTURE, NOTES}.
- Model `app.bot.practice.problem-model`, with a structured output schema `{statement, solution, finalAnswer, fromClass, sourceIndexes[]}`. Build the schema by hand, as `FeynmanSchema` does; see the SDK gotcha about `outputConfig` overwriting itself in the course-parser notes.
- Difficulty guidance:
  - EASY: one step
  - MEDIUM: 2–3 steps
  - HARD: multi-concept
  - CLASS: reproduce or closely adapt a real problem from the excerpts, set `fromClass=true` and cite it
- Pass in the previous problem statements from this chat so it doesn't repeat itself.
- Save a PROBLEM message. `content` = the statement, and the meta is `BotMeta.problem(ProblemDto(number, statement, fromClass, sources), ProblemSecret(solution, finalAnswer))`.
- If there are no READY files, return 400 with "Add some course files first, then I can write problems from them."

`answer` (multipart `text` and/or `photo`):
- Photo checks: jpeg, png or webp only, sniffed from the bytes; at most `app.bot.practice.max-photo-bytes`. The photo is **never stored or logged**. The USER message content is the text, or "📷 Photo of my work" when only a photo was sent.
- Grading model: `app.bot.practice.vision-model` when there's a photo, otherwise `grade-model`. The structured output is `{intent: ANSWER|QUESTION, verdict, feedback, steps[]}`, graded against the latest problem's `ProblemSecret`.
- Intent QUESTION: don't save a GRADE. Find or create the temporary help chat (`findFirstByParentChatIdAndUserIdOrderByIdDesc`, otherwise a new one) and return `helpChatId` plus `question` = the text.
- Intent ANSWER: save a GRADE message whose `GradeDto.solution` is set only when the verdict is CORRECT.
- `reveal` saves a GRADE message with verdict INCORRECT, the feedback "Here's the worked solution.", and the solution set.
- Rate limit: 12 per user per minute. Call `BotLimits.check(PRACTICE)` before every model call. Record usage under `BOT_PRACTICE`.

## Wave 2F: Recall integration (package `feynman`)
**Owns**: `feynman/**` and `src/test/java/com/rnave/studily/feynman/**`. Don't touch the two tests Ryan owes; see rule 9.

Changes:
- Add `courseId` to `FeynmanSession` (a `Long` column) and `bankFileId` to `FeynmanDocument`.
- `start(courseId, title, focus, files, bankFileIds)`:
  - check the course belongs to the user
  - save uploads through `bankService.upload(Scope.course(...), files, null)`
  - read the text of every material with `StudyDocumentReader.readText(name, bytes)`. Uploads use their bytes; bank files use `bankService.content(file)`.
  - link each `FeynmanDocument.bankFileId`
  - keep the 3-material limit and `MAX_MATERIAL_CHARS`
- `addDocuments` saves to the bank in the same way.
- Extend the DTOs as described in the wire protocol, and add `list(courseId)` filtering.
- Check the tutor prompt in `ClaudeFeynmanTutor`. After `didNotKnow`, the bot must explain the concept plainly and then ask the student to explain it back in their own words before moving on. Tighten the prompt only if it doesn't already do this.
- Update the existing Feynman tests for the new signatures.

## Wave 2G: frontend modes
**Owns**: `features/studilybot/ChatMode.tsx`, `RecallMode.tsx`, `PracticeMode.tsx`, `HelpChatPanel.tsx`, `ProblemCard.tsx`, `features/feynman/feynmanApi.ts` (add the new fields), and `features/feynman/FeynmanWhatsNew.tsx` (rename the copy to StudilyBot). It also owns mounting `FeynmanWhatsNew` in `components/Layout.tsx`. Use the shared Wave 1C components; don't fork them.

**ChatMode**:
- With no `:id`, show an empty state with `CourseSelect` (including "No course") and a composer. The first send runs `createChat`, navigates to `/study/studilybot/chat/:id`, then streams.
- Answers stream through `streamAnswer`, with the mascot `thinking` while waiting.
- Show `CitationChip`s under BOT messages.
- Dropping files calls `botApi.uploadToChat`. The header shows the attached course, or "Files in this chat" with a list of `chat.files`.

**RecallMode**:
- The new-session form has `CourseSelect` (a course is required), a multi-select of that course's READY or any bank files (from `bankApi.courseFiles`), an upload, and a focus field. These post to `/feynman/sessions`.
- The session view reuses the logic from `FeynmanChatPage` (send, finish), rendered with `ChatThread`. REPORT messages render as `ReportCard`.

**PracticeMode**:
- The new-session form has `CourseSelect` (required), a four-way difficulty segmented control (Easy | Medium | Hard | Class-accurate) and an optional topic.
- The session view shows `ProblemCard`: the statement, a "From your class" badge plus source chips when `fromClass` is set, and Next problem and Show solution buttons.
- The answer composer has a text box and a camera or upload button (`accept="image/*" capture="environment"`). Photos are downscaled in a canvas to ≤1600px JPEG before sending and are never kept after sending.
- GRADE messages render a verdict pill, feedback and steps.
- An **Ask StudilyBot** button opens `HelpChatPanel`, which is a side panel on wide screens and a bottom sheet on mobile, running the ChatMode thread for the help chat. It's created with `botApi.createChat(courseId, practiceChatId)`.
- When `AnswerResult.helpChatId` is set, open the panel and auto-send `question` into it.

Throughout: handle 429 with a friendly banner, show a disabled state from `useBotStatus`, and handle guest mode.

## Wave 2 addendum (after the Wave 1 reviews; base commit 7dd0850)
- **Branching**: your worktree may start on the wrong commit. First run `git checkout -b <your-branch> 7dd0850`.
- **Chat and Practice backends (2D and 2E)**:
  - Call `BotLimits.check(mode)` **before** `QueryRewriter.rewrite`, `Retriever.retrieve` and every Claude call.
  - Pass `AiFeature.BOT_CHAT` or `BOT_PRACTICE` to `retrieve`.
  - Record `Rewrite.inputTokens`/`outputTokens` against `Rewrite.model` through `AiUsageRecorder`. Do this only when `model != null`, because the rewriter doesn't record anything itself.
  - Clip the question to 2,000 characters before it goes to the rewriter or to retrieval.
  - `ChunkStore` can throw `TooManyRequestsException` when it's busy. Over SSE, send it as `error {code:"BUSY"}`.
- **Chat uploads (2D)**: `POST /api/bot/chats/{id}/files` must load the chat with `findByIdAndUserId`, which gives a 404 for anyone else's chat, **before** calling `bankService.upload`. `BankService` trusts the chat scope.
- **`Retriever.retrieve`**: if Voyage embedding fails, it now falls back to keyword-only search, and relevance comes back null. Treat a null relevance as normal.
- **Frontend: shared `ChatConversation`** (`features/studilybot/ChatConversation.tsx`):
  - Wave 2G1 **owns** it. A stub with the final props exists already: `{chatId, compact?, initialQuestion?, onInitialQuestionSent?}`.
  - It renders one existing chat end to end: it loads it with `botApi.chat`, shows the thread with citations, streams through `streamAnswer`, handles uploads through `botApi.uploadToChat` (hidden when `temporary`), and auto-sends `initialQuestion` once.
  - ChatMode's `:id` view and Practice's `HelpChatPanel` both render it. 2G2 imports it and never edits it.
- **BotLayout**: its sidebar query key is `["bot","chats",mode]`. Invalidate `["bot","chats"]` after you create, rename, delete or send.
- The Wave 2G split, owners and ownership:
  - **2G1**: `ChatMode.tsx`, `ChatConversation.tsx`, `RecallMode.tsx`, `features/feynman/*` (port the `FeynmanChatPage` and `FeynmanListPage` logic into RecallMode, then delete those two pages and fix `FeynmanWhatsNew` to link to `/study/studilybot/recall`), and mounting `FeynmanWhatsNew` in `components/Layout.tsx`.
  - **2G2**: `PracticeMode.tsx`, `ProblemCard.tsx`, `HelpChatPanel.tsx`, `photo.ts` (canvas downscale to a JPEG of at most 1600px).
