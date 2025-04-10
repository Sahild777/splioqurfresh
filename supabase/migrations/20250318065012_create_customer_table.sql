-- Create customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) NOT NULL UNIQUE,
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for customer name and license number for faster searches
CREATE INDEX idx_customer_name ON customers(customer_name);
CREATE INDEX idx_license_number ON customers(license_number);
CREATE INDEX idx_customer_bar_id ON customers(bar_id);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to perform all operations
CREATE POLICY "Allow authenticated users full access" ON customers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 