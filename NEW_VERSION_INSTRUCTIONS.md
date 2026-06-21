## to debug and install local build
 - in package.json increment last number of "version": "0.0.1-dev.6", the last version of local build is saved in key "_last_dev_versioning_for_cache", we must increment the version of the local build otherwise the cache mechanism of vscode won't reflect the changes done in last build

  - run : `pnpm build` and install manually file pr-status-monitor-0.0.1-dev.XX.vsix

  - when the code is ready to de deployed to the microsoft marketplace run:
    - update the followings fields in package.json : "version", "_last_dev_versioning_for_cache"
    - update in README. md [![Version](https://img.shields.io/badge/version-0.0.11-brightgreen.svg)]() with correct version number
    - `publish:login` if I'm not yet logged in
    - `publish`