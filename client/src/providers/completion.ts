
import * as log from "../common/log";
import { extjsLangMgr } from "../extension";
import { configuration } from "../common/configuration";
import { ComponentType, DeclarationType, IComponent, IConfig, IExtJsBase, IMethod, IProperty, IRange, utils } from "../../../common";
import {
    CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position,
    TextDocument, CompletionItemKind, window, EndOfLine, Range, TextEdit
} from "vscode";
import {
    getMethodByPosition, isPositionInObject, isPositionInRange, toVscodeRange, isComponent, getObjectRangeByPosition, documentEol
} from "../common/clientUtils";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import {
    isArrayExpression, isIdentifier, isObjectExpression, Comment, isObjectProperty, isExpressionStatement,
    isStringLiteral, ObjectProperty, StringLiteral, isFunctionExpression, ObjectExpression, isNewExpression,
    isVariableDeclaration, isVariableDeclarator, isCallExpression, isMemberExpression, isFunctionDeclaration,
    isThisExpression, isAwaitExpression, SourceLocation, Node, isLabeledStatement
} from "@babel/types";


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

        log.methodStart("provide dot completion items", 1, "", true, [["line text", lineText]]);

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
            completionItems.push(...this.getInlineCompletionItems(text, lineText, position, document, "   ", 2));
        }
        else {
            completionItems.push(...this.getCompletionItems(lineText, fnText, position, document, addedItems, "   ", 2));
        }

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

        log.methodDone("provide dot completion items", 1, "", true);

        return completionItems.length > 0 ? completionItems : undefined;
    }


    createCompletionItem(property: string, cmpClass: string, nameSpace: string, kind: CompletionItemKind, isConfig: boolean, extendedFrom: string | undefined, position: Position, logPad = "   ", logLevel = 2)
    {
        const propCompletion: CompletionItem[] = [];
        log.methodStart("create completion item", logLevel, logPad, false, [
            ["property", property], ["namespace", nameSpace], ["kind", kind.toString()],
            ["is config", isConfig], ["extended from", extendedFrom], ["position", position]
        ]);

        //
        // Get the appropriate component part, a method, property, config, or class, as specified
        // by the caller
        //
        let cmp: IComponent | IMethod | IProperty | IConfig | undefined;
        switch (kind)
        {
            case CompletionItemKind.Method:
                cmp = this.getMethodCmp(property, cmpClass, nameSpace, logPad + "   ", logLevel + 1);
                break;
            case CompletionItemKind.Property: // or config
                cmp = this.getPropertyCmp(property, cmpClass, nameSpace, logPad + "   ", logLevel + 1);
                break;
            default: // class
                cmp = extjsLangMgr.getComponent(cmpClass, nameSpace, true, logPad + "   ", logLevel + 1);
                break;
        }

        if (!cmp) {
            return propCompletion;
        }

        //
        // Hide private properties according to user settings (default true).
        //
        if (cmp.private && configuration.get<boolean>("intellisenseIncludePrivate") !== true)
        {
            log.write("   private properties are configred to be ignored", logLevel, logPad);
            log.methodDone("create completion item", logLevel, logPad);
            return propCompletion;
        }

        //
        // Hide deprecated properties according to user settings (default true).
        //
        if (cmp.deprecated && configuration.get<boolean>("intellisenseIncludeDeprecated") !== true)
        {
            log.write("   deprecated properties are configred to be ignored", logLevel, logPad);
            log.methodDone("create completion item", logLevel, logPad);
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

        let tagText = this.tagText(cmp, property, isConfig, extendedFrom);
        if (tagText)
        {
            completionItem.insertText = property;
            //
            // Label can be tagged with config, getter/setter, deprecated, since, etc...
            //
            completionItem.label = this.getLabel(completionItem.label, tagText);
        }

        //
        // Documentation / JSDoc / Leading Comments
        //
        completionItem.documentation = cmp.markdown;

        //
        // Add the populated completion item to the array of items to be returned to the caller,
        // if this is a `config`, then we are going to add getter/setter items as well
        //
        propCompletion.push(completionItem);

        //
        // If this is a `config` property (i.e. IConfig), then add getter/setter
        //
        if (kind === CompletionItemKind.Property && ("getter" in cmp || "setter" in cmp))
        {
            if ("getter" in cmp)
            {
                const getterItem = new CompletionItem(cmp.getter, CompletionItemKind.Method);
                getterItem.documentation = cmp.markdown;
                getterItem.commitCharacters = [ "(" ];
                tagText = this.tagText(cmp, cmp.getter, true, extendedFrom);
                if (tagText) {
                    getterItem.insertText = cmp.getter;
                    getterItem.label = this.getLabel(getterItem.label, tagText);
                }
                propCompletion.push(getterItem);
            }
            if ("setter" in cmp)
            {
                const setterItem = new CompletionItem(cmp.setter, CompletionItemKind.Method);
                setterItem.documentation = cmp.markdown;
                setterItem.commitCharacters = [ "(" ];
                tagText = this.tagText(cmp, cmp.setter, true, extendedFrom);
                if (tagText) {
                    setterItem.insertText = cmp.setter;
                    setterItem.label = this.getLabel(setterItem.label, tagText);
                }
                propCompletion.push(setterItem);
            }
        }

        log.methodDone("create completion item", logLevel, logPad);

        //
        // this return line was here for the first 3 months of development, not sure how
        // it ever even worked, but leaving here for reference for now
        //
        // return cmp || kind === CompletionItemKind.Class ? propCompletion : [];
        return propCompletion;
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
    private getCompletionItems(lineText: string, fnText: string | undefined, position: Position, document: TextDocument, addedItems: string[], logPad = "", logLevel = 2): CompletionItem[]
    {
        log.methodStart("get completion items", logLevel, logPad, true, [["line text", lineText], ["fn text", fnText]]);

        const completionItems: CompletionItem[] = [],
              fsPath = document.uri.fsPath,
              nameSpace = extjsLangMgr.getNamespaceFromFile(fsPath, undefined, logPad + "   ", logLevel + 1);
        let lineCls = lineText?.substring(0, lineText.lastIndexOf(".")).trim();

        if (!nameSpace) {
            return completionItems;
        }

        if (lineCls.includes("("))
        {
            const parenthesisIdxR = lineCls.lastIndexOf("(") + 1;
            lineCls = lineCls.substring(parenthesisIdxR).trim();
            if (lineCls.includes(","))
            {
                lineCls = lineCls.substring(lineCls.lastIndexOf(",", parenthesisIdxR) + 1).trim();
            }
        }
        if (lineCls.includes("=")) {
            lineCls = lineCls.substring(lineCls.lastIndexOf("=") + 1).trim();
        }
        if (lineCls.includes(" ")) {
            lineCls = lineCls.substring(lineCls.lastIndexOf(" ") + 1);
        }

        const _pushItems = ((cmp?: IComponent) =>
        {
            const baseCmp = cmp;
            if (!baseCmp) { return; }
            completionItems.push(...this.getCmpCompletionItems(baseCmp, position, addedItems, logPad + "   ", logLevel + 1));
            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            while (cmp)
            {
                for (const mixin of cmp.mixins)
                {
                    const mixinCmp = extjsLangMgr.getComponent(mixin, nameSpace, false, "      ", logLevel + 1);
                    if (mixinCmp) {
                        _pushItems(mixinCmp);
                    }
                }
                if (cmp.extend) {
                    cmp = extjsLangMgr.getComponent(cmp.extend, nameSpace, false, "      ", logLevel + 1);
                    if (cmp) {
                        _pushItems(cmp);
                    }
                }
                else {
                    cmp = undefined;
                }
            }
        });

        log.value("   line cls", lineCls, logLevel + 1, logPad);

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
        let component = extjsLangMgr.getComponent(lineCls, nameSpace, true, "      ", logLevel + 1);
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
            completionItems.push(...this.getChildClsCompletionItems(component.componentClass, nameSpace, position, addedItems, logPad + "   ", logLevel + 1));
        }
        else {
            log.write("   try sub-component tree", logLevel + 2, logPad);
            const subComponents = extjsLangMgr.getSubComponentNames(lineCls, logPad + "      ", logLevel + 2);
            if (subComponents.length > 0)
            {
                log.write("   found sub-components", logLevel + 2, logPad);
                for (const sf of subComponents)
                {
                    if (!addedItems.includes(sf)) {
                        log.value("   add sub-component", sf, logLevel + 2, logPad);
                        completionItems.push(...this.createCompletionItem(sf, lineCls + "." + sf, nameSpace,
                                                                          CompletionItemKind.Class, false, undefined, position, logPad + "   ", logLevel + 2));
                        addedItems.push(sf);
                    }
                }
            } //
             // For local instance vars, only provide completion from the right function
            //
            else {
                component = extjsLangMgr.getComponentByFile(fsPath, "      ", logLevel + 2);
                if (component && fnText)
                {
                    _pushItems(...this.getLocalInstanceComponents(fnText, lineCls, position, fsPath, component, logPad + "   ", logLevel + 1));
                }
            }
        }

        log.methodDone("get completion items", logLevel, logPad, false, [["# of added items", completionItems.length]]);
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
    private getChildClsCompletionItems(componentClass: string, nameSpace: string, position: Position, addedItems: string[], logPad: string, logLevel: number): CompletionItem[]
    {
        const cmps = extjsLangMgr.getComponentNames(),
              cmpClsParts = componentClass.split("."),
              completionItems: CompletionItem[] = [];

        log.methodStart("get child cls completion items", logLevel, logPad);

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
                    completionItems.push(...this.createCompletionItem(cCls, cls, nameSpace, CompletionItemKind.Class, false, undefined, position, logPad + "   ", logLevel + 1));
                    addedItems.push(cCls);
                    log.write("   added inline completion item", 3, logPad);
                    log.value("      item", cCls, 3, logPad);
                }
            }
        }

        log.methodDone("get child cls completion items", logLevel, logPad, false, [["# of added items", completionItems.length]]);
        return completionItems;
    }


    private getCmpCompletionItems(component: IComponent, position: Position, addedItems: string[], logPad: string, logLevel: number): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [];
        log.methodStart("get cmp completion items", logLevel, logPad);

        component.methods.forEach((c: IMethod) =>
        {
            if (addedItems.indexOf(c.name) === -1)
            {
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, component.nameSpace, CompletionItemKind.Method, false, undefined, position, logPad + "   ", logLevel + 1));
                addedItems.push(c.name);
                log.write("   added dot completion method", logLevel + 1, logPad);
                log.value("      name", c.name, logLevel + 1);
            }
        });

        component.properties.forEach((c: IProperty) =>
        {
            if (addedItems.indexOf(c.name) === -1)
            {
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, component.nameSpace, CompletionItemKind.Property, false, undefined, position, logPad + "   ", logLevel + 1));
                addedItems.push(c.name);
                log.write("   added dot completion method", logLevel + 1, logPad);
                log.value("      name", c.name, logLevel + 1, logPad);
            }
        });

        component.configs.forEach((c: IConfig) =>
        {
            if (addedItems.indexOf(c.name) === -1)
            {
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, component.nameSpace, CompletionItemKind.Property, true, undefined, position, logPad + "   ", logLevel + 1));
                addedItems.push(c.name);
                log.write("   added dot completion method", logLevel + 1);
                log.value("      name", c.name, logLevel + 1, logPad);
            }
        });

        //
        // TODO - property completion - static and private actions
        //

        log.methodDone("get child cls completion items", logLevel, logPad, false, [["# of added items", completionItems.length]]);
        return completionItems;
    }


    private getInlineCompletionItems(text: string, lineText: string, position: Position, document: TextDocument, logPad: string, logLevel: number): CompletionItem[]
    {
        log.methodStart("get inline completion items", logLevel, logPad);

        const addedItems: string[] = [],
              completionItems: CompletionItem[] = [],
              cmps = extjsLangMgr.getComponentNames(),
              aliases = extjsLangMgr.getAliasNames(),
              thisPath = window.activeTextEditor?.document?.uri.fsPath,
              thisCmp = thisPath ? extjsLangMgr.getComponentByFile(thisPath, logPad + "   ", logLevel + 1) : undefined,
              isInObject = thisCmp ? isPositionInObject(position, thisCmp) : undefined,
              method = thisCmp ? getMethodByPosition(position, thisCmp) : undefined;

        if (!thisCmp) {
            return completionItems;
        }

        //
        // A helper function to add items to the completion list that will be provided to VSCode
        //
        const _add = (cmp: IConfig | IProperty | undefined, cls: string, basic: boolean, kind: CompletionItemKind, isConfig = false, extendedCls?: string, doc?: string) =>
        {   //
            // 'basic' means just add the completion item w/o all the checks.  this is for cases of
            // configs, properties within an object.
            //
            if (cls)
            {
                const cCls = cls.split(".")[0];
                if (addedItems.indexOf(cCls) === -1)
                {
                    let cItems;
                    if (!basic) {
                        cItems = this.createCompletionItem(cCls, cCls, thisCmp.nameSpace, kind, isConfig, extendedCls, position, logPad + "   ", logLevel + 1);
                    }
                    else {
                        const tagText = this.tagText(cmp, cCls, isConfig, extendedCls);
                        cItems = [ new CompletionItem(this.getLabel(cCls, tagText), kind) ];
                        if (tagText) {
                            cItems[0].insertText = cCls;
                        }
                    }
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
                    log.write("   added inline completion item", logLevel + 1, logPad);
                    log.value("      item", cCls, logLevel + 1, logPad);
                }
            }
        };

        //
        // A helper function for adding configs and properties of a class to the completion item list
        // that will be provided to VSCode.
        //
        const _addProps = (cmp: IComponent | undefined, extendedCls?: string) =>
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
                const mixinCmp = extjsLangMgr.getComponent(mixin, thisCmp.nameSpace, false, logPad + "   ", logLevel + 1);
                if (mixinCmp) {
                    _addProps(mixinCmp, tCmp.componentClass);
                }
            }
            while (tCmp.extend && (tCmp = extjsLangMgr.getComponent(tCmp.extend, thisCmp.nameSpace, false, logPad + "   ", logLevel + 1)))
            {
                _addProps(tCmp, tCmp.componentClass);
            }
        };

        const _addObjectConfigs = (objectRange: IRange | undefined) =>
        {   //
            // We have to find the object block that contains the current position, so that we
            // can look at the xtype within that block, and display the appropriate config items
            //
            if (objectRange)
            {
                completionItems.push(...this.getXtypeCompletionItems(document, position, thisCmp.nameSpace, logPad + "   ", logLevel, _addProps));
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
                                const cmp = extjsLangMgr.getComponent(v.componentClass, thisCmp.nameSpace, false, logPad + "   ", logLevel + 1);
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

        log.methodDone("get inline completion items", logLevel, logPad, false, [["# of added items", completionItems.length]]);
        return completionItems;
    }


    private getLabel(label: string, tagText: string)
    {
        return `${label}${this.rightPad(tagText, label.length)}${tagText}`;
    }


    private getLocalInstanceComponents(fnText: string, lineCls: string, position: Position, fsPath: string, component: IComponent, logPad: string, logLevel: number): IComponent[]
    {
        log.methodStart("get local instance components", logLevel, logPad);

        const components: IComponent[] = [];
        const _add = ((a: IExtJsBase[] | undefined) =>
        {
            if (!a) { return; }
            if (lineCls !== "this")
            {
                for (const p of a)
                {
                    if (p.name === lineCls) {
                        const lCmp = extjsLangMgr.getComponentInstance(lineCls, component.nameSpace, position, fsPath, logPad + "   ", logLevel + 1);
                        if (isComponent(lCmp)) {
                            components.push(lCmp);
                        }
                        break;
                    }
                }
            }
            else {
                const lCmp = extjsLangMgr.getComponentInstance(lineCls, component.nameSpace, position, fsPath, logPad + "   ", logLevel + 1);
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

        log.methodDone("get local instance components", logLevel, logPad, false, [["# of items", components.length]]);
        return components;
    }


    private getMethodCmp(property: string, cmpClass: string, nameSpace: string, logPad: string, logLevel: number): IMethod | IConfig | undefined
    {
        log.methodStart("get method component", logLevel, logPad);

        let cmp: IMethod | IConfig | undefined = extjsLangMgr.getMethod(cmpClass, property, nameSpace, logPad + "   ", logLevel + 1);
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
                cmp = extjsLangMgr.getConfig(cmpClass, gsProperty, nameSpace, logPad + "   ", logLevel + 1) ||
                      extjsLangMgr.getConfig(cmpClass, property, nameSpace, logPad + "   ", logLevel + 1);
            }
        }

        log.methodDone("get method component", logLevel, logPad);
        return cmp;
    }


    private getPropertyCmp(property: string, cmpClass: string, nameSpace: string, logPad: string, logLevel: number): IProperty | IConfig | undefined
    {
        log.methodStart("get property component", logLevel, logPad);
        const cmp = extjsLangMgr.getConfig(cmpClass, property, nameSpace, logPad + "   ", logLevel + 1) ||
                    extjsLangMgr.getProperty(cmpClass, property, nameSpace, logPad + "   ", logLevel + 1);
        log.methodDone("get property component", logLevel, logPad);
        return cmp;
    }


    private getXtypeCompletionItems(document: TextDocument, position: Position, nameSpace: string, logPad: string, logLevel: number, addFn: (arg: IComponent) => void)
    {
        const completionItems: CompletionItem[] = [],
              xtypes = extjsLangMgr.getXtypeNames(),
              cmp = extjsLangMgr.getComponentByFile(document.uri.fsPath),
              range = document.getWordRangeAtPosition(position),
              addedItems: string[] = [];
        let hasXtype = "";

        if (range && cmp && isPositionInObject(position, cmp)) // && getMethodByPosition(position, cmp))
        {   //
            // Check to see if there's already an xtype definition within the object block
            //
            const objectRange = getObjectRangeByPosition(position, cmp);
            if (objectRange)
            {
                const eol = documentEol(document),
                      vsRange = toVscodeRange(objectRange.start, objectRange.end),
                      innerPositionLine = position.line - vsRange.start.line;
                let idx = 0, tIdx = -1,
                    objectRangeText = document.getText(vsRange),
                    objectRangeTextCut = objectRangeText;

                for (let i = 0; i <= innerPositionLine; i++) {
                    tIdx = objectRangeText.indexOf(eol, idx) + eol.length;
                    objectRangeTextCut = objectRangeText.substring(idx, tIdx);
                    idx = tIdx;
                }
                // objectRangeText = objectRangeText.substring(idx, objectRangeText.indexOf(eol, idx));
                objectRangeText = objectRangeText.replace(objectRangeTextCut, "");
                try {
                    const ast = parse(objectRangeText);
                    if (ast)
                    {
                        const astNode = ast.program.body[0];
                        if (isLabeledStatement(astNode))
                        {
                            if (isExpressionStatement(astNode.body) && isArrayExpression(astNode.body.expression))
                            {
                                const elements = astNode.body.expression.elements;
                                for (const e of elements)
                                {
                                    if (isObjectExpression(e) && e.loc)
                                    {
                                        const relativePosition = new Position(position.line - objectRange.start.line, position.character);
                                        if (toVscodeRange(e.loc.start, e.loc.end).contains(relativePosition))
                                        {
                                            for (const p of e.properties)
                                            {
                                                if (isObjectProperty(p))
                                                {
                                                    if (isIdentifier(p.key))
                                                    {
                                                        if (p.key.name === "xtype")
                                                        {
                                                            if (isStringLiteral(p.value))
                                                            {
                                                                hasXtype = p.value.value;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                catch (ex) {
                    log.error(ex.toString());
                    return completionItems;
                }
            }

            // if ((/\bxtype: *["']{1}([A-Z0-9-_]+)["']{1} *,{0,1} *$/gmi).test(objectRangeTextCut))
            if (hasXtype)
            {
                const cls = extjsLangMgr.getMappedClass(hasXtype, nameSpace, ComponentType.Widget),
                      xComponent = cls ? extjsLangMgr.getComponent(cls, nameSpace, false, logPad + "   ", logLevel + 1) : undefined;
                if (xComponent) {
                    addFn(xComponent);
                }
            }
            else
            {
                for (const xtype of xtypes)
                {
                    if (!addedItems.includes(xtype))
                    {
                        const xtypeCompletion = new CompletionItem(`xtype: ${xtype}`),
                            lineText = document.lineAt(position).text.substr(0, position.character);
                        xtypeCompletion.insertText = `xtype: "${xtype}",`;
                        xtypeCompletion.command = {command: "vscode-extjs:ensureRequire", title: "ensureRequire"};
                        if (lineText.includes("xtype")) {
                            const xTypeIdx = lineText.indexOf("xtype"),
                                xTypeIdx2 = lineText.indexOf("xtype:"),
                                xTypeIdx3 = lineText.indexOf("xtype: "),
                                xTypeIdxOffset = xTypeIdx3 !== -1 ? 2 : (xTypeIdx2 !== -1 ? 1 : 0),
                                preRange = new Range(new Position(position.line, xTypeIdx + xTypeIdxOffset),
                                                    new Position(position.line, xTypeIdx + xTypeIdxOffset + 4));
                            xtypeCompletion.additionalTextEdits = [ TextEdit.replace(preRange, "") ];
                        }
                        completionItems.push(xtypeCompletion);
                        addedItems.push(xtype);
                    }
                }
            }
        }

        return completionItems;
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


    private tagText(cmp: IComponent | IMethod | IProperty | IConfig | undefined, property: string, isConfig: boolean, extendedCls?: string)
    {
        let tagText = "";

        //
        // Show extended class
        //
        if (extendedCls)
        {
            const extendedClsParts = extendedCls.split(".");
            tagText += (extendedClsParts[extendedClsParts.length - 1] + " ");
        }

        //
        // If it's a config and not a property
        //
        if (isConfig)
        {
            tagText += "config ";
            if (property.startsWith("get")) {
                tagText += "getter ";
            }
            else if (property.startsWith("set")) {
                tagText += "setter ";
            }
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

        return tagText.trimRight();
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
