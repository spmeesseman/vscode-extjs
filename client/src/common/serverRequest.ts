import { Diagnostic, TextDocumentContentChangeEvent } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { IComponent, IEdit, IServerRequest } from "../../../common";
import { toIRange } from "./clientUtils";


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

    async parseExtJsFile(fsPath: string, project: string, nameSpace: string, text: string, edits: IEdit[])
    {
        const request: IServerRequest = { fsPath, project, text, nameSpace, edits };
        return this.client.sendRequest<IComponent[]>("parseExtJsFile", JSON.stringify(request));
    }

    async validateExtJsFile(fsPath: string, project: string, nameSpace: string, text: string, edits: IEdit[]): Promise<Diagnostic[]>
    {
        const request: IServerRequest = { fsPath, project, text, nameSpace, edits };
        return this.client.sendRequest<Diagnostic[]>("validateExtJsFile", JSON.stringify(request));
    }
}

export default ServerRequest;
