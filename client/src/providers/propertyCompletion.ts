
import {
    CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position,
    TextDocument, CompletionItemKind
} from "vscode";
import {
    methodToComponentClassMapping, configToComponentClassMapping, propertyToComponentClassMapping, getComponentInstance, getComponentByFile,
    getComponent, getConfig, getMethod, getProperty, componentClassToComponentsMapping, getClassFromFile, getComponentByAlias
} from "../languageManager";
import * as log from "../common/log";
import { configuration } from "../common/configuration";
import { IComponent, IConfig, IMethod, IProperty, utils } from "../../../common";


class PropertyCompletionItemProvider
{

    createCompletionItem(property: string, cmpClass: string, kind: CompletionItemKind): CompletionItem[]
    {
        let markdown: string | undefined;
        const propCompletion: CompletionItem[] = [];

        let cmp: IComponent | IMethod | IProperty | IConfig | undefined;
        switch (kind)
        {
            case CompletionItemKind.Function:
            case CompletionItemKind.Method:
                cmp = this.getMethodCmp(property, cmpClass);
                break;
            case CompletionItemKind.Property:
                cmp = this.getPropertyCmp(property, cmpClass);
                break;
            case CompletionItemKind.Class:
                cmp = getComponent(cmpClass, true);
                break;
            default:
                break;
        }

        if (cmp?.private && configuration.get<boolean>("intellisenseIncludePrivate") !== true)
        {
            return propCompletion;
        }

        if (cmp?.deprecated && configuration.get<boolean>("intellisenseIncludeDeprecated") !== true)
        {
            return propCompletion;
        }

        propCompletion.push(new CompletionItem(property, kind));

        //
        // FunctionProvider will call with property empty
        //
        if (cmp && "params" in cmp && kind === CompletionItemKind.Function) // function params
        {
            propCompletion[0].kind = CompletionItemKind.Property;
            propCompletion[0].label = "";
            if (cmp.params)
            {
                for (const p of cmp.params)
                {
                    if (p.doc) {
                        markdown = p.doc;
                    }
                }
            }
            if (!markdown) {
                cmp = undefined;
            }
        }
        else
        {
            markdown = cmp?.markdown;

            if (cmp?.deprecated)
            {
                propCompletion[0].insertText = property;
                propCompletion[0].label = propCompletion[0].label + " (deprecated)";
            }

            if (cmp?.private)
            {
                propCompletion[0].insertText = property;
                propCompletion[0].label = propCompletion[0].label + " (private)";
            }

            if (cmp?.since && !cmp?.deprecated)
            {
                propCompletion[0].insertText = property;
                propCompletion[0].label = propCompletion[0].label + ` (since ${cmp.since})`;
            }
        }

        propCompletion[0].documentation = markdown;

        //
        // If this is a config property (i.e. IConfig), then add getter/setter
        //
        if (cmp && "getter" in cmp)
        {
            propCompletion.push(new CompletionItem(cmp.getter, CompletionItemKind.Method));
            propCompletion.push(new CompletionItem(cmp.setter, CompletionItemKind.Method));
            propCompletion[1].documentation = cmp?.markdown;
            propCompletion[2].documentation = cmp?.markdown;
        }

        return cmp ? propCompletion : [];
    }


    private getMethodCmp(property: string, cmpClass: string): IMethod | IConfig | undefined
    {
        let cmp: IMethod | IConfig | undefined = getMethod(cmpClass, property);
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
                cmp = getConfig(cmpClass, gsProperty);
                if (!cmp) {
                    cmp = getConfig(cmpClass, property);
                }
            }
        }
        return cmp;
    }


    private getPropertyCmp(property: string, cmpClass: string): IProperty | IConfig | undefined
    {
        let cmp: IProperty | IConfig | undefined = getConfig(cmpClass, property);
        if (!cmp) {
            cmp = getProperty(cmpClass, property);
        }
        return cmp;
    }

}


class InlineCompletionItemProvider extends PropertyCompletionItemProvider implements CompletionItemProvider
{

    provideCompletionItems(document: TextDocument, position: Position)
    {
        const addedItems: string[] = [],
            lineText = document.lineAt(position).text.substr(0, position.character),
            completionItems: CompletionItem[] = [];

        log.methodStart("provide inline completion items", 2, "", true, [["line text", lineText]]);

        completionItems.push(...this.getCompletionItems(addedItems));

        log.value("   # of added items", completionItems.length, 3);
        log.methodDone("provide inline completion items", 2, "", true);

        return completionItems.length > 0 ? completionItems : undefined;
    }


    getCompletionItems(addedItems: string[]): CompletionItem[]
    {
        const map = componentClassToComponentsMapping,
              completionItems: CompletionItem[] = [];

        Object.keys(map).forEach((cls) =>
        {
            if (cls)
            {
                const cCls = cls.split(".")[0];
                if (addedItems.indexOf(cCls) === -1)
                {
                    completionItems.push(...this.createCompletionItem(cCls, cls, CompletionItemKind.Class));
                    addedItems.push(cCls);

                    log.blank(3);
                    log.write("      added inline completion item", 3);
                    log.value("         item", cCls, 3);
                }
            }
        });

        return completionItems;
    }

}


class DotCompletionItemProvider extends PropertyCompletionItemProvider implements CompletionItemProvider
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
        if (!lineText || !lineText.endsWith(".")) {
            return undefined;
        }

        log.methodStart("provide dot completion items", 2, "", true, [["line text", lineText]]);

        completionItems.push(...this.getCompletionItems(lineText, fnText, document.uri.fsPath, addedItems));

        log.value("   # of added items", completionItems.length, 3);
        log.methodDone("provide dot completion items", 2, "", true);

        return completionItems.length > 0 ? completionItems : undefined;
    }


    /**
     * @method getFunctionName
     *
     * Get outer function name based on current document position.
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


    private getCompletionItems(lineText: string, fnText: string | undefined, fsPath: string, addedItems: string[]): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [],
              lineCls = lineText?.substring(0, lineText.length - 1).trim();

        const _pushItems = ((cmp?: IComponent) =>
        {
            if (!cmp) { return; }
            log.write("   methods", 1);
            completionItems.push(...this.getCmpCompletionItems(cmp.componentClass, methodToComponentClassMapping, CompletionItemKind.Method, addedItems));
            log.write("   properties", 1);
            completionItems.push(...this.getCmpCompletionItems(cmp.componentClass, propertyToComponentClassMapping, CompletionItemKind.Property, addedItems));
            log.write("   configs", 1);
            completionItems.push(...this.getCmpCompletionItems(cmp.componentClass, configToComponentClassMapping, CompletionItemKind.Property, addedItems));
            //
            // TODO - property completion - static and private sctions
            //
            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            while (cmp && cmp.extend)
            {
                cmp = getComponent(cmp.extend);
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
            const thisCls = getClassFromFile(fsPath);
            if (thisCls) {
                _pushItems(getComponent(thisCls, true, fsPath));
            }
            return completionItems;
        }

        //
        // Create the completion items, including items in extended classes
        //
        let component = getComponent(lineCls, true);
        if (component)
        {
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
            completionItems.push(...this.getChildClsCompletionItems(component.componentClass, addedItems));
        }
        else //
        {   // For local instance vars, only provide completion from the right function
            //
            component = getComponentByFile(fsPath);
            if (component)
            {
                let lCmp: any;
                for (const m of component.methods)
                {
                    if (m.name === fnText)
                    {
                        if (!m.variables) { continue; }
                        for (const p of m.variables)
                        {
                            if (p.name === lineCls) {
                                lCmp = getComponentInstance(lineCls, fsPath);
                                _pushItems(lCmp);
                                break;
                            }
                        }
                        if (lCmp) {
                            break;
                        }
                    }
                }
            }
            else {
                completionItems.push(...this.getClsCompletionItems(lineText, lineCls, addedItems));
            }
        }

        return completionItems;
    }


    private getClsCompletionItems(lineText: string, cls: string, addedItems: string[]): CompletionItem[]
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
                completionItems.push(...this.createCompletionItem(lastProp, cls, CompletionItemKind.Class));
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
    private getChildClsCompletionItems(componentClass: string, addedItems: string[]): CompletionItem[]
    {
        const map = componentClassToComponentsMapping,
              cmpClsParts = componentClass.split("."),
              completionItems: CompletionItem[] = [];

        Object.keys(map).forEach((cls) =>
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
                    completionItems.push(...this.createCompletionItem(cCls, cls, CompletionItemKind.Class));
                    addedItems.push(cCls);

                    log.blank(1);
                    log.write("      added inline completion item", 3);
                    log.value("         item", cCls, 3);
                }
            }
        });

        return completionItems;
    }


    private getCmpCompletionItems(lineCls: string, map: { [s: string]: string | undefined } | ArrayLike<string>, kind: CompletionItemKind, addedItems: string[]): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [];

        Object.entries(map).forEach(([p, cls]) =>
        {
            if (cls === lineCls)
            {
                if (addedItems.indexOf(p) === -1)
                {
                    completionItems.push(...this.createCompletionItem(p, cls, kind));
                    addedItems.push(p);

                    log.blank(1);
                    log.write("      added dot completion item", 3);
                    log.value("         item", p, 3);
                    log.value("         kind", kind, 4);
                }
            }
        });

        return completionItems;
    }

}


function registerPropertyCompletionProvider(context: ExtensionContext)
{
    const inlineTriggers = [
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
        "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
        "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "_"
    ];
    context.subscriptions.push(
        languages.registerCompletionItemProvider("javascript", new InlineCompletionItemProvider(), ...inlineTriggers),
        languages.registerCompletionItemProvider("javascript", new DotCompletionItemProvider(), ".")
    );
}


export default registerPropertyCompletionProvider;
