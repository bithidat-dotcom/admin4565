-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- 1. Ensure the products table has the 'seller' column
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS seller TEXT;

-- 2. Ensure RLS is enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing permissive policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Allow all on products" ON public.products;

-- 4. Create a robust permissive policy for public access (Admin style)
-- This allows anyone with the Anon key to Read, Insert, Update, and Delete products.
CREATE POLICY "Allow all on products" 
ON public.products 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- 5. Refresh schema cache
-- (Running this in the SQL editor forces PostgREST to reload the schema)
NOTIFY pgrst, 'reload schema';
