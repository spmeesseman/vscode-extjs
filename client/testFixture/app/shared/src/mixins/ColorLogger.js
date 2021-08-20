/**
 * @class VSCodeExtJS.mixins.XLogger
 * @since 0.5.0
 * 
 */
Ext.define('VSCodeExtJS.mixins.ColorLogger',
{
    alias: 'widget.colorlogger',
    mixinId: 'colorLogger',
    
    /**
     * @property {String} logTag The tag to use when logging with {@link Ext.csi.Log}
     * @readonly
     * @private
     */
    logTag: '[TAG]',

    /**
     * @property {String} logTagColor The tag color to use when logging with {@link Ext.csi.Log}
     * @readonly
     * @private
     */
    logTagColor: '#0000DD',

    /**
     * File specific logger that uses colored log tags to distinguigh console output
     * Calls {@link Ext.csi.Log#write Log.write()}
     * @private
     * @param {String} msg The message to log
     * @param {String} [lvl] The logging level of this message, must be 0-5
     */
    xLog: function(msg, lvl)
    {
        Log.write(msg, lvl, false, false, null, this.logTag, this.logTagColor);
    },


    /**
     * File specific logger that uses colored log tags to distinguigh console output.
     * Calls {@link Ext.csi.Log#value Log.value()}
     * @private
     * @param {String} msg The message to log
     * @param {Object|String|Array} value The value to log
     * @param {Number} [lvl] The logging level of this message, must be 0-5
     */
    xVal: function(msg, value, lvl)
    {
        Log.value(msg, value, lvl, false, false, this.logTag, this.logTagColor);
    }

});
