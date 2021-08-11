/**
 * @class VSCodeExtJS.main.Main
 * 
 * The VSCodeExtJS.main.Main namespace.
 */
 Ext.define('VSCodeExtJS.main.Main',
 {
	/**
	 * @property prop1
	 * Test property #1
	 */
	prop1: true,
	/**
	 * @property prop2
	 * Test property #2
	 */
	prop2: false,

	config:
	{
		/**
		 * @cfg cfg1
		 * Config property #1
		 */
		cfg1: true,
		/**
		 * @cfg cfg2
		 * Config property #2
		 */
		 cfg2: false
	},

	items: [
	{
		xtype: "physiciandropdown"
	},
	{
		xtype: 'userdropdown'
	}]

});