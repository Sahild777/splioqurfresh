-- Drop existing table if it exists
DROP TABLE IF EXISTS brands;

-- Create the brands table with updated structure
CREATE TABLE brands (
    id INT4 GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brand_name TEXT NOT NULL,
    item_code TEXT NOT NULL UNIQUE,
    sizes TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Spirits', 'Wines', 'Fermented Beer', 'Mild Beer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX idx_brands_brand_name ON brands(brand_name);
CREATE INDEX idx_brands_item_code ON brands(item_code);

-- Enable Row Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable all actions for authenticated users only"
    ON brands
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 