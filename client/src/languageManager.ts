
import {
    Disposable, ExtensionContext, Progress, TextDocumentChangeEvent, Range, Position,
    ProgressLocation, TextDocument, TextEditor, window, workspace, Uri, FileDeleteEvent,
    ConfigurationChangeEvent
} from "vscode";
import {
    IAlias, IConfig, IComponent, IMethod, IConf, IProperty, IXtype, utils, ComponentType,
    IVariable, VariableType, IExtJsBase, IPrimitive
} from  "../../common";
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
import { toVscodeRange, toVscodePosition, isPositionInRange, isComponent } from "./common/clientUtils";


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
            log.write("   found component class", 3, logPad);
            className = cls;
        }
        return className;
    }


    getComponent(componentClass: string, checkAlias?: boolean): IComponent | undefined
    {
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


    getMappedClass(property: string, cmpType: ComponentType)
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
    private getComponentClass(property: string, position: Position | undefined, lineText: string, fsPath: string | undefined): string | undefined
    {
        let cmpClass = "this", // getComponentByConfig(property);
            cmpClassPre, cmpClassPreIdx = -1, cutAt = 0;

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

        if (cmpClass === "this")
        {
            if (fsPath) {
                cmpClass = this.getComponentByFile(fsPath)?.componentClass || "";
            }
        }
        else //
        {   // Check aliases/alternate class names
            //
            let aliasClass: string | undefined;
            if (aliasClass = this.widgetToComponentClassMapping[cmpClass])
            {
                cmpClass = aliasClass;
            }
        }

        //
        // Instances
        //
        if (fsPath && !this.getComponent(cmpClass, true))
        {
            const instance = this.getComponentInstance(cmpClass, position || new Position(0, 0), fsPath);
            if (isComponent(instance)) {
                cmpClass = instance.componentClass;
            }
        }

        log.blank(1);
        log.value("class", cmpClass, 1);
        return cmpClass;
    }


    getComponentInstance(property: string, position: Position, fsPath: string): IComponent | IPrimitive | undefined
    {
        const thisCls = this.getClassFromFile(fsPath);

        if (!thisCls) {
            return;
        }
        else if (property === "this") {
            return this.getComponent(thisCls, true);
        }

        const cmp = this.getComponent(thisCls, true);
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
                    const cmp = this.getComponent(variable.componentClass, true);
                    if (cmp) {
                        return cmp;
                    }
                    else {
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


    getConfig(cmp: string, property: string): IConfig | undefined
    {
        const configs = this.componentClassToConfigsMapping[cmp];
        log.write("get config by component class", 1);
        log.value("   component class", cmp, 2);
        log.value("   config", property, 2);
        if (configs)
        {
            for (let c = 0; c < configs.length; c++)
            {
                if (configs[c].name === property)
                {
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
        const fsPath = this.componentClassToFilesMapping[componentClass];
        log.write("get fs path by component", 1);
        log.value("   path", fsPath, 2);
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
              thisCmp = this.getComponentByFile(document.uri.fsPath),
              range = document.getWordRangeAtPosition(position) || new Range(position, position);

        log.methodStart("get line properties", 1, logPad);

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
        let lineText = allLineText.replace(/[\s\w]+=[\s]*(new)*\s*/, "").replace(/[\s\w]*if\s*\(\s*[!]{0,2}/, ""),
            property = document.getText(range),
            cmpType: ComponentType = ComponentType.None;

        //
        // Handle "this"
        // TODO - handle 'this' for non-controller function with local this
        //
        if (property === "this")
        {
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
            const xtypeCmp = this.xtypeToComponentClassMapping[lineText];
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
            if (!this.getComponentByAlias(property) && !this.getComponent(property)) {
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
            const cls = this.variablesToComponentClassMapping[property];
            if (cls) {
                const variable = this.componentClassToVariablesMapping[cls.name]?.find(v => v.name === property);
                cmpClass = variable?.componentClass;
            }
            else {
                let cmp = this.getComponent(property, true);
                if (cmp) {
                    cmpClass = cmp.componentClass;
                }
                else {
                    const icmp = this.getComponentInstance(property, position, document.uri.fsPath);
                    if (isComponent(icmp)) {
                        cmp = icmp;
                    }
                }
            }
        }
        else if (cmpType === ComponentType.Method)
        {
            cmpClass = this.getComponentClass(property, position, lineText, thisPath);
            if (cmpClass)
            {   //
                // getComponentClass() will return the file class if this is a config getter/setter, so
                // check the methods mapping to see if it exists on the main component or not.  If it doesnt
                // then check if its a config property getter/setter fn
                //
                const classHasMethod = !!this.componentClassToMethodsMapping[cmpClass]?.find(x => x.name === property);
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
                    // cmpClass = this.getComponentClass(property, position, lineText, thisPath);
                }
            }
        }
        else // ComponentType.Property / ComponentType.Config | variable / parameter
        {
            const cmp = this.getComponentInstance(property, position, document.uri.fsPath),
                  cfgCls = this.getMappedClass(property, ComponentType.Config);
            cmpClass = cmp?.componentClass || this.getComponentClass(property, position, lineText, thisPath);
            if (!cmpClass)
            {
                log.write("   property not found, look for config", 2, logPad);
                cmpType = ComponentType.Property;
                cmpClass = this.getComponentClass(property, position, lineText, thisPath);
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

        log.value("   component class", cmpClass, 2, logPad);

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


    /**
     * @method getNamespaceFromFile
     *
     * @param fsPath Filesystem path to file
     * @param part Zero-based index of namespace part to return
     */
    getNamespaceFromFile(fsPath: string, part?: number): string | undefined
    {
        let ns: string | undefined;
        log.methodStart("get component class by file", 1, "   ", false, [["file", fsPath]]);
        const cls = this.fileToComponentClassMapping[fsPath];
        if (cls){
            log.write("   found base class", 3);
            ns = cls.split(".")[part ?? 0];
        }
        return ns;
    }


    getPropertyPosition(property: string, cmpType: ComponentType, componentClass: string, logPad = "")
    {
        let start = new Position(0, 0),
            end = new Position(0, 0);

        const pObject = cmpType === ComponentType.Method ? this.getMethod(componentClass, property) :
                                      (cmpType === ComponentType.Config ? this.getConfig(componentClass, property) :
                                                                          this.getProperty(componentClass, property));

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
            const mainCmp = this.getComponent(componentClass);
            if (mainCmp) {
                _setPosition(mainCmp);
            }
        }

        return { start, end };
    }


    getProperty(cmp: string, property: string): IProperty | undefined
    {
        let prop: IProperty | undefined;
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
                    prop = properties[c];
                    break;
                }
            }
        }
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


    getMethod(cmp: string, property: string): IMethod| undefined
    {
        let method: IMethod | undefined;
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
                    method = methods[c];
                    break;
                }
            }
        }

        return method;
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
        let x: IXtype | undefined;
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
                    x = xtypes[c];
                    break;
                }
            }
        }

        return x;
    }


    getXtypeNames(): string[]
    {
        const xtypes: string[] = [],
              xmap = this.componentClassToXTypesMapping;

        Object.entries(xmap).forEach(([ cls, xtype ]) =>
        {
            if (cls && xtype)
            {
                for (const x of xtype) {
                    xtypes.push(x.name);
                }
            }
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
        const componentClass = this.getClassFromFile(fsPath);
        if (componentClass)
        {
            log.write("handle file deletion", 1);
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
                        delete this.variablesToMethodMapping[v.name];
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

            delete this.fileToComponentClassMapping[fsPath];
            delete this.methodToVariablesMapping[componentClass];

            delete this.componentClassToWidgetsMapping[componentClass];
            delete this.componentClassToAliasesMapping[componentClass];
            delete this.componentClassToFilesMapping[componentClass];
            delete this.componentClassToRequiresMapping[componentClass];
            delete this.componentClassToConfigsMapping[componentClass];
            delete this.componentClassToPropertiesMapping[componentClass];
            delete this.componentClassToMethodsMapping[componentClass];
            delete this.componentClassToComponentsMapping[componentClass];
            delete this.componentClassToVariablesMapping[componentClass];
        }
    }


    private async indexAll(progress?: Progress<any>, forceAstIndexing = false)
    {
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

        log.methodStart("indexing all", 1, "", true, [[ "# of configs", this.config.length ]]);

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
                        const pct = (cfgPct * currentCfgIdx) + Math.round(++currentFileIdx / components.length * (100 / this.config.length));
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
                        {
                            log.blank();
                            log.value("   Indexing file", uri.fsPath, 1);
                            //
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
                            const pct = (cfgPct * currentCfgIdx) + Math.round(++currentFileIdx / numFiles * (100 / this.config.length));
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

        if (oneCall) {
            this.isIndexing = false;
            showReIndexButton(true);
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
        showReIndexButton(true);
    }


    private async initializeInternal()
    {
        this.config = await this.configParser.getConfig();
        if (this.config.length === 0) {
            window.showInformationMessage("Could not find any app.json or .extjsrc.json files");
            return [];
        }
        this.indexFiles();
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
    {
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
            this.componentClassToWidgetsMapping[componentClass] = widgets;
            this.componentClassToMethodsMapping[componentClass] = methods;
            this.componentClassToConfigsMapping[componentClass] = configs;
            this.componentClassToPropertiesMapping[componentClass] = properties;
            this.componentClassToXTypesMapping[componentClass] = xtypes;
            this.componentClassToAliasesMapping[componentClass] = aliases;

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
    }


    private async processConfigChange(e: Uri)
    {
        fsStorage?.clear();
        await this.initializeInternal();
    }


    private processDocumentChange(e: TextDocumentChangeEvent)
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
                const fsPath = textDocument.uri.fsPath,
                      ns = this.getNamespace(textDocument);
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
        //
        // rc/conf file / app.json
        //
        const disposables: Disposable[] = [],
              jsWatcher = workspace.createFileSystemWatcher("**/*.js"),
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
        disposables.push(workspace.onDidChangeTextDocument((e) => { this.processDocumentChange(e); }, this));
        // disposables.push(workspace.onDidChangeTextDocument((e) => this.processDocumentChange));
        //
        // Deletions
        //
        disposables.push(jsWatcher.onDidDelete(async (e) => { await this.processDocumentDelete(e); }, this));
        //
        // Creations
        //
        disposables.push(jsWatcher.onDidCreate(async (e) => { await this.indexFile(e.fsPath, this.getNamespace(e), true, e); }, this));
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
