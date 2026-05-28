# fmt: off
import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Constellation lines — defined as Hipparcos ID pairs so they stay correct
# regardless of star list order.  Resolved to list indices at load time.
# ---------------------------------------------------------------------------
_HIP_LINES = [
    # Orion
    (24436, 27989),  # Rigel – Betelgeuse
    (27989, 25336),  # Betelgeuse – Bellatrix
    (25336, 25930),  # Bellatrix – Mintaka
    (25930, 26311),  # Mintaka – Alnilam
    (26311, 26727),  # Alnilam – Alnitak
    (24436, 27366),  # Rigel – Saiph
    (27366, 26727),  # Saiph – Alnitak
    # Ursa Major (Big Dipper)
    (54061, 53910),  # Dubhe – Merak
    (53910, 58001),  # Merak – Phecda
    (58001, 59774),  # Phecda – Megrez
    (59774, 62956),  # Megrez – Alioth
    (62956, 65378),  # Alioth – Mizar
    (65378, 67301),  # Mizar – Alkaid
    (54061, 58001),  # Dubhe – Phecda (bowl top)
    # Canis Major
    (32349, 30324),  # Sirius – Mirzam
    (32349, 34444),  # Sirius – Wezen
    (34444, 33579),  # Wezen – Adhara
    # Taurus
    (21421, 25428),  # Aldebaran – Elnath
    # Scorpius
    (80763, 85927),  # Antares – Shaula
    (80763, 86228),  # Antares – Sargas
    # Crux (Southern Cross)
    (60718, 61084),  # Acrux – Gacrux
    (62434, 60260),  # Mimosa – Delta Cru
    # Centaurus
    (71683, 68702),  # Alpha Cen – Hadar
    # Leo
    (49669, 50583),  # Regulus – Algieba
    (50583, 54879),  # Algieba – Zosma
    (54879, 57632),  # Zosma – Denebola
    # Perseus
    (15863, 14576),  # Mirfak – Algol
    # Auriga
    (24608, 28360),  # Capella – Menkalinan
]


def _load_stars_csv():
    """Load stars from data/stars.csv. Returns (stars, hip_to_idx) or (None, {})."""
    path = DATA_DIR / "stars.csv"
    if not path.exists():
        return None, {}
    stars, hip_idx = [], {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row.get("proper", "").strip() or row.get("bf", "").strip()
            if not name:
                continue
            try:
                hip = int(row["hip"]) if row.get("hip", "").strip() else None
                entry = (name, float(row["ra"]), float(row["dec"]), float(row["mag"]))
            except (ValueError, KeyError):
                continue
            idx = len(stars)
            stars.append(entry)
            if hip:
                hip_idx[hip] = idx
    return stars, hip_idx


def _load_messier_csv():
    """Load Messier objects from data/messier.csv. Returns list or None."""
    path = DATA_DIR / "messier.csv"
    if not path.exists():
        return None
    objects = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                objects.append((
                    row["name"],
                    float(row["ra"]),
                    float(row["dec"]),
                    float(row["magnitude"]),
                    row.get("type", ""),
                ))
            except (ValueError, KeyError):
                continue
    return objects or None


def _resolve_lines(hip_idx):
    return [
        (hip_idx[a], hip_idx[b])
        for a, b in _HIP_LINES
        if a in hip_idx and b in hip_idx
    ]


# ---------------------------------------------------------------------------
# Hardcoded fallback — used when data/ CSVs have not been downloaded yet.
# Run `uv run python backend/fetch_catalog.py` to populate data/.
# ---------------------------------------------------------------------------

_STARS_FALLBACK = [
    # name,               RA (h),     Dec (°),   mag
    ("Sirius",            6.7525,    -16.7161,  -1.46),
    ("Canopus",           6.3992,    -52.6957,  -0.72),
    ("Arcturus",         14.2610,     19.1822,  -0.05),
    ("Rigel Kentaurus",  14.6600,    -60.8339,  -0.01),
    ("Vega",             18.6157,     38.7836,   0.03),
    ("Capella",           5.2781,     45.9981,   0.08),
    ("Rigel",             5.2423,     -8.2017,   0.13),
    ("Procyon",           7.6550,      5.2250,   0.38),
    ("Achernar",          1.6286,    -57.2367,   0.46),
    ("Betelgeuse",        5.9194,      7.4069,   0.50),
    ("Hadar",            14.0637,    -60.3730,   0.61),
    ("Altair",           19.8464,      8.8683,   0.76),
    ("Aldebaran",         4.5987,     16.5092,   0.87),
    ("Acrux",            12.4433,    -63.0991,   0.76),
    ("Antares",          16.4901,    -26.4320,   1.09),
    ("Spica",            13.4199,    -11.1613,   1.04),
    ("Pollux",            7.7553,     28.0262,   1.16),
    ("Fomalhaut",        22.9608,    -29.6223,   1.16),
    ("Deneb",            20.6905,     45.2803,   1.25),
    ("Mimosa",           12.7953,    -59.6888,   1.25),
    ("Regulus",          10.1395,     11.9672,   1.36),
    ("Adhara",            6.9771,    -28.9722,   1.50),
    ("Castor",            7.5767,     31.8883,   1.57),
    ("Gacrux",           12.5194,    -57.1133,   1.63),
    ("Shaula",           17.5601,    -37.1038,   1.63),
    ("Bellatrix",         5.4188,      6.3497,   1.64),
    ("Elnath",            5.4381,     28.6075,   1.65),
    ("Miaplacidus",       9.2200,    -69.7172,   1.67),
    ("Alnilam",           5.6036,     -1.2019,   1.69),
    ("Gamma Velorum",     8.1589,    -47.3367,   1.78),
    ("Alnair",           22.1373,    -46.9608,   1.73),
    ("Alnitak",           5.6795,     -1.9426,   1.77),
    ("Alioth",           12.9004,     55.9598,   1.76),
    ("Dubhe",            11.0621,     61.7511,   1.79),
    ("Mirfak",            3.4054,     49.8612,   1.79),
    ("Wezen",             7.1397,    -26.3932,   1.83),
    ("Sargas",           17.6217,    -42.9978,   1.86),
    ("Kaus Australis",   18.4028,    -34.3847,   1.85),
    ("Avior",             8.3753,    -59.5097,   1.86),
    ("Alkaid",           13.7923,     49.3133,   1.85),
    ("Menkalinan",        5.9921,     44.9474,   1.90),
    ("Atria",            16.8114,    -69.0278,   1.91),
    ("Alhena",            6.6285,     16.3993,   1.93),
    ("Peacock",          20.4275,    -56.7350,   1.94),
    ("Mirzam",            6.3783,    -17.9559,   1.98),
    ("Alphard",           9.4598,     -8.6586,   1.99),
    ("Polaris",           2.5302,     89.2641,   2.02),
    ("Hamal",             2.1197,     23.4625,   2.01),
    ("Algieba",          10.3328,     19.8417,   2.01),
    ("Diphda",            0.7264,    -17.9866,   2.04),
]

_MESSIER_FALLBACK = [
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

# Fallback constellation lines resolved by star name (fixes index bugs in old version).
_name_idx = {s[0]: i for i, s in enumerate(_STARS_FALLBACK)}
_LINES_FALLBACK = [
    (_name_idx[a], _name_idx[b])
    for a, b in [
        ("Rigel",          "Betelgeuse"),
        ("Betelgeuse",     "Alnilam"),
        ("Alnilam",        "Alnitak"),
        ("Alnilam",        "Bellatrix"),
        ("Bellatrix",      "Betelgeuse"),
        ("Rigel",          "Alnitak"),
        ("Alioth",         "Alkaid"),
        ("Dubhe",          "Alioth"),
        ("Sirius",         "Adhara"),
        ("Sirius",         "Wezen"),
        ("Aldebaran",      "Elnath"),
        ("Antares",        "Shaula"),
        ("Antares",        "Sargas"),
        ("Acrux",          "Mimosa"),
        ("Acrux",          "Gacrux"),
        ("Rigel Kentaurus","Hadar"),
        ("Regulus",        "Algieba"),
        ("Capella",        "Menkalinan"),
    ]
    if a in _name_idx and b in _name_idx
]

# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------
_csv_stars, _hip_idx = _load_stars_csv()
_csv_messier = _load_messier_csv()

STARS               = _csv_stars   if _csv_stars   is not None else _STARS_FALLBACK
MESSIER             = _csv_messier if _csv_messier is not None else _MESSIER_FALLBACK
CONSTELLATION_LINES = _resolve_lines(_hip_idx) if _csv_stars is not None else _LINES_FALLBACK

_source = "data/stars.csv" if _csv_stars is not None else "hardcoded fallback"
print(f"[catalog] {len(STARS):,} stars, {len(MESSIER)} DSOs, "
      f"{len(CONSTELLATION_LINES)} constellation segments  ({_source})")
