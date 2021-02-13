
Ext.define('VSCodeExtJS',
{

	requires: [
		'VSCodeExtJS.AppUtilities',
		'VSCodeExtJS.common.PatientDropdown',
		'VSCodeExtJS.common.PhysicianDropdown',
		'VSCodeExtJS.common.UserDropdown'
	],

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
	}]

});
