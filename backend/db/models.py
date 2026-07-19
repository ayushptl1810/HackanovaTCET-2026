"""
SQLite schema definitions and connection helpers.

Tables:
  - citizen_profiles: Citizen registration, slabs, verification tier
  - tickets: CSC assistance tickets for scheme applications

Storage reliability notes
-------------------------
This project lives inside a OneDrive-synced folder. SQLite's WAL mode keeps
freshly-written data in a separate ``<db>-wal`` sidecar until a checkpoint
folds it into the main file. Cloud-sync clients (OneDrive/Dropbox) sync the
main ``.db`` but handle the transient ``-wal``/``-shm`` sidecars unreliably —
when the sidecar is separated from the main file, committed tables silently
"disappear" and every query raises ``no such table``.

To make this robust we:
  1. Use ``journal_mode=DELETE`` (single-file, no sidecars to lose) instead of WAL.
  2. Resolve the DB path to an *absolute* path so a relative ``HAQSE_DB_PATH``
     can't point at a cwd-dependent duplicate.
  3. Self-heal the schema on every connection (``CREATE TABLE IF NOT EXISTS``),
     so a reverted file can never surface as a 500 again.
"""

import os
import sqlite3
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Path resolution — always absolute, anchored to the backend dir.
# A relative HAQSE_DB_PATH (e.g. "h.db") is resolved against the backend
# directory, NOT the process cwd, so the same file is used no matter where
# uvicorn is launched from.
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

_env_path = os.getenv("HAQSE_DB_PATH")
if _env_path:
    DB_PATH = _env_path if os.path.isabs(_env_path) else os.path.join(_BACKEND_DIR, _env_path)
else:
    DB_PATH = os.path.join(_BACKEND_DIR, "haqse.db")
DB_PATH = os.path.abspath(DB_PATH)


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS citizen_profiles (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_hmac        TEXT UNIQUE NOT NULL,
    phone_encrypted   BLOB,
    pin_hash          TEXT NOT NULL,
    name              TEXT DEFAULT '',
    age_slab          TEXT DEFAULT '',
    gender            TEXT DEFAULT '',
    income_slab       TEXT DEFAULT '',
    annual_income     INTEGER DEFAULT 0,
    occupation        TEXT DEFAULT '',
    state             TEXT DEFAULT '',
    preferred_lang    TEXT DEFAULT 'hi',
    verified_tier     INTEGER DEFAULT 0,
    docs_available    TEXT DEFAULT '[]',
    auto_apply_optin  INTEGER DEFAULT 0,
    last_seen         DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_fingerprint TEXT DEFAULT '',
    failed_pin_count  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tickets (
    ticket_id   TEXT PRIMARY KEY,
    phone_hmac  TEXT NOT NULL,
    scheme_id   TEXT NOT NULL,
    status      TEXT DEFAULT 'open',
    csc_id      TEXT DEFAULT '',
    pdf_token   TEXT DEFAULT '',
    priority    INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (phone_hmac) REFERENCES citizen_profiles(phone_hmac)
);

CREATE INDEX IF NOT EXISTS idx_tickets_phone ON tickets(phone_hmac);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
"""


def _ensure_schema(conn: sqlite3.Connection) -> None:
    """Idempotently create all tables/indexes. Cheap; safe to call often."""
    conn.executescript(_SCHEMA_SQL)


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # DELETE journal keeps everything in ONE file — no -wal/-shm sidecars for a
    # cloud-sync client to lose. FULL sync trades a little speed for durability.
    conn.execute("PRAGMA journal_mode=DELETE")
    conn.execute("PRAGMA synchronous=FULL")
    conn.execute("PRAGMA foreign_keys=ON")
    # Self-heal: guarantee the schema exists before the caller runs any query,
    # so a reverted/rehydrated file can never cause a "no such table" 500.
    _ensure_schema(conn)
    return conn


@contextmanager
def get_db():
    """Context manager that yields a sqlite3 connection and auto-commits."""
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist. Safe to call on every startup."""
    with get_db() as conn:
        _ensure_schema(conn)
    logger.info("Database initialised at %s (journal=DELETE)", DB_PATH)
