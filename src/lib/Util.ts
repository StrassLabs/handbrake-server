import config from 'config';
import _ from 'lodash';
import upath from 'upath';
import { promises as fs } from 'fs';
import { file as createTempFile } from 'tmp-promise';
import * as LosslessJSON from 'lossless-json';

import { JobConfig } from '../entities/EncodeJob';
import { PathMapping } from '../entities/AppConfig';


export function mapFilePath(remotePath: string): string {
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

export function normalizeFilePath(originalPath: string): string {

  let fixedPath = upath.normalizeSafe(originalPath);

  let mappedPath = mapFilePath(fixedPath);

  return mappedPath;
}

export async function writeJobSettingsToTempFile(queueExportJobs: JobConfig[]): Promise<string[]> {

  const tempFileOptions = {
    prefix: 'hbjob-', // Temp file name prefix
    postfix: '.json', // Temp file extension
  };

  let tempFilePaths: string[] = [];
  for await (const queueExportJob of queueExportJobs) {
    const { path: tempFilePath } = await createTempFile(tempFileOptions);
    console.info('tempFilePath', tempFilePath);
    await fs.writeFile(tempFilePath, LosslessJSON.stringify(queueExportJob));

    tempFilePaths.push(tempFilePath);
  }

  return tempFilePaths;
}

export function parseJobSettings(jobSettings: JobConfig[]): JobConfig[] {
  // todo: data 'tegridy checking

  let outJobSettings: JobConfig[] = [];

  jobSettings.forEach((config: JobConfig) => {
    let originalSourcePath: string = config.Job.Source.Path;
    let originalDestinationPath: string = config.Job.Destination.File;
  
    console.info('originalSourcePath', originalSourcePath);
    console.info('originalDestinationPath', originalDestinationPath);
  
    let normalSourcePath = normalizeFilePath(originalSourcePath);
    let normalDestinationPath = normalizeFilePath(originalDestinationPath);
  
    console.info('normalSourcePath', normalSourcePath);
    console.info('normalDestinationPath', normalDestinationPath);
  
    config.Job.Source.Path = normalSourcePath;
    config.Job.Destination.File = normalDestinationPath;

    outJobSettings.push(config)
  });

  return outJobSettings;
}

export async function loadJobFile(queueExportFile: string): Promise<string[]> {

  let rawFile: string = await (await fs.readFile(queueExportFile)).toString();

  let queueExport: JobConfig[] = LosslessJSON.parse(rawFile);

  const parsedJobSettings = parseJobSettings(queueExport);

  const tempJobSettingsFiles = await writeJobSettingsToTempFile(parsedJobSettings);

  console.info('tempJobSettingsFiles', tempJobSettingsFiles);

  return tempJobSettingsFiles;
}
