import http.server
import socketserver
import ssl
import os
import sys

PORT = 8443  # Standard HTTPS port

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle OPTIONS requests for CORS preflight
        self.send_response(200)
        self.end_headers()

def generate_self_signed_cert():
    """Generate a self-signed certificate if needed"""
    if not (os.path.exists("server.key") and os.path.exists("server.crt")):
        print("Generating self-signed certificate...")
        os.system('openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" -keyout server.key -out server.crt')
        print("Certificate generated")
    return "server.key", "server.crt"

if __name__ == '__main__':
    print(f"Starting HTTPS server with CORS support on port {PORT}")
    print(f"Serving files from: {os.getcwd()}")
    
    key_file, cert_file = generate_self_signed_cert()
    
    # Create HTTPS server
    httpd = socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler)
    httpd.allow_reuse_address = True
    
    # Add SSL context
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=cert_file, keyfile=key_file)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    
    print(f"Server started at https://localhost:{PORT}")
    print("If accessing from other devices, use your Pi's IP address")
    print("For example: https://192.168.1.37:8443")
    print("NOTE: You will need to accept the self-signed certificate in your browser")
    print("Press Ctrl+C to stop.")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.") 