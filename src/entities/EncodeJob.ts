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

export interface JobConfig {
  Job: JobConfigItem;
}
