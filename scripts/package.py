"""Produce install and source ZIPs without the local GIPHY key."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "extension/manifest.json").read_text())
version = manifest["version"]
destination = root.parent
local_config = root / "extension/config.js"
empty_config = b"// Set your GIPHY key in the extension options.\nself.JATO_CONFIG = Object.freeze({ apiKey: '' });\n"

def add_file(archive, file, name):
    if file == local_config:
        archive.writestr(str(name), empty_config)
    else:
        archive.write(file, name)

with zipfile.ZipFile(destination / f"jatoGifs-{version}.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root / "extension").rglob("*")):
        if file.is_file() and file.name != ".DS_Store":
            add_file(archive, file, file.relative_to(root / "extension"))
with zipfile.ZipFile(destination / f"jatoGifs-{version}-codigo.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob("*")):
        relative = file.relative_to(root)
        if file.is_file() and not any(p in {".git", "node_modules", "__pycache__", ".DS_Store"} for p in relative.parts):
            add_file(archive, file, Path("jatoGifs") / relative)
print(f"Created jatoGifs-{version}.zip and jatoGifs-{version}-codigo.zip")
