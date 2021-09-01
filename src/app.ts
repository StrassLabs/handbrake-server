import config from 'config';
import _ from 'lodash';
import upath from 'upath';
import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import { EventEmitter } from 'events';

import { JobConfig } from './entities/EncodeJob';

import {
  mapFilePath,
  normalizeFilePath,
  writeJobSettingsToTempFile,
  parseJobSettings,
  loadJobFile,
} from './lib/Util';

const hbjs = require('handbrake-js');


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

  const loadedJobFiles = await loadJobFile(jobFilePath);

  const maxConcurrentJerbs: number = config.get('maxConcurrentJobsInQueue');
  let inProgressJerbs = 0;
  for await (const loadedJobFile of loadedJobFiles) {
    let encodeSettings: object = {
      // input: './media/test_video_01.mp4',
      // output: './media/converted/test_video_01.mkv',
      'queue-import-file': loadedJobFile,
    };
    
    inProgressJerbs++;
    const jerb = await startEncode(encodeSettings);
  
    jerb.on('start', () => {
      console.info('start');
    });
  
    jerb.on('begin', () => {
      console.info('begin');
    });
  
    const progressUpdateDelay: number = config.get('progressUpdateDelay');
  
    jerb.on('progress', _.throttle((progress: any) => {
  
      console.info(
        '[%s] Percent complete: %s, FPS: %s, ETA: %s',
        progress.taskNumber,
        progress.percentComplete,
        progress.avgFps,
        progress.eta,
      );
    }, progressUpdateDelay));
  
    jerb.on('end', () => {
      console.info('end');
    });

    jerb.on('complete', () => {
      console.info('complete');
      inProgressJerbs--;
    });
  
    jerb.on('cancelled', () => {
      console.info('cancelled');
      inProgressJerbs--;
    });

    while (inProgressJerbs >= maxConcurrentJerbs) {
      await new Promise(r => setTimeout(r, 1000));
    }

  }
  
  while (inProgressJerbs > 0) {
    await new Promise(r => setTimeout(r, 1000));
  }
}

function moveCompletedJobFile(jobFilePath: string) {
  const completeJobFilePath = upath.joinSafe(
    upath.dirname(jobFilePath) + '/complete',
    upath.basename(jobFilePath),
  );

  fs.rename(
    jobFilePath,
    completeJobFilePath,
  );
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

  jobFileWatcher.on('add', async (path, stats) => {

    const notDumbPath = upath.normalizeSafe(path);

    console.info('new item found:', stats, notDumbPath);

    await handleNewJobFile(notDumbPath);

    moveCompletedJobFile(notDumbPath);
  });

  console.log('watching for new job files :)');
}

main();
