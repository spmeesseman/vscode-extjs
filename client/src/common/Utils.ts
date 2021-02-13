function isNeedRequire(componentClass: string) {
	if (componentClass.startsWith('Ext.')) {
		return false;
	}
	return true;
}

export { isNeedRequire };

