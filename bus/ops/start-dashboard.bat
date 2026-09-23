@echo off
rem start-dashboard.bat -- double-click launcher for serve-dashboard.js
rem (Windows, matching this machine). Starts the local dashboard server
rem and opens it in the default browser. Close this window to stop the
rem server.
cd /d "%~dp0"
start "" http://localhost:8877/
node serve-dashboard.js
