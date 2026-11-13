import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Get('brands')
  brands() {
    return this.catalog.listBrands();
  }

  @Get('products')
  products(@Query() query: Record<string, string | undefined>) {
    return this.catalog.listProducts(query);
  }

  /** Vitrine de l'accueil : 3 produits phares tirés au hasard à chaque appel */
  @Get('products/showcase')
  showcase() {
    return this.catalog.showcase();
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.getProduct(slug);
  }
}
