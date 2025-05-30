-- Create transport_permits table
CREATE TABLE transport_permits (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    tp_no VARCHAR(50) NOT NULL,
    party_id UUID NOT NULL REFERENCES parties(id),
    bar_id UUID NOT NULL REFERENCES bars(id),
    tp_date DATE NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(tp_no, bar_id)
);

-- Create tp_items table
CREATE TABLE tp_items (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    tp_id BIGINT NOT NULL REFERENCES transport_permits(id) ON DELETE CASCADE,
    brand_id BIGINT NOT NULL REFERENCES brands(id),
    qty INTEGER NOT NULL CHECK (qty > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(tp_id, brand_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_transport_permits_tp_no ON transport_permits(tp_no);
CREATE INDEX idx_transport_permits_party_id ON transport_permits(party_id);
CREATE INDEX idx_transport_permits_bar_id ON transport_permits(bar_id);
CREATE INDEX idx_transport_permits_tp_date ON transport_permits(tp_date);
CREATE INDEX idx_transport_permits_created_by ON transport_permits(created_by);
CREATE INDEX idx_tp_items_tp_id ON tp_items(tp_id);
CREATE INDEX idx_tp_items_brand_id ON tp_items(brand_id);

-- Enable Row Level Security
ALTER TABLE transport_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tp_items ENABLE ROW LEVEL SECURITY;

-- Create public access policies
CREATE POLICY "Public access to transport permits"
    ON transport_permits FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public access to tp items"
    ON tp_items FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_transport_permits_updated_at
    BEFORE UPDATE ON transport_permits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tp_items_updated_at
    BEFORE UPDATE ON tp_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
