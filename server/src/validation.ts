
import { Connection, Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";


export async function validateExtJsDocument(textDocument: TextDocument, connection: Connection, hasDiagnosticRelatedInformationCapability: boolean): Promise<void>
{
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < 5)
    {
		problems++;
		const diagnostic: Diagnostic =
        {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: "ex"
		};

		if (hasDiagnosticRelatedInformationCapability)
        {
			diagnostic.relatedInformation = [
            {
                location: {
                    uri: textDocument.uri,
                    range: { ...diagnostic.range }
                },
                message: "Casing matters, don't do it!!"
            },
            {
                location: {
                    uri: textDocument.uri,
                    range: { ...diagnostic.range }
                },
                message: "Particularly for this example message"
            }];
		}

		diagnostics.push(diagnostic);
	}

	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
