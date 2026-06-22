import logging
from typing import Tuple, List, Any, Optional
from app.modules.agent_runner.domain.models import AgentBlueprint

logger = logging.getLogger(__name__)

class ObservabilityFactory:
    """
    Adapter for creating observability sessions (e.g., Langfuse).
    Stateless factory that returns isolated callbacks and clients per request.
    """
    
    @staticmethod
    def create_observability_session(blueprint: AgentBlueprint) -> Tuple[List[Any], Optional[Any]]:
        """
        Creates observability callbacks and an isolated client instance for the current scope.
        Returns:
            Tuple[callbacks_list, flushable_client_instance]
        """
        callbacks = []
        observability_client = None
        
        if blueprint.langfuse_public_key and blueprint.langfuse_secret_key:
            try:
                # Attempt to import Langfuse (Optional Dependency)
                from langfuse import Langfuse
                from langfuse.langchain import CallbackHandler
                
                # Instantiate isolated client for this session scope
                observability_client = Langfuse(
                    public_key=blueprint.langfuse_public_key,
                    secret_key=blueprint.langfuse_secret_key,
                    host=blueprint.langfuse_host or "https://cloud.langfuse.com"
                )
                
                # Instantiate callback handler bound to the public key
                langfuse_handler = CallbackHandler(public_key=blueprint.langfuse_public_key)
                callbacks.append(langfuse_handler)
                
                logger.debug(f"[OBSERVABILITY] Langfuse initialized for PK={blueprint.langfuse_public_key}")
                
            except ImportError:
                logger.warning("[OBSERVABILITY] langfuse package not installed. Tracing disabled.")
            except Exception as e:
                logger.error(f"[OBSERVABILITY] Error initializing Langfuse: {e}")

        return callbacks, observability_client
