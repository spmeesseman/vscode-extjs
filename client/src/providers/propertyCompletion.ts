
import {
    CompletionItem, CompletionItemProvider, ExtensionContext, languages, Position,
    TextDocument, CompletionItemKind
} from "vscode";
import {
    methodToComponentClassMapping, configToComponentClassMapping, propertyToComponentClassMapping,
    getComponent, getConfig, getMethod, getProperty, componentClassToComponentsMapping
} from "../languageManager";
import * as log from "../common/log";
import { IComponent, IConfig, IMethod, IProperty, utils } from "../../../common";


class PropertyCompletionItemProvider
{

    createCompletionItem(property: string, cmpClass: string, kind: CompletionItemKind): CompletionItem
    {
        const propCompletion = new CompletionItem(property, kind);

        let cmp: IComponent | IMethod | IProperty | IConfig | undefined;
        switch (kind)
        {
            case CompletionItemKind.Method:
                cmp = this.getMethodCmp(property, cmpClass);
                break;
            case CompletionItemKind.Property:
                cmp = this.getPropertyCmp(property, cmpClass);
                break;
            case CompletionItemKind.Class:
                cmp = getComponent(cmpClass);
                break;
            default:
                break;
        }

        propCompletion.documentation = cmp?.markdown;
        return propCompletion;
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

        log.logBlank(1);
        log.log("provide inline completion items", 1);

        if (!lineText) {
            log.log("   invalid input parameters, exit", 1);
            return undefined;
        }

        log.logValue("   line text", lineText, 3);
        completionItems.push(...this.getCompletionItems(addedItems));

        return completionItems.length > 0 ? completionItems : undefined;
    }


    getCompletionItems(addedItems: string[]): CompletionItem[]
    {
        const map = componentClassToComponentsMapping;
        const completionItems: CompletionItem[] = [];

        Object.keys(map).forEach((cls) =>
        {
            if (cls)
            {
                const cCls = cls.split(".")[0];
                if (addedItems.indexOf(cCls) === -1)
                {
                    completionItems.push(this.createCompletionItem(cCls, cls, CompletionItemKind.Class));
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

        log.logBlank(1);
        log.log("provide dot completion items", 1);

        if (!lineText) {
            log.log("   invalid input parameters, exit", 1);
            return undefined;
        }

        completionItems.push(...this.getCompletionItems(lineText, addedItems));

        log.logValue("   line text", lineText, 3);
        log.logValue("   # of added items", completionItems.length, 3);

        return completionItems.length > 0 ? completionItems : undefined;
    }


    private getCompletionItems(lineText: string, addedItems: string[]): CompletionItem[]
    {
        const map = componentClassToComponentsMapping;
        const completionItems: CompletionItem[] = [],
              lineCls = lineText?.substring(0, lineText.length - 1).trim();

        if (!lineText.endsWith(".")) {
            return completionItems;
        }

        log.logValue("   line cls", lineCls, 3);

        Object.keys(map).forEach((cls) =>
        {
            if (cls)
            {
                if (cls === lineCls)
                {
                    log.log("   methods", 1);
                    completionItems.push(...this.getCmpCompletionItems(lineCls, methodToComponentClassMapping, CompletionItemKind.Method, addedItems));

                    log.log("   properties", 1);
                    completionItems.push(...this.getCmpCompletionItems(lineCls, propertyToComponentClassMapping, CompletionItemKind.Property, addedItems));

                    log.log("   configs", 1);
                    completionItems.push(...this.getCmpCompletionItems(lineCls, configToComponentClassMapping, CompletionItemKind.Property, addedItems));
                }
                else {
                    completionItems.push(...this.getClsCompletionItems(lineText, cls, addedItems));
                }
            }
        });

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
                completionItems.push(this.createCompletionItem(lastProp, cls, CompletionItemKind.Class));
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
                    completionItems.push(this.createCompletionItem(p, cls, kind));
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
    context.subscriptions.push(
        languages.registerCompletionItemProvider("javascript", new InlineCompletionItemProvider()),
        languages.registerCompletionItemProvider("javascript", new DotCompletionItemProvider(), ".")
    );
}


export default registerPropertyCompletionProvider;
