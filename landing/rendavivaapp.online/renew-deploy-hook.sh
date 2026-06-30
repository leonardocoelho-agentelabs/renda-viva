#!/bin/sh
# Let's Encrypt deploy hook for rendavivaapp.online
# Installed at: /etc/letsencrypt/renewal-hooks/deploy/rendavivaapp-online.sh
# After a renewal, copy the renewed cert into the openresty container's
# mounted ssl dir (the container cannot see /etc/letsencrypt) and reload.
SRC="/etc/letsencrypt/live/rendavivaapp.online"
DST="/etc/icontainer/apps/openresty/openresty/conf/conf.d/users/ssl"
if [ -f "$SRC/fullchain.pem" ]; then
  cp -L "$SRC/fullchain.pem" "$DST/rendavivaapp.online.fullchain.pem"
  cp -L "$SRC/privkey.pem"   "$DST/rendavivaapp.online.privkey.pem"
  chmod 644 "$DST/rendavivaapp.online.fullchain.pem"
  chmod 600 "$DST/rendavivaapp.online.privkey.pem"
  CID=$(docker ps --format '{{.Names}}' | grep -m1 openresty)
  [ -n "$CID" ] && docker exec "$CID" openresty -s reload 2>/dev/null || true
fi
