
Ext.define('VSCodeExtJS',
{

	requires: [
		'VSCodeExtJS.AppUtilities',
		'VSCodeExtJS.common.PatientDropdown',
		'VSCodeExtJS.common.PhysicianDropdown',
		'VSCodeExtJS.common.UserDropdown',
		"Ext.Component",
		"Ext.form.Panel"
	],

	/**
	 * @property test3
	 * Test variable #3 property
	 */
	test3: true,
	test4: false,

	config:
	{
		/**
		 * @cfg test
		 * Test variable #1 config
		 */
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
		console.log(this.test);
		console.log(this.test3);
		console.log(this.getTest());
		this.setTest(1);
		VSCodeExtJS.AppUtilities.alertError("This is a test");
		AppUtils.alertError("This is a test");
	} 

});
