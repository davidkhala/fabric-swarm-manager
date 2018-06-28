const config = require('./config');
const swarmBaseUrl = `${config.swarmServer.url}:${config.swarmServer.port}`;
const {RequestPromise} = require('./common/nodejs/express/serverClient');
const logger = require('./common/nodejs/logger').new('swarm Client');
const serverClient = require('./common/nodejs/express/serverClient');
const {ConfigFactory} = require('./common/nodejs/configtxlator');
exports.globalConfig = () => {
	return RequestPromise({url: `${swarmBaseUrl}/config/orgs`, method: 'GET'});
};
exports.touch = () => {
	return RequestPromise({url: swarmBaseUrl, method: 'GET'});
};
exports.leader = () => serverClient.leader.info(swarmBaseUrl);
const util = require('util');
const exec = util.promisify(require('child_process').exec);
exports.getChaincode =async (path) => {
	const {stdout, stderr} = await exec('docker system prune --force');
	if (stderr) {
		throw stderr;
	}
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

	const blockWaiter = async () => {
		const respNewOrg = await serverClient.createOrUpdateOrg(swarmBaseUrl, channelName, MSPID, MSPName, nodeType, {
			admins,
			root_certs,
			tls_root_certs
		}, false);
		const newConfig = new ConfigFactory(respNewOrg);
		const mspConfig = newConfig.getOrg(MSPName, nodeType);
		logger.debug('newOrg', mspConfig);
		if (!mspConfig) {
			return new Promise((resolve) => {
				logger.warn('new org block waiter for 2 second');
				setTimeout(() => {
					resolve(blockWaiter());
				}, 2000);
			});
		}

	};
	await blockWaiter();
};
exports.newOrderer = (ordererHostName) => {
	const address = `${ordererHostName}:7050`;
	logger.debug('newOrderer', address);
	const body = {
		address
	};
	return RequestPromise({url: `${swarmBaseUrl}/channel/newOrderer`, body});
};