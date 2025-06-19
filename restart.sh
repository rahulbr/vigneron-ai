#!/bin/bash

echo "🔄 Cleaning up old processes..."
pkill -f next 2>/dev/null || true
pkill -f node 2>/dev/null || true

echo "🗑️ Removing build cache..."
rm -rf .next

echo "⏳ Waiting for cleanup..."
sleep 2

echo "🚀 Starting fresh Next.js server..."
npm run dev