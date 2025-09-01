#!/bin/bash

# Feature Branch Deployment Setup Script
# This script helps set up the staging environment on Render.com

echo "🚀 Setting up Feature Branch Deployment on Render.com"
echo "=================================================="

echo ""
echo "📋 Prerequisites:"
echo "1. You have a Render.com account"
echo "2. Your GitHub repository is connected to Render"
echo "3. You're on the feature/backend-user-management-system branch"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "feature/backend-user-management-system" ]; then
    echo "❌ Error: You must be on the feature/backend-user-management-system branch"
    echo "Current branch: $CURRENT_BRANCH"
    echo "Please run: git checkout feature/backend-user-management-system"
    exit 1
fi

echo "✅ Current branch: $CURRENT_BRANCH"

echo ""
echo "🔧 Step 1: Create Staging Frontend Service"
echo "------------------------------------------"
echo "1. Go to https://dashboard.render.com"
echo "2. Click 'New +' → 'Static Site'"
echo "3. Connect your wayzo repository"
echo "4. Set Branch to: feature/backend-user-management-system"
echo "5. Configure:"
echo "   - Name: wayzo-trip-planner-staging"
echo "   - Build Command: echo 'No build required'"
echo "   - Publish Directory: frontend"
echo "   - Auto-Deploy: ✅ Enabled"
echo ""

read -p "Press Enter when you've created the staging frontend service..."

echo ""
echo "🔧 Step 2: Create Staging Backend Service"
echo "------------------------------------------"
echo "1. Click 'New +' → 'Web Service'"
echo "2. Connect same repository"
echo "3. Set Branch to: feature/backend-user-management-system"
echo "4. Configure:"
echo "   - Name: wayzo-backend-staging"
echo "   - Build Command: cd backend && npm install"
echo "   - Start Command: cd backend && npm start"
echo "   - Environment: Node"
echo "5. Add Environment Variables:"
echo "   - NODE_ENV: staging"
echo "   - PORT: 10000"
echo "   - JWT_SECRET: (auto-generated)"
echo "   - OPENAI_API_KEY: (your key)"
echo ""

read -p "Press Enter when you've created the staging backend service..."

echo ""
echo "🔧 Step 3: Get Your Staging URLs"
echo "--------------------------------"
echo "After both services are deployed, you'll have:"
echo "Frontend: https://wayzo-trip-planner-staging.onrender.com"
echo "Backend: https://wayzo-backend-staging.onrender.com"
echo ""

echo "🔧 Step 4: Update Environment Variables"
echo "--------------------------------------"
echo "1. Copy backend/.env.example to backend/.env"
echo "2. Update the URLs in .env:"
echo "   FRONTEND_URL=https://wayzo-trip-planner-staging.onrender.com"
echo "   BACKEND_URL=https://wayzo-backend-staging.onrender.com"
echo ""

echo "🔧 Step 5: Test Deployment"
echo "-------------------------"
echo "1. Make a small change to test auto-deployment"
echo "2. Push to feature branch:"
echo "   git add ."
echo "   git commit -m 'test: staging deployment'"
echo "   git push origin feature/backend-user-management-system"
echo "3. Check Render dashboard for deployment status"
echo "4. Test your staging URLs"
echo ""

echo "🎉 Setup Complete!"
echo "=================="
echo "Your staging environment is now ready for development."
echo "Every push to feature/backend-user-management-system will auto-deploy to staging."
echo ""
echo "Next steps:"
echo "1. Start implementing backend features"
echo "2. Test on staging environment"
echo "3. When ready, merge to main for production"
echo ""

echo "📚 Documentation:"
echo "- Backend Implementation Guide: docs/BACKEND_IMPLEMENTATION_GUIDE.md"
echo "- Git Workflow Strategy: docs/GIT_WORKFLOW_STRATEGY.md"
echo "- Feature Branch Deployment: docs/FEATURE_BRANCH_DEPLOYMENT.md"
echo ""