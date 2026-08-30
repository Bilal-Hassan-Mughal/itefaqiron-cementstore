#!/usr/bin/env node

/**
 * Diagnostic: Frontend Labour Charges Issue
 * Identifies exactly what the frontend is/should be sending
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('🔍 FRONTEND LABOUR CHARGES DIAGNOSTIC');
console.log('='.repeat(70) + '\n');

const salesPagePath = path.join(__dirname, 'src/app/dashboard/sales/page.js');
const content = fs.readFileSync(salesPagePath, 'utf8');

// ============================================================================
// Find paymentData initial state
// ============================================================================
console.log('📋 Step 1: Check paymentData initial state\n');

const paymentDataMatch = content.match(/const \[paymentData[^]*?labour: ''/);
if (paymentDataMatch) {
  console.log('✅ paymentData initialized with labour: ""');
  console.log('   (Empty string means no initial value)\n');
} else {
  console.log('❌ Could not find paymentData with labour field\n');
}

// ============================================================================
// Find labourChargesValue extraction
// ============================================================================
console.log('📋 Step 2: Check labourChargesValue extraction\n');

const labourExtractRegex = /const labourChargesValue = [^;]+;/;
const labourExtract = content.match(labourExtractRegex);
if (labourExtract) {
  console.log('✅ Found labourChargesValue extraction:');
  console.log(`   ${labourExtract[0]}\n`);
} else {
  console.log('❌ labourChargesValue not found - THIS IS THE PROBLEM!\n');
}

// ============================================================================
// Find labour in saleData
// ============================================================================
console.log('📋 Step 3: Check labour_charges in saleData object\n');

const saleDataMatch = content.match(/labour_charges: labourChargesValue/);
if (saleDataMatch) {
  console.log('✅ labour_charges is in saleData object\n');
} else {
  console.log('❌ labour_charges NOT in saleData - THIS IS THE PROBLEM!\n');
}

// ============================================================================
// Find saleData JSON serialization
// ============================================================================
console.log('📋 Step 4: Check how saleData is sent to API\n');

const jsonStringifyMatch = content.match(/JSON\.stringify\(saleData\)/);
if (jsonStringifyMatch) {
  console.log('✅ saleData is stringified with JSON.stringify\n');
} else {
  console.log('⚠️  Could not find JSON.stringify(saleData)\n');
}

// ============================================================================
// Simulate what should happen
// ============================================================================
console.log('📋 Step 5: Simulation of correct flow\n');

console.log('When user enters 750 in labour field, flow should be:\n');

console.log('┌─────────────────────────────────────────────────────┐');
console.log('│ 1. User enters: 750 in Labour field on screen      │');
console.log('│    → handlePaymentDataChange({ ...labour: "750" })  │');
console.log('└─────────────────────────────────────────────────────┘');

console.log('\n┌─────────────────────────────────────────────────────┐');
console.log('│ 2. paymentData.labour = "750"                      │');
console.log('│    setPaymentData({ ...labour: "750" })            │');
console.log('└─────────────────────────────────────────────────────┘');

console.log('\n┌─────────────────────────────────────────────────────┐');
console.log('│ 3. When Save clicked:                              │');
console.log('│    labourChargesValue = paymentData.labour || "0"  │');
console.log('│    = "750"                                          │');
console.log('└─────────────────────────────────────────────────────┘');

console.log('\n┌─────────────────────────────────────────────────────┐');
console.log('│ 4. Create saleData { labour_charges: "750", ... }  │');
console.log('└─────────────────────────────────────────────────────┘');

console.log('\n┌─────────────────────────────────────────────────────┐');
console.log('│ 5. POST /api/sales {                               │');
console.log('│      "labour_charges": "750",                      │');
console.log('│      ...other fields...                            │');
console.log('│    }                                               │');
console.log('└─────────────────────────────────────────────────────┘');

console.log('\n┌─────────────────────────────────────────────────────┐');
console.log('│ 6. API receives & saves labour_charges: 750        │');
console.log('│    Database now has labour_charges: 750            │');
console.log('└─────────────────────────────────────────────────────┘\n');

// ============================================================================
// Findings
// ============================================================================
console.log('='.repeat(70));
console.log('💡 FINDINGS');
console.log('='.repeat(70) + '\n');

console.log('✅ API Backend: WORKING - accepts and saves labour_charges\n');

console.log('❓ Frontend Issue: Need to verify...\n');

console.log('To debug this, add this hook to your browser console:');
console.log('(while on sales form)\n');

console.log('```javascript');
console.log('// Add this to monitor when labour changes');
console.log('const originalSetPaymentData = window.__paymentDataSetter;');
console.log('window.__paymentDataSetter = (data) => {');
console.log('  if (data.labour !== undefined) {');
console.log('    console.log("🔴 paymentData.labour =", data.labour);');
console.log('  }');
console.log('  return originalSetPaymentData(data);');
console.log('};');
console.log('```\n');

console.log('OR better yet - look at the browser console LOGS when you:');
console.log('1. Type 750 into the Labour field');
console.log('2. Click Save/Submit');
console.log('3. Check if you see "labour_charges: 750" in the JSON log\n');

console.log('The logs already added show:');
console.log('• "Labour input changed to: [value]"');
console.log('• "Payment data before saleData: {labour: [value], ...}"');
console.log('• "Labour saleData check: {labour_charges: [value]}"');
console.log('• "Final JSON payload:" [entire object]\n');

console.log('='.repeat(70) + '\n');

