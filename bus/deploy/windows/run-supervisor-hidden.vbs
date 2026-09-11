' Same hidden-launch trick as run-queue-daemon-hidden.vbs, for
' pilot-supervisor.js's every-30-min scheduled run. This one is
' short-lived (exits within seconds) so its console window only flashed
' briefly, but hiding it too keeps both trading-pilot tasks consistent.
CreateObject("WScript.Shell").Run """A:\node.exe"" bus\scripts\pilot-supervisor.js", 0, False
