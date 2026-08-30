#!/bin/bash

echo "Stopping any running Node processes..."
pkill -f "next dev" || true
sleep 2

echo "Deleting old Prisma client..."
rm -rf node_modules/.prisma

echo "Regenerating Prisma client..."
npx prisma generate

echo "Done! You can now restart your dev server with: npm run dev"

