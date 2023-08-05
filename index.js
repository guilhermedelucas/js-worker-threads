const { Worker } = require('worker_threads');
const fs = require('fs');
const os = require('os');

const totalThreads = os.cpus().length;

function chunkify(array, n) {
	const chunkSize = Math.ceil(array.length / n); // Use ceil to ensure even distribution
	const chunks = [];
	for (let i = 0; i < n; i++) {
		chunks.push(array.slice(i * chunkSize, (i + 1) * chunkSize));
	}
	return chunks;
}

async function run(jobs, concurrentWorkers) {
	return new Promise((resolve) => {
		let completedWorkers = 0;
		const chunks = chunkify(jobs, concurrentWorkers);
		const tick = performance.now();
		const workerPromises = [];

		chunks.forEach((data, i) => {
			const worker = new Worker('./worker.js');
			worker.postMessage(data);
			worker.on('message', (workerMessage) => {
				// console.log(workerMessage);
				console.log(`Worker ${i} completed`);
				completedWorkers++;
				worker.terminate();
			});
			workerPromises.push(
				new Promise((innerResolve) => {
					worker.on('exit', () => {
						innerResolve();
					});
				})
			);
		});

		Promise.all(workerPromises).then(() => {
			const elapsed = performance.now() - tick;
			writeLog(`${concurrentWorkers} workers took ${elapsed} ms`);
			resolve();
		});
	});
}

function writeLog(message) {
	console.log(message);
	fs.appendFile('log.txt', message + '\n', (err) => {
		if (err) {
			console.error('Error writing to log file:', err);
		} else {
			console.log('Log entry written to log.txt');
		}
	});
}

const jobs = Array.from({ length: 100 }, () => 1e9);

(async () => {
	for (let index = 1; index <= totalThreads; index++) {
		await run(jobs, index);
	}
})();
