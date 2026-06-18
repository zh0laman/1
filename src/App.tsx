import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './presentation/pages/auth/LoginPage'
import AuthCallbackPage from './presentation/pages/auth/AuthCallbackPage'
import WorkspaceLayout from './presentation/pages/dashboard/WorkspaceLayout'
import DashboardPage from './presentation/pages/dashboard/DashboardPage'
import MessengerPage from './presentation/pages/messenger/MessengerPage'
import WorkspacePage from './presentation/pages/workspace/WorkspacePage'
import AlemStorePage from './presentation/pages/alemstore/AlemStorePage'
import ProfilePage from './presentation/pages/profile/ProfilePage'
import CalendarPage from './presentation/pages/calendar/CalendarPage'
import CalendarCallPage from './presentation/pages/calendar/CalendarCallPage'
import BoardPage from './presentation/pages/board/BoardPage'
import AlemAiPage from './presentation/pages/alemai/AlemAiPage'
import AlemRagPage from './presentation/pages/alemrag'
import AlemDrivePage from './presentation/pages/alemdrive/AlemDrivePage'
import NotesPage from './presentation/pages/notes/NotesPage'
import AlemContactPage from './presentation/pages/alem-contact/AlemContactPage'
import HrOrgCanvasPage from './presentation/pages/alem-contact/HrOrgCanvasPage'
import ProtectedRoute from './presentation/routes/ProtectedRoute'
import PublicOnlyRoute from './presentation/routes/PublicOnlyRoute'
import RagLoginPage from './presentation/pages/bot-admin/RagLoginPage'
import BotAdminPage from './presentation/pages/bot-admin/BotAdminPage'
import RagChatPage from './presentation/pages/bot-admin/RagChatPage'
import RagProtectedRoute from './presentation/pages/bot-admin/RagProtectedRoute'

export default function App() {
  // Global guard: Ensure we are always within the /web/ basename.
  // This prevents the router from breaking if some code redirects to /login instead of /web/login.
  if (!window.location.pathname.startsWith('/web') && !window.location.pathname.startsWith('/api')) {
    const currentPath = window.location.pathname === '/' ? '' : window.location.pathname;
    const newPath = '/web' + currentPath + '/' + window.location.search + window.location.hash;
    window.location.assign(newPath.replace(/\/+$/, '/').replace(/\/\//g, '/'));
    return null;
  }

  return (
    <BrowserRouter basename="/web/">

      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* RAG Admin Platform */}
        <Route path="/rag-admin/login" element={<RagLoginPage />} />
        <Route path="/rag-admin/bots" element={<RagProtectedRoute><BotAdminPage /></RagProtectedRoute>} />
        <Route path="/rag-admin/chat" element={<RagProtectedRoute><RagChatPage /></RagProtectedRoute>} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<WorkspaceLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/main/dashboard" element={<DashboardPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/alemstore" element={<AlemStorePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/calls/calendar/:roomName" element={<CalendarCallPage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/kanban" element={<BoardPage />} />
            <Route path="/alemai" element={<AlemAiPage />} />
            <Route path="/alem-rag" element={<AlemRagPage />} />
            <Route path="/alem-rag/tablet" element={<AlemRagPage />} />
            <Route path="/drive/*" element={<AlemDrivePage />} />
            <Route path="/drive/tablet/*" element={<AlemDrivePage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/alem-contact" element={<AlemContactPage />} />
            <Route path="/alem-contact/org-map" element={<HrOrgCanvasPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/messenger" element={<MessengerPage />} />
            <Route path="/messenger/:username" element={<MessengerPage />} />
            <Route path="/:username" element={<MessengerPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
