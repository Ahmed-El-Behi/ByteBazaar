import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('Catalogue')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @ApiOperation({
    summary: 'Catégories',
    description: 'Arborescence des catégories, avec le nombre de produits.',
  })
  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  /** Photo de chaque catégorie (tuiles de l'accueil) */
  @ApiOperation({
    summary: 'Photo de chaque catégorie',
    description: 'Tuiles de la page d’accueil.',
  })
  @Get('categories/covers')
  categoryCovers() {
    return this.catalog.categoryCovers();
  }

  @ApiOperation({
    summary: 'Marques',
    description:
      'Marques ayant au moins un produit en vente, par ordre alphabétique.',
  })
  @Get('brands')
  brands() {
    return this.catalog.listBrands();
  }

  // Les filtres sont lus et bornés par le service (valeurs invalides ignorées, jamais d'erreur)
  @ApiOperation({
    summary: 'Liste des produits',
    description:
      'Filtres combinables, tri et pagination. Tri par défaut « Pertinence » : popularité, disponibilité et correspondance avec la recherche.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Recherche (nom du produit ou marque)',
    example: 'rtx 4070',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Slug d’une catégorie ou d’une sous-catégorie',
    example: 'cartes-graphiques',
  })
  @ApiQuery({
    name: 'brand',
    required: false,
    description: 'Slugs de marques séparés par des virgules',
    example: 'asus,msi',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    description: 'Prix minimum en TND',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    description: 'Prix maximum en TND',
  })
  @ApiQuery({
    name: 'inStock',
    required: false,
    enum: ['true'],
    description: 'Uniquement les produits en stock',
  })
  @ApiQuery({
    name: 'socket',
    required: false,
    description: 'Socket processeur / carte mère',
    example: 'AM5',
  })
  @ApiQuery({ name: 'ramType', required: false, enum: ['DDR4', 'DDR5'] })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['relevance', 'newest', 'price_asc', 'price_desc', 'name'],
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 12,
    description: '48 au maximum',
  })
  @Get('products')
  products(@Query() query: Record<string, string | undefined>) {
    return this.catalog.listProducts(query);
  }

  /** Vitrine de l'accueil : 3 produits phares tirés au hasard à chaque appel */
  @ApiOperation({
    summary: 'Vitrine de l’accueil',
    description:
      '3 produits en stock de 3 catégories différentes, tirés au hasard à chaque appel.',
  })
  @Get('products/showcase')
  showcase() {
    return this.catalog.showcase();
  }

  @ApiOperation({
    summary: 'Détail d’un produit',
    description:
      'Caractéristiques, photos, stock, en français ou en anglais selon Accept-Language.',
  })
  @ApiParam({ name: 'slug', example: 'corsair-rm750-22177' })
  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.getProduct(slug);
  }
}
