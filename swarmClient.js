const config = require('./config');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const {RequestPromise} = require('./common/nodejs/express/serverClient');
const logger = require('./common/nodejs/logger').new('swarm Client');
const serverClient = require('./common/nodejs/express/serverClient');
const {ConfigFactory} = require('./common/nodejs/configtxlator');
const golangUtil = require('./common/nodejs/golang');
exports.globalConfig = () => {
	return RequestPromise({url: `${swarmBaseUrl}/config/orgs`, method: 'GET'});
};
exports.touch = () => {
	return RequestPromise({url: swarmBaseUrl, method: 'GET'});
};
exports.leader = () => serverClient.leader.info(swarmBaseUrl);
exports.getChaincode = async (chaincodeName) => {
	const url = `${swarmBaseUrl}/config/chaincode`;
	const {chaincodes} = await RequestPromise({url, method: 'GET'});
	const {path} = chaincodes[chaincodeName];
	await golangUtil.get(path);
	return {chaincodePath: path};
};
exports.block = (filePath) => {
	logger.debug('block', filePath);
	return serverClient.block(swarmBaseUrl, filePath);
};
exports.newOrg = async (cryptoPath, nodeType, channelName, orgName, TLS) => {
	logger.debug('newOrg', nodeType, {channelName, orgName, TLS}, cryptoPath);
	let orgConfig;
	const {msp} = cryptoPath.OrgFile(nodeType);
	const admins = [msp.admincerts];
	const root_certs = [msp.cacerts];
	const tls_root_certs = TLS ? [msp.tlscacerts] : [];

	if (nodeType === 'orderer') {
		orgConfig = config.orderer.orgs[orgName];
	} else {
		orgConfig = config.orgs[orgName];
	}
	const MSPID = orgConfig.MSP.id;
	const MSPName = orgConfig.MSP.name;


	const respNewOrg = await serverClient.createOrUpdateOrg(swarmBaseUrl, channelName, MSPID, MSPName, nodeType, {
		admins,
		root_certs,
		tls_root_certs
	}, false);
	logger.debug({respNewOrg});
	if (respNewOrg.status === 'BAD_REQUEST') {
		throw Error(JSON.stringify(respNewOrg));
	}
	if (nodeType === 'orderer') {
		const blockWaiter = async () => {
			const respNewOrg = await exports.getChannelConfig(channelName, nodeType);
			const newConfig = new ConfigFactory(JSON.stringify(respNewOrg));
			const mspConfig = newConfig.getOrg(MSPName, nodeType);
			logger.debug('new orderer org', mspConfig);
			if (!mspConfig) {
				return new Promise((resolve) => {
					logger.warn('new orderer org block waiter for 2 second');
					setTimeout(() => {
						resolve(blockWaiter());
					}, 2000);
				});
			}

		};
		await blockWaiter();

	} else {
		return respNewOrg;
	}

};
exports.newOrderer = (ordererHostName) => {
	const address = `${ordererHostName}:7050`;
	logger.debug('newOrderer', address);
	const body = {
		address
	};
	return RequestPromise({url: `${swarmBaseUrl}/channel/newOrderer`, body});
};
exports.getChannelConfig = (channelName, nodeType) => {
	const url = `${swarmBaseUrl}/channel/getChannelConfig`;
	const body = {
		nodeType, channelName
	};
	return RequestPromise({url, body});
};