/**
 * @class VSCodeExtJS.view.users.GridController
 * 
 * Controller class for all users display grid.
 */
Ext.define('VSCodeExtJS.view.users.GridController', 
{
    extend : 'Ext.app.ViewController',
    alias : 'controller.usersgrid',


    onAction: function(action, btn)
    {
        switch (action)
        {
            case 'view':
                this.onView();
                break;
             
            case 'edit':
                this.onEdit(btn);
                break;
                
            default:
                Utils.alert('This action has not yet been implemented');
                break;
        }
    },


    onAfterRender: function(grid)
    {
        grid.setHidden(false);
        grid.setDisabled(false);
    },


    onOkClick: function(btn)
    {
        console.log("ok");
    },


    onView: function()
    {
        var me = this;
        var view = me.getView();
        var vm = view.getViewModel();
        //
        // Get the selected record
        //
        var selections = view.getSelectionModel().getSelection();        
        if (!Utils.checkOneSelected(selections, true))
        {
            return;
        }

        var selection = selections[0];
        var storeType = vm.get('storeType');
    },
       
    
    onEdit: function() 
    { 
        let me = this,
            view = me.getView(),
            vm = view.getViewModel();
        //
        // Get the selected record
        //
        const selections = view.getSelectionModel().getSelection();        
        if (!Utils.checkOneSelected(selections, true))
        {
            return;
        }

        const selection = selections[0],
              storeType = vm.get('storeType');
    },


    sayHi: function()
    {
        console.log("hi");
    }

});
