export type StudyScopeKind = "set" | "folder" | "course" | "selection";

export interface StudyScope {
  kind: StudyScopeKind;
  id: number;
  setIds?: number[];
}

export function setScope(id: number): StudyScope {
  return { kind: "set", id };
}

export function selectionScope(setIds: number[]): StudyScope {
  return { kind: "selection", id: 0, setIds };
}

export function scopeKey(scope: StudyScope): string {
  if (scope.kind === "selection") return `selection-${(scope.setIds ?? []).join("-")}`;
  return scope.kind === "set" ? String(scope.id) : `${scope.kind}-${scope.id}`;
}
