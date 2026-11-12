"""
Construit le catalogue des périphériques ByteBazaar (souris, claviers, écrans,
casques, enceintes, webcams) à partir du jeu de données PCPartPicker de
docyx/pc-part-dataset (licence MIT, copie dans data/raw/pc-part-dataset/).

Même démarche que pour le catalogue des composants :
  - seuls les produits avec un prix sont gardés, dans l'ordre de popularité de la source ;
  - marques normalisées (« HP HyperX » → HyperX, « Acer Acer Nitro » → Acer Nitro…) ;
  - noms au format des sites pros (marque + modèle + caractéristiques clés) ;
  - doublons départagés par la couleur, puis supprimés s'ils restent identiques ;
  - produits hors sujet écartés (prix aberrants, écrans géants ou rétro…) ;
  - prix convertis en TND (USD × 3,15, arrondi à l'unité inférieure) ;
  - stock à 0 : `npm run seed:stock` attribue un stock de test, comme pour les composants.

Les visuels sont générés ensuite par frontend/scripts/generate-accessory-tiles.mjs.

Usage :
  python -X utf8 scripts/build_accessories.py --candidates   # tous les produits → data/raw/accessory_candidates.json
  python -X utf8 scripts/match_accessory_images.py ...        # photos des candidats
  python -X utf8 scripts/build_accessories.py                 # catalogue : les produits ayant une photo
"""

import hashlib
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'data' / 'raw' / 'pc-part-dataset'
OUT = ROOT / 'data' / 'accessories_catalogue.json'
CANDIDATES = ROOT / 'data' / 'raw' / 'accessory_candidates.json'
# Photos : correspondances trouvées par scripts/match_accessory_images.py (URL distante),
# téléchargées ensuite dans frontend/public/products/ par scripts/download_product_images.py
IMAGE_MATCHES = ROOT / 'data' / 'raw' / 'accessory_images.json'
PUBLIC_PRODUCTS = ROOT.parent / 'frontend' / 'public' / 'products'

USD_TO_TND = 3.15
# Date d'ajout : les plus populaires sont les plus récents, catégories entrelacées
# (la rubrique « Derniers ajouts » de l'accueil montre ainsi un mélange représentatif)
ADDED_AT_BASE = datetime(2026, 11, 12, 8, 0, tzinfo=timezone.utc)
ADDED_AT_STEP = timedelta(minutes=7)

# slug, source, nameFr, nameEn, code SKU, quota, prix min/max (USD)
CATEGORIES = [
    ('ecrans', 'monitor', 'Écrans', 'Monitors', 'MON', 300, (80, 2500)),
    ('souris', 'mouse', 'Souris', 'Mice', 'MOU', 220, (8, 250)),
    ('claviers', 'keyboard', 'Claviers', 'Keyboards', 'KBD', 220, (12, 350)),
    ('casques', 'headphones', 'Casques audio', 'Headsets', 'HDS', 200, (15, 700)),
    ('enceintes', 'speakers', 'Enceintes', 'Speakers', 'SPK', 80, (15, 800)),
    ('webcams', 'webcam', 'Webcams', 'Webcams', 'CAM', 45, (20, 350)),
]

# Marques en plusieurs mots ou à corriger (préfixe du nom → marque affichée, préfixe remplacé)
BRAND_PREFIXES = [
    ('HP HyperX', 'HyperX', 'HyperX'),
    ('be quiet!', 'be quiet!', 'be quiet!'),
    ('Fractal Design', 'Fractal Design', 'Fractal Design'),
    ('Cooler Master', 'Cooler Master', 'Cooler Master'),
    ('Creative Labs', 'Creative', 'Creative'),
    ('RK Royal Kludge', 'Royal Kludge', 'Royal Kludge'),
    ('Das Keyboard', 'Das Keyboard', 'Das Keyboard'),
    ('Mad Catz', 'Mad Catz', 'Mad Catz'),
    ('Cyber Acoustics', 'Cyber Acoustics', 'Cyber Acoustics'),
    ('Turtle Beach', 'Turtle Beach', 'Turtle Beach'),
    ('Final Audio', 'Final', 'Final'),
    ('Green Extreme', 'Green Extreme', 'Green Extreme'),
    ('Endgame Gear', 'Endgame Gear', 'Endgame Gear'),
    ('Audio-Technica', 'Audio-Technica', 'Audio-Technica'),
    ('Western Digital', 'Western Digital', 'Western Digital'),
]
# Casse des marques déjà présentes dans le catalogue des composants
BRAND_CASE = {'ASUS': 'Asus', 'GIGABYTE': 'Gigabyte', 'ASROCK': 'ASRock', 'SILVERSTONE': 'Silverstone', 'STEELSERIES': 'SteelSeries'}

COLOR_FR = {
    'Black': 'Noir', 'White': 'Blanc', 'Gray': 'Gris', 'Grey': 'Gris', 'Silver': 'Argent', 'Red': 'Rouge',
    'Blue': 'Bleu', 'Pink': 'Rose', 'Green': 'Vert', 'Purple': 'Violet', 'Yellow': 'Jaune', 'Orange': 'Orange',
    'Gold': 'Or', 'Brown': 'Marron', 'Beige': 'Beige', 'Clear': 'Transparent', 'Multicolor': 'Multicolore',
}

RESOLUTION_LABELS = {
    (1920, 1080): 'Full HD', (2560, 1440): 'QHD', (3840, 2160): '4K UHD', (3440, 1440): 'UWQHD',
    (5120, 1440): 'DQHD', (2560, 1080): 'UW-FHD', (1920, 1200): 'WUXGA', (2560, 1600): 'WQXGA',
    (5120, 2160): '5K2K', (5120, 2880): '5K', (3840, 1600): 'WQHD+', (3840, 1080): 'DFHD',
}


def squash(text):
    return re.sub(r'\s+', ' ', text).strip()


def split_brand(raw_name):
    name = squash(raw_name)
    for prefix, brand, replacement in BRAND_PREFIXES:
        if name.lower().startswith(prefix.lower() + ' '):
            return brand, squash(replacement + name[len(prefix):])
    brand = name.split(' ')[0]
    rest = name[len(brand):].strip()
    # « Acer Acer Nitro » : marque répétée
    if rest.lower().startswith(brand.lower() + ' '):
        rest = rest[len(brand):].strip()
    brand = BRAND_CASE.get(brand.upper(), brand)
    return brand, squash(f'{brand} {rest}')


def clean_name(name):
    name = re.sub(r'\s*\((?:Black|White|Gray|Grey|Silver|Red|Blue|Pink)[^)]*\)\s*$', '', name, flags=re.I)
    name = re.sub(r'\s+for\s+(?:PC|PS[45]|Xbox|Mac|Nintendo|Switch)\b.*$', '', name, flags=re.I)
    return squash(name)


def mentions(name, *words):
    return any(re.search(rf'\b{re.escape(w)}\b', name, flags=re.I) for w in words)


def wireless_of(connection):
    return bool(connection) and 'wireless' in connection.lower()


def color_fr(color):
    if not color:
        return None
    return ' / '.join(COLOR_FR.get(part.strip(), part.strip()) for part in color.split('/'))


def num(value):
    return int(value) if isinstance(value, float) and value.is_integer() else value


def spec(name, value_text, value_number=None, unit=None):
    return {'name': name, 'valueText': value_text, 'valueNumber': value_number, 'unit': unit}


def yes_no(value):
    return 'Yes' if value else 'No'


# ------------------------------------------------------------------ règles par catégorie

def build_monitor(r, base):
    res = tuple(r.get('resolution') or ())
    size, hz = r.get('screen_size'), r.get('refresh_rate')
    if len(res) != 2 or not size or not hz or not (21 <= size <= 49) or res[1] < 1080:
        return None
    label = RESOLUTION_LABELS.get(res, f'{res[0]}x{res[1]}')
    panel = r.get('panel_type')
    name = f'{base} {num(size)}" {label} {num(hz)} Hz' + (f' {panel}' if panel else '')
    specs = [
        spec('Screen Size', f'{num(size)}"', size, 'in'),
        spec('Resolution', f'{res[0]} x {res[1]}'),
        spec('Refresh Rate', f'{num(hz)} Hz', hz, 'Hz'),
    ]
    if r.get('response_time'):
        specs.append(spec('Response Time (G2G)', f"{num(r['response_time'])} ms", r['response_time'], 'ms'))
    if panel:
        specs.append(spec('Panel Type', panel))
    if r.get('aspect_ratio'):
        specs.append(spec('Aspect Ratio', r['aspect_ratio']))
    summary = f'{num(size)}", {label}, {num(hz)} Hz' + (f', dalle {panel}' if panel else '')
    return name, specs, summary


def build_mouse(r, base):
    wireless = wireless_of(r.get('connection_type'))
    dpi = r.get('max_dpi')
    name = base
    if wireless and not mentions(base, 'wireless', 'lightspeed', 'hyperspeed', 'bluetooth'):
        name += ' Wireless'
    if dpi:
        name += f' {num(dpi)} DPI'
    specs = []
    if r.get('tracking_method'):
        specs.append(spec('Tracking Method', r['tracking_method']))
    if r.get('connection_type'):
        specs.append(spec('Connection Type', r['connection_type']))
    if dpi:
        specs.append(spec('Maximum DPI', f'{num(dpi)} DPI', dpi, 'DPI'))
    if r.get('hand_orientation'):
        specs.append(spec('Hand Orientation', r['hand_orientation']))
    summary = ('sans fil' if wireless else 'filaire') + (f', {num(dpi)} DPI' if dpi else '')
    return name, specs, summary


def build_keyboard(r, base):
    wireless = wireless_of(r.get('connection_type'))
    # « Razer Gen-3 (Tactile) » → « Razer Gen-3 Tactile » (parenthèses imbriquées dans le nom)
    switches = squash(re.sub(r'[()]', ' ', r['switches'])) if r.get('switches') else None
    name = base
    if r.get('tenkeyless') and not mentions(base, 'tkl', 'mini', 'tenkeyless') and not re.search(r'\b(60|65|75)%?\b', base):
        name += ' TKL'
    if wireless and not mentions(base, 'wireless', 'lightspeed', 'hyperspeed', 'bluetooth'):
        name += ' Wireless'
    if switches and not mentions(base, *switches.split()[-1:]):
        name += f' ({switches})'
    specs = []
    if r.get('style'):
        specs.append(spec('Style', r['style']))
    if switches:
        specs.append(spec('Switch Type', switches))
    if r.get('backlit'):
        specs.append(spec('Backlit', r['backlit']))
    specs.append(spec('Tenkeyless', yes_no(r.get('tenkeyless'))))
    if r.get('connection_type'):
        specs.append(spec('Connection Type', r['connection_type']))
    summary = ', '.join(x for x in [
        (r.get('style') or '').lower() or None,
        'sans fil' if wireless else 'filaire',
        f'switchs {switches}' if switches else None,
        f"rétroéclairage {r['backlit']}" if r.get('backlit') else None,
    ] if x)
    return name, specs, summary


def build_headphones(r, base):
    name = base
    if r.get('wireless') and not mentions(base, 'wireless', 'lightspeed', 'hyperspeed', 'bluetooth'):
        name += ' Wireless'
    specs = []
    if r.get('type'):
        specs.append(spec('Type', r['type']))
    fr = r.get('frequency_response') or []
    if len(fr) == 2:
        specs.append(spec('Frequency Response', f'{num(fr[0])} Hz - {num(fr[1])} kHz'))
    specs.append(spec('Microphone', yes_no(r.get('microphone'))))
    specs.append(spec('Wireless', yes_no(r.get('wireless'))))
    if r.get('enclosure_type'):
        specs.append(spec('Enclosure Type', r['enclosure_type']))
    summary = ', '.join(x for x in [
        'sans fil' if r.get('wireless') else 'filaire',
        'avec micro' if r.get('microphone') else None,
        f"type {r['type'].lower()}" if r.get('type') else None,
    ] if x)
    return name, specs, summary


def build_speakers(r, base):
    config = r.get('configuration')
    watts = r.get('wattage')
    if watts is not None and watts < 1:  # valeur aberrante de la source (ex. 0,01 W)
        watts = None
    if config is None:
        return None
    channels = f'{float(config):.1f}'
    name = base + ('' if re.search(r'\b\d\.\d\b', base) else f' {channels}') + (f' {num(watts)} W' if watts else '')
    specs = [spec('Configuration', channels, float(config))]
    if watts:
        specs.append(spec('Wattage', f'{num(watts)} W', watts, 'W'))
    fr = r.get('frequency_response') or []
    if len(fr) == 2:
        specs.append(spec('Frequency Response', f'{num(fr[0])} Hz - {num(fr[1])} kHz'))
    summary = f'système {channels}' + (f', {num(watts)} W' if watts else '')
    return name, specs, summary


def build_webcam(r, base):
    resolutions = r.get('resolutions') or []
    if not resolutions:
        return None
    best = resolutions[0]
    label = best.upper() if best.lower() in ('4k', '2k') else best
    name = base if mentions(base, best) else f'{base} {label}'
    specs = [spec('Resolutions', ', '.join(resolutions))]
    if r.get('connection'):
        specs.append(spec('Connection', r['connection']))
    if r.get('focus_type'):
        specs.append(spec('Focus Type', r['focus_type']))
    if r.get('fov'):
        specs.append(spec('Field of View', f"{num(r['fov'])}°", r['fov'], '°'))
    if r.get('os'):
        specs.append(spec('Operating System', ', '.join(r['os'])))
    summary = f'{label}' + (f", mise au point {r['focus_type'].lower()}" if r.get('focus_type') else '')
    return name, specs, summary


BUILDERS = {
    'monitor': build_monitor,
    'mouse': build_mouse,
    'keyboard': build_keyboard,
    'headphones': build_headphones,
    'speakers': build_speakers,
    'webcam': build_webcam,
}


def has_photo(slug, sku, matches):
    return sku in matches or not image_url(slug, sku, {}).endswith('.svg')


def image_url(slug, sku, matches):
    """Photo locale si déjà téléchargée, sinon URL distante à télécharger, sinon visuel généré."""
    for ext in ('.jpg', '.jpeg', '.png', '.webp'):
        if (PUBLIC_PRODUCTS / slug / f'{sku}{ext}').exists():
            return f'/products/{slug}/{sku}{ext}'
    if sku in matches:
        return matches[sku]['imageUrl']
    return f'/products/{slug}/{sku}.svg'


def slugify(text):
    text = text.lower()
    for a, b in (('é', 'e'), ('è', 'e'), ('ê', 'e'), ('à', 'a'), ('ô', 'o'), ('ü', 'u'), ('ö', 'o'), ('"', '')):
        text = text.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')


def main():
    candidates_mode = '--candidates' in sys.argv
    out = CANDIDATES if candidates_mode else OUT
    products, brands = [], {}
    report = {}
    matches = json.loads(IMAGE_MATCHES.read_text(encoding='utf-8')) if IMAGE_MATCHES.exists() else {}
    photo_count = 0

    for slug, source, name_fr, name_en, code, quota, (pmin, pmax) in CATEGORIES:
        rows = json.loads((RAW / f'{source}.json').read_text(encoding='utf-8'))
        total = len(rows)
        candidates, seen = [], set()
        for rank, r in enumerate(rows):
            price = r.get('price')
            if not price or not (pmin <= price <= pmax):
                continue
            brand, base = split_brand(clean_name(r['name']))
            built = BUILDERS[source](r, base)
            if not built:
                continue
            name, specs, summary = built
            color = r.get('color')
            if color:
                specs.append(spec('Color', color))
            key = (name.lower(), (color or '').lower())
            if key in seen:  # même produit, même couleur : déjà retenu
                continue
            seen.add(key)
            candidates.append({'rank': rank, 'brand': brand, 'model': base, 'name': name, 'color': color, 'price': price, 'specs': specs, 'summary': summary})

        # Doublons de nom : couleur en suffixe ; s'ils restent identiques, on garde le premier
        groups = defaultdict(list)
        for c in candidates:
            groups[c['name'].lower()].append(c)
        for group in groups.values():
            if len(group) > 1 and len({c['color'] for c in group}) > 1:
                for c in group:
                    if not c['color']:
                        continue
                    # « … (Cherry MX Red) » + couleur → « … (Cherry MX Red, Blanc) »
                    if c['name'].endswith(')'):
                        c['name'] = c['name'][:-1] + f", {color_fr(c['color'])})"
                    else:
                        c['name'] += f" ({color_fr(c['color'])})"
        unique, names = [], set()
        for c in candidates:
            if c['name'].lower() in names:
                continue
            names.add(c['name'].lower())
            c['digest'] = hashlib.sha1(f"{source}:{c['name']}:{c['color']}".encode()).hexdigest()[:8].upper()
            c['sku'] = f"ACC-{code}-{c['digest']}"
            unique.append(c)

        # Candidats : tous (pour la recherche de photos). Catalogue : les plus populaires AYANT une photo,
        # comme pour les composants (chaque produit du site a une vraie photo).
        if candidates_mode:
            selected = unique
        else:
            selected = [c for c in unique if has_photo(slug, c['sku'], matches)][:quota]

        for position, c in enumerate(selected):
            digest, sku = c['digest'], c['sku']
            price_tnd = int(c['price'] * USD_TO_TND)
            spec_text_fr = '; '.join(f"{s['name']}: {s['valueText']}" for s in c['specs'])
            products.append({
                'sku': sku,
                'slug': f"{slugify(c['name'])}-{digest.lower()[:6]}",
                'name': c['name'],
                'descriptionFr': f"{c['name']} de {c['brand']}. Accessoire informatique : {name_fr.lower()} ({c['summary']}). Caractéristiques : {spec_text_fr}.",
                'descriptionEn': f"{c['name']} by {c['brand']}. Computer accessory: {name_en.lower()}. Specifications: {spec_text_fr}.",
                'price': f'{price_tnd}.000',
                'stockQuantity': 0,
                'isActive': True,
                'categorySlug': slug,
                'brandName': c['brand'],
                'images': [{'url': image_url(slug, sku, matches), 'altText': c['name'], 'position': 0, 'isPrimary': True}],
                'specs': c['specs'],
                # Popularité décroissante dans l'ordre de la source (sert au tri « Pertinence »)
                'source': {'name': 'docyx/pc-part-dataset', 'model': c['model'], 'rank': c['rank'], 'ratingCount': len(selected) - position, 'priceUSD': c['price'], 'color': c['color']},
            })
            brands.setdefault(c['brand'].lower(), c['brand'])
            photo_count += not products[-1]['images'][0]['url'].endswith('.svg')

        report[slug] = {'source': total, 'retenus': len(selected)}

    # Tour par tour : 1er de chaque catégorie, puis 2e de chaque catégorie, etc.
    by_category = defaultdict(list)
    for product in products:
        by_category[product['categorySlug']].append(product)
    interleaved, depth = [], max(len(v) for v in by_category.values())
    for i in range(depth):
        for slug, *_ in CATEGORIES:
            if i < len(by_category[slug]):
                interleaved.append(by_category[slug][i])
    for i, product in enumerate(interleaved):
        product['addedAt'] = (ADDED_AT_BASE - i * ADDED_AT_STEP).isoformat().replace('+00:00', 'Z')

    categories = [{'slug': 'peripheriques', 'nameFr': 'Périphériques', 'nameEn': 'Peripherals'}] + [
        {'slug': slug, 'nameFr': name_fr, 'nameEn': name_en, 'parentSlug': 'peripheriques'}
        for slug, _, name_fr, name_en, *_ in CATEGORIES
    ]
    data = {
        'metadata': {
            'title': 'ByteBazaar — périphériques',
            'source': 'docyx/pc-part-dataset (PCPartPicker), licence MIT — https://github.com/docyx/pc-part-dataset',
            'conversion': f'floor(price_usd * {USD_TO_TND}), stocké avec 3 décimales .000',
            'productCount': len(products),
            'categories': report,
        },
        'categories': categories,
        'brands': [{'name': b, 'slug': slugify(b)} for b in sorted(brands.values(), key=str.lower)],
        'products': products,
    }
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'{len(products)} périphériques → {out.relative_to(ROOT)} ({photo_count} avec photo)')
    for slug, r in report.items():
        print(f"  {slug:<10} {r['retenus']:>4} retenus / {r['source']} dans la source")
    dup = Counter(p['name'].lower() for p in products)
    print('  noms en double :', sum(1 for v in dup.values() if v > 1))


if __name__ == '__main__':
    main()
