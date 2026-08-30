<?php
// Database Migration Script - Add advance_payment column

// Database configuration (adjust these with your actual credentials)
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "u889453186_parianwali";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "✅ Connected to database successfully!\n";

// SQL to add advance_payment column
$sql = "ALTER TABLE `sales` ADD COLUMN `advance_payment` DOUBLE NOT NULL DEFAULT 0 AFTER `bank_title`";

if ($conn->query($sql) === TRUE) {
    echo "✅ SUCCESS: advance_payment column added to sales table!\n";
} else {
    // Check if column already exists
    if (strpos($conn->error, "Duplicate column name") !== false) {
        echo "⚠️  Column already exists - no action needed\n";
    } else {
        echo "❌ Error: " . $conn->error . "\n";
    }
}

// Verify the column exists
$result = $conn->query("DESCRIBE sales");

echo "\n📋 Sales table structure:\n";
if ($result->num_rows > 0) {
    echo "Field | Type | Null | Key | Default\n";
    echo str_repeat("-", 50) . "\n";
    while($row = $result->fetch_assoc()) {
        echo $row["Field"] . " | " . $row["Type"] . " | " . $row["Null"] . " | " . $row["Key"] . " | " . $row["Default"] . "\n";
    }
}

$conn->close();
echo "\n✅ Migration complete!\n";
?>
