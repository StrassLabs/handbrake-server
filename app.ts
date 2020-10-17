import config from 'config';
import _ from 'lodash';
import upath from 'upath';
import chokidar from 'chokidar';
import * as LosslessJSON from 'lossless-json';
import { file as createTempFile } from 'tmp-promise';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';

const hbjs = require('handbrake-js');


interface EncodeSource {
  Path: string;
}

interface EncodeDestination {
  File: string;
}

interface EncodeVideoOptions {
  Encoder: string;
}

interface JobConfigItem {
  Source: EncodeSource;
  Destination: EncodeDestination;
  Video: EncodeVideoOptions;
}

interface JobConfig {
  Job: JobConfigItem;
}

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

  let mappedPath = mapFilePath(fixedPath);

  return mappedPath;
}

async function writeJobSettingsToTempFile(queueExportJob: JobConfig): Promise<string> {

  const tempFileOptions = {
    prefix: 'hbjob-', // Temp file name prefix
    postfix: '.json', // Temp file extension
  };

  const { path: tempFilePath } = await createTempFile(tempFileOptions);
  console.info('tempFilePath', tempFilePath);

  await fs.writeFile(tempFilePath, LosslessJSON.stringify(queueExportJob));

  return tempFilePath;
}

function parseJobSettings(jobSettings: JobConfig): JobConfig {
  // todo: data 'tegridy checking

  let originalSourcePath: string = jobSettings.Job.Source.Path;
  let originalDestinationPath: string = jobSettings.Job.Destination.File;

  console.info('originalSourcePath', originalSourcePath);
  console.info('originalDestinationPath', originalDestinationPath);

  let normalSourcePath = normalizeFilePath(originalSourcePath);
  let normalDestinationPath = normalizeFilePath(originalDestinationPath);

  console.info('normalSourcePath', normalSourcePath);
  console.info('normalDestinationPath', normalDestinationPath);

  jobSettings.Job.Source.Path = normalSourcePath;
  jobSettings.Job.Destination.File = normalDestinationPath;

  return jobSettings;
}

async function loadQueueExport(queueExportFile: string): Promise<object> {
  let encodeSettings: object;

  let rawFile: string = await (await fs.readFile(queueExportFile)).toString();

  let queueExport: JobConfig[] = LosslessJSON.parse(rawFile);

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

async function handleNewJobFile(jobFilePath: string) {

  console.log('loading configuration');

  const encodeSettings = await loadQueueExport(jobFilePath);

  console.log('starting encode');

  const jerb = await startEncode(encodeSettings);

  jerb.on('progress', (progress: any) => {
    console.log(
      'Percent complete: %s, FPS: %s, ETA: %s',
      progress.percentComplete,
      progress.avgFps,
      progress.eta,
    );
  });
}

function getJobDirGlob(): string {
  const jobDir: string = config.get('jobDirectory');
  const jobFileExt: string = config.get('jobFileExtension');

  const watcherGlob: string = upath.joinSafe(jobDir, jobFileExt);

  return watcherGlob;
}


async function main() {
  const jobFileWatcher = chokidar.watch(getJobDirGlob(), {
    persistent: true,
  });

  jobFileWatcher.on('add', (path, stats) => {

    const notDumbPath = upath.normalizeSafe('./' + path);

    console.info('new item found:', stats, notDumbPath);

    handleNewJobFile(notDumbPath);
  });
}

main();
