import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { UserPlus, Check, Clock, School, GraduationCap, BookOpen, CalendarDays, Lock, MessageSquare } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import Avatar from "../../components/Avatar";
import BackButton from "../../components/BackButton";
import ScheduleCard from "../../components/ScheduleCard";
import type { Conversation, ProfileSchedule, Relationship } from "../../types";
import { Spinner } from "../../components/Skeleton";
import PublicSetsSection from "../learn/PublicSetsSection";
import { UserProfileProgress } from "../progress/ProfileProgress";
import { invalidateProgress } from "../../lib/progressDelta";

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const id = Number(userId);
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["friends", "user", id],
    queryFn: () => api.get<Relationship>(`/friends/users/${id}`),
    enabled: Number.isFinite(id),
    retry: false,
  });

  const schedule = useQuery({
    queryKey: ["schedule", id],
    queryFn: () => api.get<ProfileSchedule>(`/users/${id}/schedule`),
    enabled: Number.isFinite(id) && !!data && data.status !== "SELF",
    retry: false,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["schoolmates"] });
    queryClient.invalidateQueries({ queryKey: ["friends", "user", id] });
  }

  const send = useMutation({
    mutationFn: () => api.post("/friends/requests", { userId: id }),
    onSuccess: invalidateAll,
  });

  const accept = useMutation({
    mutationFn: (requestId: number) => api.post(`/friends/requests/${requestId}/accept`),
    onSuccess: () => {
      invalidateAll();
      invalidateProgress(queryClient);
    },
  });

  const withdraw = useMutation({
    mutationFn: (requestId: number) => api.del(`/friends/requests/${requestId}`),
    onSuccess: invalidateAll,
  });

  const openChat = useMutation({
    mutationFn: () => api.post<Conversation>("/conversations/direct", { userId: id }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/messages/${conv.id}`);
    },
  });

  const pending = send.isPending || accept.isPending || withdraw.isPending || openChat.isPending;

  if (data?.status === "SELF") {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 stagger-children">
      <BackButton fallback="/friends" />

      {isLoading ? (
        <Spinner label="Loading…" />
      ) : error || !data ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-fg-3">
            {error instanceof ApiError && error.status === 404 ? "User not found." : "Couldn't load this profile."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
          <div className="min-w-0 space-y-4 lg:space-y-5">
            <div className="card p-6 text-center">
              <Avatar name={data.user.name} username={data.user.username} avatarUrl={data.user.avatarUrl} size={80} className="mx-auto mb-4 text-3xl" />
              <h1 className="text-xl font-bold text-fg">{data.user.name}</h1>
              <p className="mt-0.5 text-[13px] text-fg-3">@{data.user.username}</p>
              {data.user.bio && <p className="mx-auto mt-3 max-w-xs text-sm text-fg-2">{data.user.bio}</p>}

              <UserProfileProgress userId={id} />

              {data.status === "FRIENDS" && (
                <div className="mt-4">
                  <div><span className="badge badge-green">Friends</span></div>
                  <button onClick={() => openChat.mutate()} disabled={pending} className="btn btn-primary mt-4 min-h-[40px] w-full">
                    <MessageSquare size={13} />
                    Message
                  </button>
                </div>
              )}
              {data.status === "NONE" && (
                <div className="mt-5">
                  <button onClick={() => send.mutate()} disabled={pending} className="btn btn-primary min-h-[40px] w-full">
                    <UserPlus size={13} />
                    Add friend
                  </button>
                  <p className="mt-2 text-[11px] text-fg-3">Add them to message and see their shared schedule.</p>
                </div>
              )}
              {data.status === "OUTGOING_PENDING" && data.requestId && (
                <div className="mt-4">
                  <div><span className="badge badge-muted"><Clock size={11} />Request sent</span></div>
                  <button onClick={() => withdraw.mutate(data.requestId!)} disabled={pending} className="btn btn-ghost mt-4 min-h-[40px] w-full">
                    Withdraw request
                  </button>
                </div>
              )}
              {data.status === "INCOMING_PENDING" && data.requestId && (
                <button onClick={() => accept.mutate(data.requestId!)} disabled={pending} className="btn btn-primary mt-5 min-h-[40px] w-full">
                  <Check size={13} />
                  Accept friend request
                </button>
              )}
            </div>

            <div className="card">
              <div className="px-5 pb-1 pt-4">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
                  <GraduationCap size={14} className="text-fg-3" />
                  Education
                </h3>
              </div>
              <div className="divide-y divide-line">
                {data.user.school && <EducationRow icon={<School size={14} />} label="School" value={data.user.school} />}
                {data.user.major && <EducationRow icon={<BookOpen size={14} />} label="Major" value={data.user.major} />}
                {data.user.year != null && (
                  <EducationRow icon={<GraduationCap size={14} />} label="Year" value={`Year ${data.user.year}`} />
                )}
                {!data.user.school && !data.user.major && data.user.year == null && (
                  <p className="px-5 py-4 text-[13px] text-fg-3">
                    {data.user.name || data.user.username} hasn't added any education details.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4 lg:space-y-5">
            {schedule.data?.visible && schedule.data.semester ? (
              <ScheduleCard courses={schedule.data.courses} semesterLabel={schedule.data.semester.label} />
            ) : (
              <div className="card">
                <div className="flex items-center justify-between px-5 pb-1 pt-4">
                  <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
                    <CalendarDays size={14} className="text-fg-3" />
                    Current semester
                  </h3>
                </div>
                {schedule.isLoading ? (
                  <p className="px-5 py-4 text-[13px] text-fg-3">Loading…</p>
                ) : schedule.error ? (
                  <p className="px-5 py-4 text-[13px] text-fg-3">
                    {schedule.error instanceof ApiError
                      ? schedule.error.message
                      : "Couldn't load this schedule."}
                  </p>
                ) : schedule.data?.visible ? (
                  <p className="px-5 py-4 text-[13px] text-fg-3">No active semester.</p>
                ) : (
                  <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-fg-3">
                    <Lock size={13} />
                    {data.user.name} hasn't shared their schedule.
                  </p>
                )}
              </div>
            )}

            <PublicSetsSection
              userId={id}
              title={`${data.user.name || data.user.username}'s flashcard sets`}
              emptyHint={`${data.user.name || data.user.username} hasn't shared any flashcard sets with you yet.`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EducationRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-fg-3">{icon}</span>
      <span className="w-20 shrink-0 text-[12px] text-fg-3">{label}</span>
      <span className="min-w-0 break-words text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
