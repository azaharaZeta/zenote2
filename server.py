#!/usr/bin/env python3
"""
Servidor de DESARROLLO con cabeceras NO-CACHE.

Uso:  python3 server.py [puerto]      (por defecto 8123; es lo que lanza `npm run serve`)
Sirve el directorio actual, así que ejecútalo desde la raíz del proyecto. Ctrl+C para parar.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000


class NoCacheHandler(SimpleHTTPRequestHandler):
    # .mjs por si algún día se sirve un módulo con esa extensión (node los usa, pero por si acaso).
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    # ThreadingHTTPServer: atiende peticiones en paralelo (el navegador pide varios módulos a la vez;
    # un servidor de un solo hilo se atasca con keep-alive). allow_reuse_address ya viene activo.
    print(f"Alien Pocho — dev server (no-cache) en http://localhost:{PORT}  ·  Ctrl+C para parar")
    try:
        ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
