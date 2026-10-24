export const SCHEMA_VERSION = 1;

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY NOT NULL,
  name          TEXT NOT NULL,
  starts_at     TEXT NOT NULL,
  ends_at       TEXT NOT NULL,
  downloaded_at TEXT
);

CREATE TABLE IF NOT EXISTS stages (
  id        TEXT PRIMARY KEY NOT NULL,
  event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  latitude  REAL NOT NULL,
  longitude REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS concerts (
  id        TEXT PRIMARY KEY NOT NULL,
  event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_id  TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  artist    TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pois (
  id        TEXT PRIMARY KEY NOT NULL,
  event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type      TEXT NOT NULL CHECK (type IN ('toilet','water','medical','gate','food')),
  name      TEXT NOT NULL,
  latitude  REAL NOT NULL,
  longitude REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY NOT NULL,
  login         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_items (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concert_id TEXT NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
  added_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, concert_id)
);

CREATE TABLE IF NOT EXISTS check_ins (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concert_id TEXT NOT NULL REFERENCES concerts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, concert_id)
);

CREATE TABLE IF NOT EXISTS saved_places (
  id        TEXT PRIMARY KEY NOT NULL,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  type      TEXT NOT NULL CHECK (type IN ('tent','meeting_point','parking','other')),
  latitude  REAL NOT NULL,
  longitude REAL NOT NULL,
  saved_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_messages (
  id              TEXT PRIMARY KEY NOT NULL,
  crew_id         TEXT NOT NULL,
  author_id       TEXT NOT NULL,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('queued','sent')),
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at      TEXT NOT NULL,
  next_attempt_at TEXT,
  sent_at         TEXT
);

CREATE TABLE IF NOT EXISTS stops (
  id        INTEGER PRIMARY KEY NOT NULL,
  name      TEXT NOT NULL,
  latitude  REAL NOT NULL,
  longitude REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS departures (
  stop_id       INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  route_name    TEXT NOT NULL,
  headsign      TEXT NOT NULL,
  departure_at  TEXT NOT NULL,
  delay_seconds INTEGER,
  fetched_at    TEXT NOT NULL,
  PRIMARY KEY (stop_id, route_name, departure_at)
);

CREATE TABLE IF NOT EXISTS transit_alerts (
  id         TEXT PRIMARY KEY NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to   TEXT,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stages_event          ON stages(event_id);
CREATE INDEX IF NOT EXISTS idx_concerts_event_starts ON concerts(event_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_concerts_stage        ON concerts(stage_id);
CREATE INDEX IF NOT EXISTS idx_pois_event_lat_lon    ON pois(event_id, latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stops_lat_lon         ON stops(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_schedule_concert      ON schedule_items(concert_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_concert     ON check_ins(concert_id);
CREATE INDEX IF NOT EXISTS idx_saved_places_user     ON saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status_next    ON outbox_messages(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_crew_created   ON outbox_messages(crew_id, created_at);
`;
