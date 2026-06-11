import json
import redis
from typing import Dict, Any
from app.modules.agent_runner.application.ports.telemetry_port import TelemetryPort

class RedisTelemetry(TelemetryPort):
    """
    Concrete implementation of TelemetryPort using Redis.
    This connects to Redis at instantiation, avoiding global import-time traps.
    """
    def __init__(self, redis_url: str):
        self._redis_client = redis.from_url(redis_url)

    def publish_debug(self, task_id: str, debug_data: Dict[str, Any]) -> None:
        """Publish debug info to Redis so frontend debugger can show it."""
        try:
            self._redis_client.publish(f"agent_stream_{task_id}", json.dumps({
                "status": "TRACE_STEP",
                "message": "New trace step",
                "data": debug_data
            }))
        except Exception as e:
            # Safely ignore or log redis publish errors without crashing the graph
            pass
