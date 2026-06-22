import os

class Settings:
    # Check if running inside a Docker container
    IS_DOCKER_ENV = os.path.exists("/.dockerenv")
    
    # Langfuse configuration
    LANGFUSE_SECRET_KEY = os.environ.get("LANGFUSE_SECRET_KEY", "")
    LANGFUSE_PUBLIC_KEY = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    LANGFUSE_HOST = os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")
    
    @classmethod
    def resolve_internal_host(cls, url: str) -> str:
        """
        Resolves localhost to host.docker.internal if running in Docker,
        so containers can access host network services like Ollama or Local AI.
        """
        if cls.IS_DOCKER_ENV and url:
            if "localhost" in url or "127.0.0.1" in url:
                return url.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal")
        return url

settings = Settings()
