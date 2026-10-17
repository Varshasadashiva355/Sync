import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './lib/db.js';
import { buildStats, rankCandidates, scoreTeam } from './shared/match.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const store = openStore(ROOT);
const clients = new Map();
const SESSION_COOKIE = 'teamforge_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function fail(message, status = 400, field = null) {
  const error = new Error(message);
  error.status = status;
  if (field) error.field = field;
  throw error;
}

function normalizeText(value, label, min, max) {
  if (typeof value !== 'string') fail(`${label} is required.`, 400, label.toLowerCase());
  const trimmed = value.trim();
  if (trimmed.length < min) fail(`${label} needs at least ${min} characters.`, 400, label.toLowerCase());
  if (trimmed.length > max) fail(`${label} must stay under ${max} characters.`, 400, label.toLowerCase());
  return trimmed;
}

function asInt(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${label} must be a whole number between ${min} and ${max}.`, 400, label.toLowerCase());
  }
  return number;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      fail('Request body is too large.', 413);
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    fail('Request body must be valid JSON.', 400);
  }
}

function requestCookie(req, name) {
  const prefix = `${name}=`;
  const entry = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function sessionTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function currentStudent(req) {
  const token = requestCookie(req, SESSION_COOKIE);
  return token ? store.getSessionStudent(sessionTokenHash(token)) : null;
}

function requireStudent(req) {
  const student = currentStudent(req);
  if (!student) fail('Sign in to continue.', 401);
  return student;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString('hex'));

function verifyPassword(password, storedHash) {
  const [salt, digest] = (storedHash || DUMMY_PASSWORD_HASH).split(':');
  const expected = Buffer.from(digest, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function setSessionCookie(req, res, token, maxAge) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = process.env.NODE_ENV === 'production' || forwardedProto === 'https' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`,
  );
}

function createLoginSession(req, res, student) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  store.createSession({
    tokenHash: sessionTokenHash(token),
    studentId: student.id,
    expiresAt,
  });
  setSessionCookie(req, res, token, Math.floor(SESSION_TTL_MS / 1000));
}

function limitLoginAttempts(req) {
  const key = req.socket.remoteAddress || 'unknown';
  const time = Date.now();
  let entry = loginAttempts.get(key);
  if (!entry || time - entry.startedAt >= LOGIN_WINDOW_MS) {
    entry = { startedAt: time, attempts: 0 };
    loginAttempts.set(key, entry);
  }
  if (entry.attempts >= LOGIN_MAX_ATTEMPTS) {
    fail('Too many sign-in attempts. Try again in 15 minutes.', 429);
  }
  entry.attempts += 1;
  return key;
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

function validateProjectPayload(body) {
  const title = normalizeText(body.title, 'Project title', 3, 80);
  const summary = normalizeText(body.summary, 'Project summary', 10, 400);
  if (typeof body.deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.deadline)) {
    fail('Deadline must use the YYYY-MM-DD format.', 400, 'deadline');
  }
  if (!Array.isArray(body.roles) || body.roles.length < 1 || body.roles.length > 6) {
    fail('Choose between 1 and 6 roles for the team.', 400, 'roles');
  }
  const roleNames = new Set();
  const roles = body.roles.map((role) => {
    const name = normalizeText(role.role, 'Role name', 2, 40);
    if (roleNames.has(name)) fail('Each role can appear only once.', 400, 'roles');
    roleNames.add(name);
    return { role: name, slots: asInt(role.slots, 'Role slot count', 1, 3) };
  });
  const teamSize = roles.reduce((sum, role) => sum + role.slots, 0);
  if (teamSize < 2 || teamSize > 8) {
    fail('The total number of seats must be between 2 and 8.', 400, 'roles');
  }
  if (!Array.isArray(body.requirements) || body.requirements.length < 2 || body.requirements.length > 8) {
    fail('Choose between 2 and 8 required skills.', 400, 'requirements');
  }
  const knownSkills = new Set(store.getSnapshot().skills.map((skill) => skill.id));
  const seen = new Set();
  const requirements = body.requirements.map((requirement) => {
    if (!knownSkills.has(requirement.skillId)) {
      fail('One of the selected skills is not in the skill catalog.', 400, 'requirements');
    }
    if (seen.has(requirement.skillId)) fail('Each skill can appear only once.', 400, 'requirements');
    seen.add(requirement.skillId);
    return {
      skillId: requirement.skillId,
      weight: asInt(requirement.weight, 'Skill weight', 1, 5),
      minLevel: asInt(requirement.minLevel, 'Minimum skill level', 1, 5),
    };
  });
  return { title, summary, deadline: body.deadline, roles, requirements, teamSize };
}

function validateProfile(body) {
  const preferredRole = normalizeText(body.preferredRole, 'Preferred role', 2, 40);
  const experience = asInt(body.experience, 'Experience level', 1, 3);
  if (!['available', 'limited', 'busy'].includes(body.availability)) {
    fail('Availability must be available, limited, or busy.', 400, 'availability');
  }
  const bio = normalizeText(body.bio || '', 'Short bio', 0, 320);
  const year = asInt(body.year, 'Year of study', 1, 5);
  const program = normalizeText(body.program, 'Program', 2, 60);
  const linkedinUrl = validateProfileUrl(body.linkedinUrl, 'LinkedIn URL', ['linkedin.com', 'www.linkedin.com']);
  const githubUrl = validateProfileUrl(body.githubUrl, 'GitHub URL', ['github.com', 'www.github.com']);
  if (!Array.isArray(body.skills) || body.skills.length < 1 || body.skills.length > 20) {
    fail('Add between 1 and 20 skills to your profile.', 400, 'skills');
  }
  const knownSkills = new Set(store.getSnapshot().skills.map((skill) => skill.id));
  const seen = new Set();
  const skills = body.skills.map((skill) => {
    if (!knownSkills.has(skill.skillId)) fail('Unknown skill selected.', 400, 'skills');
    if (seen.has(skill.skillId)) fail('Each skill can appear only once.', 400, 'skills');
    seen.add(skill.skillId);
    return { skillId: skill.skillId, level: asInt(skill.level, 'Skill level', 1, 5) };
  });
  return {
    preferredRole,
    experience,
    availability: body.availability,
    bio,
    year,
    program,
    linkedinUrl,
    githubUrl,
    skills,
  };
}

function validateProfileUrl(value, label, allowedHosts) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 2048) {
    fail(`${label} must be a valid HTTPS profile link.`, 400, label.toLowerCase().replaceAll(' ', ''));
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    fail(`${label} must be a valid HTTPS profile link.`, 400, label.toLowerCase().replaceAll(' ', ''));
  }
  if (
    url.protocol !== 'https:' ||
    !allowedHosts.includes(url.hostname.toLowerCase()) ||
    url.port ||
    url.username ||
    url.password
  ) {
    fail(`${label} must use HTTPS and its official profile domain.`, 400, label.toLowerCase().replaceAll(' ', ''));
  }
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function snapshotWithStats(studentId) {
  const snapshot = store.getSnapshot();
  const visible = {
    ...snapshot,
    students: snapshot.students.map((student) =>
      student.id === studentId ? student : { ...student, email: null },
    ),
  };
  return { ...visible, stats: buildStats(visible), mode: 'live' };
}

function broadcast(event) {
  const payload = { ...event, at: new Date().toISOString() };
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients.keys()) {
    try {
      client.write(frame);
    } catch {
      clients.delete(client);
    }
  }
}

function eventFromProject(type, projectId, actorId, message, extra = {}) {
  return { type, projectId, actorId, message, ...extra };
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;

  if (req.method === 'GET' && pathname === '/api/health') {
    let databaseOk = false;
    try {
      store.db.prepare('SELECT 1').get();
      databaseOk = true;
    } catch {
      databaseOk = false;
    }
    return sendJson(res, databaseOk ? 200 : 503, {
      ok: databaseOk,
      service: 'teamforge',
      database: 'sqlite',
      databaseOk,
      realtimeClients: clients.size,
      serverTime: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && pathname === '/api/session') {
    const student = currentStudent(req);
    return sendJson(res, 200, {
      student: student ? { id: student.id, name: student.name, email: student.email } : null,
    });
  }

  if (req.method === 'GET' && pathname === '/api/catalog') {
    const snapshot = store.getSnapshot();
    return sendJson(res, 200, { skills: snapshot.skills, roles: ROLE_CATALOG });
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    const body = await readJson(req);
    const name = normalizeText(body.name, 'Name', 2, 60);
    const email = normalizeText(body.email, 'Email address', 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail('Enter a valid email address.', 400, 'email');
    }
    if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) {
      fail('Password must be between 10 and 128 characters.', 400, 'password');
    }
    const program = normalizeText(body.program, 'Program', 2, 60);
    const year = asInt(body.year, 'Year of study', 1, 5);
    const preferredRole = normalizeText(body.preferredRole, 'Preferred role', 2, 40);
    if (!ROLE_CATALOG.includes(preferredRole)) fail('Choose a role from the catalog.', 400, 'preferredRole');
    const skillId = normalizeText(body.skillId, 'First skill', 1, 80);
    const knownSkills = new Set(store.getSnapshot().skills.map((skill) => skill.id));
    if (!knownSkills.has(skillId)) fail('Choose a skill from the catalog.', 400, 'skillId');
    if (store.getAccountByEmail(email)) fail('An account with this email already exists.', 409, 'email');
    let student;
    try {
      student = store.createAccount({
        name,
        email,
        year,
        program,
        preferredRole,
        skillId,
        skillLevel: asInt(body.skillLevel, 'Skill level', 1, 5),
        passwordHash: hashPassword(body.password),
      });
    } catch (error) {
      if (store.getAccountByEmail(email)) fail('An account with this email already exists.', 409, 'email');
      throw error;
    }
    createLoginSession(req, res, student);
    return sendJson(res, 201, { student: { id: student.id, name: student.name, email: student.email } });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await readJson(req);
    const email = normalizeText(body.email, 'Email address', 3, 254).toLowerCase();
    if (typeof body.password !== 'string' || body.password.length > 128) {
      fail('Enter your email and password.', 400, 'password');
    }
    const attemptKey = limitLoginAttempts(req);
    const account = store.getAccountByEmail(email);
    const valid = verifyPassword(body.password, account?.password_hash || null);
    if (!account || !account.password_hash || !valid) fail('Email or password is incorrect.', 401);
    clearLoginAttempts(attemptKey);
    const student = store.getStudents().find((entry) => entry.id === account.id);
    createLoginSession(req, res, student);
    return sendJson(res, 200, { student: { id: student.id, name: student.name, email: student.email } });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    const token = requestCookie(req, SESSION_COOKIE);
    const student = currentStudent(req);
    if (token) store.deleteSession(sessionTokenHash(token));
    setSessionCookie(req, res, '', 0);
    for (const [client, studentId] of clients) {
      if (student?.id === studentId) {
        client.end();
        clients.delete(client);
      }
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/bootstrap') {
    const student = requireStudent(req);
    return sendJson(res, 200, snapshotWithStats(student.id));
  }

  if (req.method === 'GET' && pathname === '/api/students') {
    requireStudent(req);
    return sendJson(res, 200, {
      students: store.getStudents().map(({ email, ...student }) => student),
    });
  }

  const matchesRoute = pathname.match(/^\/api\/projects\/([^/]+)\/matches$/);
  if (req.method === 'GET' && matchesRoute) {
    requireStudent(req);
    const snapshot = store.getSnapshot();
    const project = snapshot.projects.find((entry) => entry.id === matchesRoute[1]);
    if (!project) fail('Project not found.', 404);
    const team = snapshot.teams.find((entry) => entry.id === project.teamId);
    const teamWithStudents = team
      ? {
          ...team,
          memberStudents: team.members
            .map((member) => snapshot.students.find((student) => student.id === member.studentId))
            .filter(Boolean),
        }
      : { members: [] };
    const results = rankCandidates(project, teamWithStudents, snapshot.students);
    store.saveCompatibility(project.id, results);
    const pending = new Set(
      snapshot.invitations
        .filter((invite) => invite.projectId === project.id && invite.status === 'pending')
        .map((invite) => invite.inviteeId),
    );
    return sendJson(res, 200, {
      projectId: project.id,
      teamStatus: team ? team.status : 'forming',
      matches: results.map((result) => ({
        studentId: result.studentId,
        score: result.score,
        breakdown: result.breakdown,
        missingSkills: result.missingSkills,
        reasons: result.reasons,
        openRoles: result.openRoles,
        invitePending: pending.has(result.studentId),
      })),
      computedAt: new Date().toISOString(),
    });
  }

  const projectRoute = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectRoute && req.method === 'PATCH') {
    const student = requireStudent(req);
    const snapshot = store.getSnapshot();
    const project = snapshot.projects.find((entry) => entry.id === projectRoute[1]);
    if (!project) fail('Project not found.', 404);
    if (project.ownerId !== student.id) fail('Only the project lead can edit this brief.', 403);
    const body = await readJson(req);
    const validated = validateProjectPayload(body);
    store.updateProject(project.id, validated);
    broadcast(
      eventFromProject(
        'project.updated',
        project.id,
        student.id,
        `${student.name} updated the brief for ${validated.title}`,
      ),
    );
    return sendJson(res, 200, { projectId: project.id, snapshot: snapshotWithStats(student.id) });
  }

  if (req.method === 'POST' && pathname === '/api/projects') {
    const student = requireStudent(req);
    const body = await readJson(req);
    const validated = validateProjectPayload(body);
    const projectId = store.createProject({ ...validated, ownerId: student.id });
    broadcast(
      eventFromProject(
        'project.created',
        projectId,
        student.id,
        `${student.name} opened ${validated.title} for teammates`,
      ),
    );
    return sendJson(res, 201, { projectId, snapshot: snapshotWithStats(student.id) });
  }

  const invitationRoute = pathname.match(/^\/api\/projects\/([^/]+)\/invitations$/);
  if (invitationRoute && req.method === 'POST') {
    const student = requireStudent(req);
    const snapshot = store.getSnapshot();
    const project = snapshot.projects.find((entry) => entry.id === invitationRoute[1]);
    if (!project) fail('Project not found.', 404);
    if (project.ownerId !== student.id) fail('Only the project lead can invite teammates.', 403);
    const body = await readJson(req);
    const invitee = snapshot.students.find((entry) => entry.id === body.inviteeId);
    if (!invitee) fail('Choose a student to invite.', 400, 'inviteeId');
    const role = normalizeText(body.role, 'Invitation role', 2, 40);
    if (!project.roles.some((entry) => entry.role === role)) {
      fail('That role is not part of this project brief.', 400, 'role');
    }
    const message =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 280)
        : `Your skills look like a strong fit for ${project.title}.`;
    const invitationId = store.createInvitation({
      projectId: project.id,
      inviterId: student.id,
      inviteeId: invitee.id,
      role,
      message,
    });
    broadcast(
      eventFromProject(
        'invitation.created',
        project.id,
        student.id,
        `${student.name} invited ${invitee.name} to ${project.title} as ${role}`,
        { inviteeId: invitee.id, invitationId },
      ),
    );
    return sendJson(res, 201, {
      invitationId,
      snapshot: snapshotWithStats(student.id),
    });
  }

  const responseRoute = pathname.match(/^\/api\/invitations\/([^/]+)\/respond$/);
  if (responseRoute && req.method === 'POST') {
    const student = requireStudent(req);
    const body = await readJson(req);
    if (!['accept', 'decline'].includes(body.action)) {
      fail('Response action must be accept or decline.', 400, 'action');
    }
    const snapshot = store.getSnapshot();
    const invitation = snapshot.invitations.find((entry) => entry.id === responseRoute[1]);
    if (!invitation) fail('Invitation not found.', 404);
    if (invitation.inviteeId !== student.id) fail('This invitation belongs to another student.', 403);
    const project = snapshot.projects.find((entry) => entry.id === invitation.projectId);
    const result = store.respondToInvitation({
      invitationId: invitation.id,
      studentId: student.id,
      action: body.action,
    });
    const message =
      body.action === 'accept'
        ? `${student.name} accepted the ${invitation.role} invitation for ${project ? project.title : invitation.projectId}`
        : `${student.name} declined the ${invitation.role} invitation for ${project ? project.title : invitation.projectId}`;
    broadcast(
      eventFromProject(
        body.action === 'accept' ? 'invitation.accepted' : 'invitation.declined',
        invitation.projectId,
        student.id,
        message,
        { inviteeId: student.id, invitationId: invitation.id },
      ),
    );
    return sendJson(res, 200, { ...result, snapshot: snapshotWithStats(student.id) });
  }

  const lockRoute = pathname.match(/^\/api\/teams\/([^/]+)\/lock$/);
  if (lockRoute && req.method === 'POST') {
    const student = requireStudent(req);
    const snapshot = store.getSnapshot();
    const team = snapshot.teams.find((entry) => entry.id === lockRoute[1]);
    if (!team) fail('Team not found.', 404);
    const project = snapshot.projects.find((entry) => entry.id === team.projectId);
    if (!project) fail('Project not found.', 404);
    store.lockTeam({ teamId: team.id, ownerId: student.id });
    broadcast(
      eventFromProject(
        'team.locked',
        project.id,
        student.id,
        `${project.title} locked a complete roster`,
      ),
    );
    return sendJson(res, 200, { status: 'locked', snapshot: snapshotWithStats(student.id) });
  }

  const studentRoute = pathname.match(/^\/api\/students\/([^/]+)$/);
  if (studentRoute && req.method === 'PATCH') {
    const student = requireStudent(req);
    if (student.id !== studentRoute[1]) fail('You can only edit your own profile.', 403);
    const body = await readJson(req);
    const validated = validateProfile(body);
    const updated = store.updateStudent({ studentId: student.id, ...validated });
    broadcast({
      type: 'profile.updated',
      actorId: student.id,
      projectId: null,
      message: `${student.name} updated their skill profile`,
    });
    return sendJson(res, 200, { student: updated, snapshot: snapshotWithStats(student.id) });
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    const student = requireStudent(req);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 3000\n\n`);
    res.write(
      `data: ${JSON.stringify({ type: 'connected', message: 'Realtime channel open', at: new Date().toISOString() })}\n\n`,
    );
    clients.set(res, student.id);
    const heartbeat = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(heartbeat);
        clients.delete(res);
      }
    }, 25000);
    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
    return;
  }

  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: { message: 'API route not found.' } });
  }

  return sendJson(res, 404, { error: { message: 'Not found.' } });
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }
  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(ROOT, 'index.html');
  } else if (pathname === '/data/seed.json') {
    filePath = path.join(ROOT, 'data', 'seed.json');
  } else if (pathname.startsWith('/assets/') || pathname.startsWith('/shared/')) {
    const decoded = decodeURIComponent(pathname);
    filePath = path.join(ROOT, decoded);
    const allowedRoots = [path.join(ROOT, 'assets'), path.join(ROOT, 'shared')];
    if (!allowedRoots.some((root) => filePath.startsWith(root + path.sep))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const info = await stat(filePath);
  if (!info.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const isFont = ext === '.woff2';
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': isFont ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url.pathname);
    }
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('[teamforge]', error);
    if (!res.headersSent) {
      sendJson(res, status, {
        error: {
          message: status >= 500 ? 'Something went wrong on the server.' : error.message,
          ...(error.field ? { field: error.field } : {}),
        },
      });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`TeamForge is running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${store.dbPath}`);
  console.log(`Role catalog: ${ROLE_CATALOG.length} roles available`);
});
