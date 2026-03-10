#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ce script doit être exécuté en root (sudo)."
  exit 1
fi

echo "=== Install Kiosk Linux (Wayland + Cage + Chromium) ==="
echo

normalize_player_url() {
  local raw="$1"
  local value
  value="$(echo "$raw" | xargs)"
  if [[ -z "$value" ]]; then
    echo ""
    return
  fi

  if [[ ! "$value" =~ ^https?:// ]]; then
    value="http://$value"
  fi

  if [[ "$value" =~ ^(https?://)([^/:]+)(/.*)?$ ]]; then
    local proto="${BASH_REMATCH[1]}"
    local host="${BASH_REMATCH[2]}"
    local path="${BASH_REMATCH[3]:-/player}"
    value="${proto}${host}:4173${path}"
  fi

  echo "$value"
}

DEFAULT_PLAYER_URL="http://192.168.1.47:4173/player"
read -r -p "URL du player [$DEFAULT_PLAYER_URL] : " PLAYER_URL_INPUT
PLAYER_URL="${PLAYER_URL_INPUT:-$DEFAULT_PLAYER_URL}"
PLAYER_URL="$(normalize_player_url "$PLAYER_URL")"

if [[ -z "$PLAYER_URL" ]]; then
  echo "URL player invalide."
  exit 1
fi

DEFAULT_KIOSK_USER="kiosk"
read -r -p "Utilisateur kiosk [$DEFAULT_KIOSK_USER] : " KIOSK_USER_INPUT
KIOSK_USER="${KIOSK_USER_INPUT:-$DEFAULT_KIOSK_USER}"

echo
echo "[1/6] Installation des paquets requis..."
apt-get update
apt-get install -y \
  chromium-browser \
  cage \
  seatd \
  dbus-user-session \
  libseat1 \
  libegl1 \
  libgbm1 \
  xdg-utils

echo "[2/6] Préparation utilisateur kiosk..."
if ! id "$KIOSK_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$KIOSK_USER"
fi
usermod -aG video,render,input,audio "$KIOSK_USER" || true

echo "[3/6] Activation seatd..."
systemctl enable seatd
systemctl restart seatd

echo "[4/6] Runtime Wayland pour kiosk..."
mkdir -p /run/kiosk-runtime
chown "$KIOSK_USER:$KIOSK_USER" /run/kiosk-runtime
chmod 700 /run/kiosk-runtime

cat >/etc/tmpfiles.d/kiosk-runtime.conf <<EOF
d /run/kiosk-runtime 0700 $KIOSK_USER $KIOSK_USER -
EOF
systemd-tmpfiles --create /etc/tmpfiles.d/kiosk-runtime.conf

echo "[5/6] Script de lancement kiosk..."
cat >/usr/local/bin/start-kiosk-wayland.sh <<EOF
#!/usr/bin/env bash
set -euo pipefail

rm -f /tmp/kiosk-browser.log
touch /tmp/kiosk-browser.log
chown $KIOSK_USER:$KIOSK_USER /tmp/kiosk-browser.log

exec sudo -u $KIOSK_USER env -u WAYLAND_DISPLAY -u DISPLAY \
  XDG_RUNTIME_DIR=/run/kiosk-runtime \
  LIBSEAT_BACKEND=seatd \
  WLR_BACKENDS=drm,libinput \
  dbus-run-session -- \
  cage -s -- \
  chromium-browser --kiosk --start-fullscreen --ozone-platform=wayland --enable-features=UseOzonePlatform \
  "$PLAYER_URL" 2>&1 | tee /tmp/kiosk-browser.log
EOF
chmod +x /usr/local/bin/start-kiosk-wayland.sh

echo "[6/6] Service systemd kiosk..."
cat >/etc/systemd/system/kiosk-wayland.service <<EOF
[Unit]
Description=Kiosk Wayland (Cage + Chromium)
After=network-online.target seatd.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/start-kiosk-wayland.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable kiosk-wayland.service
systemctl restart kiosk-wayland.service

echo
echo "Installation terminée."
echo "URL kiosk : $PLAYER_URL"
echo "Utilisateur : $KIOSK_USER"
echo
echo "Commande directe validée :"
echo "sudo -u $KIOSK_USER env -u WAYLAND_DISPLAY -u DISPLAY XDG_RUNTIME_DIR=/run/kiosk-runtime LIBSEAT_BACKEND=seatd WLR_BACKENDS=drm,libinput dbus-run-session -- cage -s -- chromium-browser --kiosk --start-fullscreen --ozone-platform=wayland --enable-features=UseOzonePlatform \"$PLAYER_URL\" 2>&1 | tee /tmp/kiosk-browser.log"
echo
echo "Test manuel sans conflit seatd (important) :"
echo "  sudo systemctl stop kiosk-wayland.service"
echo "  sudo rm -f /tmp/kiosk-browser.log; sudo touch /tmp/kiosk-browser.log; sudo chown $KIOSK_USER:$KIOSK_USER /tmp/kiosk-browser.log"
echo "  sudo -u $KIOSK_USER env -u WAYLAND_DISPLAY -u DISPLAY XDG_RUNTIME_DIR=/run/kiosk-runtime LIBSEAT_BACKEND=seatd WLR_BACKENDS=drm,libinput dbus-run-session -- cage -s -- chromium-browser --kiosk --start-fullscreen --ozone-platform=wayland --enable-features=UseOzonePlatform \"$PLAYER_URL\" 2>&1 | tee /tmp/kiosk-browser.log"
echo "  sudo systemctl restart kiosk-wayland.service"
echo
echo "Logs : journalctl -u kiosk-wayland.service -f"
