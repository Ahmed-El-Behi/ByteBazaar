"""
Normalise les noms du catalogue ByteBazaar (data/catalogue_local_images_cleaned.json).

Les noms importés de PCPartPicker ne contiennent souvent que la série du fabricant
("Gigabyte GAMING OC", "Crucial MX500"...). Ce script reconstruit des noms au format
des sites professionnels (LDLC, Materiel.net, Newegg) à partir des caractéristiques :

  GPU      : Marque + Puce + Série + Mémoire          -> "MSI GeForce RTX 5060 VENTUS 2X 8 GB"
  SSD      : Marque + Modèle + Capacité + Format       -> "Lexar NM620 1 TB M.2 NVMe PCIe 3.0"
  Alim.    : Marque + Modèle + Puissance + Certif.     -> "Corsair RM750x SHIFT 750W 80+ Gold"
  RAM      : Marque + Gamme + Kit + Fréquence + CAS    -> "Corsair Vengeance 32 GB (2 x 16 GB) DDR5-6000 CL30"
  Watercooling : + "AIO" + taille du radiateur        -> "NZXT Kraken 240 RGB AIO 240 mm"

Les doublons restants sont départagés par la couleur. Le nom d'origine est conservé dans
source.originalName : le script est idempotent (relançable sans empiler les suffixes).

Usage : python -X utf8 scripts/normalize_catalogue.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path

CATALOGUE = Path(__file__).resolve().parent.parent / "data" / "catalogue_local_images_cleaned.json"

COLOR_FR = {
    "White": "Blanc",
    "Black": "Noir",
    "Silver": "Argent",
    "Gray": "Gris",
    "Red": "Rouge",
    "Blue": "Bleu",
    "Pink": "Rose",
    "Gold": "Or",
}

def specs_of(product):
    return {s["name"]: s["valueText"] for s in product.get("specs", [])}

def squash(text):
    return re.sub(r"\s+", " ", text).strip()

def contains(haystack, needle):
    """Vrai si `needle` apparaît déjà dans `haystack` (insensible à la casse et aux espaces)."""
    norm = lambda s: re.sub(r"[\s\-]", "", s.lower())
    return norm(needle) in norm(haystack)

def model_part(name, brand):
    return squash(name[len(brand):]) if name.lower().startswith(brand.lower()) else squash(name)

def gb(value):
    """'8 GB' -> '8 GB', '2 x 16GB' -> '2 x 16 GB'."""
    return squash(re.sub(r"(\d)(GB|TB)", r"\1 \2", value))

# règles par catégorie

def name_gpu(base, brand, s):
    chipset = s.get("Chipset", "")
    memory = gb(s.get("Memory", ""))
    lhr = " LHR" if "LHR" in chipset else ""
    chip = squash(re.sub(r"\b\d+\s?GB\b|\bLHR\b", "", chipset)) + lhr

    model = model_part(base, brand)
    # Retire du modèle la puce et la mémoire déjà présentes ("ASRock Radeon RX 7900 XT 20GB")
    model = re.sub(re.escape(chip.replace(" LHR", "")), "", model, flags=re.I)
    model = squash(re.sub(r"\b\d+\s?GB\b", "", model, flags=re.I))

    parts = [brand, chip, model, memory]
    if s.get("Color", "").startswith("White") and "white" not in base.lower():
        parts.append("White")
    return squash(" ".join(p for p in parts if p))

def name_storage(base, brand, s):
    capacity = gb(s.get("Capacity", ""))
    ff = s.get("Form Factor", "")
    interface = s.get("Interface", "")

    pcie = re.search(r"PCIe (\d\.\d)", interface)
    if pcie:
        kind = f"M.2 NVMe PCIe {pcie.group(1)}"
    elif interface == "M.2 SATA":
        kind = "M.2 SATA"
    elif interface == "U.2":
        kind = "U.2 NVMe"
    elif ff.startswith("2.5"):
        kind = '2.5" SATA'
    else:
        kind = interface

    parts = [base]
    if capacity and not contains(base, capacity):
        parts.append(capacity)
    parts.append(f"SSD {kind}" if "ssd" not in base.lower() else kind)
    return squash(" ".join(parts))

def name_psu(base, brand, s):
    watts = re.sub(r"\s", "", s.get("Wattage", ""))  # "850W"
    eff = s.get("Efficiency Rating") or ""
    ptype = s.get("Type", "")

    parts = [base]
    if ptype in ("SFX", "TFX", "Flex ATX") and not contains(base, ptype):
        parts.append(ptype)
    if watts and not re.search(rf"\b{watts[:-1]}\s?W\b", base, flags=re.I):
        parts.append(watts)
    if eff and not contains(base, eff):
        parts.append(eff)
    return squash(" ".join(parts))

def name_ram(base, brand, s):
    modules = gb(s.get("Modules", ""))  # "2 x 16 GB"
    speed = s.get("Speed", "")  # "DDR5-6000"
    cas = s.get("CAS Latency", "")

    parts = [base]
    if modules:
        parts.append(f"({modules})")
    if speed and not contains(base, speed):
        parts.append(speed)
    if cas:
        parts.append(f"CL{cas}")
    return squash(" ".join(parts))

def name_cooler(base, brand, s, url):
    if "liquid" not in url:
        return base
    radiator = s.get("Radiator Size", "").replace(" ", " ")
    parts = [base, "AIO"]
    if radiator and not contains(base, radiator):
        parts.append(radiator)
    return squash(" ".join(parts))

RULES = {
    "cartes-graphiques": name_gpu,
    "stockage": name_storage,
    "alimentations": name_psu,
    "memoire-ram": name_ram,
}

def build_name(product):
    base = product["source"].get("originalName") or product["name"]
    brand = product["brandName"]
    s = specs_of(product)
    cat = product["categorySlug"]
    if cat == "refroidissement":
        return name_cooler(base, brand, s, product["source"].get("url", ""))
    rule = RULES.get(cat)
    return rule(base, brand, s) if rule else base

def color_suffix(product):
    color = specs_of(product).get("Color")
    if not color:
        return None
    return " / ".join(COLOR_FR.get(c.strip(), c.strip()) for c in color.split("/"))

# La référence fabricant termine l'URL source, après le type de produit
PART_MARKERS = (
    "processor-", "video-card-", "memory-", "motherboard-", "solid-state-drive-",
    "power-supply-", "case-", "cpu-cooler-",
)

def part_number(product):
    slug = product["source"].get("url", "").rstrip("/").split("/")[-1]
    for marker in PART_MARKERS:
        if marker in slug:
            return slug.rsplit(marker, 1)[1].upper()
    return None

def group_by_name(products):
    groups = defaultdict(list)
    for p in products:
        groups[p["_newName"].lower()].append(p)
    return [g for g in groups.values() if len(g) > 1]

def main():
    data = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    products = data["products"]

    for p in products:
        p["source"].setdefault("originalName", p["name"])
        p["_newName"] = build_name(p)
        # Processeurs vendus sans ventirad ni boîte
        if p["categorySlug"] == "processeurs" and "oemtray" in p["source"].get("url", ""):
            p["_newName"] += " Tray"

    # 1. Départage des doublons par la couleur ("... (Blanc)") quand elle diffère
    for group in group_by_name(products):
        if len({color_suffix(p) for p in group}) > 1:
            for p in group:
                if color_suffix(p):
                    p["_newName"] += f" ({color_suffix(p)})"

    # 2. Variantes strictement identiques (révision, profil XMP/EXPO...) : référence fabricant
    for group in group_by_name(products):
        for p in group:
            ref = part_number(p)
            if ref:
                p["_newName"] += f" ({ref})"

    changed = 0
    for p in products:
        old_display = p["name"]
        new = p.pop("_newName")
        original = p["source"]["originalName"]
        if new != old_display:
            changed += 1
        p["name"] = new
        # Les descriptions commencent par le nom : on le remplace
        for key in ("descriptionFr", "descriptionEn"):
            for prefix in (old_display, original):
                if p[key].startswith(prefix):
                    p[key] = new + p[key][len(prefix):]
                    break
        for img in p.get("images", []):
            img["altText"] = new

    CATALOGUE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    names = [p["name"].lower() for p in products]
    dups = len(names) - len(set(names))
    print(f"{changed} noms modifiés sur {len(products)} produits ; doublons restants : {dups}")

if __name__ == "__main__":
    main()
