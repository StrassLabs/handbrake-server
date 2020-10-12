import config from 'config';
import _ from 'lodash';
import upath from 'upath';
import chokidar from 'chokidar';
import { file as createTempFile } from 'tmp-promise';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';

const hbjs = require('handbrake-js');

// interface EncodeJobConfig

interface PathMapping {
  remote: string;
  local: string;
}


function mapFilePath(remotePath: string): string {
  const mappings: PathMapping[] = config.get('pathMappings');

  const mappingMatch = <PathMapping>_.find(mappings, (mapping) => {
    if (_.startsWith(remotePath, mapping.remote)) {
      return mapping;
    }
  });

  if (mappingMatch) {
    let localPath: string;

    localPath = _.replace(remotePath, mappingMatch.remote, mappingMatch.local);

    return localPath;
  }

  return remotePath;
}

function normalizeFilePath(originalPath: string): string {

  let fixedPath = upath.normalizeSafe(originalPath);
  console.info('fixedPath', fixedPath);

  let mappedPath = mapFilePath(fixedPath);
  console.info('mappedPath', mappedPath);

  return mappedPath;
}

async function writeJobSettingsToTempFile(queueExportJob: object): Promise<string> {

  const tempFileOptions = {
    prefix: 'hbjob-', // Temp file name prefix
    postfix: '.json', // Temp file extension
  };

  const { path: tempFilePath } = await createTempFile(tempFileOptions);
  console.info('tempFilePath', tempFilePath);

  await fs.writeFile(tempFilePath, JSON.stringify(queueExportJob));

  return tempFilePath;
}

function parseJobSettings(jobSettings: object): object {
  // todo: data 'tegridy checking

  let originalSourcePath: string = _.get(jobSettings, 'Job.Source.Path');
  let originalDestinationPath: string = _.get(jobSettings, 'Job.Destination.File');

  console.info('originalSourcePath', originalSourcePath);
  console.info('originalDestinationPath', originalDestinationPath);

  let normalSourcePath = normalizeFilePath(originalSourcePath);
  let normalDestinationPath = normalizeFilePath(originalDestinationPath);

  console.info('normalSourcePath', normalSourcePath);
  console.info('normalDestinationPath', normalDestinationPath);

  return jobSettings;
}

async function loadQueueExport(queueExportFile: string): Promise<object> {
  let encodeSettings: object;

  let queueExport: Array<object> = require(queueExportFile);

  // console.log(queueExport[0]);
  // todo: modify job settings here
  const parsedJobSettings = parseJobSettings(queueExport[0]);

  const tempJobSettingsFile = await writeJobSettingsToTempFile(parsedJobSettings);

  console.info('tempJobSettingsFile', tempJobSettingsFile);

  encodeSettings = {
    // input: './media/test_video_01.mp4',
    // output: './media/converted/test_video_01.mkv',
    'queue-import-file': tempJobSettingsFile,
  };

  return encodeSettings;
}

async function startEncode(encodeSettings: object): Promise<EventEmitter> {

  const encJob = hbjs.spawn(encodeSettings);

  encJob.on('error', (err: Error) => {
    // invalid user input, no video found etc
    console.error('[Error] %s', err);
  });

  return encJob;
}

async function main() {

  // let queueExportFile = './jobs/win_cli_test_video_02.json';
  let queueExportFile = './jobs/windows_queue_export_cli.json';

  console.log('loading configuration');

  const encodeSettings = await loadQueueExport(queueExportFile);

  // console.log('starting encode');

  // const jerb = await startEncode(encodeSettings);

  // jerb.on('progress', (progress: any) => {
  //   console.log(
  //     'Percent complete: %s, ETA: %s',
  //     progress.percentComplete,
  //     progress.eta
  //   );
  // });
}

main();
