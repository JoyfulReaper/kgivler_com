
#!/usr/bin/env bash
set -euo pipefail

# Deploy Stonybrook Landscaping to Nginx on Frontdesk.
#
# Usage:
#   cd /opt/kgivler_com
#   git pull --ff-only
#   ./dev/deploy-stonybrook.sh
#
# Deploys the current committed dev branch.
# Does not pull, commit, push, or reload Nginx.

REPO_DIR="/opt/kgivler_com"
SOURCE_DIR="$REPO_DIR/dev/examples/stonybrook"
DEST_DIR="/var/www/stonybrook"

SITE_URL="http://127.0.0.1:8088"
PUBLIC_URL="https://stonybrook-demo.kgivler.com/"

EXPECTED_BRANCH="dev"

echo "==> Checking repository"

cd "$REPO_DIR"

CURRENT_BRANCH="$(git branch --show-current)"

if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
    echo "ERROR: Expected branch '$EXPECTED_BRANCH', found '$CURRENT_BRANCH'."
    exit 1
fi

# Refuse to deploy uncommitted modifications, staged changes,
# or untracked files within the Stonybrook source directory.
if [[ -n "$(git status --porcelain --untracked-files=all -- dev/examples/stonybrook/)" ]]; then
    echo "ERROR: Stonybrook has uncommitted or untracked changes."
    echo "Commit or discard them before deploying."
    git status --short -- dev/examples/stonybrook/
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

# nginx is commonly installed under /usr/sbin, which
# may not be included in a normal user's PATH.
# It is checked separately using sudo below.
for cmd in rsync curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "ERROR: Missing required command: $cmd"
        exit 1
    fi
done

echo "==> Checking Nginx configuration"

sudo nginx -t

echo
echo "==> Previewing deployment changes"

# Only operate on this dedicated static-site directory.
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

FAILED=0

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
    STATUS="$(curl \
        --silent \
        --output /dev/null \
        --write-out '%{http_code}' \
        --max-time 10 \
        "$SITE_URL$path")"

    if [[ "$STATUS" == "200" ]]; then
        echo "OK: $path"
    else
        echo "ERROR: $path returned HTTP $STATUS"
        FAILED=1
    fi
done

echo

if [[ "$FAILED" -ne 0 ]]; then
    echo "WARNING: Deployment completed, but verification failed."
    echo "Check Nginx logs and the deployed files."
    exit 1
fi

echo "==> Deployment complete"
echo
echo "Git commit: $COMMIT"
echo "Source:     $SOURCE_DIR"
echo "Deployed:   $DEST_DIR"
echo "Local URL:  $SITE_URL"
echo "Public URL: $PUBLIC_URL"
echo
echo "No Nginx reload required for static file updates."
