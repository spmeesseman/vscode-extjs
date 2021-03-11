//@ts-check

'use strict';

const path = require('path');

/**
 * @type {import('webpack').Configuration}
 */
const config =
{   //
	// vscode extensions run in a Node.js-context -> https://webpack.js.org/configuration/node/
	//
	target: 'node',
	//
	// the entry point of this extension, -> https://webpack.js.org/configuration/entry-context/
	//
	entry: './client/src/extension.ts',
	output:
	{   //
		// the bundle is stored in the 'dist' folder (check package.json), -> https://webpack.js.org/configuration/output/
		//
		path: path.resolve(__dirname, 'dist', 'client'),
		filename: 'extension.js',
		libraryTarget: 'commonjs',
		devtoolModuleFilenameTemplate: '../[resource-path]'
	},
	devtool: 'source-map',
	externals:
	{   //
		// the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot
		// be webpack'ed, -> https://webpack.js.org/configuration/externals/
		//
		vscode: 'commonjs vscode',
		json5: 'json5'
	},
	resolve:
	{   //
		// support reading TypeScript and JavaScript files, -> https://github.com/TypeStrong/ts-loader
		//
		extensions: ['.ts', '.js']
	},
	module: {
		rules: [{
			test: /\.ts$/,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader'
			}]
		}]
	}
};
module.exports = config;