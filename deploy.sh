#!/bin/bash

# ====== WAYZO DEPLOYMENT SCRIPT ======
# This script provides multiple deployment options

echo "🚀 Wayzo Deployment Options"
echo "=========================="
echo ""

# Check if we're in the right directory
if [ ! -f "frontend/index.backend.html" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to deploy to GitHub Pages
deploy_github_pages() {
    echo "📦 Deploying to GitHub Pages..."
    
    # Check if gh-pages branch exists
    if git show-ref --verify --quiet refs/remotes/origin/gh-pages; then
        git checkout gh-pages
        git pull origin gh-pages
    else
        git checkout -b gh-pages
    fi
    
    # Copy frontend files
    cp -r frontend/* .
    
    # Commit and push
    git add .
    git commit -m "Deploy to GitHub Pages - $(date)"
    git push origin gh-pages
    
    echo "✅ Deployed to GitHub Pages!"
    echo "🌐 Your app is available at: https://fxcoop.github.io/wayzo/"
}

# Function to deploy to Netlify
deploy_netlify() {
    echo "📦 Deploying to Netlify..."
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        echo "❌ Netlify CLI not found. Installing..."
        npm install -g netlify-cli
    fi
    
    # Deploy to Netlify
    cd frontend
    netlify deploy --prod --dir=.
    
    echo "✅ Deployed to Netlify!"
}

# Function to deploy to Vercel
deploy_vercel() {
    echo "📦 Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "❌ Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    # Deploy to Vercel
    cd frontend
    vercel --prod
    
    echo "✅ Deployed to Vercel!"
}

# Function to create deployment package
create_package() {
    echo "📦 Creating deployment package..."
    
    # Create dist directory
    mkdir -p dist
    
    # Copy frontend files
    cp -r frontend/* dist/
    
    # Copy deployment configs
    cp netlify.toml dist/ 2>/dev/null || echo "No netlify.toml found"
    
    # Create README
    cat > dist/README.md << EOF
# Wayzo - Trip Planning Application

## Deployment Instructions

### Option 1: Netlify
1. Drag and drop this folder to Netlify
2. Your app will be deployed automatically

### Option 2: Vercel
1. Install Vercel CLI: \`npm i -g vercel\`
2. Run: \`vercel --prod\`

### Option 3: Any Static Hosting
1. Upload all files to your hosting provider
2. Ensure all files are in the root directory

## Features
- Multi-destination trip planning
- Professional admin dashboard
- Authentication system
- Mobile-responsive design
- Enterprise-ready architecture

## URLs
- Main App: /index.backend.html
- Admin Dashboard: /admin.html
EOF
    
    echo "✅ Deployment package created in 'dist/' folder"
    echo "📁 You can now upload the 'dist/' folder to any hosting provider"
}

# Function to show deployment status
show_status() {
    echo "📊 Deployment Status"
    echo "==================="
    
    # Check GitHub Pages
    if git show-ref --verify --quiet refs/remotes/origin/gh-pages; then
        echo "✅ GitHub Pages: Active"
        echo "   URL: https://fxcoop.github.io/wayzo/"
    else
        echo "❌ GitHub Pages: Not deployed"
    fi
    
    # Check if we have deployment configs
    if [ -f "netlify.toml" ]; then
        echo "✅ Netlify: Configuration ready"
    else
        echo "❌ Netlify: No configuration"
    fi
    
    echo ""
}

# Main menu
while true; do
    echo "Choose deployment option:"
    echo "1) Deploy to GitHub Pages"
    echo "2) Deploy to Netlify"
    echo "3) Deploy to Vercel"
    echo "4) Create deployment package"
    echo "5) Show deployment status"
    echo "6) Exit"
    echo ""
    read -p "Enter your choice (1-6): " choice
    
    case $choice in
        1)
            deploy_github_pages
            break
            ;;
        2)
            deploy_netlify
            break
            ;;
        3)
            deploy_vercel
            break
            ;;
        4)
            create_package
            break
            ;;
        5)
            show_status
            ;;
        6)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Please try again."
            ;;
    esac
    
    echo ""
done

echo ""
echo "🎉 Deployment completed!"
echo "Check the output above for your deployment URL."