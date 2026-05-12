const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDev ? 'development' : 'production',
  output: {
    path: join(__dirname, '../../dist/apps/klenzo'),
    clean: true,
    ...(isDev && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  // In development, webpack watches for file changes and rebuilds automatically.
  // @nx/js:node then restarts the Node process after each rebuild.
  watch: isDev,
  watchOptions: {
    // Ignore node_modules and dist to avoid infinite rebuild loops
    ignored: /node_modules|dist/,
    // Small debounce so rapid saves don't trigger multiple rebuilds
    aggregateTimeout: 300,
    poll: 1000, // use polling — required inside Docker volumes on Windows/macOS hosts
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: 'apps/klenzo/src/main.ts',
      tsConfig: 'apps/klenzo/tsconfig.app.json',
      assets: ['apps/klenzo/src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
