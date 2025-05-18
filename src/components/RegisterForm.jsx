import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext';
import { api } from '../api/api';

export default function RegisterForm() {
  const { login } = useContext(AuthContext);
  const [form, setForm] = useState({ email: '', password: '', role: 'player', invite_token: '' });
  const [error, setError] = useState('');

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await api.post('/register', form);
      // Optionally auto-login or redirect
    } catch (err) {
      setError('Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Register</h2>
      {error && <div className="error">{error}</div>}
      <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Email" required />
      <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" required />
      <select name="role" value={form.role} onChange={handleChange}>
        <option value="player">Player</option>
        <option value="coach">Coach</option>
      </select>
      <input name="invite_token" value={form.invite_token} onChange={handleChange} placeholder="Invite Token (optional)" />
      <button type="submit">Register</button>
    </form>
  );
}