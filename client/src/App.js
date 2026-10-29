import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home';
import Auth from './components/Auth';
import './App.css';
import PlayerDashboard from './components/PlayerDashboard';
import CoachDashboard from './components/CoachDashboard';
import StudentAnalysis from './components/StudentAnalysis';
import FullAnalysisPage from './components/FullAnalysisPage';
import MetricsPage from './components/MetricsPage';
import StudentReport from './components/StudentReport';
import CoachReport from './components/CoachReport';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<PlayerDashboard />} />
          <Route path="/coach-dashboard" element={<CoachDashboard />} />
          <Route path="/student/:id/analysis" element={<StudentAnalysis />} />
          <Route path="/analysis/:videoId" element={<FullAnalysisPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/report/student" element={<StudentReport />} />
          <Route path="/report/coach" element={<CoachReport />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
