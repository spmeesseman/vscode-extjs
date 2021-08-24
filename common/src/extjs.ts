
import { IAlias, IComponent, IConfig, ILogger, IMethod, IProperty, IType, IWidget, IXtype } from "./interface";


export function getComponent(componentClass: string, nameSpace: string, project: string, components: IComponent[], logger?: ILogger, logPad = "", logLevel = 1): IComponent | undefined
{
	logger?.methodStart("get component", logLevel, logPad, false, [["component class", componentClass], ["namespace", nameSpace]]);
	const component = components.find(c => c.componentClass === componentClass && project === c.project) ||
					  getComponentByAlias(componentClass, nameSpace, project, components, logger, logPad + "   ", logLevel);
	logger?.methodDone("get component", logLevel, logPad, false, [["found", !!component]]);
	return component;
}



export function getComponentByAlias(alias: string, nameSpace: string, project: string, components: IComponent[], logger?: ILogger, logPad = "", logLevel = 1): IComponent | undefined
{
	// const aliasNsReplaceRegex = /(?:[^\.]+\.)+/i;
	const _match = (c: IComponent, a: IAlias|IXtype) =>
	{
		let matched = false;
		if (project === c.project)
		{
			if (isAlias(a)) {
				matched = a.name === alias || a.name === `${a.nameSpace}.${alias}`;
			}
			else if (isXType(a)) {
				matched = a.name === alias;
			}
		}
		return matched;
	};

	logger?.methodStart("get component by alias", logLevel, logPad, false, [["component alias", alias], ["namespace", nameSpace], ["project", project]]);

	const component = components.find(c => c.xtypes.find(x => _match(c, x))) ||
					  components.find(c => c.aliases.find(a => _match(c, a)));

	logger?.methodDone("get component by alias", logLevel, logPad, false, [["found", !!component]]);
	return component;
}


export function isConfig(component: IComponent | IProperty | IMethod | IConfig | undefined): component is IConfig
{
    return !!component && "getter" in component;
}


export function isAlias(component: IWidget | IXtype | IType | IAlias | undefined): component is IAlias
{
    return !!component && "type" in component && component.type === "alias";
}


export function isMethod(component: IComponent | IProperty | IMethod | IConfig | undefined): component is IMethod
{
    return !!component && "variables" in component;
}


export function isNeedRequire(componentClass: string | undefined, components: IComponent[])
{
    return !(!componentClass || (componentClass.startsWith("Ext.") && components.find(c => c.nameSpace === "Ext" && c.componentClass === componentClass)));
}


export function isProperty(component: IComponent | IProperty | IMethod | IConfig | undefined): component is IProperty
{
    return !!component && !("variables" in component) && !("getter" in component);
}


export function isType(component: IWidget | IXtype | IType | IAlias | undefined): component is IType
{
    return !!component && "type" in component && component.type === "type";
}


export function isXType(component: IWidget | IXtype | IType | IAlias | undefined): component is IXtype
{
    return !!component && "type" in component && component.type === "xtype";
}

