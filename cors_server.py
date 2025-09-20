#!/usr/bin/env python3

from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl
import os
import urllib.request
import re
from urllib.parse import urlparse
import time
import threading
import sys
import importlib.util

# Try regular import first, fall back to loading the local `colors.py`
try:
    from colors import magenta, red, green
except Exception:
    colors_path = os.path.join(os.path.dirname(__file__), 'colors.py')
    spec = importlib.util.spec_from_file_location('colors', colors_path)
    colors = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(colors)
    magenta = colors.magenta
    red = colors.red
    green = colors.green

REMOTE_SERVER = 'https://pub-c6b11003307646e98afc7540d5f09c41.r2.dev'


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', 'https://www.remnote.com')
        self.send_header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.mp3'):
            return 'audio/mpeg'
        return super().guess_type(path)

    def log_request(self, code='-', size='-'):
        # Log request line, code, and size
        print(f"[CORS] {self.requestline} -> {code} {size}")
        # Log headers
        for k, v in self.headers.items():
            print(f"[CORS] Header: {k}: {v}")

    def do_GET(self):
        print(f"[CORS] GET {self.path}")
        local_path = self.translate_path(self.path)
        print(f'local path to find: {local_path} ')
        # Only attempt remote fetch for files matching 32 hex chars + .mp3
        parsed = urlparse(self.path)
        path_only = parsed.path
        if not re.search(r"/[a-f0-9]{32}\.mp3$", path_only):
            print(f"[CORS] Path does not match expected pattern, skipping remote fetch: {path_only}")
        elif not os.path.exists(local_path):  # and self.path.endswith('.mp3'):
            remote_url = REMOTE_SERVER + self.path
            print(magenta(f"[CORS] Missing locally, fetching: {remote_url}"))
            try:
                # Use helper to fetch with UA and retries
                self._fetch_remote_with_retries(remote_url, local_path)
            except Exception as e:
                print(red(f"[CORS] Fetch failed: {e}"))
        else:
            print(magenta(f"[CORS] {self.path} hits locally,"))

        super().do_GET()

    def do_HEAD(self):
        print(f"[CORS] HEAD {self.path}")
        local_path = self.translate_path(self.path)
        print(f'local path to find: {local_path} ')
        # Only attempt remote fetch for files matching 32 hex chars + .mp3
        if not os.path.exists(local_path):  # and self.path.endswith('.mp3'):
            remote_url = REMOTE_SERVER + self.path
            print(magenta(f"[CORS] Missing locally, fetching: {remote_url}"))
            # Start background fetch so HEAD responses don't block waiting for remote
            def _bg_fetch():
                try:
                    # Use same helper as GET to fetch with UA and retries
                    self._fetch_remote_with_retries(remote_url, local_path)
                except Exception as e:
                    print(red(f"[CORS] Background fetch failed: {e}"))

            t = threading.Thread(target=_bg_fetch, daemon=True)
            t.start()
        else:
            print(green(f"[CORS] {self.path} hits locally"))

        super().do_HEAD()

    def do_OPTIONS(self):
        print(f"[CORS] OPTIONS {self.path}")
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', 'https://www.remnote.com')
        self.send_header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def _fetch_remote_with_retries(self, remote_url, local_path, retries=3, delay=10):
        """Fetch remote_url with a custom User-Agent header, retrying on failure.

        Writes the fetched bytes to local_path on success.
        """
        # parsed = urlparse(self.path)
        # path_only = parsed.path

        last_exc = None
        if not re.search(r"/[a-f0-9]{32}\.mp3$", remote_url):
            print(f"[CORS] Path does not match expected pattern, skipping remote fetch: {remote_url}")
            return
        ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
        req = urllib.request.Request(remote_url, headers={"User-Agent": ua})

        for attempt in range(1, retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = resp.read()
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, 'wb') as f:
                    f.write(data)
                    print(green(f"[CORS] Saved: {local_path} (attempt {attempt})"))
                return
            except Exception as e:
                last_exc = e
                print(red(f"[CORS] Fetch attempt remote: [{remote_url}], local: [{local_path}], attempt: [{attempt}] failed: [{e}]"))
                if attempt < retries:
                    print(f"[CORS] Retrying in {delay} seconds...")
                    time.sleep(delay)
        # If we reach here, all attempts failed
        raise last_exc


if __name__ == '__main__':

    script_path = os.path.abspath(__file__)
    directory_path = os.path.dirname(script_path)
    print(f"当前脚本所在目录的绝对路径:{green(directory_path)}")
    # set working path:
    os.chdir(directory_path)

    host = '0.0.0.0'
    port = 9999
    link = f"https://{host}:{port}"

    print(f"[CORS] Server starting on {green(link)}...")
    httpd = HTTPServer((host, port), CORSRequestHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile='server.pem')
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    httpd.serve_forever()
