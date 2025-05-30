-- Create daily_sales table
CREATE TABLE daily_sales (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    sale_date DATE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_daily_sale UNIQUE (bar_id, brand_id, sale_date)
);

-- Create indexes for daily_sales
CREATE INDEX idx_daily_sales_bar_id ON daily_sales(bar_id);
CREATE INDEX idx_daily_sales_brand_id ON daily_sales(brand_id);
CREATE INDEX idx_daily_sales_sale_date ON daily_sales(sale_date);

-- Enable Row Level Security for daily_sales
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_sales
CREATE POLICY "Users can view their own daily sales"
    ON daily_sales FOR SELECT
    USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own daily sales"
    ON daily_sales FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own daily sales"
    ON daily_sales FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own daily sales"
    ON daily_sales FOR DELETE
    USING (auth.uid() = created_by);

-- Create trigger for updated_at on daily_sales
CREATE TRIGGER update_daily_sales_updated_at
    BEFORE UPDATE ON daily_sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create inventory table
CREATE TABLE inventory (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
    brand_id BIGINT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    opening_qty INTEGER NOT NULL DEFAULT 0,
    receipt_qty INTEGER NOT NULL DEFAULT 0,
    sale_qty INTEGER NOT NULL DEFAULT 0,
    closing_qty INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_inventory_entry UNIQUE (bar_id, brand_id, date)
);

-- Create indexes for faster queries
CREATE INDEX idx_inventory_bar_id ON inventory(bar_id);
CREATE INDEX idx_inventory_brand_id ON inventory(brand_id);
CREATE INDEX idx_inventory_date ON inventory(date);

-- Enable Row Level Security
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create open policy for all access
CREATE POLICY "Allow all access to inventory"
    ON inventory FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create function to update closing quantity
CREATE OR REPLACE FUNCTION update_inventory_closing_qty()
RETURNS TRIGGER AS $$
BEGIN
    NEW.closing_qty := NEW.opening_qty + NEW.receipt_qty - NEW.sale_qty;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update closing quantity
CREATE TRIGGER update_closing_qty
    BEFORE INSERT OR UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_closing_qty();

-- Create function to update next day's opening quantity
CREATE OR REPLACE FUNCTION update_next_day_opening_qty()
RETURNS TRIGGER AS $$
BEGIN
    -- Update opening quantity for the next day
    UPDATE inventory
    SET opening_qty = NEW.closing_qty
    WHERE bar_id = NEW.bar_id
    AND brand_id = NEW.brand_id
    AND date = NEW.date + INTERVAL '1 day';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update next day's opening quantity
CREATE TRIGGER update_next_day_opening
    AFTER INSERT OR UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_next_day_opening_qty();

-- Create function to sync TP receipts
CREATE OR REPLACE FUNCTION sync_tp_receipts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update receipt quantity in inventory
    UPDATE inventory
    SET receipt_qty = (
        SELECT COALESCE(SUM(qty), 0)
        FROM tp_items ti
        JOIN transport_permits tp ON ti.tp_id = tp.id
        WHERE tp.bar_id = NEW.bar_id
        AND ti.brand_id = NEW.brand_id
        AND tp.tp_date = NEW.date
    )
    WHERE bar_id = NEW.bar_id
    AND brand_id = NEW.brand_id
    AND date = NEW.date;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync TP receipts
CREATE TRIGGER sync_tp_receipts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tp_items
    FOR EACH ROW
    EXECUTE FUNCTION sync_tp_receipts();

-- Create function to sync sales
CREATE OR REPLACE FUNCTION sync_sales()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sale quantity in inventory
    UPDATE inventory
    SET sale_qty = (
        SELECT COALESCE(SUM(qty), 0)
        FROM daily_sales
        WHERE bar_id = NEW.bar_id
        AND brand_id = NEW.brand_id
        AND sale_date = NEW.date
    )
    WHERE bar_id = NEW.bar_id
    AND brand_id = NEW.brand_id
    AND date = NEW.date;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync sales
CREATE TRIGGER sync_sales_trigger
    AFTER INSERT OR UPDATE OR DELETE ON daily_sales
    FOR EACH ROW
    EXECUTE FUNCTION sync_sales();
