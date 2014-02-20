Package.describe({
    summary: "Create and manipulate D3 force-directed graphs"
});

Package.on_use(function(api, where) {
    api.use(['d3'], 'client');
    api.add_files([
        'canvg/rgbcolor.js',
        'canvg/StackColor.js',
        'canvg/canvg.js',
        'geostats/geostats.min.js',
        'geostats/jenks.util.js',
        'dictionary.js',
        'colors.js',
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
    ]);

    if (api.export) {
        api.export('d3graph');
        api.export('d3treelayout');
        api.export('d3colors');
        api.export('d3color');
        api.export('d3selector');
    }
});

Package.on_test(function (api) {
    api.use(["meteor-d3graph", "tinytest", "test-helpers"]);
    api.add_files(["tests/links-tests.js"], ["client"]);
});