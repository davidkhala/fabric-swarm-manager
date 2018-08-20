const config = require('./config');
const {deployPeer, chaincodeClean} = require('./common/nodejs/fabric-dockerode');
const {swarmServiceName, serviceClear, taskLiveWaiter,swarmTouch} = require('./common/docker/nodejs/dockerode-util');
const {CryptoPath} = require('./common/nodejs/path');
const peerUtil = require('./common/nodejs/peer');
const {adminName, loadFromLocal} = require('./common/nodejs/user');
const {globalConfig} = require('./swarmClient');
const {join:joinChannel} = require('./common/nodejs/channel');
const logger = require('./common/nodejs/logger').new('genPeer');
const {newOrg} = require('./swarmClient');
const channelUtil = require('./common/nodejs/channel');
const clientUtil = require('./common/nodejs/client');
const MSPROOTvolumeName = 'MSPROOT';
const peerName = 'newContainer';
const peerOrg = 'NEW';
const portMap = config.orgs[peerOrg].peers[peerName].portMap;
const ordererUtil = require('./common/nodejs/orderer');
const path = require('path');
const asyncTask = async (action) => {
	logger.debug('[start] genPeer');
	const cryptoType = 'peer';
	const channelName = 'allchannel';

	const cryptoPath = new CryptoPath(peerUtil.container.MSPROOT, {
		peer: {
			name: peerName,
			org: peerOrg
		},
		user: {
			name: adminName
		}
	});
	const MSPROOTDir = path.resolve(config.MSPROOT);
	const hostCryptoPath = new CryptoPath(MSPROOTDir, {
		peer: {
			name: peerName,
			org: peerOrg
		},
		user: {
			name: adminName
		}
	});
	const {peerHostName} = cryptoPath;
	if (action === 'down') {
		const serviceName = swarmServiceName(peerHostName);
		const {result} = await swarmTouch();
		if(result){
			await serviceClear(serviceName);
		}
		await chaincodeClean();
		logger.info('[done] down');
		return;
	}

	await newOrg(hostCryptoPath, cryptoType, channelName, peerOrg);

	const {docker: {network, fabricTag}, TLS} = await globalConfig();
	const imageTag = `${fabricTag}`;

	//Stateful: assume volume created in caCryptogen.js
	const tls = TLS ? cryptoPath.TLSFile(cryptoType) : undefined;
	const peerPort = portMap.port;
	const eventHubPort = portMap.eventHubPort;
	const peerService = await deployPeer({
		Name: peerHostName, network, imageTag,
		port: peerPort, eventHubPort,
		msp: {
			volumeName: MSPROOTvolumeName,
			configPath: cryptoPath.MSP(cryptoType),
			id: config.orgs[peerOrg].MSP.id
		}, peerHostName,
		tls
	});
	await taskLiveWaiter(peerService);

	const peerClient = clientUtil.new();
	const peerAdmin = await loadFromLocal(hostCryptoPath, 'peer', config.orgs[peerOrg].MSP.id, peerClient.getCryptoSuite());
	await peerClient.setUserContext(peerAdmin, true);


	const channel = channelUtil.new(peerClient, channelName);
	const {caCert: cert} = TLS ? hostCryptoPath.TLSFile(cryptoType) : {};
	const peer = peerUtil.new({peerPort, peerHostName, cert});
	const orderer = ordererUtil.new({ordererPort: 7050});//FIXME Testing with tls disabled, we cannot join channel without orderer pem

	const result = await joinChannel(channel, peer,orderer,1000);
	logger.info('joinChannel',result);
};
try {
	asyncTask(process.env.action);
} catch (err) {
	logger.error(err);
	process.exit(1);
}
