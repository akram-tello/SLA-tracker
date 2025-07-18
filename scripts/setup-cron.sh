#!/bin/bash

# ETL Cron Job Setup Script
# This script helps set up hourly ETL sync cron jobs

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CRON_SCRIPT="$SCRIPT_DIR/etl-cron.sh"
CRON_JOB="0 * * * * $CRON_SCRIPT"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  ETL Cron Job Setup${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Check if running as root (optional)
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. This is not recommended for security reasons."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_header

# Check environment configuration
print_section() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_section "Environment Configuration"
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    print_status "Found .env.local file"
    
    # Check for ETL_API_URL
    if grep -q "ETL_API_URL" "$PROJECT_ROOT/.env.local"; then
        ETL_API_URL=$(grep "ETL_API_URL" "$PROJECT_ROOT/.env.local" | cut -d'=' -f2)
        print_status "ETL_API_URL configured: $ETL_API_URL"
    else
        print_warning "ETL_API_URL not found in .env.local"
        print_warning "For production, add: ETL_API_URL=https://yourdomain.com"
    fi
else
    print_warning "No .env.local file found"
    print_status "Copy env.example to .env.local and configure your settings"
fi

# Check if cron script exists
if [ ! -f "$CRON_SCRIPT" ]; then
    print_error "ETL cron script not found at: $CRON_SCRIPT"
    exit 1
fi

# Check if cron script is executable
if [ ! -x "$CRON_SCRIPT" ]; then
    print_status "Making cron script executable..."
    chmod +x "$CRON_SCRIPT"
fi

# Check if crontab is available
if ! command -v crontab &> /dev/null; then
    print_error "crontab command not found. Please install cron/crontab first."
    exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    print_error "curl command not found. Please install curl first."
    exit 1
fi

print_status "Setting up ETL cron job..."

# Create temporary crontab file
TEMP_CRON=$(mktemp)

# Get current crontab
crontab -l 2>/dev/null > "$TEMP_CRON"

# Check if cron job already exists
if grep -q "$CRON_SCRIPT" "$TEMP_CRON"; then
    print_warning "ETL cron job already exists in crontab."
    echo "Current cron job:"
    grep "$CRON_SCRIPT" "$TEMP_CRON"
    echo
    
    read -p "Do you want to remove the existing job and add a new one? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove existing job
        sed -i "\|$CRON_SCRIPT|d" "$TEMP_CRON"
        print_status "Removed existing ETL cron job."
    else
        print_status "Keeping existing cron job. Setup complete."
        rm "$TEMP_CRON"
        exit 0
    fi
fi

# Add new cron job
echo "# ETL Sync Job - Runs every hour" >> "$TEMP_CRON"
echo "$CRON_JOB" >> "$TEMP_CRON"
echo "" >> "$TEMP_CRON"

# Install new crontab
if crontab "$TEMP_CRON"; then
    print_status "ETL cron job installed successfully!"
    echo
    echo "Cron job details:"
    echo "  Schedule: Every hour at minute 0"
    echo "  Script: $CRON_SCRIPT"
    echo "  Logs: $PROJECT_ROOT/logs/"
    echo
    print_status "To view current crontab: crontab -l"
    print_status "To edit crontab: crontab -e"
    print_status "To remove cron job: crontab -e (then delete the line)"
else
    print_error "Failed to install crontab."
    rm "$TEMP_CRON"
    exit 1
fi

# Clean up
rm "$TEMP_CRON"

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"
print_status "Created logs directory: $PROJECT_ROOT/logs"

# Test the cron script
print_status "Testing ETL cron script..."
if "$CRON_SCRIPT" > /dev/null 2>&1; then
    print_status "Cron script test completed."
else
    print_warning "Cron script test failed. This might be normal if the API server is not running."
    print_warning "Make sure your server is running and ETL_API_URL is configured correctly."
fi

echo
print_status "Setup complete! The ETL sync will run every hour."
print_status "Check the logs directory for execution logs and any errors."

# Production deployment notes
if [ "$NODE_ENV" = "production" ] || [ -n "$ETL_API_URL" ]; then
    echo
    print_section "Production Deployment Notes"
    print_status "For production deployment:"
    echo "  1. Ensure ETL_API_URL is set to your production domain"
    echo "  2. Verify database connections are configured for production"
    echo "  3. Test the cron job manually: ./scripts/etl-cron.sh"
    echo "  4. Monitor logs: npm run etl:monitor"
    echo "  5. Set up log rotation if needed"
fi 