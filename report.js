require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('   SALE RETURN ERROR - DETAILED INVESTIGATION REPORT');
    console.log('='.repeat(70) + '\n');
    
    // Get sale info
    const sale = await prisma.sale.findUnique({
      where: { sale_id: 6655 },
      include: { 
        sale_details: true,
        customer: true
      }
    });
    
    console.log('SALE #6655 DETAILS:');
    console.log('-'.repeat(70));
    console.log('Customer Name:      ' + sale.customer.cus_name);
    console.log('Customer ID:        ' + sale.customer.cus_id);
    console.log('Sale Date:          ' + sale.created_at);
    console.log('Sale Total:         ' + sale.total_amount);
    console.log('Bill Type:          ' + sale.bill_type);
    console.log('');
    
    console.log('PRODUCTS SOLD IN THIS SALE:');
    console.log('-'.repeat(70));
    sale.sale_details.forEach(d => {
      console.log(`  Product ID: ${d.pro_id}`);
      console.log(`    - Quantity: ${d.qnty} units`);
      console.log(`    - Unit Rate: ${d.unit_rate}`);
      console.log(`    - Total: ${d.total_amount}\n`);
    });
    
    console.log('WHAT YOU ARE TRYING TO RETURN:');
    console.log('-'.repeat(70));
    console.log('  Product ID: 550');
    console.log('  Requested Return Qty: 7 units');
    console.log('');
    
    const product550InSale = sale.sale_details.find(d => d.pro_id === 550);
    console.log('IS PRODUCT 550 IN THIS SALE?');
    console.log('-'.repeat(70));
    if (product550InSale) {
      console.log('YES - Sold Qty: ' + product550InSale.qnty + ' units');
    } else {
      console.log('NO - Product 550 is NOT in this sale');
      console.log('   You can only return products that were sold in this sale');
    }
    console.log('');
    
    console.log('SOLUTION OPTIONS:');
    console.log('-'.repeat(70));
    console.log('1. FIND THE CORRECT SALE:');
    console.log('   Find which sale actually has Product 550');
    console.log('   Use that sale number instead of #6655');
    console.log('');
    console.log('2. REMOVE PRODUCT 550:');
    console.log('   Only return Products 173 or 252 (which ARE in this sale)');
    console.log('');
    console.log('3. MANUAL RETURN (NO LINKED SALE):');
    console.log('   Create a return WITHOUT linking to a sale');
    console.log('   Allows returning any product for the customer');
    console.log('');
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
