import { 
  auth, 
  db,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from './firebase-config.js';

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
const S = {
  auth: false,
  section: 'dashboard',
  nextId: 1,
  profile: { name: 'WorkDesk User', email: '', title: 'Freelancer', location: '' },
  projects: [],
  clients: [],
  tasks: [],
  invoices: []
};

const LEGACY_DEMO_SIGNATURE = {
  projects: ['Website Redesign','Mobile App UI','Brand Refresh','Marketing Campaign'],
  clients: ['Luna Ventures','PixelWave Studio','Atlas Co.','Nova Labs'],
  tasks: ['Finalise proposal','Client workshop prep','Invoice review','Design handoff'],
  invoices: ['Landing page','Brand kit','Monthly retainer']
};

const WORKSPACE_KEYS = ['nextId','profile','projects','clients','tasks','invoices'];
const DEFAULT_WORKSPACE = JSON.parse(JSON.stringify(
  WORKSPACE_KEYS.reduce((acc,key)=>{ acc[key] = S[key]; return acc; }, {})
));
let currentUser = null;

function clone(data){ return JSON.parse(JSON.stringify(data)); }
function workspaceRef(uid){ return doc(db, 'users', uid, 'private', 'workspace'); }
function workspaceSnapshot(){
  return {
    nextId: S.nextId,
    profile: S.profile,
    projects: S.projects,
    clients: S.clients,
    tasks: S.tasks,
    invoices: S.invoices,
    updatedAt: serverTimestamp()
  };
}
function isLegacyDemoWorkspace(data){
  if(!data) return false;
  return Object.entries(LEGACY_DEMO_SIGNATURE).every(([key,names])=>{
    const items = Array.isArray(data[key]) ? data[key] : [];
    const itemNames = items.map(item=>item.name || item.title);
    return items.length === names.length && names.every(name=>itemNames.includes(name));
  });
}
function applyWorkspace(data={}, user=null){
  const base = clone(DEFAULT_WORKSPACE);
  if(isLegacyDemoWorkspace(data)) data = {};
  WORKSPACE_KEYS.forEach(key=>{
    S[key] = data[key] ?? base[key];
  });
  if(user){
    S.profile = {
      ...base.profile,
      ...S.profile,
      name: S.profile.name || user.displayName || user.email?.split('@')[0] || 'WorkDesk User',
      email: user.email || S.profile.email
    };
  }
}
async function loadUserWorkspace(user){
  currentUser = user;
  const snap = await getDoc(workspaceRef(user.uid));
  if(snap.exists()){
    const data = snap.data();
    const resetLegacyDemo = isLegacyDemoWorkspace(data);
    applyWorkspace(data, user);
    if(resetLegacyDemo) await setDoc(workspaceRef(user.uid), workspaceSnapshot(), { merge:true });
  } else {
    applyWorkspace({}, user);
    await setDoc(workspaceRef(user.uid), {
      ...workspaceSnapshot(),
      createdAt: serverTimestamp()
    }, { merge:true });
  }
}
async function saveUserWorkspace(){
  if(!currentUser) return;
  await setDoc(workspaceRef(currentUser.uid), workspaceSnapshot(), { merge:true });
}
function renderAndSave(message, type='success'){
  renderAll();
  saveUserWorkspace().catch((error)=>{
    console.error('Workspace save failed', error);
    toast('Could not save to Firebase. Check Firestore rules.','error');
  });
  if(message) toast(message,type);
}

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function $(id){ return document.getElementById(id) }
function el(tag,cls,html){ const e=document.createElement(tag); if(cls)e.className=cls; if(html!==undefined)e.innerHTML=html; return e }
function toast(msg, type='success'){
  const icons = { success:'✓', error:'✕', info:'ℹ' };
  const t = el('div',`toast toast-${type}`);
  t.innerHTML = `<span class="toast-icon">${icons[type]||'✓'}</span><span>${msg}</span>`;
  $('toast-container').appendChild(t);
  setTimeout(()=>t.remove(), 4000);
}
function initials(name){ return name.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase() }
function validateEmail(e){ return /^\S+@\S+\.\S+$/.test(e) }
function validatePw(p){ return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p) }
function friendlyAuthError(error){
  const messages = {
    'auth/invalid-credential':'Invalid email or password.',
    'auth/user-not-found':'No account found with this email.',
    'auth/wrong-password':'Invalid email or password.',
    'auth/email-already-in-use':'An account already exists with this email.',
    'auth/popup-blocked':'The browser blocked the Google sign-in popup.',
    'auth/unauthorized-domain':'This domain is not authorized in Firebase Authentication.'
  };
  return messages[error.code] || error.message || 'Authentication failed. Please try again.';
}
function friendlyFirestoreError(error){
  const messages = {
    'permission-denied':'Firestore denied access. Deploy the rules in firestore.rules to allow each signed-in user to access only their own workspace.',
    'not-found':'Firestore database was not found. Create a Firestore database in Firebase Console first.',
    'unavailable':'Firestore is unavailable right now. Check your connection and Firebase project status.'
  };
  return messages[error.code] || error.message || 'Could not access Firebase Firestore.';
}
function pwStrength(p){
  if(!p) return 0;
  let s=0;
  if(p.length>=8)s++;
  if(/[A-Z]/.test(p))s++;
  if(/\d/.test(p))s++;
  if(/[^A-Za-z0-9]/.test(p))s++;
  return s;
}
function pill(status){
  const k = status.toLowerCase().replace(/\s+/g,'-');
  return `<span class="pill pill-${k}">${status}</span>`;
}
function fmtDate(d){ return d||'—' }
function moneyValue(amount){
  if(typeof amount === 'number') return amount;
  const cleaned = String(amount||'').replace(/[^0-9.-]/g,'');
  return Number(cleaned) || 0;
}
function fmtMoney(value){
  return `$${Math.round(value).toLocaleString()}`;
}

/* ═══════════════════════════════════════════════
   MODAL SYSTEM
═══════════════════════════════════════════════ */
let _onConfirm = null;
function openModal(title, bodyHTML, confirmLabel, onConfirm, isDanger=false){
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHTML;
  $('modal-footer').innerHTML = `
    <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
    <button class="btn ${isDanger?'btn-danger':'btn-primary'}" id="modal-confirm" style="padding:11px 20px">${confirmLabel}</button>
  `;
  _onConfirm = onConfirm;
  $('modal-confirm').onclick = ()=>{ if(_onConfirm) _onConfirm(); };
  $('modal-cancel').onclick = closeModal;
  $('modal-overlay').classList.remove('hidden');
}
function closeModal(){ $('modal-overlay').classList.add('hidden'); _onConfirm=null; }
$('modal-close').onclick = closeModal;
$('modal-overlay').addEventListener('click',e=>{ if(e.target===$('modal-overlay')) closeModal(); });

/* ═══════════════════════════════════════════════
   REVENUE CHART (SVG)
═══════════════════════════════════════════════ */
const revenueData = [0,0,0,0,0,0,0];
function buildChart(){
  const svg = $('revenue-chart');
  const W=600, H=140, pad=20;
  const min = Math.min(...revenueData)-200;
  const max = Math.max(...revenueData)+200;
  const range = max-min || 1;
  const pts = revenueData.map((v,i)=>({
    x: pad + (i/(revenueData.length-1))*(W-2*pad),
    y: H-pad - ((v-min)/range)*(H-2*pad)
  }));

  // Grid lines
  let gridHTML = '';
  for(let i=0;i<4;i++){
    const y = pad + (i/3)*(H-2*pad);
    gridHTML += `<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="rgba(255,255,255,.04)" stroke-width="1"/>`;
  }

  // Smooth bezier path
  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  for(let i=1;i<pts.length;i++){
    const p=pts[i-1], c=pts[i];
    const cx=(p.x+c.x)/2;
    linePath += ` C ${cx} ${p.y} ${cx} ${c.y} ${c.x} ${c.y}`;
  }
  const areaPath = linePath + ` L ${pts[pts.length-1].x} ${H} L ${pts[0].x} ${H} Z`;

  // Dots & interactive areas
  const dotsHTML = pts.map((p,i)=>`
    <circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="5" fill="#22d3ee" stroke="#060a15" stroke-width="2.5" style="opacity:0;transition:opacity .15s" data-idx="${i}"/>
    <rect x="${p.x-30}" y="0" width="60" height="${H}" fill="transparent" class="chart-hit" data-idx="${i}"/>
  `).join('');

  svg.innerHTML = `
    <defs>
      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity=".22"/>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridHTML}
    <path d="${areaPath}" fill="url(#cg)"/>
    <path d="${linePath}" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dotsHTML}
  `;

  const tooltip = $('chart-tooltip');
  const months = ['Nov','Dec','Jan','Feb','Mar','Apr','May'];
  svg.querySelectorAll('.chart-hit').forEach(hit=>{
    const i = parseInt(hit.dataset.idx);
    const dot = svg.querySelectorAll('.chart-dot')[i];
    hit.addEventListener('mouseenter',e=>{
      dot.style.opacity='1';
      tooltip.textContent = `${months[i]}: $${revenueData[i].toLocaleString()}`;
      tooltip.style.opacity='1';
      const rect = svg.getBoundingClientRect();
      const wr = svg.parentElement.getBoundingClientRect();
      tooltip.style.left = `${pts[i].x*(wr.width/W)-40}px`;
      tooltip.style.top = `${pts[i].y*(140/H)-36}px`;
    });
    hit.addEventListener('mouseleave',()=>{
      dot.style.opacity='0';
      tooltip.style.opacity='0';
    });
  });
}

/* ═══════════════════════════════════════════════
   RENDER FUNCTIONS
═══════════════════════════════════════════════ */
function renderProfile(){
  const { name, email } = S.profile;
  const init = initials(name);
  ['sb-avatar','chip-av','profile-avatar','mobile-avatar'].forEach(id=>{
    const e=$(id); if(e) e.textContent=init;
  });
  if($('sb-name')) $('sb-name').textContent = name;
  if($('sb-email')) $('sb-email').textContent = email;
  if($('chip-name')) $('chip-name').textContent = name;
  if($('chip-email')) $('chip-email').textContent = email;
  if($('profile-name')) $('profile-name').textContent = name;
  if($('profile-email')) $('profile-email').textContent = email;
  if($('main-title')) $('main-title').textContent = `Good morning, ${name.split(' ')[0]} 👋`;
  if($('p-name')) $('p-name').value = name;
  if($('p-email')){
    $('p-email').value = currentUser?.email || email;
    $('p-email').readOnly = true;
  }
  if($('p-title')) $('p-title').value = S.profile.title || '';
  if($('p-location')) $('p-location').value = S.profile.location || '';
  if($('ps-projects')) $('ps-projects').textContent = S.projects.length;
  if($('ps-clients')) $('ps-clients').textContent = S.clients.length;
  if($('ps-tasks')) $('ps-tasks').textContent = S.tasks.length;
  if($('ps-invoices')) $('ps-invoices').textContent = S.invoices.length;
}

function renderStats(){
  const active = S.projects.filter(p=>p.status==='Active').length;
  const done = S.tasks.filter(t=>t.status==='Done').length;
  const paid = S.invoices.filter(i=>i.status==='Paid').length;
  if($('dashboard-kicker')){
    const openTasks = S.tasks.filter(t=>t.status!=='Done').length;
    $('dashboard-kicker').textContent = `${active} active projects | ${openTasks} open tasks`;
  }
  const cards = [
    { section:'projects', color:'sc-cyan', icon:'🗂', value:S.projects.length, label:'Projects', sub:`${active} active`, badge:'↑', cls:'sb-up' },
    { section:'clients', color:'sc-violet', icon:'👥', value:S.clients.length, label:'Clients', sub:'All active', badge:'→', cls:'sb-neutral' },
    { section:'tasks', color:'sc-green', icon:'✅', value:S.tasks.length, label:'Tasks', sub:`${done} completed`, badge:'↑', cls:'sb-up' },
    { section:'invoices', color:'sc-amber', icon:'💼', value:S.invoices.length, label:'Invoices', sub:`${paid} paid`, badge:'↑', cls:'sb-up' }
  ];
  $('stats-grid').innerHTML = cards.map(c=>`
    <button class="stat-card ${c.color}" type="button" data-open-section="${c.section}" aria-label="Open ${c.label}">
      <div class="stat-head">
        <div class="stat-icon">${c.icon}</div>
        <span class="stat-badge ${c.cls}">${c.badge}</span>
      </div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-lbl">${c.label}</div>
      <div class="stat-sub">${c.sub}</div>
    </button>
  `).join('');
}

function renderDashRecent(){
  const proj = S.projects.slice(-3).reverse();
  $('dash-projects').innerHTML = proj.map(p=>`
    <tr class="mini-row" data-open-section="projects" data-project-id="${p.id}">
      <td><strong>${p.name}</strong><br/><small>${p.deadline}</small></td>
      <td style="text-align:right">${pill(p.status)}</td>
    </tr>
  `).join('') || '<tr><td class="table-empty">No projects yet</td></tr>';

  const tasks = S.tasks.filter(t=>t.status==='To Do').slice(0,4);
  $('dash-tasks').innerHTML = tasks.map(t=>`
    <tr><td><strong>${t.title}</strong><br/><small>Due ${t.due}</small></td><td style="text-align:right">${pill(t.status)}</td></tr>
  `).join('') || '<tr><td class="table-empty">All caught up!</td></tr>';

  const paidTotal = S.invoices.filter(i=>i.status==='Paid').reduce((sum,i)=>sum+moneyValue(i.amount),0);
  const unpaidTotal = S.invoices.filter(i=>i.status!=='Paid').reduce((sum,i)=>sum+moneyValue(i.amount),0);
  const total = paidTotal + unpaidTotal;
  if($('rev-paid')) $('rev-paid').textContent = fmtMoney(paidTotal);
  if($('rev-unpaid')) $('rev-unpaid').textContent = fmtMoney(unpaidTotal);
  if($('rev-total')) $('rev-total').textContent = fmtMoney(total);
  if($('revenue-sub')) $('revenue-sub').textContent = total ? `${S.invoices.length} invoices tracked` : 'No invoices yet';
  if($('revenue-trend')) $('revenue-trend').textContent = total ? `${paidTotal ? Math.round((paidTotal/total)*100) : 0}% paid` : '0%';
  if($('invoice-summary')){
    $('invoice-summary').innerHTML = `
      <div class="invoice-summary-row"><span class="invoice-summary-label">Paid invoices</span><span class="invoice-summary-value">${paidTotal ? fmtMoney(paidTotal) : '$0'}</span></div>
      <div class="invoice-summary-row"><span class="invoice-summary-label">Unpaid invoices</span><span class="invoice-summary-value">${unpaidTotal ? fmtMoney(unpaidTotal) : '$0'}</span></div>
      <div class="invoice-summary-row"><span class="invoice-summary-label">Total invoices</span><span class="invoice-summary-value">${S.invoices.length}</span></div>
    `;
  }
}

function renderTable(section, search=''){
  const q = search.toLowerCase();
  function rowActions(id, extra=''){
    return `<td><div class="row-actions">${extra}<button class="action-btn del" data-id="${id}" data-section="${section}" title="Delete">🗑</button></div></td>`;
  }

  const renderers = {
    projects: (items) => {
      const filtered = items.filter(p=>
        p.name.toLowerCase().includes(q)||p.status.toLowerCase().includes(q)||p.deadline.toLowerCase().includes(q)
      );
      if(!filtered.length) return '<tr><td colspan="4" class="table-empty">No projects found.</td></tr>';
      return filtered.map(p=>`
        <tr data-project-row="${p.id}">
          <td><strong>${p.name}</strong></td>
          <td>${pill(p.status)}</td>
          <td>${fmtDate(p.deadline)}</td>
          ${rowActions(p.id)}
        </tr>`).join('');
    },
    clients: (items) => {
      const filtered = items.filter(c=>
        c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q)||(c.company||'').toLowerCase().includes(q)
      );
      if(!filtered.length) return '<tr><td colspan="4" class="table-empty">No clients found.</td></tr>';
      return filtered.map(c=>`
        <tr>
          <td><strong>${c.name}</strong></td>
          <td>${c.email}</td>
          <td>${c.company||'—'}</td>
          ${rowActions(c.id)}
        </tr>`).join('');
    },
    tasks: (items) => {
      const filtered = items.filter(t=>
        t.title.toLowerCase().includes(q)||t.status.toLowerCase().includes(q)||t.due.toLowerCase().includes(q)
      );
      if(!filtered.length) return '<tr><td colspan="4" class="table-empty">No tasks found.</td></tr>';
      return filtered.map(t=>`
        <tr>
          <td><strong>${t.title}</strong></td>
          <td>${pill(t.status)}</td>
          <td>${fmtDate(t.due)}</td>
          <td><div class="row-actions">
            ${t.status!=='Done'?`<button class="action-btn done-btn" data-id="${t.id}" data-section="tasks" title="Mark Done">✓</button>`:''}
            <button class="action-btn del" data-id="${t.id}" data-section="tasks" title="Delete">🗑</button>
          </div></td>
        </tr>`).join('');
    },
    invoices: (items) => {
      const filtered = items.filter(i=>
        i.title.toLowerCase().includes(q)||i.status.toLowerCase().includes(q)||(i.client||'').toLowerCase().includes(q)
      );
      if(!filtered.length) return '<tr><td colspan="5" class="table-empty">No invoices found.</td></tr>';
      return filtered.map(i=>`
        <tr>
          <td><strong>${i.title}</strong></td>
          <td>${i.client||'—'}</td>
          <td style="font-family:var(--font-d);font-weight:600">${i.amount}</td>
          <td>${pill(i.status)}</td>
          <td><div class="row-actions">
            ${i.status!=='Paid'?`<button class="action-btn pay-btn" data-id="${i.id}" data-section="invoices" title="Mark Paid">✓</button>`:''}
            <button class="action-btn del" data-id="${i.id}" data-section="invoices" title="Delete">🗑</button>
          </div></td>
        </tr>`).join('');
    }
  };

  const tbody = {
    projects:'projects-tbody', clients:'clients-tbody',
    tasks:'tasks-tbody', invoices:'invoices-tbody'
  }[section];
  if(tbody && renderers[section]) $(tbody).innerHTML = renderers[section](S[section]);
}

function renderAll(){
  renderProfile();
  renderStats();
  renderDashRecent();
  renderTable('projects', ($('proj-search')||{value:''}).value);
  renderTable('clients', ($('client-search')||{value:''}).value);
  renderTable('tasks', ($('task-search')||{value:''}).value);
  renderTable('invoices', ($('inv-search')||{value:''}).value);
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */
const sections = ['dashboard','projects','clients','tasks','invoices','profile'];
function setSection(name){
  S.section = name;
  sections.forEach(s=>{
    const el = $(`section-${s}`);
    if(el) el.classList.toggle('hidden', s!==name);
  });
  document.querySelectorAll('.nav-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.section===name);
  });
  renderAll();
}
function openSection(name, options={}){
  if(!sections.includes(name)) return;
  setSection(name);
  if(options.projectId){
    requestAnimationFrame(()=>{
      const row = document.querySelector(`[data-project-row="${options.projectId}"]`);
      if(!row) return;
      row.scrollIntoView({ behavior:'smooth', block:'center' });
      row.classList.add('row-highlight');
      setTimeout(()=>row.classList.remove('row-highlight'), 1600);
    });
  }
}

document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    openSection(btn.dataset.section);
    // close mobile sidebar
    $('sidebar').classList.remove('open');
    $('sb-overlay').classList.add('hidden');
  });
});

$('stats-grid').addEventListener('click',e=>{
  const target = e.target.closest('[data-open-section]');
  if(target) openSection(target.dataset.openSection);
});

$('dash-projects').addEventListener('click',e=>{
  const target = e.target.closest('[data-open-section]');
  if(!target) return;
  openSection(target.dataset.openSection, { projectId:target.dataset.projectId });
});

$('section-dashboard').addEventListener('click',e=>{
  const target = e.target.closest('[data-open-section]');
  if(!target || target.closest('#stats-grid') || target.closest('#dash-projects')) return;
  openSection(target.dataset.openSection);
});

// Hamburger
$('hamburger').addEventListener('click',()=>{
  $('sidebar').classList.toggle('open');
  $('sb-overlay').classList.toggle('hidden');
});
$('sb-overlay').addEventListener('click',()=>{
  $('sidebar').classList.remove('open');
  $('sb-overlay').classList.add('hidden');
});

// Search
['proj-search','client-search','task-search','inv-search'].forEach(id=>{
  const map = {'proj-search':'projects','client-search':'clients','task-search':'tasks','inv-search':'invoices'};
  const el = $(id);
  if(el) el.addEventListener('input',()=>renderTable(map[id],el.value));
});

/* ═══════════════════════════════════════════════
   TABLE ACTIONS (delegation)
═══════════════════════════════════════════════ */
document.querySelectorAll('.data-table').forEach(t=>{
  t.addEventListener('click',e=>{
    const btn = e.target.closest('[data-id][data-section]');
    if(!btn) return;
    const id = parseInt(btn.dataset.id);
    const section = btn.dataset.section;

    if(btn.classList.contains('del')){
      const item = S[section].find(x=>x.id===id);
      if(!item) return;
      openModal(
        'Confirm Delete',
        `<p style="color:var(--muted)">Are you sure you want to delete <strong style="color:var(--text)">"${item.name||item.title}"</strong>? This cannot be undone.</p>`,
        'Delete', ()=>{
          S[section] = S[section].filter(x=>x.id!==id);
          closeModal();
          renderAndSave('Item deleted.','info');
        }, true
      );
    } else if(btn.classList.contains('done-btn')){
      const task = S.tasks.find(x=>x.id===id);
      if(task){ task.status='Done'; renderAndSave('Task marked as done!','success'); }
    } else if(btn.classList.contains('pay-btn')){
      const inv = S.invoices.find(x=>x.id===id);
      if(inv){ inv.status='Paid'; renderAndSave('Invoice marked as paid!','success'); }
    }
  });
});

/* ═══════════════════════════════════════════════
   ADD MODALS
═══════════════════════════════════════════════ */
$('add-project-btn').addEventListener('click',()=>{
  openModal('Add Project',`
    <div class="field"><div class="field-label"><label>Project Name</label></div>
      <input id="m-proj-name" class="field-input" placeholder="e.g. Website Redesign"/><div class="field-error" id="m-proj-name-err"></div></div>
    <div class="field"><div class="field-label"><label>Status</label></div>
      <select id="m-proj-status" class="field-input"><option>Active</option><option>In Progress</option><option>Completed</option></select></div>
    <div class="field"><div class="field-label"><label>Deadline</label></div>
      <input id="m-proj-deadline" class="field-input" type="text" placeholder="e.g. Jun 30, 2026"/></div>
  `,'Add Project',()=>{
    const name = $('m-proj-name').value.trim();
    if(!name){ $('m-proj-name-err').textContent='Name is required'; return; }
    S.projects.push({ id:S.nextId++, name, status:$('m-proj-status').value, deadline:$('m-proj-deadline').value||'TBD' });
    closeModal(); renderAndSave('Project added!','success');
  });
});

$('add-client-btn').addEventListener('click',()=>{
  openModal('Add Client',`
    <div class="field"><div class="field-label"><label>Name</label></div>
      <input id="m-client-name" class="field-input" placeholder="e.g. Jane Smith"/><div class="field-error" id="m-client-name-err"></div></div>
    <div class="field"><div class="field-label"><label>Email</label></div>
      <input id="m-client-email" class="field-input" type="email" placeholder="jane@company.com"/><div class="field-error" id="m-client-email-err"></div></div>
    <div class="field"><div class="field-label"><label>Company</label></div>
      <input id="m-client-company" class="field-input" placeholder="e.g. Acme Corp"/></div>
  `,'Add Client',()=>{
    const name = $('m-client-name').value.trim();
    const email = $('m-client-email').value.trim();
    let ok=true;
    if(!name){ $('m-client-name-err').textContent='Name is required'; ok=false; }
    if(!validateEmail(email)){ $('m-client-email-err').textContent='Valid email required'; ok=false; }
    if(!ok) return;
    S.clients.push({ id:S.nextId++, name, email, company:$('m-client-company').value.trim()||'—' });
    closeModal(); renderAndSave('Client added!','success');
  });
});

$('add-task-btn').addEventListener('click',()=>{
  openModal('Add Task',`
    <div class="field"><div class="field-label"><label>Task Title</label></div>
      <input id="m-task-title" class="field-input" placeholder="e.g. Send proposal"/><div class="field-error" id="m-task-title-err"></div></div>
    <div class="field"><div class="field-label"><label>Status</label></div>
      <select id="m-task-status" class="field-input"><option>To Do</option><option>In Progress</option><option>Done</option></select></div>
    <div class="field"><div class="field-label"><label>Due Date</label></div>
      <input id="m-task-due" class="field-input" type="text" placeholder="e.g. Jun 01, 2026"/></div>
  `,'Add Task',()=>{
    const title = $('m-task-title').value.trim();
    if(!title){ $('m-task-title-err').textContent='Title is required'; return; }
    S.tasks.push({ id:S.nextId++, title, status:$('m-task-status').value, due:$('m-task-due').value||'TBD' });
    closeModal(); renderAndSave('Task added!','success');
  });
});

$('add-invoice-btn').addEventListener('click',()=>{
  const clientOpts = S.clients.map(c=>`<option>${c.name}</option>`).join('');
  openModal('Add Invoice',`
    <div class="field"><div class="field-label"><label>Description</label></div>
      <input id="m-inv-title" class="field-input" placeholder="e.g. Logo design"/><div class="field-error" id="m-inv-title-err"></div></div>
    <div class="field"><div class="field-label"><label>Client</label></div>
      <select id="m-inv-client" class="field-input"><option value="">-- select --</option>${clientOpts}</select></div>
    <div class="field"><div class="field-label"><label>Amount</label></div>
      <input id="m-inv-amount" class="field-input" placeholder="e.g. $1,500"/><div class="field-error" id="m-inv-amount-err"></div></div>
    <div class="field"><div class="field-label"><label>Status</label></div>
      <select id="m-inv-status" class="field-input"><option>Unpaid</option><option>Paid</option></select></div>
  `,'Add Invoice',()=>{
    const title = $('m-inv-title').value.trim();
    const amount = $('m-inv-amount').value.trim();
    let ok=true;
    if(!title){ $('m-inv-title-err').textContent='Description is required'; ok=false; }
    if(!amount){ $('m-inv-amount-err').textContent='Amount is required'; ok=false; }
    if(!ok) return;
    S.invoices.push({ id:S.nextId++, title, client:$('m-inv-client').value||'—', amount, status:$('m-inv-status').value });
    closeModal(); renderAndSave('Invoice added!','success');
  });
});

/* ═══════════════════════════════════════════════
   PROFILE SAVE
═══════════════════════════════════════════════ */
$('save-profile-btn').addEventListener('click',()=>{
  const name = $('p-name').value.trim();
  const email = currentUser?.email || $('p-email').value.trim();
  if(!name){ toast('Name is required.','error'); return; }
  if(!validateEmail(email)){ toast('Valid email is required.','error'); return; }
  S.profile.name = name;
  S.profile.email = email;
  S.profile.title = $('p-title').value.trim();
  S.profile.location = $('p-location').value.trim();
  renderAndSave('Profile saved!','success');
});
$('cancel-profile-btn').addEventListener('click',()=>{ renderAll(); toast('Changes discarded.','info'); });

/* ═══════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════ */
function setAuthMode(mode){
  ['login-form','signup-form','forgot-form'].forEach(id=>$(id).classList.add('hidden'));
  $(`${mode}-form`).classList.remove('hidden');
  $('auth-message').classList.add('hidden');
  // clear errors
  document.querySelectorAll('.field-error').forEach(e=>e.textContent='');
  document.querySelectorAll('.auth-msg').forEach(e=>e.classList.add('hidden'));
}

function switchToDashboard(){
  S.auth = true;
  $('auth-shell').classList.add('hidden');
  $('dashboard-shell').classList.remove('hidden');
  setSection('dashboard');
  buildChart();
}

// Login
$('form-login').addEventListener('submit', async e=>{
  e.preventDefault();
  $('login-email-err').textContent='';
  $('login-pw-err').textContent='';
  $('login-general-err').classList.add('hidden');
  const email = $('login-email').value.trim();
  const pw = $('login-password').value.trim();
  let ok=true;
  if(!validateEmail(email)){ $('login-email-err').textContent='Enter a valid email'; ok=false; }
  if(!pw){ $('login-pw-err').textContent='Password is required'; ok=false; }
  if(!ok) return;
  
  const btn = $('form-login').querySelector('button[type="submit"]');
  try {
    btn.disabled = true;
    btn.textContent = 'Signing In...';
    await signInWithEmailAndPassword(auth, email, pw);
    toast('Welcome back to WorkDesk!','success');
  } catch (error) {
    $('login-general-err').textContent = error.message;
    $('login-general-err').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
});

// Signup
const pwInput = $('signup-password');
pwInput.addEventListener('input',()=>{
  const strength = pwStrength(pwInput.value);
  const labels = ['','Weak','Fair','Good','Strong'];
  const classes = ['','s1','s2','s3','s4'];
  for(let i=1;i<=4;i++){
    const bar = $(`sb${i}`);
    bar.className = 's-bar';
    if(i<=strength) bar.classList.add(classes[strength]);
  }
  $('strength-lbl').textContent = labels[strength]||'';
});

$('form-signup').addEventListener('submit', async e=>{
  e.preventDefault();
  const name=$('signup-name').value.trim();
  const email=$('signup-email').value.trim();
  const pw=$('signup-password').value.trim();
  let ok=true;
  document.querySelectorAll('#signup-form .field-error').forEach(e=>e.textContent='');
  $('signup-general-err').classList.add('hidden');
  if(!name){ $('signup-name-err').textContent='Full name is required'; ok=false; }
  if(!validateEmail(email)){ $('signup-email-err').textContent='Enter a valid email'; ok=false; }
  if(!validatePw(pw)){ $('signup-pw-err').textContent='8+ chars with letters & numbers'; ok=false; }
  if(!ok) return;
  
  const btn = $('form-signup').querySelector('button[type="submit"]');
  try {
    btn.disabled = true;
    btn.textContent = 'Creating Account...';
    const credential = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(credential.user, { displayName:name });
    S.profile.name = name;
    S.profile.email = email;
    currentUser = credential.user;
    try {
      await setDoc(workspaceRef(credential.user.uid), {
        ...workspaceSnapshot(),
        createdAt: serverTimestamp()
      }, { merge:true });
    } catch (storeError) {
      console.error('Workspace create failed', storeError);
      toast(friendlyFirestoreError(storeError),'error');
    }
    toast('Account created! Welcome to WorkDesk 🎉','success');
  } catch (error) {
    $('signup-general-err').textContent = error.message;
    $('signup-general-err').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account →';
  }
});

// Forgot
$('form-forgot').addEventListener('submit', async e=>{
  e.preventDefault();
  $('forgot-email-err').textContent='';
  const email=$('forgot-email').value.trim();
  if(!validateEmail(email)){ $('forgot-email-err').textContent='Enter a valid email'; return; }
  
  const btn = $('form-forgot').querySelector('button[type="submit"]');
  try {
    btn.disabled = true;
    btn.textContent = 'Sending...';
    await sendPasswordResetEmail(auth, email);
    toast(`Reset link sent to ${email}`,'info');
    setAuthMode('login');
  } catch (error) {
    $('forgot-email-err').textContent = error.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
});

// Mode switches
$('show-signup').addEventListener('click',()=>setAuthMode('signup'));
$('show-login').addEventListener('click',()=>setAuthMode('login'));
$('forgot-link').addEventListener('click',()=>setAuthMode('forgot'));
$('back-to-login').addEventListener('click',()=>setAuthMode('login'));
$('google-btn').addEventListener('click', async ()=>{ 
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    toast('Signed in with Google!','success');
  } catch (error) {
    if(error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request'){
      toast('Opening Google sign-in in this tab...','info');
      await signInWithRedirect(auth, provider);
      return;
    }
    $('login-general-err').textContent = friendlyAuthError(error);
    $('login-general-err').classList.remove('hidden');
  }
});

// Sign out
$('signout-btn').addEventListener('click', async ()=>{
  try {
    await signOut(auth);
    toast('Signed out. See you soon!','info');
  } catch (error) {
    console.error('Sign out error', error);
  }
});

// PW toggles
function pwToggle(inputId, btnId){
  const btn=$(btnId), inp=$(inputId);
  btn.addEventListener('click',()=>{
    const show = inp.type==='password';
    inp.type = show?'text':'password';
    btn.textContent = show?'Hide':'Show';
  });
}
pwToggle('login-password','login-pw-toggle');
pwToggle('signup-password','signup-pw-toggle');

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
setAuthMode('login');

getRedirectResult(auth)
  .then((result)=>{
    if(result?.user) toast('Signed in with Google!','success');
  })
  .catch((error)=>{
    $('login-general-err').textContent = friendlyAuthError(error);
    $('login-general-err').classList.remove('hidden');
  });

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      await loadUserWorkspace(user);
      switchToDashboard();
    } catch (error) {
      console.error('Workspace load failed', error);
      currentUser = user;
      applyWorkspace({}, user);
      switchToDashboard();
      toast(friendlyFirestoreError(error),'error');
    }
  } else {
    currentUser = null;
    applyWorkspace();
    S.auth = false;
    $('dashboard-shell').classList.add('hidden');
    $('auth-shell').classList.remove('hidden');
    setAuthMode('login');
  }
});
