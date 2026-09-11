' Launches run-queue-daemon.js with NO visible console window.
' Task Scheduler always opens a console for a plain node.exe action --
' this is the standard WScript.Shell.Run(...,0,...) trick to suppress it
' (window style 0 = hidden). Added 2026-09-11: the visible, always-open
' console from this long-lived daemon was interfering with the user's
' fullscreen games. Relies on the scheduled task's WorkingDirectory being
' set to the vault root so the relative script path below resolves.
CreateObject("WScript.Shell").Run """A:\node.exe"" bus\scripts\run-queue-daemon.js", 0, False
