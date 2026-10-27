import sys
from pathlib import Path
import argparse
import psycopg
from psycopg import sql

project_root = Path(__file__).resolve().parent.parent.parent

def reset_test_db(with_logs: bool = False):
    admin_conn_str = "postgresql://postgres:postgres123@localhost:5432/postgres"
    test_db_name = "smart_dormitory_test"
    test_conn_str = f"postgresql://postgres:postgres123@localhost:5432/{test_db_name}"

    print(f"Connecting to {admin_conn_str}...")
    with psycopg.connect(admin_conn_str, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE);").format(sql.Identifier(test_db_name)))
            cur.execute(sql.SQL("CREATE DATABASE {};").format(sql.Identifier(test_db_name)))
            print(f"Created clean database '{test_db_name}'.")

    db_scripts = [
        project_root / "database" / "01_schema.sql",
        project_root / "database" / "02_procedures.sql",
        project_root / "database" / "03_triggers.sql",
    ]
    if with_logs:
        db_scripts.append(project_root / "database" / "04_seed_1m_logs.sql")

    with psycopg.connect(test_conn_str, autocommit=True) as conn:
        with conn.cursor() as cur:
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
