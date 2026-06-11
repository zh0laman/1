import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Drive from './pages/Drive';
import Editor from './pages/Editor';
import Contact from './pages/Contact';
import Notebook from './pages/Notebook';
import ProtectedRoute from './components/ProtectedRoute';
import { useEffect } from 'react';

// Component to intercept token from URL (for WebView/Mobile auth)
function AuthInterceptor() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      // Remove tokens from URL for security and clean UI
      params.delete('token');
      params.delete('refresh_token');

      navigate({
        pathname: location.pathname,
        search: params.toString()
      }, { replace: true });
    }
  }, [location, navigate]);

  return null;
}

import PublicShare from './pages/PublicShare';

function App() {
  return (
    <Router>
      <AuthInterceptor />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/share/:id" element={<PublicShare />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Drive />} />
            <Route path="/shared" element={<Drive mode="shared" />} />
            <Route path="/recent" element={<Drive mode="recent" />} />
            <Route path="/notebook" element={<Notebook />} />
          </Route>
          <Route path="/contact" element={<Contact />} />
        </Route>

        <Route path="/editor/:fileId" element={<Editor />} />
        <Route path="/editor-external/:fileId" element={<Editor />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
