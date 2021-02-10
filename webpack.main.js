const CopyPlugin = require('copy-webpack-plugin');

let devtool = 'source-map';
if (process.env.NODE_ENV === 'production') {
    devtool = undefined;
}

module.exports = {
    mode: 'development',
    devtool: devtool,
    entry: {
        main: ['./src/main/main.ts', './src/main/ipc.ts']
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'icons/*' },
            ]
        })
    ],
    module: {
        rules: [
            {
                test: /\.node$/,
                use: 'node-loader',
            },
            {
                test: /\.ts$/,
                exclude: /(node_modules|\.webpack)/,
                use: {
                    loader: 'ts-loader',
                }
            },
        ],
    },
    resolve: {
        extensions: ['.js', '.ts']
    },
    target: 'electron-main',
};
