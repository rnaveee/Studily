export type StudyScopeKind = "set" | "folder" | "course";

export interface StudyScope {
  kind: StudyScopeKind;
  id: number;
}

export function setScope(id: number): StudyScope {
  return { kind: "set", id };
}

export function scopeKey(scope: StudyScope): string {
  return scope.kind === "set" ? String(scope.id) : `${scope.kind}-${scope.id}`;
}
