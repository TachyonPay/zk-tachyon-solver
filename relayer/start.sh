#!/bin/bash

echo "🚀 Starting Bridge Relayer Service"
echo "=================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "💡 Please copy env.example to .env and configure your settings:"
    echo "   cp env.example .env"
    echo "   # Then edit .env with your private key and network settings"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Start the service
echo "🚀 Starting relayer on port 3000..."
echo "📡 Health check: http://localhost:3000/health"
echo "🔗 Settle endpoint: http://localhost:3000/settle"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

npm start 