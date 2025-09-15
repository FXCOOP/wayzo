#!/bin/bash

echo "🚀 Wayzo-Staging Deployment Script"
echo "=================================="

# Check if we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "fix-links-v36" ]; then
    echo "❌ Wrong branch. Current: $CURRENT_BRANCH, Expected: fix-links-v36"
    echo "Run: git checkout fix-links-v36"
    exit 1
fi

echo "✅ On correct branch: $CURRENT_BRANCH"

# Check if changes are committed
if ! git diff-index --quiet HEAD --; then
    echo "❌ Uncommitted changes detected"
    echo "Run: git add . && git commit -m 'deploy updates'"
    exit 1
fi

echo "✅ All changes committed"

# Push to remote
echo "📤 Pushing to remote repository..."
git push origin fix-links-v36

echo "✅ Code pushed to GitHub"
echo ""
echo "🎯 NEXT STEPS:"
echo "1. Go to https://render.com/dashboard"
echo "2. Create Web Service from GitHub repo"
echo "3. Select branch: fix-links-v36"
echo "4. Use configuration from render-deploy.yaml"
echo "5. Add your OPENAI_API_KEY environment variable"
echo "6. Deploy!"
echo ""
echo "📋 Configuration Summary:"
echo "- Branch: fix-links-v36"
echo "- Build: cd backend && npm install"
echo "- Start: cd backend && npm start"
echo "- Health: /healthz"
echo "- Port: 10000"
echo ""
echo "🎉 Ready for deployment!"