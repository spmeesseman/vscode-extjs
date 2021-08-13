
import * as log from "../common/log";
import { extjsLangMgr } from "../extension";
import { configuration } from "../common/configuration";
import { ComponentType, DeclarationType, IComponent, IConfig, IExtJsBase, IMethod, IProperty, IRange, utils } from "../../../common";
import {
    CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position,
    TextDocument, CompletionItemKind, window, EndOfLine
} from "vscode";
import {
    getMethodByPosition, isPositionInObject, isPositionInRange, toVscodeRange, isComponent, getObjectRangeByPosition, documentEol
} from "../common/clientUtils";



class ExtJsCompletionItemProvider implements CompletionItemProvider
{
    private rightInfoPad = 45;

    //
    // Properties that shouldn't get displayed in inline Intellisense
    //
    private ignoreProps = [
        "xtype", "extend", "requires", "alias", "alternateClassName", "singleton"
    ];


    provideCompletionItems(document: TextDocument, position: Position)
    {
        const addedItems: string[] = [],
              lineText = document.lineAt(position).text.substr(0, position.character),
              fnText = this.getFunctionName(document, position),
              completionItems: CompletionItem[] = [],
              range = document.getWordRangeAtPosition(position),
              text = range ? document.getText(range) : "";

        //
        // The `getInlineCompletionItems` method handles completion items that lead all other
        // parts of a classpath.  For example, the class:
        //
        //     MyApp.view.users.Users
        //     fn.call(MyApp.view.users.Users);
        //
        // The `MyApp` part of the class path is of interest, when the user starts typing into a
        // blank line (or a new statement block), we want to display all possible parts of a
        // classpath that lead the class name, in this case we ant to add 'MyApp' as a completion item
        //
        // The `(?<!(?:"|'|\\/\\/|[ ]+\\*|\\/\\*\\*)[^;]*)` portion of the regex ignores patterns
        // that are contains in strings or comments
        //
        if (!lineText || !lineText.includes(".") || (!text && lineText.endsWith("(")) ||
           ((text && lineText.match(new RegExp(`(?<!(?:"|'|\\/\\/|[ ]+\\*|\\/\\*\\*)[^;]*)[^.]*[,]{0,1}\\s*${text}\\s*$`)))))
        {
            completionItems.push(...this.getInlineCompletionItems(text, lineText, position, document));
            return completionItems;
        }

        log.methodStart("provide dot completion items", 2, "", true, [["line text", lineText]]);

        completionItems.push(...this.getCompletionItems(lineText, fnText, position, document, addedItems));

        // completionItems.push({
        //     label: "Ext.create",
        //     kind: CompletionItemKind.Keyword,
        //     insertText: `Ext.create(\"\",${EOL}{${EOL}${EOL}});`, // SnippetString('Good ${1|morning,afternoon,evening|}. It is ${1}, right?')
        //     // documentation: new MarkdownString("Inserts a snippet that lets you select the _appropriate_ part of the day for your greeting.")
        // });

        //
        // A completion item that re-triggers IntelliSense when being accepted, the `command`-property is
        // set which the editor will execute after completion has been inserted. Also, the `insertText`
        // is set so that a space is inserted after `new`
        //
        // completionItems.push({
        //     label: "new",
        //     kind: CompletionItemKind.Keyword,
        //     insertText: "new ",
        //     command: { command: "editor.action.triggerSuggest", title: "Re-trigger completions..." }
        // });

        log.methodDone("provide dot completion items", 2, "", true);

        return completionItems.length > 0 ? completionItems : undefined;
    }


    createCompletionItem(property: string, cmpClass: string, nameSpace: string, kind: CompletionItemKind, isConfig: boolean, extendedFrom: string | undefined, position: Position): CompletionItem[]
    {
        const propCompletion: CompletionItem[] = [];

        //
        // Get the appropriate component part, a method, property, config, or class, as specified
        // by the caller
        //
        let cmp: IComponent | IMethod | IProperty | IConfig | undefined;
        switch (kind)
        {
            case CompletionItemKind.Method:
                cmp = this.getMethodCmp(property, cmpClass, nameSpace);
                break;
            case CompletionItemKind.Property:
                cmp = this.getPropertyCmp(property, cmpClass, nameSpace);
                break;
            default: // class
                cmp = extjsLangMgr.getComponent(cmpClass, nameSpace, true);
                break;
        }

        //
        // Hide private properties according to user settings (default true).
        //
        if (cmp?.private && configuration.get<boolean>("intellisenseIncludePrivate") !== true)
        {
            return propCompletion;
        }

        //
        // Hide deprecated properties according to user settings (default true).
        //
        if (cmp?.deprecated && configuration.get<boolean>("intellisenseIncludeDeprecated") !== true)
        {
            return propCompletion;
        }

        //
        // Create completion item
        //
        const completionItem: CompletionItem = new CompletionItem(property, kind);

        //
        // For methods/functions, we want the trigger character to be "(", otherwise, "."
        //
        if (kind === CompletionItemKind.Method)
        {
            completionItem.commitCharacters = [ "(" ];
        }
        else {
            completionItem.commitCharacters = [ "." ];
        }

        const tagText = this.tagText(cmp, isConfig, extendedFrom);
        if (tagText) {
            completionItem.insertText = property;
            completionItem.label = `${completionItem.label}${this.rightPad(tagText, completionItem.label.length)}${tagText}`;
        }

        //
        // Documentation / JSDoc / Leading Comments
        //
        completionItem.documentation = cmp?.markdown;

        //
        // Add the populated completion item to the array of items to be returned to the caller,
        // if this is a `config`, then we are going to add getter/setter items as well
        //
        propCompletion.push(completionItem);

        //
        // If this is a `config` property (i.e. IConfig), then add getter/setter
        //
        if (kind === CompletionItemKind.Property && cmp && "getter" in cmp)
        {
            propCompletion.push(new CompletionItem(cmp.getter, CompletionItemKind.Method));
            propCompletion.push(new CompletionItem(cmp.setter, CompletionItemKind.Method));
            propCompletion[1].documentation = cmp.markdown;
            propCompletion[2].documentation = cmp.markdown;
        }

        return cmp || kind === CompletionItemKind.Class ? propCompletion : [];
    }


    /**
     * @method getFunctionName
     *
     * Get outer function name based on current document position.  Used to determine if
     * targeted properties are local to a function or global
     *
     * @param document VSCode Document object
     * @param position VSCode position object
     */
    private getFunctionName(document: TextDocument, position: Position)
    {
        const text = document.getText();
        let idx = text.lastIndexOf("function", document.offsetAt(position));
        if (idx !== -1)
        {
            let sidx = idx = text.lastIndexOf(":", idx);
            if (sidx !== -1)
            {
                const sidx2 = text.lastIndexOf("\t", --sidx),
                      sidx3 = text.lastIndexOf("\n", sidx);
                sidx = text.lastIndexOf(" ", sidx);
                if (sidx2 > sidx) {  sidx = sidx2; }
                if (sidx3 > sidx) { sidx = sidx3; }
                if (sidx !== -1)
                {
                    return text.substring(sidx, idx).trim();
                }
            }
        }
    }


    /**
     * @method getCompletionItems
     *
     * @param lineText The complete text of the line of the current trigger position.
     * @param fnText The outer function name of the function that contains the reference to this property,
     * if this property is found within a controller method.  Used for local property (relative to the
     * outer function) inspection only.
     * @param fsPath The filesystem path to the JavasScript class file.
     * @param addedItems Array holding item labels already added in this request.
     */
    private getCompletionItems(lineText: string, fnText: string | undefined, position: Position, document: TextDocument, addedItems: string[]): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [],
              fsPath = document.uri.fsPath,
              nameSpace = extjsLangMgr.getNamespaceFromFile(fsPath, undefined, "   ");
        let lineCls = lineText?.substring(0, lineText.lastIndexOf(".")).trim();

        if (!nameSpace) {
            return completionItems;
        }

        log.methodStart("get completion items", 2, "   ", true, [["line text", lineText], ["fn text", fnText]]);

        if (lineCls.includes("("))
        {
            lineCls = lineCls.substring(lineCls.indexOf("(") + 1).trim();
            if (lineCls.includes(","))
            {
                lineCls = lineCls.substring(lineCls.indexOf(",") + 1).trim();
            }
        }
        if (lineCls.includes("=")) {
            lineCls = lineCls.substring(lineCls.indexOf("=") + 1).trim();
        }
        if (lineCls.includes(" ")) {
            lineCls = lineCls.substring(lineCls.lastIndexOf(" ") + 1);
        }

        const _pushItems = ((cmp?: IComponent) =>
        {
            const baseCmp = cmp;
            if (!baseCmp) { return; }
            completionItems.push(...this.getCmpCompletionItems(baseCmp, position, addedItems));
            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            while (cmp)
            {
                for (const mixin of cmp.mixins)
                {
                    const mixinCmp = extjsLangMgr.getComponent(mixin, nameSpace, false, "      ");
                    if (mixinCmp) {
                        _pushItems(mixinCmp);
                    }
                }
                if (cmp.extend) {
                    cmp = extjsLangMgr.getComponent(cmp.extend, nameSpace, false, "      ");
                    if (cmp) {
                        _pushItems(cmp);
                    }
                }
                else {
                    cmp = undefined;
                }
            }
        });

        log.value("      line cls", lineCls, 3);

        //
        // Handle "this"
        //
        if (lineText.trim() === "this.")
        {
            // const thisCls = extjsLangMgr.getClassFromFile(fsPath);
            // if (thisCls) {
            //     _pushItems(extjsLangMgr.getComponent(thisCls, true));
            // }
            // return completionItems;
            // lineCls = extjsLangMgr.getClassFromFile(fsPath) || lineCls;
        }

        //
        // Create the completion items, including items in extended classes
        //
        let component = extjsLangMgr.getComponent(lineCls, nameSpace, true, "      ");
        if (component)
        {   //
            // Push component items, i.e. methods, properties, and configs
            //
            _pushItems(component);
            //
            // Class properties
            //
            // Example:
            //
            //     User has typed:
            //
            //         VSCodeExtJS.
            //
            //     Any existing class paths should display in the intellisense:
            //
            //         AppUtilities
            //         common
            //         etc...
            //
            completionItems.push(...this.getChildClsCompletionItems(component.componentClass, nameSpace, position, addedItems));
        }
        else {
            log.write("      try sub-component tree", 3);
            const subComponents = extjsLangMgr.getSubComponentNames(lineCls, "      ");
            if (subComponents.length > 0)
            {
                log.write("      found sub-components", 3);
                for (const sf of subComponents)
                {
                    if (!addedItems.includes(sf)) {
                        log.value("      add sub-component", sf, 4);
                        completionItems.push(...this.createCompletionItem(sf, lineCls + "." + sf, nameSpace,
                                                                          CompletionItemKind.Class, false, undefined, position));
                        addedItems.push(sf);
                    }
                }
            } //
             // For local instance vars, only provide completion from the right function
            //
            else {
                component = extjsLangMgr.getComponentByFile(fsPath, "      ");
                if (component && fnText)
                {
                    _pushItems(...this.getLocalInstanceComponents(fnText, lineCls, position, fsPath, component));
                }
            }
        }

        log.methodDone("get completion items", 2, "   ", false, [["# of added items", completionItems.length]]);
        return completionItems;
    }


    /**
     * @method getChildClsCompletionItems
     *
     * Get possible Intellisense classpaths for a given class
     *
     * Example:
     *
     *     User has typed:
     *         VSCodeExtJS.
     *     Any existing classpaths should display in the intellisense:
     *         AppUtilities
     *         common
     *         etc...
     *
     * @param componentClass Component class
     * @param addedItems Shared provider instance array to avoid duplicate references
     *
     * @returns {CompletionItem[]}
     */
    private getChildClsCompletionItems(componentClass: string, nameSpace: string, position: Position, addedItems: string[]): CompletionItem[]
    {
        const cmps = extjsLangMgr.getComponentNames(),
              cmpClsParts = componentClass.split("."),
              completionItems: CompletionItem[] = [];

        for (const cls of cmps)
        {
            if (cls)
            {
                let cCls: string | undefined;
                const clsParts = cls.split(".");

                for (let i = 0; i < clsParts.length &&  i < cmpClsParts.length; i++)
                {
                    if (clsParts[i] !== cmpClsParts[i]) {
                        continue;
                    }
                    if (i === cmpClsParts.length - 1 && clsParts.length > i + 1 && cCls !== componentClass) {
                        cCls = clsParts[i + 1];
                        break;
                    }
                }

                if (cCls && addedItems.indexOf(cCls) === -1)
                {
                    completionItems.push(...this.createCompletionItem(cCls, cls, nameSpace, CompletionItemKind.Class, false, undefined, position));
                    addedItems.push(cCls);

                    log.blank(1);
                    log.write("      added inline completion item", 3);
                    log.value("         item", cCls, 3);
                }
            }
        }

        return completionItems;
    }


    private getCmpCompletionItems(component: IComponent, position: Position, addedItems: string[]): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [];

        component.methods.forEach((c: IMethod) =>
        {
            if (addedItems.indexOf(c.name) === -1)
            {
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, component.nameSpace, CompletionItemKind.Method, false, undefined, position));
                addedItems.push(c.name);

                log.blank(1);
                log.write("      added dot completion method", 3);
                log.value("         name", c.name, 3);
            }
        });

        component.properties.forEach((c: IProperty) =>
        {
            if (addedItems.indexOf(c.name) === -1)
            {
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, component.nameSpace, CompletionItemKind.Property, false, undefined, position));
                addedItems.push(c.name);

                log.blank(1);
                log.write("      added dot completion method", 3);
                log.value("         name", c.name, 3);
            }
        });

        component.configs.forEach((c: IConfig) =>
        {
            if (addedItems.indexOf(c.name) === -1)
            {
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, component.nameSpace, CompletionItemKind.Property, true, undefined, position));
                addedItems.push(c.name);

                log.blank(1);
                log.write("      added dot completion method", 3);
                log.value("         name", c.name, 3);
            }
        });

        //
        // TODO - property completion - static and private actions
        //

        return completionItems;
    }


    private getInlineCompletionItems(text: string, lineText: string, position: Position, document: TextDocument): CompletionItem[]
    {
        const addedItems: string[] = [],
              completionItems: CompletionItem[] = [],
              cmps = extjsLangMgr.getComponentNames(),
              aliases = extjsLangMgr.getAliasNames(),
              thisPath = window.activeTextEditor?.document?.uri.fsPath,
              thisCmp = thisPath ? extjsLangMgr.getComponentByFile(thisPath) : undefined,
              isInObject = thisCmp ? isPositionInObject(position, thisCmp) : undefined,
              method = thisCmp ? getMethodByPosition(position, thisCmp) : undefined;

        if (!thisCmp) {
            return completionItems;
        }

        //
        // A helper function to add items to the completion list that will be provided to VSCode
        //
        const _add = ((cmp: IConfig | IProperty | undefined, cls: string, basic: boolean, kind: CompletionItemKind, isConfig = false, extendedCls?: string, doc?: string) =>
        {   //
            // 'basic' means just add the completion item w/o all the checks.  this is for cases of
            // configs, properties within an object.
            //
            if (cls)
            {
                const cCls = cls.split(".")[0];
                if (addedItems.indexOf(cCls) === -1)
                {
                    const label = this.tagText(cmp, isConfig, extendedCls);
                    const cItems = !basic ? this.createCompletionItem(cCls, cCls, thisCmp.nameSpace, kind, isConfig, extendedCls, position) :
                                            [ new CompletionItem(`${cCls}${this.rightPad(label, cCls.length)}${label}`, kind) ];
                    //
                    // Add the completion item(s) to the completion item array that will be provided to
                    // the VSCode engine
                    //
                    if (cItems.length > 0)
                    {   //
                        // Add doc and commit character here for basic mode
                        //
                        if (basic) {
                            cItems.forEach((i) => {
                                i.documentation = doc;
                                if (kind === CompletionItemKind.Constant || kind === CompletionItemKind.Variable) {
                                    i.commitCharacters = [ "." ];
                                }
                            });
                        }
                        completionItems.push(...cItems);
                        addedItems.push(cCls);
                    }
                    log.blank(3);
                    log.write("      added inline completion item", 3);
                    log.value("         item", cCls, 3);
                }
            }
        });

        //
        // A helper function for adding configs and properties of a class to the completion item list
        // that will be provided to VSCode.
        //
        const _addProps = ((cmp: IComponent | undefined, extendedCls?: string) =>
        {
            if (!cmp) { return; }
            cmp?.configs.forEach((c: IConfig) =>
            {
                _add(c, c.name, true, CompletionItemKind.Property, true, extendedCls, c.markdown);
            });
            cmp?.properties.forEach((p: IProperty) =>
            {
                if (this.ignoreProps.indexOf(p.name) === -1) {
                    _add(p, p.name, true, CompletionItemKind.Property, false, extendedCls, p.markdown);
                }
            });
            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            let tCmp: IComponent | undefined = cmp;
            for (const mixin of tCmp.mixins)
            {
                const mixinCmp = extjsLangMgr.getComponent(mixin, thisCmp.nameSpace);
                if (mixinCmp) {
                    _addProps(mixinCmp, tCmp.componentClass);
                }
            }
            while (tCmp.extend && (tCmp = extjsLangMgr.getComponent(tCmp.extend, thisCmp.nameSpace)))
            {
                _addProps(tCmp, tCmp.componentClass);
            }
        });

        const _addObjectConfigs = (objectRange: IRange | undefined) =>
        {   //
            // We have to find the object block that contains the current position, so that we
            // can look at the xtype within that block, and display the appropriate config items
            //
            if (objectRange)
            {
                const eol = documentEol(document),
                    vsRange = toVscodeRange(objectRange.start, objectRange.end),
                    objectRangeText = document.getText(vsRange),
                    regex = new RegExp(/\bxtype: *["']{1}([A-Z0-9-_]+)["']{1} *,{0,1} *$/, "gmi"),
                    innerPositionLine = position.line - vsRange.start.line;
                let idx = -1, tIdx = -1, matches,
                    objectRangeTextCUt = objectRangeText;

                for (let i = 0; i < innerPositionLine; i++) {
                    tIdx = objectRangeTextCUt.indexOf(eol) + 1;
                    idx += tIdx;
                    objectRangeTextCUt = objectRangeTextCUt.substring(tIdx);
                }
                ++idx;

                if (idx !== -1)
                {
                    let xComponent;
                    while ((matches = regex.exec(objectRangeText)) !== null)
                    {
                        if (matches.index <= idx)
                        {
                            const cls = extjsLangMgr.getMappedClass(matches[1], thisCmp.nameSpace, ComponentType.Widget);
                            xComponent = cls ? extjsLangMgr.getComponent(cls, thisCmp.nameSpace) : undefined;
                        }
                        else { break; }
                    }
                    _addProps(xComponent);
                }
            }
        };

        //
        // Depending on the current position, provide the completion items...
        //
        if (method && !isInObject)
        {   //
            // We're in a function, and not within an object expression
            //
            for (const c of cmps) { _add(undefined, c, false, CompletionItemKind.Class); }
            for (const a of aliases) { _add(undefined, a, false, CompletionItemKind.Class); }
            for (const p of method.params) { _add(undefined, p.name, false, CompletionItemKind.Property); }
            for (const v of method.variables) {
                if (v.declaration === DeclarationType.const) {
                    _add(undefined, v.name, true, CompletionItemKind.Constant);
                }
                else {
                    _add(undefined, v.name, true, CompletionItemKind.Variable);
                }
            }
        }
        else if (isInObject)
        {   //
            // We're within an object expression, we provide configs and properties to the
            // completion items list here
            //
            _add(undefined, "xtype", true, CompletionItemKind.Property);
            //
            // First, find the class that the expression is being applied to, which contains the
            // base configs and properties that we want, we'll also traverse up the inheritance tree
            // to add the configs and properties of each component up to the base
            //
            if (method)
            {   //
                // Loop the object expression ranges in this method, ensure the current position is
                // within one of these ranges.  The configs/props only get displayed when the current
                // position is within an object expression.
                //
                for (const oRange of method.objectRanges)
                {
                    if (isPositionInRange(position, toVscodeRange(oRange.start, oRange.end)))
                    {   //
                        // Add inner object class properties if there's an xtype label defined on it
                        //
                        // Example, consider the process of writing of the following:
                        //
                        //     const userDd = Ext.create({
                        //         xtype: "userdropdowns",
                        //         fieldLabel: "label",
                        //         user
                        //
                        // While writing the above, at the current end of string, intellisense should pop up
                        // all properties/configs of the xtype 'userdropdowns' that start with the text
                        // 'user', i.e. userName, etc
                        //
                        _addObjectConfigs(oRange);
                        //
                        // Method variable parameter object expressions
                        //
                        method.variables.forEach((v) =>
                        {
                            if (isPositionInRange(position, toVscodeRange(v.start, v.end)))
                            {
                                const cmp = extjsLangMgr.getComponent(v.componentClass, thisCmp.nameSpace);
                                _addProps(cmp);
                            }
                        });
                        break;
                    }
                }
            }
            else { //
                  // Add inner object class properties if there's an xtype label defined on it
                 // for the main class object ranges.  (We processed all objects within methods
                // above)
                //
                // Example, consider the process of writing of the following:
                //
                //     {
                //         xtype: "textfield",
                //         fieldLabel: "label",
                //         max
                //
                // While writing the above, at the current end of string, intellisense should pop up
                // all properties/configs of the xtype 'textfield' that start with the text 'max',
                // i.e. maxLength, etc
                //
                _addObjectConfigs(thisCmp ? getObjectRangeByPosition(position, thisCmp) : undefined);
            }
        }

        return completionItems;
    }


    private getLocalInstanceComponents(fnText: string, lineCls: string, position: Position, fsPath: string, component: IComponent): IComponent[]
    {
        const components: IComponent[] = [];
        const _add = ((a: IExtJsBase[] | undefined) =>
        {
            if (!a) { return; }
            if (lineCls !== "this")
            {
                for (const p of a)
                {
                    if (p.name === lineCls) {
                        const lCmp = extjsLangMgr.getComponentInstance(lineCls, component.nameSpace, position, fsPath);
                        if (isComponent(lCmp)) {
                            components.push(lCmp);
                        }
                        break;
                    }
                }
            }
            else {
                const lCmp = extjsLangMgr.getComponentInstance(lineCls, component.nameSpace, position, fsPath);
                if (isComponent(lCmp)) {
                    components.push(lCmp);
                }
            }
        });
        for (const m of component.methods)
        {
            if (m.name === fnText)
            {
                _add(m.variables);
                _add(m.params);
                break;
            }
        }
        return components;
    }


    private getMethodCmp(property: string, cmpClass: string, nameSpace: string): IMethod | IConfig | undefined
    {
        let cmp: IMethod | IConfig | undefined = extjsLangMgr.getMethod(cmpClass, property, nameSpace);
        if (!cmp)
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
            if (utils.isGetterSetter(property))
            {   //
                // Extract the property name from the getter/setter.  Note the actual config
                // property will be a lower-case-first-letter version of the extracted property
                //
                const gsProperty = utils.lowerCaseFirstChar(property.substring(3));
                cmp = extjsLangMgr.getConfig(cmpClass, gsProperty, nameSpace);
                if (!cmp) {
                    cmp = extjsLangMgr.getConfig(cmpClass, property, nameSpace);
                }
            }
        }
        return cmp;
    }


    private getPropertyCmp(property: string, cmpClass: string, nameSpace: string): IProperty | IConfig | undefined
    {
        let cmp: IProperty | IConfig | undefined = extjsLangMgr.getConfig(cmpClass, property, nameSpace);
        if (!cmp) {
            cmp = extjsLangMgr.getProperty(cmpClass, property, nameSpace);
        }
        return cmp;
    }


    private rightPad(text: string | undefined, offset: number)
    {
        let pad = "";
        if (!text) { return pad; }
        for (let i = text.length + offset; i < this.rightInfoPad; i++)
        {
            pad += " ";
        }
        return pad || " ";
    }


    private tagText(cmp: IComponent | IMethod | IProperty | IConfig | undefined, isConfig: boolean, extendedCls?: string)
    {
        let tagText = "";

        //
        // Show extended class
        //
        if (extendedCls) {
            const extendedClsParts = extendedCls.split(".");
            tagText += (extendedClsParts[extendedClsParts.length - 1] + " ");
        }

        //
        // If it's a config and not a property
        //
        if (isConfig) {
            tagText += "Config ";
        }

        //
        // Show/hide deprecated properties according to user settings (default true).
        // If this property is hidden by user preference, this method exited already above.
        //
        if (cmp?.deprecated)
        {
            tagText += "(deprecated) ";
        }

        //
        // Show/hide private properties according to user settings (default false)
        // If this property is hidden by user preference, this method exited already above.
        //
        if (cmp?.private)
        {
            tagText += "(private) ";
        }

        //
        // Show  `since` properties if not deprecated
        //
        if (cmp?.since && !cmp.deprecated)
        {
            tagText += `(since ${cmp.since}) `;
        }

        return tagText.trim();
    }

}


function registerCompletionProvider(context: ExtensionContext)
{
    const triggerChars = [
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
        "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
        "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "_", "."
    ];
    context.subscriptions.push(
        languages.registerCompletionItemProvider("javascript", new ExtJsCompletionItemProvider(), ...triggerChars)
    );
}


export default registerCompletionProvider;
