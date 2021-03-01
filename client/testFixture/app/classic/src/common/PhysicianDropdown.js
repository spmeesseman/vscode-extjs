
/**
 * @class VSCodeExtJS.common.PhysicianDropdown
 * 
 * The Physician Dropdown.
 */
Ext.define('VSCodeExtJS.common.PhysicianDropdown', 
{
	/**
	 * @property xtype
	 * Test
	 */
	xtype: ['physiciandropdown'],
	extend: 'VSCodeExtJS.common.UserDropdown',

	/**
	 * @method getPin
	 *
	 * Test old get pin # description
	 *
	 * @deprecated Use getPinNumber()
	 */
	getPin: function()
	{
		console.log("test load physician");
	},

	/**
	 * @method getPinNumber
	 *
	 * Test get pin # description
	 * @since 1.0.0
	 */
	getPinNumber: function()
	{
		console.log("test load physician");
	},

	/**
	 * @method getPinNumberInternal
	 *
	 * Test get pin # internal description, private function
	 * 
	 * @since 1.0.0
	 * @private
	 */
	getPinNumberInternal: function()
	{
		console.log("test load physician");
	}

});