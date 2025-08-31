#!/bin/bash

# Wayzo Staging Deployment Script
# This script ONLY deploys to staging environments

set -e

echo "🚀 Wayzo Staging Deployment"
echo "=========================="
echo "⚠️  This will deploy to STAGING only"
echo ""

# Check if we're on staging branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "staging" ] && [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "❌ Warning: You're not on staging branch (current: $CURRENT_BRANCH)"
    echo "   Consider switching to staging branch first:"
    echo "   git checkout -b staging"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Staging deployment options
echo "Choose staging deployment platform:"
echo "1) Local staging server (http://localhost:3000)"
echo "2) Vercel staging preview"
echo "3) Netlify staging preview"
echo "4) Render staging service"
echo "5) Docker staging container"
echo ""

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "📦 Starting local staging server..."
        echo "✅ Staging server running at: http://localhost:3000"
        echo "   Press Ctrl+C to stop"
        cd frontend && python3 -m http.server 3000
        ;;
        
    2)
        echo "📦 Deploying to Vercel staging..."
        if ! command -v vercel &> /dev/null; then
            echo "❌ Vercel CLI not found. Install with: npm i -g vercel"
            exit 1
        fi
        vercel --env NODE_ENV=staging
        ;;
        
    3)
        echo "📦 Deploying to Netlify staging..."
        if ! command -v netlify &> /dev/null; then
            echo "❌ Netlify CLI not found. Install with: npm i -g netlify-cli"
            exit 1
        fi
        netlify deploy --dir=frontend --env NODE_ENV=staging
        ;;
        
    4)
        echo "📦 Deploying to Render staging..."
        echo "✅ Render staging configuration ready."
        echo "   Deploy via Render dashboard with staging environment variables:"
        echo "   - NODE_ENV=staging"
        echo "   - ORIGIN=https://wayzo-staging.onrender.com"
        ;;
        
    5)
        echo "📦 Building Docker staging image..."
        docker build -t wayzo:staging .
        echo "✅ Staging Docker image built. Run with:"
        echo "   docker run -p 3000:8080 -e NODE_ENV=staging wayzo:staging"
        ;;
        
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Staging deployment completed!"
echo "🔍 Test your staging deployment before merging to production."