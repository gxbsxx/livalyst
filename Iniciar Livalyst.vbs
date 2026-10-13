' Abre (o reinicia) Livalyst sin ventana. La primera vez instala dependencias (necesita Node.js).
' Al arrancar, el panel del chat lo avisa arriba unos segundos; si no arranca, aquí sale un aviso con el motivo.
' Todo es ligero a propósito: nada de PowerShell, WMI ni buscar entre los programas abiertos (daban tirones al ratón).
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = fs.GetParentFolderName(WScript.ScriptFullName)

' ¿Responde Livalyst? (pregunta corta, como mucho 1,5 s)
Function Responde()
  Responde = False
  On Error Resume Next
  Set h = CreateObject("MSXML2.ServerXMLHTTP")
  h.setTimeouts 500, 500, 500, 1000
  h.Open "GET", "http://localhost:8787/config", False
  h.Send
  If Err.Number = 0 Then Responde = (h.Status = 200)
  Err.Clear
  On Error GoTo 0
End Function

If sh.Run("cmd /c where node", 0, True) <> 0 Then
  MsgBox "Falta Node.js. Instala la versión LTS y vuelve a abrir esto.", 48, "Livalyst"
  sh.Run "https://nodejs.org/es/download"
  WScript.Quit
End If

' Si ya está abierto, se le pide que se cierre para cargar la versión nueva
flag = ""
If Responde() Then
  flag = " --reiniciado"
  On Error Resume Next
  Set h = CreateObject("MSXML2.ServerXMLHTTP")
  h.setTimeouts 500, 500, 500, 1000
  h.Open "POST", "http://localhost:8787/quit", False
  h.Send
  On Error GoTo 0
  For i = 1 To 12
    WScript.Sleep 250
    If Not Responde() Then Exit For
  Next
  ' Plan B, solo si no ha hecho caso (una versión antigua sin /quit): cerrar lo que ocupe el puerto 8787
  If Responde() Then sh.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr "":8787 "" ^| findstr LISTENING') do taskkill /f /pid %a", 0, True
  WScript.Sleep 300
End If

If Not fs.FolderExists("node_modules") Then sh.Run "cmd /c npm install", 1, True
sh.Run "cmd /c node server.js" & flag & " > livalyst.log 2>&1", 0, False

' Comprueba durante 20 segundos que responde; si no, avisa con lo último que escribió
For i = 1 To 40
  WScript.Sleep 500
  If Responde() Then WScript.Quit
Next
motivo = ""
If fs.FileExists("livalyst.log") Then
  Set f = fs.OpenTextFile("livalyst.log", 1)
  If Not f.AtEndOfStream Then motivo = f.ReadAll
  f.Close
End If
If Len(motivo) > 600 Then motivo = "..." & Right(motivo, 600)
If motivo = "" Then motivo = "No ha dado ningún detalle."
MsgBox "Livalyst no ha arrancado." & vbCrLf & vbCrLf & motivo, 16, "Livalyst"
