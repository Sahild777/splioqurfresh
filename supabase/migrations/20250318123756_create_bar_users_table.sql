-- Create bar_users table
CREATE TABLE bar_users (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, bar_id)
);

-- Create indexes
CREATE INDEX idx_bar_users_user_id ON bar_users(user_id);
CREATE INDEX idx_bar_users_bar_id ON bar_users(bar_id);

-- Enable RLS
ALTER TABLE bar_users ENABLE ROW LEVEL SECURITY;

-- Policy for viewing bar_users (users can only view their own entries)
CREATE POLICY "Users can view their own bar_users entries"
ON bar_users FOR SELECT
USING (user_id = auth.uid());

-- Policy for inserting bar_users (users can only insert their own entries)
CREATE POLICY "Users can insert their own bar_users entries"
ON bar_users FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy for updating bar_users (users can only update their own entries)
CREATE POLICY "Users can update their own bar_users entries"
ON bar_users FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy for deleting bar_users (users can only delete their own entries)
CREATE POLICY "Users can delete their own bar_users entries"
ON bar_users FOR DELETE
USING (user_id = auth.uid());

-- Insert initial data for existing users and bars
INSERT INTO bar_users (user_id, bar_id)
SELECT 
    auth.uid() as user_id,
    id as bar_id
FROM bars
WHERE NOT EXISTS (
    SELECT 1 FROM bar_users 
    WHERE user_id = auth.uid() 
    AND bar_id = bars.id
);
