import http.server
import socketserver
import json
import os
import sys
import urllib.parse
import subprocess
import tempfile
import base64
import shutil
import threading
import time
import webbrowser
import winreg
import ctypes
import io
import struct
from PIL import Image

PORT = 8050

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    # Check if _internal/static exists (one-dir PyInstaller build)
    internal_static = os.path.join(BASE_DIR, '_internal', 'static')
    if os.path.exists(internal_static):
        STATIC_DIR = internal_static
    else:
        STATIC_DIR = os.path.join(getattr(sys, '_MEIPASS', BASE_DIR), 'static')
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    internal_static = os.path.join(BASE_DIR, '_internal', 'static')
    if os.path.exists(internal_static):
        STATIC_DIR = internal_static
    else:
        STATIC_DIR = os.path.join(BASE_DIR, 'static')


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class ThemeServerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path).path
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        if parsed_path == '/api/export-deskthemepack':
            self.handle_export_deskthemepack(post_data)
        elif parsed_path == '/api/apply-theme':
            self.handle_apply_theme(post_data)
        else:
            self.send_error(404, 'Endpoint not found')

    def convert_png_b64_to_cur(self, b64_str, hotspot_x=0, hotspot_y=0):
        try:
            png_bytes = base64.b64decode(b64_str)
            img = Image.open(io.BytesIO(png_bytes))
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            img = img.resize((32, 32), Image.Resampling.LANCZOS)
            png_buf = io.BytesIO()
            img.save(png_buf, format='PNG')
            raw_png = png_buf.getvalue()

            # CUR header: Reserved(0), Type(2 for CUR), Count(1)
            cur_header = struct.pack('<HHH', 0, 2, 1)
            # Directory entry: Width(32), Height(32), ColorCount(0), Reserved(0), HotspotX, HotspotY, BytesInRes, ImageOffset(22)
            dir_entry = struct.pack('<BBBBHHII', 32, 32, 0, 0, hotspot_x, hotspot_y, len(raw_png), 22)
            return cur_header + dir_entry + raw_png
        except Exception as e:
            print('CUR conversion exception:', e)
            return None

    def convert_png_b64_to_ico(self, b64_str):
        try:
            png_bytes = base64.b64decode(b64_str)
            img = Image.open(io.BytesIO(png_bytes))
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            out = io.BytesIO()
            # Multi-resolution Windows 11 icon sizes for crisp high-DPI desktop scaling
            icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
            img.save(out, format='ICO', sizes=icon_sizes)
            return out.getvalue()
        except Exception as e:
            print('ICO conversion exception:', e)
            return None

    def handle_export_deskthemepack(self, post_data):
        try:
            data = json.loads(post_data.decode('utf-8'))
            theme_name = data.get('theme_name', 'CustomTheme').strip()
            theme_ini = data.get('theme_ini', '')
            wallpaper_data = data.get('wallpaper_data')
            sounds_data = data.get('sounds_data', {})
            cursors_data = data.get('cursors_data', {})
            icons_data = data.get('icons_data', {})

            temp_dir = tempfile.mkdtemp()
            theme_file = os.path.join(temp_dir, f"{theme_name}.theme")
            with open(theme_file, 'w', encoding='utf-8') as f:
                f.write(theme_ini)

            cab_out_name = f"{theme_name}.deskthemepack"
            ddf_file = os.path.join(temp_dir, 'pack.ddf')
            cab_out_path = os.path.join(temp_dir, cab_out_name)

            ddf_content = (
                '.OPTION EXPLICIT\n'
                f'.Set CabinetNameTemplate={cab_out_name}\n'
                f'.Set DiskDirectoryTemplate={temp_dir}\n'
                '.Set CabinetFileCountThreshold=0\n'
                '.Set FolderFileCountThreshold=0\n'
                '.Set FolderSizeThreshold=0\n'
                '.Set MaxCabinetSize=0\n'
                '.Set MaxDiskFileCount=0\n'
                '.Set MaxDiskSize=0\n'
                '.Set CompressionType=MSZIP\n'
                '.Set Cabinet=on\n'
                '.Set Compress=on\n\n'
                f'"{theme_file}" "{theme_name}.theme"\n'
            )

            # Wallpaper
            if wallpaper_data and ',' in wallpaper_data:
                _, b64_str = wallpaper_data.split(',', 1)
                img_bytes = base64.b64decode(b64_str)
                wall_dir = os.path.join(temp_dir, 'DesktopBackground')
                os.makedirs(wall_dir, exist_ok=True)
                wall_file = os.path.join(wall_dir, 'wallpaper.jpg')
                with open(wall_file, 'wb') as f:
                    f.write(img_bytes)
                ddf_content += f'.Set DestinationDir="DesktopBackground"\n"{wall_file}" "wallpaper.jpg"\n'

            # Sounds
            if sounds_data:
                sounds_dir = os.path.join(temp_dir, 'Sounds')
                os.makedirs(sounds_dir, exist_ok=True)
                for sound_key, s_data in sounds_data.items():
                    if s_data and ',' in s_data:
                        _, s_b64 = s_data.split(',', 1)
                        s_bytes = base64.b64decode(s_b64)
                        s_file = os.path.join(sounds_dir, f"{sound_key.lower()}.wav")
                        with open(s_file, 'wb') as f:
                            f.write(s_bytes)
                        ddf_content += f'.Set DestinationDir="Sounds"\n"{s_file}" "{sound_key.lower()}.wav"\n'

            # Cursors
            if cursors_data:
                hotspots = {
                    'Arrow': (0, 0),
                    'Help': (0, 0),
                    'AppStarting': (0, 0),
                    'Wait': (16, 16),
                    'Crosshair': (16, 16),
                    'IBeam': (16, 16),
                    'NWPen': (0, 0),
                    'No': (16, 16),
                    'SizeNS': (16, 16),
                    'SizeWE': (16, 16),
                    'SizeNWSE': (16, 16),
                    'SizeNESW': (16, 16),
                    'SizeAll': (16, 16),
                    'UpArrow': (16, 0),
                    'Hand': (12, 2)
                }
                cursors_dir = os.path.join(temp_dir, 'Cursors')
                os.makedirs(cursors_dir, exist_ok=True)
                for cur_key, c_data in cursors_data.items():
                    if c_data and ',' in c_data:
                        _, c_b64 = c_data.split(',', 1)
                        hx, hy = hotspots.get(cur_key, (0, 0))
                        c_bytes = self.convert_png_b64_to_cur(c_b64, hx, hy)
                        if c_bytes:
                            c_file = os.path.join(cursors_dir, f"{cur_key.lower()}.cur")
                            with open(c_file, 'wb') as f:
                                f.write(c_bytes)
                            ddf_content += f'.Set DestinationDir="Cursors"\n"{c_file}" "{cur_key.lower()}.cur"\n'

            # Icons
            if icons_data:
                icons_dir = os.path.join(temp_dir, 'Icons')
                os.makedirs(icons_dir, exist_ok=True)
                icon_map = {
                    'Computer': 'computer.ico',
                    'UserFiles': 'user.ico',
                    'Network': 'network.ico',
                    'RecycleFull': 'recycle_full.ico',
                    'RecycleEmpty': 'recycle_empty.ico'
                }
                for ico_key, target_file in icon_map.items():
                    ico_b64 = icons_data.get(ico_key)
                    if ico_b64 and ',' in ico_b64:
                        _, i_b64 = ico_b64.split(',', 1)
                        i_bytes = self.convert_png_b64_to_ico(i_b64)
                        if i_bytes:
                            i_file = os.path.join(icons_dir, target_file)
                            with open(i_file, 'wb') as f:
                                f.write(i_bytes)
                            ddf_content += f'.Set DestinationDir="Icons"\n"{i_file}" "{target_file}"\n'

            with open(ddf_file, 'w', encoding='utf-8') as f:
                f.write(ddf_content)

            no_window = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            subprocess.run(['makecab', '/F', ddf_file], check=True, cwd=temp_dir, capture_output=True, creationflags=no_window)

            with open(cab_out_path, 'rb') as f:
                cab_bytes = f.read()

            shutil.rmtree(temp_dir, ignore_errors=True)

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f'attachment; filename="{cab_out_name}"')
            self.send_header('Content-Length', str(len(cab_bytes)))
            self.end_headers()
            self.wfile.write(cab_bytes)
        except Exception as e:
            self.send_json_error(str(e))

    def handle_apply_theme(self, post_data):
        try:
            data = json.loads(post_data.decode('utf-8'))
            theme_name = data.get('theme_name', 'CustomTheme').strip()
            theme_ini = data.get('theme_ini', '')
            wallpaper_data = data.get('wallpaper_data')
            sounds_data = data.get('sounds_data', {})
            cursors_data = data.get('cursors_data', {})
            icons_data = data.get('icons_data', {})

            local_appdata = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
            themes_dir = os.path.join(local_appdata, 'Microsoft', 'Windows', 'Themes')
            os.makedirs(themes_dir, exist_ok=True)

            assets_dir = os.path.join(themes_dir, f"{theme_name}_assets")
            os.makedirs(assets_dir, exist_ok=True)

            wall_path = None
            # 1. Wallpaper
            if wallpaper_data and ',' in wallpaper_data:
                _, b64_str = wallpaper_data.split(',', 1)
                img_bytes = base64.b64decode(b64_str)
                wall_dir = os.path.join(assets_dir, 'DesktopBackground')
                os.makedirs(wall_dir, exist_ok=True)
                wall_path = os.path.join(wall_dir, 'wallpaper.jpg')
                with open(wall_path, 'wb') as f:
                    f.write(img_bytes)
                theme_ini = theme_ini.replace('DesktopBackground\\wallpaper.jpg', wall_path)
                theme_ini = theme_ini.replace('%SystemRoot%\\web\\wallpaper\\Windows\\img0.jpg', wall_path)

            # 2. Sounds
            sound_event_map = {
                'WindowsLogon': '.Default',
                'Notification': 'SystemNotification',
                'CriticalStop': 'SystemHand',
                'Exclamation': 'SystemExclamation',
                'EmptyRecycleBin': 'EmptyRecycleBin',
                'DeviceConnect': 'DeviceConnect',
                'DeviceDisconnect': 'DeviceDisconnect',
                'Navigating': 'Navigating'
            }
            if sounds_data:
                sounds_dir = os.path.join(assets_dir, 'Sounds')
                os.makedirs(sounds_dir, exist_ok=True)
                for sound_key, s_data in sounds_data.items():
                    if s_data and ',' in s_data:
                        _, s_b64 = s_data.split(',', 1)
                        s_bytes = base64.b64decode(s_b64)
                        s_file = os.path.join(sounds_dir, f"{sound_key.lower()}.wav")
                        with open(s_file, 'wb') as f:
                            f.write(s_bytes)
                        rel_p = f"Sounds\\{sound_key.lower()}.wav"
                        theme_ini = theme_ini.replace(rel_p, s_file)

                        evt_name = sound_event_map.get(sound_key)
                        if evt_name:
                            try:
                                reg_path = f"AppEvents\\Schemes\\Apps\\.Default\\{evt_name}\\.Current"
                                with winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_path) as key:
                                    winreg.SetValueEx(key, '', 0, winreg.REG_SZ, s_file)
                            except Exception:
                                pass

            # 3. Cursors
            hotspots = {
                'Arrow': (0, 0),
                'Help': (0, 0),
                'AppStarting': (0, 0),
                'Wait': (16, 16),
                'Crosshair': (16, 16),
                'IBeam': (16, 16),
                'NWPen': (0, 0),
                'No': (16, 16),
                'SizeNS': (16, 16),
                'SizeWE': (16, 16),
                'SizeNWSE': (16, 16),
                'SizeNESW': (16, 16),
                'SizeAll': (16, 16),
                'UpArrow': (16, 0),
                'Hand': (12, 2)
            }
            ocr_map = {
                'Arrow': 32512,       # OCR_NORMAL
                'IBeam': 32513,       # OCR_IBEAM
                'Wait': 32514,        # OCR_WAIT
                'Crosshair': 32515,   # OCR_CROSS
                'UpArrow': 32516,     # OCR_UP
                'SizeNWSE': 32642,    # OCR_SIZENWSE
                'SizeNESW': 32643,    # OCR_SIZENESW
                'SizeWE': 32644,      # OCR_SIZEWE
                'SizeNS': 32645,      # OCR_SIZENS
                'SizeAll': 32646,     # OCR_SIZEALL
                'No': 32648,          # OCR_NO
                'Hand': 32649,        # OCR_HAND
                'AppStarting': 32650, # OCR_APPSTARTING
                'Help': 32651         # OCR_HELP
            }

            cursor_paths = {}
            if cursors_data:
                cursors_dir = os.path.join(assets_dir, 'Cursors')
                os.makedirs(cursors_dir, exist_ok=True)

                # Set Cursor Scheme Name in Registry
                try:
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Control Panel\Cursors', 0, winreg.KEY_SET_VALUE) as key:
                        winreg.SetValueEx(key, '', 0, winreg.REG_SZ, theme_name)
                        winreg.SetValueEx(key, 'SchemeName', 0, winreg.REG_SZ, theme_name)
                except Exception as e:
                    print('Registry Cursors open exception:', e)

                for cur_key, c_data in cursors_data.items():
                    if c_data and ',' in c_data:
                        _, c_b64 = c_data.split(',', 1)
                        hx, hy = hotspots.get(cur_key, (0, 0))
                        c_bytes = self.convert_png_b64_to_cur(c_b64, hx, hy)
                        if c_bytes:
                            c_file = os.path.join(cursors_dir, f"{cur_key.lower()}.cur")
                            with open(c_file, 'wb') as f:
                                f.write(c_bytes)

                            # Replace relative path in INI with actual absolute path
                            rel_p = f"Cursors\\{cur_key.lower()}.cur"
                            theme_ini = theme_ini.replace(rel_p, c_file)
                            cursor_paths[cur_key] = c_file

                            # Save to HKCU\Control Panel\Cursors registry
                            try:
                                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Control Panel\Cursors', 0, winreg.KEY_SET_VALUE) as key:
                                    winreg.SetValueEx(key, cur_key, 0, winreg.REG_SZ, c_file)
                            except Exception as e:
                                print(f'Registry write exception for cursor {cur_key}:', e)

                # Save complete 15-cursor scheme string in HKCU\Control Panel\Cursors\Schemes
                cursor_order = ['Arrow', 'Help', 'AppStarting', 'Wait', 'Crosshair', 'IBeam', 'NWPen', 'No', 'SizeNS', 'SizeWE', 'SizeNWSE', 'SizeNESW', 'SizeAll', 'UpArrow', 'Hand']
                scheme_paths = [cursor_paths.get(k, '') for k in cursor_order]
                scheme_str = ','.join(scheme_paths)
                try:
                    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r'Control Panel\Cursors\Schemes') as key:
                        winreg.SetValueEx(key, theme_name, 0, winreg.REG_SZ, scheme_str)
                except Exception as e:
                    print('Registry Schemes write exception:', e)

                # Apply cursors immediately to the live system
                for cur_key, ocr_id in ocr_map.items():
                    c_file = cursor_paths.get(cur_key)
                    if c_file and os.path.exists(c_file):
                        try:
                            h_cur = ctypes.windll.user32.LoadCursorFromFileW(c_file)
                            if h_cur:
                                ctypes.windll.user32.SetSystemCursor(h_cur, ocr_id)
                        except Exception as e:
                            print(f'SetSystemCursor error for {cur_key}:', e)

                # Notify Windows to reload system cursors from registry
                try:
                    ctypes.windll.user32.SystemParametersInfoW(87, 0, None, 3)  # SPI_SETCURSORS (0x0057), SPIF_UPDATEINIFILE | SPIF_SENDCHANGE (0x03)
                    # Broadcast WM_SETTINGCHANGE (0x001A) to all windows
                    ctypes.windll.user32.SendMessageTimeoutW(0xFFFF, 0x001A, 0, "Control Panel\\Cursors", 0x0002, 3000, ctypes.byref(ctypes.c_ulong()))
                except Exception as e:
                    print('SystemParametersInfoW cursor refresh error:', e)

            # 4. Desktop Icons
            if icons_data:
                icons_dir = os.path.join(assets_dir, 'Icons')
                os.makedirs(icons_dir, exist_ok=True)
                icon_map = {
                    'Computer': ('computer.ico', '{20D04FE0-3AEA-1069-A2D8-08002B30309D}'),
                    'UserFiles': ('user.ico', '{59031A47-3F72-44A7-89C5-5595FE6B30EE}'),
                    'Network': ('network.ico', '{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}'),
                    'RecycleFull': ('recycle_full.ico', '{645FF040-5081-101B-9F08-00AA002F954E}'),
                    'RecycleEmpty': ('recycle_empty.ico', '{645FF040-5081-101B-9F08-00AA002F954E}')
                }

                saved_icons = {}
                for ico_key, (target_file, clsid) in icon_map.items():
                    ico_b64 = icons_data.get(ico_key)
                    if ico_b64 and ',' in ico_b64:
                        _, i_b64 = ico_b64.split(',', 1)
                        i_bytes = self.convert_png_b64_to_ico(i_b64)
                        if i_bytes:
                            i_file = os.path.join(icons_dir, target_file)
                            with open(i_file, 'wb') as f:
                                f.write(i_bytes)
                            saved_icons[ico_key] = i_file

                            # Replace relative path in INI with actual absolute path
                            rel_p = f"Icons\\{target_file}"
                            theme_ini = theme_ini.replace(rel_p, i_file)

                # Apply Desktop Icons directly to Windows 11 Registry
                # HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\CLSID\{GUID}\DefaultIcon
                for ico_key, (target_file, clsid) in icon_map.items():
                    i_file = saved_icons.get(ico_key)
                    if not i_file:
                        continue
                    try:
                        explorer_reg = f"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CLSID\\{clsid}\\DefaultIcon"
                        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, explorer_reg) as key:
                            if ico_key == 'RecycleFull':
                                winreg.SetValueEx(key, 'full', 0, winreg.REG_SZ, i_file)
                            elif ico_key == 'RecycleEmpty':
                                winreg.SetValueEx(key, '', 0, winreg.REG_SZ, i_file)
                                winreg.SetValueEx(key, 'empty', 0, winreg.REG_SZ, i_file)
                            else:
                                winreg.SetValueEx(key, '', 0, winreg.REG_SZ, i_file)
                    except Exception as e:
                        print(f'Registry Explorer Icon error for {ico_key}:', e)

                    # Also set in HKCU\Software\Classes\CLSID\{clsid}\DefaultIcon
                    try:
                        classes_reg = f"Software\\Classes\\CLSID\\{clsid}\\DefaultIcon"
                        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, classes_reg) as key:
                            if ico_key == 'RecycleFull':
                                winreg.SetValueEx(key, 'full', 0, winreg.REG_SZ, i_file)
                            elif ico_key == 'RecycleEmpty':
                                winreg.SetValueEx(key, '', 0, winreg.REG_SZ, i_file)
                                winreg.SetValueEx(key, 'empty', 0, winreg.REG_SZ, i_file)
                            else:
                                winreg.SetValueEx(key, '', 0, winreg.REG_SZ, i_file)
                    except Exception:
                        pass

            # 5. Write .theme file with all absolute resolved paths
            theme_file_path = os.path.join(themes_dir, f"{theme_name}.theme")
            with open(theme_file_path, 'w', encoding='utf-8') as f:
                f.write(theme_ini)

            # 6. Apply wallpaper natively if present
            if wall_path and os.path.exists(wall_path) and sys.platform == 'win32':
                try:
                    ctypes.windll.user32.SystemParametersInfoW(20, 0, wall_path, 3)  # SPI_SETDESKWALLPAPER (0x0014)
                except Exception as e:
                    print('Wallpaper apply error:', e)

            # 7. Refresh Windows Shell & Desktop Icon Cache
            if sys.platform == 'win32':
                try:
                    # Notify Windows Shell that file associations / shell icons changed
                    ctypes.windll.shell32.SHChangeNotify(0x08000000, 0, None, None)  # SHCNE_ASSOCCHANGED
                    # Redraw desktop windows to immediately update desktop icons
                    hwnd_progman = ctypes.windll.user32.FindWindowW("Progman", None)
                    if hwnd_progman:
                        ctypes.windll.user32.RedrawWindow(hwnd_progman, None, None, 0x0085)  # RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW
                    hwnd_desktop = ctypes.windll.user32.GetDesktopWindow()
                    if hwnd_desktop:
                        ctypes.windll.user32.RedrawWindow(hwnd_desktop, None, None, 0x0085)
                except Exception as e:
                    print('Shell refresh error:', e)

            # 8. Start theme file to let Windows register it in Windows Settings
            if sys.platform == 'win32':
                try:
                    os.startfile(theme_file_path)
                except Exception as e:
                    print('os.startfile theme error:', e)

            res = {
                'success': True,
                'message': f"Theme '{theme_name}' with full Cursors, Sounds & Icons applied!"
            }
            self.send_json_response(res)
        except Exception as e:
            print('handle_apply_theme Exception:', e)
            self.send_json_error(str(e))

    def send_json_response(self, data, code=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json_error(self, message, code=500):
        self.send_json_response({'success': False, 'error': message}, code=code)


def run_server_loop(current_port):
    os.chdir(STATIC_DIR)
    with ReusableTCPServer(('', current_port), ThemeServerHandler) as httpd:
        httpd.serve_forever()


def main():
    current_port = PORT
    for port_attempt in range(PORT, PORT + 10):
        try:
            with ReusableTCPServer(('', port_attempt), ThemeServerHandler) as test_server:
                current_port = port_attempt
                break
        except OSError:
            continue

    server_thread = threading.Thread(target=run_server_loop, args=(current_port,), daemon=True)
    server_thread.start()
    time.sleep(0.6)

    url = f'http://localhost:{current_port}'

    try:
        import webview
        webview.settings['ALLOW_DOWNLOADS'] = True
        print(f'Opening Native Windows Desktop Application on port {current_port}...')
        webview.create_window(
            title='Fluent Theme Studio for Windows 11',
            url=url,
            width=1280,
            height=820,
            resizable=True,
            min_size=(900, 600)
        )
        webview.start()
    except Exception as e:
        print('Opening in Web Browser...', e)
        webbrowser.open(url)
        while True:
            time.sleep(1)


if __name__ == '__main__':
    main()
