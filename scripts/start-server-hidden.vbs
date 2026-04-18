' NotebookLM MCP Server - hidden startup helper
' Starts the HTTP server without opening a visible console window.

Dim fso
Dim shell
Dim scriptDir
Dim projectDir

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

shell.CurrentDirectory = projectDir
shell.Run "node dist/http-wrapper.js", 0, False
