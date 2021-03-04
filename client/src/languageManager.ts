
import * as path from "path";
import {
    Disposable, ExtensionContext, Progress, TextDocumentChangeEvent, Range, Position,
    ProgressLocation, TextDocument, TextEditor, window, workspace, Uri, FileDeleteEvent, ConfigurationChangeEvent
} from "vscode";
import ServerRequest from "./common/ServerRequest";
import { fsStorage } from "./common/fsStorage";
import { storage } from "./common/storage";
import { configuration } from "./common/configuration";
import { IAlias, IConfig, IComponent, IMethod, IConf, IProperty, IXtype, utils, ComponentType, IVariable } from  "../../common";
import * as log from "./common/log";
import { CommentParser } from "./common/commentParser";
import { ConfigParser } from "./common/configParser";


export interface ILineProperties
{
    property?: string;
    cmpClass?: string;
    cmpType?: ComponentType;
}


class ExtjsLanguageManager
{
    private isIndexing = true;
    private config: IConf[] = [];
    private serverRequest: ServerRequest;
    private reIndexTaskId: NodeJS.Timeout | undefined;
    private dirNamespaceMap: Map<string, string> = new Map<string, string>();
    private commentParser: CommentParser;
    private configParser: ConfigParser;

    private widgetToComponentClassMapping: { [widget: string]: string | undefined } = {};
    private configToComponentClassMapping: { [property: string]: string | undefined } = {};
    private methodToComponentClassMapping: { [method: string]: string | undefined } = {};
    private propertyToComponentClassMapping: { [method: string]: string | undefined } = {};
    private xtypeToComponentClassMapping: { [method: string]: string | undefined } = {};
    private fileToComponentClassMapping: { [fsPath: string]: string | undefined } = {};
    private variablesToComponentClassMapping: { [variable: string]: IComponent | undefined } = {};
    private variablesToMethodMapping: { [variable: string]: IMethod | undefined } = {};

    private componentClassToWidgetsMapping: { [componentClass: string]: string[] | undefined } = {};
    private componentClassToRequiresMapping: { [componentClass: string]: string[] | undefined } = {};
    private componentClassToFsPathMapping: { [componentClass: string]: string | undefined } = {};
    private componentClassToXTypesMapping: { [componentClass: string]: IXtype[] | undefined } = {};
    private componentClassToConfigsMapping: { [componentClass: string]: IConfig[] | undefined } = {};
    private componentClassToPropertiesMapping: { [componentClass: string]: IProperty[] | undefined } = {};
    private componentClassToMethodsMapping: { [componentClass: string]: IMethod[] | undefined } = {};
    private componentClassToComponentsMapping: { [componentClass: string]: IComponent | undefined } = {};
    private componentClassToFilesMapping: { [componentClass: string]: string | undefined } = {};
    private componentClassToAliasesMapping: { [componentClass: string]: IAlias[] | undefined } = {};
    private componentClassToVariablesMapping: { [componentClass: string]: IVariable[] | undefined } = {};
    private methodToVariablesMapping: { [componentClass: string]: IVariable[] | undefined } = {};


    constructor(serverRequest: ServerRequest)
    {
        this.serverRequest = serverRequest;
        this.commentParser = new CommentParser();
        this.configParser = new ConfigParser();
    }


    getAlias(cmp: string, alias: string): IXtype | undefined
    {
        const aliases = this.componentClassToAliasesMapping[cmp];
        log.write("get config by component class", 1);
        log.value("   component class", cmp, 2);
        log.value("   alias", alias, 2);
        if (aliases) {
            for (let c = 0; c < aliases.length; c++) {
                if (aliases[c].name.replace("widget.", "") === alias) {
                    log.write("   found config", 3);
                    log.value("      name", aliases[c].name, 4);
                    log.value("      start", aliases[c].start.line + ", " + aliases[c].start.column, 4);
                    log.value("      end", aliases[c].end.line + ", " + aliases[c].end.column, 4);
                    return aliases[c];
                }
            }
        }
        return undefined;
    }


    getAliasNames(): string[]
    {
        const aliases: string[] = [],
              amap = this.componentClassToAliasesMapping;

        Object.entries(amap).forEach(([ cls, alias ]) =>
        {
            if (cls && alias)
            {
                for (const a of alias) {
                    aliases.push(a.name);
                }
            }
        });
        return aliases;
    }


    getClassFromPath(fsPath: string)
    {
        //
        // TODO - check / test file delete
        //
        let cmpClass: string | undefined;
        const wsf = workspace.getWorkspaceFolder(Uri.file(fsPath));

        log.write("get component by fs path", 1);
        log.value("   path", fsPath, 2);

        for (const conf of this.config)
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

        log.value("   component class", cmpClass, 2);
        return cmpClass;
    }


    /**
     * @method getNamespaceFromFile
     *
     * @param fsPath Filesystem path to file
     * @param part Zero-based index of namespace part to return
     */
    getNamespaceFromFile(fsPath: string, part?: number): string | undefined
    {
        log.methodStart("get component class by file", 1, "   ", false, [["file", fsPath]]);
        const cls = this.fileToComponentClassMapping[fsPath];
        if (cls){
            log.write("   found base class", 3);
            return cls.split(".")[part ?? 0];
        }
        return undefined;
    }


    getClassFromFile(fsPath: string, logPad = ""): string | undefined
    {
        log.methodStart("get component class by file", 1, logPad, false, [["file", fsPath]]);
        const cls = this.fileToComponentClassMapping[fsPath];
        if (cls) {
            log.write("   found component class", 3, logPad);
            return cls;
        }
        return undefined;
    }


    getComponent(componentClass: string, checkAlias?: boolean, fsPath?: string): IComponent | undefined
    {
        if (fsPath && componentClass === "this")
        {
            componentClass = this.getClassFromFile(fsPath) || "this";
            if (componentClass === "this") {
                return undefined;
            }
        }

        let component = this.componentClassToComponentsMapping[componentClass];

        log.write("get component by class", 1);
        log.value("   component class", componentClass, 2);

        if (component)
        {
            log.write("   found component", 3);
            log.value("      namespace", component.nameSpace, 4);
            log.value("      base namespace", component.baseNameSpace, 4);
        }

        if (!component && checkAlias === true)
        {
            component = this.getComponentByAlias(componentClass);
            if (component) {
                log.write("   found aliased component", 3);
                log.value("      namespace", component.nameSpace, 4);
                log.value("      base namespace", component.baseNameSpace, 4);
            }
        }

        if (!component && fsPath)
        {
            component = this.getComponentInstance(componentClass, fsPath);
            if (component) {
                log.write("   found instanced component", 3);
                log.value("      namespace", component.nameSpace, 4);
                log.value("      base namespace", component.baseNameSpace, 4);
            }
        }

        return component;
    }


    getComponentNames(): string[]
    {
        const cmps: string[] = [],
              map = this.componentClassToComponentsMapping;
        Object.keys(map).forEach((cls) =>
        {
            cmps.push(cls);
        });
        return cmps;
    }


    getComponentByAlias(alias: string): IComponent | undefined
    {
        const cls = this.widgetToComponentClassMapping[alias];
        log.write("get component by alias", 1);
        log.value("   component alias", alias, 2);
        if (cls) {
            const component = this.getComponent(cls);
            if (component) {
                log.write("   found component", 3);
                log.value("      namespace", component.nameSpace, 4);
                log.value("      base namespace", component.baseNameSpace, 4);
                return component;
            }
        }
        return undefined;
    }


    getComponentByFile(fsPath: string): IComponent | undefined
    {
        const cls = this.getClassFromFile(fsPath);
        log.write("get component by file", 1);
        log.value("   component file", fsPath, 2);
        if (cls) {
            const component = this.getComponent(cls);
            if (component) {
                log.write("   found component", 3);
                log.value("      namespace", component.nameSpace, 4);
                log.value("      base namespace", component.baseNameSpace, 4);
                return component;
            }
        }
        return undefined;
    }


    /**
     * @method getComponentClass
     *
     * Get component class name from an xtype, alias, or alternateClassName
     * Note that xtypes/aliases must be unique within an application for this /**
     * to work properly every time.
     *
     * @param {String} property Property name, i.e. an xtype, alias, or widget aliased string
     * @param {String} txt The complete line of text the property is found in
     *
     * @returns {String}
     */
    getComponentClass(property: string, cmpType?: ComponentType, txt?: string, fsPath?: string): string | undefined
    {
        let cmpClass = "this", // getComponentByConfig(property);
            cmpClassPre, cmpClassPreIdx = -1, cutAt = 0;

        if (!txt)
        {
            if (!cmpType || cmpType === ComponentType.Widget) {
                return this.widgetToComponentClassMapping[property];
            }
            else if (cmpType === ComponentType.Method) {
                return this.methodToComponentClassMapping[property];
            }
            else if (cmpType === ComponentType.Property) {
                return this.propertyToComponentClassMapping[property];
            }
            // else if (cmpType & (ComponentType.Property | ComponentType.Config)) {
            else if (cmpType === ComponentType.Config) {
                // if (this.propertyToComponentClassMapping[property]) {
                //     return this.propertyToComponentClassMapping[property];
                // }
                return this.configToComponentClassMapping[property];
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
        if (aliasClass = this.widgetToComponentClassMapping[cmpClass])
        {
            cmpClass = aliasClass;
        }

        //
        // Instances
        //
        if (fsPath && !this.getComponent(cmpClass, true))
        {
            const instance = this.getComponentInstance(cmpClass, fsPath);
            if (instance) {
                cmpClass = instance.componentClass;
            }
        }

        log.blank(1);
        log.value("class", cmpClass, 1);
        return cmpClass;
    }


    getComponentInstance(property: string, fsPath: string)
    {
         //
        // Check instance properties
        //

        const thisCls = this.getClassFromFile(fsPath);
        if (!thisCls) {
            return;
        }

        const cmp = this.getComponent(thisCls) || this.getComponentByAlias(thisCls);
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
                        const instanceCmp = this.getComponent(variable.componentClass) || this.getComponentByAlias(variable.componentClass);
                        if (instanceCmp && instanceCmp.markdown)
                        {
                            log.value("provide instance class hover info", property, 1);
                            return instanceCmp;
                        }
                    }
                }
            }
        }
    }


    getConfig(cmp: string, property: string): IConfig | undefined
    {
        const configs = this.componentClassToConfigsMapping[cmp];
        log.write("get config by component class", 1);
        log.value("   component class", cmp, 2);
        log.value("   config", property, 2);
        if (configs) {
            for (let c = 0; c < configs.length; c++) {
                if (configs[c].name === property) {
                    log.write("   found config", 3);
                    log.value("      name", configs[c].name, 4);
                    log.value("      start", configs[c].start.line + ", " + configs[c].start.column, 4);
                    log.value("      end", configs[c].end.line + ", " + configs[c].end.column, 4);
                    return configs[c];
                }
            }
        }
        return undefined;
    }


    getFilePath(componentClass: string)
    {
        const fsPath = this.componentClassToFsPathMapping[componentClass];
        log.write("get fs path by component", 1);
        log.value("   path", fsPath, 2);
        return fsPath;
    }


    getLineProperties(document: TextDocument, position: Position, logPad = ""): ILineProperties
    {
        let cmpType: ComponentType = ComponentType.None;
        const range = document.getWordRangeAtPosition(position);
        if (range === undefined) {
            return {};
        }

        const line = position.line,
                nextLine = document.lineAt(line + 1);
        let lineText = document.getText(new Range(new Position(line, 0), nextLine.range.start))
                                .trim().replace(/[\s\w]+=[\s]*(new)*\s*/, ""),
            property = document.getText(range);

        log.methodStart("get line properties", 1, logPad);

        if (property === "this")
        {
            // TODO - this definition
        }

        //
        // Class string literals
        // Match string literal class, e.g.:
        //
        //     Ext.create("Ext.data.Connection", {
        //     Ext.create("Ext.panel.Panel", {
        //     requires: [ "MyApp.common.Utilities" ]
        //
        if (lineText.match(new RegExp(`["']{1}[\\w.]*.${property}[\\w.]*["']{1}`)) ||
            lineText.match(new RegExp(`["']{1}[\\w.]*${property}.[\\w.]*["']{1}`)))
        {
            cmpType = ComponentType.Class;
            //
            // Strip off everything outside the quotes to get our full class name, i.e.
            //
            //     MyApp.common.Utilities
            //
            lineText = lineText.replace(/^[^"']*["']{1}/, "").replace(/["']{1}[\w\W]*$/, "");
            //
            // Set the property to the last piece of the class name.  We want the effect that clicking
            // anywhere within the string references th  entore component class, not just the "part" that
            // gets looked at when doing a goto def for a non-quoted class variable/path
            //
            const strParts = lineText.split(".");
            property = strParts[strParts.length - 1];
        }
        //
        // Methods
        // Match function/method signature type, e.g.
        //
        //     testFn();
        //
        else if (lineText.match(new RegExp(`${property}\\s*\\([ \\W\\w\\{]*\\)\\s*;\\s*$`)))
        {
            cmpType = ComponentType.Method;
        }
        //
        // Properties / configs
        //
        else if (lineText.match(new RegExp(`.${property}\\s*[;\\)]+\\s*$`)))
        {
            cmpType = ComponentType.Property;
        }
        //
        // Classes (non string literal)
        //
        else if (lineText.match(new RegExp(`(.|^\\s*)${property}.[\\W\\w]*$`)))
        {
            cmpType = ComponentType.Class;
        }

        let cmpClass: string | undefined;
        const thisPath = window.activeTextEditor?.document?.uri.fsPath;

        log.value("   property", property, 2, logPad);
        log.value("   component type", cmpType, 2, logPad);

        if (cmpType === ComponentType.Class)
        {
            cmpClass = lineText.substring(0, lineText.indexOf(property) + property.length);
            //
            // Check for "instance" type
            //
            const cls = this.variablesToComponentClassMapping[property];
            if (cls) {
                const variable = this.componentClassToVariablesMapping[cls.name]?.find(v => v.name === property);
                if (variable) {
                    cmpClass = variable.componentClass;
                }
            }
        }
        else
        {
            cmpClass = this.getComponentClass(property, cmpType, lineText, thisPath);
            if (!cmpClass)
            {   //
                // If this is a method, check for getter/setter for a config property...
                //
                if (cmpType === ComponentType.Method && (property.startsWith("get") || property.startsWith("set")))
                {
                    log.write("   method not found, look for getter/setter config", 2, logPad);
                    property = utils.lowerCaseFirstChar(property.substring(3));
                    cmpType = ComponentType.Config;
                    log.value("      config name", property, 2, logPad);
                    cmpClass = this.getComponentClass(property, cmpType, lineText, thisPath);
                }
                //
                // If this is a property, check for a config property...
                //
                else if (cmpType === ComponentType.Property)
                {
                    log.write("   property not found, look for config", 2, logPad);
                    cmpType = ComponentType.Config;
                    cmpClass = this.getComponentClass(property, cmpType, lineText, thisPath);
                }
            }
            else
            {
                if (cmpType === ComponentType.Property)
                {
                    const cfgCls = this.getComponentClass(property, ComponentType.Config);
                    if (cfgCls)
                    {
                        log.write("   look for config", 2, logPad);
                        cmpType = ComponentType.Config;
                        cmpClass = cfgCls;
                    }
                }
            }
        }

        log.value("   component class", cmpClass, 2, logPad);

        return { cmpClass, cmpType, property };
    }


    getProperty(cmp: string, property: string): IProperty | undefined
    {
        const properties = this.componentClassToPropertiesMapping[cmp];
        log.write("get property by component class", 1);
        log.value("   component class", cmp, 2);
        log.value("   property", property, 2);
        if (properties) {
            for (let c = 0; c < properties.length; c++) {
                if (properties[c].name === property) {
                    log.write("   found property", 3);
                    log.value("      name", properties[c].name, 4);
                    log.value("      start (line/col)",  properties[c].start.line + ", " + properties[c].start.column, 4);
                    log.value("      end (line/col)", properties[c].end.line + ", " + properties[c].end.column, 4);
                    return properties[c];
                }
            }
        }
        return undefined;
    }


    getMethod(cmp: string, property: string): IMethod| undefined
    {
        const methods = this.componentClassToMethodsMapping[cmp];
        log.write("get config by method", 1);
        log.value("   component class", cmp, 2);
        log.value("   property", property, 2);
        if (methods)
        {
            for (let c = 0; c < methods.length; c++)
            {
                if (methods[c].name === property) {
                    log.write("   found method", 3);
                    log.value("      name", methods[c].name, 4);
                    log.value("      start (line/col)",  methods[c].start.line + ", " + methods[c].start.column, 4);
                    log.value("      end (line/col)", methods[c].end.line + ", " + methods[c].end.column, 4);
                    return methods[c];
                }
            }
        }
        return undefined;
    }


    getSubComponentNames(componentClass: string): string[]
    {
        const subComponentNames: string[] = [],
              map = this.componentClassToComponentsMapping;

        log.write("get component by class", 1);
        log.value("   component class", componentClass, 2);

        Object.keys(map).forEach((cls) =>
        {
            if (cls && cls.startsWith(componentClass))
            {
                const subCMp = cls.replace(componentClass + ".", "").split(".")[0];
                if (subCMp) {
                    subComponentNames.push(subCMp);
                }
            }
        });

        return subComponentNames;
    }


    getXType(cmp: string, xtype: string): IXtype | undefined
    {
        const xtypes = this.componentClassToXTypesMapping[cmp];
        log.write("get config by component class", 1);
        log.value("   component class", cmp, 2);
        log.value("   xtype", xtype, 2);
        if (xtypes) {
            for (let c = 0; c < xtypes.length; c++) {
                if (xtypes[c].name === xtype) {
                    log.write("   found config", 3);
                    log.value("      name", xtypes[c].name, 4);
                    log.value("      start", xtypes[c].start.line + ", " + xtypes[c].start.column, 4);
                    log.value("      end", xtypes[c].end.line + ", " + xtypes[c].end.column, 4);
                    return xtypes[c];
                }
            }
        }
        return undefined;
    }


    getWidgetNames(): string[]
    {
        const aliases: string[] = [],
              amap = this.componentClassToWidgetsMapping;

        Object.entries(amap).forEach(([ cls, widget ]) =>
        {
            if (cls && widget)
            {
                for (const a of widget) {
                    aliases.push(a);
                }
            }
        });
        return aliases;
    }


    private handleDeleFile(fsPath: string)
    {
        const componentClass = this.getClassFromPath(fsPath);
        if (componentClass)
        {
            log.write("handle file depetion", 1);
            log.value("   path", fsPath, 2);
            log.value("   component class", componentClass, 2);

            const component = this.getComponent(componentClass);
            if (component)
            {
                // component.aliases.forEach((alias) => {
                //     delete aliasToComponentClassMapping[alias];
                // });

                component.configs.forEach((config) => {
                    delete this.configToComponentClassMapping[config.name];
                });

                component.methods.forEach((method) => {
                    delete this.methodToComponentClassMapping[method.name];
                    method.variables?.forEach((v) => {
                        delete this.variablesToComponentClassMapping[v.name];
                    });
                });

                // component.privates.forEach((private) => {
                //     delete privateToComponentClassMapping[private.name];
                // });

                component.properties.forEach((property) => {
                    delete this.propertyToComponentClassMapping[property.name];
                });

                // component.statics.forEach((static) => {
                //     delete configToComponentClassMapping[static.name];
                // });

                component.widgets.forEach((widget) => {
                    delete this.widgetToComponentClassMapping[widget];
                });
            }

            delete this.componentClassToWidgetsMapping[componentClass];
            delete this.componentClassToAliasesMapping[componentClass];
            delete this.componentClassToFsPathMapping[componentClass];
            delete this.componentClassToRequiresMapping[componentClass];
            delete this.componentClassToConfigsMapping[componentClass];
            delete this.componentClassToPropertiesMapping[componentClass];
            delete this.componentClassToMethodsMapping[componentClass];
            delete this.componentClassToComponentsMapping[componentClass];
            delete this.componentClassToVariablesMapping[componentClass];
            delete this.methodToVariablesMapping[componentClass];
        }
    }


    async initialize(context: ExtensionContext): Promise<Disposable[]>
    {
        this.config = await this.configParser.getConfig();
        if (this.config.length === 0) {
            window.showInformationMessage("Could not find any app.json or .extjsrc.json files");
            return [];
        }

        //
        // Do full indexing
        //
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


    isBusy()
    {
        return this.isIndexing;
    }


    private getNamespace(document: TextDocument | undefined)
    {
        if (document) {
            return this.dirNamespaceMap.get(path.dirname(document.uri.fsPath)) || "Ext";
        }
        return "Ext";
    }


    private getStorageKey(fsPath: string)
    {
        const wsf = workspace.getWorkspaceFolder(Uri.file(fsPath));
        if (wsf) {
            return fsPath.replace(wsf.uri.fsPath, "");
        }
        return Uri.file(fsPath).path;
    }


    private async indexAll(progress?: Progress<any>)
    {
        const processedDirs: string[] = [],
              cfgPct = this.config && this.config.length ? 100 / this.config.length : 100;
        let currentCfgIdx = 0;

        const _isIndexed = ((dir: string) =>
        {
            for (const d of processedDirs)
            {   //
                // Dont process dirs already processed.  If dirs in a user's config overlap eachother
                // then something might get missed so it's on the user to make sure their paths are
                // set correctly, in app.json and/or .extjsrc files.
                //
                // if (d === dir || d.indexOf(dir) !== -1 || dir.indexOf(d) !== -1) {
                if (d === dir) {
                    return true;
                }
            }
            return false;
        });

        log.methodStart("indexing all", 1, "", true, [[ "# of configs", this.config.length ]]);

        for (const conf of this.config)
        {
            let currentFileIdx = 0,
                numFiles = 0,
                dirs: string[] = [];

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

            const increment = Math.round(1 / numFiles * cfgPct);

            log.blank();
            log.value("   # of files to index", numFiles, 1);

            for (const dir of dirs)
            {
                if (!_isIndexed(dir))
                {
                    const uris = await workspace.findFiles(`${dir}/**/*.js`);
                    for (const uri of uris)
                    {
                        log.blank();
                        log.value("   Indexing file", uri.fsPath, 1);
                        //
                        // Index this file
                        //
                        try {
                            await this.indexFile(uri.fsPath, conf.name, uri, "   ");
                        }
                        catch (e) {
                            log.error(e.toString());
                            break;
                        }
                        //
                        // Report progress
                        //
                        const pct = (cfgPct * currentCfgIdx) + Math.round(++currentFileIdx / numFiles * (100 / this.config.length));
                        progress?.report({
                            increment,
                            message: pct + "%"
                        });
                        // statusBarSpace.text = getStatusString(pct);
                    }
                    processedDirs.push(dir);
                    this.dirNamespaceMap.set(path.join(conf.baseDir, dir), conf.name);
                }
            }

            progress?.report({
                increment,
                message: Math.round(++currentCfgIdx * cfgPct) + "%"
            });
        }

        log.methodDone("indexing all", 1, "", true);
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
            this.isIndexing = true;
            try {
                await this.indexAll(progress);
            }
            catch {}
            this.isIndexing = false;
        });
    }


    async indexFile(fsPath: string, project: string, document: TextDocument | Uri, logPad = ""): Promise<IComponent[] | false | undefined>
    {
        const storageKey = this.getStorageKey(fsPath),
              storedComponents = fsStorage?.get(project, storageKey),
              storedTimestamp = storage?.get<Date>(storageKey + "_TIMESTAMP");
        let components: IComponent[] | undefined;

        //
        // TODO - Store only set of files from framework, or one per version
        // i.e. a user can have 5 projects all with the same 7.2 framework local to the project,
        // we dont want to process or store each copy of the same set of files, only one copy
        // Will need to use relative path storage keys.
        //

        log.methodStart("indexing " + fsPath, 2, logPad, true, [
            [ "project", project ],
            [ "stored timestamp", storedTimestamp ]
        ]);

        //
        // Get components for this file from the Language Server or local storage if exists
        //
        if (!storedComponents)
        {
            let text: string | undefined;
            if (document instanceof Uri) {
                text = (await workspace.fs.readFile(document)).toString();
            }
            else {
                text = document.getText();
            }
            if (!utils.isExtJsFile(text)) {
                return false;
            }
            components = await this.serverRequest.parseExtJsFile(fsPath, project, text);
        }
        else {
            components = JSON.parse(storedComponents);
            await this.serverRequest.loadExtJsComponent(storedComponents);
        }

        //
        // If no commponenst, then bye
        //
        if (!components || components.length === 0) {
            return;
        }
        log.value("   # of stored components", components.length, 3);

        //
        // Loog the list of components and create component mappings
        //
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
                cmp.markdown = this.commentParser.toMarkdown(componentClass, cmp.doc, logPad + "   ");
            }

            log.write("   map classes to components", 2, logPad);

            //
            // Map the component class to the various component types found
            //
            this.componentClassToFsPathMapping[componentClass] = fsPath;
            this.componentClassToWidgetsMapping[componentClass] = widgets;
            this.componentClassToMethodsMapping[componentClass] = methods;
            this.componentClassToConfigsMapping[componentClass] = configs;
            this.componentClassToPropertiesMapping[componentClass] = properties;
            this.componentClassToXTypesMapping[componentClass] = xtypes;
            this.componentClassToAliasesMapping[componentClass] = aliases;

            //
            // Map the filesystem path <-> component class
            //
            this.fileToComponentClassMapping[fsPath] = componentClass;
            this.componentClassToFilesMapping[componentClass] = fsPath;

            //
            // Map the component class to it's component (it's own definition)
            //
            this.componentClassToComponentsMapping[componentClass] = cmp;

            //
            // Map the component class to any requires strings found
            //
            if (requires) {
                this.componentClassToRequiresMapping[componentClass] = requires.value;
            }

            log.write("   map components to classes", 2, logPad);

            //
            // Map widget/alias/xtype types found to the component class
            //
            widgets.forEach(xtype => {
                this.widgetToComponentClassMapping[xtype] = componentClass;
            });

            //
            // Map methods found to the component class
            //
            methods.forEach(method => {
                method.markdown = this.commentParser.toMarkdown(method.name, method.doc, logPad + "   ");
                this.methodToComponentClassMapping[method.name] = componentClass;
                if (method.params)
                {
                    for (const p of method.params)
                    {
                        if (p.doc) {
                            p.markdown = this.commentParser.toMarkdown(p.name, p.doc, logPad + "   ");
                        }
                    }
                }
                if (method.variables)
                {
                    const varMapping = this.componentClassToVariablesMapping[componentClass];
                    if (!varMapping) {
                        this.componentClassToVariablesMapping[componentClass] = [ ...method.variables ];
                    }
                    else {
                        varMapping.push(...method.variables);
                    }
                    for (const v of method.variables)
                    {
                        this.variablesToComponentClassMapping[v.name] = cmp;
                        this.variablesToMethodMapping[v.name] = method;
                    }
                }
            });

            //
            // Map config properties found to the component class
            //
            configs.forEach(config => {
                config.markdown = this.commentParser.toMarkdown(config.name, config.doc, logPad + "   ");
                this.configToComponentClassMapping[config.name] = componentClass;
            });

            //
            // Map properties found to the component class
            //
            properties.forEach(property => {
                property.markdown = this.commentParser.toMarkdown(property.name, property.doc, logPad + "   ");
                this.propertyToComponentClassMapping[property.name] = componentClass;
            });

            //
            // Map xtypes found to the component class
            //
            xtypes.forEach(xtype => {
                this.xtypeToComponentClassMapping[xtype.name] = componentClass;
            });
        });

        //
        // Update local storage
        //
        if (project) {
            await fsStorage?.update(project, storageKey, JSON.stringify(components));
            await storage?.update(storageKey + "_TIMESTAMP", new Date());
        }

        log.methodDone("indexing " + fsPath, 2, logPad, true);

        return components;
    }


    private async processConfigChange(e: ConfigurationChangeEvent)
    {
        if (e.affectsConfiguration("extjsLangSvr.ignoreErrors"))
        {
            this.reIndexTaskId = undefined;
            const document = window.activeTextEditor?.document,
                  fsPath = document?.uri.fsPath,
                  ns = this.getNamespace(document);
            if (document && fsPath)
            {   //
                // Clear
                //
                this.handleDeleFile(fsPath);
                //
                // Index the file
                //
                const components = await this.indexFile(fsPath, ns, document);
                //
                // Validate document
                //
                if (components && components.length > 0) {
                    this.validateDocument(document, ns);
                }
            }
        }
    }


    private processDocumentChange(e: TextDocumentChangeEvent)
    {
        const debounceMs = configuration.get<number>("validationDelay", 1250),
             textDocument = e.document;
        if (textDocument.languageId === "javascript")
        {   //
            // Debounce!!
            //
            if (this.reIndexTaskId) {
                clearTimeout(this.reIndexTaskId);
            }
            this.reIndexTaskId = setTimeout(async () =>
            {
                this.reIndexTaskId = undefined;
                const fsPath = textDocument.uri.fsPath,
                      ns = this.getNamespace(textDocument);
                //
                // Clear
                //
                this.handleDeleFile(fsPath);
                //
                // Index the file
                //
                const components = await this.indexFile(textDocument.uri.fsPath, ns, textDocument);
                //
                // Validate document
                //
                if (components && components.length > 0) {
                    this.validateDocument(textDocument, ns);
                }
            }, debounceMs);
        }
    }


    private processDocumentDelete(e: FileDeleteEvent)
    {
        e.files.forEach(async file =>
        {
            this.handleDeleFile(file.fsPath);
            const activeTextDocument = window.activeTextEditor?.document;
            if (activeTextDocument && activeTextDocument.languageId === "javascript") {
                this.validateDocument(activeTextDocument, this.getNamespace(activeTextDocument));
            }
        });
    }


    private processDocumentOpen(textDocument: TextDocument)
    {
        if (textDocument.languageId === "javascript") {
           this.validateDocument(textDocument, this.getNamespace(textDocument));
        }
    }


    private processEditorChange(e: TextEditor | undefined)
    {
        const textDocument = e?.document;
        if (textDocument) {
            if (textDocument.languageId === "javascript") {
                this.validateDocument(textDocument, this.getNamespace(textDocument));
            }
        }
    }


    /**
     * @method registerWatchers
     *
     * Register application event watchers - Document open/change/delete, config file filesystem,
     * settings/config
     *
     * @private
     *
     * @param context VSCode extension context
     */
    private registerWatchers(context: ExtensionContext): Disposable[]
    {
        //
        // rc/conf file / app.json
        //
        const disposables: Disposable[] = [];

        //
        // Config watcher
        //
        const confWatcher = workspace.createFileSystemWatcher("{.extjsrc{.json,},app.json}");
        disposables.push(confWatcher.onDidChange(async (e) => { this.config = await this.configParser.getConfig(); }, this));

        //
        // Open dcument text change
        //
        disposables.push(workspace.onDidChangeTextDocument((e) => { this.processDocumentChange(e); }, this));
        // disposables.push(workspace.onDidChangeTextDocument((e) => this.processDocumentChange));
        //
        // Deletions
        //
        disposables.push(workspace.onDidDeleteFiles((e) => { this.processDocumentDelete(e); }, this));
        //
        // Active editor changed
        //
        disposables.push(window.onDidChangeActiveTextEditor((e) => { this.processEditorChange(e); }, this));
        //
        // Open text document
        //
        disposables.push(workspace.onDidOpenTextDocument((e) => { this.processDocumentOpen(e); }, this));
        //
        // Register configurations/settings change watcher
        //
        disposables.push(workspace.onDidChangeConfiguration((e) => { this.processConfigChange(e); }, this));

        context.subscriptions.push(...disposables);
        return disposables;
    }


    async validateDocument(textDocument?: TextDocument, nameSpace?: string)
    {
        if (!textDocument) {
            textDocument = window.activeTextEditor?.document;
        }
        if (textDocument)
        {
            const text = textDocument.getText();
            if (!nameSpace) {
                nameSpace = this.getNamespace(textDocument);
            }
            if (!utils.isExtJsFile(text)) {
                return;
            }
            await this.serverRequest.validateExtJsFile(textDocument.uri.path, nameSpace, text);
        }
    }

}


export default ExtjsLanguageManager;
