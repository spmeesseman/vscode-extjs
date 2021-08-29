
import * as log from "../common/log";
import { extjsLangMgr } from "../extension";
import { configuration } from "../common/configuration";
import {
    ComponentType, DeclarationType, IComponent, IConfig, IExtJsBase, IMethod, IProperty,
    utils, ast, IObjectRange, extjs
} from "../../../common";
import {
    CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position,
    TextDocument, CompletionItemKind, Range, TextEdit, commands, MarkdownString
} from "vscode";
import {
    getMethodByPosition, isPositionInObjectRange, isPositionInRange, toVscodeRange,
    getObjectRangeByPosition, documentEol, quoteChar, getWorkspaceProjectName, toIPosition,
} from "../common/clientUtils";
import {
    isIdentifier, isObjectExpression, isObjectProperty, isStringLiteral,  ObjectExpression, ArrayExpression
} from "@babel/types";
import { doc } from "../test/suite/helper";


interface ICompletionConfig
{
    addedItems: string[];
    document: TextDocument;
    includeDeprecated: boolean;
    includePrivate: boolean;
    lineTextLeft: string;
    project: string;
    position: Position;
    quoteChar: "'" | "\"";
    text: string;
    thisCmp: IComponent;
    xtypeEol: boolean;
}


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

        log.methodStart("provide completion items", 1, "", true);

        const thisCmp = extjsLangMgr.getComponentByFile(document.uri.fsPath, "   ", 2) as IComponent;
        if (!thisCmp) {
            return [];
        }

        if (!utils.isExtJsFile(document.getText()) || !isPositionInRange(position, toVscodeRange(thisCmp.bodyStart, thisCmp.bodyEnd))) {
            return [];
        }

        const range = document.getWordRangeAtPosition(position),
              text = range ? document.getText(range) : "",
              lineText = document.lineAt(position).text,
              lineTextLeft = lineText.substr(0, position.character).trimLeft(),
              config: ICompletionConfig = {
                includeDeprecated: configuration.get<boolean>("intellisenseIncludeDeprecated"),
                includePrivate: configuration.get<boolean>("intellisenseIncludePrivate"),
                xtypeEol: configuration.get<boolean>("intellisenseXtypeEol", true),
                quoteChar: quoteChar(),
                project: getWorkspaceProjectName(document.uri.fsPath),
                addedItems: [],
                position, document, text, lineTextLeft, thisCmp
              };

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
              inQuotes = quotesRegex.test(lineText);

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
            if (!lineTextLeft || !lineTextLeft.includes(".") ||
                // As 1st...nth function parameter
                (text && (new RegExp(`\\((?:|[\\w\\W]+,)\\s*${text}`)).test(lineTextLeft)) ||
                // Inline, start of line, or following : ; (
                (!text && /(?:\(|;|\\:|,)\s*(?:$|\))/.test(lineTextLeft)))
            {
                log.write("   do inline completion", 1);
                completionItems.push(...(await this.getInlineCompletionItems(config, "   ", 2)));
            }
            else {
                log.write("   do dot completion", 1);
                const outerMethod =  getMethodByPosition(position, thisCmp);
                completionItems.push(...this.getCompletionItems(outerMethod?.name, config, "   ", 2));
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


    createCompletionItem(property: string, cmpClassPart: string, config: ICompletionConfig, kind: CompletionItemKind, isStatic: boolean, isInlineChild: boolean, preSelect: boolean, extendedFrom: string | undefined, logPad: string, logLevel: number)
    {
        const propCompletion: CompletionItem[] = [];
        log.methodStart("create completion item", logLevel, logPad, false, [
            ["property", property], ["project", config.project], ["kind", kind.toString()],
            ["extended from", extendedFrom], ["position", config.position]
        ]);

        //
        // Get the appropriate component part, a method, property, config, or class, as specified
        // by the caller
        //
        let cmp: IComponent | IMethod | IProperty | IConfig | undefined;
        switch (kind)
        {
            case CompletionItemKind.Method:
                cmp = extjsLangMgr.getMethod(cmpClassPart, property, config.project, isStatic, logPad + "   ", logLevel + 1);
                break;
            case CompletionItemKind.Property: // or config
                cmp = this.getPropertyCmp(property, cmpClassPart, config.project, isStatic, logPad + "   ", logLevel + 1);
                break;
            default: // class
                cmp = extjsLangMgr.getComponent(cmpClassPart, config.project, logPad + "   ", logLevel + 1, toIPosition(config.position));
                break;
        }

        if (!cmp) {
            return propCompletion;
        }

        //
        // Hide private properties according to user settings (default true).
        //
        if (cmp.private && config.includePrivate !== true)
        {
            log.write("   private properties are configured to be ignored", logLevel, logPad);
            log.methodDone("create completion item", logLevel, logPad);
            return propCompletion;
        }

        //
        // Hide deprecated properties according to user settings (default true).
        //
        if (cmp.deprecated && config.includeDeprecated !== true)
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
        if (cmp.doc && cmp.doc.title) {
            completionItem.documentation = new MarkdownString().appendCodeblock(cmp.doc.title).appendMarkdown(cmp.doc.body);
        }

        //
        // If a text edit triggers a completion in the middle of the expression we need to
        // make sure to replace the existing right side part if the user selects from the
        // completion items.  Use `additionalTextEdits` on the completion item to accomplish.
        //
        const lineText = config.document.lineAt(config.position).text,
              lineTextLeftCurCharInclusive = lineText.substr(0, config.position.character + 1),
              lineTextRight = lineText.replace(lineTextLeftCurCharInclusive, ""),
              rTextMatch = lineTextRight.match(/([a-zA-Z_0-9]+)/);
        if (rTextMatch && rTextMatch[1])
        {
            const rRange = new Range(config.position, new Position(config.position.line, config.position.character + rTextMatch[1].length));
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
                if (cmp.doc && cmp.doc.body) {
                    getterItem.documentation = new MarkdownString().appendCodeblock(cmp.doc.title).appendMarkdown(cmp.doc.body);
                }
                getterItem.commitCharacters = [ "(" ];
                tagText = this.tagText(cmp, cmp.getter, extendedFrom);
                getterItem.insertText = cmp.getter;
                getterItem.label = this.getLabel(getterItem.label, tagText);
                propCompletion.push(getterItem);
            }
            if ("setter" in cmp)
            {
                const setterItem = new CompletionItem(cmp.setter, CompletionItemKind.Method);
                if (cmp.doc && cmp.doc.body) {
                    setterItem.documentation = new MarkdownString().appendCodeblock(cmp.doc.title).appendMarkdown(cmp.doc.body);
                }
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
    private getCompletionItems(fnText: string | undefined, config: ICompletionConfig, logPad: string, logLevel: number): CompletionItem[]
    {
        log.methodStart("get completion items", logLevel, logPad, true, [["text", config.text], ["line text left", config.lineTextLeft], ["fn text", fnText]]);

        const completionItems: CompletionItem[] = [],
              fsPath = config.document.uri.fsPath;

        const fullClsTextCmp = extjsLangMgr.getComponent(config.lineTextLeft, config.project, logPad + "   ", logLevel + 1);
        let lineCls = !fullClsTextCmp ? config.lineTextLeft?.substring(0, config.lineTextLeft.lastIndexOf(".")).trim() : config.lineTextLeft;

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
            if (!cmp) { return; }

            completionItems.push(...this.getCmpCompletionItems(cmp, instance, config, logPad + "   ", logLevel + 1));
            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            while (cmp)
            {
                if (cmp.mixins) {
                    for (const mixin of cmp.mixins.value) {
                        _pushItems(instance, extjsLangMgr.getComponent(mixin.name, config.project, "      ", logLevel + 1));
                    }
                }
                if (cmp.extend) {
                    cmp = extjsLangMgr.getComponent(cmp.extend, config.project, "      ", logLevel + 1);
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
        const component = extjsLangMgr.getComponent(lineCls, config.project, logPad + "   ", logLevel + 1);
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
                completionItems.push(...this.getChildClsCompletionItems(component, config, logPad + "   ", logLevel + 1));
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
                    if (!config.addedItems.includes(sf)) {
                        log.value("   add sub-component", sf, logLevel + 2, logPad);
                        completionItems.push(...this.createCompletionItem(sf, lineCls + "." + sf, config, CompletionItemKind.Class, false, false,
                                                                          false, undefined, logPad + "   ", logLevel + 2));
                        config.addedItems.push(sf);
                    }
                }
            } //
             // For local instance vars, only provide completion from the right function
            //
            else if (fnText)
            {
                log.write("   try instance-component tree", logLevel + 2, logPad);
                const instComponents = this.getLocalInstanceComponents(fnText, lineCls, config.position, fsPath, config.thisCmp, logPad + "   ", logLevel + 1);
                for (const ic of instComponents) {
                    _pushItems(true, ic);
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
    private getChildClsCompletionItems(component: IComponent, config: ICompletionConfig, logPad: string, logLevel: number): CompletionItem[]
    {
        const cmps = extjsLangMgr.getComponentNames(config.project),
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

            if (cCls && !config.addedItems.includes(cCls))
            {
                completionItems.push(...this.createCompletionItem(
                    cCls, cls, config, CompletionItemKind.Class, false, true, false, undefined, logPad + "   ", logLevel + 1
                ));
                config.addedItems.push(cCls);
                log.write("   added inline completion item", logLevel + 2, logPad);
                log.value("      item", cCls, logLevel + 2, logPad);
            }
        }

        log.methodDone("get child cls completion items", logLevel, logPad, false, [["# of added items", completionItems.length]]);
        return completionItems;
    }


    private getCmpCompletionItems(component: IComponent, instance: boolean, config: ICompletionConfig, logPad: string, logLevel: number): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [];
        log.methodStart("get cmp completion items", logLevel, logPad + 1, false, [["instance", instance], ["singleton", component.singleton]]);

        if (instance || component.singleton)
        {
            log.write(`   Processing ${component.singleton ? "singleton" : "instance"}`, logLevel + 1, logPad);

            component.methods.filter((m) => !config.addedItems.includes(m.name)).forEach((c: IMethod) =>
            {
                completionItems.push(...this.createCompletionItem(
                    c.name, c.componentClass, config, CompletionItemKind.Method, false, false, false, undefined, logPad + "   ", logLevel + 1
                ));
                config.addedItems.push(c.name);
                log.write("   added methods dot completion method", logLevel + 2, logPad);
                log.value("      name", c.name, logLevel + 2);
            });

            component.properties.filter((p) => !config.addedItems.includes(p.name)).forEach((c: IProperty) =>
            {
                completionItems.push(...this.createCompletionItem(
                    c.name, c.componentClass, config, CompletionItemKind.Property, false, false, false, undefined, logPad + "   ", logLevel + 1
                ));
                config.addedItems.push(c.name);
                log.write("   added properties dot completion method", logLevel + 2, logPad);
                log.value("      name", c.name, logLevel + 2, logPad);
            });

            if (!component.singleton)
            {
                component.configs.filter((c) => !config.addedItems.includes(c.name)).forEach((c: IConfig) =>
                {
                    completionItems.push(...this.createCompletionItem(
                        c.name, c.componentClass, config, CompletionItemKind.Property, false, false, false, undefined, logPad + "   ", logLevel + 1
                    ));
                    config.addedItems.push(c.name);
                    log.write("   added configs dot completion method", logLevel + 2);
                    log.value("      name", c.name, logLevel + 2, logPad);
                });

                component.privates.filter((c) => !config.addedItems.includes(c.name)).forEach((c: IProperty | IMethod) =>
                {
                    const kind = extjs.isProperty(c) ? CompletionItemKind.Property : CompletionItemKind.Method;
                    completionItems.push(...this.createCompletionItem(
                        c.name, c.componentClass, config, kind, false, false, false, undefined, logPad + "   ", logLevel + 1
                    ));
                    config.addedItems.push(c.name);
                    log.write("   added privates dot completion method", logLevel + 2);
                    log.value("      name", c.name, logLevel + 2, logPad);
                });
            }
        }
        else
        {
            log.write("   Processing statics", logLevel + 1, logPad);
            component.statics.filter((c) => !config.addedItems.includes(c.name)).forEach((c: IProperty | IMethod) =>
            {
                const kind = extjs.isProperty(c) ? CompletionItemKind.Property : CompletionItemKind.Method;
                completionItems.push(...this.createCompletionItem(
                    c.name, c.componentClass, config, kind, true, false, false, undefined, logPad + "   ", logLevel + 1
                ));
                config.addedItems.push(c.name);
                log.write("   added statics dot completion method", logLevel + 2);
                log.value("      name", c.name, logLevel + 2, logPad);
            });
        }

        log.methodDone("get child cls completion items", logLevel + 1, logPad, false, [["# of added items", completionItems.length]]);
        return completionItems;
    }


    private async getInlineCompletionItems(config: ICompletionConfig, logPad: string, logLevel: number)
    {
        log.methodStart("get inline completion items", logLevel, logPad);

        const completionItems: CompletionItem[] = [],
              cmps = extjsLangMgr.getComponentNames(config.project),
              aliases = extjsLangMgr.getAliasNames(config.project),
              isInObject = isPositionInObjectRange(config.position, config.thisCmp),
              method = getMethodByPosition(config.position, config.thisCmp),
              quote = quoteChar();

        //
        // A helper function to add items to the completion list that will be provided to VSCode
        //
        const _add = (cmp: IConfig | IProperty | undefined, cls: string, basic: boolean, kind: CompletionItemKind, extendedCls?: string) =>
        {
            const cCls = cls.split(".")[0];
            if (!config.addedItems.includes(cCls))
            {
                let cItems;
                //
                // 'basic' means just add the completion item w/o all the checks.  this is for cases of
                // configs, properties within an object.
                //
                if (!basic) {
                    cItems = this.createCompletionItem(cCls, cls, config, kind, false, false, true, extendedCls, logPad + "   ", logLevel + 1);
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
                            if (cmp && cmp.doc && cmp.doc.body) {
                                i.documentation = new MarkdownString().appendCodeblock(cmp.doc.title).appendMarkdown(cmp.doc.body);
                            }
                            if (kind === CompletionItemKind.Constant || kind === CompletionItemKind.Variable) {
                                i.commitCharacters = [ "." ];
                            }
                        });
                    }
                    completionItems.push(...cItems);
                    config.addedItems.push(cCls);
                }
                log.write("   added inline completion item", logLevel + 1, logPad);
                log.value("      item", cCls, logLevel + 1, logPad);
            }
        };

        //
        // A helper function for adding configs and properties of a class to the completion item list
        // that will be provided to VSCode.
        //
        const _addProps = (cmp: IComponent | undefined, extendedCls?: string) =>
        {
            if (!cmp) { return; }
            cmp.configs.forEach((c: IConfig) =>
            {
                _add(c, c.name, true, CompletionItemKind.Property, extendedCls);
            });
            cmp.properties.filter((p) => !this.ignoreProps.includes(p.name)).forEach((p) =>
            {
                _add(p, p.name, true, CompletionItemKind.Property, extendedCls);
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
                    const mixinCmp = extjsLangMgr.getComponent(mixin.name, config.project, logPad + "   ", logLevel + 1, toIPosition(config.position));
                    _addProps(mixinCmp, tCmp.componentClass);
                }
            }
            while (tCmp.extend && (tCmp = extjsLangMgr.getComponent(tCmp.extend, config.project, logPad + "   ", logLevel + 1, toIPosition(config.position))))
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
        if (config.lineTextLeft && new RegExp(`x?type\\s*:\\s*${quote}${quote}$`).test(config.lineTextLeft))
        {
            completionItems.push(...(await this.getObjectRangeCompletionItems(undefined, config, logPad + "   ", logLevel, _addProps)));
        }
        //
        // Depending on the current position, provide the completion items...
        //
        // Check whether we're inside a method of a component, and not within an object expression {}, or
        // if we're within an object expression.  Handline these 2 scenarios will be different obviously.
        //
        else if (method && !isInObject) // isInObject does not mean it's within the method/fn object
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
                    if (isPositionInRange(config.position, toVscodeRange(oRange.start, oRange.end)))
                    {
                        let added = false;
                        //
                        // Method variable parameter object expressions
                        //
                        method.variables.filter((v) => isPositionInRange(config.position, toVscodeRange(v.start, v.end))).forEach((v) =>
                        {
                            const cmp = extjsLangMgr.getComponent(v.componentClass, config.project, logPad + "   ", logLevel + 1);
                            _addProps(cmp);
                            added = !!cmp;
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
                                undefined, config, logPad + "   ", logLevel, _addProps
                            )));
                        }
                        break;
                    }
                }
            }
            else if (getObjectRangeByPosition(config.position, config.thisCmp))
            {   //
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
                const m = config.lineTextLeft.match(new RegExp(`^["']*([\\w_\\-]+)["']*\\s*\\:\\s*${config.text}$`, "i"));
                if (m)
                {
                    const [_, property ] = m;
                    log.write("   add inline property completion", 1);
                    completionItems.push(...(await this.getObjectRangeCompletionItems(
                        property, config, logPad + "   ", logLevel, _addProps
                    )));
                }
                else {
                    completionItems.push(...(await this.getObjectRangeCompletionItems(
                        undefined, config, logPad + "   ", logLevel, _addProps
                    )));
                }
            }
            else if (config.thisCmp.extend) // on main object
            {
                const cmp = extjsLangMgr.getComponent(config.thisCmp.extend, config.project, logPad + "   ", logLevel + 1);
                _addProps(cmp, config.thisCmp.extend);
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

        const _add = ((a: IExtJsBase[]) =>
        {
            if (lineCls !== "this")
            {
                for (const p of a)
                {
                    if (p.name === lineCls) {
                        const lCmp = extjsLangMgr.getComponentInstance(lineCls, project, position, fsPath, logPad + "   ", logLevel + 1) as IComponent;
                        components.push(lCmp);
                        break;
                    }
                }
            }
            else {
                const lCmp = extjsLangMgr.getComponentInstance(lineCls, project, position, fsPath, logPad + "   ", logLevel + 1) as IComponent;
                components.push(lCmp);
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


    private getPropertyCmp(property: string, cmpClass: string, project: string, isStatic: boolean, logPad: string, logLevel: number): IProperty | IConfig | undefined
    {
        log.methodStart("get property component", logLevel, logPad);
        const cmp = extjsLangMgr.getConfig(cmpClass, property, project, logPad + "   ", logLevel + 1) ||
                    extjsLangMgr.getProperty(cmpClass, property, project, isStatic, logPad + "   ", logLevel + 1);
        log.methodDone("get property component", logLevel, logPad);
        return cmp;
    }


    private async getObjectRangeCompletionItems(property: string | undefined, config: ICompletionConfig,  logPad: string, logLevel: number, addFn: (arg: IComponent) => void)
    {
        log.methodStart("get object range completion Items", logLevel, logPad);

        const completionItems: CompletionItem[] = [],
              project = getWorkspaceProjectName(config.document.uri.fsPath);

        //
        // Check if we aren't within a parsed `objectRange`, if we are not, then this is the
        // main Ext.define object.
        //
        // Coverage shows we account for the position already being within range before the
        // call to this method is made.  Keeping here commented for now in case there is some
        // kind of side effect.  If there wasn't so many changes through initial development,
        // removing this would be a concerned but I think since so much has changed it's possible
        // this isn't needed anymore.
        //
        // if (!isPositionInObjectRange(config.position, config.thisCmp))
        // {   //
        //     // Add properties and configs from the extended class.
        //     //
        //     let cmp2 = extjsLangMgr.getComponent(config.thisCmp.componentClass, project, logPad + "   ", logLevel + 1, toIPosition(config.position));
        //     if (cmp2 && cmp2.extend)
        //     {
        //         cmp2 = extjsLangMgr.getComponent(cmp2.extend, project, logPad + "   ", logLevel + 1, toIPosition(config.position));
        //         if (cmp2) {
        //             if (!property) {
        //                 addFn(cmp2);
        //             }
        //             else {
        //                 completionItems.push(...this.getPropertyValueItems(property, config, cmp2, logPad + "   ", logLevel + 1));
        //             }
        //         }
        //     }
        // }
        //
        // Attempt to determine if an object defines an `xtype` and if it does, add it's
        // properties and configs to the completion list.
        //
        // Note that if it was determined that an object was a parameter to a call expression
        // i.e. x.y.z.create or Ext.create("x.y.x", ...) then this method will not have been
        // called for that object.
        //
        // else //
        // {   //
            // let hasXtype: { name: string | undefined; type: string | undefined } | undefined;
            // Check to see if there's already an xtype definition within the object block
            //
            const objectRange = getObjectRangeByPosition(config.position, config.thisCmp) as IObjectRange;
            //
            // See comments above about coverage.  I think this is a redundant check too and we
            // can safely assume objectRange is not undefined
            // if (objectRange)
            // {   //
                // We'll be using the AST parser here, so remove the current line from the text that
                // will be sent to the parser, since it'll probably be invalid syntax during an edit.
                // Remove the current line and store the result in objectRangeText` for AST parsing.
                //
                // if (objectRange.type === "MethodParameterVariable") {
                //     return completionItems;
                // }
                const eol = documentEol(config.document),
                      vsRange = toVscodeRange(objectRange.start, objectRange.end),
                      innerPositionLine = config.position.line - vsRange.start.line;
                let idx = 0, tIdx = -1,
                    objectRangeText = config.document.getText(vsRange),
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
                const hasXtype = this.getObjectXType(objectRangeText, objectRange, config.position);
            // }

            if (hasXtype && hasXtype.name)
            {   //
                // Add the objects `xtype` properties and configs
                //
                const cmpType = hasXtype.type === "type" ? ComponentType.Store :  ComponentType.Widget,
                      cls = extjsLangMgr.getClsByProperty(hasXtype.name, getWorkspaceProjectName(config.document.uri.fsPath), cmpType),
                      xComponent = cls ? extjsLangMgr.getComponent(cls, project, logPad + "   ", logLevel + 1, toIPosition(config.position)) : undefined;
                if (xComponent) {
                    if (!property) {
                        addFn(xComponent);
                    }
                    else {
                        completionItems.push(...this.getPropertyValueItems(property, config, xComponent, logPad + "   ", logLevel + 1));
                    }
                }
            }
            else
            {   //
                //  An `xtype` is not defined on this object, add the complete `xtype` list
                //
                const xtypes = [];
                if (property !== "type" && (!config.text || !/\btype/.test(config.lineTextLeft))) { xtypes.push(...extjsLangMgr.getXtypeNames(config.project)); }
                if (property !== "xtype" && (!config.text || !/\bxtype/.test(config.lineTextLeft))) { xtypes.push(...extjsLangMgr.getStoreTypeNames(config.project)); }
                xtypes.filter(x => !config.addedItems.includes(x)).forEach((xtype) =>
                {
                    const xtypeCompletion = this.getXTypeCompletionItem(xtype, config, xtype.includes("store.") ? "type" : "xtype");
                    completionItems.push(xtypeCompletion);
                    config.addedItems.push(xtype);
                });
            }
        // }

        log.methodDone("get object range completion Items", logLevel, logPad);
        return completionItems;
    }


    private getObjectXType(objectRangeText: string, objectRange: IObjectRange, position: Position)
    {
        let xtype: { name: string | undefined; type: string | undefined } | undefined;

        if (objectRange.type === "ObjectExpression") {
            objectRangeText = "a: [" + objectRangeText + "]";
        }
        else { // if (objectRange.type === "ObjectProperty") {
            objectRangeText = "a: [" + objectRangeText.substring(objectRangeText.indexOf("{"), objectRangeText.lastIndexOf("}") + 1) + "]";
        }

        //
        // Use AST parser to determine if there's a defined `xtype` within the object, either
        // before or after the current position.
        //
        const arrExp = ast.getLabeledStatementAst(objectRangeText, log.error).program.body[0].body.expression as ArrayExpression;
        arrExp.elements.filter(e => isObjectExpression(e) && e.loc).forEach(e =>
        {
            const relativePosition = new Position(position.line - objectRange.start.line, position.character),
                  objExp = e as ObjectExpression;
            if (objExp && objExp.loc && objExp.properties && toVscodeRange(objExp.loc.start, { line: objExp.loc.end.line, column: 10000 }).contains(relativePosition))
            {
                for (const p of objExp.properties)
                {
                    if (isObjectProperty(p) && isIdentifier(p.key) && isStringLiteral(p.value) &&
                        (p.key.name === "type" || p.key.name === "xtype"))
                    {
                        xtype = {
                            name: p.value.value,
                            type: p.key.name
                        };
                    }
                }
            }
        });

        return xtype;
    }


    private getPropertyValueItems(property: string, config: ICompletionConfig, component: IComponent, logPad: string, logLevel: number)
    {
        let tCmp: IComponent | undefined = component;
        const completionItems: CompletionItem[] = [],
              project = getWorkspaceProjectName(config.document.uri.fsPath);

        const _get = (c: IComponent) => {
            return extjsLangMgr.getConfig(c.componentClass, property, project, logPad + "   ", logLevel + 1) ||
                   extjsLangMgr.getProperty(c.componentClass, property, project, false, logPad + "   ", logLevel + 1);
        };

        //
        // Traverse up the inheritance tree, checking the 'extend' property and if
        // it exists, we include public class properties in the Intellisense
        //
        let propertyDef = _get(tCmp);
        if (!propertyDef && tCmp.mixins && tCmp.mixins.value)
        {
            for (const mixin of tCmp.mixins.value)
            {
                const mixinCmp = extjsLangMgr.getComponent(mixin.name, project, logPad + "   ", logLevel + 1, toIPosition(config.position));
                if (mixinCmp) {
                    propertyDef = _get(mixinCmp);
                    if (propertyDef) {
                        break;
                    }
                }
            }
            while (!propertyDef && tCmp.extend && (tCmp = extjsLangMgr.getComponent(tCmp.extend, project, logPad + "   ", logLevel + 1, toIPosition(config.position))))
            {
                propertyDef = _get(tCmp);
            }
            if (!propertyDef)
            {
                tCmp = component;
                while (!propertyDef && tCmp.types.length && (tCmp = extjsLangMgr.getComponent(tCmp.types[0].name, project, logPad + "   ", logLevel + 1, toIPosition(config.position))))
                {
                    propertyDef = _get(tCmp);
                }
            }
        }

        if (propertyDef && propertyDef.doc)
        {
            let valueCompletionItem: CompletionItem | undefined;
            const eol = documentEol(config.document);
            switch (propertyDef.doc.type) {
                case "string":
                    valueCompletionItem = new CompletionItem("String Value", CompletionItemKind.Value);
                    valueCompletionItem.insertText = " " + "\"\"";
                    completionItems.push(valueCompletionItem);
                    break;
                case "boolean":
                    valueCompletionItem = new CompletionItem("false", CompletionItemKind.Value);
                    valueCompletionItem.insertText = ` false${config.xtypeEol ? "," + eol : ""}`;
                    completionItems.push(valueCompletionItem);
                    valueCompletionItem = new CompletionItem("true", CompletionItemKind.Value);
                    valueCompletionItem.insertText = ` true${config.xtypeEol ? "," + eol : ""}`;
                    completionItems.push(valueCompletionItem);
                    break;
                // case "Array":
                // case "string[]":
                //     valueCompletionItem = new CompletionItem("Object Value", CompletionItemKind.Value);
                //     valueCompletionItem.insertText = " " + "{}";
                //     completionItems.push(valueCompletionItem);
                //     break;
                // case "Object":
                //     valueCompletionItem = new CompletionItem("Object Value", CompletionItemKind.Value);
                //     valueCompletionItem.insertText = " " + "{}";
                //     completionItems.push(valueCompletionItem);
                //     break;
                default:
                //    valueCompletionItem = new CompletionItem("Array Value", CompletionItemKind.Value);
                //    valueCompletionItem.insertText = " " + "[]";
                //    completionItems.push(valueCompletionItem);
                //    valueCompletionItem = new CompletionItem("Object Value", CompletionItemKind.Value);
                //    valueCompletionItem.insertText = " " + "{}";
                //    completionItems.push(valueCompletionItem);
                    //
                    // TODO - display class values if the type is a class type
                    // e.g. 'Ext.create('VSCodeExtJS.common.PhysicianDropdown', {});'
                    //
                    break;
            }
        }

        return completionItems;
    }


    private getXTypeCompletionItem(xtype: string, config: ICompletionConfig, type: "xtype" | "type")
    {
        xtype = xtype.replace("store.", "").replace("model.", "");

        const xtypeCompletion = new CompletionItem(`${type}: ${xtype}`),
                lineText = config.document.lineAt(config.position).text.trimRight(),
                useXTypeEol = config.xtypeEol,
                eol = documentEol(config.document),
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
                  preRange =  new Range(new Position(config.position.line, xTypeIdx),
                                        new Position(config.position.line, xTypeIdx + 6 + (quoteIdx !== -1 ? 2 : 0)));
            xtypeCompletion.additionalTextEdits = [ TextEdit.replace(preRange, "") ];
            //
            // Deal with surrounding quotes - the last quotes we need to actually back up one
            // character into the actual edit space, otherwise no edit takes place
            //
            if (quoteIdx !== -1) {
                const quoteIdx2 = lineText.lastIndexOf(quote),
                      leftPad = lineText.length - lineText.trimLeft().length,
                      preRange2 =  new Range(new Position(config.position.line, quoteIdx2 + (leftPad ? leftPad - 1 : 0)),
                                             new Position(config.position.line, quoteIdx2 + leftPad + 10));
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
        return pad;
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
