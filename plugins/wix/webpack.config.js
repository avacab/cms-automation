const path = require('path');

module.exports = {
  entry: {
    'ai-writing-assistant': './public/ai-writing-assistant.js',
    'setup-page': './public/setup-page.js',
    'content-enhancer': './public/content-enhancer.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    library: {
      type: 'module'
    }
  },
  experiments: {
    outputModule: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  },
  externals: {
    'wix-data': 'wix-data',
    'wix-location': 'wix-location', 
    'wix-storage': 'wix-storage',
    'wix-window': 'wix-window'
  },
  mode: process.env.NODE_ENV || 'development',
  devtool: 'source-map'
};