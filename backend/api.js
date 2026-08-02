/* Shared API helper + session storage.
   Tokens are kept in localStorage so the session survives closing the tab,
   satisfying the "stay logged in until manual logout" requirement. */

const API_BASE = '/api';

const Session = {
  getToken() {
    return localStorage.getItem('mp_token');
  },
  getUser() {
    const raw = localStorage.getItem('mp_user');
    return raw ? JSON.parse(raw) : null;
  },
  save(token, user) {
    localStorage.setItem('mp_token', token);
    localStorage.setItem('mp_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('mp_token');
    localStorage.removeItem('mp_user');
  },
  isLoggedIn() {
    return !!this.getToken();
  }
};

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Session.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    /* empty body */
  }

  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
      Session.clear();
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }

  return data;
}

async function apiUploadRequest(path, { method = 'POST', formData, onProgress } = {}) {
  const token = Session.getToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch (_) {}

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        if (xhr.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
          Session.clear();
          window.location.href = '/login';
        }
        reject(new Error(data.error || 'Something went wrong. Please try again.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Could not reach the server. Check your connection and try again.'));
    };

    xhr.send(formData);
  });
}

const Api = {
  register: (phone_number, username, password) =>
    apiRequest('/auth/register', { method: 'POST', body: { phone_number, username, password } }),

  login: (username, password, rememberMe) =>
    apiRequest('/auth/login', { method: 'POST', body: { username, password, rememberMe } }),

  me: () => apiRequest('/auth/me'),

  listFriends: () => apiRequest('/friends'),

  searchByPhone: (phone) => apiRequest(`/friends/search?phone=${encodeURIComponent(phone)}`),

  sendFriendRequest: (phone_number) =>
    apiRequest('/friends/request', { method: 'POST', body: { phone_number } }),

  receivedRequests: () => apiRequest('/friends/requests/received'),

  sentRequests: () => apiRequest('/friends/requests/sent'),

  acceptRequest: (id) => apiRequest(`/friends/requests/${id}/accept`, { method: 'POST' }),

  ignoreRequest: (id) => apiRequest(`/friends/requests/${id}/ignore`, { method: 'POST' }),

  getMessages: (friendId) => apiRequest(`/messages/${friendId}`),

  sendMessage: (friendId, message_text) =>
    apiRequest(`/messages/${friendId}`, { method: 'POST', body: { message_text } }),

  sendMediaMessage: (friendId, file, message_text, onProgress) => {
    const fd = new FormData();
    fd.append('media', file);
    if (message_text && message_text.trim()) {
      fd.append('message_text', message_text.trim());
    }
    return apiUploadRequest(`/messages/${friendId}`, {
      method: 'POST',
      formData: fd,
      onProgress
    });
  }
};

/* ---- Small shared UI helpers ---- */

function showToast(message, type = '') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function initials(name) {
  if (!name) return '?';
  return name.slice(0, 2).toUpperCase();
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDay(isoString) {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Guard for pages that require a logged-in user. Redirects to /login if absent. */
function requireSession() {
  if (!Session.isLoggedIn()) {
    window.location.href = '/login';
    return false;
  }
  return true;
}
