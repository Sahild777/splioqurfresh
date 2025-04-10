-- Add MRP column to brands table
ALTER TABLE brands 
ADD COLUMN mrp NUMERIC(10, 2) NOT NULL DEFAULT 0.00 
CHECK (mrp >= 0);

-- Create an index on the MRP column for faster queries
CREATE INDEX idx_brands_mrp ON brands(mrp);

