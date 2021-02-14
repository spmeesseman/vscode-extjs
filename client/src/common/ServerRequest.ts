import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { IExtjsComponent, Position } from "../common/interface";


export function toVscodePosition(position: Position)
{
    const { line, column } = position;
    return new vscode.Position(line - 1, column);
}

export function toVscodeRange(start: Position, end: Position)
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

    async parseExtJsFile(text: string)
    {
        return this.client.sendRequest<IExtjsComponent[] | null>("parseExtJsFile", text);
    }
}

export default ServerRequest;