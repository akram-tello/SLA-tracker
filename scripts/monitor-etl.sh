#!/bin/bash

# ETL Sync Monitoring Script
# This script helps monitor ETL sync jobs and view logs

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"

# Load environment variables if .env.local exists
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env.local" | xargs)
fi

# API URL configuration - supports both development and production
API_URL="${ETL_API_URL:-http://localhost:3000/api/v1/etl/status}"
API_URL="${API_URL%/api/v1/etl/status}/api/v1/etl/status"

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
    echo -e "${BLUE}  ETL Sync Monitor${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_section() {
    echo -e "${CYAN}--- $1 ---${NC}"
}

# Function to check if logs directory exists
check_logs_directory() {
    if [ ! -d "$LOG_DIR" ]; then
        print_error "Logs directory not found: $LOG_DIR"
        print_status "Run the setup script first: ./scripts/setup-cron.sh"
        exit 1
    fi
}

# Function to show recent logs
show_recent_logs() {
    local days=${1:-1}
    print_section "Recent ETL Sync Logs (Last $days day(s))"
    
    # Find log files from the last N days
    find "$LOG_DIR" -name "etl-sync-*.log" -mtime -$days 2>/dev/null | while read -r log_file; do
        if [ -f "$log_file" ]; then
            echo -e "${YELLOW}Log file: $(basename "$log_file")${NC}"
            echo "Last 10 entries:"
            tail -10 "$log_file" | sed 's/^/  /'
            echo
        fi
    done
}

# Function to show error logs
show_error_logs() {
    local days=${1:-1}
    print_section "Recent ETL Sync Errors (Last $days day(s))"
    
    # Find error log files from the last N days
    find "$LOG_DIR" -name "etl-sync-errors-*.log" -mtime -$days 2>/dev/null | while read -r error_file; do
        if [ -f "$error_file" ]; then
            echo -e "${RED}Error file: $(basename "$error_file")${NC}"
            if [ -s "$error_file" ]; then
                cat "$error_file" | sed 's/^/  /'
            else
                echo "  No errors found"
            fi
            echo
        fi
    done
}

# Function to check ETL API status
check_api_status() {
    print_section "ETL API Status"
    print_status "Checking API at: $API_URL"
    
    if curl -s --max-time 10 "$API_URL" > /dev/null 2>&1; then
        print_status "ETL API is accessible"
        
        # Get detailed status
        local status_response=$(curl -s "$API_URL" 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo "API Response:"
            echo "$status_response" | jq '.' 2>/dev/null || echo "$status_response"
        fi
    else
        print_error "ETL API is not accessible"
        print_warning "Make sure your server is running and ETL_API_URL is configured correctly"
        print_warning "Current API URL: $API_URL"
    fi
}

# Function to check cron job status
check_cron_status() {
    print_section "Cron Job Status"
    
    if command -v crontab &> /dev/null; then
        local cron_job=$(crontab -l 2>/dev/null | grep "etl-cron.sh")
        if [ -n "$cron_job" ]; then
            print_status "ETL cron job is installed:"
            echo "  $cron_job"
        else
            print_warning "ETL cron job not found in crontab"
            print_status "Run setup script: ./scripts/setup-cron.sh"
        fi
    else
        print_error "crontab command not available"
    fi
}

# Function to show sync statistics
show_sync_stats() {
    print_section "Sync Statistics"
    
    # Count successful syncs in the last 7 days
    local success_count=$(find "$LOG_DIR" -name "etl-sync-*.log" -mtime -7 2>/dev/null | xargs grep -l "completed successfully" 2>/dev/null | wc -l)
    
    # Count failed syncs in the last 7 days
    local error_count=$(find "$LOG_DIR" -name "etl-sync-errors-*.log" -mtime -7 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    
    echo "Last 7 days:"
    echo "  Successful syncs: $success_count"
    echo "  Error entries: $error_count"
    
    # Show last sync time
    local last_sync=$(find "$LOG_DIR" -name "etl-sync-*.log" -mtime -7 2>/dev/null | xargs grep "completed successfully" 2>/dev/null | tail -1 | cut -d' ' -f1,2)
    if [ -n "$last_sync" ]; then
        echo "  Last successful sync: $last_sync"
    else
        echo "  Last successful sync: Not found"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -l, --logs [DAYS]     Show recent logs (default: 1 day)"
    echo "  -e, --errors [DAYS]   Show recent errors (default: 1 day)"
    echo "  -a, --api             Check API status"
    echo "  -c, --cron            Check cron job status"
    echo "  -s, --stats           Show sync statistics"
    echo "  -h, --help            Show this help message"
    echo
    echo "Environment Variables:"
    echo "  ETL_API_URL           API base URL (default: http://localhost:3000)"
    echo
    echo "Examples:"
    echo "  $0                    Show all information"
    echo "  $0 -l 3              Show logs from last 3 days"
    echo "  $0 -e 7              Show errors from last 7 days"
    echo "  $0 -a                Check only API status"
}

# Main script logic
main() {
    print_header
    
    # Check if logs directory exists
    check_logs_directory
    
    # Parse command line arguments
    local show_logs=false
    local show_errors=false
    local show_api=false
    local show_cron=false
    local show_stats=false
    local log_days=1
    local error_days=1
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -l|--logs)
                show_logs=true
                if [[ $2 =~ ^[0-9]+$ ]]; then
                    log_days=$2
                    shift 2
                else
                    shift
                fi
                ;;
            -e|--errors)
                show_errors=true
                if [[ $2 =~ ^[0-9]+$ ]]; then
                    error_days=$2
                    shift 2
                else
                    shift
                fi
                ;;
            -a|--api)
                show_api=true
                shift
                ;;
            -c|--cron)
                show_cron=true
                shift
                ;;
            -s|--stats)
                show_stats=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # If no specific options provided, show all
    if [ "$show_logs" = false ] && [ "$show_errors" = false ] && [ "$show_api" = false ] && [ "$show_cron" = false ] && [ "$show_stats" = false ]; then
        show_logs=true
        show_errors=true
        show_api=true
        show_cron=true
        show_stats=true
    fi
    
    # Execute requested functions
    if [ "$show_logs" = true ]; then
        show_recent_logs "$log_days"
    fi
    
    if [ "$show_errors" = true ]; then
        show_error_logs "$error_days"
    fi
    
    if [ "$show_api" = true ]; then
        check_api_status
    fi
    
    if [ "$show_cron" = true ]; then
        check_cron_status
    fi
    
    if [ "$show_stats" = true ]; then
        show_sync_stats
    fi
    
    echo
    print_status "Monitoring complete!"
}

# Run main function with all arguments
main "$@" 