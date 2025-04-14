-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Users can insert their own transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Users can update their own transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Users can delete their own transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Users can view their own tp items" ON tp_items;
DROP POLICY IF EXISTS "Users can insert their own tp items" ON tp_items;
DROP POLICY IF EXISTS "Users can update their own tp items" ON tp_items;
DROP POLICY IF EXISTS "Users can delete their own tp items" ON tp_items;
DROP POLICY IF EXISTS "Public access to transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Public access to tp items" ON tp_items;
DROP POLICY IF EXISTS "Public access to brands" ON brands;
DROP POLICY IF EXISTS "Public access to parties" ON parties;
DROP POLICY IF EXISTS "Public access to bars" ON bars;

-- Modify the created_by column to be nullable
ALTER TABLE transport_permits ALTER COLUMN created_by DROP NOT NULL;

-- Disable RLS for these tables to allow public access
ALTER TABLE transport_permits DISABLE ROW LEVEL SECURITY;
ALTER TABLE tp_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE parties DISABLE ROW LEVEL SECURITY;
ALTER TABLE bars DISABLE ROW LEVEL SECURITY;

-- Create backup policies just in case RLS is re-enabled
CREATE POLICY "Public access to transport permits"
    ON transport_permits FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public access to tp items"
    ON tp_items FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public access to brands"
    ON brands FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public access to parties"
    ON parties FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public access to bars"
    ON bars FOR ALL
    USING (true)
    WITH CHECK (true); 