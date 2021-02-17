
import {
    CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, CompletionList,
    ExtensionContext, languages, Position, ProviderResult, TextDocument, CompletionItemKind, Range
} from "vscode";
import {
    methodToComponentClassMapping, configToComponentClassMapping, propertyToComponentClassMapping,
    getComponentClass, ComponentType, getConfig
} from "../languageManager";
import * as util from "../common/utils";


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
              completionItems: ProviderResult<CompletionItem[] | CompletionList> = [],
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

        function _pci(map: { [s: string]: string | undefined } | ArrayLike<string>, kind: CompletionItemKind, base: string, cItems: CompletionItem[], aItems: string[])
        {
            Object.entries(map).forEach(([p, cls]) =>
            {
                if (cls && (!base || cls.indexOf(base) === 0))
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
                          cText = base ? fullPath.replace(base, "").substring(1) : p,
                          thisProp = cText.indexOf(".") !== -1 ? cText.substring(0, cText.indexOf(".")) : cText,
                          isEndProp = thisProp === p;
                    if (aItems.indexOf(thisProp) === -1)
                    {
                        const iKind = !isEndProp ? CompletionItemKind.Class : kind,
                              propCompletion = new CompletionItem(thisProp, iKind);
                        util.logValue("      item", p, 3);
                        util.logValue("      kind", iKind, 4);
                        util.logValue("      full path", fullPath, 4);
                        cItems.push(propCompletion);
                        aItems.push(cText);
                    }
                }
            });
        }

        util.log("   methods", 1);
        _pci(methodToComponentClassMapping, CompletionItemKind.Method, completionBase, completionItems, addedItems);
        util.log("   properties", 1);
        _pci(propertyToComponentClassMapping, CompletionItemKind.Property, completionBase, completionItems, addedItems);
        util.log("   configs", 1);
        _pci(configToComponentClassMapping, CompletionItemKind.Property, completionBase, completionItems, addedItems);

        return completionItems;
    }

}


function registerPropertyCompletionProvider(context: ExtensionContext)
{
    context.subscriptions.push(languages.registerCompletionItemProvider("javascript", new PropertyCompletionItemProvider()));
}


export default registerPropertyCompletionProvider;
