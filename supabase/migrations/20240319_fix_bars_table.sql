-- Drop existing bars table if it exists
DROP TABLE IF EXISTS bars CASCADE;

-- Create bars table with correct schema
CREATE TABLE bars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_name VARCHAR(255) NOT NULL,
    licensee_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    address TEXT,
    financial_year_start DATE NOT NULL,
    financial_year_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE bars ENABLE ROW LEVEL SECURITY;

-- Create policies for bars
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

CREATE POLICY "Enable delete for authenticated users" ON bars
    FOR DELETE
    TO authenticated
    USING (true);

-- Create trigger for updating timestamps
CREATE TRIGGER update_bars_updated_at
    BEFORE UPDATE ON bars
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 