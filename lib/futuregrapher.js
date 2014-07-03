define(function(require) {
    var futuregrapher = require('futuregrapher/core');
    futuregrapher.TypeChecker = require('futuregrapher/typechecker');

    futuregrapher.SvgRenderer = require('futuregrapher/svgrenderer');
    futuregrapher.GraphVis = require('futuregrapher/graphvis');

    futuregrapher.VisNode = require('futuregrapher/visnode');
    futuregrapher.VisLink = require('futuregrapher/vislink');
    futuregrapher.VisCluster = require('futuregrapher/viscluster');

    futuregrapher.NodeCircle = require('futuregrapher/nodecircle');
    futuregrapher.LabelText = require('futuregrapher/labeltext');
    futuregrapher.LinkLine = require('futuregrapher/linkline');
    futuregrapher.ClusterHull = require('futuregrapher/clusterhull');
    
    futuregrapher.autoZoomer = require('futuregrapher/autozoomer');
    futuregrapher.autoRadiusScale = require('futuregrapher/autoradiusscale');
    futuregrapher.gradientScale = require('futuregrapher/gradientscale');
    
    return futuregrapher;
});
