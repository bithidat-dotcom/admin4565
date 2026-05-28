export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  images: string[];
  discount: number;
  seller?: string;
  category?: string;
  created_at: string;
  stock?: number;
  sold?: number;
}

export interface Order {
  id: string;
  customer_name: string;
  whatsapp_number: string;
  location: string;
  price: number;
  product_details: string;
  product_name?: string;
  quantity?: number | string;
  user_id?: string;
  cancelled_by?: 'user' | 'admin';
  status: 'pending' | 'packing' | 'shipping' | 'delivered' | 'completed' | 'cancelled';
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

export interface User {
  id: string;
  name: string;
  whatsapp_number: string;
  location: string;
  email?: string;
  total_orders?: number;
  total_spent?: number;
  wallet_balance?: number;
  last_login?: string;
  created_at: string;
}

export type View = 'dashboard' | 'products' | 'orders' | 'banners' | 'reviews' | 'users';
