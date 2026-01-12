-- Add payment details to installments table
ALTER TABLE installments
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('pix', 'boleto', 'credit_card', 'cash', 'transfer')),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS transaction_id TEXT, -- For external gateway ID
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Comment on columns for clarity
COMMENT ON COLUMN installments.payment_method IS 'Method used for payment: pix, boleto, etc.';
COMMENT ON COLUMN installments.paid_at IS 'Date when the payment was actually received';
COMMENT ON COLUMN installments.metadata IS 'Flexible storage for Pix Key, Barcode, etc.';

-- Create index for faster queries on status and dates
CREATE INDEX IF NOT EXISTS idx_installments_status_date ON installments(status, due_date);
CREATE INDEX IF NOT EXISTS idx_installments_paid_at ON installments(paid_at);
