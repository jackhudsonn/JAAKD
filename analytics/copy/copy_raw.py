"""Nightly copy job: prod tables (public.*) -> analytics database (raw.*).

Run after the backend's price refresh (22:00 UTC) and before dbt:
  python copy/copy_raw.py
(Not named copy.py: that would shadow Python's built-in copy module, which dataclasses imports.)

Connections come from two environment variables (libpq connection strings):
  SOURCE_DSN     prod, as jaakd_analytics_reader (read-only)
  ANALYTICS_DSN  analytics database, as analytics_pipeline
e.g. "host=127.0.0.1 port=5433 dbname=jaakd user=jaakd_analytics_reader password=..."

How it works:
1. Every table is read from one consistent snapshot of prod (REPEATABLE READ), so an order placed
   mid-copy shows up in all tables or none. The snapshot time is recorded as source_snapshot_at.
2. Everything on the analytics side happens in one transaction: drift check, then for each table
   TRUNCATE + COPY, then a raw._load_log row per table. Any failure rolls it all back, so the raw
   tables keep the previous night's data.
3. Rows stream straight from prod to the analytics database with COPY; nothing is written to disk.

Exits 1 on any failure, so Jenkins marks the run as failed.
"""

import logging
import os
import sys
import time
import uuid
from datetime import datetime
from typing import Any

import psycopg
from psycopg import sql

from tables import TABLES, Table

log = logging.getLogger("analytics.copy")

# Fail fast instead of hanging when a database is unreachable.
CONNECT_TIMEOUT_SECONDS = 10

COLUMN_TYPES_SQL = """
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = %s AND table_name = %s
"""


def main() -> int:
    # Log times in UTC, like the rest of the pipeline (snapshot time, Jenkins schedule, dates in the marts).
    logging.Formatter.converter = time.gmtime
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S UTC",
    )
    try:
        run_copy(require_env("SOURCE_DSN"), require_env("ANALYTICS_DSN"))
    except Exception:
        log.exception("Copy failed; the analytics database still has the previous copy")
        return 1
    return 0


def run_copy(source_dsn: str, analytics_dsn: str) -> None:
    run_id = uuid.uuid4()
    log.info("Copy run %s starting (%d tables)", run_id, len(TABLES))

    with connect(source_dsn) as source, connect(analytics_dsn) as analytics:
        # Settings for the source transaction; they apply from its first statement.
        source.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
        source.read_only = True

        with source.transaction(), analytics.transaction():
            snapshot_at = fetch_snapshot_time(source)
            log.info("Source snapshot at %s", snapshot_at.isoformat())

            check_drift(source, analytics)

            row_counts: dict[str, int] = {}
            for table in TABLES:
                row_counts[table.name] = copy_table(source, analytics, table)
                log.info("Copied %-18s %8d rows", table.name, row_counts[table.name])

            record_load(analytics, run_id, snapshot_at, row_counts)

    log.info("Copy run %s finished: %d rows in total", run_id, sum(row_counts.values()))


def connect(dsn: str) -> psycopg.Connection[Any]:
    return psycopg.connect(
        dsn,
        connect_timeout=CONNECT_TIMEOUT_SECONDS,
        application_name="jaakd-analytics-copy",
    )


def fetch_snapshot_time(source: psycopg.Connection[Any]) -> datetime:
    # now() is the start time of the transaction, i.e. the moment the snapshot was taken.
    row = source.execute("SELECT now()").fetchone()
    assert row is not None
    return row[0]


def check_drift(source: psycopg.Connection[Any], analytics: psycopg.Connection[Any]) -> None:
    """Fail before touching any data if tables.py, prod and the raw tables disagree on columns."""
    problems: list[str] = []
    for table in TABLES:
        source_types = column_types(source, "public", table.name)
        raw_types = column_types(analytics, "raw", table.name)

        if set(raw_types) != set(table.columns):
            problems.append(
                f"raw.{table.name} has columns {sorted(raw_types)}, tables.py lists {sorted(table.columns)}"
            )
        for column in table.columns:
            if column in table.computed:
                continue
            if column not in source_types:
                problems.append(f"public.{table.name}.{column} is missing on prod (or not readable)")
            elif column in raw_types and source_types[column] != raw_types[column]:
                problems.append(
                    f"{table.name}.{column} is {source_types[column]} on prod but {raw_types[column]} in raw"
                )

    if problems:
        raise RuntimeError(
            "Schema drift; update analytics/db/setup.sql and copy/tables.py:\n  " + "\n  ".join(problems)
        )


def column_types(conn: psycopg.Connection[Any], schema: str, table: str) -> dict[str, tuple[Any, ...]]:
    rows = conn.execute(COLUMN_TYPES_SQL, (schema, table)).fetchall()
    return {row[0]: tuple(row[1:]) for row in rows}


def copy_table(source: psycopg.Connection[Any], analytics: psycopg.Connection[Any], table: Table) -> int:
    """Replace raw.<table> with the rows of public.<table>; returns the number of rows copied."""
    columns = sql.SQL(", ").join(sql.Identifier(column) for column in table.columns)
    select_list = sql.SQL(", ").join(select_expression(table, column) for column in table.columns)

    copy_out = sql.SQL("COPY (SELECT {} FROM {}) TO STDOUT").format(
        select_list, sql.Identifier("public", table.name)
    )
    copy_in = sql.SQL("COPY {} ({}) FROM STDIN").format(sql.Identifier("raw", table.name), columns)

    analytics.execute(sql.SQL("TRUNCATE {}").format(sql.Identifier("raw", table.name)))

    with source.cursor() as out_cursor, analytics.cursor() as in_cursor:
        with out_cursor.copy(copy_out) as out_copy, in_cursor.copy(copy_in) as in_copy:
            for chunk in out_copy:
                in_copy.write(chunk)
        return in_cursor.rowcount


def select_expression(table: Table, column: str) -> sql.Composable:
    if column in table.computed:
        return sql.SQL("{} AS {}").format(sql.SQL(table.computed[column]), sql.Identifier(column))
    return sql.Identifier(column)


def record_load(
    analytics: psycopg.Connection[Any], run_id: uuid.UUID, snapshot_at: datetime, row_counts: dict[str, int]
) -> None:
    with analytics.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO raw._load_log (run_id, table_name, row_count, source_snapshot_at)"
            " VALUES (%s, %s, %s, %s)",
            [(run_id, name, count, snapshot_at) for name, count in row_counts.items()],
        )


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Environment variable {name} is not set")
    return value


if __name__ == "__main__":
    sys.exit(main())
