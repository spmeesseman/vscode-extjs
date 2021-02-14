
Ext.define('VSCodeExtJS',
{

	requires: [
		'VSCodeExtJS.AppUtilities',
		'VSCodeExtJS.common.PatientDropdown',
		'VSCodeExtJS.common.PhysicianDropdown',
		'VSCodeExtJS.common.UserDropdown'
	],

	config:
	{
		test: true,
		test2: false
	},

	items: [
	{
		xtype: "physiciandropdown"
	},
	{
		xtype: "patientdropdown"
	},
	{
		xtype: 'userdropdown'
	},
	{
		xtype: 'form'
	},
	{
		xtype: 'component'
	}],

	/**
	 * Test fn description
	 * @param {*} a Test a
	 * @param {*} b Test b
	 */
	testFn: function(a, b)
	{
		testFn2(1, 2);
	},

	/**
	 * Test fn description
	 * @param {*} a Test a
	 * @param {*} b Test b
	 */
	testFn2: function(a, b)
	{
		testFn(1, 2);
	} 

});
