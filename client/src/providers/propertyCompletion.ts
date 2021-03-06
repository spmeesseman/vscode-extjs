
import {
    CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position,
    TextDocument, CompletionItemKind, window
} from "vscode";
import { extjsLangMgr } from "../extension";
import * as log from "../common/log";
import { isPositionInMethod, isPositionInObject } from "../common/clientUtils";
import { configuration } from "../common/configuration";
import { IComponent, IConfig, IExtJsBase, IMethod, IProperty, utils } from "../../../common";



class ExtJsCompletionItemProvider implements CompletionItemProvider
{

    provideCompletionItems(document: TextDocument, position: Position)
    {
        const addedItems: string[] = [],
              lineText = document.lineAt(position).text.substr(0, position.character),
              fnText = this.getFunctionName(document, position),
              completionItems: CompletionItem[] = [];
        //
        // Check for "." since VSCode 24/7 Intellisense will trigger every character no matter what
        // the trigger char(s) is for this provider.  24/7 Intellisense can be turned off in settings.json:
        //
        //    "editor.quickSuggestions": false
        //

        if (!lineText) {
            return undefined;
        }

        //
        // The `getInlineCompletionItems` method handles completion items that lead all other
        // parts of a classpath.  FOr example, the class:
        //
        //     MyApp.view.users.Users
        //
        // The `MyApp` part of the class path is of interest, when the user starts typing into a
        // blank line (or a new statement block), we want to display all possible parts of a
        // classpath that lead the classname, in this case we ant to add 'MyApp' as a completion item
        //
        if (!lineText.includes(".")) {
            completionItems.push(...this.getInlineCompletionItems(lineText, position));
            return completionItems;
        }

        log.methodStart("provide dot completion items", 2, "", true, [["line text", lineText]]);

        completionItems.push(...this.getCompletionItems(lineText, fnText, position, document.uri.fsPath, addedItems));

        // completionItems.push({
        //     label: "Ext.create",
        //     kind: CompletionItemKind.Keyword,
        //     insertText: `Ext.create(\"\",${EOL}{${EOL}${EOL}});`, // SnippetString('Good ${1|morning,afternoon,evening|}. It is ${1}, right?')
        //     // documentation: new MarkdownString("Inserts a snippet that lets you select the _appropriate_ part of the day for your greeting.")
        // });

        //
        // A completion item that retriggers IntelliSense when being accepted, the `command`-property is
        // set which the editor will execute after completion has been inserted. Also, the `insertText`
        // is set so that a space is inserted after `new`
        //
        // completionItems.push({
        //     label: "new",
        //     kind: CompletionItemKind.Keyword,
        //     insertText: "new ",
        //     command: { command: "editor.action.triggerSuggest", title: "Re-trigger completions..." }
        // });

        log.value("   # of added items", completionItems.length, 3);
        log.methodDone("provide dot completion items", 2, "", true);

        return completionItems.length > 0 ? completionItems : undefined;
    }


    createCompletionItem(property: string, cmpClass: string, kind: CompletionItemKind, position: Position): CompletionItem[]
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
                cmp = this.getMethodCmp(property, cmpClass);
                break;
            case CompletionItemKind.Property:
                cmp = this.getPropertyCmp(property, cmpClass);
                break;
            default: // class
                cmp = extjsLangMgr.getComponent(cmpClass, position, true);
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
        if (kind === CompletionItemKind.Method || kind === CompletionItemKind.Function)
        {
            completionItem.commitCharacters = [ "(" ];
        }
        else {
            completionItem.commitCharacters = [ "." ];
        }

        //
        // Show/hide deprecated properties according to user settings (default true).
        // If this property is hidden by user preference, this methid exited already above.
        //
        if (cmp?.deprecated)
        {
            completionItem.insertText = property;
            completionItem.label = completionItem.label + " (deprecated)";
        }

        //
        // Show/hide private properties according to user settings (default false)
        // If this property is hidden by user preference, this methid exited already above.
        //
        if (cmp?.private)
        {
            completionItem.insertText = property;
            completionItem.label = completionItem.label + " (private)";
        }

        //
        // Show  `since` properties if not deprecated
        //
        if (cmp?.since && !cmp?.deprecated)
        {
            completionItem.insertText = property;
            completionItem.label = completionItem.label + ` (since ${cmp.since})`;
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
            propCompletion[1].documentation = cmp?.markdown;
            propCompletion[2].documentation = cmp?.markdown;
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
     * @param fnText The outer function name of the funtion that contains the reference to this property,
     * if this property is found within a controller method.  Used for local property (relative to the
     * outer function) inspection only.
     * @param fsPath The filesystem path to the JavasSript class file.
     * @param addedItems Array holding item labels already added in this request.
     */
    private getCompletionItems(lineText: string, fnText: string | undefined, position: Position, fsPath: string, addedItems: string[]): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [],
              lineCls = lineText?.substring(0, lineText.lastIndexOf(".")).trim();

        const _pushItems = ((cmp?: IComponent) =>
        {
            if (!cmp) { return; }
            completionItems.push(...this.getCmpCompletionItems(cmp, position, addedItems));
            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            while (cmp && cmp.extend)
            {
                cmp = extjsLangMgr.getComponent(cmp.extend);
                if (cmp) {
                    _pushItems(cmp);
                }
            }
        });

        log.value("   line cls", lineCls, 3);

        //
        // Handle "this"
        //
        if (lineText.trim() === "this.")
        {
            const thisCls = extjsLangMgr.getClassFromFile(fsPath);
            if (thisCls) {
                _pushItems(extjsLangMgr.getComponent(thisCls, position, true, fsPath));
            }
            return completionItems;
        }

        //
        // Create the completion items, including items in extended classes
        //
        let component = extjsLangMgr.getComponent(lineCls, position, true);
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
            //     Any existing classpaths should display in the intellisense:
            //
            //         AppUtilities
            //         common
            //         etc...
            //
            completionItems.push(...this.getChildClsCompletionItems(component.componentClass, position, addedItems));
        }
        else {
            log.write("   try sub-component tree", 3);
            const subComponents = extjsLangMgr.getSubComponentNames(lineCls);
            if (subComponents.length > 0)
            {
                log.write("   found sub-components", 3);
                for (const sf of subComponents)
                {
                    if (!addedItems.includes(sf)) {
                        log.value("   add sub-component", sf, 4);
                        completionItems.push(...this.createCompletionItem(sf, lineCls + "." + sf, CompletionItemKind.Class, position));
                        addedItems.push(sf);
                    }
                }
            } //
             // For local instance vars, only provide completion from the right function
            //
            else {
                component = extjsLangMgr.getComponentByFile(fsPath);
                if (component && fnText)
                {
                    _pushItems(...this.getLocalInstanceComponents(fnText, lineCls, position, fsPath, component));
                }
                else {
                    completionItems.push(...this.getClsCompletionItems(lineText, lineCls, position, addedItems));
                }
            }
        }

        return completionItems;
    }


    private getClsCompletionItems(lineText: string, cls: string, position: Position, addedItems: string[]): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [],
              clsParts = cls.split(".");
        let cCls = "",
            rtnNextPart = false;

        for (const clsPart of clsParts)
        {
            if (cCls) {
                cCls += ".";
            }
            cCls += clsPart;

            if (!rtnNextPart)
            {
                if (!lineText.endsWith(cCls + ".")) {
                    continue;
                }
                else {
                    rtnNextPart = true;
                    continue;
                }
            }

            if (addedItems.indexOf(cCls) === -1)
            {
                const lastProp = cCls.indexOf(".") !== -1 ? cCls.substring(cCls.indexOf(".") + 1) : cCls;
                completionItems.push(...this.createCompletionItem(lastProp, cls, CompletionItemKind.Class, position));
                addedItems.push(cCls);
                log.blank(1);
                log.write("      added dot completion class item", 3);
                log.value("         item", cCls, 3);
            }
            break;
        }

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
     * @param addedItems Shared provider instance array to avooid duplicate references
     *
     * @returns {CompletionItem[]}
     */
    private getChildClsCompletionItems(componentClass: string, position: Position, addedItems: string[]): CompletionItem[]
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
                    completionItems.push(...this.createCompletionItem(cCls, cls, CompletionItemKind.Class, position));
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
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, CompletionItemKind.Method, position));
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
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, CompletionItemKind.Property, position));
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
                completionItems.push(...this.createCompletionItem(c.name, c.componentClass, CompletionItemKind.Property, position));
                addedItems.push(c.name);

                log.blank(1);
                log.write("      added dot completion method", 3);
                log.value("         name", c.name, 3);
            }
        });

        //
        // TODO - property completion - static and private sctions
        //

        return completionItems;
    }


    private getInlineCompletionItems(lineText: string, position: Position): CompletionItem[]
    {
        const addedItems: string[] = [],
              completionItems: CompletionItem[] = [],
              cmps = extjsLangMgr.getComponentNames(),
              aliases = extjsLangMgr.getAliasNames(),
              thisPath = window.activeTextEditor?.document?.uri.fsPath,
              thisCmp = thisPath ? extjsLangMgr.getComponentByFile(thisPath) : undefined;

        if (thisCmp && isPositionInMethod(position, thisCmp))
        {
            const _add = ((cls: string) =>
            {
                if (cls)
                {
                    const cCls = cls.split(".")[0];
                    if (addedItems.indexOf(cCls) === -1)
                    {
                        const cItems = this.createCompletionItem(cCls, cCls, CompletionItemKind.Class, position);
                        if (cItems.length > 0) {
                            completionItems.push(...cItems);
                            addedItems.push(cCls);
                        }
                        log.blank(3);
                        log.write("      added inline completion item", 3);
                        log.value("         item", cCls, 3);
                    }
                }
            });

            for (const c of cmps) { _add(c); }
            for (const a of aliases) { _add(a); }
        }

        return completionItems;
    }


    private getLocalInstanceComponents(fnText: string, lineCls: string, position: Position, fsPath: string, component: IComponent): IComponent[]
    {
        const components: IComponent[] = [];
        const _add = ((a: IExtJsBase[] | undefined) =>
        {
            if (!a) { return; }
            for (const p of a)
            {
                if (p.name === lineCls) {
                    const lCmp = extjsLangMgr.getComponentInstance(lineCls, position, fsPath);
                    if (lCmp){
                        components.push(lCmp);
                    }
                    break;
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


    private getMethodCmp(property: string, cmpClass: string): IMethod | IConfig | undefined
    {
        let cmp: IMethod | IConfig | undefined = extjsLangMgr.getMethod(cmpClass, property);
        if (!cmp)
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
            if (utils.isGetterSetter(property))
            {   //
                // Extract the property name from the getter/setter.  Note the actual config
                // property will be a lower-case-first-leter version of the extracted property
                //
                const gsProperty = utils.lowerCaseFirstChar(property.substring(3));
                cmp = extjsLangMgr.getConfig(cmpClass, gsProperty);
                if (!cmp) {
                    cmp = extjsLangMgr.getConfig(cmpClass, property);
                }
            }
        }
        return cmp;
    }


    private getPropertyCmp(property: string, cmpClass: string): IProperty | IConfig | undefined
    {
        let cmp: IProperty | IConfig | undefined = extjsLangMgr.getConfig(cmpClass, property);
        if (!cmp) {
            cmp = extjsLangMgr.getProperty(cmpClass, property);
        }
        return cmp;
    }

}


function registerPropertyCompletionProvider(context: ExtensionContext)
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


export default registerPropertyCompletionProvider;
