#!/usr/bin/env python3
"""
AgentRuntime OS Startup Script
------------------------------
A user-facing utility to automatically configure environment settings,
detect the local area network (LAN) IP address, and launch the Docker stack.
"""
import os
import socket
import subprocess
import sys

BANNER = """
============================================================
              🛡️  AgentRuntime OS Startup  🛡️              
============================================================
Welcome! This script automatically detects your network layout,
configures your local environment, and boots up the containers.
"""

def get_lan_ip():
    """Detects the host's primary LAN IP routing outbound internet traffic."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Connect to a public IP to identify the routing interface (no data is sent)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        # Fallback to localhost if network interface lookup fails
        return "127.0.0.1"

def setup_environment(lan_ip):
    """Generates or updates the .env configuration with the detected LAN IP."""
    print("🟢 Configuring environment variables...")
    env_example_path = ".env.example"
    env_path = ".env"
    
    # Targeted environment variables
    target_vars = {
        "DATABASE_URL": 'DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:54322/postgres"\n',
        "NEXT_PUBLIC_BACKEND_URL": f'NEXT_PUBLIC_BACKEND_URL="http://{lan_ip}:7070/api/backend"\n',
        "NEXTAUTH_URL": f'NEXTAUTH_URL="http://{lan_ip}:7070"\n'
    }
    
    lines = []
    # 1. Read existing .env or fallback to .env.example
    if os.path.exists(env_path):
        print(f"📝 Modifying existing {env_path} file...")
        with open(env_path, "r") as f:
            lines = f.readlines()
    elif os.path.exists(env_example_path):
        print(f"📝 Creating new {env_path} from template...")
        with open(env_example_path, "r") as f:
            lines = f.readlines()
    else:
        print("❌ Error: Neither .env nor .env.example was found in the workspace root.")
        sys.exit(1)
        
    # 2. Inject or replace target variables
    new_lines = []
    seen_vars = set()
    
    for line in lines:
        matched = False
        for var_name, replacement_line in target_vars.items():
            if line.startswith(f"{var_name}="):
                new_lines.append(replacement_line)
                seen_vars.add(var_name)
                matched = True
                break
        if not matched:
            new_lines.append(line)
            
    # Append any variables that were missing in the template/source env
    for var_name, replacement_line in target_vars.items():
        if var_name not in seen_vars:
            new_lines.append(replacement_line)
            
    # 3. Write back to .env
    try:
        with open(env_path, "w") as f:
            f.writelines(new_lines)
        print("✅ Environment successfully configured.")
    except Exception as e:
        print(f"❌ Error: Failed to write to .env: {e}")
        sys.exit(1)

def run_compose():
    """Boots the container stack via Docker Compose."""
    print("🟢 Building and launching Docker containers...")
    cmd = "docker-compose up -d --build"
    try:
        # Run docker compose and stream logs to stdout
        subprocess.run(cmd, shell=True, check=True)
        print("✅ Docker Compose stack successfully started.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: Docker Compose failed to start with code {e.returncode}")
        sys.exit(e.returncode)

def main():
    print(BANNER)
    
    lan_ip = get_lan_ip()
    print(f"📡 Detected Host LAN IP: {lan_ip}")
    
    setup_environment(lan_ip)
    run_compose()
    
    # Beautiful URL print block
    print("\n" + "="*60)
    print("🎉 AgentRuntime OS is fully active and running via Nginx Proxy!")
    print("="*60)
    print(f"👉 Local Dashboard URL:       http://localhost:7070")
    print(f"👉 Local Backend API Docs:    http://localhost:7070/api/backend/docs")
    print(f"👉 Local Supabase Studio:     http://localhost:54323")
    if lan_ip != "127.0.0.1":
        print(f"🌐 Shared LAN Dashboard URL:  http://{lan_ip}:7070")
        print(f"🌐 Shared LAN API Docs URL:   http://{lan_ip}:7070/api/backend/docs")
        print(f"🌐 Shared LAN Supabase Studio: http://{lan_ip}:54323")
    print("="*60)
    print("Enjoy collaborating with your swarm!")

if __name__ == "__main__":
    main()
