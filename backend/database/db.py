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


def init_db(app, url):
    from backend.models import pricing, workload  # noqa: F401  (register tables)
    engine = make_engine(url)
    Base.metadata.create_all(engine)
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
