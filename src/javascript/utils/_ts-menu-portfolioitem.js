/**
 * @private
 * Gear menu shown by default on rows of Rally.ui.grid.Grids and Rally.ui.cardboard.Cards of boards.
 */
Ext.define('CArABU.technicalservices.PortfolioItemMenu', {
    extend: 'Rally.ui.menu.RecordMenu',
    alias: 'widget.tsportfolioitemrecordmenu',

    mixins: {
        messageagble: 'Rally.Messageable'
    },

    config: {

        /**
         * @cfg {Rally.data.Model} record (required)
         * The record to build the menu for
         */
        record: null,

        /**
         * @cfg {Rally.data.Model} parentRecord
         * The record this item is associated with for the purposes of building this menu
         */
        associatedRecord: null,

        /**
         * @cfg {Function} onBeforeRecordMenuCopy
         * Function to execute before copying a record from the gear menu. Return false to not perform the action.
         * @param {Rally.data.Model} record The record that is being acted on.
         */
        onBeforeRecordMenuCopy: Ext.emptyFn,

        /**
         * @cfg {Function} onRecordMenuCopy
         * Function to execute after copying a record from the gear menu.
         * @param {Rally.data.Model} record The record that was acted on.
         */
        onRecordMenuCopy: Ext.emptyFn,

        /**
         * @cfg {Function} onBeforeRecordMenuDelete
         * Function to execute before deleting a record from the gear menu. Return false to not perform the action.
         * @param {Rally.data.Model} record The record that is being acted on.
         */
        onBeforeRecordMenuDelete: Ext.emptyFn,

        /**
         * @cfg {Function} onRecordMenuDelete
         * Function to execute after deleting a record from the gear menu.
         * @param {Rally.data.Model} record The record that was acted on.
         */
        onRecordMenuDelete: Ext.emptyFn,

        /**
         * @cfg {Function} onBeforeRecordMenuRankHighest
         * Function to execute before ranking a record highest from the gear menu. Return false to not perform the action.
         * @param {Rally.data.Model} record The record that is being acted on.
         */
        onBeforeRecordMenuRankHighest: Ext.emptyFn,

        /**
         * @cfg {Function} onBeforeRecordMenuRankLowest
         * Function to execute before ranking a record highest from the gear menu. Return false to not perform the action.
         * @param {Rally.data.Model} record The record that is being acted on.
         */
        onBeforeRecordMenuRankLowest: Ext.emptyFn,

        /**
         * @inheritdoc Rally.ui.menu.RankExtremeMenuItem#rankRecordHelper
         */
        rankRecordHelper: {
            findRecordToRankAgainst: Ext.emptyFn,
            getMoveToPositionStore: Ext.emptyFn
        }

    },

    initComponent: function() {
        this.items = this._getMenuItems();
        this.callParent(arguments);
    },

    _getMenuItems: function() {
        var record = this.getRecord(),
            items = [];

        record.isUpdatable = function() { return true; };
        record.isUserStory = function() { return false; };
        record.isDefect = function() { return false; };
        record.isTask = function() { return false; };
        record.isPortfolioItem = function() { return true; };
        record.isMilestone = function() { return false; };

        items.push({
            xtype: 'rallyrecordmenuitemedit',
            record: record
        });

        items.push({
            xtype:'tsrecordmenuitemremove',
            record: record,
            view: this.view
        });

        items.push(
            {
                xtype: 'menuseparator'
            }
        );

        return items;
    }
});
