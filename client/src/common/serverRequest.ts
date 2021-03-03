import { Diagnostic, Range, Position, Uri } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { IComponent, IPosition } from "../../../common";


class ServerRequest
{
    private client: LanguageClient;

    constructor(client: LanguageClient)
    {
        this.client = client;
    }

    async loadExtJsComponent(ast: string)
    {
        await this.client.sendRequest("loadExtJsComponent", ast);
    }

    async parseExtJsFile(fsPath: string, nameSpace: string, text: string)
    {
        return this.client.sendRequest<IComponent[] | undefined>("parseExtJsFile", JSON.stringify({ fsPath, text, nameSpace }));
    }

    async getExtJsComponent(text: string)
    {
        return this.client.sendRequest<string | undefined>("getExtJsComponent", text);
    }

    async validateExtJsFile(path: string, nameSpace: string, text: string): Promise<Diagnostic[]>
    {
        return this.client.sendRequest<Diagnostic[]>("validateExtJsFile", JSON.stringify({ path, nameSpace, text }));
    }
}

export default ServerRequest;
