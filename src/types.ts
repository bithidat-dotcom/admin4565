export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  images: string[];
  discount: number;
  seller?: string;
  seller_id?: string;
  seller_logo?: string;
  seller_whatsapp?: string;
  seller_email?: string;
  seller_facebook?: string;
  seller_instagram?: string;
  seller_tiktok?: string;
  category?: string;
  created_at: string;
  stock?: number;
  quantity?: number;
  qty?: number;
  sold?: number;
  gadgetSpecs?: {
    ram?: string;
    storage?: string;
    refreshRate?: string;
    battery?: string;
    watt?: string;
    amp?: string;
  };
  discountExpiresAt?: string;
  is_super_sale?: boolean;
  extra_categories?: string[];
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  seller?: string;
}

export interface Order {
  id: string;
  customer_name: string;
  whatsapp_number: string;
  location: string;
  price: number;
  product_details: string;
  product_name?: string;
  product_image?: string;
  quantity?: number | string;
  seller?: string;
  seller_id?: string;
  seller_logo?: string;
  seller_whatsapp?: string;
  user_id?: string;
  area?: string;
  post_code?: string;
  delivery_charge?: number;
  cancelled_by?: 'user' | 'admin';
  status: 'pending' | 'confirmed' | 'packing' | 'shipping' | 'delivered' | 'completed' | 'cancelled';
  created_at: string;
  items?: OrderItem[];
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

export interface Seller {
  id: string;
  seller_id?: string;
  password?: string;
  pin?: string;
  name: string; // Shop Name
  owner_name?: string;
  logo: string;
  whatsapp_number: string;
  shop_address?: string;
  email?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  role: 'product_seller' | 'food_seller';
  created_at: string;
  is_verified?: boolean;
  rating?: number;
}

export type View = 'dashboard' | 'products' | 'orders' | 'banners' | 'reviews' | 'users' | 'sellers' | 'settings' | 'employees' | 'inventory' | 'offers' | 'analytics' | 'customers' | 'notifications' | 'profile';

export interface InventoryItem {
  id: string;
  item_name: string;
  type: 'product' | 'food';
  stock: number;
  minimum_stock: number;
  sold: number;
  last_updated: string;
}

export interface PromoOffer {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'food' | 'product' | 'combo' | 'flash_sale';
  code?: string;
  description: string;
  discount: number;
  banner?: string;
  start_date: string;
  end_date: string;
  min_order?: number;
  max_discount?: number;
  is_active: boolean;
  created_at: string;
}
