import path from 'path';
import process from 'process';
import torrentStream from 'torrent-stream';
import TorrentSearchApi from 'torrent-search-api';

/**
 * Filters out audiobooks from a list of torrents.
 * @param {Array} torrents - List of torrents to filter.
 * @returns {Promise<Array>} - Filtered list of torrents.
 */
export async function filterAudiobooks(torrents) {
  const promises = torrents.map(
    async (torrent) => await checkIfAudible(torrent.magnet),
  );

  try {
    const result = await Promise.all(promises);
    return result;
  } catch (error) {
    console.error('Error while filtering audiobooks:', error);
  }
}

/**
 * Checks if a torrent contains audio files.
 * @param {object} torrent - The torrent object.
 * @returns {Promise<object>} - Promise resolving to the torrent object if it contains audio files.
 */
export async function checkIfAudible(torrent) {
  return new Promise((resolve, reject) => {
    let audible = false;

    try {
      const engine = torrentStream(torrent.magnet, {
        tmp: path.join(process.cwd(), '/tmp'),
        path: path.join(process.cwd(), '/tmp'),
      });

      engine.on('ready', function () {
        engine.files.forEach(function (file) {
          const extensions = [
            '.mp3',
            '.aac',
            '.mpeg',
            '.wav',
            '.m4a',
            '.flac',
            '.wma',
          ];

          extensions.forEach((ext) => {
            if (file.name.includes(ext)) {
              audible = true;
            }
          });
        });

        engine.destroy(() => { });
        if (audible) resolve(torrent);
      });
    } catch (error) {
      console.log('Failed to get metadata: ', error);
      reject(error);
    }
  });
}

/**
 * Searches for torrents using the specified provider and adds them to the given array.
 * @param {string} query - The search query.
 * @param {string} provider - The name of the torrent provider to search from.
 * @param {Array} trs - Array to store found torrents.
 */
export async function searchForTorrents(query, provider, trs) {
  try {
    if (trs.length < 3) {
      TorrentSearchApi.enableProvider(provider);
      const torrents = await TorrentSearchApi.search(query, '', 3);

      torrents.forEach((torrent) => {
        if ('magnet' in torrent) {
          if (torrent.numFiles !== 0 && torrent.id !== 0) {
            torrent['provider'] = 'public providers';
            trs.push(torrent);
          }
        }
      });
    }
  } catch (error) {
    console.error(
      `Error searching torrents from ${provider}. Potentially your IP may be blocked`,
    );
    // handle the error, e.g., return an error response
  }
  TorrentSearchApi.disableProvider(provider);
}
