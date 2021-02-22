
import {
    CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position,
    TextDocument, CompletionItemKind
} from "vscode";
import {
    methodToComponentClassMapping, configToComponentClassMapping, propertyToComponentClassMapping, getComponentInstance,
    getComponent, getConfig, getMethod, getProperty, componentClassToComponentsMapping, getClassFromFile, getComponentByAlias, getComponentClass
} from "../languageManager";
import * as log from "../common/log";
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
                cmp = getComponent(cmpClass) || getComponentByAlias(cmpClass);
                break;
            default:
                break;
        }

        if (cmp?.private)
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
                propCompletion[0].label = property + " (deprecated)";
            }

            if (cmp?.since)
            {
                propCompletion[0].insertText = property;
                propCompletion[0].label = property + ` (since ${cmp.since})`;
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

        log.logMethodStart("provide inline completion items", 2, "", true, [["line text", lineText]]);

        completionItems.push(...this.getCompletionItems(addedItems));

        log.logValue("   # of added items", completionItems.length, 3);
        log.logMethodDone("provide inline completion items", 2, "", true);

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

                    log.logBlank(1);
                    log.log("      added inline completion item", 3);
                    log.logValue("         item", cCls, 3);
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

        log.logMethodStart("provide dot completion items", 2, "", true, [["line text", lineText]]);

        completionItems.push(...this.getCompletionItems(lineText, document.uri.fsPath, addedItems));

        log.logValue("   # of added items", completionItems.length, 3);
        log.logMethodDone("provide dot completion items", 2, "", true);

        return completionItems.length > 0 ? completionItems : undefined;
    }


    private getCompletionItems(lineText: string, fsPath: string, addedItems: string[]): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [],
              lineCls = lineText?.substring(0, lineText.length - 1).trim();

        const _pushItems = ((cmp?: IComponent) =>
        {
            if (!cmp) { return; }
            log.log("   methods", 1);
            completionItems.push(...this.getCmpCompletionItems(cmp.componentClass, methodToComponentClassMapping, CompletionItemKind.Method, addedItems));
            log.log("   properties", 1);
            completionItems.push(...this.getCmpCompletionItems(cmp.componentClass, propertyToComponentClassMapping, CompletionItemKind.Property, addedItems));
            log.log("   configs", 1);
            completionItems.push(...this.getCmpCompletionItems(cmp.componentClass, configToComponentClassMapping, CompletionItemKind.Property, addedItems));
            //
            // TODO - property completion - static and private sctions
            //
        });

        log.logValue("   line cls", lineCls, 3);

        //
        // Handle "this"
        //
        if (lineText === "this.")
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
        let component = getComponent(lineCls, true, fsPath);
        if (component)
        {
            _pushItems(component);
            //
            // Traverse up the inheritance tree, checking the 'extend' property and if
            // it exists, we include public class properties in the Intellisense
            //
            while (component && component.extend)
            {
                component = getComponent(component.extend);
                if (component) {
                    _pushItems(component);
                }
            }
        }
        else {
            completionItems.push(...this.getClsCompletionItems(lineText, lineCls, addedItems));
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
                log.logBlank(1);
                log.log("      added dot completion class item", 3);
                log.logValue("         item", cCls, 3);
            }
            break;
        }

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

                    log.logBlank(1);
                    log.log("      added dot completion item", 3);
                    log.logValue("         item", p, 3);
                    log.logValue("         kind", kind, 4);
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
