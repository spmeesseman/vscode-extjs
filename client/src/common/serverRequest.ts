import { Diagnostic } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { IComponent } from "../../../common";


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

    async validateExtJsFile(path: string, nameSpace: string, text: string): Promise<Diagnostic[]>
    {
        return this.client.sendRequest<Diagnostic[]>("validateExtJsFile", JSON.stringify({ path, nameSpace, text }));
    }
}

export default ServerRequest;
