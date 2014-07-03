// These are the default options that the renderer will use if not overridden in the options parameter
// for the constructor.

define(function(require) {
    var defaultSvgRendererOptions = {
        layerIds: ["clusters", "links", "nodes", "labels"]  // First one becomes the bottom layer
    };

    return defaultSvgRendererOptions;
});