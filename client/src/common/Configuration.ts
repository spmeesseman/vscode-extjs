"use strict";

import {
    ConfigurationChangeEvent, Event, EventEmitter, workspace,
    WorkspaceConfiguration, ConfigurationTarget, Uri
} from "vscode";

const extensionName = "extjsLangSvr";

class Configuration
{
    private configuration: WorkspaceConfiguration;
    private _onDidChange = new EventEmitter<ConfigurationChangeEvent>();


    get onDidChange(): Event<ConfigurationChangeEvent>
    {
        return this._onDidChange.event;
    }


    constructor()
    {
        this.configuration = workspace.getConfiguration(extensionName);
        workspace.onDidChangeConfiguration(this.onConfigurationChanged, this);
    }


    private onConfigurationChanged(event: ConfigurationChangeEvent)
    {
        if (!event.affectsConfiguration(extensionName))
        {
            return;
        }

        this.configuration = workspace.getConfiguration(extensionName);

        this._onDidChange.fire(event);
    }


    public get<T>(section: string, defaultValue?: T): T
    {
        return this.configuration.get<T>(section, defaultValue!);
    }


    public update(section: string, value: any): Thenable<void>
    {
        return this.configuration.update(section, value, ConfigurationTarget.Global);
    }


    public updateWs(section: string, value: any): Thenable<void>
    {
        return workspace.getConfiguration(extensionName).update(section, value, ConfigurationTarget.Workspace);
    }


    public updateWsf(section: string, value: any, uri?: Uri): Thenable<void>
    {
        return workspace.getConfiguration(extensionName, uri ? uri : workspace.workspaceFolders ?
            workspace.workspaceFolders[0].uri : null)
            .update(section, value, ConfigurationTarget.WorkspaceFolder);
    }


    public inspect(section: string)
    {
        return this.configuration.inspect(section);
    }

}

export const configuration = new Configuration();
