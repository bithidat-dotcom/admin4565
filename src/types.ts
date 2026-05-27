export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  images: string[];
  discount: number;
  seller?: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_name: string;
  whatsapp_number: string;
  location: string;
  price: number;
  product_details: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
}

export interface Banner {
  id: string;
  title: string;
  image: string;
  created_at: string;
}

export interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  product_name?: string;
  created_at: string;
}

export type View = 'dashboard' | 'products' | 'orders' | 'banners' | 'reviews';
