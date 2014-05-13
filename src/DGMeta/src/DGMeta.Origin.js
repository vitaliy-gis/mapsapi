DG.Meta.Origin = DG.Class.extend({
    
    options : {
        subdomains : 'abc',
        dataFilter : null
    },

    _url : false,

    initialize: function (url, options) {
        this._url = url;
        this._requests = {};
        
        this._tileStorage = {};
        this._dataStorage = {};

        options = L.setOptions(this, options);

        if (typeof options.subdomains === 'string') {
            options.subdomains = options.subdomains.split('');
        }
    },

    get: function (coord) {
        var key = this.serializeCoord(coord),
            self = this;

        if (typeof this._tileStorage[key] === 'undefined' && 
            typeof this._requests[key] === 'undefined') {
            this._tileStorage[key] = false;
            this._requests[key] = this._requestData(coord).then(function (data) {
                self.set(coord, self.options.dataFilter ? self.options.dataFilter(data, coord) : data);
            });
        }

        if (this._tileStorage[key].constructor === Object) {
            return Object.keys(this._tileStorage[key]).map(function (id) {
                return DG.extend({ geometry : this._tileStorage[key][id]}, this._dataStorage[id]);
            }, this);
        }

        return this._tileStorage[key];
    },

    set: function (coord, data) {
        var key = this.serializeCoord(coord);

        data.forEach(function (entity) {
            entity.geometry = DG.Wkt.toPoints(entity.geometry);
            if (!this._tileStorage[key]) {
                this._tileStorage[key] = {};
            }
            this._tileStorage[key][entity.id] = entity.geometry;
            delete entity.geometry;
            this._dataStorage[entity.id] = entity;
        }, this);
    },

    flush: function () {
        this._storage = {};
    },

    setURL: function (url) {
        this._url = url;
    },

    serializeCoord : function (coord) {
        return [coord.x, coord.y, coord.z].join(':');
    },

    _requestData: function (key) {
        if (this._url) {
            return this._performRequest(key);
        } else {
            return DG.when([]);
        }
    },

    _performRequest: function (coords) { // (String) -> Promise
        var url = this._prepareURL(coords),
            request = DG.ajax(url, {
                type: 'get',
                dataType: 'json'
            });

        return request;
    },

    _prepareURL: function (coords) {
        return DG.Util.template(this._url, {
            x : coords.x,
            y : coords.y,
            z : coords.z,
            s : this._getSubdomain(coords)
        });
    },

    _getSubdomain: DG.TileLayer.prototype._getSubdomain

});

DG.Meta.origin = function (source, options) {
    if (source instanceof DG.Meta.Origin) {
        return source;
    }
    return new DG.Meta.Origin(source, options);
};