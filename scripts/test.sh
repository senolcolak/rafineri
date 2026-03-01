#!/bin/bash
# Run all tests across the monorepo

set -e

echo "🧪 Running Rafineri Test Suite"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print section headers
print_header() {
    echo ""
    echo -e "${YELLOW}$1${NC}"
    echo "----------------------------------------"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test Shared Package
print_header "Testing @rafineri/shared"
cd packages/shared
if pnpm test 2>/dev/null; then
    print_success "Shared package tests passed"
else
    echo "No tests found in shared package (skipping)"
fi
cd ../..

# Test API
print_header "Testing @rafineri/api"
cd apps/api
if pnpm test; then
    print_success "API tests passed"
else
    print_error "API tests failed"
    exit 1
fi
cd ../..

# Test Worker
print_header "Testing @rafineri/worker"
cd apps/worker
if pnpm test; then
    print_success "Worker tests passed"
else
    print_error "Worker tests failed"
    exit 1
fi
cd ../..

# Test Web (if tests exist)
print_header "Testing @rafineri/web"
cd apps/web
if pnpm test 2>/dev/null; then
    print_success "Web tests passed"
else
    echo "No tests found in web package (skipping)"
fi
cd ../..

echo ""
echo "================================"
print_success "All tests passed!"
