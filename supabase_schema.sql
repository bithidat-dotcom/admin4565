-- SUPABASE DATABASE SETUP & POLICIES
-- This SQL script ensures tables are formatted correctly,
-- RLS policies are permissive to fix any Deletion failures,
-- and inserts a robust Auditing & History system for products.

-- 1. Ensure Table Structure for Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    description TEXT,
    image TEXT,
    images TEXT[] DEFAULT '{}',
    discount NUMERIC DEFAULT 0,
    type TEXT,
    seller TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ensure Table Structure for Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    location TEXT NOT NULL,
    product_name TEXT NOT NULL, -- Supports multi-products e.g., 'Cloth x 2, Laptop x 1' or 'Mobile (3) + T-Shirts (1)'
    price NUMERIC NOT NULL, -- Represents the products subtotal
    status TEXT DEFAULT 'pending'::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Template SQL query to send/insert new multi-product orders:
-- INSERT INTO public.orders (customer_name, whatsapp, location, product_name, price)
-- VALUES ('Zahid Hasan', '+8801700000000', 'Dhaka, Bangladesh', 'Cloth x 3, Laptop x 1', 4500);

-- 3. Ensure Table Structure for Banners
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image TEXT NOT NULL,
    ad_link TEXT DEFAULT NULL,
    ad_title TEXT DEFAULT NULL,
    is_ad BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS) on all tables (if not already enabled)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing RLS policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public select" ON public.products;
DROP POLICY IF EXISTS "Allow public insert" ON public.products;
DROP POLICY IF EXISTS "Allow public update" ON public.products;
DROP POLICY IF EXISTS "Allow public delete" ON public.products;
DROP POLICY IF EXISTS "Allow all for anonymous" ON public.products;

DROP POLICY IF EXISTS "Allow public select" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert" ON public.orders;
DROP POLICY IF EXISTS "Allow public update" ON public.orders;
DROP POLICY IF EXISTS "Allow public delete" ON public.orders;
DROP POLICY IF EXISTS "Allow all for anonymous" ON public.orders;

DROP POLICY IF EXISTS "Allow public select" ON public.banners;
DROP POLICY IF EXISTS "Allow public insert" ON public.banners;
DROP POLICY IF EXISTS "Allow public update" ON public.banners;
DROP POLICY IF EXISTS "Allow public delete" ON public.banners;
DROP POLICY IF EXISTS "Allow all for anonymous" ON public.banners;

-- 6. Recreate robust policies allowing all CRUD operations for the application
DROP POLICY IF EXISTS "Allow all on products" ON public.products;
DROP POLICY IF EXISTS "Allow all on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all on banners" ON public.banners;

DROP POLICY IF EXISTS "Allow public select on products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert on products" ON public.products;
DROP POLICY IF EXISTS "Allow public update on products" ON public.products;
DROP POLICY IF EXISTS "Allow public delete on products" ON public.products;

DROP POLICY IF EXISTS "Allow public select on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public delete on orders" ON public.orders;

DROP POLICY IF EXISTS "Allow public select on banners" ON public.banners;
DROP POLICY IF EXISTS "Allow public insert on banners" ON public.banners;
DROP POLICY IF EXISTS "Allow public update on banners" ON public.banners;
DROP POLICY IF EXISTS "Allow public delete on banners" ON public.banners;

-- Explicit policies for Products
CREATE POLICY "Allow public select on products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public insert on products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on products" ON public.products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on products" ON public.products FOR DELETE USING (true);

-- Explicit policies for Orders
CREATE POLICY "Allow public select on orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert on orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on orders" ON public.orders FOR DELETE USING (true);

-- Explicit policies for Banners
CREATE POLICY "Allow public select on banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Allow public insert on banners" ON public.banners FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on banners" ON public.banners FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on banners" ON public.banners FOR DELETE USING (true);

-- 7. Create Products History table to track changes automatically
CREATE TABLE IF NOT EXISTS public.products_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    action TEXT NOT NULL, -- 'CREATED', 'UPDATED', 'DELETED'
    changed_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for history
ALTER TABLE public.products_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on products_history" ON public.products_history;
DROP POLICY IF EXISTS "Allow public select on products_history" ON public.products_history;
DROP POLICY IF EXISTS "Allow public insert on products_history" ON public.products_history;
DROP POLICY IF EXISTS "Allow public delete on products_history" ON public.products_history;

CREATE POLICY "Allow public select on products_history" ON public.products_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on products_history" ON public.products_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on products_history" ON public.products_history FOR DELETE USING (true);

-- 8. Create trigger function to automatically log changes in history table
CREATE OR REPLACE FUNCTION public.log_product_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.products_history (product_id, product_name, action, changed_data)
        VALUES (
            NEW.id::text,
            NEW.name,
            'CREATED',
            jsonb_build_object(
                'price', NEW.price,
                'type', NEW.type,
                'seller', NEW.seller,
                'discount', NEW.discount
            )
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.products_history (product_id, product_name, action, changed_data)
        VALUES (
            NEW.id::text,
            NEW.name,
            'UPDATED',
            jsonb_build_object(
                'old_price', OLD.price,
                'new_price', NEW.price,
                'old_type', OLD.type,
                'new_type', NEW.type,
                'old_seller', OLD.seller,
                'new_seller', NEW.seller,
                'old_discount', OLD.discount,
                'new_discount', NEW.discount
            )
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.products_history (product_id, product_name, action, changed_data)
        VALUES (
            OLD.id::text,
            OLD.name,
            'DELETED',
            jsonb_build_object(
                'price', OLD.price,
                'type', OLD.type,
                'seller', OLD.seller,
                'discount', OLD.discount
            )
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Bind trigger to Products table
DROP TRIGGER IF EXISTS tr_log_product_history ON public.products;
CREATE TRIGGER tr_log_product_history
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_product_history();

-- 10. Ensure Table Structure for Reviews and Likes
CREATE TABLE IF NOT EXISTS public.product_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_ip TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (product_id, user_ip)
);

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_review_replies (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  review_id BIGINT NOT NULL,
  reply_user TEXT NOT NULL,
  reply_comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on new tables
ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_review_replies ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access on likes" ON public.product_likes;
DROP POLICY IF EXISTS "Allow public insert access on likes" ON public.product_likes;
DROP POLICY IF EXISTS "Allow public delete access on likes" ON public.product_likes;

DROP POLICY IF EXISTS "Allow public read access on reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Allow public insert access on reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Allow public delete access on reviews" ON public.product_reviews;

DROP POLICY IF EXISTS "Allow public read access on replies" ON public.product_review_replies;
DROP POLICY IF EXISTS "Allow public insert access on replies" ON public.product_review_replies;
DROP POLICY IF EXISTS "Allow public delete access on replies" ON public.product_review_replies;

-- Recreate robust policies allowing all CRUD operations for the application
CREATE POLICY "Allow public read access on likes" ON public.product_likes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on likes" ON public.product_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on likes" ON public.product_likes FOR DELETE USING (true);

CREATE POLICY "Allow public read access on reviews" ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on reviews" ON public.product_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on reviews" ON public.product_reviews FOR DELETE USING (true);

CREATE POLICY "Allow public read access on replies" ON public.product_review_replies FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on replies" ON public.product_review_replies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access on replies" ON public.product_review_replies FOR DELETE USING (true);


-- 11. Create Orders History / Archiving Log Table
CREATE TABLE IF NOT EXISTS public.orders_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    location TEXT NOT NULL,
    product_name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    status TEXT NOT NULL,
    action TEXT NOT NULL, -- 'CREATED', 'COMPLETED', 'CANCELLED', 'UPDATED', 'DELETED'
    changed_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for orders logging
ALTER TABLE public.orders_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select on orders_history" ON public.orders_history;
DROP POLICY IF EXISTS "Allow public insert on orders_history" ON public.orders_history;
DROP POLICY IF EXISTS "Allow public delete on orders_history" ON public.orders_history;

CREATE POLICY "Allow public select on orders_history" ON public.orders_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on orders_history" ON public.orders_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on orders_history" ON public.orders_history FOR DELETE USING (true);

-- 12. Create trigger function to automatically backup / safe-keep deleted, completed, or cancelled orders
CREATE OR REPLACE FUNCTION public.log_order_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.orders_history (order_id, customer_name, whatsapp, location, product_name, price, status, action, changed_data)
        VALUES (
            NEW.id::text,
            NEW.customer_name,
            NEW.whatsapp,
            NEW.location,
            NEW.product_name,
            NEW.price,
            NEW.status,
            'CREATED',
            jsonb_build_object('created_at', NEW.created_at)
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.orders_history (order_id, customer_name, whatsapp, location, product_name, price, status, action, changed_data)
        VALUES (
            NEW.id::text,
            NEW.customer_name,
            NEW.whatsapp,
            NEW.location,
            NEW.product_name,
            NEW.price,
            NEW.status,
            CASE 
                WHEN NEW.status = 'completed' AND OLD.status != 'completed' THEN 'COMPLETED'
                WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN 'CANCELLED'
                ELSE 'UPDATED'
            END,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'old_price', OLD.price,
                'new_price', NEW.price
            )
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.orders_history (order_id, customer_name, whatsapp, location, product_name, price, status, action, changed_data)
        VALUES (
            OLD.id::text,
            OLD.customer_name,
            OLD.whatsapp,
            OLD.location,
            OLD.product_name,
            OLD.price,
            OLD.status,
            'DELETED',
            jsonb_build_object(
                'deleted_at', timezone('utc'::text, now()),
                'final_status', OLD.status
            )
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to Orders table
DROP TRIGGER IF EXISTS tr_log_order_history ON public.orders;
CREATE TRIGGER tr_log_order_history
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_history();


