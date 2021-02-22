import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { IComponent, IPosition } from "../../../common";


export function toVscodePosition(position: IPosition)
{
    const { line, column } = position;
    return new vscode.Position(line - 1, column);
}

export function toVscodeRange(start: IPosition, end: IPosition)
{
    return new vscode.Range(toVscodePosition(start), toVscodePosition(end));
}

class ServerRequest
{
    private client: LanguageClient;

    constructor(client: LanguageClient)
    {
        this.client = client;
    }

    async parseExtJsFile(fsPath: string, nameSpace: string, text: string)
    {
        return this.client.sendRequest<IComponent[] | undefined>("parseExtJsFile", JSON.stringify({ fsPath, text, nameSpace }));
    }

    async getExtJsComponent(text: string)
    {
        return this.client.sendRequest<string | undefined>("getExtJsComponent", text);
    }
}

export default ServerRequest;