
export enum ComponentType
{
    None,
    Config = 1 << 0,
    Method = 1 << 1,
    Property = 1 << 2,
    Widget = 1 << 3,
    Class = 1 << 4,
    Model = 1 << 5,
    Store = 1 << 6,
    Type = 1 << 7,
    XType = 1 << 8,
    Layout = 1 << 9
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
}


export interface IAlias extends IWidget
{
    type: "alias" | "alternateClassName";
}


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
    markdown?: any;
    methods: IMethod[];
    mixins: string[];
    nameSpace: string;
    objectRanges: IObjectRange[];
    private?: boolean;
    privates: (IProperty | IMethod)[];
    project: string;
    properties: IProperty[];
    requires?: IRequires;
    since?: string;
    singleton: boolean;
    statics: (IProperty | IMethod)[];
    types: IType[];
    uses?: IRequires;
    widgets: IWidget[];
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
    classpath: string[];
    css?: any;
    development?: any;
    fashion?: any;
    framework?: string;
    frameworkDir?: string;
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


export interface IConfig extends IPropertyBase
{
    setter: string;
    getter: string;
}


export interface ILogger
{
    error: (msg: string | (string|Error)[] | Error, params?: (string|any)[][]) => void;
    methodStart: (msg: string, level?: number, logPad?: string, doLogBlank?: boolean, params?: (string|any)[][]) => void;
    methodDone: (msg: string, level?: number, logPad?: string, doLogBlank?: boolean, params?: (string|any)[][]) => void;
    write: (msg: string, level?: number, logPad?: string, force?: boolean) => void;
    value: (msg: string, value: any, level?: number, logPad?: string) => void;
    values: (values: (string|any)[][], level?: number, logPad?: string, doLogBlank?: boolean) => void;
}


export interface IMethod extends IProperty
{
    bodyStart: IPosition;
    bodyEnd: IPosition;
    objectRanges: IObjectRange[];
    params: IParameter[];
    variables: IVariable[];
    returns: string | undefined;
}


export interface IObjectRange extends IRange
{
    name?: string; // empty if method parameter
    type: "ObjectMethod" | "ObjectProperty" | "ObjectExpression" | "SpreadElement";
}


export interface IParameter extends IExtJsBase
{
    doc?: string;
    markdown?: any;
    methodName: string;
    type: VariableType;
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


export interface IPropertyBase extends IExtJsBase
{
    doc?: string;
    markdown?: any;
    private: boolean;
    deprecated: boolean;
    since?: string;
}


export interface IProperty extends IPropertyBase
{
    static: boolean;
}


export interface IRange
{
    start: IPosition;
    end: IPosition;
}


export interface IRequires
{
    value: IRequire[];
    start: IPosition;
    end: IPosition;
}


export interface IRequire
{
    name: string;
    start: IPosition | undefined;
    end: IPosition | undefined;
}


export interface IType extends IWidget
{
    type: "type";
    parentProperty: string;
}


export interface IUse extends IRequire {}


export interface IUses extends IRequires {}


export interface IVariable extends IExtJsBase
{
    methodName: string;
    declaration: DeclarationType;
    type?: VariableType;
}


export interface IWidget extends IExtJsBase
{
    type: "alias" | "type" | "xtype" | "alternateClassName";
}


export interface IXtype extends IWidget
{
    type: "xtype";
    parentProperty: string;
}
