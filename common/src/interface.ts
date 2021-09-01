
export enum ComponentType
{
    None = 0,
    Config = 1,
    Method = 2,
    Property = 4,
    Widget = 8,
    Class = 16,
    Model = 32,
    Store = 64,
    Type = 128,
    XType = 256,
    Layout = 512,
    Instance = 1024
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
    range: IRange;
}


export interface IAlias extends IWidget
{
    type: "alias";
    nameSpace: string;
}


export interface IAlternateClassName extends IWidget
{
    type: "alternateClassName";
    nameSpace: string;
}


export interface IComponent extends IExtJsBase
{
    aliases: (IAlias|IAlternateClassName)[];
    baseNameSpace: string;
    bodyStart: IPosition;
    bodyEnd: IPosition;
    configs: IConfig[];
    deprecated?: boolean;
    doc?: IJsDoc;
    extend?: string;
    fsPath: string;
    methods: IMethod[];
    mixins?: IMixins;
    model?: string;
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


/**
 * Represents a configuration object read from a configuration file.
 * Configuration objects are read from:
 *
 *      .extjsrc.json files
 *      app.json files
 *      Paths set in workspace settings
 */
export interface IConf
{
    archivePath?: string;
    /**
     * The base directory of the configuration file.  Full path.
     */
    baseDir: string;
    /**
     * The base directory of the configuration file, relative to the worksace
     * directory.  Relative path.
     */
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
    /**
     * The directory of the workspace/project folder that the configuration file
     * belongs to / resides in.  Full path.
     */
    wsDir: string;
}


export interface IConfig extends IPropertyBase
{
    setter: string;
    getter: string;
}


export interface IDictionary<TValue>
{
    [id: string]: TValue;
}



export interface IEdit
{
    end: number;
    start: number;
    length: number;
    range: IRange;
    text: string;
}


export interface IJsDocParam
{
    default?: string;
    name: string;
    type: string;
    body: string;
    title: string;
}


export interface IJsDoc
{
    body: string;
    deprecated: boolean;
    private: boolean;
    pType: "property" | "param" | "cfg" | "class" | "method" | "unknown";
    returns: string;
    since: string;
    singleton: boolean;
    static: boolean;
    title: string;
    type: string;
    params: IJsDocParam[];
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


export interface IMethod extends IPropertyBase
{
    bodyStart: IPosition;
    bodyEnd: IPosition;
    objectRanges: IObjectRange[];
    params: IParameter[];
    variables: IVariable[];
    returns: string | undefined;
    static: boolean;
}


export interface IMixin extends IRequire {}


export interface IMixins extends IRequires {}


export interface IObjectRange extends IRange
{
    name?: string; // empty if method parameter
    type: "ObjectMethod" | "ObjectProperty" | "ObjectExpression" | "SpreadElement";
}


export interface IParameter extends IExtJsBase
{
    // doc?: string;
    // docTitle?: string;
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
    doc?: IJsDoc;
    private: boolean;
    deprecated: boolean;
    since?: string;
    value: IPropertyValue | undefined;
}


export interface IProperty extends IPropertyBase
{
    static: boolean;
}


export interface IPropertyValue extends IRange
{
    value: any | undefined;
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
    start: IPosition;
    end: IPosition;
}


export interface IServerRequest
{
    edits: IEdit[];
    fsPath: string;
    nameSpace: string;
    project: string;
    text: string;
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
    parentProperty: string;
}


export interface IXtype extends IWidget
{
    type: "xtype";
}
