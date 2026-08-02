(function () {
  if (!requireSession()) return;

  const params = new URLSearchParams(window.location.search);
  const friendId = Number(params.get('friend'));
  const mainPanel = document.getElementById('main-panel');
  const appShell = document.getElementById('app-shell');

  let currentFriend = null;
  let pendingFile = null;
  let pendingFilePreviewUrl = null;
  let pendingUploadRow = null;

  if (!Number.isInteger(friendId) || friendId <= 0) {
    renderEmptyState();
    initSidebar({ activeFriendId: null });
    return;
  }

  window.onIncomingMessage = (message) => {
    if (message.sender_id !== friendId) return;
    appendMessage(message, false);
    scrollToBottom();
  };

  window.onChatHeaderPresence = (userId, online) => {
    if (userId !== friendId) return;
    const statusEl = document.getElementById('chat-status');
    if (statusEl) {
      statusEl.textContent = online ? 'Online' : 'Offline';
      statusEl.classList.toggle('online', online);
    }
  };

  initSidebar({
    activeFriendId: friendId,
    onFriendsLoaded: (friends) => {
      currentFriend = friends.find((f) => f.id === friendId);
      if (!currentFriend) {
        showToast("You're not friends with that user yet.", 'error');
        window.location.href = '/dashboard';
        return;
      }
      renderConversation(currentFriend);
      loadHistory();
    }
  });

  function renderEmptyState() {
    mainPanel.innerHTML = `
      <div class="panel-placeholder">
        <h2>No conversation selected</h2>
        <p>Pick a friend from the sidebar to start chatting.</p>
        <a href="/dashboard" class="btn btn-ghost btn-sm" style="margin-top:1rem;">Back to dashboard</a>
      </div>
    `;
  }

  let typingTimeout = null;
  let lastTypingSentAt = 0;

  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileTypeLabel(file) {
    if (!file || !file.type) return 'file';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  }

  function clearPendingFile() {
    if (pendingFilePreviewUrl) {
      URL.revokeObjectURL(pendingFilePreviewUrl);
      pendingFilePreviewUrl = null;
    }
    pendingFile = null;
    const previewEl = document.getElementById('pending-preview');
    if (previewEl) previewEl.remove();
  }

  function renderPendingPreview() {
    clearPendingFile();

    const composer = document.getElementById('composer-form');
    if (!composer || !pendingFile) return;

    const previewEl = document.createElement('div');
    previewEl.id = 'pending-preview';
    previewEl.className = 'pending-preview';

    const typeLabel = getFileTypeLabel(pendingFile);
    let mediaHtml = '';

    if (typeLabel === 'image') {
      pendingFilePreviewUrl = URL.createObjectURL(pendingFile);
      mediaHtml = `<img src="${pendingFilePreviewUrl}" alt="preview" class="pending-thumb"/>`;
    } else if (typeLabel === 'video') {
      pendingFilePreviewUrl = URL.createObjectURL(pendingFile);
      mediaHtml = `<video src="${pendingFilePreviewUrl}" class="pending-thumb" muted></video>`;
    } else {
      mediaHtml = `<div class="pending-icon">📎</div>`;
    }

    previewEl.innerHTML = `
      <div class="pending-preview-inner">
        ${mediaHtml}
        <div class="pending-meta">
          <div class="pending-name" title="${escapeHtml(pendingFile.name)}">${escapeHtml(pendingFile.name)}</div>
          <div class="pending-size">${formatFileSize(pendingFile.size)}</div>
        </div>
        <button type="button" class="pending-remove" id="pending-remove-btn" aria-label="Remove attachment">&times;</button>
      </div>
    `;

    composer.parentNode.insertBefore(previewEl, composer);

    const removeBtn = document.getElementById('pending-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearPendingFile();
      });
    }
  }

  function renderPendingUploadRow(file) {
    const list = document.getElementById('message-list');
    if (!list) return null;
    if (list.querySelector('.empty-note')) list.innerHTML = '';

    const typeLabel = getFileTypeLabel(file);
    let mediaHtml = '';

    if (typeLabel === 'image' || typeLabel === 'video') {
      const previewUrl = URL.createObjectURL(file);
      if (typeLabel === 'image') {
        mediaHtml = `<img src="${previewUrl}" class="media-thumb pending-media"/>`;
      } else {
        mediaHtml = `<video src="${previewUrl}" class="media-thumb pending-media" muted></video>`;
      }
    } else {
      mediaHtml = `<div class="media-placeholder">📎 ${escapeHtml(file.name)}</div>`;
    }

    const row = document.createElement('div');
    row.className = 'bubble-row mine pending-upload-row';
    row.innerHTML = `
      <div class="bubble">
        ${mediaHtml}
        <div class="upload-progress-wrap">
          <div class="upload-progress-bar" style="width:0%"></div>
          <div class="upload-progress-text">0%</div>
        </div>
      </div>
    `;
    list.appendChild(row);
    scrollToBottom();
    return row;
  }

  function updatePendingUploadProgress(row, percent) {
    if (!row) return;
    const bar = row.querySelector('.upload-progress-bar');
    const text = row.querySelector('.upload-progress-text');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = percent + '%';
  }

  function removePendingUploadRow(row) {
    if (!row) return;
    const img = row.querySelector('img, video');
    if (img && img.src && img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
    row.remove();
  }

  function renderConversation(friend) {
    mainPanel.innerHTML = `
      <div class="chat-header">
        <div class="who">
          <a href="/dashboard" class="back-link" aria-label="Back to friends list">&larr;</a>
          <div class="avatar" style="position:relative;">
            ${initials(friend.username)}
            <span class="presence-dot ${friend.online ? 'online' : ''}" id="chat-presence-dot"></span>
          </div>
          <div>
            <div class="name">${escapeHtml(friend.username)}</div>
            <div class="status ${friend.online ? 'online' : ''}" id="chat-status">${friend.online ? 'Online' : 'Offline'}</div>
          </div>
        </div>
      </div>

      <div class="message-list" id="message-list">
        <div class="empty-note">Loading conversation…</div>
      </div>

      <div class="typing-indicator" id="typing-indicator"></div>

      <input type="file" id="media-file-input" accept="image/*,video/*" style="display:none;" />

      <form class="composer" id="composer-form">
        <button type="button" class="attach-btn" id="attach-btn" aria-label="Attach photo or video" title="Attach photo or video">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea id="message-input" placeholder="Write a message…" rows="1" maxlength="5000"></textarea>
        <button type="submit" class="send-btn" id="send-btn" aria-label="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 11.5L21 3L13 21L11 13L3 11.5Z" stroke="white" stroke-width="1.8" stroke-linejoin="round" fill="white" fill-opacity="0.15"/></svg>
        </button>
      </form>
    `;

    const textarea = document.getElementById('message-input');
    const form = document.getElementById('composer-form');
    const sendBtn = document.getElementById('send-btn');
    const typingIndicator = document.getElementById('typing-indicator');
    const socket = getSocket();
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('media-file-input');

    function clearTypingIndicator() {
      if (typingIndicator) {
        typingIndicator.textContent = '';
      }
    }

    function showTypingIndicator() {
      if (typingIndicator) {
        typingIndicator.textContent = 'Typing...';
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      typingTimeout = window.setTimeout(clearTypingIndicator, 1400);
    }

    function sendTypingEvent() {
      if (!friendId || Date.now() - lastTypingSentAt < 700) return;
      lastTypingSentAt = Date.now();
      socket.emit('typing', { friendId });
    }

    socket.on('typing', ({ userId }) => {
      if (userId !== friendId) return;
      showTypingIndicator();
    });

    window.onTyping = (userId) => {
      if (userId !== friendId) return;
      showTypingIndicator();
    };

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      sendTypingEvent();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    attachBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const allowedImages = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const allowedVideos = ['video/mp4', 'video/webm', 'video/quicktime'];
      const maxImage = 10 * 1024 * 1024;
      const maxVideo = 100 * 1024 * 1024;

      if (![...allowedImages, ...allowedVideos].includes(file.type)) {
        showToast('Only JPG, PNG, GIF, WEBP images and MP4, WEBM, MOV videos are allowed.', 'error');
        fileInput.value = '';
        return;
      }

      if (allowedImages.includes(file.type) && file.size > maxImage) {
        showToast('Image is too large (max 10MB).', 'error');
        fileInput.value = '';
        return;
      }
      if (allowedVideos.includes(file.type) && file.size > maxVideo) {
        showToast('Video is too large (max 100MB).', 'error');
        fileInput.value = '';
        return;
      }

      pendingFile = file;
      fileInput.value = '';
      renderPendingPreview();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = textarea.value;
      const hasText = text && text.trim().length > 0;
      const hasMedia = !!pendingFile;

      if (!hasText && !hasMedia) return;

      sendBtn.disabled = true;
      attachBtn.disabled = true;

      try {
        if (hasMedia) {
          const file = pendingFile;
          const caption = hasText ? text : '';
          pendingUploadRow = renderPendingUploadRow(file);
          clearPendingFile();
          textarea.value = '';
          textarea.style.height = 'auto';

          const { message } = await Api.sendMediaMessage(friendId, file, caption, (percent) => {
            updatePendingUploadProgress(pendingUploadRow, percent);
          });

          removePendingUploadRow(pendingUploadRow);
          pendingUploadRow = null;
          appendMessage(message, true);
          scrollToBottom();
          clearTypingIndicator();
        } else {
          const { message } = await Api.sendMessage(friendId, text);
          appendMessage(message, true);
          textarea.value = '';
          textarea.style.height = 'auto';
          scrollToBottom();
          clearTypingIndicator();
        }
      } catch (err) {
        if (pendingUploadRow) {
          removePendingUploadRow(pendingUploadRow);
          pendingUploadRow = null;
        }
        showToast(err.message, 'error');
      } finally {
        sendBtn.disabled = false;
        attachBtn.disabled = false;
        textarea.focus();
      }
    });
  }

  let lastRenderedDay = null;

  async function loadHistory() {
    const list = document.getElementById('message-list');
    try {
      const { messages } = await Api.getMessages(friendId);
      lastRenderedDay = null;
      if (messages.length === 0) {
        list.innerHTML = '<div class="empty-note">No messages yet — say hello!</div>';
        return;
      }
      list.innerHTML = '';
      messages.forEach((m) => appendMessage(m, m.sender_id !== friendId, { skipScroll: true }));
      scrollToBottom();
    } catch (err) {
      list.innerHTML = `<div class="empty-note">Could not load messages: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderMediaContent(message) {
    if (!message.message_type || message.message_type === 'text') return '';

    const url = message.media_url ? escapeHtml(message.media_url) : '';
    const name = message.media_name ? escapeHtml(message.media_name) : '';
    const size = formatFileSize(message.media_size);

    if (message.message_type === 'image') {
      return `
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="media-link">
          <img src="${url}" alt="${name}" class="media-img" loading="lazy"/>
        </a>
        ${name ? `<div class="media-caption">${name}${size ? ' · ' + size : ''}</div>` : ''}
      `;
    }

    if (message.message_type === 'video') {
      return `
        <video src="${url}" class="media-video" controls preload="metadata" playsinline></video>
        ${name ? `<div class="media-caption">${name}${size ? ' · ' + size : ''}</div>` : ''}
      `;
    }

    return '';
  }

  function appendMessage(message, isMine, { skipScroll = false } = {}) {
    const list = document.getElementById('message-list');
    if (!list) return;

    if (list.querySelector('.empty-note')) list.innerHTML = '';

    const day = formatDay(message.timestamp);
    if (day !== lastRenderedDay) {
      const divider = document.createElement('div');
      divider.className = 'day-divider';
      divider.textContent = day;
      list.appendChild(divider);
      lastRenderedDay = day;
    }

    const isMedia = message.message_type && message.message_type !== 'text';
    const hasText = message.message_text && String(message.message_text).trim().length > 0;

    const row = document.createElement('div');
    row.className = `bubble-row ${isMine ? 'mine' : 'theirs'}${isMedia ? ' has-media' : ''}`;

    const mediaHtml = renderMediaContent(message);
    const textHtml = hasText ? `<div class="bubble-text">${escapeHtml(message.message_text)}</div>` : '';

    row.innerHTML = `
      <div class="bubble">
        ${mediaHtml}
        ${textHtml}
        <span class="time">${formatTime(message.timestamp)}</span>
      </div>
    `;
    list.appendChild(row);
  }

  function scrollToBottom() {
    const list = document.getElementById('message-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  if (window.innerWidth <= 760) {
    appShell.classList.add('show-main');
  }
})();
