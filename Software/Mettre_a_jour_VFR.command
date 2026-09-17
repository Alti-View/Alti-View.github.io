#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "Actualisation des points VFR auprès du SIA…"
if python3 tools/update_sia_vfr.py; then
  echo "Mise à jour terminée. Rechargez VFR.html et revérifiez les routes enregistrées."
else
  echo "Échec : les anciennes données sont conservées. Vérifiez leur date dans la carte."
fi
read -r -p "Appuyez sur Entrée pour fermer. "
