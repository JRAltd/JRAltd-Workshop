Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonw = dir & "\.venv\Scripts\pythonw.exe"
launcher = dir & "\launcher.py"

If fso.FileExists(pythonw) Then
    shell.CurrentDirectory = dir
    shell.Run """" & pythonw & """ """ & launcher & """", 0, False
Else
    shell.CurrentDirectory = dir
    shell.Run "cmd /c start_monitor.bat", 1, False
End If
