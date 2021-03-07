
import { ExtensionContext } from "vscode";
import registerXtypeCodeActionProvider from "./xtypeCodeAction";
import registerXtypeCompletionProvider from "./xtypeCompletion";
import registerXtypeDefinitionProvider from "./xtypeDefinion";
import registerXtypeHoverProvider from "./xtypeHover";
import registerHoverProvider from "./hover";
import registerCompletionProvider from "./completion";
import registerDefinitionProvider from "./definition";
import registerMethodSignatureProvider from "./methodSignature";
import registerSyntaxCodeActionProvider from "./syntaxCodeAction";
import registerTypeDefinitionProvider from "./typeDefinition";


export type Register = (context: ExtensionContext) => void;


export function registerProviders(context: ExtensionContext)
{
    const registers: Register[] = [
        registerXtypeHoverProvider,
        registerXtypeDefinitionProvider,
        registerXtypeCodeActionProvider,
        registerXtypeCompletionProvider,
        registerHoverProvider,
        registerCompletionProvider,
        registerDefinitionProvider,
        registerMethodSignatureProvider,
        registerSyntaxCodeActionProvider,
        registerTypeDefinitionProvider
    ];

    registers.forEach(register => register(context));
}
