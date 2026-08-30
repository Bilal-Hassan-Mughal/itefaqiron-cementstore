-- Saved Query: lstqry
-- Description: Get the last sale ID and complete sale details
SELECT sale_id, bill_number, cus_id, store_id, total_amount, payment, payment_type, cash_payment, bank_payment, created_at, updated_at
FROM sales 
ORDER BY sale_id DESC 
LIMIT 1;
