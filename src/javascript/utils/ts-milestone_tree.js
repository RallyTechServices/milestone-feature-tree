 Ext.define('CArABU.technicalservices.MilestonTree', {
    extend: 'Ext.container.Container',
    alias: 'widget.tsmilestonetree',
    columns: [],
    cls: 'rally-grid',
    tree_cls: 'ts-rally-grid',
    /**
     * @cfg {String} targetFilter
     *
     * WSAPI query to be applied at the target level
     *
     */
    targetFilter: '(ObjectID > 0)',
    /**
     * @cfg {String} targetType
     *
     * Model type path that the query and scope will be applied to (and the tree built from)
     *
     */
    targetType: 'Milestone',
    /**
     *
     * @type Number targetChunk
     *
     * When searching for parents of the target type, we pass along an array of
     * ObjectIDs (so it's not one call per item and we get fewer calls to the server),
     * but the length of that get is limited.  Instead of calculating the best length,
     * we just define a number of OIDs to shove into the call
     */
    targetChunk: 100,

    context: null,

    respectScopeForChildren: true,


    /**
     * @type Boolean limitToInScopeFeatures
     *
     * When presenting Milestones, only include the ones that have features that are in scope
     */
    limitToInScopeFeatures: true,

    layout: 'border',
    //autoScroll: true,

    initComponent: function() {
        if ( this.columns.length == 0 ) { throw("Missing required setting: columns"); }

        this.callParent();
        this.addEvents(
            /**
             * @event aftertree
             * Fires when the tree has been created and placed on the page.
             * @param {Rally.technicalservices.InsideOutTree} this
             * @param {Ext.tree.Panel} tree
             */
            'aftertree',
            /**
             * @event afterloadtargets
             * Fires when data has been collected from the initial target query
             * @param {Rally.technicalservices.InsideOutTree} this
             */
            'afterloadtargets',
            /**
             * @event afterload
             * Fires when data has been collected from the parents and children
             * @param {Rally.technicalservices.InsideOutTree} this
             */
            'afterload'
         );
    },
    initItems: function() {
        this.callParent();
        this._fetchPortfolioNames().then({
            scope: this,
            success: function(pi_model_names){
                this.lowestPIName = pi_model_names[0];
                this.logger.log('Lowest PI Name:', this.lowestPIName);

                this._gatherData().then({
                    scope: this,
                    success:function(all_unordered_items){
                        this.fireEvent('afterload',this);

                        var ordered_items = CArABU.technicalservices.util.TreeBuilding.constructRootItems(all_unordered_items);

                        if ( this.limitToInScopeFeatures ) {
                            ordered_items = CArABU.technicalservices.util.TreeBuilding.removeRootsWithoutChildren(ordered_items);
                        }
                        var calculated_items = this._doColumnCalculations(ordered_items);
                        var ordered_items_as_hashes = CArABU.technicalservices.util.TreeBuilding.convertModelsToHashes(calculated_items);

                        this._makeStoreAndShowGrid(ordered_items_as_hashes);
                    },
                    failure:function(error_msg){
                        this.fireEvent('aftertree',this);
                        this.add({xtype:'container',html:error_msg});
                    }
                });
            },
            failure: function(error_msg){
                this.fireEvent('aftertree',this);
                this.add({xtype:'container',html:error_msg});
            }
        });
    },
    _gatherData:function(){
        var deferred = Ext.create('Deft.Deferred');
        this._fetchTargetItems().then({
            scope: this,
            success:function(target_items){
                var target_items_by_oid = {},
                    me = this;

                Ext.Array.each(target_items,function(item){
                    target_items_by_oid[item.get('ObjectID')] = item;
                });
                this.fireEvent('afterloadtargets',this,target_items);
                var promises = [];

                promises.push(function(){
                    return me._fetchChildItems(target_items,target_items_by_oid);
                });

                this.logger.log('start sequence');
                Deft.Chain.sequence(promises).then({
                    scope: this,
                    success: function(all_unordered_items){
                        var flattened_array = Ext.Array.flatten(all_unordered_items);
                        var all_unordered_items_hash = {};
                        if ( flattened_array.length > 0 ) {
                            all_unordered_items_hash = flattened_array[0];
                        }
                        deferred.resolve(all_unordered_items_hash);
                    },
                    failure: function(error_msg) { deferred.reject(error_msg); }
                });
            },
            failure:function(error_msg){ deferred.reject(error_msg); }
        });
        return deferred;
    },
    // The target items are items at the starting level -- query and scope applies
    _fetchTargetItems: function(){
        var deferred = Ext.create('Deft.Deferred');

        var query = '( ObjectID > 0 )';

        if ( this.targetFilter ){
            query = this.targetFilter;
        }

        var filters = null;
        if ( query instanceof Rally.data.wsapi.Filter ) {
            filters = query;
        } else {
            try {
                var filters = Rally.data.wsapi.Filter.fromQueryString(query);
            } catch(e) {
                deferred.reject("Filter is poorly constructed");
            }
        }

        Ext.create('Rally.data.wsapi.Store', {
            autoLoad: true,
            model: this.targetType,
            fetch: this._getFetchNames(),
            filters:filters,
            limit:'Infinity',
            listeners:  {
                scope: this,
                load: function(store, records, success){
                    if (success) {
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Error loading ' + this.targetType + ' items');
                    }
               }
           }
        });
        return deferred.promise;
    },
    _fetchChildItems: function(parent_items,fetched_items, deferred){
        if ( !deferred ) {
            deferred = Ext.create('Deft.Deferred');
        }

        var parent_oids = Ext.Array.map(parent_items, function(parent){
            return parent.get('ObjectID');
        });

        var promises = [];

        var number_of_oids = parent_oids.length;

        if (number_of_oids > 0 ) {
            this.logger.log("Searching children in chunks of " + this.targetChunk + " parents");
            for ( var i=0; i<number_of_oids; i+=this.targetChunk ) {
                var chunk_array = parent_oids.slice(i,i+this.targetChunk);
                promises.push(this._fetchByArrayOfValues(this.lowestPIName,chunk_array,"Milestones.ObjectID"));
            }
        }


        if (promises.length > 0) {
            Deft.Promise.all(promises).then({
                scope: this,
                success: function(results) {
                    var children = Ext.Array.flatten(results);
                    Ext.Array.each(children,function(child){
                        if ( !fetched_items[child.get('ObjectID') ] ) {
                            var parent = this._getParentFrom(child);
                            fetched_items[child.get('ObjectID')] = child;
                        }
                    },this);
                    // recurse if we were drilling down
                    this._fetchChildItems(children,fetched_items,deferred);
                },
                failure: function(error_msg){ deferred.reject(error_msg); }
            });
        } else {
            deferred.resolve(fetched_items);
        }
        return deferred.promise;
    },

    _getParentFrom:function(child){
        var type = child.get('_type');
        if ( type == "hierarchicalrequirement" ) {
            var parent = child.get('Parent') || child.get('PortfolioItem');
            child.set('parent',parent);
            return parent;
        }

        if ( /portfolio/.test(type) ) {
            var parent = child.get("Parent");
            child.set('parent', parent);
            return parent;
        }

        if ( type == "task" ) {
            var parent = child.get("WorkProduct");
            child.set('parent', parent);
            return parent;
        }

        if ( type == "defect" ) {
            var parent = child.get("Requirement");
            if ( this.targetType == "TestFolder" || this.targetType == "TestCase") {
                parent = child.get('TestCase');
            }
            child.set('parent', parent);
            return parent;
        }

        if ( type == "testfolder" ) {
            var parent = child.get("Parent");
            child.set('parent', parent);
            return parent;
        }

        if ( type == "testcase" ) {
            var parent = child.get('TestFolder');
            child.set('parent',parent);
            return parent;
        }

        return null;
    },

    _fetchByArrayOfValues:function(model_name,oids,field_name){
        var deferred = Ext.create('Deft.Deferred');

        var filters = Ext.create('Rally.data.wsapi.Filter',{property:field_name,value:oids[0]});

        for ( var i=1;i<oids.length;i++ ) {
            filters = filters.or(Ext.create('Rally.data.wsapi.Filter',{
                property:field_name,
                value:oids[i]
            }));
        }

        var config = {
            autoLoad: true,
            model: model_name,
            fetch: this._getFetchNames(),
            filters: filters,
            listeners:  {
                scope: this,
                load: function(store, records, success){
                    if (success) {
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Error loading ' + model_name + ' items');
                    }
                }
            }
        };

        if ( this.limitToInScopeFeatures ) {
            this.respectScopeForChildren = true;
        }

        if ( ! this.respectScopeForChildren ) {
            config.context = {
                project: null
            }
        }
        Ext.create('Rally.data.wsapi.Store', config);
        return deferred.promise;
    },

    _doColumnCalculations:function(ordered_items){
        var calculated_items = ordered_items;
        Ext.Array.each(this.columns,function(column){
            if ( column.calculator && column.dataIndex ) {
                calculated_items = CArABU.technicalservices.util.TreeBuilding.rollup({
                    root_items: ordered_items,
                    field_name: column.dataIndex,
                    leaves_only: column.leaves_only,
                    calculator: column.calculator
                });
            }
        });
        return calculated_items;
    },

    _makeStoreAndShowGrid: function(ordered_items){
        this.tree = null;
        if ( ordered_items.length == 0 ) {
            this.add({
                xtype:'container',
                margin: 15,
                html: 'No data found'
            });
        } else {
            Ext.define('TSTreeModelWithAdditions', {
                extend: 'TSTreeModel',
                fields: this._getFetchFields()
            });

            var tree_store = Ext.create('Ext.data.TreeStore',{
                model: TSTreeModelWithAdditions,
                root: {
                    expanded: false,
                    children: ordered_items
                }
            });

            var config = this._getTreeConfig(tree_store);
            this.grid= this.add(config);
        }

        this.fireEvent('aftertree',this,this.grid);
    },

    getGrid: function() {
        return this.grid;
    },

    _getTreeConfig: function(tree_store) {
        var config = {
            xtype:'treepanel',
            context: Rally.getApp().getContext(),
            region: 'center',
            store: tree_store,
            cls: this.tree_cls,
            rootVisible: false,
            enableColumnMove: true,
            sortableColumns: true,
            autoScroll: true,
            rowLines: true,
            width: this.width,
            height: this.height,
            columns: this.columns,
            plugins: [{ptype: 'rallyboardformattedidhoverable'}],
            getRecord: function(tr) {
                return this.view.getRecord(tr);
            },
            listeners: {
                scope: this,
                columnmove: function() {
                    this.fireEvent('columnschanged',this);
                },
                columnsave: function() {
                    this.fireEvent('columnschanged',this);
                },
                columnresize: function(){
                    this.fireEvent('columnschanged',this);
                },
                columnshow: function() {
                    this.fireEvent('columnschanged',this);
                }
            }
        };
        if ( this.context ) {
            Ext.Object.merge(config,{
                stateful: true,
                stateId: this.context.getScopedStateId('ms-tree-grid'),
                stateEvents: ['columnmove','columnsave','columnresize','columnshow']
            });
        }
        return config;
    },

    _fetchPortfolioNames: function(){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store', {
            autoLoad: true,
            model: 'TypeDefinition',
            sorters: [{
              property: 'Ordinal',
              direction: 'ASC'
            }],
            filters: [{
              property: 'Parent.Name',
              operator: '=',
              value: 'Portfolio Item'
            }, {
              property: 'Creatable',
              operator: '=',
              value: true
            }],
            listeners:  {
                scope: this,
                load: function(store, records, success){
                    if (success) {
                        var pi_model_names = _.map(records, function (rec) { return rec.get('TypePath'); });
                        deferred.resolve(pi_model_names);
                    } else {
                        deferred.reject('Error loading portofolio item names.');
                    }
               }
           }
        });
        return deferred.promise;
    },

    // TODO: automatically set type
    _getFetchFields: function() {
        var base_fields = [
            { name: 'ObjectID', type: 'auto' },
            { name: 'Name', type: 'string' },
            { name: '_type', type: 'string' },
            { name: 'Workspace', type: 'object' } // required for popover
        ];

        var additional_fields = Ext.Array.map(this.columns,function(column){
            var config = { name: column.dataIndex, type: 'auto' };
            if ( column.convert ) {
                config.convert = column.convert;
            }
            return config;
        });

        return Ext.Array.merge(base_fields,additional_fields);
    },

    _getFetchNames: function() {
        var base_field_names = ['ObjectID','_type','Name','Workspace'];
        var parent_field_names = ['Parent','PortfolioItem','Requirement','WorkProduct','TestFolder','TestCase'];
        var children_field_names = ['Children','Tasks','UserStories','TestCases','Milestones'];

        var field_names = Ext.Array.merge(base_field_names,children_field_names);
        field_names = Ext.Array.merge(field_names,parent_field_names);

        Ext.Array.each(this.columns, function(column){
            field_names = Ext.Array.merge(field_names,[column.dataIndex]);
            if ( column.otherFields ) {
                field_names = Ext.Array.merge(field_names,column.otherFields);
            }
        });

        return field_names;
    }
});
