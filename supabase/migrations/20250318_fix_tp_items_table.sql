-- Add the bar_id column to tp_items table
ALTER TABLE tp_items
ADD COLUMN bar_id UUID REFERENCES bars(id);

-- Create an index for the new column
CREATE INDEX idx_tp_items_bar_id ON tp_items(bar_id);

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS sync_tp_receipts_trigger ON tp_items;

-- Then, redefine the sync_tp_receipts function to handle cases with or without bar_id
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
  
  -- Update receipt quantity in inventory
  UPDATE inventory
  SET receipt_qty = (
      SELECT COALESCE(SUM(ti.qty), 0)
      FROM tp_items ti
      JOIN transport_permits tp ON ti.tp_id = tp.id
      WHERE tp.bar_id = bar_id_val
      AND ti.brand_id = NEW.brand_id
      AND tp.tp_date = tp_date_val
  )
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

-- Create the trigger again
CREATE TRIGGER sync_tp_receipts_trigger
AFTER INSERT OR UPDATE ON tp_items
FOR EACH ROW
EXECUTE FUNCTION sync_tp_receipts();

-- Update existing tp_items with the correct bar_id
UPDATE tp_items AS ti
SET bar_id = tp.bar_id
FROM transport_permits AS tp
WHERE ti.tp_id = tp.id
AND ti.bar_id IS NULL; 