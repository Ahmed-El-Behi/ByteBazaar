"""
Trouve une photo produit pour chaque périphérique de data/accessories_catalogue.json.

Le jeu de données des périphériques (docyx/pc-part-dataset) n'a pas d'images : on cherche
le même produit dans les métadonnées « Electronics » d'Amazon Reviews 2023 (McAuley Lab,
Hugging Face), qui contiennent les URL des photos.

Étapes :
  1. extraction (une fois) : seules les fiches d'accessoires sont lues à distance, colonne par
     colonne, dans les fichiers Parquet (≈ 2 Go en ligne, ≈ 20 Mo extraits) ;
  2. appariement strict — mieux vaut un visuel généré que la photo d'un autre produit :
       - la boutique (marque) ou le début du titre doit correspondre à la marque ;
       - CHAQUE mot du modèle (« Rival », « 3 », « 27GP850-B »…) doit figurer dans le titre
         comme mot entier (« 770 » ne correspond pas à « 1770 », « 3 » pas à « 700 ») ;
       - le titre doit nommer le type de produit (souris, clavier, casque…) ;
       - les accessoires « pour » un produit (patins, coussinets, supports, lots…) sont écartés ;
       - à score égal : la bonne couleur, la marque en tête du titre, puis la fiche la plus notée.
  Sortie : data/raw/accessory_images.json (SKU → URL de la photo, ASIN, titre retenu).

Prérequis : `pip install duckdb` (outil de préparation des données, pas une dépendance du site).
Usage :
  python scripts/match_accessory_images.py --extract amazon_accessories.parquet   # étape 1
  python scripts/match_accessory_images.py --subset amazon_accessories.parquet    # étape 2
Puis : python scripts/build_accessories.py, scripts/download_product_images.py, build à nouveau.
"""

import argparse
import json
import math
import re
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
# Tous les candidats (build_accessories.py --candidates), pas seulement le catalogue final
CATALOGUE = ROOT / 'data' / 'raw' / 'accessory_candidates.json'
OUT = ROOT / 'data' / 'raw' / 'accessory_images.json'

PARQUET = (
    'https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/resolve/refs%2Fpr%2F10/'
    'raw_meta_Electronics/full-{:05d}-of-00010.parquet'
)

# Catégorie ByteBazaar → catégories Amazon acceptées
CATEGORY_LEAVES = {
    'ecrans': ['Monitors'],
    'souris': ['Mice'],
    'claviers': ['Keyboards'],
    'casques': ['Computer Headsets', 'Headphones', 'Over-Ear Headphones', 'On-Ear Headphones', 'Earbud Headphones', 'Gaming Headsets'],
    'enceintes': ['Computer Speakers', 'Bookshelf Speakers', 'Soundbars'],
    'webcams': ['Webcams'],
}

# Le titre doit nommer le type de produit (écarte stations, supports, câbles…)
CATEGORY_NOUNS = {
    'ecrans': re.compile(r'\bmonitor|\bdisplay', re.I),
    'souris': re.compile(r'\bmouse\b|\bmice\b', re.I),
    'claviers': re.compile(r'\bkeyboard', re.I),
    'casques': re.compile(r'\bheadset|\bheadphone|\bearbud|\bearphone|\biems?\b', re.I),
    'enceintes': re.compile(r'\bspeaker|\bsoundbar|\bstudio monitors?\b', re.I),
    'webcams': re.compile(r'\bwebcam|\bcamera', re.I),
}

# Fiches qui ne sont pas le produit lui-même mais un accessoire pour lui (ou un lot)
NOT_THE_PRODUCT = re.compile(
    r'^\W*for\b|\bcompatible with\b|\breplacement\b|\bskins?\b|\bskates?\b|\bgrip tape\b|\bgrips?\b'
    r'|\bear ?pads?\b|\bear ?cushions?\b|\bkeycaps?\b|\bwrist rest\b|\bmouse ?pad\b|\bprotector\b'
    r'|\bdecals?\b|\bstickers?\b|\bcarrying case\b|\bstand for\b|\bmount for\b|\bcable for\b'
    r'|\bheadset stand\b|\bbase station\b|\bbungee\b|\bin-?line mic\b|\bboom mic\b|\bbundle\b|\bcombo\b'
    r'|\blegs\b|\bfeet\b|\bspare\b|\b\d+-?pack\b|\bpack of\b|\bset of\b',
    re.I,
)

# Mots trop vagues pour identifier un modèle (le type de produit est vérifié à part)
GENERIC_WORDS = {'gaming', 'mouse', 'keyboard', 'headset', 'monitor', 'the', 'and', 'with', 'edition',
                 'wireless', 'wired', 'webcam', 'speakers', 'speaker', 'usb'}


# Couleurs : celles qui changent l'apparence du produit doivent apparaître dans le titre
COLOR_WORDS = {
    'white': r'\bwhite\b', 'pink': r'\bpink\b', 'blue': r'\bblue\b', 'red': r'\bred\b', 'green': r'\bgreen\b',
    'purple': r'\bpurple\b', 'yellow': r'\byellow\b', 'orange': r'\borange\b', 'gold': r'\bgold\b',
    'silver': r'\bsilver\b', 'gray': r'\bgr[ae]y\b', 'black': r'\bblack\b',
}
NEUTRAL_COLORS = {'black', 'gray', 'silver'}
# Pour un produit noir / gris : écarter les fiches d'une variante colorée. « Red », « Blue »,
# « Green »… comptent aussi, sauf quand ils désignent un switch ou une technologie
# (Cherry MX Red, Razer Green Switches, Blue VO!CE)
OTHER_COLORS = (
    r'\b(white|pink|purple|yellow|mint|lavender|orange|gold)\b'
    r'|(?<!mx )(?<!razer )(?<!kailh )(?<!gateron )(?<!outemu )\b(red|blue|green)\b(?!\s*(switch|optical|linear|tactile|clicky|vo))'
)


def norm(text):
    return re.sub(r'[^a-z0-9]', '', (text or '').lower())


def grams(title):
    """Jetons du titre et concaténations de 2-3 jetons voisins (« 27GP850-B » = « 27gp850 » + « b »)."""
    tokens = re.findall(r'[a-z0-9]+', title.lower())
    out = set()
    for n in (1, 2, 3):
        for i in range(len(tokens) - n + 1):
            out.add(''.join(tokens[i:i + n]))
    return out


def extract(path):
    con = duckdb.connect()
    con.sql('INSTALL httpfs; LOAD httpfs;')
    leaves = sorted({leaf for values in CATEGORY_LEAVES.values() for leaf in values})
    files = [PARQUET.format(i) for i in range(10)]
    con.sql(f"""
        COPY (
          SELECT parent_asin, title, store, categories, rating_number, images.hi_res AS hi_res, images.large AS large
          FROM read_parquet({files})
          WHERE list_has_any(categories, {leaves})
        ) TO '{path}' (FORMAT parquet)
    """)
    print('Extraction :', con.sql(f"SELECT count(*) FROM '{path}'").fetchone()[0], 'fiches')


def load_candidates(path):
    con = duckdb.connect()
    rows = con.sql(f"SELECT parent_asin, title, store, categories, rating_number, large, hi_res FROM '{path}'").fetchall()
    by_category = {slug: [] for slug in CATEGORY_LEAVES}
    for asin, title, store, categories, rating, large, hi_res in rows:
        image = next((u for u in (large or []) + (hi_res or []) if u), None)
        if not title or not image or NOT_THE_PRODUCT.search(title):
            continue
        record = {
            'asin': asin,
            'title': title,
            'store': store or '',
            'rating': rating or 0,
            'image': image,
            'compact': norm(title),
            'grams': grams(title),
        }
        for slug, leaves in CATEGORY_LEAVES.items():
            if any(leaf in (categories or []) for leaf in leaves) and CATEGORY_NOUNS[slug].search(title):
                by_category[slug].append(record)
    return by_category


def model_tokens(model, brand):
    """Mots du modèle à retrouver tels quels dans le titre (marque et mots génériques exclus)."""
    rest = model[len(brand):] if model.lower().startswith(brand.lower()) else model
    tokens = [norm(t) for t in re.split(r'[\s/,()]+', rest)]
    return [t for t in tokens if t and t not in GENERIC_WORDS]


def best_match(product, candidates):
    brand = norm(product['brandName'])
    color = (product['source'].get('color') or '').lower()
    required = model_tokens(product['source']['model'], product['brandName'])
    # Il faut au moins un mot distinctif (référence avec chiffre ou mot de 4 lettres et plus) :
    # « MSI Pro » seul correspondrait à n'importe quel écran MSI « Pro »
    if not any(re.search(r'\d', t) and len(t) >= 2 or len(t) >= 4 for t in required):
        return None

    # Un petit numéro (« MX Master 3 », « Tiny 2 ») doit suivre directement le mot précédent :
    # sinon « MX Master 2S … 3 appareils » passerait pour une MX Master 3
    pairs = [required[i - 1] + t for i, t in enumerate(required) if i > 0 and t.isdigit() and len(t) <= 2]
    has_code = any(re.search(r'\d', t) for t in required)

    best, best_score = None, 0.0
    for c in candidates:
        if brand not in norm(c['store']) and not c['compact'].startswith(brand):
            continue
        if any(token not in c['grams'] for token in required) or any(p not in c['grams'] for p in pairs):
            continue
        # Modèle sans référence chiffrée (« Koss PLUG ») : ses mots doivent figurer en tête du titre,
        # là où se trouve le nom du modèle, et non au détour de la description
        if not has_code and any(token not in grams(' '.join(c['title'].split()[:8])) for token in required):
            continue
        title = c['title'].lower()
        # Couleur stricte : une variante blanche ou rose ne doit pas montrer la photo du modèle noir
        main_color = color.split('/')[0].strip()
        if main_color in COLOR_WORDS and main_color not in NEUTRAL_COLORS:
            if not re.search(COLOR_WORDS[main_color], title):
                continue
        elif re.search(OTHER_COLORS, title):
            continue
        score = 1.0 + (0.3 if c['compact'].startswith(brand) else 0.0)
        score += math.log10(c['rating'] + 1) * 0.05
        if score > best_score:
            best, best_score = c, score
    return best


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--extract', help="Extrait les fiches Amazon vers ce fichier Parquet puis s'arrête")
    parser.add_argument('--subset', help="Fichier Parquet extrait à utiliser pour l'appariement")
    args = parser.parse_args()

    if args.extract:
        extract(args.extract)
        return

    catalogue = json.loads(CATALOGUE.read_text(encoding='utf-8'))
    candidates = load_candidates(args.subset)
    matches, per_category = {}, {}
    for product in catalogue['products']:
        slug = product['categorySlug']
        found = best_match(product, candidates[slug])
        stats = per_category.setdefault(slug, [0, 0])
        stats[1] += 1
        if found:
            stats[0] += 1
            matches[product['sku']] = {
                'imageUrl': found['image'],
                'asin': found['asin'],
                'matchedTitle': found['title'][:160],
                'name': product['name'],
            }

    OUT.write_text(json.dumps(matches, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(matches)} photos trouvées → {OUT.relative_to(ROOT)}')
    for slug, (found, total) in per_category.items():
        print(f'  {slug:<10} {found:>4} / {total}')


if __name__ == '__main__':
    main()
