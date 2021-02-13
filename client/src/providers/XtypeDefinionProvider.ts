
import { CancellationToken, DefinitionProvider, ExtensionContext, languages, Location, LocationLink, Position, ProviderResult, Range, TextDocument, Uri } from 'vscode';
import { getExtjsComponentClass, getExtjsFilePath } from '../common/ExtjsLanguageManager';


class XtypeDefinitionProvider implements DefinitionProvider 
{
	provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location | Location[] | LocationLink[]> 
	{
		const range = document.getWordRangeAtPosition(position);
		if (range === undefined) {
			return;
		}
		
		const line = position.line,
			  xtype = document.getText(range),
			  text = document.getText(new Range(new Position(line, 0), new Position(line, range.end.character + 1)));

		if (new RegExp(`xtype\\s*:\\s*(['"])${xtype}\\1$`).test(text))
		{
			const componentClass = getExtjsComponentClass(xtype);
			if (componentClass)
			{
				const fsPath = getExtjsFilePath(componentClass),
					  uri = Uri.parse(`file://${fsPath}`),
					  start = new Position(0, 0),
					  end = new Position(0, 0),
					  range = new Range(start, end);
				return {
					uri,
					range
				};
			}
		}
	}
}


export default function registerXtypeDefinitionProvider(context: ExtensionContext)
{
	context.subscriptions.push(languages.registerDefinitionProvider('javascript', new XtypeDefinitionProvider()));
}
