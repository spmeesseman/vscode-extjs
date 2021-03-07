/**
 * @class VSCodeExtJS.common.UserDropdown
 * 
 * The User Dropdown.
 * 
 * @since 1.0.0
 */
Ext.define('VSCodeExtJS.common.UserDropdown',
{
	alias: 'widget.userdropdown',

	/**
	 * @property readOnly
	 * Test variable readOnly property, set to `true` to not allow changing
	 * current selection
	 */
	readOnly: true,

	config:
	{
		/**
		 * @cfg userName
		 * System username
		 */
		userName: undefined
	},

	/**
	 * Test load description
	 */
	load: function()
	{
		console.log("test load physician");
	},

	/**
	 * @method save
	 * Test save description
	 */
	save: function()
	{
		console.log("test load physician");
	},

	/**
	 * @method
	 * Test save description
	 */
	delete: function()
	{
		console.log("test delete physician");
	}
});
