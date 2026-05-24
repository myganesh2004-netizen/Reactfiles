window.initAuth = function() {
  const authMessage = document.getElementById('auth-message');
  const loginFormEl = document.getElementById('login-form');
  const signupFormEl = document.getElementById('signup-form');
  const forgotFormEl = document.getElementById('forgot-form');
  const authShell = document.getElementById('auth-shell');
  const dashboardShell = document.getElementById('dashboard-shell');

  const authModeButtons = {
    showSignup: document.getElementById('show-signup'),
    showLogin: document.getElementById('show-login'),
    forgotLink: document.getElementById('forgot-link'),
    backToLogin: document.getElementById('back-to-login')
  };

  const forms = {
    login: document.getElementById('form-login'),
    signup: document.getElementById('form-signup'),
    forgot: document.getElementById('form-forgot')
  };

  const inputs = {
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    signupName: document.getElementById('signup-name'),
    signupEmail: document.getElementById('signup-email'),
    signupPassword: document.getElementById('signup-password'),
    forgotEmail: document.getElementById('forgot-email')
  };

  const errors = {
    loginEmail: document.getElementById('login-email-error'),
    loginPassword: document.getElementById('login-password-error'),
    loginGeneral: document.getElementById('login-general-error'),
    signupName: document.getElementById('signup-name-error'),
    signupEmail: document.getElementById('signup-email-error'),
    signupPassword: document.getElementById('signup-password-error'),
    signupGeneral: document.getElementById('signup-general-error'),
    forgotEmail: document.getElementById('forgot-email-error')
  };

  function toggleElement(targetEl) {
    loginFormEl.classList.add('hidden');
    signupFormEl.classList.add('hidden');
    forgotFormEl.classList.add('hidden');
    authMessage.classList.add('hidden');
    targetEl.classList.remove('hidden');
  }

  function setAuthMode(mode) {
    window.AppState.authMode = mode;
    window.resetAuthErrors(errors);
    if (mode === 'login') toggleElement(loginFormEl);
    if (mode === 'signup') toggleElement(signupFormEl);
    if (mode === 'forgot') toggleElement(forgotFormEl);
  }

  function switchToDashboard() {
    window.AppState.authenticated = true;
    authShell.classList.add('hidden');
    dashboardShell.classList.remove('hidden');
    if (typeof window.setActiveSection === 'function') {
      window.setActiveSection('dashboard');
    }
    window.showToast('Welcome to WorkDesk!', 'success');
  }

  forms.login.addEventListener('submit', function(event) {
    event.preventDefault();
    window.resetAuthErrors(errors);
    const email = inputs.loginEmail.value.trim();
    const password = inputs.loginPassword.value.trim();
    let valid = true;

    if (!window.validateEmail(email)) {
      errors.loginEmail.textContent = 'Enter a valid email';
      valid = false;
    }
    if (!password) {
      errors.loginPassword.textContent = 'Password is required';
      valid = false;
    }
    if (!valid) return;
    switchToDashboard();
  });

  forms.signup.addEventListener('submit', function(event) {
    event.preventDefault();
    window.resetAuthErrors(errors);
    const name = inputs.signupName.value.trim();
    const email = inputs.signupEmail.value.trim();
    const password = inputs.signupPassword.value.trim();
    let valid = true;

    if (!name) {
      errors.signupName.textContent = 'Full name is required';
      valid = false;
    }
    if (!window.validateEmail(email)) {
      errors.signupEmail.textContent = 'Enter a valid email';
      valid = false;
    }
    if (!window.validateSignupPassword(password)) {
      errors.signupPassword.textContent = 'Must be 8+ chars with letters & numbers';
      valid = false;
    }
    if (!valid) return;

    window.AppState.data.profile.name = name;
    window.AppState.data.profile.email = email;
    switchToDashboard();
    authMessage.textContent = 'Account created! You are now signed in.';
    authMessage.classList.remove('hidden');
  });

  forms.forgot.addEventListener('submit', function(event) {
    event.preventDefault();
    errors.forgotEmail.textContent = '';
    const email = inputs.forgotEmail.value.trim();
    if (!window.validateEmail(email)) {
      errors.forgotEmail.textContent = 'Enter a valid email address';
      return;
    }
    window.showToast(`Reset link sent to ${email}`, 'success');
    setAuthMode('login');
  });

  authModeButtons.showSignup.addEventListener('click', function() {
    setAuthMode('signup');
  });
  authModeButtons.showLogin.addEventListener('click', function() {
    setAuthMode('login');
  });
  authModeButtons.forgotLink.addEventListener('click', function() {
    setAuthMode('forgot');
  });
  authModeButtons.backToLogin.addEventListener('click', function() {
    setAuthMode('login');
  });

  document.getElementById('signout-btn').addEventListener('click', function() {
    window.AppState.authenticated = false;
    authShell.classList.remove('hidden');
    dashboardShell.classList.add('hidden');
    setAuthMode('login');
    window.showToast('Signed out. See you soon!', 'info');
  });

  function togglePassword(buttonId, inputEl) {
    const btn = document.getElementById(buttonId);
    btn.addEventListener('click', function() {
      const show = inputEl.type === 'password';
      inputEl.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
    });
  }

  togglePassword('login-toggle-password', inputs.loginPassword);
  togglePassword('signup-toggle-password', inputs.signupPassword);

  setAuthMode('login');
};
