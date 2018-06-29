const peerName = 'newContainer';
const peerOrg = 'NEW';
const chaincodeId = process.env.name ? process.env.name : 'adminChaincode';
const channelName = 'allchannel';
const config = require('./config');
const logger = require('./common/nodejs/logger').new('deployCC');
const {port, eventHubPort} = config.orgs[peerOrg].peers[peerName].portMap;
const {updateInstall, install, invoke} = require('./common/nodejs/chaincode');
const peerUtil = require('./common/nodejs/peer');
const {adminName, loadFromLocal} = require('./common/nodejs/user');
const {getChaincode, globalConfig} = require('./swarmClient');
const {CryptoPath, homeResolve} = require('./common/nodejs/path');
const clientUtil = require('./common/nodejs/client');
const channelUtil = require('./common/nodejs/channel');
const eventHubUtil = require('./common/nodejs/eventHub');
const {chaincodeClean} = require('./common/nodejs/fabric-dockerode');
const ordererUtil = require('./common/nodejs/orderer');
const asyncTask = async (action) => {
	if (action === 'down') {
		await chaincodeClean(true);
		return;
	}
	const {chaincodePath} = await getChaincode(chaincodeId);
	const hostCryptoPath = new CryptoPath(homeResolve(config.MSPROOT), {
		peer: {
			name: peerName,
			org: peerOrg
		},
		user: {
			name: adminName
		}
	});
	const {TLS} = await globalConfig();
	const {peerHostName} = hostCryptoPath;
	const {caCert: cert} = TLS ? hostCryptoPath.TLSFile('peer') : {};
	const peer = peerUtil.new({peerPort: port, peerHostName, cert});

	const peerClient = clientUtil.new();
	const peerAdmin = await loadFromLocal(hostCryptoPath, 'peer', config.orgs[peerOrg].MSP.id, peerClient.getCryptoSuite());
	await peerClient.setUserContext(peerAdmin, true);

	if (action === 'update') {
		await updateInstall(peer, {chaincodeId, chaincodePath}, peerClient);
	} else {
		await install([peer], {chaincodeId, chaincodePath, chaincodeVersion: 'v0'}, peerClient);
	}

	logger.debug({GOPATH: process.env.GOPATH});

	const channel = channelUtil.new(peerClient, channelName);
	const peers = [peer];
	const eventHub = eventHubUtil.new(peerClient, {eventHubPort, cert, peerHostName});
	const eventHubs = [eventHub];
	const fcn = '';
	const args = [];
	const orderer = ordererUtil.new({ordererPort: 7050});//FIXME Testing with tls disabled, we cannot join channel without orderer pem
	await invoke(channel, peers, eventHubs, {chaincodeId, fcn, args},orderer);
};
try {
	asyncTask(process.env.action);
} catch (err) {
	logger.error(err);
	process.exit(1);
}

