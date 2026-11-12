11/11
/**
 * ==============================================================================
 * RECAPITULATIF DES MISES A JOUR & EVOLUTIONS DU PROJET (BYTEBAZAAR)
 * ==============================================================================
 *
 * 1. DESIGN & ERGONOMIE GENERALES (FRONTEND ANGULAR) :
 *    - Footer complet et restructuré (liens d'information, réseaux sociaux, thématisation clair/sombre).
 *    - Création des pages d'information réactives (/a-propos et /contact) avec ombrages portés adaptés.
 *    - Suppression des soulignements brutaux sur les liens interactifs au profit d'un effet lumineux au survol (brightness hover).
 *    - Modernisation des icônes SVG globales dans app.html (panier d'achat, bouton de déconnexion).
 *
 * 2. COMPTE CLIENT & TUNNEL D'ACHAT (FRONTEND ANGULAR) :
 *    - Espace client (/compte) optimisé et polished (profil, commandes, configurations).
 *    - Intégration du garde de navigation `pendingChangesGuard` sur la modification du profil.
 *    - Ajout des miniatures d'images produits dans tout le tunnel d'achat :
 *      -> Panier (CartPage)
 *      -> Récapitulatif de commande (CheckoutPage)
 *      -> Détail / Confirmation de commande (OrderDetailPage)
 *
 * 3. FLUX DE REINITIALISATION DE MOT DE PASSE (BACKEND NESTJS & FRONTEND) :
 *    - Backend (NestJS / Prisma) :
 *      -> Route POST /auth/forgot-password : Vérification email Prisma, gestion de l'erreur 404 et génération d'un JWT temporaire (15 min).
 *      -> Route POST /auth/reset-password : Validation du token JWT, typage strict et hachage du nouveau mot de passe.
 *    - Service Mail SMTP (Gmail) :
 *      -> Méthode `sendPasswordResetEmail` intégrée dans MailService via @nestjs-modules/mailer sans altérer l'existant (mails de bienvenue et notifications de statut).
 *    - Frontend (Angular) :
 *      -> Composant `ResetPasswordPage` avec barre de mesure de la robustesse du mot de passe en temps réel.
 *      -> Capture automatique du token dans l'URL (?token=...).
 *      -> Alignement des routes Angular (app.routes.ts) pour /reset-password avec alias de secours /nouveau-mot-de-passe.
 *
 * 4. ETANCHEITE & SECURITE DES FORMULAIRES :
 *    - Ajout du bouton d'affichage/masquage du mot de passe (icône œil SVG + signals Angular) sur les formulaires de Connexion et de Réinitialisation.
 *
 * 5. NETTOYAGE & SECURISATION (12/11/2026) :
 *    - Routes /admin réservées au rôle ADMIN (rôle relu en base à chaque requête).
 *    - Commande : réservation du stock atomique (plus de survente), produits désactivés refusés.
 *    - Statuts de commande : progression uniquement vers l'avant, Annulée / Livrée définitifs
 *      (une annulation ne remet plus le stock deux fois).
 *    - Mot de passe oublié : réponse identique que l'email existe ou non, lien à usage unique,
 *      déconnexion des anciennes sessions après réinitialisation, limitation des tentatives.
 *    - Catalogue : noms normalisés (marque + puce + série + mémoire, capacité, puissance...),
 *      1 241 produits obsolètes supprimés, tri « Pertinence » par défaut.
 *    - Import du catalogue (npm run seed) : ~10 s au lieu de ~50 min.
 *    - Voir README.md pour l'installation.
 * ==============================================================================
 */
