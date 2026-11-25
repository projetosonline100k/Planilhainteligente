#!/bin/bash
# Liga o WhatsApp do agente VaiViajar no Mac/VPS com o WAHA (grátis, conecta pelo QR Code).
# Container próprio ("waha-vaiviajar", porta 3010), separado do WAHA do Infopro.
# A sessão (login do WhatsApp) fica em ~/.vaiviajar/whatsapp/sessoes e sobrevive a recriar o container.
# Chaves vêm do .env.local: WAHA_API_KEY e WHATSAPP_WEBHOOK_SECRET.
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ler() { grep "^$1=" "$RAIZ/.env.local" | tail -1 | cut -d= -f2-; }
KEY="$(ler WAHA_API_KEY)"; SEG="$(ler WHATSAPP_WEBHOOK_SECRET)"; PORTA_HOOK="$(ler WAHA_WEBHOOK_PORT)"
PORTA_HOOK="${PORTA_HOOK:-3110}"
[ -n "$KEY" ] && [ -n "$SEG" ] || { echo "Preencha WAHA_API_KEY e WHATSAPP_WEBHOOK_SECRET no .env.local"; exit 1; }

if command -v colima >/dev/null && ! docker info >/dev/null 2>&1; then
  echo "Ligando o Colima (Docker)…"; colima start >/dev/null
fi

D="$HOME/.vaiviajar/whatsapp"; mkdir -p "$D/sessoes"
ARQ="$(uname -m)"; [ "$ARQ" = "arm64" ] || [ "$ARQ" = "aarch64" ] && IMG=devlikeapro/waha:gows-arm-2026.9.2 || IMG=devlikeapro/waha:gows-2026.9.2

docker rm -f waha-vaiviajar >/dev/null 2>&1 || true
docker run -d --name waha-vaiviajar --restart unless-stopped \
  -p 127.0.0.1:3010:3000 \
  -v "$D/sessoes:/app/.sessions" \
  -e WHATSAPP_DEFAULT_ENGINE=GOWS \
  -e WAHA_API_KEY="$KEY" \
  -e WAHA_DASHBOARD_USERNAME=admin -e WAHA_DASHBOARD_PASSWORD="$KEY" \
  -e WHATSAPP_SWAGGER_USERNAME=admin -e WHATSAPP_SWAGGER_PASSWORD="$KEY" \
  -e WHATSAPP_HOOK_URL="http://host.docker.internal:$PORTA_HOOK/webhook?k=$SEG" \
  -e WHATSAPP_HOOK_EVENTS=message \
  -e WAHA_BASE_URL=http://localhost:3010 \
  -e WHATSAPP_FILES_LIFETIME=600 \
  -e WHATSAPP_RESTART_ALL_SESSIONS=True \
  "$IMG" >/dev/null

echo -n "Esperando o WAHA subir"
for _ in $(seq 1 60); do curl -sf -H "X-Api-Key: $KEY" http://localhost:3010/api/sessions >/dev/null && break; echo -n "."; sleep 2; done; echo
curl -s -X POST -H "X-Api-Key: $KEY" -H 'Content-Type: application/json' -d '{"name":"default","start":true}' http://localhost:3010/api/sessions >/dev/null || true
curl -s -X POST -H "X-Api-Key: $KEY" http://localhost:3010/api/sessions/default/start >/dev/null || true
sleep 3
STATUS="$(curl -s -H "X-Api-Key: $KEY" http://localhost:3010/api/sessions/default | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status","?"))' 2>/dev/null || echo '?')"
echo "WAHA do VaiViajar ligado ($IMG). Sessão: $STATUS"
if [ "$STATUS" = "SCAN_QR_CODE" ]; then
  curl -s -H "X-Api-Key: $KEY" -H 'Accept: image/png' http://localhost:3010/api/default/auth/qr -o "$D/qr.png" && open "$D/qr.png" 2>/dev/null || true
  echo "Escaneie o QR Code com o WhatsApp do número do agente: Aparelhos conectados → Conectar um aparelho."
  echo "(Também dá pelo painel do WAHA: http://localhost:3010/dashboard — usuário admin, senha = WAHA_API_KEY)"
fi
