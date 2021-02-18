
import {
    CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, CompletionList,
    ExtensionContext, languages, Position, ProviderResult, TextDocument, CompletionItemKind, Range
} from "vscode";
import {
    methodToComponentClassMapping, configToComponentClassMapping, propertyToComponentClassMapping,
    getComponentClass, getComponent, getConfig, getMethod, getProperty, componentClassToComponentsMapping
} from "../languageManager";
import * as util from "../common/utils";
import { IComponent, IConfig, IMethod, IProperty } from "../common/interface";


class PropertyCompletionItemProvider
{

    getCmpCompletionItems(text: string, lineText: string, map: { [s: string]: string | undefined } | ArrayLike<string>, kind: CompletionItemKind, addedItems: string[], tag: string): CompletionItem[]
    {
        const completionItems: CompletionItem[] = [];
        let base = lineText.replace(text, "");
        if (base && base[base.length - 1] === ".") {
            base = base.substring(0, base.length - 1);
        }

        util.logValue("   current text block", text, 2);
        util.logValue("   completion base", base, 2);
        util.logValue("   line text", lineText, 3);

        Object.entries(map).forEach(([p, cls]) =>
        {
            if (cls && (!base || cls.indexOf(base) === 0))
            {
                const fullPath = cls + "." + p,
                      cText = base ? fullPath.replace(base, "").substring(1) : p;
                let thisProp = cText.indexOf(".") !== -1 ? cText.substring(0, cText.indexOf(".")) : cText;
                const isEndProp = thisProp === p && (cText.indexOf(".") !== -1 || cls === base),
                      wasProp = thisProp;
                //
                // Example:
                //
                //     text = Ext.csi.s
                //     base = Ext.csi
                //     p    = s
                //     cls  = Ext.csi.store.Base
                //
                // Return the property name prefixed by 'base'
                //

                if (!isEndProp)
                {
                    if (base)
                    {
                        const cPart = cls.replace(base, ""),
                                nextDotIdx = cPart.indexOf(".", 1);
                        thisProp = cPart.substring(1, nextDotIdx !== -1 ? nextDotIdx : cPart.length);
                    }
                    else {
                        thisProp = cls.substring(0, cls.indexOf("."));
                    }
                }

                if (addedItems.indexOf(thisProp) === -1)
                {
                    const iKind = !isEndProp ? CompletionItemKind.Class : kind;
                    completionItems.push(this.createCompletionItem(thisProp, wasProp, cls, iKind, tag));
                    addedItems.push(thisProp);

                    util.logBlank(1);
                    util.log("      added inline completion item", 3);
                    util.logValue("         item", thisProp, 3);
                    util.logValue("         was item", wasProp, 3);
                    util.logValue("         kind", kind, 4);
                    util.logValue("         end prop", isEndProp, 4);
                    util.logValue("         full path", fullPath, 4);
                }
            }
        });

        return completionItems;
    }

    createCompletionItem(thisProp: string, wasProp: string, cmpClass: string, kind: CompletionItemKind, tag: string): CompletionItem
    {
        const propCompletion = new CompletionItem(thisProp, kind);

        let cmp: IComponent | IMethod | IProperty | IConfig | undefined;
        switch (kind)
        {
            case CompletionItemKind.Method:
                cmp = this.getMethodCmp(wasProp, cmpClass);
                break;
            case CompletionItemKind.Property:
                cmp = this.getPropertyCmp(wasProp, cmpClass);
                break;
            case CompletionItemKind.Class:
                cmp = getComponent(cmpClass);
                break;
            default:
                break;
        }
        // propCompletion.filterText = tag;
        propCompletion.documentation = cmp?.markdown;
        return propCompletion;
    }


    getMethodCmp(property: string, cmpClass: string): IMethod | IConfig | undefined
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
            if (util.isGetterSetter(property))
            {   //
                // Extract the property name from the getter/setter.  Note the actual config
                // property will be a lower-case-first-leter version of the extracted property
                //
                const gsProperty = util.lowerCaseFirstChar(property.substring(3));
                cmp = getConfig(cmpClass, gsProperty);
                if (!cmp) {
                    cmp = getConfig(cmpClass, property);
                }
            }
        }
        return cmp;
    }


    getPropertyCmp(property: string, cmpClass: string): IProperty | IConfig | undefined
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

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList>
    {
        const range = document.getWordRangeAtPosition(position);
        if (range === undefined) {
            return;
        }
        const addedItems: string[] = [],
              text = document.getText(range),
              lineText = document.lineAt(position).text.substr(0, position.character),
              completionItems: CompletionItem[] = [];

        util.logBlank(1);
        util.log("provide inline completion items", 1);

        if (!text || !lineText) {
            util.log("   invalid input parameters, exit", 1);
            return completionItems;
        }

        util.log("   methods", 1);
        completionItems.push(...this.getCmpCompletionItems(text, lineText, methodToComponentClassMapping, CompletionItemKind.Method, addedItems, "inline"));

        util.log("   properties", 1);
        completionItems.push(...this.getCmpCompletionItems(text, lineText, propertyToComponentClassMapping, CompletionItemKind.Property, addedItems, "inline"));

        util.log("   configs", 1);
        completionItems.push(...this.getCmpCompletionItems(text, lineText, configToComponentClassMapping, CompletionItemKind.Property, addedItems, "inline"));

        return completionItems.length > 0 ? completionItems : undefined;
    }

}


class DotCompletionItemProvider extends PropertyCompletionItemProvider implements CompletionItemProvider
{

    provideCompletionItems(document: TextDocument, position: Position)
    {
        const addedItems: string[] = [],
              lineText = document.lineAt(position).text.substr(0, position.character),
              completionItems: CompletionItem[] = [];

        util.logBlank(1);
        util.log("provide dot completion items", 1);

        if (!lineText) {
            util.log("   invalid input parameters, exit", 1);
            return undefined;
        }

        util.logValue("   line text", lineText, 3);
        completionItems.push(...this.getCompletionItems(lineText, addedItems));

        return completionItems.length > 0 ? completionItems : undefined;
    }


    getCompletionItems(lineText: string, addedItems: string[]): CompletionItem[]
    {
        const map = componentClassToComponentsMapping;
        const completionItems: CompletionItem[] = [],
              lineCls = lineText?.substring(0, lineText.length - 1).trim();

        if (!lineText.endsWith(".")) {
            return completionItems;
        }

        Object.keys(map).forEach((cls) =>
        {
            if (cls)
            {
                if (cls === lineCls)
                {
                    util.log("   methods", 1);
                    completionItems.push(...this.getCmpCompletionItems("", lineText, methodToComponentClassMapping, CompletionItemKind.Method, addedItems, "dot"));

                    util.log("   properties", 1);
                    completionItems.push(...this.getCmpCompletionItems("", lineText, propertyToComponentClassMapping, CompletionItemKind.Property, addedItems, "dot"));

                    util.log("   configs", 1);
                    completionItems.push(...this.getCmpCompletionItems("", lineText, configToComponentClassMapping, CompletionItemKind.Property, addedItems, "dot"));
                }
                else
                {
                    const clsParts = cls.split(".");
                    let cCls = "",
                        rtnNextPart = false;

                    for (const clsPart of clsParts)
                    {
                        if (cCls) {
                            cCls += ".";
                        }
                        cCls += clsPart;

                        util.logValue("      cls part", cCls, 5);

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
                            const preFullProp = cls.indexOf(".") !== -1 ? cls.substring(0, cCls.indexOf(".")) : cls,
                                lastProp = cCls.indexOf(".") !== -1 ? cCls.substring(cCls.indexOf(".") + 1) : cCls,
                                isEndProp = !!lineText.endsWith(preFullProp + ".");
                            let kind = CompletionItemKind.Class;
                            if (isEndProp) {
                                kind = CompletionItemKind.Method;
                            }
                            completionItems.push(this.createCompletionItem(lastProp, lastProp, cls, kind, "dot"));
                            addedItems.push(cCls);

                            util.logBlank(1);
                            util.log("      added dot completion item", 3);
                            util.logValue("         item", cCls, 3);
                            util.logValue("         kind", kind, 4);
                            util.logValue("         end prop", isEndProp, 4);
                        }
                        break;
                    }
                }
            }
        });

        return completionItems;
    }

}


function registerPropertyCompletionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCompletionItemProvider("javascript", new InlineCompletionItemProvider()),
                               languages.registerCompletionItemProvider("javascript", new DotCompletionItemProvider(), "."));
}


export default registerPropertyCompletionProvider;
