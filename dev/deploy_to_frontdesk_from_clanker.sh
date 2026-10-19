#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="/opt/kgivler_com/dev/src"
REMOTE_HOST="joyfulreaper@frontdesk"
REMOTE_BINARY="/usr/local/bin/devsite"
SERVICE="devsite"

LOCAL_TMP="$(mktemp /tmp/devsite.XXXXXX)"
REMOTE_TMP="/tmp/devsite-deploy-$(date +%s)-$$"

cleanup() {
    rm -f "$LOCAL_TMP"
}

trap cleanup EXIT

echo "==> Checking architecture"

LOCAL_ARCH="$(uname -m)"
REMOTE_ARCH="$(ssh "$REMOTE_HOST" uname -m)"

if [[ "$LOCAL_ARCH" != "$REMOTE_ARCH" ]]; then
    echo "ERROR: Architecture mismatch"
    echo "  Clanker:   $LOCAL_ARCH"
    echo "  Frontdesk: $REMOTE_ARCH"
    exit 1
fi

echo "==> Building devsite on Clanker"

cd "$SOURCE_DIR"
go build -o "$LOCAL_TMP" .

echo "==> Copying binary to Frontdesk"

scp "$LOCAL_TMP" "$REMOTE_HOST:$REMOTE_TMP"

echo "==> Installing and restarting devsite on Frontdesk"

ssh -t "$REMOTE_HOST" "
    set -e

    sudo cp -a '$REMOTE_BINARY' '${REMOTE_BINARY}.backup'
    sudo install -m 0755 '$REMOTE_TMP' '${REMOTE_BINARY}.new'
    sudo mv '${REMOTE_BINARY}.new' '$REMOTE_BINARY'

    rm -f '$REMOTE_TMP'

    sudo systemctl restart '$SERVICE'

    if ! systemctl is-active --quiet '$SERVICE'; then
        echo
        echo 'ERROR: devsite failed to start'
        systemctl status '$SERVICE' --no-pager --full || true
        exit 1
    fi

    echo
    systemctl status '$SERVICE' --no-pager --full
"

echo
echo "==> Deployment complete"
