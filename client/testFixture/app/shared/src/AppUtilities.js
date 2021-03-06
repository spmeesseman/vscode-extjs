/**
 * @class VSCodeExtJS.AppUtilities
 * 
 * The AppUtils namespace provides a set of common functions.
 * 
 * @singleton
 */
Ext.define('VSCodeExtJS.AppUtilities', 
{
    /**
     * Utility class
     */
    alias: 'AppUtils', 
    alternateClassName: 'AppUtils',
    singleton: true,

    requires: [ 
        
    ],
    
    /**
     * @property {String} privateProperty
     * @private
     * A private property
     */
    privateProperty: 'private',

    /**
     * @property {String} publicProperty
     * A public property
     */
    publicProperty: 'private',

    /**
     * Displays a popup message to the user in the case of an application error.
     * 
     * Note this function will also make an entry in the application_error table.
     *
     * Example:
     *
     *     AppUtils.alertError('Scott wasnt tired today', 127);
     * 
     * @param {String} msg The specific error message.
     *     
     * @param {Number} [code=128] The error code, can be one of the following:
     * 
     *     127 - Client Error
     *     128 - Client General
     * 
     * @param {Boolean} [showHelpDeskBtn=true]  Show the button to open a help desk ticket
     * User can select whetheror not to submit a ticket, or close and proceed.
     * 
     * @param {Number} [helpType=1] Type of help request, can be one of the following:
     *     1 - Bug Report
     *     2 - Feature Request
     *     3 - Quality Issue
     *     4 - Tech Support
     * 
     * @param {Function} fn Callback function
     * 
     * @returns {Boolean} `true` if user selected ok button, `false` otherwise
    */
    alertError: function(msg, code, showHelpDeskBtn, helpType, fn)
    {
        return true;
    }

});
