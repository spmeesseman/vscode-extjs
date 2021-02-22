import { Diagnostic, Range, Position, Uri } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { IComponent, IPosition } from "../../../common";


export function toVscodePosition(position: IPosition)
{
    const { line, column } = position;
    return new Position(line - 1, column);
}

export function toVscodeRange(start: IPosition, end: IPosition)
{
    return new Range(toVscodePosition(start), toVscodePosition(end));
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

    async validateExtJsFile(fsPath: string, nameSpace: string, text: string): Promise<Diagnostic[]>
    {
        const uriPath = this.fsPathToUriPath(fsPath);
        return this.client.sendRequest<Diagnostic[]>("validateExtJsFile", JSON.stringify({ uriPath, nameSpace, text }));
    }


    private fsPathToUriPath(fsPath: string)
    {
        const uri = Uri.parse(fsPath);
        return "file:///" + (uri.scheme ? uri.scheme + "%3A" : "") + uri.path.replace(/\\/g, "/"); // win32 compat;
    }
}

export default ServerRequest;
