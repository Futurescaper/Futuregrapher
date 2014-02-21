function setupDummyNetwork(clusteringNodeProvider) {
    var nodeSettings = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    _(nodeSettings).each(function (nodeSetting) { clusteringNodeProvider.addNode(nodeSetting); });

    var linkSettings = [{ from: "1", to: "2" }, { from: "1", to: "3" }];
    _(linkSettings).each(function (linkSetting) { clusteringNodeProvider.addLink(linkSetting); });
 }

Tinytest.add('d3graph tests - ClusteringNodeProvider - updateClusters test, no clusters', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    setupDummyNetwork(clusteringNodeProvider);    
    
    // Execute
    clusteringNodeProvider.updateClusters();
    
    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    test.equal(visNodes.length, 4, "With no clusters, all four nodes should be visible");
    test.equal(visLinks.length, 2, "With no clusters, both links should be visible");
});

Tinytest.add('d3graph tests - ClusteringNodeProvider - updateClusters test, with clusters', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    setupDummyNetwork(clusteringNodeProvider);    
    
    // Execute
    clusteringNodeProvider.getNode("1").clusterId = "cluster 1";
    clusteringNodeProvider.getNode("2").clusterId = "cluster 1";
    clusteringNodeProvider.updateClusters();
    
    // Verify
    
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    test.equal(visNodes.length, 4, "With no clusters, all four nodes should be visible");
    test.equal(visLinks.length, 2, "With no clusters, both links should be visible");
});
