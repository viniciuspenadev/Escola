-- Add columns to support Payment Gateway (Asaas/Efi) integration

DO $$
BEGIN
    -- 1. Gateway ID (External ID from Asaas)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installments' AND column_name = 'gateway_integration_id') THEN
        ALTER TABLE installments ADD COLUMN gateway_integration_id TEXT;
    END IF;

    -- 2. Billing URL (Link to the PDF/Web view of the bill)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installments' AND column_name = 'billing_url') THEN
        ALTER TABLE installments ADD COLUMN billing_url TEXT;
    END IF;

    -- 3. Pix QR Code (Raw Copy-Paste Code)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installments' AND column_name = 'pix_qr_code') THEN
        ALTER TABLE installments ADD COLUMN pix_qr_code TEXT;
    END IF;

    -- 4. Payment Method (Update/Check if enum allows new types if strict, usually text is flexible)
    -- Assuming payment_method is TEXT based on previous code usage, if ENUM we might need to alter type.
    -- Just in case, no operation needed if it's text.
    
    -- Index for faster lookups by gateway ID
    CREATE INDEX IF NOT EXISTS idx_installments_gateway_id ON installments(gateway_integration_id);

END $$;
