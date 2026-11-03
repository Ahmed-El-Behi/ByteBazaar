export const API_URL = 'http://localhost:3000';

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface Category {
  id: number;
  slug: string;
  nameFr: string;
  nameEn: string;
}

export interface CategoryNode extends Category {
  children: (Category & { _count: { products: number } })[];
}

export interface ProductListItem {
  id: number;
  sku: string;
  slug: string;
  name: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
  brand: { name: string; slug: string };
  category: { slug: string; nameFr: string; nameEn: string };
  image: { url: string; altText: string | null } | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ProductSpec {
  id: number;
  name: string;
  valueText: string;
  valueNumber: number | null;
  unit: string | null;
}

export interface ProductDetail {
  id: number;
  sku: string;
  slug: string;
  name: string;
  descriptionFr: string;
  descriptionEn: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
  brand: { name: string; slug: string; logoUrl: string | null };
  category: { slug: string; nameFr: string; nameEn: string };
  images: { id: number; url: string; altText: string | null; position: number; isPrimary: boolean }[];
  specs: ProductSpec[];
  technical: ({ kind: string } & Record<string, unknown>) | null;
}