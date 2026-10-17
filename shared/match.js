export const AVAILABILITY_FACTOR = {
  available: 1,
  limited: 0.7,
  busy: 0.38,
};

export function levelFor(student, skillId) {
  if (!student || !Array.isArray(student.skills)) return 0;
  const entry = student.skills.find((skill) => skill.skillId === skillId);
  return entry ? Number(entry.level) || 0 : 0;
}

export function teamForProject(project, teams) {
  if (!project) return null;
  return teams.find((team) => team.id === project.teamId) || null;
}

export function getOpenRoles(project, team) {
  if (!project || !Array.isArray(project.roles)) return [];
  const members = team && Array.isArray(team.members) ? team.members : [];
  return project.roles.map((role) => {
    const filled = members.filter((member) => member.role === role.role).length;
    return {
      role: role.role,
      slots: role.slots,
      filled,
      open: Math.max(0, role.slots - filled),
    };
  });
}

export function teamMemberStudents(team, students) {
  if (!team) return [];
  return team.members
    .map((member) => students.find((student) => student.id === member.studentId))
    .filter(Boolean);
}

function weightedAverage(project, valueForRequirement) {
  const requirements = project && Array.isArray(project.requirements) ? project.requirements : [];
  let weightSum = 0;
  let valueSum = 0;
  for (const requirement of requirements) {
    const weight = Number(requirement.weight) || 1;
    weightSum += weight;
    valueSum += weight * Math.max(0, Math.min(1, valueForRequirement(requirement)));
  }
  return weightSum ? valueSum / weightSum : 0;
}

function candidateCoverage(candidate, project) {
  return weightedAverage(project, (requirement) => {
    const level = levelFor(candidate, requirement.skillId);
    const min = Math.max(1, Number(requirement.minLevel) || 3);
    if (level >= min) return 1;
    if (level <= 0) return 0;
    return 0.35 + 0.4 * (level / min);
  });
}

function complementarity(candidate, project, teamMembers) {
  const coverage = candidateCoverage(candidate, project);
  if (!teamMembers.length) return coverage * 0.78;
  return weightedAverage(project, (requirement) => {
    const min = Math.max(1, Number(requirement.minLevel) || 3);
    const level = levelFor(candidate, requirement.skillId);
    const teamMax = teamMembers.reduce(
      (max, member) => Math.max(max, levelFor(member, requirement.skillId)),
      0,
    );
    if (teamMax < min) {
      if (level >= min) return 1;
      return (level / min) * 0.6;
    }
    if (level > teamMax) return Math.min((level - teamMax) / 2, 1) * 0.5;
    return 0;
  });
}

function roleFit(candidate, project, team) {
  const openRoles = getOpenRoles(project, team).filter((role) => role.open > 0);
  const preferred = candidate.preferredRole;
  if (openRoles.some((role) => role.role === preferred)) return 1;
  if ((project.roles || []).some((role) => role.role === preferred)) return 0.55;
  return 0.25;
}

function balanceFactor(candidate, teamMembers) {
  if (!teamMembers.length) return 0.75;
  const levels = teamMembers.map((member) => Number(member.experience) || 2);
  levels.push(Number(candidate.experience) || 2);
  const mean = levels.reduce((sum, value) => sum + value, 0) / levels.length;
  const spread = Math.sqrt(
    levels.reduce((sum, value) => sum + (value - mean) ** 2, 0) / levels.length,
  );
  const smoothness = Math.max(0, Math.min(1, 1 - spread / 1.25));
  return Math.max(0, Math.min(1, smoothness * 0.7 + 0.3));
}

function missingForCandidate(candidate, project) {
  return (project.requirements || [])
    .filter((requirement) => levelFor(candidate, requirement.skillId) < requirement.minLevel)
    .map((requirement) => requirement.name || requirement.skillId);
}

function reasonsForCandidate(candidate, project, team, breakdown, openRoles) {
  const reasons = [];
  const covered = [...(project.requirements || [])]
    .filter((requirement) => levelFor(candidate, requirement.skillId) >= requirement.minLevel)
    .sort((a, b) => b.weight - a.weight);
  if (covered.length >= 2) {
    reasons.push(`Covers ${covered[0].name} and ${covered[1].name} at the level the brief needs`);
  } else if (covered.length === 1) {
    reasons.push(`Covers the required ${covered[0].name} skill`);
  }
  const matchingOpenRole = openRoles.find(
    (role) => role.open > 0 && role.role === candidate.preferredRole,
  );
  if (matchingOpenRole) reasons.push(`Fills the open ${matchingOpenRole.role} slot`);
  if (breakdown.complementarity >= 0.55 && team.members.length) {
    reasons.push('Adds depth the current team is missing');
  }
  if (!missingForCandidate(candidate, project).length && covered.length) {
    reasons.push('Meets every declared skill requirement');
  }
  if (!reasons.length) reasons.push('Brings adjacent strengths to this brief');
  return reasons.slice(0, 3);
}

export function scoreCandidate(candidate, project, teamInput) {
  const team = teamInput || { members: [] };
  const members = team.members || [];
  const teamStudents = teamStudentsForScoring(team, candidate, project);
  const coverage = candidateCoverage(candidate, project);
  const complement = complementarity(candidate, project, teamStudents);
  const role = roleFit(candidate, project, team);
  const balance = balanceFactor(candidate, teamStudents);
  const availability = AVAILABILITY_FACTOR[candidate.availability] ?? 0.7;
  const weighted =
    coverage * 0.42 + complement * 0.2 + role * 0.16 + balance * 0.14 + availability * 0.08;
  const breakdown = { coverage, complementarity: complement, roleFit: role, balance, availability };
  return {
    studentId: candidate.id,
    score: Math.round(Math.max(0, Math.min(1, weighted)) * 100),
    breakdown,
    missingSkills: missingForCandidate(candidate, project),
    openRoles: getOpenRoles(project, team).filter((entry) => entry.open > 0),
    reasons: reasonsForCandidate(
      candidate,
      project,
      team,
      breakdown,
      getOpenRoles(project, team),
    ),
  };
}

function teamStudentsForScoring(team, candidate, project) {
  if (Array.isArray(team.memberStudents)) return team.memberStudents;
  const members = Array.isArray(team.members) ? team.members : [];
  const memberIds = new Set(members.map((member) => member.studentId || member.id));
  if (project && Array.isArray(project._students)) {
    return project._students.filter((student) => memberIds.has(student.id));
  }
  return members.filter((member) => Array.isArray(member.skills));
}

export function rankCandidates(project, team, students) {
  if (!project) return [];
  const memberIds = new Set((team && team.members ? team.members : []).map((member) => member.studentId));
  return students
    .filter((student) => !memberIds.has(student.id))
    .map((student) => ({
      ...scoreCandidate(student, project, team),
      student,
    }))
    .sort((a, b) => b.score - a.score || a.student.name.localeCompare(b.student.name));
}

export function scoreTeam(project, team, students) {
  const members = team && Array.isArray(team.members) ? team.members : [];
  const memberStudents = members
    .map((member) => {
      if (Array.isArray(member.skills)) return member;
      return students.find((student) => student.id === member.studentId);
    })
    .filter(Boolean);
  const openRoles = getOpenRoles(project, team);
  const totalSlots = openRoles.reduce((sum, role) => sum + role.slots, 0);
  const filledSlots = openRoles.reduce((sum, role) => sum + role.filled, 0);

  const coverage = weightedAverage(project, (requirement) => {
    const maxLevel = memberStudents.reduce(
      (max, member) => Math.max(max, levelFor(member, requirement.skillId)),
      0,
    );
    if (maxLevel >= requirement.minLevel) return 1;
    if (!maxLevel) return 0;
    return (maxLevel / requirement.minLevel) * 0.6;
  });

  const roles = totalSlots ? filledSlots / totalSlots : 0;
  const levels = memberStudents.map((member) => Number(member.experience) || 2);
  let balance = 0.75;
  if (levels.length) {
    const mean = levels.reduce((sum, value) => sum + value, 0) / levels.length;
    const spread = Math.sqrt(
      levels.reduce((sum, value) => sum + (value - mean) ** 2, 0) / levels.length,
    );
    balance = Math.max(0, Math.min(1, (1 - spread / 1.3) * 0.7 + 0.3));
  }
  const size = project.teamSize ? Math.min(1, members.length / project.teamSize) : 0;
  const score = Math.round((coverage * 0.5 + roles * 0.22 + balance * 0.16 + size * 0.12) * 100);

  const missingSkills = (project.requirements || [])
    .filter((requirement) => {
      const maxLevel = memberStudents.reduce(
        (max, member) => Math.max(max, levelFor(member, requirement.skillId)),
        0,
      );
      return maxLevel < requirement.minLevel;
    })
    .map((requirement) => requirement.name || requirement.skillId);

  return {
    score,
    breakdown: { coverage, roles, balance, size },
    missingSkills,
    openRoles: openRoles.filter((role) => role.open > 0),
    memberCount: members.length,
  };
}

export function normalizeSeed(seed) {
  const skillsById = new Map(seed.skills.map((skill) => [skill.id, skill]));
  const students = seed.students.map((student) => ({
    ...student,
    skills: student.skills
      .map((entry) => {
        const skill = skillsById.get(entry.skillId);
        return skill ? { ...entry, name: skill.name, category: skill.category } : null;
      })
      .filter(Boolean),
  }));
  const projects = seed.projects.map((project) => ({
    ...project,
    requirements: project.requirements
      .map((requirement) => {
        const skill = skillsById.get(requirement.skillId);
        return skill ? { ...requirement, name: skill.name, category: skill.category } : null;
      })
      .filter(Boolean),
  }));
  return { ...seed, students, projects, skills: seed.skills };
}

export function buildStats(snapshot) {
  const forming = snapshot.teams.filter((team) => team.status === 'forming');
  const openRoles = forming.reduce((sum, team) => {
    const project = snapshot.projects.find((entry) => entry.id === team.projectId);
    return sum + getOpenRoles(project, team).reduce((inner, role) => inner + role.open, 0);
  }, 0);
  const pendingInvites = snapshot.invitations.filter((invite) => invite.status === 'pending');
  const readiness = snapshot.teams.map((team) => {
    const project = snapshot.projects.find((entry) => entry.id === team.projectId);
    return scoreTeam(project, team, snapshot.students).score;
  });
  return {
    students: snapshot.students.length,
    projects: snapshot.projects.length,
    liveTeams: forming.length,
    openRoles,
    pendingInvites: pendingInvites.length,
    averageReadiness: readiness.length
      ? Math.round(readiness.reduce((sum, value) => sum + value, 0) / readiness.length)
      : 0,
  };
}
