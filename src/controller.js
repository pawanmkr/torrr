import path from 'path'
import torrentStream from 'torrent-stream';

export async function getMetadata(req, res) {
  const { magnetUri } = req.body;
  const files = []

  try {
    const engine = torrentStream(magnetUri, {
      tmp: path.join(process.cwd(), '/tmp'),
      path: path.join(process.cwd(), '/tmp')
    });

    engine.on('ready', function () {

      engine.files.forEach(function (file) {
        const extensions = ['.3gp', '.avi', '.flv', '.h264', '.m4v', '.mkv', '.mov', '.mp4', '.mpg', '.mpeg'];
        extensions.forEach(ext => {
          if (file.name.includes(ext)) {
            files.push({
              "name": file.name,
              "path": file.path,
              "size": Math.round(file.length / 1000000)
            })
          }
        })
      });

      engine.destroy(() => { })

      res.send(files)
    })
  } catch (error) {
    console.log(error)
  }
}

export async function handleStreaming(req, res) {
  let { filePath, magnetUri } = req.query;

  console.log("\n> Adding torrent...")

  try {
    const engine = torrentStream(magnetUri, {
      tmp: path.join(process.cwd(), '/tmp'),
      path: path.join(process.cwd(), '/tmp')
    });

    engine.on('ready', function () {
      console.log("\n> Torrent is ready to serve")

      let totalProgress = 0;
      let canWrite = true;

      console.log("\n> Finding your file...")
      const targetFile = engine.files.find(file => {
        if (file.path === filePath) {
          file.select();
          console.log("\n> File found and Selected")
          console.log('> ' + file.name + '  -  ' + Math.round(file.length / 1000000) + ' MB')
          return file;
        }
      });

      if (targetFile === undefined) {
        console.log("File not found")
        return res.status(404).send(`\n> File not found!`);
      }

      if (engine.files.length > 1) {
        console.log("\n> Deselecting other files...")
        engine.files.forEach((file) => {
          if (file.path !== filePath) {
            file.deselect()
          }
        })
      }

      res.setHeader("Content-Type", "application/octet-stream")
      res.setHeader("Content-Length", targetFile.length)
      res.setHeader("Content-disposition", "attachment; filename=" + path.basename(targetFile.name))

      const totoalFileSize = targetFile.length;

      console.log("\n> Creating ReadStream...")
      const stream = targetFile.createReadStream();
      let uploadBytes = 0

      stream.on('open', () => {
        console.log("\n> Stream Opened")
      })

      stream.on('ready', () => {
        console.log("\n> Stream Ready")
      })

      // stream.on('open', () => {
      //   console.log("\n> Stream Opened")
      // })

      res.on('drain', () => {
        // console.log("\n> Response Drained")
        canWrite = true;
        stream.resume();
      })

      stream.on('error', (error) => {
        console.error('Stream error:', error);
        res.end();
        engine.destroy();
      });

      res.on('error', (error) => {
        console.error('Response error:', error);
        stream.destroy();
        engine.destroy();
      });

      stream.on('data', (chunk) => {
        uploadBytes += chunk.length
        let currentProgress = Math.round((uploadBytes / totoalFileSize) * 100);
        const mb = Math.round(uploadBytes / 1000000);
        if (currentProgress !== totalProgress) {
          console.log('\n> ' + currentProgress + "%  --->  " + mb + "MB")
        }
        totalProgress = currentProgress;

        if (!res.write(chunk)) {
          // console.log("\n> Pausing Stream...")
          canWrite = false;
          stream.pause();
        }
      })

      stream.on('end', () => {
        console.log("\n> Stream ended")
        res.end()
        engine.destroy()
      })

      res.on('close', () => {
        console.log("\n> Response closed")
        engine.remove(false, () => { })
        engine.destroy()
      })

      stream.on('oncomplete', () => {
        console.log("\n> ReadStream is complete")
      })

      engine.on('download', () => {
        // console.log("\n> Downloading torrent started!")
      })

      engine.on('error', (error) => {
        console.error('engine error:', error);
        engine.destroy();
        res.end();
      });

    })
  } catch (error) {
    console.log(error)
  }
}
