from abc import ABC, abstractmethod
from typing import Dict, Any

class TelemetryPort(ABC):
    @abstractmethod
    def publish_debug(self, task_id: str, debug_data: Dict[str, Any]) -> None:
        """Publish debug/trace information for a specific task."""
        pass
