"""
Downloads the HYG v4.1 star catalog and generates backend/data/stars.csv
(stars mag ≤ 6.5) and backend/data/messier.csv.

Run once from alpaca-control-panel/backend/:
    uv run python fetch_catalog.py
"""
import csv
import io
import urllib.request
from pathlib import Path

HYG_URL = (
    "https://raw.githubusercontent.com/astronexus/HYG-Database"
    "/main/hyg/CURRENT/hygdata_v41.csv"
)
MAG_LIMIT = 6.5
KEEP_COLS = ("hip", "proper", "bf", "ra", "dec", "mag", "con")

DATA_DIR = Path(__file__).parent / "data"

# Messier objects — written directly so messier.csv is always up to date.
_MESSIER = [
    ("M1  Crab Nebula",            5.5756,   22.0145,  8.4,  "SNR"),
    ("M2",                        21.5578,   -0.8233,  6.5,  "GC"),
    ("M3",                        13.7033,   28.3775,  6.2,  "GC"),
    ("M4",                        16.3933,  -26.5256,  5.9,  "GC"),
    ("M5",                        15.3097,    2.0817,  5.8,  "GC"),
    ("M6  Butterfly Cluster",     17.6681,  -32.2128,  4.2,  "OC"),
    ("M7  Ptolemy Cluster",       17.8978,  -34.8167,  3.3,  "OC"),
    ("M8  Lagoon Nebula",         18.0628,  -24.3831,  5.8,  "Neb"),
    ("M11 Wild Duck Cluster",     18.8511,   -6.2714,  5.8,  "OC"),
    ("M13 Hercules Cluster",      16.6947,   36.4611,  5.8,  "GC"),
    ("M15",                       21.4997,   12.1669,  6.3,  "GC"),
    ("M16 Eagle Nebula",          18.3133,  -13.7878,  6.0,  "Neb+OC"),
    ("M17 Omega Nebula",          18.3461,  -16.1753,  6.0,  "Neb"),
    ("M20 Trifid Nebula",         18.0428,  -22.9717,  8.5,  "Neb"),
    ("M22",                       18.6056,  -23.9047,  5.1,  "GC"),
    ("M24 Sagittarius Star Cloud",18.2817,  -18.5542,  4.6,  "SC"),
    ("M27 Dumbbell Nebula",       19.9944,   22.7211,  7.4,  "PN"),
    ("M31 Andromeda Galaxy",       0.7122,   41.2689,  3.4,  "Gal"),
    ("M32",                        0.7108,   40.8656,  8.7,  "Gal"),
    ("M33 Triangulum Galaxy",      1.5644,   30.6603,  5.7,  "Gal"),
    ("M35",                        6.1483,   24.3333,  5.3,  "OC"),
    ("M36",                        5.6036,   34.1350,  6.0,  "OC"),
    ("M37",                        5.8728,   32.5503,  5.6,  "OC"),
    ("M38",                        5.4781,   35.8497,  6.4,  "OC"),
    ("M41",                        6.7781,  -20.7267,  4.5,  "OC"),
    ("M42 Orion Nebula",           5.5883,   -5.3911,  4.0,  "Neb"),
    ("M44 Beehive Cluster",        8.6728,   19.9833,  3.1,  "OC"),
    ("M45 Pleiades",               3.7908,   24.1050,  1.6,  "OC"),
    ("M47",                        7.6094,  -14.4892,  4.4,  "OC"),
    ("M51 Whirlpool Galaxy",      13.4978,   47.1950,  8.4,  "Gal"),
    ("M57 Ring Nebula",           18.8933,   33.0289,  8.8,  "PN"),
    ("M64 Black Eye Galaxy",      12.9456,   21.6822,  8.5,  "Gal"),
    ("M78",                        5.7778,    0.0806,  8.3,  "Neb"),
    ("M81 Bode's Galaxy",          9.9256,   69.0653,  6.9,  "Gal"),
    ("M82 Cigar Galaxy",           9.9281,   69.6797,  8.4,  "Gal"),
    ("M83 Southern Pinwheel",     13.6169,  -29.8658,  7.6,  "Gal"),
    ("M92",                       17.2853,   43.1358,  6.4,  "GC"),
    ("M97 Owl Nebula",            11.2478,   55.0189,  9.9,  "PN"),
    ("M101 Pinwheel Galaxy",      14.0539,   54.3492,  7.9,  "Gal"),
    ("M104 Sombrero Galaxy",      12.6661,  -11.6231,  8.0,  "Gal"),
]


def fetch_stars():
    print(f"Downloading HYG v4.1 from:\n  {HYG_URL}")
    with urllib.request.urlopen(HYG_URL, timeout=30) as resp:
        raw = resp.read().decode("utf-8")

    rows = []
    for row in csv.DictReader(io.StringIO(raw)):
        # Row 0 of HYG is the Sun — not a fixed star; exclude it.
        if row.get("proper", "").strip() == "Sol":
            continue
        try:
            if float(row["mag"]) > MAG_LIMIT:
                continue
        except (ValueError, KeyError):
            continue
        rows.append({k: row.get(k, "") for k in KEEP_COLS})

    out = DATA_DIR / "stars.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=KEEP_COLS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows):,} stars (mag ≤ {MAG_LIMIT}) → {out}")


def write_messier():
    out = DATA_DIR / "messier.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "ra", "dec", "magnitude", "type"])
        for name, ra, dec, mag, typ in _MESSIER:
            writer.writerow([name, ra, dec, mag, typ])
    print(f"Wrote {len(_MESSIER)} Messier objects → {out}")


if __name__ == "__main__":
    DATA_DIR.mkdir(exist_ok=True)
    fetch_stars()
    write_messier()
    print("Done. Restart the backend to pick up the new catalog.")
