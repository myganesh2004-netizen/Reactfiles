window.initDashboard = function() {
  const sectionButtons = Array.from(document.querySelectorAll('.nav-link'));
  const sectionPanels = {
    dashboard: document.getElementById('section-dashboard'),
    projects: document.getElementById('section-projects'),
    clients: document.getElementById('section-clients'),
    tasks: document.getElementById('section-tasks'),
    invoices: document.getElementById('section-invoices'),
    profile: document.getElementById('section-profile')
  };

  const inputs = {
    projects: document.getElementById('projects-search'),
    clients: document.getElementById('clients-search'),
    tasks: document.getElementById('tasks-search'),
    invoices: document.getElementById('invoices-search')
  };

  const tables = {
    projects: document.getElementById('projects-table'),
    clients: document.getElementById('clients-table'),
    tasks: document.getElementById('tasks-table'),
    invoices: document.getElementById('invoices-table')
  };

  const dashboardStats = document.getElementById('dashboard-stats');
  const sidebarName = document.getElementById('sidebar-name');
  const sidebarEmail = document.getElementById('sidebar-email');
  const chipName = document.getElementById('chip-name');
  const chipEmail = document.getElementById('chip-email');
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const profileAvatar = document.getElementById('profile-avatar');
  const mainTitle = document.getElementById('main-title');

  function updateProfileView() {
    const { name, email } = window.AppState.data.profile;
    const initials = window.getInitials(name);
    sidebarName.textContent = name;
    sidebarEmail.textContent = email;
    chipName.textContent = name;
    chipEmail.textContent = email;
    profileName.textContent = name;
    profileEmail.textContent = email;
    profileAvatar.textContent = initials;
    document.getElementById('profile-avatar').textContent = initials;
    mainTitle.textContent = `Good morning, ${name.split(' ')[0]} 👋`;
  }

  function renderDashboardCards() {
    const metrics = {
      projects: window.AppState.data.projects.length,
      clients: window.AppState.data.clients.length,
      tasks: window.AppState.data.tasks.length,
      invoices: window.AppState.data.invoices.length
    };
    const activeProjects = window.AppState.data.projects.filter(p => p.status === 'Active').length;
    const doneTasks = window.AppState.data.tasks.filter(t => t.status === 'Done').length;
    const paidInvoices = window.AppState.data.invoices.filter(i => i.status === 'Paid').length;
    const cards = [
      { label: 'Projects', value: metrics.projects, sub: `${activeProjects} active`, icon: '🗂' },
      { label: 'Clients', value: metrics.clients, sub: 'All active', icon: '👥' },
      { label: 'Tasks', value: metrics.tasks, sub: `${doneTasks} completed`, icon: '✅' },
      { label: 'Invoices', value: metrics.invoices, sub: `${paidInvoices} paid`, icon: '💼' }
    ];

    dashboardStats.innerHTML = cards.map(card => `
      <div class="stat-card">
        <div class="stat-head"><div class="stat-icon">${card.icon}</div><span class="stat-label">${card.label}</span></div>
        <h2 class="stat-value">${card.value}</h2>
        <p class="stat-sub">${card.sub}</p>
      </div>
    `).join('');
  }

  function renderTable(section, searchTerm = '') {
    const query = searchTerm.toLowerCase();
    const rows = window.AppState.data[section] || [];
    const table = tables[section];
    const filtered = rows.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(query)));

    if (!filtered.length) {
      table.innerHTML = `<tr><td colspan="3" class="muted-text">No records found.</td></tr>`;
      return;
    }

    const renderers = {
      projects: project => `
        <tr>
          <td><strong>${project.name}</strong></td>
          <td><span class="status-pill status-${project.status.toLowerCase().replace(' ', '-')}">${project.status}</span></td>
          <td>${project.deadline}</td>
        </tr>`,
      clients: client => `
        <tr>
          <td><strong>${client.name}</strong></td>
          <td>${client.email}</td>
        </tr>`,
      tasks: task => `
        <tr>
          <td><strong>${task.title}</strong></td>
          <td><span class="status-pill status-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
          <td>${task.due}</td>
        </tr>`,
      invoices: invoice => `
        <tr>
          <td><strong>${invoice.title}</strong></td>
          <td>${invoice.amount}</td>
          <td><span class="status-pill status-${invoice.status.toLowerCase()}">${invoice.status}</span></td>
        </tr>`
    };

    table.innerHTML = filtered.map(renderers[section]).join('');
  }

  window.setActiveSection = function(section) {
    window.AppState.section = section;
    sectionButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.section === section));
    Object.keys(sectionPanels).forEach(key => sectionPanels[key].classList.toggle('hidden', key !== section));
    renderCurrentSection();
  };

  window.renderCurrentSection = function() {
    updateProfileView();
    renderDashboardCards();
    const searchTerm = inputs[window.AppState.section] ? inputs[window.AppState.section].value : '';
    if (['projects', 'clients', 'tasks', 'invoices'].includes(window.AppState.section)) {
      renderTable(window.AppState.section, searchTerm);
    }
  };

  sectionButtons.forEach(button => {
    button.addEventListener('click', () => window.setActiveSection(button.dataset.section));
  });

  Object.values(inputs).forEach(input => {
    input.addEventListener('input', window.renderCurrentSection);
  });

  window.renderCurrentSection();
};
