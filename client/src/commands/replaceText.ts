
import { commands, ExtensionContext, Range, TextEditor, TextEditorEdit } from "vscode";


export function replaceText(textEditor: TextEditor, edit: TextEditorEdit, text: string | undefined, range: Range | undefined)
{
	if (range && text)
	{
		edit.replace(range, text);
	}
}


function registerReplaceTextCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerTextEditorCommand("vscode-extjs:replaceText",
										   (textEditor: TextEditor, edit: TextEditorEdit, text: string, range: Range) =>
										   { replaceText(textEditor, edit, text, range); })
    );
}


export default registerReplaceTextCommand;
