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

		console.log(this.test);
		console.log(this.test3);
		console.log(this.getTest());
		this.setTest(1);
		VSCodeExtJS.AppUtilities.alertError("This is a test");
		AppUtils.alertError("This is a test");
		const str = this.testFn5();
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
	},

	testFn4: function(a, b)
	{
		const patient = Ext.create('VSCodeExtJS.common.PatientDropdown', {
			
		});
		const phys = Ext.create('VSCodeExtJS.common.PhysicianDropdown', {
			
		});
	},

	/**
	 * @method testFn5
	 * Test fn5 description
	 * @returns {String} The string
	 */
	testFn5: function()
	{
		return "string";
	},

	/**
	 * @method testFn6
	 * Test fn6 description
	 */
	testFn6: function()
	{
		let cmp = this.down('physiciandropdown');
		cmp.load("test");
	},

	testFn7: function()
	{
		me.test3 = AppUtils.alertError("test");
	},

	testFn8: function(physName)
	{
		const phys = Ext.define({
			xtype: "physiciandropdown",
			name: physName,
			
		})
		return phys;
	},

	dockedItems: [
	{
		xtype: "physiciandropdown",

	},
	{ 
		xtype: "patientdropdown",

	},
	{
		xtype: 'userdropdown',
		
	},
	{
		xtype: 'tbseparator',
	},
	{
		xtype: 'textfield',

	}]

});
