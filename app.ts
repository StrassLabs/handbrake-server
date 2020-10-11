import * as config from 'config';
import * as upath from 'upath';
import * as chokidar from 'chokidar';
import { file as createTempFile } from 'tmp-promise';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';

const hbjs = require('handbrake-js');



// parse file paths

async function writeJobSettingsToTempFile(queueExportJob: Object): Promise<string> {

  const tempFileOptions = {
    prefix: 'hbjob-', // Temp file name prefix
    postfix: '.json', // Temp file extension
  };

  const { path: tempFilePath } = await createTempFile(tempFileOptions);
  console.info('tempFilePath', tempFilePath);

  await fs.writeFile(tempFilePath, JSON.stringify(queueExportJob));

  return tempFilePath;
}

async function loadQueueExport(queueExportFile: string): Promise<Object> {
  let encodeSettings: Object;

  let queueExport: Array<Object> = require(queueExportFile);

  // console.log(queueExport[0]);
  // todo: modify job settings here

  const tempJobSettingsFile = await writeJobSettingsToTempFile(queueExport[0]);

  console.info('tempJobSettingsFile', tempJobSettingsFile);

  encodeSettings = {
    // input: './media/test_video_01.mp4',
    // output: './media/converted/test_video_01.mkv',
    'queue-import-file': tempJobSettingsFile,
  };

  return encodeSettings;
}

async function main() {

  let queueExportFile = './jobs/win_cli_test_video_02.json';

  console.log('loading configuration');

  const encodeSettings = await loadQueueExport(queueExportFile);

  console.log('starting encode');

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

}

main();
