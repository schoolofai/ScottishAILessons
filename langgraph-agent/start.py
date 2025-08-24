#!/usr/bin/env python3
"""
Cross-platform startup script for LangGraph Chat Application
Starts both backend and frontend servers and opens the browser
"""

import os
import sys
import time
import subprocess
import platform
import signal
import webbrowser
from pathlib import Path
import requests
from typing import List

# ANSI color codes for terminal output
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

# Disable colors on Windows if not supported
if platform.system() == 'Windows':
    try:
        import colorama
        colorama.init()
    except ImportError:
        # If colorama is not available, disable colors
        for attr in dir(Colors):
            if not attr.startswith('_'):
                setattr(Colors, attr, '')

class AppLauncher:
    def __init__(self):
        self.script_dir = Path(__file__).parent.absolute()
        self.processes: List[subprocess.Popen] = []
        self.backend_url = "http://localhost:2024"
        self.frontend_url = "http://localhost:3000"
        
    def print_banner(self):
        """Print welcome banner"""
        print(f"{Colors.CYAN}{Colors.BOLD}")
        print("=" * 60)
        print("  🚀 LangGraph Chat Application Launcher")
        print("=" * 60)
        print(f"{Colors.RESET}")
        
    def print_status(self, message: str, status: str = "info"):
        """Print colored status message"""
        color = {
            "info": Colors.BLUE,
            "success": Colors.GREEN,
            "warning": Colors.YELLOW,
            "error": Colors.RED
        }.get(status, Colors.WHITE)
        
        icon = {
            "info": "ℹ️ ",
            "success": "✅",
            "warning": "⚠️ ",
            "error": "❌"
        }.get(status, "")
        
        print(f"{color}{icon} {message}{Colors.RESET}")
        
    def check_prerequisites(self):
        """Check if Python and Node.js are installed"""
        self.print_status("Checking prerequisites...", "info")
        
        # Check Python
        try:
            result = subprocess.run([sys.executable, "--version"], 
                                  capture_output=True, text=True)
            python_version = result.stdout.strip()
            self.print_status(f"Python found: {python_version}", "success")
        except Exception as e:
            self.print_status("Python is not properly configured", "error")
            sys.exit(1)
            
        # Check Node.js
        try:
            result = subprocess.run(["node", "--version"], 
                                  capture_output=True, text=True)
            node_version = result.stdout.strip()
            self.print_status(f"Node.js found: {node_version}", "success")
        except FileNotFoundError:
            self.print_status("Node.js is not installed. Please install Node.js 18+", "error")
            sys.exit(1)
            
    def setup_environment(self):
        """Set up Python virtual environment and dependencies"""
        os.chdir(self.script_dir)
        
        # Check/create virtual environment
        venv_path = self.script_dir.parent / "venv"
        if not venv_path.exists():
            self.print_status("Creating Python virtual environment...", "warning")
            subprocess.run([sys.executable, "-m", "venv", str(venv_path)], check=True)
            
        # Determine venv activation script
        if platform.system() == "Windows":
            venv_python = venv_path / "Scripts" / "python.exe"
            venv_pip = venv_path / "Scripts" / "pip.exe"
        else:
            venv_python = venv_path / "bin" / "python"
            venv_pip = venv_path / "bin" / "pip"
            
        # Check if backend dependencies are installed
        self.print_status("Checking backend dependencies...", "info")
        result = subprocess.run([str(venv_pip), "show", "langgraph-cli"],
                              capture_output=True, text=True)
        if result.returncode != 0:
            self.print_status("Installing backend dependencies...", "warning")
            subprocess.run([str(venv_pip), "install", "-e", ".", "langgraph-cli[inmem]"],
                         check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.print_status("Backend dependencies installed", "success")
        else:
            self.print_status("Backend dependencies already installed", "success")
            
        # Create .env if needed
        env_file = self.script_dir / ".env"
        env_example = self.script_dir / ".env.example"
        if not env_file.exists() and env_example.exists():
            self.print_status("Creating .env file from template...", "warning")
            env_file.write_text(env_example.read_text())
            self.print_status("Please add your API keys to .env file if needed", "warning")
            
        return venv_python
        
    def setup_frontend(self):
        """Set up frontend dependencies and configuration"""
        frontend_dir = self.script_dir / "assistant-ui-frontend"
        
        if not frontend_dir.exists():
            self.print_status("Frontend directory not found. Please run the setup first.", "error")
            sys.exit(1)
            
        os.chdir(frontend_dir)
        
        # Check if node_modules exists
        if not (frontend_dir / "node_modules").exists():
            self.print_status("Installing frontend dependencies...", "warning")
            subprocess.run(["npm", "install", "--legacy-peer-deps"],
                         check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.print_status("Frontend dependencies installed", "success")
        else:
            self.print_status("Frontend dependencies already installed", "success")
            
        # Create .env.local if needed
        env_local = frontend_dir / ".env.local"
        if not env_local.exists():
            self.print_status("Creating frontend configuration...", "warning")
            env_local.write_text(
                "# Frontend environment variables\n"
                "NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024\n"
                "NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=agent\n"
            )
            self.print_status("Frontend configuration created", "success")
            
    def wait_for_server(self, url: str, name: str, timeout: int = 30):
        """Wait for a server to be ready"""
        self.print_status(f"Waiting for {name} to start...", "info")
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(url, timeout=1)
                if response.status_code < 500:
                    self.print_status(f"{name} is ready!", "success")
                    return True
            except requests.exceptions.RequestException:
                pass
            time.sleep(1)
            
        self.print_status(f"{name} failed to start within {timeout} seconds", "error")
        return False
        
    def start_backend(self, venv_python):
        """Start the backend server"""
        os.chdir(self.script_dir)
        self.print_status("Starting LangGraph backend server...", "info")
        
        # Determine the command based on OS
        if platform.system() == "Windows":
            venv_langgraph = self.script_dir.parent / "venv" / "Scripts" / "langgraph.exe"
        else:
            venv_langgraph = self.script_dir.parent / "venv" / "bin" / "langgraph"
            
        # Create and start backend process
        backend_log_path = self.script_dir / "backend.log"
        backend_log_path.touch()  # Create log file if it doesn't exist
        backend_log = open(backend_log_path, "w")
        process = subprocess.Popen(
            [str(venv_langgraph), "dev"],
            stdout=backend_log,
            stderr=backend_log,
            cwd=self.script_dir
        )
        self.processes.append(process)
        
        # Wait for backend to be ready
        if not self.wait_for_server(f"{self.backend_url}/docs", "Backend"):
            self.cleanup()
            sys.exit(1)
            
    def start_frontend(self):
        """Start the frontend server"""
        frontend_dir = self.script_dir / "assistant-ui-frontend"
        os.chdir(frontend_dir)
        self.print_status("Starting Assistant-UI frontend...", "info")
        
        # Create and start frontend process  
        frontend_log_path = self.script_dir / "frontend.log"
        frontend_log_path.touch()  # Create log file if it doesn't exist
        frontend_log = open(frontend_log_path, "w")
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            stdout=frontend_log,
            stderr=frontend_log,
            cwd=frontend_dir
        )
        self.processes.append(process)
        
        # Wait for frontend to be ready
        if not self.wait_for_server(self.frontend_url, "Frontend"):
            self.cleanup()
            sys.exit(1)
            
    def open_browser(self):
        """Open the frontend in default browser"""
        self.print_status("Opening browser...", "info")
        time.sleep(1)
        webbrowser.open(self.frontend_url)
        self.print_status("Browser opened", "success")
        
    def print_urls(self):
        """Print application URLs"""
        print(f"\n{Colors.GREEN}{Colors.BOLD}{'=' * 60}")
        print("🎉 Application is running!")
        print(f"{'=' * 60}{Colors.RESET}\n")
        
        print(f"{Colors.CYAN}📍 Frontend (Chat UI):{Colors.RESET} {self.frontend_url}")
        print(f"{Colors.CYAN}📍 Backend API:{Colors.RESET} {self.backend_url}")
        print(f"{Colors.CYAN}📍 API Documentation:{Colors.RESET} {self.backend_url}/docs")
        print(f"{Colors.CYAN}📍 LangGraph Studio:{Colors.RESET} https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024")
        print()
        print(f"{Colors.YELLOW}Press Ctrl+C to stop all servers{Colors.RESET}")
        print(f"{Colors.CYAN}To view logs in real-time, open a new terminal and run:{Colors.RESET}")
        print(f"  {Colors.WHITE}tail -f backend.log{Colors.RESET}   (for backend logs)")
        print(f"  {Colors.WHITE}tail -f frontend.log{Colors.RESET}  (for frontend logs)")
        print()
        
    def cleanup(self):
        """Clean up processes on exit"""
        print(f"\n{Colors.YELLOW}Shutting down servers...{Colors.RESET}")
        for process in self.processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except:
                process.kill()
        self.print_status("All servers stopped", "success")
        
    def run(self):
        """Main execution flow"""
        self.print_banner()
        
        try:
            # Setup signal handler for cleanup
            signal.signal(signal.SIGINT, lambda s, f: self.cleanup())
            if platform.system() != "Windows":
                signal.signal(signal.SIGTERM, lambda s, f: self.cleanup())
            
            # Check prerequisites
            self.check_prerequisites()
            
            # Setup environment
            venv_python = self.setup_environment()
            
            # Setup frontend
            self.setup_frontend()
            
            # Start servers
            self.start_backend(venv_python)
            self.start_frontend()
            
            # Open browser
            self.open_browser()
            
            # Print URLs
            self.print_urls()
            
            # Keep running until interrupted
            while True:
                time.sleep(1)
                # Check if processes are still running
                for process in self.processes:
                    if process.poll() is not None:
                        self.print_status("A server has stopped unexpectedly", "error")
                        self.cleanup()
                        sys.exit(1)
                        
        except KeyboardInterrupt:
            pass
        finally:
            self.cleanup()

if __name__ == "__main__":
    launcher = AppLauncher()
    launcher.run()