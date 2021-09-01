
import { commands, ExtensionContext, Range, TextEditor, TextEditorEdit } from "vscode";


function replaceText(edit: TextEditorEdit, text: string, range: Range)
{
	edit.replace(range, text);
}


function registerReplaceTextCommand(context: ExtensionContext)
{
	context.subscriptions.push(
        commands.registerTextEditorCommand("vscode-extjs:replaceText",
										   (textEditor: TextEditor, edit: TextEditorEdit, text: string, range: Range) =>
										   { replaceText(edit, text, range); })
    );
}


export default registerReplaceTextCommand;
