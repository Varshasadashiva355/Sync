PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  year            INTEGER NOT NULL CHECK (year BETWEEN 1 AND 5),
  program         TEXT NOT NULL,
  preferred_role  TEXT NOT NULL,
  experience      INTEGER NOT NULL CHECK (experience BETWEEN 1 AND 3),
  availability    TEXT NOT NULL CHECK (availability IN ('available', 'limited', 'busy')),
  bio             TEXT NOT NULL DEFAULT '',
  avatar_tone     TEXT NOT NULL DEFAULT 'navy',
  linkedin_url    TEXT NOT NULL DEFAULT '',
  github_url      TEXT NOT NULL DEFAULT '',
  password_hash   TEXT,
  created_at      TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_lower ON students(LOWER(email));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  category  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_skills (
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  PRIMARY KEY (student_id, skill_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  owner_id    TEXT NOT NULL REFERENCES students(id),
  team_size   INTEGER NOT NULL CHECK (team_size BETWEEN 2 AND 8),
  deadline    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_skills (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  weight      INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 5),
  min_level   INTEGER NOT NULL CHECK (min_level BETWEEN 1 AND 5),
  PRIMARY KEY (project_id, skill_id)
);

CREATE TABLE IF NOT EXISTS project_roles (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  slots       INTEGER NOT NULL CHECK (slots BETWEEN 1 AND 3),
  PRIMARY KEY (project_id, role)
);

CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('forming', 'complete', 'locked')),
  created_at  TEXT NOT NULL,
  locked_at   TEXT
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  joined_at   TEXT NOT NULL,
  PRIMARY KEY (team_id, student_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id       TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  inviter_id    TEXT NOT NULL REFERENCES students(id),
  invitee_id    TEXT NOT NULL REFERENCES students(id),
  role          TEXT NOT NULL,
  message       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    TEXT NOT NULL,
  responded_at  TEXT
);

CREATE TABLE IF NOT EXISTS compatibility_scores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score           REAL NOT NULL,
  breakdown       TEXT NOT NULL,
  missing_skills  TEXT NOT NULL,
  computed_at     TEXT NOT NULL,
  UNIQUE (project_id, student_id)
);

CREATE TABLE IF NOT EXISTS activity (
  id          TEXT PRIMARY KEY,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  actor_id    TEXT REFERENCES students(id),
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee ON invitations(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_team ON invitations(team_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
