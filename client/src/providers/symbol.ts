
import {
    ExtensionContext, languages, CancellationToken, ProviderResult, Location,
    TextDocument, DocumentSymbolProvider, DocumentSymbol, SymbolInformation, SymbolKind
} from "vscode";
import { getComponent, getComponentByAlias } from "../languageManager";
import { toVscodeLocation } from "../common/clientUtils";
import * as log from "../common/log";
import { IExtJsBase } from "../../../common";


class SymbolProvider implements DocumentSymbolProvider
{
    provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<SymbolInformation[] | DocumentSymbol[]>
    {
        let location: Location;
        const symbolInfo: SymbolInformation[] = [],
              text = document.getText();

        const _addSymbol = ((cmp: IExtJsBase, kind: SymbolKind, pCmp?: IExtJsBase) => {
            const location = toVscodeLocation(cmp.start, cmp.end, document.uri);
            symbolInfo.push(new SymbolInformation(cmp.name, kind, pCmp?.name ?? "", location));
        });

        log.methodStart("provide document symbols", 1, "", true);

        //
        // ExtJS class files will call Ext.define()
        //
        const matches = text.match(/Ext\.define\s*\(\s*["']{1}([\w\.]+)["']{1}\s*,/);
        if (matches && matches[1])
        {
            const cmp = getComponent(matches[1], true);
            if (!cmp) {
                return;
            }
            //
            // Validate method variables
            //
            for (const method of cmp.methods)
            {
                log.value("   method", method.name, 2);
                _addSymbol(method, SymbolKind.Method);

                if (method.variables)
                {
                    for (const variable of method.variables)
                    {
                        log.value("      variable ", variable.name, 3);
                        _addSymbol(variable, SymbolKind.Variable, method);
                    }
                }
            }
        }

        log.methodDone("provide document symbols", 2, "", true);

        return symbolInfo;
    }
}


function registerSymbolProvider(context: ExtensionContext)
{
    context.subscriptions.push(
        languages.registerDocumentSymbolProvider("javascript", new SymbolProvider())
    );
}


export default registerSymbolProvider;
