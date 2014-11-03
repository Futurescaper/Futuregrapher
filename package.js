Package.describe({
    summary: "Network visualization library",
    version: "1.0.0",
    name: "futurescaper:futuregrapher",
    git: "https://github.com/Futurescaper/futuregrapher.git"
});

Package.onUse(function(api, where) {
    api.versionsFrom('METEOR@0.9.0');
    api.use(['d3', 'jquery'], 'client');
    api.addFiles(['dist/futuregrapher.js'], ['client']);
    api.export('futuregrapher');
});

Package.on_test(function (api) {
    api.use(["d3", "tinytest", "test-helpers"]);
    api.addFiles(['dist/futuregrapher.js'], ["client"]);
    api.addFiles([
        "test/jquery-simulate/jquery.simulate.js",
        "test/stubs.js", "test/helpers.js",
        "test/graphvis-tests.js"
    ], ["client"]);
});

