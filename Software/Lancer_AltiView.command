#!/bin/bash
# Double-cliquez ce fichier pour lancer Altiview avec les données en direct.
cd "$(dirname "$0")"
PORT=8790
if lsof -ti tcp:$PORT > /dev/null 2>&1; then
  echo "Altiview tourne déjà sur le port $PORT."
else
  perl tools/altiview_gateway.pl "." $PORT &
  sleep 1
fi
open "http://127.0.0.1:$PORT/flg_prep.html"
echo ""
echo "Altiview est lancé. Gardez cette fenêtre ouverte pendant l'utilisation."
echo "Pour quitter : Ctrl+C puis fermez la fenêtre."
wait
