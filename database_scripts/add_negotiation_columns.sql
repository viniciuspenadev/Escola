-- Migration to add negotiation tracking columns to installments table

ALTER TABLE installments
ADD COLUMN IF NOT EXISTS original_value DECIMAL(10,2), -- Snapshot of the value before any negotiation
ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2) DEFAULT 0, -- Amount discounted
ADD COLUMN IF NOT EXISTS surcharge_value DECIMAL(10,2) DEFAULT 0, -- Amount added (interest/fine)
ADD COLUMN IF NOT EXISTS negotiation_type VARCHAR(20), -- 'discount', 'surcharge', 'correction'
ADD COLUMN IF NOT EXISTS negotiation_notes TEXT, -- Justification for the change
ADD COLUMN IF NOT EXISTS negotiation_date TIMESTAMP WITH TIME ZONE; -- When the negotiation happened

-- Create index for faster analytics on discounts
CREATE INDEX IF NOT EXISTS idx_installments_negotiation_type ON installments(negotiation_type);

COMMENT ON COLUMN installments.original_value IS 'Valor original da parcela antes de descontos ou acréscimos';
COMMENT ON COLUMN installments.discount_value IS 'Valor total concedido de desconto';
COMMENT ON COLUMN installments.surcharge_value IS 'Valor total cobrado de juros/multa nesta negociação';
