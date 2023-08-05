const { Worker } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const appendFileAsync = promisify(fs.appendFile);

const totalThreads = os.cpus().length;
const lang = `node-${process.versions.node}`;

function chunkify(array, n) {
	const chunkSize = Math.ceil(array.length / n); // Use ceil to ensure even distribution
	const chunks = [];
	for (let i = 0; i < n; i++) {
		chunks.push(array.slice(i * chunkSize, (i + 1) * chunkSize));
	}
	return chunks;
}

async function run(jobs, concurrentWorkers, date) {
	return new Promise(async (resolve) => {
		let completedWorkers = 0;
		const chunks = chunkify(jobs, concurrentWorkers);
		const tick = process.hrtime(); // Record start time
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

		Promise.all(workerPromises).then(async () => {
			const elapsedHrtime = process.hrtime(tick);
			const elapsedMilliseconds =
				elapsedHrtime[0] * 1000 + elapsedHrtime[1] / 1e6;

			const formattedDate = date.toISOString().split('T')[0];
			const row = `${formattedDate},${lang},${concurrentWorkers},${elapsedMilliseconds}\n`;

			try {
				await appendFileAsync('results.csv', row);
				console.log('Results added to results.csv');
			} catch (error) {
				console.error('Error appending to results.csv:', error);
			}
			resolve();
		});
	});
}

const jobs = Array.from({ length: 100 }, () => 1e9);

(async () => {
	if (!fs.existsSync('results.csv')) {
		await appendFileAsync('results.csv', 'date,lang,threads,running_time\n');
	}

	const date = new Date();
	for (let index = 1; index <= totalThreads; index++) {
		await run(jobs, index, date);
	}
})();
