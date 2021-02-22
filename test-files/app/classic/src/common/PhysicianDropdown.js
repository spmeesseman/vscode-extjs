
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
	 * Test get pin # description
	 */
	getPinNumber: function()
	{
		console.log("test load physician");
	}

});