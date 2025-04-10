-- Create VAT credentials table
CREATE TABLE IF NOT EXISTS public.vat_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.vat_credentials ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their bar's VAT credentials
CREATE POLICY "Users can view their bar's VAT credentials"
    ON public.vat_credentials
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bar_users bu
            WHERE bu.bar_id = vat_credentials.bar_id
            AND bu.user_id = auth.uid()
        )
    );

-- Allow authenticated users to insert VAT credentials for their bars
CREATE POLICY "Users can insert VAT credentials for their bars"
    ON public.vat_credentials
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bar_users bu
            WHERE bu.bar_id = bar_id
            AND bu.user_id = auth.uid()
        )
    );

-- Allow authenticated users to update VAT credentials for their bars
CREATE POLICY "Users can update VAT credentials for their bars"
    ON public.vat_credentials
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bar_users bu
            WHERE bu.bar_id = vat_credentials.bar_id
            AND bu.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bar_users bu
            WHERE bu.bar_id = bar_id
            AND bu.user_id = auth.uid()
        )
    );

-- Allow authenticated users to delete VAT credentials for their bars
CREATE POLICY "Users can delete VAT credentials for their bars"
    ON public.vat_credentials
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bar_users bu
            WHERE bu.bar_id = vat_credentials.bar_id
            AND bu.user_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_vat_credentials_updated_at
    BEFORE UPDATE ON public.vat_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column(); 