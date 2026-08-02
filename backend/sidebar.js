/* Shared sidebar: profile card, friends/requests tabs, phone search, logout.
   Used by both dashboard.html and chat.html so the two pages feel like one
   continuous app shell. `activeFriendId` (number|null) highlights the open
   conversation when called from the chat page. */

let socket = null;
let currentFriends = [];

function getSocket() {
  if (socket) return socket;
  socket = io({ auth: { token: Session.getToken() } });
  return socket;
}

async function initSidebar({ activeFriendId = null, onFriendsLoaded = null } = {}) {
  const user = Session.getUser();
  if (!user) return;

  document.getElementById('sidebar-name').textContent = user.username;
  document.getElementById('sidebar-phone').textContent = `+${user.phone_number}`;
  document.getElementById('sidebar-avatar').textContent = initials(user.username);

  document.getElementById('logout-btn').addEventListener('click', () => {
    if (socket) socket.disconnect();
    Session.clear();
    window.location.href = '/login';
  });

  setupTabs();
  setupSearch();

  await Promise.all([loadFriends(activeFriendId), loadRequests()]);
  if (onFriendsLoaded) onFriendsLoaded(currentFriends);

  setupRealtime(activeFriendId);
}

function setupTabs() {
  const tabs = document.querySelectorAll('.sidebar-tab');
  const panels = {
    friends: document.getElementById('panel-friends'),
    requests: document.getElementById('panel-requests')
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      Object.entries(panels).forEach(([key, el]) => {
        el.style.display = key === tab.dataset.tab ? 'block' : 'none';
      });
    });
  });
}

function setupSearch() {
  const input = document.getElementById('search-phone');
  const resultBox = document.getElementById('search-result');

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 11);
    if (input.value.length < 11) {
      resultBox.innerHTML = '';
      return;
    }
    runSearch(input.value);
  });

  async function runSearch(phone) {
    resultBox.innerHTML = '<div class="empty-note" style="padding:0.75rem 0;">Searching…</div>';
    try {
      const data = await Api.searchByPhone(phone);
      renderSearchResult(data);
    } catch (err) {
      resultBox.innerHTML = `<div class="field-hint" style="color:var(--coral-dark);padding:0.4rem 0;">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderSearchResult(data) {
    const { user: found, relationship } = data;
    let actionHtml = '';
    if (relationship === 'friends') {
      actionHtml = '<span class="field-hint">Already friends</span>';
    } else if (relationship === 'request_sent') {
      actionHtml = '<span class="field-hint">Request pending</span>';
    } else if (relationship === 'request_received') {
      actionHtml = '<span class="field-hint">They sent you a request — check Requests</span>';
    } else {
      actionHtml = `<button class="btn btn-primary btn-sm" id="send-request-btn">Add friend</button>`;
    }

    resultBox.innerHTML = `
      <div class="friend-row" style="cursor:default;">
        <div class="avatar">${initials(found.username)}</div>
        <div class="profile-meta" style="flex:1;">
          <div class="name">${escapeHtml(found.username)}</div>
        </div>
        ${actionHtml}
      </div>
    `;

    const btn = document.getElementById('send-request-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
          await Api.sendFriendRequest(input.value);
          showToast('Friend request sent.', 'success');
          resultBox.innerHTML = '<span class="field-hint">Request sent</span>';
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Add friend';
        }
      });
    }
  }
}

async function loadFriends(activeFriendId) {
  const list = document.getElementById('friend-list');
  try {
    const { friends } = await Api.listFriends();
    currentFriends = friends;
    if (friends.length === 0) {
      list.innerHTML = '<div class="empty-note">No friends yet. Search a phone number above to add one.</div>';
      return;
    }
    list.innerHTML = friends.map((f) => friendRowHtml(f, f.id === activeFriendId)).join('');
    list.querySelectorAll('.friend-row').forEach((row) => {
      row.addEventListener('click', () => {
        window.location.href = `/chat?friend=${row.dataset.id}`;
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-note">Could not load friends: ${escapeHtml(err.message)}</div>`;
  }
}

function friendRowHtml(friend, isActive) {
  return `
    <div class="friend-row ${isActive ? 'active' : ''}" data-id="${friend.id}">
      <div class="avatar" style="position:relative;">
        ${initials(friend.username)}
        <span class="presence-dot ${friend.online ? 'online' : ''}" data-presence-for="${friend.id}"></span>
      </div>
      <div class="profile-meta" style="flex:1;">
        <div class="name">${escapeHtml(friend.username)}</div>
        <div class="status ${friend.online ? 'online' : ''}" data-status-for="${friend.id}">${friend.online ? 'Online' : 'Offline'}</div>
      </div>
    </div>
  `;
}

async function loadRequests() {
  const list = document.getElementById('request-list');
  const badge = document.getElementById('requests-badge');
  try {
    const { requests } = await Api.receivedRequests();
    if (requests.length === 0) {
      list.innerHTML = '<div class="empty-note">No pending requests.</div>';
      badge.classList.remove('visible');
    } else {
      list.innerHTML = requests.map(requestRowHtml).join('');
      badge.textContent = requests.length;
      badge.classList.add('visible');
      wireRequestActions();
    }
  } catch (err) {
    list.innerHTML = `<div class="empty-note">Could not load requests: ${escapeHtml(err.message)}</div>`;
  }
}

function requestRowHtml(req) {
  return `
    <div class="request-row" data-request-id="${req.id}">
      <div class="top">
        <div class="avatar">${initials(req.sender_username)}</div>
        <div class="profile-meta">
          <div class="name">${escapeHtml(req.sender_username)}</div>
          <div class="when">wants to connect</div>
        </div>
      </div>
      <div class="request-actions">
        <button class="btn btn-primary btn-sm" data-action="accept">Accept</button>
        <button class="btn btn-ghost btn-sm" data-action="ignore">Ignore</button>
      </div>
    </div>
  `;
}

function wireRequestActions() {
  document.querySelectorAll('.request-row').forEach((row) => {
    const id = row.dataset.requestId;
    row.querySelector('[data-action="accept"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await Api.acceptRequest(id);
        showToast('Friend request accepted.', 'success');
        row.remove();
        await loadFriends(null);
        refreshBadgeAfterRemoval();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    row.querySelector('[data-action="ignore"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await Api.ignoreRequest(id);
        row.remove();
        refreshBadgeAfterRemoval();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function refreshBadgeAfterRemoval() {
  const list = document.getElementById('request-list');
  const badge = document.getElementById('requests-badge');
  const remaining = list.querySelectorAll('.request-row').length;
  if (remaining === 0) {
    list.innerHTML = '<div class="empty-note">No pending requests.</div>';
    badge.classList.remove('visible');
  } else {
    badge.textContent = remaining;
  }
}

function setupRealtime(activeFriendId) {
  const s = getSocket();

  s.on('connect_error', () => {
    // Session token likely expired; bounce to login.
    Session.clear();
    window.location.href = '/login';
  });

  s.on('presence_update', ({ userId, online }) => {
    const dot = document.querySelector(`[data-presence-for="${userId}"]`);
    const status = document.querySelector(`[data-status-for="${userId}"]`);
    if (dot) dot.classList.toggle('online', online);
    if (status) {
      status.textContent = online ? 'Online' : 'Offline';
      status.classList.toggle('online', online);
    }
    if (typeof window.onChatHeaderPresence === 'function') {
      window.onChatHeaderPresence(userId, online);
    }
  });

  s.on('friend_request_received', () => {
    showToast('You have a new friend request.');
    loadRequests();
  });

  s.on('friend_request_accepted', ({ friend }) => {
    showToast(`${friend.username} accepted your friend request.`, 'success');
    loadFriends(activeFriendId);
  });

  s.on('typing', ({ userId }) => {
    if (typeof window.onTyping === 'function') {
      window.onTyping(userId);
    }
  });

  // Let the chat page (if open) handle incoming messages itself.
  if (typeof window.onIncomingMessage === 'function') {
    s.on('receive_message', window.onIncomingMessage);
  }
}
