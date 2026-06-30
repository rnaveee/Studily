import { Link } from "react-router-dom";
import { Edit2, GraduationCap, BookOpen, School } from "lucide-react";
import { useAuth } from "../../lib/auth";

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  const initial = (user.name ?? user.username).charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Profile</h1>
        <Link to="/profile/edit" className="btn btn-ghost">
          <Edit2 size={13} />
          Edit
        </Link>
      </div>

      {/* Avatar + name */}
      <div className="card p-6 text-center">
        <div
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-accent-fg"
          style={{ background: "var(--accent)" }}
        >
          {initial}
        </div>
        <h2 className="text-xl font-bold text-fg">{user.name}</h2>
        <p className="mt-0.5 text-[13px] text-fg-3">@{user.username}</p>
        <p className="mt-0.5 text-[13px] text-fg-3">{user.email}</p>
        {user.bio && (
          <p className="mx-auto mt-3 max-w-xs text-sm text-fg-2">{user.bio}</p>
        )}
      </div>

      {/* Details */}
      <div className="card divide-y divide-line">
        {user.school && (
          <ProfileRow icon={<School size={14} />} label="School" value={user.school} />
        )}
        {user.major && (
          <ProfileRow icon={<BookOpen size={14} />} label="Major" value={user.major} />
        )}
        {user.year != null && (
          <ProfileRow icon={<GraduationCap size={14} />} label="Year" value={`Year ${user.year}`} />
        )}
        {user.schoolId && (
          <ProfileRow icon={null} label="Student ID" value={user.schoolId} />
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
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-fg-3">{icon}</span>
      <span className="w-24 shrink-0 text-[12px] text-fg-3">{label}</span>
      <span className="text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
