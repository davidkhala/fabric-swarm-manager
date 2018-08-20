const peerName = 'newContainer';
const peerOrg = 'NEW';
const chaincodeId = process.env.name ? process.env.name : 'stress';
const channelName = 'allchannel';
const config = require('./config');
const logger = require('./common/nodejs/logger').new('deployCC');
const {port} = config.orgs[peerOrg].peers[peerName].portMap;
const {invoke} = require('./common/nodejs/chaincode');
const peerUtil = require('./common/nodejs/peer');
const {adminName, loadFromLocal} = require('./common/nodejs/user');
const {globalConfig} = require('./swarmClient');
const {CryptoPath} = require('./common/nodejs/path');
const clientUtil = require('./common/nodejs/client');
const channelUtil = require('./common/nodejs/channel');
const eventHubUtil = require('./common/nodejs/eventHub');
const ordererUtil = require('./common/nodejs/orderer');
const path = require('path');
const asyncTask = async (action) => {
	const hostCryptoPath = new CryptoPath(path.resolve(config.MSPROOT), {
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


	const channel = channelUtil.new(peerClient, channelName);
	const peers = [peer];
	const eventHub = eventHubUtil.newEventHub(channel, peer, true);
	const eventHubs = [eventHub];
	const fcn = '';
	const args = [];
	const orderer = ordererUtil.new({ordererPort: 7050});//FIXME Testing with tls disabled, we cannot join channel without orderer pem
	await invoke(channel, peers, eventHubs, {chaincodeId, fcn, args}, orderer);
};
try {
	asyncTask(process.env.action);
} catch (err) {
	logger.error(err);
	process.exit(1);
}

