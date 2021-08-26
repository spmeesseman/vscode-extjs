
import {
    Disposable, ExtensionContext, Progress, TextDocumentChangeEvent, Range, Position,
    ProgressLocation, TextDocument, window, workspace, Uri, ConfigurationChangeEvent, commands
} from "vscode";
import {
    IConfig, IComponent, IMethod, IConf, IProperty, utils, ComponentType,
    IVariable, VariableType, IExtJsBase, IPrimitive, IParameter, extjs, IPosition
} from  "../../common";

import {
    toVscodeRange, toVscodePosition, isPositionInRange, isComponent, isExcluded, documentEol, getWorkspaceProjectName, toIPosition
} from "./common/clientUtils";
import * as log from "./common/log";
import * as path from "path";
import ServerRequest from "./common/ServerRequest";
import { pathExists } from "../../common/lib/fs";
import { fsStorage } from "./common/fsStorage";
import { storage } from "./common/storage";
import { configuration } from "./common/configuration";
import { CommentParser } from "./common/commentParser";
import { ConfigParser } from "./common/configParser";
import { showReIndexButton } from "./commands/indexFiles";


export interface ILineProperties
{
    property: string;
    cmpClass?: string;
    cmp?: IComponent;
    callee?: string;
    calleeCmp?: IExtJsBase;
    thisClass?: string;
    thisCmp?: IComponent;
    cmpType: ComponentType;
    text: string;
    lineText: string;
    project: string;
    component: IComponent | IPrimitive | undefined;
}


class ExtjsLanguageManager
{   //
    // When an update requires a re-index, change the name of this flag
    //
    private forceReIndexOnUpdateFlag = "vscode-extjs-flags-0.7.2";

    private isIndexing = false;
    private isValidating = false;
    private fsStoragePath = "";

    private config: IConf[] = [];
    private serverRequest: ServerRequest;
    private reIndexTaskIds: Map<string, NodeJS.Timeout | undefined> = new Map();
    private dirNamespaceMap: Map<string, string> = new Map<string, string>();
    private commentParser: CommentParser;
    private configParser: ConfigParser;
    private components: IComponent[] = [];
    private isTests = false;
    private currentLineCount = 0;

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

    private clsToFilesMapping: { [project: string]: { [componentClass: string]: string | undefined }} = {};


    constructor(serverRequest: ServerRequest)
    {
        this.serverRequest = serverRequest;
        this.commentParser = new CommentParser();
        this.configParser = new ConfigParser();
    }


    getAliasNames(): string[]
    {
        const aliases: string[] = [];
        this.components.forEach((c) => {
            c.aliases.forEach((a) => {
                if (!aliases.includes(a.name)) {
                    aliases.push(a.name);
                }
            });
        });
        return aliases;
    }


    private getAppJsonDir(fsPath: string)
    {
        // this.config.find((c) => fsPath.indexOf(c.baseDir) !== -1)?.baseDir
        let appJsonDir = path.dirname(fsPath);
        for (const conf of this.config)
        {
            if (fsPath.includes(conf.baseDir)) {
                appJsonDir = conf.baseDir;
                break;
            }
        }
        return appJsonDir;
    }


    getClsByPath(fsPath: string): string | undefined
    {
        const project = getWorkspaceProjectName(fsPath);
        return this.components.find(c => project === c.project && c.fsPath === fsPath)?.componentClass;
    }


    getClsByProperty(property: string, project: string, cmpType: ComponentType): string | undefined
    {
        let cls: string | undefined;
        if (cmpType === ComponentType.Widget) {
            cls = this.components.find(c => project === c.project && c.xtypes.find(x => x.name.replace("widget.", "") === property))?.componentClass ||
                  this.components.find(c => project === c.project && c.aliases.find(a => a.name.replace("widget.", "") === property))?.componentClass;
        }
        else if (cmpType === ComponentType.Store) {
            cls = this.components.find(c => project === c.project && c.aliases.find(t => t.name === `store.${property}`))?.componentClass;
        }
        return cls;
    }


    getComponents()
    {
        return this.components;
    }


    getComponent(componentClass: string, project: string, logPad: string, logLevel: number, position?: IPosition, thisCmp?: IComponent): IComponent | undefined
    {
        log.methodStart("get component", logLevel, logPad, false, [["component class", componentClass], ["project", project]]);
        const component = extjs.getComponent(componentClass, project, this.components, position, thisCmp, undefined, logPad, logLevel);
        log.methodDone("get component", logLevel, logPad, false, [["found", !!component]]);
        return component;
    }


    getComponentNames(): string[]
    {
        const cmps: string[] = [];
        this.components.forEach((c) => {
            if (!cmps.includes(c.componentClass)) {
                cmps.push(c.componentClass);
            }
        });
        return cmps;
    }


    getComponentByAlias(alias: string, project: string, logPad: string, logLevel: number, position?: IPosition, thisCmp?: IComponent): IComponent | undefined
    {
        log.methodStart("get component by alias", logLevel, logPad, false, [["component alias", alias], ["project", project]]);
        const component = extjs.getComponentByAlias(alias, project, this.components, position, thisCmp, undefined, logPad, logLevel);
        log.methodDone("get component by alias", logLevel, logPad, false, [["found", !!component]]);
        return component;
    }


    getComponentByFile(fsPath: string, logPad = "", logLevel = 1): IComponent | undefined
    {
        let component: IComponent | undefined;
        log.methodStart("get component by file", logLevel, logPad, false, [["component file", fsPath]]);
        const cls = this.getClsByPath(fsPath),
              project = getWorkspaceProjectName(fsPath);
        if (cls) {
            log.value("   component class", cls, logLevel + 1, logPad);
            component = this.getComponent(cls, project, logPad, logLevel + 1);
        }
        log.methodDone("get component by file", logLevel, logPad);
        return component;
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
    private getComponentClass(property: string, project: string, position: Position, lineText: string, fsPath: string | undefined, logPad = "", logLevel = 1): string | undefined
    {
        let cmpClass = "this", // getComponentByConfig(property);
            cmpClassPre, cmpClassPreIdx = -1, cutAt = 0;

        log.methodStart("get component class", logLevel, logPad, false, [["property", property], ["project", project]]);

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
            if (cmpClass[i] < "A" || cmpClass[i] > "z")
            {
                if (cmpClass[i] > "9" || cmpClass[i] < "0") {
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
        //
        // Instances
        //
        else if (!this.getComponent(cmpClass, project, logPad + "   ", logLevel, toIPosition(position)) && fsPath)
        {
            const instance = this.getComponentInstance(cmpClass, project, position, fsPath, logPad + "   ", logLevel);
            if (isComponent(instance)) {
                cmpClass = instance.componentClass;
            }
        }

        log.methodDone("get component class", logLevel, logPad, false, [["class", cmpClass]]);
        return cmpClass;
    }


    getComponentInstance(property: string, project: string, position: Position, fsPath: string, logPad = "", logLevel = 1): IComponent | IPrimitive | undefined
    {
        log.methodStart("get component instance", logLevel, logPad, false, [["property", property], ["project", project]]);

        const thisCls = this.getClsByPath(fsPath);

        if (thisCls)
        {
            const cmp = this.getComponent(thisCls, project, logPad + "   ", logLevel, toIPosition(position));

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
                        let variable: IVariable | IParameter | undefined = method.variables?.find(v => v.name === property);
                        if (!variable) {
                            variable = method.params?.find(v => v.name === property);
                            if (variable?.type !== VariableType._class) {
                                variable = undefined;
                            }
                        }
                        if (variable) {
                            const cmp = this.getComponent(variable.componentClass, project, logPad + "   ", logLevel, toIPosition(position));
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
                                    componentClass: variable.componentClass,
                                    range: utils.toRange(variable.start, variable.end)
                                };
                            }
                        }
                    }
                }
            }
        }

        log.methodDone("get component instance", logLevel, logPad);
    }


    getConfig(componentClass: string, property: string, project: string, logPad = "", logLevel = 1): IConfig | undefined
    {
        let config: IConfig | undefined;

        log.methodStart("get config by component class", logLevel, logPad, false, [
            ["component class", componentClass], ["property", property], ["project", project]
        ]);

        //
        // Get ns/cmp
        //
        const cmp = this.components.find(c => c.componentClass === componentClass && c.project === project);
        if (cmp && cmp.configs)
        {
            for (let c = 0; c < cmp.configs.length; c++)
            {
                if (cmp.configs[c].name === property)
                {
                    log.write("   found config", logLevel + 2, logPad);
                    log.value("      name", cmp.configs[c].name, logLevel + 3, logPad);
                    log.value("      start", cmp.configs[c].start.line + ", " + cmp.configs[c].start.column, logLevel + 3, logPad);
                    log.value("      end", cmp.configs[c].end.line + ", " + cmp.configs[c].end.column, logLevel + 3, logPad);
                    config = cmp.configs[c];
                }
            }
        }
        else {
            log.write("   could not find config by component class", logLevel, logPad);
        }

        log.methodDone("get config by component class", logLevel, logPad);

        return config;
    }


    getFilePath(componentClass: string, project: string, logPad = "", logLevel = 1)
    {
        const fsPath = this.clsToFilesMapping[project][componentClass];
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
              range = document.getWordRangeAtPosition(position) || new Range(position, position),
              project = getWorkspaceProjectName(document.uri.fsPath);

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
            cmpType: ComponentType = ComponentType.None,
            component: IComponent | IPrimitive | undefined;
        const text = property;

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
                property,
                text,
                project,
                lineText: allLineText,
                component
            };
        }

        //
        // Make sure a component match was found by file
        //
        if (!thisCmp)
        {
            log.write("   class 'this' file not found", logLevel + 1, logPad);
            log.methodDone("get line properties", logLevel + 1, logPad, false);
            return {
                thisClass: undefined,
                thisCmp,
                cmpClass: undefined,
                cmpType: ComponentType.Class,
                property,
                text,
                project,
                lineText: allLineText,
                component
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
        if (new RegExp(`["']{1}[\\w.]*\\.${property}[\\w.]*["']{1}`).test(lineText) || new RegExp(`["']{1}[\\w.]*${property}\\.[\\w.]*["']{1}`).test(lineText))
        {
            if (/^type: [\"']{1}[\\w.]/.test(lineText)) {
                cmpType = ComponentType.Class | ComponentType.Store;
            }
            else {
                cmpType = ComponentType.Class;
            }
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
            if (/\btype: [\"']{1}[\\w.]/.test(lineText)) {
                cmpType = ComponentType.Class | ComponentType.Store;
            }
            else {
                cmpType = ComponentType.Class;
            }
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
            component = this.getComponent(lineText, project, logPad + "   ", logLevel, toIPosition(position), thisCmp);
            if (component) {
                const strParts = component.componentClass.split(".");
                property = strParts[strParts.length - 1];
                lineText = component.componentClass;
            }
        }
        //
        // Methods
        // Match function/method signature type, e.g.
        //
        //     testFn();
        //     testFn2(a, b);
        //     testFn2(a, { x: 0, y: 1});
        //     testFn2(a, {
        //         x: 0, y: 1
        //     });
        //
        // else if (lineText.match(new RegExp(`${property}\\s*\\((?:\\)|\\s*[\\w_ ,\\{\\}.:\\r\\n]+)`)))
        // else if (lineText.match(new RegExp(`${property}\\s*\\([ \\W\\w\\{]*\\)\\s*[;,\\)]+\\s*\\{*$`)))
        else if (new RegExp(`${property}\\s*\\(`).test(lineText))
        {
            component = this.getComponent(lineText.replace(/[^a-z0-9\.]/gi, "").trim(), project, logPad + "   ", logLevel + 1, toIPosition(position), thisCmp);
            cmpType = component ? ComponentType.Class : ComponentType.Method;
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
        else if (new RegExp(`.${property}\\s*[;\\)]{1,2}\\s*$`).test(lineText) ||
                 new RegExp(`(\\s*(const|var|let){0,1}\\s+|^)${property}\\s*[=.]{1}\\s*[ \\W\\w\\{\\(]*\\s*$`).test(allLineText))
        {
            component = this.getComponent(property, project, logPad + "   ", logLevel, toIPosition(position), thisCmp);
            cmpType = component ? ComponentType.Class : ComponentType.Property;
        }
        //
        // Classes and property class instances (non string literal)
        //
        else if (new RegExp(`(.|^\\s*)${property}.[\\W\\w]*$`).test(lineText))
        {
            if (/\btype: ["']{1}[\w.]/.test(lineText)) {
                cmpType = ComponentType.Class | ComponentType.Store;
            }
            else {
                cmpType = ComponentType.Class;
            }
        }

        let cmpClass: string | undefined;
        const thisPath = window.activeTextEditor?.document?.uri.fsPath;

        log.value("   line text property (recalculated)", property, logLevel + 1, logPad);
        log.value("   line text component type", cmpType, logLevel + 1, logPad);

        //
        // TODO
        //
        // If this is a `type` property, then set the alias name that will be used to search the
        // component cache
        //
        // let propertyAliasPre = "";
        // if (cmpType & ComponentType.Type)
        // {
        //     if (cmpType & ComponentType.Store) {
        //         propertyAliasPre = "store.";
        //     }
        //     else if (cmpType & ComponentType.Store) {
        //         propertyAliasPre = "layout.";
        //     }
        // }

        if (cmpType & ComponentType.Class)
        {
            cmpClass = lineText.substring(0, lineText.indexOf(property) + property.length);
            if (component = this.getComponent(property, project, logPad + "   ", logLevel, toIPosition(position), thisCmp)) {
                cmpClass = component.componentClass;
            }
            else if (component = this.getComponentInstance(property, project, position, document.uri.fsPath, logPad + "   ", logLevel)) {
                cmpClass = component.componentClass;
            }
        }
        else if (cmpType === ComponentType.Method)
        {
            cmpClass = this.getComponentClass(property, project, position, lineText, thisPath, logPad + "   ", logLevel);
            if (cmpClass)
            {   //
                // getComponentClass() will return the file class if this is a config getter/setter, so
                // check the methods mapping to see if it exists on the main component or not.  If it doesn't
                // then check if its a config property getter/setter fn
                //
                const classHasMethod = !!this.components.find(c =>
                    c.componentClass === cmpClass && project === getWorkspaceProjectName(c.fsPath)
                )?.methods?.find(x => x.name === property);
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
                    // cmpClass = this.getComponentClass(property, position, lineText, thisPath);
                }
            }
        }
        else // ComponentType.Property / ComponentType.Config | variable / parameter
        {   //
            cmpClass = this.getComponentInstance(property, project, position, document.uri.fsPath, logPad + "   ", logLevel)?.componentClass;
            if (!cmpClass) {
                const cmp = this.components.find(c => /* c.nameSpace === nameSpace && */
                                    c.project === project && c.componentClass === thisCmp.componentClass && c.properties.find(p => p.name === property)) ||
                            this.components.find(c => /* c.nameSpace === nameSpace && */
                                    c.project === project && c.componentClass === thisCmp.componentClass && c.configs.find(cfg => cfg.name === property));
                if (cmp) {
                    cmpClass = cmp.componentClass;
                    if (cmp.configs.find(c => c.name === property)) {
                        cmpType = ComponentType.Config;
                    }
                }
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
            cmpType: cmpType || ComponentType.None,
            property,
            thisCmp,
            thisClass: thisCmp?.componentClass,
            callee,
            text,
            project,
            lineText: allLineText,
            component
        };
    }


    getMethod(componentClass: string, property: string, project: string, isStatic: boolean, logPad = "", logLevel = 1): IMethod| undefined
    {
        log.methodStart("get method by property", logLevel, logPad, false, [
            ["component class", componentClass], ["property", property], ["project", project]
        ]);

        let method: IMethod | undefined,
            methods: IMethod[] | undefined;

        const component = this.getComponent(componentClass, project, logPad + "   ", logLevel);
        if (component) {
            const privateMethods = component.privates.filter((c) => extjs.isMethod(c)) as IMethod[];
            methods = !isStatic ? [...component.methods, ...privateMethods ] :
                                  component.statics.filter((c) => extjs.isMethod(c)) as IMethod[];
        }

        methods?.filter((m) => m.name === property).forEach((m) => {
            log.write("   found method", logLevel + 2, logPad);
            log.value("      name", m.name, logLevel + 2, logPad);
            log.value("      start (line/col)",  m.start.line + ", " + m.start.column, logLevel + 2, logPad);
            log.value("      end (line/col)", m.end.line + ", " + m.end.column, logLevel + 2, logPad);
            method = m;
        });

        log.methodDone("get method by property", logLevel, logPad, false, [["method", method?.name]]);
        return method;
    }


    getModelTypeNames(): string[]
    {
        const types: string[] = [];
        this.components.forEach((c) => {
            types.push(...c.aliases.filter(a => !types.includes(a.name) && a.name.startsWith("model.")).map(a => a.name));
        });
        return types;
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


    getNamespaceFromClass(componentClass: string, project: string, defaultNs?: string, logPad = "", logLevel = 1)
    {
        log.methodStart("get namespace from class", logLevel, logPad, false, [["component class", componentClass]]);
        if (componentClass.indexOf(".") !== -1)
        {
            defaultNs = componentClass.substring(0, componentClass.indexOf("."));
        }
        else {
            const aCmp = this.components.find(c => project === c.project && componentClass === c.componentClass);
            if (aCmp) {
                defaultNs = aCmp.componentClass.substring(0, aCmp.componentClass.indexOf("."));
            }
        }
        log.methodDone("get namespace from class", logLevel, logPad, false, [["namespace", defaultNs]]);
        return defaultNs || componentClass;
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
        const cls = this.getClsByPath(fsPath);
        if (cls){
            log.value("   found base class", cls, logLevel + 2, logPad);
            ns = cls.split(".")[part ?? 0];
        }
        log.methodDone("get namespace from file", logLevel, logPad, false, [["namespace", ns]]);
        return ns;
    }


    getPropertyPosition(property: string, cmpType: ComponentType, componentClass: string, project: string, isStatic: boolean, logPad = "", logLevel = 1)
    {
        let start = new Position(0, 0),
            end = new Position(0, 0);

        log.methodStart("get property position", logLevel, logPad, false, [
            ["property", property], ["component class", componentClass], ["project", project]
        ]);

        const pObject = cmpType === ComponentType.Method ? this.getMethod(componentClass, property, project, isStatic, logPad + "   ") :
                                      (cmpType === ComponentType.Config ? this.getConfig(componentClass, property, project, logPad + "   ", logLevel + 1) :
                                                                          this.getProperty(componentClass, property, project, isStatic, logPad + "   ", logLevel + 1));

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
            const mainCmp = this.getComponent(componentClass, project, logPad + "   ", logLevel);
            if (mainCmp) {
                _setPosition(mainCmp);
            }
        }

        log.methodDone("get property position", logLevel, logPad);
        return { start, end };
    }


    getProperty(componentClass: string, property: string, project: string, isStatic: boolean, logPad = "", logLevel = 1): IProperty | undefined
    {
        log.methodStart("get property by component class", logLevel, logPad, false, [
            ["component class", componentClass], ["property", property], ["project", project]
        ]);

        let prop: IProperty | undefined;
        let properties: IProperty[] | undefined;

        const component = this.components.find((c) => c.componentClass === componentClass && project === c.project);
        if (component) {
            const privateProperties = component.privates.filter((c) => extjs.isProperty(c)) as IProperty[];
            properties = !isStatic ? [...component.properties, ...privateProperties ] :
                                  component.statics.filter((c) => extjs.isProperty(c)) as IMethod[];
        }

        properties?.filter((p) => p.name === property).forEach((p) => {
            log.write("   found property", logLevel + 2, logPad);
            log.value("      name", p.name, logLevel + 3, logPad);
            log.value("      start (line/col)",  p.start.line + ", " + p.start.column, logLevel + 3, logPad);
            log.value("      end (line/col)", p.end.line + ", " + p.end.column, logLevel + 3, logPad);
            prop = p;
        });

        log.methodDone("get property by component class", logLevel, logPad, false, [["property", prop?.name]]);
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


    /**
     * Get list of inline class parts following the specified class path
     *
     * Example:
     *
     *      If `clsPart` is 'VSCodeExtJS.common' then we iterate the class list looking
     *      for component class paths that start with this text.  In this case, the text
     *      items 'PhysicianDropdown', 'UserDropdown', and 'PatientDropdown' should be
     *      returned.
     *
     * @param componentClass COmponent class
     * @param logPad Log padding
     * @param logLevel Log level
     *
     * @returns {String[]}
     */
    getSubComponentNames(clsPart: string, logPad = "", logLevel = 1): string[]
    {
        const subComponentNames: string[] = [];

        log.write("get sub-component names", logLevel, logPad);
        log.value("   component class part", clsPart, logLevel + 1, logPad);

        this.components.forEach((c) => {
            if (c.componentClass.startsWith(clsPart))
            {
                const subCMp = c.componentClass.replace(clsPart + ".", "").split(".")[0];
                if (!subComponentNames.includes(subCMp)) {
                    subComponentNames.push(subCMp);
                }
            }
        });

        return subComponentNames;
    }


    getStoreTypeNames(): string[]
    {
        const types: string[] = [];
        this.components.forEach((c) => {
            types.push(...c.aliases.filter(a => !types.includes(a.name) && /\bstore\./.test(a.name)).map(a => a.name));
        });
        return types;
    }


    getXtypeNames(): string[]
    {
        const xtypes: string[] = [];
        this.components.forEach((c) =>
        {
            xtypes
            .push(
                ...c.xtypes.filter(x => !xtypes.includes(x.name.replace("widget.", ""))
            )
            .map(x => x.name.replace("widget.", "")));

            xtypes
            .push(
                ...c.aliases.filter(a => !xtypes.includes(a.name.replace("widget.", "")) && /\bwidget\./.test(a.name)
            )
            .map(a => a.name.replace("widget.", "")));
        });
        return xtypes;
    }


    private getCmpStorageFileName(fsPath: string, nameSpace: string)
    {
        const uriFile = Uri.file(fsPath),
              wsf = workspace.getWorkspaceFolder(uriFile);
        let sFile = path.join(path.basename(uriFile.fsPath), nameSpace, "components.json");
        if (wsf) {
            const projectName = path.basename(wsf.uri.fsPath);
            sFile = path.join(projectName, fsPath.replace(wsf.uri.fsPath, ""), nameSpace, "components.json");
        }
        return sFile;
    }


    private async indexAll(progress: Progress<any>, project?: string, logPad = "", logLevel = 1)
    {
        log.methodStart("index all", logLevel, logPad, true, [
            [ "project", project ], [ "# of configurations", this.config.length ]
        ]);

        const processedDirs: string[] = [],
              cfgPct = this.config && this.config.length ? 100 / this.config.length : 100;
        let currentCfgIdx = 0,
            components: IComponent[] = [],
            pct = 0;

        //
        // The 'forceReIndexOnUpdateFlag' is set before a release in the case where a re-index
        // needs to happen when the new version is run for the first time on the user machine.
        // Clear the fs cache in the case where this flag is set but a re-indexing hasnt happened yet.
        //
        const needsReIndex = storage.get<string>(this.forceReIndexOnUpdateFlag, "false") !== "true";
        if (needsReIndex) {
            await commands.executeCommand("vscode-extjs:clearAst", undefined, true, logPad + "   ");
        }

        const _isIndexed = ((dir: string) =>
        {
            return !!processedDirs.find((d) => d === dir);
        });

        for (const conf of this.config)
        {
            log.value("   process config", conf.name, 1, logPad);
            log.values([
                ["wsDir", conf.wsDir], ["baseWsDir", conf.baseWsDir], ["baseDir", conf.baseDir], ["classpath", conf.classpath.toString()]
            ], 2, logPad + "   ");

            const projectName = getWorkspaceProjectName(conf.wsDir),
                  forceProjectAstIndexing = !(await pathExists(path.join(this.fsStoragePath, projectName)));
            let currentFileIdx = 0,
                numFiles = 0,
                increment: number | undefined;

            log.value("   projectName", projectName, 2, logPad);

            if (project) {
                if (project.toLowerCase() !== projectName.toLowerCase()) {
                    log.write("   skip project", 1, logPad);
                    continue;
                }
            }

            progress.report({
                increment: 0,
                message: `: Indexing project ${projectName} ${pct}%`
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
                        processedDirs.push(c.fsPath);
                        this.dirNamespaceMap.set(path.dirname(c.fsPath), conf.name);
                        pct = Math.round((cfgPct * currentCfgIdx) + (++currentFileIdx / components.length * (100 / this.config.length)));
                        progress.report({
                            increment,
                            message: `: Indexing project ${projectName} ${pct}%`
                        });
                    }

                    ++currentCfgIdx;
                    const nextInc = (currentCfgIdx * cfgPct) - 1,
                          nextInc2 = (currentCfgIdx * cfgPct) - 2;

                    progress.report({
                        increment,
                        message: `: Caching project ${projectName} ${Math.round(nextInc2 > pct ? nextInc2 : (nextInc > pct ? nextInc : pct))}%`
                    });

                    await this.serverRequest.loadExtJsComponent(JSON.stringify(components), projectName);

                    progress.report({
                        increment,
                        message: `: Caching project ${projectName} ${Math.round(nextInc > pct ? nextInc : pct)}%`
                    });

                    await this.processComponents(components, projectName, false, "   ", logLevel + 1);

                    progress.report({
                        increment,
                        message: `: Indexing project ${projectName} ${Math.round(currentCfgIdx * cfgPct)}%`
                    });
                }
            }
            else // index the file via the language server
            {
                let currentDir = 0,
                    currentFile = 0;
                components = []; // clear component defs from last loop iteration

                //
                // Status bar
                //
                // const statusBarSpace = window.createStatusBarItem(StatusBarAlignment.Left, -10000);
                // statusBarSpace.tooltip = "ExtJs Language Server is building the syntax tree";
                // statusBarSpace.text = getStatusString(0);
                // statusBarSpace.show();

                for (const dir of conf.classpath)
                {
                    if (!_isIndexed(dir))
                    {
                        const uris = await workspace.findFiles(`${path.join(conf.baseWsDir, dir)}/**/*.js`);
                        numFiles += uris.length;
                    }
                }

                increment = Math.round(1 / numFiles * cfgPct);

                log.blank();
                log.write(`   Indexing ${numFiles} files in ${conf.classpath.length} classpath directories`, logLevel, logPad);

                for (const dir of conf.classpath)
                {
                    if (!_isIndexed(dir))
                    {
                        log.write(`   Index directory ${++currentDir} of ${conf.classpath.length}`, 2, logPad);

                        const uris = await workspace.findFiles(`${path.join(conf.baseWsDir, dir)}/**/*.js`);
                        for (const uri of uris)
                        {
                            log.write(`   Index file ${++currentFile} of ${numFiles}`, 2, logPad);
                            //
                            // Index this file and process its components
                            //
                            try {
                                const cmps = await this.indexFile(uri.fsPath, conf.name, false, uri, false, logPad + "   ", logLevel);
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
                            pct = Math.round((cfgPct * currentCfgIdx) + (++currentFileIdx / numFiles * (100 / this.config.length)));
                            progress.report({
                                increment,
                                message: `: Indexing project ${projectName} ${pct}%`
                            });
                            // statusBarSpace.text = getStatusString(pct);
                        }
                        processedDirs.push(dir);
                        this.dirNamespaceMap.set(path.join(conf.baseDir, dir), conf.name);
                    }
                }

                ++currentCfgIdx;
                const nextInc = (currentCfgIdx * cfgPct) - 1,
                      nextInc2 = (currentCfgIdx * cfgPct) - 2;

                progress.report({
                    increment,
                    message: `: Caching project ${projectName} ${Math.round(nextInc2 > pct ? nextInc2 : (nextInc > pct ? nextInc : pct))}%`
                });

                //
                // Update entire component tree in fs cache
                //
                if (components.length > 0) {
                    await fsStorage.update(storageKey, JSON.stringify(components));
                    await storage.update(storageKey + "_TIMESTAMP", new Date());
                }

                progress.report({
                    increment,
                    message: `: Indexing project ${projectName} ${Math.round(currentCfgIdx * cfgPct)}%`
                });
            }
        }

        //
        // The 'forceReIndexOnUpdateFlag' is set before a release in the case where a re-index
        // needs to happen when the new version is run for the first time on the user machine.
        // Set flag that indexing was done
        //
        await storage.update(this.forceReIndexOnUpdateFlag, "true");

        log.methodDone("index all", logLevel, logPad, true);
    }


    private async indexAndValidateFile(document: TextDocument)
    {
        const ns = this.getNamespace(document);
        //
        // Index the file, don't save to fs cache, we'll persist to fs cache when the
        // document is saved
        //
        const components = await this.indexFile(document.uri.fsPath, ns, false, document);
        //
        // Validate document
        //
        if (components && components.length > 0) {
            await this.validateDocument(document, ns);
        }
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
            for (const c of this.config)
            {
                if (c.buildDir) {
                    const buildUriPath = Uri.file(path.join(wsPath, c.buildDir)).path;
                    if (uriFile.path.includes(buildUriPath)) {
                        log.write(logPad + "Excluded by workspace.json build path");
                        return;
                    }
                }
                //
                // The 'node_modules' folder should be ignored, but for open tooling projects
                // there will be references to @sencha and any other extjs package used e.g.
                // Ext.csi, Ext.plyr, etc.
                //
                if (c.classpath && uriFile.path.includes("node_modules")) {
                    for (const classPath of c.classpath)
                    {
                        const cpUriPath = Uri.file(path.join(c.baseDir, classPath)).path;
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
        // Get components for this file from the Language Server
        //
        let text: string | undefined;
        if (document instanceof Uri) {
            text = (await workspace.fs.readFile(document)).toString();
        }
        else {
            text = document.getText();
        }

        //
        // Check to make sure this is an ExtJs file.  Caller will have already checked to see if
        // it's a javascript file if necessary (file watchers only watch classpath js files, so if
        // this is a filewatcher event it's guaranteed to be a js file).)
        //
        if (!utils.isExtJsFile(text)) {
            return false;
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
        // Request 'parse file' from server
        //
        const project = getWorkspaceProjectName(fsPath),
              components = await this.serverRequest.parseExtJsFile(fsPath, project, nameSpace, text),
              cached = await this.processComponents(components, project, oneCall, logPad + "   ", logLevel + 1);

        //
        // Save to fs cache if caller has specified to, and if we parsed some components
        //
        if (cached && components.length > 0 && saveToCache) {
            this.persistComponent(fsPath, nameSpace, components[0]);
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
     * @method indexFiles Wraps `indexAll` with progress indicator
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
        // Validate and index the active js document, if there is one
        //
        const activeTextDocument = window.activeTextEditor?.document;
        if (activeTextDocument && activeTextDocument.languageId === "javascript")
        {
            await this.indexAndValidateFile(activeTextDocument);
        }
        this.isIndexing = false;
        showReIndexButton();
    }


    private async initializeInternal()
    {   //
        // Get configuration from app.json, .extjsrc, and settings
        //
        this.config = await this.configParser.getConfig();
        if (this.config.length === 0) {
            window.showInformationMessage("Could not find any app.json or .extjsrc.json files");
            return [];
        }
        //
        // Index files, loading from fs cache if available
        //
        await this.indexFiles();
    }


    async initialize(context: ExtensionContext): Promise<Disposable[]>
    {
        this.fsStoragePath = context.globalStoragePath;
        //
        // The `initializeInternal` method will get the configuration from  app.json, .extjsrc, and
        // settings, and start indexing of all files, loading from fs cache if available
        //
        await this.initializeInternal();
        //
        // TODO - Cache cleanup task
        //
        // Create a task that will run every minute and clean up any hanging items in
        // both the memory and fs cache
        //
        // setTimeout(async () =>
        // {
        //     //
        // }, 60000);
        //
        // Return disposable watchers list...
        //
        return this.watcherRegister(context);
    }


    isBusy()
    {
        return this.isIndexing || this.isValidating;
    }


    private async persistComponent(fsPath: string, nameSpace: string, component: IComponent)
    {
        const baseDir = this.getAppJsonDir(fsPath),
              storageKey = this.getCmpStorageFileName(baseDir, nameSpace),
              storedComponents: IComponent[] = JSON.parse(await fsStorage.get(storageKey) || "[]");

        for (let i = 0; i < storedComponents.length; i++)
        {
            if (storedComponents[i].fsPath === fsPath && storedComponents[i].nameSpace === nameSpace)
            {
                storedComponents[i] = component;
                break;
            }
        }

        await fsStorage.update(storageKey, JSON.stringify(storedComponents));
        await storage.update(storageKey + "_TIMESTAMP", new Date());
    }


    private async processComponents(components: IComponent[] | undefined, project: string, isFileEdit: boolean, logPad = "", logLevel = 1)
    {   //
        // If no components, then bye bye
        //
        if (!components || components.length === 0) {
            return false;
        }

        log.methodStart("process components", logLevel, logPad, true, [[ "# of stored components", components.length ]]);

        //
        // Process the specified component(s) / update memory cache
        //
        for (const cmp of components)
        {
            const {
                componentClass, widgets, xtypes, methods, configs, properties, aliases, nameSpace, fsPath
            } = cmp;

            //
            // In a case where a user can copy the contents of a file and paste it into a new
            // file, or when copying an entire file, the file will share the same class name as
            // the source file.  In these cases, we do not want to overwrite the originally
            // parsed component.  So check to make sure the extracted class name's mapped
            // filesystem is the same as the method param fsPath. The 'isFileEdit' argument will be
            // `false`` when the processing is being done from indexAll().
            //
            if (isFileEdit)
            {
                const shouldBeFsPath = this.clsToFilesMapping[project] ? this.clsToFilesMapping[project][componentClass] : undefined;
                if (shouldBeFsPath && shouldBeFsPath !== fsPath)
                {
                    log.write("   ignoring duplicate component " + componentClass, logLevel + 1, logPad);
                    log.write("   filesystem path already mapped to " + shouldBeFsPath, logLevel + 1, logPad);
                    continue;
                }
            }

            log.write("   process component " + componentClass, logLevel + 1, logPad);
            log.values([
                ["namespace", nameSpace], ["# of widgets", widgets.length], ["# of xtypes", xtypes.length],
                ["# of methods", methods.length], ["# of config properties", configs.length], ["# of properties", properties.length],
                ["# of aliases", aliases.length], ["fs path", fsPath ]
            ], logLevel + 1, logPad + "      ");

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
            cmp.markdown = cmp.doc ? cmp.markdown = this.commentParser.toMarkdown(componentClass, cmp.doc, logPad + "   ") : undefined;

            //
            // Map the filesystem path <-> component class.  Do a check to see if there are duplicate
            // class names found.  The `fsPath` parameter is null when this is being called from
            // indexAl() after reading and indexing from the fs cache
            //
            if (!this.clsToFilesMapping[project]) {
                this.clsToFilesMapping[project] = {};
            }
            if (!fsPath && this.clsToFilesMapping[project][componentClass])
            {
                window.showWarningMessage(`Duplicate component class names found - ${componentClass}`);
            }
            this.clsToFilesMapping[project][componentClass] = cmp.fsPath;
            cmp.aliases.forEach((a) => {
                if (!fsPath && this.clsToFilesMapping[project][a.name])
                {
                    window.showWarningMessage(`Duplicate component alias names found - ${a.name}`);
                }
                this.clsToFilesMapping[project][a.name] = cmp.fsPath;
            });

            //
            // Map methods found to the component class
            //
            methods.forEach(method => {
                method.markdown = this.commentParser.toMarkdown(method.name, method.doc, logPad + "   ");
                if (method.params)
                {
                    log.write(`         add doc for method ${method.name}`, logLevel + 2, logPad);
                    for (const p of method.params)
                    {
                        if (p.doc) {
                            p.markdown = this.commentParser.toMarkdown(p.name, p.doc, logPad + "   ");
                        }
                    }
                }
            });

            //
            // Map config properties found to the component class
            //
            log.write(`      add doc for ${configs.length} configs`, logLevel + 1, logPad);
            configs.forEach(config => {
                config.markdown = this.commentParser.toMarkdown(config.name, config.doc, logPad + "   ");
            });

            //
            // Map properties found to the component class
            //
            log.write(`      add doc for ${properties.length} properties`, logLevel + 1, logPad);
            properties.forEach(property => {
                property.markdown = this.commentParser.toMarkdown(property.name, property.doc, logPad + "   ");
            });

            //
            // Update memory cache
            //
            log.write("      update memory cache", logLevel + 1, logPad);
            const idx = this.components.findIndex((c) => c.componentClass === componentClass && project === c.project);
            if (idx >= 0) {
                this.components.splice(idx, 1, cmp);
            }
            else {
                this.components.push(cmp);
            }

            log.write("      parsed component parts:", logLevel + 3, logPad);
            log.values([
                [ "configs", JSON.stringify(cmp.configs, undefined, 3)],
                [ "methods", JSON.stringify(cmp.methods, undefined, 3)],
                [ "property", JSON.stringify(cmp.properties, undefined, 3)],
                [ "widget", JSON.stringify(cmp.widgets, undefined, 3)]
            ], logLevel + 3, logPad + "   ");
            log.write("   done processing component " + componentClass, logLevel + 1, logPad);
        }

        log.methodDone("process components", logLevel, logPad);
        return true;
    }


    private async removeComponentsFromCache(uri: Uri)
    {
        const fsPath = uri.fsPath,
               project = getWorkspaceProjectName(fsPath);

        log.methodStart("remove file from cache", 1, "", true, [["path", fsPath]]);

        const componentClass = this.getClsByPath(fsPath),
              componentNs = componentClass ? this.getNamespaceFromClass(componentClass, project, undefined, "   ", 2) : undefined;

        if (componentClass && componentNs)
        {
            log.value("   removing component class", componentClass, 2);
            //
            // Update memory cache
            //
            this.components.filter((c) => c.fsPath === uri.fsPath).forEach((c, i) => {
                this.components.splice(i, 1);
            });
        }

        log.methodDone("remove file from cache", 1, "", true);
    }


    /**
     * For tests
     *
     * @private
     * @since 0.3.0
     */
    setBusy(busy: boolean)
    {
        this.isIndexing = busy;
    }


    /**
     * For tests
     *
     * @private
     * @since 0.3.0
     */
    setTests(tests: boolean)
    {
        this.isTests = tests;
    }


    async validateDocument(textDocument: TextDocument | undefined, nameSpace: string)
    {
        const text = textDocument?.getText();
        this.currentLineCount = textDocument?.lineCount || 0;
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
            const project = getWorkspaceProjectName(textDocument.uri.fsPath);
            this.isValidating = true;
            if (await pathExists(path.join(this.fsStoragePath, project))) {
                await this.serverRequest.validateExtJsFile(textDocument.uri.path, project, nameSpace, text);
            }
            // else {
            //     await this.indexFiles(this.getWorkspaceProjectName(textDocument.uri.fsPath));
            // }
            showReIndexButton(true);
            this.isValidating = false;
        }
    }


    private async watcherConfigChange(e: Uri)
    {
        const project = getWorkspaceProjectName(e.fsPath),
              msg = `${project} config file modified, re-index all files?`,
              action = !this.isTests ? await window.showInformationMessage(msg, "Yes", "No") : "Yes";
        if (action === "Yes") {
            await commands.executeCommand("vscode-extjs:clearAst", project);
            await this.initializeInternal();
        }
    }


    private async watcherDocumentDelete(uri: Uri) // (e: FileDeleteEvent)
    {
        await this.removeComponentsFromCache(uri);
        const activeTextDocument = window.activeTextEditor?.document;
        await this.validateDocument(activeTextDocument, this.getNamespace(activeTextDocument));
    }


    private watcherOpenDocumentChange(e: TextDocumentChangeEvent)
    {
        if (e.contentChanges.length > 0 && e.document.languageId === "javascript" && utils.isExtJsFile(e.document.getText()))
        {
            //
            // Clear debounce timeout if still pending
            //
            let taskId = this.reIndexTaskIds.get(e.document.uri.fsPath);
            if (taskId) {
                clearTimeout(taskId);
                this.reIndexTaskIds.delete(e.document.uri.fsPath);
            }
            //
            // Clear 'Ext.define edited' timeout if still pending
            //
            taskId = this.reIndexTaskIds.get("Ext.Define-" + e.document.uri.fsPath);
            if (taskId) {
                clearTimeout(taskId);
                this.reIndexTaskIds.delete("Ext.Define-" + e.document.uri.fsPath);
            }

            //
            // Check the change
            //
            let debounceMs = configuration.get<number>("validationDelay", 1250);
            for (const change of e.contentChanges)
            {   //
                // On enter/return key, validate immediately as the line #s for all range definitions
                // underneath the edit have just shifted by one line
                //
                if (change.text.includes(documentEol(e.document)) || e.document.lineCount !== this.currentLineCount) {
                    debounceMs = 0;
                }
                //
                // If the 'Ext.define' line is being edited, so clear out any cache info for this
                // file, since the component class name is changing
                //
                else if (e.document.lineAt(change.range.start).text.includes("Ext.define"))
                {
                    this.removeComponentsFromCache(e.document.uri);
                }
            }
            //
            // Set current line count.  It allows to track if we will debounce the indexing or not,
            // because if the line count changes, whether it's from a new EOL, or, and EOL that was
            // removed, we need to re-index right away to reset the class's object ranges
            //
            this.currentLineCount = e.document.lineCount;
            //
            // Debounce!!  Or not!!  We don't debounce if there was an EOL involved in the edit
            //
            taskId = setTimeout(async (document) =>
            {
                this.reIndexTaskIds.delete(document.uri.fsPath);
                await this.indexAndValidateFile(document);
            }, debounceMs, e.document);

            this.reIndexTaskIds.set(e.document.uri.fsPath, taskId);
        }
    }


    /**
     * @method watcherRegister
     *
     * Register application event watchers - Document open/change/delete, config file filesystem,
     * settings/config
     *
     * @private
     *
     * @param context VSCode extension context
     */
    private watcherRegister(context: ExtensionContext): Disposable[]
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

        const clsPathGlob = `**/{${classPaths.join(",")}}/**/*.js`.replace("//**", "/");
        log.write("   file watcher glob:", 2);
        log.write(`   ${clsPathGlob}`, 2);

        //
        // rc/conf file / app.json
        //
        const disposables: Disposable[] = [],
              jsWatcher = workspace.createFileSystemWatcher(clsPathGlob),
              confWatcher = workspace.createFileSystemWatcher("**/{.extjsrc,.extjsrc.json,app.json,workspace.json}");
        //
        // Config watcher
        //
        disposables.push(confWatcher.onDidChange(async (e) => { await this.watcherConfigChange(e); }, this));
        disposables.push(confWatcher.onDidDelete(async (e) => { await this.watcherConfigChange(e); }, this));
        disposables.push(confWatcher.onDidCreate(async (e) => { await this.watcherConfigChange(e); }, this));
        //
        // disposables.push(workspace.onDidChangeTextDocument((e) => this.processDocumentChange));
        //
        // Javascript watchers
        //
        disposables.push(jsWatcher.onDidChange(async (e) => { await this.indexFile(e.fsPath, this.getNamespace(e), true, e); }, this));
        disposables.push(jsWatcher.onDidCreate(async (e) => { await this.indexFile(e.fsPath, this.getNamespace(e), true, e); }, this));
        disposables.push(jsWatcher.onDidDelete(async (e) => { await this.watcherDocumentDelete(e); }, this));
        //
        // Active editor changed (processes open-document too)
        //
        disposables.push(window.onDidChangeActiveTextEditor(async (e) => { await this.validateDocument(e?.document, this.getNamespace(e?.document)); }, this));
        //
        // Open document text change
        //
        disposables.push(workspace.onDidChangeTextDocument((e) => { this.watcherOpenDocumentChange(e); }, this));
        //
        // Register configurations/settings change watcher
        //
        disposables.push(workspace.onDidChangeConfiguration(async (e) => { await this.watcherSettingsChange(e); }, this));

        context.subscriptions.push(...disposables);

        log.methodDone("Register file watchers", 1);
        return disposables;
    }


    private async watcherSettingsChange(e: ConfigurationChangeEvent)
    {
        if (e.affectsConfiguration("extjsIntellisense.ignoreErrors"))
        {
            const document = window.activeTextEditor?.document;
            await this.validateDocument(document, this.getNamespace(document));
        }
        else if (e.affectsConfiguration("extjsIntellisense.include") || e.affectsConfiguration("extjsIntellisense.frameworkDirectory"))
        {
            const msg = "Path settings modified, re-index all files in all projects?",
                  action = !this.isTests ? await window.showInformationMessage(msg, "Yes", "No") : "Yes";
            if (action === "Yes") {
                await commands.executeCommand("vscode-extjs:clearAst");
                await this.initializeInternal();
            }
        }
    }

}


export default ExtjsLanguageManager;
