var testLevel = "meteor-d3graph tests - ClusteringNodeProvider - ";

function setupDummyNetwork(clusteringNodeProvider) {
    var nodeSettings = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    _(nodeSettings).each(function (nodeSetting) { clusteringNodeProvider.addNode(nodeSetting); });

    var linkSettings = [{ from: "1", to: "2" }, { from: "1", to: "3" }];
    _(linkSettings).each(function (linkSetting) { clusteringNodeProvider.addLink(linkSetting); });
 }

Tinytest.add(testLevel + 'test addNode and addLink without clusters', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    
    // Execute
    setupDummyNetwork(clusteringNodeProvider);
    
    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    testArrayProperty(test, visNodes, "id", ["1", "2", "3", "4"]);

    test.equal(visLinks.length, 2, "With no clusters, both links should be visible");

    test.equal(visLinks[0].id, "1->2", "First link should have id 1->2");
    test.equal(visLinks[0].source.id, "1", "First link should point from node 1");
    test.equal(visLinks[0].target.id, "2", "First ink should point to node 2");

    test.equal(visLinks[1].id, "1->3", "Second link should have id 1->3");
    test.equal(visLinks[1].source.id, "1", "Second link should point from node 1");
    test.equal(visLinks[1].target.id, "3", "Second link should point to node 3");
});

Tinytest.add(testLevel + 'test removeNode without clusters', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    d3graphStub._clusteringNodeProvider = clusteringNodeProvider;
    setupDummyNetwork(clusteringNodeProvider);
    
    // Execute
    clusteringNodeProvider.removeNode("2", null, true);
    
    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    testArrayProperty(test, visNodes, "id", ["1", "3", "4"]);

    test.equal(visLinks.length, 1, "Only the link from 1 - 3 should be left");
    test.equal(visLinks[0].id, "1->3", "Second link should have id 1->3");
    test.equal(visLinks[0].source.id, "1", "Second link should point from node 1");
    test.equal(visLinks[0].target.id, "3", "Second link should point to node 3");
});

Tinytest.add(testLevel + 'test removeNode where node is only node in cluster', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    d3graphStub._clusteringNodeProvider = clusteringNodeProvider;

    var nodeSettings = [{ id: "1" }, { id: "2", clusterId: "cluster" }, { id: "3" }, { id: "4" }];
    _(nodeSettings).each(function (nodeSetting) { clusteringNodeProvider.addNode(nodeSetting); });

    var linkSettings = [{ from: "1", to: "2" }, { from: "1", to: "3" }];
    _(linkSettings).each(function (linkSetting) { clusteringNodeProvider.addLink(linkSetting); });
    
    // Execute
    clusteringNodeProvider.removeNode("2", null, true);
    
    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    testArrayProperty(test, visNodes, "id", ["1", "3", "4"]);

    test.equal(visLinks.length, 1, "Only the link from 1 - 3 should be left");
    test.equal(visLinks[0].id, "1->3", "Second link should have id 1->3");
    test.equal(visLinks[0].source.id, "1", "Second link should point from node 1");
    test.equal(visLinks[0].target.id, "3", "Second link should point to node 3");    
    
    var clusters = clusteringNodeProvider.getVisClusters();
    test.equal(clusters.length, 0, "There should be no clusters");
});

Tinytest.add(testLevel + "simple test of calcluate()", function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    d3graphStub._clusteringNodeProvider = clusteringNodeProvider;
    d3graphStub.settings = { minRadius: 10, maxRadius: 40 };

    var nodeSettings = [{ id: "1", weight: 1 }, { id: "2", weight: 2 }, { id: "3",weight: 3 }, { id: "4", weight: 4 }];
    _(nodeSettings).each(function (nodeSetting) { clusteringNodeProvider.addNode(nodeSetting); });

    var linkSettings = [{ from: "1", to: "2", weight: 1 }, { from: "1", to: "3", weight: 2 }];
    _(linkSettings).each(function (linkSetting) { clusteringNodeProvider.addLink(linkSetting); });
    
    // Execute
    clusteringNodeProvider.calculate();
    
    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    testArrayProperty(test, visNodes, "radius", [10, 20, 30, 40]);
    testArrayProperty(test, visNodes, "color", ["rgb(255,0,0)", "rgb(170,85,0)", "rgb(85,170,0)", "rgb(0,255,0)"]);

    var visLinks = clusteringNodeProvider.getVisLinks();
    testArrayProperty(test, visLinks, "normalized", [0, 1]);
});

/* This doesn't work because it modifies the svg so it cannot mock d3graph.

Tinytest.add(testLevel + "simple moveNodes() test", function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    d3graphStub._d3styles.settings = { nodeBorderSize: 1 };
    d3graphStub.force = { stop: function () {} };
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    d3graphStub._clusteringNodeProvider = clusteringNodeProvider;
    setupDummyNetwork(clusteringNodeProvider);

    var positions = [{ id: "1", color: "#0000ff" }, { id: "2", color: "#ff00ff" }];
    
    // Execute
    clusteringNodeProvider.moveNodes(positions, 250, true);
    
    // Verify
});

*/

Tinytest.add(testLevel + "test updateMarkers", function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var el =  $("<div />");
    d3graphStub.markers = d3.select(el[0]).append("svg:svg").append("svg:defs");
    d3graphStub.d3styles = function () { return { colors: { linkMin: "#ff0000", linkMax: "#00ff00", nodeMin: "#ff0000", nodeMax: "#00ff00" } }; }
    d3graphStub.settings = { minMarkerSize: 10, maxMarkerSize: 100 };
    
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);

    var nodeSettings = [{ id: "fromNode" }, { id: "toNode" }];
    _(nodeSettings).each(function (nodeSetting) { clusteringNodeProvider.addNode(nodeSetting); });

    var linkSettings = [{ from: "fromNode", to: "toNode" }];
    _(linkSettings).each(function (linkSetting) { clusteringNodeProvider.addLink(linkSetting); });

    // Execute
    clusteringNodeProvider.updateMarkers();
    
    // Verify
    var markerElements = el.find("marker");
    test.equal(markerElements.length, 11, "There should be 10 markers for one link color, plus a tracker-marker");
    
    test.equal(markerElements[0].getAttribute("markerWidth"), "50", "First marker should be 50 pixels wide");
    test.equal(markerElements[0].getAttribute("markerHeight"), "30", "First marker should be 30 pixels wide");
});
