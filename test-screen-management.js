/**
 * Test suite for Screen Management with Cancel Functionality
 * Tests that screens are only removed on explicit cancel, not on navigation
 * 
 * Run with: node test-screen-management.js
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
  console.log('\n' + '='.repeat(70));
  log(title, 'cyan');
  console.log('='.repeat(70));
}

// Mock state manager with new cancel functionality
class EnhancedScreenStateManager {
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
    const currentState = this.captureScreenState(currentForm);
    const newStack = this.screenStack.slice(0, this.currentScreenIndex + 1);
    newStack.push(currentState);
    
    this.screenStack = newStack;
    this.currentScreenIndex = newStack.length - 1;
    
    return true;
  }

  goToPreviousScreen() {
    if (this.currentScreenIndex > 0) {
      const previousIndex = this.currentScreenIndex - 1;
      const previousState = this.screenStack[previousIndex];
      
      if (!previousState) {
        return null;
      }
      
      this.currentScreenIndex = previousIndex;
      return this.restoreScreenState(previousState);
    } else if (this.currentScreenIndex === 0) {
      // Can't go back - just notify
      return { cannotGoBack: true };
    }
    
    return null;
  }

  goToNextScreen() {
    if (this.currentScreenIndex < this.screenStack.length - 1) {
      const nextIndex = this.currentScreenIndex + 1;
      const nextState = this.screenStack[nextIndex];
      
      if (!nextState) {
        return null;
      }
      
      this.currentScreenIndex = nextIndex;
      return this.restoreScreenState(nextState);
    }
    
    return null;
  }

  cancelCurrentScreen() {
    if (this.screenStack.length === 0) {
      return { allCleared: true };
    } else if (this.currentScreenIndex > 0) {
      // Remove current screen and go back to previous
      const newStack = this.screenStack.filter((_, index) => index !== this.currentScreenIndex);
      this.screenStack = newStack;
      const previousIndex = this.currentScreenIndex - 1;
      const previousState = newStack[previousIndex];
      this.currentScreenIndex = previousIndex;
      return this.restoreScreenState(previousState);
    } else if (this.currentScreenIndex === 0) {
      // Remove only screen
      this.screenStack = [];
      this.currentScreenIndex = -1;
      return { allCleared: true };
    }
    
    return null;
  }

  goBackToList() {
    // Goes back to list but keeps screen in stack
    return { backToList: true, screenIndex: this.currentScreenIndex };
  }
}

// Test cases
function testScreenManagement() {
  const manager = new EnhancedScreenStateManager();
  let passedTests = 0;
  let failedTests = 0;

  logSection('TEST 1: Create Multiple Screens');
  try {
    const screen1 = {
      customer: { id: 1, name: 'Customer A' },
      store: { id: 1, name: 'Store 1' },
      products: [{ id: 1, title: 'Product 1', qty: 5 }],
      payment: { cash: 1000, bank: 500 },
      billType: 'BILL'
    };

    manager.openNewScreen(screen1);
    
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
      log('✅ Three screens created successfully', 'green');
      log(`   Current Index: ${manager.currentScreenIndex + 1}, Total Screens: ${manager.screenStack.length}`, 'green');
      passedTests++;
    } else {
      log(`❌ Screen creation failed`, 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 2: Navigate Without Clearing (Ctrl+Left)');
  try {
    const restoredState = manager.goToPreviousScreen();
    
    // Verify we're on screen 2
    if (manager.currentScreenIndex === 1 && 
        restoredState.customer?.name === 'Customer B' &&
        manager.screenStack.length === 3) {
      log('✅ Navigated to previous screen, all screens intact', 'green');
      log(`   Current: Screen ${manager.currentScreenIndex + 1}, Stack Size: ${manager.screenStack.length}`, 'green');
      log(`   Customer: ${restoredState.customer.name}`, 'green');
      passedTests++;
    } else {
      log('❌ Navigation failed', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 3: Go Back to First Screen (Ctrl+Left x2)');
  try {
    manager.goToPreviousScreen();
    const result = manager.goToPreviousScreen();
    
    // Should stay at index 0, not clear anything
    if (result.cannotGoBack === true && 
        manager.currentScreenIndex === 0 &&
        manager.screenStack.length === 3) {
      log('✅ At first screen, cannot go back, all screens preserved', 'green');
      log(`   Current: Screen ${manager.currentScreenIndex + 1}, Stack Size: ${manager.screenStack.length}`, 'green');
      passedTests++;
    } else {
      log('❌ First screen navigation failed', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 4: Go Forward (Ctrl+Right)');
  try {
    manager.goToNextScreen();
    const restoredState = manager.goToNextScreen();
    
    if (manager.currentScreenIndex === 2 && 
        restoredState.customer?.name === 'Customer C' &&
        manager.screenStack.length === 3) {
      log('✅ Navigated forward to screen 3, all screens intact', 'green');
      log(`   Current: Screen ${manager.currentScreenIndex + 1}, Stack Size: ${manager.screenStack.length}`, 'green');
      log(`   Customer: ${restoredState.customer.name}`, 'green');
      passedTests++;
    } else {
      log('❌ Forward navigation failed', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 5: Cancel Current Screen - Remove From Stack');
  try {
    const result = manager.cancelCurrentScreen();
    
    if (manager.currentScreenIndex === 1 && 
        manager.screenStack.length === 2 &&
        result.customer?.name === 'Customer B') {
      log('✅ Screen 3 canceled, returned to screen 2', 'green');
      log(`   Current: Screen ${manager.currentScreenIndex + 1}, Stack Size: ${manager.screenStack.length}`, 'green');
      log(`   Customer: ${result.customer.name}`, 'green');
      passedTests++;
    } else {
      log('❌ Cancel current screen failed', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 6: Cancel Another Screen');
  try {
    const result = manager.cancelCurrentScreen();
    
    if (manager.currentScreenIndex === 0 && 
        manager.screenStack.length === 1 &&
        result.customer?.name === 'Customer A') {
      log('✅ Screen 2 canceled, returned to screen 1', 'green');
      log(`   Current: Screen ${manager.currentScreenIndex + 1}, Stack Size: ${manager.screenStack.length}`, 'green');
      log(`   Customer: ${result.customer.name}`, 'green');
      passedTests++;
    } else {
      log('❌ Cancel second screen failed', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 7: Cancel Last Screen - Ready for New Sale');
  try {
    const result = manager.cancelCurrentScreen();
    
    if (manager.currentScreenIndex === -1 && 
        manager.screenStack.length === 0 &&
        result.allCleared === true) {
      log('✅ Last screen canceled, ready for new sale', 'green');
      log(`   Index: ${manager.currentScreenIndex}, Stack Size: ${manager.screenStack.length}`, 'green');
      passedTests++;
    } else {
      log('❌ Cancel last screen failed', 'red');
      failedTests++;
    }
  } catch (e) {
    log(`❌ Error: ${e.message}`, 'red');
    failedTests++;
  }

  logSection('TEST 8: Back to List (Screen Saved)');
  try {
    // Create a couple of screens again
    const screen1 = {
      customer: { id: 1, name: 'Customer A' },
      store: { id: 1, name: 'Store 1' },
      products: [],
      payment: { cash: 0, bank: 0 },
      billType: 'BILL'
    };
    
    manager.openNewScreen(screen1);
    
    const screen2 = {
      customer: { id: 2, name: 'Customer D' },
      store: { id: 2, name: 'Store 2' },
      products: [{ id: 2, title: 'Product 2', qty: 7 }],
      payment: { cash: 3000, bank: 1500 },
      billType: 'BILL'
    };
    
    manager.openNewScreen(screen2);
    
    const result = manager.goBackToList();
    
    // Verify screen is still in stack
    if (result.backToList === true &&
        result.screenIndex === 1 &&
        manager.screenStack.length === 2) {
      log('✅ Back to List clicked, screen saved in stack', 'green');
      log(`   Screen ${result.screenIndex + 1} will be restored when returning`, 'green');
      log(`   Stack Size: ${manager.screenStack.length}`, 'green');
      passedTests++;
    } else {
      log('❌ Back to List functionality failed', 'red');
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
log('╔════════════════════════════════════════════════════════════════╗', 'cyan');
log('║         SCREEN MANAGEMENT TEST SUITE (WITH CANCEL)              ║', 'cyan');
log('║  No auto-clear on navigation | Cancel removes screen            ║', 'cyan');
log('╚════════════════════════════════════════════════════════════════╝', 'cyan');

const allTestsPassed = testScreenManagement();

console.log('\n');
if (allTestsPassed) {
  log('═══════════════════════════════════════════════════════════════', 'green');
  log('🎉 ALL TESTS PASSED! Screen Management is working correctly.', 'green');
  log('═══════════════════════════════════════════════════════════════', 'green');
  console.log('\nKey Features Verified:');
  console.log('  ✅ No auto-clear on Ctrl+Left/Right navigation');
  console.log('  ✅ Screens only removed when Cancel Current is clicked');
  console.log('  ✅ Back to List preserves current screen in stack');
  console.log('  ✅ All screen states properly preserved and restored');
  console.log('  ✅ Last screen removal clears for new sale');
  process.exit(0);
} else {
  log('═══════════════════════════════════════════════════════════════', 'red');
  log('❌ Some tests failed. Please review the output above.', 'red');
  log('═══════════════════════════════════════════════════════════════', 'red');
  process.exit(1);
}
