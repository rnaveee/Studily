import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Folder, FolderPlus } from "lucide-react";
import Modal from "../../components/Modal";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import type { FlashcardFolder, FlashcardSet } from "../../types";

export default function MoveToFolderModal({ set, onClose }: { set: FlashcardSet; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const folders = useQuery({
    queryKey: ["flashcards", "folders"],
    queryFn: () => api.get<FlashcardFolder[]>("/flashcard-folders"),
  });

  const move = useMutation({
    mutationFn: (folderId: number | null) =>
      api.put<FlashcardSet>(`/flashcard-sets/${set.id}/folder`, { folderId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      onClose();
    },
    onError: () => toast.error("Couldn't move that set"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const folder = await api.post<FlashcardFolder>("/flashcard-folders", { name: name.trim() });
      await api.put<FlashcardSet>(`/flashcard-sets/${set.id}/folder`, { folderId: folder.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't create that folder"),
  });

  const busy = move.isPending || create.isPending;
  const rowClass =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-fg transition-colors hover:bg-surface-hi disabled:opacity-50";

  return (
    <Modal onClose={onClose} title="Move to folder" size="sm">
      <p className="mb-3 truncate text-[12px] text-fg-3">{set.title}</p>
      <div className="max-h-64 space-y-0.5 overflow-y-auto">
        <button disabled={busy} onClick={() => move.mutate(null)} className={rowClass}>
          <Folder size={14} className="shrink-0 text-fg-3" />
          <span className="flex-1">No folder</span>
          {set.folderId == null && <Check size={14} className="text-accent" />}
        </button>
        {(folders.data ?? []).map((f) => (
          <button key={f.id} disabled={busy} onClick={() => move.mutate(f.id)} className={rowClass}>
            <Folder size={14} className="shrink-0 text-fg-3" />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            {set.folderId === f.id && <Check size={14} className="text-accent" />}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2 pt-3"
        style={{ borderTop: "1px solid var(--line)" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !busy) create.mutate();
        }}
      >
        <input
          className="input min-w-0 flex-1"
          placeholder="New folder name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={!name.trim() || busy} className="btn btn-soft shrink-0">
          <FolderPlus size={13} />
          Create
        </button>
      </form>
    </Modal>
  );
}
