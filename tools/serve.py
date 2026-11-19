"""Static dev server for the site with caching turned off, so phones always get the latest files.

Usage: py -3.11 tools/serve.py [port] [bind]
"""
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
BIND = sys.argv[2] if len(sys.argv) > 2 else "0.0.0.0"


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".webp": "image/webp"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


handler = functools.partial(NoCache, directory=ROOT)
with http.server.ThreadingHTTPServer((BIND, PORT), handler) as httpd:
    print(f"Serving {ROOT} on http://{BIND}:{PORT}", flush=True)
    httpd.serve_forever()
