export type FeynmanRole = "USER" | "BOT";
export type FeynmanKind = "CHAT" | "REPORT";
export type FeynmanStatus = "ACTIVE" | "COMPLETE";

export interface FeynmanMessage {
  id: number;
  role: FeynmanRole;
  kind: FeynmanKind;
  body: string;
  createdAt: string;
}

export interface FeynmanDocument {
  id: number;
  fileName: string;
  sizeBytes: number;
  chars: number;
  createdAt: string;
}

export interface FeynmanSession {
  id: number;
  title: string;
  focus: string | null;
  status: FeynmanStatus;
  score: number | null;
  documents: FeynmanDocument[];
  messages: FeynmanMessage[];
}

export interface FeynmanSummary {
  id: number;
  title: string;
  status: FeynmanStatus;
  score: number | null;
  updatedAt: string;
}

export interface FeynmanTurn {
  messages: FeynmanMessage[];
  status: FeynmanStatus;
  score: number | null;
}

export interface FeynmanReport {
  score: number;
  summary: string;
  strengths: string[];
  gaps: { concept: string; detail: string }[];
  concepts: { concept: string; score: number; didNotKnow: boolean }[];
}

export function parseReport(body: string): FeynmanReport | null {
  try {
    return JSON.parse(body) as FeynmanReport;
  } catch {
    return null;
  }
}
