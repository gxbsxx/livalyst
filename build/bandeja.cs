// Icono de Livalyst en la bandeja del sistema (junto al reloj de Windows).
// Clic derecho: abrir la configuración o cerrar Livalyst. Doble clic: abrir la configuración.
// Lo arranca server.js; se cierra solo cuando Livalyst deja de responder.
// Se compila con el csc.exe que trae Windows (ver .github/workflows/exe.yml).
using System;
using System.Diagnostics;
using System.Drawing;
using System.Net;
using System.Threading;
using System.Windows.Forms;

static class Bandeja {
  const string URL = "http://localhost:8787/";
  static NotifyIcon icono;
  static int fallos = 0;

  [STAThread]
  static void Main() {
    bool nuevo;
    Mutex unico = new Mutex(true, "Livalyst.Bandeja", out nuevo);
    if (!nuevo) return; // ya hay un icono: no poner otro

    ContextMenuStrip menu = new ContextMenuStrip();
    menu.Items.Add("Abrir configuración", null, delegate { Abrir(); });
    menu.Items.Add(new ToolStripSeparator());
    menu.Items.Add("Cerrar Livalyst", null, delegate { Cerrar(); });

    icono = new NotifyIcon();
    icono.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
    icono.Text = "Livalyst";
    icono.ContextMenuStrip = menu;
    icono.DoubleClick += delegate { Abrir(); };
    icono.Visible = true;

    // Cada 2 s comprueba que Livalyst sigue abierto; tras 4 fallos seguidos (8 s) quita el icono.
    // ponytail: el margen cubre el reinicio al actualizar server.js; si algún reinicio tarda más, subir el número.
    System.Windows.Forms.Timer reloj = new System.Windows.Forms.Timer();
    reloj.Interval = 2000;
    reloj.Tick += delegate {
      ThreadPool.QueueUserWorkItem(delegate {
        bool vivo = Pedir("GET", "config");
        if (vivo) fallos = 0; else fallos++;
        if (fallos >= 4) menu.BeginInvoke((MethodInvoker)delegate { Salir(); });
      });
    };
    reloj.Start();
    Application.Run();
    GC.KeepAlive(unico);
  }

  static bool Pedir(string metodo, string ruta) {
    try {
      HttpWebRequest r = (HttpWebRequest)WebRequest.Create(URL + ruta);
      r.Method = metodo; r.Timeout = 1500; r.Proxy = null;
      if (metodo == "POST") r.ContentLength = 0;
      using (WebResponse w = r.GetResponse()) return true;
    } catch { return false; }
  }

  static void Abrir() { try { Process.Start(URL + "widgets"); } catch { } }

  static void Cerrar() { Pedir("POST", "quit"); Salir(); }

  static void Salir() { icono.Visible = false; icono.Dispose(); Application.Exit(); }
}
