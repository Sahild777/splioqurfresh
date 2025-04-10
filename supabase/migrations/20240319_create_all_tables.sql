-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE item_category AS ENUM ('beer', 'wine', 'spirits', 'mixers', 'other');

-- Create bars table
CREATE TABLE bars (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create bar_users table (for managing users per bar)
CREATE TABLE bar_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bar_id BIGINT REFERENCES bars(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(bar_id, user_id)
);

-- Create brands table
CREATE TABLE brands (
    id BIGSERIAL PRIMARY KEY,
    item_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    size VARCHAR(50) NOT NULL,
    category item_category NOT NULL,
    mrp DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create parties table
CREATE TABLE parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create inventory table
CREATE TABLE inventory (
    id BIGSERIAL PRIMARY KEY,
    bar_id BIGINT REFERENCES bars(id) ON DELETE CASCADE,
    brand_id BIGINT REFERENCES brands(id) ON DELETE CASCADE,
    opening_stock_cases INTEGER DEFAULT 0,
    opening_stock_bottles INTEGER DEFAULT 0,
    current_stock_cases INTEGER DEFAULT 0,
    current_stock_bottles INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(bar_id, brand_id)
);

-- Create tp_entries table
CREATE TABLE tp_entries (
    id BIGSERIAL PRIMARY KEY,
    bar_id BIGINT REFERENCES bars(id) ON DELETE CASCADE,
    tp_no VARCHAR(50) NOT NULL,
    party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(bar_id, tp_no)
);

-- Create tp_items table
CREATE TABLE tp_items (
    id BIGSERIAL PRIMARY KEY,
    tp_entry_id BIGINT REFERENCES tp_entries(id) ON DELETE CASCADE,
    brand_id BIGINT REFERENCES brands(id) ON DELETE CASCADE,
    qty_case INTEGER NOT NULL,
    qty_bottle INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create daily_sales table
CREATE TABLE daily_sales (
    id BIGSERIAL PRIMARY KEY,
    bar_id BIGINT REFERENCES bars(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_bottles INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(bar_id, date)
);

-- Create sale_items table
CREATE TABLE sale_items (
    id BIGSERIAL PRIMARY KEY,
    daily_sale_id BIGINT REFERENCES daily_sales(id) ON DELETE CASCADE,
    brand_id BIGINT REFERENCES brands(id) ON DELETE CASCADE,
    qty_case INTEGER NOT NULL,
    qty_bottle INTEGER NOT NULL,
    mrp DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create RLS Policies
ALTER TABLE bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE tp_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tp_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Create policies for bars
CREATE POLICY "Users can view their assigned bars"
    ON bars FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bar_users
            WHERE bar_users.bar_id = bars.id
            AND bar_users.user_id = auth.uid()
        )
    );

-- Create policies for bar_users
CREATE POLICY "Users can view bar users for their bars"
    ON bar_users FOR SELECT
    USING (
        bar_id IN (
            SELECT bar_id FROM bar_users WHERE user_id = auth.uid()
        )
    );

-- Create policies for inventory
CREATE POLICY "Users can view inventory for their bars"
    ON inventory FOR SELECT
    USING (
        bar_id IN (
            SELECT bar_id FROM bar_users WHERE user_id = auth.uid()
        )
    );

-- Create policies for tp_entries
CREATE POLICY "Users can view TP entries for their bars"
    ON tp_entries FOR SELECT
    USING (
        bar_id IN (
            SELECT bar_id FROM bar_users WHERE user_id = auth.uid()
        )
    );

-- Create policies for daily_sales
CREATE POLICY "Users can view sales for their bars"
    ON daily_sales FOR SELECT
    USING (
        bar_id IN (
            SELECT bar_id FROM bar_users WHERE user_id = auth.uid()
        )
    );

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_bars_updated_at
    BEFORE UPDATE ON bars
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bar_users_updated_at
    BEFORE UPDATE ON bar_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parties_updated_at
    BEFORE UPDATE ON parties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tp_entries_updated_at
    BEFORE UPDATE ON tp_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tp_items_updated_at
    BEFORE UPDATE ON tp_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_sales_updated_at
    BEFORE UPDATE ON daily_sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 