
import {
    Disposable, ExtensionContext, Progress, TextDocumentChangeEvent, Range, Position,
    ProgressLocation, TextDocument, TextEditor, window, workspace, Uri, FileDeleteEvent,
    ConfigurationChangeEvent,
    commands
} from "vscode";
import {
    IAlias, IConfig, IComponent, IMethod, IConf, IProperty, IXtype, utils, ComponentType,
    IVariable, VariableType, IExtJsBase, IPrimitive, IRequire
} from  "../../common";

import {
    toVscodeRange, toVscodePosition, isPositionInRange, isComponent, isExcluded
} from "./common/clientUtils";
import * as log from "./common/log";
import * as path from "path";
import ServerRequest from "./common/ServerRequest";
import { EOL } from "os";
import { pathExists } from "../../common/lib/fs";
import { fsStorage } from "./common/fsStorage";
import { storage } from "./common/storage";
import { configuration } from "./common/configuration";
import { CommentParser } from "./common/commentParser";
import { ConfigParser } from "./common/configParser";
import { showReIndexButton } from "./commands/indexFiles";


export interface ILineProperties
{
    property?: string;
    cmpClass?: string;
    cmp?: IComponent;
    callee?: string;
    calleeCmp?: IExtJsBase;
    thisClass?: string;
    thisCmp?: IComponent;
    cmpType?: ComponentType;
}


class ExtjsLanguageManager
{   //
    // When an update requires a re-index, change the name of this flag
    //
    private forceReIndexOnUpdateFlag = "vscode-extjs-flags-0.4";

    private isIndexing = false;
    private isValidating = false;
    private fsStoragePath = "";

    private config: IConf[] = [];
    private serverRequest: ServerRequest;
    private reIndexTaskId: NodeJS.Timeout | undefined;
    private dirNamespaceMap: Map<string, string> = new Map<string, string>();
    private commentParser: CommentParser;
    private configParser: ConfigParser;
    private components: IComponent[] = [];

    //
    // TODO - Mappings rework
    //
    // These mappings need some work.  These were pulled from the original base
    // project and there was a misunderstanding how they worked, i.e. the current mess.
    //
    // Some of these mappings are maps from a key to the component represented by the key.
    // But some of them represent a map of keys within a component.  It's a mess.  They
    // were here before the IComponent interface was put in.
    //
    // widgetToClsMapping seems to be the only useful mapping?  ALl other mappings
    // are for definitions within a component itself, which, we can just grab IComponent now
    // and don't need any of these mappings.  widgetToClsMapping is useful because
    // a respective provider can grab a class definition when doing completion or hover or
    // definition from an open file.
    //

    private widgetToClsMapping: { [nameSpace: string]: { [widget: string]: string | undefined }} = {};
    private configToClsMapping: { [nameSpace: string]: { [property: string]: string | undefined }} = {};
    private methodToClsMapping: { [nameSpace: string]: { [method: string]: string | undefined }} = {};
    private propertyToClsMapping: { [nameSpace: string]: { [method: string]: string | undefined }} = {};
    private xtypeToComponentClassMapping: { [nameSpace: string]: { [method: string]: string | undefined }} = {};
    private fileToComponentClassMapping: { [fsPath: string]: string | undefined } = {};
    private variablesToComponentMapping: { [nameSpace: string]: { [variable: string]: IComponent | undefined }} = {};
    private variablesToMethodMapping: { [nameSpace: string]: { [variable: string]: IMethod | undefined }} = {};

    private componentClassToWidgetsMapping: { [nameSpace: string]: { [componentClass: string]: string[] | undefined }} = {};
    private componentClassToRequiresMapping: { [nameSpace: string]: { [componentClass: string]: IRequire[] | undefined }} = {};
    private clsToXTypesMapping: { [nameSpace: string]: { [componentClass: string]: IXtype[] | undefined }} = {};
    private clsToConfigsMapping: { [nameSpace: string]: { [componentClass: string]: IConfig[] | undefined }} = {};
    private clsToPropertiesMapping: { [nameSpace: string]: { [componentClass: string]: IProperty[] | undefined }} = {};
    private clsToMethodsMapping: { [nameSpace: string]: { [componentClass: string]: IMethod[] | undefined }} = {};
    private clsToCmpMapping: { [nameSpace: string]: { [componentClass: string]: IComponent | undefined }} = {};
    private componentClassToFilesMapping: { [componentClass: string]: string | undefined } = {};
    private componentClassToAliasesMapping: { [nameSpace: string]: { [componentClass: string]: IAlias[] | undefined }} = {};
    private componentClassToVariablesMapping: { [nameSpace: string]: { [componentClass: string]: IVariable[] | undefined }} = {};
    private methodToVariablesMapping: { [nameSpace: string]: { [componentClass: string]: IVariable[] | undefined }} = {};


    constructor(serverRequest: ServerRequest)
    {
        this.serverRequest = serverRequest;
        this.commentParser = new CommentParser();
        this.configParser = new ConfigParser();
    }


    getAliasRef(componentClass: string, alias: string, nameSpace: string, logPad = "", logLevel = 1): IXtype | undefined
    {
        const aliases = this.componentClassToAliasesMapping[nameSpace][componentClass];
        log.methodStart("get alias", logLevel, logPad, false, [["component class", componentClass], ["alias", alias]]);
        if (aliases) {
            for (let c = 0; c < aliases.length; c++) {
                if (aliases[c].name.replace("widget.", "") === alias) {
                    log.methodDone("get alias", logLevel + 2, logPad, false, [
                        ["name", aliases[c].name],
                        ["base namespace", "start", aliases[c].start.line + ", " + aliases[c].start.column],
                        ["end", aliases[c].end.line + ", " + aliases[c].end.column]
                    ]);
                    return aliases[c];
                }
            }
        }
        log.write("   could not find alias", logLevel, logPad);
        log.methodDone("get alias", logLevel, logPad);
        return undefined;
    }


    getAliasNames(): string[]
    {
        const aliases: string[] = [],
              map = this.componentClassToAliasesMapping;

        Object.values(map).forEach((ns) => {
            Object.entries(ns).forEach(([ cls, alias ]) =>
            {
                if (cls && alias)
                {
                    for (const a of alias) {
                        if (!aliases.includes(a.name)) {
                            aliases.push(a.name);
                        }
                    }
                }
            });
        });
        return aliases;
    }


    private getAppJsonDir(fsPath: string)
    {
        for (const conf of this.config)
        {
            if (fsPath.indexOf(conf.baseDir) !== -1) {
                return conf.baseDir;
            }
        }
        return path.dirname(fsPath);
    }


    getClassFromFile(fsPath: string, logPad = "", logLevel = 1): string | undefined
    {
        let className: string | undefined;
        log.methodStart("get component class by file", logLevel, logPad, false, [["file", fsPath]]);
        const cls = this.fileToComponentClassMapping[fsPath];
        if (cls) {
            log.write("   found component class", logLevel + 1, logPad);
            className = cls;
        }
        log.methodDone("get component class by file", logLevel, logPad, false, [["component class", className]]);
        return className;
    }


    getClsToWidgetMapping()
    {
        return this.componentClassToWidgetsMapping;
    }


    getComponent(componentClass: string, nameSpace: string, checkAlias?: boolean, logPad = "", logLevel = 1): IComponent | undefined
    {
        log.methodStart("get component", logLevel, logPad, false, [["component class", componentClass], ["namespace", nameSpace]]);

        //
        // Get component from mapping
        //
        let component = this.clsToCmpMapping[nameSpace] ? this.clsToCmpMapping[nameSpace][componentClass] : undefined;
        if (!component) {
            component = this.clsToCmpMapping.Ext[componentClass];
        }
        //
        // Some namespaces will be calculated as 'Ext', i.e. Ext.csi, Ext.ux, or others that may not
        // necessarily be a part of the ExtJs Framework and the 'Ext' namespace.  Loop through all
        // the parsed namespaces and see if we can find the component
        //
        if (!component) {
            Object.keys(this.clsToCmpMapping).forEach(async (ns) => {
                component = this.clsToCmpMapping[ns][componentClass];
                return !!component;
            });
        }

        if (component)
        {
            log.write("   found component", logLevel + 2, logPad);
            log.value("      namespace", component.nameSpace, logLevel + 3, logPad);
            log.value("      base namespace", component.baseNameSpace, logLevel + 3, logPad);
        }

        if (!component && checkAlias === true)
        {
            component = this.getComponentByAlias(componentClass, nameSpace, logPad + "   ", logLevel);
            if (component) {
                log.write("   found aliased component", logLevel + 2, logPad);
                log.value("      namespace", component.nameSpace, logLevel + 3, logPad);
                log.value("      base namespace", component.baseNameSpace, logLevel + 3, logPad);
            }
        }

        log.methodDone("get component", logLevel, logPad);
        return component;
    }


    getComponentNames(): string[]
    {
        const cmps: string[] = [],
              map = this.clsToCmpMapping;
        Object.values(map).forEach((ns) => {
            Object.keys(ns).forEach((cmp) => {
                if (!cmps.includes(cmp)) {
                    cmps.push(cmp);
                }
            });
        });
        return cmps;
    }


    getComponentByAlias(alias: string, nameSpace: string, logPad = "", logLevel = 1): IComponent | undefined
    {   //
        // Get mapping
        //
        let cls = this.widgetToClsMapping[nameSpace] ? this.widgetToClsMapping[nameSpace][alias] : undefined;
        if (!cls) {
            cls = this.widgetToClsMapping.Ext[alias];
        }
        //
        // Some namespaces will be calculated as 'Ext', i.e. Ext.csi, Ext.ux, or others that may not
        // necessarily be a part of the ExtJs Framework and the 'Ext' namespace.  Loop through all
        // the parsed namespaces and see if we can find the component
        //
        if (!cls) {
            Object.keys(this.widgetToClsMapping).forEach(async (ns) => {
                cls = this.widgetToClsMapping[ns][alias];
                return !!cls;
            });
        }
        log.methodStart("get component by alias", logLevel, logPad, false, [["component alias", alias], ["namespace", nameSpace]]);
        if (cls) {
            const component = this.getComponent(cls, nameSpace, false, logPad + "   ", logLevel);
            if (component) {
                log.methodDone("get component by alias", logLevel + 2, logPad, false, [
                    ["namespace", component.nameSpace], ["base namespace", component.baseNameSpace]
                ]);
                return component;
            }
        }
        log.write("   could not find component by alias", logLevel, logPad);
        log.methodDone("get component by alias", logLevel, logPad);
        return undefined;
    }


    getComponentByFile(fsPath: string, logPad = "", logLevel = 1): IComponent | undefined
    {
        log.methodStart("get component by file", logLevel, logPad, false, [["component file", fsPath]]);
        const cls = this.getClassFromFile(fsPath, logPad);
        if (cls) {
            log.value("   component class", cls, logLevel + 1, logPad);
            const component = this.getComponent(cls, this.getNamespaceFromClass(cls), false, logPad);
            if (component) {
                log.methodDone("found component", logLevel, logPad, false, [["namespace", component.nameSpace], ["base namespace", component.baseNameSpace]]);
                return component;
            }
        }
        log.write("   could not find component by file", logLevel, logPad);
        log.methodDone("get component by file", logLevel, logPad);
        return undefined;
    }


    getMappedClass(property: string, nameSpace: string, cmpType: ComponentType): string | undefined
    {
        if (!cmpType || cmpType === ComponentType.Widget) {
            return this.widgetToClsMapping[nameSpace] ? (this.widgetToClsMapping[nameSpace][property] || this.widgetToClsMapping.Ext[property]) :
                                                         this.widgetToClsMapping.Ext[property];
        }
        else if (cmpType === ComponentType.Method) {
            return this.methodToClsMapping[nameSpace] ? (this.methodToClsMapping[nameSpace][property] || this.methodToClsMapping.Ext[property]) :
                                                         this.methodToClsMapping.Ext[property];
        }
        else if (cmpType === ComponentType.Property) {
            return this.propertyToClsMapping[nameSpace] ? (this.propertyToClsMapping[nameSpace][property] || this.propertyToClsMapping.Ext[property]) :
                                                           this.propertyToClsMapping.Ext[property];
        }
        else if (cmpType === ComponentType.Config) {
            return this.configToClsMapping[nameSpace] ? (this.configToClsMapping[nameSpace][property] || this.configToClsMapping.Ext[property]) :
                                                         this.configToClsMapping.Ext[property];
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
     * @private
     *
     * @param {String} property Property name, i.e. an xtype, alias, or widget aliased string
     * @param {Position} position The position of `property` in the document
     * @param {String} lineText The complete line of text the property is found in
     * @param {String} fsPath File system path
     *
     * @returns {String}
     */
    private getComponentClass(property: string, nameSpace: string, position: Position | undefined, lineText: string, fsPath: string | undefined, logPad = "", logLevel = 1): string | undefined
    {
        let cmpClass = "this", // getComponentByConfig(property);
            cmpClassPre, cmpClassPreIdx = -1, cutAt = 0;

        log.methodStart("get component class", logLevel, logPad, false, [["property", property], ["namespace", nameSpace]]);

        //
        // Get class name prependature to hovered property
        //
        // classPre could be something like:
        //
        //     Ext.csi.view.common.
        //     Ext.csi.store.
        //     Ext.form.field.
        //     MyApp.view.users.
        //
        const pIdx = lineText.indexOf(property);
        cmpClassPre = lineText.substring(0, pIdx);
        //
        // If property is within a function expression, e.g.:
        //
        //     console.log(VSCodeExtJS.common.UserDropdown.proparty);
        //
        // Trim off characters up to and inclusing the 1st '('
        //
        if (cmpClassPre.indexOf("(") < pIdx) {
            // cmpClassPre = lineText.substring(cmpClassPre.indexOf("(") + 1);
        }
        cmpClassPreIdx = cmpClassPre.lastIndexOf("=");
        if (cmpClassPreIdx === -1) {
            cmpClassPreIdx = cmpClassPre.lastIndexOf(" ");
        }
        cmpClassPreIdx++;
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

        if (cmpClass === "this")
        {
            if (fsPath) {
                cmpClass = this.getComponentByFile(fsPath, logPad + "   ", logLevel)?.componentClass || "";
            }
        }
        else //
        {   // Check aliases/alternate class names
            //
            let aliasClass = this.widgetToClsMapping[nameSpace] ? this.widgetToClsMapping[nameSpace][cmpClass] : undefined;
            if (!aliasClass) {
                aliasClass = this.widgetToClsMapping.Ext[property];
            }
            //
            // Some namespaces will be calculated as 'Ext', i.e. Ext.csi, Ext.ux, or others that may not
            // necessarily be a part of the ExtJs Framework and the 'Ext' namespace.  Loop through all
            // the parsed namespaces and see if we can find the component
            //
            if (!aliasClass) {
                Object.keys(this.widgetToClsMapping).forEach(async (ns) => {
                    aliasClass = this.widgetToClsMapping[ns][cmpClass];
                    return !!aliasClass;
                });
            }
            if (aliasClass) {
                cmpClass = aliasClass;
            }
        }

        //
        // Instances
        //
        if (fsPath && !this.getComponent(cmpClass, nameSpace, true, logPad + "   ", logLevel))
        {
            const instance = this.getComponentInstance(cmpClass, nameSpace, position || new Position(0, 0), fsPath, logPad + "   ", logLevel);
            if (isComponent(instance)) {
                cmpClass = instance.componentClass;
            }
        }

        log.methodDone("get component class", logLevel, logPad, false, [["class", cmpClass]]);
        return cmpClass;
    }


    getComponentInstance(property: string, nameSpace: string, position: Position, fsPath: string, logPad = "", logLevel = 1): IComponent | IPrimitive | undefined
    {
        log.methodStart("get component instance", logLevel, logPad, false, [["property", property], ["namespace", nameSpace]]);

        const thisCls = this.getClassFromFile(fsPath, logPad + "   ", logLevel);

        if (thisCls)
        {
            const cmp = this.getComponent(thisCls, nameSpace, true, logPad + "   ", logLevel);

            if (property === "this") {
                log.methodDone("get component instance", logLevel, logPad, false, [["component class", "this"]]);
                return cmp;
            }

            if (cmp)
            {
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
                    if (isPositionInRange(position, toVscodeRange(method.start, method.end)))
                    {
                        let variable = method.variables?.find(v => v.name === property);
                        if (!variable) {
                            variable = method.params?.find(v => v.name === property);
                            if (variable?.type !== VariableType._class) {
                                variable = undefined;
                            }
                        }
                        if (variable) {
                            const cmp = this.getComponent(variable.componentClass, nameSpace, true, logPad + "   ", logLevel);
                            if (cmp) {
                                log.methodDone("get component instance", logLevel, logPad);
                                return cmp;
                            }
                            else {
                                log.methodDone("get component instance", logLevel, logPad);
                                return {
                                    name: variable.name,
                                    start: variable.start,
                                    end: variable.end,
                                    componentClass: variable.componentClass
                                };
                            }
                        }
                    }
                }
            }
        }

        log.methodDone("get component instance", logLevel, logPad);
    }


    getConfig(componentClass: string, property: string, nameSpace: string, logPad = "", logLevel = 1): IConfig | undefined
    {
        log.methodStart("get config by component class", logLevel, logPad, false, [
            ["component class", componentClass], ["property", property], ["namespace", nameSpace]
        ]);
        //
        // Get mapping
        //
        let configs = this.clsToConfigsMapping[nameSpace] ? this.clsToConfigsMapping[nameSpace][componentClass] : undefined;
        if (!configs) {
            configs = this.clsToConfigsMapping.Ext[componentClass];
        }
        //
        // Some namespaces will be calculated as 'Ext', i.e. Ext.csi, Ext.ux, or others that may not
        // necessarily be a part of the ExtJs Framework and the 'Ext' namespace.  Loop through all
        // the parsed namespaces and see if we can find the component
        //
        if (!configs) {
            Object.keys(this.clsToConfigsMapping).forEach(async (ns) => {
                configs = this.clsToConfigsMapping[ns][componentClass];
                return !!configs;
            });
        }
        if (configs)
        {
            for (let c = 0; c < configs.length; c++)
            {
                if (configs[c].name === property)
                {
                    log.write("   found config", logLevel + 2, logPad);
                    log.value("      name", configs[c].name, logLevel + 3, logPad);
                    log.value("      start", configs[c].start.line + ", " + configs[c].start.column, logLevel + 3, logPad);
                    log.value("      end", configs[c].end.line + ", " + configs[c].end.column, logLevel + 3, logPad);
                    log.methodDone("get config by component class", logLevel, logPad);
                    return configs[c];
                }
            }
        }
        log.write("   could not find config by component class", logLevel, logPad);
        log.methodDone("get config by component class", logLevel, logPad);
        return undefined;
    }


    getFilePath(componentClass: string, logPad = "", logLevel = 1)
    {
        const fsPath = this.componentClassToFilesMapping[componentClass];
        log.write("get fs path by component", logLevel, logPad);
        log.value("   path", fsPath, logLevel + 1, logPad);
        return fsPath;
    }


    /**
     * @method getLineProperties
     *
     * Get line properties by document position
     *
     * @param document The TextDocument instance
     * @param position The position in the document to extract line properties for
     * @param logPad Padding to prepend to any logging
     */
    getLineProperties(document: TextDocument, position: Position, logPad = "", logLevel = 1): ILineProperties
    {
        log.methodStart("get line properties", logLevel, logPad);

        const line = position.line,
              nextLine = document.lineAt(line + 1),
              allLineText = document.getText(new Range(new Position(line, 0), nextLine.range.start)).trim(),
              thisCmp = this.getComponentByFile(document.uri.fsPath, logPad + "   ", logLevel) as IComponent,
              range = document.getWordRangeAtPosition(position) || new Range(position, position);

        log.values([
            ["file", document.uri.fsPath], ["namespace", thisCmp?.nameSpace],
            ["component class", thisCmp?.componentClass], ["line text (all)", allLineText]
        ], logLevel + 1, logPad + "   ");

        //
        // Break line text down up to the property and any callee objects/class instance we need to examine
        //
        // Examples:
        //
        //     1. const x = new Ext.util.DelayedTask(...)
        //     2. if (!Util.checkOneSelected(...)) {
        //
        // We want it stripped up to the callee of the property we're looking at
        //
        //     1. Ext.util.DelayedTask(...)
        //     2. Util.checkOneSelected(...)) {
        //
        let lineText = allLineText.replace(/[\s\w.\[\]]+=[\s]*(new)*\s*/, "").replace(/[\s\w]*if\s*\(\s*[!]{0,2}/, ""),
            property = document.getText(range),
            cmpType: ComponentType = ComponentType.None;

        log.value("   trimmed line text", lineText, logLevel + 1, logPad);
        log.value("   property", property, logLevel + 1, logPad);

        //
        // Handle "this"
        // TODO - handle 'this' for non-controller function with local this
        //
        if (property === "this")
        {
            log.methodDone("get line properties", logLevel + 1, logPad, false, [["component class", "this"]]);
            return {
                thisClass: thisCmp?.componentClass,
                thisCmp,
                cmpClass: thisCmp?.componentClass,
                cmpType: ComponentType.Class,
                property
            };
        }

        //
        // Old regex's from first implementation, leave for now for reference
        //
        // Methods
        // if (lineText.match(new RegExp(`${property}\\s*\\([ \\W\\w\\{]*\\)\\s*;\\s*$`)))
        // Properties / configs
        // else if (lineText.match(new RegExp(`\\.${property}\\s*[;\\)]+\\s*$`)))
        // Classes
        // else if (lineText.match(new RegExp(`(.|^\\s*)${property}.[\\W\\w]*$`)))

        //
        // Class string literals
        // Match string literal class, e.g.:
        //
        //     Ext.create("Ext.data.Connection", {
        //     Ext.create("Ext.panel.Panel", {
        //     requires: [ "MyApp.common.Utilities" ]let cmp = this.down('physiciandropdown');
        //
        if (lineText.match(new RegExp(`["']{1}[\\w.]*\\.${property}[\\w.]*["']{1}`)) ||
            lineText.match(new RegExp(`["']{1}[\\w.]*${property}\\.[\\w.]*["']{1}`)))
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
            // anywhere within the string references th  entire component class, not just the "part" that
            // gets looked at when doing a goto def for a non-quoted class variable/path
            //
            const strParts = lineText.split(".");
            property = strParts[strParts.length - 1];
        }
        //
        // String literal xtype
        //
        else if (lineText.match(new RegExp(`\\.(up|down|next|prev)\\(\\s*["']{1}${property}["']{1}\\s*\\)`)))
        {
            cmpType = ComponentType.Class;
            //
            // Strip off everything outside the quotes to get our xtype, i.e.
            //
            //     grid.up('panel')
            //
            // We want 'panel'
            //
            lineText = lineText.replace(/^[^"']*["']{1}/, "").replace(/["']{1}[\w\W]*$/, "");
            //
            // Set the property to the last piece of the xtypes class name.
            //
            let xtypeCmp = this.widgetToClsMapping[thisCmp.nameSpace] ? this.widgetToClsMapping[thisCmp.nameSpace][lineText] : undefined;
            if (!xtypeCmp) {
                xtypeCmp = this.widgetToClsMapping.Ext[lineText];
            }
            if (xtypeCmp) {
                const strParts = xtypeCmp.split(".");
                property = strParts[strParts.length - 1];
                lineText = xtypeCmp;
            }
        }
        //
        // Methods
        // Match function/method signature type, e.g.
        //
        //     testFn();
        //     testFn2(a, b);
        //     testFn2(a, { x: 0, y: 1});
        //
        else if (lineText.match(new RegExp(`${property}\\s*\\([ \\W\\w\\{]*\\)\\s*[;,\\)]+\\s*\\{*$`)))
        {
            cmpType = ComponentType.Method;
        }
        //
        // Properties / configs / variables / parameters / class expressions, e.g.:
        //
        //     property.getSomething();
        //     const property = this;
        //
        // Also catches 'class' type hover on a full path class method call for example:
        //
        //     VSCodeExtJS.common.UserDropdown.create();
        //
        // Hovering over 'VSCodeExtJS' should yield 'class' type.
        //
        else if (lineText.match(new RegExp(`.${property}\\s*[;\\)]{1,2}\\s*$`)) ||
                 allLineText.match(new RegExp(`(\\s*(const|var|let){0,1}\\s+|^)${property}\\s*[=.]{1}\\s*[ \\W\\w\\{\\(]*\\s*$`)))
        {
            if (!this.getComponentByAlias(property, thisCmp.nameSpace, logPad + "   ", logLevel) && !this.getComponent(property, thisCmp.nameSpace, false, logPad + "   ", logLevel)) {
                cmpType = ComponentType.Property;
            }
            else {
                cmpType = ComponentType.Class;
            }
        }
        //
        // Classes and property class instances (non string literal)
        //
        else if (lineText.match(new RegExp(`(.|^\\s*)${property}.[\\W\\w]*$`)))
        {
            cmpType = ComponentType.Class;
        }

        let cmpClass: string | undefined;
        const thisPath = window.activeTextEditor?.document?.uri.fsPath;

        log.value("   property (recalculated)", property, logLevel + 1, logPad);
        log.value("   component type", cmpType, logLevel + 1, logPad);

        if (cmpType === ComponentType.Class)
        {
            cmpClass = lineText.substring(0, lineText.indexOf(property) + property.length);
            let cls: string | IComponent | undefined = this.variablesToComponentMapping[thisCmp.nameSpace][property];
            if (cls && cls.name) {
                let variable: IVariable | undefined;
                if (this.componentClassToVariablesMapping[thisCmp.nameSpace]) {
                    variable = this.componentClassToVariablesMapping[thisCmp.nameSpace][cls.name]?.find(v => v.name === property);
                }
                cmpClass = variable?.componentClass;
                if (!cmpClass) {
                    variable = this.componentClassToVariablesMapping.Ext[cls.name]?.find(v => v.name === property);
                    cmpClass = variable?.componentClass;
                }
            }
            else {
                cls = this.widgetToClsMapping[thisCmp.nameSpace] ? this.widgetToClsMapping[thisCmp.nameSpace][property] : undefined;
                if (!cls) {
                    cls = this.widgetToClsMapping.Ext[property];
                }
                if (cls) {
                    cmpClass = cls;
                }
                else {
                    let cmp = this.getComponent(property, thisCmp.nameSpace, true, logPad + "   ", logLevel);
                    if (cmp) {
                        cmpClass = cmp.componentClass;
                    }
                    else {
                        const iCmp = this.getComponentInstance(property, thisCmp.nameSpace, position, document.uri.fsPath, logPad + "   ", logLevel);
                        if (isComponent(iCmp)) {
                            cmp = iCmp;
                            cmpClass = cmp.componentClass;
                        }
                    }
                }
            }
        }
        else if (cmpType === ComponentType.Method)
        {
            cmpClass = this.getComponentClass(property, thisCmp.nameSpace, position, lineText, thisPath, logPad + "   ", logLevel);
            if (cmpClass)
            {   //
                // getComponentClass() will return the file class if this is a config getter/setter, so
                // check the methods mapping to see if it exists on the main component or not.  If it doesn't
                // then check if its a config property getter/setter fn
                //
                const classHasMethod = !!this.clsToMethodsMapping[thisCmp.nameSpace][cmpClass]?.find(x => x.name === property);
                if (!classHasMethod && utils.isGetterSetter(property))
                {   //
                    // A config property:
                    //
                    //     user: null
                    //
                    // Will have the following getter/setter created by the framework if not defined
                    // on the object:
                    //
                    //     getUser()
                    //     setUser(value)
                    //
                    // Check for these config methods, see if they exist for this property
                    //
                    log.write("   method not found, look for getter/setter config", logLevel + 1, logPad);
                    property = utils.lowerCaseFirstChar(property.substring(3));
                    cmpType = ComponentType.Config;
                    log.value("      config name", property, logLevel + 1, logPad);
                    // cmpClass = this.getComponentClass(property, thisCmp.nameSpace, position, lineText, thisPath);
                }
            }
        }
        else // ComponentType.Property / ComponentType.Config | variable / parameter
        {
            const cmp = this.getComponentInstance(property, thisCmp.nameSpace, position, document.uri.fsPath, logPad + "   ", logLevel),
                  cfgCls = this.getMappedClass(property, thisCmp.nameSpace, ComponentType.Config);
            cmpClass = cmp?.componentClass || this.getComponentClass(property, thisCmp.nameSpace, position, lineText, thisPath, logPad + "   ", logLevel);
            if (!cmpClass)
            {
                log.write("   property not found, look for config", 2, logPad);
                cmpType = ComponentType.Property;
                cmpClass = this.getComponentClass(property, thisCmp.nameSpace, position, lineText, thisPath, logPad + "   ", logLevel);
                if (cfgCls === cmpClass) {
                    cmpType = ComponentType.Config;
                }
            }
            //
            // If this is a property, check for a config property...
            //
            else if (cmpType === ComponentType.Property && cfgCls)
            {
                log.write("   property not found, got config", logLevel + 1, logPad);
                cmpType = ComponentType.Config;
                cmpClass = cfgCls;
            }
        }

        let callee: string | undefined;
        if (cmpClass) {
            callee = lineText.substring(lineText.indexOf(cmpClass) + cmpClass.length)
                             .replace(/\(.{0,1}\)\s*[;]*/, "").replace(".", "").trim();
        }

        log.methodDone("get line properties", logLevel, logPad, false, [["component class", cmpClass]]);

        return {
            cmpClass,
            cmpType,
            property,
            thisCmp,
            thisClass: thisCmp?.componentClass,
            callee
        };
    }


    getNamespace(document: TextDocument | Uri | undefined)
    {
        if (document)
        {
            let uri: Uri;
            if (document instanceof Uri) {
                uri = document;
            }
            else {
                uri = document.uri;
            }
            let dir = path.dirname(uri.fsPath);
            while (dir.indexOf(path.sep) !== -1) {
                const ns = this.dirNamespaceMap.get(dir);
                if (ns) {
                    return ns;
                }
                dir = path.dirname(dir);
                if (!workspace.getWorkspaceFolder(Uri.file(dir)) || dir.length <= 3) {
                    break;
                }
            }
        }
        return "Ext";
    }


    getNamespaceFromClass(componentClass: string, defaultNs?: string, logPad = "", logLevel = 1)
    {
        if (!defaultNs) {
            defaultNs = componentClass;
        }
        if (componentClass.indexOf(".") !== -1)
        {
            return componentClass.substring(0, componentClass.indexOf("."));
        }
        if (!this.widgetToClsMapping[componentClass])
        {
            let aCmp = this.getComponentByAlias(componentClass, defaultNs, logPad, logLevel);
            if (!aCmp) {
                aCmp = this.getComponentByAlias(componentClass, "Ext", logPad, logLevel);
            }
            if (aCmp) {
                return aCmp.componentClass.substring(0, aCmp.componentClass.indexOf("."));
            }
        }
        return defaultNs;
    }


    /**
     * @method getNamespaceFromFile
     *
     * @param fsPath Filesystem path to file
     * @param part Zero-based index of namespace part to return
     */
    getNamespaceFromFile(fsPath: string, part?: number, logPad = "", logLevel = 1): string | undefined
    {
        let ns: string | undefined;
        log.methodStart("get namespace from file", logLevel, logPad, false, [["file", fsPath]]);
        const cls = this.fileToComponentClassMapping[fsPath];
        if (cls){
            log.value("   found base class", cls, logLevel + 2, logPad);
            ns = cls.split(".")[part ?? 0];
        }
        log.methodDone("get namespace from file", logLevel, logPad, false, [["namespace", ns]]);
        return ns;
    }


    getPropertyPosition(property: string, cmpType: ComponentType, componentClass: string, nameSpace: string, logPad = "", logLevel = 1)
    {
        let start = new Position(0, 0),
            end = new Position(0, 0);

        log.methodStart("get property position", logLevel, logPad, false, [
            ["property", property], ["component class", componentClass], ["namespace", nameSpace]
        ]);

        const pObject = cmpType === ComponentType.Method ? this.getMethod(componentClass, property, nameSpace, logPad + "   ") :
                                      (cmpType === ComponentType.Config ? this.getConfig(componentClass, property, nameSpace, logPad + "   ") :
                                                                          this.getProperty(componentClass, property, nameSpace, logPad + "   "));

        const _setPosition = ((o: IExtJsBase) =>
        {
            if (o.start && o.end)
            {
                log.write("   setting position", logLevel + 1, logPad);
                log.value("      start line", o.start?.line, logLevel + 2, logPad);
                log.value("      end line", o.end?.line, logLevel + 2, logPad);
                start = toVscodePosition(o.start);
                end = toVscodePosition(o.end);
            }
        });

        if (pObject)
        {
            _setPosition(pObject);
        }
        else //
        {   // In the case where there are multiple classes defined in one file, get the main
            // component file and search for the class position in the case where it is not 0,0.
            // Otherwise this is a class definition, and pObject (method, property, config) is undefined
            //
            const mainCmp = this.getComponent(componentClass, nameSpace, false, logPad + "   ", logLevel);
            if (mainCmp) {
                _setPosition(mainCmp);
            }
        }

        log.methodDone("get property position", logLevel, logPad);
        return { start, end };
    }


    getProperty(componentClass: string, property: string, nameSpace: string, logPad = "", logLevel = 1): IProperty | undefined
    {
        log.methodStart("get property by component class", logLevel, logPad, false, [
            ["component class", componentClass], ["property", property], ["namespace", nameSpace]
        ]);

        //
        // Get mapping
        //
        let prop: IProperty | undefined;
        let properties = this.clsToPropertiesMapping[nameSpace] ? this.clsToPropertiesMapping[nameSpace][componentClass] : undefined;
        if (!properties) {
            properties = this.clsToPropertiesMapping.Ext[componentClass];
        }
        //
        // Some namespaces will be calculated as 'Ext', i.e. Ext.csi, Ext.ux, or others that may not
        // necessarily be a part of the ExtJs Framework and the 'Ext' namespace.  Loop through all
        // the parsed namespaces and see if we can find the component
        //
        if (!properties) {
            Object.keys(this.clsToPropertiesMapping).forEach(async (ns) => {
                properties = this.clsToPropertiesMapping[ns][componentClass];
                return !!properties;
            });
        }

        if (properties) {
            for (let c = 0; c < properties.length; c++) {
                if (properties[c].name === property) {
                    log.write("   found property", logLevel + 2, logPad);
                    log.value("      name", properties[c].name, logLevel + 3, logPad);
                    log.value("      start (line/col)",  properties[c].start.line + ", " + properties[c].start.column, logLevel + 3, logPad);
                    log.value("      end (line/col)", properties[c].end.line + ", " + properties[c].end.column, logLevel + 3, logPad);
                    prop = properties[c];
                    break;
                }
            }
        }
        log.methodDone("get property by component class", logLevel, logPad);
        return prop;
    }


    getPropertyRange(property: string, thisClass: string | undefined, start: Position, end: Position, currentPosition: Position)
    {
        let range = new Range(start, end);
        //
        // If the position is within the range of the goto definition, the provided definition will be
        // ignored by VSCode.  For example, consider the base class `VSCodeExtJS`, and the following
        // method call in one of it's own methods:
        //
        //     VSCodeExtJS.common.UserDropdown.create();
        //
        // The range of `VSCodeExtJS` is within class itself, so just reset the range to just be the
        // start position.  In this case the property 'VSCodeExtJS` is equal to the class 'VSCodeExtJS'.
        //
        if (thisClass === property && isPositionInRange(currentPosition, range))
        {
            range = new Range(start, start);
        }
        return range;
    }


    getMethod(componentClass: string, property: string, nameSpace: string, logPad = "", logLevel = 1): IMethod| undefined
    {
        log.methodStart("get method by property", logLevel, logPad, false, [
            ["component class", componentClass], ["property", property], ["namespace", nameSpace]
        ]);

        let method: IMethod | undefined,
            methods = this.clsToMethodsMapping[nameSpace] ? this.clsToMethodsMapping[nameSpace][componentClass] : undefined;
        if (!methods) {
            methods = this.clsToMethodsMapping.Ext[componentClass];
        }
        //
        // Some namespaces will be calculated as 'Ext', i.e. Ext.csi, Ext.ux, or others that may not
        // necessarily be a part of the ExtJs Framework and the 'Ext' namespace.  Loop through all
        // the parsed namespaces and see if we can find the component
        //
        if (!methods) {
            Object.keys(this.clsToMethodsMapping).forEach(async (ns) => {
                methods = this.clsToMethodsMapping[ns][componentClass];
                return !!methods;
            });
        }

        if (methods)
        {
            for (let c = 0; c < methods.length; c++)
            {
                if (methods[c].name === property) {
                    log.write("   found method", logLevel + 2, logPad);
                    log.value("      name", methods[c].name, logLevel + 2, logPad);
                    log.value("      start (line/col)",  methods[c].start.line + ", " + methods[c].start.column, logLevel + 2, logPad);
                    log.value("      end (line/col)", methods[c].end.line + ", " + methods[c].end.column, logLevel + 2, logPad);
                    method = methods[c];
                    break;
                }
            }
        }

        log.methodDone("get method by property", logLevel, logPad, false, [["method", method?.name]]);
        return method;
    }


    getSubComponentNames(componentClass: string, logPad = "", logLevel = 1): string[]
    {
        const subComponentNames: string[] = [],
              map = this.clsToCmpMapping;

        log.write("get sub-component names", logLevel, logPad);
        log.value("   component class", componentClass, logLevel + 1, logPad);

        Object.values(map).forEach((ns) =>
        {
            Object.keys(ns).forEach((cls) =>
            {
                if (cls && cls.startsWith(componentClass))
                {
                    const subCMp = cls.replace(componentClass + ".", "").split(".")[0];
                    if (subCMp) {
                        subComponentNames.push(subCMp);
                    }
                }
            });
        });

        return subComponentNames;
    }


    getXTypeRef(componentClass: string, xtype: string, logPad = "", logLevel = 1): IXtype | undefined
    {
        log.methodStart("get xtype by component class", logLevel, logPad, false, [["component class", componentClass], ["xtype", xtype]]);

        let x: IXtype | undefined;
        const ns = this.getNamespaceFromClass(componentClass);
        if (!ns) {
            return undefined;
        }
        let xtypes = this.clsToXTypesMapping[ns] ? this.clsToXTypesMapping[ns][componentClass] : undefined;
        if (!xtypes) {
            xtypes = this.clsToXTypesMapping.Ext[componentClass];
        }

        if (xtypes) {
            for (let c = 0; c < xtypes.length; c++) {
                if (xtypes[c].name === xtype) {
                    log.write("   found config", logLevel + 2, logPad);
                    log.value("      name", xtypes[c].name, logLevel + 3, logPad);
                    log.value("      start", xtypes[c].start.line + ", " + xtypes[c].start.column, logLevel + 3, logPad);
                    log.value("      end", xtypes[c].end.line + ", " + xtypes[c].end.column, logLevel + 3, logPad);
                    x = xtypes[c];
                    break;
                }
            }
        }

        log.methodDone("get xtype by component class", logLevel, logPad, false, [["xtype", x]]);
        return x;
    }


    getXtypeNames(): string[]
    {
        const xtypes: string[] = [],
              xMap = this.clsToXTypesMapping;

        Object.values(xMap).forEach((ns) =>
        {
            Object.entries(ns).forEach(([ cls, xtype ]) =>
            {
                if (cls && xtype)
                {
                    for (const x of xtype) {
                        xtypes.push(x.name);
                    }
                }
            });
        });
        return xtypes;
    }


    private getWorkspaceProjectName(fsPath: string)
    {
        const wsf = workspace.getWorkspaceFolder(Uri.file(fsPath));
        if (wsf) {
            return path.basename(wsf.uri.fsPath);
        }
        return path.basename(fsPath);
    }


    private getCmpStorageFileName(fsPath: string, nameSpace: string)
    {
        const wsf = workspace.getWorkspaceFolder(Uri.file(fsPath));
        if (wsf) {
            const projectName = path.basename(wsf.uri.fsPath);
            return path.join(fsPath.replace(wsf.uri.fsPath, ""), projectName, nameSpace, "components.json");
        }
        return Uri.file(fsPath).path;
    }


    private handleDeleFile(fsPath: string)
    {
        log.methodStart("handle delete file", 1, "", true, [["path", fsPath]]);

        const componentClass = this.getClassFromFile(fsPath),
              componentNs = componentClass ? this.getNamespaceFromClass(componentClass) : undefined;
        if (componentClass && componentNs)
        {
            log.value("   component class", componentClass, 2);

            const component = this.getComponent(componentClass, componentNs, false, "   ");
            if (component)
            {
                // component.aliases.forEach((alias) => {
                //     delete aliasToComponentClassMapping[alias];
                // });

                component.configs.forEach((config) => {
                    delete this.configToClsMapping[componentNs][config.name];
                });

                component.methods.forEach((method) => {
                    delete this.methodToClsMapping[componentNs][method.name];
                    method.variables?.forEach((v) => {
                        delete this.variablesToComponentMapping[componentNs][v.name];
                        delete this.variablesToMethodMapping[componentNs][v.name];
                    });
                });

                // component.privates.forEach((private) => {
                //     delete privateToComponentClassMapping[private.name];
                // });

                component.properties.forEach((property) => {
                    delete this.propertyToClsMapping[componentNs][property.name];
                });

                // component.statics.forEach((static) => {
                //     delete configToClsMapping[static.name];
                // });

                component.widgets.forEach((widget) => {
                    delete this.widgetToClsMapping[componentNs][widget];
                });
            }

            delete this.fileToComponentClassMapping[fsPath];
            delete this.methodToVariablesMapping[componentNs][componentClass];

            delete this.componentClassToWidgetsMapping[componentNs][componentClass];
            delete this.componentClassToAliasesMapping[componentNs][componentClass];
            delete this.componentClassToFilesMapping[componentClass];
            delete this.componentClassToRequiresMapping[componentNs][componentClass];
            delete this.clsToConfigsMapping[componentNs][componentClass];
            delete this.clsToPropertiesMapping[componentNs][componentClass];
            delete this.clsToMethodsMapping[componentNs][componentClass];
            delete this.clsToCmpMapping[componentNs][componentClass];
            delete this.componentClassToVariablesMapping[componentNs][componentClass];
        }

        log.methodDone("handle delete file", 1);
    }


    private async indexAll(progress?: Progress<any>, project?: string, logPad = "", logLevel = 1)
    {
        log.methodStart("index all", logLevel, logPad, true, [
            [ "project", project ], [ "# of configs", this.config.length ]
        ]);

        const processedDirs: string[] = [],
              cfgPct = this.config && this.config.length ? 100 / this.config.length : 100;
        let currentCfgIdx = 0,
            components: IComponent[] = [];
        //
        // store.type and different cache paths were added in 0.4, re-index if it hasn't been done already
        //
        const needsReIndex = storage.get<string>(this.forceReIndexOnUpdateFlag, "false") !== "true";
        if (needsReIndex) {
            await commands.executeCommand("vscode-extjs:clearAst", undefined, true, "   ");
        }

        const _isIndexed = ((dir: string) =>
        {
            for (const d of processedDirs)
            {   //
                // Don't process dirs already processed.  If dirs in a user's config overlap eachother
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

        for (const conf of this.config)
        {
            const projectName = this.getWorkspaceProjectName(conf.wsDir),
                  forceProjectAstIndexing = !(await pathExists(path.join(this.fsStoragePath, projectName)));
            let currentFileIdx = 0,
                numFiles = 0,
                dirs: string[] = [],
                increment: number | undefined;

            log.write("   process config", 1, logPad);
            log.values([
                ["projectName", projectName], ["confName", conf.name], ["wsDir", conf.wsDir],
                ["baseWsDir", conf.baseWsDir], ["baseDir", conf.baseDir], ["classpath", conf.classpath.toString()]
            ], 2, logPad + "   ");

            if (project) {
                if (project.toLowerCase() !== projectName.toLowerCase()) {
                    log.write("   skip project", 1, logPad);
                    continue;
                }
            }

            progress?.report({
                increment: 0,
                message: `: Scanning project ${projectName}`
            });

            const storageKey = this.getCmpStorageFileName(conf.baseDir, conf.name),
                  storedComponents = !forceProjectAstIndexing ? await fsStorage.get(storageKey) : undefined;
            //
            // Get components for this directory from local storage if exists
            //
            if (storedComponents && needsReIndex === false)
            {
                if (!_isIndexed(conf.baseDir))
                {
                    components = JSON.parse(storedComponents);
                    increment = Math.round(1 / components.length * cfgPct);
                    //
                    // Request load components from server
                    //
                    for (const c of components)
                    {
                        await this.serverRequest.loadExtJsComponent(JSON.stringify([c]));
                        processedDirs.push(c.fsPath);
                        this.dirNamespaceMap.set(path.dirname(c.fsPath), conf.name);
                        const pct = Math.round((cfgPct * currentCfgIdx) + (++currentFileIdx / components.length * (100 / this.config.length)));
                        progress?.report({
                            increment,
                            message: ": Indexing " + pct + "%"
                        });
                    }
                    await this.processComponents(components, "   ", logLevel);
                    progress?.report({
                        increment,
                        message: Math.round(++currentCfgIdx * cfgPct) + "%"
                    });
                }
            }
            else // index the file via the language server
            {
                components = []; // clear component defs from last loop iteration

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
                        const uris = await workspace.findFiles(`${path.join(conf.baseWsDir, dir)}/**/*.js`);
                        numFiles += uris.length;
                    }
                }

                increment = Math.round(1 / numFiles * cfgPct);

                log.blank();
                log.value("   # of files to index", numFiles, logLevel, logPad);

                for (const dir of dirs)
                {
                    if (!_isIndexed(dir))
                    {
                        const uris = await workspace.findFiles(`${path.join(conf.baseWsDir, dir)}/**/*.js`);
                        for (const uri of uris)
                        {   //
                            // Index this file and process its components
                            //
                            try {
                                const cmps = await this.indexFile(uri.fsPath, conf.name, false, uri, false, "   ", logLevel);
                                if (cmps) {
                                    components.push(...cmps);
                                }
                            }
                            catch (e) {
                                log.error(e);
                                break;
                            }
                            //
                            // Report progress
                            //
                            const pct = Math.round((cfgPct * currentCfgIdx) + (++currentFileIdx / numFiles * (100 / this.config.length)));
                            progress?.report({
                                increment,
                                message: ": Indexing " + pct + "%"
                            });
                            // statusBarSpace.text = getStatusString(pct);
                        }
                        processedDirs.push(dir);
                        this.dirNamespaceMap.set(path.join(conf.baseDir, dir), conf.name);
                    }
                }

                //
                // Update local storage
                //
                if (components.length > 0) {
                    await fsStorage.update(storageKey, JSON.stringify(components));
                    await storage.update(storageKey + "_TIMESTAMP", new Date());
                }

                progress?.report({
                    increment,
                    message: ": Indexing " + Math.round(++currentCfgIdx * cfgPct) + "%"
                });
            }
        }

        storage.update(this.forceReIndexOnUpdateFlag, "true");

        log.methodDone("index all", logLevel, logPad, true);
    }


    async indexFile(fsPath: string, nameSpace: string, saveToCache: boolean, document: TextDocument | Uri, oneCall = true, logPad = "", logLevel = 1): Promise<IComponent[] | false | undefined>
    {
        log.methodStart("indexing " + fsPath, logLevel, logPad, true, [[ "namespace", nameSpace ]]);

        const uriFile = Uri.file(fsPath),
              wsPath = workspace.getWorkspaceFolder(uriFile)?.uri.fsPath;
        let skipExcludeCheck = false;

        //
        // Exclude configured build dir from workspace.json
        //
        if (wsPath)
        {
            for (const c of this.config) {
                if (c.buildDir) {
                    const buildUriPath = Uri.file(path.join(wsPath, c.buildDir)).path;
                    if (uriFile.path.includes(buildUriPath)) {
                        log.write(logPad + "Excluded by workspace.json build path");
                        return;
                    }
                }
                if (c.classpath) {
                    const classPaths = typeof(c.classpath) === "string" ? [ c.classpath ] : c.classpath;
                    for (const classPath of classPaths)
                    {
                        const cpUriPath = Uri.file(path.join(wsPath, classPath)).path;
                        if (uriFile.path.includes(cpUriPath)) {
                            skipExcludeCheck = true;
                            break;
                        }
                    }
                }
            }
        }

        //
        // Exclude Application/workspace/user configured paths
        // Paths must be glob pattern e.g. **/src/**
        //
        if (!skipExcludeCheck && isExcluded(uriFile.path)) {
            log.write(logPad + "Excluded by configured exclude path(s)");
            return;
        }

        //
        // Set 'indexing' flag, hide toolbar indexing button
        // The 'oneCall' flag is set when the indexing is being done on the active document only
        // For bulk indexing, this is handled by caller
        //
        if (oneCall) {
            this.isIndexing = true;
            showReIndexButton(false);
        }

        //
        // Get components for this file from the Language Server
        //
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

        //
        // Request 'parse file' from server
        //
        const components = await this.serverRequest.parseExtJsFile(fsPath, nameSpace, text);
        await this.processComponents(components, logPad, logLevel);

        if (components && saveToCache)
        {
            const baseDir = this.getAppJsonDir(fsPath),
                  storageKey = this.getCmpStorageFileName(baseDir, nameSpace),
                  storedComponents: IComponent[] = JSON.parse(await fsStorage.get(storageKey) || "[]");

            for (const component of components)
            {
                for (let i = 0; i < storedComponents.length; i++)
                {
                    if (storedComponents[i].fsPath === fsPath)
                    {
                        storedComponents[i] = component;
                        break;
                    }
                }
            }

            await fsStorage.update(storageKey, JSON.stringify(storedComponents));
            await storage.update(storageKey + "_TIMESTAMP", new Date());
        }

        //
        // Unset 'indexing' flag, unhide toolbar indexing button
        // The 'oneCall' flag is set when the indexing is being done on the active document only
        // For bulk indexing, this is handled by caller
        //
        if (oneCall) {
            this.isIndexing = false;
            showReIndexButton();
        }

        log.methodDone("indexing " + fsPath, logLevel, logPad, true);

        return components;
    }


    /**
     * @method indexFiles
     *
     * Public initializer
     */
    async indexFiles(project?: string)
    {
        if (this.isBusy()) {
            return;
        }
        this.isIndexing = true;
        showReIndexButton(false);
        //
        // Do full indexing
        //
        await window.withProgress(
        {
            location: ProgressLocation.Window,
            cancellable: false,
            title: "ExtJs"
        },
        async (progress) =>
        {
            try {
                await this.indexAll(progress, project);
            }
            catch (e) {
                log.error(e);
            }
        });
        //
        // Validate active js document if there is one
        //
        const activeTextDocument = window.activeTextEditor?.document;
        if (activeTextDocument && activeTextDocument.languageId === "javascript") {
            await this.validateDocument(activeTextDocument, this.getNamespace(activeTextDocument));
        }
        this.isIndexing = false;
        showReIndexButton();
    }


    private async initializeInternal()
    {
        this.config = await this.configParser.getConfig();
        if (this.config.length === 0) {
            window.showInformationMessage("Could not find any app.json or .extjsrc.json files");
            return [];
        }
        await this.indexFiles();
    }


    async initialize(context: ExtensionContext): Promise<Disposable[]>
    {
        this.fsStoragePath = context.globalStoragePath;
        await this.initializeInternal();
        return this.registerWatchers(context);
    }


    isBusy()
    {
        return this.isIndexing || this.isValidating;
    }


    private async processComponents(components: IComponent[] | undefined, logPad = "", logLevel = 1)
    {
        this.components = components || [];
        //
        // If no components, then bye
        //
        if (!components || components.length === 0) {
            return;
        }

        log.methodStart("process components", logLevel, logPad, true, [[ "# of stored components", components.length ]]);

        //
        // Log the list of components and create component mappings
        //
        await utils.forEachAsync(components, (cmp: IComponent) =>
        {
            const {
                componentClass, requires, widgets, xtypes, methods, configs, properties, aliases, nameSpace
            } = cmp;

            log.write("   process component " + componentClass, logLevel + 1, logPad);
            log.values([
                ["namespace", nameSpace], ["# of widgets", widgets.length], ["# of xtypes", xtypes.length],
                ["# of methods", methods.length], ["# of configs", configs.length], ["# of properties", properties.length],
                ["# of aliases", aliases.length]
            ], logLevel + 2, logPad + "      ");
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

            log.write("      map classes to components", logLevel + 3, logPad);

            //
            // Map the component class to the various component types found
            //
            if (!this.componentClassToWidgetsMapping[nameSpace]) {
                this.componentClassToWidgetsMapping[nameSpace] = {};
            }
            this.componentClassToWidgetsMapping[nameSpace][componentClass] = widgets;
            if (!this.clsToMethodsMapping[nameSpace]) {
                this.clsToMethodsMapping[nameSpace] = {};
            }
            this.clsToMethodsMapping[nameSpace][componentClass] = methods;
            if (!this.clsToConfigsMapping[nameSpace]) {
                this.clsToConfigsMapping[nameSpace] = {};
            }
            this.clsToConfigsMapping[nameSpace][componentClass] = configs;
            if (!this.clsToPropertiesMapping[nameSpace]) {
                this.clsToPropertiesMapping[nameSpace] = {};
            }
            this.clsToPropertiesMapping[nameSpace][componentClass] = properties;
            if (!this.clsToXTypesMapping[nameSpace]) {
                this.clsToXTypesMapping[nameSpace] = {};
            }
            this.clsToXTypesMapping[nameSpace][componentClass] = xtypes;
            if (!this.componentClassToAliasesMapping[nameSpace]) {
                this.componentClassToAliasesMapping[nameSpace] = {};
            }
            this.componentClassToAliasesMapping[nameSpace][componentClass] = aliases;

            //
            // Map the filesystem path <-> component class
            //
            if (cmp.fsPath) {
                this.fileToComponentClassMapping[cmp.fsPath] = componentClass;
                this.componentClassToFilesMapping[componentClass] = cmp.fsPath;
                cmp.aliases.forEach((a) => {
                    this.componentClassToFilesMapping[a.name] = cmp.fsPath;
                });
            }

            //
            // Map the component class to it's component (it's own definition)
            //
            if (!this.clsToCmpMapping[nameSpace]) {
                this.clsToCmpMapping[nameSpace] = {};
            }
            this.clsToCmpMapping[nameSpace][componentClass] = cmp;
            cmp.aliases.forEach((a) => {
                this.clsToCmpMapping[nameSpace][a.name] = cmp;
            });

            //
            // Map the component class to any requires strings found
            //
            if (requires) {
                if (!this.componentClassToRequiresMapping[nameSpace]) {
                    this.componentClassToRequiresMapping[nameSpace] = {};
                }
                this.componentClassToRequiresMapping[nameSpace][componentClass] = requires.value;
            }

            log.write("      map components to classes", logLevel + 3, logPad);

            //
            // Map widget/alias/xtype types found to the component class
            //
            if (!this.widgetToClsMapping[nameSpace]) {
                this.widgetToClsMapping[nameSpace] = {};
            }
            widgets.forEach(xtype => {
                this.widgetToClsMapping[nameSpace][xtype] = componentClass;
            });

            //
            // Map methods found to the component class
            //
            methods.forEach(method => {
                method.markdown = this.commentParser.toMarkdown(method.name, method.doc, logPad + "   ");
                if (!this.methodToClsMapping[nameSpace]) {
                    this.methodToClsMapping[nameSpace] = {};
                }
                this.methodToClsMapping[nameSpace][method.name] = componentClass;
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
                    if (!this.variablesToComponentMapping[nameSpace]) {
                        this.variablesToComponentMapping[nameSpace] = {};
                        this.variablesToMethodMapping[nameSpace] = {};
                        this.componentClassToVariablesMapping[nameSpace] = {};
                        this.methodToVariablesMapping[nameSpace] = {};
                    }
                    this.methodToVariablesMapping[nameSpace][method.name] = [ ...method.variables ];
                    const varMapping = this.componentClassToVariablesMapping[nameSpace][componentClass];
                    if (!varMapping) {
                        this.componentClassToVariablesMapping[nameSpace][componentClass] = [ ...method.variables ];
                    }
                    else {
                        varMapping.push(...method.variables);
                    }
                    for (const v of method.variables)
                    {
                        this.variablesToComponentMapping[nameSpace][v.name] = cmp;
                        this.variablesToMethodMapping[nameSpace][v.name] = method;
                    }
                }
            });

            //
            // Map config properties found to the component class
            //
            if (!this.configToClsMapping[nameSpace]) {
                this.configToClsMapping[nameSpace] = {};
            }
            configs.forEach(config => {
                config.markdown = this.commentParser.toMarkdown(config.name, config.doc, logPad + "   ");
                this.configToClsMapping[nameSpace][config.name] = componentClass;
            });

            //
            // Map properties found to the component class
            //
            if (!this.propertyToClsMapping[nameSpace]) {
                this.propertyToClsMapping[nameSpace] = {};
            }
            properties.forEach(property => {
                property.markdown = this.commentParser.toMarkdown(property.name, property.doc, logPad + "   ");
                this.propertyToClsMapping[nameSpace][property.name] = componentClass;
            });

            //
            // Map xtypes found to the component class
            //
            if (!this.xtypeToComponentClassMapping[nameSpace]) {
                this.xtypeToComponentClassMapping[nameSpace] = {};
            }
            xtypes.forEach(xtype => {
                this.xtypeToComponentClassMapping[nameSpace][xtype.name] = componentClass;
            });

            log.write("      parsed component parts:", logLevel + 1);
            log.values([
                [ "configs", JSON.stringify(this.configToClsMapping[componentClass], undefined, 3)],
                [ "methods", JSON.stringify(this.methodToClsMapping[componentClass], undefined, 3)],
                [ "property", JSON.stringify(this.propertyToClsMapping[componentClass], undefined, 3)],
                [ "widget", JSON.stringify(this.widgetToClsMapping[componentClass], undefined, 3)],
                [ "xtypes", JSON.stringify(this.xtypeToComponentClassMapping[componentClass], undefined, 3)]
            ], 4, logPad + "   ");
            log.write("   done processing component " + componentClass, logLevel);
        });

        log.methodDone("process components", logLevel, logPad);
    }


    private async processConfigChange(e: Uri)
    {
        const action = await window.showInformationMessage("Config file modified, re-index all files?", "Yes", "No");
        if (action === "Yes") {
            fsStorage.clear();
            await this.initializeInternal();
        }
    }


    private async processDocumentChange(e: Uri)
    {
        await this.indexFile(e.fsPath, this.getNamespace(e), true, e);
    }


    private processOpenDocumentChange(e: TextDocumentChangeEvent)
    {
        if (e.contentChanges.length === 0) {
            return;
        }

        let debounceMs = configuration.get<number>("validationDelay", 1250);
        const textDocument = e.document;
        //
        // Clear debounce timeout if still pending
        //
        if (this.reIndexTaskId) {
            clearTimeout(this.reIndexTaskId);
        }

        if (textDocument.languageId === "javascript" && utils.isExtJsFile(textDocument.getText()))
        {   //
            // On enter/return key, validate immediately as the line #s for all range definitions
            // underneath the edit have just shifted by one line
            //
            for (const change of e.contentChanges)
            {
                if (change.text.includes(EOL)) {
                    debounceMs = 0;
                }
            }
            //
            // Debounce!!
            //
            this.reIndexTaskId = setTimeout(async () =>
            {
                this.reIndexTaskId = undefined;
                const ns = this.getNamespace(textDocument);
                //
                // Index the file
                //
                const components = await this.indexFile(textDocument.uri.fsPath, ns, true, textDocument);
                //
                // Validate document
                //
                if (components && components.length > 0) {
                    await this.validateDocument(textDocument, ns);
                }
            }, debounceMs);
        }
    }


    private async processDocumentDelete(uri: Uri) // (e: FileDeleteEvent)
    {
        this.handleDeleFile(uri.fsPath);
        const activeTextDocument = window.activeTextEditor?.document;
        await this.validateDocument(activeTextDocument, this.getNamespace(activeTextDocument));
    }


    private async processEditorChange(e: TextEditor | undefined)
    {
        await this.validateDocument(e?.document, this.getNamespace(e?.document));
    }


    private async processSettingsChange(e: ConfigurationChangeEvent)
    {
        if (e.affectsConfiguration("extjsIntellisense.ignoreErrors"))
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
                const components = await this.indexFile(fsPath, ns, false, document);
                //
                // Validate document
                //
                if (components && components.length > 0) {
                    this.validateDocument(document, ns);
                }
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
        log.methodStart("Register file watchers", 1, "", true);
        log.write("   Build file watcher glob", 2);
        //
        // Build watcher glob from classpaths
        //
        const classPaths = [];
        for (const c of this.config)
        {
            if (typeof(c.classpath) === "string" || c.classpath instanceof String)
            {
                log.write(`      Adding classpath ${c.classpath}`, 3);
                classPaths.push(c.classpath.replace("\\", "/"));
            }
            else {
                for (const cp of c.classpath) {
                    log.write(`      Adding classpath ${cp}`, 3);
                    classPaths.push(cp.replace("\\", "/"));
                }
            }
        }
        if (classPaths.length === 0) {
            classPaths.push("**/*.js");
        }

        log.write("   file watcher glob:", 2);
        log.write(`   **/{${classPaths.join(",")}}/**/*.js`, 2);

        //
        // rc/conf file / app.json
        //
        const disposables: Disposable[] = [],
              jsWatcher = workspace.createFileSystemWatcher(`**/{${classPaths.join(",")}}/**/*.js`),
              confWatcher = workspace.createFileSystemWatcher("**/{.extjsrc,.extjsrc.json,app.json,workspace.json}");

        //
        // Config watcher
        //
        disposables.push(confWatcher.onDidChange(async (e) => { await this.processConfigChange(e); }, this));
        disposables.push(confWatcher.onDidDelete(async (e) => { await this.processConfigChange(e); }, this));
        disposables.push(confWatcher.onDidCreate(async (e) => { await this.processConfigChange(e); }, this));

        //
        // Open document text change
        //
        disposables.push(workspace.onDidChangeTextDocument((e) => { this.processOpenDocumentChange(e); }, this));
        // disposables.push(workspace.onDidChangeTextDocument((e) => this.processDocumentChange));
        //
        // Javascript watchers
        //
        disposables.push(jsWatcher.onDidChange(async (e) => { await this.processDocumentChange(e); }, this));
        disposables.push(jsWatcher.onDidCreate(async (e) => { await this.indexFile(e.fsPath, this.getNamespace(e), true, e); }, this));
        disposables.push(jsWatcher.onDidDelete(async (e) => { await this.processDocumentDelete(e); }, this));
        //
        // Active editor changed (processes open-document too)
        //
        disposables.push(window.onDidChangeActiveTextEditor(async (e) => { await this.processEditorChange(e); }, this));
        //
        // Register configurations/settings change watcher
        //
        disposables.push(workspace.onDidChangeConfiguration(async (e) => { await this.processSettingsChange(e); }, this));

        context.subscriptions.push(...disposables);

        log.methodDone("Register file watchers", 1);
        return disposables;
    }

    /**
     * For tests
     */
    setBusy(busy: boolean)
    {
        this.isIndexing = busy;
    }


    async validateDocument(textDocument: TextDocument | undefined, nameSpace: string)
    {
        const text = textDocument?.getText();
        //
        // Check to make sure it's an ExtJs file
        //
        if (!text || !textDocument || textDocument.languageId !== "javascript" || !utils.isExtJsFile(text))
        {
            showReIndexButton(false);
        }
        else //
        {   // Validate
            //
            this.isValidating = true;
            nameSpace = nameSpace || this.getNamespace(textDocument);
            if (await pathExists(path.join(this.fsStoragePath, this.getWorkspaceProjectName(textDocument.uri.fsPath)))) {
                await this.serverRequest.validateExtJsFile(textDocument.uri.path, nameSpace, text);
            }
            // else {
            //     await this.indexFiles(this.getWorkspaceProjectName(textDocument.uri.fsPath));
            // }
            showReIndexButton(true);
            this.isValidating = false;
        }
    }

}


export default ExtjsLanguageManager;
