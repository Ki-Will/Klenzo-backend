#!/bin/bash
#
# Klenzo Microservice Build Script
# Builds all microservices with their dependencies
#
# Usage:
#   ./scripts/build-services.sh              # Build all services
#   ./scripts/build-services.sh auth-service # Build single service
#   ./scripts/build-services.sh --clean      # Clean dist before building
#

set -e

SERVICES=(
  "auth-service"
  "finance-service"
  "productivity-service"
  "habit-service"
  "notification-service"
  "insight-service"
)

CLEAN=false
TARGET_SERVICE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --clean)
      CLEAN=true
      shift
      ;;
    -*)
      echo "Unknown option: $1"
      exit 1
      ;;
    *)
      TARGET_SERVICE="$1"
      shift
      ;;
  esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Clean dist directory if requested
if [ "$CLEAN" = true ]; then
  log_warn "Cleaning dist directory..."
  rm -rf dist/
fi

# Determine which services to build
if [ -n "$TARGET_SERVICE" ]; then
  # Validate service name
  SERVICE_FOUND=false
  for svc in "${SERVICES[@]}"; do
    if [ "$svc" = "$TARGET_SERVICE" ]; then
      SERVICE_FOUND=true
      break
    fi
  done

  if [ "$SERVICE_FOUND" = false ]; then
    log_error "Unknown service: $TARGET_SERVICE"
    echo "Available services: ${SERVICES[*]}"
    exit 1
  fi

  SERVICES_TO_BUILD=("$TARGET_SERVICE")
else
  SERVICES_TO_BUILD=("${SERVICES[@]}")
fi

# Build each service
for service in "${SERVICES_TO_BUILD[@]}"; do
  log_info "Building $service..."

  if npx nx build "$service" --configuration=production; then
    log_info "✓ $service built successfully"
  else
    log_error "✗ Failed to build $service"
    exit 1
  fi
done

log_info "All services built successfully!"
