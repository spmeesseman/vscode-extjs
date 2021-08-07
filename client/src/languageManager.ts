
import {
    Disposable, ExtensionContext, Progress, TextDocumentChangeEvent, Range, Position,
    ProgressLocation, TextDocument, TextEditor, window, workspace, Uri, FileDeleteEvent,
    ConfigurationChangeEvent
} from "vscode";
import {
    IAlias, IConfig, IComponent, IMethod, IConf, IProperty, IXtype, utils, ComponentType,
    IVariable, VariableType, IExtJsBase, IPrimitive
} from  "../../common";

import {
    toVscodeRange, toVscodePosition, isPositionInRange, isComponent, isExcluded
} from "./common/clientUtils";
import * as log from "./common/log";
import * as path from "path";
import ServerRequest from "./common/ServerRequest";
import { EOL } from "os";
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
{
    private isIndexing = false;
    private isValidating = false;

    private config: IConf[] = [];
    private serverRequest: ServerRequest;
    private reIndexTaskId: NodeJS.Timeout | undefined;
    private dirNamespaceMap: Map<string, string> = new Map<string, string>();
    private commentParser: CommentParser;
    private configParser: ConfigParser;

    private widgetToComponentClassMapping: { [nameSpace: string]: { [widget: string]: string | undefined }} = {};
    private configToComponentClassMapping: { [nameSpace: string]: { [property: string]: string | undefined }} = {};
    private methodToComponentClassMapping: { [nameSpace: string]: { [method: string]: string | undefined }} = {};
    private propertyToComponentClassMapping: { [nameSpace: string]: { [method: string]: string | undefined }} = {};
    private xtypeToComponentClassMapping: { [nameSpace: string]: { [method: string]: string | undefined }} = {};
    private fileToComponentClassMapping: { [fsPath: string]: string | undefined } = {};
    private variablesToComponentMapping: { [nameSpace: string]: { [variable: string]: IComponent | undefined }} = {};
    private variablesToMethodMapping: { [nameSpace: string]: { [variable: string]: IMethod | undefined }} = {};

    private componentClassToWidgetsMapping: { [nameSpace: string]: { [componentClass: string]: string[] | undefined }} = {};
    private componentClassToRequiresMapping: { [nameSpace: string]: { [componentClass: string]: string[] | undefined }} = {};
    private componentClassToXTypesMapping: { [nameSpace: string]: { [componentClass: string]: IXtype[] | undefined }} = {};
    private componentClassToConfigsMapping: { [nameSpace: string]: { [componentClass: string]: IConfig[] | undefined }} = {};
    private componentClassToPropertiesMapping: { [nameSpace: string]: { [componentClass: string]: IProperty[] | undefined }} = {};
    private componentClassToMethodsMapping: { [nameSpace: string]: { [componentClass: string]: IMethod[] | undefined }} = {};
    private componentClassToComponentsMapping: { [nameSpace: string]: { [componentClass: string]: IComponent | undefined }} = {};
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


    getAlias(componentClass: string, alias: string, nameSpace?: string, logPad = ""): IXtype | undefined
    {
        if (!nameSpace) {
            nameSpace = this.getNamespaceFromClass(componentClass);
        }
        const aliases = this.componentClassToAliasesMapping[nameSpace][componentClass];
        log.methodStart("get alias", 1, logPad, false, [["component class", componentClass], ["alias", alias]]);
        if (aliases) {
            for (let c = 0; c < aliases.length; c++) {
                if (aliases[c].name.replace("widget.", "") === alias) {
                    log.methodDone("get alias", 3, logPad, false, [
                        ["name", aliases[c].name],
                        ["base namespace", "start", aliases[c].start.line + ", " + aliases[c].start.column],
                        ["end", aliases[c].end.line + ", " + aliases[c].end.column]
                    ]);
                    return aliases[c];
                }
            }
        }
        log.write("   could not find alias", 1, logPad);
        log.methodDone("get alias", 1, logPad);
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
                        aliases.push(a.name);
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


    getClassFromFile(fsPath: string, logPad = ""): string | undefined
    {
        let className: string | undefined;
        log.methodStart("get component class by file", 1, logPad, false, [["file", fsPath]]);
        const cls = this.fileToComponentClassMapping[fsPath];
        if (cls) {
            log.write("   found component class", 2, logPad);
            className = cls;
        }
        log.methodDone("get component class by file", 1, logPad, false, [["component class", className]]);
        return className;
    }


    getComponent(componentClass: string, nameSpace?: string, checkAlias?: boolean, logPad = ""): IComponent | undefined
    {
        log.methodStart("get component", 1, logPad, false, [["component class", componentClass], ["namespace", nameSpace]]);

        if (!nameSpace) {
            nameSpace = this.getNamespaceFromClass(componentClass);
        }

        let component = this.componentClassToComponentsMapping[nameSpace][componentClass];
        if (component)
        {
            log.write(logPad + "   found component", 3, logPad);
            log.value(logPad + "      namespace", component.nameSpace, 4, logPad);
            log.value(logPad + "      base namespace", component.baseNameSpace, 4, logPad);
        }

        if (!component && checkAlias === true)
        {
            component = this.getComponentByAlias(componentClass, nameSpace, logPad + "   ");
            if (component) {
                log.write(logPad + "   found aliased component", 3, logPad);
                log.value(logPad + "      namespace", component.nameSpace, 4, logPad);
                log.value(logPad + "      base namespace", component.baseNameSpace, 4, logPad);
            }
        }

        log.methodDone("get component", 2, logPad);
        return component;
    }


    getComponentNames(): string[]
    {
        const cmps: string[] = [],
              map = this.componentClassToComponentsMapping;
        Object.values(map).forEach((ns) => {
            Object.keys(ns).forEach((cmp) => {
                cmps.push(cmp);
            });
        });
        return cmps;
    }


    getComponentByAlias(alias: string, nameSpace: string, logPad = ""): IComponent | undefined
    {
        const cls = this.widgetToComponentClassMapping[nameSpace][alias];
        log.methodStart("get component by alias", 1, logPad, false, [["component alias", alias], ["namespace", nameSpace]]);
        if (cls) {
            const component = this.getComponent(cls, nameSpace, false, logPad + "   ");
            if (component) {
                log.methodDone("get component by alias", 3, logPad, false, [
                    ["namespace", component.nameSpace], ["base namespace", component.baseNameSpace]
                ]);
                return component;
            }
        }
        log.write("   could not find component by alias", 1, logPad);
        log.methodDone("get component by alias", 1, logPad);
        return undefined;
    }


    getComponentByFile(fsPath: string, logPad = ""): IComponent | undefined
    {
        log.methodStart("get component by file", 1, logPad, false, [["component file", fsPath]]);
        const cls = this.getClassFromFile(fsPath, logPad);
        if (cls) {
            log.value("   component class", cls, 2);
            const component = this.getComponent(cls, this.getNamespaceFromClass(cls), false, logPad);
            if (component) {
                log.methodDone("found component", 3, logPad, false, [["namespace", component.nameSpace], ["base namespace", component.baseNameSpace]]);
                return component;
            }
        }
        log.write("   could not find component by file", 1, logPad);
        log.methodDone("get component by file", 2, logPad);
        return undefined;
    }


    getMappedClass(property: string, nameSpace: string, cmpType: ComponentType): string | undefined
    {
        if (!cmpType || cmpType === ComponentType.Widget) {
            return this.widgetToComponentClassMapping[nameSpace][property];
        }
        else if (cmpType === ComponentType.Method) {
            return this.methodToComponentClassMapping[nameSpace][property];
        }
        else if (cmpType === ComponentType.Property) {
            return this.propertyToComponentClassMapping[nameSpace][property];
        }
        // else if (cmpType & (ComponentType.Property | ComponentType.Config)) {
        else if (cmpType === ComponentType.Config) {
            // if (this.propertyToComponentClassMapping[property]) {
            //     return this.propertyToComponentClassMapping[property];
            // }
            return this.configToComponentClassMapping[nameSpace][property];
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
    private getComponentClass(property: string, nameSpace: string, position: Position | undefined, lineText: string, fsPath: string | undefined, logPad = ""): string | undefined
    {
        let cmpClass = "this", // getComponentByConfig(property);
            cmpClassPre, cmpClassPreIdx = -1, cutAt = 0;

        log.methodStart("get component class", 1, logPad, false, [["property", property], ["namespace", nameSpace]]);

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
                cmpClass = this.getComponentByFile(fsPath, logPad + "   ")?.componentClass || "";
            }
        }
        else //
        {   // Check aliases/alternate class names
            //
            let aliasClass: string | undefined;
            if (aliasClass = this.widgetToComponentClassMapping[nameSpace][cmpClass])
            {
                cmpClass = aliasClass;
            }
        }

        //
        // Instances
        //
        if (fsPath && !this.getComponent(cmpClass, nameSpace, true, logPad + "   "))
        {
            const instance = this.getComponentInstance(cmpClass, nameSpace, position || new Position(0, 0), fsPath, logPad + "   ");
            if (isComponent(instance)) {
                cmpClass = instance.componentClass;
            }
        }

        log.methodDone("get component class", 1, logPad, false, [["class", cmpClass]]);
        return cmpClass;
    }


    getComponentInstance(property: string, nameSpace: string, position: Position, fsPath: string, logPad = ""): IComponent | IPrimitive | undefined
    {
        log.methodStart("get component instance", 1, logPad, false, [["property", property], ["namespace", nameSpace]]);

        const thisCls = this.getClassFromFile(fsPath, logPad + "   ");

        if (thisCls)
        {
            const cmp = this.getComponent(thisCls, nameSpace, true, logPad + "   ");

            if (property === "this") {
                log.methodDone("get component instance", 1, logPad, false, [["component class", "this"]]);
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
                            const cmp = this.getComponent(variable.componentClass, nameSpace, true, logPad + "   ");
                            if (cmp) {
                                log.methodDone("get component instance", 1, logPad);
                                return cmp;
                            }
                            else {
                                log.methodDone("get component instance", 1, logPad);
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

        log.methodDone("get component instance", 1, logPad);
    }


    getConfig(componentClass: string, property: string, nameSpace?: string, logPad = ""): IConfig | undefined
    {
        if (!nameSpace) {
            nameSpace = this.getNamespaceFromClass(componentClass);
        }
        const configs = this.componentClassToConfigsMapping[nameSpace][componentClass];
        log.methodStart("get config by component class", 1, logPad, false, [
            ["component class", componentClass], ["property", property], ["namespace", nameSpace]
        ]);
        if (configs)
        {
            for (let c = 0; c < configs.length; c++)
            {
                if (configs[c].name === property)
                {
                    log.write("   found config", 3, logPad);
                    log.value("      name", configs[c].name, 4, logPad);
                    log.value("      start", configs[c].start.line + ", " + configs[c].start.column, 4, logPad);
                    log.value("      end", configs[c].end.line + ", " + configs[c].end.column, 4, logPad);
                    log.methodDone("get config by component class", 1, logPad);
                    return configs[c];
                }
            }
        }
        log.write("   could not find config by component class", 1, logPad);
        log.methodDone("get config by component class", 1, logPad);
        return undefined;
    }


    getFilePath(componentClass: string, logPad = "")
    {
        const fsPath = this.componentClassToFilesMapping[componentClass];
        log.write("get fs path by component", 1, logPad);
        log.value("   path", fsPath, 2, logPad);
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
    getLineProperties(document: TextDocument, position: Position, logPad = ""): ILineProperties
    {
        const line = position.line,
              nextLine = document.lineAt(line + 1),
              allLineText = document.getText(new Range(new Position(line, 0), nextLine.range.start)).trim(),
              thisCmp = this.getComponentByFile(document.uri.fsPath) as IComponent,
              range = document.getWordRangeAtPosition(position) || new Range(position, position);

        log.methodStart("get line properties", 1, logPad, false, [
            ["namespace", thisCmp.nameSpace], ["component class", thisCmp.componentClass], ["line text (all)", allLineText]
        ]);

        //
        // Break line text down up to the property and any calle objects/class instance we need to examine
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

        log.value("   trimmed line text", lineText, 2);

        //
        // Handle "this"
        // TODO - handle 'this' for non-controller function with local this
        //
        if (property === "this")
        {
            log.methodDone("get line properties", 2, logPad, false, [["component class", "this"]]);
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
        // String literal xtype
        //
        else if (lineText.match(new RegExp(`\\.(up|down|next|prev)\\(\\s*["']{1}${property}["']{1}\\s*\\)`)))
        {
            cmpType = ComponentType.Class;
            //
            // Strip off everything outside the quotes to get our xtype, i.e.
            //
            //     grid.up('mypanel')
            //
            // We want 'mypanel'
            //
            lineText = lineText.replace(/^[^"']*["']{1}/, "").replace(/["']{1}[\w\W]*$/, "");
            //
            // Set the property to the last piece of the xtype's class name.
            //
            const xtypeCmp = this.xtypeToComponentClassMapping[thisCmp.nameSpace][lineText];
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
            if (!this.getComponentByAlias(property, thisCmp.nameSpace) && !this.getComponent(property, thisCmp.nameSpace, false, logPad + "   ")) {
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

        log.value("   property", property, 2, logPad);
        log.value("   component type", cmpType, 2, logPad);

        if (cmpType === ComponentType.Class)
        {
            cmpClass = lineText.substring(0, lineText.indexOf(property) + property.length);
            const cls = this.variablesToComponentMapping[thisCmp.nameSpace][property];
            if (cls && cls.name) {
                const variable = this.componentClassToVariablesMapping[thisCmp.nameSpace][cls.name]?.find(v => v.name === property);
                cmpClass = variable?.componentClass;
            }
            else {
                let cmp = this.getComponent(property, thisCmp.nameSpace, true, logPad + "   ");
                if (cmp) {
                    cmpClass = cmp.componentClass;
                }
                else {
                    const icmp = this.getComponentInstance(property, thisCmp.nameSpace, position, document.uri.fsPath, logPad + "   ");
                    if (isComponent(icmp)) {
                        cmp = icmp;
                    }
                }
            }
        }
        else if (cmpType === ComponentType.Method)
        {
            cmpClass = this.getComponentClass(property, thisCmp.nameSpace, position, lineText, thisPath, logPad + "   ");
            if (cmpClass)
            {   //
                // getComponentClass() will return the file class if this is a config getter/setter, so
                // check the methods mapping to see if it exists on the main component or not.  If it doesnt
                // then check if its a config property getter/setter fn
                //
                const classHasMethod = !!this.componentClassToMethodsMapping[thisCmp.nameSpace][cmpClass]?.find(x => x.name === property);
                if (!classHasMethod && utils.isGetterSetter(property))
                {   //
                    // A config property:
                    //
                    //     user: null
                    //
                    // Will have the folloiwng getter/setter created by the framework if not defined
                    // on the object:
                    //
                    //     getUser()
                    //     setUser(value)
                    //
                    // Check for these config methods, see if they exist for this property
                    //
                    log.write("   method not found, look for getter/setter config", 2, logPad);
                    property = utils.lowerCaseFirstChar(property.substring(3));
                    cmpType = ComponentType.Config;
                    log.value("      config name", property, 2, logPad);
                    // cmpClass = this.getComponentClass(property, thisCmp.nameSpace, position, lineText, thisPath);
                }
            }
        }
        else // ComponentType.Property / ComponentType.Config | variable / parameter
        {
            const cmp = this.getComponentInstance(property, thisCmp.nameSpace, position, document.uri.fsPath, logPad + "   "),
                  cfgCls = this.getMappedClass(property, thisCmp.nameSpace, ComponentType.Config);
            cmpClass = cmp?.componentClass || this.getComponentClass(property, thisCmp.nameSpace, position, lineText, thisPath, logPad + "   ");
            if (!cmpClass)
            {
                log.write("   property not found, look for config", 2, logPad);
                cmpType = ComponentType.Property;
                cmpClass = this.getComponentClass(property, thisCmp.nameSpace, position, lineText, thisPath, logPad + "   ");
                if (cfgCls === cmpClass) {
                    cmpType = ComponentType.Config;
                }
            }
            //
            // If this is a property, check for a config property...
            //
            else if (cmpType === ComponentType.Property && cfgCls)
            {
                log.write("   property not found, got config", 2, logPad);
                cmpType = ComponentType.Config;
                cmpClass = cfgCls;
            }
        }

        let callee: string | undefined;
        if (cmpClass) {
            callee = lineText.substring(lineText.indexOf(cmpClass) + cmpClass.length)
                             .replace(/\(.{0,1}\)\s*[;]*/, "").replace(".", "").trim();
        }

        log.methodDone("get line properties", 2, logPad, false, [["component class", cmpClass]]);

        return {
            cmpClass,
            cmpType,
            property,
            thisCmp,
            thisClass: thisCmp?.componentClass,
            callee
        };
    }


    private getNamespace(document: TextDocument | Uri | undefined)
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


    getNamespaceFromClass(componentClass: string)
    {
        if (componentClass.indexOf(".") !== -1) {
            return componentClass.substring(0, componentClass.indexOf("."));
        }
        return componentClass;
    }


    /**
     * @method getNamespaceFromFile
     *
     * @param fsPath Filesystem path to file
     * @param part Zero-based index of namespace part to return
     */
    getNamespaceFromFile(fsPath: string, part?: number, logPad = ""): string | undefined
    {
        let ns: string | undefined;
        log.methodStart("get namespace from file", 1, logPad, false, [["file", fsPath]]);
        const cls = this.fileToComponentClassMapping[fsPath];
        if (cls){
            log.value("   found base class", cls, 3, logPad);
            ns = cls.split(".")[part ?? 0];
        }
        log.methodDone("get namespace from file", 1, logPad, false, [["namespace", ns]]);
        return ns;
    }


    getPropertyPosition(property: string, cmpType: ComponentType, componentClass: string, nameSpace?: string, logPad = "")
    {
        let start = new Position(0, 0),
            end = new Position(0, 0);

        if (!nameSpace) {
            nameSpace = this.getNamespaceFromClass(componentClass);
        }

        const pObject = cmpType === ComponentType.Method ? this.getMethod(componentClass, property, nameSpace) :
                                      (cmpType === ComponentType.Config ? this.getConfig(componentClass, property, nameSpace, logPad + "   ") :
                                                                          this.getProperty(componentClass, property, nameSpace, logPad + "   "));

        const _setPosition = ((o: IExtJsBase) =>
        {
            if (o.start && o.end)
            {
                log.write("setting position", 2, logPad);
                log.value("   start line", o.start?.line, 3, logPad);
                log.value("   end line", o.end?.line, 3, logPad);
                start = toVscodePosition(o.start);
                end = toVscodePosition(o.end);
            }
        });

        if (pObject)
        {
            _setPosition(pObject);
        }
        else //
        {   // In the case where there are multipl classes defined in one file, get the main
            // component file and search for the class position in the case where it is not 0,0
            //
            const mainCmp = this.getComponent(componentClass, nameSpace, false, logPad + "   ");
            if (mainCmp) {
                _setPosition(mainCmp);
            }
        }

        return { start, end };
    }


    getProperty(componentClass: string, property: string, nameSpace?: string, logPad = ""): IProperty | undefined
    {
        let prop: IProperty | undefined;
        if (!nameSpace) {
            nameSpace = this.getNamespaceFromClass(componentClass);
        }
        const properties = this.componentClassToPropertiesMapping[nameSpace][componentClass];
        log.methodStart("get property by component class", 1, logPad, false, [
            ["component class", componentClass], ["property", property], ["namespace", nameSpace]
        ]);
        if (properties) {
            for (let c = 0; c < properties.length; c++) {
                if (properties[c].name === property) {
                    log.write("   found property", 3, logPad);
                    log.value("      name", properties[c].name, 4, logPad);
                    log.value("      start (line/col)",  properties[c].start.line + ", " + properties[c].start.column, 4, logPad);
                    log.value("      end (line/col)", properties[c].end.line + ", " + properties[c].end.column, 4, logPad);
                    prop = properties[c];
                    break;
                }
            }
        }
        log.methodDone("get property by component class", 1, logPad);
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


    getMethod(componentClass: string, property: string, nameSpace?: string, logPad = ""): IMethod| undefined
    {
        log.methodStart("get method by property", 1, logPad, false, [
            ["component class", componentClass], ["property", property], ["namespace", nameSpace]
        ]);

        let method: IMethod | undefined;
        if (!nameSpace) {
            nameSpace = this.getNamespaceFromClass(componentClass);
        }
        const methods = this.componentClassToMethodsMapping[nameSpace][componentClass];

        if (methods)
        {
            for (let c = 0; c < methods.length; c++)
            {
                if (methods[c].name === property) {
                    log.write("   found method", 3, logPad);
                    log.value("      name", methods[c].name, 4, logPad);
                    log.value("      start (line/col)",  methods[c].start.line + ", " + methods[c].start.column, 4, logPad);
                    log.value("      end (line/col)", methods[c].end.line + ", " + methods[c].end.column, 4, logPad);
                    method = methods[c];
                    break;
                }
            }
        }

        log.methodDone("get method by property", 1, logPad, false, [["method", method]]);
        return method;
    }


    getSubComponentNames(componentClass: string, logPad = ""): string[]
    {
        const subComponentNames: string[] = [],
              map = this.componentClassToComponentsMapping;

        log.write("get sub-component names", 1, logPad);
        log.value("   component class", componentClass, 2, logPad);

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


    getXType(componentClass: string, xtype: string, logPad = ""): IXtype | undefined
    {
        log.methodStart("get xtype by component class", 1, logPad, false, [["component class", componentClass], ["xtype", xtype]]);

        let x: IXtype | undefined;
        const ns = this.getNamespaceFromClass(componentClass);
        if (!ns) {
            return undefined;
        }
        const xtypes = this.componentClassToXTypesMapping[ns][componentClass];

        if (xtypes) {
            for (let c = 0; c < xtypes.length; c++) {
                if (xtypes[c].name === xtype) {
                    log.write("   found config", 3, logPad);
                    log.value("      name", xtypes[c].name, 4, logPad);
                    log.value("      start", xtypes[c].start.line + ", " + xtypes[c].start.column, 4, logPad);
                    log.value("      end", xtypes[c].end.line + ", " + xtypes[c].end.column, 4, logPad);
                    x = xtypes[c];
                    break;
                }
            }
        }

        log.methodDone("get xtype by component class", 1, logPad, false, [["xtype", x]]);
        return x;
    }


    getXtypeNames(): string[]
    {
        const xtypes: string[] = [],
              xmap = this.componentClassToXTypesMapping;

        Object.values(xmap).forEach((ns) =>
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


    private getStorageKey(fsPath: string)
    {
        const wsf = workspace.getWorkspaceFolder(Uri.file(fsPath));
        if (wsf) {
            return fsPath.replace(wsf.uri.fsPath, "");
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
                    delete this.configToComponentClassMapping[componentNs][config.name];
                });

                component.methods.forEach((method) => {
                    delete this.methodToComponentClassMapping[componentNs][method.name];
                    method.variables?.forEach((v) => {
                        delete this.variablesToComponentMapping[componentNs][v.name];
                        delete this.variablesToMethodMapping[componentNs][v.name];
                    });
                });

                // component.privates.forEach((private) => {
                //     delete privateToComponentClassMapping[private.name];
                // });

                component.properties.forEach((property) => {
                    delete this.propertyToComponentClassMapping[componentNs][property.name];
                });

                // component.statics.forEach((static) => {
                //     delete configToComponentClassMapping[static.name];
                // });

                component.widgets.forEach((widget) => {
                    delete this.widgetToComponentClassMapping[componentNs][widget];
                });
            }

            delete this.fileToComponentClassMapping[fsPath];
            delete this.methodToVariablesMapping[componentNs][componentClass];

            delete this.componentClassToWidgetsMapping[componentNs][componentClass];
            delete this.componentClassToAliasesMapping[componentNs][componentClass];
            delete this.componentClassToFilesMapping[componentClass];
            delete this.componentClassToRequiresMapping[componentNs][componentClass];
            delete this.componentClassToConfigsMapping[componentNs][componentClass];
            delete this.componentClassToPropertiesMapping[componentNs][componentClass];
            delete this.componentClassToMethodsMapping[componentNs][componentClass];
            delete this.componentClassToComponentsMapping[componentNs][componentClass];
            delete this.componentClassToVariablesMapping[componentNs][componentClass];
        }

        log.methodDone("handle delete file", 1);
    }


    private async indexAll(progress?: Progress<any>, forceAstIndexing = false)
    {
        log.methodStart("indexing all", 1, "", true, [[ "# of configs", this.config.length ]]);

        const processedDirs: string[] = [],
              cfgPct = this.config && this.config.length ? 100 / this.config.length : 100;
        let currentCfgIdx = 0,
            components: IComponent[] = [];

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

        for (const conf of this.config)
        {
            let currentFileIdx = 0,
                numFiles = 0,
                dirs: string[] = [],
                increment: number | undefined;

            progress?.report({
                increment: 0,
                message: `: Scanning project ${path.basename(conf.wsDir)}`
            });

            const storageKey = this.getStorageKey(path.join(conf.baseDir, "components.json")),
                storedComponents = !forceAstIndexing ? fsStorage?.get(conf.name, storageKey) : undefined;

            //
            // Get components for this directory from local storage if exists
            //
            if (storedComponents)
            {
                if (!_isIndexed(conf.baseDir))
                {
                    components = JSON.parse(storedComponents);
                    increment = Math.round(1 / components.length * cfgPct);
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
                    await this.processComponents(components, "   ");
                    progress?.report({
                        increment,
                        message: Math.round(++currentCfgIdx * cfgPct) + "%"
                    });
                }
            }
            else // index the file via the languge server
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
                        const uris = await workspace.findFiles(`${path.join(conf.baseWsDir, dir)}/**/*.js`);
                        numFiles += uris.length;
                    }
                }

                increment = Math.round(1 / numFiles * cfgPct);

                log.blank();
                log.value("   # of files to index", numFiles, 1);

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
                                const cmps = await this.indexFile(uri.fsPath, conf.name, false, uri, false, "   ");
                                if (cmps) {
                                    components.push(...cmps);
                                }
                            }
                            catch (e) {
                                log.error(e.toString());
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
                    await fsStorage?.update(conf.name, storageKey, JSON.stringify(components));
                    await storage?.update(storageKey + "_TIMESTAMP", new Date());
                }

                progress?.report({
                    increment,
                    message: ": Indexing " + Math.round(++currentCfgIdx * cfgPct) + "%"
                });
            }
        }

        log.methodDone("indexing all", 1, "", true);
    }


    async indexFile(fsPath: string, project: string, saveToCache: boolean, document: TextDocument | Uri, oneCall = true, logPad = ""): Promise<IComponent[] | false | undefined>
    {
        log.methodStart("indexing " + fsPath, 2, logPad, true, [[ "project", project ]]);

        const uriFile = Uri.file(fsPath),
              wsPath = workspace.getWorkspaceFolder(uriFile)?.uri.fsPath;

        //
        // Exclude configured build dir from workspace.json
        //
        for (const c of this.config) {
            if (c.buildDir && wsPath) {
                const buildUriPath = Uri.file(path.join(wsPath, c.buildDir)).path;
                if (uriFile.path.includes(buildUriPath)) {
                    log.write(logPad + "Excluded by workspace.json build path");
                    return;
                }
            }
        }

        //
        // Exclude Application/workspace/user configured paths
        // Paths must be glob pattern e.g. **/src/**
        //
        if (isExcluded(uriFile.path)) {
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

        const components = await this.serverRequest.parseExtJsFile(fsPath, project, text);
        await this.processComponents(components, logPad);

        if (components && saveToCache)
        {
            const baseDir = this.getAppJsonDir(fsPath),
                  storageKey = this.getStorageKey(path.join(baseDir, "components.json")),
                  storedComponents: IComponent[] = JSON.parse(fsStorage?.get(project, storageKey) || "[]");

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

            await fsStorage?.update(project, storageKey, JSON.stringify(storedComponents));
            await storage?.update(storageKey + "_TIMESTAMP", new Date());
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

        log.methodDone("indexing " + fsPath, 2, logPad, true);

        return components;
    }


    /**
     * @method indexFiles
     *
     * Public initializer
     */
    async indexFiles()
    {
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
                await this.indexAll(progress);
            }
            catch {}
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
        await this.initializeInternal();
        return this.registerWatchers(context);
    }


    isBusy()
    {
        return this.isIndexing || this.isValidating;
    }


    private async processComponents(components: IComponent[] | undefined, logPad = "")
    {   //
        // If no commponenst, then bye
        //
        if (!components || components.length === 0) {
            return;
        }

        log.methodStart("process components", 1, logPad, true, [[ "# of stored components", components.length ]]);

        //
        // Loog the list of components and create component mappings
        //
        await utils.forEachAsync(components, (cmp: IComponent) =>
        {
            const {
                componentClass, requires, widgets, xtypes, methods, configs, properties, aliases, nameSpace
            } = cmp;

            log.value("   process component " + componentClass, 2);
            log.value("      namespace", nameSpace, 3);
            log.value("      # of widgets", widgets.length, 3);
            log.value("      # of xtypes", xtypes.length, 3);
            log.value("      # of methods", methods.length, 3);
            log.value("      # of configs", configs.length, 3);
            log.value("      # of properties", properties.length, 3);
            log.value("      # of aliases", aliases.length, 3);

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

            log.write("   map classes to components", 4, logPad);

            //
            // Map the component class to the various component types found
            //
            if (!this.componentClassToWidgetsMapping[nameSpace]) {
                this.componentClassToWidgetsMapping[nameSpace] = {};
            }
            this.componentClassToWidgetsMapping[nameSpace][componentClass] = widgets;
            if (!this.componentClassToMethodsMapping[nameSpace]) {
                this.componentClassToMethodsMapping[nameSpace] = {};
            }
            this.componentClassToMethodsMapping[nameSpace][componentClass] = methods;
            if (!this.componentClassToConfigsMapping[nameSpace]) {
                this.componentClassToConfigsMapping[nameSpace] = {};
            }
            this.componentClassToConfigsMapping[nameSpace][componentClass] = configs;
            if (!this.componentClassToPropertiesMapping[nameSpace]) {
                this.componentClassToPropertiesMapping[nameSpace] = {};
            }
            this.componentClassToPropertiesMapping[nameSpace][componentClass] = properties;
            if (!this.componentClassToXTypesMapping[nameSpace]) {
                this.componentClassToXTypesMapping[nameSpace] = {};
            }
            this.componentClassToXTypesMapping[nameSpace][componentClass] = xtypes;
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
            }

            //
            // Map the component class to it's component (it's own definition)
            //
            if (!this.componentClassToComponentsMapping[nameSpace]) {
                this.componentClassToComponentsMapping[nameSpace] = {};
            }
            this.componentClassToComponentsMapping[nameSpace][componentClass] = cmp;

            //
            // Map the component class to any requires strings found
            //
            if (requires) {
                if (!this.componentClassToRequiresMapping[nameSpace]) {
                    this.componentClassToRequiresMapping[nameSpace] = {};
                }
                this.componentClassToRequiresMapping[nameSpace][componentClass] = requires.value;
            }

            log.write("   map components to classes", 4, logPad);

            //
            // Map widget/alias/xtype types found to the component class
            //
            if (!this.widgetToComponentClassMapping[nameSpace]) {
                this.widgetToComponentClassMapping[nameSpace] = {};
            }
            widgets.forEach(xtype => {
                this.widgetToComponentClassMapping[nameSpace][xtype] = componentClass;
            });

            //
            // Map methods found to the component class
            //
            methods.forEach(method => {
                method.markdown = this.commentParser.toMarkdown(method.name, method.doc, logPad + "   ");
                if (!this.methodToComponentClassMapping[nameSpace]) {
                    this.methodToComponentClassMapping[nameSpace] = {};
                }
                this.methodToComponentClassMapping[nameSpace][method.name] = componentClass;
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
            if (!this.configToComponentClassMapping[nameSpace]) {
                this.configToComponentClassMapping[nameSpace] = {};
            }
            configs.forEach(config => {
                config.markdown = this.commentParser.toMarkdown(config.name, config.doc, logPad + "   ");
                this.configToComponentClassMapping[nameSpace][config.name] = componentClass;
            });

            //
            // Map properties found to the component class
            //
            if (!this.propertyToComponentClassMapping[nameSpace]) {
                this.propertyToComponentClassMapping[nameSpace] = {};
            }
            properties.forEach(property => {
                property.markdown = this.commentParser.toMarkdown(property.name, property.doc, logPad + "   ");
                this.propertyToComponentClassMapping[nameSpace][property.name] = componentClass;
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
        });

        log.methodDone("process components", 1, logPad, true);
    }


    private async processConfigChange(e: Uri)
    {
        const action = await window.showInformationMessage("Config file modified, re-index all files?", "Yes", "No");
        if (action === "Yes") {
            fsStorage?.clear();
            await this.initializeInternal();
        }
    }


    private async processDocumentChange(e: Uri)
    {
        await this.indexFile(e.fsPath, this.getNamespace(e), true, e);
    }


    private processOpenDocumentChange(e: TextDocumentChangeEvent)
    {
        let debounceMs = configuration.get<number>("validationDelay", 1250);
        const textDocument = e.document;

        //
        // On enter/return key, validate immediately as the line #s for all range definitions
        // underneath the edit have just shifted by one line
        //
        for (const change of e.contentChanges)
        {
            if (change.text.includes(EOL)) {
                debounceMs = 0;
            }
        }

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
                const ns = this.getNamespace(textDocument);
                //
                // Clear
                //
                // this.handleDeleFile(fsPath);
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
        if (activeTextDocument && activeTextDocument.languageId === "javascript") {
            await this.validateDocument(activeTextDocument, this.getNamespace(activeTextDocument));
        }
    }


    private async processDocumentOpen(textDocument: TextDocument)
    {
        if (textDocument.languageId === "javascript") {
           await this.validateDocument(textDocument, this.getNamespace(textDocument));
        }
    }


    private async processEditorChange(e: TextEditor | undefined)
    {
        const textDocument = e?.document;
        if (textDocument) {
            if (textDocument.languageId === "javascript") {
                await this.validateDocument(textDocument, this.getNamespace(textDocument));
            }
        }
    }


    private async processSettingsChange(e: ConfigurationChangeEvent)
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

        log.value("   file watcher globs", classPaths.join (" | "), 2);
        log.write(`**/{${classPaths.join(",")}}/**/*.js`);

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
        // Active editor changed
        //
        disposables.push(window.onDidChangeActiveTextEditor(async (e) => { await this.processEditorChange(e); }, this));
        //
        // Open text document
        //
        disposables.push(workspace.onDidOpenTextDocument(async (e) => { await this.processDocumentOpen(e); }, this));
        //
        // Register configurations/settings change watcher
        //
        disposables.push(workspace.onDidChangeConfiguration(async (e) => { await this.processSettingsChange(e); }, this));

        context.subscriptions.push(...disposables);

        log.methodDone("Register file watchers", 1);
        return disposables;
    }


    async validateDocument(textDocument?: TextDocument, nameSpace?: string)
    {
        this.isValidating = true;
        if (!textDocument) {
            textDocument = window.activeTextEditor?.document;
        }
        if (textDocument)
        {
            const text = textDocument.getText();
            if (!nameSpace) {
                nameSpace = this.getNamespace(textDocument);
            }
            if (utils.isExtJsFile(text)) {
                await this.serverRequest.validateExtJsFile(textDocument.uri.path, nameSpace, text);
            }
        }
        this.isValidating = false;
    }

}


export default ExtjsLanguageManager;
