import pytest
from app.core.config import Settings

def test_resolve_internal_host():
    # Simulate Docker environment
    Settings.IS_DOCKER_ENV = True
    
    # Test localhost rewrite
    assert Settings.resolve_internal_host("http://localhost:11434") == "http://host.docker.internal:11434"
    assert Settings.resolve_internal_host("http://127.0.0.1:1234/v1") == "http://host.docker.internal:1234/v1"
    
    # Test external IP (should not be rewritten)
    assert Settings.resolve_internal_host("http://192.168.1.5:11434") == "http://192.168.1.5:11434"

def test_resolve_internal_host_no_docker():
    # Simulate Local environment
    Settings.IS_DOCKER_ENV = False
    
    # Should not rewrite if not in Docker
    assert Settings.resolve_internal_host("http://localhost:11434") == "http://localhost:11434"
    

