-- Create TP table
CREATE TABLE transport_permits (
    id SERIAL PRIMARY KEY,
    tp_no VARCHAR(100) NOT NULL UNIQUE,
    party_id INTEGER NOT NULL REFERENCES parties(id),
    tp_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create TP Items table
CREATE TABLE tp_items (
    id SERIAL PRIMARY KEY,
    tp_id INTEGER NOT NULL REFERENCES transport_permits(id),
    brand_id INTEGER NOT NULL REFERENCES brands(id),
    qty INTEGER NOT NULL CHECK (qty > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tp_no ON transport_permits(tp_no);
CREATE INDEX idx_tp_party ON transport_permits(party_id);
CREATE INDEX idx_tp_date ON transport_permits(tp_date);
CREATE INDEX idx_tp_items_tp ON tp_items(tp_id);
CREATE INDEX idx_tp_items_brand ON tp_items(brand_id);

-- Enable Row Level Security (RLS)
ALTER TABLE transport_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tp_items ENABLE ROW LEVEL SECURITY;

-- Create policies for transport_permits
CREATE POLICY "Allow authenticated users full access to transport_permits" ON transport_permits
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policies for tp_items
CREATE POLICY "Allow authenticated users full access to tp_items" ON tp_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create triggers to automatically update updated_at timestamp
CREATE TRIGGER set_transport_permits_updated_at
    BEFORE UPDATE ON transport_permits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_tp_items_updated_at
    BEFORE UPDATE ON tp_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 