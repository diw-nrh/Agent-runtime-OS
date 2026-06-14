from abc import ABC, abstractmethod
from typing import Dict

class OrchestratorPort(ABC):
    @abstractmethod
    def submit_agent_run(self, blueprint_id: str, payload: Dict[str, object]) -> str:
        """
        Submit a new agent run workflow/task.
        Returns the unique task or run ID.
        """
        pass

    @abstractmethod
    def cancel_run(self, run_id: str) -> bool:
        """
        Cancel a currently executing run.
        Returns True if successful, False otherwise.
        """
        pass

    @abstractmethod
    def send_signal(self, run_id: str, signal_name: str, payload: Dict[str, object]) -> bool:
        """
        Send a signal to a running or paused workflow (e.g., human approval).
        Returns True if the signal was successfully delivered.
        """
        pass
