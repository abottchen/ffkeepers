#!/usr/bin/perl -w

use strict;
use CGI;
use POSIX;
use Crypt::CBC;

open STDERR,">/var/www/perl/keepers/keepers.err";
my $input = new CGI;
print $input->header;

sub Round {
	my $num = shift @_;
	if($num !~ /\./) {
		return $num;
	}
	my ($b,$a) = $num =~ /(\d+)\.(\d)/;
	return  $b + ($a>=5?1:0);
}

sub encryptString {
   my ($string,$password) = @_;
  
   my $cipher = Crypt::CBC->new(
      -key        => $password,
      -cipher     => 'Blowfish',
      -padding  => 'space',
      -add_header => 1
   );

   my $enc = $cipher->encrypt( $string  );
   return $enc; 
}

my @teams;
my %players;
open CSV,"</var/www/perl/keepers/ff2017rosters.csv";
while(<CSV>) {
	chomp;
	s/\s+\z//;
	next if(/Player/);
	my @line;
	
	if(/ADAM/) {
		s/"//g;
		@line = split(/,,/);
		push @teams, @line;
	} else {
		s/"//g;
		@line = split(/,/);
		for my $i (0..9) {
			$players{$teams[$i]} .= (shift @line) . ","; 		
			$players{$teams[$i]} .= (shift @line) . ","; 		
		}	
	}
}

print "<html>\n";

# Keepers were picked
if(defined $input->param('submitplayers')) {
	my @players = $input->param('player');
	if(scalar @players > 3) {
		print "<h2><font color=red>Too many selections!</font></h2>";
	} elsif($input->param('password') eq "") {
		print "<h2><font color=red>You did not enter a password!</font></h2>";
	} else {
		print "<h2>You are keeping</h2><br>";
		if(scalar(@players) == 0) {
			print "No Players<br>";
		}
		my $string;
		for my $player (@players) {
			print "$player<br>";
			$string .= $player . "/";
		}	
		print "<br><br>With the password '" . $input->param('password') . "'<br>Make sure to remember it!<br>";
		my $team=$input->param('team');
		open FH,">/ff/$team.enc";
		print FH encryptString($string,$input->param('password'));
		close FH;
	}
} elsif(defined $input->param('submit')) {
# Team was selected
	my $inteam = $input->param('teamname');
	print "<h2>Select Keepers</h2>\n";
	print "<form name='players' method='post' action='keepers.pl'>\n";
	print "<table>\n";
	print "<tr>\n";
	print "<th>\n";
	print "<th>Name\n";
	print "<th>Last Year\n";
	print "<th>This Year\n";
	my @line = split /,/, $players{$inteam};
	for my $i (1..17) {
		my $n = shift(@line);
		my $p = shift(@line);
		printf("<tr><td><input type='checkbox' name='player' value='$n'><td>%s<td align=center>%s<td align=center>%s</tr>\n", $n, Round($p*0.1)>0?$p-Round($p*0.1):$p-1, $p); 
	}
	print "</table>\n";
	print "<br>\n";
	print "Enter the password to encrypt your choices: <input type='text' name='password'><br>\n";
	print "<font size=-1>Note: This password can be any length greater than 0.<br>
		Make sure it is set to something you are willing to say in front of everyone when we go to unlock your picks.<br>
		You are free to submit this page again to change your selections at any time.<br></font>\n";
	print "<input type='hidden' name='team' value='$inteam'>\n";
	print "<input type='submit' name='submitplayers' value='Keep'>\n";
	print "</form>\n";
} else { # Default start page
	print "<h2>Select your team</h2>\n";
	print "<form name='team' method='post' action='keepers.pl'>\n";
	print "<select name='teamname'>\n";
	for my $t (@teams) {
		print "<option value='$t'>$t</option>\n";
	}
	print "</select>\n";
	print "<input type='submit' name='submit' value='Select'>\n";
	print "</form>\n";
}

print "</html>\n";

