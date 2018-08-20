const config = require('./config');
const logger = require('./common/nodejs/logger').new('sign server');
const userUtil = require('./common/nodejs/user');
const signUtil = require('./common/nodejs/multiSign');
const clientUtil = require('./common/nodejs/client');
const {CryptoPath, fsExtra} = require('./common/nodejs/path');
const path = require('path');
const baseApp = require('./common/nodejs/express/baseApp');
const {sha2_256} = require('./common/nodejs/helper');

const fs = require('fs');
exports.run = () => {
	const {port} = config.signServer;
	const {app} = baseApp.run(port);
	const Multer = require('multer');
	const cache = Multer({dest: path.resolve(config.signServer.cache)});
	/**
	 * return two signatures: 1 from orderer 1 from peer
	 */
	app.post('/', cache.single('proto'), async (req, res) => {
		const ordererOrg = 'NewConsensus';
		const peerOrg = 'NEW';
		const ordererName = 'orderer0';
		const peerName = 'newContainer';
		try {
			if (!req.file) throw Error('no attachment file');
			const proto = fs.readFileSync(req.file.path);
			logger.info('sign request', 'hash', sha2_256(proto));

			const cryptoPath = new CryptoPath(path.resolve(config.MSPROOT), {
				orderer: {name: ordererName, org: ordererOrg,},
				peer: {name: peerName, org: peerOrg},
				user: {name: 'Admin'}
			});

			const ordererClient = clientUtil.new();
			const ordererAdmin = await userUtil.loadFromLocal(cryptoPath, 'orderer', config.orderer.orgs[ordererOrg].MSP.id, ordererClient.getCryptoSuite());
			await ordererClient.setUserContext(ordererAdmin, true);
			const peerClient = clientUtil.new();
			const peerAdmin = await userUtil.loadFromLocal(cryptoPath, 'peer', config.orgs[peerOrg].MSP.id, peerClient.getCryptoSuite());
			await peerClient.setUserContext(peerAdmin, true);
			const {signatures} = await signUtil.signs([Promise.resolve(ordererClient), Promise.resolve(peerClient)], proto);

			res.send({signatures: signUtil.toBase64(signatures)});
		} catch (err) {
			logger.error(err);
			res.status(400).send(err.toString());
		}

	});
};
exports.clean = () => {
	logger.info('clean');
	fsExtra.removeSync(path.resolve(config.signServer.cache));
};
