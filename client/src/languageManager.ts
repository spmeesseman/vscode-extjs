
import * as fs from "fs";
import json5 from "json5";
import * as path from "path";
import {
    Diagnostic, DiagnosticSeverity, Disposable, ExtensionContext, languages, MarkdownString , Progress,
    ProgressLocation, Range, TextDocument, TextEditor, window, workspace, Uri
} from "vscode";
import ServerRequest, { toVscodeRange } from "./common/ServerRequest";
import { IConfig, IComponent, IMethod, IConf, IProperty, IXtype, utils } from  "../../common";
import { configuration } from "./common/configuration";
import * as log from "./common/log";


const diagnosticCollection = languages.createDiagnosticCollection("extjs-lint");

let config: IConf[] = [];

export const widgetToComponentClassMapping: { [widget: string]: string | undefined } = {};
export const configToComponentClassMapping: { [property: string]: string | undefined } = {};
export const methodToComponentClassMapping: { [method: string]: string | undefined } = {};
export const propertyToComponentClassMapping: { [method: string]: string | undefined } = {};
export const xtypeToComponentClassMapping: { [method: string]: string | undefined } = {};
export const fileToComponentClassMapping: { [fsPath: string]: string | undefined } = {};

const componentClassToWidgetsMapping: { [componentClass: string]: string[] | undefined } = {};
const componentClassToAliasesMapping: { [componentClass: string]: string[] | undefined } = {};
const componentClassToRequiresMapping: { [componentClass: string]: string[] | undefined } = {};
const componentClassToFsPathMapping: { [componentClass: string]: string | undefined } = {};
const componentClassToXTypesMapping: { [componentClass: string]: IXtype[] | undefined } = {};
const componentClassToConfigsMapping: { [componentClass: string]: IConfig[] | undefined } = {};
const componentClassToPropertiesMapping: { [componentClass: string]: IProperty[] | undefined } = {};
const componentClassToMethodsMapping: { [componentClass: string]: IMethod[] | undefined } = {};
export const componentClassToComponentsMapping: { [componentClass: string]: IComponent | undefined } = {};
export const componentClassToFilesMapping: { [componentClass: string]: string | undefined } = {};

enum MarkdownChars
{
    NewLine = "  \n",
    TypeWrapBegin = "[",
    TypeWrapEnd = "]",
    Bold = "**",
    Italic = "*",
    BoldItalicStart = "_**",
    BoldItalicEnd = "**_",
    LongDash = "&#8212;",
    Black = "\\u001b[30m",
    Red = "\\u001b[31",
    Green = "\\u001b[32m",
    Yellow = "\\u001b[33m",
    Blue = "\\u001b[34m", // "<span style=\"color:blue\">"  "</style>"
    Magenta = "\\u001b[35",
    Cyan = "\\u001b[36m",
    White = "\\u001b[37m"
}

enum MarkdownStringMode
{
    Class,
    Code,
    Config,
    Deprecated,
    Link,
    Method,
    Normal,
    Private,
    Property,
    Param,
    Returns,
    Since,
    Singleton
}

export enum ComponentType
{
    None,
    Config = 1 << 0,
    Method = 1 << 1,
    Property = 1 << 2,
    Widget = 1 << 3,
    Class = 1 << 4
}

class ExtjsLanguageManager
{
    private serverRequest: ServerRequest;
    private reIndexTaskId: NodeJS.Timeout | undefined;
    private dirNamespaceMap: Map<string, string> = new Map<string, string>();


    constructor(serverRequest: ServerRequest)
    {
        this.serverRequest = serverRequest;
    }


    async indexing(fsPath: string, nameSpace: string, text: string, logPad = "")
    {
        const components = await this.serverRequest.parseExtJsFile(fsPath, nameSpace, text);
        if (!components || components.length === 0) {
            return;
        }

        log.logMethodStart("indexing " + fsPath, 2, logPad, true);

        await utils.forEachAsync(components, (cmp: IComponent) =>
        {
            const {
                componentClass, requires, widgets, xtypes, methods, configs, properties, aliases
            } = cmp;

            //
            // The components documentation.  Defined at the very top of the class file, e.g.:
            //
            //     /**
            //      * @class MyApp.Utilities
            //      *
            //      * Description for MyApp utilities class
            //      *
            //      * @singleton
            //      * @since 2.0.0
            //      */
            //     Ext.define("MyApp.Utilities", {
            //         ...
            //     });
            //
            if (cmp?.doc) {
                cmp.markdown = commentToMarkdown(componentClass, cmp.doc, logPad + "   ");
            }

            log.log("   map classes to components", 2, logPad);

            //
            // Map the component class to the various component types found
            //
            componentClassToFsPathMapping[componentClass] = fsPath;
            componentClassToWidgetsMapping[componentClass] = widgets;
            componentClassToMethodsMapping[componentClass] = methods;
            componentClassToConfigsMapping[componentClass] = configs;
            componentClassToPropertiesMapping[componentClass] = properties;
            componentClassToXTypesMapping[componentClass] = xtypes;
            componentClassToAliasesMapping[componentClass] = aliases;

            //
            // Map the filesystem path <-> component class
            //
            fileToComponentClassMapping[fsPath] = componentClass;
            componentClassToFilesMapping[componentClass] = fsPath;

            //
            // Map the component class to it's component (it's own definition)
            //
            componentClassToComponentsMapping[componentClass] = cmp;

            //
            // Map the component class to any requires strings found
            //
            if (requires) {
                componentClassToRequiresMapping[componentClass] = requires.value;
            }

            log.log("   map components to classes", 2, logPad);

            //
            // Map widget/alias/xtype types found to the component class
            //
            widgets.forEach(xtype => {
                widgetToComponentClassMapping[xtype] = componentClass;
            });

            //
            // Map methods found to the component class
            //
            methods.forEach(method => {
                method.markdown = commentToMarkdown(method.name, method.doc);
                methodToComponentClassMapping[method.name] = componentClass;
                if (method.params)
                {
                    for (const p of method.params)
                    {
                        if (p.doc) {
                            p.markdown = commentToMarkdown(p.name, p.doc);
                        }
                    }
                }
            });

            //
            // Map config properties found to the component class
            //
            configs.forEach(config => {
                config.markdown = commentToMarkdown(config.name, config.doc);
                configToComponentClassMapping[config.name] = componentClass;
            });

            //
            // Map properties found to the component class
            //
            properties.forEach(property => {
                property.markdown = commentToMarkdown(property.name, property.doc);
                propertyToComponentClassMapping[property.name] = componentClass;
            });

            //
            // Map xtypes found to the component class
            //
            xtypes.forEach(xtype => {
                xtypeToComponentClassMapping[xtype.name] = componentClass;
            });
        });

        log.logMethodDone("indexing " + fsPath, 2, logPad, true);
    }


    async validateDocument(textDocument: TextDocument, nameSpace: string): Promise<void>
    {
        const diagnostics: Diagnostic[] = [];
        const text = textDocument.getText();
        const components = await this.serverRequest.parseExtJsFile(textDocument.uri.fsPath, nameSpace, text);

        components?.forEach(cmp =>
        {
            //
            // TODO - Validation
            // Properties, config properties, and methods
            //

            const { componentClass, xtypes } = cmp;
            const requiredXtypes = getRequiredXtypes(componentClass) || [];

            function validateXtype(xtype: string, range: Range)
            {
                if (!requiredXtypes.includes(xtype))
                {
                    // problems++;
                    const diagnostic: Diagnostic = {
                        severity: DiagnosticSeverity.Error,
                        range,
                        message: `xtype "${xtype}" not found.`,
                        source: "vscode-ext-js"
                    };
                    diagnostics.push(diagnostic);
                }
            }

            for (const xtype of xtypes) {
                validateXtype(xtype.name, toVscodeRange(xtype.start, xtype.end));
            }
        });

        diagnosticCollection.set(textDocument.uri, diagnostics);
    }


    private async indexingAll(progress?: Progress<any>)
    {
        const processedDirs: string[] = [];
        let dirs: string[] = [],
            numFiles = 0,
            currentFileIdx = 0;

        const _isIndexed = ((dir: string) =>
        {
            for (const d of processedDirs)
            {   //
                // Dont process dirs already processed.  If dirs in a user's config overlap eachother
                // then something might get missed so it's on the user to make sure their paths are
                // set correctly, in app.json and/or .extjsrc files.
                //
                if (d === dir || d.indexOf(dir) !== -1 || dir.indexOf(d) !== -1) {
                    return true;
                }
            }
            return false;
        });

        log.logMethodStart("indexing all", 1, "", true);

        for (const conf of config)
        {
            if (typeof conf.classpath === "string")
            {
                dirs = [ conf.classpath ];
            }
            else {
                dirs = conf.classpath;
            }

            //
            // Status bar
            //
            // const statusBarSpace = window.createStatusBarItem(StatusBarAlignment.Left, -10000);
            // statusBarSpace.tooltip = "ExtJs Language Server is building the syntax tree";
            // statusBarSpace.text = getStatusString(0);
            // statusBarSpace.show();

            for (const dir of dirs)
            {
                if (!_isIndexed(dir))
                {
                    const uris = await workspace.findFiles(`${dir}/**/*.js`);
                    numFiles += uris.length;
                }
            }

            const increment = Math.round(1 / numFiles * 100);

            log.logBlank();
            log.logValue("   # of files to index", numFiles, 1);

            for (const dir of dirs)
            {
                if (!_isIndexed(dir))
                {
                    const uris = await workspace.findFiles(`${dir}/**/*.js`);
                    for (const uri of uris)
                    {
                        log.logBlank();
                        log.logValue("   Indexing file", uri.fsPath, 1);
                        const text = (await workspace.fs.readFile(uri)).toString();
                        await this.indexing(uri.fsPath, conf.name, text, "   ");
                        const pct = Math.round(++currentFileIdx / numFiles * 100);
                        progress?.report({
                            increment,
                            message: pct + "%"
                        });
                        // statusBarSpace.text = getStatusString(pct);
                    }
                    processedDirs.push(dir);
                    this.dirNamespaceMap.set(dir, conf.name);
                }
            }
        }

        log.logMethodDone("indexing all", 1, "", true);
    }


    private async indexingAllWithProgress()
    {
        await window.withProgress(
        {
            location: ProgressLocation.Window,
            cancellable: false,
            title: "Indexing ExtJs Files"
        },
        async (progress) =>
        {
            await this.indexingAll(progress);
        });
    }


    async setup(context: ExtensionContext): Promise<Disposable[]>
    {
        const success = await initConfig();
        if (!success) {
            window.showInformationMessage("Could not find any app.json or .extjsrc.json files");
            return [];
        }

        await this.indexingAllWithProgress();
        //
        // Validate active js document if there is one
        //
        const activeTextDocument = window.activeTextEditor?.document;
        if (activeTextDocument && activeTextDocument.languageId === "javascript") {
            await this.validateDocument(activeTextDocument, this.getNamespace(activeTextDocument));
        }
        return this.registerWatchers(context);
    }


    getNamespace(document: TextDocument | undefined)
    {
        if (document) {
            return this.dirNamespaceMap.get(path.dirname(document.uri.fsPath)) || "Ext";
        }
        return "Ext";
    }


    registerWatchers(context: ExtensionContext): Disposable[]
    {
        //
        // rc/conf file / app.json
        //
        const debounceMs = 1500,
              disposables: Disposable[] = [],
              confWatcher = workspace.createFileSystemWatcher("{.extjsrc{.json,},app.json}");

        context.subscriptions.push(confWatcher);
        confWatcher.onDidChange(initConfig);

        //
        // Open dcument text change
        //
        disposables.push(workspace.onDidChangeTextDocument(async (event) =>
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
                    const ns = this.getNamespace(textDocument);
                    handleDeleFile(fsPath);
                    await this.indexing(textDocument.uri.fsPath, ns, textDocument.getText());
                    await this.validateDocument(textDocument, ns);
                }, debounceMs);
            }
        }, context.subscriptions));

        //
        // Deletions
        //
        disposables.push(workspace.onDidDeleteFiles(async (event) =>
        {
            event.files.forEach(async file =>
            {
                handleDeleFile(file.fsPath);
                const activeTextDocument = window.activeTextEditor?.document;
                if (activeTextDocument && activeTextDocument.languageId === "javascript") {
                    await this.validateDocument(activeTextDocument, this.getNamespace(activeTextDocument));
                }
            });
        }, context.subscriptions));

        //
        // Active editor changed
        //
        disposables.push(window.onDidChangeActiveTextEditor(async (e: TextEditor | undefined) =>
        {
            const textDocument = e?.document;
            if (textDocument) {
                if (textDocument.languageId === "javascript") {
                    await this.validateDocument(textDocument, this.getNamespace(textDocument));
                }
            }
        }, context.subscriptions));

        //
        // Open text document
        //
        disposables.push(workspace.onDidOpenTextDocument(async (textDocument: TextDocument) =>
        {
            if (textDocument.languageId === "javascript") {
                await this.validateDocument(textDocument, this.getNamespace(textDocument));
            }
        }, context.subscriptions));

        //
        // Register configurations/settings change watcher
        //
        disposables.push(workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration("extjsLangSvr.debug") || e.affectsConfiguration("extjsLangSvr.debugLevel")) {
                //
                // TODO
                //
                log.log("Process settings change 'include'", 1);
            }
        }, context.subscriptions));

        return disposables;
    }

}


function boldItalic(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
{
    return (leadingSpace ? " " : "") + MarkdownChars.BoldItalicStart + text +
           MarkdownChars.BoldItalicEnd + (trailingSpace ? " " : "");
}


function bold(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
{
    return (leadingSpace ? " " : "") + MarkdownChars.Bold + text + MarkdownChars.Bold +
           (trailingSpace ? " " : "");
}


function commentToMarkdown(property: string, comment: string | undefined, logPad = ""): MarkdownString | undefined
{
    if (!comment || !property) {
        return;
    }

    const markdown = new MarkdownString();

    //
    // JSDoc comments in the following form:
    //
    //     /**
    //     * @property propName
    //     * The property description
    //     * @returns {Boolean}
    //     */
    //
    //     /**
    //     * @method methodName
    //     * The method description
    //     * @property prop1 Property 1 description
    //     * @property prop2 Property 2 description
    //     * @returns {Boolean}
    //     */
    //
    // VSCode Hover API takes Clojure based markdown text.  See:
    //
    //     https://clojure.org/community/editing
    //

    log.logMethodStart("build markdown string from comment", 2, logPad, false, [["comment", comment]]);

    const commentFmt = comment?.trim()
        //
        // Clean up beginning of string /**\n...
        //
        .replace(/^[\* \t\n\r]+/, "");
        //
        // Format line breaks to Clojure standard
        //
        // .replace(/\n/, newLine)
        // //
        // // Remove leading "* " for each line in the comment
        // //
        // .replace(/\* /, "")
        // //
        // // Bold @ tags
        // //
        // .replace(/@[a-z]+ /, function(match) {
        //     return "_**" + match.trim() + "**_ ";
        // })
        // .trim();

    const docLines = commentFmt.split(/\r{0,1}\n{1}\s*\*( |$)/);
    let mode: MarkdownStringMode | undefined,
        indented = "",
        previousMode: MarkdownStringMode | undefined,
        trailers: string[] = [];

    docLines.forEach((line) =>
    {
        if (!line.trim()) {
            return; // continue forEach()
        }

        if (markdown.value.length > 0 && mode !== MarkdownStringMode.Code) {
            markdown.appendMarkdown(MarkdownChars.NewLine);
        }

        line = line
        //
        // Remove line breaks, we format later depending on comment parts, done w/ Clojure
        // standard line breaks
        //
        .replace(/\n/, "")
        //
        // Remove leading "* " for each line in the comment
        //
        .replace(/\* /, "")
        .replace(/\s*\*$/, ""); // <- Blank lines
        //
        // Italicize @ tags
        //
        // .replace(/@[a-z]+ /, function(match) {
        //     return "_" + match.trim() + "_";
        // });
        // .trim();

        log.logValue("   process line", line, 4);

        if (!line.trim()) {
            return; // continue forEach()
        }

        mode = getMode(line);

        if (indented && mode !== MarkdownStringMode.Code)
        {
            markdown.appendCodeblock(indented.trim());
            indented = "";
        }

        //
        // If 'mode' defined, and strings exist in the 'trailers' array, then then we are done
        // processing previous tag block.  e.g.:
        //
        //     @param {Boolean} [show=true]  Show the button to open a help desk ticket
        //     User can select whetheror not to submit a ticket.
        //     [ TRAILERS GO HERE ]
        //     @param {Boolean} [ask=true]  Prompt for input   ( <--- processing this line)
        //
        if (mode !== undefined && mode !== MarkdownStringMode.Code && trailers.length)
        {
            trailers.forEach((t) => {
                markdown.appendMarkdown(t);
            });
            trailers = [];
        }

        mode = mode !== undefined ? mode : previousMode;

        previousMode = mode;

        if (mode === MarkdownStringMode.Config || mode === MarkdownStringMode.Property || mode === MarkdownStringMode.Method)
        {
            handleObjectLine(line, property, markdown);
        }
        else if (mode === MarkdownStringMode.Class)
        {
            handleClassLine(line, markdown);
        }
        else if (mode === MarkdownStringMode.Param)
        {
            handleParamLine(line, trailers, markdown);
        }
        else if (mode === MarkdownStringMode.Code)
        {
            log.logValue("      indented line", line, 4);
            indented += MarkdownChars.NewLine + line.trim();
        }
        else if (mode === MarkdownStringMode.Returns)
        {
            handleReturnsLine(line, markdown);
        }
        else if (mode === MarkdownStringMode.Deprecated)
        {
            handleDeprecatedLine(line, markdown);
        }
        else if (mode === MarkdownStringMode.Singleton)
        {
            handleTagLine(line, markdown);
        }
        else
        {
            handleTextLine(line, markdown);
        }
    });

    log.logMethodDone("build markdown string from comment", 2);
    return markdown;
}


async function initConfig(): Promise<boolean>
{
    const // settingsPaths = configuration.get<string[]>("include"),
          confUris = await workspace.findFiles(".extjsrc{.json,}"),
          appDotJsonUris = await workspace.findFiles("app.json");

    log.logMethodStart("initialize config", 1, "", true);

    //
    // Clear
    //
    config = [];

    // if (settingsPaths)
    // {
    //     for (const path of settingsPaths)
    //     {
    //         config.push({
    //             classpath: path,
    //             name: AppNamespace
    //         });
    //     }
    // }

    if (confUris)
    {
        for (const uri of confUris)
        {
            const fileSystemPath = uri.fsPath || uri.path;
            const confJson = fs.readFileSync(fileSystemPath, "utf8");
            const conf: IConf = json5.parse(confJson);
            if (conf.classpath && conf.name)
            {
                log.logValue("   add .extjsrc path", fileSystemPath, 2);
                log.logValue("      namespace", conf.name, 2);
                log.logValue("      classpath", conf.classpath, 3);
                config.push(conf);
            }
        }
    }

    if (appDotJsonUris)
    {
        for (const uri of appDotJsonUris)
        {
            const fileSystemPath = uri.fsPath || uri.path;
            let confJson = fs.readFileSync(fileSystemPath, "utf8");
            const conf: IConf = json5.parse(confJson);
            //
            // Merge classpath to root
            //
            const classic = conf.classic ? Object.assign([], conf.classic) : {},
                  modern = conf.modern ? Object.assign([], conf.modern) : {};

            if (!conf.classpath)
            {
                conf.classpath = [];
            }
            else if (typeof conf.classpath === "string")
            {
                conf.classpath = [ conf.classpath ];
            }

            if (classic?.classpath)
            {
                conf.classpath = conf.classpath.concat(...classic.classpath);
            }
            if (modern?.classpath) {
                conf.classpath = conf.classpath.concat(...modern.classpath);
            }

            const wsDotJsonFsPath = path.join(path.dirname(uri.fsPath), "workspace.json");
            if (fs.existsSync(wsDotJsonFsPath))
            {
                confJson = fs.readFileSync(wsDotJsonFsPath, "utf8");
                const wsConf = json5.parse(confJson);
                if (wsConf.frameworks && wsConf.frameworks.ext)
                {
                    conf.classpath.push(wsConf.frameworks.ext);
                    log.logValue("   add ws.json framework path", wsConf.frameworks.ext, 2);
                }
                if (wsConf.packages && wsConf.packages.dir)
                {
                    const dirs = wsConf.packages.dir.split(",");
                    for (const d of dirs)
                    {
                        const wsPath = d.replace(/\$\{workspace.dir\}[/\\]{1}/, "")
                                        .replace(/\$\{toolkit.name\}[/\\]{1}/, "classic");
                        conf.classpath.push(wsPath);
                        log.logValue("   add ws.json path", wsPath, 2);
                    }
                }
            }

            if (conf.classpath && conf.name)
            {
                log.logValue("   add app.json paths", fileSystemPath, 2);
                log.logValue("      namespace", conf.name, 2);
                log.logValue("      classpath", conf.classpath, 3);
                config.push(conf);
            }
        }
    }

    log.logValue("   # of configs found", config.length, 3);
    log.logMethodDone("initialize config", 1, "", true);

    return (config.length > 0);
}


export function getClassFromPath(fsPath: string)
{
    //
    // TODO - check / test file delete
    //
    let cmpClass: string | undefined;
    const // uriPath = Uri.parse(fsPath).path.replace(/\\/g, "/"), // win32 compat
          // wsf = workspace.getWorkspaceFolder(Uri.parse(`file://${uriPath}`));
          wsf = workspace.getWorkspaceFolder(Uri.parse(fsPath));

    log.log("get component by fs path", 1);
    log.logValue("   path", fsPath, 2);

    for (const conf of config)
    {
        if (conf.classpath.includes(fsPath))
        {
            if (wsf) {
                fsPath = fsPath.replace(wsf.uri.fsPath, "");
            }

            fsPath = fsPath.replace(new RegExp(`^${path.sep}*${conf.classpath}${path.sep}*`), "");
            fsPath = fsPath.replace(/\..+$/, "");
            cmpClass = conf.name + "." + fsPath.split(path.sep).join(".");
            break;
        }
    }

    log.logValue("   component class", cmpClass, 2);
    return cmpClass;
}


export function getClassFromFile(fsPath: string): string | undefined
{
    const cls = fileToComponentClassMapping[fsPath];
    log.log("get component class by file", 1);
    log.logValue("   file", fsPath, 2);
    if (cls) {
        log.log("   found component class", 3);
        return cls;
    }
    return undefined;
}


export function getComponent(componentClass: string, checkAlias?: boolean, fsPath?: string): IComponent | undefined
{
    let component = componentClassToComponentsMapping[componentClass];

    log.log("get component by class", 1);
    log.logValue("   component class", componentClass, 2);

    if (component)
    {
        log.log("   found component", 3);
        log.logValue("      namespace", component.nameSpace, 4);
        log.logValue("      base namespace", component.baseNameSpace, 4);
    }

    if (!component && checkAlias === true)
    {
        component = getComponentByAlias(componentClass);
        if (component) {
            log.log("   found aliased component", 3);
            log.logValue("      namespace", component.nameSpace, 4);
            log.logValue("      base namespace", component.baseNameSpace, 4);
        }
    }

    if (!component && fsPath)
    {
        component = getComponentInstance(componentClass, fsPath);
        if (component) {
            log.log("   found instanced component", 3);
            log.logValue("      namespace", component.nameSpace, 4);
            log.logValue("      base namespace", component.baseNameSpace, 4);
        }
    }

    return component;
}


export function getComponentByAlias(alias: string): IComponent | undefined
{
    const cls = widgetToComponentClassMapping[alias];
    log.log("get component by alias", 1);
    log.logValue("   component alias", alias, 2);
    if (cls) {
        const component = getComponent(cls);
        if (component) {
            log.log("   found component", 3);
            log.logValue("      namespace", component.nameSpace, 4);
            log.logValue("      base namespace", component.baseNameSpace, 4);
            return component;
        }
    }
    return undefined;
}


export function getComponentByFile(fsPath: string): IComponent | undefined
{
    const cls = getClassFromFile(fsPath);
    log.log("get component by file", 1);
    log.logValue("   component file", fsPath, 2);
    if (cls) {
        const component = getComponent(cls);
        if (component) {
            log.log("   found component", 3);
            log.logValue("      namespace", component.nameSpace, 4);
            log.logValue("      base namespace", component.baseNameSpace, 4);
            return component;
        }
    }
    return undefined;
}


/**
 * Get component class name
 *
 * @param {String} property Property name
 * @param {String} txt The complete line of text the property is found in
 */
export function getComponentClass(property: string, cmpType?: ComponentType, txt?: string)
{
    let cmpClass = "this", // getComponentByConfig(property);
        cmpClassPre, cmpClassPreIdx = -1, cutAt = 0;

    if (!txt)
    {
        if (!cmpType || cmpType === ComponentType.Widget) {
            return widgetToComponentClassMapping[property];
        }
        else if (cmpType === ComponentType.Method) {
            return methodToComponentClassMapping[property];
        }
        else if (cmpType === ComponentType.Property) {
            return propertyToComponentClassMapping[property];
        }
        else if (cmpType === (ComponentType.Property | ComponentType.Config)) {
            if (propertyToComponentClassMapping[property]) {
                return propertyToComponentClassMapping[property];
            }
            return configToComponentClassMapping[property];
        }
        else {
            return undefined;
        }
    }

    //
    // Get class name prependature to hovered property
    //
    // classPre could be something like:
    //
    //     Ext.csi.view.common.
    //     Ext.csi.store.
    //     Ext.form.field.
    //     MyApp.view.myview.
    //
    cmpClassPre = txt.substring(0, txt.indexOf(property));
    cmpClassPreIdx = cmpClassPre.lastIndexOf(" ") + 1;

    //
    // Remove the trailing '.' for the component name
    //
    cmpClass = cmpClassPre.substr(0, cmpClassPre.length - 1);
    if (cmpClassPreIdx > 0)
    {
        cmpClassPre = cmpClassPre.substring(cmpClassPreIdx);
    }

    for (let i = cmpClass.length - 1; i >= 0 ; i--)
    {
        if (cmpClass[i] < "A" || cmpClass > "z")
        {
            if (cmpClass[i] < "0" || cmpClass > "9") {
                if (cmpClass[i] !== ".") {
                    cutAt = i;
                    break;
                }
            }
        }
    }

    cmpClass = cmpClass.substring(cutAt).replace(/[^\w.]+/g, "").trim();

    if (!cmpClass || cmpClass === "this")
    {
        cmpClass = "VSCodeExtJS"; // TODO set main class name somewhere for reference
    }

    //
    // Check aliases/alternate class names
    //
    let aliasClass: string | undefined;
    if (aliasClass = widgetToComponentClassMapping[cmpClass])
    {
        cmpClass = aliasClass;
    }

    log.logBlank(1);
    log.logValue("class", cmpClass, 1);
    return cmpClass;
}


export function getComponentInstance(property: string, fsPath: string)
{
     //
    // Check instance properties
    //

    const thisCls = getClassFromFile(fsPath);
    if (!thisCls) {
        return;
    }

    const cmp = getComponent(thisCls) || getComponentByAlias(thisCls);
    if (!cmp) {
        return;
    }

    for (const variable of cmp.privates)
    {
        // TODO - property hover - check private sec
    }

    for (const variable of cmp.statics)
    {
        // TODO - property hover - check static sec
    }

    for (const method of cmp.methods)
    {
        if (method.variables)
        {
            for (const variable of method.variables)
            {
                if (variable.name === property)
                {
                    const instanceCmp = getComponent(variable.componentClass) || getComponentByAlias(variable.componentClass);
                    if (instanceCmp && instanceCmp.markdown)
                    {
                        log.logValue("provide instance class hover info", property, 1);
                        return instanceCmp;
                    }
                }
            }
        }
    }
}


export function getConfig(cmp: string, property: string): IConfig | undefined
{
    const configs = componentClassToConfigsMapping[cmp];
    log.log("get config by component class", 1);
    log.logValue("   component class", cmp, 2);
    log.logValue("   config", property, 2);
    if (configs) {
        for (let c = 0; c < configs.length; c++) {
            if (configs[c].name === property) {
                log.log("   found config", 3);
                log.logValue("      name", configs[c].name, 4);
                log.logValue("      start", configs[c].start.line + ", " + configs[c].start.column, 4);
                log.logValue("      end", configs[c].end.line + ", " + configs[c].end.column, 4);
                return configs[c];
            }
        }
    }
    return undefined;
}


export function getFilePath(componentClass: string)
{
    const fsPath = componentClassToFsPathMapping[componentClass];
    log.log("get fs path by component", 1);
    log.logValue("   path", fsPath, 2);
    return fsPath;
}


export function getProperty(cmp: string, property: string): IProperty | undefined
{
    const properties = componentClassToPropertiesMapping[cmp];
    log.log("get property by component class", 1);
    log.logValue("   component class", cmp, 2);
    log.logValue("   property", property, 2);
    if (properties) {
        for (let c = 0; c < properties.length; c++) {
            if (properties[c].name === property) {
                log.log("   found property", 3);
                log.logValue("      name", properties[c].name, 4);
                log.logValue("      start (line/col)",  properties[c].start.line + ", " + properties[c].start.column, 4);
                log.logValue("      end (line/col)", properties[c].end.line + ", " + properties[c].end.column, 4);
                return properties[c];
            }
        }
    }
    return undefined;
}


export function getMethod(cmp: string, property: string): IMethod| undefined
{
    const methods = componentClassToMethodsMapping[cmp];
    log.log("get config by method", 1);
    log.logValue("   component class", cmp, 2);
    log.logValue("   property", property, 2);
    if (methods)
    {
        for (let c = 0; c < methods.length; c++)
        {
            if (methods[c].name === property) {
                log.log("   found method", 3);
                log.logValue("      name", methods[c].name, 4);
                log.logValue("      start (line/col)",  methods[c].start.line + ", " + methods[c].start.column, 4);
                log.logValue("      end (line/col)", methods[c].end.line + ", " + methods[c].end.column, 4);
                return methods[c];
            }
        }
    }
    return undefined;
}


function getMode(line: string): MarkdownStringMode | undefined
{
    let mode;
    if (line.startsWith("@"))
    {
        const tag = line.trim().substring(0, line.indexOf(" ") !== -1 ? line.indexOf(" ") : line.length);
        switch (tag)
        {
            case "@cfg":
            case "@config":
                mode = MarkdownStringMode.Config;
                break;
            case "@class":
                mode = MarkdownStringMode.Class;
                break;
            // case "{@link":
            //     mode = MarkdownStringMode.Link;
            //     break;
            case "@property":
                mode = MarkdownStringMode.Property;
                break;
            case "@param":
                mode = MarkdownStringMode.Param;
                break;
            case "@returns":
            case "@return":
                mode = MarkdownStringMode.Returns;
                break;
            case "@method":
                mode = MarkdownStringMode.Method;
                break;
            case "@since":
                mode = MarkdownStringMode.Since;
                break;
            case "@deprecated":
                mode = MarkdownStringMode.Deprecated;
                break;
            case "@private":
                mode = MarkdownStringMode.Private;
                break;
            case "@singleton":
                mode = MarkdownStringMode.Singleton;
                break;
            case "@inheritdoc":
            default:
                break;
        }
        log.logValue("      found @ tag", tag, 4);
        log.logValue("      set mode", mode?.toString(), 4);
    }
    else if (line.length > 3 && (line.substring(0, 3) === "   " || line[0] === "\t"))
    {
        mode = MarkdownStringMode.Code;
    }
    return mode;
}


function getRequiredXtypes(cmp: string)
{
    const requires = []; // Object.keys(componentClassToWidgetsMapping).filter(it => util.isNeedRequire(it));
    log.log("get required xtypes by component class", 1);
    log.logValue("   component class", cmp, 2);
    requires.push(...(componentClassToRequiresMapping[cmp] || []));
    const reqXTypes = requires.reduce<string[]>((previousValue, currentCmpClass) => {
        previousValue.push(...(componentClassToWidgetsMapping[currentCmpClass] || []));
        return previousValue;
    }, []);
    log.logValue("   # of required xtypes", reqXTypes.length, 2);
    reqXTypes.forEach((x) => {
        log.log("      " + x);
    });
    log.log("completed get required xtypes by component class", 1);
    return reqXTypes;
}


function getStatusString(pct: number)
{
    return "$(loading~spin) Indexing ExtJs Files " + (pct ?? "0") + "%";
}


export function getXType(cmp: string, xtype: string): IXtype | undefined
{
    const xtypes = componentClassToXTypesMapping[cmp];
    log.log("get config by component class", 1);
    log.logValue("   component class", cmp, 2);
    log.logValue("   xtype", xtype, 2);
    if (xtypes) {
        for (let c = 0; c < xtypes.length; c++) {
            if (xtypes[c].name === xtype) {
                log.log("   found config", 3);
                log.logValue("      name", xtypes[c].name, 4);
                log.logValue("      start", xtypes[c].start.line + ", " + xtypes[c].start.column, 4);
                log.logValue("      end", xtypes[c].end.line + ", " + xtypes[c].end.column, 4);
                return xtypes[c];
            }
        }
    }
    return undefined;
}


function handleDeleFile(fsPath: string)
{
    const componentClass = getClassFromPath(fsPath);
    if (componentClass)
    {
        log.log("handle file depetion", 1);
        log.logValue("   path", fsPath, 2);
        log.logValue("   component class", componentClass, 2);

        const component = getComponent(componentClass);
        if (component)
        {
            // component.aliases.forEach((alias) => {
            //     delete aliasToComponentClassMapping[alias];
            // });

            component.configs.forEach((config) => {
                delete configToComponentClassMapping[config.name];
            });

            component.methods.forEach((method) => {
                delete methodToComponentClassMapping[method.name];
            });

            // component.privates.forEach((private) => {
            //     delete privateToComponentClassMapping[private.name];
            // });

            component.properties.forEach((property) => {
                delete propertyToComponentClassMapping[property.name];
            });

            // component.statics.forEach((static) => {
            //     delete configToComponentClassMapping[static.name];
            // });

            component.widgets.forEach((widget) => {
                delete widgetToComponentClassMapping[widget];
            });
        }

        delete componentClassToWidgetsMapping[componentClass];
        delete componentClassToAliasesMapping[componentClass];
        delete componentClassToFsPathMapping[componentClass];
        delete componentClassToRequiresMapping[componentClass];
        delete componentClassToConfigsMapping[componentClass];
        delete componentClassToPropertiesMapping[componentClass];
        delete componentClassToMethodsMapping[componentClass];
        delete componentClassToComponentsMapping[componentClass];
    }
}


function handleClassLine(line: string, markdown: MarkdownString)
{
    let classLine = line.trim();
    if (classLine.match(/@[\w]+ /))
    {
        const lineParts = line.trim().split(" ");
        classLine = italic(lineParts[0], false, true);
        if (lineParts.length > 1)
        {
            lineParts.shift();
            classLine += bold(lineParts[0], true, true);
            if (lineParts.length > 1)
            {
                lineParts.shift();
                classLine += MarkdownChars.NewLine + lineParts.join(" ");
            }
        }
    }
    log.logValue("      insert class line", classLine, 4);
    markdown.appendMarkdown(classLine);
}


function handleDeprecatedLine(line: string, markdown: MarkdownString)
{
    let textLine = line.trim();
    textLine = italic(textLine, false, true);
    log.logValue("      insert deprecated line", textLine, 4);
    markdown.appendMarkdown(textLine);
}


function handleObjectLine(line: string, property: string, markdown: MarkdownString)
{
    let cfgLine = "";
    if (line.startsWith("@")) {
        const lineParts = line.split(property);
        cfgLine = lineParts[0] + boldItalic(property) + " " + lineParts[1];
    }
    else {
        cfgLine = line.trim();
    }
    log.logValue("      insert object line", cfgLine, 4);
    markdown.appendMarkdown(cfgLine);
}


function handleParamLine(line: string, trailers: string[], markdown: MarkdownString)
{
    if (!line.startsWith("@"))
    {
        log.logValue("      insert param text line", line, 4);
        markdown.appendMarkdown(line);
        return;
    }

    let lineProperty = "", lineType = "",
        lineValue = "", lineTrail = "";
    const lineParts = line.split(" ");
    //
    // Examples:
    //
    //     @param {Object} opt Delivery options.
    //     @param {String} msg The specific error message.
    //     Some more descriptive text about the above property.
    //     @param {Boolean} [show=true]  Show the button to open a help desk ticket
    //     Some more descriptive text about the above property.
    //
    // Trailing line text i.e. 'Some more descriptive text about the above property' gets
    // stored into 'lineTrail'.  THis is placed "before" the default value extracted from a
    // first line i.e. [show=true].
    //
    if (lineParts.length > 1)
    {   //
        // Check for no type i.e. @param propName the description here
        //
        if (!lineParts[1].match(/\{[A-Z]+\}/i))
        {
            lineType = "";
            lineProperty = lineParts[1];
            if (lineParts.length > 2)
            {
                lineParts.shift();
                lineParts.shift();
                lineTrail = lineParts.join(" ");
            }
            else {
                lineParts.shift();
                lineTrail = "";
            }
        }
        //
        // Has type i.e. @param {String} propName the description here
        //
        else if (lineParts.length > 2)
        {
            lineType = lineParts[1];
            lineProperty = lineParts[2];
            if (lineParts.length > 3)
            {
                lineParts.shift();
                lineParts.shift();
                lineParts.shift();
                lineTrail = lineParts.join(" ");
            }
        }
    }

    //
    // If no property name was found, then there's nothing to add to the markdown, exit
    //
    if (!lineProperty) {
        return;
    }

    log.logValue("          name", lineProperty, 4);
    log.logValue("          type", lineType, 4);

    if (lineType)
    {
        lineType = lineType.replace(/[\{\}]/g, "");
    }

    //
    // Check for a default value, for example:
    //
    //     @param {Boolean} [debug=true] Set to `true` to...
    //
    // If a default value is found, set 'lineValue' and this is added to the 'trailers'
    // array to be placed at the end of the params documentation body
    //
    if (lineProperty.match(/\[[A-Z0-9]+=[A-Z0-9"'`]+\]/i))
    {
        lineProperty = lineProperty.replace(/[\[\]]/g, "");
        const paramParts = lineProperty.split("=");
        lineProperty = paramParts[0];
        lineValue = paramParts[1];
    }

    let paramLine = italic("@param", false, true) + boldItalic(lineProperty, false, true) +
                    italic(MarkdownChars.TypeWrapBegin + lineType + MarkdownChars.TypeWrapEnd);
    if (lineTrail) {
        paramLine += " " + MarkdownChars.LongDash + lineTrail;
    }
    log.logValue("      param line", paramLine, 4);
    if (!markdown.value.endsWith(MarkdownChars.NewLine)) {
        markdown.appendMarkdown(MarkdownChars.NewLine);
    }
    markdown.appendMarkdown(paramLine);

    if (lineValue)
    {
        trailers.push(MarkdownChars.NewLine + "- " + italic("Defaults to:") + " `" +
                      lineValue.replace(/`/g, "") + "`" +  MarkdownChars.NewLine +  MarkdownChars.NewLine);
    }
    else {
        markdown.appendMarkdown(MarkdownChars.NewLine);
    }
}


function handleReturnsLine(line: string, markdown: MarkdownString)
{
    const rtnLineParts = line.trim().split(" ");
    let rtnLine = MarkdownChars.Italic + rtnLineParts[0] + MarkdownChars.Italic + " ";
    rtnLineParts.shift();
    rtnLine += rtnLineParts.join(" ");
    rtnLine = rtnLine.replace(/\*@return[s]{0,1}\* \{[A-Za-z]+\}/, (matched) => {
         return matched.replace(/\{[A-Za-z]+\}/, (matched2) => {
             return italic(matched2.replace("{", MarkdownChars.TypeWrapBegin)
                                   .replace("}", MarkdownChars.TypeWrapEnd));
         });
    });
    log.logValue("      insert returns line", rtnLine, 4);
    markdown.appendMarkdown(MarkdownChars.NewLine + rtnLine);
}


function handleTagLine(line: string, markdown: MarkdownString)
{
    let textLine = line.trim();
    textLine = italic(textLine, false, true);
    log.logValue("      insert tag line", textLine, 4);
    markdown.appendMarkdown(textLine);
}


function handleTextLine(line: string, markdown: MarkdownString)
{
    let textLine = line.trim();
    if (textLine.match(/@[\w]+ /))
    {
        const lineParts = line.trim().split(" ");
        textLine = italic(lineParts[0], false, true);
        if (lineParts.length > 1) {
            lineParts.shift();
            textLine += lineParts.join(" ");
        }
    }
    if (textLine.match(/\{\s*@link [\w]+\s*\}/))
    {
        textLine = textLine.replace(/\{\s*@link [\w]+\s*\}/, (matched) => {
            return boldItalic(matched);
       });
    }
    log.logValue("      insert text line", textLine, 4);
    markdown.appendMarkdown(textLine);
}


function italic(text: string, leadingSpace?: boolean, trailingSpace?: boolean)
{
    return (leadingSpace ? " " : "") + MarkdownChars.Italic + text +
           MarkdownChars.Italic + (trailingSpace ? " " : "");
}


export default ExtjsLanguageManager;
