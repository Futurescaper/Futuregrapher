D3graphStub = function () {
    var _links = {};
    
    this._d3styles = { colors: { nodeMin: "#ff0000", nodeMax: "#00ff00" } };
    this._clusteringNodeProvider = null;

    // Interface
    this.settings = { minRadius: 5, maxRadius: 10 };
    this.events = {};
    this.links = [];
    this.update = function() {};

    this.getAllLinks = function () { return this._clusteringNodeProvider ? this._clusteringNodeProvider.getAllLinks() : this.links; }
    
    this.d3 = function () { return d3; }

    this.d3styles = function () { return this._d3styles; };
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

ClusteringNodeProviderStub = function () {
    this.updateMarkers = function () {};
    
    this.getVisNodes = function () { return []; }
    this.getVisLinks = function () { return []; }
    this.getVisClusters = function () { return []; }
    
    this.getCenter = function () { return null; }

    this.updateSizesForZoom = function () {}
    
    this.addNode = function () {};
}
