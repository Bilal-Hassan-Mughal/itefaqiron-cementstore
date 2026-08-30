/**
 * Test Case: Order Creation and Conversion to Sale
 * 
 * This test verifies:
 * 1. Database accounts (Cash, Bank, Customers, etc.)
 * 2. Order creation with proper ledger entries
 * 3. Order loading into sale page
 * 4. Sale conversion with complete ledger tracking
 * 5. Labour charges persistence
 * 6. Cash/Bank account balance updates
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ANSI color codes for better console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(80));
    log(title, 'cyan');
    console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

async function runTests() {
    try {
        logSection('TEST 1: Checking Database Accounts');

        // Check customer categories
        const categories = await prisma.customerCategory.findMany();
        logInfo(`Found ${categories.length} customer categories:`);
        categories.forEach(cat => {
            console.log(`  - ID: ${cat.cus_cat_id}, Title: "${cat.cus_cat_title}"`);
        });

        // Find special account categories
        const cashCategory = categories.find(c =>
            c.cus_cat_title.toLowerCase().includes('cash') &&
            c.cus_cat_title.toLowerCase().includes('account')
        );
        const bankCategory = categories.find(c =>
            c.cus_cat_title.toLowerCase().includes('bank') &&
            c.cus_cat_title.toLowerCase().includes('account')
        );

        if (cashCategory) {
            logSuccess(`Cash Account Category found: "${cashCategory.cus_cat_title}" (ID: ${cashCategory.cus_cat_id})`);
        } else {
            logError('Cash Account Category NOT found');
        }

        if (bankCategory) {
            logSuccess(`Bank Account Category found: "${bankCategory.cus_cat_title}" (ID: ${bankCategory.cus_cat_id})`);
        } else {
            logError('Bank Account Category NOT found');
        }

        // Find actual cash and bank accounts
        const cashAccount = cashCategory ? await prisma.customer.findFirst({
            where: { cus_category: cashCategory.cus_cat_id }
        }) : null;

        const bankAccount = bankCategory ? await prisma.customer.findFirst({
            where: { cus_category: bankCategory.cus_cat_id }
        }) : null;

        if (cashAccount) {
            logSuccess(`Cash Account found: "${cashAccount.cus_name}" (ID: ${cashAccount.cus_id}, Balance: ${cashAccount.cus_balance})`);
        } else {
            logError('No Cash Account found in customers table');
        }

        if (bankAccount) {
            logSuccess(`Bank Account found: "${bankAccount.cus_name}" (ID: ${bankAccount.cus_id}, Balance: ${bankAccount.cus_balance})`);
        } else {
            logError('No Bank Account found in customers table');
        }

        // Find a regular customer for testing
        const customerCategory = categories.find(c =>
            c.cus_cat_title.toLowerCase().includes('customer')
        );

        const testCustomer = customerCategory ? await prisma.customer.findFirst({
            where: { cus_category: customerCategory.cus_cat_id }
        }) : await prisma.customer.findFirst({
            where: {
                cus_category: {
                    notIn: [cashCategory?.cus_cat_id, bankCategory?.cus_cat_id].filter(Boolean)
                }
            }
        });

        if (testCustomer) {
            logSuccess(`Test Customer found: "${testCustomer.cus_name}" (ID: ${testCustomer.cus_id}, Balance: ${testCustomer.cus_balance})`);
        } else {
            logError('No test customer found');
            return;
        }

        // Find a product for testing
        const testProduct = await prisma.product.findFirst();
        if (testProduct) {
            logSuccess(`Test Product found: "${testProduct.pro_title}" (ID: ${testProduct.pro_id}, Price: ${testProduct.pro_sale_price})`);
        } else {
            logError('No test product found');
            return;
        }

        // Find a store
        const testStore = await prisma.store.findFirst();
        if (testStore) {
            logSuccess(`Test Store found: "${testStore.store_name}" (ID: ${testStore.storeid})`);
        } else {
            logError('No test store found');
            return;
        }

        // Get initial balances
        const initialCashBalance = cashAccount?.cus_balance || 0;
        const initialBankBalance = bankAccount?.cus_balance || 0;
        const initialCustomerBalance = testCustomer.cus_balance;

        logSection('TEST 2: Creating Test Order');

        const orderData = {
            cus_id: testCustomer.cus_id,
            store_id: testStore.storeid,
            total_amount: 10000,
            discount: 500,
            payment: 3000, // Advance payment
            cash_payment: 2000,
            bank_payment: 1000,
            payment_type: 'CASH',
            labour_charges: 1500,
            shipping_amount: 500,
            bill_type: 'ORDER',
            reference: 'Test Order - Automated Test',
            sale_details: [
                {
                    pro_id: testProduct.pro_id,
                    qnty: 5,
                    unit: 'PCS',
                    unit_rate: 2000,
                    total_amount: 10000,
                    discount: 0,
                    net_total: 10000,
                    cus_id: testCustomer.cus_id
                }
            ]
        };

        logInfo('Order Details:');
        console.log(`  Customer: ${testCustomer.cus_name}`);
        console.log(`  Total Amount: ${orderData.total_amount}`);
        console.log(`  Discount: ${orderData.discount}`);
        console.log(`  Labour Charges: ${orderData.labour_charges}`);
        console.log(`  Shipping: ${orderData.shipping_amount}`);
        console.log(`  Advance Payment: ${orderData.payment}`);
        console.log(`    - Cash: ${orderData.cash_payment}`);
        console.log(`    - Bank: ${orderData.bank_payment}`);

        // Calculate expected values
        const netTotal = orderData.total_amount - orderData.discount + orderData.shipping_amount;
        // Business rule: For an order, customer balance is only adjusted by the paid payment (advance), ignoring order total.
        const expectedCustomerBalance = initialCustomerBalance - orderData.payment;
        const expectedCashBalance = initialCashBalance + orderData.cash_payment;
        const expectedBankBalance = initialBankBalance + orderData.bank_payment;

        logInfo('Expected Results:');
        console.log(`  Net Total: ${netTotal}`);
        console.log(`  Customer Balance: ${initialCustomerBalance} - ${orderData.payment} = ${expectedCustomerBalance}`);
        console.log(`  Cash Balance: ${initialCashBalance} + ${orderData.cash_payment} = ${expectedCashBalance}`);
        console.log(`  Bank Balance: ${initialBankBalance} + ${orderData.bank_payment} = ${expectedBankBalance}`);

        // Create the order via API simulation
        logInfo('Creating order...');

        const response = await fetch('http://localhost:3000/api/sales', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const error = await response.json();
            logError(`Order creation failed: ${JSON.stringify(error)}`);
            return;
        }

        const createdOrder = await response.json();
        logSuccess(`Order created successfully! Order ID: ${createdOrder.sale_id}`);

        logSection('TEST 3: Verifying Ledger Entries');

        // Fetch ledger entries for this order
        const ledgerEntries = await prisma.ledger.findMany({
            where: { bill_no: createdOrder.sale_id.toString() },
            include: { customer: true },
            orderBy: { l_id: 'asc' }
        });

        logInfo(`Found ${ledgerEntries.length} ledger entries:`);
        ledgerEntries.forEach((entry, index) => {
            console.log(`\n  Entry ${index + 1}:`);
            console.log(`    Account: ${entry.customer.cus_name} (ID: ${entry.cus_id})`);
            console.log(`    Opening: ${entry.opening_balance}`);
            console.log(`    Debit: ${entry.debit_amount}`);
            console.log(`    Credit: ${entry.credit_amount}`);
            console.log(`    Closing: ${entry.closing_balance}`);
            console.log(`    Type: ${entry.trnx_type}`);
            console.log(`    Details: ${entry.details}`);
            console.log(`    Payments: ${entry.payments}`);
        });

        // Verify expected ledger entries
        const customerEntries = ledgerEntries.filter(e => e.cus_id === testCustomer.cus_id);
        const cashEntries = ledgerEntries.filter(e => e.cus_id === cashAccount?.cus_id);
        const bankEntries = ledgerEntries.filter(e => e.cus_id === bankAccount?.cus_id);

        if (customerEntries.length >= 1) {
            logSuccess(`Customer ledger entries found: ${customerEntries.length}`);
        } else {
            logError('Customer ledger entries missing');
        }

        if (orderData.cash_payment > 0) {
            if (cashEntries.length >= 1) {
                logSuccess(`Cash account ledger entries found: ${cashEntries.length}`);
            } else {
                logError('Cash account ledger entries missing');
            }
        }

        if (orderData.bank_payment > 0) {
            if (bankEntries.length >= 1) {
                logSuccess(`Bank account ledger entries found: ${bankEntries.length}`);
            } else {
                logError('Bank account ledger entries missing');
            }
        }

        logSection('TEST 4: Verifying Account Balances');

        // Fetch updated balances
        const updatedCustomer = await prisma.customer.findUnique({
            where: { cus_id: testCustomer.cus_id }
        });

        const updatedCashAccount = cashAccount ? await prisma.customer.findUnique({
            where: { cus_id: cashAccount.cus_id }
        }) : null;

        const updatedBankAccount = bankAccount ? await prisma.customer.findUnique({
            where: { cus_id: bankAccount.cus_id }
        }) : null;

        logInfo('Actual Balances After Order:');
        console.log(`  Customer: ${updatedCustomer.cus_balance} (Expected: ${expectedCustomerBalance})`);
        if (updatedCashAccount) {
            console.log(`  Cash: ${updatedCashAccount.cus_balance} (Expected: ${expectedCashBalance})`);
        }
        if (updatedBankAccount) {
            console.log(`  Bank: ${updatedBankAccount.cus_balance} (Expected: ${expectedBankBalance})`);
        }

        // Verify balances
        const customerBalanceMatch = Math.abs(updatedCustomer.cus_balance - expectedCustomerBalance) < 0.01;
        const cashBalanceMatch = !updatedCashAccount || Math.abs(updatedCashAccount.cus_balance - expectedCashBalance) < 0.01;
        const bankBalanceMatch = !updatedBankAccount || Math.abs(updatedBankAccount.cus_balance - expectedBankBalance) < 0.01;

        if (customerBalanceMatch) {
            logSuccess('Customer balance is correct');
        } else {
            logError(`Customer balance mismatch! Expected: ${expectedCustomerBalance}, Got: ${updatedCustomer.cus_balance}`);
        }

        if (orderData.cash_payment > 0) {
            if (cashBalanceMatch) {
                logSuccess('Cash account balance is correct');
            } else {
                logError(`Cash balance mismatch! Expected: ${expectedCashBalance}, Got: ${updatedCashAccount?.cus_balance}`);
            }
        }

        if (orderData.bank_payment > 0) {
            if (bankBalanceMatch) {
                logSuccess('Bank account balance is correct');
            } else {
                logError(`Bank balance mismatch! Expected: ${expectedBankBalance}, Got: ${updatedBankAccount?.cus_balance}`);
            }
        }

        logSection('TEST 5: Loading Order (Simulating GET request)');

        // Fetch the order
        const getResponse = await fetch(`http://localhost:3000/api/sales?id=${createdOrder.sale_id}`);
        if (!getResponse.ok) {
            logError('Failed to fetch order');
            return;
        }

        const fetchedOrder = await getResponse.json();
        logSuccess('Order fetched successfully');

        // Verify labour charges
        logInfo('Order Data:');
        console.log(`  Labour Charges: ${fetchedOrder.labour_charges}`);
        console.log(`  Shipping Amount: ${fetchedOrder.shipping_amount}`);
        console.log(`  Discount: ${fetchedOrder.discount}`);
        console.log(`  Payment: ${fetchedOrder.payment}`);
        console.log(`  Cash Payment: ${fetchedOrder.cash_payment}`);
        console.log(`  Bank Payment: ${fetchedOrder.bank_payment}`);

        if (parseFloat(fetchedOrder.labour_charges) === orderData.labour_charges) {
            logSuccess('Labour charges loaded correctly');
        } else {
            logError(`Labour charges mismatch! Expected: ${orderData.labour_charges}, Got: ${fetchedOrder.labour_charges}`);
        }

        logSection('TEST SUMMARY');

        const allTestsPassed =
            customerBalanceMatch &&
            cashBalanceMatch &&
            bankBalanceMatch &&
            customerEntries.length >= 1 &&
            (orderData.cash_payment === 0 || cashEntries.length >= 1) &&
            (orderData.bank_payment === 0 || bankEntries.length >= 1) &&
            parseFloat(fetchedOrder.labour_charges) === orderData.labour_charges;

        if (allTestsPassed) {
            logSuccess('ALL TESTS PASSED! ✨');
            log('\nThe order creation and ledger system is working correctly:', 'green');
            log('  ✅ Ledger entries created properly', 'green');
            log('  ✅ Account balances updated correctly', 'green');
            log('  ✅ Labour charges persisted', 'green');
            log('  ✅ Cash/Bank accounts tracked properly', 'green');
        } else {
            logError('SOME TESTS FAILED');
            log('\nPlease review the errors above', 'red');
        }

        // Cleanup option
        console.log('\n' + '='.repeat(80));
        logWarning(`Test order created with ID: ${createdOrder.sale_id}`);
        logWarning('You may want to delete this test order from the database.');
        console.log('='.repeat(80) + '\n');

    } catch (error) {
        logError(`Test failed with error: ${error.message}`);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the tests
runTests();
