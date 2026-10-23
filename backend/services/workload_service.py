from sqlalchemy import select

from backend.models.workload import Workload, WorkloadProfile
from backend.utils.validation import validate_workload


def create_workload(session, data):
    clean = validate_workload(data)
    wp = WorkloadProfile(**clean)
    session.add(wp)
    session.flush()
    return wp.to_dict()


def list_workloads(session):
    return [w.to_dict() for w in session.scalars(select(WorkloadProfile).order_by(WorkloadProfile.id))]


def get_workload(session, wid):
    wp = session.get(WorkloadProfile, wid)
    return wp.to_dict() if wp else None


def to_engine_workload(d):
    return Workload.from_dict(d)
