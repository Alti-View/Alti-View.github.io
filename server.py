#!/usr/bin/env python3
"""
AltiView Cockpit Weather Gateway & Local Server
------------------------------------------------
1. Serves static files for AltiView software.
2. Acts as a CORS-enabled gateway to NOAA Aviation Weather Center for live METARs & TAFs.
3. Automatically falls back to regional reference aerodromes for VFR airfields without individual TAFs.
"""

import sys
import os
import json
import ssl
import urllib.request
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import webbrowser
import socket
from functools import partial

PORT_DEFAULT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Aeronautical reference aerodrome mapping for VFR airfields
# When an aerodrome has no individual TAF, refer to the regional CTR/TMA reference platform
REFERENCE_STATIONS = {
    # Paris & Île-de-France
    "LFPZ": "LFPO",  # Saint-Cyr-l'École -> Paris Orly
    "LFFU": "LFPO",  # Chavenay-Villepreux -> Paris Orly
    "LFPL": "LFPG",  # Lognes-Émerainville -> Paris CDG
    "LFPM": "LFPO",  # Melun Villaroche -> Paris Orly
    "LFAI": "LFPO",  # Nangis Les Loges -> Paris Orly
    "LFPT": "LFPG",  # Pontoise Cormeilles -> Paris CDG
    "LFPB": "LFPG",  # Le Bourget -> Paris CDG
    "LFPK": "LFPO",  # Coulommiers -> Paris Orly
    "LFPE": "LFPG",  # Meaux Esbly -> Paris CDG
    "LFPH": "LFPG",  # Chelles Le Pin -> Paris CDG
    "LFJS": "LFPO",  # Fontenay Trésigny -> Paris Orly
    # Côte d'Azur & Provence
    "LFMD": "LFMN",  # Cannes Mandelieu -> Nice Côte d'Azur
    "LFMA": "LFML",  # Aix Les Milles -> Marseille Provence
    "LFMQ": "LFML",  # Le Castellet -> Marseille Provence
    "LFTZ": "LFML",  # La Môle St-Tropez -> Marseille / Toulon
    # Rhône-Alpes
    "LFLY": "LFLL",  # Lyon Bron -> Lyon Saint-Exupéry
    "LFKA": "LFLL",  # Albertville -> Lyon Saint-Exupéry
    "LFLG": "LFLL",  # Grenoble Le Versoud -> Lyon Saint-Exupéry
    "LFLP": "LFLL",  # Annecy Meythet -> Lyon / Chambéry
    # Sud-Ouest
    "LFCL": "LFBO",  # Toulouse Lasbordes -> Toulouse Blagnac
    "LFBC": "LFBD",  # Cazaux -> Bordeaux Mérignac
    "LFCH": "LFBD",  # Arcachon La Teste -> Bordeaux Mérignac
    "LFBT": "LFBP",  # Tarbes Laloubère -> Pau Pyrénées
    # Grand Ouest & Bretagne
    "LFRT": "LFRN",  # Saint-Malo -> Rennes Saint-Jacques
    "LFRD": "LFRN",  # Dinard Pleurtuit -> Rennes Saint-Jacques
    "LFRF": "LFRB",  # Granville -> Brest Bretagne
    "LFRZ": "LFRS",  # Saint-Nazaire -> Nantes Atlantique
}

def get_ssl_context():
    try:
        return ssl.create_default_context()
    except Exception:
        return ssl._create_unverified_context()

def fetch_url(url, timeout=8):
    """Fetch URL with aviation user agent and SSL fallback"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AltiView-Cockpit/1.0",
        "Accept": "application/json, text/plain, */*"
    }
    req = urllib.request.Request(url, headers=headers)
    ctx = get_ssl_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception:
        try:
            unverified_ctx = ssl._create_unverified_context()
            with urllib.request.urlopen(req, timeout=timeout, context=unverified_ctx) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception:
            return None

def fetch_noaa_taf(icao):
    """Fetch TAF for an ICAO code from NOAA with reference aerodrome fallback"""
    icao = icao.strip().upper()
    url = f"https://aviationweather.gov/api/data/taf?ids={icao}&format=json"
    raw = fetch_url(url)
    
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, list) and len(data) > 0 and data[0].get("rawTAF"):
                return {
                    "icao": icao,
                    "rawTAF": data[0].get("rawTAF"),
                    "name": data[0].get("name"),
                    "issueTime": data[0].get("issueTime"),
                    "validTimeFrom": data[0].get("validTimeFrom"),
                    "validTimeTo": data[0].get("validTimeTo"),
                    "fcsts": data[0].get("fcsts", []),
                    "isRef": False,
                    "refIcao": None
                }
        except json.JSONDecodeError:
            pass

    # Check regional reference aerodrome if direct airfield has no published TAF
    ref_station = REFERENCE_STATIONS.get(icao)
    if ref_station:
        ref_url = f"https://aviationweather.gov/api/data/taf?ids={ref_station}&format=json"
        ref_raw = fetch_url(ref_url)
        if ref_raw:
            try:
                data = json.loads(ref_raw)
                if isinstance(data, list) and len(data) > 0 and data[0].get("rawTAF"):
                    return {
                        "icao": icao,
                        "rawTAF": data[0].get("rawTAF"),
                        "name": data[0].get("name"),
                        "issueTime": data[0].get("issueTime"),
                        "validTimeFrom": data[0].get("validTimeFrom"),
                        "validTimeTo": data[0].get("validTimeTo"),
                        "fcsts": data[0].get("fcsts", []),
                        "isRef": True,
                        "refIcao": ref_station
                    }
            except json.JSONDecodeError:
                pass

    return {
        "icao": icao,
        "rawTAF": None,
        "isRef": False,
        "refIcao": None,
        "message": f"No TAF published for {icao}"
    }

def fetch_noaa_metar(icao):
    """Fetch METAR for an ICAO code from NOAA or VATSIM fallback"""
    icao = icao.strip().upper()
    url = f"https://aviationweather.gov/api/data/metar?ids={icao}&format=json"
    raw = fetch_url(url)
    
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, list) and len(data) > 0 and data[0].get("rawOb"):
                item = data[0]
                return {
                    "icao": icao,
                    "rawMetar": item.get("rawOb"),
                    "name": item.get("name"),
                    "wdir": item.get("wdir"),
                    "wspd": item.get("wspd"),
                    "temp": item.get("temp"),
                    "dewp": item.get("dewp"),
                    "altim": item.get("altim"),
                    "visib": item.get("visib"),
                    "fltCat": item.get("fltCat"),
                    "reportTime": item.get("reportTime")
                }
        except json.JSONDecodeError:
            pass

    # VATSIM fallback
    vatsim_url = f"https://metar.vatsim.net/{icao}"
    v_raw = fetch_url(vatsim_url)
    if v_raw and len(v_raw.strip()) > 8 and "No METAR" not in v_raw:
        return {
            "icao": icao,
            "rawMetar": v_raw.strip(),
            "name": f"Aerodrome {icao}",
            "wdir": None,
            "wspd": None,
            "temp": None,
            "dewp": None,
            "altim": None,
            "visib": None,
            "fltCat": None,
            "reportTime": None
        }

    return {
        "icao": icao,
        "rawMetar": None,
        "message": f"No METAR reported for {icao}"
    }

class AltiViewHandler(SimpleHTTPRequestHandler):
    """HTTP handler that serves static files and provides CORS API routes"""

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API Health Check
        if path in ("/api/health", "/api/status"):
            payload = {
                "status": "ok",
                "service": "AltiView Weather Gateway",
                "version": "1.0",
                "reference_stations_count": len(REFERENCE_STATIONS)
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # 2. API TAF
        if path == "/api/taf":
            icao_param = query.get("icao", query.get("ids", [""]))[0]
            icaos = [x.strip().upper() for x in icao_param.split(",") if x.strip()]
            if not icaos:
                body = json.dumps({"error": "Missing 'icao' parameter"}).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            results = [fetch_noaa_taf(code) for code in icaos]
            resp_body = results[0] if len(results) == 1 else results
            body = json.dumps(resp_body).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # 3. API METAR
        if path == "/api/metar":
            icao_param = query.get("icao", query.get("ids", [""]))[0]
            icaos = [x.strip().upper() for x in icao_param.split(",") if x.strip()]
            if not icaos:
                body = json.dumps({"error": "Missing 'icao' parameter"}).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            results = [fetch_noaa_metar(code) for code in icaos]
            resp_body = results[0] if len(results) == 1 else results
            body = json.dumps(resp_body).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # 4. Unified API Weather (METAR + TAF)
        if path == "/api/weather":
            icao = query.get("icao", [""])[0].strip().upper()
            if not icao:
                body = json.dumps({"error": "Missing 'icao' parameter"}).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            metar = fetch_noaa_metar(icao)
            taf = fetch_noaa_taf(icao)

            payload = {
                "icao": icao,
                "name": taf.get("name") or metar.get("name") or f"Aerodrome {icao}",
                "metar": metar.get("rawMetar"),
                "taf": taf.get("rawTAF"),
                "isRefTaf": taf.get("isRef", False),
                "refIcao": taf.get("refIcao"),
                "metarData": metar,
                "tafData": taf
            }
            body = json.dumps(payload).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # 5. Default: static file serving
        super().do_GET()

    def log_message(self, format, *args):
        msg = format % args
        if "GET /api/" in msg:
            print(f"[AltiView WX Gateway] {msg}")

def find_available_port(start_port=PORT_DEFAULT):
    port = start_port
    while port < start_port + 50:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
        port += 1
    return start_port

def main():
    should_open = "--open" in sys.argv
    port = find_available_port(PORT_DEFAULT)

    handler_factory = partial(AltiViewHandler, directory=BASE_DIR)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_factory)
    url = f"http://localhost:{port}/flg_prep.html"

    print("=" * 66)
    print("   ✈️   ALTIVIEW COCKPIT — PASSERELLE MÉTÉO & PRÉPARATION DE VOL")
    print("=" * 66)
    print(f"  • Interface de vol active sur : {url}")
    print(f"  • Passerelle TAF / METAR      : http://localhost:{port}/api/weather?icao=LFPG")
    print(f"  • Dossier des sources        : {BASE_DIR}")
    print("=" * 66)
    print("Serveur en cours d'exécution. Appuyez sur Ctrl + C pour arrêter.")
    print()

    if should_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nFermeture d'AltiView. Bons vols !")
        server.server_close()

if __name__ == "__main__":
    main()
