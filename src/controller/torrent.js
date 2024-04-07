// Import necessary modules
import path from 'path';
import torrentStream from 'torrent-stream';
import crypto from 'node:crypto';
import queryString from 'node:querystring';
import QRCode from 'qrcode';
import process from 'process';
import ffmpeg from 'fluent-ffmpeg';
import Queries from '../database/queries.js';
import { checkIfAudible, searchForTorrents } from '../services/torrent.js';
import { downloadFromGoogleDrive } from '../services/gdrive.js';


/**
 * Function to create torrent stream engine
 * @param {string} magnet - Magnet Link 
 * @returns {torrentStream} - Torrent Engine
 */
function createTorrentEngine(magnet) {
  return torrentStream(magnet, {
    tmp: path.join(process.cwd(), '/tmp'),
    path: path.join(process.cwd(), '/tmp'),
  });
}


/**
 * Retrieves metadata of a torrent.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
export async function getMetadata(req, res) {
  const { magnet } = req.query;
  // Array to store files metadata
  const files = [];

  try {
    const engine = createTorrentEngine(magnet);

    engine.on('ready', function () {


      // Iterate through files in torrent
      /* engine.files.forEach(function (file) {
        // Supported file extensions
        const extensions = [
          '.3gp', '.avi', '.flv', '.h264', '.m4v',
          '.mkv', '.mov', '.mp4', '.mpg', '.mpeg',
        ];

        // Check if file extension is supported
        extensions.forEach((ext) => {
          if (file.name.includes(ext)) {
            files.push({
              name: file.name,
              path: file.path,
              size: `${Math.round(file.length / 1000000)} mb`,
            });
          }
        });
      }); */

      // Efficient file type filtering
      const supportedExtensions = new Set([
        '.3gp', '.avi', '.flv', '.h264', '.m4v',
        '.mkv', '.mov', '.mp4', '.mpg', '.mpeg',
      ]);
      for (const file of engine.files) {
        const extension = path.extname(file.name).toLowerCase();
        if (supportedExtensions.has(extension)) {
          files.push({
            name: file.name,
            path: file.path,
            size: `${Math.round(file.length / 1000000)} mb`,
          });
        }
      }

      engine.destroy(() => { });

      res.send(files);
    });
  } catch (error) {
    console.log(error);
  }
}


/**
 * Handles streaming of torrent.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
export async function handleStreaming(req, res) {
  let { googleDriveFileLink, filePath, magnet } = req.query;

  // If the file is from Google Drive, download it
  if (googleDriveFileLink !== undefined && googleDriveFileLink.includes('https://drive.google.com/file')) {
    await downloadFromGoogleDrive(googleDriveFileLink, res);
  } else {
    console.log('\n> Adding torrent...');

    try {
      // Create torrent stream engine
      const engine = createTorrentEngine(magnet);

      // Event handler when torrent is ready
      engine.on('ready', function () {
        console.log('\n> Torrent is ready to serve');

        let totalProgress = 0;

        // Finding the target file in torrent
        console.log('\n> Finding your file...');
        const targetFile = engine.files.find((file) => {
          if (file.path === filePath) {
            file.select();
            console.log('\n> File found and Selected');
            console.log(
              '> ' +
              file.name +
              ' - ' +
              Math.round(file.length / 1000000) +
              ' MB',
            );
            return file;
          }
        });

        // If target file not found
        if (targetFile === undefined) {
          console.log('File not found');
          return res.status(404).send('\n> File not found!');
        }

        // Deselecting other files
        if (engine.files.length > 1) {
          console.log('\n> Deselecting other files...');
          engine.files.forEach((file) => {
            if (file.path !== filePath) {
              file.deselect();
            }
          });
        }

        // Setting headers for response
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', targetFile.length);
        res.setHeader(
          'Content-disposition',
          'attachment; filename=' + path.basename(targetFile.name),
        );

        const totoalFileSize = targetFile.length;

        // Creating read stream for target file
        console.log('\n> Creating ReadStream...');
        const stream = targetFile.createReadStream();
        let uploadBytes = 0;


        ffmpeg(stream)
          .format('flv')
          .audioCodec('aac')
          .videoCodec('libx264')
          .audioBitrate('128k')
          .videoBitrate('2000k') // 2000k
          .outputOptions('-threads 6')
          .output('rtmp://localhost/stream/hls_720')
          .on('start', (commandLine) => console.log('FFmpeg started:', commandLine))
          .on('error', (err) => console.error('Error:', err))
          .on('end', () => console.log('Stream ended'))
          .run();



        // Pipe stream to response
        // stream.pipe(res);

        // Handling stream events
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          res.end();
          engine.destroy();
        });

        // res.on('error', (error) => {
        //   console.error('Response error:', error);
        //   stream.destroy();
        //   engine.destroy();
        // });

        stream.on('end', () => {
          console.log('\n> Stream ended');
          res.end();
          engine.destroy();
        });

        // res.on('close', () => {
        //   console.log('\n> Response closed');
        //   engine.remove(false, () => { });
        //   engine.destroy();
        // });

        stream.on('data', (chunk) => {
          uploadBytes += chunk.length;
          let currentProgress = Math.round((uploadBytes / totoalFileSize) * 100);
          const mb = Math.round(uploadBytes / 1000000);
          if (currentProgress !== totalProgress) {
            console.log('\n> ' + currentProgress + '% ---> ' + mb + 'MB');
          }
          totalProgress = currentProgress;
        });

        engine.on('download', () => { });

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
}


/**
 * Searches for torrents based on the provided query.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
export async function searchTorrents(req, res) {
  let { query, audio } = req.query;

  const providers = [
    '1337x',
    'ThePirateBay',
    'KickassTorrents',
    'Limetorrents',
    'Torrent9',
    'TorrentProject',
    'Torrentz2',
    'Eztv',
    'Rarbg',
  ];

  let trs = [];
  const promises1 = providers.map(
    async (provider) => await searchForTorrents(query, provider, trs),
  );

  await Promise.all(promises1);
  // console.log(trs);

  let audibleTorrents = [];
  if (audio == 'true') {
    const magnetLinks = new Set();

    const promises2 = trs.map(async tr => {
      if (!magnetLinks.has(tr.magnet)) {
        magnetLinks.add(tr.magnet);
        return await checkIfAudible(tr);
      }
    });
    audibleTorrents = await Promise.all(promises2);
  }

  const finalTorrents = [];
  audibleTorrents.forEach(at => {
    if (at !== null || at !== undefined) finalTorrents.push(at);
  });

  // Return search results
  return res.json({
    found: finalTorrents.length > 0 || trs.length > 0,
    length: finalTorrents.length || trs.length,
    result: finalTorrents.length > 0 ? finalTorrents : trs,
  });
}


/**
 * Generates a short link for a given magnet URI.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
export async function generateShortLink(req, res) {
  const { magnet } = req.query;
  if (magnet == undefined) {
    return res.sendStatus(400).send('Magnet URI not found');
  }

  // Generating unique ID for short link
  const uid = crypto.randomUUID().substring(0, 8);
  await Queries.saveMagnet(uid, magnet);

  const shortLink = `${process.env.SERVER_URL}/short/` + uid;
  const qrcode = await QRCode.toDataURL(shortLink);

  // Send short link and corresponding QR code
  res.json({
    shortLink: shortLink,
    qrCode: qrcode,
  });
}


/**
 * Redirects to the metadata endpoint using the short link.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
export async function handleShortService(req, res) {
  const uid = req.params.uid;
  if (!uid) {
    return res.sendStatus(400).json({
      error: 'short link is invalid',
    });
  }

  const magnet = await Queries.retrieveMagnetUsingShortLink(uid);
  if (!magnet) {
    return res.sendStatus(404).json({
      error: 'please use a valid link, this does not exist in our system',
    });
  }

  const queryParams = { magnet: magnet };
  const redirectUrl = '/metadata?' + queryString.stringify(queryParams);
  res.redirect(301, redirectUrl);
}


/**
 * Retrieves the click statistics for a given short link.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
export async function handleShortStats(req, res) {
  const uid = req.params.uid;
  if (!uid) {
    return res.sendStatus(400).json({
      error: 'invalid short id',
    });
  }

  const clicks = await Queries.retrieveShortStats(uid);
  if (!clicks || clicks < 0) {
    return res.sendStatus(404).json({
      error: 'invalid short id, this does not exist in our system',
    });
  }

  // Return short link ID and total clicks
  res.json({
    shortId: uid,
    totalClicks: clicks,
  });
}
