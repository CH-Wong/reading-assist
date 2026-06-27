#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────
#  Reading Assist – AWS Deployment Script (macOS / Linux)
# ────────────────────────────────────────────────────────────
#  Builds the frontend and deploys the full stack
#  (S3 + CloudFront + API proxy) to AWS via CDK.
#
#  Usage:
#    ./deploy.sh
#    ./deploy.sh -d reading.example.com -z Z1234567890
#
#  Options:
#    -d DOMAIN        Optional custom domain name
#    -z HOSTED_ZONE_ID Optional Route 53 hosted zone ID
#    -p PROFILE       Optional AWS CLI profile
#    -r REGION        AWS region (default: us-east-1)
# ────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════════════╗"
echo "║   Reading Assist – AWS Deployment Script     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Load .env file if it exists (before CLI parsing, so CLI flags override) ──
ENV_FILE="$ROOT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  echo "▶ Loading .env file..."
  set -a  # auto-export all variables
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
  echo "  ✓ Environment variables loaded from .env"
  echo ""
else
  echo "ℹ No .env file found. Using existing environment variables."
  echo "  To use a .env file: cp .env.example .env and fill in values."
  echo ""
fi

# Parse arguments (override .env values if passed)
DOMAIN="${DOMAIN:-}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
PROFILE="${PROFILE:-}"
REGION="${REGION:-us-east-1}"

while getopts "d:z:p:r:" opt; do
  case $opt in
    d) DOMAIN="$OPTARG" ;;
    z) HOSTED_ZONE_ID="$OPTARG" ;;
    p) PROFILE="$OPTARG" ;;
    r) REGION="$OPTARG" ;;
    *) echo "Usage: $0 [-d domain] [-z hostedZoneId] [-p profile] [-r region]"; exit 1 ;;
  esac
done

# ── Step 1: Build frontend ──
echo "Step 1/5: Building frontend..."
(cd "$ROOT_DIR" && npm run build)
echo "  Frontend built successfully"
echo ""

# ── Step 2: Install CDK dependencies ──
echo "Step 2/5: Installing CDK dependencies..."
(cd "$ROOT_DIR/cdk" && npm install)
echo "  CDK dependencies installed"
echo ""

# ── Step 3: Compile CDK TypeScript ──
echo "Step 3/5: Compiling CDK TypeScript..."
(cd "$ROOT_DIR/cdk" && npx tsc)
echo "  CDK TypeScript compiled"
echo ""

# ── Step 4: Bootstrap CDK ──
echo "Step 4/5: Bootstrapping CDK (if needed)..."
echo "  Bootstrapping primary region ($REGION)..."
BOOTSTRAP_ARGS=("bootstrap" "--region" "$REGION")
[ -n "$PROFILE" ] && BOOTSTRAP_ARGS+=("--profile" "$PROFILE")
(cd "$ROOT_DIR/cdk" && npx cdk "${BOOTSTRAP_ARGS[@]}")
echo "  Bootstrapping us-east-1 (for ACM certificate)..."
BOOTSTRAP_US_ARGS=("bootstrap" "--region" "us-east-1")
[ -n "$PROFILE" ] && BOOTSTRAP_US_ARGS+=("--profile" "$PROFILE")
(cd "$ROOT_DIR/cdk" && npx cdk "${BOOTSTRAP_US_ARGS[@]}")
echo "  CDK bootstrapped"
echo ""

# ── Step 5: Deploy stack ──
echo "Step 5/5: Deploying stack..."
DEPLOY_ARGS=("deploy")
[ -n "$PROFILE" ] && DEPLOY_ARGS+=("--profile" "$PROFILE")
if [ -n "$DOMAIN" ] && [ -n "$HOSTED_ZONE_ID" ]; then
  DEPLOY_ARGS+=("-c" "domain=$DOMAIN" "-c" "hostedZoneId=$HOSTED_ZONE_ID")
  echo "  Using custom domain: $DOMAIN"
else
  echo "  Using default CloudFront domain (no custom domain)"
fi
DEPLOY_ARGS+=("--all" "--require-approval" "broadening")

(cd "$ROOT_DIR/cdk" && npx cdk "${DEPLOY_ARGS[@]}")

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✓ Deployment complete!                      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Your CloudFront URL will be shown in the CDK output above."
echo "Or run:  cd cdk && npx cdk deploy --outputs-file outputs.json"
