#!/bin/bash

# ETL Sync Cron Job Script
# Runs every hour to sync data from master database to analytics database

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"

# Load environment variables if .env.local or .env exists
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env.local" | xargs)
elif [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# API URL configuration - supports both development and production
API_URL="${ETL_API_URL:-http://localhost:3000/api/v1/etl/sync}"
TIMEOUT=300  # 5 minutes timeout

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Log file with timestamp
LOG_FILE="$LOG_DIR/etl-sync-$(date +%Y%m%d).log"
ERROR_LOG="$LOG_DIR/etl-sync-errors-$(date +%Y%m%d).log"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$ERROR_LOG" >> "$LOG_FILE"
}

# Start sync process
log_message "Starting ETL sync job..."
log_message "API URL: $API_URL"

# Check if the API is accessible
if ! curl -s --max-time 10 "$API_URL" > /dev/null 2>&1; then
    log_error "API endpoint is not accessible at: $API_URL"
    log_error "Please check if the server is running and ETL_API_URL is configured correctly."
    exit 1
fi

# Execute ETL sync with timeout (macOS compatible)
log_message "Executing ETL sync via API..."
SYNC_START=$(date +%s)

# Run the sync with timeout and capture output (macOS compatible)
if command -v timeout >/dev/null 2>&1; then
    # Linux/Unix systems with timeout command
    SYNC_OUTPUT=$(timeout $TIMEOUT curl -s -X POST "$API_URL" 2>&1)
    SYNC_EXIT_CODE=$?
else
    # macOS systems without timeout command
    SYNC_OUTPUT=$(curl -s -X POST "$API_URL" --max-time $TIMEOUT 2>&1)
    SYNC_EXIT_CODE=$?
fi

SYNC_END=$(date +%s)
SYNC_DURATION=$((SYNC_END - SYNC_START))

# Check if sync was successful
if [ $SYNC_EXIT_CODE -eq 0 ]; then
    log_message "ETL sync completed successfully in ${SYNC_DURATION} seconds"
    log_message "Sync response: $SYNC_OUTPUT"
    
    # Check if response contains error
    if echo "$SYNC_OUTPUT" | grep -q '"error"'; then
        log_error "API returned an error: $SYNC_OUTPUT"
        exit 1
    fi
else
    if [ $SYNC_EXIT_CODE -eq 124 ] || [ $SYNC_EXIT_CODE -eq 28 ]; then
        log_error "ETL sync timed out after ${TIMEOUT} seconds"
    else
        log_error "ETL sync failed with exit code $SYNC_EXIT_CODE"
        log_error "Sync output: $SYNC_OUTPUT"
    fi
    exit 1
fi

# Log completion
log_message "ETL sync job completed successfully"
exit 0 