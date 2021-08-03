
export enum ComponentType
{
    None,
    Config = 1 << 0,
    Method = 1 << 1,
    Property = 1 << 2,
    Widget = 1 << 3,
    Class = 1 << 4
}


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
    _class,
    _number,
    _object,
    _string
}

export interface IExtJsBase extends IRange
{
    componentClass: string;
    name: string;
    fsPath?: string;
}


export interface IAlias extends IExtJsBase {}


export interface IComponent extends IExtJsBase
{
    aliases: IAlias[];
    baseNameSpace: string;
    bodyStart: IPosition;
    bodyEnd: IPosition;
    configs: IConfig[];
    deprecated?: boolean;
    doc?: string;
    extend?: string;
    fsPath: string;
    isFramework: boolean;
    markdown?: any;
    methods: IMethod[];
    nameSpace: string;
    objectRanges: IRange[];
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
    baseWsDir: string;
    bootstrap?: any;
    buildDir: string | undefined;
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
    wsDir: string;
}


export interface IConfig extends IProperty
{
    setter: string;
    getter: string;
}


export interface IMethod extends IProperty
{
    bodyStart: IPosition;
    bodyEnd: IPosition;
    objectRanges: IRange[];
    params: IParameter[];
    variables: IVariable[];
    returns: any;
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


export interface IPrimitive extends IExtJsBase
{
    type?: VariableType;
}


export interface IProperty extends IExtJsBase
{
    doc?: string;
    markdown?: any;
    private?: boolean;
    deprecated?: boolean;
    since?: string;
}


export interface IRange
{
    start: IPosition;
    end: IPosition;
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
