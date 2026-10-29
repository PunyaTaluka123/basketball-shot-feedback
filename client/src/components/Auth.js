import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Auth.css';

const Auth = () => {
  const location = useLocation();
  const getQuery = () => new URLSearchParams(location.search);
  const initialRole = getQuery().get('role') || 'player';
  const initialMode = getQuery().get('mode') || 'login';

  const [isLogin, setIsLogin] = useState(initialMode !== 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initialRole);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
    const [age, setAge] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setRole(params.get('role') || 'player');
    setIsLogin((params.get('mode') || 'login') !== 'register');
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? 'http://localhost:3001/api/auth/login' : 'http://localhost:3001/api/auth/register';
    try {
      // Include age only for registration and only for players
      const payload = isLogin ? { email, password, role } : (role === 'player' ? { email, password, role, age } : { email, password, role });
      const response = await axios.post(endpoint, payload);
      const { token, user } = response.data;
      // Save token and user data to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setMessage(isLogin ? 'Login successful!' : 'Registration successful!');
      setError('');
      // Enforce role match on login
      if (isLogin && user.role !== role) {
        setError(`You tried to login as a ${role}, but this account is a ${user.role}. Please use the correct login option or credentials.`);
        setMessage('');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return;
      }
      // Redirect based on user role
      if (user.role === 'player') {
        navigate('/dashboard');
      } else if (user.role === 'coach') {
        navigate('/coach-dashboard');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'An error occurred');
      setMessage('');
    }
  };

  return (
    <div className="auth-container">
      <div style={{ textAlign: 'left', marginBottom: '10px' }}>
        <Link to="/" className="back-home-link">&larr; Back to Home</Link>
      </div>
      <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="player">Player</option>
          <option value="coach">Coach</option>
        </select>
        {/* Show age input only for player registration */}
        {!isLogin && role === 'player' && (
          <input
            type="number"
            placeholder="Age"
            value={age}
            onChange={e => setAge(e.target.value)}
            min="1"
            required
          />
        )}
        <button type="submit">{isLogin ? 'Login' : 'Sign Up'}</button>
      </form>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
      <button onClick={() => setIsLogin(!isLogin)} className="toggle-button">
        {isLogin ? 'Switch to Sign Up' : 'Switch to Login'}
      </button>
    </div>
  );
};

export default Auth; 
