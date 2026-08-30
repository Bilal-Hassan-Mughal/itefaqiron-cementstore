#!/usr/bin/env node

/**
 * Database Migration Script - Add advance_payment column to sales table
 * Run this to add the missing advance_payment column
 */

const mysql = require('mysql2/promise');

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'u889453186_parianwali'
    });

    console.log('✅ Connected to database successfully!');

    // Check if column already exists
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'advance_payment'`
    );

    if (columns.length > 0) {
      console.log('⚠️  Column advance_payment already exists - no action needed');
      await connection.end();
      return;
    }

    // Add the column
    const sql = 'ALTER TABLE `sales` ADD COLUMN `advance_payment` DOUBLE NOT NULL DEFAULT 0 AFTER `bank_title`';
    await connection.execute(sql);
    console.log('✅ SUCCESS: advance_payment column added to sales table!');

    // Verify
    const [result] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'sales' 
       ORDER BY ORDINAL_POSITION`
    );

    console.log('\n📋 Sales table structure:');
    console.log('Field | Type | Null | Default');
    console.log('-'.repeat(50));
    result.forEach(col => {
      console.log(`${col.COLUMN_NAME} | ${col.COLUMN_TYPE} | ${col.IS_NULLABLE} | ${col.COLUMN_DEFAULT}`);
    });

    await connection.end();
    console.log('\n✅ Migration complete!');
    process.exit(0);

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Column already exists - no action needed');
      process.exit(0);
    }
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
