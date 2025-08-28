#!/bin/bash

# 🚀 Wayzo Trip Planner - Render Deployment Script
# This script prepares and deploys the application to Render

set -e

echo "🚀 Starting Render deployment for Wayzo Trip Planner..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "frontend/index.backend.html" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Error: Git is not installed${NC}"
    exit 1
fi

# Check if we have uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    echo "Current git status:"
    git status --short
    
    read -p "Do you want to commit these changes before deploying? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}📝 Committing changes...${NC}"
        git add .
        git commit -m "Deploy to Render - $(date)"
    fi
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 Current branch: ${CURRENT_BRANCH}${NC}"

# Ensure we're on main branch for production deployment
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  Warning: You're not on the main branch${NC}"
    read -p "Do you want to switch to main branch? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout main
        echo -e "${GREEN}✅ Switched to main branch${NC}"
    fi
fi

# Push to remote if needed
echo -e "${BLUE}📤 Pushing to remote repository...${NC}"
git push origin main

echo ""
echo -e "${GREEN}🎉 Deployment preparation completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps to deploy to Render:${NC}"
echo ""
echo "1. 🌐 Go to https://render.com and sign in"
echo "2. 📁 Click 'New +' and select 'Static Site'"
echo "3. 🔗 Connect your GitHub repository"
echo "4. ⚙️  Configure the deployment:"
echo "   - Name: wayzo-trip-planner"
echo "   - Build Command: echo 'No build required'"
echo "   - Publish Directory: frontend"
echo "5. 🚀 Click 'Create Static Site'"
echo ""
echo -e "${YELLOW}💡 The render.yaml file is already configured for you!${NC}"
echo ""
echo -e "${GREEN}✅ Your application will be automatically deployed and updated on every push to main${NC}"
echo ""
echo -e "${BLUE}🔗 After deployment, you'll get a URL like: https://wayzo-trip-planner.onrender.com${NC}"
echo ""

# Check if we can create a deployment package
if command -v zip &> /dev/null; then
    echo -e "${BLUE}📦 Creating deployment package...${NC}"
    DEPLOY_DIR="wayzo-deploy-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$DEPLOY_DIR"
    cp -r frontend/* "$DEPLOY_DIR/"
    cp render.yaml "$DEPLOY_DIR/"
    cp package.json "$DEPLOY_DIR/"
    zip -r "${DEPLOY_DIR}.zip" "$DEPLOY_DIR"
    rm -rf "$DEPLOY_DIR"
    echo -e "${GREEN}✅ Deployment package created: ${DEPLOY_DIR}.zip${NC}"
    echo -e "${BLUE}💡 You can upload this zip file to Render if needed${NC}"
else
    echo -e "${YELLOW}⚠️  Zip not available - skipping deployment package creation${NC}"
fi

echo ""
echo -e "${GREEN}🎯 Ready to deploy to Render!${NC}"
echo -e "${BLUE}📚 For more help, visit: https://render.com/docs/deploy-a-static-site${NC}"