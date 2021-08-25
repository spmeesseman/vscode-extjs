
import * as utils from "./utils";
import { IAlias, IComponent, IConfig, ILogger, IMethod, IPosition, IProperty, IRange, IType, IWidget, IXtype } from "./interface";


export function getComponent(componentClass: string, project: string, components: IComponent[], position?: IPosition, thisCmp?: IComponent, logger?: ILogger, logPad = "", logLevel = 1): IComponent | undefined
{
	logger?.methodStart("get component", logLevel, logPad, false, [["component class", componentClass], ["project", project]]);
	const component = components.find(c => c.componentClass === componentClass && project === c.project) ||
					  getComponentByAlias(componentClass, project, components, position, thisCmp, logger, logPad + "   ", logLevel);
	logger?.methodDone("get component", logLevel, logPad, false, [["found", !!component]]);
	return component;
}


export function getComponentByAlias(alias: string, project: string, components: IComponent[], position?: IPosition, thisCmp?: IComponent, logger?: ILogger, logPad = "", logLevel = 1): IComponent | undefined
{
	logger?.methodStart("get component by alias", logLevel, logPad, false, [["component alias", alias], ["project", project]]);

	const w = position && thisCmp ? getWidgetByPosition(position, thisCmp) : undefined;
	// const aliasNsReplaceRegex = /(?:[^\.]+\.)+/i;
	const _match = (c: IComponent, a: IAlias|IXtype|IType) =>
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

	let component: IComponent | undefined;
	const xtypeComponents = w?.type !== "type" ? (components.filter(c => c.xtypes.find(x => _match(c, x))) || []) :
												 (components.filter(c => c.types.find(t => _match(c, t))) || []),
		  aliasComponents = components.filter(c => c.aliases.find(a => _match(c, a))) || [];

	//
	// getAliasLookup() will examine parent object's property name of the widget in the
	// current document and match it to it's namespace name i.e. 'layout.vbox', where
	// 'layout' is the namespace name.  This is only possible if `position` and `thisCmp`
	// arguments were passed by the caller.
	//
	if (position && thisCmp && w && w.type === "type") {
		component = getAliasLookup(aliasComponents, position, thisCmp);
	}
	else if (xtypeComponents.length > 0) {
		component = xtypeComponents[0];
	}
	else if (aliasComponents.length > 0) {
		component = aliasComponents[0];
	}

	logger?.methodDone("get component by alias", logLevel, logPad, false, [["found", !!component]]);
	return component;
}


/**
 * @method getAliasLookup
 * @since 0.7.0
 *
 * Gets the component from an array of alias components by examining parent object
 * property names and matching to the alias namespace, i.e. 'layout.vbox', where
 * the 'layout' part is the namespace name
 *
 * The only true way to know what component we're looking at when referencing it by an
 * alias is to examine the position in the current document, and then the parent object
 * properties. For example, consider the parsed widget property:
 *
 *     layout: {
 *         type: 'vbox',
 *         align: 'stretch'
 *     }
 *
 * To find the class definition for the type 'vbox', we scan the widgets on the current
 * document component, find the object range that the current position lies within, and
 * examine the defintiion of the widget that's found there fot it's nameSpace property.
 * In this case, an alias name would be `layout.vbox`, `layout.hbox`, etc
 *
 * If no range and current document component were passed by the caller, the result
 * could be invalid if there's an xtype in the application with the same alias short
 * name `vbox`, or another alias of any namespace.
 *
 * In the case of a viewModel, we need to traverse up a couple objects to see if there's
 * a `stores` property, which would behave the same as a `store` node as a 1st level
 * object property.
 *
 * `Widgets` are parsed objects ina component/class file that are defined by either
 * an `xtype` or `type` property.
 *
 * @param aliasComponents The array of alias components to do the lookup on
 * @param position The cursor position within the document
 * @param thisCmp The component class of the current document
 */
export function getAliasLookup(components: IComponent[], position: IPosition | undefined, thisCmp: IComponent | undefined)
{
	let component: IComponent | undefined;

	if (components)
	{
		if (position && thisCmp) {
			for (const c of components) {
				for (const a of c.aliases) {
					thisCmp.objectRanges.filter(r => utils.isPositionInRange(position, r)).forEach(r => {
						if (r.name === a.nameSpace || (r.name === "stores" && a.nameSpace === "store")) {
							component = c;
						}
					});
				}
			}
		}
	}

	return component;
}


export function getWidgetByPosition(position: IPosition, component: IComponent)
{
    return component.widgets.find(w => isPositionInRange(position, w.range));
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


export function isPositionInRange(position: IPosition, range: IRange)
{
    if (position.line > range.start.line && position.line < range.end.line) {
        return true;
    }
    else if (position.line === range.start.line)
    {
        return position.column >= range.start.column;
    }
    else if (position.line === range.end.line)
    {
        return position.column <= range.end.column;
    }
    return false;
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

