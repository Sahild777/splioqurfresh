-- Create party table
CREATE TABLE parties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    party_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for party name for faster searches
CREATE INDEX idx_party_name ON parties(party_name);

-- Enable Row Level Security (RLS)
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to perform all operations
CREATE POLICY "Allow authenticated users full access" ON parties
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON parties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 