-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Policy for viewing inventory (users can only view their own bar's inventory)
CREATE POLICY "Users can view their own bar's inventory"
ON inventory FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bar_users
    WHERE bar_users.bar_id = inventory.bar_id
    AND bar_users.user_id = auth.uid()
  )
);

-- Policy for inserting inventory (users can only insert for their own bars)
CREATE POLICY "Users can insert inventory for their own bars"
ON inventory FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bar_users
    WHERE bar_users.bar_id = inventory.bar_id
    AND bar_users.user_id = auth.uid()
  )
);

-- Policy for updating inventory (users can only update their own bar's inventory)
CREATE POLICY "Users can update their own bar's inventory"
ON inventory FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM bar_users
    WHERE bar_users.bar_id = inventory.bar_id
    AND bar_users.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bar_users
    WHERE bar_users.bar_id = inventory.bar_id
    AND bar_users.user_id = auth.uid()
  )
);

-- Policy for deleting inventory (users can only delete their own bar's inventory)
CREATE POLICY "Users can delete their own bar's inventory"
ON inventory FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM bar_users
    WHERE bar_users.bar_id = inventory.bar_id
    AND bar_users.user_id = auth.uid()
  )
); 