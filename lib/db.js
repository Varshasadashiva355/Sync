import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_STUDENT_CREATED_AT = '2026-09-01T08:00:00.000Z';

function now() {
  return new Date().toISOString();
}

export function openStore(rootDir) {
  const dataDir = path.join(rootDir, 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.TEAMFORGE_DB || path.join(dataDir, 'teamforge.db');
  const db = new DatabaseSync(dbPath);
  db.exec(readFileSync(path.join(rootDir, 'schema.sql'), 'utf8'));
  const studentColumns = db.prepare('PRAGMA table_info(students)').all();
  if (!studentColumns.some((column) => column.name === 'password_hash')) {
    db.exec('ALTER TABLE students ADD COLUMN password_hash TEXT');
  }
  if (!studentColumns.some((column) => column.name === 'linkedin_url')) {
    db.exec("ALTER TABLE students ADD COLUMN linkedin_url TEXT NOT NULL DEFAULT ''");
  }
  if (!studentColumns.some((column) => column.name === 'github_url')) {
    db.exec("ALTER TABLE students ADD COLUMN github_url TEXT NOT NULL DEFAULT ''");
  }
  if (Number(db.prepare('SELECT COUNT(*) AS count FROM students').get().count) === 0) {
    seed(db, rootDir);
  }
  return {
    db,
    dbPath,
    getSnapshot: () => getSnapshot(db),
    getStudents: () => getStudents(db),
    getAccountByEmail: (email) => getAccountByEmail(db, email),
    createAccount: (payload) => createAccount(db, payload),
    createSession: (payload) => createSession(db, payload),
    getSessionStudent: (tokenHash) => getSessionStudent(db, tokenHash),
    deleteSession: (tokenHash) => deleteSession(db, tokenHash),
    updateStudent: (payload) => updateStudent(db, payload),
    createProject: (payload) => createProject(db, payload),
    updateProject: (projectId, payload) => updateProject(db, projectId, payload),
    createInvitation: (payload) => createInvitation(db, payload),
    respondToInvitation: (payload) => respondToInvitation(db, payload),
    lockTeam: (payload) => lockTeam(db, payload),
    saveCompatibility: (projectId, results) => saveCompatibility(db, projectId, results),
  };
}

function seed(db, rootDir) {
  const seedPath = path.join(rootDir, 'data', 'seed.json');
  const seedData = JSON.parse(readFileSync(seedPath, 'utf8'));
  const createdAt = seedData.generatedAt || now();

  withTransaction(db, () => {
    const insertSkill = db.prepare('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)');
    for (const skill of seedData.skills) insertSkill.run(skill.id, skill.name, skill.category);

    const insertStudent = db.prepare(`
      INSERT INTO students (id, name, email, year, program, preferred_role, experience, availability, bio, avatar_tone, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStudentSkill = db.prepare(
      'INSERT INTO student_skills (student_id, skill_id, level) VALUES (?, ?, ?)',
    );
    for (const student of seedData.students) {
      insertStudent.run(
        student.id,
        student.name,
        student.email,
        student.year,
        student.program,
        student.preferredRole,
        student.experience,
        student.availability,
        student.bio || '',
        student.avatarTone || 'navy',
        DEFAULT_STUDENT_CREATED_AT,
      );
      for (const skill of student.skills) {
        insertStudentSkill.run(student.id, skill.skillId, skill.level);
      }
    }

    const insertProject = db.prepare(`
      INSERT INTO projects (id, title, summary, owner_id, team_size, deadline, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertProjectSkill = db.prepare(
      'INSERT INTO project_skills (project_id, skill_id, weight, min_level) VALUES (?, ?, ?, ?)',
    );
    const insertProjectRole = db.prepare(
      'INSERT INTO project_roles (project_id, role, slots) VALUES (?, ?, ?)',
    );
    for (const project of seedData.projects) {
      insertProject.run(
        project.id,
        project.title,
        project.summary,
        project.ownerId,
        project.teamSize,
        project.deadline,
        project.createdAt || createdAt,
      );
      for (const requirement of project.requirements) {
        insertProjectSkill.run(
          project.id,
          requirement.skillId,
          requirement.weight,
          requirement.minLevel,
        );
      }
      for (const role of project.roles) {
        insertProjectRole.run(project.id, role.role, role.slots);
      }
    }

    const insertTeam = db.prepare(`
      INSERT INTO teams (id, project_id, name, status, created_at, locked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertMember = db.prepare(
      'INSERT INTO team_members (team_id, student_id, role, joined_at) VALUES (?, ?, ?, ?)',
    );
    for (const team of seedData.teams) {
      insertTeam.run(
        team.id,
        team.projectId,
        team.name,
        team.status,
        team.createdAt || createdAt,
        team.lockedAt || null,
      );
      for (const member of team.members) {
        insertMember.run(team.id, member.studentId, member.role, member.joinedAt || createdAt);
      }
    }

    const insertInvitation = db.prepare(`
      INSERT INTO invitations
        (id, project_id, team_id, inviter_id, invitee_id, role, message, status, created_at, responded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const invite of seedData.invitations) {
      insertInvitation.run(
        invite.id,
        invite.projectId,
        invite.teamId,
        invite.inviterId,
        invite.inviteeId,
        invite.role,
        invite.message || '',
        invite.status,
        invite.createdAt,
        invite.respondedAt || null,
      );
    }

    const insertActivity = db.prepare(`
      INSERT INTO activity (id, project_id, actor_id, type, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const entry of seedData.activity) {
      insertActivity.run(
        entry.id,
        entry.projectId || null,
        entry.actorId || null,
        entry.type,
        entry.message,
        entry.createdAt,
      );
    }
  });
}

function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // The original failure is more useful than a rollback failure.
    }
    throw error;
  }
}

function getStudents(db) {
  const rows = db.prepare('SELECT * FROM students ORDER BY name COLLATE NOCASE').all();
  const skillRows = db
    .prepare(`
      SELECT ss.student_id, ss.skill_id, ss.level, s.name, s.category
      FROM student_skills ss
      JOIN skills s ON s.id = ss.skill_id
      ORDER BY s.category, s.name
    `)
    .all();
  const skillsByStudent = new Map();
  for (const row of skillRows) {
    if (!skillsByStudent.has(row.student_id)) skillsByStudent.set(row.student_id, []);
    skillsByStudent.get(row.student_id).push({
      skillId: row.skill_id,
      name: row.name,
      category: row.category,
      level: row.level,
    });
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    year: row.year,
    program: row.program,
    preferredRole: row.preferred_role,
    experience: row.experience,
    availability: row.availability,
    bio: row.bio,
    avatarTone: row.avatar_tone,
    linkedinUrl: row.linkedin_url || '',
    githubUrl: row.github_url || '',
    skills: skillsByStudent.get(row.id) || [],
  }));
}

function getAccountByEmail(db, email) {
  return db
    .prepare('SELECT id, password_hash FROM students WHERE LOWER(email) = ?')
    .get(email) || null;
}

function createAccount(db, payload) {
  const studentId = `s-${randomUUID().slice(0, 12)}`;
  const createdAt = now();
  withTransaction(db, () => {
    db.prepare(`
      INSERT INTO students
        (id, name, email, year, program, preferred_role, experience, availability, bio, avatar_tone, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'available', '', 'teal', ?, ?)
    `).run(
      studentId,
      payload.name,
      payload.email,
      payload.year,
      payload.program,
      payload.preferredRole,
      payload.passwordHash,
      createdAt,
    );
    db.prepare('INSERT INTO student_skills (student_id, skill_id, level) VALUES (?, ?, ?)').run(
      studentId,
      payload.skillId,
      payload.skillLevel,
    );
    addActivity(db, {
      projectId: null,
      actorId: studentId,
      type: 'student_joined',
      message: `${payload.name} joined the student network`,
    });
  });
  return getStudents(db).find((student) => student.id === studentId);
}

function createSession(db, payload) {
  db.prepare(`
    INSERT INTO sessions (token_hash, student_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(payload.tokenHash, payload.studentId, payload.expiresAt, now());
}

function getSessionStudent(db, tokenHash) {
  const row = db.prepare(`
    SELECT students.id
    FROM sessions
    JOIN students ON students.id = sessions.student_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, now());
  return row ? getStudents(db).find((student) => student.id === row.id) || null : null;
}

function deleteSession(db, tokenHash) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

function getSnapshot(db) {
  const skills = db.prepare('SELECT * FROM skills ORDER BY category, name').all().map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
  }));
  const students = getStudents(db);
  const projectRows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  const requirementRows = db
    .prepare(`
      SELECT ps.project_id, ps.skill_id, ps.weight, ps.min_level, s.name, s.category
      FROM project_skills ps
      JOIN skills s ON s.id = ps.skill_id
    `)
    .all();
  const roleRows = db.prepare('SELECT * FROM project_roles').all();
  const teamRows = db.prepare('SELECT * FROM teams').all();
  const memberRows = db.prepare('SELECT * FROM team_members ORDER BY joined_at').all();
  const invitationRows = db.prepare('SELECT * FROM invitations ORDER BY created_at DESC').all();
  const activityRows = db
    .prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT 60')
    .all();

  const requirementsByProject = groupBy(requirementRows, 'project_id', (row) => ({
    skillId: row.skill_id,
    name: row.name,
    category: row.category,
    weight: row.weight,
    minLevel: row.min_level,
  }));
  const rolesByProject = groupBy(roleRows, 'project_id', (row) => ({
    role: row.role,
    slots: row.slots,
  }));
  const membersByTeam = groupBy(memberRows, 'team_id', (row) => ({
    studentId: row.student_id,
    role: row.role,
    joinedAt: row.joined_at,
  }));
  const teams = teamRows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    lockedAt: row.locked_at,
    members: membersByTeam.get(row.id) || [],
  }));
  const teamByProject = new Map(teams.map((team) => [team.projectId, team]));
  const projects = projectRows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    ownerId: row.owner_id,
    teamSize: row.team_size,
    deadline: row.deadline,
    createdAt: row.created_at,
    requirements: requirementsByProject.get(row.id) || [],
    roles: rolesByProject.get(row.id) || [],
    teamId: teamByProject.get(row.id) ? teamByProject.get(row.id).id : null,
  }));

  return {
    students,
    skills,
    projects,
    teams,
    invitations: invitationRows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      teamId: row.team_id,
      inviterId: row.inviter_id,
      inviteeId: row.invitee_id,
      role: row.role,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      respondedAt: row.responded_at,
    })),
    activity: activityRows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      actorId: row.actor_id,
      type: row.type,
      message: row.message,
      createdAt: row.created_at,
    })),
    serverTime: now(),
  };
}

function groupBy(rows, key, mapper) {
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row[key])) result.set(row[key], []);
    result.get(row[key]).push(mapper(row));
  }
  return result;
}

function updateStudent(db, payload) {
  const {
    studentId,
    preferredRole,
    experience,
    availability,
    bio,
    year,
    program,
    linkedinUrl,
    githubUrl,
    skills,
  } = payload;
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!student) {
    const error = new Error('Student profile not found.');
    error.status = 404;
    throw error;
  }
  withTransaction(db, () => {
    db.prepare(`
      UPDATE students
        SET preferred_role = ?, experience = ?, availability = ?, bio = ?, year = ?, program = ?,
          linkedin_url = ?, github_url = ?
      WHERE id = ?
    `).run(
      preferredRole ?? student.preferred_role,
      experience ?? student.experience,
      availability ?? student.availability,
      bio ?? student.bio,
      year ?? student.year,
      program ?? student.program,
      linkedinUrl ?? student.linkedin_url ?? '',
      githubUrl ?? student.github_url ?? '',
      studentId,
    );
    if (Array.isArray(skills)) {
      db.prepare('DELETE FROM student_skills WHERE student_id = ?').run(studentId);
      const insert = db.prepare(
        'INSERT INTO student_skills (student_id, skill_id, level) VALUES (?, ?, ?)',
      );
      for (const skill of skills) {
        insert.run(studentId, skill.skillId, skill.level);
      }
    }
    addActivity(db, {
      projectId: null,
      actorId: studentId,
      type: 'profile_updated',
      message: `${student.name} updated their skill profile`,
    });
  });
  return getStudents(db).find((entry) => entry.id === studentId);
}

function createProject(db, payload) {
  const { ownerId, title, summary, deadline, roles, requirements } = payload;
  const owner = db.prepare('SELECT * FROM students WHERE id = ?').get(ownerId);
  if (!owner) {
    const error = new Error('Project owner not found.');
    error.status = 404;
    throw error;
  }
  const teamSize = roles.reduce((sum, role) => sum + Number(role.slots), 0);
  const projectId = `p-${randomUUID().slice(0, 10)}`;
  const teamId = `t-${randomUUID().slice(0, 10)}`;
  const createdAt = now();
  withTransaction(db, () => {
    db.prepare(`
      INSERT INTO projects (id, title, summary, owner_id, team_size, deadline, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, title, summary, ownerId, teamSize, deadline, createdAt);
    const insertRequirement = db.prepare(
      'INSERT INTO project_skills (project_id, skill_id, weight, min_level) VALUES (?, ?, ?, ?)',
    );
    for (const requirement of requirements) {
      insertRequirement.run(
        projectId,
        requirement.skillId,
        requirement.weight,
        requirement.minLevel,
      );
    }
    const insertRole = db.prepare(
      'INSERT INTO project_roles (project_id, role, slots) VALUES (?, ?, ?)',
    );
    for (const role of roles) insertRole.run(projectId, role.role, role.slots);

    db.prepare(`
      INSERT INTO teams (id, project_id, name, status, created_at, locked_at)
      VALUES (?, ?, ?, 'forming', ?, NULL)
    `).run(teamId, projectId, title, createdAt);

    const ownerRole =
      roles.find((role) => role.role === owner.preferred_role)?.role || roles[0].role;
    db.prepare(
      'INSERT INTO team_members (team_id, student_id, role, joined_at) VALUES (?, ?, ?, ?)',
    ).run(teamId, ownerId, ownerRole, createdAt);

    addActivity(db, {
      projectId,
      actorId: ownerId,
      type: 'project_created',
      message: `${owner.name} opened ${title} for teammates`,
    });
  });
  return projectId;
}

function updateProject(db, projectId, payload) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    const error = new Error('Project not found.');
    error.status = 404;
    throw error;
  }
  const team = db.prepare('SELECT * FROM teams WHERE project_id = ?').get(projectId);
  if (team && team.status === 'locked') {
    const error = new Error('A locked team brief cannot be edited.');
    error.status = 409;
    throw error;
  }
  const members = db.prepare('SELECT * FROM team_members WHERE team_id = ?').all(team.id);
  const roles = payload.roles;
  const roleByName = new Map(roles.map((role) => [role.role, role]));
  for (const member of members) {
    const role = roleByName.get(member.role);
    if (!role) {
      const error = new Error(
        `${member.role} still has a member assigned, so that role cannot be removed.`,
      );
      error.status = 409;
      throw error;
    }
    const filled = members.filter((entry) => entry.role === member.role).length;
    if (role.slots < filled) {
      const error = new Error(`The ${member.role} slot count cannot be lower than its members.`);
      error.status = 409;
      throw error;
    }
  }
  const teamSize = roles.reduce((sum, role) => sum + Number(role.slots), 0);
  if (members.length > teamSize) {
    const error = new Error('The new roster is smaller than the current membership.');
    error.status = 409;
    throw error;
  }
  const owner = db.prepare('SELECT name FROM students WHERE id = ?').get(project.owner_id);
  withTransaction(db, () => {
    db.prepare(`
      UPDATE projects SET title = ?, summary = ?, team_size = ?, deadline = ? WHERE id = ?
    `).run(
      payload.title ?? project.title,
      payload.summary ?? project.summary,
      teamSize,
      payload.deadline ?? project.deadline,
      projectId,
    );
    db.prepare('UPDATE teams SET name = ? WHERE project_id = ?').run(
      payload.title ?? project.title,
      projectId,
    );
    if (Array.isArray(payload.requirements)) {
      db.prepare('DELETE FROM project_skills WHERE project_id = ?').run(projectId);
      const insert = db.prepare(
        'INSERT INTO project_skills (project_id, skill_id, weight, min_level) VALUES (?, ?, ?, ?)',
      );
      for (const requirement of payload.requirements) {
        insert.run(projectId, requirement.skillId, requirement.weight, requirement.minLevel);
      }
    }
    db.prepare('DELETE FROM project_roles WHERE project_id = ?').run(projectId);
    const insertRole = db.prepare(
      'INSERT INTO project_roles (project_id, role, slots) VALUES (?, ?, ?)',
    );
    for (const role of roles) insertRole.run(projectId, role.role, role.slots);
    addActivity(db, {
      projectId,
      actorId: project.owner_id,
      type: 'project_updated',
      message: `${owner.name} updated the brief for ${payload.title ?? project.title}`,
    });
    refreshTeamStatus(db, team.id);
  });
  return projectId;
}

function createInvitation(db, payload) {
  const { projectId, inviterId, inviteeId, role, message } = payload;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    const error = new Error('Project not found.');
    error.status = 404;
    throw error;
  }
  const team = db.prepare('SELECT * FROM teams WHERE project_id = ?').get(projectId);
  if (!team) {
    const error = new Error('This project has no team yet.');
    error.status = 409;
    throw error;
  }
  if (team.status !== 'forming') {
    const error = new Error(
      team.status === 'locked'
        ? 'This team is locked and no longer accepts invitations.'
        : 'This team is already complete.',
    );
    error.status = 409;
    throw error;
  }
  const inviter = db.prepare('SELECT * FROM students WHERE id = ?').get(inviterId);
  const invitee = db.prepare('SELECT * FROM students WHERE id = ?').get(inviteeId);
  if (!inviter || !invitee) {
    const error = new Error('Student not found.');
    error.status = 404;
    throw error;
  }
  if (project.owner_id !== inviterId) {
    const error = new Error('Only the project lead can invite teammates.');
    error.status = 403;
    throw error;
  }
  if (inviteeId === inviterId) {
    const error = new Error('You cannot invite yourself.');
    error.status = 400;
    throw error;
  }
  const existingMember = db
    .prepare('SELECT 1 FROM team_members WHERE team_id = ? AND student_id = ?')
    .get(team.id, inviteeId);
  if (existingMember) {
    const error = new Error(`${invitee.name} is already on this team.`);
    error.status = 409;
    throw error;
  }
  const pending = db
    .prepare(
      "SELECT 1 FROM invitations WHERE team_id = ? AND invitee_id = ? AND status = 'pending'",
    )
    .get(team.id, inviteeId);
  if (pending) {
    const error = new Error(`An invitation to ${invitee.name} is already pending.`);
    error.status = 409;
    throw error;
  }
  const openRole = checkOpenRole(db, projectId, team.id, role);
  if (!openRole) {
    const error = new Error(`The ${role} slot is already filled.`);
    error.status = 409;
    throw error;
  }
  const memberCount = Number(
    db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?').get(team.id).count,
  );
  if (memberCount >= project.team_size) {
    const error = new Error('This team is already full.');
    error.status = 409;
    throw error;
  }
  const inviteId = `inv-${randomUUID().slice(0, 10)}`;
  const createdAt = now();
  withTransaction(db, () => {
    db.prepare(`
      INSERT INTO invitations
        (id, project_id, team_id, inviter_id, invitee_id, role, message, status, created_at, responded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL)
    `).run(inviteId, projectId, team.id, inviterId, inviteeId, role, message || '', createdAt);
    addActivity(db, {
      projectId,
      actorId: inviterId,
      type: 'invite_sent',
      message: `${inviter.name} invited ${invitee.name} to ${project.title} as ${role}`,
    });
  });
  return inviteId;
}

function checkOpenRole(db, projectId, teamId, roleName) {
  const role = db
    .prepare('SELECT * FROM project_roles WHERE project_id = ? AND role = ?')
    .get(projectId, roleName);
  if (!role) return null;
  const filled = Number(
    db
      .prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ? AND role = ?')
      .get(teamId, roleName).count,
  );
  return filled < role.slots ? role : null;
}

function respondToInvitation(db, payload) {
  const { invitationId, studentId, action } = payload;
  const invite = db.prepare('SELECT * FROM invitations WHERE id = ?').get(invitationId);
  if (!invite) {
    const error = new Error('Invitation not found.');
    error.status = 404;
    throw error;
  }
  if (invite.invitee_id !== studentId) {
    const error = new Error('This invitation belongs to another student.');
    error.status = 403;
    throw error;
  }
  if (invite.status !== 'pending') {
    const error = new Error('This invitation has already been answered.');
    error.status = 409;
    throw error;
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(invite.project_id);
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(invite.team_id);
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!project || !team || !student) {
    const error = new Error('The invitation target no longer exists.');
    error.status = 409;
    throw error;
  }

  if (action === 'decline') {
    withTransaction(db, () => {
      db.prepare(
        "UPDATE invitations SET status = 'declined', responded_at = ? WHERE id = ?",
      ).run(now(), invitationId);
      addActivity(db, {
        projectId: project.id,
        actorId: studentId,
        type: 'invite_declined',
        message: `${student.name} declined the ${invite.role} invitation for ${project.title}`,
      });
    });
    return { status: 'declined' };
  }

  if (team.status !== 'forming') {
    const error = new Error(
      team.status === 'locked'
        ? 'This team is locked and cannot accept new members.'
        : 'This team is already complete.',
    );
    error.status = 409;
    throw error;
  }
  const role = checkOpenRole(db, project.id, team.id, invite.role);
  if (!role) {
    const error = new Error(`The ${invite.role} slot is no longer open.`);
    error.status = 409;
    throw error;
  }
  const memberCount = Number(
    db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?').get(team.id).count,
  );
  if (memberCount >= project.team_size) {
    const error = new Error('This team filled up before the invitation was accepted.');
    error.status = 409;
    throw error;
  }
  const joinedAt = now();
  let nextStatus = 'forming';
  withTransaction(db, () => {
    db.prepare(
      'INSERT INTO team_members (team_id, student_id, role, joined_at) VALUES (?, ?, ?, ?)',
    ).run(team.id, studentId, invite.role, joinedAt);
    db.prepare(
      "UPDATE invitations SET status = 'accepted', responded_at = ? WHERE id = ?",
    ).run(joinedAt, invitationId);
    addActivity(db, {
      projectId: project.id,
      actorId: studentId,
      type: 'invite_accepted',
      message: `${student.name} joined ${project.title} as ${invite.role}`,
    });
    nextStatus = refreshTeamStatus(db, team.id);
  });
  return { status: nextStatus === 'complete' ? 'complete' : 'accepted' };
}

function refreshTeamStatus(db, teamId) {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
  if (!team || team.status === 'locked') return team ? team.status : null;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(team.project_id);
  const members = db.prepare('SELECT * FROM team_members WHERE team_id = ?').all(teamId);
  const roles = db.prepare('SELECT * FROM project_roles WHERE project_id = ?').all(team.project_id);
  const allRolesFilled = roles.every((role) => {
    const filled = members.filter((member) => member.role === role.role).length;
    return filled >= role.slots;
  });
  const complete = members.length >= project.team_size && allRolesFilled;
  const nextStatus = complete ? 'complete' : 'forming';
  if (nextStatus !== team.status) {
    db.prepare('UPDATE teams SET status = ? WHERE id = ?').run(nextStatus, teamId);
    if (nextStatus === 'complete') {
      addActivity(db, {
        projectId: project.id,
        actorId: null,
        type: 'team_complete',
        message: `${project.title} reached a balanced full roster`,
      });
    }
  }
  return nextStatus;
}

function lockTeam(db, payload) {
  const { teamId, ownerId } = payload;
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
  if (!team) {
    const error = new Error('Team not found.');
    error.status = 404;
    throw error;
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(team.project_id);
  if (!project) {
    const error = new Error('Project not found.');
    error.status = 404;
    throw error;
  }
  if (project.owner_id !== ownerId) {
    const error = new Error('Only the project lead can lock the team.');
    error.status = 403;
    throw error;
  }
  if (team.status === 'locked') return { status: 'locked' };
  if (team.status !== 'complete') {
    const error = new Error('Fill every role before locking the roster.');
    error.status = 409;
    throw error;
  }
  const lockedAt = now();
  withTransaction(db, () => {
    db.prepare("UPDATE teams SET status = 'locked', locked_at = ? WHERE id = ?").run(
      lockedAt,
      teamId,
    );
    addActivity(db, {
      projectId: project.id,
      actorId: ownerId,
      type: 'team_locked',
      message: `${project.title} locked a complete roster`,
    });
  });
  return { status: 'locked' };
}

function saveCompatibility(db, projectId, results) {
  const computedAt = now();
  withTransaction(db, () => {
    const upsert = db.prepare(`
      INSERT INTO compatibility_scores
        (project_id, student_id, score, breakdown, missing_skills, computed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, student_id) DO UPDATE SET
        score = excluded.score,
        breakdown = excluded.breakdown,
        missing_skills = excluded.missing_skills,
        computed_at = excluded.computed_at
    `);
    for (const result of results) {
      upsert.run(
        projectId,
        result.studentId,
        result.score,
        JSON.stringify(result.breakdown),
        JSON.stringify(result.missingSkills),
        computedAt,
      );
    }
  });
}

function addActivity(db, { projectId, actorId, type, message }) {
  db.prepare(`
    INSERT INTO activity (id, project_id, actor_id, type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`act-${randomUUID().slice(0, 10)}`, projectId || null, actorId || null, type, message, now());
}
