
import * as fs from "fs";
import json5 from "json5";
import * as path from "path";
import * as vscode from "vscode";
import ServerRequest, { toVscodeRange } from "./common/ServerRequest";
import { IConfig, IExtjsComponent, IMethod, IConf } from "./common/interface";
import { configuration } from "./common/configuration";
import * as util from "./common/utils";


const diagnosticCollection = vscode.languages.createDiagnosticCollection("extjs-lint");
const conf: IConf = {
    extjsDir: "",
    extjsBase: "",
    workspaceRoot: "",
};

export const widgetToComponentClassMapping: { [widget: string]: string | undefined } = {};
export const configToComponentClassMapping: { [property: string]: string | undefined } = {};
export const methodToComponentClassMapping: { [method: string]: string | undefined } = {};

const componentClassToWidgetsMapping: { [componentClass: string]: string[] | undefined } = {};
const componentClassToRequiresMapping: { [componentClass: string]: string[] | undefined } = {};
const componentClassToFsPathMapping: { [componentClass: string]: string | undefined } = {};
const componentClassToConfigsMapping: { [componentClass: string]: IConfig[] | undefined } = {};
const componentClassToMethodsMapping: { [componentClass: string]: IMethod[] | undefined } = {};


class ExtjsLanguageManager
{
    private serverRequest: ServerRequest;
    private reIndexTaskId: NodeJS.Timeout | undefined;


    constructor(serverRequest: ServerRequest)
    {
        this.serverRequest = serverRequest;
    }


    async indexing(fsPath: string, text: string)
    {
        const components = await this.serverRequest.parseExtJsFile(text);

        await util.forEachAsync(components, (cmp: IExtjsComponent) =>
        {
            const { componentClass, requires, widgets, methods, configs } = cmp;
            componentClassToFsPathMapping[componentClass] = fsPath;
            componentClassToWidgetsMapping[componentClass] = widgets;
            componentClassToMethodsMapping[componentClass] = methods;
            componentClassToConfigsMapping[componentClass] = configs;

            widgets.forEach(xtype => {
                widgetToComponentClassMapping[xtype] = componentClass;
            });

            methods.forEach(method => {
                methodToComponentClassMapping[method.name] = componentClass;
            });

            configs.forEach(config => {
                configToComponentClassMapping[config.name] = componentClass;
            });

            if (requires) {
                componentClassToRequiresMapping[componentClass] = requires.value;
            }
        });
    }


    async validateDocument(textDocument: vscode.TextDocument): Promise<void>
    {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = textDocument.getText();
        const components = await this.serverRequest.parseExtJsFile(text);

        components?.forEach(cmp =>
        {
            const { componentClass, xtypes } = cmp;
            const requiredXtypes = getRequiredXtypes(componentClass) || [];

            function validateXtype(xtype: string, range: vscode.Range)
            {
                if (!requiredXtypes.includes(xtype))
                {
                    // problems++;
                    const diagnostic: vscode.Diagnostic = {
                        severity: vscode.DiagnosticSeverity.Error,
                        range,
                        message: `xtype "${xtype}" not found.`,
                        source: "vscode-ext-js"
                    };
                    diagnostics.push(diagnostic);
                }
            }

            for (const xtype of xtypes) {
                validateXtype(xtype.value, toVscodeRange(xtype.start, xtype.end));
            }
        });

        diagnosticCollection.set(textDocument.uri, diagnostics);
    }


    private async indexingAll(progress?: vscode.Progress<any>)
    {
        let dirs: string[] = [],
            numFiles = 0,
            currentFileIdx = 0;

        util.log("start indexing", 1);

        if (typeof conf.extjsDir === "string")
        {
            dirs = [ conf.extjsDir ];
        }
        else {
            dirs = conf.extjsDir;
        }

        //
        // Status bar
        //
        // const statusBarSpace = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -10000);
        // statusBarSpace.tooltip = "ExtJs Language Server is building the syntax tree";
        // statusBarSpace.text = getStatusString(0);
        // statusBarSpace.show();

        for (const dir of dirs)
        {
            const uris = await vscode.workspace.findFiles(`${dir}/**/*.js`);
            numFiles += uris.length;
        }

        const increment = Math.round(1 / numFiles * 100);

        util.logValue("   # of files to index", numFiles, 1);

        for (const dir of dirs)
        {
            const uris = await vscode.workspace.findFiles(`${dir}/**/*.js`);
            for (const uri of uris)
            {
                util.logValue("      Indexing file", uri.fsPath, 1);
                const text = (await vscode.workspace.fs.readFile(uri)).toString();
                await this.indexing(uri.fsPath, text);
                const pct = Math.round(++currentFileIdx / numFiles * 100);
                progress?.report({
                    increment,
                    message: pct + "%"
                });
                // statusBarSpace.text = getStatusString(pct);
            }
        }
    }


    private async indexingAllWithProgress()
    {
        await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            cancellable: false,
            title: "Indexing ExtJs Files"
        },
        async (progress) =>
        {
            await this.indexingAll(progress);
        });
    }


    async setup(context: vscode.ExtensionContext): Promise<vscode.Disposable[]>
    {
        //await this.serverRequest.onSettingsChange();
        await initConfig();
        setTimeout(async () =>
        {
            await this.indexingAllWithProgress();
            //
            // Validate active js document if there is one
            //
            const activeTextDocument = vscode.window.activeTextEditor?.document;
            if (activeTextDocument && activeTextDocument.languageId === "javascript") {
                await this.validateDocument(activeTextDocument);
            }
        }, 100);
        return this.registerWatchers(context);
    }


    registerWatchers(context: vscode.ExtensionContext): vscode.Disposable[]
    {
        //
        // rc/conf file
        //
        const disposables: vscode.Disposable[] = [];
        const confWatcher = vscode.workspace.createFileSystemWatcher(".extjsrc{.json,}");
        context.subscriptions.push(confWatcher);
        confWatcher.onDidChange(initConfig);

        //
        // Open dcument text change
        //
        disposables.push(vscode.workspace.onDidChangeTextDocument(async (event) =>
        {
            const textDocument = event.document;
            if (textDocument.languageId === "javascript")
            {   //
                // Debounce!!
                //
                if (this.reIndexTaskId) {
                    clearTimeout(this.reIndexTaskId);
                }
                this.reIndexTaskId = setTimeout(async () => {
                    this.reIndexTaskId = undefined;
                    const fsPath = textDocument.uri.fsPath;
                    handleDeleFile(fsPath);
                    await this.indexing(textDocument.uri.fsPath, textDocument.getText());
                    await this.validateDocument(textDocument);
                }, 1000);
            }
        }, context.subscriptions));

        //
        // Deletions
        //
        disposables.push(vscode.workspace.onDidDeleteFiles(async (event) =>
        {
            event.files.forEach(async file =>
            {
                handleDeleFile(file.fsPath);
                const activeTextDocument = vscode.window.activeTextEditor?.document;
                if (activeTextDocument && activeTextDocument.languageId === "javascript") {
                    await this.validateDocument(activeTextDocument);
                }
            });
        }, context.subscriptions));

        //
        // Active editor changed
        //
        disposables.push(vscode.window.onDidChangeActiveTextEditor(async (e: vscode.TextEditor | undefined) =>
        {
            const textDocument = e?.document;
            if (textDocument) {
                if (textDocument.languageId === "javascript") {
                    await this.validateDocument(textDocument);
                }
            }
        }, context.subscriptions));

        //
        // Open text document
        //
        disposables.push(vscode.workspace.onDidOpenTextDocument(async (textDocument: vscode.TextDocument) =>
        {
            if (textDocument.languageId === "javascript") {
                await this.validateDocument(textDocument);
            }
        }, context.subscriptions));

        //
        // Register configurations/settings change watcher
        //
        disposables.push(vscode.workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration("extjsLangSvr.include")) {
                //
                // TODO
                //
                util.log("Process settings change 'include'", 1);
                // await this.serverRequest.onSettingsChange();
            }
        }, context.subscriptions));

        return disposables;
    }

}


function getStatusString(pct: number)
{
    return "$(loading~spin) Indexing ExtJs Files " + (pct ?? "0") + "%";
}


async function initConfig()
{
    const settingsUris = configuration.get<string[]>("include");
    const confUris = await vscode.workspace.findFiles(".extjsrc{.json,}");
    if (confUris)
    {
        for (const uri of confUris) {
            const fileSystemPath = uri.fsPath || uri.path;
            const confJson = fs.readFileSync(fileSystemPath, "utf8");
            const _conf = json5.parse(confJson);
            Object.assign(conf, _conf);
        }
    }
}


export function getCmpClassFromPath(fsPath: string)
{
    const wsf = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(fsPath));

    util.log("get component by fs path", 1);
    util.logValue("   path", fsPath, 2);

    if (wsf) {
        if (conf.workspaceRoot === "") {
            conf.workspaceRoot = wsf.uri.fsPath;
        }
        fsPath = fsPath.replace(wsf.uri.fsPath, "");
    }

    fsPath = fsPath.replace(new RegExp(`^${path.sep}*${conf.extjsDir}${path.sep}*`), "");
    fsPath = fsPath.replace(/\..+$/, "");
    const cmpClass = conf.extjsBase + "." + fsPath.split(path.sep).join(".");

    util.logValue("   component class", cmpClass, 2);
    return cmpClass;
}


function getXtypes(cmp: string, log = true, logPad = "")
{
    const xTypes = componentClassToWidgetsMapping[cmp];
    if (log) {
        util.log(logPad + "get xtypes by component class", 1);
        util.logValue(logPad + "   component class", cmp, 2);
        util.logValue(logPad + "   # of xtypes", xTypes?.length, 2);
    }
    return xTypes;
}


function getRequiredXtypes(cmp: string)
{
    const requires = []; // Object.keys(componentClassToWidgetsMapping).filter(it => util.isNeedRequire(it));
    util.log("get required xtypes by component class", 1);
    util.logValue("   component class", cmp, 2);
    requires.push(...(componentClassToRequiresMapping[cmp] || []));
    const reqXTypes = requires.reduce<string[]>((previousValue, currentCmpClass) => {
        previousValue.push(...(getXtypes(currentCmpClass, false) || []));
        return previousValue;
    }, []);
    util.logValue("   # of required xtypes", reqXTypes.length, 2);
    reqXTypes.forEach((x) => {
        util.log("      " + x);
    });
    util.log("completed get required xtypes by component class", 1);
    return reqXTypes;
}


export function getFilePath(componentClass: string)
{
    const fsPath = componentClassToFsPathMapping[componentClass];
    util.log("get fs path by component", 1);
    util.logValue("   path", fsPath, 2);
    return fsPath;
}


export function getComponentClass(widget: string)
{
    const cmpClass = widgetToComponentClassMapping[widget];
    util.log("get component class by widget", 1);
    util.logValue("   path", widget, 2);
    return cmpClass;
}


export function getComponentByConfig(property: string)
{
    const cmpClass = configToComponentClassMapping[property];
    util.log("get component class by config", 1);
    util.logValue("   path", property, 2);
    return cmpClass;
}


export function getConfigByComponent(cmp: string, property: string): IConfig | undefined
{
    const configs = componentClassToConfigsMapping[cmp];
    util.log("get config by component class", 1);
    util.logValue("   component class", cmp, 2);
    util.logValue("   property", property, 2);
    if (configs) {
        for (let c = 0; c < configs.length; c++) {
            if (configs[c].name === property) {
                util.log("   found config", 3);
                util.logValue("      name", configs[c].name, 4);
                util.logValue("      start", configs[c].start, 4);
                util.logValue("      end", configs[c].end, 4);
                return configs[c];
            }
        }
    }
    return undefined;
}


export function getMethodByComponent(cmp: string, property: string): IConfig | undefined
{
    const methods = componentClassToMethodsMapping[cmp];
    util.log("get config by method", 1);
    util.logValue("   component class", cmp, 2);
    util.logValue("   property", property, 2);
    if (methods)
    {
        for (let c = 0; c < methods.length; c++)
        {
            if (methods[c].name === property) {
                util.log("   found method", 3);
                util.logValue("      name", methods[c].name, 4);
                util.logValue("      start", methods[c].start, 4);
                util.logValue("      end", methods[c].end, 4);
                return methods[c];
            }
        }
    }
    return undefined;
}


function handleDeleFile(fsPath: string)
{
    const componentClass = getCmpClassFromPath(fsPath);
    if (componentClass)
    {
        util.log("handle file depetion", 1);
        util.logValue("   path", fsPath, 2);
        util.logValue("   component class", componentClass, 2);
        getXtypes(componentClass)?.forEach(xtype => {
            delete widgetToComponentClassMapping[xtype];
        });
        delete componentClassToWidgetsMapping[componentClass];
        delete componentClassToFsPathMapping[componentClass];
        delete componentClassToRequiresMapping[componentClass];
        delete componentClassToConfigsMapping[componentClass];
    }
}


export default ExtjsLanguageManager;
