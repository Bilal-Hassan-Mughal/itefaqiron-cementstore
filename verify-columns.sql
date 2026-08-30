-- Verify payment columns exist in sales table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'sales' 
  AND column_name IN ('cash_payment', 'bank_payment', 'bank_title')
ORDER BY ordinal_position;



