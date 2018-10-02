// will fire doneselected so that the dropdown will update
Ext.define('CArABU.technicalservices.SharedViewDialog',{
    extend: 'Rally.ui.dialog.SharedViewDialog',
    alias: 'widget.tssharedviewdialog',
    mixins: {
        messageable: 'Rally.Messageable',
        clientMetrics: 'Rally.clientmetrics.ClientMetricsRecordable',
        observable: 'Ext.util.Observable'
    },
    _onDoneClicked: function() {
        this.fireEvent('doneselected',this);
        this.close();
    }
});
