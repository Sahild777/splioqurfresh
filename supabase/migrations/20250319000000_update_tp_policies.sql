-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Users can insert their own transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Users can update their own transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Users can delete their own transport permits" ON transport_permits;
DROP POLICY IF EXISTS "Users can view their own tp items" ON tp_items;
DROP POLICY IF EXISTS "Users can insert their own tp items" ON tp_items;
DROP POLICY IF EXISTS "Users can update their own tp items" ON tp_items;
DROP POLICY IF EXISTS "Users can delete their own tp items" ON tp_items;

-- Recreate policies for transport_permits with simplified conditions
CREATE POLICY "Users can view their own transport permits"
    ON transport_permits FOR SELECT
    USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own transport permits"
    ON transport_permits FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own transport permits"
    ON transport_permits FOR UPDATE
    USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own transport permits"
    ON transport_permits FOR DELETE
    USING (auth.uid() = created_by);

-- Recreate policies for tp_items with simplified conditions
CREATE POLICY "Users can view their own tp items"
    ON tp_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM transport_permits
            WHERE transport_permits.id = tp_items.tp_id
            AND transport_permits.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own tp items"
    ON tp_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM transport_permits
            WHERE transport_permits.id = tp_items.tp_id
            AND transport_permits.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update their own tp items"
    ON tp_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM transport_permits
            WHERE transport_permits.id = tp_items.tp_id
            AND transport_permits.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own tp items"
    ON tp_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM transport_permits
            WHERE transport_permits.id = tp_items.tp_id
            AND transport_permits.created_by = auth.uid()
        )
    ); 