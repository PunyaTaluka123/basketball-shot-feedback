import React, { useEffect, useState, useContext } from 'react';
import { api } from '../api/api';
import { AuthContext } from '../AuthContext';

export default function InviteManager() {
  const { user } = useContext(AuthContext);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (user?.role === 'player') {
      api.get('/invites').then(res => setInvites(res.data));
    }
  }, [user]);

  const handleInvite = async e => {
    e.preventDefault();
    try {
      await api.post('/invite', { player_email: email });
      setMsg('Invite sent!');
    } catch {
      setMsg('Failed to send invite');
    }
  };

  const respond = async (invite_id, status) => {
    await api.post('/invites/respond', { invite_id, status });
    setInvites(invites.filter(i => i.id !== invite_id));
  };

  return (
    <div>
      <h3>Invites</h3>
      {user?.role === 'coach' && (
        <form onSubmit={handleInvite}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Player Email" />
          <button type="submit">Send Invite</button>
        </form>
      )}
      {msg && <div>{msg}</div>}
      {user?.role === 'player' && (
        <ul>
          {invites.map(invite => (
            <li key={invite.id}>
              From Coach {invite.coach_id} - Status: {invite.status}
              <button onClick={() => respond(invite.id, 'accepted')}>Accept</button>
              <button onClick={() => respond(invite.id, 'rejected')}>Reject</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
