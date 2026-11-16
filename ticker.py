"""Taskbar pill for the DSH Stock Watch plugin.

Draws a small, click-through, always-on-top strip inside the Windows taskbar,
just left of the notification area, showing the first watchlist code's last
price and change. Data comes from the plugin host (`--base`), so this process
never talks to a market-data origin.

Pure Win32 + Pillow: the window is layered (per-pixel alpha), so the rounded
capsule blends cleanly over the taskbar and clicks fall through to whatever is
underneath.
"""

from __future__ import annotations

import argparse
import ctypes
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from ctypes import wintypes as w
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

user32 = ctypes.WinDLL("user32", use_last_error=True)
gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

# ------------------------------------------------------------------ constants
WS_POPUP = 0x80000000
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_TOPMOST = 0x00000008
WS_EX_NOACTIVATE = 0x08000000

SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002
SWP_NOZORDER = 0x0004
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
HWND_TOPMOST = -1

ULW_ALPHA = 0x00000002
AC_SRC_OVER = 0x00
AC_SRC_ALPHA = 0x01
DIB_RGB_COLORS = 0

WM_DESTROY = 0x0002
WM_TIMER = 0x0113
WM_DISPLAYCHANGE = 0x007E
WM_MOUSEMOVE = 0x0200
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
WM_MOUSELEAVE = 0x02A3
WM_SETCURSOR = 0x0020

TME_LEAVE = 0x00000002
IDC_HAND = 32649

SM_CXSCREEN = 0
SM_CYSCREEN = 1
SPI_GETWORKAREA = 0x0030

TIMER_ID = 1
TIMER_MS = 400

# ------------------------------------------------------------------ structures
LRESULT = ctypes.c_ssize_t
WNDPROC = ctypes.WINFUNCTYPE(LRESULT, w.HWND, w.UINT, ctypes.c_size_t, ctypes.c_ssize_t)


class WNDCLASSEXW(ctypes.Structure):
    _fields_ = [
        ("cbSize", w.UINT),
        ("style", w.UINT),
        ("lpfnWndProc", WNDPROC),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", w.HINSTANCE),
        ("hIcon", ctypes.c_void_p),
        ("hCursor", ctypes.c_void_p),
        ("hbrBackground", ctypes.c_void_p),
        ("lpszMenuName", w.LPCWSTR),
        ("lpszClassName", w.LPCWSTR),
        ("hIconSm", ctypes.c_void_p),
    ]


class BLENDFUNCTION(ctypes.Structure):
    _fields_ = [
        ("BlendOp", ctypes.c_ubyte),
        ("BlendFlags", ctypes.c_ubyte),
        ("SourceConstantAlpha", ctypes.c_ubyte),
        ("AlphaFormat", ctypes.c_ubyte),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", w.DWORD),
        ("biWidth", w.LONG),
        ("biHeight", w.LONG),
        ("biPlanes", w.WORD),
        ("biBitCount", w.WORD),
        ("biCompression", w.DWORD),
        ("biSizeImage", w.DWORD),
        ("biXPelsPerMeter", w.LONG),
        ("biYPelsPerMeter", w.LONG),
        ("biClrUsed", w.DWORD),
        ("biClrImportant", w.DWORD),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", w.DWORD * 3)]


class TRACKMOUSEEVENT(ctypes.Structure):
    _fields_ = [
        ("cbSize", w.DWORD),
        ("dwFlags", w.DWORD),
        ("hwndTrack", w.HWND),
        ("dwHoverTime", w.DWORD),
    ]


user32.RegisterClassExW.argtypes = [ctypes.POINTER(WNDCLASSEXW)]
user32.RegisterClassExW.restype = w.ATOM
user32.CreateWindowExW.argtypes = [w.DWORD, w.LPCWSTR, w.LPCWSTR, w.DWORD, ctypes.c_int,
                                   ctypes.c_int, ctypes.c_int, ctypes.c_int, w.HWND,
                                   ctypes.c_void_p, w.HINSTANCE, ctypes.c_void_p]
user32.CreateWindowExW.restype = w.HWND
user32.DefWindowProcW.argtypes = [w.HWND, w.UINT, ctypes.c_size_t, ctypes.c_ssize_t]
user32.DefWindowProcW.restype = LRESULT
user32.GetMessageW.argtypes = [ctypes.POINTER(w.MSG), w.HWND, w.UINT, w.UINT]
user32.GetMessageW.restype = ctypes.c_int
user32.DispatchMessageW.argtypes = [ctypes.POINTER(w.MSG)]
user32.TranslateMessage.argtypes = [ctypes.POINTER(w.MSG)]
user32.SetProcessDpiAwarenessContext.argtypes = [ctypes.c_void_p]
user32.SetProcessDpiAwarenessContext.restype = w.BOOL
user32.SetTimer.argtypes = [w.HWND, ctypes.c_size_t, w.UINT, ctypes.c_void_p]
user32.KillTimer.argtypes = [w.HWND, ctypes.c_size_t]
user32.SetWindowPos.argtypes = [w.HWND, w.HWND, ctypes.c_int, ctypes.c_int,
                                ctypes.c_int, ctypes.c_int, w.UINT]
user32.GetDC.argtypes = [w.HWND]
user32.GetDC.restype = w.HDC
user32.ReleaseDC.argtypes = [w.HWND, w.HDC]
gdi32.CreateCompatibleDC.argtypes = [w.HDC]
gdi32.CreateCompatibleDC.restype = w.HDC
gdi32.DeleteDC.argtypes = [w.HDC]
gdi32.CreateDIBSection.argtypes = [w.HDC, ctypes.POINTER(BITMAPINFO), w.UINT,
                                  ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p, w.DWORD]
gdi32.CreateDIBSection.restype = w.HBITMAP
gdi32.SelectObject.argtypes = [w.HDC, ctypes.c_void_p]
gdi32.SelectObject.restype = ctypes.c_void_p
gdi32.DeleteObject.argtypes = [ctypes.c_void_p]
user32.UpdateLayeredWindow.argtypes = [w.HWND, w.HDC, ctypes.POINTER(w.POINT),
                                       ctypes.POINTER(w.SIZE), w.HDC, ctypes.POINTER(w.POINT),
                                       w.DWORD, ctypes.POINTER(BLENDFUNCTION), w.DWORD]
user32.FindWindowW.argtypes = [w.LPCWSTR, w.LPCWSTR]
user32.FindWindowW.restype = w.HWND
user32.GetWindowRect.argtypes = [w.HWND, ctypes.POINTER(w.RECT)]
user32.EnumChildWindows.argtypes = [w.HWND, ctypes.c_void_p, w.LPARAM]
user32.GetClassNameW.argtypes = [w.HWND, w.LPWSTR, ctypes.c_int]
user32.ShowWindow.argtypes = [w.HWND, ctypes.c_int]
user32.DestroyWindow.argtypes = [w.HWND]
user32.PostQuitMessage.argtypes = [ctypes.c_int]
user32.GetSystemMetrics.argtypes = [ctypes.c_int]
user32.SystemParametersInfoW.argtypes = [w.UINT, w.UINT, ctypes.c_void_p, w.UINT]
user32.GetCursorPos.argtypes = [ctypes.POINTER(w.POINT)]
user32.SetCapture.argtypes = [w.HWND]
user32.SetCapture.restype = w.HWND
user32.ReleaseCapture.argtypes = []
user32.TrackMouseEvent.argtypes = [ctypes.POINTER(TRACKMOUSEEVENT)]
user32.LoadCursorW.argtypes = [w.HINSTANCE, ctypes.c_void_p]
user32.LoadCursorW.restype = ctypes.c_void_p
user32.SetCursor.argtypes = [ctypes.c_void_p]
gdi32.GetPixel.argtypes = [w.HDC, ctypes.c_int, ctypes.c_int]
gdi32.GetPixel.restype = w.DWORD
kernel32.GetModuleHandleW.restype = w.HINSTANCE
kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, w.BOOL, w.LPCWSTR]
kernel32.CreateMutexW.restype = w.HANDLE

# ------------------------------------------------------------------- palette
# The pill samples the taskbar underneath and repaints itself in that colour, so
# it reads as part of the shell instead of a black box. These stay as the
# fallback used before the first sample or when the shell cannot be measured.
BG = (23, 25, 29, 236)
BORDER = (255, 255, 255, 28)
TEXT_NAME = (176, 184, 196, 255)
TEXT_PRICE = (245, 247, 250, 255)
UP = (246, 70, 93, 255)
DOWN = (14, 203, 129, 255)
FLAT = (154, 163, 175, 255)
MUTED = (140, 148, 160, 255)

DARK_PALETTE = {
    "bg": BG,
    "border": BORDER,
    "name": TEXT_NAME,
    "price": TEXT_PRICE,
    "muted": MUTED,
    "up": UP,
    "down": DOWN,
    "flat": FLAT,
    "arrow_idle": (255, 255, 255, 110),
    "arrow_active": (255, 255, 255, 240),
    "glow": (255, 255, 255, 34),
}


def palette_from_taskbar(rgb: tuple[int, int, int]) -> dict:
    """Blend into the taskbar colour, then pick text tones that stay legible."""
    red, green, blue = rgb
    luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

    if luminance >= 135:
        # Light taskbar: nudge the fill a touch lighter than the shell and switch
        # to dark text with a slightly deeper red/green for contrast.
        lift = lambda value: min(255, value + 9)
        return {
            "bg": (lift(red), lift(green), lift(blue), 238),
            "border": (0, 0, 0, 24),
            "name": (82, 88, 98, 255),
            "price": (24, 26, 30, 255),
            "muted": (122, 128, 137, 255),
            "up": (201, 42, 65, 255),
            "down": (9, 141, 97, 255),
            "flat": (108, 114, 123, 255),
            "arrow_idle": (44, 48, 56, 120),
            "arrow_active": (20, 22, 26, 235),
            "glow": (0, 0, 0, 22),
        }

    sink = lambda value: max(0, value - 6)
    return {
        "bg": (sink(red), sink(green), sink(blue), 236),
        "border": (255, 255, 255, 30),
        "name": (196, 202, 212, 255),
        "price": (245, 247, 250, 255),
        "muted": (150, 157, 168, 255),
        "up": UP,
        "down": DOWN,
        "flat": FLAT,
        "arrow_idle": (255, 255, 255, 110),
        "arrow_active": (255, 255, 255, 240),
        "glow": (255, 255, 255, 34),
    }


def median_color(samples: list[tuple[int, int, int]]) -> tuple[int, int, int] | None:
    if not samples:
        return None
    channels = []
    for index in range(3):
        values = sorted(color[index] for color in samples)
        channels.append(values[len(values) // 2])
    return channels[0], channels[1], channels[2]


def sample_pixel(x: int, y: int) -> tuple[int, int, int] | None:
    """One composited screen pixel, as RGB (COLORREF is 0x00BBGGRR)."""
    screen = user32.GetDC(None)
    try:
        value = gdi32.GetPixel(screen, x, y)
    finally:
        user32.ReleaseDC(None, screen)
    if value == 0xFFFFFFFF:
        return None
    return value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF


FONT_DIR = Path(r"C:\Windows\Fonts")


def load_font(bold: bool, size_px: int) -> ImageFont.FreeTypeFont:
    names = ("msyhbd.ttc", "msyh.ttc", "simhei.ttf") if bold else ("msyh.ttc", "simhei.ttf", "segoeui.ttf")
    for name in names:
        path = FONT_DIR / name
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size_px)
            except OSError:
                continue
    return ImageFont.load_default(size_px)


def premultiply_bgra(image: Image.Image) -> bytes:
    alpha = image.getchannel("A")
    alpha_rgb = Image.merge("RGB", (alpha, alpha, alpha))
    rgb = ImageChops.multiply(image.convert("RGB"), alpha_rgb)
    merged = Image.merge("RGBA", (*rgb.split(), alpha))
    return merged.tobytes("raw", "BGRA")


def fmt_price(value, market: str) -> str:
    if not isinstance(value, (int, float)):
        return "—"
    if market == "KR":
        return f"{value:,.0f}"
    digits = 3 if market == "HK" else 2
    return f"{value:,.{digits}f}"


def fmt_pct(value, palette: dict | None = None) -> tuple[str, tuple[int, int, int, int]]:
    tones = palette or DARK_PALETTE
    if not isinstance(value, (int, float)):
        return "—", tones["flat"]
    if value > 0:
        return f"▲ {value:+.2f}%", tones["up"]
    if value < 0:
        return f"▼ {value:.2f}%", tones["down"]
    return f"{value:.2f}%", tones["flat"]


def truncate(draw: ImageDraw.ImageDraw, text: str, font, limit: float) -> str:
    if font.getlength(text) <= limit:
        return text
    ellipsis = "…"
    trimmed = text
    while trimmed and font.getlength(trimmed + ellipsis) > limit:
        trimmed = trimmed[:-1]
    return (trimmed + ellipsis) if trimmed else ellipsis


def arrow_geometry(width: int, scale: float) -> tuple[tuple[float, float], tuple[float, float]]:
    """The two arrow buttons as (x0, x1) rects.

    One definition feeds the hover glow, the triangle placement and the hit test,
    so the round highlight, the glyph and the clickable area stay in step.
    """
    padx = 8 * scale
    zone = 19 * scale
    margin = 2 * scale
    prev_rect = (padx - margin, padx + zone + margin)
    next_rect = (width - padx - zone - margin, width - padx + margin)
    return prev_rect, next_rect


def render_pill(
    snapshot: dict,
    scale: float,
    hover: str | None = None,
    palette: dict | None = None,
) -> Image.Image:
    """Compose the capsule. Everything is sized from the taskbar scale."""
    tones = palette or DARK_PALETTE
    height = max(22, int(round(32 * scale)))
    padx = int(round(8 * scale))
    arrow_zone = int(round(19 * scale))
    dot = max(2, int(round(3.2 * scale)))
    gap_dot = int(round(6 * scale))
    gap_name = int(round(9 * scale))
    gap_price = int(round(8 * scale))
    gap_pct = int(round(7 * scale))

    font_name = load_font(False, max(10, int(round(12.5 * scale))))
    font_price = load_font(True, max(12, int(round(16 * scale))))
    font_pct = load_font(True, max(10, int(round(12.5 * scale))))
    font_meta = load_font(False, max(9, int(round(10.5 * scale))))

    name = str(snapshot.get("name") or snapshot.get("code") or "盯盘")
    market = str(snapshot.get("market") or "")

    # Outside the US cash session the pre/post price is the one that matters, so
    # the pill shows it as the headline number and tags the name.
    extended = snapshot.get("extended")
    tag = ""
    if isinstance(extended, dict) and isinstance(extended.get("price"), (int, float)):
        tag = "盘前" if extended.get("session") == "pre" else "盘后"
        price_text = fmt_price(extended.get("price"), market)
        pct_text, color = fmt_pct(extended.get("changePct"), tones)
        name = f"{tag} {name}"
    else:
        price_text = fmt_price(snapshot.get("price"), market)
        pct_text, color = fmt_pct(snapshot.get("changePct"), tones)

    count = snapshot.get("count")
    index = snapshot.get("index")
    steppable = isinstance(count, int) and count > 1
    counter_text = f"{index + 1}/{count}" if steppable and isinstance(index, int) else ""

    probe = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    name_text = truncate(probe, name, font_name, round(120 * scale))
    width = (
        padx
        + arrow_zone
        + gap_dot
        + dot * 2
        + gap_dot
        + font_name.getlength(name_text)
        + gap_name
        + font_price.getlength(price_text)
        + gap_price
        + font_pct.getlength(pct_text)
        + (gap_pct + font_meta.getlength(counter_text) if counter_text else 0)
        + gap_dot
        + arrow_zone
        + padx
    )
    width = int(round(width))
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        [0, 0, width - 1, height - 1],
        radius=height // 2,
        fill=tones["bg"],
        outline=tones["border"],
        width=1,
    )

    center = height / 2
    chevron = max(3.0, 4.8 * scale)
    idle = tones["arrow_idle"]
    active = tones["arrow_active"]
    prev_rect, next_rect = arrow_geometry(width, scale)

    # Hover glow under the arrow being pointed at. ImageDraw writes pixels
    # directly, so it has to be composited from an overlay to stay translucent.
    if steppable and hover in ("prev", "next"):
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        painter = ImageDraw.Draw(overlay)
        box = prev_rect if hover == "prev" else next_rect
        painter.rounded_rectangle(
            [box[0], 4, box[1], height - 5],
            radius=(height - 9) // 2,
            fill=tones["glow"],
        )
        canvas.alpha_composite(overlay)

    x = padx
    if steppable:
        cx = (prev_rect[0] + prev_rect[1]) / 2
        draw.polygon(
            [
                (cx + (chevron / 2), center - chevron),
                (cx + (chevron / 2), center + chevron),
                (cx - (chevron / 2), center),
            ],
            fill=active if hover == "prev" else idle,
        )
    x += arrow_zone

    draw.ellipse([x, center - dot, x + dot * 2, center + dot], fill=color)
    x += dot * 2 + gap_dot
    draw.text((x, center), name_text, font=font_name, fill=tones["name"], anchor="lm")
    x += font_name.getlength(name_text) + gap_name
    draw.text((x, center), price_text, font=font_price, fill=tones["price"], anchor="lm")
    x += font_price.getlength(price_text) + gap_price
    draw.text((x, center), pct_text, font=font_pct, fill=color, anchor="lm")
    x += font_pct.getlength(pct_text)
    if counter_text:
        x += gap_pct
        draw.text((x, center), counter_text, font=font_meta, fill=tones["muted"], anchor="lm")
        x += font_meta.getlength(counter_text)
    x += gap_dot

    if steppable:
        cx = (next_rect[0] + next_rect[1]) / 2
        draw.polygon(
            [
                (cx - (chevron / 2), center - chevron),
                (cx - (chevron / 2), center + chevron),
                (cx + (chevron / 2), center),
            ],
            fill=active if hover == "next" else idle,
        )
    return canvas


class Feed:
    """Polls the plugin host for the selected code's snapshot."""

    def __init__(self, base: str, interval: float) -> None:
        self.base = base.rstrip("/")
        self.url = self.base + "/plugins/stock-watch/ticker.json"
        self.control = self.base + "/plugins/stock-watch/ticker"
        self.interval = max(1.0, interval)
        self.snapshot: dict | None = None
        self.stop = False
        self.failures = 0
        self.lock = threading.Lock()

    def current(self) -> dict | None:
        with self.lock:
            return self.snapshot

    def poll_once(self) -> None:
        try:
            request = urllib.request.Request(self.url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8"))
            self.failures = 0
            with self.lock:
                self.snapshot = data
            if data.get("enabled") is False:
                self.stop = True
        except Exception:
            self.failures += 1
            # The host is gone (app closed, plugin removed): let the pill die too.
            if self.failures >= 8:
                self.stop = True

    def step(self, delta: int) -> None:
        """Ask the host for the previous/next code, then refresh immediately."""
        try:
            body = json.dumps({"action": "step", "delta": delta}).encode("utf-8")
            request = urllib.request.Request(
                self.control,
                data=body,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                response.read()
        except Exception:
            return
        self.poll_once()

    def run(self) -> None:
        while not self.stop:
            self.poll_once()
            if self.stop:
                break
            time.sleep(self.interval)


def taskbar_rect() -> w.RECT | None:
    hwnd = user32.FindWindowW("Shell_TrayWnd", None)
    if not hwnd:
        return None
    rect = w.RECT()
    if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return None
    return rect


def tray_left(taskbar: w.HWND) -> int | None:
    found: list[int] = []
    callback_type = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)

    def visit(child, _):
        buffer = ctypes.create_unicode_buffer(64)
        user32.GetClassNameW(child, buffer, 64)
        if buffer.value == "TrayNotifyWnd":
            rect = w.RECT()
            if user32.GetWindowRect(child, ctypes.byref(rect)):
                found.append(rect.left)
            return False
        return True

    callback = callback_type(visit)
    user32.EnumChildWindows(taskbar, ctypes.cast(callback, ctypes.c_void_p), 0)
    return found[0] if found else None


def work_area() -> w.RECT:
    rect = w.RECT()
    if user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(rect), 0):
        return rect
    rect.left, rect.top = 0, 0
    rect.right, rect.bottom = user32.GetSystemMetrics(SM_CXSCREEN), user32.GetSystemMetrics(SM_CYSCREEN)
    return rect


def position_file() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home())
    # 2.x renamed the plugin to dsh-dingpan; keep reading the old file once so an
    # existing pinned position survives the upgrade.
    legacy = Path(base) / "dsh-stock-watch" / "ticker.json"
    current = Path(base) / "dsh-dingpan" / "ticker.json"
    if not current.exists() and legacy.exists():
        return legacy
    return current


def load_position() -> tuple[int, int] | None:
    try:
        data = json.loads(position_file().read_text(encoding="utf-8"))
        x, y = int(data["x"]), int(data["y"])
    except Exception:
        return None
    # Ignore a remembered spot that no longer lands on any screen.
    if x < -2000 or y < -2000:
        return None
    if x > user32.GetSystemMetrics(SM_CXSCREEN) or y > user32.GetSystemMetrics(SM_CYSCREEN):
        return None
    return x, y


def save_position(x: int, y: int) -> None:
    path = position_file()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"x": int(x), "y": int(y)}), encoding="utf-8")
    except OSError:
        # A read-only profile only costs the drag position, never the ticker itself.
        pass


class Pill:
    def __init__(self, feed: Feed) -> None:
        self.feed = feed
        self.hwnd = w.HWND()
        self.image: Image.Image | None = None
        self.key: tuple | None = None
        self.scale = 1.0
        self.ticks = 0
        self.position = load_position()
        self.dragging = False
        self.drag_grab = (0, 0)
        self.moved = False
        self.press_client = (0, 0)
        self.press_cursor = (0, 0)
        self.hover: str | None = None
        self.tracking = False
        self.steppable = False
        self.prev_rect = (0.0, 0.0)
        self.next_rect = (0.0, 0.0)
        self.palette = DARK_PALETTE
        self.palette_at = 0.0
        self._hand_cursor = user32.LoadCursorW(None, ctypes.c_void_p(IDC_HAND))
        self._wndproc = WNDPROC(self._on_message)
        self._create_window()

    # ----------------------------------------------------------------- window
    def _create_window(self) -> None:
        hinstance = kernel32.GetModuleHandleW(None)
        class_name = "DshStockWatchTicker"
        wc = WNDCLASSEXW()
        wc.cbSize = ctypes.sizeof(WNDCLASSEXW)
        wc.style = 0
        wc.lpfnWndProc = self._wndproc
        wc.hInstance = hinstance
        wc.lpszClassName = class_name
        user32.RegisterClassExW(ctypes.byref(wc))  # 1410 when already registered: fine

        # No WS_EX_TRANSPARENT: the pill must receive the drag gestures.
        ex_style = WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE
        self.hwnd = user32.CreateWindowExW(
            ex_style, class_name, "Stock Watch", WS_POPUP,
            0, 0, 10, 10, None, None, hinstance, None,
        )
        if not self.hwnd:
            raise OSError(f"CreateWindowExW failed: {ctypes.get_last_error()}")
        user32.SetTimer(self.hwnd, TIMER_ID, TIMER_MS, None)

    def _on_message(self, hwnd, msg, wparam, lparam):
        if msg == WM_TIMER:
            self._tick()
            return 0
        if msg == WM_DISPLAYCHANGE:
            self.key = None
            self._tick()
            return 0
        if msg == WM_LBUTTONDOWN:
            self._begin_press(lparam)
            return 0
        if msg == WM_MOUSEMOVE:
            if self.dragging:
                self._move_drag()
            else:
                self._update_hover(lparam)
            return 0
        if msg == WM_LBUTTONUP:
            self._release(lparam)
            return 0
        if msg == WM_MOUSELEAVE:
            self.tracking = False
            if self.hover is not None:
                self.hover = None
                self._tick()
            return 0
        if msg == WM_SETCURSOR:
            if self._zone_at(self._cursor_client()[0]) is not None:
                user32.SetCursor(self._hand_cursor)
                return 1
            return user32.DefWindowProcW(hwnd, msg, wparam, lparam)
        if msg == WM_DESTROY:
            user32.KillTimer(hwnd, TIMER_ID)
            user32.PostQuitMessage(0)
            return 0
        return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    # --------------------------------------------------------------- pointer
    @staticmethod
    def _client_xy(lparam: int) -> tuple[int, int]:
        x = ctypes.c_short(lparam & 0xFFFF).value
        y = ctypes.c_short((lparam >> 16) & 0xFFFF).value
        return x, y

    def _cursor_client(self) -> tuple[int, int]:
        cursor = w.POINT()
        user32.GetCursorPos(ctypes.byref(cursor))
        rect = w.RECT()
        user32.GetWindowRect(self.hwnd, ctypes.byref(rect))
        return cursor.x - rect.left, cursor.y - rect.top

    def _zone_at(self, x: int) -> str | None:
        if not self.steppable or self.image is None:
            return None
        # Exactly the painted/highlighted button rect, so the round glow and the
        # clickable area never disagree.
        if self.prev_rect[0] <= x <= self.prev_rect[1]:
            return "prev"
        if self.next_rect[0] <= x <= self.next_rect[1]:
            return "next"
        return None

    def _update_hover(self, lparam: int) -> None:
        if not self.tracking:
            self.tracking = True
            track = TRACKMOUSEEVENT()
            track.cbSize = ctypes.sizeof(TRACKMOUSEEVENT)
            track.dwFlags = TME_LEAVE
            track.hwndTrack = self.hwnd
            track.dwHoverTime = 0
            user32.TrackMouseEvent(ctypes.byref(track))

        zone = self._zone_at(self._client_xy(lparam)[0])
        if zone != self.hover:
            self.hover = zone
            self._tick()

    def _begin_press(self, lparam: int) -> None:
        cursor = w.POINT()
        user32.GetCursorPos(ctypes.byref(cursor))
        rect = w.RECT()
        user32.GetWindowRect(self.hwnd, ctypes.byref(rect))
        self.press_client = self._client_xy(lparam)
        self.press_cursor = (cursor.x, cursor.y)
        self.drag_grab = (cursor.x - rect.left, cursor.y - rect.top)
        self.dragging = True
        self.moved = False
        user32.SetCapture(self.hwnd)

    def _move_drag(self) -> None:
        if self.image is None:
            return
        cursor = w.POINT()
        user32.GetCursorPos(ctypes.byref(cursor))
        if not self.moved:
            dx = cursor.x - self.press_cursor[0]
            dy = cursor.y - self.press_cursor[1]
            # A click wobbles by a pixel or two; only a real drag should move us.
            if (dx * dx) + (dy * dy) < 16:
                return
            self.moved = True
        x = max(0, cursor.x - self.drag_grab[0])
        y = max(0, cursor.y - self.drag_grab[1])
        width, height = self.image.size
        user32.SetWindowPos(
            self.hwnd, HWND_TOPMOST, x, y, width, height,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
        self.position = (x, y)

    def _release(self, lparam: int) -> None:
        if not self.dragging:
            return
        self.dragging = False
        user32.ReleaseCapture()

        if self.moved:
            if self.position:
                save_position(*self.position)
            return

        zone = self._zone_at(self._client_xy(lparam)[0])
        if zone is None:
            return
        delta = -1 if zone == "prev" else 1
        threading.Thread(target=self.feed.step, args=(delta,), daemon=True).start()

    # ------------------------------------------------------------------ paint
    def _metrics(self) -> tuple[float, int, int]:
        """Scale from the taskbar height, plus the anchor point (right edge, top)."""
        taskbar = taskbar_rect()
        screen_h = user32.GetSystemMetrics(SM_CYSCREEN)
        if taskbar and 24 <= (taskbar.bottom - taskbar.top) <= 120 and taskbar.top < screen_h - 4:
            height = taskbar.bottom - taskbar.top
            scale = max(0.85, min(1.8, height / 48.0))
            left = tray_left(user32.FindWindowW("Shell_TrayWnd", None))
            if left is None:
                left = taskbar.right - int(300 * scale)
            # Leave room for the taskbar's own weather/news widget, which sits
            # immediately left of the notification area on stock Windows.
            right_edge = left - int(200 * scale)
            return scale, right_edge, taskbar.top + (height - int(round(32 * scale))) // 2

        area = work_area()
        scale = 1.0
        return scale, area.right - int(10 * scale), area.bottom - int(44 * scale)

    def _place(self, width: int, height: int) -> bool:
        """Move the pill into place. False means the taskbar was not readable yet."""
        if self.position:
            x, y = self.position
        else:
            scale, right_edge, top = self._metrics()
            if right_edge <= width or top <= 0:
                # Never show the pill at the desktop origin while the shell is
                # briefly unreadable; the next timer tick retries.
                return False
            x, y = right_edge - width, top
        user32.SetWindowPos(
            self.hwnd, HWND_TOPMOST, x, y, width, height,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
        return True

    def _sample_palette(self) -> dict | None:
        """Read the strip just left of the pill and derive a taskbar-matching palette."""
        taskbar = taskbar_rect()
        if not taskbar:
            return None
        height = taskbar.bottom - taskbar.top
        if height < 20:
            return None

        rect = w.RECT()
        user32.GetWindowRect(self.hwnd, ctypes.byref(rect))
        left = rect.left
        if left <= 0:
            # First tick: the window is still at the origin, so predict where the
            # pill will land instead of sampling that corner.
            scale, right_edge, _ = self._metrics()
            width = self.image.width if self.image else int(round(300 * scale))
            left = max(0, right_edge - width)

        y = taskbar.top + (height // 2)
        anchor = left - 12
        samples: list[tuple[int, int, int]] = []
        for step in range(8):
            x = anchor - (step * 16)
            if x < taskbar.left + 8 or x > taskbar.right - 8:
                break
            for offset in (-3, 0, 3):
                pixel = sample_pixel(x, y + offset)
                if pixel:
                    samples.append(pixel)

        rgb = median_color(samples)
        return palette_from_taskbar(rgb) if rgb else None

    def _tick(self) -> None:
        self.ticks += 1
        snapshot = self.feed.current()

        if self.feed.stop:
            user32.DestroyWindow(self.hwnd)
            return

        now = time.monotonic()
        if now - self.palette_at > 8.0:
            sampled = self._sample_palette()
            if sampled is not None:
                self.palette = sampled
                self.palette_at = now

        scale = self._metrics()[0]
        payload = snapshot or {"name": "盯盘", "message": "connecting"}
        key = (
            payload.get("code"),
            payload.get("price"),
            payload.get("changePct"),
            payload.get("name"),
            payload.get("message"),
            payload.get("index"),
            payload.get("count"),
            self.hover,
            tuple(self.palette["bg"][:3]),
            round(scale, 2),
        )

        if key != self.key:
            self.key = key
            self.scale = scale
            self.image = render_pill(payload, scale, self.hover, self.palette)
            self.steppable = isinstance(payload.get("count"), int) and payload.get("count") > 1
            self.prev_rect, self.next_rect = arrow_geometry(self.image.width, scale)
            if not self._place(*self.image.size):
                self.key = None  # taskbar not measurable yet: retry next tick
                return
            self._blit()
        elif self.ticks % 16 == 0 and self.position is None:
            # Follow a moved/resized taskbar, but never fight a user's drag.
            if self._place(*self.image.size):
                self._blit()

    def _blit(self) -> None:
        assert self.image is not None
        width, height = self.image.size
        screen_dc = user32.GetDC(None)
        mem_dc = gdi32.CreateCompatibleDC(screen_dc)
        try:
            info = BITMAPINFO()
            info.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
            info.bmiHeader.biWidth = width
            info.bmiHeader.biHeight = -height  # top-down
            info.bmiHeader.biPlanes = 1
            info.bmiHeader.biBitCount = 32
            info.bmiHeader.biCompression = 0
            bits = ctypes.c_void_p()
            bitmap = gdi32.CreateDIBSection(
                mem_dc, ctypes.byref(info), DIB_RGB_COLORS, ctypes.byref(bits), None, 0,
            )
            if not bitmap:
                return
            data = premultiply_bgra(self.image)
            ctypes.memmove(bits, data, len(data))
            previous = gdi32.SelectObject(mem_dc, bitmap)

            size = w.SIZE(width, height)
            source = w.POINT(0, 0)
            blend = BLENDFUNCTION(AC_SRC_OVER, 0, 255, AC_SRC_ALPHA)
            # pptDst must be NULL: a POINT here would also *move* the window, and
            # every repaint would snap the pill back to the desktop origin.
            user32.UpdateLayeredWindow(
                self.hwnd, screen_dc, None, ctypes.byref(size),
                mem_dc, ctypes.byref(source), 0, ctypes.byref(blend), ULW_ALPHA,
            )
            gdi32.SelectObject(mem_dc, previous)
            gdi32.DeleteObject(bitmap)
        finally:
            gdi32.DeleteDC(mem_dc)
            user32.ReleaseDC(None, screen_dc)

    # -------------------------------------------------------------------- run
    def run(self) -> None:
        message = w.MSG()
        while user32.GetMessageW(ctypes.byref(message), None, 0, 0) > 0:
            user32.TranslateMessage(ctypes.byref(message))
            user32.DispatchMessageW(ctypes.byref(message))


def main() -> int:
    parser = argparse.ArgumentParser(description="Stock Watch taskbar ticker")
    parser.add_argument("--base", required=True, help="plugin host origin, e.g. http://127.0.0.1:3080")
    parser.add_argument("--interval", type=float, default=3.0)
    args = parser.parse_args()

    try:
        user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
    except Exception:
        pass

    # A second instance would draw a second pill in the same spot. A restart can
    # overlap the previous instance's teardown by a few frames, so retry briefly.
    for _ in range(20):
        kernel32.CreateMutexW(None, False, "Local\\dsh-dingpan-ticker")
        if ctypes.get_last_error() != 183:  # ERROR_ALREADY_EXISTS
            break
        time.sleep(0.1)
    else:
        return 0

    feed = Feed(args.base, args.interval)
    threading.Thread(target=feed.run, daemon=True).start()

    pill = Pill(feed)
    pill.run()
    feed.stop = True
    return 0


if __name__ == "__main__":
    sys.exit(main())
