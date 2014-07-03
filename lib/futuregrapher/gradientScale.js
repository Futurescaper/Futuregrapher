define(function(require) {
    var gradientScale = function () {
        var domain = [0, 1],
            range = ["#333", "#aaa"],
            domainScale = d3.scale.linear(),
            rangeScale = d3.scale.linear().range(range);
    
        function rescale() {
            domainScale
                .domain(domain)
                .range([0, range.length - 1]);
                
            rangeScale
                .domain(d3.range(0, range.length))
                .range(range);
            
            return scale;
        }
        
        function scale(x) {
            return rangeScale(domainScale(x));
        }
        
        scale.domain = function (x) {
            if (!arguments.length) return domain;
            domain = x;
            return rescale();
        };
        
        scale.range = function (x) {
            if (!arguments.length) return range;
            range = x;
            return rescale();
        };
        
        return rescale();
    }

    return gradientScale;
});