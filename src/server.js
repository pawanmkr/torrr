import cluster from 'cluster';
import os from 'os';
import app from './app.js';
import dotenv from 'dotenv';
import process from 'process';
// import { connectWithDB } from './database/config.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  const numCPUs = os.cpus().length;

  // await connectWithDB();

  if (cluster.isPrimary) {
    console.log(`\n> Total CPU Cores: ${numCPUs}`);
    console.log(`> Master ${process.pid} is running`);

    // Fork workers for each CPU core
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    // Listen for dying workers
    cluster.on('exit', (worker) => {
      console.log(`\n> Worker ${worker.process.pid} died`);
      // Replace the dead worker
      cluster.fork();
    });
  } else {
    app.listen(PORT, () => {
      console.log(`> Worker ${process.pid} started and listening on http://localhost:${PORT}`);
    });
  }
}

(async function () {
  try {
    await startServer();

  } catch (error) {
    throw Error('[server]: Failed to start the server ', error);
  }
})();
