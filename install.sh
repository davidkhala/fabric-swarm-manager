#!/usr/bin/env bash
set -e -x
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
root=$CURRENT

if [ -z "$(ls -A $root/common)" ]; then
	git pull
	git submodule update --init --recursive
fi

$root/common/install.sh
$root/common/install.sh chaincodeDevEnv

# finally
sudo apt autoremove -y
npm install
