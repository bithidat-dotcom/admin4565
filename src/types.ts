export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  images: string[];
  discount: number;
  created_at: string;
}

export interface Order {
  id: string;
  customer_name: string;
  whatsapp: string;
  location: string;
  product_name: string;
  price: number;
  status: 'pending' | 'confirmed';
  created_at: string;
}

export interface Banner {
  id: string;
  image: string;
  created_at: string;
}

export type View = 'dashboard' | 'products' | 'orders' | 'banners' | 'history';
