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

    async loadExtJsComponent(ast: string, project: string)
    {
        await this.client.sendRequest("loadExtJsComponent", JSON.stringify({ ast, project }));
    }

    async parseExtJsFile(fsPath: string, project: string, nameSpace: string, text: string)
    {
        return this.client.sendRequest<IComponent[]>("parseExtJsFile", JSON.stringify({ fsPath, project, text, nameSpace }));
    }

    async validateExtJsFile(path: string, project: string, nameSpace: string, text: string): Promise<Diagnostic[]>
    {
        return this.client.sendRequest<Diagnostic[]>("validateExtJsFile", JSON.stringify({ path, project, nameSpace, text }));
    }
}

export default ServerRequest;
