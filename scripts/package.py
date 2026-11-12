"""Produce install and source ZIPs, excluding any obsolete local config.js."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
extension = root / "extension"
version = json.loads((extension / "manifest.json").read_text())["version"]
destination = root.parent
ignored = {".git", "node_modules", "__pycache__", ".DS_Store"}


def included(file):
    relative = file.relative_to(root)
    return (file.is_file()
            and not ignored.intersection(relative.parts)
            and not any(part == ".env" or part.startswith(".env.") for part in relative.parts)
            and relative != Path("extension/config.js"))


with zipfile.ZipFile(destination / f"jatoGifs-{version}.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(extension.rglob("*")):
        if included(file):
            archive.write(file, file.relative_to(extension))
with zipfile.ZipFile(destination / f"jatoGifs-{version}-codigo.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob("*")):
        if included(file):
            archive.write(file, Path("jatoGifs") / file.relative_to(root))
print(f"Created jatoGifs-{version}.zip and jatoGifs-{version}-codigo.zip")
