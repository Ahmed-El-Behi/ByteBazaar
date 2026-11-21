import { LEGAL_CONTACT } from './legal-content';

// Identité du vendeur (factures, virement). Valeurs de démonstration : à remplacer par les
// informations réelles de la société avant la mise en production.
export const STORE = {
  name: 'ByteBazaar SARL',
  address: 'Rue du Lac Léman, Les Berges du Lac, 1053 Tunis, Tunisie',
  email: LEGAL_CONTACT,
  phone: '+216 70 000 000',
  taxId: '1234567/A/M/000',
  bank: {
    name: 'Banque Internationale Arabe de Tunisie (BIAT)',
    holder: 'ByteBazaar SARL',
    rib: '08 006 0123456789012 34',
  },
};

/** Taux de TVA appliqué aux composants informatiques en Tunisie ; les prix affichés sont TTC */
export const VAT_RATE = 0.19;

/** Ventilation d'un montant TTC : hors taxes et TVA, arrondis au millime */
export function vatBreakdown(totalTtc: number) {
  const ht = Math.round((totalTtc / (1 + VAT_RATE)) * 1000) / 1000;
  return { ht, vat: Math.round((totalTtc - ht) * 1000) / 1000 };
}
