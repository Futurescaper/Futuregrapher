define(function(require) {
    var autoZoomer = function (renderer) {
        var enabled = true;
        var margin = 20;
        var zoomExtent = [0.25, 4];
        var terminateAt;
        var fix = null;
    
        function zoom (renderElements, scale, translate) {
            if (!enabled) return {};
                
            // If we're in "fixed" mode, just return that.
            if (fix) return fix;
                
            // If we've passed the planned death time, disable ourselves.
            if (terminateAt && new Date().getTime() > terminateAt) {
                terminateAt = null;
                enabled = false;
                return {};
            }
                
            var xExtent = d3.extent(renderElements.nodeCircles, function (nc) { return nc.x; });
            var yExtent = d3.extent(renderElements.nodeCircles, function (nc) { return nc.y; });
    
            if (!xExtent[0] || !yExtent[0])     // If there are no nodes, don't modify anything.
                return {};
    
            var canvasWidth = renderer.width() - margin * 2;
            var canvasHeight = renderer.height() - margin * 2;
            
            var canvasCenterX = canvasWidth / 2;
            var canvasCenterY = canvasHeight / 2;
    
            var nodeSpaceWidth = xExtent[1] - xExtent[0];
            var nodeSpaceHeight = yExtent[1] - yExtent[0];
            
            var nodeCenterX = xExtent[0] + nodeSpaceWidth / 2;
            var nodeCenterY = yExtent[0] + nodeSpaceHeight / 2;
            
            var newScale = Math.min(canvasHeight / nodeSpaceHeight, canvasWidth / nodeSpaceWidth);
            
            if (newScale < zoomExtent[0]) scale = zoomExtent[0];
            if (newScale > zoomExtent[1]) scale = zoomExtent[1];
            
            var x = canvasCenterX - nodeCenterX * newScale + margin;
            var y = canvasCenterY - nodeCenterY * newScale + margin;
    
            return {
                scale: newScale,
                translate: [x, y]
            };
        }
    
        zoom.enable = function () {
            fix = null;     // Enable means not fixed mode.
            enabled = true;
            return zoom;
        }
        
        zoom.disable = function () {
            enabled = false;
            return zoom;
        }
        
        zoom.enabled = function () {
            return enabled;
        }
    
        // Set an object to return: { scale: ..., translate: [...] }
        zoom.fix = function (newFix) {
            if (!arguments.length) return fix;
            
            fix = newFix;
            enabled = true;
            terminateAt = null;
            return zoom;
        }
    
        zoom.margin = function (newMargin) {
            if (!arguments.length) return margin;
            
            margin = newMargin;
            return zoom;
        };
        
        zoom.zoomExtent = function (newZoomExtent) {
            if (!arguments.length) return zoomExtent;
            
            zoomExtent = newZoomExtent;
            return zoom;
        };
        
        zoom.terminateIn = function (milliseconds) {
            var now = new Date().getTime();
            if (!arguments.length) return terminateAt - now;  // Return the number of milliseconds left before we terminate
    
            fix = null;     // Enable means not fixed mode.
            enabled = true;
            terminateAt = now + milliseconds;
            return zoom;
        };
    
        return zoom;
    };

    return autoZoomer;
});
