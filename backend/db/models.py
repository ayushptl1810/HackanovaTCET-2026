"""
SQLite schema definitions and connection helpers.

Tables:
  - citizen_profiles: Citizen registration, slabs, verification tier
  - tickets: CSC assistance tickets for scheme applications
"""

import os
import sqlite3
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("HAQSE_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "haqse.db"))


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
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


def init_db():
    """Create tables if they don't exist. Safe to call on every startup."""
    with get_db() as conn:
        conn.executescript(_SCHEMA_SQL)
    logger.info("Database initialised at %s", DB_PATH)
