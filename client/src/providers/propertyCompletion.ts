
import {
    CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, CompletionList,
    ExtensionContext, languages, Position, ProviderResult, TextDocument, CompletionItemKind, Range
} from "vscode";
import {
    methodToComponentClassMapping, configToComponentClassMapping, propertyToComponentClassMapping,
    getComponentClass, ComponentType, getConfig, getMethod, getProperty
} from "../languageManager";
import * as util from "../common/utils";
import { IConfig, IMethod, IProperty } from "../common/interface";


class PropertyCompletionItemProvider implements CompletionItemProvider
{
    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList>
    {
        const range = document.getWordRangeAtPosition(position);
        if (range === undefined) {
            return;
        }
        const addedItems: string[] = [],
              line = position.line,
              text = document.getText(range),
              lineText = document.getText(new Range(new Position(line, 0), new Position(line, position.character)))?.trim(),
              completionItems: CompletionItem[] = [];

        util.log("provide property completion items", 1);

        if (!text || !lineText) {
            util.log("   invalid input parameters, exit", 1);
            return completionItems;
        }

        util.log("   methods", 1);
        completionItems.push(...this.getCompletionItems(text, lineText, methodToComponentClassMapping, CompletionItemKind.Method, addedItems));

        util.log("   properties", 1);
        completionItems.push(...this.getCompletionItems(text, lineText, propertyToComponentClassMapping, CompletionItemKind.Property, addedItems));

        util.log("   configs", 1);
        completionItems.push(...this.getCompletionItems(text, lineText, configToComponentClassMapping, CompletionItemKind.Property, addedItems));

        return completionItems;
    }


    private getCompletionItems(text: string, lineText: string, map: { [s: string]: string | undefined } | ArrayLike<string>, kind: CompletionItemKind, addedItems: string[]): CompletionItem[]
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
                    completionItems.push(this.createCompletionItem(thisProp, wasProp, cls, iKind));
                    addedItems.push(thisProp);

                    util.log("      added completion item", 3);
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


    private createCompletionItem(thisProp: string, wasProp: string, cmpClass: string, kind: CompletionItemKind): CompletionItem
    {
        const propCompletion = new CompletionItem(thisProp, kind);

        let cmp: IMethod | IProperty | IConfig | undefined;
        switch (kind)
        {
            case CompletionItemKind.Method:
                cmp = this.getMethodCmp(wasProp, cmpClass);
                break;
            case CompletionItemKind.Property:
                cmp = this.getPropertyCmp(wasProp, cmpClass);
                break;
            case CompletionItemKind.Class:
                // TODO - pick comments in server for classes
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
        if (!cmp) {
            if (property.startsWith("get") || property.startsWith("set") && property[3] >= "A" && property[3] <= "Z")
            {
                const gsProperty = util.lowerCaseFirstChar(property.substring(3));
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


function registerPropertyCompletionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCompletionItemProvider("javascript", new PropertyCompletionItemProvider()));
}


export default registerPropertyCompletionProvider;
