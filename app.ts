import { file } from 'tmp-promise';
import * as config from 'config';
import * as upath from 'upath';
import * as chokidar from 'chokidar';

const hbjs = require('handbrake-js');


console.log('loading configuration');

let queueExportFile = './jobs/win_cli_test_video_02.json';

let queueExport: Array<Object> = require(queueExportFile);
console.log(queueExport[0]);


console.log('starting encode');

const encodeSettings = {
  // input: 'media/test_video_01.mp4',
  // output: 'media/test_video_01_conv.mkv',
  'queue-import-file': queueExportFile,
};

const jerb = hbjs.spawn(encodeSettings);

jerb.on('error', (err: Error) => {
  // invalid user input, no video found etc
  console.error('[Error] %s', err);
});

jerb.on('progress', (progress: any) => {
  console.log(
    'Percent complete: %s, ETA: %s',
    progress.percentComplete,
    progress.eta
  );
});
