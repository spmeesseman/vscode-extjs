/**
 * @class VSCodeExtJS
 * 
 * The VSCodeExtJS app root namespace.
 */
Ext.define('VSCodeExtJS',
{

	requires: [
		'VSCodeExtJS.AppUtilities',
		'VSCodeExtJS.common.PatientDropdown',
		'VSCodeExtJS.common.PhysicianDropdown'
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
		xtype: "patieuntdropdown"
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
		console.log(1, 2);
	},

	/**
	 * Test fn description
	 * @param {String} a Test a
	 * @param {VSCodeExtJS.common.PhysicianDropdown} b Test b
	 */
	testFn2: function(a, b)
	{
		this.testFn(1, 2);
CCC
		console.log(this.test);
		console.log(this.test3);
		console.log(this.getTest());
		this.setTest(1);
		VSCodeExtJS.AppUtilities.alertError("This is a test");
		AppUtils.alertError("This is a test");

		VSCodeExtJS.common.PhysicianDropdown.create();
		VSCodeExtJS.common.UserDropdown.create();
        
		const phys = Ext.create("VSCodeExtJS.common.PhysicianDropdown", {
			hidden: false,
			disabled: true
		});
		const pin = phys.getPinNumber();
		phys.delete();

		const phys2 = new VSCodeExtJS.common.PhysicianDropdown({
			hidden: false,
			disabled: true
		});
		phys2.save(a);

		const phys3 = VSCodeExtJS.common.PhysicianDropdown.create({
			hidden: false,
			disabled: true
		});
		phys3.load(b);
        
	},

	/**
	 * Test fn3 description
	 * @param {String} a Test3 a
	 * @param {Boolean} b Test3 b
	 */
	testFn3: function(a, b)
	{
		const me = this,
		      test = me.getTest();
        
		me.testFn2();
		this.testFn();

		const grid = Ext.create("Ext.grid.Panel", {
			hidden: false,
			disabled: true
		});
		grid.show();
	} 

});
