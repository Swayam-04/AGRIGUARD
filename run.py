"""
AgriGuard — Unified Application Launcher
Initializes the system, verifies database & inventory, and starts the FastAPI server.
"""

import sys
import os
import socket
import argparse
from pathlib import Path

# Enable UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to Python search path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Automatically forward to project virtualenv if invoked from global Python
venv_python = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe" if sys.platform == "win32" else PROJECT_ROOT / ".venv" / "bin" / "python"
if sys.prefix == sys.base_prefix and venv_python.is_file() and os.environ.get("_AGRIGUARD_VENV_ACTIVE") != "1":
    import subprocess
    os.environ["_AGRIGUARD_VENV_ACTIVE"] = "1"
    print(f"[*] AgriGuard: Auto-routing to project virtualenv ({venv_python})...")
    try:
        ret = subprocess.run([str(venv_python)] + sys.argv)
        sys.exit(ret.returncode)
    except KeyboardInterrupt:
        sys.exit(0)

import uvicorn


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def find_available_port(start_port: int = 8000, max_attempts: int = 10) -> int:
    for port in range(start_port, start_port + max_attempts):
        if not is_port_in_use(port):
            return port
    return start_port


def main():
    parser = argparse.ArgumentParser(description="AgriGuard Unified Server Launcher")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the dashboard server on (default: 8000)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    args = parser.parse_args()

    port = args.port
    if is_port_in_use(port):
        print(f"[!] Notice: Port {port} is currently busy.")
        fallback_port = find_available_port(port + 1)
        print(f"[*] Automatically switching to available port: {fallback_port}")
        port = fallback_port

    print("=" * 60)
    print("  [AgriGuard] AI-Powered Precision Farming Robot")
    print("  Theme: NET ZERO AI Architecture")
    print("=" * 60)
    print(f"  Project Root: {PROJECT_ROOT}")
    print(f"  Starting Dashboard on: http://localhost:{port}")
    print(f"  API Documentation on:  http://localhost:{port}/docs")
    print("=" * 60)

    uvicorn.run(
        "backend.main:app",
        host=args.host,
        port=port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[*] AgriGuard server terminated gracefully.")
        sys.exit(0)
