import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { invalidateItemQueries } from "../../lib/invalidateItems";
import { toast } from "../../lib/toast";
import type { AcademicItem, AcademicItemRequest, SeriesScope } from "../../types";
import Modal from "../../components/Modal";
import ItemForm from "../../components/ItemForm";
import ScopeChoice from "../calendar/ScopeChoice";

export default function ItemModal({
  item,
  courseId,
  courses = [],
  onClose,
}: {
  item?: AcademicItem;
  courseId?: number;
  courses?: { id: number; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const closeRef = useRef<(() => void) | null>(null);
  const [scope, setScope] = useState<SeriesScope>("OCCURRENCE");

  const save = useMutation({
    mutationFn: ({ cid, req }: { cid: number; req: AcademicItemRequest }) =>
      item
        ? api.put<AcademicItem>(`/items/${item.id}?scope=${scope}`, req)
        : api.post<AcademicItem>(`/courses/${cid}/items`, req),
    onSuccess: () => {
      toast.success(item ? "Item updated" : "Item created");
      invalidateItemQueries(qc, item?.courseId ?? courseId);
      (closeRef.current ?? onClose)();
    },
  });

  const initial: AcademicItemRequest | undefined = item && {
    type: item.type,
    title: item.title,
    dueAt: item.dueAt,
    location: item.location ?? null,
    weight: item.weight ?? null,
    score: item.score ?? null,
    maxScore: item.maxScore ?? null,
    status: item.status,
    gradeCategoryId: item.gradeCategoryId ?? null,
  };

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      title={item ? "Edit item" : "New item"}
      size="md"
      variant="sheet"
    >
      {item?.seriesId && (
        <ScopeChoice label={null} scope={scope} onChange={setScope} />
      )}

      {item?.canvasSynced && (
        <p className="text-[12px] text-fg-3">
          Synced from Canvas — your next sync may overwrite changes made here.
        </p>
      )}

      <ItemForm
        bare
        initial={initial}
        submitLabel={item ? "Save changes" : "Add"}
        courseId={item?.courseId ?? courseId}
        courses={courses}
        onSubmit={(cid, req) => save.mutateAsync({ cid, req })}
        onCancel={() => (closeRef.current ?? onClose)()}
      />
    </Modal>
  );
}
