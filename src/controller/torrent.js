import path from 'path';
import torrentStream from 'torrent-stream';
import TorrentSearchApi from 'torrent-search-api'
import crypto from 'node:crypto'
import { Queries } from '../database/queries.js';
import queryString from 'node:querystring';
import QRCode from 'qrcode';

export async function getMetadata(req, res) {
  const { magnet } = req.query;
  const files = []

  try {
    const engine = torrentStream(magnet, {
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
              "size": `${Math.round(file.length / 1000000)} mb`
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
  let { filePath, magnet } = req.query;

  console.log("\n> Adding torrent...")

  try {
    const engine = torrentStream(magnet, {
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

      stream.pipe(res)

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

      stream.on('end', () => {
        console.log("\n> Stream ended")
        // Generate and send the MPD file
        generateAndSendMPDFile();
        res.end()
        engine.destroy()
      })

      res.on('close', () => {
        console.log("\n> Response closed")
        engine.remove(false, () => { })
        engine.destroy()
      })

      stream.on('data', (chunk) => {
        uploadBytes += chunk.length
        let currentProgress = Math.round((uploadBytes / totoalFileSize) * 100);
        const mb = Math.round(uploadBytes / 1000000);
        if (currentProgress !== totalProgress) {
          console.log('\n> ' + currentProgress + "%  --->  " + mb + "MB")
        }
        totalProgress = currentProgress;
      });

      engine.on('download', () => {
        // console.log("\n> Downloading torrent started!")
      });

      engine.on('error', (error) => {
        console.error('engine error:', error);
        engine.destroy();
        res.end();
      });
    });
  } catch (error) {
    console.error(error);
  }
}

export async function searchTorrents(req, res) {
  const { query } = req.query;

  const providers = [
    '1337x',
    'ThePirateBay',
    'KickassTorrents',
    'Limetorrents',
    'Torrent9',
    'TorrentProject',
    'Torrentz2',
    'Eztv',
    'Rarbg'
  ];

  const trs = [];

  for (const provider of providers) {
    try {
      if (trs.length < 10) {
        TorrentSearchApi.enableProvider(provider);
        const torrents = await TorrentSearchApi.search(query, '', 100);

        torrents.forEach(torrent => {
          // console.log(torrent);
          if ('magnet' in torrent) {
            if (torrent.numFiles !== 0 && torrent.id !== 0) {
              torrent["provider"] = "public providers"
              trs.push(torrent);
            }
          }
        });
      }
    } catch (error) {
      console.error(`Error searching torrents from ${provider}. Potentially your IP may be blocked`);
      // handle the error, e.g., return an error response
    }
    TorrentSearchApi.disableProvider(provider);
  }

  res.json({
    found: trs.length > 0,
    length: trs.length,
    result: trs
  });
}

export async function generateShortLink(req, res) {
  const { magnet } = req.query;
  if (magnet == undefined) {
    return res.sendStatus(400).send("Magnet URI not found");
  }

  const uid = crypto.randomUUID().substring(0, 8);
  await Queries.saveMagnet(uid, magnet);

  const shortLink = `${process.env.SERVER_URL}/short/` + uid;
  const qrcode = await QRCode.toDataURL(shortLink);

  res.json({
    shortLink: shortLink,
    qrCode: qrcode
  })
}

export async function handleShortService(req, res) {
  const uid = req.params.uid;
  if (!uid) {
    return res.sendStatus(400).json({
      error: "short link is invalid"
    })
  }

  const magnet = await Queries.retrieveMagnetUsingShortLink(uid);
  if (!magnet) {
    return res.sendStatus(404).json({
      error: "please use a valid link, this does not exist in our system"
    });
  }

  const queryParams = { magnet: magnet }
  const redirectUrl = '/metadata?' + queryString.stringify(queryParams);
  res.redirect(301, redirectUrl);
};

export async function handleShortStats(req, res) {
  const uid = req.params.uid;
  if (!uid) {
    return res.sendStatus(400).json({
      error: "invalid short id"
    })
  }

  const clicks = await Queries.retrieveShortStats(uid);
  if (!clicks || clicks < 0) {
    return res.sendStatus(404).json({
      error: "invalid short id, this does not exist in our system"
    });
  }

  res.json({
    shortId: uid,
    totalClicks: clicks
  });
};
