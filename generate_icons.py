import os
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
import time

def run_server():
    server = HTTPServer(('localhost', 8000), SimpleHTTPRequestHandler)
    server.serve_forever()

if __name__ == '__main__':
    # 确保images目录存在
    if not os.path.exists('images'):
        os.makedirs('images')
    
    # 打开浏览器访问生成图标的页面
    webbrowser.open('http://localhost:8000/generate_icons.html')
    
    # 运行服务器
    run_server() 