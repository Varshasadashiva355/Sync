import {
  buildStats,
  getOpenRoles,
  normalizeSeed,
  rankCandidates,
  scoreCandidate,
  scoreTeam,
} from '../shared/match.js';

const ROLE_CATALOG = [
  'Frontend Developer',
  'Backend Developer',
  'Full-stack Developer',
  'UI/UX Designer',
  'Product Manager',
  'Data Scientist',
  'ML Engineer',
  'DevOps Engineer',
  'QA Engineer',
  'Mobile Developer',
  'Technical Writer',
];

const AVAILABILITY_LABELS = {
  available: 'Available now',
  limited: 'Limited time',
  busy: 'Busy this month',
};

const EXPERIENCE_LABELS = {
  1: 'Foundational',
  2: 'Intermediate',
  3: 'Advanced',
};

const ICON_PATHS = {
  arrowRight: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 6.8"/>',
  x: '<path d="M6 6 18 18M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.8" cy="10.8" r="5.8"/><path d="m15.2 15.2 4.6 4.6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.7 19.2c.4-3 2.5-4.9 5.3-4.9s4.9 1.9 5.3 4.9"/><path d="M15.4 5.4a3 3 0 0 1 0 5.2"/><path d="M17.2 14.8c1.9.4 3.1 2.1 3.4 4.4"/>',
  userPlus: '<circle cx="9" cy="8" r="3"/><path d="M3.7 19.2c.4-3 2.5-4.9 5.3-4.9 1.2 0 2.3.3 3.2 1"/><path d="M18 13.5v5M15.5 16h5"/>',
  sparkles: '<path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"/><path d="M18.5 13.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/>',
  send: '<path d="m21 3-7.2 18-3.6-7.2L3 10.2 21 3Z"/><path d="M21 3 10.2 13.8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
  alert: '<path d="M12 3.8 21 20H3L12 3.8Z"/><path d="M12 9v4.5M12 17h.01"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.6 2.6L16.5 9"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.8 6.2 3 3"/>',
  briefcase: '<rect x="3.5" y="7" width="17" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  bell: '<path d="M18 8.6a6 6 0 1 0-12 0c0 6-2.2 7.1-2.2 7.1h16.4S18 14.6 18 8.6"/><path d="M10.4 19.5a2 2 0 0 0 3.2 0"/>',
};

const state = {
  mode: 'loading',
  snapshot: null,
  authMode: 'login',
  registrationOptions: null,
  currentStudentId: null,
  activeProjectId: null,
  route: 'overview',
  search: '',
  filter: 'all',
  dirSearch: '',
  dirRole: 'all',
  dirAvailability: 'all',
  connected: false,
  serviceHealth: null,
  healthTimer: null,
  eventSource: null,
  refreshTimer: null,
  toastTimer: null,
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindGlobalEvents();
  try {
    const session = await api('/api/session', { method: 'GET' });
    if (!session.student) {
      state.registrationOptions = await api('/api/catalog', { method: 'GET' });
      state.mode = 'auth';
      renderAuthScreen();
      return;
    }
    state.currentStudentId = session.student.id;
    const data = await api('/api/bootstrap', { method: 'GET' });
    state.snapshot = data;
    state.mode = 'live';
    connectRealtime();
  } catch {
    try {
      const response = await fetch('data/seed.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Seed snapshot unavailable');
      const seed = await response.json();
      const normalized = normalizeSeed(seed);
      state.snapshot = {
        ...normalized,
        stats: buildStats(normalized),
        serverTime: new Date().toISOString(),
      };
      state.mode = 'preview';
    } catch {
      renderFatal();
      return;
    }
  }

  document.body.classList.remove('is-auth-screen');
  if (state.mode === 'live') {
    refreshServiceHealth();
    state.healthTimer = window.setInterval(refreshServiceHealth, 30000);
  }

  if (state.mode === 'preview') {
    const storedIdentity = storageGet('teamforge-identity');
    const studentIds = new Set(state.snapshot.students.map((student) => student.id));
    state.currentStudentId =
      (storedIdentity && studentIds.has(storedIdentity) && storedIdentity) ||
      (state.snapshot.defaultStudentId && studentIds.has(state.snapshot.defaultStudentId)
        ? state.snapshot.defaultStudentId
        : state.snapshot.students[0]?.id);
  }
  const storedProject = storageGet('teamforge-project');
  state.activeProjectId =
    storedProject && projectById(storedProject) ? storedProject : null;
  state.route = routeFromHash();
  if (!location.hash) history.replaceState(null, '', '#/overview');
  if (state.mode === 'preview') populateIdentitySelect();
  render();
}

function bindGlobalEvents() {
  window.addEventListener('hashchange', () => {
    const nextRoute = routeFromHash();
    const changed = nextRoute !== state.route;
    state.route = nextRoute;
    closeMobileNav();
    render();
    if (changed) window.scrollTo({ top: 0, behavior: 'auto' });
  });

  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileNav();
  });

  const dialog = $('#appDialog');
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    document.body.classList.remove('has-dialog');
    $('#dialogContent').innerHTML = '';
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
}

function handleClick(event) {
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) {
    state.filter = filterButton.dataset.filter;
    $$('[data-filter]').forEach((button) => {
      button.classList.toggle('is-active', button === filterButton);
      button.setAttribute('aria-pressed', String(button === filterButton));
    });
    refreshCandidateList();
    return;
  }

  const availabilityButton = event.target.closest('[data-dir-availability]');
  if (availabilityButton) {
    state.dirAvailability = availabilityButton.dataset.dirAvailability;
    $$('[data-dir-availability]').forEach((button) => {
      button.classList.toggle('is-active', button === availabilityButton);
      button.setAttribute('aria-pressed', String(button === availabilityButton));
    });
    refreshDirectoryGrid();
    return;
  }

  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    const action = actionElement.dataset.action;
    switch (action) {
      case 'toggle-nav':
        toggleMobileNav();
        return;
      case 'close-nav':
        closeMobileNav();
        return;
      case 'open-profile':
        openProfileDialog();
        return;
      case 'show-run':
        openRunDialog();
        return;
      case 'close-dialog':
        closeDialog();
        return;
      case 'new-project':
        openProjectDialog();
        return;
      case 'edit-project':
        openProjectDialog(projectById(actionElement.dataset.project));
        return;
      case 'invite':
        openInviteDialog(actionElement);
        return;
      case 'invite-recommendation':
        openInviteDialog(actionElement);
        return;
      case 'respond-invite':
        respondInvite(actionElement);
        return;
      case 'lock-team':
        openLockDialog(actionElement.dataset.team);
        return;
      case 'confirm-lock':
        confirmLock(actionElement);
        return;
      case 'go-invites':
        openInvitations();
        return;
      case 'retry-load':
        window.location.reload();
        return;
      case 'toggle-auth':
        state.authMode = state.authMode === 'login' ? 'register' : 'login';
        renderAuthScreen();
        return;
      case 'logout':
        signOut();
        return;
      default:
        break;
    }
  }

  const projectLink = event.target.closest('a[data-project]');
  if (projectLink) {
    setActiveProject(projectLink.dataset.project);
    closeMobileNav();
    if (location.hash === projectLink.getAttribute('href')) render();
    return;
  }

  if (event.target.closest('.nav-link')) closeMobileNav();
  if (event.target.closest('#mobileScrim')) closeMobileNav();
}

function handleInput(event) {
  if (event.target.id === 'candidateSearch') {
    state.search = event.target.value;
    refreshCandidateList();
  }
  if (event.target.id === 'directorySearch') {
    state.dirSearch = event.target.value;
    refreshDirectoryGrid();
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.id === 'identitySelect') {
    if (state.mode !== 'preview') return;
    state.currentStudentId = target.value;
    storageSet('teamforge-identity', target.value);
    render();
    return;
  }
  if (target.id === 'projectSelect') {
    setActiveProject(target.value);
    render();
    return;
  }
  if (target.id === 'dirRole') {
    state.dirRole = target.value;
    refreshDirectoryGrid();
    return;
  }
  if (target.closest('#projectForm')) {
    syncProjectForm(target.closest('#projectForm'));
  }
  if (target.matches('[data-skill-toggle]')) {
    const option = target.closest('.skill-option');
    const level = option?.querySelector('select');
    if (level) level.disabled = !target.checked;
  }
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.id === 'loginForm' || form.id === 'registerForm') {
    event.preventDefault();
    await submitAuthentication(form);
  }
  if (form.id === 'profileForm') {
    event.preventDefault();
    await saveProfile(form);
  }
  if (form.id === 'projectForm') {
    event.preventDefault();
    await saveProject(form);
  }
  if (form.id === 'inviteForm') {
    event.preventDefault();
    await sendInvitation(form);
  }
}

/* ---------- Data helpers ---------- */

function currentStudent() {
  return studentById(state.currentStudentId);
}

function studentById(id) {
  return state.snapshot?.students.find((student) => student.id === id) || null;
}

function projectById(id) {
  return state.snapshot?.projects.find((project) => project.id === id) || null;
}

function teamFor(project) {
  if (!project) return null;
  return state.snapshot.teams.find((team) => team.id === project.teamId) || null;
}

function teamWithMembers(project) {
  const team = teamFor(project);
  if (!team) return { members: [], memberStudents: [] };
  return {
    ...team,
    memberStudents: team.members
      .map((member) => studentById(member.studentId))
      .filter(Boolean),
  };
}

function overviewProject(student) {
  if (!student || !state.snapshot) return null;
  const selected = state.activeProjectId ? projectById(state.activeProjectId) : null;
  if (selected) return selected;
  const owned = state.snapshot.projects.find((project) => project.ownerId === student.id);
  if (owned) return owned;
  const memberTeam = state.snapshot.teams.find((team) =>
    team.members.some((member) => member.studentId === student.id),
  );
  if (memberTeam) return projectById(memberTeam.projectId);
  return state.snapshot.projects[0] || null;
}

function getActiveProject() {
  if (!state.snapshot) return null;
  const explicit = state.activeProjectId ? projectById(state.activeProjectId) : null;
  if (explicit) return explicit;
  const student = currentStudent();
  return overviewProject(student) || state.snapshot.projects[0] || null;
}

function setActiveProject(projectId) {
  if (!projectId || !projectById(projectId)) return;
  state.activeProjectId = projectId;
  storageSet('teamforge-project', projectId);
}

function openRolesFor(project, team) {
  return getOpenRoles(project, team).filter((role) => role.open > 0);
}

function getInviteRole(candidate, project, team) {
  if (!candidate || !project || !team) return null;
  const openRoles = openRolesFor(project, team);
  return openRoles.some((role) => role.role === candidate.preferredRole)
    ? candidate.preferredRole
    : openRoles[0]?.role || null;
}

function pendingInviteFor(projectId, studentId) {
  return state.snapshot.invitations.find(
    (invite) =>
      invite.projectId === projectId &&
      invite.inviteeId === studentId &&
      invite.status === 'pending',
  );
}

function matchesFor(project) {
  if (!project) return [];
  const team = teamWithMembers(project);
  return rankCandidates(project, team, state.snapshot.students).map((result) => {
    const pending = pendingInviteFor(project.id, result.studentId);
    const openRoles = openRolesFor(project, team);
    const inviteRole =
      team.status === 'forming' ? getInviteRole(result.student, project, team) : null;
    return {
      ...result,
      inviteRole,
      openRoles,
      preferredRoleOpen: openRoles.some((role) => role.role === result.student.preferredRole),
      invitePending: Boolean(pending),
      canInvite:
        Boolean(inviteRole) &&
        project.ownerId === state.currentStudentId &&
        !pending &&
        team.status === 'forming',
    };
  });
}

function currentStats() {
  return state.snapshot?.stats || buildStats(state.snapshot);
}

function pendingReceivedInvites() {
  return state.snapshot.invitations.filter(
    (invite) =>
      invite.inviteeId === state.currentStudentId && invite.status === 'pending',
  );
}

function applySnapshot(snapshot) {
  if (!snapshot) return;
  state.snapshot = snapshot.stats ? snapshot : { ...snapshot, stats: buildStats(snapshot) };
}

/* ---------- Rendering shell ---------- */

function render() {
  if (!state.snapshot) return;
  const student = currentStudent();
  if (!student) return;
  updateChrome(student);
  const main = $('#main');
  if (state.route === 'match') main.innerHTML = renderMatchView(student);
  else if (state.route === 'team') main.innerHTML = renderTeamView(student);
  else if (state.route === 'directory') main.innerHTML = renderDirectoryView(student);
  else main.innerHTML = renderOverviewView(student);
  updateRealtimeChrome();
}

function updateChrome(student) {
  const identitySelect = $('#identitySelect');
  if (identitySelect && identitySelect.options.length !== state.snapshot.students.length) {
    populateIdentitySelect();
  }
  if (identitySelect) identitySelect.value = student.id;

  const avatar = $('#userAvatar');
  if (avatar) {
    avatar.className = `avatar avatar-${student.avatarTone || 'navy'}`;
    avatar.textContent = initials(student.name);
    avatar.setAttribute('aria-hidden', 'true');
  }
  const name = $('#userName');
  if (name) name.textContent = student.name;
  const meta = $('#userMeta');
  if (meta) meta.textContent = `${student.preferredRole} · Year ${student.year}`;

  const titles = {
    overview: ['Capstone workspace', 'Overview'],
    match: ['Compatibility engine', 'Match studio'],
    team: ['Roster & invitations', 'Team room'],
    directory: ['Saptagiri NPS University', 'Student directory'],
  };
  const [eyebrow, title] = titles[state.route] || titles.overview;
  const pageEyebrow = $('#pageEyebrow');
  if (pageEyebrow) pageEyebrow.textContent = eyebrow;
  const pageTitle = $('#pageTitle');
  if (pageTitle) pageTitle.textContent = title;

  $$('[data-nav]').forEach((link) => {
    const active = link.dataset.nav === state.route;
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const pending = pendingReceivedInvites();
  const badge = $('#inviteBadge');
  if (badge) {
    badge.hidden = pending.length === 0;
    badge.textContent = String(pending.length);
  }
  const notification = $('.notification-btn');
  if (notification) {
    notification.setAttribute(
      'aria-label',
      pending.length
        ? `Open ${pending.length} pending invitation${pending.length > 1 ? 's' : ''}`
        : 'No pending invitations',
    );
  }

  const preview = $('#previewNotice');
  if (preview) preview.hidden = state.mode !== 'preview';
  const identityControl = $('.identity-control');
  if (identityControl) identityControl.hidden = state.mode !== 'preview';
  const logoutButton = $('#logoutButton');
  if (logoutButton) logoutButton.hidden = state.mode !== 'live';
}

function updateRealtimeChrome() {
  const pill = $('#realtimePill');
  const text = $('#realtimeText');
  const sidebar = $('#sidebarLive');
  const sidebarLabel = $('#sidebarLiveLabel');
  const serviceStatus = $('#serviceStatus');
  if (!pill || !text || !sidebar) return;

  if (serviceStatus) {
    serviceStatus.textContent =
      state.mode === 'preview'
        ? 'Backend unavailable · read-only snapshot'
        : state.serviceHealth === true
          ? 'Backend and database online'
          : state.serviceHealth === false
            ? 'Backend or database unavailable'
            : 'Checking backend and database';
  }

  if (state.mode === 'preview') {
    pill.dataset.state = 'preview';
    text.textContent = 'Preview';
    sidebar.dataset.state = 'preview';
    if (sidebarLabel) sidebarLabel.textContent = 'Preview snapshot';
  } else if (state.connected) {
    pill.dataset.state = 'live';
    text.textContent = 'Live';
    sidebar.dataset.state = 'live';
    if (sidebarLabel) sidebarLabel.textContent = 'Realtime sync on';
  } else {
    pill.dataset.state = 'reconnecting';
    text.textContent = 'Connecting';
    sidebar.dataset.state = 'offline';
    if (sidebarLabel) sidebarLabel.textContent = 'Realtime reconnecting';
  }
}

function populateIdentitySelect() {
  const select = $('#identitySelect');
  if (!select || !state.snapshot) return;
  select.innerHTML = state.snapshot.students
    .map(
      (student) =>
        `<option value="${esc(student.id)}">${esc(student.name)}</option>`,
    )
    .join('');
}

function renderFatal() {
  const main = $('#main');
  if (!main) return;
  main.innerHTML = `
    <div class="fatal-state">
      <p class="eyebrow"><span class="eyebrow-dot"></span> Workspace unavailable</p>
      <h2 style="margin-top: 10px;">TeamForge could not open.</h2>
      <p>The realtime backend is not responding and the local seed snapshot could not be loaded. Start the server, then reload this page.</p>
      <pre class="command-block">npm start</pre>
      <div class="hero-actions" style="justify-content: center;">
        <button class="btn btn-primary" type="button" data-action="retry-load">${icon('refresh', 16)} Reload workspace</button>
        <button class="btn btn-ghost" type="button" data-action="show-run">How to run</button>
      </div>
    </div>`;
}

function renderAuthScreen(message = '') {
  const main = $('#main');
  if (!main) return;
  document.body.classList.add('is-auth-screen');
  const registering = state.authMode === 'register';
  const roles = state.registrationOptions?.roles || ROLE_CATALOG;
  const skills = state.registrationOptions?.skills || [];
  main.innerHTML = `
    <section class="auth-layout" aria-labelledby="authTitle">
      <div class="auth-brand"><span class="brand-mark" aria-hidden="true">${icon('users', 20)}</span><span>TeamForge</span></div>
      <div class="auth-panel">
        <p class="panel-eyebrow">Saptagiri NPS University</p>
        <h1 id="authTitle">${registering ? 'Create your account' : 'Welcome back'}</h1>
        <p class="auth-subtitle">${registering ? 'Join the capstone network with your own student profile.' : 'Sign in to your student workspace.'}</p>
        <form class="auth-form" id="${registering ? 'registerForm' : 'loginForm'}" novalidate>
          ${registering ? `
            <div class="field">
              <label class="field-label" for="authName">Full name</label>
              <input id="authName" name="name" type="text" autocomplete="name" maxlength="60" required>
            </div>` : ''}
          <div class="field">
            <label class="field-label" for="authEmail">Email address</label>
            <input id="authEmail" name="email" type="email" autocomplete="email" maxlength="254" required autofocus>
          </div>
          ${registering ? `
            <div class="form-grid">
              <div class="field">
                <label class="field-label" for="authProgram">Program</label>
                <input id="authProgram" name="program" type="text" maxlength="60" value="Saptagiri NPS University" required>
              </div>
              <div class="field">
                <label class="field-label" for="authYear">Year of study</label>
                <select id="authYear" name="year">${[1, 2, 3, 4, 5].map((year) => `<option value="${year}">Year ${year}</option>`).join('')}</select>
              </div>
              <div class="field">
                <label class="field-label" for="authRole">Preferred role</label>
                <select id="authRole" name="preferredRole">${roles.map((role) => `<option value="${esc(role)}">${esc(role)}</option>`).join('')}</select>
              </div>
              <div class="field">
                <label class="field-label" for="authSkill">First skill</label>
                <select id="authSkill" name="skillId" required>${skills.map((skill) => `<option value="${esc(skill.id)}">${esc(skill.name)}</option>`).join('')}</select>
              </div>
              <input type="hidden" name="skillLevel" value="3">
            </div>` : ''}
          <div class="field">
            <label class="field-label" for="authPassword">Password</label>
            <input id="authPassword" name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="10" maxlength="128" required>
            ${registering ? '<span class="field-hint">Use at least 10 characters.</span>' : ''}
          </div>
          <div class="field-error auth-error" id="authError" role="alert" ${message ? '' : 'hidden'}>${esc(message)}</div>
          <button class="btn btn-primary auth-submit" type="submit">${registering ? 'Create account' : 'Sign in'}</button>
        </form>
        <div class="auth-switch">
          <span>${registering ? 'Already have an account?' : 'New to TeamForge?'}</span>
          <button class="text-link" type="button" data-action="toggle-auth">${registering ? 'Sign in' : 'Create account'}</button>
        </div>
        <p class="auth-note">Email addresses are not verified in this installation. Use an address you control.</p>
      </div>
    </section>`;
}

async function submitAuthentication(form) {
  const endpoint = form.id === 'registerForm' ? '/api/register' : '/api/login';
  const submit = form.querySelector('[type="submit"]');
  const errorBox = $('#authError', form);
  if (errorBox) {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }
  submit.disabled = true;
  submit.classList.add('is-loading');
  try {
    await api(endpoint, {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    window.location.reload();
  } catch (error) {
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
    submit.disabled = false;
    submit.classList.remove('is-loading');
  }
}

async function signOut() {
  try {
    await api('/api/logout', { method: 'POST' });
    state.eventSource?.close();
    window.location.reload();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ---------- Overview ---------- */

function renderOverviewView(student) {
  const stats = currentStats();
  const project = overviewProject(student);
  const team = project ? teamWithMembers(project) : null;
  const insight = project ? scoreTeam(project, team, state.snapshot.students) : null;
  const owner = project ? studentById(project.ownerId) : null;
  const matches = project ? matchesFor(project).slice(0, 3) : [];
  const activity = state.snapshot.activity.slice(0, 6);

  const heroPanel = project
    ? `
      <aside class="hero-panel" aria-label="Team readiness">
        <div class="hero-panel-head">
          <span>Your team readiness</span>
          ${statusBadge(team?.status || 'forming')}
        </div>
        <h2 class="hero-project">${esc(project.title)}</h2>
        <p class="hero-project-meta">${team.members.length} of ${project.teamSize} seats filled${insight.openRoles.length ? ` · ${insight.openRoles.map((role) => `${esc(role.role)} open`).join(' · ')}` : ' · every role filled'}</p>
        ${memberAvatars(team, 5)}
        <div class="mini-progress">
          <div class="mini-progress-row">
            <span>Skill coverage</span>
            <strong>${percent(insight.breakdown.coverage)}</strong>
          </div>
          <div class="progress-track"><div class="progress-fill is-gold" style="width: ${percent(insight.breakdown.coverage)}"></div></div>
        </div>
        <div class="gap-line">
          ${insight.missingSkills.length
            ? `<span>Still missing</span><strong>${insight.missingSkills.slice(0, 3).map(esc).join(' · ')}</strong>`
            : '<span>No skill gaps on this roster.</span>'}
        </div>
        <a class="text-link" href="#/team">Manage the roster ${icon('arrowRight', 13)}</a>
      </aside>`
    : `
      <aside class="hero-panel" aria-label="Start a project">
        <div class="hero-panel-head"><span>Your workspace</span></div>
        <h2 class="hero-project">No brief yet.</h2>
        <p class="hero-project-meta">Describe the project, mark the skills it needs, and TeamForge will rank the classmates who complete it.</p>
        <button class="btn btn-primary" type="button" data-action="new-project">${icon('plus', 15)} Create a project brief</button>
      </aside>`;

  return `
    <div class="view">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-dot"></span> Capstone studio · Autumn 2026</p>
          <h1>Build a team that covers every gap.</h1>
          <p class="hero-lede">TeamForge reads the skills you bring and the roles your project actually needs, then ranks the classmates who complete the picture — not just the ones who look like you.</p>
          <div class="hero-actions">
            <a class="btn btn-gold" href="${project ? '#/team' : '#/match'}">${project ? 'Open your team room' : 'Start a project brief'} ${icon('arrowRight', 15)}</a>
            <a class="btn btn-ghost-light" href="#/match">Find complementary teammates</a>
          </div>
          <div class="hero-meta">
            <span><strong>${stats.students}</strong> student profiles</span>
            <span><strong>${stats.projects}</strong> capstone briefs</span>
            <span><strong>${stats.openRoles}</strong> open seats</span>
          </div>
        </div>
        ${heroPanel}
      </section>

      <section class="stats-grid" aria-label="Workspace statistics">
        ${statCard('Students in network', stats.students, 'Profiles available for matching')}
        ${statCard('Live projects', stats.projects, 'Active capstone briefs in the workspace')}
        ${statCard('Open seats', stats.openRoles, 'Roles still waiting for a match')}
        ${statCard('Avg. team readiness', `${stats.averageReadiness}%`, 'Calculated across every roster')}
      </section>

      ${project ? `
        <label class="toolbar-select overview-project-select" for="projectSelect">
          <span class="toolbar-select-label">Selected project</span>
          <select id="projectSelect" aria-label="Choose the project for the readiness chart and team radar">
            ${state.snapshot.projects.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === project.id ? 'selected' : ''}>${esc(entry.title)}</option>`).join('')}
          </select>
        </label>` : ''}

      <div class="dashboard-grid">
        <div class="dashboard-main">
          ${project ? renderProjectPanel(project, team, insight, owner) : renderNoProjectPanel()}
          ${project ? renderTeamSOS(project, team, insight) : ''}
          <section class="panel panel-pad">
            <div class="panel-head">
              <div class="panel-head-copy">
                <span class="panel-eyebrow">Recommended next</span>
                <h2 class="panel-title">Top matches${project ? ` for ${esc(project.title)}` : ''}</h2>
                <p class="panel-subtitle">Ranked by skill coverage, complementarity and open-role fit.</p>
              </div>
              <a class="panel-link" href="#/match">Open match studio ${icon('arrowRight', 13)}</a>
            </div>
            ${matches.length ? `
              <div class="matches-list">
                ${matches.map((match) => renderMiniMatch(match, project)).join('')}
              </div>
              <div class="section-foot">
                <span class="section-foot-note">${project ? `${insight.openRoles.length} open role${insight.openRoles.length === 1 ? '' : 's'} · scores update with every join` : 'Create a brief to see ranked matches'}</span>
                <a class="text-link" href="#/match">See everyone ${icon('arrowRight', 13)}</a>
              </div>` : `
              <div class="empty-state" style="min-height: 180px; margin-top: 14px; border: 0; background: var(--surface-muted);">
                <h3>No ranked candidates yet</h3>
                <p>${project ? 'Every recommended profile is already on this roster, or the team is closed.' : 'Create a project brief to unlock compatibility scoring.'}</p>
              </div>`}
          </section>
        </div>

        <aside class="dashboard-side">
          <section class="panel panel-pad activity-panel">
            <div class="panel-head">
              <div class="panel-head-copy">
                <span class="panel-eyebrow">Workspace pulse</span>
                <h2 class="panel-title">Live activity</h2>
              </div>
              ${state.mode === 'live' ? '<span class="live-tag">Live</span>' : '<span class="count-pill">Snapshot</span>'}
            </div>
            ${activity.length ? `<ol class="activity-list">${activity.map(renderActivityItem).join('')}</ol>` : '<p class="panel-subtitle" style="margin-top: 14px;">No activity yet. Invite a teammate to start the feed.</p>'}
          </section>

          <section class="panel panel-pad">
            <div class="panel-head">
              <div class="panel-head-copy">
                <span class="panel-eyebrow">Your inbox</span>
                <h2 class="panel-title">Invitations</h2>
              </div>
              <span class="count-pill">${pendingReceivedInvites().length}</span>
            </div>
            ${renderInboxPeek(student)}
          </section>
        </aside>
      </div>

      <section class="panel project-board">
        <div class="panel-head">
          <div class="panel-head-copy">
            <span class="panel-eyebrow">Across the studio</span>
            <h2 class="panel-title">Capstone board</h2>
            <p class="panel-subtitle">Every brief in the workspace, with its current roster and readiness.</p>
          </div>
          <button class="btn btn-soft btn-sm" type="button" data-action="new-project">${icon('plus', 14)} New project</button>
        </div>
        <div class="project-list">
          ${state.snapshot.projects.map((entry) => renderProjectRow(entry)).join('')}
        </div>
      </section>
    </div>`;
}

function renderProjectPanel(project, team, insight, owner) {
  const missing = insight.missingSkills;
  return `
    <section class="panel panel-pad">
      <div class="panel-head">
        <div class="panel-head-copy">
          <span class="panel-eyebrow">${project.ownerId === state.currentStudentId ? 'Your capstone' : 'Featured capstone'}</span>
          <h2 class="panel-title">${esc(project.title)}</h2>
          <p class="panel-subtitle">Led by ${esc(owner?.name || 'a student lead')} · ${formatDate(project.deadline)}</p>
        </div>
        ${statusBadge(team.status)}
      </div>
      <div class="team-summary-grid">
        <div class="team-summary-main">
          <p class="panel-copy">${esc(project.summary)}</p>
          <div class="team-meta-row">
            ${metaItem('Team lead', owner?.name || '—')}
            ${metaItem('Deadline', formatDate(project.deadline))}
            ${metaItem('Seats', `${team.members.length} / ${project.teamSize}`)}
            ${metaItem('Team fit', `${insight.score}%`)}
          </div>
          <div class="member-line">
            <span class="member-line-label">Roster</span>
            ${memberAvatars(team, 5)}
          </div>
        </div>
        <div class="team-summary-side">
          <div class="readiness-block">
            ${scoreRing(insight.score, 82)}
            <span class="readiness-label">Team readiness</span>
          </div>
          ${renderSeatChart(project, team)}
          <div class="missing-block">
            <span class="section-label">${missing.length ? 'Missing skills' : 'Skill coverage'}</span>
            <div class="skill-chip-row">
              ${missing.length
                ? missing.slice(0, 3).map((name) => `<span class="gap-chip">${esc(name)}</span>`).join('')
                : '<span class="skill-chip is-met">Every required skill covered</span>'}
            </div>
          </div>
          <a class="btn btn-soft" href="#/team">Open team room ${icon('arrowRight', 14)}</a>
        </div>
      </div>
    </section>`;
}

function renderSeatChart(project, team) {
  const total = Math.max(1, project.teamSize);
  const filled = Math.min(team.members.length, total);
  const open = Math.max(0, total - filled);
  const circumference = 2 * Math.PI * 36;
  const filledLength = circumference * (filled / total);
  return `
    <div class="seat-chart-block">
      <span class="section-label">Project seats</span>
      <div class="seat-chart-layout">
        <svg class="seat-chart" viewBox="0 0 100 100" role="img" aria-label="${filled} of ${total} project seats filled">
          <circle class="seat-chart-track" cx="50" cy="50" r="36"></circle>
          <circle class="seat-chart-filled" cx="50" cy="50" r="36" stroke-dasharray="${filledLength.toFixed(2)} ${circumference.toFixed(2)}"></circle>
          <text class="seat-chart-value" x="50" y="48" text-anchor="middle">${filled}/${total}</text>
          <text class="seat-chart-caption" x="50" y="61" text-anchor="middle">FILLED</text>
        </svg>
        <div class="seat-chart-legend">
          <span><i class="seat-legend-dot is-filled"></i>${filled} filled</span>
          <span><i class="seat-legend-dot is-open"></i>${open} open</span>
        </div>
      </div>
    </div>`;
}

function renderTeamSOS(project, team, insight) {
  const daysToDeadline = Math.ceil(
    (new Date(`${project.deadline}T23:59:59`).getTime() - Date.now()) / 86400000,
  );
  const matches = matchesFor(project).filter((match) => !match.invitePending);
  const canInvite = project.ownerId === state.currentStudentId && team.status === 'forming';
  const actions = [];

  for (const role of insight.openRoles) {
    const match = matches.find((entry) => entry.student.preferredRole === role.role) || matches[0];
    actions.push({
      level: 'urgent',
      title: `${role.role} seat${role.open === 1 ? '' : 's'} unfilled`,
      detail: match
        ? `Top ranked option: ${match.student.name} · ${match.score}% match.`
        : 'Review ranked students to find a fit for this role.',
      action: match && canInvite && state.mode === 'live'
        ? `<button class="btn btn-ghost btn-sm" type="button" data-action="invite-recommendation" data-student="${esc(match.studentId)}" data-project="${esc(project.id)}" data-role="${esc(role.role)}">Invite ${esc(match.student.name.split(' ')[0])}</button>`
        : `<a class="btn btn-ghost btn-sm" href="#/match" data-project="${esc(project.id)}">Review candidates</a>`,
    });
  }

  for (const skillName of insight.missingSkills.slice(0, 2)) {
    const requirement = project.requirements.find((entry) => entry.name === skillName);
    const match = matches.find((entry) =>
      entry.student.skills.some(
        (skill) => skill.name === skillName && skill.level >= (requirement?.minLevel || 1),
      ),
    );
    actions.push({
      level: 'watch',
      title: `${skillName} coverage is missing`,
      detail: match
        ? `${match.student.name} meets the brief's ${skillName} requirement.`
        : 'Compare candidate skill profiles against this requirement.',
      action: match && canInvite && state.mode === 'live'
        ? `<button class="btn btn-ghost btn-sm" type="button" data-action="invite-recommendation" data-student="${esc(match.studentId)}" data-project="${esc(project.id)}" data-role="${esc(match.inviteRole || insight.openRoles[0]?.role || '')}">Review ${esc(match.student.name.split(' ')[0])}</button>`
        : `<a class="btn btn-ghost btn-sm" href="#/match" data-project="${esc(project.id)}">Review matches</a>`,
    });
  }

  if (daysToDeadline <= 14) {
    actions.push({
      level: daysToDeadline <= 7 ? 'urgent' : 'watch',
      title: daysToDeadline < 0 ? 'Project deadline has passed' : `Deadline in ${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'}`,
      detail: insight.openRoles.length
        ? 'Prioritize unfilled seats before the remaining work window closes.'
        : 'Confirm the team has a delivery plan and owner for each remaining task.',
      action: `<a class="btn btn-ghost btn-sm" href="#/team">Review team</a>`,
    });
  }

  const limitedMembers = team.members
    .map((member) => studentById(member.studentId))
    .filter((member) => member && member.availability !== 'available');
  if (limitedMembers.length) {
    actions.push({
      level: 'watch',
      title: `${limitedMembers.length} member${limitedMembers.length === 1 ? '' : 's'} report limited capacity`,
      detail: limitedMembers.map((member) => `${member.name} (${AVAILABILITY_LABELS[member.availability]})`).join(', '),
      action: `<a class="btn btn-ghost btn-sm" href="#/team">Review roster</a>`,
    });
  }

  const risk = actions.some((action) => action.level === 'urgent')
    ? 'urgent'
    : actions.length ? 'watch' : 'clear';
  return `
    <section class="panel panel-pad sos-panel" aria-labelledby="sosTitle">
      <div class="panel-head">
        <div class="panel-head-copy">
          <span class="panel-eyebrow">Team SOS</span>
          <h2 class="panel-title" id="sosTitle">Team survival radar</h2>
          <p class="panel-subtitle">Live risks and suggested next moves for ${esc(project.title)}.</p>
        </div>
        <span class="sos-status is-${risk}">${risk === 'clear' ? 'On track' : risk === 'urgent' ? 'Needs action' : 'Watch'}</span>
      </div>
      ${actions.length
        ? `<ul class="sos-list">${actions.slice(0, 6).map((action) => `
            <li class="sos-item is-${action.level}">
              <span class="sos-marker" aria-hidden="true"></span>
              <div class="sos-copy"><strong>${esc(action.title)}</strong><p>${esc(action.detail)}</p></div>
              ${action.action}
            </li>`).join('')}</ul>`
        : '<p class="panel-subtitle sos-clear">No current role, skill, deadline, or availability risks detected.</p>'}
    </section>`;
}

function renderNoProjectPanel() {
  return `
    <section class="panel panel-pad">
      <div class="panel-head">
        <div class="panel-head-copy">
          <span class="panel-eyebrow">Get started</span>
          <h2 class="panel-title">Your project brief is the starting point.</h2>
          <p class="panel-subtitle">Set the roles and skills the work actually needs. The matcher does the rest.</p>
        </div>
      </div>
      <div class="empty-state" style="margin-top: 16px;">
        <span class="empty-state-icon">${icon('briefcase', 20)}</span>
        <h3>No project brief yet</h3>
        <p>Create a brief to unlock ranked teammates, compatibility scoring and invitations.</p>
        <button class="btn btn-primary" type="button" data-action="new-project">${icon('plus', 15)} Create a project</button>
      </div>
    </section>`;
}

function renderMiniMatch(match, project) {
  const student = match.student;
  let action = '';
  if (match.invitePending) {
    action = '<span class="invite-status pending">Pending</span>';
  } else if (match.canInvite) {
    action = `<button class="btn btn-ghost btn-sm" type="button" data-action="invite" data-student="${esc(student.id)}" data-project="${esc(project.id)}" data-role="${esc(match.inviteRole)}">Invite</button>`;
  }
  return `
    <div class="match-mini">
      ${avatar(student, 'avatar')}
      <div class="match-mini-identity">
        <span class="match-mini-name">${esc(student.name)}</span>
        <span class="match-mini-meta">${esc(student.preferredRole)} · ${esc(student.program)}</span>
        <span class="match-mini-reason">${esc(match.reasons[0] || '')}</span>
      </div>
      <span class="match-mini-score">${match.score}<small>match</small></span>
      ${action}
    </div>`;
}

function renderProjectRow(project) {
  const team = teamWithMembers(project);
  const insight = scoreTeam(project, team, state.snapshot.students);
  const owner = studentById(project.ownerId);
  return `
    <a class="project-row" href="#/match" data-project="${esc(project.id)}">
      <span class="project-row-main">
        <span class="project-row-title">${esc(project.title)}</span>
        <span class="project-row-meta">${esc(owner?.name || 'Student lead')} · ${formatDate(project.deadline)}</span>
      </span>
      ${statusBadge(team.status)}
      <span class="project-row-seats">${team.members.length}/${project.teamSize} seats</span>
      <span class="project-row-fit">${insight.score}% fit</span>
      <span class="project-row-arrow">${icon('chevronRight', 16)}</span>
    </a>`;
}

function renderInboxPeek(student) {
  const pending = pendingReceivedInvites().slice(0, 2);
  if (!pending.length) {
    return `<p class="panel-subtitle" style="margin-top: 14px;">No invitations waiting. When a team lead invites you, it appears here instantly.</p>`;
  }
  return `<div class="invite-list">
    ${pending.map((invite) => {
      const project = projectById(invite.projectId);
      const inviter = studentById(invite.inviterId);
      return `
        <div class="invite-item">
          ${avatar(inviter || student, 'avatar-sm')}
          <div class="invite-copy">
            <p class="invite-title">${esc(inviter?.name || 'A team lead')} invited you <span>as ${esc(invite.role)}</span></p>
            <p class="invite-message">${esc(project?.title || 'a project')}</p>
            <div class="invite-meta"><span>${relativeTime(invite.createdAt)}</span></div>
          </div>
          <div class="invite-actions">
            <button class="btn btn-primary btn-sm" type="button" data-action="respond-invite" data-invitation="${esc(invite.id)}" data-response="accept">Accept</button>
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

/* ---------- Match studio ---------- */

function renderMatchView(student) {
  const project = getActiveProject();
  if (!project) {
    return `
      <div class="view">
        ${renderViewHead('Match studio', 'Find the strengths your brief is missing.', 'Every score is calculated against the current roster, so the ranking moves the moment someone joins.', `<button class="btn btn-primary" type="button" data-action="new-project">${icon('plus', 15)} New project</button>`)}
        <div class="empty-state">
          <span class="empty-state-icon">${icon('target', 20)}</span>
          <h3>Start with a project brief</h3>
          <p>Add required skills and roles, then TeamForge can rank the classmates who complete the team.</p>
          <button class="btn btn-primary" type="button" data-action="new-project">${icon('plus', 15)} Create a project</button>
        </div>
      </div>`;
  }

  const team = teamWithMembers(project);
  const insight = scoreTeam(project, team, state.snapshot.students);
  const isOwner = project.ownerId === state.currentStudentId;
  const allMatches = matchesFor(project);
  const visibleMatches = filterMatches(allMatches, state.filter, state.search);
  const owner = studentById(project.ownerId);
  const rosterClosed = team.status !== 'forming';

  return `
    <div class="view">
      ${renderViewHead(
        'Match studio',
        'Find the strengths your brief is missing.',
        'Every score is calculated against the current roster, so the ranking moves the moment someone joins.',
        `<button class="btn btn-primary" type="button" data-action="new-project">${icon('plus', 15)} New project</button>`,
      )}

      <div class="toolbar">
        <label class="toolbar-select" for="projectSelect">
          <span class="toolbar-select-label">Brief</span>
          <select id="projectSelect" aria-label="Choose a project brief">
            ${state.snapshot.projects.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === project.id ? 'selected' : ''}>${esc(entry.title)}</option>`).join('')}
          </select>
        </label>
        <div class="filter-rail" role="group" aria-label="Filter candidates">
          ${filterChip('all', 'All candidates', state.filter)}
          ${filterChip('open', 'Open-role fit', state.filter)}
          ${filterChip('available', 'Available now', state.filter)}
        </div>
        <label class="search-field" for="candidateSearch">
          ${icon('search', 16)}
          <input id="candidateSearch" type="search" placeholder="Search names, roles or skills" autocomplete="off" value="${esc(state.search)}" aria-label="Search candidates">
        </label>
      </div>

      <div class="match-layout">
        <aside class="panel brief-panel" aria-label="Project brief">
          <div class="brief-head">
            <span class="panel-eyebrow">Project brief</span>
            ${statusBadge(team.status)}
          </div>
          <h2 class="brief-title">${esc(project.title)}</h2>
          <p class="brief-summary">${esc(project.summary)}</p>
          <dl class="brief-facts">
            <div class="brief-fact">
              <dt>Team lead</dt>
              <dd>${esc(owner?.name || '—')}</dd>
            </div>
            <div class="brief-fact">
              <dt>Deadline</dt>
              <dd>${formatDate(project.deadline)}</dd>
            </div>
            <div class="brief-fact">
              <dt>Seats</dt>
              <dd>${team.members.length} of ${project.teamSize} filled</dd>
            </div>
            <div class="brief-fact">
              <dt>Team fit</dt>
              <dd>${insight.score}% readiness</dd>
            </div>
          </dl>

          <div class="brief-section">
            <div class="brief-section-head">
              <h3>Required skills</h3>
              <span>${project.requirements.length} skills</span>
            </div>
            <div class="requirement-list">
              ${project.requirements.map((requirement) => renderRequirementRow(requirement, team, project)).join('')}
            </div>
          </div>

          <div class="brief-section">
            <div class="brief-section-head">
              <h3>Role slots</h3>
              <span>${insight.openRoles.reduce((sum, role) => sum + role.open, 0)} open</span>
            </div>
            <div class="role-list">
              ${insight.openRoles.map((role) => `
                <div class="role-row ${role.open === 0 ? 'is-filled' : ''}">
                  <span class="role-row-name">${esc(role.role)}</span>
                  <span class="role-row-state">${role.open === 0 ? 'Filled' : `${role.open} open`}</span>
                </div>`).join('')}
            </div>
          </div>

          <div class="brief-section">
            <div class="brief-section-head">
              <h3>Team so far</h3>
              <span>${team.members.length} / ${project.teamSize}</span>
            </div>
            <div class="brief-team">
              ${team.members.map((member) => {
                const memberStudent = studentById(member.studentId);
                return memberStudent ? `<span class="member-chip">${avatar(memberStudent, 'avatar')} ${esc(memberStudent.name.split(' ')[0])}</span>` : '';
              }).join('') || '<span class="brief-note">No teammates yet.</span>'}
            </div>
          </div>

          ${insight.missingSkills.length ? `
            <div class="brief-section">
              <div class="brief-section-head">
                <h3>Skill gaps</h3>
                <span>${insight.missingSkills.length}</span>
              </div>
              <div class="skill-chip-row">
                ${insight.missingSkills.map((name) => `<span class="gap-chip">${esc(name)}</span>`).join('')}
              </div>
            </div>` : ''}

          <div class="brief-actions">
            ${isOwner && team.status !== 'locked'
              ? `<button class="btn btn-ghost" type="button" data-action="edit-project" data-project="${esc(project.id)}">${icon('edit', 14)} Edit this brief</button>`
              : ''}
              <p class="brief-note">${isOwner
              ? 'As team lead, choose a ranked candidate and assign any role with an open seat.'
              : `Only ${esc(owner?.name || 'the team lead')} can send invitations for this brief.`}</p>
          </div>
        </aside>

        <section class="candidate-area" aria-label="Ranked candidates">
          <div class="results-head">
            <div>
              <h2>Ranked teammates</h2>
              <p>Scores reflect the current roster, required skills and open roles.</p>
            </div>
            <span class="results-count" id="resultsCount">${visibleMatches.length} candidate${visibleMatches.length === 1 ? '' : 's'}</span>
          </div>
          ${!isOwner ? `<div class="inline-notice">${icon('info', 15)}<span>This brief is led by ${esc(owner?.name || 'another student')}. You can compare candidates, but invitations stay with the team lead.</span></div>` : ''}
          ${rosterClosed ? `<div class="inline-notice">${icon('lock', 15)}<span>This roster is ${team.status === 'locked' ? 'locked' : 'complete'}. Invitations are closed, but scores remain visible.</span></div>` : ''}
          <div class="candidate-list" id="candidateList">
            ${visibleMatches.length
              ? visibleMatches.map((match, index) => renderMatchCard(match, project, team, isOwner, index)).join('')
              : renderNoMatches()}
          </div>
        </section>
      </div>
    </div>`;
}

function renderViewHead(eyebrow, title, copy, actions) {
  return `
    <div class="view-head">
      <div class="view-head-copy">
        <p class="eyebrow"><span class="eyebrow-dot"></span> ${esc(eyebrow)}</p>
        <h2>${esc(title)}</h2>
        <p class="view-copy">${esc(copy)}</p>
      </div>
      <div class="view-head-actions">${actions || ''}</div>
    </div>`;
}

function filterChip(value, label, active) {
  return `<button class="filter-chip ${value === active ? 'is-active' : ''}" type="button" data-filter="${esc(value)}" aria-pressed="${value === active}">${esc(label)}</button>`;
}

function renderRequirementRow(requirement, team, project) {
  const teamMax = team.memberStudents.reduce(
    (max, member) => Math.max(max, member.skills.find((skill) => skill.skillId === requirement.skillId)?.level || 0),
    0,
  );
  const covered = teamMax >= requirement.minLevel;
  return `
    <div class="requirement-row ${covered ? 'is-covered' : 'is-missing'}">
      <span class="requirement-name">${esc(requirement.name)}</span>
      <span class="requirement-meta">min ${requirement.minLevel} · weight ${requirement.weight}</span>
      <div class="requirement-track"><div class="requirement-fill" style="width: ${requirement.weight * 20}%"></div></div>
    </div>`;
}

function renderMatchCard(match, project, team, isOwner, index) {
  const student = match.student;
  const missing = match.missingSkills;
  const footnote = missing.length
    ? `Missing ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` +${missing.length - 3}` : ''}`
    : 'Covers every required skill';
  return `
    <article class="match-card" style="--i: ${index}">
      <div class="match-card-head">
        ${avatar(student, 'avatar-lg')}
        <div class="match-identity">
          <div class="match-name-row">
            <h3 class="match-name">${esc(student.name)}</h3>
            ${availabilityBadge(student)}
          </div>
          <p class="match-meta">${esc(student.preferredRole)} · ${esc(student.program)} · Year ${student.year}</p>
          <p class="match-bio">${esc(student.bio)}</p>
          ${profileSocialLinks(student)}
        </div>
        <div class="match-score">
          ${scoreRing(match.score, 62)}
          <span class="match-score-label">Match</span>
        </div>
      </div>

      <div class="skill-chip-row">
        ${project.requirements.map((requirement) => {
          const entry = student.skills.find((skill) => skill.skillId === requirement.skillId);
          const met = entry && entry.level >= requirement.minLevel;
          return `<span class="skill-chip ${met ? 'is-met' : 'is-missing'}" title="${esc(requirement.name)} requires level ${requirement.minLevel}">${esc(requirement.name)} <b>${entry ? entry.level : '—'}/${requirement.minLevel}</b></span>`;
        }).join('')}
      </div>

      <ul class="match-reasons">
        ${match.reasons.slice(0, 2).map((reason) => `<li>${esc(reason)}</li>`).join('')}
      </ul>

      <div class="match-card-foot">
        <div class="breakdown-grid">
          ${breakdownItem('Skill coverage', match.breakdown.coverage)}
          ${breakdownItem('Complement', match.breakdown.complementarity)}
          ${breakdownItem('Role fit', match.breakdown.roleFit)}
        </div>
        <div class="match-action">
          <span class="match-footnote ${missing.length ? 'is-gap' : ''}">${esc(footnote)}</span>
          ${renderInviteAction(match, project, team, isOwner)}
        </div>
      </div>
    </article>`;
}

function renderInviteAction(match, project, team, isOwner) {
  if (!isOwner) {
    const owner = studentById(project.ownerId);
    return `<button class="btn btn-ghost btn-sm" type="button" disabled>Led by ${esc(owner?.name.split(' ')[0] || 'lead')}</button>`;
  }
  if (team.status !== 'forming') {
    return `<button class="btn btn-ghost btn-sm" type="button" disabled>Roster ${team.status}</button>`;
  }
  if (match.invitePending) {
    return `<span class="invite-pending">${icon('clock', 13)} Invitation pending</span>`;
  }
  if (match.inviteRole) {
    return `<button class="btn btn-primary btn-sm" type="button" data-action="invite" data-student="${esc(match.studentId)}" data-project="${esc(project.id)}">Select role & invite</button>`;
  }
  return `<button class="btn btn-ghost btn-sm" type="button" disabled>Team full</button>`;
}

function breakdownItem(label, value) {
  return `
    <div class="breakdown-item">
      <div class="breakdown-row">
        <span class="breakdown-label">${esc(label)}</span>
        <span class="breakdown-value">${percent(value)}</span>
      </div>
      <div class="breakdown-track"><div class="breakdown-fill" style="width: ${percent(value)}"></div></div>
    </div>`;
}

function filterMatches(matches, filter, query) {
  const term = query.trim().toLowerCase();
  return matches.filter((match) => {
    if (filter === 'open' && !match.preferredRoleOpen) return false;
    if (filter === 'available' && match.student.availability !== 'available') return false;
    if (!term) return true;
    const student = match.student;
    const haystack = [
      student.name,
      student.preferredRole,
      student.program,
      ...student.skills.map((skill) => skill.name),
    ].join(' ').toLowerCase();
    return haystack.includes(term);
  });
}

function renderNoMatches() {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${icon('search', 19)}</span>
      <h3>No candidates match this view</h3>
      <p>Try clearing the search or switching the filter. Every student profile is still available in the directory.</p>
      <a class="btn btn-ghost btn-sm" href="#/directory">Browse directory</a>
    </div>`;
}

function refreshCandidateList() {
  const project = getActiveProject();
  if (!project) return;
  const team = teamWithMembers(project);
  const allMatches = matchesFor(project);
  const visible = filterMatches(allMatches, state.filter, state.search);
  const list = $('#candidateList');
  const count = $('#resultsCount');
  const student = currentStudent();
  const isOwner = project.ownerId === student?.id;
  if (list) {
    list.innerHTML = visible.length
      ? visible.map((match, index) => renderMatchCard(match, project, team, isOwner, index)).join('')
      : renderNoMatches();
  }
  if (count) count.textContent = `${visible.length} candidate${visible.length === 1 ? '' : 's'}`;
}

/* ---------- Team room ---------- */

function renderTeamView(student) {
  const project = getActiveProject();
  if (!project) {
    return `
      <div class="view">
        ${renderViewHead('Team room', 'Your roster starts with a brief.', 'Create a project, fill the roles and invite the classmates who close the gaps.', `<button class="btn btn-primary" type="button" data-action="new-project">${icon('plus', 15)} New project</button>`)}
        <div class="empty-state">
          <span class="empty-state-icon">${icon('users', 20)}</span>
          <h3>No team to show yet</h3>
          <p>Once you create a project brief, your roster, live invitations and compatibility score appear here.</p>
          <button class="btn btn-primary" type="button" data-action="new-project">${icon('plus', 15)} Create a project</button>
        </div>
      </div>`;
  }

  const team = teamWithMembers(project);
  const insight = scoreTeam(project, team, state.snapshot.students);
  const owner = studentById(project.ownerId);
  const isOwner = project.ownerId === student.id;
  const totalSlots = project.roles.reduce((sum, role) => sum + role.slots, 0);
  const filledSlots = project.roles.reduce((sum, role) => {
    const filled = team.members.filter((member) => member.role === role.role).length;
    return sum + Math.min(filled, role.slots);
  }, 0);
  const received = pendingReceivedInvites();
  const sent = state.snapshot.invitations
    .filter((invite) => invite.teamId === team.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const projectActivity = state.snapshot.activity
    .filter((entry) => entry.projectId === project.id)
    .slice(0, 6);

  return `
    <div class="view">
      ${renderViewHead(
        'Team room',
        project.title,
        `Led by ${owner?.name || 'a student lead'} · ${formatDate(project.deadline)} · ${team.members.length} of ${project.teamSize} seats filled`,
        `<a class="btn btn-ghost" href="#/match">${icon('search', 15)} Find teammates</a>${isOwner && team.status === 'forming' ? `<button class="btn btn-primary" type="button" data-action="edit-project" data-project="${esc(project.id)}">${icon('edit', 15)} Edit brief</button>` : ''}`,
      )}

      ${renderStepper(team)}

      <div class="team-layout">
        <div class="team-main">
          <section class="panel panel-pad">
            <div class="panel-head">
              <div class="panel-head-copy">
                <span class="panel-eyebrow">Composition</span>
                <h2 class="panel-title">Roster</h2>
                <p class="panel-subtitle">${filledSlots} of ${totalSlots} role slots filled · ${team.members.length} of ${project.teamSize} seats.</p>
              </div>
              ${statusBadge(team.status)}
            </div>
            <div class="roster-grid">
              ${project.roles.map((role) => renderRoleSlots(role, team, project, isOwner)).join('')}
            </div>
            <div class="roster-foot">
              <div>
                <span class="section-label">Current skill gaps</span>
                <div class="skill-chip-row" style="margin-top: 6px;">
                  ${insight.missingSkills.length
                    ? insight.missingSkills.map((name) => `<span class="gap-chip">${esc(name)}</span>`).join('')
                    : '<span class="skill-chip is-met">Every required skill is covered</span>'}
                </div>
              </div>
              <span class="panel-subtitle">${insight.openRoles.reduce((sum, role) => sum + role.open, 0)} open seat${insight.openRoles.reduce((sum, role) => sum + role.open, 0) === 1 ? '' : 's'}</span>
            </div>
          </section>

          <section class="panel panel-pad">
            <div class="panel-head">
              <div class="panel-head-copy">
                <span class="panel-eyebrow">Calculated live</span>
                <h2 class="panel-title">Team compatibility</h2>
                <p class="panel-subtitle">Coverage, role completeness and experience balance across this roster.</p>
              </div>
              <span class="count-pill">${insight.score}%</span>
            </div>
            <div class="compat-grid">
              <div class="compat-score">
                ${scoreRing(insight.score, 108)}
                <span class="compat-score-label">Team readiness</span>
              </div>
              <div class="compat-bars">
                ${barItem('Skill coverage', insight.breakdown.coverage, true)}
                ${barItem('Role coverage', insight.breakdown.roles)}
                ${barItem('Experience balance', insight.breakdown.balance)}
              </div>
            </div>
            <p class="compat-note">${compatibilityNote(team, insight)}</p>
          </section>

          <section class="panel panel-pad" id="invitationPanel">
            <div class="panel-head">
              <div class="panel-head-copy">
                <span class="panel-eyebrow">Realtime inbox</span>
                <h2 class="panel-title">Invitations</h2>
                <p class="panel-subtitle">Invitations for you, plus every invite connected to this brief.</p>
              </div>
              <span class="count-pill">${received.length}</span>
            </div>

            <div class="invite-section">
              <div class="brief-section-head" style="margin-top: 12px;">
                <h3 style="font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted-soft);">For you</h3>
                <span style="font-size: 10px; color: var(--muted-soft);">${received.length} pending</span>
              </div>
              ${received.length
                ? `<div class="invite-list">${received.map((invite) => renderReceivedInvite(invite)).join('')}</div>`
                : '<p class="panel-subtitle" style="margin-top: 8px;">No pending invitations. New invites appear here the moment they are sent.</p>'}
            </div>

            <div class="invite-section">
              <div class="brief-section-head" style="margin-top: 12px;">
                <h3 style="font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted-soft);">For this brief</h3>
                <span style="font-size: 10px; color: var(--muted-soft);">${sent.length} sent</span>
              </div>
              ${sent.length
                ? `<div class="invite-list">${sent.map((invite) => renderSentInvite(invite)).join('')}</div>`
                : '<p class="panel-subtitle" style="margin-top: 8px;">No invitations sent for this brief yet.</p>'}
            </div>
          </section>
        </div>

        <aside class="team-side">
          <section class="panel lock-panel">
            <div class="lock-head">
              <span class="lock-icon">${icon('lock', 18)}</span>
              <div>
                <span class="panel-eyebrow">Final step</span>
                <h2 class="lock-title">${team.status === 'locked' ? 'Roster locked' : team.status === 'complete' ? 'Ready to lock' : 'Roster controls'}</h2>
              </div>
            </div>
            <p class="lock-copy">${lockCopy(team, project, insight)}</p>
            <ul class="criteria-list">
              ${criteriaItem(team.members.length >= project.teamSize, `${team.members.length} of ${project.teamSize} seats filled`)}
              ${criteriaItem(insight.openRoles.length === 0, 'Every role slot is filled')}
              ${criteriaItem(team.status === 'complete' || team.status === 'locked', 'Team is marked complete')}
              ${criteriaItem(team.status === 'locked', 'Lead has locked the roster')}
            </ul>
            ${team.status === 'locked'
              ? `<p class="lock-note">Locked ${relativeTime(team.lockedAt)} · membership is frozen.</p>`
              : team.status === 'complete'
                ? `<button class="btn btn-primary" type="button" data-action="lock-team" data-team="${esc(team.id)}" ${isOwner ? '' : 'disabled'}>${icon('lock', 15)} Lock roster</button>
                   <p class="lock-note">${isOwner ? 'Locking freezes membership and invitations. This is the final roster.' : `Only ${esc(owner?.name || 'the team lead')} can lock this roster.`}</p>`
                : `<button class="btn btn-primary" type="button" disabled>${icon('lock', 15)} Lock roster</button>
                   <p class="lock-note">Fill every seat and role to unlock locking.</p>`}
          </section>

          <section class="panel panel-pad activity-panel">
            <div class="panel-head">
              <div class="panel-head-copy">
                <span class="panel-eyebrow">This brief</span>
                <h2 class="panel-title">Activity</h2>
              </div>
              ${state.mode === 'live' ? '<span class="live-tag">Live</span>' : '<span class="count-pill">Snapshot</span>'}
            </div>
            ${projectActivity.length
              ? `<ol class="activity-list">${projectActivity.map(renderActivityItem).join('')}</ol>`
              : '<p class="panel-subtitle" style="margin-top: 12px;">No activity for this brief yet.</p>'}
          </section>
        </aside>
      </div>
    </div>`;
}

function renderStepper(team) {
  const status = team.status;
  const stepOne = status === 'forming' ? 'is-active' : 'is-done';
  const stepTwo = status === 'forming' ? '' : status === 'complete' ? 'is-active' : 'is-done';
  const stepThree = status === 'locked' ? 'is-locked' : '';
  return `
    <ol class="stepper" aria-label="Team status">
      <li class="step ${stepOne}">
        <span class="step-marker">${status === 'forming' ? '1' : icon('check', 13)}</span>
        <span class="step-copy"><span class="step-title">Forming</span><span class="step-note">Compatibility stays live</span></span>
      </li>
      <li class="step ${stepTwo}">
        <span class="step-marker">${status === 'complete' || status === 'locked' ? icon('check', 13) : '2'}</span>
        <span class="step-copy"><span class="step-title">Complete</span><span class="step-note">All seats and roles filled</span></span>
      </li>
      <li class="step ${stepThree}">
        <span class="step-marker">${status === 'locked' ? icon('lock', 13) : '3'}</span>
        <span class="step-copy"><span class="step-title">Locked</span><span class="step-note">Roster frozen</span></span>
      </li>
    </ol>`;
}

function renderRoleSlots(role, team, project, isOwner) {
  const members = team.members.filter((member) => member.role === role.role);
  const cards = [];
  for (const member of members.slice(0, role.slots)) {
    const student = studentById(member.studentId);
    if (!student) continue;
    const topSkills = [...student.skills].sort((a, b) => b.level - a.level).slice(0, 3);
    cards.push(`
      <div class="roster-card">
        <div class="roster-person">
          ${avatar(student, 'avatar')}
          <div class="roster-person-copy">
            <span class="roster-person-name">${esc(student.name)}</span>
            <span class="roster-role">${esc(member.role)}</span>
          </div>
        </div>
        ${profileSocialLinks(student)}
        <div class="roster-skills">
          ${topSkills.map((skill) => `<span class="skill-chip">${esc(skill.name)} <b>${skill.level}</b></span>`).join('')}
        </div>
        <span class="roster-joined">Joined ${relativeTime(member.joinedAt)}</span>
      </div>`);
  }
  const open = Math.max(0, role.slots - members.length);
  for (let index = 0; index < open; index += 1) {
    cards.push(`
      <div class="roster-card is-empty">
        <span class="roster-empty-icon">${icon('plus', 14)}</span>
        <span class="roster-empty-role">${esc(role.role)}</span>
        <span class="roster-empty-note">${open} seat${open === 1 ? '' : 's'} open</span>
        ${isOwner ? `<a class="text-link roster-empty-link" href="#/match" data-project="${esc(project.id)}">Find a match ${icon('arrowRight', 12)}</a>` : ''}
      </div>`);
  }
  return cards.join('');
}

function renderReceivedInvite(invite) {
  const project = projectById(invite.projectId);
  const team = project ? teamFor(project) : null;
  const inviter = studentById(invite.inviterId);
  const canRespond = team?.status === 'forming';
  return `
    <div class="invite-item">
      ${avatar(inviter || currentStudent(), 'avatar-sm')}
      <div class="invite-copy">
        <p class="invite-title">${esc(inviter?.name || 'A team lead')} invited you <span>as ${esc(invite.role)}</span></p>
        <p class="invite-message">${esc(project?.title || 'Project')} · ${esc(invite.message || '')}</p>
        <div class="invite-meta">
          <span>${relativeTime(invite.createdAt)}</span>
          <span>${canRespond ? 'Slot open' : 'Roster closed'}</span>
        </div>
      </div>
      <div class="invite-actions">
        ${canRespond
          ? `<button class="btn btn-primary btn-sm" type="button" data-action="respond-invite" data-invitation="${esc(invite.id)}" data-response="accept">Accept</button>
             <button class="btn btn-ghost btn-sm" type="button" data-action="respond-invite" data-invitation="${esc(invite.id)}" data-response="decline">Decline</button>`
          : '<span class="invite-status declined">Closed</span>'}
      </div>
    </div>`;
}

function renderSentInvite(invite) {
  const invitee = studentById(invite.inviteeId);
  return `
    <div class="invite-item">
      ${avatar(invitee || currentStudent(), 'avatar-sm')}
      <div class="invite-copy">
        <p class="invite-title">${esc(invitee?.name || 'Student')} <span>· ${esc(invite.role)}</span></p>
        <p class="invite-message">${esc(invite.message || '')}</p>
        <div class="invite-meta"><span>Sent ${relativeTime(invite.createdAt)}</span></div>
      </div>
      <span class="invite-status ${invite.status}">${esc(invite.status)}</span>
    </div>`;
}

function compatibilityNote(team, insight) {
  if (team.status === 'locked') {
    return `This roster was locked ${relativeTime(team.lockedAt)}. Membership and invitations are frozen for the rest of the project.`;
  }
  if (team.status === 'complete') {
    return 'Every seat and role is filled. The team lead can review the roster and lock it as final.';
  }
  if (!insight.missingSkills.length) {
    return 'All required skills are covered. Fill the remaining seats and roles to mark the team complete.';
  }
  return `The biggest gaps are ${insight.missingSkills.slice(0, 3).join(', ')}. Use the match studio to invite candidates who cover them.`;
}

function lockCopy(team, project, insight) {
  if (team.status === 'locked') {
    return 'The final roster is frozen. Every member and role is preserved in the project record.';
  }
  if (team.status === 'complete') {
    return 'All seats and roles are filled. Locking records the final roster and closes invitations.';
  }
  return `${project.teamSize - team.members.length} seat${project.teamSize - team.members.length === 1 ? '' : 's'} and ${insight.openRoles.reduce((sum, role) => sum + role.open, 0)} role slot${insight.openRoles.reduce((sum, role) => sum + role.open, 0) === 1 ? '' : 's'} remain before this roster can be locked.`;
}

function criteriaItem(met, text) {
  return `<li class="criteria-item ${met ? 'is-met' : ''}"><span class="criteria-mark">${met ? icon('check', 11) : ''}</span><span>${esc(text)}</span></li>`;
}

/* ---------- Directory ---------- */

function renderDirectoryView(student) {
  const project = getActiveProject();
  const isOwner = project?.ownerId === state.currentStudentId;
  return `
    <div class="view">
      ${renderViewHead(
        'Student directory',
        'The whole bench, scored against your brief.',
        project
          ? `See how every student profile compares with ${project.title}. Scores update as the roster changes.`
          : 'Browse skills, preferred roles and availability across the capstone cohort.',
        `<button class="btn btn-primary" type="button" data-action="new-project">${icon('plus', 15)} New project</button>`,
      )}
      <div class="toolbar directory-toolbar">
        <label class="search-field" for="directorySearch">
          ${icon('search', 16)}
          <input id="directorySearch" type="search" placeholder="Search names, roles or skills" autocomplete="off" value="${esc(state.dirSearch)}" aria-label="Search the student directory">
        </label>
        <label class="toolbar-select" for="dirRole" style="flex: 0 1 210px;">
          <span class="toolbar-select-label">Role</span>
          <select id="dirRole" aria-label="Filter by preferred role">
            <option value="all" ${state.dirRole === 'all' ? 'selected' : ''}>All roles</option>
            ${ROLE_CATALOG.map((role) => `<option value="${esc(role)}" ${state.dirRole === role ? 'selected' : ''}>${esc(role)}</option>`).join('')}
          </select>
        </label>
        <div class="filter-rail" role="group" aria-label="Filter by availability">
          ${directoryAvailabilityChip('all', 'Everyone')}
          ${directoryAvailabilityChip('available', 'Available now')}
          ${directoryAvailabilityChip('limited', 'Limited time')}
        </div>
      </div>
      <div class="directory-grid" id="directoryGrid">
        ${renderDirectoryCards(student, project, isOwner)}
      </div>
    </div>`;
}

function directoryAvailabilityChip(value, label) {
  return `<button class="filter-chip ${state.dirAvailability === value ? 'is-active' : ''}" type="button" data-dir-availability="${esc(value)}" aria-pressed="${state.dirAvailability === value}">${esc(label)}</button>`;
}

function renderDirectoryCards(student, project, isOwner) {
  if (!state.snapshot) return '';
  const team = project ? teamWithMembers(project) : null;
  const memberIds = new Set(team?.members.map((member) => member.studentId) || []);
  const matchMap = new Map();
  if (project) {
    for (const match of matchesFor(project)) matchMap.set(match.studentId, match);
  }
  const term = state.dirSearch.trim().toLowerCase();

  const cards = state.snapshot.students
    .filter((entry) => {
      if (state.dirRole !== 'all' && entry.preferredRole !== state.dirRole) return false;
      if (state.dirAvailability !== 'all' && entry.availability !== state.dirAvailability) return false;
      if (!term) return true;
      const haystack = [
        entry.name,
        entry.preferredRole,
        entry.program,
        ...entry.skills.map((skill) => skill.name),
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    })
    .map((entry, index) => {
      const match = matchMap.get(entry.id);
      const isMember = memberIds.has(entry.id);
      const isSelf = entry.id === student.id;
      const pending = project ? pendingInviteFor(project.id, entry.id) : null;
      const inviteRole = project && !isMember ? getInviteRole(entry, project, team) : null;
      const showInvite = Boolean(project && isOwner && !isMember && inviteRole && !pending && team?.status === 'forming');
      const fit = match?.score ?? (project ? scoreCandidate(entry, project, team).score : null);
      return renderStudentCard(entry, {
        index,
        isMember,
        isSelf,
        pending,
        inviteRole,
        fit,
        project,
        showInvite,
      });
    });

  if (!cards.length) {
    return `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="empty-state-icon">${icon('search', 19)}</span>
        <h3>No students match those filters</h3>
        <p>Clear the search or choose a different role to see the rest of the cohort.</p>
      </div>`;
  }
  return cards.join('');
}

function renderStudentCard(student, options) {
  const { index, isMember, isSelf, pending, inviteRole, fit, project, showInvite } = options;
  const topSkills = [...student.skills].sort((a, b) => b.level - a.level).slice(0, 4);
  return `
    <article class="student-card" style="--i: ${index}">
      <div class="student-card-head">
        ${avatar(student, 'avatar-lg')}
        <div class="student-card-identity">
          <h3 class="student-card-name">${esc(student.name)}${isSelf ? ' · you' : ''}</h3>
          <p class="student-card-meta">${esc(student.program)} · Year ${student.year}</p>
          ${availabilityBadge(student)}
        </div>
      </div>
      <div class="student-tags">
        <span class="role-tag">${esc(student.preferredRole)}</span>
        <span class="role-tag">${esc(EXPERIENCE_LABELS[student.experience] || 'Intermediate')} · ${student.experience}/3</span>
      </div>
      ${profileSocialLinks(student)}
      <div class="skill-chip-row">
        ${topSkills.map((skill) => `<span class="skill-chip">${esc(skill.name)} <b>${skill.level}</b></span>`).join('')}
      </div>
      <div class="student-card-foot">
        <div class="student-fit">
          <div class="student-fit-row">
            <span class="student-fit-label">${isMember ? 'On this team' : isSelf ? 'Your profile' : 'Match'}</span>
            <span class="student-fit-value">${fit !== null ? `${fit}%` : '—'}</span>
          </div>
          <div class="bar-track"><div class="bar-fill ${fit !== null && fit >= 80 ? 'is-gold' : ''}" style="width: ${fit ?? 0}%"></div></div>
        </div>
        ${isSelf
          ? `<button class="btn btn-ghost btn-sm" type="button" data-action="open-profile">Edit profile</button>`
          : isMember
            ? '<span class="invite-status accepted">On team</span>'
            : pending
              ? '<span class="invite-status pending">Pending</span>'
              : showInvite
                ? `<button class="btn btn-primary btn-sm" type="button" data-action="invite" data-student="${esc(student.id)}" data-project="${esc(project.id)}" data-role="${esc(inviteRole)}">Invite</button>`
                : ''}
      </div>
    </article>`;
}

function profileSocialLinks(student) {
  const links = [
    ['LinkedIn', student.linkedinUrl],
    ['GitHub', student.githubUrl],
  ].filter(([, url]) => url);
  if (!links.length) return '';
  return `<div class="profile-social-links">${links.map(([label, url]) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  ).join('')}</div>`;
}

function refreshDirectoryGrid() {
  const grid = $('#directoryGrid');
  if (!grid) return;
  const student = currentStudent();
  const project = getActiveProject();
  const isOwner = project?.ownerId === state.currentStudentId;
  grid.innerHTML = renderDirectoryCards(student, project, isOwner);
}

function openInviteDialog(button) {
  if (!requireLive('send invitations')) return;
  const student = studentById(button.dataset.student);
  const project = projectById(button.dataset.project);
  const team = project ? teamWithMembers(project) : null;
  if (!student || !project || !team) return;
  const openRoles = openRolesFor(project, team);
  if (!openRoles.length) {
    showToast('This team has no open seats.', 'error');
    return;
  }
  const match = matchesFor(project).find((entry) => entry.studentId === student.id);
  const preferredRole = student.preferredRole;
  const openRoleMap = new Map(openRoles.map((role) => [role.role, role]));
  const projectRoleMap = new Map(project.roles.map((role) => [role.role, role]));
  const requestedRole = button.dataset.role;
  const selectedRole = openRoleMap.has(requestedRole)
    ? requestedRole
    : openRoleMap.has(preferredRole) ? preferredRole : openRoles[0].role;
  const roleChoices = [...new Set([...ROLE_CATALOG, ...project.roles.map((role) => role.role)])]
    .map((role) => {
      const openRole = openRoleMap.get(role);
      const configured = projectRoleMap.has(role);
      const label = openRole
        ? `${role} · ${openRole.open} seat${openRole.open === 1 ? '' : 's'} open`
        : configured
          ? `${role} · all seats filled`
          : `${role} · add to project brief`;
      return `<option value="${esc(role)}" ${role === selectedRole ? 'selected' : ''} ${openRole ? '' : 'disabled'}>${esc(label)}</option>`;
    })
    .join('');
  openDialog(`
    <form class="dialog-form" id="inviteForm" data-student="${esc(student.id)}" data-project="${esc(project.id)}">
      <div class="dialog-head">
        <div class="dialog-head-copy">
          <span class="dialog-eyebrow">Ranked candidate · ${match?.score ?? 0}% match</span>
          <h2 class="dialog-title" id="dialogTitle">Invite ${esc(student.name)}</h2>
          <p class="dialog-subtitle">Choose an open role for this candidate. Their preferred role is ${esc(preferredRole)}.</p>
        </div>
        <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close invitation dialog">${icon('x', 18)}</button>
      </div>
      <div class="dialog-body">
        <div class="field">
          <label class="field-label" for="inviteRole">Open role</label>
          <select id="inviteRole" name="role" autofocus required>
            ${roleChoices}
          </select>
          <span class="field-hint">To make another role selectable, add it to the project brief.</span>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="edit-project" data-project="${esc(project.id)}">${icon('edit', 14)} Edit project roles</button>
      </div>
      <div class="dialog-foot">
        <span class="dialog-note">Candidate ranking is based on current skills and roster fit.</span>
        <button class="btn btn-ghost" type="button" data-action="close-dialog">Cancel</button>
        <button class="btn btn-primary" type="submit">Send invitation</button>
      </div>
    </form>`);
}

async function sendInvitation(form) {
  if (!requireLive('send invitations')) return;
  const student = studentById(form.dataset.student);
  const project = projectById(form.dataset.project);
  const role = form.elements.role.value;
  if (!student || !project || !role) return;
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.classList.add('is-loading');
  submitButton.disabled = true;
  try {
    const response = await api(`/api/projects/${project.id}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ inviteeId: student.id, role }),
    });
    applySnapshot(response.snapshot);
    closeDialog();
    render();
    showToast(`Invitation sent to ${student.name} for ${role}.`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
    submitButton.classList.remove('is-loading');
    submitButton.disabled = false;
  }
}

async function respondInvite(button) {
  if (!requireLive('respond to invitations')) return;
  const invitationId = button.dataset.invitation;
  const responseAction = button.dataset.response;
  const invitation = state.snapshot.invitations.find((entry) => entry.id === invitationId);
  if (!invitation) return;
  button.classList.add('is-loading');
  button.disabled = true;
  try {
    const response = await api(`/api/invitations/${invitation.id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action: responseAction }),
    });
    applySnapshot(response.snapshot);
    if (responseAction === 'accept') {
      setActiveProject(invitation.projectId);
      closeDialog();
      if (location.hash !== '#/team') {
        location.hash = '#/team';
      } else {
        render();
      }
      const project = projectById(invitation.projectId);
      showToast(`You joined ${project?.title || 'the team'} as ${invitation.role}.`, 'success');
    } else {
      render();
      showToast('Invitation declined.', 'info');
    }
  } catch (error) {
    showToast(error.message, 'error');
    button.classList.remove('is-loading');
    button.disabled = false;
  }
}

function openInvitations() {
  if (state.route !== 'team') {
    location.hash = '#/team';
  } else {
    render();
  }
  closeMobileNav();
  window.setTimeout(() => {
    const panel = $('#invitationPanel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 90);
}

/* ---------- Dialogs ---------- */

function openDialog(html) {
  const dialog = $('#appDialog');
  const content = $('#dialogContent');
  if (!dialog || !content) return;
  if (dialog.open) dialog.close();
  content.innerHTML = html;
  document.body.classList.add('has-dialog');
  dialog.showModal();
  requestAnimationFrame(() => {
    const focusTarget = dialog.querySelector('[autofocus], input:not([type="hidden"]), select, textarea, button');
    focusTarget?.focus();
  });
}

function closeDialog() {
  const dialog = $('#appDialog');
  if (dialog?.open) dialog.close();
  document.body.classList.remove('has-dialog');
}

function openProfileDialog() {
  const student = currentStudent();
  if (!student) return;
  const roles = [...new Set([...ROLE_CATALOG, student.preferredRole])].sort();
  const selectedSkills = new Map(student.skills.map((skill) => [skill.skillId, skill.level]));
  openDialog(`
    <form class="dialog-form" id="profileForm" novalidate>
      <div class="dialog-head">
        <div class="dialog-head-copy">
          <span class="dialog-eyebrow">Your profile</span>
          <h2 class="dialog-title" id="dialogTitle">Keep your skills current</h2>
          <p class="dialog-subtitle">This powers every compatibility score. Changes sync to the shared database.</p>
        </div>
        <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close profile dialog">${icon('x', 18)}</button>
      </div>
      <div class="dialog-body">
        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="profileRole">Preferred role</label>
            <select id="profileRole" name="preferredRole" autofocus>
              ${roles.map((role) => `<option value="${esc(role)}" ${role === student.preferredRole ? 'selected' : ''}>${esc(role)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="profileExperience">Experience level</label>
            <select id="profileExperience" name="experience">
              ${[1, 2, 3].map((level) => `<option value="${level}" ${level === student.experience ? 'selected' : ''}>${EXPERIENCE_LABELS[level]} · ${level}/3</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="profileAvailability">Availability</label>
            <select id="profileAvailability" name="availability">
              ${Object.entries(AVAILABILITY_LABELS).map(([value, label]) => `<option value="${value}" ${value === student.availability ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="profileYear">Year of study</label>
            <select id="profileYear" name="year">
              ${[1, 2, 3, 4, 5].map((year) => `<option value="${year}" ${year === student.year ? 'selected' : ''}>Year ${year}</option>`).join('')}
            </select>
          </div>
          <div class="field field-full">
            <label class="field-label" for="profileProgram">Program</label>
            <input id="profileProgram" name="program" type="text" value="${esc(student.program)}" maxlength="60">
          </div>
          <div class="field field-full">
            <label class="field-label" for="profileBio">Short bio</label>
            <textarea id="profileBio" name="bio" maxlength="320" placeholder="What do you like building?">${esc(student.bio)}</textarea>
            <span class="field-hint">${student.bio.length}/320 characters</span>
          </div>
          <div class="field">
            <label class="field-label" for="profileLinkedIn">LinkedIn profile</label>
            <input id="profileLinkedIn" name="linkedinUrl" type="url" maxlength="2048" value="${esc(student.linkedinUrl || '')}" placeholder="https://www.linkedin.com/in/your-name">
          </div>
          <div class="field">
            <label class="field-label" for="profileGitHub">GitHub profile</label>
            <input id="profileGitHub" name="githubUrl" type="url" maxlength="2048" value="${esc(student.githubUrl || '')}" placeholder="https://github.com/username">
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-head">
            <span class="form-section-title">Skills & levels</span>
            <span class="form-section-hint">Select at least one skill</span>
          </div>
          <div class="skill-editor">
            ${state.snapshot.skills.map((skill) => {
              const level = selectedSkills.get(skill.id);
              return `
                <label class="skill-option">
                  <input type="checkbox" data-skill-toggle value="${esc(skill.id)}" ${level ? 'checked' : ''} aria-label="${esc(skill.name)}">
                  <span class="skill-option-name">${esc(skill.name)}</span>
                  <select data-skill-level="${esc(skill.id)}" aria-label="${esc(skill.name)} level" ${level ? '' : 'disabled'}>
                    ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${value === (level || 3) ? 'selected' : ''}>L${value}</option>`).join('')}
                  </select>
                </label>`;
            }).join('')}
          </div>
        </div>

        <div class="field-error" id="profileError" hidden></div>
        ${state.mode === 'preview' ? '<p class="brief-note" style="margin-top: 14px;">Preview mode: profile changes need the running backend. Start the server with <code>npm start</code>.</p>' : ''}
      </div>
      <div class="dialog-foot">
        <p class="dialog-note">Signed in as ${esc(student.name)} · ${esc(student.email)}</p>
        <button class="btn btn-ghost" type="button" data-action="close-dialog">Cancel</button>
        <button class="btn btn-primary" type="submit">Save profile</button>
      </div>
    </form>`);
}

function openProjectDialog(project = null) {
  const isEdit = Boolean(project);
  const student = currentStudent();
  if (isEdit && project.ownerId !== student.id) {
    showToast('Only the project lead can edit this brief.', 'error');
    return;
  }
  const roleMap = new Map((project?.roles || []).map((role) => [role.role, role.slots]));
  const requirementMap = new Map(
    (project?.requirements || []).map((requirement) => [requirement.skillId, requirement]),
  );
  const defaultDeadline = isEdit
    ? project.deadline
    : isoDate(new Date(Date.now() + 30 * 86400000));

  openDialog(`
    <form class="dialog-form" id="projectForm" data-mode="${isEdit ? 'edit' : 'create'}" data-project="${isEdit ? esc(project.id) : ''}" novalidate>
      <div class="dialog-head">
        <div class="dialog-head-copy">
          <span class="dialog-eyebrow">${isEdit ? 'Edit brief' : 'New capstone brief'}</span>
          <h2 class="dialog-title" id="dialogTitle">${isEdit ? 'Adjust the team you need' : 'Describe the team you need'}</h2>
          <p class="dialog-subtitle">Roles set the seats. Required skills set the matching weights.</p>
        </div>
        <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close project dialog">${icon('x', 18)}</button>
      </div>
      <div class="dialog-body">
        <div class="form-grid">
          <div class="field field-full">
            <label class="field-label" for="projectTitle">Project title <span class="required">*</span></label>
            <input id="projectTitle" name="title" type="text" maxlength="80" required autofocus value="${isEdit ? esc(project.title) : ''}" placeholder="e.g. Campus Event Companion">
          </div>
          <div class="field field-full">
            <label class="field-label" for="projectSummary">What is the team building? <span class="required">*</span></label>
            <textarea id="projectSummary" name="summary" maxlength="400" required placeholder="A short, concrete description of the project and the outcome.">${isEdit ? esc(project.summary) : ''}</textarea>
          </div>
          <div class="field">
            <label class="field-label" for="projectDeadline">Target deadline</label>
            <input id="projectDeadline" name="deadline" type="date" required value="${esc(defaultDeadline)}">
          </div>
          <div class="field">
            <label class="field-label">Team seats</label>
            <div class="seat-summary" id="seatSummary"><span>Choose roles to size the team</span><strong>0</strong></div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-head">
            <span class="form-section-title">Roles & seats</span>
            <span class="form-section-hint">Select the roles the project needs</span>
          </div>
          <div class="role-editor">
            ${ROLE_CATALOG.map((role) => {
              const slots = roleMap.get(role) || 1;
              const checked = roleMap.has(role);
              return `
                <label class="role-option">
                  <input type="checkbox" data-role-checkbox value="${esc(role)}" ${checked ? 'checked' : ''}>
                  <span class="role-option-name">${esc(role)}</span>
                  <span class="role-slots">
                    <select data-role-slots aria-label="${esc(role)} seats" ${checked ? '' : 'disabled'}>
                      ${[1, 2, 3].map((value) => `<option value="${value}" ${value === slots ? 'selected' : ''}>${value}</option>`).join('')}
                    </select>
                    seats
                  </span>
                </label>`;
            }).join('')}
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-head">
            <span class="form-section-title">Required skills</span>
            <span class="form-section-hint">Min level and weight shape the score</span>
          </div>
          <div class="requirement-editor">
            ${state.snapshot.skills.map((skill) => {
              const requirement = requirementMap.get(skill.id);
              const checked = Boolean(requirement);
              return `
                <label class="requirement-option">
                  <input type="checkbox" data-skill-checkbox value="${esc(skill.id)}" ${checked ? 'checked' : ''} aria-label="${esc(skill.name)}">
                  <span class="requirement-option-name">${esc(skill.name)}</span>
                  <select data-min-level aria-label="${esc(skill.name)} minimum level" ${checked ? '' : 'disabled'}>
                    ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${value === (requirement?.minLevel || 3) ? 'selected' : ''}>Min ${value}</option>`).join('')}
                  </select>
                  <select data-weight aria-label="${esc(skill.name)} weight" ${checked ? '' : 'disabled'}>
                    ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${value === (requirement?.weight || 3) ? 'selected' : ''}>Wt ${value}</option>`).join('')}
                  </select>
                </label>`;
            }).join('')}
          </div>
        </div>

        <div class="field-error" id="projectError" hidden></div>
        ${state.mode === 'preview' ? '<p class="brief-note" style="margin-top: 14px;">Preview mode: briefs can be explored but not saved. Start the server with <code>npm start</code>.</p>' : ''}
      </div>
      <div class="dialog-foot">
        <p class="dialog-note">Seats are derived from role slots. A team needs 2–8 seats.</p>
        <button class="btn btn-ghost" type="button" data-action="close-dialog">Cancel</button>
        <button class="btn btn-primary" type="submit">${isEdit ? 'Save brief' : 'Create project'}</button>
      </div>
    </form>`);
  syncProjectForm($('#projectForm'));
}

function syncProjectForm(form) {
  if (!form) return;
  const roleChecks = $$('[data-role-checkbox]', form);
  const skillChecks = $$('[data-skill-checkbox]', form);

  for (const checkbox of roleChecks) {
    const select = checkbox.closest('.role-option')?.querySelector('[data-role-slots]');
    if (select) select.disabled = !checkbox.checked;
  }
  for (const checkbox of skillChecks) {
    const row = checkbox.closest('.requirement-option');
    for (const select of row ? $$('select', row) : []) select.disabled = !checkbox.checked;
  }
  const seats = roleChecks
    .filter((checkbox) => checkbox.checked)
    .reduce((sum, checkbox) => {
      const select = checkbox.closest('.role-option')?.querySelector('[data-role-slots]');
      return sum + Number(select?.value || 0);
    }, 0);
  const roles = roleChecks.filter((checkbox) => checkbox.checked).length;
  const summary = $('#seatSummary');
  if (summary) {
    summary.innerHTML = `<span>${roles} role${roles === 1 ? '' : 's'} selected</span><strong>${seats}</strong>`;
    summary.style.borderColor = seats >= 2 && seats <= 8 ? '#ddd2b8' : '#ecd3cf';
  }
}

function openLockDialog(teamId) {
  const team = state.snapshot.teams.find((entry) => entry.id === teamId);
  const project = team ? projectById(team.projectId) : null;
  if (!team || !project) return;
  const student = currentStudent();
  if (project.ownerId !== student.id) {
    showToast('Only the project lead can lock the roster.', 'error');
    return;
  }
  if (team.status !== 'complete') {
    showToast('Fill every seat and role before locking.', 'error');
    return;
  }
  const members = team.members.map((member) => studentById(member.studentId)).filter(Boolean);
  openDialog(`
    <div class="dialog-head">
      <div class="dialog-head-copy">
        <span class="dialog-eyebrow">Final roster</span>
        <h2 class="dialog-title" id="dialogTitle">Lock this team?</h2>
        <p class="dialog-subtitle">${esc(project.title)} · ${members.length} members</p>
      </div>
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close lock dialog">${icon('x', 18)}</button>
    </div>
    <div class="dialog-body">
      <p class="confirm-copy">Locking freezes membership and closes invitations for <strong>${esc(project.title)}</strong>. The team will move to <strong>Locked</strong> and the current roster becomes the final record.</p>
      <div class="skill-chip-row" style="margin-top: 16px;">
        ${members.map((member) => `<span class="skill-chip">${esc(member.name)} · ${esc(member.preferredRole)}</span>`).join('')}
      </div>
    </div>
    <div class="dialog-foot">
      <button class="btn btn-ghost" type="button" data-action="close-dialog">Keep forming</button>
      <button class="btn btn-primary" type="button" data-action="confirm-lock" data-team="${esc(team.id)}">${icon('lock', 15)} Lock roster</button>
    </div>`);
}

async function confirmLock(button) {
  if (!requireLive('lock a roster')) return;
  button.classList.add('is-loading');
  button.disabled = true;
  try {
    const response = await api(`/api/teams/${button.dataset.team}/lock`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    applySnapshot(response.snapshot);
    closeDialog();
    render();
    showToast('Roster locked. The final team is now frozen.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
    button.classList.remove('is-loading');
    button.disabled = false;
  }
}

function openRunDialog() {
  openDialog(`
    <div class="dialog-head">
      <div class="dialog-head-copy">
        <span class="dialog-eyebrow">Full stack</span>
        <h2 class="dialog-title" id="dialogTitle">Run the live workspace</h2>
        <p class="dialog-subtitle">The page you are viewing is a read-only snapshot unless the Node server is running.</p>
      </div>
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close run instructions">${icon('x', 18)}</button>
    </div>
    <div class="dialog-body">
      <div class="run-steps">
        <div class="run-step">
          <span class="run-step-number">1</span>
          <p>From this project folder, install nothing and start the Node server. It uses only Node 24 built-ins.<pre class="command-block">npm start</pre></p>
        </div>
        <div class="run-step">
          <span class="run-step-number">2</span>
          <p>Open <strong>http://localhost:4173</strong>. The frontend, REST API, SQLite database and realtime channel are served together.</p>
        </div>
        <div class="run-step">
          <span class="run-step-number">3</span>
          <p>Open a second tab, choose a different demo identity, and send an invitation. The receiving tab updates without a refresh.</p>
        </div>
        <div class="run-step">
          <span class="run-step-number">4</span>
          <p>Profiles, projects, invitations, compatibility snapshots and team statuses persist in <strong>data/teamforge.db</strong>.</p>
        </div>
      </div>
      <p class="brief-note" style="margin-top: 16px;">Deployment: a Dockerfile and Render blueprint are included. A public URL still requires hosting credentials, which this session cannot provision.</p>
    </div>
    <div class="dialog-foot">
      <p class="dialog-note">Backend: Node 24 · API + SSE · SQLite</p>
      <button class="btn btn-primary" type="button" data-action="close-dialog">Got it</button>
    </div>`);
}

/* ---------- Forms ---------- */

async function saveProfile(form) {
  if (!requireLive('save profile changes')) return;
  clearFormError(form, '#profileError');
  const student = currentStudent();
  const skills = $$('[data-skill-toggle]:checked', form).map((checkbox) => {
    const levelSelect = checkbox.closest('.skill-option')?.querySelector('[data-skill-level]');
    return { skillId: checkbox.value, level: Number(levelSelect?.value || 3) };
  });
  const payload = {
    preferredRole: $('#profileRole', form).value,
    experience: Number($('#profileExperience', form).value),
    availability: $('#profileAvailability', form).value,
    year: Number($('#profileYear', form).value),
    program: $('#profileProgram', form).value.trim(),
    bio: $('#profileBio', form).value.trim(),
    linkedinUrl: $('#profileLinkedIn', form).value.trim(),
    githubUrl: $('#profileGitHub', form).value.trim(),
    skills,
  };
  if (!skills.length) {
    showFormError(form, '#profileError', 'Add at least one skill so the matcher can evaluate your profile.');
    return;
  }
  if (payload.program.length < 2) {
    showFormError(form, '#profileError', 'Add your program name (at least 2 characters).');
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit?.classList.add('is-loading');
  submit.disabled = true;
  try {
    const response = await api(`/api/students/${student.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    applySnapshot(response.snapshot);
    closeDialog();
    render();
    showToast('Profile updated. Your matches have been recalculated.', 'success');
  } catch (error) {
    showFormError(form, '#profileError', error.message);
    submit?.classList.remove('is-loading');
    submit.disabled = false;
  }
}

async function saveProject(form) {
  if (!requireLive('save project briefs')) return;
  clearFormError(form, '#projectError');
  const mode = form.dataset.mode;
  const projectId = form.dataset.project;
  const title = $('#projectTitle', form).value.trim();
  const summary = $('#projectSummary', form).value.trim();
  const deadline = $('#projectDeadline', form).value;
  const roles = $$('[data-role-checkbox]:checked', form).map((checkbox) => ({
    role: checkbox.value,
    slots: Number(checkbox.closest('.role-option')?.querySelector('[data-role-slots]')?.value || 1),
  }));
  const requirements = $$('[data-skill-checkbox]:checked', form).map((checkbox) => {
    const row = checkbox.closest('.requirement-option');
    return {
      skillId: checkbox.value,
      minLevel: Number(row?.querySelector('[data-min-level]')?.value || 3),
      weight: Number(row?.querySelector('[data-weight]')?.value || 3),
    };
  });
  const seats = roles.reduce((sum, role) => sum + role.slots, 0);

  if (title.length < 3) return showFormError(form, '#projectError', 'Give the project a title of at least 3 characters.');
  if (summary.length < 10) return showFormError(form, '#projectError', 'Describe the project in at least 10 characters.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return showFormError(form, '#projectError', 'Choose a valid target deadline.');
  if (!roles.length) return showFormError(form, '#projectError', 'Select at least one role for the team.');
  if (seats < 2 || seats > 8) return showFormError(form, '#projectError', 'The team needs between 2 and 8 seats. Adjust the role slot counts.');
  if (requirements.length < 2) return showFormError(form, '#projectError', 'Select at least two required skills so the matcher has something to score.');

  const submit = form.querySelector('button[type="submit"]');
  submit?.classList.add('is-loading');
  submit.disabled = true;
  try {
    const response = await api(mode === 'edit' ? `/api/projects/${projectId}` : '/api/projects', {
      method: mode === 'edit' ? 'PATCH' : 'POST',
      body: JSON.stringify({ title, summary, deadline, roles, requirements }),
    });
    applySnapshot(response.snapshot);
    const nextProjectId = response.projectId || projectId;
    setActiveProject(nextProjectId);
    closeDialog();
    if (location.hash !== '#/match') {
      location.hash = '#/match';
    } else {
      render();
    }
    showToast(mode === 'edit' ? 'Brief updated. Matches recalculated.' : 'Project created. Your team room is open.', 'success');
  } catch (error) {
    showFormError(form, '#projectError', error.message);
    submit?.classList.remove('is-loading');
    submit.disabled = false;
  }
}

function showFormError(form, selector, message) {
  const box = $(selector, form);
  if (!box) {
    showToast(message, 'error');
    return;
  }
  box.textContent = message;
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearFormError(form, selector) {
  const box = $(selector, form);
  if (box) {
    box.hidden = true;
    box.textContent = '';
  }
}

/* ---------- Realtime ---------- */

async function refreshServiceHealth() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const health = await response.json();
    state.serviceHealth = response.ok && health.ok && health.databaseOk === true;
  } catch {
    state.serviceHealth = false;
  }
  updateRealtimeChrome();
}

function connectRealtime() {
  if (state.mode !== 'live' || state.eventSource) return;
  const source = new EventSource('/api/events');
  state.eventSource = source;
  source.onopen = () => {
    state.connected = true;
    updateRealtimeChrome();
  };
  source.onerror = () => {
    if (state.connected) {
      state.connected = false;
      updateRealtimeChrome();
      showToast('Realtime connection interrupted. Reconnecting automatically…', 'error');
    }
  };
  source.onmessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload.type === 'connected') {
      state.connected = true;
      updateRealtimeChrome();
      return;
    }
    state.connected = true;
    updateRealtimeChrome();
    if (payload.actorId && payload.actorId !== state.currentStudentId && payload.message) {
      const project = projectById(payload.projectId);
      const isLeadAcceptance =
        payload.type === 'invitation.accepted' && project?.ownerId === state.currentStudentId;
      showToast(
        isLeadAcceptance ? `${payload.message}. Your team roster is updated.` : payload.message,
        isLeadAcceptance ? 'success' : 'info',
      );
    }
    scheduleRefresh();
  };
}

function scheduleRefresh() {
  if (state.refreshTimer) window.clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(async () => {
    state.refreshTimer = null;
    if (state.mode !== 'live') return;
    try {
      const snapshot = await api('/api/bootstrap', { method: 'GET' });
      applySnapshot(snapshot);
      render();
    } catch {
      // The SSE channel will retry; leave the last good snapshot visible.
    }
  }, 140);
}

/* ---------- Shared UI helpers ---------- */

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'TF';
}

function avatar(student, sizeClass = 'avatar') {
  const tone = ['navy', 'teal', 'gold', 'plum', 'rust', 'forest', 'indigo', 'slate'].includes(student?.avatarTone)
    ? student.avatarTone
    : 'navy';
  return `<span class="avatar ${sizeClass} avatar-${tone}" aria-hidden="true">${esc(initials(student?.name))}</span>`;
}

function memberAvatars(team, limit = 5) {
  if (!team) return '';
  const members = team.members
    .slice(0, limit)
    .map((member) => studentById(member.studentId))
    .filter(Boolean);
  const openSeats = Math.max(0, (team.members.length ? state.snapshot.projects.find((project) => project.teamId === team.id)?.teamSize || 0 : 0) - team.members.length);
  return `<div class="avatar-stack">
    ${members.map((member) => avatar(member, 'avatar')).join('')}
    ${openSeats
      ? `<span class="seat-chip" title="${openSeats} open seat${openSeats === 1 ? '' : 's'}">+${openSeats}</span>`
      : ''}
  </div>`;
}

function statusBadge(status) {
  const labels = { forming: 'Forming', complete: 'Complete', locked: 'Locked' };
  return `<span class="status-badge status-${esc(status)}">${labels[status] || 'Forming'}</span>`;
}

function availabilityBadge(student) {
  return `<span class="availability-badge availability-${esc(student.availability)}">${esc(AVAILABILITY_LABELS[student.availability] || 'Available')}</span>`;
}

function statCard(label, value, note) {
  return `<article class="stat-card">
    <span class="stat-label">${esc(label)}</span>
    <strong class="stat-value">${esc(value)}</strong>
    <span class="stat-note">${esc(note)}</span>
  </article>`;
}

function metaItem(label, value) {
  return `<div class="meta-item"><span class="meta-item-label">${esc(label)}</span><span class="meta-item-value">${esc(value)}</span></div>`;
}

function scoreRing(score, size = 68) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  return `<svg class="score-ring" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${score} percent team match">
    <circle class="ring-track" cx="50" cy="50" r="${radius}"></circle>
    <circle class="ring-fill" cx="50" cy="50" r="${radius}" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
    <text class="ring-text" x="50" y="55" text-anchor="middle">${score}</text>
    <text class="ring-sub" x="50" y="68" text-anchor="middle">MATCH</text>
  </svg>`;
}

function barItem(label, value, gold = false) {
  return `<div class="bar-item">
    <div class="bar-item-head"><span class="bar-item-label">${esc(label)}</span><span class="bar-item-value">${percent(value)}</span></div>
    <div class="bar-track"><div class="bar-fill ${gold ? 'is-gold' : ''}" style="width: ${percent(value)}"></div></div>
  </div>`;
}

function percent(value) {
  return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
}

function activityMeta(type) {
  const map = {
    invite_sent: ['mail', 'tone-gold'],
    invite_accepted: ['userPlus', 'tone-green'],
    member_joined: ['users', 'tone-green'],
    team_complete: ['checkCircle', 'tone-green'],
    team_locked: ['lock', 'tone-gold'],
    project_created: ['layers', 'tone-blue'],
    project_updated: ['edit', 'tone-blue'],
    profile_updated: ['edit', 'tone-navy'],
    invite_declined: ['xCircle', 'tone-navy'],
  };
  return map[type] || ['info', 'tone-navy'];
}

function renderActivityItem(entry) {
  const [iconName, tone] = activityMeta(entry.type);
  return `<li class="activity-item">
    <span class="activity-icon ${tone}">${icon(iconName, 14)}</span>
    <div class="activity-copy">
      <p class="activity-text">${esc(entry.message)}</p>
      <time class="activity-time" datetime="${esc(entry.createdAt)}">${relativeTime(entry.createdAt)}</time>
    </div>
  </li>`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function relativeTime(value) {
  if (!value) return 'just now';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'just now';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function icon(name, size = 18) {
  return `<svg class="od-icon" style="--od-icon-size:${size}px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.info}</svg>`;
}

function requireLive(actionLabel) {
  if (state.mode === 'live') return true;
  showToast(`Preview mode — start the server with npm start to ${actionLabel}.`, 'info');
  return false;
}

function showToast(message, type = 'info') {
  const region = $('#toastRegion');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast is-${type}`;
  const iconName = type === 'success' ? 'checkCircle' : type === 'error' ? 'alert' : 'info';
  toast.innerHTML = `<span class="toast-icon">${icon(iconName, 16)}</span><span class="toast-text">${esc(message)}</span>`;
  region.appendChild(toast);
  while (region.children.length > 3) region.firstElementChild.remove();
  const timeout = type === 'error' ? 6200 : 4400;
  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 180);
  }, timeout);
}

function routeFromHash() {
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
  return ['overview', 'match', 'team', 'directory'].includes(raw) ? raw : 'overview';
}

function toggleMobileNav() {
  const sidebar = $('#sidebar');
  const scrim = $('#mobileScrim');
  const toggle = $('[data-action="toggle-nav"]');
  const isOpen = sidebar?.classList.toggle('is-open');
  if (scrim) scrim.hidden = !isOpen;
  if (toggle) toggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
}

function closeMobileNav() {
  const sidebar = $('#sidebar');
  const scrim = $('#mobileScrim');
  const toggle = $('[data-action="toggle-nav"]');
  sidebar?.classList.remove('is-open');
  if (scrim) scrim.hidden = true;
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function storageGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private windows; the app still works in-memory.
  }
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${response.status}).`);
    error.field = payload?.error?.field || null;
    throw error;
  }
  return payload;
}
