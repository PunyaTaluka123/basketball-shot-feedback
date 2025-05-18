import React, { useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthContext, AuthProvider } from './AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PlayerDashboardPage from './pages/PlayerDashboardpage';
import CoachDashboardPage from './pages/CoachDashboardPage';
import Navbar from './components/Navbar';

function PrivateRoute({ children, role }) {
  const { user } = useContext(AuthContext);   
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/player" element={
            <PrivateRoute role="player">
              <PlayerDashboardPage />
            </PrivateRoute>
          } />
          <Route path="/coach" element={
            <PrivateRoute role="coach">
              <CoachDashboardPage />
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;