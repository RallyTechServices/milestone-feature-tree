
Ext.define('TSTreeModel',{
    extend: 'Ext.data.Model',
    fields: [
        { name: 'FormattedID', type: 'String' },
        { name: 'Name', type:'String' },
        { name: '_ref', type:'String' },
        { name: '_type', type:'String' },
        { name: '__parent', type:'Number'},
        { name: 'Description', type:'String' }
    ],

    // needed for popover factory
    isSearch: function() {
        return false;
    },

    inheritableStatics: {
        /**
         * @static
         * @inheritable
         * Get the specified field on the model instance
         * @param {String} identifier the name or uuid of the field to return.
         * @return {Ext.data.Field} the field object
         */
        getField: function(identifier) {
            if (Ext.isString(identifier) && identifier.indexOf(":summary") !== -1) {
                return this.getField(identifier.split(':summary')[0]);
            }

            var fields = this.getFields();
            return _.find(fields, function(field) {
                return field.name === identifier || (_.isFunction(field.getUUID) && field.getUUID() === identifier);
            }) || _.find(fields, {name: 'c_' + identifier});

        }
    }
});
