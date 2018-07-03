const swarmClient = require('./swarmClient');
const {fabricImagePull, swarmIPJoin} = require('./common/nodejs/fabric-dockerode');
const {swarmLeave, swarmBelongs} = require('./common/docker/nodejs/dockerode-util');
const dockerCmdUtil = require('./common/docker/nodejs/dockerCmd');
const arch = 'x86_64';
const logger = require('./common/nodejs/logger').new('swarmSync');
const role = process.env.role?process.env.role: 'manager';
const asyncTask = async (action) => {
	await swarmClient.touch();
	const {workerToken,managerToken} = await swarmClient.leader();
	const token = role==='manager'?managerToken:workerToken
	const {token: JoinToken, AdvertiseAddr} = await dockerCmdUtil.advertiseAddr(token);


	if (action === 'down') {
		const {result, swarm} = await swarmBelongs(undefined, JoinToken);
		if (!result) {
			if (swarm) {
				logger.warn('swarm not belongs to', JoinToken, ',but belongs to', swarm.ID);
				await swarmLeave();
			} else {
				logger.warn('maybe a swarm worker');
			}
		}
		logger.info('[done] down');
		return;
	}
	const {docker: {network, thirdPartyTag, fabricTag}, TLS} = await swarmClient.globalConfig();
	await fabricImagePull({fabricTag, thirdPartyTag, arch});
	await swarmIPJoin({AdvertiseAddr, JoinToken});
	const node = await dockerCmdUtil.swarmWorkerInfo();
	logger.info('this node', JSON.stringify(node));


};
asyncTask(process.env.action);
