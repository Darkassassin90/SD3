(function () {
  // Already logged in? Skip straight to the app.
  if (Session.isLoggedIn()) {
    window.location.href = '/dashboard';
    return;
  }

  const form = document.getElementById('register-form');
  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const phoneInput = document.getElementById('phone');

  phoneInput.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
  });

  function setError(message) {
    if (!message) {
      errorBox.classList.remove('visible');
      errorBox.textContent = '';
      return;
    }
    errorBox.textContent = message;
    errorBox.classList.add('visible');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<span class="spinner"></span> Creating account…'
      : 'Create account';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError(null);

    const phone_number = phoneInput.value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!/^\d{11}$/.test(phone_number)) {
      setError('Phone number must be exactly 11 digits.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setError('Username must be 3–30 characters: letters, numbers, or underscore.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const data = await Api.register(phone_number, username, password);
      Session.save(data.token, data.user);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  });
})();
