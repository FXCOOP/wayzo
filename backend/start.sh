#!/bin/bash

# TripMaster AI Backend Startup Script

echo "🚀 Starting TripMaster AI Backend System..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Creating from template..."
    cp .env.example .env
    echo "📝 Please edit .env file with your configuration"
fi

# Initialize database
echo "🗄️  Initializing database..."
node -e "import('./lib/database.mjs').then(db => db.initializeDatabase())" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database initialized successfully"
else
    echo "⚠️  Database initialization had warnings (this is normal)"
fi

# Test system
echo "🧪 Running system tests..."
node test-system.mjs

if [ $? -eq 0 ]; then
    echo "✅ System tests passed"
else
    echo "⚠️  System tests had issues (check configuration)"
fi

# Start server
echo "🌐 Starting server..."
echo "📊 Server will be available at: http://localhost:10000"
echo "📚 API Documentation: http://localhost:10000/api-docs"
echo "🏥 Health Check: http://localhost:10000/healthz"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node server-new.mjs