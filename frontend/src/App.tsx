import { Suspense, lazy, useEffect, useRef, type ReactNode } from "react";
import { Navigate, Route, Routes, matchPath, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { useAuth } from "./lib/auth";
import SuspendedScreen from "./features/moderation/SuspendedScreen";
import ModerationNotices from "./features/moderation/ModerationNotices";
import ClientOnly from "./components/ClientOnly";
import routes from "./routes.json";
import AboutPage from "./features/static/AboutPage";
import TermsPage from "./features/static/TermsPage";
import PrivacyPage from "./features/static/PrivacyPage";
import SupportPage from "./features/static/SupportPage";
import InstallPage from "./features/static/InstallPage";
import ChangelogPage from "./features/static/ChangelogPage";
import NotFoundPage from "./features/static/NotFoundPage";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import ResetPasswordPage from "./features/auth/ResetPasswordPage";
import VerifyEmailPage from "./features/auth/VerifyEmailPage";
import VerifyGate from "./components/VerifyGate";
import HomeRoute from "./features/landing/HomeRoute";
import OnboardingPage from "./features/onboarding/OnboardingPage";
import WelcomePage from "./features/welcome/WelcomePage";
import ProfileSetupPage from "./features/onboarding/ProfileSetupPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import CalendarPage from "./features/calendar/CalendarPage";
import CoursesPage from "./features/courses/CoursesPage";
import CourseAutoImportPage from "./features/courses/CourseAutoImportPage";
import ScheduleImportPage from "./features/courses/ScheduleImportPage";
import CourseDetailPage from "./features/courses/CourseDetailPage";
import ProfilePage from "./features/profile/ProfilePage";
import ProfileEditPage from "./features/profile/ProfileEditPage";
import FriendsPage from "./features/friends/FriendsPage";
import SchoolmatesPage from "./features/friends/SchoolmatesPage";
import UserProfilePage from "./features/friends/UserProfilePage";
import SemestersPage from "./features/semesters/SemestersPage";
import GradesPage from "./features/semesters/GradesPage";
import MessagesPage from "./features/messages/MessagesPage";
import ConversationPage from "./features/messages/ConversationPage";
import LearnPage from "./features/learn/LearnPage";
import FlashcardsPage from "./features/learn/FlashcardsPage";
import FlashcardSetPage from "./features/learn/FlashcardSetPage";
import SharedSetPage from "./features/learn/SharedSetPage";
import AiChatPage from "./features/learn/AiChatPage";
import PomodoroPage from "./features/learn/PomodoroPage";
import SchoolPage from "./features/schools/SchoolPage";
import GradeCalculatorPage from "./features/tools/GradeCalculatorPage";
import SettingsPage from "./features/settings/SettingsPage";
import SurveyPage from "./features/survey/SurveyPage";
import TodosPage from "./features/todos/TodosPage";
import BadgesPage from "./features/progress/BadgesPage";
import SessionHistoryPage from "./features/learn/sessions/SessionHistoryPage";

const PeriodicTablePage = lazy(() => import("./features/learn/PeriodicTablePage"));
const CalculatorPage = lazy(() => import("./features/learn/CalculatorPage"));
const AdminPage = lazy(() => import("./features/admin/AdminPage"));

function BareShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-bg" style={{ height: "var(--app-height)" }}>
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4">
        <div className="mb-5 flex items-center gap-1.5">
          <img src="/studily-3a.svg" alt="" className="h-8 w-8 shrink-0" />
          <div className="font-mono text-[15px] font-bold tracking-tight text-fg">Studily</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  if (user?.suspended) {
    return (
      <Routes>
        <Route path="/support" element={<BareShell><SupportPage /></BareShell>} />
        <Route path="/terms" element={<BareShell><TermsPage /></BareShell>} />
        <Route path="/privacy" element={<BareShell><PrivacyPage /></BareShell>} />
        <Route path="*" element={<SuspendedScreen />} />
      </Routes>
    );
  }

  return (
    <>
      <TitleSync />
      <AppRoutes />
      <ClientOnly>
        <ModerationNotices />
      </ClientOnly>
    </>
  );
}

const DEFAULT_TITLE = "Studily";
const NOT_FOUND_TITLE = "Page Not Found · Studily";

function titleFor(pathname: string): string {
  const matches = (pattern: string) => matchPath({ path: pattern, end: true }, pathname) != null;
  const publicRoute = routes.public.find((r) => matches(r.path));
  if (publicRoute) return publicRoute.title;
  return routes.app.some(matches) ? DEFAULT_TITLE : NOT_FOUND_TITLE;
}

function TitleSync() {
  const { pathname } = useLocation();
  const shown = useRef(pathname);
  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    document.title = titleFor(pathname);
  }, [pathname]);
  return null;
}

export const appRoutes = (
  <>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route
      path="/welcome"
      element={
        <ProtectedRoute>
          <WelcomePage />
        </ProtectedRoute>
      }
    />
    <Route
      element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }
    >
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/profile/setup" element={<ProfileSetupPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/courses/new/auto" element={<CourseAutoImportPage />} />
      <Route path="/courses/new/schedule" element={<ScheduleImportPage />} />
      <Route path="/courses/:id" element={<CourseDetailPage />} />
      <Route path="/messages" element={<VerifyGate><MessagesPage /></VerifyGate>} />
      <Route path="/messages/:id" element={<VerifyGate><ConversationPage /></VerifyGate>} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/learn/flashcards" element={<FlashcardsPage />} />
      <Route path="/flashcards" element={<Navigate to="/learn/flashcards" replace />} />
      <Route path="/learn/flashcards/:id" element={<FlashcardSetPage />} />
      <Route path="/learn/sessions" element={<SessionHistoryPage />} />
      <Route path="/learn/ai" element={<AiChatPage />} />
      <Route
        path="/learn/calculator"
        element={
          <Suspense fallback={null}>
            <CalculatorPage />
          </Suspense>
        }
      />
      <Route path="/todos" element={<TodosPage />} />
      <Route path="/semesters" element={<SemestersPage />} />
      <Route path="/grades" element={<GradesPage />} />
      <Route path="/friends" element={<VerifyGate><FriendsPage /></VerifyGate>} />
      <Route path="/friends/schoolmates" element={<VerifyGate><SchoolmatesPage /></VerifyGate>} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/edit" element={<ProfileEditPage />} />
      <Route path="/profile/badges" element={<BadgesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/survey" element={<SurveyPage />} />
      <Route
        path="/admin"
        element={
          <Suspense fallback={null}>
            <AdminPage />
          </Suspense>
        }
      />
      <Route path="/users/:userId" element={<VerifyGate><UserProfilePage /></VerifyGate>} />
      <Route path="/users/:userId/badges" element={<VerifyGate><BadgesPage /></VerifyGate>} />
      <Route path="/profile/:userId/add" element={<VerifyGate><UserProfilePage /></VerifyGate>} />
    </Route>
    <Route element={<Layout />}>
      <Route path="/about"   element={<AboutPage />} />
      <Route path="/sets/:id" element={<SharedSetPage />} />
      <Route path="/terms"   element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/install" element={<InstallPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/pomodoro" element={<PomodoroPage />} />
      <Route path="/grade-calculator" element={<GradeCalculatorPage />} />
      <Route path="/uvic" element={<SchoolPage slug="uvic" />} />
      <Route path="/sfu" element={<SchoolPage slug="sfu" />} />
      <Route path="/ubc" element={<SchoolPage slug="ubc" />} />
      <Route
        path="/periodic-table"
        element={
          <Suspense fallback={null}>
            <PeriodicTablePage />
          </Suspense>
        }
      />
      <Route path="/learn/periodic-table" element={<Navigate to="/periodic-table" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </>
);

function AppRoutes() {
  return <Routes>{appRoutes}</Routes>;
}
