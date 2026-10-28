from contextlib import contextmanager

from flask import current_app
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


def make_engine(url):
    if url in ("sqlite://", "sqlite:///:memory:"):
        return create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    return create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})


def _migrate(engine):
    """Tiny forward-only migration: databases created before gpu_count existed get the column added."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    if "workload_profiles" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("workload_profiles")}
        if "gpu_count" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE workload_profiles ADD COLUMN gpu_count INTEGER DEFAULT 0"))


def init_db(app, url):
    from backend.models import pricing, workload  # noqa: F401  (register tables)
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    _migrate(engine)
    app.extensions["engine"] = engine
    app.extensions["session_factory"] = sessionmaker(engine, expire_on_commit=False)


@contextmanager
def session_scope():
    """Per-operation session; all queries use bound parameters (no SQL string building)."""
    session = current_app.extensions["session_factory"]()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
