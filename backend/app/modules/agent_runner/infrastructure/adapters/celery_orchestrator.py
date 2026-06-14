import json
from typing import Dict
from app.modules.agent_runner.ports.orchestrator_port import OrchestratorPort
from app.modules.agent_runner.tasks import run_agent_pipeline
from celery.result import AsyncResult

class CeleryOrchestrator(OrchestratorPort):
    def submit_agent_run(self, blueprint_id: str, payload: Dict[str, object]) -> str:
        """
        Submit the agent run to Celery.
        Returns the Celery task ID.
        """
        task = run_agent_pipeline.delay(payload) # type: ignore[attr-defined]
        return task.id

    def cancel_run(self, run_id: str) -> bool:
        """
        Revoke the Celery task.
        """
        try:
            from celery.task.control import revoke
            revoke(run_id, terminate=True)
            return True
        except Exception:
            return False

    def send_signal(self, run_id: str, signal_name: str, payload: Dict[str, object]) -> bool:
        """
        Send a signal to resume the paused task.
        We trigger a new Celery task with resume=True.
        """
        try:
            resume_payload = {
                "resume": True,
                "run_id": run_id,
                "action": payload.get("action", "approve")
            }
            run_agent_pipeline.delay(resume_payload) # type: ignore[attr-defined]
            return True
        except Exception:
            return False
