#!/usr/bin/env python3

from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl
import os
import subprocess
import urllib.request
import re
from urllib.parse import urlparse
import time
import threading
import importlib.util
import sys
import html
from datetime import datetime
import argparse
import tempfile # Added: 导入 tempfile 模块

VERBOSE = False  # Added global variable
REMOTE_SERVER = "https://pub-c6b11003307646e98afc7540d5f09c41.r2.dev"

# Precompile the mp3 filename pattern (32 hex chars + .mp3) for reuse
MP3_RE = re.compile(r'^/[A-Fa-f0-9]{32}\.mp3$', re.IGNORECASE)


def is_mp3_blob_path(path_or_url: str) -> bool:
    """Return True if the given path or URL matches the 32-hex .mp3 pattern.

    Accepts either a raw path like '/abcd...1234.mp3' or a full URL
    like 'https://example.com/abcd...1234.mp3'.
    """
    if not path_or_url:
        return False
    elif path_or_url == '/':
        return True
    # If it's a URL, extract the path portion; urlparse will also work with
    # plain paths and return an empty scheme/netloc.
    try:
        parsed = urlparse(path_or_url)
        path = parsed.path
    except Exception:
        path = path_or_url
    return bool(MP3_RE.match(path))

# Try regular import first, fall back to loading the local `colors.py`
try:
    from colors import magenta, red, green
except Exception:
    colors_path = os.path.join(os.path.dirname(__file__), "colors.py")
    spec = importlib.util.spec_from_file_location("colors", colors_path)
    colors = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(colors)
    magenta = colors.magenta
    red = colors.red
    green = colors.green


# Guard concurrent remote fetches by URL
_in_progress = set()
_in_progress_lock = threading.Lock()
current_pid = os.getpid()


def date_str():
    return datetime.now().strftime("%m%d %H:%M:%S.%f")[:-3]


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "https://www.remnote.com")
        self.send_header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".mp3"):
            return "audio/mpeg"
        return super().guess_type(path)

    def log_request(self, code="-", size="-"):
        # Log request line, code, and size
        print(
            f"[{date_str()}][{current_pid}][CORS] {self.requestline} -> {code} {size}"
        )
        # Log headers
        global VERBOSE
        if VERBOSE:
            for k, v in self.headers.items():
                print(f"[{date_str()}][{current_pid}][:CORS] Header {k}: {v}")

    def do_GET(self):
        print(f"[{date_str()}][{current_pid}][CORS] GET {self.path}")
        local_path = self.translate_path(self.path)
        # Only attempt to serve; fetching should be initiated by HEAD handler
        parsed = urlparse(self.path)
        path_only = parsed.path
        # Only handle remote-fetch logic for 32-hex mp3 filenames; otherwise
        # delegate to the default SimpleHTTPRequestHandler behavior.
        if not is_mp3_blob_path(path_only):
            print(
                f"[{date_str()}][{current_pid}][CORS] GET: path does not match 32-hex mp3 pattern, returning 404: {path_only}"
            )
            self.send_error(404, "Not Found")
            return
        elif os.path.exists(local_path):
            print(
                magenta(
                    f"[{date_str()}][{current_pid}][CORS] GET: serving local file: {local_path}"
                )
            )
        else:
            print(
                magenta(
                    f"[{date_str()}][{current_pid}][CORS] GET: file missing locally (HEAD may have triggered background fetch): {local_path}"
                )
            )

        super().do_GET()

    def do_HEAD(self):

        # local_path = self.translate_path(self.path)
        # print(f"local path to find: {local_path} ")
        # Only attempt remote fetch for files matching 32 hex chars + .mp3
        parsed = urlparse(self.path)
        path_only = parsed.path
        if not is_mp3_blob_path(path_only):
            print(
                f"[{date_str()}][{current_pid}][CORS] HEAD: path does not match 32-hex mp3 pattern, returning 404: {path_only}"
            )
            self.send_error(404, "Not Found")
            return

        print(f"[{date_str()}][{current_pid}][CORS] HEAD {self.path}")
        local_path = self.translate_path(self.path)
        if not os.path.exists(local_path):  # and self.path.endswith('.mp3'):
            remote_url = REMOTE_SERVER + self.path
            print(
                magenta(
                    f"[{date_str()}][{current_pid}][CORS] HEAD: Missing locally, fetching: {remote_url}"
                )
            )
            # Start background fetch so HEAD responses don't block waiting for remote

            def _bg_fetch():
                try:
                    # Use same helper as GET to fetch with UA and retries
                    self._fetch_remote_with_retries(remote_url, local_path)
                except Exception as e:
                    print(
                        red(
                            f"[{date_str()}][{current_pid}][CORS] Background fetch failed: {e}"
                        )
                    )

            t = threading.Thread(target=_bg_fetch, daemon=True)
            t.start()
        else:
            print(
                green(f"[{date_str()}][{current_pid}][CORS] {self.path} hits locally")
            )

        super().do_HEAD()

    def do_OPTIONS(self):
        print(f"[{date_str()}][{current_pid}][CORS] OPTIONS {self.path}")
        self.send_response(200, "ok")
        self.send_header("Access-Control-Allow-Origin", "https://www.remnote.com")
        self.send_header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def _fetch_remote_with_retries(self, remote_url, local_path, retries=3, delay=10):
        """Fetch remote_url with a custom User-Agent header, retrying on failure.

        Writes the fetched bytes to local_path on success.
        """
        # Validate path pattern first to avoid locking for irrelevant URLs
        if not is_mp3_blob_path(remote_url):
            print(
                f"[{date_str()}][{current_pid}][CORS] Path does not match expected pattern, skipping remote fetch: {remote_url}"
            )
            return False

        # Prevent duplicate concurrent fetches for the same URL
        with _in_progress_lock:
            if remote_url in _in_progress:
                print(
                    magenta(
                        f"[{date_str()}][{current_pid}][CORS] ❌ Duplicate fetch ignored for: {remote_url}"
                    )
                )
                return False
            _in_progress.add(remote_url)

        last_exc = None
        temp_file_path = None # 用于存储临时文件路径，以便在 finally 块中清理

        try:
            ua = (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
            )
            req = urllib.request.Request(remote_url, headers={"User-Agent": ua})

            # 确保目标目录存在
            os.makedirs(os.path.dirname(local_path), exist_ok=True)

            for attempt in range(1, retries + 1):
                try:
                    # 创建一个临时文件，位于目标文件所在的目录，以确保 os.rename 的原子性
                    with tempfile.NamedTemporaryFile(delete=False, dir=os.path.dirname(local_path), suffix=".tmp") as temp_f:
                        temp_file_path = temp_f.name # 记录临时文件路径
                        with urllib.request.urlopen(req, timeout=30) as resp:
                            data = resp.read()
                        temp_f.write(data) # 将数据写入临时文件

                    # 下载成功并写入临时文件后，原子性地重命名到最终路径
                    os.rename(temp_file_path, local_path)
                    print(
                        green(
                            f"[{date_str()}][{current_pid}][CORS] Saved: {local_path} (attempt {attempt})"
                        )
                    )
                    return True # 成功，退出函数
                except Exception as e:
                    last_exc = e
                    print(
                        red(
                            f"[{date_str()}][{current_pid}][CORS] Fetch attempt remote: [{remote_url}], local: [{local_path}], "
                            f"attempt: [{attempt}] failed: [{e}]"
                        )
                    )
                    # 如果当前尝试失败，清理可能存在的临时文件
                    if temp_file_path and os.path.exists(temp_file_path):
                        os.remove(temp_file_path)
                        temp_file_path = None # 重置，以便下一次尝试创建新的临时文件
                    if attempt < retries:
                        print(
                            f"[{date_str()}][{current_pid}][CORS] Retrying in {delay} seconds..."
                        )
                        time.sleep(delay)
            # 如果循环结束，表示所有尝试都失败了
            raise last_exc
        finally:
            with _in_progress_lock:
                _in_progress.discard(remote_url)
            # 确保在任何情况下（包括未捕获的异常）临时文件都被清理
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

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
                file_type = "directory"
                size = "-"
                displayname = name + "/"
            else:
                file_type = "file"
                total_files += 1
                file_size = os.path.getsize(fullname)
                total_size += file_size
                size = self._format_size(file_size)
                displayname = name

            modified_time = time.strftime(
                "%d-%b-%Y %H:%M", time.localtime(os.path.getmtime(fullname))
            )
            file_list.append(
                {
                    "name": displayname,
                    "size": size,
                    "modified": modified_time,
                    "type": file_type,
                }
            )

        # Format total size in human-readable format
        size_units = ["B", "KB", "MB", "GB"]
        size_index = 0
        human_size = total_size
        while human_size >= 1024 and size_index < len(size_units) - 1:
            human_size /= 1024.0
            size_index += 1

        enc = sys.getfilesystemencoding()
        try:
            displaypath = urllib.parse.unquote(self.path, errors="surrogatepass")
        except UnicodeDecodeError:
            displaypath = urllib.parse.unquote(self.path)
        displaypath = html.escape(displaypath, quote=False)

        r = []
        r.append("<!DOCTYPE html>")
        r.append("<html>")
        r.append("<head>")
        r.append('<meta charset="utf-8">')
        r.append(f"<title>Index of {displaypath}</title>")
        r.append("<style>")
        r.append("body { font-family: sans-serif; margin: 40px; }")
        r.append("h1 { margin-bottom: 20px; }")
        r.append("table { border-collapse: collapse; width: 100%; }")
        r.append(
            "th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }"
        )
        r.append("th { background-color: #f2f2f2; font-weight: bold; }")
        r.append("tr:hover { background-color: #f5f5f5; }")
        r.append(
            ".summary { background-color: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px; }"
        )
        r.append("</style>")
        r.append("</head>")
        r.append("<body>")
        r.append(f"<h1>Index of {displaypath}</h1>")

        # Directory summary
        r.append('<div class="summary">')
        r.append(f"<p><strong>Total Files:</strong> {total_files}</p>")
        r.append(
            f"<p><strong>Total Size:</strong> {human_size:.1f} {size_units[size_index]}</p>"
        )
        r.append("</div>")

        # File listing table
        r.append("<table>")
        r.append("<thead>")
        r.append("<tr>")
        r.append("<th>Name</th>")
        r.append("<th>Last modified</th>")
        r.append("<th>Size</th>")
        r.append("</tr>")
        r.append("</thead>")
        r.append("<tbody>")

        # Parent directory link
        if displaypath != "/":
            r.append("<tr>")
            r.append(f'<td><a href="../">../</a></td>')
            r.append("<td>-</td>")
            r.append("<td>-</td>")
            r.append("</tr>")

        for file_info in file_list:
            if file_info['name'].startswith('.'):
                continue
            r.append("<tr>")
            r.append(
                f'<td><a href="{urllib.parse.quote(file_info["name"], errors="surrogatepass")}">{html.escape(file_info["name"])}</a></td>'
            )
            r.append(f"<td>{file_info['modified']}</td>")
            r.append(f"<td>{file_info['size']}</td>")
            r.append("</tr>")

        r.append("</tbody>")
        r.append("</table>")
        r.append("</body>")
        r.append("</html>")

        encoded = "\n".join(r).encode(enc, "surrogateescape")

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
            return "0B"

        units = ["B", "KB", "MB", "GB"]
        unit_index = 0
        formatted_size = size

        while formatted_size >= 1024 and unit_index < len(units) - 1:
            formatted_size /= 1024.0
            unit_index += 1

        if unit_index == 0:
            return f"{formatted_size:.0f}{units[unit_index]}"
        else:
            return f"{formatted_size:.1f}{units[unit_index]}"


def safe_path(p):
    user = os.path.basename(os.path.expanduser("~"))

    if p.startswith(f"/Users/{user}"):
        p = p.replace(f"/Users/{user}", "~")

    return p


def init_cert():
    def task():
        time.sleep(0.1)
        script_path = os.path.join(os.path.expanduser("~"), "icloud/bin/url.sh")
        # Check if the PID file exists
        if not os.path.exists("/tmp/cors_server.pid"):
            # Save current PID to the file
            # Launch a subprocess to run the command
            subprocess.run(["bash", script_path, "https://127.0.0.1:9999"])
            with open("/tmp/cors_server.pid", "w") as f:
                f.write(str(os.getpid()))

    # Start the task in a new thread 
    thread = threading.Thread(target=task)
    thread.start()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run a simple CORS-enabled HTTPS server with remote file fetching."
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging (e.g., request headers).",
    )
    args = parser.parse_args()

    VERBOSE = args.verbose  # Set global flag based on argument

    script_path = os.path.abspath(__file__)
    directory_path = os.path.dirname(script_path)

    print(f"Work path: {green(safe_path(directory_path))}")
    # set working path:
    os.chdir(directory_path)

    host = "0.0.0.0"
    port = 9999
    link = f"https://{host}:{port}"

    print(f"[{date_str()}][{current_pid}][CORS] Server starting on {green(link)}...")
    httpd = HTTPServer((host, port), CORSRequestHandler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile="server.pem")

    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    init_cert()
    httpd.serve_forever()
