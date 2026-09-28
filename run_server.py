#!/usr/bin/env python3
"""
SSC CGL CBT Exam Local Network Server with SPA Routing Fallback
Prevents 404 errors by serving index.html for any virtual route or non-static request.
"""

import http.server
import socket
import socketserver
import os
import sys

DEFAULT_PORT = 8080

def get_local_ip():
    """Detect the local LAN IP address of this machine."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        # Clean path
        req_path = self.path.split('?')[0].split('#')[0]
        
        # Translate to local file system path
        local_path = self.translate_path(self.path)
        
        # If the file does not exist, serve index.html (SPA Fallback - prevents 404 errors!)
        if not os.path.exists(local_path) or os.path.isdir(local_path):
            index_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')
            if os.path.exists(index_path):
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()
                with open(index_path, 'rb') as f:
                    self.wfile.write(f.read())
                return

        return super().do_GET()

    def guess_type(self, path):
        mimetype = super().guess_type(path)
        if path.endswith('.json'):
            return 'application/json'
        elif path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.html'):
            return 'text/html; charset=utf-8'
        return mimetype

def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}, using default {DEFAULT_PORT}")

    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)

    local_ip = get_local_ip()

    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    try:
        with ReusableTCPServer(("0.0.0.0", port), SPARequestHandler) as httpd:
            print("=" * 70)
            print("  SSC CGL CBT EXAM SIMULATOR - LOCAL NETWORK HOST")
            print("=" * 70)
            print(f" Serving Directory : {web_dir}")
            print(f" Port               : {port}")
            print(f" Local URL          : http://localhost:{port}/")
            print(f" Local Network URL  : http://{local_ip}:{port}/")
            print("-" * 70)
            print("💡 SPA Fallback Enabled: Any custom route (like /quiz or /ssc)")
            print("   will automatically serve the quiz without 404 errors.")
            print("-" * 70)
            print(f"📱 Tablet / Mobile Access:")
            print(f"   👉 If hosted on PC, on your tablet open: http://{local_ip}:{port}/")
            print(f"   👉 If hosted on Tablet, open: http://127.0.0.1:{port}/")
            print("=" * 70)
            print("Press Ctrl+C to stop the server anytime.\n")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[+] Server gracefully stopped.")
    except Exception as e:
        print(f"\n[!] Error starting server on port {port}: {e}")

if __name__ == "__main__":
    main()
