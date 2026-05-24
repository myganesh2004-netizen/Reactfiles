window.AppState = {
  authenticated: false,
  section: 'dashboard',
  authMode: 'login',
  data: {
    profile: { name: 'Taylor Brooks', email: 'taylor@workdesk.app' },
    projects: [
      { id: 1, name: 'Website Redesign', status: 'Active', deadline: 'Jun 18, 2026' },
      { id: 2, name: 'Mobile App UI', status: 'Completed', deadline: 'May 02, 2026' },
      { id: 3, name: 'Brand Refresh', status: 'Active', deadline: 'Jul 05, 2026' },
      { id: 4, name: 'Marketing Campaign', status: 'Completed', deadline: 'Apr 24, 2026' }
    ],
    clients: [
      { id: 1, name: 'Luna Ventures', email: 'luna@ventures.com' },
      { id: 2, name: 'PixelWave Studio', email: 'hello@pixelwave.studio' },
      { id: 3, name: 'Atlas Co.', email: 'team@atlasco.com' },
      { id: 4, name: 'Nova Labs', email: 'contact@novalabs.io' }
    ],
    tasks: [
      { id: 1, title: 'Finalize proposal', status: 'Done', due: 'May 08, 2026' },
      { id: 2, title: 'Client workshop', status: 'To Do', due: 'May 16, 2026' },
      { id: 3, title: 'Invoice review', status: 'Done', due: 'May 10, 2026' },
      { id: 4, title: 'Design handoff', status: 'To Do', due: 'May 22, 2026' }
    ],
    invoices: [
      { id: 1, title: 'Landing page', amount: '$1,200', status: 'Paid' },
      { id: 2, title: 'Brand kit', amount: '$1,800', status: 'Paid' },
      { id: 3, title: 'Monthly retainer', amount: '$2,170', status: 'Unpaid' }
    ]
  }
};

window.showToast = function(message, type = 'success') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
};

window.validateEmail = function(email) {
  return /^\S+@\S+\.\S+$/.test(email);
};

window.validateSignupPassword = function(password) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
};

window.resetAuthErrors = function(errorElements) {
  Object.values(errorElements).forEach(el => {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('hidden');
  });
};

window.getInitials = function(name) {
  return name.split(' ').map(word => word[0] || '').join('').slice(0, 2).toUpperCase();
};

window.getAppElement = function(id) {
  return document.getElementById(id);
};
