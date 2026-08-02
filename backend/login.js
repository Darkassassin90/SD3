(function () {
  if (Session.isLoggedIn()) {
    window.location.href = '/dashboard';
    return;
  }

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

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
      ? '<span class="spinner"></span> Logging in…'
      : 'Log in';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError(null);

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    if (!username || !password) {
      setError('Enter both your username and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await Api.login(username, password, rememberMe);
      Session.save(data.token, data.user);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  });
})();
