-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can insert their own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can update their own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can delete their own inventory" ON inventory;

-- Create open policy for all access
CREATE POLICY "Allow all access to inventory"
    ON inventory FOR ALL
    USING (true)
    WITH CHECK (true);

-- Remove created_by column if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'inventory' AND column_name = 'created_by') THEN
        ALTER TABLE inventory DROP COLUMN created_by;
    END IF;
END $$; 