#!/bin/bash

# CMS Automation Development Environment Restart Script
# This script safely stops all running services and starts fresh

echo "🔄 Restarting CMS Automation Development Environment..."

# Step 1: Kill any existing Node processes on our ports
echo "📍 Checking for existing processes..."
PIDS=$(lsof -ti :5000,:5001,:5002 2>/dev/null)
if [ ! -z "$PIDS" ]; then
    echo "🛑 Found processes using ports 5000-5002, killing them..."
    echo $PIDS | xargs kill -9
    sleep 2
else
    echo "✅ No processes found on ports 5000-5002"
fi

# Step 2: Kill any remaining nodemon processes
echo "🧹 Cleaning up any remaining nodemon processes..."
pkill -f "nodemon" 2>/dev/null || echo "No nodemon processes found"
sleep 1

# Step 3: Verify ports are free
echo "🔍 Final port check..."
if lsof -i :5000 -i :5001 -i :5002 >/dev/null 2>&1; then
    echo "❌ Ports still in use! Please wait a moment and try again."
    exit 1
else
    echo "✅ All ports are free"
fi

# Step 4: Start development environment
echo "🚀 Starting development environment..."
cd "$(dirname "$0")/.." || exit 1
npm run dev