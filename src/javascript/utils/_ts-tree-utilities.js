/*
 * A series of utilities to help construct trees
 * with data gotten bottom or middle-up
 *
 */

Ext.define('CArABU.technicalservices.util.TreeBuilding', {
    singleton: true,
    logger: new CArABU.technicalservices.Logger(),
    /*
     * Given a hash of hashes (key = object id) that all know what
     * their parent is (based on the "parent" field -- note lowercase)
     * Return an array of models that are at the root level and
     * have a "children" field (note lowercase)
     * with appropriate items in an array
     */
    constructRootItems:function(item_hash) {
        var root_array = [];
        Ext.Object.each(item_hash, function(oid,item){
            if ( !item.get('children') ) { item.set('children',[]); }
            item.set('__parent',0);

            if ( item.get('Milestones') ) {
                var tagArray = item.get('Milestones')._tagsNameArray;
                Ext.Array.each(tagArray, function(tag){
                    var oid = parseInt(tag._ref.replace(/.*\//,''), 10);
                    if ( item_hash[oid] ) {
                        var childArray = item_hash[oid].get('children');
                        var clone = item.copy();
                        clone.set('__parent',oid);

                        childArray.push(clone);
                        item_hash[oid].set('children',childArray);
                    }
                });
            } else {
                root_array.push(item);
            }
        },this);
        return root_array;
    },
    /*
     * Given a hash of hashes (key = object id) that all know what
     * their parent is (based on the "parent" field -- note lowercase)
     * Return an array of models that are at the root level and
     * have a "children" field (note lowercase)
     * with appropriate items in an array
     */
    constructRootItemsFromHashes:function(item_hash) {
        var root_array = [];
        Ext.Object.each(item_hash, function(oid,item){
            if ( !item.children ) { item.children = []; }
            var direct_parent = item.parent;
            if (!direct_parent && !Ext.Array.contains(root_array,item)) {
                root_array.push(item);
            } else {

                var parent_oid =  direct_parent.ObjectID;
                if (!item_hash[parent_oid]) {
                    this.logger.log("Saved parent missing: ", parent_oid);
                    if ( !Ext.Array.contains(root_array,item) ) {
                        root_array.push(item);
                    }
                } else {
                    var parent = item_hash[parent_oid];
                    if ( !parent.children ) { parent.children = []; }
                    var kids = parent.children;
                    kids.push(item);
                    parent.children = kids;
                }
            }
        },this);
        return root_array;
    },
    /**
     * Given an array of models, turn them into hashes
     */
    convertModelsToHashes: function(model_array) {
        var hash_array = [];
        Ext.Array.each(model_array,function(model){
            if (this.isModel(model)) {
                var model_as_hash = model.data;
                model_as_hash.expanded = false;
                model_as_hash.leaf = false;

                // children & parent are fields that are not a
                // part of the model def'n so getData doesn't provide them
                if ( model.get('children') ) {
                    model_as_hash.children = this.convertModelsToHashes(model.get('children'));
                }
                if ( model.get('parent') ) {
                    if ( this.isModel(model.get('parent') ) ) {
                        model_as_hash.parent = model.get('parent').getData();
                    } else {
                        model_as_hash.parent = model.get('parent');
                    }
                }

                if (!model_as_hash.children || model_as_hash.children.length === 0 ) {
                    model_as_hash.leaf = true;
                }

                hash_array.push(model_as_hash);
            } else {
                hash_array.push(model);
            }
        },this);
        return hash_array;
    },
    isModel: function(model){
        return model && ( model instanceof Ext.data.Model );
    },
    /**
     * Given an array of top-level models (will have field called 'children' holding more models),
     * roll up the value in the bottom of the tree's field_name
     *
     * Config object has these values:
     *
     * @param [{Ext.data.model}] root_items
     * @param {String} field_name
     * @param {Boolean} leaves_only (true to ignore parent value, false to add children to parent's existing value)
     * @param {String|fn} calculator [ 'count' ]
     */
    rollup: function(config){
        Ext.Array.each(config.root_items,function(root_item){
            this._setValueFromChildren(root_item,config.field_name,config.calculator,config.leaves_only);
        },this);
        return config.root_items;
    },
    _setValueFromChildren:function(parent_item,field_name,calculator,leaves_only){
        var parent_value = 0;
        var children = [];
        if ( _.isFunction(parent_item.get) ) {
            parent_value = parent_item.get(field_name) || 0;
            children = parent_item.get('children') || [];
        } else {
            parent_value = parent_item[field_name] || 0;
        }
        if ( leaves_only && children.length > 0 ) { parent_value = 0; }

        Ext.Array.each(children,function(child_item) {
            this._setValueFromChildren(child_item,field_name,calculator,leaves_only);
            var child_value = 0;
            if ( _.isFunction(child_item.get) ) {
                child_value = child_item.get(field_name) || 0;
            } else {
                child_value = child_item[field_name] || 0;
            }

            if ( calculator ) {
               this._calculateAndSetParent(child_item,parent_item,field_name,calculator);
            }
        },this);
        return;
    },
    _calculateAndSetParent:function(child_item,parent_item,field_name,calculator){
        'use strict';
        if ( calculator == 'count' ) {
            var parent_val = parent_item.get(field_name) || 0;
            var child_val = child_item.get(field_name) || 0;
            parent_item.set(field_name, parent_val + child_val);
            return;
        }
        var val = calculator(child_item,parent_item);
        parent_item.set(field_name,val);
    },
    /**
     * Given an array of root items, find nodes in the tree where field_name contains field_value
     * and prune them
     *
     * @param {} root_items
     * @param {} field_name
     * @param {} field_value
     * @return {}
     */
    pruneByFieldValue: function(root_items,field_name,field_value){
        Ext.Array.each(root_items,function(root_item){
            this._removeByFieldValue(root_items,root_item,field_name,field_value);
        },this);
        return root_items;
    },
    _removeByFieldValue: function(parent_array,parent_item,field_name,field_value){
        var tester = new RegExp(field_value);

        if ( parent_item ) {
            var value = parent_item.get(field_name) || "";
            if ( tester.test(value) ) {
                Ext.Array.remove(parent_array,parent_item);
            } else {
                var kids = parent_item.get('children') || [];
                if ( kids.length > 0 ) {
                    Ext.Array.each(kids, function(kid){
                        this._removeByFieldValue(kids,kid,field_name,field_value);
                    },this);
                }
            }
        }
    },
    removeRootsWithoutChildren: function(items) {
        return Ext.Array.filter(items, function(item){
            return item.get('children') && item.get('children').length > 0;
        });
    }
});
