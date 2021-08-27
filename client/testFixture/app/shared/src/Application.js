/**
 * @class GEMS.Application
 *
 * The main application class. An instance of this class is created by app.js when it
 * calls Ext.application(). This is the ideal place to handle application launch and
 * initialization details.
 * 
 */
Ext.define('VSCodeExtJS.Application',
{
    extend: 'Ext.app.Application',
    name: 'VSCodeExtJSApp',

    requires: [
        'VSCodeExtJS'
    ],

    models: [
        'VSCodeExtJS.model.User'
    ],

    statics:
    {
        user: null,
        masterUser: null
    },
    
    launch: function() 
    {
        Ext.ariaWarn = Ext.emptyFn;

        var loginCfg = {
            xtype: 'login',
            viewModel: {
                data: {
                    user: 1
                }
            }
        };
        if (Ext.platformTags.desktop) {
            Ext.create(loginCfg);
        }
        else {
            Ext.Viewport.add(loginCfg);
        }
    }
});
