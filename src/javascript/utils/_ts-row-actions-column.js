// Ext.override(Ext.data.reader.Reader,{
//     extractData : function(root) {
//         var me = this,
//             Model   = me.model,
//             length  = root.length,
//             records = new Array(length),
//             convertedValues, node, record, i;
//
//         if (!root.length && Ext.isObject(root)) {
//             root = [root];
//             length = 1;
//         }
//
//         for (i = 0; i < length; i++) {
//             node = root[i];
//             if (node.isModel) {
//
//
//                 records[i] = node;
//             } else {
//
//
//
//                 records[i] = record = new Model(undefined, me.getId(node), node, convertedValues = {});
//
//
//
//                 record.phantom = false;
//
//                 console.log(convertedValues, node, record);
//                 if ( convertedValues && convertedValues.ObjectID ) {
//                     me.convertRecordData(convertedValues, node, record);
//                 }
//
//                 if (me.implicitIncludes && record.associations.length) {
//                     me.readAssociated(record, node);
//                 }
//             }
//         }
//
//         return records;
//     }
// });
//

/**
 * @private
 * This class specifies the definition for a row action column inside a Rally.ui.grid.Grid.
 * In general, this class will not be created directly but rather will be passed to the grid as part of a columnCfg:
 *
 *     columnCfgs: [
 *         {
 *             xtype: 'rallyrowactioncolumn',
 *             rowActionsFn: function (record) {
 *                 return [
 *                     {
 *                         xtype: 'rallyrecordmenuitemedit',
 *                         record: record
 *                     }
 *                 ];
 *             }
 *         }
 *     ]
 *
 */
 Ext.define('CArABU.technicalservices.RowActionColumn',{
    extend: 'Ext.tree.Column',
    alias: 'widget.tsrowactioncolumn',

    inheritableStatics: {
        gearIconModelTypesBlacklist: ['build', 'builddefinition', 'change', 'changeset', 'program', 'project', 'scmrepository', 'testcaseresult', 'useriterationcapacity', 'userprofile'],

        getRequiredFetchFields: function(grid) {
            return (grid.enableBulkEdit && ['Project', 'Tags']) || [];
        }
    },

    clientMetrics: {
        event: 'click',
        description: 'clicked gear menu'
    },

    /**
     * @property {Boolean} sortable False to disable sorting of this column
     *
     */
    sortable: false,
    /**
     * @property {Boolean} hideable False to disable hiding of column
     *
     */
    hideable: false,
    /**
     * @property {Boolean} resizable False to disable resizing of column
     *
     */
    resizable: false,
    /**
     * @property {Boolean} draggable False to disable reordering of a column
     *
     */
    draggable: false,
    /**
     * @property {Boolean} menuDisabled True to disable the column header menu containing sort/hide options
     *
     */
    menuDisabled: true,
    /**
     * @property {Number}
     *
     */
    flex: -1,
    minWidth: Ext.isIE9 ? 22 : 26,
    maxWidth: Ext.isIE9 ? 22 : 26,

    /**
     * @property {Boolean}
     * This column should not show up on print pages that include a printable grid
     */
    printable: false,

    tdCls: 'rally-cell-row-action',
    cls: 'row-action-column-header',

    config: {
        /**
         * @cfg {Function} rowActionsFn
         * @params record {Ext.data.Record} The record to be assigned to record menu items
         * A list of Rally.ui.menu.Menu#items objects that will be used as the row action options
         * Each row action can contain a predicate property which will be evaluated to see if the row action should be included
         * Usage:
         *      [
         *          {text: 'Move...', record: record, handler: function(){  // move this.record  }}
         *      ]
         */
        rowActionsFn: null,

        menuOptions: {},

        /**
         * @cfg {Object} scope The scope that the rowActionsFn is called with
         */
        scope: null
    },

    constructor: function() {
        this.callParent(arguments);
        this.renderer = this._renderGearIcon;
    },

    initComponent: function() {
        this.callParent(arguments);
        this.on('click', this._showMenu, this);
    },

    onDestroy: function() {
        if (this.menu) {
            this.menu.destroy();
            delete this.menu;
        }

        this.callParent(arguments);
    },

    /**
     * @private
     * @param value
     * @param metaData
     * @param record
     */
    _renderGearIcon: function(value, metaData, record) {
        metaData.tdCls = Rally.util.Test.toBrowserTestCssClass('row-action', Rally.util.Ref.getOidFromRef(record.get('_ref')));
        return '<div class="row-action-icon icon-gear"/>';
    },

    /**
     * @private
     * @param view
     * @param el
     */
    _showMenu: function(view, el) {
        var selectedRecord = view.getRecord(Ext.fly(el).parent("tr")),
            checkedRecords = view.getSelectionModel().getSelection(),
            grid = view.panel,
            defaultOptions;

        defaultOptions = {
            cls: Rally.util.Test.toBrowserTestCssClass('row-gear-menu-' + selectedRecord.getId()) + ' row-gear-menu',
            view: view,
            record: selectedRecord,
            showInlineAdd: false,
            owningEl: el.parentElement,
            popoverPlacement: ['bottom', 'top'],
            onBeforeRecordMenuCopy: function(record) {
                return grid.onBeforeRecordMenuCopy(record);
            },
            onRecordMenuCopy: function(copiedRecord, originalRecord, operation) {
                return grid.onRecordMenuCopy(copiedRecord, originalRecord, operation);
            },
            onBeforeRecordMenuDelete: function(record) {
                return grid.onBeforeRecordMenuDelete(record);
            },
            onRecordMenuDelete: function(record) {
                return grid.onRecordMenuDelete(record);
            },
            onBeforeRecordMenuRankHighest: function(record) {
                return grid.onBeforeRecordMenuRankHighest(record);
            },
            onBeforeRecordMenuRankLowest: function(record) {
                return grid.onBeforeRecordMenuRankLowest(record);
            },
            onRecordMenuRemove: function(record) {
                return grid.onRecordMenuRemove(record);
            }
        };

        if (this.rowActionsFn) {
            this.menu = Ext.create('Rally.ui.menu.RecordMenu', Ext.apply({
                items: this.rowActionsFn.call(this.scope || this, selectedRecord)
            }, defaultOptions));
        } else {
            this.menu = this._getDefaultRecordMenu(selectedRecord, defaultOptions);
        }

        this.menu.showBy(Ext.fly(el).down(".row-action-icon"));
    },

    _getDefaultRecordMenu: function(selectedRecord, defaultOptions) {
        var menu;
        var menuOptions = Ext.merge(defaultOptions, this.menuOptions || {});

        if (selectedRecord.data._type === 'milestone') {
            menu = Ext.create('CArABU.technicalservices.MilestoneMenu', menuOptions);
        } else if(/portfolioitem/.test(selectedRecord.data._type)) {
            menu = Ext.create('CArABU.technicalservices.PortfolioItemMenu', menuOptions);
        }
        return menu;
    }
});
