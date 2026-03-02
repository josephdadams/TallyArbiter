# PyInstaller runtime hook: preserve system GI typelib directories.
#
# PyInstaller's built-in gi hook sets GI_TYPELIB_PATH to the frozen bundle's
# (often empty) gi_typelibs directory, which hides the system typelibs that
# AppIndicator3, Gtk, GLib, etc. need.  We append the common system paths so
# that GI can still find them at runtime.
import os
import sys

if getattr(sys, "frozen", False):
    _candidates = [
        "/usr/lib/x86_64-linux-gnu/girepository-1.0",  # Debian/Ubuntu amd64
        "/usr/lib/aarch64-linux-gnu/girepository-1.0", # Debian/Ubuntu arm64
        "/usr/lib64/girepository-1.0",                 # Fedora/RHEL
        "/usr/lib/girepository-1.0",                   # fallback
    ]
    _current = os.environ.get("GI_TYPELIB_PATH", "")
    _paths = [p for p in _current.split(":") if p]
    for _c in _candidates:
        if os.path.isdir(_c) and _c not in _paths:
            _paths.append(_c)
    if _paths:
        os.environ["GI_TYPELIB_PATH"] = ":".join(_paths)
