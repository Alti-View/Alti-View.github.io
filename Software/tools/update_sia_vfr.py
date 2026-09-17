#!/usr/bin/env python3
"""Refresh the complete SIA viewer VFR snapshot; no guessed coordinates or VAC rules.

Uses the public viewer's request signing convention, discovered from its current
bundle. This is an undocumented service: schema changes fail closed. No personal
account, private key, or OpenAIP subscription is used or stored.
"""
import argparse
import base64
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
VIEWER = 'https://www.sia.aviation-civile.gouv.fr/vaipEx/'
API = 'https://bo-prod-sofia-vac.sia-france.fr/api/'
SOURCE = 'https://www.sia.aviation-civile.gouv.fr/vaip'
LICENSE = 'https://www.sia.aviation-civile.gouv.fr/pub/media/news/file//l/i/licenceopendata-vf_2.pdf'


def coordinate(value, axis):
    """Decode AIXM DD, DDMM or DDMMSS, retaining fractional precision."""
    match = re.fullmatch(r'(\d+(?:\.\d+)?)([NSEW])', value or '')
    if not match or match[2] not in ('NS' if axis == 'lat' else 'EW'):
        raise ValueError(f'Invalid {axis} coordinate: {value!r}')
    number, hemisphere = match.groups()
    degree_digits = 2 if axis == 'lat' else 3
    width = len(number.split('.')[0])
    if width == degree_digits:
        result = float(number)
    elif width in (degree_digits + 2, degree_digits + 4):
        degrees = int(number[:degree_digits])
        minutes = float(number[degree_digits:]) if width == degree_digits + 2 else int(number[degree_digits:degree_digits + 2])
        seconds = 0 if width == degree_digits + 2 else float(number[degree_digits + 2:])
        if minutes >= 60 or seconds >= 60:
            raise ValueError(f'Invalid minutes/seconds: {value}')
        result = degrees + minutes / 60 + seconds / 3600
    else:
        raise ValueError(f'Unknown coordinate format: {value}')
    if result > (90 if axis == 'lat' else 180):
        raise ValueError(f'Coordinate out of range: {value}')
    return -result if hemisphere in 'SW' else result


def download(url, headers=None):
    # macOS curl uses the system trust store; never disable TLS verification.
    args = ['curl', '--fail', '--silent', '--show-error', '--location',
            '--max-time', '25', '--user-agent', 'AltiView-SIA-VFR/1.0']
    for name, value in (headers or {}).items():
        args.extend(['--header', name + ': ' + value])
    result = subprocess.run([*args, url], capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError('SIA download unavailable: ' + result.stderr.decode(errors='replace').strip())
    return result.stdout


def client():
    html = download(VIEWER).decode()
    bundle = re.search(r'src="(main\.[a-zA-Z0-9]+\.js)"', html)
    if not bundle:
        raise ValueError('SIA viewer bundle changed; refresh adapter must be reviewed')
    script = download(urljoin(VIEWER, bundle[1])).decode()
    secret = re.search(r'share_secret:"([^"\n]+)"', script)
    base = re.search(r'baseUrl:"([^"]+)"', script)
    if not secret or not base or base[1] != API:
        raise ValueError('SIA viewer configuration changed; refresh adapter must be reviewed')

    def get(path):
        # Same public application authentication as the SIA browser viewer.
        digest = hashlib.sha512((secret[1] + '/api/' + path).encode()).hexdigest()
        auth = base64.b64encode(json.dumps({'tokenUri': digest}, separators=(',', ':')).encode()).decode()
        return json.loads(download(API + path, {'AUTH': auth}))
    return get


def collection(get, path):
    result, seen, total = [], set(), None
    for _ in range(100):
        if path in seen:
            raise ValueError('Repeated SIA pagination URL')
        seen.add(path)
        page = get(path)
        items, count = page.get('hydra:member'), page.get('hydra:totalItems')
        if not isinstance(items, list) or type(count) is not int or count < 0:
            raise ValueError('Invalid SIA collection schema')
        if total is not None and count != total:
            raise ValueError('SIA collection changed during download')
        total = count
        result.extend(items)
        nxt = page.get('hydra:view', {}).get('hydra:next')
        if not nxt:
            if len(result) != total:
                raise ValueError('Incomplete SIA collection')
            return result
        if not nxt.startswith('/api/') or urlparse(nxt).netloc:
            raise ValueError('Unexpected pagination target')
        path = nxt[len('/api/'):]
    raise ValueError('Too many SIA pages')


def build(points, configs, retrieved=None):
    config = {item['name']: item['value'] for item in configs}
    effective = date.fromisoformat(config['aixm-effective-date'])
    today = datetime.now(timezone.utc).date()
    if not effective <= today < effective + timedelta(days=28):
        raise ValueError(f'SIA cycle {effective} is not current; existing snapshot preserved')
    if not points:
        raise ValueError('Empty nationwide VFR dataset; existing snapshot preserved')
    converted, ids = [], set()
    for p in points:
        if p.get('initialCodeType') != 'VFR' or p.get('codeType') != 'VFR':
            raise ValueError('Unexpected point classification')
        key, name, airport = str(p['id']), p['txtName'], p.get('codeId', '')
        if key in ids or not name or not isinstance(airport, str):
            raise ValueError('Duplicate ID or invalid name/airport')
        ids.add(key)
        if airport and not re.fullmatch(r'[A-Z]{4}', airport):
            raise ValueError('Unexpected aerodrome identifier')
        c = p['coordinates']
        # Remove only the documented matching aerodrome suffix, never guess a code.
        prefix = airport[2:] + '-' if airport else ''
        code = name[len(prefix):] if prefix and name.startswith(prefix) else name
        converted.append({
            'id': 'sia-' + key, 'code': code, 'name': name, 'airport': airport,
            'lat': coordinate(c['latitude'], 'lat'), 'lng': coordinate(c['longitude'], 'lng'),
            'publishedLat': c['latitude'], 'publishedLng': c['longitude'],
            'compulsory': None, 'alt': '', 'desc': p.get('txtRmk', ''),
            '_src': 'sia', 'sourceId': key,
        })
    converted.sort(key=lambda p: (p['airport'], p['name'], p['id']))
    raw = json.dumps({'points': points, 'configs': configs}, ensure_ascii=False, sort_keys=True)
    metadata = {
        'source': 'Service de l’Information Aéronautique (SIA)', 'sourceUrl': SOURCE,
        'endpoint': API + 'v1/points?initialCodeType=VFR', 'licenseUrl': LICENSE,
        'effectiveFrom': effective.isoformat(),
        'effectiveUntil': (effective + timedelta(days=28)).isoformat(),
        'retrievedAt': retrieved or datetime.now(timezone.utc).isoformat(),
        'sourceImportDate': config.get('import-date'), 'count': len(converted),
        'metropolitanCount': sum(1 for p in converted if 41 <= p['lat'] <= 52 and -6 <= p['lng'] <= 10),
        'sha256': hashlib.sha256(raw.encode()).hexdigest(),
        'coverage': 'Points classés VFR par le visualisateur SIA, métropole et outre-mer. Exhaustivité des VAC non garantie.',
    }
    return {'metadata': metadata, 'points': converted}, raw


def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as f:
        f.write(content)
        temp = Path(f.name)
    temp.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cached', type=Path, help='Validate/rebuild a previously downloaded source archive')
    args = parser.parse_args()
    if args.cached:
        source = json.loads(args.cached.read_text())
        points, configs = source['points'], source['configs']
    else:
        get = client()
        configs = collection(get, 'v1/configs?itemsPerPage=800&page=1')
        points = collection(get, 'v1/points?initialCodeType=VFR&itemsPerPage=800&page=1')
        after = collection(get, 'v1/configs?itemsPerPage=800&page=1')
        for field in ('aixm-effective-date', 'import-date'):
            before_value = next(p['value'] for p in configs if p['name'] == field)
            after_value = next(p['value'] for p in after if p['name'] == field)
            if before_value != after_value:
                raise ValueError('SIA import changed during download; retry later')
    dataset, raw = build(points, configs)
    # A single JS file contains metadata and points, so readers never see a mixed cycle.
    output = '// Derived from SIA; attribution and cycle are embedded below. Generated by tools/update_sia_vfr.py.\n'
    output += 'globalThis.AltiviewVfrData = ' + json.dumps(dataset, ensure_ascii=False, separators=(',', ':')) + ';\n'
    atomic_write(ROOT / 'data/sia-vfr-source.json', raw + '\n')
    atomic_write(ROOT / 'data/sia-vfr.js', output)
    print(f"SIA: {len(dataset['points'])} VFR points, effective {dataset['metadata']['effectiveFrom']}. Reload the chart.")


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        raise SystemExit(f'SIA refresh failed; previous chart snapshot retained: {exc}')
