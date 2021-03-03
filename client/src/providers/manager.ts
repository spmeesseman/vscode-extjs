
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

    registers.forEach(register => register(context));
}
