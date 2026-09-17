#!/usr/bin/perl
# Tiny static file server for local preview (no Node or Python needed). Not part of the site.
# Usage: perl serve.pl <root-folder> [port]
use strict; use warnings; use IO::Socket::INET;
my $root = $ARGV[0] // '.'; my $port = $ARGV[1] // 8765;
my %mime = (html=>'text/html; charset=utf-8', css=>'text/css; charset=utf-8', js=>'text/javascript; charset=utf-8',
  svg=>'image/svg+xml', png=>'image/png', jpg=>'image/jpeg', jpeg=>'image/jpeg', webp=>'image/webp', json=>'application/json',
  mp4=>'video/mp4', ico=>'image/x-icon', woff2=>'font/woff2', txt=>'text/plain; charset=utf-8', md=>'text/plain; charset=utf-8');
my $srv = IO::Socket::INET->new(LocalAddr=>'127.0.0.1', LocalPort=>$port, Listen=>32, ReuseAddr=>1) or die "listen: $!";
$SIG{CHLD} = 'IGNORE'; $| = 1;
print "Serving $root on http://localhost:$port\n";
while (my $c = $srv->accept) {
  my $pid = fork;
  if (!defined $pid) { close $c; next }
  if ($pid) { close $c; next }
  my $req = <$c> // '';
  while (my $l = <$c>) { last if $l =~ /^\r?\n$/ }
  my ($m, $path) = $req =~ m{^(GET|HEAD) (\S+)};
  if (!$m) { print $c "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"; close $c; exit 0 }
  $path =~ s/[?#].*//; $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg;
  $path .= 'index.html' if $path =~ m{/$};
  if ($path =~ /\.\./) { print $c "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"; close $c; exit 0 }
  my $f = "$root$path";
  if (-f $f && open(my $fh, '<:raw', $f)) {
    local $/; my $d = <$fh>; close $fh;
    my ($ext) = $f =~ /\.([^.\/]+)$/; my $t = $mime{lc($ext // '')} // 'application/octet-stream';
    print $c "HTTP/1.1 200 OK\r\nContent-Type: $t\r\nContent-Length: " . length($d) . "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n";
    print $c $d if $m eq 'GET';
  } else {
    my $b = 'Not found';
    print $c "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: " . length($b) . "\r\nConnection: close\r\n\r\n$b";
  }
  close $c; exit 0;
}
