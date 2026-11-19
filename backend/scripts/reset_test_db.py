import argparse
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings

project_root = backend_dir.parent


def _parse_db_urls(test_db_url: str) -> tuple[str, str, str]:
    """Derive admin maintenance connection string and database name from TEST_DATABASE_URL."""
    parsed = urlsplit(test_db_url)
    test_db_name = parsed.path.lstrip("/")
    if not test_db_name:
        raise ValueError("TEST_DATABASE_URL must include a database name.")
    admin_conn_str = urlunsplit(
        (parsed.scheme, parsed.netloc, "/postgres", parsed.query, parsed.fragment)
    )
    return admin_conn_str, test_db_name, test_db_url


def reset_test_db(with_logs: bool = False):
    admin_conn_str, test_db_name, test_conn_str = _parse_db_urls(
        settings.test_database_url
    )

    print("Connecting to PostgreSQL maintenance database...")
    with (
        psycopg.connect(admin_conn_str, autocommit=True) as conn,
        conn.cursor() as cur,
    ):
        cur.execute(
            sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE);").format(
                sql.Identifier(test_db_name)
            )
        )
        cur.execute(sql.SQL("CREATE DATABASE {};").format(sql.Identifier(test_db_name)))
        print(f"Created clean database '{test_db_name}'.")

    db_scripts = [
        project_root / "database" / "01_schema.sql",
        project_root / "database" / "02_procedures.sql",
        project_root / "database" / "03_triggers.sql",
    ]
    if with_logs:
        db_scripts.append(project_root / "database" / "04_seed_1m_logs.sql")

    with (
        psycopg.connect(test_conn_str, autocommit=True) as conn,
        conn.cursor() as cur,
    ):
        for script in db_scripts:
            print(f"Executing {script.name}...")
            content = script.read_text(encoding="utf-8")
            cur.execute(content)
    print("Database reset completed successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset test database")
    parser.add_argument("--with-logs", action="store_true", help="Include 1M logs seed")
    args = parser.parse_args()
    reset_test_db(with_logs=args.with_logs)
