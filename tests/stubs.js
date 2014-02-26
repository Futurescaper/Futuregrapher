D3graphStub = function () {
    var _links = {};

    this._clusteringNodeProvider = null;

    // Interface
    this.settings = { minRadius: 5, maxRadius: 10 };
    this.events = {};
    this.links = [];
    this.update = function() {};

    this.getAllLinks = function () { return this._clusteringNodeProvider ? this._clusteringNodeProvider.getAllLinks() : this.links; }
    
    this.d3 = function () { return d3; }
};

NodeLibStub = function () {
    var _nodes = {};
    
    this.getNode = function (name) { return _nodes[name]; };
    
    // Stub helpers
    this.stubNodes = function (/* node1Name, node2Name, .... */) {
        _(arguments).each(function (nodeName) {
            _nodes[nodeName] = { title: nodeName, to: [], from: [] };
        });
    }
};
