//@ts-check

'use strict';

const path = require('path');
const exec = require('child_process').exec;

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
	entry: './common/src/index.ts', 
	output:
	{   //
		// the bundle is stored in the 'dist' folder (check package.json), -> https://webpack.js.org/configuration/output/
		//
		path: path.resolve(__dirname, 'dist'),
		filename: 'index.js',
		devtoolModuleFilenameTemplate: '../[resource-path]',
		library: 'common',
		libraryTarget: 'umd', // 'commonjs2'
		umdNamedDefine: true
	},
	devtool: 'source-map',
	externals:
	{   //
		// the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot
		// be webpack'ed, -> https://webpack.js.org/configuration/externals/
		//
		vscode: 'commonjs vscode' 
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
	},
	plugins: [ //
	{         // Can't get webpack to build and touch the individual js files in ./lib, these
	         // sre referenced when running in dev mode.  Run tsc to update these files afer actions
			// webpack build
		   //
		apply: (compiler) => {
			compiler.hooks.afterEmit.tap('AfterEmitPlugin', (compilation) => {
				exec('tsc -b ./common', (err, stdout, stderr) => {
				if (stdout) process.stdout.write(stdout);
				if (stderr) process.stderr.write(stderr);
				});
			});
		}
	}]
};
module.exports = config;