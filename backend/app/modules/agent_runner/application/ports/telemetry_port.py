from abc import ABC, abstractmethod
from typing import Dict

class TelemetryPort(ABC):
    @abstractmethod
    def publish_debug(self, task_id: str, debug_data: Dict[str, object]) -> None:
        """Publish debug/trace information for a specific task."""
        pass
