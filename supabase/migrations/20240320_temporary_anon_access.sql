-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON bars;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON bars;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON bars;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON bar_users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON bar_users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON bar_users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON brands;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON brands;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON brands;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON parties;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON parties;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON parties;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON inventory;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inventory;
DROP POLICY IF EXISTS "Allow authenticated users full access to transport_permits" ON transport_permits;
DROP POLICY IF EXISTS "Allow authenticated users full access to tp_items" ON tp_items;

-- Create new policies for all tables to allow anonymous access
CREATE POLICY "Enable anonymous access" ON bars
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable anonymous access" ON bar_users
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable anonymous access" ON brands
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable anonymous access" ON parties
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable anonymous access" ON customers
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable anonymous access" ON inventory
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable anonymous access" ON transport_permits
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable anonymous access" ON tp_items
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true); 