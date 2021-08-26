
import * as log from "../common/log";
import { extjsLangMgr } from "../extension";
import { configuration } from "../common/configuration";
import {
    ComponentType, DeclarationType, IComponent, IConfig, IExtJsBase, IMethod, IProperty,
    utils, ast, IObjectRange, extjs
} from "../../../common";
import {
    CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position,
    TextDocument, CompletionItemKind, window, Range, TextEdit, commands
} from "vscode";
import {
    getMethodByPosition, isPositionInObjectRange, isPositionInRange, toVscodeRange, isComponent,
    getObjectRangeByPosition, documentEol, quoteChar, getWorkspaceProjectName, toIPosition, shouldIgnoreType
} from "../common/clientUtils";
import {
    isArrayExpression, isIdentifier, isObjectExpression, isObjectProperty, isExpressionStatement,
    isStringLiteral,  isLabeledStatement
} from "@babel/types";
import { getTypeFromDoc } from "../common/commentParser";

//
// TODO - Clean up out of control function arguments
//
// interface ICompletionProperties
// {
//     property: string;
//     cmpClass?: string;
//     document: TextDocument;
//     position: Position;
//     cmpType?: ComponentType;
//     text: string;
//     lineText: string;
//     lineTextLeft: string;
//     logPad: string;
//     logLevel: number;
//     methodName?: string;
//     component?: IComponent;
//     instance?: boolean;
//     addedItems?: string[];
//     addProps?: (arg: IComponent) => void;
// }

class ExtJsCompletionItemProvider implements CompletionItemProvider
{
    private rightInfoPad = 45;

    //
    // Properties that shouldn't get displayed in inline Intellisense
    //
    private ignoreProps = [
        "xtype", "extend", "requires", "alias", "alternateClassName", "singleton", "statics"
    ];

    async provideCompletionItems(document: TextDocument, position: Position)
    {
        const range = document.getWordRangeAtPosition(position),
              text = range ? document.getText(range) : "",
              lineText = document.lineAt(position).text,
              lineTextLeft = lineText.substr(0, position.character).trimLeft();

        if (/type *\:/.test(lineTextLeft) && await shouldIgnoreType(text)) {
            return;
        }
        if (!utils.isExtJsFile(document.getText())) {
            return;
        }

        log.methodStart("provide completion items", 1, "", true);

        //
        // ** IMPORTANT **
        // It's possible the indexer initiated a re-indexing since editing the document is
        // what triggers thecompletion item request, so wait for it to finish b4 proceeding
        //
        await commands.executeCommand("vscode-extjs:waitReady", "   ", 3);
        //
        // Indexer finished, proceed...
        //

        const completionItems: CompletionItem[] = [],
              quotesRegex = new RegExp(`(?<=(?:"|')[^;]*)[^.]*[,]{0,1}\\s*${text}:*\\s*(?=(?:("|')))$`),
              commentRegex = new RegExp(`(?<=(?:\\/\\/|[ ]+\\*|\\/\\*\\*)[^;]*)[^.]*[,]{0,1}\\s*${text}:*\\s*(?<!(?:\\*\\/))$`),
              inComments = commentRegex.test(lineText),
              inQuotes = quotesRegex.test(lineText),
              project = getWorkspaceProjectName(document.uri.fsPath);

        log.values([
            ["text", text], ["line text left", lineTextLeft], ["in comments", inComments], ["in quotes", inQuotes]
        ], 2, "   ");

        //
        // The `getInlineCompletionItems` method handles completion items that lead all other
        // parts of a classpath.  For example, the class:
        //
        //     MyApp.view.users.Users
        //     fn.call(MyApp.view.users.Users);
        //
        // The `MyApp` part of the class path is of interest, when the user starts typing into a
        // blank line (or a new statement block), we want to display all possible parts of a
        // classpath that lead the class name, in this case we ant to add 'MyApp' as a completion item.
        //
        // If we're within an object expression, then we are interested in properties of the defined
        // xtype of the object.
        //
        // The `(?<!(?:"|'|\\/\\/|[ ]+\\*|\\/\\*\\*)[^;]*)` portion of the regex ignores patterns
        // that are contains in strings or comments
        //
        if (!inComments && !inQuotes)
        {
            if (!lineTextLeft || !lineTextLeft.includes(".") || (new RegExp(`(?:\\(|;|\\:)\\s*${text}`)).test(lineTextLeft))
            {
                log.write("   do inline completion", 1);
                completionItems.push(...(await this.getInlineCompletionItems(text, lineTextLeft, position, project, document, "   ", 2)));
            }
            else {
                log.write("   do dot completion", 1);
                let methodName: string | undefined;
                const thisCls = extjsLangMgr.getClsByPath(document.uri.fsPath);
                if (thisCls) {
                    const thisCmp = extjsLangMgr.getComponent(thisCls, project, "   ", 2, toIPosition(position)),
                          outerMethod =  thisCmp ? getMethodByPosition(position, thisCmp) : undefined;
                    methodName = outerMethod?.name; // name of the method we are in
                }
                completionItems.push(...this.getCompletionItems(text, lineTextLeft, methodName, position, project, document, "   ", 2));
            }
        }
        else {
            log.write("   in comment/quote - todo - display full class paths only", 3);
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

        log.methodDone("provide completion items", 1, "", true);

        return completionItems.length > 0 ? completionItems : undefined;
    }


    createCompletionItem(property: string, cmpClassPart: string, project: string, kind: CompletionItemKind, isStatic: boolean, isInlineChild: boolean, preSelect: boolean, extendedFrom: string | undefined, position: Position, document: TextDocument, logPad = "   ", logLevel = 2)
    {
        const propCompletion: CompletionItem[] = [];
        log.methodStart("create completion item", logLevel, logPad, false, [
            ["property", property], ["project", project], ["kind", kind.toString()],
            ["extended from", extendedFrom], ["position", position]
        ]);

        //
        // Get the appropriate component part, a method, property, config, or class, as specified
        // by the caller
        //
        let cmp: IComponent | IMethod | IProperty | IConfig | undefined;
        switch (kind)
        {
            case CompletionItemKind.Method:
                cmp = this.getMethodCmp(property, cmpClassPart, project, isStatic, logPad + "   ", logLevel + 1);
                break;
            case CompletionItemKind.Property: // or config
                cmp = this.getPropertyCmp(property, cmpClassPart, project, isStatic, logPad + "   ", logLevel + 1);
                break;
            default: // class
                cmp = extjsLangMgr.getComponent(cmpClassPart, project, logPad + "   ", logLevel + 1, toIPosition(position));
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
            log.write("   private properties are configured to be ignored", logLevel, logPad);
            log.methodDone("create completion item", logLevel, logPad);
            return propCompletion;
        }

        //
        // Hide deprecated properties according to user settings (default true).
        //
        if (cmp.deprecated && configuration.get<boolean>("intellisenseIncludeDeprecated") !== true)
        {
            log.write("   deprecated properties are configured to be ignored", logLevel, logPad);
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

        let tagText = !isInlineChild ? this.tagText(cmp, property, extendedFrom) : "";
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
        // If a text edit triggers a completion in the middle of the expression we need to
        // make sure to replace the existing right side part if the user selects from the
        // completion items.  Use `additionalTextEdits` on the completion item to accomplish.
        //
        const lineText = document.lineAt(position).text,
              lineTextLeft = lineText.substr(0, position.character),
              lineTextRight = lineText.replace(lineTextLeft, ""),
              rTextMatch = lineTextRight.match(/([a-zA-Z_0-9]+)/);
        let rText: string | undefined;
        if (rTextMatch && rTextMatch[1])
        {
            rText = rTextMatch[1];
        }
        if (rText)
        {
            const rRange = new Range(position, new Position(position.line, position.character + rText.length));
            completionItem.additionalTextEdits = [ TextEdit.replace(rRange, "") ];
        }

        //
        // If we're inline and it's a base name space property, select it
        //
        if (preSelect) {
            completionItem.preselect = true;
        }

        //
        // Add the populated completion item to the array of items to be returned to the caller,
        // if this is a `config`, then we are going to add getter/setter items as well
        //
        propCompletion.push(completionItem);

        //
        // If this is a `config` property (i.e. IConfig), then add getter/setter
        //
        if (kind === CompletionItemKind.Property)
        {
            if ("getter" in cmp)
            {
                const getterItem = new CompletionItem(cmp.getter, CompletionItemKind.Method);
                getterItem.documentation = cmp.markdown;
                getterItem.commitCharacters = [ "(" ];
                tagText = this.tagText(cmp, cmp.getter, extendedFrom);
                getterItem.insertText = cmp.getter;
                getterItem.label = this.getLabel(getterItem.label, tagText);
                propCompletion.push(getterItem);
            }
            if ("setter" in cmp)
            {
                const setterItem = new CompletionItem(cmp.setter, CompletionItemKind.Method);
                setterItem.documentation = cmp.markdown;
                setterItem.commitCharacters = [ "(" ];
                tagText = this.tagText(cmp, cmp.setter, extendedFrom);
                setterItem.insertText = cmp.setter;
                setterItem.label = this.getLabel(setterItem.label, tagText);
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
     * @method getCompletionItems
     *
     * @param lineText The complete text of the line of the current trigger position.
     * @param fnText The outer function name of the function that contains the reference to this property,
     * if this property is found within a controller method.  Used for local property (relative to the
     * outer function) inspection only.
     * @param fsPath The filesystem path to the JavasScript class file.
     * @param addedItems Array holding item labels already added in this request.
     */
    private getCompletionItems(text: string, lineTextLeft: string, fnText: string | undefined, position: Position, project: string, document: TextDocument, logPad = "", logLevel = 2): CompletionItem[]
    {
        log.methodStart("get completion items", logLevel, logPad, true, [["text", text], ["line text left", lineTextLeft], ["fn text", fnText]]);

        const completionItems: CompletionItem[] = [],
              fsPath = document.uri.fsPath,
              addedItems: string[] = [];

        const fullClsTextCmp = extjsLangMgr.getComponent(lineTextLeft, project, logPad + "   ", logLevel + 1);
        let lineCls = !fullClsTextCmp ? lineTextLeft?.substring(0, lineTextLeft.lastIndexOf(".")).trim() : lineTextLeft;

        //
        // Strip off unwanted text from the line text to get the text of the item of interest
        //
        // For example, if a user is typing a function parameter:
        //
        //     me.testFn(VSCodeExtJS.)
        //
        // We want "VSCodeExtJS."
        //
        if (lineCls.includes("("))
        {
            const parenthesisIdxR = lineCls.lastIndexOf("(") + 1;
            lineCls = lineCls.substring(parenthesisIdxR).trim();
            if (lineCls.includes(",")) {
                lineCls = lineCls.substring(lineCls.lastIndexOf(",", parenthesisIdxR) + 1).trim();
            }
        }
        if (lineCls.includes("=")) {
            lineCls = lineCls.substring(lineCls.lastIndexOf("=") + 1).trim();
        }
        if (lineCls.includes(" ")) {
            lineCls = lineCls.substring(lineCls.lastIndexOf(" ") + 1);
        }

        const _pushItems = ((instance: boolean, cmp?: IComponent) =>
        {
            const baseCmp = cmp;
            if (!baseCmp) { return; }

            completionItems.push(...this.getCmpCompletionItems(baseCmp, instance, position, project, document, addedItems, logPad + "   ", logLevel + 1));
            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            while (cmp)
            {
                if (cmp.mixins) {
                    for (const mixin of cmp.mixins.value) {
                        _pushItems(instance, extjsLangMgr.getComponent(mixin.name, project, "      ", logLevel + 1));
                    }
                }
                if (cmp.extend) {
                    cmp = extjsLangMgr.getComponent(cmp.extend, project, "      ", logLevel + 1);
                    _pushItems(instance, cmp);
                }
                else {
                    cmp = undefined;
                }
            }
        });

        log.value("   line cls", lineCls, logLevel + 1, logPad);

        //
        // Create the completion items, including items in extended classes
        //
        let component = extjsLangMgr.getComponent(lineCls, project, logPad + "   ", logLevel + 1);
        //
        // Check if this is an instance or classpath ref, it will be different how it's handled
        //
        if (component) // static component (non-instance)
        {   //
            // Push component items, i.e. methods, properties, and configs
            //
            _pushItems(false, component);
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
            // Note that if `cmp` is defined, then we have a full class path name and we are
            // only going to give back statics, so we don;t add child cls items in that case
            //
            if (!fullClsTextCmp) {
                completionItems.push(...this.getChildClsCompletionItems(component, project, position, document, addedItems, logPad + "   ", logLevel + 1));
            }
        }
        //
        // Instance component...
        //
        else {
            log.write("   try sub-component tree", logLevel + 2, logPad);

            const subComponents = extjsLangMgr.getSubComponentNames(lineCls, logPad + "   ", logLevel + 2);
            if (subComponents.length > 0)
            {
                log.write("   found sub-components", logLevel + 2, logPad);
                for (const sf of subComponents)
                {
                    if (!addedItems.includes(sf)) {
                        log.value("   add sub-component", sf, logLevel + 2, logPad);
                        completionItems.push(...this.createCompletionItem(sf, lineCls + "." + sf, project, CompletionItemKind.Class, false, false,
                                                                          false, undefined, position, document, logPad + "   ", logLevel + 2));
                        addedItems.push(sf);
                    }
                }
            } //
             // For local instance vars, only provide completion from the right function
            //
            else {
                log.write("   try instance-component tree", logLevel + 2, logPad);
                component = extjsLangMgr.getComponentByFile(fsPath, logPad + "   ", logLevel + 2);
                if (component && fnText)
                {
                    const instComponents = this.getLocalInstanceComponents(fnText, lineCls, position, fsPath, component, logPad + "   ", logLevel + 1);
                    if (instComponents.length > 0)
                    {
                        log.write("   found instance-components", logLevel + 2, logPad);
                        for (const ic of instComponents)
                        {
                            _pushItems(true, ic);
                        }
                    }
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
     *         ...
     *     FFrom the classes:
     *         VSCode.AppUtilities
     *         VSCode.common.UserDropdown
     *         ...
     *
     * @param componentClass Component class
     * @param addedItems Shared provider instance array to avoid duplicate references
     *
     * @returns {CompletionItem[]}
     */
    private getChildClsCompletionItems(component: IComponent, project: string, position: Position, document: TextDocument, addedItems: string[], logPad: string, logLevel: number): CompletionItem[]
    {
        const cmps = extjsLangMgr.getComponentNames(),
              componentClass = component.componentClass,
              cmpClsParts = componentClass.split("."),
              completionItems: CompletionItem[] = [];

        log.methodStart("get child cls completion items", logLevel, logPad);

        for (const cls of cmps)
        {
            let cCls: string | undefined;
            const clsParts = cls.split(".");

            for (let i = 0; i < clsParts.length &&  i < cmpClsParts.length; i++)
            {
                if (clsParts[i] !== cmpClsParts[i]) {
                    continue;
                }
                else if (i === cmpClsParts.length - 1 && clsParts.length > i + 1 && cCls !== componentClass) {
                    cCls = clsParts[i + 1];
                    break;
                }
            }

            if (cCls && !addedItems.includes(cCls))
            {
                completionItems.push(...this.createCompletionItem(
                    cCls, cls, project, CompletionItemKind.Class, false, true, false, undefined, position, document, logPad + "   ", logLevel + 1
                ));
                addedItems.push(cCls);
                log.write("   added inline completion item", logLevel + 2, logPad);
                log.value("      item", cCls, logLevel + 2, logPad);
            }
        }

        log.methodDone("get child cls completion items", logLevel, logPad, false, [["# of added items", completionItems.length]]);
        return completionItems;
    }


    private getCmpCompletionItems(component: IComponent, instance: boolean, position: Position, project: string, document: TextDocument, addedItems: string[], logPad: string, logLevel: number): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [];
        log.methodStart("get cmp completion items", logLevel, logPad + 1, false, [["instance", instance], ["singleton", component.singleton]]);

        if (instance || component.singleton)
        {
            log.write(`   Processing ${component.singleton ? "singleton" : "instance"}`, logLevel + 1, logPad);

            component.methods.filter((m) => !addedItems.includes(m.name)).forEach((c: IMethod) =>
            {
                completionItems.push(...this.createCompletionItem(
                    c.name, c.componentClass, project, CompletionItemKind.Method, false, false, false, undefined, position, document, logPad + "   ", logLevel + 1
                ));
                addedItems.push(c.name);
                log.write("   added methods dot completion method", logLevel + 2, logPad);
                log.value("      name", c.name, logLevel + 2);
            });

            component.properties.filter((p) => !addedItems.includes(p.name)).forEach((c: IProperty) =>
            {
                completionItems.push(...this.createCompletionItem(
                    c.name, c.componentClass, project, CompletionItemKind.Property, false, false, false, undefined, position, document, logPad + "   ", logLevel + 1
                ));
                addedItems.push(c.name);
                log.write("   added properties dot completion method", logLevel + 2, logPad);
                log.value("      name", c.name, logLevel + 2, logPad);
            });

            if (!component.singleton)
            {
                component.configs.filter((c) => !addedItems.includes(c.name)).forEach((c: IConfig) =>
                {
                    completionItems.push(...this.createCompletionItem(
                        c.name, c.componentClass, project, CompletionItemKind.Property, false, false, false, undefined, position, document, logPad + "   ", logLevel + 1
                    ));
                    addedItems.push(c.name);
                    log.write("   added configs dot completion method", logLevel + 2);
                    log.value("      name", c.name, logLevel + 2, logPad);
                });

                component.privates.filter((c) => !addedItems.includes(c.name)).forEach((c: IProperty | IMethod) =>
                {
                    const kind = extjs.isProperty(c) ? CompletionItemKind.Property : CompletionItemKind.Method;
                    completionItems.push(...this.createCompletionItem(
                        c.name, c.componentClass, project, kind, false, false, false, undefined, position, document, logPad + "   ", logLevel + 1
                    ));
                    addedItems.push(c.name);
                    log.write("   added privates dot completion method", logLevel + 2);
                    log.value("      name", c.name, logLevel + 2, logPad);
                });
            }
        }
        else
        {
            log.write("   Processing statics", logLevel + 1, logPad);
            component.statics.filter((c) => !addedItems.includes(c.name)).forEach((c: IProperty | IMethod) =>
            {
                const kind = extjs.isProperty(c) ? CompletionItemKind.Property : CompletionItemKind.Method;
                completionItems.push(...this.createCompletionItem(
                    c.name, c.componentClass, project, kind, true, false, false, undefined, position, document, logPad + "   ", logLevel + 1
                ));
                addedItems.push(c.name);
                log.write("   added statics dot completion method", logLevel + 2);
                log.value("      name", c.name, logLevel + 2, logPad);
            });
        }

        log.methodDone("get child cls completion items", logLevel + 1, logPad, false, [["# of added items", completionItems.length]]);
        return completionItems;
    }


    private async getInlineCompletionItems(text: string, lineTextLeft: string, position: Position, project: string, document: TextDocument, logPad: string, logLevel: number)
    {
        log.methodStart("get inline completion items", logLevel, logPad);

        const addedItems: string[] = [],
              completionItems: CompletionItem[] = [],
              cmps = extjsLangMgr.getComponentNames(),
              aliases = extjsLangMgr.getAliasNames(),
              thisPath = window.activeTextEditor?.document?.uri.fsPath,
              thisCmp = thisPath ? extjsLangMgr.getComponentByFile(thisPath, logPad + "   ", logLevel + 1) : undefined,
              isInObject = thisCmp ? isPositionInObjectRange(position, thisCmp) : undefined,
              method = thisCmp ? getMethodByPosition(position, thisCmp) : undefined,
              quote = quoteChar();

        if (!thisCmp) {
            return completionItems;
        }

        //
        // A helper function to add items to the completion list that will be provided to VSCode
        //
        const _add = (cmp: IConfig | IProperty | undefined, cls: string, basic: boolean, kind: CompletionItemKind, extendedCls?: string, doc?: string) =>
        {   //
            // See if the typed text is inclusive in this class name (cls)...
            //
            if (cls.toLowerCase().includes(text.toLowerCase())) // startWith() for exact match??
            {
                const cCls = cls.split(".")[0];
                if (!addedItems.includes(cCls))
                {
                    let cItems;
                    //
                    // 'basic' means just add the completion item w/o all the checks.  this is for cases of
                    // configs, properties within an object.
                    //
                    if (!basic) {
                        cItems = this.createCompletionItem(cCls, cls, project, kind, false, false, true, extendedCls, position, document, logPad + "   ", logLevel + 1);
                    }
                    else {
                        const tagText = cmp ? this.tagText(cmp, cCls, extendedCls) : "";
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
                        // Add doc and commit character here for basic mode, if not basic then the
                        // 'createCompletionItem' method will have handled
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
                _add(c, c.name, true, CompletionItemKind.Property, extendedCls, c.markdown);
            });
            cmp?.properties.filter((p) => !this.ignoreProps.includes(p.name)).forEach((p) =>
            {
                _add(p, p.name, true, CompletionItemKind.Property, extendedCls, p.markdown);
            });

            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            let tCmp: IComponent | undefined = cmp;
            if (tCmp.mixins)
            {
                for (const mixin of tCmp.mixins.value)
                {
                    const mixinCmp = extjsLangMgr.getComponent(mixin.name, project, logPad + "   ", logLevel + 1, toIPosition(position));
                    if (mixinCmp) {
                        _addProps(mixinCmp, tCmp.componentClass);
                    }
                }
            }
            while (tCmp.extend && (tCmp = extjsLangMgr.getComponent(tCmp.extend, project, logPad + "   ", logLevel + 1, toIPosition(position))))
            {
                _addProps(tCmp, tCmp.componentClass);
            }
        };

        //
        // Check special property cases
        //
        // xtype/type - Check for 2 quotes, as when the user types the 1st one, Code editor will auto
        // insert the 2nd
        //
        //     xtype: ''
        //
        if (lineTextLeft && new RegExp(`x?type\\s*:\\s*${quote}${quote}$`).test(lineTextLeft))
        {
            completionItems.push(...(await this.getObjectRangeCompletionItems(undefined, text, lineTextLeft, document, position, thisCmp, logPad + "   ", logLevel, _addProps)));
        }
        //
        // Depending on the current position, provide the completion items...
        //
        // Check whether we're inside a method of a component, and not within an object expression {}, or
        // if we're within an object expression.  Handline these 2 scenarios will be different obviously.
        //
        else if (method && !isInObject)
        {   //
            // We're in a function, and not within an object expression {}
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
            // to add the configs and properties of each component up to the base, including mixins
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
                    {
                        let added = false;
                        //
                        // Method variable parameter object expressions
                        //
                        method.variables.filter((v) => isPositionInRange(position, toVscodeRange(v.start, v.end))).forEach((v) =>
                        {
                            const cmp = extjsLangMgr.getComponent(v.componentClass, project, logPad + "   ", logLevel + 1);
                            if (cmp) {
                                _addProps(cmp);
                                added = true;
                            }
                        });
                        if (!added && oRange)
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
                            completionItems.push(...(await this.getObjectRangeCompletionItems(
                                undefined, text, lineTextLeft, document, position, thisCmp, logPad + "   ", logLevel, _addProps
                            )));
                        }
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
                if (getObjectRangeByPosition(position, thisCmp))
                {
                    const m = lineTextLeft.match(new RegExp(`^["']*([\\w_\\-]+)["']*\\s*\\:\\s*${text}$`, "i"));
                    if (m)
                    {
                        const [_, property ] = m;
                        log.write("   add inline property completion", 1);
                        completionItems.push(...(await this.getObjectRangeCompletionItems(
                            property, text, lineTextLeft, document, position, thisCmp, logPad + "   ", logLevel, _addProps
                        )));
                    }
                    else {
                        completionItems.push(...(await this.getObjectRangeCompletionItems(
                            undefined, text, lineTextLeft, document, position, thisCmp, logPad + "   ", logLevel, _addProps
                        )));
                    }
                }
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

        const components: IComponent[] = [],
              project = getWorkspaceProjectName(fsPath);

        const _add = ((a: IExtJsBase[] | undefined) =>
        {
            if (!a) { return; }
            if (lineCls !== "this")
            {
                for (const p of a)
                {
                    if (p.name === lineCls) {
                        const lCmp = extjsLangMgr.getComponentInstance(lineCls, project, position, fsPath, logPad + "   ", logLevel + 1);
                        if (isComponent(lCmp)) {
                            components.push(lCmp);
                        }
                        break;
                    }
                }
            }
            else {
                const lCmp = extjsLangMgr.getComponentInstance(lineCls, project, position, fsPath, logPad + "   ", logLevel + 1);
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


    private getMethodCmp(property: string, cmpClass: string, project: string, isStatic: boolean, logPad: string, logLevel: number): IMethod | IConfig | undefined
    {
        log.methodStart("get method component", logLevel, logPad);

        let cmp: IMethod | IConfig | undefined = extjsLangMgr.getMethod(cmpClass, property, project, isStatic, logPad + "   ", logLevel + 1);
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
                cmp = extjsLangMgr.getConfig(cmpClass, gsProperty, project, logPad + "   ", logLevel + 1) ||
                      extjsLangMgr.getConfig(cmpClass, property, project, logPad + "   ", logLevel + 1);
            }
        }

        log.methodDone("get method component", logLevel, logPad);
        return cmp;
    }


    private getPropertyCmp(property: string, cmpClass: string, project: string, isStatic: boolean, logPad: string, logLevel: number): IProperty | IConfig | undefined
    {
        log.methodStart("get property component", logLevel, logPad);
        const cmp = extjsLangMgr.getConfig(cmpClass, property, project, logPad + "   ", logLevel + 1) ||
                    extjsLangMgr.getProperty(cmpClass, property, project, isStatic, logPad + "   ", logLevel + 1);
        log.methodDone("get property component", logLevel, logPad);
        return cmp;
    }


    private async getObjectRangeCompletionItems(property: string | undefined, text: string, lineText: string,  document: TextDocument, position: Position, thisCmp: IComponent, logPad: string, logLevel: number, addFn: (arg: IComponent) => void)
    {
        log.methodStart("get object range completion Items", logLevel, logPad);

        const completionItems: CompletionItem[] = [],
              addedItems: string[] = [],
              project = getWorkspaceProjectName(document.uri.fsPath);

        //
        // Check if we aren't within a parsed `objectRange`, if we are not, then this is the
        // main Ext.define object.
        //
        if (!isPositionInObjectRange(position, thisCmp))
        {   //
            // Add properties and configs from the extended class.
            //
            let cmp2 = extjsLangMgr.getComponent(thisCmp.componentClass, project, logPad + "   ", logLevel + 1, toIPosition(position));
            if (cmp2 && cmp2.extend)
            {
                cmp2 = extjsLangMgr.getComponent(cmp2.extend, project, logPad + "   ", logLevel + 1, toIPosition(position));
                if (cmp2) {
                    if (!property) {
                        addFn(cmp2);
                    }
                    else {
                        completionItems.push(...this.getPropertyValueItems(property, position, cmp2, document, logPad + "   ", logLevel + 1));
                    }
                }
            }
        }
        //
        // Attempt to determine if an object defines an `xtype` and if it does, add it's
        // properties and configs to the completion list.
        //
        // Note that if it was determined that an object was a parameter to a call expression
        // i.e. x.y.z.create or Ext.create("x.y.x", ...) then this method will not have been
        // called for that object.
        //
        else //
        {   //
            let hasXtype: { name: string | undefined; type: string | undefined } | undefined;
            // Check to see if there's already an xtype definition within the object block
            //
            const objectRange = getObjectRangeByPosition(position, thisCmp);
            if (objectRange)
            {   //
                // We'll be using the AST parser here, so remove the current line from the text that
                // will be sent to the parser, since it'll probably be invalid syntax during an edit.
                // Remove the current line and store the result in objectRangeText` for AST parsing.
                //
                // if (objectRange.type === "MethodParameterVariable") {
                //     return completionItems;
                // }
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
                objectRangeText = objectRangeText.replace(objectRangeTextCut, "").trim();
                //
                // Only show xtype completion if an (x)type is not already defined within the current object
                // block... before or after the current line otherwise this would have been a little easier,
                // so we'll use the ast parser here
                //
                hasXtype = await this.getObjectXType(objectRangeText, objectRange, position);
            }

            if (hasXtype && hasXtype.name)
            {   //
                // Add the objects `xtype` properties and configs
                //
                const cmpType = hasXtype.type === "type" ? ComponentType.Store :  ComponentType.Widget,
                      cls = extjsLangMgr.getClsByProperty(hasXtype.name, getWorkspaceProjectName(document.uri.fsPath), cmpType),
                      xComponent = cls ? extjsLangMgr.getComponent(cls, project, logPad + "   ", logLevel + 1, toIPosition(position)) : undefined;
                if (xComponent) {
                    if (!property) {
                        addFn(xComponent);
                    }
                    else {
                        completionItems.push(...this.getPropertyValueItems(property, position, xComponent, document, logPad + "   ", logLevel + 1));
                    }
                }
            }
            else
            {   //
                //  An `xtype` is not defined on this object, add the complete `xtype` list
                //
                const xtypes = [];
                if (property !== "type" && (!text || !/\btype/.test(lineText))) { xtypes.push(...extjsLangMgr.getXtypeNames()); }
                if (property !== "xtype" && (!text || !/\bxtype/.test(lineText))) { xtypes.push(...extjsLangMgr.getStoreTypeNames()); }
                xtypes.filter(x => !addedItems.includes(x)).forEach((xtype) =>
                {
                    const xtypeCompletion = this.getXTypeCompletionItem(xtype, position, document, xtype.includes("store.") ? "type" : "xtype");
                    completionItems.push(xtypeCompletion);
                    addedItems.push(xtype);
                });
            }
        }

        log.methodDone("get object range completion Items", logLevel, logPad);
        return completionItems;
    }


    private async getObjectXType(objectRangeText: string, objectRange: IObjectRange, position: Position)
    {
        let xtype: { name: string | undefined; type: string | undefined } | undefined;

        if (objectRange.type === "ObjectExpression") {
            objectRangeText = "a: [" + objectRangeText + "]";
        }
        else if (objectRange.type === "ObjectProperty") {
            objectRangeText = "a: [" + objectRangeText.substring(objectRangeText.indexOf("{"), objectRangeText.lastIndexOf("}") + 1) + "]";
        }

        //
        // Use AST parser to determine if there's a defined `xtype` within the object, either
        // before or after the current position.
        //
        const astNode = ast.getLabeledStatementAst(objectRangeText, log.error).program.body[0];
        if (isLabeledStatement(astNode) && isExpressionStatement(astNode.body) && isArrayExpression(astNode.body.expression))
        {
            for (const e of astNode.body.expression.elements)
            {
                if (isObjectExpression(e) && e.loc)
                {
                    const relativePosition = new Position(position.line - objectRange.start.line, position.character);
                    if (toVscodeRange(e.loc.start, { line: e.loc.end.line, column: 10000 }).contains(relativePosition))
                    {
                        for (const p of e.properties)
                        {
                            if (isObjectProperty(p) && isIdentifier(p.key) &&
                                (p.key.name === "type" || p.key.name === "xtype" || p.key.name === "extend") &&
                                isStringLiteral(p.value))
                            {
                                xtype = {
                                    name: p.value.value,
                                    type: p.key.name
                                };
                            }
                        }
                    }
                }
            }
        }

        return xtype;
    }


    private getPropertyValueItems(property: string, position: Position, component: IComponent, document: TextDocument, logPad = "   ", logLevel = 2)
    {
        let tCmp: IComponent | undefined = component;
        const completionItems: CompletionItem[] = [],
              project = getWorkspaceProjectName(document.uri.fsPath);

        const _get = (c: IComponent) => {
            return extjsLangMgr.getConfig(c.componentClass, property, project, logPad + "   ", logLevel + 1) ||
                   extjsLangMgr.getProperty(c.componentClass, property, project, false, logPad + "   ", logLevel + 1);
        };

        //
        // Traverse up the inheritance tree, checking the 'extend' property and if
        // it exists, we include public class properties in the Intellisense
        //
        let propertyDef = _get(tCmp);
        if (!propertyDef && tCmp.mixins?.value)
        {
            for (const mixin of tCmp.mixins?.value)
            {
                const mixinCmp = extjsLangMgr.getComponent(mixin.name, project, logPad + "   ", logLevel + 1, toIPosition(position));
                if (mixinCmp) {
                    propertyDef = _get(mixinCmp);
                    if (propertyDef) {
                        break;
                    }
                }
            }
            while (!propertyDef && tCmp.extend && (tCmp = extjsLangMgr.getComponent(tCmp.extend, project, logPad + "   ", logLevel + 1, toIPosition(position))))
            {
                propertyDef = _get(tCmp);
            }
            if (!propertyDef)
            {
                tCmp = component;
                while (!propertyDef && tCmp.types.length && (tCmp = extjsLangMgr.getComponent(tCmp.types[0].name, project, logPad + "   ", logLevel + 1, toIPosition(position))))
                {
                    propertyDef = _get(tCmp);
                }
            }
        }

        if (propertyDef && propertyDef.doc)
        {
            let valueCompletionItem: CompletionItem | undefined;
            const useXTypeEol = configuration.get<boolean>("intellisenseXtypeEol", true),
                  eol = documentEol(document),
                  propertyType = getTypeFromDoc(property, propertyDef.doc, "property") || getTypeFromDoc(property, propertyDef.doc, "cfg");
            switch (propertyType) {
                case "Object":
                    valueCompletionItem = new CompletionItem("Object Value", CompletionItemKind.Value);
                    valueCompletionItem.insertText = " " + "{}";
                    completionItems.push(valueCompletionItem);
                    break;
                case "String":
                    valueCompletionItem = new CompletionItem("String Value", CompletionItemKind.Value);
                    valueCompletionItem.insertText = " " + "\"\"";
                    completionItems.push(valueCompletionItem);
                    break;
                case "Boolean":
                    valueCompletionItem = new CompletionItem("false", CompletionItemKind.Value);
                    valueCompletionItem.insertText = ` false${useXTypeEol ? "," + eol : ""}`;
                    completionItems.push(valueCompletionItem);
                    valueCompletionItem = new CompletionItem("true", CompletionItemKind.Value);
                    valueCompletionItem.insertText = ` true${useXTypeEol ? "," + eol : ""}`;
                    completionItems.push(valueCompletionItem);
                    break;
                default:
                    //
                    // TODO - display class values if the type is a class type
                    // e.g. 'Ext.create('VSCodeExtJS.common.PhysicianDropdown', {});'
                    //
                    break;
            }
        }

        return completionItems;
    }


    private getXTypeCompletionItem(xtype: string, position: Position, document: TextDocument, type = "xtype")
    {
        xtype = xtype.replace("store.", "").replace("model.", "");

        const xtypeCompletion = new CompletionItem(`${type}: ${xtype}`),
                lineText = document.lineAt(position).text.trimRight(),
                useXTypeEol = configuration.get<boolean>("intellisenseXtypeEol", true),
                eol = documentEol(document),
                quote = quoteChar();

        xtypeCompletion.insertText = `${type}: ${quote}${xtype}${quote},${useXTypeEol ? eol : ""}`;
        xtypeCompletion.command = {command: "vscode-extjs:ensureRequire", title: "ensureRequire", arguments: [ type ]};
        xtypeCompletion.preselect = true;
        //
        // If user has already typed in `xtype[: '""]` then do an additional edit and remove
        // what would be a double xtype considering the insertText.
        //
        if (lineText.includes(type))
        {
            const xTypeIdx = lineText.indexOf(type),
                  quoteIdx = lineText.indexOf(quote, xTypeIdx), // dealing with surrounding quotes
                  preRange =  new Range(new Position(position.line, xTypeIdx),
                                        new Position(position.line, xTypeIdx + 6 + (quoteIdx !== -1 ? 2 : 0)));
            xtypeCompletion.additionalTextEdits = [ TextEdit.replace(preRange, "") ];
            //
            // Deal with surrounding quotes - the last quotes we need to actually back up one
            // character into the actual edit space, otherwise no edit takes place
            //
            if (quoteIdx !== -1) {
                const quoteIdx2 = lineText.lastIndexOf(quote),
                      leftPad = lineText.length - lineText.trimLeft().length,
                      preRange2 =  new Range(new Position(position.line, quoteIdx2 + (leftPad ? leftPad - 1 : 0)),
                                             new Position(position.line, quoteIdx2 + leftPad + 10));
                xtypeCompletion.additionalTextEdits.push(TextEdit.replace(preRange2, leftPad ? lineText[0] : ""));
            }
        }
        return xtypeCompletion;
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


    private tagText(cmp: IComponent | IMethod | IProperty | IConfig, property: string, extendedCls?: string)
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
        if (extjs.isConfig(cmp))
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
        if (cmp.deprecated)
        {
            tagText += "(deprecated) ";
        }

        //
        // Show/hide private properties according to user settings (default false)
        // If this property is hidden by user preference, this method exited already above.
        //
        if (cmp.private)
        {
            tagText += "(private) ";
        }

        //
        // Show/hide private properties according to user settings (default false)
        // If this property is hidden by user preference, this method exited already above.
        //
        if ((extjs.isProperty(cmp) || extjs.isMethod(cmp)) && cmp.static)
        {
            tagText += "(static) ";
        }

        //
        // Show  `since` properties if not deprecated
        //
        if (cmp.since && !cmp.deprecated)
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
        "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "_", ".", ":", quoteChar()
    ];
    context.subscriptions.push(
        languages.registerCompletionItemProvider("javascript", new ExtJsCompletionItemProvider(), ...triggerChars)
    );
}


export default registerCompletionProvider;
