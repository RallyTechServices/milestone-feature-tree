Ext.define('CArABU.technicalservices.RemoveMenuItem', {
    alias:'widget.tsrecordmenuitemremove',
    extend:'Rally.ui.menu.item.RecordMenuItem',
    requires: [
        'Rally.nav.Manager',
        'Rally.ui.detail.DetailHelper'
    ],

    config:{
        predicate: function(record) {
            return record.isUpdatable();
        },

        handler: function() {
            console.log('record',this.record);
        },

        text: 'Remove...'
    }
});
