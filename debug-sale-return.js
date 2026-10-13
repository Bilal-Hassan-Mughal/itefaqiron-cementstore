require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Connecting to database...');
    
    // Get the sale details
    const sale = await prisma.sale.findUnique({
      where: { sale_id: 6655 },
      include: { 
        sale_details: true,
        customer: { select: { cus_name: true, cus_id: true } }
      }
    });
    
    if (!sale) {
      console.log('❌ Sale #6655 not found');
      process.exit(1);
    }
    
    console.log('📋 SALE #6655 INFO:');
    console.log('Customer:', sale.customer.cus_name, '(ID:', sale.customer.cus_id + ')');
    console.log('Total Amount:', sale.total_amount);
    console.log('Sale Date:', sale.created_at);
    console.log('Bill Type:', sale.bill_type);
    console.log('');
    
    // Check product 550 in this sale
    const product550 = sale.sale_details.find(d => d.pro_id === 550);
    
    if (product550) {
      console.log('✅ Product 550 WAS sold in this sale:');
      console.log('  - Quantity sold:', product550.qnty);
      console.log('  - Unit rate:', product550.unit_rate);
      console.log('  - Total:', product550.total_amount);
    } else {
      console.log('❌ Product 550 was NOT found in sale details');
      console.log('');
      console.log('All products in this sale:');
      sale.sale_details.forEach(d => {
        console.log(`  - Product ${d.pro_id}: ${d.qnty} units @ ${d.unit_rate}`);
      });
      process.exit(1);
    }
    
    console.log('');
    console.log('--- CHECKING PREVIOUS RETURNS ---');
    
    // Check existing returns for this sale
    const returns = await prisma.saleReturn.findMany({
      where: { sale_id: 6655 },
      include: { return_details: true }
    });
    
    if (returns.length === 0) {
      console.log('✅ No previous returns for this sale');
    } else {
      console.log(`Found ${returns.length} previous return(s):`);
      returns.forEach(ret => {
        console.log(`\nReturn #${ret.return_id}:`);
        let hasProduct550 = false;
        ret.return_details.forEach(d => {
          if (d.pro_id === 550) hasProduct550 = true;
          console.log(`  - Product ${d.pro_id}: ${d.qnty} units returned`);
        });
        if (hasProduct550) {
          console.log('  ⚠️  Product 550 was already partially returned!');
        }
      });
    }
    
    console.log('\n✅ Analysis complete');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
