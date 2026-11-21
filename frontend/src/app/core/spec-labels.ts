// Traduction des caractéristiques produit (libellés PCPartPicker en anglais)
// pour la fiche produit. Une caractéristique inconnue s'affiche telle quelle.

export const SPEC_LABELS: Record<string, string> = {
  // Processeurs
  'Core Count': 'Nombre de cœurs',
  'Integrated Graphics': 'Graphique intégré',
  Microarchitecture: 'Microarchitecture',
  'Performance Core Boost Clock': 'Fréquence boost',
  'Performance Core Clock': 'Fréquence de base',
  TDP: 'TDP',
  // Cartes mères
  'Socket / CPU': 'Socket',
  'Memory Max': 'RAM maximale',
  'Memory Slots': 'Emplacements RAM',
  // Mémoire
  'CAS Latency': 'Latence CAS',
  'First Word Latency': 'Latence premier mot',
  Modules: 'Modules',
  Speed: 'Fréquence',
  // Cartes graphiques
  Chipset: 'Puce',
  'Core Clock': 'Fréquence de base',
  'Boost Clock': 'Fréquence boost',
  Memory: 'Mémoire vidéo',
  Length: 'Longueur',
  // Stockage
  Capacity: 'Capacité',
  Cache: 'Cache',
  Interface: 'Interface',
  // Alimentations
  'Efficiency Rating': 'Certification',
  Modular: 'Modulaire',
  Wattage: 'Puissance',
  // Boîtiers
  'External Volume': 'Volume',
  'Internal 3.5" Bays': 'Baies 3,5" internes',
  'Power Supply': 'Alimentation incluse',
  'Side Panel': 'Panneau latéral',
  // Refroidissement
  'Fan RPM': 'Vitesse du ventilateur',
  'Noise Level': 'Niveau sonore',
  'Radiator Size': 'Taille du radiateur',
  // Écrans
  'Screen Size': "Taille d'écran",
  Resolution: 'Résolution',
  'Refresh Rate': 'Fréquence de rafraîchissement',
  'Response Time (G2G)': 'Temps de réponse (G2G)',
  'Panel Type': 'Type de dalle',
  'Aspect Ratio': "Format d'image",
  // Souris / claviers
  'Tracking Method': 'Capteur',
  'Connection Type': 'Connexion',
  'Maximum DPI': 'DPI maximum',
  'Hand Orientation': 'Orientation',
  Style: 'Style',
  'Switch Type': 'Switchs',
  Backlit: 'Rétroéclairage',
  Tenkeyless: 'Sans pavé numérique (TKL)',
  // Casques / enceintes
  Microphone: 'Microphone',
  Wireless: 'Sans fil',
  'Enclosure Type': 'Conception',
  'Frequency Response': 'Réponse en fréquence',
  Configuration: 'Configuration',
  // Webcams
  Resolutions: 'Résolutions',
  Connection: 'Connexion',
  'Focus Type': 'Mise au point',
  'Field of View': 'Champ de vision',
  'Operating System': 'Systèmes compatibles',
  // Communs
  Color: 'Couleur',
  'Form Factor': 'Format',
  Type: 'Type',
};

/** Caractéristiques masquées sur la fiche (prix au Go calculé en euros par la source). */
export const HIDDEN_SPECS = new Set(['Price / GB']);

const VALUE_WORDS: Record<string, string> = {
  Yes: 'Oui',
  No: 'Non',
  None: 'Aucun',
  Full: 'Complète',
  Semi: 'Semi',
  Wired: 'Filaire',
  Wireless: 'Sans fil',
  'Bluetooth Wireless': 'Bluetooth',
  Black: 'Noir',
  White: 'Blanc',
  Gray: 'Gris',
  Grey: 'Gris',
  Silver: 'Argent',
  Red: 'Rouge',
  Blue: 'Bleu',
  Pink: 'Rose',
  Green: 'Vert',
  Purple: 'Violet',
  Yellow: 'Jaune',
  Orange: 'Orange',
  Gold: 'Or',
  Brown: 'Marron',
  Beige: 'Beige',
  Clear: 'Transparent',
  Right: 'Droitier',
  Left: 'Gaucher',
  Both: 'Ambidextre',
  Optical: 'Optique',
  Laser: 'Laser',
  Auto: 'Automatique',
  Manual: 'Manuelle',
  Fixed: 'Fixe',
  Closed: 'Fermé',
  Open: 'Ouvert',
  'Tempered Glass': 'Verre trempé',
  'Tinted Tempered Glass': 'Verre trempé teinté',
  Acrylic: 'Acrylique',
  Mesh: 'Grillagé',
};

/** Traduit les valeurs simples (Oui/Non, couleurs, connexions…), y compris les listes « A / B » ou « A, B ». */
export function translateSpecValue(value: string): string {
  if (VALUE_WORDS[value]) return VALUE_WORDS[value];
  return value
    .split(/(\s*\/\s*|,\s*)/)
    .map((part) => VALUE_WORDS[part] ?? part)
    .join('');
}
