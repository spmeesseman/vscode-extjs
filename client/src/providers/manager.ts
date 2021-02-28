
import { ExtensionContext } from "vscode";
import registerXtypeCodeActionProvider from "./xtypeCodeAction";
import registerXtypeCompletionProvider from "./xtypeCompletion";
import registerXtypeDefinitionProvider from "./xtypeDefinion";
import registerXtypeHoverProvider from "./xtypeHover";
import registerPropertyHoverProvider from "./propertyHover";
import registerPropertyCompletionProvider from "./propertyCompletion";
import registerPropertyDefinitionProvider from "./propertyDefinion";
import registerMethodSignatureProvider from "./methodSignature";
import registerSyntaxCodeActionProvider from "./syntaxCodeAction";
import registerSymbolProvider from "./symbol";
import { extjsLangMgr } from "../extension";


export type Register = (context: ExtensionContext) => void;


export function registerProviders(context: ExtensionContext)
{
    const registers: Register[] = [
        registerXtypeHoverProvider,
        registerXtypeDefinitionProvider,
        registerXtypeCodeActionProvider,
        registerXtypeCompletionProvider,
        registerPropertyHoverProvider,
        registerPropertyCompletionProvider,
        registerPropertyDefinitionProvider,
        registerMethodSignatureProvider,
        registerSyntaxCodeActionProvider
    ];

    const delayedRegisters: Register[] = [
        registerSymbolProvider
    ];

    const _regSymbolProvider = ((context: ExtensionContext) => {
        setTimeout(() => {
            if (!extjsLangMgr.isBusy())
            {
                delayedRegisters.forEach(register => register(context));
            }
            else {
                _regSymbolProvider(context);
            }
        }, 250);
    });

    registers.forEach(register => register(context));
    _regSymbolProvider(context);
}
