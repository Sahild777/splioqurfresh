-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their assigned bars" ON bars;
DROP POLICY IF EXISTS "Users can view bar users for their bars" ON bar_users;
DROP POLICY IF EXISTS "Users can view inventory for their bars" ON inventory;
DROP POLICY IF EXISTS "Users can view TP entries for their bars" ON tp_entries;
DROP POLICY IF EXISTS "Users can view sales for their bars" ON daily_sales;

-- Create new policies for bars
CREATE POLICY "Enable read access for authenticated users" ON bars
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON bars
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON bars
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for bar_users
CREATE POLICY "Enable read access for authenticated users" ON bar_users
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON bar_users
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON bar_users
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for brands
CREATE POLICY "Enable read access for authenticated users" ON brands
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON brands
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON brands
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for parties
CREATE POLICY "Enable read access for authenticated users" ON parties
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON parties
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON parties
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for customers
CREATE POLICY "Enable read access for authenticated users" ON customers
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON customers
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON customers
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for inventory
CREATE POLICY "Enable read access for authenticated users" ON inventory
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON inventory
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON inventory
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for tp_entries
CREATE POLICY "Enable read access for authenticated users" ON tp_entries
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON tp_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON tp_entries
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for tp_items
CREATE POLICY "Enable read access for authenticated users" ON tp_items
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON tp_items
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON tp_items
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for daily_sales
CREATE POLICY "Enable read access for authenticated users" ON daily_sales
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON daily_sales
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON daily_sales
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for sale_items
CREATE POLICY "Enable read access for authenticated users" ON sale_items
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sale_items
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON sale_items
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true); 