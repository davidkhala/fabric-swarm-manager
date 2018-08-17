#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

function gitSync(){
	git pull
	git submodule update --init --recursive
}
function dockerGrant(){
	$CURRENT/common/docker/dockerSUDO.sh
}
fcn=$1
if [ -n "$fcn" ];then
	$fcn
else
	$CURRENT/common/install.sh golang1_10
	$CURRENT/common/install.sh
	npm install
	dockerGrant
fi

