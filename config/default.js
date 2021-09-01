const config = {
  jobDirectory: './jobs',
  jobFileExtension: '*.json',
  progressUpdateDelay: 1000,
  maxConcurrentJobsInQueue: 1,
  pathMappings: [
    // {
    //   remote: 'Z:',
    //   local: '/Volumes/downloads',
    // },
  ],
};

module.exports = config;
