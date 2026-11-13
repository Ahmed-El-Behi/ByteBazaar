// Textes juridiques du site : conditions générales de vente et politique
// de confidentialité, en français et en anglais (la version française fait foi).
// Les faits cités décrivent le fonctionnement réel du site (paiements,
// livraison, données stockées, sécurité) : les mettre à jour s'il évolue.
// Paragraphes : texte simple, <strong> autorisé (contenu statique, rendu en HTML).

export type LegalDocId = 'terms' | 'privacy';

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
  after?: string[];
}

export interface LegalDoc {
  title: string;
  lead: string;
  summaryTitle: string;
  summary: string[];
  sections: LegalSection[];
}

export const LEGAL_UPDATED = '2026-11-13';
export const LEGAL_CONTACT = 'contact@ByteBazaar.tn';

// Français
const TERMS_FR: LegalDoc = {
  title: 'Conditions générales de vente',
  lead: "Les présentes conditions encadrent l'utilisation du site ByteBazaar et toute commande passée en ligne. Elles sont acceptées par le client lorsqu'il valide sa commande.",
  summaryTitle: "L'essentiel",
  summary: [
    'Prix affichés en dinars tunisiens (TND), toutes taxes comprises.',
    'Livraison partout en Tunisie pour 7 TND par commande.',
    'Paiement à la livraison, par virement bancaire, par carte ou via PayPal.',
    'Droit de rétractation de 10 jours ouvrables à compter de la réception.',
  ],
  sections: [
    {
      id: 'objet',
      title: 'Objet et champ d’application',
      paragraphs: [
        'Les présentes conditions générales de vente (les « Conditions ») régissent les ventes de composants informatiques, de périphériques et d’accessoires conclues à distance entre ByteBazaar (le « Vendeur ») et toute personne physique effectuant un achat sur le site (le « Client »).',
        'Elles s’appliquent à l’exclusion de toutes autres conditions. Le Client déclare en avoir pris connaissance et les accepter sans réserve avant de valider sa commande. Les Conditions applicables sont celles en vigueur à la date de la commande.',
      ],
    },
    {
      id: 'vendeur',
      title: 'Identification du Vendeur',
      paragraphs: [
        'Le site est édité et exploité par <strong>ByteBazaar</strong>, boutique en ligne de composants PC établie à Tunis (Tunisie).',
        'Le Vendeur peut être contacté à l’adresse électronique <strong>contact@ByteBazaar.tn</strong>, du lundi au samedi, de 9 h à 18 h.',
      ],
    },
    {
      id: 'compte',
      title: 'Compte client',
      paragraphs: [
        'La création d’un compte est nécessaire pour passer commande. Le Client s’engage à fournir des informations exactes et à jour (nom, prénom, adresse électronique, téléphone, adresse de livraison).',
        'Le Client est responsable de la confidentialité de son mot de passe et de toute activité réalisée depuis son compte. En cas d’utilisation non autorisée, il en informe sans délai le Vendeur. Le Client peut consulter à tout moment ses commandes, ses adresses et ses configurations enregistrées depuis son espace personnel.',
      ],
    },
    {
      id: 'produits',
      title: 'Produits et informations',
      paragraphs: [
        'Les produits proposés sont décrits avec la plus grande exactitude possible : marque, référence, caractéristiques techniques et disponibilité. Les photographies sont fournies à titre illustratif et n’ont pas de valeur contractuelle.',
        'Le configurateur PC vérifie la compatibilité des composants choisis (socket du processeur, type de mémoire, format de la carte mère et du boîtier, puissance de l’alimentation). Ces indications constituent une aide au choix ; il appartient au Client de s’assurer que les produits commandés correspondent à son usage.',
        'Les offres sont valables dans la limite des stocks disponibles. Le stock affiché est mis à jour en temps réel ; un produit peut toutefois devenir indisponible entre l’ajout au panier et la validation de la commande.',
      ],
    },
    {
      id: 'prix',
      title: 'Prix',
      paragraphs: [
        'Les prix sont indiqués en <strong>dinars tunisiens (TND), toutes taxes comprises</strong>. Les frais de livraison, d’un montant forfaitaire de <strong>7 TND</strong> par commande, sont indiqués séparément dans le panier et au récapitulatif, avant la validation de la commande.',
        'Le Vendeur se réserve le droit de modifier ses prix à tout moment. Les produits sont facturés au prix en vigueur au moment de la validation de la commande.',
      ],
    },
    {
      id: 'commande',
      title: 'Commande',
      paragraphs: ['Le processus de commande comprend les étapes suivantes :'],
      list: [
        'sélection des produits et ajout au panier ;',
        'connexion au compte client ou création d’un compte ;',
        'choix ou saisie de l’adresse de livraison ;',
        'choix du mode de paiement ;',
        'vérification du récapitulatif (produits, quantités, prix, frais de livraison) puis confirmation.',
      ],
      after: [
        'La confirmation de la commande vaut acceptation des présentes Conditions et formation du contrat de vente. Une référence unique est attribuée à chaque commande ; le Client en suit l’évolution (en attente, confirmée, en préparation, expédiée, livrée) depuis son espace « Mes commandes » et est informé par e-mail des changements de statut.',
        'Le Vendeur se réserve le droit d’annuler toute commande en cas de rupture de stock, d’informations de livraison erronées, de défaut de paiement ou de litige antérieur avec le Client. Le Client en est alors informé et, le cas échéant, intégralement remboursé.',
      ],
    },
    {
      id: 'paiement',
      title: 'Paiement',
      paragraphs: ['Le Client règle sa commande selon l’un des modes proposés :'],
      list: [
        '<strong>Paiement à la livraison</strong> : en espèces, au livreur, à la réception du colis ;',
        '<strong>Virement bancaire</strong> : les coordonnées bancaires sont communiquées après validation de la commande, qui est expédiée à réception des fonds ;',
        '<strong>Carte bancaire</strong> (Visa, Mastercard) et <strong>PayPal</strong> : le paiement est traité par le prestataire concerné.',
      ],
      after: [
        'ByteBazaar ne conserve aucune donnée de carte bancaire. En cas d’échec ou d’annulation du paiement, la commande n’est pas expédiée.',
      ],
    },
    {
      id: 'livraison',
      title: 'Livraison',
      paragraphs: [
        'Les produits sont livrés à l’adresse indiquée par le Client, sur l’ensemble du territoire tunisien. Le délai de livraison est communiqué au Client lors de la confirmation de sa commande ; il court à compter de cette confirmation ou, pour un paiement par virement, de la réception des fonds.',
        'À la réception, le Client vérifie l’état du colis en présence du livreur. Toute anomalie (colis endommagé, produit manquant ou abîmé) doit être signalée au livreur et au Vendeur dans les plus brefs délais, au plus tard sous 48 heures, à l’adresse contact@ByteBazaar.tn, photos à l’appui.',
      ],
    },
    {
      id: 'retractation',
      title: 'Droit de rétractation',
      paragraphs: [
        'Conformément à la loi n° 2000-83 du 9 août 2000 relative aux échanges et au commerce électroniques, le Client dispose d’un délai de <strong>dix (10) jours ouvrables</strong> à compter de la réception des produits pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités, hors frais de retour.',
        'Pour l’exercer, le Client adresse sa demande à contact@ByteBazaar.tn en indiquant la référence de sa commande. Les produits sont retournés complets, dans leur emballage d’origine et en parfait état de revente, accompagnés de leurs accessoires et notices. Les frais de retour sont à la charge du Client.',
        'Le Vendeur rembourse les sommes versées dans un délai de dix (10) jours ouvrables à compter de la réception des produits retournés, par le moyen de paiement utilisé lors de l’achat ou, pour un paiement à la livraison, par virement.',
        'Le droit de rétractation ne s’applique pas aux produits confectionnés selon les spécifications du Client ni aux logiciels descellés par le Client, dans les conditions prévues par la loi.',
      ],
    },
    {
      id: 'garanties',
      title: 'Garanties et service après-vente',
      paragraphs: [
        'Les produits vendus sont neufs et d’origine. Ils bénéficient de la garantie légale contre les défauts de conformité et les vices cachés ainsi que, le cas échéant, de la garantie commerciale du constructeur, dont la durée et les conditions figurent dans la documentation du produit.',
        'Pour toute demande de garantie, le Client contacte le service après-vente à contact@ByteBazaar.tn en précisant la référence de sa commande et la nature du problème. La facture ou la référence de commande fait office de preuve d’achat. La garantie ne couvre pas les dommages résultant d’une mauvaise utilisation, d’une installation non conforme, d’une modification du produit ou d’un accident.',
      ],
    },
    {
      id: 'responsabilite',
      title: 'Responsabilité',
      paragraphs: [
        'Le Vendeur est tenu d’une obligation de moyens quant au bon fonctionnement du site. Sa responsabilité ne saurait être engagée en cas d’indisponibilité temporaire du site, de force majeure ou de dommages résultant d’une utilisation des produits non conforme à leur destination ou aux recommandations du constructeur.',
        'Il appartient au Client de sauvegarder ses données avant toute installation ou intervention sur son matériel.',
      ],
    },
    {
      id: 'propriete',
      title: 'Propriété intellectuelle',
      paragraphs: [
        'Les éléments du site (textes, mise en page, logo ByteBazaar, interface du configurateur) sont protégés par le droit de la propriété intellectuelle. Toute reproduction sans autorisation est interdite.',
        'Les marques, noms de produits et logos des fabricants cités sur le site appartiennent à leurs propriétaires respectifs et ne sont utilisés que pour désigner les produits commercialisés.',
      ],
    },
    {
      id: 'donnees',
      title: 'Données personnelles',
      paragraphs: [
        'Les données collectées lors de l’utilisation du site et des commandes sont traitées conformément à la loi organique n° 2004-63 du 27 juillet 2004 portant sur la protection des données à caractère personnel. Les modalités de traitement et les droits du Client sont détaillés dans la <strong>Politique de confidentialité</strong>.',
      ],
    },
    {
      id: 'litiges',
      title: 'Droit applicable et litiges',
      paragraphs: [
        'Les présentes Conditions sont soumises au droit tunisien. En cas de différend, le Client est invité à contacter d’abord le Vendeur afin de rechercher une solution amiable.',
        'À défaut d’accord amiable, le litige est porté devant les juridictions tunisiennes compétentes.',
      ],
    },
    {
      id: 'modifications',
      title: 'Modification des Conditions',
      paragraphs: [
        'Le Vendeur peut modifier les présentes Conditions à tout moment. La version applicable est celle publiée sur le site à la date de la commande ; la date de dernière mise à jour figure en tête de cette page.',
      ],
    },
  ],
};

const PRIVACY_FR: LegalDoc = {
  title: 'Politique de confidentialité',
  lead: 'Cette politique explique quelles données ByteBazaar collecte, pourquoi, combien de temps elles sont conservées et comment exercer vos droits. Nous ne collectons que ce qui est nécessaire au fonctionnement de la boutique.',
  summaryTitle: "L'essentiel",
  summary: [
    'Aucune publicité ciblée, aucun outil de mesure d’audience, aucune revente de données.',
    'Mots de passe chiffrés de manière irréversible ; aucune donnée de carte bancaire conservée.',
    'Données partagées uniquement avec les prestataires nécessaires à votre commande.',
    'Droits d’accès, de rectification et d’opposition conformément à la loi n° 2004-63.',
  ],
  sections: [
    {
      id: 'responsable',
      title: 'Responsable du traitement',
      paragraphs: [
        'Le responsable du traitement des données collectées sur le site est <strong>ByteBazaar</strong>, Tunis (Tunisie), joignable à l’adresse <strong>contact@ByteBazaar.tn</strong>.',
        'Les traitements sont réalisés conformément à la loi organique n° 2004-63 du 27 juillet 2004 portant sur la protection des données à caractère personnel.',
      ],
    },
    {
      id: 'donnees',
      title: 'Données collectées',
      paragraphs: ['Selon votre utilisation du site, nous traitons les données suivantes :'],
      list: [
        '<strong>Compte</strong> : prénom, nom, adresse électronique, numéro de téléphone (facultatif) et mot de passe, conservé uniquement sous forme chiffrée ;',
        '<strong>Livraison</strong> : nom du destinataire, téléphone, adresse, ville, gouvernorat et code postal ;',
        '<strong>Commandes</strong> : produits, quantités, montants, mode de paiement, statut de paiement et de livraison ;',
        '<strong>Activité sur la boutique</strong> : contenu du panier et configurations PC enregistrées ;',
        '<strong>Données techniques</strong> : adresse IP, utilisée temporairement pour limiter les tentatives de connexion répétées.',
      ],
      after: [
        'Les données de carte bancaire ne sont ni transmises à ByteBazaar ni conservées par le site.',
      ],
    },
    {
      id: 'finalites',
      title: 'Finalités et bases du traitement',
      paragraphs: ['Vos données sont utilisées pour :'],
      list: [
        'créer et gérer votre compte client ;',
        'traiter, préparer, livrer et suivre vos commandes, et vous en informer par e-mail ;',
        'gérer les paiements, les retours, les remboursements et le service après-vente ;',
        'conserver votre panier et vos configurations PC ;',
        'assurer la sécurité du site et prévenir la fraude ;',
        'respecter nos obligations légales, notamment comptables et fiscales.',
      ],
      after: [
        'Ces traitements reposent sur l’exécution de votre commande, sur votre consentement lors de la création du compte et sur nos obligations légales. Nous n’utilisons pas vos données à des fins de prospection commerciale sans votre accord.',
      ],
    },
    {
      id: 'destinataires',
      title: 'Destinataires des données',
      paragraphs: [
        'Vos données sont accessibles aux seules personnes habilitées de ByteBazaar, dans la limite de leurs attributions. Elles peuvent être communiquées, pour ce qui est strictement nécessaire, à :',
      ],
      list: [
        'le transporteur chargé de la livraison (nom, téléphone, adresse) ;',
        'les prestataires de paiement (PayPal, prestataire de paiement par carte) lorsque vous choisissez ces modes de paiement ;',
        'notre prestataire d’envoi d’e-mails (confirmation de compte, suivi de commande, réinitialisation du mot de passe) ;',
        'les autorités, sur demande légalement fondée.',
      ],
      after: ['ByteBazaar ne vend ni ne loue vos données personnelles.'],
    },
    {
      id: 'stockage',
      title: 'Cookies et stockage local',
      paragraphs: [
        'ByteBazaar n’utilise <strong>aucun cookie publicitaire ni outil de mesure d’audience</strong>. Le site enregistre uniquement dans votre navigateur (stockage local) les éléments nécessaires à son fonctionnement :',
      ],
      list: [
        'votre jeton de session lorsque vous êtes connecté (valable 7 jours) ;',
        'le contenu de votre panier lorsque vous n’êtes pas connecté ;',
        'vos préférences d’affichage : thème clair ou sombre, langue, mode performance du configurateur ;',
        'votre sélection en cours dans le configurateur PC.',
      ],
      after: [
        'Ces informations restent sur votre appareil ; vous pouvez les supprimer à tout moment depuis les réglages de votre navigateur. Les polices de caractères du site sont chargées depuis le service Google Fonts, ce qui implique la transmission de votre adresse IP à Google lors de leur téléchargement.',
      ],
    },
    {
      id: 'conservation',
      title: 'Durées de conservation',
      list: [
        '<strong>Compte client</strong> : jusqu’à sa suppression à votre demande ;',
        '<strong>Commandes et factures</strong> : pendant la durée imposée par les obligations comptables et fiscales ;',
        '<strong>Panier et configurations enregistrées</strong> : tant que votre compte est actif ;',
        '<strong>Adresse IP</strong> (limitation des tentatives) : quelques minutes, sans enregistrement durable.',
      ],
    },
    {
      id: 'securite',
      title: 'Sécurité',
      paragraphs: [
        'Nous mettons en œuvre des mesures techniques adaptées pour protéger vos données :',
      ],
      list: [
        'mots de passe chiffrés de manière irréversible (algorithme scrypt, avec un sel propre à chaque compte) ;',
        'sessions limitées dans le temps et automatiquement révoquées après un changement de mot de passe ;',
        'liens de réinitialisation du mot de passe valables 15 minutes et utilisables une seule fois ;',
        'nombre de tentatives de connexion, d’inscription et de réinitialisation limité par adresse IP ;',
        'accès aux outils d’administration réservé aux comptes habilités, vérifié à chaque requête.',
      ],
      after: [
        'Aucun système n’étant infaillible, nous vous recommandons d’utiliser un mot de passe unique et robuste et de vous déconnecter après utilisation sur un appareil partagé.',
      ],
    },
    {
      id: 'droits',
      title: 'Vos droits',
      paragraphs: [
        'Conformément à la loi organique n° 2004-63, vous disposez d’un droit d’accès, de rectification et d’opposition au traitement de vos données, ainsi que du droit d’en demander la suppression lorsqu’elles ne sont plus nécessaires.',
        'Vous pouvez modifier directement vos informations personnelles et vos adresses depuis votre espace « Mon compte ». Pour toute autre demande, écrivez à <strong>contact@ByteBazaar.tn</strong> en précisant l’adresse électronique de votre compte ; une preuve d’identité pourra vous être demandée.',
        'Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l’<strong>Instance nationale de protection des données personnelles (INPDP)</strong>.',
      ],
    },
    {
      id: 'mineurs',
      title: 'Mineurs',
      paragraphs: [
        'Le site s’adresse aux personnes majeures. Un mineur ne peut créer de compte ni passer commande qu’avec l’accord de son représentant légal.',
      ],
    },
    {
      id: 'modifications',
      title: 'Modification de la politique',
      paragraphs: [
        'Cette politique peut être mise à jour pour tenir compte de l’évolution du site ou de la réglementation. La date de dernière mise à jour figure en tête de cette page ; en cas de changement important, vous en serez informé.',
      ],
    },
  ],
};

// English
const TERMS_EN: LegalDoc = {
  title: 'Terms and Conditions of Sale',
  lead: 'These terms govern the use of the ByteBazaar website and any order placed online. The customer accepts them when confirming an order.',
  summaryTitle: 'At a glance',
  summary: [
    'Prices shown in Tunisian dinars (TND), all taxes included.',
    'Delivery throughout Tunisia for 7 TND per order.',
    'Cash on delivery, bank transfer, card or PayPal.',
    'Right of withdrawal of 10 working days from receipt.',
  ],
  sections: [
    {
      id: 'objet',
      title: 'Purpose and scope',
      paragraphs: [
        'These general terms and conditions of sale (the “Terms”) govern distance sales of computer components, peripherals and accessories concluded between ByteBazaar (the “Seller”) and any natural person making a purchase on the website (the “Customer”).',
        'They apply to the exclusion of any other terms. The Customer declares having read and accepted them without reservation before confirming their order. The applicable Terms are those in force on the date of the order.',
      ],
    },
    {
      id: 'vendeur',
      title: 'Seller identification',
      paragraphs: [
        'The website is published and operated by <strong>ByteBazaar</strong>, an online PC components shop based in Tunis (Tunisia).',
        'The Seller can be contacted by email at <strong>contact@ByteBazaar.tn</strong>, Monday to Saturday, 9 am to 6 pm.',
      ],
    },
    {
      id: 'compte',
      title: 'Customer account',
      paragraphs: [
        'An account is required to place an order. The Customer undertakes to provide accurate and up-to-date information (first name, last name, email address, phone number, delivery address).',
        'The Customer is responsible for keeping their password confidential and for any activity carried out from their account. In the event of unauthorised use, they inform the Seller without delay. The Customer can view their orders, addresses and saved configurations at any time from their personal area.',
      ],
    },
    {
      id: 'produits',
      title: 'Products and information',
      paragraphs: [
        'Products are described as accurately as possible: brand, reference, technical specifications and availability. Photographs are provided for illustration purposes only and are not contractually binding.',
        'The PC configurator checks the compatibility of the selected components (processor socket, memory type, motherboard and case form factor, power supply wattage). This information is provided as guidance; it is the Customer’s responsibility to make sure that the products ordered suit their intended use.',
        'Offers are valid while stocks last. Displayed stock is updated in real time; however, a product may become unavailable between being added to the cart and the order being confirmed.',
      ],
    },
    {
      id: 'prix',
      title: 'Prices',
      paragraphs: [
        'Prices are shown in <strong>Tunisian dinars (TND), all taxes included</strong>. Delivery costs, a flat fee of <strong>7 TND</strong> per order, are shown separately in the cart and in the order summary, before the order is confirmed.',
        'The Seller reserves the right to change its prices at any time. Products are invoiced at the price in force when the order is confirmed.',
      ],
    },
    {
      id: 'commande',
      title: 'Orders',
      paragraphs: ['The ordering process consists of the following steps:'],
      list: [
        'selecting products and adding them to the cart;',
        'logging in to the customer account or creating one;',
        'choosing or entering the delivery address;',
        'choosing the payment method;',
        'checking the summary (products, quantities, prices, delivery costs), then confirming.',
      ],
      after: [
        'Confirming the order constitutes acceptance of these Terms and the formation of the sales contract. Each order is given a unique reference; the Customer can follow its progress (pending, confirmed, being prepared, shipped, delivered) from the “My orders” area and is notified of status changes by email.',
        'The Seller reserves the right to cancel any order in the event of a stock shortage, incorrect delivery information, non-payment or a previous dispute with the Customer. The Customer is then informed and, where applicable, refunded in full.',
      ],
    },
    {
      id: 'paiement',
      title: 'Payment',
      paragraphs: ['The Customer pays for their order using one of the methods offered:'],
      list: [
        '<strong>Cash on delivery</strong>: in cash, to the courier, when the parcel is received;',
        '<strong>Bank transfer</strong>: bank details are provided once the order is confirmed, and the order is shipped once the funds are received;',
        '<strong>Bank card</strong> (Visa, Mastercard) and <strong>PayPal</strong>: payment is processed by the relevant provider.',
      ],
      after: [
        'ByteBazaar does not store any bank card data. If a payment fails or is cancelled, the order is not shipped.',
      ],
    },
    {
      id: 'livraison',
      title: 'Delivery',
      paragraphs: [
        'Products are delivered to the address provided by the Customer, anywhere in Tunisia. The delivery time is communicated to the Customer when their order is confirmed; it runs from that confirmation or, for payment by bank transfer, from receipt of the funds.',
        'On receipt, the Customer checks the condition of the parcel in the presence of the courier. Any anomaly (damaged parcel, missing or damaged product) must be reported to the courier and to the Seller as soon as possible, and no later than 48 hours, at contact@ByteBazaar.tn, with photographs.',
      ],
    },
    {
      id: 'retractation',
      title: 'Right of withdrawal',
      paragraphs: [
        'In accordance with Law No. 2000-83 of 9 August 2000 on electronic exchanges and commerce, the Customer has <strong>ten (10) working days</strong> from receipt of the products to exercise their right of withdrawal, without having to give reasons or pay penalties, except for return costs.',
        'To exercise it, the Customer sends their request to contact@ByteBazaar.tn, stating their order reference. Products must be returned complete, in their original packaging and in perfect condition for resale, together with their accessories and manuals. Return costs are borne by the Customer.',
        'The Seller refunds the amounts paid within ten (10) working days of receiving the returned products, using the payment method used for the purchase or, for cash on delivery, by bank transfer.',
        'The right of withdrawal does not apply to products made to the Customer’s specifications or to software unsealed by the Customer, under the conditions provided for by law.',
      ],
    },
    {
      id: 'garanties',
      title: 'Warranties and after-sales service',
      paragraphs: [
        'The products sold are new and genuine. They are covered by the legal guarantee against lack of conformity and hidden defects and, where applicable, by the manufacturer’s commercial warranty, whose duration and conditions are set out in the product documentation.',
        'For any warranty claim, the Customer contacts the after-sales service at contact@ByteBazaar.tn, stating their order reference and the nature of the problem. The invoice or order reference serves as proof of purchase. The warranty does not cover damage resulting from misuse, improper installation, modification of the product or an accident.',
      ],
    },
    {
      id: 'responsabilite',
      title: 'Liability',
      paragraphs: [
        'The Seller is bound by a best-efforts obligation regarding the proper functioning of the website. It cannot be held liable for temporary unavailability of the website, force majeure or damage resulting from use of the products that does not comply with their intended purpose or the manufacturer’s recommendations.',
        'The Customer is responsible for backing up their data before any installation or work on their equipment.',
      ],
    },
    {
      id: 'propriete',
      title: 'Intellectual property',
      paragraphs: [
        'The elements of the website (texts, layout, ByteBazaar logo, configurator interface) are protected by intellectual property law. Any reproduction without authorisation is prohibited.',
        'Manufacturers’ trademarks, product names and logos mentioned on the website belong to their respective owners and are used solely to identify the products sold.',
      ],
    },
    {
      id: 'donnees',
      title: 'Personal data',
      paragraphs: [
        'Data collected when using the website and placing orders is processed in accordance with Organic Law No. 2004-63 of 27 July 2004 on the protection of personal data. Processing arrangements and the Customer’s rights are detailed in the <strong>Privacy Policy</strong>.',
      ],
    },
    {
      id: 'litiges',
      title: 'Governing law and disputes',
      paragraphs: [
        'These Terms are governed by Tunisian law. In the event of a dispute, the Customer is invited to contact the Seller first in order to seek an amicable solution.',
        'Failing an amicable agreement, the dispute shall be brought before the competent Tunisian courts.',
      ],
    },
    {
      id: 'modifications',
      title: 'Changes to the Terms',
      paragraphs: [
        'The Seller may change these Terms at any time. The applicable version is the one published on the website on the date of the order; the date of the last update appears at the top of this page.',
      ],
    },
  ],
};

const PRIVACY_EN: LegalDoc = {
  title: 'Privacy Policy',
  lead: 'This policy explains what data ByteBazaar collects, why, how long it is kept and how to exercise your rights. We only collect what is necessary to run the shop.',
  summaryTitle: 'At a glance',
  summary: [
    'No targeted advertising, no audience measurement tools, no resale of data.',
    'Passwords irreversibly encrypted; no bank card data stored.',
    'Data shared only with the providers needed for your order.',
    'Rights of access, rectification and objection under Law No. 2004-63.',
  ],
  sections: [
    {
      id: 'responsable',
      title: 'Data controller',
      paragraphs: [
        'The controller of the data collected on the website is <strong>ByteBazaar</strong>, Tunis (Tunisia), reachable at <strong>contact@ByteBazaar.tn</strong>.',
        'Processing is carried out in accordance with Organic Law No. 2004-63 of 27 July 2004 on the protection of personal data.',
      ],
    },
    {
      id: 'donnees',
      title: 'Data collected',
      paragraphs: ['Depending on how you use the website, we process the following data:'],
      list: [
        '<strong>Account</strong>: first name, last name, email address, phone number (optional) and password, stored only in encrypted form;',
        '<strong>Delivery</strong>: recipient’s name, phone, address, city, governorate and postal code;',
        '<strong>Orders</strong>: products, quantities, amounts, payment method, payment and delivery status;',
        '<strong>Shop activity</strong>: cart contents and saved PC configurations;',
        '<strong>Technical data</strong>: IP address, used temporarily to limit repeated login attempts.',
      ],
      after: ['Bank card data is neither sent to ByteBazaar nor stored by the website.'],
    },
    {
      id: 'finalites',
      title: 'Purposes and legal bases',
      paragraphs: ['Your data is used to:'],
      list: [
        'create and manage your customer account;',
        'process, prepare, deliver and track your orders, and keep you informed by email;',
        'handle payments, returns, refunds and after-sales service;',
        'keep your cart and your PC configurations;',
        'ensure the security of the website and prevent fraud;',
        'comply with our legal obligations, in particular accounting and tax obligations.',
      ],
      after: [
        'This processing is based on the performance of your order, on your consent when creating your account and on our legal obligations. We do not use your data for marketing purposes without your consent.',
      ],
    },
    {
      id: 'destinataires',
      title: 'Recipients of the data',
      paragraphs: [
        'Your data is accessible only to authorised ByteBazaar staff, within the limits of their duties. It may be disclosed, to the extent strictly necessary, to:',
      ],
      list: [
        'the carrier responsible for delivery (name, phone, address);',
        'payment providers (PayPal, card payment provider) when you choose these payment methods;',
        'our email delivery provider (account confirmation, order tracking, password reset);',
        'the authorities, upon a legally founded request.',
      ],
      after: ['ByteBazaar does not sell or rent your personal data.'],
    },
    {
      id: 'stockage',
      title: 'Cookies and local storage',
      paragraphs: [
        'ByteBazaar uses <strong>no advertising cookies and no audience measurement tools</strong>. The website only stores in your browser (local storage) what it needs to work:',
      ],
      list: [
        'your session token when you are logged in (valid for 7 days);',
        'the contents of your cart when you are not logged in;',
        'your display preferences: light or dark theme, language, configurator performance mode;',
        'your current selection in the PC configurator.',
      ],
      after: [
        'This information stays on your device; you can delete it at any time from your browser settings. The website’s fonts are loaded from the Google Fonts service, which means your IP address is sent to Google when they are downloaded.',
      ],
    },
    {
      id: 'conservation',
      title: 'Retention periods',
      list: [
        '<strong>Customer account</strong>: until it is deleted at your request;',
        '<strong>Orders and invoices</strong>: for the period required by accounting and tax obligations;',
        '<strong>Cart and saved configurations</strong>: as long as your account is active;',
        '<strong>IP address</strong> (attempt limiting): a few minutes, with no permanent record.',
      ],
    },
    {
      id: 'securite',
      title: 'Security',
      paragraphs: ['We implement appropriate technical measures to protect your data:'],
      list: [
        'passwords irreversibly encrypted (scrypt algorithm, with a salt unique to each account);',
        'time-limited sessions, automatically revoked after a password change;',
        'password reset links valid for 15 minutes and usable only once;',
        'number of login, sign-up and reset attempts limited per IP address;',
        'access to administration tools restricted to authorised accounts and checked on every request.',
      ],
      after: [
        'As no system is infallible, we recommend using a unique, strong password and logging out after use on a shared device.',
      ],
    },
    {
      id: 'droits',
      title: 'Your rights',
      paragraphs: [
        'Under Organic Law No. 2004-63, you have the right to access, rectify and object to the processing of your data, as well as the right to request its deletion when it is no longer necessary.',
        'You can update your personal information and addresses directly from your “My account” area. For any other request, write to <strong>contact@ByteBazaar.tn</strong>, stating the email address of your account; proof of identity may be requested.',
        'If you believe your rights have not been respected, you may refer the matter to the <strong>National Authority for the Protection of Personal Data (INPDP)</strong>.',
      ],
    },
    {
      id: 'mineurs',
      title: 'Minors',
      paragraphs: [
        'The website is intended for adults. A minor may only create an account or place an order with the consent of their legal guardian.',
      ],
    },
    {
      id: 'modifications',
      title: 'Changes to this policy',
      paragraphs: [
        'This policy may be updated to reflect changes to the website or to regulations. The date of the last update appears at the top of this page; you will be informed of any significant change.',
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocId, { fr: LegalDoc; en: LegalDoc }> = {
  terms: { fr: TERMS_FR, en: TERMS_EN },
  privacy: { fr: PRIVACY_FR, en: PRIVACY_EN },
};
