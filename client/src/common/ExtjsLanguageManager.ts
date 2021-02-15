
import * as fs from "fs";
import json5 from "json5";
import * as path from "path";
import * as vscode from "vscode";
import { isNeedRequire } from "./Utils";
import ServerRequest, { toVscodeRange } from "./ServerRequest";
import { IConfig, IMethod } from "./interface";


const diagnosticCollection = vscode.languages.createDiagnosticCollection("extjs-lint");
const conf: IConf = {
    extjsDir: "",
    extjsBase: "",
    workspaceRoot: "",
};

interface IConf {
    extjsDir: string;
    extjsBase: string;
    workspaceRoot: string;
}

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


    constructor(serverRequest: ServerRequest)
    {
        this.serverRequest = serverRequest;
    }


    async indexing(fsPath: string, text: string)
    {
        const components = await this.serverRequest.parseExtJsFile(text);

        components?.forEach(cmp =>
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


    async validateExtjsDocument(textDocument: vscode.TextDocument): Promise<void>
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


    private async indexingAll()
    {
        const uris = await vscode.workspace.findFiles(`${conf.extjsDir}/**/*.js`);
        //
        // TODO - put message in status bar - indexing , 0-100% progress
        //
        for (const uri of uris) {
            const text = (await vscode.workspace.fs.readFile(uri)).toString();
            await this.indexing(uri.fsPath, text);
        }
    }


    async setup(context: vscode.ExtensionContext)
    {
        await initConfig();
        await this.indexingAll();

        const activeTextDocument = vscode.window.activeTextEditor?.document;
        if (activeTextDocument && activeTextDocument.languageId === "javascript") {
            await this.validateExtjsDocument(activeTextDocument);
        }

        const confWatcher = vscode.workspace.createFileSystemWatcher(".extjsrc{.json,}");
        context.subscriptions.push(confWatcher);
        confWatcher.onDidChange(initConfig);

        vscode.workspace.onDidChangeTextDocument(async (event) =>
        {   //
            // TODO - debounce
            //
            const textDocument = event.document;
            if (textDocument.languageId === "javascript")
            {
                const fsPath = textDocument.uri.fsPath;
                handleDeleFile(fsPath);
                await this.indexing(textDocument.uri.fsPath, textDocument.getText());
                await this.validateExtjsDocument(textDocument);
            }
        }, context.subscriptions);

        vscode.workspace.onDidDeleteFiles(async (event) =>
        {
            event.files.forEach(async file =>
            {
                handleDeleFile(file.fsPath);
                //
                // TODO - activeDocument Validating
                //
                const activeTextDocument = vscode.window.activeTextEditor?.document;
                if (activeTextDocument && activeTextDocument.languageId === "javascript") {
                    await this.validateExtjsDocument(activeTextDocument);
                }
            });
        }, context.subscriptions);

        vscode.window.onDidChangeActiveTextEditor(async (e: vscode.TextEditor | undefined) =>
        {
            const textDocument = e?.document;
            if (textDocument) {
                if (textDocument.languageId === "javascript") {
                    await this.validateExtjsDocument(textDocument);
                }
            }
        }, context.subscriptions);

        vscode.workspace.onDidOpenTextDocument(async (textDocument: vscode.TextDocument) =>
        {
            if (textDocument.languageId === "javascript") {
                await this.validateExtjsDocument(textDocument);
            }
        }, context.subscriptions);
    }
}


async function initConfig()
{
    const confUris = await vscode.workspace.findFiles(".extjsrc{.json,}");
    for (const uri of confUris) {
        const fileSystemPath = uri.fsPath || uri.path;
        const confJson = fs.readFileSync(fileSystemPath, "utf8");
        const _conf = json5.parse(confJson);
        Object.assign(conf, _conf);
    }
}


export function fsPathToCmpClass(fsPath: string)
{
    const wsf = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(fsPath));
    if (wsf) {
        if (conf.workspaceRoot === "") {
            conf.workspaceRoot = wsf.uri.fsPath;
        }
        fsPath = fsPath.replace(wsf.uri.fsPath, "");
    }
    fsPath = fsPath.replace(new RegExp(`^${path.sep}*${conf.extjsDir}${path.sep}*`), "");
    fsPath = fsPath.replace(/\..+$/, "");
    return conf.extjsBase + "." + fsPath.split(path.sep).join(".");
}


function handleDeleFile(fsPath: string)
{
    const componentClass = fsPathToCmpClass(fsPath);

    getXtypes(componentClass)?.forEach(xtype => {
        delete widgetToComponentClassMapping[xtype];
    });

    delete componentClassToWidgetsMapping[componentClass];
    delete componentClassToFsPathMapping[componentClass];
    delete componentClassToRequiresMapping[componentClass];
    delete componentClassToConfigsMapping[componentClass];
}


function getXtypes(cmp: string)
{
    return componentClassToWidgetsMapping[cmp];
}


function getRequiredXtypes(cmp: string)
{
    const requires = Object.keys(componentClassToWidgetsMapping).filter(it => !isNeedRequire(it));
    requires.push(...(componentClassToRequiresMapping[cmp] || []));
    return requires.reduce<string[]>((previousValue, currentCmpClass) => {
        previousValue.push(...(getXtypes(currentCmpClass) || []));
        return previousValue;
    }, []);
}


export function getExtjsFilePath(componentClass: string)
{
    return componentClassToFsPathMapping[componentClass];
}


export function getExtjsComponentClass(widget: string)
{
    return widgetToComponentClassMapping[widget];
}


export function getExtjsComponentByConfig(property: string)
{
    return configToComponentClassMapping[property];
}


export function getExtjsConfigByComponent(cmp: string, property: string): IConfig | undefined
{
    const configs = componentClassToConfigsMapping[cmp];
    if (configs) {
        for (let c = 0; c < configs.length; c++) {
            if (configs[c].name === property) {
                return configs[c];
            }
        }
    }
    return undefined;
}


export function getExtjsConfigByMethod(cmp: string, property: string): IConfig | undefined
{
    const methods = componentClassToMethodsMapping[cmp];
    if (methods) {
        for (let c = 0; c < methods.length; c++) {
            if (methods[c].name === property) {
                return methods[c];
            }
        }
    }
    return undefined;
}


export default ExtjsLanguageManager;
