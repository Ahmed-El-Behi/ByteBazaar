// =====================================================================
// Tri « Pertinence » du catalogue.
//
// Sans recherche, l'ordre mélange les catégories au lieu d'afficher les
// derniers produits importés en bloc :
//   score = popularité relative dans SA catégorie (0..1) × 2
//         + part aléatoire stable sur la journée (0..1) × 1,5
//         + 1 si le produit est en stock
// La popularité est classée par catégorie : les meilleurs GPU, CPU, SSD…
// arrivent ensemble en tête. La graine change chaque jour (ordre varié
// d'un jour à l'autre) mais reste fixe dans la journée, ce qui garde une
// pagination cohérente.
//
// Avec une recherche, la qualité de correspondance du texte domine
// (mot exact > début de mot > contenu ; phrase complète en bonus).
// =====================================================================

export interface RelevanceCandidate {
  id: number;
  name: string;
  sku: string;
  popularity: number;
  stockQuantity: number;
  categoryId: number;
  brand: { name: string };
}

const DAY_MS = 86_400_000;

// Hachage entier → [0, 1) (mulberry32 sur id ⊕ graine)
function jitter(id: number, seed: number): number {
  let t = (Math.imul(id, 0x9e3779b1) ^ seed) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function popularityPercentiles(
  candidates: RelevanceCandidate[],
): Map<number, number> {
  const byCategory = new Map<number, RelevanceCandidate[]>();
  for (const c of candidates) {
    const list = byCategory.get(c.categoryId) ?? [];
    list.push(c);
    byCategory.set(c.categoryId, list);
  }

  const percentile = new Map<number, number>();
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.popularity - b.popularity);
    list.forEach((c, i) =>
      percentile.set(c.id, list.length > 1 ? i / (list.length - 1) : 1),
    );
  }
  return percentile;
}

function textScore(
  candidate: RelevanceCandidate,
  query: string,
  terms: string[],
): number {
  const name = candidate.name.toLowerCase();
  const brand = candidate.brand.name.toLowerCase();
  const sku = candidate.sku.toLowerCase();
  const words = name.split(/[\s()/,-]+/).filter(Boolean);

  let score = 0;
  for (const term of terms) {
    if (words.includes(term)) score += 3;
    else if (words.some((w) => w.startsWith(term))) score += 2;
    else if (name.includes(term)) score += 1;
    if (brand === term) score += 1.5;
    if (sku.includes(term)) score += 1;
  }
  if (terms.length > 1 && name.includes(query)) score += 4;
  if (name.startsWith(query) || name.startsWith(`${brand} ${query}`))
    score += 2;
  return score;
}

/** Renvoie les identifiants triés du plus pertinent au moins pertinent. */
export function relevanceOrder(
  candidates: RelevanceCandidate[],
  rawQuery = '',
  now = Date.now(),
): number[] {
  const query = rawQuery.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const seed = Math.floor(now / DAY_MS);
  const percentile = popularityPercentiles(candidates);

  const scored = candidates.map((c) => {
    let score =
      (percentile.get(c.id) ?? 0) * 2 +
      jitter(c.id, seed) * 1.5 +
      (c.stockQuantity > 0 ? 1 : 0);
    if (terms.length) score += textScore(c, query, terms) * 3;
    return { id: c.id, score };
  });

  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  return scored.map((s) => s.id);
}
