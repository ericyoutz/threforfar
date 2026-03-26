'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';

export default function DashboardClient({ initialData }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState('workspace');
  const [search, setSearch] = useState('');
  const [selectedChatId, setSelectedChatId] = useState(initialData.chats[0]?.id || null);
  const [messageInput, setMessageInput] = useState('');
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatDescription, setNewChatDescription] = useState('');
  const [memberSelection, setMemberSelection] = useState(() =>
    initialData.users.filter((u) => u.role !== 'ADMIN').slice(0, 2).map((u) => u.id)
  );
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ── Unread tracking ────────────────────────────────────────────────────────
  // Initialise with the last message ID in each chat (everything on load is "read")
  const [lastReadIds, setLastReadIds] = useState(() => {
    const map = {};
    initialData.chats.forEach((chat) => {
      const msgs = chat.messages;
      map[chat.id] = msgs.length ? msgs[msgs.length - 1].id : 0;
    });
    return map;
  });

  const unreadCounts = useMemo(() => {
    const counts = {};
    data.chats.forEach((chat) => {
      const lastRead = lastReadIds[chat.id] ?? 0;
      counts[chat.id] = chat.messages.filter((m) => m.id > lastRead).length;
    });
    return counts;
  }, [data.chats, lastReadIds]);

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts]
  );

  // Mark a chat as fully read
  function markRead(chatId, chats) {
    const chat = (chats || data.chats).find((c) => c.id === chatId);
    if (!chat || !chat.messages.length) return;
    const lastId = chat.messages[chat.messages.length - 1].id;
    setLastReadIds((prev) => ({ ...prev, [chatId]: lastId }));
  }

  // Select a chat and immediately clear its unread count
  function selectChat(chatId) {
    setSelectedChatId(chatId);
    markRead(chatId);
  }

  // ── Character profile editing ──────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    characterName: initialData.currentUser.profile?.character || '',
    faction:       initialData.currentUser.profile?.faction   || '',
    styleNotes:    initialData.currentUser.profile?.style     || '',
    phone:         initialData.currentUser.profile?.phone     || ''
  });
  const [profileError, setProfileError] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);

  async function saveProfile() {
    setProfileBusy(true);
    setProfileError('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileDraft)
      });
      const result = await response.json();
      if (!response.ok) {
        setProfileError(result.error || 'Could not save profile.');
        return;
      }
      if (result.data) setData(result.data);
      setEditingProfile(false);
    } catch {
      setProfileError('Could not save profile.');
    } finally {
      setProfileBusy(false);
    }
  }

  // ── Account settings (name, email, password) ───────────────────────────────
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountDraft, setAccountDraft] = useState({
    name:  initialData.currentUser.name  || '',
    email: initialData.currentUser.email || ''
  });
  const [accountError,   setAccountError]   = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [accountBusy,    setAccountBusy]    = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [pwDraft, setPwDraft] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError,   setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwBusy,    setPwBusy]    = useState(false);

  async function saveAccount() {
    setAccountBusy(true);
    setAccountError('');
    setAccountSuccess('');
    try {
      const response = await fetch('/api/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountDraft)
      });
      const result = await response.json();
      if (!response.ok) {
        setAccountError(result.error || 'Could not save account details.');
        return;
      }
      if (result.data) setData(result.data);
      setAccountSuccess('Account details updated.');
      setEditingAccount(false);
    } catch {
      setAccountError('Could not save account details.');
    } finally {
      setAccountBusy(false);
    }
  }

  async function savePassword() {
    setPwError('');
    setPwSuccess('');
    if (pwDraft.newPassword !== pwDraft.confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      const response = await fetch('/api/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwDraft.currentPassword,
          newPassword:     pwDraft.newPassword
        })
      });
      const result = await response.json();
      if (!response.ok) {
        setPwError(result.error || 'Could not change password.');
        return;
      }
      setPwSuccess('Password changed successfully.');
      setPwDraft({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setChangingPassword(false);
    } catch {
      setPwError('Could not change password.');
    } finally {
      setPwBusy(false);
    }
  }

  // ── Refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef    = useRef(null);
  const selectedChatIdRef = useRef(selectedChatId);
  useEffect(() => { selectedChatIdRef.current = selectedChatId; }, [selectedChatId]);

  // ── Polling ────────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const response = await fetch('/api/data');
      if (!response.ok) return;
      const result = await response.json();
      if (!result.data) return;

      setData(result.data);

      // If the selected chat was removed, fall back to first
      const stillExists = result.data.chats.some((c) => c.id === selectedChatIdRef.current);
      if (!stillExists && result.data.chats.length) {
        setSelectedChatId(result.data.chats[0].id);
      }

      // Auto-mark the currently open chat as read
      const activeChatId = selectedChatIdRef.current;
      if (activeChatId) markRead(activeChatId, result.data.chats);
    } catch {
      // silently ignore network errors during background polling
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(poll, 5000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [poll]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChatId, data.chats]);

  // ── Update browser tab title with unread count ─────────────────────────────
  useEffect(() => {
    document.title = totalUnread > 0
      ? `(${totalUnread}) StoryCrafter`
      : 'StoryCrafter';
  }, [totalUnread]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.chats.filter((chat) => chat.title.toLowerCase().includes(query));
  }, [data.chats, search]);

  const selectedChat = visibleChats.find((c) => c.id === selectedChatId) || visibleChats[0] || null;
  const isAdmin = data.currentUser.role === 'ADMIN';
  const currentProfile = data.currentUser.profile;

  // ── API helper ─────────────────────────────────────────────────────────────
  async function handleApi(url, body = {}) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Something went wrong.');
        return null;
      }
      if (result.data) {
        setData(result.data);
        if (result.data.chats.length && !result.data.chats.some((c) => c.id === selectedChatId)) {
          setSelectedChatId(result.data.chats[0].id);
        }
      }
      return result;
    } catch {
      setError('Something went wrong.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!selectedChat || !messageInput.trim()) return;
    const result = await handleApi('/api/messages', { chatId: selectedChat.id, message: messageInput });
    if (result) {
      setMessageInput('');
      // Our own message is immediately read
      if (result.data) markRead(selectedChat.id, result.data.chats);
    }
  }

  async function createChat() {
    if (!newChatTitle.trim()) return;
    const result = await handleApi('/api/chats', {
      title: newChatTitle,
      description: newChatDescription,
      memberIds: memberSelection
    });
    if (result) {
      setNewChatTitle('');
      setNewChatDescription('');
      setMemberSelection(result.data.users.filter((u) => u.role !== 'ADMIN').slice(0, 2).map((u) => u.id));
      setSelectedChatId(result.data.chats[0]?.id || null);
      setTab('workspace');
    }
  }

  async function approveUser(requestId) {
    await handleApi('/api/admin/approve', { requestId });
  }

  async function toggleChatMember(chatId, userId) {
    await handleApi('/api/admin/chat-members', { chatId, userId });
  }

  async function publishAnnouncement() {
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    const result = await handleApi('/api/announcements', { title: announcementTitle, body: announcementBody });
    if (result) {
      setAnnouncementTitle('');
      setAnnouncementBody('');
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="pill">Private Roleplay Writing Platform</div>
          <h1>StoryCrafter</h1>
          <p>Admin-controlled collaborative writing with saved shared data.</p>
        </div>
        <div className="row top-actions">
          <button type="button" className="btn-primary" onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="tabs">
        {['workspace', 'admin', 'about'].map((value) => (
          <button
            key={value}
            type="button"
            className={`tab ${tab === value ? 'btn-primary active' : ''}`}
            onClick={() => setTab(value)}
          >
            {value === 'workspace'
              ? `Workspace${totalUnread > 0 ? ` (${totalUnread})` : ''}`
              : value === 'admin' ? 'Admin' : 'About'}
          </button>
        ))}
      </div>

      {error ? <div className="notice">{error}</div> : null}
      {busy ? <div className="success">Saving changes...</div> : null}

      {/* ── WORKSPACE ── */}
      <div className={`layout ${tab !== 'workspace' ? 'hidden' : ''}`}>
        <section className="card">
          <div className="card-header">
            <h2>Users</h2>
            <p>Approved members of the shared writing platform.</p>
          </div>
          <div className="card-body">
            <div className="user-switch">
              {data.users.map((user) => (
                <div key={user.id} className={`user-item ${user.id === data.currentUser.id ? 'active' : ''}`}>
                  <div style={{ fontWeight: 600 }}>{user.name}</div>
                  <div className="small">{user.role}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>{selectedChat ? selectedChat.title : 'Chats'}</h2>
            <p>{selectedChat ? selectedChat.description || 'Private room' : 'Only assigned rooms appear here.'}</p>
          </div>
          <div className="card-body">
            <div className="search">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" />
            </div>
            <div className="chat-grid">
              <div id="chatList" className="chat-list">
                {visibleChats.length ? visibleChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                    onClick={() => selectChat(chat.id)}
                  >
                    <div className="chat-item-row">
                      <div style={{ fontWeight: 600 }}>{chat.title}</div>
                      {unreadCounts[chat.id] > 0 && (
                        <span className="unread-badge">{unreadCounts[chat.id]}</span>
                      )}
                    </div>
                    <div className="small">{chat.description}</div>
                  </button>
                )) : (
                  <div className="announce-item"><p>No chats are assigned to this account.</p></div>
                )}
              </div>
              <div>
                <div className="chip-row">
                  {selectedChat?.members.map((memberId) => {
                    const user = data.users.find((u) => u.id === memberId);
                    return <div key={memberId} className="member-chip">{user?.name || 'Unknown'}</div>;
                  })}
                </div>
                <div className="chat-room">
                  {selectedChat ? selectedChat.messages.map((message) => {
                    const sender = data.users.find((u) => u.id === message.senderId);
                    return (
                      <div key={message.id} className="bubble">
                        <div className="meta">
                          <span>{sender?.name || 'Unknown'}</span>
                          <span>{message.time}</span>
                        </div>
                        <div>{message.text}</div>
                      </div>
                    );
                  }) : <div className="announce-item"><p>Select a room.</p></div>}
                  <div ref={messagesEndRef} />
                </div>
                <div className="composer">
                  <input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Write in this private thread…"
                  />
                  <button type="button" className="btn-primary" onClick={sendMessage}>Send</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Community Panel</h2>
            <p>Announcements, profile, and notifications.</p>
          </div>
          <div className="card-body subgrid">
            <div className="panel-section">
              <h3>Announcements</h3>
              <div>
                {data.announcements.map((announcement) => (
                  <div key={announcement.id} className="announce-item">
                    <div className="meta">
                      <strong className="meta-strong">{announcement.title}</strong>
                      <span>{announcement.time}</span>
                    </div>
                    <p>{announcement.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-section">
              <h3>Character Profile</h3>
              {currentProfile ? (
                editingProfile ? (
                  <div className="profile-box">
                    <div className="profile-edit">
                      <div>
                        <label>Character name</label>
                        <input
                          value={profileDraft.characterName}
                          onChange={(e) => setProfileDraft((p) => ({ ...p, characterName: e.target.value }))}
                          placeholder="Your character's name"
                        />
                      </div>
                      <div>
                        <label>Faction</label>
                        <input
                          value={profileDraft.faction}
                          onChange={(e) => setProfileDraft((p) => ({ ...p, faction: e.target.value }))}
                          placeholder="Faction or group"
                        />
                      </div>
                      <div>
                        <label>Writing style</label>
                        <input
                          value={profileDraft.styleNotes}
                          onChange={(e) => setProfileDraft((p) => ({ ...p, styleNotes: e.target.value }))}
                          placeholder="e.g. Third-person, lyrical"
                        />
                      </div>
                      <div>
                        <label>Phone for SMS notifications</label>
                        <input
                          value={profileDraft.phone}
                          onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+15550001234 (E.164 format)"
                        />
                      </div>
                      {profileError ? <div className="notice">{profileError}</div> : null}
                      <div className="profile-actions">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={saveProfile}
                          disabled={profileBusy}
                        >
                          {profileBusy ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingProfile(false); setProfileError(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="profile-box">
                    <div><strong>Character:</strong> {currentProfile.character || 'Not set'}</div>
                    <div className="mt-8"><strong>Faction:</strong> {currentProfile.faction || 'Not set'}</div>
                    <div className="mt-8"><strong>Writing style:</strong> {currentProfile.style || 'Not set'}</div>
                    <div className="mt-8"><strong>SMS number:</strong> {currentProfile.phone || 'Not set'}</div>
                    <div className="mt-10">
                      <button
                        type="button"
                        className="btn-soft"
                        style={{ fontSize: 13, padding: '8px 14px' }}
                        onClick={() => {
                          setProfileDraft({
                            characterName: currentProfile.character || '',
                            faction:       currentProfile.faction   || '',
                            styleNotes:    currentProfile.style     || '',
                            phone:         currentProfile.phone     || ''
                          });
                          setEditingProfile(true);
                        }}
                      >
                        Edit profile
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="profile-box">
                  <div className="muted">Admin account does not use a character profile.</div>
                </div>
              )}
            </div>

            <div className="panel-section">
              <h3>Account Settings</h3>
              {accountSuccess ? <div className="success">{accountSuccess}</div> : null}
              {pwSuccess      ? <div className="success">{pwSuccess}</div>      : null}

              {/* ── Name & email ── */}
              {editingAccount ? (
                <div className="profile-box">
                  <div className="profile-edit">
                    <div>
                      <label>Display name</label>
                      <input
                        value={accountDraft.name}
                        onChange={(e) => setAccountDraft((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label>Email address</label>
                      <input
                        type="email"
                        value={accountDraft.email}
                        onChange={(e) => setAccountDraft((p) => ({ ...p, email: e.target.value }))}
                        placeholder="you@example.com"
                      />
                    </div>
                    {accountError ? <div className="notice">{accountError}</div> : null}
                    <div className="profile-actions">
                      <button type="button" className="btn-primary" onClick={saveAccount} disabled={accountBusy}>
                        {accountBusy ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => { setEditingAccount(false); setAccountError(''); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="profile-box">
                  <div><strong>Name:</strong> {data.currentUser.name}</div>
                  <div className="mt-8"><strong>Email:</strong> {data.currentUser.email}</div>
                  <div className="mt-10">
                    <button
                      type="button"
                      className="btn-soft"
                      style={{ fontSize: 13, padding: '8px 14px' }}
                      onClick={() => {
                        setAccountDraft({ name: data.currentUser.name, email: data.currentUser.email });
                        setAccountError('');
                        setAccountSuccess('');
                        setEditingAccount(true);
                      }}
                    >
                      Edit account
                    </button>
                  </div>
                </div>
              )}

              {/* ── Change password ── */}
              {changingPassword ? (
                <div className="profile-box">
                  <div className="profile-edit">
                    <div>
                      <label>Current password</label>
                      <input
                        type="password"
                        value={pwDraft.currentPassword}
                        onChange={(e) => setPwDraft((p) => ({ ...p, currentPassword: e.target.value }))}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <label>New password</label>
                      <input
                        type="password"
                        value={pwDraft.newPassword}
                        onChange={(e) => setPwDraft((p) => ({ ...p, newPassword: e.target.value }))}
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div>
                      <label>Confirm new password</label>
                      <input
                        type="password"
                        value={pwDraft.confirmPassword}
                        onChange={(e) => setPwDraft((p) => ({ ...p, confirmPassword: e.target.value }))}
                        placeholder="Repeat new password"
                      />
                    </div>
                    {pwError ? <div className="notice">{pwError}</div> : null}
                    <div className="profile-actions">
                      <button type="button" className="btn-primary" onClick={savePassword} disabled={pwBusy}>
                        {pwBusy ? 'Saving…' : 'Change password'}
                      </button>
                      <button type="button" onClick={() => { setChangingPassword(false); setPwError(''); setPwDraft({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn-soft"
                    style={{ fontSize: 13, padding: '8px 14px' }}
                    onClick={() => { setChangingPassword(true); setPwError(''); setPwSuccess(''); }}
                  >
                    Change password
                  </button>
                </div>
              )}
            </div>

            <div className="panel-section">
              <h3>Access Rules</h3>
              <div className="announce-item"><p>Users only see chats assigned to them.</p></div>
              <div className="announce-item"><p>The administrator creates rooms, approves users, and controls membership.</p></div>
              <div className="announce-item"><p>Email and SMS notifications are sent to room members when a new message arrives.</p></div>
            </div>
          </div>
        </section>
      </div>

      {/* ── ADMIN ── */}
      <div className={`layout ${tab !== 'admin' ? 'hidden' : ''}`}>
        <section className="card">
          <div className="card-header">
            <h2>Create Room</h2>
            <p>Admin-only controls.</p>
          </div>
          <div className="card-body stack">
            {!isAdmin ? <div className="notice">You are not signed in as the administrator. Admin controls are locked.</div> : null}
            <div>
              <label>Room title</label>
              <input value={newChatTitle} onChange={(e) => setNewChatTitle(e.target.value)} placeholder="Enter private thread name" disabled={!isAdmin} />
            </div>
            <div>
              <label>Description</label>
              <input value={newChatDescription} onChange={(e) => setNewChatDescription(e.target.value)} placeholder="Short description" disabled={!isAdmin} />
            </div>
            <div>
              <label>Assign members</label>
              <div className="stack">
                {data.users.filter((u) => u.role !== 'ADMIN').map((user) => {
                  const active = memberSelection.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={`member-pick ${active ? 'active' : ''}`}
                      disabled={!isAdmin}
                      onClick={() => {
                        setMemberSelection((prev) =>
                          prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                        );
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{user.name}</div>
                      <div className="small">{user.role}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" className="btn-primary btn-full" onClick={createChat} disabled={!isAdmin}>
              Create Private Chat
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Admin Tools</h2>
            <p>Account approvals, announcements, and room membership.</p>
          </div>
          <div className="card-body subgrid">
            <div className="panel-section">
              <h3>Pending Account Requests</h3>
              <div>
                {data.pendingUsers.length ? data.pendingUsers.map((request) => (
                  <div key={request.id} className="request-item">
                    <div style={{ fontWeight: 600 }}>{request.name}</div>
                    <div className="small">{request.email}</div>
                    <div className="row mt-10">
                      <button type="button" className="btn-primary" onClick={() => approveUser(request.id)} disabled={!isAdmin}>
                        Approve writer
                      </button>
                    </div>
                  </div>
                )) : <div className="announce-item"><p>No pending requests.</p></div>}
              </div>
            </div>

            <div className="panel-section">
              <h3>Publish Announcement</h3>
              <input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="Announcement title" disabled={!isAdmin} />
              <textarea value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} placeholder="Announcement text" disabled={!isAdmin} />
              <button type="button" className="btn-primary" onClick={publishAnnouncement} disabled={!isAdmin}>
                Publish Announcement
              </button>
            </div>

            <div className="panel-section">
              <h3>Manage Room Membership</h3>
              <div>
                {data.chats.map((chat) => (
                  <div key={chat.id} className="announce-item">
                    <h4>{chat.title}</h4>
                    <p>{chat.description}</p>
                    <div className="chip-row mt-10">
                      {chat.members.map((memberId) => {
                        const user = data.users.find((u) => u.id === memberId);
                        return <div key={memberId} className="member-chip">{user?.name || 'Unknown'}</div>;
                      })}
                    </div>
                    <div className="mt-10 wrap-buttons">
                      {data.users.filter((u) => u.role !== 'ADMIN').map((user) => {
                        const active = chat.members.includes(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            className={active ? 'btn-primary' : ''}
                            disabled={!isAdmin}
                            onClick={() => toggleChatMember(chat.id, user.id)}
                          >
                            {user.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Notifications</h2>
            <p>How members are alerted to new messages.</p>
          </div>
          <div className="card-body subgrid">
            <div className="announce-item"><p><strong>In-app</strong> — unread count badges appear on chat rooms and the Workspace tab in real time.</p></div>
            <div className="announce-item"><p><strong>Email</strong> — sent via Resend to each member's registered email address when a new message is posted.</p></div>
            <div className="announce-item"><p><strong>SMS</strong> — sent via Twilio to any member who has saved a phone number in their character profile.</p></div>
            <div className="announce-item"><p>Add <code>RESEND_API_KEY</code>, <code>RESEND_FROM_EMAIL</code>, <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, and <code>TWILIO_FROM_NUMBER</code> to your Vercel environment variables to activate.</p></div>
          </div>
        </section>
      </div>

      {/* ── ABOUT ── */}
      <div className={`card ${tab !== 'about' ? 'hidden' : ''}`}>
        <div className="card-header">
          <h2>About StoryCrafter</h2>
          <p>A private, admin-controlled collaborative writing platform.</p>
        </div>
        <div className="card-body subgrid">
          <div className="announce-item"><h4>Platform</h4><p>Built for Next.js on Vercel with Postgres.</p></div>
          <div className="announce-item"><h4>Authentication</h4><p>Session cookies and hashed passwords.</p></div>
          <div className="announce-item"><h4>Persistence</h4><p>All users share one saved database. Messages, rooms, and announcements are stored permanently.</p></div>
          <div className="announce-item"><h4>Notifications</h4><p>In-app unread badges, email via Resend, and SMS via Twilio — all fire automatically when a message is posted.</p></div>
        </div>
      </div>
    </div>
  );
}
