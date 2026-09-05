#!/usr/bin/env python3
"""开发服务器：静态服务本目录，并为 html/js/css 发送 no-cache 头，
避免 ES module 被浏览器缓存导致更新后页面仍旧（python -m http.server 的常见坑）。
用法：python tools-serve.py [端口]（默认 8090）
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class ThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ThreadingTCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
        print(f"Serving on http://127.0.0.1:{PORT} (no-cache)")
        httpd.serve_forever()
