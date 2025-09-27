#cors_server.py!/usr/bin/env python3

from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl
import os
import urllib.request
import re
from urllib.parse import urlparse
import time
import threading
import importlib.util
import sys
import html
from datetime import datetime

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

# Guard concurrent remote fetches by URL
_in_progress = set()
_in_progress_lock = threading.Lock()
current_pid = os.getpid()

def date_str():
    return datetime.now().strftime("%m%d %H:%M:%S.%f")[:-3]

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
        print(f"[{date_str()}][{current_pid}][CORS] {self.requestline} -> {code} {size}")
        # Log headers
        for k, v in self.headers.items():
            print(f"[{date_str()}][{current_pid}][CORS] Header: {k}: {v}")

    def do_GET(self):
        print(f"[{date_str()}][{current_pid}][CORS] GET {self.path}")
        local_path = self.translate_path(self.path)
        # Only attempt to serve; fetching should be initiated by HEAD handler
        parsed = urlparse(self.path)
        path_only = parsed.path
        if not re.search(r"/[a-f0-9]{32}\.mp3$", path_only):
            print(f"[{date_str()}][{current_pid}][CORS] GET: path does not match pattern, serving directly: {path_only}")
        elif os.path.exists(local_path):
            print(magenta(f"[{date_str()}][{current_pid}][CORS] GET: serving local file: {local_path}"))
        else:
            print(magenta(f"[{date_str()}][{current_pid}][CORS] GET: file missing locally (HEAD may have triggered background fetch): {local_path}"))

        super().do_GET()

    def do_HEAD(self):
        print(f"[{date_str()}][{current_pid}][CORS] HEAD {self.path}")
        local_path = self.translate_path(self.path)
        print(f'local path to find: {local_path} ')
        # Only attempt remote fetch for files matching 32 hex chars + .mp3
        if not os.path.exists(local_path):  # and self.path.endswith('.mp3'):
            remote_url = REMOTE_SERVER + self.path
            print(magenta(f"[{date_str()}][{current_pid}][CORS] Missing locally, fetching: {remote_url}"))
            # Start background fetch so HEAD responses don't block waiting for remote

            def _bg_fetch():
                try:
                    # Use same helper as GET to fetch with UA and retries
                    self._fetch_remote_with_retries(remote_url, local_path)
                except Exception as e:
                    print(red(f"[{date_str()}][{current_pid}][CORS] Background fetch failed: {e}"))

            t = threading.Thread(target=_bg_fetch, daemon=True)
            t.start()
        else:
            print(green(f"[{date_str()}][{current_pid}][CORS] {self.path} hits locally"))

        super().do_HEAD()

    def do_OPTIONS(self):
        print(f"[{date_str()}][{current_pid}][CORS] OPTIONS {self.path}")
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', 'https://www.remnote.com')
        self.send_header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def _fetch_remote_with_retries(self, remote_url, local_path, retries=3, delay=10):
        """Fetch remote_url with a custom User-Agent header, retrying on failure.

        Writes the fetched bytes to local_path on success.
        """
        # Validate path pattern first to avoid locking for irrelevant URLs
        if not re.search(r"/[a-f0-9]{32}\.mp3$", remote_url):
            print(f"[{date_str()}][{current_pid}][CORS] Path does not match expected pattern, skipping remote fetch: {remote_url}")
            return False

        # Prevent duplicate concurrent fetches for the same URL
        with _in_progress_lock:
            if remote_url in _in_progress:
                print(magenta(f"[{date_str()}][{current_pid}][CORS] ❌ Duplicate fetch ignored for: {remote_url}"))
                return False
            _in_progress.add(remote_url)
        last_exc = None
        try:
            ua = (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
            )
            req = urllib.request.Request(remote_url, headers={"User-Agent": ua})

            for attempt in range(1, retries + 1):
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        data = resp.read()
                    os.makedirs(os.path.dirname(local_path), exist_ok=True)
                    with open(local_path, 'wb') as f:
                        f.write(data)
                    print(green(f"[{date_str()}][{current_pid}][CORS] Saved: {local_path} (attempt {attempt})"))
                    return True
                except Exception as e:
                    last_exc = e
                    print(red(
                        f"[{date_str()}][{current_pid}][CORS] Fetch attempt remote: [{remote_url}], local: [{local_path}], "
                        f"attempt: [{attempt}] failed: [{e}]"
                    ))
                    if attempt < retries:
                        print(f"[{date_str()}][{current_pid}][CORS] Retrying in {delay} seconds...")
                        time.sleep(delay)
            # If we reach here, all attempts failed
            raise last_exc
        finally:
            with _in_progress_lock:
                _in_progress.discard(remote_url)

    def list_directory(self, path):
        """Override to include directory summary at the top with nginx-style formatting"""
        try:
            list = os.listdir(path)
        except OSError:
            self.send_error(404, "No permission to list directory")
            return None

        list.sort(key=lambda a: a.lower())

        # Calculate directory summary
        total_files = 0
        total_size = 0
        file_list = []

        for name in list:
            fullname = os.path.join(path, name)
            if os.path.isdir(fullname):
                file_type = 'directory'
                size = '-'
                displayname = name + '/'
            else:
                file_type = 'file'
                total_files += 1
                file_size = os.path.getsize(fullname)
                total_size += file_size
                size = self._format_size(file_size)
                displayname = name

            modified_time = time.strftime('%d-%b-%Y %H:%M', time.localtime(os.path.getmtime(fullname)))
            file_list.append({
                'name': displayname,
                'size': size,
                'modified': modified_time,
                'type': file_type
            })

        # Format total size in human-readable format
        size_units = ['B', 'KB', 'MB', 'GB']
        size_index = 0
        human_size = total_size
        while human_size >= 1024 and size_index < len(size_units) - 1:
            human_size /= 1024.0
            size_index += 1

        enc = sys.getfilesystemencoding()
        try:
            displaypath = urllib.parse.unquote(self.path, errors='surrogatepass')
        except UnicodeDecodeError:
            displaypath = urllib.parse.unquote(self.path)
        displaypath = html.escape(displaypath, quote=False)

        r = []
        r.append('<!DOCTYPE html>')
        r.append('<html>')
        r.append('<head>')
        r.append('<meta charset="utf-8">')
        r.append(f'<title>Index of {displaypath}</title>')
        r.append('<style>')
        r.append('body { font-family: sans-serif; margin: 40px; }')
        r.append('h1 { margin-bottom: 20px; }')
        r.append('table { border-collapse: collapse; width: 100%; }')
        r.append('th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }')
        r.append('th { background-color: #f2f2f2; font-weight: bold; }')
        r.append('tr:hover { background-color: #f5f5f5; }')
        r.append('.summary { background-color: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px; }')
        r.append('</style>')
        r.append('</head>')
        r.append('<body>')
        r.append(f'<h1>Index of {displaypath}</h1>')

        # Directory summary
        r.append('<div class="summary">')
        r.append(f'<p><strong>Total Files:</strong> {total_files}</p>')
        r.append(f'<p><strong>Total Size:</strong> {human_size:.1f} {size_units[size_index]}</p>')
        r.append('</div>')

        # File listing table
        r.append('<table>')
        r.append('<thead>')
        r.append('<tr>')
        r.append('<th>Name</th>')
        r.append('<th>Last modified</th>')
        r.append('<th>Size</th>')
        r.append('</tr>')
        r.append('</thead>')
        r.append('<tbody>')

        # Parent directory link
        if displaypath != '/':
            r.append('<tr>')
            r.append(f'<td><a href="../">../</a></td>')
            r.append('<td>-</td>')
            r.append('<td>-</td>')
            r.append('</tr>')

        for file_info in file_list:
            r.append('<tr>')
            r.append(f'<td><a href="{urllib.parse.quote(file_info["name"], errors="surrogatepass")}">{html.escape(file_info["name"])}</a></td>')
            r.append(f'<td>{file_info["modified"]}</td>')
            r.append(f'<td>{file_info["size"]}</td>')
            r.append('</tr>')

        r.append('</tbody>')
        r.append('</table>')
        r.append('</body>')
        r.append('</html>')

        encoded = '\n'.join(r).encode(enc, 'surrogateescape')

        # Send the HTML response directly
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=%s" % enc)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)
        return None

    def _format_size(self, size):
        """Format file size in human-readable format like nginx"""
        if size == 0:
            return '0B'

        units = ['B', 'KB', 'MB', 'GB']
        unit_index = 0
        formatted_size = size

        while formatted_size >= 1024 and unit_index < len(units) - 1:
            formatted_size /= 1024.0
            unit_index += 1

        if unit_index == 0:
            return f'{formatted_size:.0f}{units[unit_index]}'
        else:
            return f'{formatted_size:.1f}{units[unit_index]}'


def safe_path(p):
    user = os.path.basename(os.path.expanduser("~"))

    if p.startswith(f'/Users/{user}'):
        p = p.replace(f'/Users/{user}', '~')

    return p


if __name__ == '__main__':

    script_path = os.path.abspath(__file__)
    directory_path = os.path.dirname(script_path)

    print(f"Work path: {green(safe_path(directory_path))}")
    # set working path:
    os.chdir(directory_path)

    host = '0.0.0.0'
    port = 9999
    link = f"https://{host}:{port}"

    print(f"[{date_str()}][{current_pid}][CORS] Server starting on {green(link)}...")
    httpd = HTTPServer((host, port), CORSRequestHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile='server.pem')
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    httpd.serve_forever()
