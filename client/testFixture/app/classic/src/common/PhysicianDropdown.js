
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
	 *
	 * @returns {String} Pin #
	 */
	getPin: function()
	{
		return "1111";
	},

	/**
	 * @method getPinNumber
	 *
	 * Test get pin # description
	 * @since 1.0.0
	 * @returns {String} Pin #
	 */
	getPinNumber: function()
	{
		return "1111";
	},

	/**
	 * @method getPinNumberInternal
	 *
	 * Test get pin # internal description, private function
	 * 
	 * @since 1.0.2
	 * @private
	 * @returns {String} Pin #
	 */
	getPinNumberInternal: function()
	{
		return "1212";
	}

});