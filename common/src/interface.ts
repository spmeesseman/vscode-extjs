
export enum DeclarationType
{
    const,
    let,
    var
}


export enum VariableType
{
    _any,
    _arr,
    _boolean,
    _number,
    _object,
    _string
}

export interface IExtJsBase
{
    componentClass: string;
    name: string;
    start: IPosition;
    end: IPosition;
    fsPath?: string;
}


export interface IAlias extends IExtJsBase {}


export interface IComponent extends IExtJsBase
{
    aliases: IAlias[];
    baseNameSpace: string;
    configs: IConfig[];
    deprecated?: boolean;
    doc?: string;
    extend?: string;
    isFramework: boolean;
    markdown?: any;
    methods: IMethod[];
    nameSpace: string;
    private?: boolean;
    privates: (IProperty | IMethod)[];
    properties: IProperty[];
    requires?: IRequires;
    since?: string;
    statics: (IProperty | IMethod)[];
    widgets: string[];
    xtypes: IXtype[];
}


export interface IConf
{
    archivePath?: string;
    baseDir: string;
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
    params?: IParameter[];
    variables?: IVariable[];
}


export interface IParameter extends IExtJsBase
{
    doc?: string;
    markdown?: any;
    methodName: string;
    declaration?: DeclarationType;
    type?: VariableType;
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


export interface IVariable extends IExtJsBase
{
    methodName: string;
    declaration?: DeclarationType;
    type?: VariableType;
}


export interface IXtype extends IExtJsBase {}
