import http.server
import socketserver
import ssl
import os
import sys
import urllib.parse

PORT = 8443  # Standard HTTPS port

class BookingFolderHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Get the current directory (bookings folder)
        self.base_dir = os.getcwd()
        super().__init__(*args, **kwargs)
    
    def translate_path(self, path):
        """
        Translate URL path to file system path
        This overrides the default behavior to handle booking folder paths
        """
        # Parse the URL path
        parsed_path = urllib.parse.urlparse(path)
        path = parsed_path.path
        
        # Split into components - first part after / would be booking ID
        # e.g., /booking_123/segment1.mp4 -> ['', 'booking_123', 'segment1.mp4']
        parts = path.split('/')
        
        # Root index listing request
        if len(parts) <= 1 or parts[1] == '':
            # For the root path, just list the booking folders
            return self.base_dir
        
        # Request for a booking folder or file within it
        booking_id = parts[1]
        booking_path = os.path.join(self.base_dir, booking_id)
        
        # If it's just a booking ID, serve the folder listing
        if len(parts) <= 2 or parts[2] == '':
            return booking_path
        
        # It's a file within a booking folder
        file_path = os.path.join(booking_path, '/'.join(parts[2:]))
        return file_path
    
    def list_directory(self, path):
        """
        Custom directory listing that filters content based on path
        """
        try:
            # Check if this is the root directory
            is_root = path == self.base_dir
            
            if is_root:
                # For root, only show booking folders
                all_items = os.listdir(path)
                folders = [d for d in all_items if os.path.isdir(os.path.join(path, d))]
                
                # Start the HTML response
                r = []
                r.append('<!DOCTYPE HTML>')
                r.append('<html>')
                r.append('<head>')
                r.append('<title>Booking Folders</title>')
                r.append('</head>')
                r.append('<body>')
                r.append('<h1>Booking Folders</h1>')
                r.append('<ul>')
                
                # Add entries for each booking folder
                for folder in sorted(folders):
                    displayname = folder
                    linkname = folder + '/'
                    r.append('<li><a href="%s">%s</a></li>' % (linkname, displayname))
                
                r.append('</ul>')
                r.append('</body>')
                r.append('</html>')
                
                encoded = '\n'.join(r).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.send_header('Content-Length', str(len(encoded)))
                self.end_headers()
                return http.server.io.BytesIO(encoded)
            
            # For non-root paths, use the default directory listing
            return super().list_directory(path)
            
        except Exception as e:
            print(f"Error in list_directory: {e}")
            return super().list_directory(path)
    
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
    print(f"Serving booking folders from: {os.getcwd()}")
    print("Access format: https://localhost:8443/BOOKING_ID/segment1.mp4")
    
    key_file, cert_file = generate_self_signed_cert()
    
    # Create HTTPS server
    httpd = socketserver.TCPServer(("", PORT), BookingFolderHandler)
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