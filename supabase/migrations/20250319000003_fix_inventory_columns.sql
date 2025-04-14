-- First drop the trigger that depends on these columns
DROP TRIGGER IF EXISTS sync_tp_receipts_trigger ON tp_items;
DROP FUNCTION IF EXISTS sync_tp_receipts();

-- Add missing columns to inventory table
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS opening_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS receipt_qty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_qty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_stock INTEGER DEFAULT 0;

-- Create the updated trigger function
CREATE OR REPLACE FUNCTION sync_tp_receipts()
RETURNS TRIGGER AS $$
DECLARE
  tp_record RECORD;
  bar_id_val UUID;
  tp_date_val DATE;
BEGIN
  -- Get the transport permit record to get bar_id and date
  SELECT tp.bar_id, tp.tp_date INTO bar_id_val, tp_date_val
  FROM transport_permits tp
  WHERE tp.id = NEW.tp_id;
  
  -- First, ensure there's an inventory record for this date
  INSERT INTO inventory (bar_id, brand_id, date, opening_stock, receipt_qty, sales_qty, closing_stock)
  VALUES (bar_id_val, NEW.brand_id, tp_date_val, 0, 0, 0, 0)
  ON CONFLICT (bar_id, brand_id, date) DO NOTHING;

  -- Then update receipt quantity in inventory
  UPDATE inventory
  SET receipt_qty = (
      SELECT COALESCE(SUM(ti.qty), 0)
      FROM tp_items ti
      JOIN transport_permits tp ON ti.tp_id = tp.id
      WHERE tp.bar_id = bar_id_val
      AND ti.brand_id = NEW.brand_id
      AND tp.tp_date = tp_date_val
  ),
  closing_stock = opening_stock + receipt_qty - sales_qty
  WHERE bar_id = bar_id_val
  AND brand_id = NEW.brand_id
  AND date = tp_date_val;
  
  -- Also update the bar_id in the tp_items record if it's NULL
  IF NEW.bar_id IS NULL THEN
    NEW.bar_id := bar_id_val;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER sync_tp_receipts_trigger
AFTER INSERT OR UPDATE ON tp_items
FOR EACH ROW
EXECUTE FUNCTION sync_tp_receipts(); 