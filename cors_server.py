#!/usr/bin/env python3

from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl
import os
import urllib.request
import re
from urllib.parse import urlparse
import time
import threading

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
            print(f"\033[1;35m[CORS] Missing locally, fetching: {remote_url}\033[0m")
            try:
                # Use helper to fetch with UA and retries
                self._fetch_remote_with_retries(remote_url, local_path)
            except Exception as e:
                print(f"\033[1;31m[CORS] Fetch failed: {e}\033[0m")
        else:
            print(f"\033[1;35m[CORS] {self.path} hits locally, \033[0m")

        super().do_GET()

    def do_HEAD(self):
        print(f"[CORS] HEAD {self.path}")
        local_path = self.translate_path(self.path)
        print(f'local path to find: {local_path} ')
        # Only attempt remote fetch for files matching 32 hex chars + .mp3
        if not os.path.exists(local_path):  # and self.path.endswith('.mp3'):
            remote_url = REMOTE_SERVER + self.path
            print(f"\033[1;35m[CORS] Missing locally, fetching: {remote_url}\033[0m")
            # Start background fetch so HEAD responses don't block waiting for remote
            def _bg_fetch():
                try:
                    # Use same helper as GET to fetch with UA and retries
                    self._fetch_remote_with_retries(remote_url, local_path)
                    # print(f"\033[1;32m[CORS] Saved: {local_path}\033[0m")
                except Exception as e:
                    print(f"\033[1;31m[CORS] Background fetch failed: {e}\033[0m")

            t = threading.Thread(target=_bg_fetch, daemon=True)
            t.start()
        else:
            print(f"\033[1;35m[CORS] {self.path} hits locally, \033[0m")

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
                print(f"\033[1;32m[CORS] Saved: {local_path} (attempt {attempt})\033[0m")
                return
            except Exception as e:
                last_exc = e
                print(f"\033[1;31m[CORS] Fetch attempt remote: [{remote_url}], local: [{local_path}], attempt: [{attempt}] failed: [{e}]\033[0m")
                if attempt < retries:
                    print(f"[CORS] Retrying in {delay} seconds...")
                    time.sleep(delay)
        # If we reach here, all attempts failed
        raise last_exc


if __name__ == '__main__':
    port = 9999
    print(f"[CORS] Server starting on 0.0.0.0:{port}...")
    httpd = HTTPServer(('0.0.0.0', port), CORSRequestHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile='server.pem')
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    httpd.serve_forever()
