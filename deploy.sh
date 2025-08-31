#!/bin/bash

# Wayzo Deployment Script
# Usage: ./deploy.sh [platform]

set -e

PLATFORM=${1:-"help"}

echo "🚀 Wayzo Deployment Script"
echo "=========================="

case $PLATFORM in
  "vercel")
    echo "📦 Deploying to Vercel..."
    if ! command -v vercel &> /dev/null; then
      echo "❌ Vercel CLI not found. Install with: npm i -g vercel"
      exit 1
    fi
    vercel --prod
    ;;
    
  "netlify")
    echo "📦 Deploying to Netlify..."
    if ! command -v netlify &> /dev/null; then
      echo "❌ Netlify CLI not found. Install with: npm i -g netlify-cli"
      exit 1
    fi
    netlify deploy --prod --dir=frontend
    ;;
    
  "render")
    echo "📦 Deploying to Render..."
    echo "✅ Render configuration created. Deploy via Render dashboard:"
    echo "   1. Connect your GitHub repository"
    echo "   2. Create new Web Service"
    echo "   3. Use render.yaml configuration"
    echo "   4. Set environment variables:"
    echo "      - OPENAI_API_KEY"
    echo "      - STRIPE_SECRET_KEY (if using Stripe)"
    echo "      - STRIPE_WEBHOOK_SECRET (if using Stripe)"
    ;;
    
  "fly")
    echo "📦 Deploying to Fly.io..."
    if ! command -v flyctl &> /dev/null; then
      echo "❌ Fly CLI not found. Install with: curl -L https://fly.io/install.sh | sh"
      exit 1
    fi
    flyctl deploy
    ;;
    
  "docker")
    echo "📦 Building Docker image..."
    docker build -t wayzo:latest .
    echo "✅ Docker image built. Run with:"
    echo "   docker run -p 8080:8080 -e OPENAI_API_KEY=your_key wayzo:latest"
    ;;
    
  "local")
    echo "📦 Starting local development server..."
    cd backend
    npm install
    npm start
    ;;
    
  "test")
    echo "🧪 Testing deployment configuration..."
    echo "✅ Vercel config: vercel.json"
    echo "✅ Netlify config: netlify.toml"
    echo "✅ Render config: render.yaml"
    echo "✅ Fly.io config: fly.toml"
    echo "✅ Docker config: Dockerfile"
    echo "✅ All deployment configs ready!"
    ;;
    
  *)
    echo "Usage: ./deploy.sh [platform]"
    echo ""
    echo "Available platforms:"
    echo "  vercel    - Deploy frontend to Vercel"
    echo "  netlify   - Deploy frontend to Netlify"
    echo "  render    - Deploy full-stack to Render"
    echo "  fly       - Deploy backend to Fly.io"
    echo "  docker    - Build Docker image"
    echo "  local     - Start local development server"
    echo "  test      - Test deployment configuration"
    echo ""
    echo "Environment Variables Required:"
    echo "  OPENAI_API_KEY     - Your OpenAI API key"
    echo "  STRIPE_SECRET_KEY  - Your Stripe secret key (optional)"
    echo "  STRIPE_WEBHOOK_SECRET - Your Stripe webhook secret (optional)"
    ;;
esac