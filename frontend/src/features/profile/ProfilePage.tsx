import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Edit2, GraduationCap, BookOpen, CalendarDays, School } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import Avatar from "../../components/Avatar";
import WeekSchedule from "../../components/WeekSchedule";
import type { ProfileSchedule } from "../../types";

export default function ProfilePage() {
  const { user } = useAuth();

  const schedule = useQuery({
    queryKey: ["schedule", user?.id],
    queryFn: () => api.get<ProfileSchedule>(`/users/${user!.id}/schedule`),
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Profile</h1>
        <Link to="/profile/edit" className="btn btn-ghost">
          <Edit2 size={13} />
          Edit
        </Link>
      </div>

      <div className="card p-6 text-center">
        <Avatar name={user.name} username={user.username} avatarUrl={user.avatarUrl} size={80} className="mx-auto mb-4 text-3xl" />
        <h2 className="text-xl font-bold text-fg">{user.name}</h2>
        <p className="mt-0.5 text-[13px] text-fg-3">@{user.username}</p>
        <p className="mt-0.5 text-[13px] text-fg-3">{user.email}</p>
        {user.bio && (
          <p className="mx-auto mt-3 max-w-xs text-sm text-fg-2">{user.bio}</p>
        )}
      </div>

      <div className="card divide-y divide-line">
        {(user.school || user.schoolId) && (
          <ProfileRow
            icon={<School size={14} />}
            label="School"
            value={
              <span className="flex items-center gap-2">
                {user.school}
                {user.schoolId && <span className="badge badge-muted">{user.schoolId}</span>}
              </span>
            }
          />
        )}
        {user.major && (
          <ProfileRow icon={<BookOpen size={14} />} label="Major" value={user.major} />
        )}
        {user.year != null && (
          <ProfileRow icon={<GraduationCap size={14} />} label="Year" value={`Year ${user.year}`} />
        )}
        {!user.school && !user.major && !user.year && !user.schoolId && (
          <div className="px-5 py-4 text-[13px] text-fg-3">
            No details yet —{" "}
            <Link to="/profile/edit" className="text-accent hover:text-accent-2 transition-colors">
              fill in your profile
            </Link>
            .
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <CalendarDays size={14} className="text-fg-3" />
            Current semester
          </h3>
          {schedule.data?.semester && (
            <span className="badge badge-muted">{schedule.data.semester.label}</span>
          )}
        </div>
        {schedule.data?.semester ? (
          <WeekSchedule courses={schedule.data.courses} />
        ) : (
          <p className="px-5 py-4 text-[13px] text-fg-3">
            {schedule.isLoading ? (
              "Loading…"
            ) : (
              <>
                No active semester —{" "}
                <Link to="/semesters" className="text-accent hover:text-accent-2 transition-colors">
                  set one up
                </Link>
                .
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-fg-3">{icon}</span>
      <span className="w-24 shrink-0 text-[12px] text-fg-3">{label}</span>
      <span className="text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
