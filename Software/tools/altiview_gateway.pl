#!/usr/bin/perl
# =============================================================================
# Altiview — passerelle locale (serveur + données aéronautiques)
#
# Sert le logiciel ET les données officielles depuis la même adresse locale.
# Les navigateurs refusent d'appeler aviationweather.gov ou l'API NOTAM de la FAA
# directement depuis un fichier local (règle CORS) : la passerelle fait l'appel
# à leur place, en Perl + curl, sans rien installer.
#
#   perl tools/altiview_gateway.pl [dossier] [port]
#
# Points d'entrée :
#   /api/health                        état de la passerelle et des sources
#   /api/metar?ids=LFPN,LFOB           METAR officiels (NOAA / aviationweather.gov)
#   /api/taf?ids=LFPN                  TAF officiels (NOAA)
#   /api/notam?icao=LFPN&client_id=..&client_secret=..   NOTAM (API FAA, clé gratuite)
#   /api/openaip?path=airspaces&...&key=..               espaces aériens (OpenAIP, clé gratuite)
# =============================================================================
use strict; use warnings;
use IO::Socket::INET;
use File::Path qw(make_path);

my $root = $ARGV[0] // '.';
my $port = $ARGV[1] // 8790;
my $cache_dir = ($ENV{TMPDIR} || '/tmp') . 'altiview-cache';
$cache_dir =~ s{//+}{/}g;
make_path($cache_dir) unless -d $cache_dir;

my %mime = (
  html => 'text/html; charset=utf-8', css => 'text/css; charset=utf-8', js => 'text/javascript; charset=utf-8',
  svg => 'image/svg+xml', png => 'image/png', jpg => 'image/jpeg', jpeg => 'image/jpeg', webp => 'image/webp',
  json => 'application/json; charset=utf-8', ico => 'image/x-icon', woff2 => 'font/woff2',
  txt => 'text/plain; charset=utf-8', command => 'text/plain; charset=utf-8', pl => 'text/plain; charset=utf-8'
);

sub url_decode { my $s = shift // ''; $s =~ tr/+/ /; $s =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg; return $s; }
sub parse_query {
  my $q = shift // ''; my %p;
  for my $pair (split /&/, $q) { my ($k, $v) = split /=/, $pair, 2; next unless defined $k && length $k; $p{url_decode($k)} = url_decode($v // ''); }
  return %p;
}
sub safe { my $s = shift // ''; $s =~ s/[^A-Za-z0-9,._\-]//g; return $s; }
sub cache_name { my $s = shift; $s =~ s/[^A-Za-z0-9]/_/g; return substr($s, 0, 120); }

# HTTPS via curl : présent sur macOS, aucune dépendance Perl supplémentaire
sub fetch_upstream {
  my ($url, $ttl, @headers) = @_;
  my $file = "$cache_dir/" . cache_name($url) . '.cache';
  if ($ttl > 0 && -f $file && (time - (stat $file)[9]) < $ttl) {
    local $/; open my $fh, '<:raw', $file or return (200, '');
    my $d = <$fh>; close $fh; return (200, $d, 1);
  }
  my @cmd = ('curl', '-s', '--max-time', '20', '-H', 'User-Agent: Altiview/1.0 (local gateway)');
  push @cmd, ('-H', $_) for @headers;
  push @cmd, ('-w', '\n%{http_code}', $url);
  my $out = '';
  if (open my $ph, '-|', @cmd) { local $/; $out = <$ph> // ''; close $ph; }
  my $code = 502;
  if ($out =~ s/\n(\d{3})\s*$//) { $code = $1 + 0; }
  if ($code == 200 && length $out) {
    if (open my $fh, '>:raw', $file) { print $fh $out; close $fh; }
  }
  return ($code, $out, 0);
}

sub send_json {
  my ($c, $code, $body, $cached) = @_;
  my $status = $code == 200 ? 'OK' : ($code == 404 ? 'Not Found' : ($code == 401 ? 'Unauthorized' : 'Bad Gateway'));
  print $c "HTTP/1.1 $code $status\r\nContent-Type: application/json; charset=utf-8\r\n"
    . "Access-Control-Allow-Origin: *\r\nCache-Control: no-store\r\n"
    . "X-Altiview-Cache: " . ($cached ? 'hit' : 'miss') . "\r\n"
    . "Content-Length: " . length($body) . "\r\nConnection: close\r\n\r\n" . $body;
}

my $srv = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Listen => 64, ReuseAddr => 1)
  or die "Port $port occupé : $!\n";
$SIG{CHLD} = 'IGNORE'; $| = 1;
print "Altiview — passerelle locale\n";
print "  Application : http://127.0.0.1:$port/flg_prep.html\n";
print "  Données     : /api/metar · /api/taf · /api/notam · /api/openaip\n";
print "  Fermer      : Ctrl+C\n\n";

while (my $c = $srv->accept) {
  my $pid = fork;
  if (!defined $pid) { close $c; next }
  if ($pid) { close $c; next }

  my $req = <$c> // '';
  while (my $l = <$c>) { last if $l =~ /^\r?\n$/ }
  my ($method, $target) = $req =~ m{^(GET|HEAD|OPTIONS)\s+(\S+)};
  if (!$method) { print $c "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"; close $c; exit 0 }
  if ($method eq 'OPTIONS') {
    print $c "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    close $c; exit 0;
  }

  my ($path, $query) = split /\?/, $target, 2;
  $path = url_decode($path);
  my %q = parse_query($query);

  if ($path =~ m{^/api/}) {
    if ($path eq '/api/health') {
      my $body = '{"ok":true,"service":"altiview-gateway","version":"1.0",'
        . '"sources":{"metar":"aviationweather.gov (NOAA)","taf":"aviationweather.gov (NOAA)",'
        . '"notam":"external-api.faa.gov (clé requise)","airspaces":"api.core.openaip.net (clé requise)"},'
        . '"time":"' . scalar(gmtime) . ' UTC"}';
      send_json($c, 200, $body, 0);
    }
    elsif ($path eq '/api/metar' || $path eq '/api/taf') {
      my $kind = $path eq '/api/metar' ? 'metar' : 'taf';
      my $ids = safe($q{ids} || '');
      if (!$ids) { send_json($c, 400, '{"error":"parametre ids manquant"}', 0); close $c; exit 0; }
      my ($code, $body, $cached) = fetch_upstream(
        "https://aviationweather.gov/api/data/$kind?ids=$ids&format=json", 240);
      send_json($c, $code == 200 ? 200 : 502, $code == 200 ? $body : '{"error":"source indisponible","upstream":' . $code . '}', $cached);
    }
    elsif ($path eq '/api/notam') {
      my $icao = safe($q{icao} || '');
      my $id = $q{client_id} || ''; my $secret = $q{client_secret} || '';
      if (!$icao) { send_json($c, 400, '{"error":"parametre icao manquant"}', 0); close $c; exit 0; }
      if (!$id || !$secret) { send_json($c, 401, '{"error":"cle FAA absente","how":"Renseignez client_id et client_secret dans Sources de donnees"}', 0); close $c; exit 0; }
      my ($code, $body, $cached) = fetch_upstream(
        "https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=$icao&pageSize=50&sortBy=effectiveStartDate&sortOrder=Desc",
        900, "client_id: $id", "client_secret: $secret");
      send_json($c, $code == 200 ? 200 : $code, $code == 200 ? $body : '{"error":"source NOTAM indisponible","upstream":' . $code . '}', $cached);
    }
    elsif ($path eq '/api/openaip') {
      my $sub = safe($q{path} || 'airspaces');
      my $key = $q{key} || '';
      if (!$key) { send_json($c, 401, '{"error":"cle OpenAIP absente","how":"Renseignez la cle dans Sources de donnees"}', 0); close $c; exit 0; }
      my @params;
      for my $k (qw(bbox page limit country type searchOptimized)) {
        push @params, "$k=" . safe($q{$k}) if defined $q{$k} && length $q{$k};
      }
      my $qs = join('&', @params);
      my ($code, $body, $cached) = fetch_upstream(
        "https://api.core.openaip.net/api/$sub" . ($qs ? "?$qs" : ''), 3600, "x-openaip-api-key: $key");
      send_json($c, $code == 200 ? 200 : $code, $code == 200 ? $body : '{"error":"source espaces aeriens indisponible","upstream":' . $code . '}', $cached);
    }
    else { send_json($c, 404, '{"error":"point d\'entree inconnu"}', 0); }
    close $c; exit 0;
  }

  # ---- fichiers du logiciel -------------------------------------------------
  $path .= 'index.html' if $path =~ m{/$};
  if ($path =~ /\.\./) { print $c "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"; close $c; exit 0 }
  my $f = "$root$path";
  if (-f $f && open(my $fh, '<:raw', $f)) {
    local $/; my $d = <$fh>; close $fh;
    my ($ext) = $f =~ /\.([^.\/]+)$/;
    my $t = $mime{lc($ext // '')} // 'application/octet-stream';
    print $c "HTTP/1.1 200 OK\r\nContent-Type: $t\r\nContent-Length: " . length($d) . "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n";
    print $c $d if $method eq 'GET';
  } else {
    my $b = 'Fichier introuvable';
    print $c "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: " . length($b) . "\r\nConnection: close\r\n\r\n$b";
  }
  close $c; exit 0;
}
