import { Sparkles, type LucideIcon } from "lucide-react";

export interface Article {
  slug: string;
  title: string;
  summary: string;
  icon: LucideIcon;
}

export const ARTICLES: Article[] = [
  {
    slug: "what-is-studily",
    title: "What is Studily",
    summary: "The all-in-one student platform: why it was built and what you get, from the dashboard to StudilyBot.",
    icon: Sparkles,
  },
];
