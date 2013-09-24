Package.describe({
    summary: "Create and manipulate D3 force-directed graphs"
});

Package.on_use(function(api, where) {
    api.use(['d3'], 'client');
    api.add_files([
        'dictionary.js',
        'd3graph.js',
        'highlights.js',
        'labels.js',
        'links.js',
        'nodes.js',
        'selector.js',
        'styles.js',
        'tags.js',
        'themes.js',
        'zoomer.js'
    ]);

    if (api.export)
        api.export("d3graph");
});