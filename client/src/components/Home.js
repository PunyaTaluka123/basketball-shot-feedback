import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
      <h1>Welcome to the Basketball Training Analytics System</h1>
      <p>Enhance your skills with personalized analytics and feedback.</p>
      <div className="login-options">
        <div className="login-box">
          <h2>Login as Coach</h2>
          <Link to="/auth?role=coach" className="nav-link">Coach Login</Link>
        </div>
        <div className="login-box">
          <h2>Login as Student</h2>
          <Link to="/auth?role=player" className="nav-link">Student Login</Link>
        </div>
      </div>
      <div className="register-link">
        <p>Don't have an account? <Link to="/auth?mode=register" className="register-now">Register Now</Link></p>
      </div>
    </div>
  );
};

export default Home; 
