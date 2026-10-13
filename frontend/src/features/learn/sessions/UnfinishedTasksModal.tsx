import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Circle } from "lucide-react";
import Modal, { useModalClose } from "../../../components/Modal";
import { api } from "../../../lib/api";
import { toast } from "../../../lib/toast";

export default function UnfinishedTasksModal({ tasks, onClose }: { tasks: string[]; onClose: () => void }) {
  return (
    <Modal
      onClose={onClose}
      title="You have unfinished work"
      showClose={false}
      footer={<Buttons tasks={tasks} />}
    >
      <p className="text-[13px] text-fg-2">Add {tasks.length === 1 ? "it" : "them"} to your todo list?</p>
      <ul className="mt-3 space-y-1.5">
        {tasks.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-fg">
            <Circle size={14} className="mt-[3px] shrink-0 text-fg-3" />
            <span className="min-w-0 break-words">{t}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function Buttons({ tasks }: { tasks: string[] }) {
  const qc = useQueryClient();
  const close = useModalClose();
  const [saving, setSaving] = useState(false);

  async function addAll() {
    setSaving(true);
    const results = await Promise.allSettled(
      tasks.map((title) => api.post("/todos", { title, priority: "MEDIUM", checklist: [] })),
    );
    qc.invalidateQueries({ queryKey: ["todos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    const added = results.filter((r) => r.status === "fulfilled").length;
    if (added === tasks.length) {
      toast.success(added === 1 ? "Added 1 task to your todo list" : `Added ${added} tasks to your todo list`);
    } else if (added > 0) {
      toast.error(`Added ${added} of ${tasks.length} tasks. Some couldn't be saved.`);
    } else {
      toast.error("Couldn't add your tasks to the todo list");
    }
    close();
  }

  return (
    <>
      <button onClick={close} disabled={saving} className="btn btn-ghost">
        I'm okay
      </button>
      <button onClick={addAll} disabled={saving} className="btn btn-primary" autoFocus>
        {saving ? "Adding…" : "Do it"}
      </button>
    </>
  );
}
