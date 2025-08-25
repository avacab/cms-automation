#!/bin/bash

echo "🚀 Starting CMS Development Environment..."

# Start development database and services
echo "🐳 Starting database services..."
docker-compose -f docker/development/docker-compose.yml up -d

# Wait for database
echo "⏳ Waiting for database to be ready..."
sleep 5

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start all development servers
echo "🏃 Starting development servers..."
npm run dev
