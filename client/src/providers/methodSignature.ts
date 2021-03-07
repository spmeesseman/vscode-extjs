
import {
    ExtensionContext, languages, Position, CancellationToken, ProviderResult, ParameterInformation,
    TextDocument, SignatureHelpProvider, SignatureHelp, SignatureHelpContext, SignatureInformation
} from "vscode";
import { extjsLangMgr } from "../extension";
import * as log from "../common/log";


class MethodSignatureProvider implements SignatureHelpProvider
{
	provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): ProviderResult<SignatureHelp>
	{
        const sigHelp = new SignatureHelp();
        let lineText = document.lineAt(position).text.substr(0, position.character),
            pLoc = lineText.lastIndexOf("(");

        if (pLoc !== -1)
        {
            pLoc = lineText.lastIndexOf("(", pLoc - 1);
            if (pLoc !== -1)
            {
                lineText = lineText.substring(pLoc + 1);
            }
        }

        //
        // Check for "(" since VSCode 24/7 Intellisense will trigger every character no matter what
        // the trigger char(s) is for this provider.  24/7 Intellisense can be turned off in settings.json:
        //
        //    "editor.quickSuggestions": false
        //
        if (lineText && lineText.includes("(") && !lineText.endsWith(")"))
        {
            log.methodStart("provide method signature", 2, "", true, [["line text", lineText]]);

            //
            // Create signature information
            //
            sigHelp.signatures = [ this.getSignatureInfo(lineText) ];

            //
            // Set the current parameter index
            //
            let commaIdx = lineText.indexOf(",");
            sigHelp.activeParameter = 0;
            while (commaIdx !== -1) {
                ++sigHelp.activeParameter;
                commaIdx = lineText.indexOf(",", commaIdx + 1);
            }

            log.methodDone("provide method signature", 2, "", true);
        }

        return sigHelp;
    }


    getSignatureInfo(lineText: string): SignatureInformation
    {
		let signature = "";
        const params: ParameterInformation[] = [],
			  matches = lineText.match(/([\w]+\.)/g);

		//
		// Create signature parameter information
		//
        if (matches)
        {
            let cls = "";
            for (const m of matches)
            {
                cls += m;
            }
            cls = cls.substring(0, cls.length - 1); // remove trailing .
            const cmp = extjsLangMgr.getComponent(cls) || extjsLangMgr.getComponentByAlias(cls);

            if (cmp)
            {
				const methodName = lineText.substring(lineText.lastIndexOf(".") + 1, lineText.indexOf("("));
                for (const m of cmp.methods)
                {
                    if (m.name === methodName && m.params)
                    {
						for (const p of m.params)
						{
							params.push(new ParameterInformation(p.name, p.markdown || p.doc));
						}
						break;
                    }
                }
            }
        }

		//
		// Build method signature string in the form:
		//
		//     param1, param2, param3, ...
		//
		params.forEach((p) => {
			if (signature) {
				signature += ", ";
			}
			signature += p.label;
		});

		const sigInfo = new SignatureInformation(signature);
		sigInfo.parameters = params;

        return sigInfo;
    }
}


function registerMethodSignatureProvider(context: ExtensionContext)
{
    context.subscriptions.push(
        languages.registerSignatureHelpProvider("javascript", new MethodSignatureProvider())
    );
}


export default registerMethodSignatureProvider;
