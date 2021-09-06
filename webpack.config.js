const path = require('path');
const glob = require('glob');
const TerserPlugin = require("terser-webpack-plugin");

const sources_files = glob.sync('./src/sources/**.ts').reduce(function(obj, el){
    obj[path.parse(el).name] = el;
    return obj
 },{});

 console.log({
    'main': './src/index.ts',
    ...sources_files
});

module.exports = {
    entry: {
        'main': './src/index.ts',
        ...sources_files
    },
    mode: 'production',
    module: {
        rules: [
          {
            test: /\.ts?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    target: 'node',
    output: {
        clean: true,
        filename: (pathData) => {
            return pathData.chunk.name === 'main' ? 'bundle.js' : 'sources/[name].js';
        },
        path: path.resolve(__dirname, 'dist'),
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        comments: false,
                    },
                },
                extractComments: false,
            }),
        ],
    },
};