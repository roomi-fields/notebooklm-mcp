' NotebookLM MCP Server - hidden startup helper
' Starts the HTTP server without opening a visible console window.

Dim fso, shell, scriptDir, projectDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Resolve the project root dynamically from the script location
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

shell.CurrentDirectory = projectDir

' Launch the server in hidden mode (0 = hidden)
shell.Run "node dist/http-wrapper.js", 0, False
