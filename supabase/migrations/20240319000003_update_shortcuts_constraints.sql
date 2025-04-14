-- First, drop the existing unique constraints
ALTER TABLE shortcuts DROP CONSTRAINT IF EXISTS shortcuts_shortform_key;
ALTER TABLE shortcuts DROP CONSTRAINT IF EXISTS shortcuts_brand_id_key;

-- Create a function to handle automatic shortcut assignment
CREATE OR REPLACE FUNCTION auto_assign_brand_shortcuts()
RETURNS TRIGGER AS $$
DECLARE
    v_brand_name TEXT;
    v_similar_brand RECORD;
BEGIN
    -- Get the brand name for the new shortcut
    SELECT brand_name INTO v_brand_name
    FROM brands
    WHERE id = NEW.brand_id;

    -- Look for existing shortcuts for brands with the same name
    FOR v_similar_brand IN (
        SELECT s.shortform
        FROM shortcuts s
        JOIN brands b ON b.id = s.brand_id
        WHERE b.brand_name = v_brand_name
        LIMIT 1
    ) LOOP
        -- If found, use the same shortform
        NEW.shortform = v_similar_brand.shortform;
        RETURN NEW;
    END LOOP;

    -- If no existing shortcut found, use the provided shortform
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-assigning shortcuts
DROP TRIGGER IF EXISTS auto_assign_shortcuts_trigger ON shortcuts;
CREATE TRIGGER auto_assign_shortcuts_trigger
    BEFORE INSERT ON shortcuts
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_brand_shortcuts();

-- Add a new composite unique constraint
ALTER TABLE shortcuts
ADD CONSTRAINT unique_shortform_per_brand_name UNIQUE (shortform, brand_id); 