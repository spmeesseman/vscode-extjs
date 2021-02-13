
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import registerEnsureRequireCommand from './commands/EnsureRequireCommand';
import { registerProviders } from './providers/ProviderManager';
import ExtjsLanguageManager from './common/ExtjsLanguageManager';
import ServerRequest from './common/ServerRequest';


let client: LanguageClient;


export async function activate(context: vscode.ExtensionContext)
{
	console.log('Congratulations, your extension "vscode-extjs" is now active!');

	registerProviders(context);
	await run(context);

	const serverRequest = new ServerRequest(client);
	const extjsLanguageManager = new ExtjsLanguageManager(serverRequest);
	extjsLanguageManager.setup(context);

	registerEnsureRequireCommand(context, serverRequest);
}


async function run(context: vscode.ExtensionContext)
{
	//
	// The server is implemented in node
	//
	let serverModule = context.asAbsolutePath( 
		path.join('dist', 'server.js')
	);
	//
	// The debug options for the server:
	//
	//     --inspect=6009
	//
	// Runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	//
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	//
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	//
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	//
	// Options to control the language client
	//
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'javascript' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			// fileEvents: vscode.workspace.createFileSystemWatcher('**/*.js'),
		}
	};

	//
	// Create the language client and start the client.
	//
	client = new LanguageClient(
		'vscode-extjs',
		'vscode extjs Language Server',
		serverOptions,
		clientOptions
	);

	client.start();

	await client.onReady();
	return client;
}


export function deactivate(): Thenable<void> | undefined
{
	if (!client) {
		return undefined;
	}
	return client.stop();
}
