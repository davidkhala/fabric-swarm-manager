const peerName = 'newContainer';
const peerOrg = 'NEW';
const chaincodeId = 'adminChaincode';
const config = require('./config');
const logger = require('./common/nodejs/logger').new('deployCC');
const portMap = config.orgs[peerOrg].peers[peerName].portMap;
const {install, invoke} = require('./common/nodejs/chaincode');
const peerUtil = require('./common/nodejs/peer');

const {RequestPromise} = require('./common/nodejs/express/serverClient');
const asyncTask = async () => {
	await RequestPromise(({url:, body, method:'GET' , formData})
	const peers = [];
	const chaincodePath, chaincodeVersion;
	await install(peers, {chaincodeId, chaincodePath, chaincodeVersion}, client);
};
try {
	asyncTask(process.env.action);
} catch (err) {
	logger.error(err);
	process.exit(1);
}

