Package.describe({
    summary: "Network visualization library"
});

Package.on_use(function(api, where) {
    api.use(['d3', 'jquery'], 'client');
    api.add_files(['dist/futuregrapher.js'], ['client']);
    api.export('futuregrapher');
});

Package.on_test(function (api) {
    api.use(["d3", "tinytest", "test-helpers"]);
    api.add_files(['dist/futuregrapher.js'], ["client"]);
    api.add_files([
        "test/jquery-simulate/jquery.simulate.js",
        "test/stubs.js", "test/helpers.js",
        "test/graphvis-tests.js"
    ], ["client"]);
});

