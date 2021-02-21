

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
    markdown?: any;
    fsPath: string;
    isFramework: boolean;
}


export interface IConf
{
    archivePath?: string;
    bootstrap?: any;
    builds?: any;
    cache?: any;
    classic?: any;
    classpath: string | string[];
    css?: any;
    development?: any;
    fashion?: any;
    framework?: string;
    id?: string;
    ignore?: string[];
    indexHtmlPath?: string;
    language?: any;
    loader?: any;
    modern?: any;
    name: string;
    output?: any;
    production?: any;
    resource?: any;
    resources?: any;
    requires?: string[];
    url?: string;
    version?: string;
}


export interface IConfig extends IProperty
{
    setter: string;
    getter: string;
}


export interface IMethod extends IProperty
{
    params?: IVariable[];
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
    markdown?: any;
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

export interface TestTest2
{
    debugClient: boolean;
    debugServer: boolean;
    debugLevel: number;
    include: string[] | string;
}
export interface IVariable extends IExtJsBase
{
    methodName: string;
    componentClass: string;
    type: VariableType;
}


export interface IXtype extends IExtJsBase {}
