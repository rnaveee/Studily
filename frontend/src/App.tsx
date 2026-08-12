import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import AboutPage from "./features/static/AboutPage";
import TermsPage from "./features/static/TermsPage";
import PrivacyPage from "./features/static/PrivacyPage";
import SupportPage from "./features/static/SupportPage";
import InstallPage from "./features/static/InstallPage";
import ChangelogPage from "./features/static/ChangelogPage";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import ResetPasswordPage from "./features/auth/ResetPasswordPage";
import VerifyEmailPage from "./features/auth/VerifyEmailPage";
import VerifyGate from "./components/VerifyGate";
import HomeRoute from "./features/landing/HomeRoute";
import OnboardingPage from "./features/onboarding/OnboardingPage";
import ProfileSetupPage from "./features/onboarding/ProfileSetupPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import CalendarPage from "./features/calendar/CalendarPage";
import CoursesPage from "./features/courses/CoursesPage";
import CourseDetailPage from "./features/courses/CourseDetailPage";
import ProfilePage from "./features/profile/ProfilePage";
import ProfileEditPage from "./features/profile/ProfileEditPage";
import FriendsPage from "./features/friends/FriendsPage";
import SchoolmatesPage from "./features/friends/SchoolmatesPage";
import UserProfilePage from "./features/friends/UserProfilePage";
import SemestersPage from "./features/semesters/SemestersPage";
import MessagesPage from "./features/messages/MessagesPage";
import ConversationPage from "./features/messages/ConversationPage";
import LearnPage from "./features/learn/LearnPage";
import FlashcardsPage from "./features/learn/FlashcardsPage";
import FlashcardSetPage from "./features/learn/FlashcardSetPage";
import AiChatPage from "./features/learn/AiChatPage";
import PomodoroPage from "./features/learn/PomodoroPage";
import SettingsPage from "./features/settings/SettingsPage";

const PeriodicTablePage = lazy(() => import("./features/learn/PeriodicTablePage"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
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
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/messages" element={<VerifyGate><MessagesPage /></VerifyGate>} />
        <Route path="/messages/:id" element={<VerifyGate><ConversationPage /></VerifyGate>} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/flashcards" element={<FlashcardsPage />} />
        <Route path="/learn/flashcards/:id" element={<FlashcardSetPage />} />
        <Route path="/learn/ai" element={<AiChatPage />} />
        <Route
          path="/learn/periodic-table"
          element={
            <Suspense fallback={null}>
              <PeriodicTablePage />
            </Suspense>
          }
        />
        <Route path="/pomodoro" element={<PomodoroPage />} />
        <Route path="/semesters" element={<SemestersPage />} />
        <Route path="/friends" element={<VerifyGate><FriendsPage /></VerifyGate>} />
        <Route path="/friends/schoolmates" element={<VerifyGate><SchoolmatesPage /></VerifyGate>} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users/:userId" element={<VerifyGate><UserProfilePage /></VerifyGate>} />
        <Route path="/profile/:userId/add" element={<VerifyGate><UserProfilePage /></VerifyGate>} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/about"   element={<AboutPage />} />
        <Route path="/terms"   element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
