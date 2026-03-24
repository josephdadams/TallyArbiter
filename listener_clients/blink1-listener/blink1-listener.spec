# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for Tally Arbiter Blink(1) Listener
# Usage: pyinstaller blink1-listener.spec

import sys

block_cipher = None

a = Analysis(
    ["blink1-listener.py"],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        "blink1",
        "blink1.blink1",
        "PIL",
        "PIL.Image",
        "PIL.ImageDraw",
        "zeroconf",
        "zeroconf._utils",
        "zeroconf._utils.ipaddress",
        "zeroconf._utils.name",
        "socketio",
        "engineio",
        "engineio.async_drivers",
        # Linux: gi.repository bindings used directly (no pystray on Linux)
        *(["gi", "gi.repository.GLib", "gi.repository.Gtk",
           "gi.repository.AyatanaAppIndicator3"] if sys.platform == "linux" else []),
        # macOS: pystray for the Cocoa menu-bar icon
        *(["pystray", "pystray._base", "pystray._darwin"] if sys.platform == "darwin" else []),
        # Windows: pystray for the notification area icon
        *(["pystray", "pystray._base", "pystray._win32"] if sys.platform == "win32" else []),
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=(
        # Restore system GI typelib paths that PyInstaller's gi hook may hide
        ["rthook_gi_typelib.py"] if sys.platform == "linux" else []
    ),
    excludes=[
        # Exclude GObject/GTK stack on non-Linux – not installed there
        *(["gi", "gi.repository", "gi.repository.GLib", "gi.repository.Gtk",
           "gi.repository.GObject", "gi.repository.AyatanaAppIndicator3",
           "gi.repository.AppIndicator3"] if sys.platform != "linux" else []),
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# macOS uses onedir mode (required for .app bundles); Linux uses onefile.
_exclude_binaries = sys.platform == "darwin"

exe = EXE(
    pyz,
    a.scripts,
    [] if _exclude_binaries else a.binaries,
    [] if _exclude_binaries else a.zipfiles,
    [] if _exclude_binaries else a.datas,
    [] if _exclude_binaries else [],
    exclude_binaries=_exclude_binaries,
    name="blink1-listener",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    # No console window on macOS or Windows (tray-only app); keep console on Linux for logging
    console=sys.platform == "linux",
    disable_windowed_traceback=False,
    # macOS: emulate argv[0] so the app bundle works correctly
    argv_emulation=sys.platform == "darwin",
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# macOS: collect all files into a directory, then wrap in a .app bundle
if sys.platform == "darwin":
    coll = COLLECT(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=True,
        upx_exclude=[],
        name="blink1-listener",
    )
    app = BUNDLE(
        coll,
        name="Tally Arbiter Blink(1) Listener.app",
        icon=None,
        bundle_identifier="com.tallyarbiter.blink1listener",
        info_plist={
            # LSUIElement=1: run as menu-bar agent (no Dock icon)
            "LSUIElement": True,
            "NSHighResolutionCapable": True,
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleName": "Tally Arbiter Blink(1) Listener",
        },
    )

# Windows: onefile mode produces dist/blink1-listener.exe
