
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
        const line = position.line,
              text = document.getText(range),
			  lineText = document.getText(new Range(new Position(line, 0), new Position(line, position.character)))?.trim(),
              completionItems: CompletionItem[] = [],
              addedItems: string[] = [];
        let completionBase = lineText.replace(text, "");
        if (completionBase && completionBase[completionBase.length - 1] === ".") {
            completionBase = completionBase.substring(0, completionBase.length - 1);
        }

        util.log("provide property completion items", 1);
        util.logValue("   current text block", text, 2);
        util.logValue("   completion base", completionBase, 2);
        util.logValue("   line text", lineText, 3);

        if (!text || !lineText) {
            return;
        }

        function _pci(map: { [s: string]: string | undefined } | ArrayLike<string>, kind: CompletionItemKind)
        {
            Object.entries(map).forEach(([p, cls]) =>
            {
                if (cls && (!completionBase || cls.indexOf(completionBase) === 0))
                {
                    //
                    // Example:
                    //
                    //     text = Ext.csi.s
                    //     base = Ext.csi
                    //     p    = s
                    //     cls  = Ext.csi.store.Base
                    //     cls  = Ext.csi.store.Base
                    //
                    // Return the property name prefixed by 'base'
                    //
                    const fullPath = cls + "." + p,
                          cText = completionBase ? fullPath.replace(completionBase, "").substring(1) : p;
                    let thisProp = cText.indexOf(".") !== -1 ? cText.substring(0, cText.indexOf(".")) : cText;
                    const isEndProp = thisProp === p && (cText.indexOf(".") !== -1 || cls === completionBase);
                    let wasProp = thisProp;
                    if (!isEndProp)
                    {
                        if (completionBase)
                        {
                            const cPart = cls.replace(completionBase, ""),
                                  nextDotIdx = cPart.indexOf(".", 1);
                            thisProp = cPart.substring(1, nextDotIdx !== -1 ? nextDotIdx : cPart.length);
                        }
                        else {
                            thisProp = cls.substring(0, cls.indexOf("."));
                        }
                    }
                    if (addedItems.indexOf(thisProp) === -1)
                    {
                        const iKind = !isEndProp ? CompletionItemKind.Class : kind,
                              propCompletion = new CompletionItem(thisProp, iKind);
                        let cmp: IMethod | IProperty | IConfig | undefined;
                        switch (iKind)
                        {
                            case CompletionItemKind.Method:
                                cmp = getMethod(cls, wasProp);
                                if (!cmp) {
                                    if (wasProp.startsWith("get") || wasProp.startsWith("set") && wasProp[3] >= "A" && wasProp[3] <= "Z")
                                    {
                                        const gsProperty = util.lowerCaseFirstChar(wasProp.substring(3));
                                        cmp = getConfig(cls, gsProperty);
                                        if (!cmp) {
                                            cmp = getConfig(cls, wasProp);
                                        }
                                    }
                                }
                                break;
                            case CompletionItemKind.Property:
                                cmp = getConfig(cls, wasProp);
                                if (!cmp) {
                                    cmp = getProperty(cls, wasProp);
                                }
                                break;
                            case CompletionItemKind.Class:
                                // TODO - pick comments in server for classes
                                break;
                            default:
                                break;
                        }

                        util.log("      add completion item", 3);
                        util.logValue("         item", p, 3);
                        util.logValue("         kind", iKind, 4);
                        util.logValue("         end prop", isEndProp, 4);
                        util.logValue("         full path", fullPath, 4);

                        propCompletion.documentation = cmp?.markdown;
                        completionItems.push(propCompletion);
                        addedItems.push(thisProp);
                    }
                }
            });
        }

        util.log("   methods", 1);
        _pci(methodToComponentClassMapping, CompletionItemKind.Method);
        util.log("   properties", 1);
        _pci(propertyToComponentClassMapping, CompletionItemKind.Property);
        util.log("   configs", 1);
        _pci(configToComponentClassMapping, CompletionItemKind.Property);

        return completionItems;
    }

}


function registerPropertyCompletionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCompletionItemProvider("javascript", new PropertyCompletionItemProvider()));
}


export default registerPropertyCompletionProvider;
