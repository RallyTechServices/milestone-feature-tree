//defaultItems use sortIndex of 0 & 1
    var SORT_INDEXES = {
        userViews: 2,
        defaultViews: 3,
        workspaceViews: 4,
        projectViews: 5
    }, GROUP_NAMES = [
        'defaultItems',
        'userViews',
        'defaultViews',
        'workspaceViews',
        'projectViews'
    ];

Ext.define('CArABU.technicalservices.SharedViewComboBox',{
    extend: 'Rally.ui.combobox.ComboBox',
    alias: 'widget.tssharedviewcombobox',

    mixins: {
        messageable: 'Rally.Messageable'
    },

    config: {
        emptyText: 'Select Saved View...',
        autoExpand: true,
        editable: true,
        typeAhead: true,
        queryMode: 'remote',
        minChars: 0,
        forceSelection: true,
        defaultSelectionPosition: null,
        displayField: 'Name',
        valueField: 'identifier',
        defaultViews: [],
        matchFieldWidth: true,
        width: 210,
        enableProjectSharing: true,
        enableUrlSharing: false,
        enableReadingUserPref: false,
        additionalFilters: [],
        suppressViewNotFoundNotification: false,
        context: null
    },

    constructor: function(config) {
        this.mergeConfig(config);
        this.config.storeConfig = this._getStoreConfig();
        this.config.listConfig = this._getListConfig();

        var id = this._getSharedViewId();

        if (id) {
            this.config.sharedViewId = id;
            this.config.value = this._formatSharedViewId(id);
        }

        this.callParent([this.config]);
    },

    initComponent: function() {
        this.callParent(arguments);

        if (this.sharedViewId && this.stateful && !this._hasState()) {
            this.applyState(this._mockSharedViewState());
        }
        this.on('select', this._selectView, this);
        this.cmp && this.cmp.on('viewstatesave', this._onCmpViewStateSave, this, { buffer: 200});
        this.on('beforestatesave', function() {
            return !!this.store.getRange().length;
        }, this);
        this.subscribe(this, Rally.Message.objectCreate, this._onObjectCreate, this);
        this.subscribe(this, Rally.Message.objectUpdate, this._onObjectChange, this);
        this.subscribe(this, Rally.Message.objectDestroy, this._onObjectDestroy, this);
    },

    onKeyDown: function(e) {
        this.callParent(arguments);
        if (e.getKey() === e.ESC) {
            this.triggerBlur();
            this.doQuery(this.allQuery);
            this.inputEl.blur();
        }
    },

    beforeQuery: function(queryPlan) {
        var queryString = queryPlan.query,
            storeFilters = this.store && this.store.filters.getRange(),
            queryFilter = Rally.data.wsapi.Filter.and(storeFilters);

        if (queryString) {
            queryFilter = queryFilter.and({
                property: 'Name',
                operator: 'contains',
                value: queryString
            });
            this._searching = true;
        } else {
            delete this._searching;
        }

        queryPlan.query = queryFilter.toString();
        return this.callParent(arguments);
    },

    getState: function() {
        var record = this.getRecord(), state = {};
        if (record) {
            state.value = record.get('identifier');
            if (this._isSharedView(record)) {
                state.objectId = record.get('ObjectID');
                state.versionId = record.get('VersionId');
            }
        }
        return state;
    },

    applyState: function(state) {
        var selectedView = this._hasState() ? Ext.state.Manager.get(this.stateId) : {};

        if (this._shouldOverrideState(state)) {
            Ext.apply(state, this._mockSharedViewState());
        } else {
            this.sharedViewId = Rally.util.Ref.getOidFromRef(state.value) || state.value;
        }

        this.on('defaultsset', function() {
            this.setValue(state.value);
            var currentValue = this.getRecord();
            if (currentValue && this._isDefaultView(currentValue) && selectedView.value !== this.sharedViewId) {
                this._applyView(this._decodeValue(currentValue));
            } else {
                this.saveState();
            }
            delete this.sharedViewId;
        }, this, {single: true});

        this._ensureLatestView(state);
    },

    saveState: function() {
        this._applyParameters();
        this.callParent(arguments);
    },

    onBeforeSelect: function(combo, record) {
        var isDefaultItem = this._isDefaultItem(record);
        if (isDefaultItem) {
            this.collapse();
            this._createSharedViewDialog(record);
        }
        return !isDefaultItem;
    },

    onDestroy: function() {
        if (this.dialog) {
            this.dialog.destroy();
            delete this.dialog;
        }
        this.callParent(arguments);
    },

    onTriggerClick: function() {
        if(this._searching){
            this.callParent(arguments);
        } else {
            if (this.isExpanded) {
                this.collapse();
            } else {
                this.expand();
            }
        }
    },

    _mockSharedViewState: function() {
        var state = {
            value: this._formatSharedViewId(this.sharedViewId)
        };

        if (this._isNonDefaultViewIdentifier()) {
            state.objectId = this.sharedViewId;
            state.versionId = -1;
        }

        return state;
    },

    _hasState: function(){
        if (this.stateful && this.stateId) {
            return !!Ext.state.Manager.get(this.stateId);
        }
        return false;
    },

    _formatSharedViewId: function(id) {
        return (id + '').length > 2 ? '/preference/' + id : id;
    },

    _shouldOverrideState: function(state) {
        var stateValue = Rally.util.Ref.getOidFromRef(state.value) || state.value;
        return this.sharedViewId && (this.sharedViewId !== stateValue);
    },

    _ensureLatestView: function(state){
        if (state.objectId && state.versionId) {
            this.store.model.load(state.objectId, {
                fetch: ['VersionId', 'Value'],
                success: function (record) {
                    if(record && record.get('VersionId') !== state.versionId) {
                        this.store.on('load', function(){
                            this._applyView(this._decodeValue(record));
                        }, this, {single: true});
                    }
                },
                scope: this
            });
        }
    },

    _onObjectChange: function(record) {
        if (this._isViewPreference(record)) {
            this.setValue(record.get('_ref'));
            this.store.reload();
        }
    },

    _onObjectCreate: function(record) {
        if (this._isViewPreference(record)) {
            this.store.add(new this.store.model(record.data));
            this.setValue(record.get('_ref'));
            if (this.picker) {
                this.picker.refresh();
            }
        }
    },

    _onObjectDestroy: function(record) {
        if (this._isViewPreference(record)) {
            if (this.getValue() === record.get('_ref')) {
                this._clearParameters();
            }
            this.store.reload();
        }
    },

    _getProxy: function(){
        var modelFactory = Rally.data.wsapi.ModelFactory,
            wsapiVersion = Rally.environment.getServer().getWsapiVersion(),
            url = modelFactory.buildProxyUrl('Preference', wsapiVersion);
        return modelFactory.buildProxy(url, 'Preference', null, wsapiVersion);
    },

    _getStoreConfig: function() {

        return {
            autoLoad: true,
            remoteFilter: true,
            remoteSort: false,
            sortOnLoad: true,
            proxy: this._getProxy(),
            fetch: ['ObjectID', 'User', 'Name', 'VersionId', 'Project'],
            fields: [
                'ObjectID',
                'User',
                'Value',
                'VersionId',
                'Project',
                {
                    name: 'Name',
                    type: 'string',
                    sortType: 'asUCString'
                },
                {
                    name: 'groupName',
                    type: 'string',
                    convert: function(value, record) {
                        return value || (record.get('User') ? 'userViews' : (record.get('Project') ? 'projectViews' : 'workspaceViews'));
                    }
                },
                {
                    name: 'sortIndex',
                    type: 'int',
                    convert: function(value, record) {
                        return Ext.isEmpty(value) ? SORT_INDEXES[record.get('groupName')] : value;
                    }
                },
                {
                    name: 'identifier',
                    type: 'string',
                    convert: function(value, record) {
                        return value || record.raw._ref;
                    }
                }
            ],
            filters: this._getFilters(),
            sorters: [
                {
                    property: 'sortIndex',
                    direction: 'ASC'
                },
                {
                    property: 'Name',
                    direction: 'ASC'
                }
            ],
            listeners: {
                load: this._addDefaultViews,
                scope: this
            }
        };
    },

    _getFilters: function() {
        var context = this.getContext(),
            filters = [
                {
                    property: 'AppId',
                    operator: '=',
                    value: context.getAppId()
                },
                {
                    property: 'Type',
                    operator: '=',
                    value: 'View'
                },
                {
                    property: 'Workspace',
                    operator: '=',
                    value: Rally.util.Ref.getRelativeUri(context.getWorkspaceRef())
                },
                Rally.data.wsapi.Filter.or([
                    {
                        property: 'User',
                        operator: '=',
                        value: Rally.util.Ref.getRelativeUri(context.getUser())
                    },
                    Rally.data.wsapi.Filter.and([
                        {
                            property: 'User',
                            operator: '=',
                            value: null
                        },
                        {
                            property: 'Project',
                            operator: '=',
                            value: null
                        }
                    ]),
                    {
                        property: 'Project',
                        operator: '=',
                        value: context.getProjectRef()
                    }
                ])
            ];

        if (!_.isEmpty(this.additionalFilters)) {
            filters = filters.concat(this.additionalFilters);
        }

        return filters;
    },

    _getDefaultItems: function() {
        return [
            { Name: 'Save New View...', identifier: 'saveNewView', groupName: 'defaultItems', sortIndex: 0},
            { Name: 'Manage Saved Views...', identifier: 'manageSavedView', groupName: 'defaultItems', sortIndex: 1}
        ];
    },

    _getDefaultViews: function() {
        var defaultViews = _.map(this.getDefaultViews(), function(defaultView) {
                return _.assign(defaultView, {
                    groupName: 'defaultViews',
                    sortIndex: SORT_INDEXES.defaultViews
                });
            }),
            filteredViews = _.filter(defaultViews, function(view) {
                if (this._searching){
                    return view.Name.toLowerCase().indexOf(this.getValue().toLowerCase()) >= 0;
                }
                return true;
            }, this);
        return filteredViews;
    },

    _addDefaultViews: function() {

        if (this.store) {
            this.store.add(this._getDefaultItems().concat(this._getDefaultViews()));
        }

        if (this._savedViewNotInStore()) {
            this._insertViewIntoStore();
        } else {
            this.fireEvent('defaultsset', this);
        }

        if (this.picker) {
            this.picker.refresh();
        }
    },

    _savedViewNotInStore: function() {
      return !this._searching && this.sharedViewId && this.store.find("identifier", this._formatSharedViewId(this.sharedViewId)) === -1;
    },

    _insertViewIntoStore: function() {

        var filters = this._getFilters(),
            store = this.store;
        filters.push({property: 'ObjectID', value: this.sharedViewId});

        store.suspendEvents(true);

        if (this.enableReadingUserPref) {
            store.model.load(this.sharedViewId, {
                fetch: store.fetch,
                success: function (record) {
                    store.add(record);
                    store.resumeEvents();
                    this.setValue(record);
                    this.fireEvent('defaultsset', this);
                },
                failure: function() {
                    store.resumeEvents();
                    this._clearParameters();
                    if (!this.suppressViewNotFoundNotification) {
                        this.suppressViewNotFoundNotification = false;
                        Rally.ui.notify.Notifier.showWarning({message: 'The view you are seeking has been removed or you do not have access to view it.'});
                    }
                    this.fireEvent('defaultsset', this);
                },
                scope: this
            });
        } else {
            Ext.create('Rally.data.wsapi.Store', {
                model: store.model,
                autoLoad: true,
                listeners: {
                    load: function (storeForRecordToInsert, data) {
                        if (data.length) {
                            var record = _.first(data);
                            store.add(record);
                            store.resumeEvents();
                            this.setValue(record);
                        } else {
                            store.resumeEvents();
                            this._clearParameters();
                            Rally.ui.notify.Notifier.showWarning({message: 'The view you are seeking has been removed or you do not have access to view it.'});
                        }
                        this.fireEvent('defaultsset', this);
                    },
                    scope: this
                },
                fetch: store.fetch,
                filters: filters
            });
        }
    },

    _getListConfig: function() {
        var itemTpl = '<div role="option" unselectable="on" class="' + Ext.baseCSSPrefix + 'boundlist-item">{' + this.displayField + '}</div>';
        return {
            cls: 'rally-shared-view-list',
            loadMask: false,
            emptyText: 'No matching views',
            height: 400,
            tpl: [
                '<div class="default-items ' + Ext.plainListCls + '">',
                    '<tpl for="defaultItems">',
                        '<div role="option" unselectable="on" class="default-item ' + Ext.baseCSSPrefix + 'boundlist-item action-item">{Name}</div>',
                    '</tpl>',
                '</div>',
                '<div class="view-items ' + Ext.plainListCls + '" style="">',
                    '<tpl if="userViews.length">',
                        '<div class="rally-group-header multi-object-picker-header">My Views</div>',
                        '<tpl for="userViews">',
                            itemTpl,
                        '</tpl>',
                    '</tpl>',
                    '<tpl if="defaultViews.length">',
                        '<div class="rally-group-header multi-object-picker-header">Default Views</div>',
                        '<tpl for="defaultViews">',
                            itemTpl,
                        '</tpl>',
                    '</tpl>',
                    '<tpl if="workspaceViews.length">',
                        '<div class="rally-group-header multi-object-picker-header">Workspace Shared Views</div>',
                        '<tpl for="workspaceViews">',
                            itemTpl,
                        '</tpl>',
                    '</tpl>',
                    '<tpl if="projectViews.length">',
                        '<div class="rally-group-header multi-object-picker-header">Project Shared Views</div>',
                        '<tpl for="projectViews">',
                            itemTpl,
                        '</tpl>',
                    '</tpl>',
                '</ul>'
            ],
            collectData: function (records, startIndex) {
                var data = this.superclass.collectData.call(this, records, startIndex);
                _.each(GROUP_NAMES, function(groupName){
                    data[groupName] = _.filter(data, {groupName: groupName});
                }, this);
                return data;
            },
            highlightItem: function(item) {
                this.setHighlightedItem(item);

                var el = Ext.get(item);
                if (el) {
                    var container = el.up('.view-items');
                    if (container) {
                        var itemTop = el.getRegion().top,
                            itemBottom = el.getRegion().bottom,
                            containerTop = container.getRegion().top,
                            containerBottom = container.getRegion().bottom;

                        if (itemTop < containerTop) {
                            item.scrollIntoView(container, false, false, false);
                        }

                        if (itemTop > containerBottom ){
                            item.scrollIntoView(container, false, false, false);
                        }

                        if (itemBottom > containerBottom ){
                            item.scrollIntoView(container, false, false, false);
                        }

                        itemTop = el.getRegion().top;
                        if (itemTop === containerTop) {
                            var previousSibling = Ext.get(item.previousSibling);
                            if (previousSibling && previousSibling.hasCls('rally-group-header')) {
                                container.scroll('up', previousSibling.getHeight(), false);
                            }
                        }
                    }
                }
            }
        };
    },

    _createSharedViewDialog: function(record){
        var me = this;
        this.dialog = Ext.widget({
            xtype: 'tssharedviewdialog',
            cmp: this.cmp,
            enableProjectSharing: this.enableProjectSharing,
            addNewConfig: {
                expanded: record.get(this.valueField) === 'saveNewView',
                listeners: {
                    boxready: function(cmp) {
                        if(cmp.expanded) {
                            cmp.getNameField().inputEl.focus(200);
                        }
                    }
                }
            },
            additionalFilters: this.additionalFilters,
            context: this.getContext(),
            listeners: {
                doneselected: function(dialog){
                    me.getStore().reload();
                }
            }
        });
    },

    _onCmpViewStateSave: function() {
        delete this.originalValue;
        this.reset();
    },

    reset: function(){
        this._clearParameters();
        this.callParent();
    },

    _isViewPreference: function(record){
        return record.self.typePath === 'preference' &&
            record.get('Type') === 'View' &&
            record.get('AppId') === this.getContext().getAppId();
    },

    _isSharedView: function(record){
        return record.get('groupName') === 'workspaceViews' ||
            record.get('groupName') === 'projectViews';
    },

    _isDefaultItem: function(record) {
        return record.get('groupName') === 'defaultItems';
    },

    _isDefaultView: function(record) {
        return record.get('groupName') === 'defaultViews';
    },

    _decodeValue: function(record) {
        return Ext.JSON.decode(record.get('Value'), true);
    },

    _isNonDefaultViewIdentifier: function() {
        return (this.sharedViewId + '').length > 2;
    },

    _getValue: function(record){
        var deferred = new Deft.Deferred();

        if (this._isDefaultView(record)) {
            deferred.resolve(this._decodeValue(record));
        } else {
            this.store.model.load(record.get('ObjectID'), {
                fetch: ['Value'],
                success: function (record) {
                    deferred.resolve(this._decodeValue(record));
                },
                scope: this
            });
        }
        return deferred.promise;
    },

    _applyView: function(view) {
        if (_.isFunction(this.cmp.setCurrentView)) {
            this.saveState();
            this.cmp.setCurrentView(view);
        }
    },

    _getSharedViewId: function() {
        if (this.enableUrlSharing) {
            var sharedViewParam = this.getSharedViewParam();
            if (Ext.isNumeric(sharedViewParam)) {
                return +sharedViewParam;
            }
        }
    },

    getSharedViewParam: function() {
        var hash = window.location.hash,
            matches = hash.match(/sharedViewId=(\d+)/);

        return matches && matches[1];
    },

    _applyParameters: function(){
        if (this.enableUrlSharing) {
            var record = this.getRecord();
            if (record) {
                var identifier = this.getRecord().get('identifier'),
                    viewId = Rally.util.Ref.isRefUri(identifier) ? Rally.util.Ref.getOidFromRef(identifier) : identifier;
                Rally.nav.Manager.applyParameters({sharedViewId: viewId}, false);
            }
        }
    },

    _clearParameters: function(){
        Rally.nav.Manager.applyParameters({}, false, ['sharedViewId']);
    },

    _selectView: function(){
        this._getValue(this.getRecord()).then({
            success: this._applyView,
            scope: this
        });
    },

    getContext: function() {
        return this.context;
    }

});
