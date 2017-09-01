#!/usr/bin/perl -w

use strict;
use Crypt::CBC;

sub decryptString {
   my ($string,$password) = @_;
   
   my $cipher = Crypt::CBC->new(
      -key        => $password,
      -cipher     => 'Blowfish',
      -padding  => 'space',
      -add_header => 1
   );

   my $dec = $cipher->decrypt( $string  );
   return $dec; 
}


print "File: $ARGV[0]\nPassword: $ARGV[1]\n";
open my $fh, '<:unix', $ARGV[0];
read $fh, my $buffer, -s $fh;
close $fh;

print decryptString($buffer, $ARGV[1]) . "\n";
