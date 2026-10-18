import type { ReactNode } from "react";
import Modal from "../../../components/Modal";
import AlarmSoundsEditor from "./AlarmSoundsEditor";
import type { StudySessionMode } from "../../../types";

export default function SessionSettingsModal({
  mode,
  tasks,
  onClose,
}: {
  mode: StudySessionMode;
  tasks: ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} title="Session settings" variant="sheet" size="md">
      <section>{tasks}</section>
      <section className="space-y-2.5 border-t border-line pt-4">
        <h3 className="text-[13px] font-semibold text-fg">Alarm sounds</h3>
        <AlarmSoundsEditor mode={mode} />
      </section>
    </Modal>
  );
}
