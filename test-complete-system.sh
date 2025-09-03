#!/bin/bash

# 🚀 Wayzo System Test Script
# Comprehensive testing of all system components

echo "🚀 Testing Wayzo Complete System..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_output="$3"
    
    echo -e "${BLUE}Testing: ${test_name}${NC}"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "  ${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
    fi
}

# Function to check URL accessibility
check_url() {
    local url="$1"
    local test_name="$2"
    
    echo -e "${BLUE}Testing: ${test_name}${NC}"
    if curl -s --max-time 10 "$url" > /dev/null; then
        echo -e "  ${GREEN}✅ PASS - URL accessible${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "  ${RED}❌ FAIL - URL not accessible${NC}"
        ((TESTS_FAILED++))
    fi
}

echo ""
echo "📋 System Architecture Tests"
echo "---------------------------"

# Test 1: Check if we're in the right directory
run_test "Project Structure" "test -f ../README.md" "README.md exists"

# Test 2: Check backend files
run_test "Backend Files" "test -f server.mjs && test -f server-new.mjs" "Backend files exist"

# Test 3: Check frontend files
run_test "Frontend Files" "test -f ../frontend/index.backend.html" "Frontend files exist"

# Test 4: Check database
run_test "Database File" "test -f wayzo.sqlite" "Database exists"

echo ""
echo "🔧 Backend System Tests"
echo "----------------------"

# Test 5: Database initialization
run_test "Database Schema" "node -e \"import('./lib/database.mjs').then(db => db.initializeDatabase())\"" "Database schema"

# Test 6: Node.js version
run_test "Node.js Version" "node --version | grep -q 'v20'" "Node.js 20.x"

# Test 7: Dependencies
run_test "Dependencies" "test -f package.json && test -d node_modules" "Dependencies installed"

echo ""
echo "🌐 Deployment Tests"
echo "------------------"

# Test 8: Check staging backend
check_url "https://wayzo-backend-staging.onrender.com/healthz" "Staging Backend Health"

# Test 9: Check staging frontend
check_url "https://wayzo-trip-planner-staging.onrender.com" "Staging Frontend"

# Test 10: Check version endpoint
check_url "https://wayzo-backend-staging.onrender.com/version" "Version Endpoint"

echo ""
echo "📚 Documentation Tests"
echo "---------------------"

# Test 11: Check documentation files
run_test "System Manual" "test -f ../docs/COMPLETE_SYSTEM_MANUAL.md" "System manual exists"
run_test "Backend Guide" "test -f IMPLEMENTATION_GUIDE.md" "Backend guide exists"
run_test "Architecture Doc" "test -f ../docs/ARCHITECTURE.md" "Architecture doc exists"

echo ""
echo "🔒 Security Tests"
echo "----------------"

# Test 12: Check environment file
run_test "Environment Template" "test -f .env.example" "Environment template exists"

# Test 13: Check JWT secret
run_test "JWT Configuration" "grep -q 'JWT_SECRET' .env.example" "JWT configuration"

echo ""
echo "📊 Analytics Tests"
echo "-----------------"

# Test 14: Check analytics module
run_test "Analytics Module" "test -f lib/analytics.mjs" "Analytics module exists"

# Test 15: Check admin module
run_test "Admin Module" "test -f lib/admin.mjs" "Admin module exists"

echo ""
echo "📧 Email System Tests"
echo "-------------------"

# Test 16: Check email module
run_test "Email Module" "test -f lib/email.mjs" "Email module exists"

# Test 17: Check email templates
run_test "Email Templates" "grep -q 'email_templates' lib/database.mjs" "Email templates table"

echo ""
echo "🎯 API Tests"
echo "-----------"

# Test 18: Check API documentation
run_test "API Docs Module" "test -f lib/api-docs.mjs" "API docs module exists"

# Test 19: Check main API endpoints
run_test "Plan Endpoint" "grep -q '/api/plan' server.mjs" "Plan API endpoint"
run_test "Auth Endpoint" "grep -q '/api/auth' server-new.mjs" "Auth API endpoint"

echo ""
echo "📈 Results Summary"
echo "================="

echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
    echo -e "${BLUE}Success Rate: ${SUCCESS_RATE}%${NC}"
fi

echo ""
echo "🎯 System Status"
echo "================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! System is ready for deployment.${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed. Please check the issues above.${NC}"
fi

echo ""
echo "📋 Next Steps"
echo "============"
echo "1. Set up environment variables in .env"
echo "2. Configure email service (Gmail app password)"
echo "3. Deploy to Render.com"
echo "4. Test all endpoints with curl or Postman"
echo "5. Access admin panel at /admin"
echo "6. Review the complete system manual"

echo ""
echo "📚 Documentation"
echo "==============="
echo "📖 Complete System Manual: docs/COMPLETE_SYSTEM_MANUAL.md"
echo "🔧 Backend Guide: backend/IMPLEMENTATION_GUIDE.md"
echo "🏗️ Architecture: docs/ARCHITECTURE.md"
echo "🚀 Deployment: docs/DEPLOYMENT.md"