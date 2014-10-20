define(function(require) {
    var autoRadiusScale = function () {
        var maxRadius = 10,
            maxInputValue = 100;
    
        function rescale() {
            return scale;
        }
        
        function scale(x) {
            return Math.sqrt(maxRadius * maxRadius * (x / maxInputValue));
        }
        
        scale.maxRadius = function (x) {
            if (!arguments.length) return maxRadius;
            maxRadius = x;
            return rescale();
        };
        
        scale.maxInputValue = function (x) {
            if (!arguments.length) return maxInputValue;
            maxInputValue = x;
            return rescale();
        };
        
        return rescale();
    };

    return autoRadiusScale;
});
