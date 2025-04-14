-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON shortcuts;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON shortcuts;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON shortcuts;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON shortcuts;
DROP POLICY IF EXISTS "Allow all access to shortcuts" ON shortcuts;

-- Create new open access policy
CREATE POLICY "Allow all access to shortcuts"
    ON shortcuts FOR ALL
    USING (true)
    WITH CHECK (true); 