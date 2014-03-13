Package.describe({
    summary: "Create and manipulate D3 force-directed graphs"
});

var libFiles = [
        'canvg/rgbcolor.js',
        'canvg/StackColor.js',
        'canvg/canvg.js',
        'geostats/geostats.min.js',
        'geostats/jenks.util.js',
        'tipsy/tipsy.js',
        'dictionary.js',
        'colors.js',
        'ClusteringNodeProvider.js',
        'nodes.js',
        'highlights.js',
        'labels.js',
        'links.js',
        'selector.js',
        'styles.js',
        'tags.js',
        'zoomer.js',
        'd3graph.js',
        'd3treelayout.js'
    ];

Package.on_use(function(api, where) {
    api.use(['d3', 'jquery'], 'client');
    api.add_files(libFiles, ["client"]);

    if (api.export) {
        api.export('d3graph');
        api.export('d3treelayout');
        api.export('d3colors');
        api.export('d3color');
        api.export('d3selector');
    }
});

Package.on_test(function (api) {
    api.use(["d3", "tinytest", "test-helpers"]);

    api.add_files(libFiles, ["client"]);
    api.add_files(["tests/stubs.js", "tests/helpers.js",
        "tests/d3graph-tests.js", 
        "tests/d3links-tests.js",
        "tests/clusteringnodeprovider-tests.js", 
        "tests/clusteringnodeprovider-clustering-tests.js",
        "tests/d3zoomer-tests.js"
    ], ["client"]);
});