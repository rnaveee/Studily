import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  Folder,
  FolderInput,
  FolderPlus,
  Layers,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import BackButton from "../../components/BackButton";
import SegmentedToggle from "../../components/SegmentedToggle";
import { useRequireAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import type { Course, FlashcardFolder, FlashcardSet } from "../../types";
import NewFlashcardSetModal from "./NewFlashcardSetModal";
import EditSetModal from "./EditSetModal";
import MoveToFolderModal from "./MoveToFolderModal";
import { VisibilityBadge } from "./visibility";
import { readJson, writeJson } from "./studyStorage";
import { SkeletonList } from "../../components/Skeleton";
import QueryError from "../../components/QueryError";

type Grouping = "folder" | "course";

const GROUPING_KEY = "studily.flashcards.grouping";

interface Section {
  key: string;
  title: string;
  color?: string;
  sets: FlashcardSet[];
  studyTo?: string;
  folder?: FlashcardFolder;
  muted?: boolean;
}

export default function FlashcardsPage() {
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const confirm = useConfirm();
  const [editingSet, setEditingSet] = useState<FlashcardSet | null>(null);
  const [movingSet, setMovingSet] = useState<FlashcardSet | null>(null);
  const [showCreate, setShowCreate] = useState<"blank" | "import" | null>(null);
  const [grouping, setGroupingState] = useState<Grouping>(() =>
    readJson<Grouping>(GROUPING_KEY) === "course" ? "course" : "folder",
  );
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const sets = useQuery({
    queryKey: ["flashcards", "sets"],
    queryFn: () => api.get<FlashcardSet[]>("/flashcard-sets"),
  });

  const courses = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const folders = useQuery({
    queryKey: ["flashcards", "folders"],
    queryFn: () => api.get<FlashcardFolder[]>("/flashcard-folders"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/flashcard-sets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flashcards"] }),
  });

  const createFolder = useMutation({
    mutationFn: (name: string) => api.post<FlashcardFolder>("/flashcard-folders", { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      setCreatingFolder(false);
      setFolderName("");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't create that folder"),
  });

  const renameFolder = useMutation({
    mutationFn: ({ folder, name }: { folder: FlashcardFolder; name: string }) =>
      api.put<FlashcardFolder>(`/flashcard-folders/${folder.id}`, { name, position: folder.position }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      setRenamingId(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't rename that folder"),
  });

  const removeFolder = useMutation({
    mutationFn: (id: number) => api.del(`/flashcard-folders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flashcards"] }),
    onError: () => toast.error("Couldn't delete that folder"),
  });

  function setGrouping(next: Grouping) {
    setGroupingState(next);
    writeJson(GROUPING_KEY, next);
  }

  const list = sets.data ?? [];
  const sections = buildSections(grouping, list, folders.data ?? [], courses.data ?? []);

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/learn" />
          <div>
            <h1 className="text-xl font-semibold text-fg">Flashcards</h1>
            <p className="mt-1 text-[13px] text-fg-3">Create sets and study them.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={() => requireAuth(() => setShowCreate("import"))}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-3 transition-colors hover:text-fg"
          >
            Use Quizlet?
            <ArrowRight size={13} />
          </button>
          <button onClick={() => requireAuth(() => setShowCreate("import"))} className="btn btn-ghost">
            <ClipboardPaste size={13} />
            Import
          </button>
          <button onClick={() => requireAuth(() => setShowCreate("blank"))} className="btn btn-primary">
            <Plus size={13} />
            Create
          </button>
        </div>
      </div>

      {list.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedToggle
            className="w-full sm:w-64"
            options={[
              { value: "folder", label: "Folders" },
              { value: "course", label: "By course" },
            ]}
            value={grouping}
            onChange={setGrouping}
          />
          {grouping === "folder" && !creatingFolder && (
            <button
              onClick={() => requireAuth(() => setCreatingFolder(true))}
              className="btn btn-soft"
            >
              <FolderPlus size={13} />
              New folder
            </button>
          )}
        </div>
      )}

      {grouping === "folder" && creatingFolder && (
        <form
          className="card flex flex-wrap items-center gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (folderName.trim() && !createFolder.isPending) createFolder.mutate(folderName.trim());
          }}
        >
          <Folder size={16} className="shrink-0 text-fg-3" />
          <input
            autoFocus
            className="input min-w-0 flex-1"
            placeholder="Folder name"
            maxLength={60}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
          />
          <button type="submit" disabled={!folderName.trim() || createFolder.isPending} className="btn btn-primary">
            Create folder
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingFolder(false);
              setFolderName("");
            }}
            className="btn btn-ghost"
          >
            Cancel
          </button>
        </form>
      )}

      {sets.isLoading ? (
        <SkeletonList rows={3} />
      ) : sets.isError && !sets.data ? (
        <QueryError onRetry={() => sets.refetch()} />
      ) : list.length > 0 ? (
        <div className="space-y-7">
          {sections.map((section) => (
            <SectionBlock
              key={section.key}
              section={section}
              renaming={section.folder != null && renamingId === section.folder.id}
              renameValue={renameValue}
              onRenameValue={setRenameValue}
              onStartRename={(f) => {
                setRenamingId(f.id);
                setRenameValue(f.name);
              }}
              onCancelRename={() => setRenamingId(null)}
              onSubmitRename={(f) => {
                if (renameValue.trim() && !renameFolder.isPending) {
                  renameFolder.mutate({ folder: f, name: renameValue.trim() });
                }
              }}
              onDeleteFolder={async (f) => {
                const ok = await confirm({
                  title: `Delete the ${f.name} folder?`,
                  message: "The sets inside are kept and move to Unfiled.",
                  confirmLabel: "Delete folder",
                  danger: true,
                });
                if (ok) removeFolder.mutate(f.id);
              }}
              courses={courses.data ?? []}
              onEdit={(s) => requireAuth(() => setEditingSet(s))}
              onMove={(s) => requireAuth(() => setMovingSet(s))}
              onDelete={async (s) => {
                const ok = await confirm({
                  title: `Delete ${s.title}?`,
                  message: `This permanently removes the set and its ${s.cards.length} ${s.cards.length === 1 ? "card" : "cards"}.`,
                  confirmLabel: "Delete set",
                  danger: true,
                });
                if (ok) remove.mutate(s.id);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <Layers className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
          <p className="text-sm text-fg-3">You have no flashcards. Create one!</p>
        </div>
      )}

      {editingSet && <EditSetModal set={editingSet} onClose={() => setEditingSet(null)} />}
      {movingSet && <MoveToFolderModal set={movingSet} onClose={() => setMovingSet(null)} />}

      {showCreate && (
        <NewFlashcardSetModal importing={showCreate === "import"} onClose={() => setShowCreate(null)} />
      )}
    </div>
  );
}

function buildSections(
  grouping: Grouping,
  sets: FlashcardSet[],
  folders: FlashcardFolder[],
  courses: Course[],
): Section[] {
  if (grouping === "folder") {
    const out: Section[] = folders.map((f) => ({
      key: `folder-${f.id}`,
      title: f.name,
      folder: f,
      sets: sets.filter((s) => s.folderId === f.id),
      studyTo: `/learn/flashcards/folders/${f.id}`,
    }));
    const known = new Set(folders.map((f) => f.id));
    const unfiled = sets.filter((s) => s.folderId == null || !known.has(s.folderId));
    if (unfiled.length > 0 || out.length === 0) {
      out.push({ key: "unfiled", title: "Unfiled", sets: unfiled, muted: true });
    }
    return out;
  }
  const out: Section[] = [];
  for (const c of courses) {
    const inCourse = sets.filter((s) => s.courseId === c.id);
    if (inCourse.length === 0) continue;
    out.push({
      key: `course-${c.id}`,
      title: c.code ? `${c.code}${c.name ? ` · ${c.name}` : ""}` : c.name,
      color: c.color ?? undefined,
      sets: inCourse,
      studyTo: `/learn/flashcards/courses/${c.id}`,
    });
  }
  const known = new Set(courses.map((c) => c.id));
  const loose = sets.filter((s) => s.courseId == null || !known.has(s.courseId));
  if (loose.length > 0) out.push({ key: "no-course", title: "No course", sets: loose, muted: true });
  return out;
}

function SectionBlock({
  section,
  renaming,
  renameValue,
  onRenameValue,
  onStartRename,
  onCancelRename,
  onSubmitRename,
  onDeleteFolder,
  courses,
  onEdit,
  onMove,
  onDelete,
}: {
  section: Section;
  renaming: boolean;
  renameValue: string;
  onRenameValue: (v: string) => void;
  onStartRename: (f: FlashcardFolder) => void;
  onCancelRename: () => void;
  onSubmitRename: (f: FlashcardFolder) => void;
  onDeleteFolder: (f: FlashcardFolder) => void;
  courses: Course[];
  onEdit: (s: FlashcardSet) => void;
  onMove: (s: FlashcardSet) => void;
  onDelete: (s: FlashcardSet) => void;
}) {
  const navigate = useNavigate();
  const totalCards = section.sets.reduce((n, s) => n + s.cards.length, 0);
  const folder = section.folder;
  const headerColor = section.color ?? "var(--fg-3)";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {renaming && folder ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitRename(folder);
            }}
          >
            <input
              autoFocus
              className="input min-w-0 flex-1"
              maxLength={60}
              value={renameValue}
              onChange={(e) => onRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancelRename();
              }}
            />
            <button
              type="submit"
              disabled={!renameValue.trim()}
              className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
              aria-label="Save folder name"
            >
              <Check size={15} />
            </button>
            <button
              type="button"
              onClick={onCancelRename}
              className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
              aria-label="Cancel rename"
            >
              <X size={15} />
            </button>
          </form>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Folder size={15} className="shrink-0" style={{ color: headerColor }} />
            <h2 className={`truncate text-[14px] font-semibold ${section.muted ? "text-fg-2" : "text-fg"}`}>
              {section.title}
            </h2>
            <span className="shrink-0 text-[12px] text-fg-3">
              {section.sets.length} {section.sets.length === 1 ? "set" : "sets"}
            </span>
          </div>
        )}
        {!renaming && (
          <div className="flex shrink-0 items-center gap-1">
            {section.studyTo && (
              <button
                disabled={totalCards === 0}
                onClick={() => navigate(section.studyTo!)}
                className="btn btn-soft"
              >
                <Play size={12} />
                Study all
              </button>
            )}
            {folder && (
              <>
                <button
                  onClick={() => onStartRename(folder)}
                  className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
                  aria-label="Rename folder"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onDeleteFolder(folder)}
                  className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                  aria-label="Delete folder"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {section.sets.length === 0 ? (
        <p className="card px-4 py-5 text-center text-[13px] text-fg-3">
          This folder is empty. Use the move button on a set to put it here.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {section.sets.map((s) => (
            <SetCard
              key={s.id}
              set={s}
              color={courses.find((c) => c.id === s.courseId)?.color ?? "var(--accent)"}
              onEdit={onEdit}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SetCard({
  set: s,
  color,
  onEdit,
  onMove,
  onDelete,
}: {
  set: FlashcardSet;
  color: string;
  onEdit: (s: FlashcardSet) => void;
  onMove: (s: FlashcardSet) => void;
  onDelete: (s: FlashcardSet) => void;
}) {
  return (
    <li
      className="card flex items-center justify-between gap-3 p-4 animate-fade"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <Link to={`/learn/flashcards/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          <Layers size={16} style={{ color }} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[14px] font-medium text-fg">
            <span className="truncate">{s.title}</span>
            {s.dueCount > 0 && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: `color-mix(in srgb, ${color} 14%, transparent)`,
                  color,
                }}
              >
                {s.dueCount} due
              </span>
            )}
            <VisibilityBadge visibility={s.visibility} />
          </div>
          {s.description && <div className="text-[12px] text-fg-3 truncate">{s.description}</div>}
        </div>
      </Link>
      <div className="flex shrink-0 items-center">
        <button
          onClick={() => onMove(s)}
          className="shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          aria-label="Move to folder"
        >
          <FolderInput size={15} />
        </button>
        <button
          onClick={() => onEdit(s)}
          className="shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          aria-label="Edit set"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => onDelete(s)}
          className="shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
          aria-label="Delete set"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}
