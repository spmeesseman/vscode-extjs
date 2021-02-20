

export interface IExtJsBase
{
    name: string;
    start: IPosition;
    end: IPosition;
    fsPath?: string;
}


export interface IComponent
{
    aliases: string[];
    baseNamespace: string;
    componentClass: string;
    requires?: IRequires;
    widgets: string[];
    xtypes: IXtype[];
    properties: IProperty[];
    configs: IConfig[];
    methods: IMethod[];
    statics: (IProperty | IMethod)[];
    privates: (IProperty | IMethod)[];
    doc?: string;
    markdown?: string;
    fsPath?: string;
}



export interface IConf
{
    extjsDir: string | string[];
    extjsBase: string;
    workspaceRoot: string;
}


export interface IConfig extends IProperty
{
    setter: string;
    getter: string;
}


export interface IMethod extends IProperty
{
    params?: string;
    variables?: IVariable[];
}

export interface IPosition
{
    line: number;
    column: number;
}



export interface IProperty extends IExtJsBase
{
    doc?: string;
    markdown?: string;
    private?: boolean;
    deprecated?: boolean;
    since?: string;
}


export interface IRequires
{
    value: string[];
    start: IPosition;
    end: IPosition;
}


export interface ISettings
{
    debugClient: boolean;
    debugServer: boolean;
    debugLevel: number;
    include: string[] | string;
}


export enum VariableType
{
    const,
    let,
    var
}


export interface IVariable extends IExtJsBase
{
    componentClass: string;
    instanceClass: string;
    method: IMethod;
    type: VariableType; // i.e. "const", "let", "var"
}


export interface IXtype extends IExtJsBase {}
