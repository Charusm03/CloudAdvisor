"""Architecture boundary for the future ML classifier (NOT implemented).

The engines only ever see a usage_pattern string. Today it is the user's dropdown value;
later MLWorkloadClassifier.predict(utilization_history) can supply it without touching the cost engine.
"""
from abc import ABC, abstractmethod


class WorkloadClassifier(ABC):
    @abstractmethod
    def predict(self, utilization_history):
        """Return one of utilization patterns: steady-state | bursty | batch/scheduled | gpu-intensive."""


class ManualWorkloadClassifier(WorkloadClassifier):
    """Behaves like a classifier but returns the pattern the user selected."""

    def __init__(self, selected_pattern):
        self.selected_pattern = selected_pattern

    def predict(self, utilization_history=None):
        return self.selected_pattern
