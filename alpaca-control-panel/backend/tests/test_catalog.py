"""Catalog loading, star naming and constellation-line resolution."""
import csv

import pytest

import catalog

HYG_HEADER = ["hip", "proper", "bf", "ra", "dec", "mag", "con"]


def write_stars(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(HYG_HEADER)
        w.writerows(rows)


# ── Bayer / Flamsteed formatting ───────────────────────────────────────────

@pytest.mark.parametrize(
    "bf, expected",
    [
        ("58Alp Ori", "α Ori"),       # Flamsteed + Bayer → prefer Bayer
        ("Alp1Cru", "α¹ Cru"),        # Bayer with index
        ("Mu 1Sco", "μ¹ Sco"),        # two-letter Greek abbreviation
        ("The Sco", "θ Sco"),
        ("19    Ori", "19 Ori"),      # Flamsteed only, padded
        ("112Bet Tau", "β Tau"),
        ("weird  value", "weird value"),  # unparseable → whitespace-normalised
    ],
)
def test_format_bf(bf, expected):
    assert catalog._format_bf(bf) == expected


@pytest.mark.parametrize(
    "row, expected",
    [
        ({"proper": "Rigel", "bf": "19Bet Ori", "hip": "24436"}, "Rigel"),
        ({"proper": "", "bf": "Alp1Cru", "hip": "60718"}, "α¹ Cru"),
        ({"proper": "", "bf": "", "hip": "25"}, "HIP 25"),
        ({"proper": "", "bf": "", "hip": ""}, None),
    ],
)
def test_star_name_precedence(row, expected):
    assert catalog._star_name(row) == expected


# ── CSV loading (using a temporary data dir) ───────────────────────────────

def test_load_stars_csv(tmp_path, monkeypatch):
    write_stars(tmp_path / "stars.csv", [
        ["", "Sol", "", "0.0", "0.0", "-26.7", ""],           # the Sun → excluded
        ["24436", "Rigel", "19Bet Ori", "5.242", "-8.2", "0.18", "Ori"],
        ["60718", "", "Alp1Cru", "12.443", "-63.1", "0.77", "Cru"],
        ["25", "", "", "0.0053", "-44.29", "6.28", "Phe"],    # HIP-only name
        ["", "", "", "1.0", "1.0", "6.0", ""],                # no name at all → skipped
        ["99", "Broken", "", "not-a-number", "0", "1", ""],   # bad RA → skipped
    ])
    monkeypatch.setattr(catalog, "DATA_DIR", tmp_path)

    stars, hip_idx = catalog._load_stars_csv()

    assert [s[0] for s in stars] == ["Rigel", "α¹ Cru", "HIP 25"]
    assert stars[0] == ("Rigel", 5.242, -8.2, 0.18)
    assert hip_idx == {24436: 0, 60718: 1, 25: 2}


def test_load_stars_csv_missing_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(catalog, "DATA_DIR", tmp_path)
    assert catalog._load_stars_csv() == (None, {})


def test_load_messier_csv(tmp_path, monkeypatch):
    (tmp_path / "messier.csv").write_text(
        "name,ra,dec,magnitude,type\n"
        "M42 Orion Nebula,5.5883,-5.3911,4.0,Neb\n"
        "Mbad,x,0,1,?\n"
    )
    monkeypatch.setattr(catalog, "DATA_DIR", tmp_path)
    assert catalog._load_messier_csv() == [("M42 Orion Nebula", 5.5883, -5.3911, 4.0, "Neb")]


def test_resolve_lines_drops_missing_stars(monkeypatch):
    monkeypatch.setattr(catalog, "_HIP_LINES", [(1, 2), (2, 3), (3, 99)])
    assert catalog._resolve_lines({1: 0, 2: 1, 3: 2}) == [(0, 1), (1, 2)]


# ── Static data sanity ─────────────────────────────────────────────────────

def test_hip_lines_have_no_duplicates_or_self_loops():
    seen = set()
    for a, b in catalog._HIP_LINES:
        assert a != b
        key = frozenset((a, b))
        assert key not in seen, f"duplicate segment {a}-{b}"
        seen.add(key)


def test_fallback_lines_reference_valid_stars():
    n = len(catalog._STARS_FALLBACK)
    assert catalog._LINES_FALLBACK
    for i, j in catalog._LINES_FALLBACK:
        assert 0 <= i < n and 0 <= j < n


def test_exported_catalog_excludes_sun():
    assert all(s[0] != "Sol" for s in catalog.STARS)
    assert all(s[3] > -2 for s in catalog.STARS)  # nothing brighter than Sirius


def test_exported_coordinates_in_range():
    for name, ra, dec, mag, *_ in catalog.STARS + catalog.MESSIER:
        assert 0 <= ra < 24, name
        assert -90 <= dec <= 90, name


# ── Real HYG data (only when backend/data/stars.csv has been generated) ────

REAL_STARS = catalog.DATA_DIR / "stars.csv"

# Constellation segments, by star name, that must resolve from the real data.
EXPECTED_SEGMENTS = {
    ("Rigel", "Betelgeuse"),
    ("Megrez", "Dubhe"),          # closes the Big Dipper bowl
    ("Mimosa", "Imai"),           # δ Cru (HIP 59747), not ε Cru
    ("Algieba", "Zosma"),         # HIP 54872, not Chertan
    ("Zosma", "Denebola"),
    ("Acrux", "Gacrux"),
    ("Capella", "Menkalinan"),
}


@pytest.mark.skipif(not REAL_STARS.exists(), reason="run fetch_catalog.py to generate stars.csv")
def test_real_constellation_lines_resolve_to_expected_stars():
    stars, hip_idx = catalog._load_stars_csv()
    lines = catalog._resolve_lines(hip_idx)
    assert len(lines) == len(catalog._HIP_LINES), "some HIP ids are missing from stars.csv"
    named = {(stars[i][0], stars[j][0]) for i, j in lines}
    missing = EXPECTED_SEGMENTS - named
    assert not missing, f"missing segments: {missing}"
    assert not any("Chertan" in pair for pair in named)
    assert not any("Ginan" in pair for pair in named)
