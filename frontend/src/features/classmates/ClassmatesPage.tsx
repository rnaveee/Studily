import { useQuery } from "@tanstack/react-query";
import { Users2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import Avatar from "../../components/Avatar";
import type { ClassmateSuggestion } from "../../types";

export default function ClassmatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["classmates"],
    queryFn: () => api.get<ClassmateSuggestion[]>("/classmates/suggestions"),
  });

  return (
    <div className="space-y-4 animate-in">
      <div>
        <h1 className="text-xl font-semibold text-fg">Classmates</h1>
        <p className="mt-1 text-[13px] text-fg-3">
          People at your school enrolled in the same course codes.{" "}
          <Link to="/profile" className="text-accent hover:text-accent-2 transition-colors">
            Set your school
          </Link>{" "}
          and add courses with codes to see matches.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      ) : data && data.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.map((s, i) => {
            return (
              <li key={`${s.user.id}-${s.sharedCourseCode}-${i}`} className="card p-4 animate-fade">
                <div className="flex items-center gap-3">
                  <Avatar name={s.user.name} username={s.user.username} avatarUrl={s.user.avatarUrl} size={36} className="text-[13px]" />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-medium text-fg truncate">{s.user.name}</span>
                      <span className="text-[12px] text-fg-3 truncate">@{s.user.username}</span>
                    </div>
                    {(s.user.major || s.user.year) && (
                      <div className="text-[12px] text-fg-3">
                        {[s.user.major, s.user.year ? `Year ${s.user.year}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="badge badge-accent">{s.sharedCourseCode}</span>
                  <span className="text-[12px] text-fg-3">{s.sharedCourseName}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card p-10 text-center">
          <Users2 className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
          <p className="text-sm text-fg-3">No classmate matches yet.</p>
          <p className="mt-1 text-[12px] text-fg-3">
            Add course codes and set your school in{" "}
            <Link to="/profile" className="text-accent hover:text-accent-2 transition-colors">
              Profile
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
