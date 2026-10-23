import pytest

from backend.app import create_app
from backend.tests.helpers import BASE_WORKLOAD


@pytest.fixture()
def app():
    return create_app({"SQLALCHEMY_DATABASE_URI": "sqlite://", "TESTING": True})


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def payload():
    return dict(BASE_WORKLOAD)
