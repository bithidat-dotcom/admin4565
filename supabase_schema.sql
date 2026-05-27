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
    product_name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending'::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Ensure Table Structure for Banners
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image TEXT NOT NULL,
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
CREATE POLICY "Allow all on products" ON public.products FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on orders" ON public.orders FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on banners" ON public.banners FOR ALL TO public USING (true) WITH CHECK (true);

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
CREATE POLICY "Allow all on products_history" ON public.products_history FOR ALL TO public USING (true) WITH CHECK (true);

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
