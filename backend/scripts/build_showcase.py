"""
Sélection de la vitrine de la page d'accueil (les 3 cartes flottantes à côté du slogan).

Pour chaque catégorie mise en avant, on garde les produits :
  1. dont la photo locale est de bonne qualité (voir photo_score) ;
  2. parmi eux, les plus appréciés des clients (nombre d'avis de la source, = `popularity` en base).

Sorties :
  - data/showcase.json         { "<categorySlug>": ["SKU", ...] }  — vitrine (catégories mises en avant)
    L'API (GET /products/showcase) en tire 3 au hasard, dans 3 catégories différentes, parmi ceux en stock.
  - data/category_covers.json  { "<categorySlug>": ["SKU", ...] }  — photo des tuiles de catégories de
    l'accueil (toutes les catégories) : les plus belles photos parmi les 40 produits les plus appréciés ;
    l'API (GET /categories/covers) garde le premier encore en vente.

Usage (depuis backend/) :  python -I scripts/build_showcase.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT.parent / "frontend" / "public"
CATALOGUES = [ROOT / "data" / "catalogue_local_images_cleaned.json", ROOT / "data" / "accessories_catalogue.json"]
OUTPUT = ROOT / "data" / "showcase.json"
COVERS = ROOT / "data" / "category_covers.json"
COVER_POOL = 40  # produits les plus appréciés examinés par catégorie
COVER_KEEP = 5  # candidats gardés (si le premier n'est plus en vente)

# Photo choisie à la main pour chaque tuile de catégorie : le produit le plus « flashy »
# (RGB, blanc, modèles haut de gamme). Les candidats automatiques suivent en secours.
COVER_PICKS = {
    "alimentations": "PCP-440052",  # Cooler Master XG850 Plus (écran RGB)
    "boitiers": "PCP-258894",  # Corsair iCUE 465X RGB (blanc, ventilateurs RGB)
    "cartes-graphiques": "PCP-564076",  # MSI GeForce RTX 5090 GAMING TRIO OC (3 ventilateurs)
    "cartes-meres": "PCP-550486",  # Gigabyte X870E AORUS XTREME AI TOP
    "casques": "ACC-HDS-7376190A",  # Razer Opus X (vert Razer)
    "claviers": "ACC-KBD-4847A2C4",  # SteelSeries Apex Pro (RGB)
    "ecrans": "ACC-MON-BDBE775D",  # Sceptre C248W incurvé
    "enceintes": "ACC-SPK-1F99E90C",  # Razer Nommo Chroma (RGB)
    "memoire-ram": "PCP-508101",  # Kingston FURY Beast RGB
    "processeurs": "PCP-459576",  # AMD Ryzen 9 7950X3D
    "refroidissement": "PCP-305852",  # Asus ROG STRIX LC 360 RGB White Edition (watercooling blanc RGB)
    "souris": "ACC-MOU-9525A7DB",  # Logitech G502 Proteus Spectrum (RGB)
    "stockage": "PCP-495615",  # Crucial T500 avec dissipateur
    "webcams": "ACC-CAM-CF9F6A2E",  # Razer Kiyo (anneau lumineux)
}

# Catégories de la vitrine (pas de webcams, d'enceintes, d'alimentations ni de stockage)
CATEGORIES = [
    "cartes-graphiques",
    "ecrans",
    "claviers",
    "processeurs",
    "memoire-ram",
    "souris",
    "casques",
    "boitiers",
    "cartes-meres",
    "refroidissement",
]
PER_CATEGORY = 15
MIN_SCORE = 0.6

def photo_score(path: Path, monitor: bool = False) -> float:
    """
    Note de 0 à 1 d'une photo produit :
      - résolution suffisante (le plus petit côté) ;
      - cadrage proche du carré (pas de bandeau très large ou très haut) ;
      - fond blanc propre sur les bords (photo « packshot », pas une mise en scène) ;
      - sujet bien cadré : ni minuscule au milieu du blanc, ni coupé par les bords ;
      - image riche (contraste suffisant, pas une silhouette plate).
    Écrans : la dalle touche souvent le haut de la photo, on ne regarde donc que les coins
    du bas (autour du pied) et on exige un fond d'écran coloré (pas d'écran noir éteint).
    """
    try:
        with Image.open(path) as im:
            im = im.convert("RGB")
    except OSError:
        return 0.0

    w, h = im.size
    short = min(w, h)
    if short < 200:
        return 0.0
    ratio = w / h
    if not 0.6 <= ratio <= 1.75:
        return 0.0

    gray = im.convert("L")
    small = gray.resize((96, round(96 * h / w)) if w >= h else (round(96 * w / h), 96))
    sw, sh = small.size
    px = small.load()

    # Fond : les quatre coins (12 % de chaque côté) doivent être quasi blancs.
    # (On regarde les coins et non les bords entiers : un écran occupe souvent toute la largeur.)
    cw, ch = max(2, round(sw * 0.12)), max(2, round(sh * 0.12))
    corners = [
        px[x, y]
        for x0, y0 in (((0, sh - ch), (sw - cw, sh - ch)) if monitor else ((0, 0), (sw - cw, 0), (0, sh - ch), (sw - cw, sh - ch)))
        for x in range(x0, x0 + cw)
        for y in range(y0, y0 + ch)
    ]
    white_corners = sum(v >= 236 for v in corners) / len(corners)
    if white_corners < 0.85:
        return 0.0

    # Place du sujet : part des pixels non blancs (ni minuscule, ni photo pleine page)
    coverage = sum(px[x, y] < 236 for y in range(sh) for x in range(sw)) / (sw * sh)
    if not 0.18 <= coverage <= (0.95 if monitor else 0.88):
        return 0.0

    # Couleurs vives (saturation moyenne des pixels non blancs), indispensable pour un écran
    hsv = im.resize((sw, sh)).convert("HSV").load()
    sat = [hsv[x, y][1] for y in range(sh) for x in range(sw) if px[x, y] < 236]
    colorful = sum(sat) / len(sat) / 255
    if monitor and colorful < 0.3:
        return 0.0

    contrast = ImageStat.Stat(gray).stddev[0]  # 0 → 128

    resolution = min(1.0, (short - 200) / 200)  # 200 px → 0, 400 px et plus → 1
    framing = 1 - abs(coverage - 0.5) / 0.4
    richness = min(1.0, contrast / 70)
    if monitor:
        richness = min(1.0, colorful / 0.55)
    return round(0.25 * resolution + 0.3 * white_corners + 0.25 * max(0.0, framing) + 0.2 * richness, 4)

def main() -> int:
    candidates: dict[str, list[tuple[int, float, str]]] = {}
    for catalogue in CATALOGUES:
        products = json.loads(catalogue.read_text(encoding="utf-8"))["products"]
        for p in products:
            category = p.get("categorySlug")
            if not category or not p.get("isActive", True) or not p.get("images"):
                continue
            image = next((i for i in p["images"] if i.get("isPrimary")), p["images"][0])
            score = photo_score(PUBLIC / image["url"].lstrip("/"), monitor=category == "ecrans")
            if score < MIN_SCORE:
                continue
            popularity = int((p.get("source") or {}).get("ratingCount") or 0)
            candidates.setdefault(category, []).append((popularity, score, p["sku"]))

    showcase: dict[str, list[str]] = {}
    covers: dict[str, list[str]] = {}
    for category, rows in candidates.items():
        # Tuile de catégorie : la plus belle photo parmi les plus appréciés
        popular = sorted(rows, key=lambda r: r[0], reverse=True)[:COVER_POOL]
        auto = [sku for _, _, sku in sorted(popular, key=lambda r: r[1], reverse=True)[:COVER_KEEP]]
        pick = COVER_PICKS.get(category)
        covers[category] = ([pick] if pick else []) + [sku for sku in auto if sku != pick]
        if category not in CATEGORIES:
            continue
        # Les plus appréciés d'abord ; à égalité, la plus belle photo
        rows.sort(key=lambda r: (r[0], r[1]), reverse=True)
        showcase[category] = [sku for _, _, sku in rows[:PER_CATEGORY]]
        print(f"{category:20} {len(rows):4} photos retenues -> {len(showcase[category])} en vitrine")

    OUTPUT.write_text(json.dumps(showcase, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    COVERS.write_text(json.dumps(covers, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"-> {OUTPUT.relative_to(ROOT)}, {COVERS.relative_to(ROOT)} ({len(covers)} catégories)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
