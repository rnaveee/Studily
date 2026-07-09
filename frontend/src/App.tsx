import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import AboutPage from "./features/static/AboutPage";
import TermsPage from "./features/static/TermsPage";
import PrivacyPage from "./features/static/PrivacyPage";
import SupportPage from "./features/static/SupportPage";
import InstallPage from "./features/static/InstallPage";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<ConversationPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/flashcards" element={<FlashcardsPage />} />
        <Route path="/learn/flashcards/:id" element={<FlashcardSetPage />} />
        <Route path="/learn/ai" element={<AiChatPage />} />
        <Route path="/semesters" element={<SemestersPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/friends/schoolmates" element={<SchoolmatesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/users/:userId" element={<UserProfilePage />} />
        <Route path="/profile/:userId/add" element={<UserProfilePage />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/about"   element={<AboutPage />} />
        <Route path="/terms"   element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/install" element={<InstallPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
