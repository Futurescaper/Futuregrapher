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