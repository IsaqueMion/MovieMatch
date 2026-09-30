"""Generate tiny, embedded poster previews. Run with Python 3 + Pillow after refreshing the catalogue."""
import base64
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

catalogue_path = Path(__file__).resolve().parents[1] / "src/data/landingMovies.json"
catalogue = json.loads(catalogue_path.read_text(encoding="utf-8"))


def preview(movie):
    # Download only a small public TMDB thumbnail; no credentials or database access.
    with urlopen(movie["poster"].replace("/w500/", "/w92/"), timeout=20) as response:
        image = Image.open(BytesIO(response.read())).convert("RGB")
    image = image.resize((24, 36), Image.Resampling.LANCZOS)
    output = BytesIO()
    image.save(output, format="JPEG", quality=45, optimize=True)
    return {**movie, "preview": "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")}


# Finish all downloads before replacing the snapshot, so failures keep it intact.
with ThreadPoolExecutor(max_workers=4) as executor:
    catalogue["movies"] = list(executor.map(preview, catalogue["movies"]))
catalogue_path.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Generated {len(catalogue['movies'])} embedded 24x36 previews.")
