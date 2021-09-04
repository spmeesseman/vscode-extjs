
import { Disposable, ExtensionContext, Position, Range, TextDocument, Uri } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { ComponentType, IComponent, IConfig, IEdit, IExtJsBase, IMethod, IPosition, IPrimitive, IProperty } from "../../../common";


export interface IExtjsLanguageManager
{
    getConfig: (componentClass: string, property: string, project: string, logPad: string, logLevel: number) => IConfig | undefined;
    getAliasNames: (project: string) => string[];
    getClsByProperty: (property: string, project: string, cmpType: ComponentType.Widget | ComponentType.Store) => string | undefined;
    getComponent: (componentClass: string, project: string, logPad: string, logLevel: number, position?: IPosition, thisCmp?: IComponent) => IComponent | undefined;
    getComponentByFile: (fsPath: string, logPad: string, logLevel: number) => IComponent | undefined;
    getComponentInstance: (property: string, project: string, position: Position, thisCmp: IComponent, logPad: string, logLevel: number) => IComponent | IPrimitive | undefined;
    getComponentNames: (project: string) => string[];
    getComponents: () => IComponent[];
    getFilePath: (componentClass: string, project: string, logPad: string, logLevel: number) => string | undefined;
    getProperty: (componentClass: string, property: string, project: string, isStatic: boolean, logPad: string, logLevel: number) => IProperty | undefined;
    getPropertyPosition: (property: string, cmpType: ComponentType, componentClass: string, project: string, isStatic: boolean, logPad: string, logLevel: number) => Range;
    getLineProperties: (document: TextDocument, position: Position, logPad: string, logLevel: number) => ILineProperties;
    getMethod: (componentClass: string, property: string, project: string, isStatic: boolean, logPad: string, logLevel: number) => IMethod| undefined;
    getModelTypeNames: (project: string) => string[];
    getNamespace: (document: TextDocument | Uri | undefined) => string;
    getStoreTypeNames: (project: string) => string[];
    getSubComponentNames: (clsPart: string, logPad: string, logLevel: number) => string[];
    getXtypeNames: (project: string) => string[];
    indexFiles: (project?: string) => Promise<void>;
    initialize: (context: ExtensionContext) => Promise<Disposable[]>;
    isBusy: () => boolean;
    setBusy: (busy: boolean) => void;
    setTests: (tests: boolean | { disableFileWatchers: boolean }) => void;
    validateDocument: (textDocument: TextDocument | undefined, nameSpace: string, logPad: string, logLevel: number, edits?: IEdit[]) => Promise<void>;
}


export interface ExtJsApi
{
    extjsLangMgr: IExtjsLanguageManager;
    client: LanguageClient;
}


export interface ILineProperties
{
    property: string;
    cmpClass?: string;
    callee?: string;
    calleeCmp?: IExtJsBase;
    thisClass?: string;
    thisCmp?: IComponent;
    cmpType: ComponentType;
    text: string;
    lineText: string;
    lineTextCut: string;
    project: string;
    component: IComponent | IPrimitive | undefined;
}


export interface ITestsConfig
{
    disableFileWatchers?: boolean;
    disableConfigurationWatchers?: boolean;
}

