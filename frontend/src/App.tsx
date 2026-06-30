import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import StaticPage from "./components/StaticPage";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import CalendarPage from "./features/calendar/CalendarPage";
import CoursesPage from "./features/courses/CoursesPage";
import CourseDetailPage from "./features/courses/CourseDetailPage";
import ProfilePage from "./features/profile/ProfilePage";
import ProfileEditPage from "./features/profile/ProfileEditPage";
import ClassmatesPage from "./features/classmates/ClassmatesPage";
import SemestersPage from "./features/semesters/SemestersPage";

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
        <Route path="/semesters" element={<SemestersPage />} />
        <Route path="/classmates" element={<ClassmatesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/about"   element={<StaticPage title="About" />} />
        <Route path="/terms"   element={<StaticPage title="Terms of Service" />} />
        <Route path="/privacy" element={<StaticPage title="Privacy Policy" />} />
        <Route path="/support" element={<StaticPage title="Support" />} />
        <Route path="/install" element={<StaticPage title="Install" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
