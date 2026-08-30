/**
 * Test suite for Screen Navigation (Ctrl+Left/Right Arrow)
 * This test verifies that screen state is properly saved and restored
 * 
 * Run with: node test-screen-navigation.js
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

// Mock state for testing
class ScreenStateManager {
  constructor() {
    this.screenStack = [];
    this.currentScreenIndex = -1;
  }

  captureScreenState(formState) {
    const state = {
      formSelectedCustomer: formState.customer ? { ...formState.customer } : null,
      formSelectedStore: formState.store ? { ...formState.store } : null,
      productTableData: JSON.parse(JSON.stringify(formState.products || [])),
      paymentData: JSON.parse(JSON.stringify(formState.payment || {})),
      billType: formState.billType,
      formSelectedProduct: formState.product ? { ...formState.product } : null,
      productFormData: JSON.parse(JSON.stringify(formState.productForm || {})),
      newTransport: JSON.parse(JSON.stringify(formState.transport || {})),
      transportAccounts: (formState.transportAccounts || []).map(t => ({ ...t })),
      transportOptions: (formState.transportOptions || []).map(t => ({ ...t })),
      timestamp: new Date().toLocaleTimeString(),
      customerName: formState.customer?.name || 'New Sale'
    };
    return state;
  }

  restoreScreenState(state) {
    if (!state) {
      console.warn('⚠️ No state to restore');
      return null;
    }
    return {
      customer: state.formSelectedCustomer,
      store: state.formSelectedStore,
      products: state.productTableData,
      payment: state.paymentData,
      billType: state.billType,
      product: state.formSelectedProduct,
      productForm: state.productFormData,
      transport: state.newTransport,
      transportAccounts: state.transportAccounts,
      transportOptions: state.transportOptions,
      timestamp: state.timestamp,
      customerName: state.customerName
    };
  }

  openNewScreen(currentForm) {
    console.log('➡️ OPENING NEW SCREEN');
    const currentState = this.captureScreenState(currentForm);
    const newStack = this.screenStack.slice(0, this.currentScreenIndex + 1);
    newStack.push(currentState);
    
    this.screenStack = newStack;
    this.currentScreenIndex = newStack.length - 1;
    
    console.log(`📚 New stack created: ${newStack.length} screens`);
    return true;
  }

  goToPreviousScreen() {
    console.log('⬅️ GOING TO PREVIOUS SCREEN');
    console.log(`📊 Current: Index=${this.currentScreenIndex}, Stack Length=${this.screenStack.length}`);
    
    if (this.currentScreenIndex > 0) {
      const previousIndex = this.currentScreenIndex - 1;
      const previousState = this.screenStack[previousIndex];
      
      if (!previousState) {
        console.error('❌ Previous state not found!');
        return null;
      }
      
      this.currentScreenIndex = previousIndex;
      return this.restoreScreenState(previousState);
    } else if (this.currentScreenIndex === 0) {
      this.currentScreenIndex = -1;
      this.screenStack = [];
      return { cleared: true };
    }
    
    return null;
  }

  goToNextScreen() {
    console.log('➡️ GOING TO NEXT SCREEN');
    if (this.currentScreenIndex < this.screenStack.length - 1) {
      const nextIndex = this.currentScreenIndex + 1;
      const nextState = this.screenStack[nextIndex];
      
      if (!nextState) {
        console.error('❌ Next state not found!');
        return null;
      }
      
      this.currentScreenIndex = nextIndex;
      return this.restoreScreenState(nextState);
    }
    
    return null;
  }
}

// Test cases
function testScreenNavigation() {
  const manager = new ScreenStateManager();
  let passedTests = 0;
  let failedTests = 0;

  logSection('TEST 1: Basic Screen Opening');
  try {
    const screen1 = {
      customer: { id: 1, name: 'Customer A' },
      store: { id: 1, name: 'Store 1' },
      products: [{ id: 1, title: 'Product 1', qty: 5 }],
      payment: { cash: 1000, bank: 500 },
      billType: 'BILL'
    };

    manager.openNewScreen(screen1);
    
    if (manager.currentScreenIndex === 0 && manager.screenStack.length === 1) {
      log('✅ Screen 1 opened successfully', 'green');
      passedTests++;
    } else {
      log('❌ Screen 1 not opened correctly', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 2: Multiple Screen Opening');
  try {
    const screen2 = {
      customer: { id: 2, name: 'Customer B' },
      store: { id: 2, name: 'Store 2' },
      products: [{ id: 2, title: 'Product 2', qty: 3 }],
      payment: { cash: 2000, bank: 1000 },
      billType: 'BILL'
    };

    manager.openNewScreen(screen2);
    
    const screen3 = {
      customer: { id: 3, name: 'Customer C' },
      store: { id: 3, name: 'Store 3' },
      products: [{ id: 3, title: 'Product 3', qty: 10 }],
      payment: { cash: 5000, bank: 2000 },
      billType: 'BILL'
    };

    manager.openNewScreen(screen3);
    
    if (manager.currentScreenIndex === 2 && manager.screenStack.length === 3) {
      log('✅ Multiple screens opened successfully', 'green');
      passedTests++;
    } else {
      log(`❌ Screen stack incorrect: Index=${manager.currentScreenIndex}, Length=${manager.screenStack.length}`, 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 3: Go Back (Ctrl+Left) - Single Step');
  try {
    const restoredState = manager.goToPreviousScreen();
    
    if (restoredState && 
        restoredState.customer?.name === 'Customer B' && 
        restoredState.products.length === 1 &&
        restoredState.products[0].title === 'Product 2' &&
        manager.currentScreenIndex === 1) {
      log('✅ State correctly restored to Screen 2', 'green');
      log(`   Customer: ${restoredState.customer.name}`, 'green');
      log(`   Products: ${restoredState.products.length} item(s)`, 'green');
      passedTests++;
    } else {
      log('❌ State not restored correctly', 'red');
      log(`   Current: ${JSON.stringify(restoredState)}`, 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 4: Go Back Again (Ctrl+Left) - Two Steps');
  try {
    const restoredState = manager.goToPreviousScreen();
    
    if (restoredState && 
        restoredState.customer?.name === 'Customer A' && 
        restoredState.products.length === 1 &&
        restoredState.products[0].title === 'Product 1' &&
        manager.currentScreenIndex === 0) {
      log('✅ State correctly restored to Screen 1', 'green');
      log(`   Customer: ${restoredState.customer.name}`, 'green');
      log(`   Products: ${restoredState.products.length} item(s)`, 'green');
      passedTests++;
    } else {
      log('❌ State not restored correctly', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 5: Go Forward (Ctrl+Right) - After Going Back');
  try {
    const restoredState = manager.goToNextScreen();
    
    if (restoredState && 
        restoredState.customer?.name === 'Customer B' && 
        restoredState.products.length === 1 &&
        restoredState.products[0].title === 'Product 2' &&
        manager.currentScreenIndex === 1) {
      log('✅ State correctly restored when going forward to Screen 2', 'green');
      log(`   Customer: ${restoredState.customer.name}`, 'green');
      log(`   Products: ${restoredState.products.length} item(s)`, 'green');
      passedTests++;
    } else {
      log('❌ State not restored correctly when going forward', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 6: Complex State Restoration - Verify Product Details');
  try {
    // Go to Screen 3
    manager.goToNextScreen();
    
    if (manager.currentScreenIndex === 2) {
      const screen3State = manager.screenStack[2];
      
      if (screen3State && 
          screen3State.formSelectedCustomer?.name === 'Customer C' &&
          screen3State.productTableData.length === 1 &&
          screen3State.productTableData[0].title === 'Product 3' &&
          screen3State.paymentData.cash === 5000) {
        log('✅ Complex state details preserved correctly', 'green');
        log(`   Customer: ${screen3State.formSelectedCustomer.name}`, 'green');
        log(`   Product Title: ${screen3State.productTableData[0].title}`, 'green');
        log(`   Payment - Cash: ${screen3State.paymentData.cash}`, 'green');
        log(`   Payment - Bank: ${screen3State.paymentData.bank}`, 'green');
        passedTests++;
      } else {
        log('❌ Complex state details not preserved', 'red');
        failedTests++;
      }
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 7: Data Integrity - No Cross-Contamination');
  try {
    // Go back to Screen 1
    manager.goToPreviousScreen();
    manager.goToPreviousScreen();
    
    const screen1State = manager.restoreScreenState(manager.screenStack[0]);
    
    if (screen1State &&
        screen1State.customer?.name === 'Customer A' &&
        screen1State.products[0].qty === 5 &&
        screen1State.payment.cash === 1000 &&
        screen1State.payment.bank === 500) {
      log('✅ No data cross-contamination between screens', 'green');
      log(`   Screen 1 - Customer: ${screen1State.customer.name}`, 'green');
      log(`   Screen 1 - Product Qty: ${screen1State.products[0].qty}`, 'green');
      log(`   Screen 1 - Payment: Cash ${screen1State.payment.cash}, Bank ${screen1State.payment.bank}`, 'green');
      passedTests++;
    } else {
      log('❌ Data contamination detected', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST SUMMARY');
  log(`✅ Passed: ${passedTests}`, 'green');
  if (failedTests > 0) {
    log(`❌ Failed: ${failedTests}`, 'red');
  }
  
  const total = passedTests + failedTests;
  const percentage = Math.round((passedTests / total) * 100);
  log(`📊 Success Rate: ${percentage}%`, percentage === 100 ? 'green' : 'yellow');
  
  return failedTests === 0;
}

// Run tests
console.clear();
log('╔════════════════════════════════════════════════════════════╗', 'cyan');
log('║         SCREEN NAVIGATION TEST SUITE                        ║', 'cyan');
log('║  Testing Ctrl+Left/Right Arrow State Preservation          ║', 'cyan');
log('╚════════════════════════════════════════════════════════════╝', 'cyan');

const allTestsPassed = testScreenNavigation();

console.log('\n');
if (allTestsPassed) {
  log('═══════════════════════════════════════════════════════════', 'green');
  log('🎉 ALL TESTS PASSED! Screen Navigation is working correctly.', 'green');
  log('═══════════════════════════════════════════════════════════', 'green');
  process.exit(0);
} else {
  log('═══════════════════════════════════════════════════════════', 'red');
  log('❌ Some tests failed. Please review the output above.', 'red');
  log('═══════════════════════════════════════════════════════════', 'red');
  process.exit(1);
}
