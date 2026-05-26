export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  images: string[];
  discount: number;
  created_at: string;
  type?: string;
  seller?: string;
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
  ad_link?: string | null;
  ad_title?: string | null;
  is_ad?: boolean;
  created_at: string;
}

export interface ProductHistoryEntry {
  id: string;
  product_id: string;
  product_name: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  changed_data: {
    price?: number;
    type?: string;
    seller?: string;
    discount?: number;
    old_price?: number;
    new_price?: number;
    old_type?: string;
    new_type?: string;
    old_seller?: string;
    new_seller?: string;
    old_discount?: number;
    new_discount?: number;
  };
  changed_at: string;
}

export interface ProductReview {
  id: number;
  product_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface ReviewReply {
  id: number;
  review_id: number;
  reply_user: string;
  reply_comment: string;
  created_at: string;
}

export interface ProductLike {
  id: string;
  product_id: string;
  user_ip: string;
  created_at: string;
}

export type View = 'dashboard' | 'products' | 'orders' | 'banners' | 'history' | 'reviews';
