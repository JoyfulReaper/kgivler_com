
#!/usr/bin/env bash
set -euo pipefail

# Deploy the Stonybrook static demonstration site on Frontdesk.
#
# Run after updating the local dev branch:
#
#   git pull --ff-only
#   ./dev/deploy-stonybrook.sh

REPO_DIR="/opt/kgivler_com"
SOURCE_DIR="$REPO_DIR/dev/examples/stonybrook"
DEST_DIR="/var/www/stonybrook"

SITE_URL="http://127.0.0.1:8088"
EXPECTED_BRANCH="dev"

echo "==> Checking repository"

cd "$REPO_DIR"

CURRENT_BRANCH="$(git branch --show-current)"

if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
    echo "ERROR: Expected branch '$EXPECTED_BRANCH', found '$CURRENT_BRANCH'."
    exit 1
fi

if [[ ! -f "$SOURCE_DIR/index.html" ||
      ! -f "$SOURCE_DIR/styles.css" ||
      ! -f "$SOURCE_DIR/portfolio/carousel.js" ]]; then
    echo "ERROR: Required Stonybrook files are missing."
    exit 1
fi

COMMIT="$(git rev-parse --short HEAD)"

echo "Branch: $CURRENT_BRANCH"
echo "Commit: $COMMIT"
echo

echo "==> Checking dependencies"

for command in rsync curl nginx; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "ERROR: Missing required command: $command"
        exit 1
    fi
done

echo "==> Checking Nginx configuration"

sudo nginx -t

echo
echo "==> Previewing deployment changes"

sudo mkdir -p "$DEST_DIR"

sudo rsync -avnc --delete \
    "$SOURCE_DIR/" \
    "$DEST_DIR/"

echo
read -r -p "Deploy these changes? [y/N] " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo
echo "==> Deploying Stonybrook"

sudo rsync -avc --delete \
    "$SOURCE_DIR/" \
    "$DEST_DIR/"

echo
echo "==> Setting ownership and permissions"

sudo chown -R root:root "$DEST_DIR"
sudo find "$DEST_DIR" -type d -exec chmod 755 {} +
sudo find "$DEST_DIR" -type f -exec chmod 644 {} +

echo
echo "==> Verifying local HTTP responses"

for path in \
    "/" \
    "/about/" \
    "/services/" \
    "/portfolio/" \
    "/contact/" \
    "/styles.css" \
    "/portfolio/carousel.js" \
    "/assets/images/about-garden-800.jpg"
do
    STATUS="$(curl --silent --output /dev/null \
        --write-out '%{http_code}' \
        --max-time 10 \
        "$SITE_URL$path")"

    if [[ "$STATUS" != "200" ]]; then
        echo "ERROR: $path returned HTTP $STATUS"
        exit 1
    fi

    echo "OK: $path"
done

echo
echo "==> Deployment complete"

echo "Git commit: $COMMIT"
echo "Local URL:  $SITE_URL"
echo "Public URL: https://stonybrook-demo.kgivler.com/"
echo
echo "No Nginx reload required for static file updates."
