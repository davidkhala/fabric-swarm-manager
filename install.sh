#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
root=$CURRENT

if [ -z "$(ls -A $root/common)" ]; then
	git pull
	git submodule update --init --recursive
fi

$root/common/install.sh

# finally
sudo apt autoremove -y
npm install
